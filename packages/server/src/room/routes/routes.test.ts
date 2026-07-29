// ---------------------------------------------------------------------------
// Integration tests for S2 route handlers:
//   pickDeck, ready, unready, leave
// Also: C2 (no socket frame on rejected ready) and C6 (flip winner leave).
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Application } from "express";
import { hash } from "@node-rs/argon2";
import { openDb } from "../../db/openDb.js";
import { createApp } from "../../app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../../catalog/fixture.js";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
import { insertRoom } from "../roomStore.js";
import { ROOM_OPEN_TTL_MS } from "../roomState.js";
import { DuelManager } from "../../duel/duelManager.js";
import { attachDuelWsServer } from "../../duel/duelSocket.js";
import { createRoomWss } from "../roomSocket.js";
import { attachUpgradeRouter } from "../../wsUpgradeRouter.js";
import { FakeEdisonDuel } from "../../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../../duel/engineInterface.js";
import type { RoomSnapshot, RoomServerMessage } from "@yugioh-app/contracts";

// ── Catalog ───────────────────────────────────────────────────────────────

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

// Unlimited, non-extra-deck passcodes from the fixture catalog.
const UNLIMITED_MAIN = [
  89631139, 46986414, 70781052, 5405694, 29401950, 71413901, 28604635, 83011277, 23205979, 71564252,
  24508238, 80441106, 7572887, 89943723,
];

/** Build a legal 40-card main deck from fixture unlimited cards. */
function legalMain(): number[] {
  const main: number[] = [];
  for (let i = 0; i < 13; i++) {
    const code = UNLIMITED_MAIN[i]!;
    main.push(code, code, code);
  }
  main.push(UNLIMITED_MAIN[13]!);
  return main;
}

// ── Fixtures ──────────────────────────────────────────────────────────────

let db: Database.Database;
let app: Application;

beforeEach(() => {
  db = openDb(":memory:");
  app = createApp(db, makeTestCatalog());
});

afterEach(() => {
  db.close();
});

// ── Auth helpers ──────────────────────────────────────────────────────────

async function seedUser(displayName: string): Promise<{ userId: string }> {
  const userId = randomUUID();
  const pw = await hash("pw");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());
  return { userId };
}

async function login(displayName: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ displayName, password: "pw" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  return (
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? ""
  );
}

async function seedAndLogin(displayName: string): Promise<{ sid: string; userId: string }> {
  const { userId } = await seedUser(displayName);
  const sid = await login(displayName);
  return { sid, userId };
}

// ── Room helpers ──────────────────────────────────────────────────────────

function seedRoom(
  creatorUserId: string,
  opts: {
    status?: string;
    opponentUserId?: string | null;
    creatorDeckId?: string | null;
    opponentDeckId?: string | null;
    creatorReadyAt?: number | null;
    opponentReadyAt?: number | null;
    roomDeadlineAt?: number;
    createdAt?: number;
  } = {},
): { roomId: string } {
  const roomId = randomUUID();
  const now = Date.now();
  insertRoom(db, {
    id: roomId,
    joinToken: randomUUID(),
    creatorUserId,
    perMoveSeconds: 300,
    seed: 42n,
    roomDeadlineAt: opts.roomDeadlineAt ?? now + ROOM_OPEN_TTL_MS,
    createdAt: opts.createdAt ?? now - 60_000, // 1 minute ago
  });
  if (opts.status && opts.status !== "open") {
    db.prepare("UPDATE duel_room SET status = ? WHERE id = ?").run(opts.status, roomId);
  }
  if (opts.opponentUserId !== undefined) {
    db.prepare("UPDATE duel_room SET opponent_user_id = ? WHERE id = ?").run(
      opts.opponentUserId,
      roomId,
    );
  }
  if (opts.creatorDeckId !== undefined) {
    db.prepare("UPDATE duel_room SET creator_deck_id = ? WHERE id = ?").run(
      opts.creatorDeckId,
      roomId,
    );
  }
  if (opts.opponentDeckId !== undefined) {
    db.prepare("UPDATE duel_room SET opponent_deck_id = ? WHERE id = ?").run(
      opts.opponentDeckId,
      roomId,
    );
  }
  if (opts.creatorReadyAt !== undefined) {
    db.prepare("UPDATE duel_room SET creator_ready_at = ? WHERE id = ?").run(
      opts.creatorReadyAt,
      roomId,
    );
  }
  if (opts.opponentReadyAt !== undefined) {
    db.prepare("UPDATE duel_room SET opponent_ready_at = ? WHERE id = ?").run(
      opts.opponentReadyAt,
      roomId,
    );
  }
  return { roomId };
}

/** Insert a legal deck row into the DB. */
function seedDeck(ownerId: string, name = "Test Deck"): string {
  const deckId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, ?)",
  ).run(deckId, ownerId, name, JSON.stringify(legalMain()), now, now);
  return deckId;
}

/** Insert an illegal deck (main deck too small — only 1 card). */
function seedIllegalDeck(ownerId: string): string {
  const deckId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, '[]', '[]', 0, ?, ?)",
  ).run(deckId, ownerId, "Illegal Deck", JSON.stringify([89631139]), now, now);
  return deckId;
}

// ── pickDeck tests ────────────────────────────────────────────────────────

describe("POST /api/duels/:id/room/deck (pickDeck)", () => {
  it("stores a deck reference for the creator while status=open", async () => {
    const { sid, userId } = await seedAndLogin("Creator");
    const { roomId } = seedRoom(userId, { status: "open" });
    const deckId = seedDeck(userId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.deckSelected).toBe(true);

    // Persisted server-side
    const row = db.prepare("SELECT creator_deck_id FROM duel_room WHERE id = ?").get(roomId) as {
      creator_deck_id: string;
    };
    expect(row.creator_deck_id).toBe(deckId);
  });

  it("stores a deck reference for the creator while status=filled", async () => {
    const { sid, userId: creatorId } = await seedAndLogin("Creator2");
    const { userId: oppId } = await seedUser("Opp2");
    const { roomId } = seedRoom(creatorId, { status: "filled", opponentUserId: oppId });
    const deckId = seedDeck(creatorId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.deckSelected).toBe(true);
  });

  it("allows the invitee to pick a deck (E14)", async () => {
    const { userId: creatorId } = await seedUser("CreatorE14");
    const { sid: oppSid, userId: oppId } = await seedAndLogin("OppE14");
    const { roomId } = seedRoom(creatorId, { status: "filled", opponentUserId: oppId });
    const deckId = seedDeck(oppId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oppSid}`)
      .send({ deckId });

    expect(res.status).toBe(200);
    // Deck name/count in caller's view
    const snap = res.body as RoomSnapshot;
    expect(snap.you.deckSelected).toBe(true);
    expect(snap.you.deckName).toBeTruthy();
  });

  it("allows deck changes before ready (E15)", async () => {
    const { sid, userId } = await seedAndLogin("CreatorE15");
    const { userId: oppId } = await seedUser("OppE15");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: oppId });
    const deckId1 = seedDeck(userId, "Deck 1");
    const deckId2 = seedDeck(userId, "Deck 2");

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId: deckId1 });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId: deckId2 });

    expect(res.status).toBe(200);
    const row = db.prepare("SELECT creator_deck_id FROM duel_room WHERE id = ?").get(roomId) as {
      creator_deck_id: string;
    };
    expect(row.creator_deck_id).toBe(deckId2);
  });

  it("rejects deck pick by already-ready occupant (E30, AC1)", async () => {
    const { sid, userId } = await seedAndLogin("CreatorE30");
    const { userId: oppId } = await seedUser("OppE30");
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorReadyAt: Date.now() - 1000,
    });
    const deckId = seedDeck(userId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_ready");
  });

  it("rejects deck pick for a deck not owned by caller", async () => {
    const { sid, userId } = await seedAndLogin("Creator-own");
    const { userId: other } = await seedUser("Other-own");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: other });
    const deckId = seedDeck(other); // owned by other

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_invalid");
  });

  it("returns 403 for non-occupant", async () => {
    const { userId: creatorId } = await seedUser("Creator-403");
    const { sid: strangeSid } = await seedAndLogin("Stranger-403");
    const { roomId } = seedRoom(creatorId, { status: "filled" });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${strangeSid}`)
      .send({ deckId: randomUUID() });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_occupant");
  });

  it("closes expired room and returns 410", async () => {
    const { sid, userId } = await seedAndLogin("Creator-exp");
    const { roomId } = seedRoom(userId, { status: "open", roomDeadlineAt: Date.now() - 1000 });
    const deckId = seedDeck(userId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
  });
});

// ── ready tests ───────────────────────────────────────────────────────────

describe("POST /api/duels/:id/room/ready (ready)", () => {
  it("readies a player with a valid deck (E25, AC2)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-rdy");
    const { userId: oppId } = await seedUser("Opp-rdy");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: oppId });
    const deckId = seedDeck(userId);
    db.prepare("UPDATE duel_room SET creator_deck_id = ? WHERE id = ?").run(deckId, roomId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.ready).toBe(true);
    expect(snap.you.deckLocked).toBe(true);

    // Rebase deadline (E25)
    const row = db
      .prepare("SELECT creator_ready_at, room_deadline_at FROM duel_room WHERE id = ?")
      .get(roomId) as { creator_ready_at: number; room_deadline_at: number };
    expect(row.creator_ready_at).toBeGreaterThan(0);
    expect(row.room_deadline_at).toBeGreaterThan(Date.now() + 9 * 60 * 1000); // ~10 min from now
  });

  it("rejects ready with no deck picked (deck_required, E26, AC4)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-nodeck");
    const { userId: oppId } = await seedUser("Opp-nodeck");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: oppId });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_required");

    // Other occupant snapshot unchanged (AC3)
    const row = db.prepare("SELECT creator_ready_at FROM duel_room WHERE id = ?").get(roomId) as {
      creator_ready_at: null;
    };
    expect(row.creator_ready_at).toBeNull();
  });

  it("is idempotent: ready twice with same deck returns 200 (E29, AC4)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-idempotent");
    const { userId: oppId } = await seedUser("Opp-idempotent");
    const deckId = randomUUID();
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorDeckId: deckId,
      creatorReadyAt: Date.now() - 1000,
    });
    // Insert a deck_json snapshot (simulating first ready already happened)
    db.prepare("UPDATE duel_room SET creator_deck_json = ? WHERE id = ?").run(
      JSON.stringify({ main: [], extra: [] }),
      roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
  });

  it("rejects ready with an illegal deck (deck_invalid, E28, AC2)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-illegal");
    const { userId: oppId } = await seedUser("Opp-illegal");
    const illegalDeckId = seedIllegalDeck(userId);
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorDeckId: illegalDeckId,
    });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_invalid");
    expect(res.body.error.validation).toBeDefined();

    // Zero observable change to opponent (AC3): no ready_at set
    const row = db.prepare("SELECT creator_ready_at FROM duel_room WHERE id = ?").get(roomId) as {
      creator_ready_at: null;
    };
    expect(row.creator_ready_at).toBeNull();
  });

  it("clears stale deck reference when deck was deleted (E27)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-deleted");
    const { userId: oppId } = await seedUser("Opp-deleted");
    const nonExistentDeckId = randomUUID();
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorDeckId: nonExistentDeckId,
    });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_invalid");

    // Deck reference cleared
    const row = db.prepare("SELECT creator_deck_id FROM duel_room WHERE id = ?").get(roomId) as {
      creator_deck_id: null;
    };
    expect(row.creator_deck_id).toBeNull();

    // No ready_at set (AC3)
    const readyRow = db
      .prepare("SELECT creator_ready_at FROM duel_room WHERE id = ?")
      .get(roomId) as { creator_ready_at: null };
    expect(readyRow.creator_ready_at).toBeNull();
  });

  it("fires flip when both players ready (T5)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("Creator-flip");
    const { sid: oSid, userId: oId } = await seedAndLogin("Opp-flip");
    const { roomId } = seedRoom(cId, { status: "filled", opponentUserId: oId });
    const cDeckId = seedDeck(cId, "C Deck");
    const oDeckId = seedDeck(oId, "O Deck");
    db.prepare("UPDATE duel_room SET creator_deck_id = ?, opponent_deck_id = ? WHERE id = ?").run(
      cDeckId,
      oDeckId,
      roomId,
    );

    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${oSid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("awaiting_choice");
    expect(snap.flip).not.toBeNull();
    expect(snap.flip!.winnerUserId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects ready in wrong state (not filled)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-ws");
    const { roomId } = seedRoom(userId, { status: "open" });
    const deckId = seedDeck(userId);
    db.prepare("UPDATE duel_room SET creator_deck_id = ? WHERE id = ?").run(deckId, roomId);

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("wrong_state");
  });

  it("closes expired room first and rejects ready (E35, AC12)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-exp2");
    const { userId: oppId } = await seedUser("Opp-exp2");
    const deckId = seedDeck(userId);
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorDeckId: deckId,
      roomDeadlineAt: Date.now() - 1000,
    });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
    const row = db
      .prepare("SELECT status, creator_ready_at FROM duel_room WHERE id = ?")
      .get(roomId) as { status: string; creator_ready_at: null };
    expect(row.status).toBe("closed");
    expect(row.creator_ready_at).toBeNull();
  });
});

// ── unready tests ─────────────────────────────────────────────────────────

describe("POST /api/duels/:id/room/unready (unready)", () => {
  it("clears ready flag and locked snapshot (AC6)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-unrdy");
    const { userId: oppId } = await seedUser("Opp-unrdy");
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorReadyAt: Date.now() - 1000,
      creatorDeckId: randomUUID(),
    });
    db.prepare("UPDATE duel_room SET creator_deck_json = ? WHERE id = ?").run(
      JSON.stringify({ main: [], extra: [] }),
      roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/unready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.ready).toBe(false);
    expect(snap.you.deckLocked).toBe(false);

    const row = db
      .prepare("SELECT creator_ready_at, creator_deck_json FROM duel_room WHERE id = ?")
      .get(roomId) as { creator_ready_at: null; creator_deck_json: null };
    expect(row.creator_ready_at).toBeNull();
    expect(row.creator_deck_json).toBeNull();
  });

  it("does not move room_deadline_at (AC6, R28)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-dead");
    const { userId: oppId } = await seedUser("Opp-dead");
    const deadline = Date.now() + 5 * 60_000; // 5 min from now
    const { roomId } = seedRoom(userId, {
      status: "filled",
      opponentUserId: oppId,
      creatorReadyAt: Date.now() - 1000,
      roomDeadlineAt: deadline,
    });
    db.prepare("UPDATE duel_room SET creator_deck_json = ? WHERE id = ?").run(
      JSON.stringify({ main: [], extra: [] }),
      roomId,
    );

    await request(app).post(`/api/duels/${roomId}/room/unready`).set("Cookie", `sid=${sid}`);

    const row = db.prepare("SELECT room_deadline_at FROM duel_room WHERE id = ?").get(roomId) as {
      room_deadline_at: number;
    };
    expect(row.room_deadline_at).toBe(deadline);
  });

  it("is idempotent when not ready", async () => {
    const { sid, userId } = await seedAndLogin("Creator-idem");
    const { userId: oppId } = await seedUser("Opp-idem");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: oppId });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/unready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
  });

  it("rejects unready in wrong state (not filled)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-unrdy-ws");
    const { roomId } = seedRoom(userId, { status: "open" });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/unready`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("wrong_state");
  });
});

// ── leave tests ───────────────────────────────────────────────────────────

describe("POST /api/duels/:id/room/leave (leave)", () => {
  it("creator leave closes the room for both (E24, AC8)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-leave");
    const { userId: oppId } = await seedUser("Opp-leave");
    const { roomId } = seedRoom(userId, { status: "filled", opponentUserId: oppId });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("left");
  });

  it("creator leave from open state closes the room", async () => {
    const { sid, userId } = await seedAndLogin("Creator-open-leave");
    const { roomId } = seedRoom(userId, { status: "open" });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
  });

  it("opponent leave from filled reverts to open (T11, AC9)", async () => {
    const { userId: cId } = await seedUser("Creator-T11");
    const { sid: oSid, userId: oId } = await seedAndLogin("Opp-T11");
    const now = Date.now();
    const createdAt = now - 60_000; // created 1 min ago
    const { roomId } = seedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      createdAt,
      roomDeadlineAt: now + 25 * 60_000,
    });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${oSid}`);

    expect(res.status).toBe(200);
    const row = db
      .prepare(
        "SELECT status, opponent_user_id, creator_ready_at, opponent_ready_at, creator_deck_json, opponent_deck_json, join_token_consumed_at FROM duel_room WHERE id = ?",
      )
      .get(roomId) as {
      status: string;
      opponent_user_id: null;
      creator_ready_at: null;
      opponent_ready_at: null;
      creator_deck_json: null;
      opponent_deck_json: null;
      join_token_consumed_at: null;
    };
    expect(row.status).toBe("open");
    expect(row.opponent_user_id).toBeNull();
    expect(row.creator_ready_at).toBeNull();
    expect(row.opponent_ready_at).toBeNull();
    expect(row.creator_deck_json).toBeNull();
    expect(row.opponent_deck_json).toBeNull();
    expect(row.join_token_consumed_at).toBeNull();
  });

  it("T11 close expired_unclaimed when restored deadline is in the past (AC9)", async () => {
    const { userId: cId } = await seedUser("Creator-T11exp");
    const { sid: oSid, userId: oId } = await seedAndLogin("Opp-T11exp");
    // createdAt 31 min ago → restored deadline (created_at + 30 min) is 1 min in the past
    const now = Date.now();
    const createdAt = now - 31 * 60_000;
    const { roomId } = seedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      createdAt,
      roomDeadlineAt: now + 60_000,
    });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${oSid}`);

    expect(res.status).toBe(200);
    const row = db
      .prepare("SELECT status, closed_reason FROM duel_room WHERE id = ?")
      .get(roomId) as { status: string; closed_reason: string };
    expect(row.status).toBe("closed");
    expect(row.closed_reason).toBe("expired_unclaimed");
  });

  it("opponent leave from awaiting_choice closes the room (AC8)", async () => {
    const { userId: cId } = await seedUser("Creator-AQ");
    const { sid: oSid, userId: oId } = await seedAndLogin("Opp-AQ");
    const { roomId } = seedRoom(cId, { status: "awaiting_choice", opponentUserId: oId });
    db.prepare("UPDATE duel_room SET flip_winner_user_id = ?, flip_rolled_at = ? WHERE id = ?").run(
      cId,
      Date.now() - 1000,
      roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${oSid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("left");
  });

  it("rejects leave from starting state (leave_not_allowed, E44, AC10)", async () => {
    const { sid, userId } = await seedAndLogin("Creator-start");
    const { userId: oppId } = await seedUser("Opp-start");
    const { roomId } = seedRoom(userId, { status: "starting", opponentUserId: oppId });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("leave_not_allowed");
  });

  it("returns 403 for non-occupant", async () => {
    const { userId: cId } = await seedUser("Creator-403L");
    const { sid } = await seedAndLogin("Stranger-403L");
    const { roomId } = seedRoom(cId, { status: "filled" });

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_occupant");
  });

  it("T11 clears both ready flags when reverting to open (AC9)", async () => {
    const { userId: cId } = await seedUser("Creator-T11ready");
    const { sid: oSid, userId: oId } = await seedAndLogin("Opp-T11ready");
    const now = Date.now();
    const { roomId } = seedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      creatorReadyAt: now - 30_000,
      opponentReadyAt: now - 20_000,
      createdAt: now - 60_000,
      roomDeadlineAt: now + 25 * 60_000,
    });
    db.prepare(
      "UPDATE duel_room SET creator_deck_json = ?, opponent_deck_json = ? WHERE id = ?",
    ).run(JSON.stringify({ main: [], extra: [] }), JSON.stringify({ main: [], extra: [] }), roomId);

    await request(app).post(`/api/duels/${roomId}/room/leave`).set("Cookie", `sid=${oSid}`);

    const row = db
      .prepare(
        "SELECT creator_ready_at, opponent_ready_at, creator_deck_json, opponent_deck_json FROM duel_room WHERE id = ?",
      )
      .get(roomId) as {
      creator_ready_at: null;
      opponent_ready_at: null;
      creator_deck_json: null;
      opponent_deck_json: null;
    };
    expect(row.creator_ready_at).toBeNull();
    expect(row.opponent_ready_at).toBeNull();
    expect(row.creator_deck_json).toBeNull();
    expect(row.opponent_deck_json).toBeNull();
  });
});

// ── C2 — no ROOM_STATE frame on rejected ready ────────────────────────────
// Spins up a real HTTP server so the room WebSocket is reachable.

describe("ready — C2: rejected ready produces zero socket frames for opponent", () => {
  let wsDb: Database.Database;
  let wsApp: Application;
  let httpServer: HttpServer;
  let port: number;

  beforeEach(async () => {
    wsDb = openDb(":memory:");
    const catalog = makeTestCatalog();
    const manager = new DuelManager(
      async () =>
        new FakeEdisonDuel([
          { status: "waiting", messages: [], awaiting: { seat: 0 } },
        ]) as DuelEngine,
      async () =>
        new FakeEdisonDuel([
          { status: "waiting", messages: [], awaiting: { seat: 0 } },
        ]) as DuelEngine,
    );
    wsApp = createApp(wsDb, catalog, manager);
    httpServer = createServer(wsApp);
    const boardWss = attachDuelWsServer(httpServer, wsDb, manager);
    const roomWss = createRoomWss();
    attachUpgradeRouter(httpServer, wsDb, boardWss, roomWss);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = httpServer.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    wsDb.close();
  });

  async function seedWsUser(displayName: string): Promise<{ sid: string; userId: string }> {
    const userId = randomUUID();
    const pw = await hash("pw");
    wsDb
      .prepare(
        "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
      )
      .run(userId, displayName, pw, new Date().toISOString());
    const res = await request(wsApp).post("/api/auth/login").send({ displayName, password: "pw" });
    const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
    const sid =
      cookies
        .find((c) => c.startsWith("sid="))
        ?.split(";")[0]
        ?.slice(4) ?? "";
    return { sid, userId };
  }

  it("opponent receives no new ROOM_STATE frame when creator ready is rejected (C2, AC3)", async () => {
    const { sid: cSid, userId: cId } = await seedWsUser("Creator-C2");
    const { sid: oSid, userId: oId } = await seedWsUser("Opp-C2");

    const roomId = randomUUID();
    insertRoom(wsDb, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: cId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 30 * 60_000,
      createdAt: Date.now() - 60_000,
    });
    wsDb
      .prepare("UPDATE duel_room SET status = 'filled', opponent_user_id = ? WHERE id = ?")
      .run(oId, roomId);

    // Creator has a non-existent deck reference (simulates deleted deck, E27)
    wsDb.prepare("UPDATE duel_room SET creator_deck_id = ? WHERE id = ?").run(randomUUID(), roomId);

    // Connect opponent's socket and collect frames
    const frames: RoomServerMessage[] = [];
    const wsUrl = `ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: `sid=${oSid}` } });
      ws.on("open", () => resolve());
      ws.on("message", (data: Buffer) => {
        frames.push(JSON.parse(data.toString()) as RoomServerMessage);
      });
      ws.on("error", reject);
      ws.on("unexpected-response", (_req, res) => {
        reject(new Error(`WS upgrade rejected: ${res.statusCode}`));
      });

      // Close the socket after the test window
      setTimeout(() => ws.close(), 300);
    });

    // Wait for the initial frame
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    const frameCountAfterConnect = frames.length;
    expect(frameCountAfterConnect).toBe(1); // only the initial snapshot

    // Creator sends ready with the deleted deck — should be rejected
    const readyRes = await request(wsApp)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(readyRes.status).toBe(400); // deck_invalid — deck not found

    // Wait to give any spurious broadcast time to arrive
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    // Opponent must have received no additional frames (AC3, C2)
    expect(frames.length).toBe(frameCountAfterConnect);

    // Confirm nothing changed in the row either (belt-and-suspenders)
    const row = wsDb.prepare("SELECT creator_ready_at FROM duel_room WHERE id = ?").get(roomId) as {
      creator_ready_at: null;
    };
    expect(row.creator_ready_at).toBeNull();
  });
});

// ── C6 — flip winner leaving from awaiting_choice closes the room ─────────

describe("leave — C6: flip winner leave from awaiting_choice closes room for both", () => {
  it("flip winner leaves → room closed, no duel recorded (C6)", async () => {
    const { sid: winnerSid, userId: winnerId } = await seedAndLogin("Winner-C6");
    const { userId: loserId } = await seedUser("Loser-C6");

    const { roomId } = seedRoom(winnerId, {
      status: "awaiting_choice",
      opponentUserId: loserId,
    });
    // winner is the flip winner
    db.prepare("UPDATE duel_room SET flip_winner_user_id = ?, flip_rolled_at = ? WHERE id = ?").run(
      winnerId,
      Date.now() - 1_000,
      roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${winnerSid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("left");
    expect(snap.closedByUserId).toBe(winnerId);

    // No duel row should exist
    const duelRow = db.prepare("SELECT id FROM duel WHERE id = ?").get(roomId);
    expect(duelRow).toBeUndefined();
  });

  it("flip loser leaving from awaiting_choice also closes the room", async () => {
    const { userId: winnerId } = await seedUser("Winner-C6b");
    const { sid: loserSid, userId: loserId } = await seedAndLogin("Loser-C6b");

    const { roomId } = seedRoom(winnerId, {
      status: "awaiting_choice",
      opponentUserId: loserId,
    });
    db.prepare("UPDATE duel_room SET flip_winner_user_id = ?, flip_rolled_at = ? WHERE id = ?").run(
      winnerId,
      Date.now() - 1_000,
      roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${loserSid}`);

    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("left");
  });
});
