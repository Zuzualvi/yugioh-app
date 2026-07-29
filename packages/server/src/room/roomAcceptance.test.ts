// ---------------------------------------------------------------------------
// ZUH-30 — Room feature acceptance suite  (E1–E48)
//
// Drives every edge case through real HTTP routes + the room WebSocket.
// No direct DB writes in the happy-path chain (Sections A and B).
// Sections C–G seed state via DB only where the reaching-HTTP-route belongs
// to a slice not yet merged; each such test is annotated "REQUIRES S2".
//
// Run status against integration/duel-room before S2 merges:
//   E1–E13, E19–E23, E34, E36–E43, E45–E48 — PASS
//   E14–E16, E24–E33, E35, E44             — FAIL (501 until S2 merges)
//   E11 (browser redirect), E17 (10 s presence timer), E18 (process restart):
//     NOT TESTABLE AT HTTP LEVEL — see comments on each test.
//
// PRD overrule decisions asserted here (CEO calls 2026-07-28):
//   - Invitee leave from filled → open   (not closed)
//   - 120 s choice window → expired_choice   (no auto-choice)
//   - Un-ready is allowed before both ready
//   - Opponent sees "deck selected" boolean, never a deck name
//   - One-room-at-a-time is NOT enforced
//   - Flip loser may leave from awaiting_choice (closes for both)
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Application } from "express";
import { hash } from "@node-rs/argon2";
import { attachDuelWsServer } from "../duel/duelSocket.js";
import { createRoomWss } from "./roomSocket.js";
import { attachUpgradeRouter } from "../wsUpgradeRouter.js";
import { DuelManager } from "../duel/duelManager.js";
import { FakeEdisonDuel } from "../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../duel/engineInterface.js";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import { insertRoom } from "./roomStore.js";
import { ROOM_OPEN_TTL_MS } from "./roomState.js";

// ── Test catalog ──────────────────────────────────────────────────────────

const UNLIMITED_MAIN = [
  89631139, 46986414, 70781052, 5405694, 29401950, 71413901, 28604635, 83011277, 23205979, 71564252,
  24508238, 80441106, 7572887, 89943723,
];

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  return {
    catalog: FIXTURE_CATALOG,
    byPasscode,
    aliasIndex,
    legalPasscodes: new Set([...byPasscode.keys(), ...aliasIndex.keys()]),
  };
}

function legalMain(): number[] {
  const main: number[] = [];
  for (let i = 0; i < 13; i++)
    main.push(UNLIMITED_MAIN[i]!, UNLIMITED_MAIN[i]!, UNLIMITED_MAIN[i]!);
  main.push(UNLIMITED_MAIN[13]!);
  return main;
}

// ── Infrastructure ────────────────────────────────────────────────────────

let db: Database.Database;
let app: Application;
let httpServer: HttpServer;
let port: number;

function makeFakeManager() {
  return new DuelManager(
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
  );
}

beforeEach(async () => {
  db = openDb(":memory:");
  const manager = makeFakeManager();
  app = createApp(db, makeTestCatalog(), manager);
  httpServer = createServer(app);
  attachUpgradeRouter(httpServer, db, attachDuelWsServer(httpServer, db, manager), createRoomWss());
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
  port = (httpServer.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((r) => httpServer.close(() => r()));
  db.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function seedAndLogin(name: string): Promise<{ sid: string; userId: string }> {
  const userId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, name, await hash("pw"), new Date().toISOString());
  const res = await request(app)
    .post("/api/auth/login")
    .send({ displayName: name, password: "pw" });
  const sid =
    ((res.headers["set-cookie"] as string[] | undefined) ?? [])
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? "";
  return { sid, userId };
}

function seedLegalDeck(ownerId: string, name = "Deck"): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, ?)",
  ).run(id, ownerId, name, JSON.stringify(legalMain()), now, now);
  return id;
}

/** Create room via HTTP, return roomId + joinToken. */
async function httpCreate(
  sid: string,
  perMoveSeconds = 300,
): Promise<{ roomId: string; joinToken: string }> {
  const res = await request(app)
    .post("/api/duels")
    .set("Cookie", `sid=${sid}`)
    .send({ timer: { perMoveSeconds } });
  return res.body as { roomId: string; joinToken: string };
}

/** Claim room via HTTP. */
async function httpClaim(sid: string, joinToken: string) {
  return request(app).post("/api/duels/join").set("Cookie", `sid=${sid}`).send({ joinToken });
}

/** Seed a room row directly for tests that need a specific starting state (S2-blocked flow). */
function dbSeedRoom(
  creatorUserId: string,
  opts: {
    status?: string;
    opponentUserId?: string;
    creatorDeckId?: string | null;
    opponentDeckId?: string | null;
    creatorReadyAt?: number | null;
    opponentReadyAt?: number | null;
    flipWinnerUserId?: string | null;
    flipRolledAt?: number | null;
    roomDeadlineAt?: number;
    createdAt?: number;
  } = {},
): { roomId: string; joinToken: string } {
  const roomId = randomUUID();
  const joinToken = randomUUID();
  const now = Date.now();
  insertRoom(db, {
    id: roomId,
    joinToken,
    creatorUserId,
    perMoveSeconds: 300,
    seed: 42n,
    roomDeadlineAt: opts.roomDeadlineAt ?? now + ROOM_OPEN_TTL_MS,
    createdAt: opts.createdAt ?? now,
  });
  if (opts.status && opts.status !== "open")
    db.prepare("UPDATE duel_room SET status=? WHERE id=?").run(opts.status, roomId);
  if (opts.opponentUserId)
    db.prepare("UPDATE duel_room SET opponent_user_id=? WHERE id=?").run(
      opts.opponentUserId,
      roomId,
    );
  if (opts.creatorDeckId !== undefined)
    db.prepare("UPDATE duel_room SET creator_deck_id=? WHERE id=?").run(opts.creatorDeckId, roomId);
  if (opts.opponentDeckId !== undefined)
    db.prepare("UPDATE duel_room SET opponent_deck_id=? WHERE id=?").run(
      opts.opponentDeckId,
      roomId,
    );
  if (opts.creatorReadyAt !== undefined)
    db.prepare("UPDATE duel_room SET creator_ready_at=? WHERE id=?").run(
      opts.creatorReadyAt,
      roomId,
    );
  if (opts.opponentReadyAt !== undefined)
    db.prepare("UPDATE duel_room SET opponent_ready_at=? WHERE id=?").run(
      opts.opponentReadyAt,
      roomId,
    );
  if (opts.flipWinnerUserId)
    db.prepare("UPDATE duel_room SET flip_winner_user_id=?, flip_rolled_at=? WHERE id=?").run(
      opts.flipWinnerUserId,
      opts.flipRolledAt ?? Date.now(),
      roomId,
    );
  return { roomId, joinToken };
}

function wsFirstMessage(sid: string, roomId: string): Promise<RoomSnapshot> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
      headers: { Cookie: `sid=${sid}` },
    });
    ws.on("message", (d: Buffer) => {
      ws.close();
      resolve((JSON.parse(d.toString()) as { snapshot: RoomSnapshot }).snapshot);
    });
    ws.on("error", reject);
    ws.on("unexpected-response", (_r, res) => reject(new Error(`WS ${res.statusCode}`)));
  });
}

// ── §7.1 Link and entry (E1–E13) ──────────────────────────────────────────

describe("§7.1 Link and entry", () => {
  it("E1: creator closes tab — room stays open; no state transition from disconnect", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E1-C");
    const { roomId } = await httpCreate(cSid);
    // Connect creator socket then close it
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${cSid}` },
      });
      ws.on("open", () => {
        ws.close();
        resolve();
      });
      ws.on("error", reject);
    });
    // Room still open — no state transition
    const row = db.prepare("SELECT status FROM duel_room WHERE id=?").get(roomId) as {
      status: string;
    };
    expect(row.status).toBe("open");
    void cId;
  });

  it("E2: creator re-opens room URL — same room, countdown recomputed from row", async () => {
    const { sid: cSid } = await seedAndLogin("E2-C");
    const { roomId } = await httpCreate(cSid);
    const r1 = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(r1.status).toBe(200);
    expect((r1.body as RoomSnapshot).status).toBe("open");
    expect((r1.body as RoomSnapshot).roomDeadlineAt).toBeGreaterThan(Date.now());
    // Second GET returns the same room
    const r2 = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(r2.status).toBe(200);
    expect((r2.body as RoomSnapshot).roomId).toBe(roomId);
  });

  it("E3: invitee opens expired link — 404/expired verdict; lazy close written back", async () => {
    const { sid: cSid } = await seedAndLogin("E3-C");
    const { sid: oSid } = await seedAndLogin("E3-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    // Expire the room
    db.prepare("UPDATE duel_room SET room_deadline_at=? WHERE id=?").run(Date.now() - 1000, roomId);
    const res = await httpClaim(oSid, joinToken);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
    // Writeback persisted
    const row = db
      .prepare("SELECT status, closed_reason FROM duel_room WHERE id=?")
      .get(roomId) as {
      status: string;
      closed_reason: string;
    };
    expect(row.status).toBe("closed");
    expect(row.closed_reason).toBe("expired_unclaimed");
  });

  it("E4: third party opens already-claimed link — 409 already_claimed, row unchanged", async () => {
    const { sid: cSid } = await seedAndLogin("E4-C");
    const { sid: oSid } = await seedAndLogin("E4-O");
    const { sid: p3Sid } = await seedAndLogin("E4-P3");
    const { joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const res = await httpClaim(p3Sid, joinToken);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_claimed");
  });

  it("E5: link for a started duel — 409 already_started (distinct from already_claimed)", async () => {
    const { sid: cSid } = await seedAndLogin("E5-C");
    const { sid: oSid } = await seedAndLogin("E5-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    db.prepare("UPDATE duel_room SET status='starting' WHERE id=?").run(roomId);
    const res = await httpClaim(oSid, joinToken);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_started");
  });

  it("E6: link for a closed room — 409 room_closed", async () => {
    const { sid: cSid } = await seedAndLogin("E6-C");
    const { sid: oSid } = await seedAndLogin("E6-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    db.prepare("UPDATE duel_room SET status='closed', closed_reason='left' WHERE id=?").run(roomId);
    const res = await httpClaim(oSid, joinToken);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("room_closed");
  });

  it("E7: creator opens their own join link — returns their room (not an error)", async () => {
    const { sid: cSid } = await seedAndLogin("E7-C");
    const { joinToken } = await httpCreate(cSid);
    const res = await httpClaim(cSid, joinToken);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).you.role).toBe("creator");
  });

  it("E8: invitee re-opens link from chat after claiming — recognised, returns room", async () => {
    const { sid: cSid } = await seedAndLogin("E8-C");
    const { sid: oSid } = await seedAndLogin("E8-O");
    const { joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const res = await httpClaim(oSid, joinToken);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).you.role).toBe("opponent");
  });

  it("E9: two simultaneous claims — exactly one wins; loser gets already_claimed (R40/E9)", async () => {
    const { sid: cSid } = await seedAndLogin("E9-C");
    const { sid: o1 } = await seedAndLogin("E9-O1");
    const { sid: o2 } = await seedAndLogin("E9-O2");
    const { joinToken } = await httpCreate(cSid);
    const [r1, r2] = await Promise.all([httpClaim(o1, joinToken), httpClaim(o2, joinToken)]);
    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body.error.code).toBe("already_claimed");
    // Loser writes nothing — only one opponent_user_id
    const row = db
      .prepare("SELECT opponent_user_id FROM duel_room WHERE join_token=?")
      .get(joinToken) as { opponent_user_id: string };
    expect(typeof row.opponent_user_id).toBe("string");
  });

  it("E10: invitee double-taps Join — idempotent, second claim returns room", async () => {
    const { sid: cSid } = await seedAndLogin("E10-C");
    const { sid: oSid } = await seedAndLogin("E10-O");
    const { joinToken } = await httpCreate(cSid);
    const r1 = await httpClaim(oSid, joinToken);
    const r2 = await httpClaim(oSid, joinToken);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Nothing wrote on the second call — same row
    expect((r2.body as RoomSnapshot).status).toBe("filled");
  });

  it("E11 (API): unauthenticated visitor may call GET /api/duels/join/:token and get verdict", async () => {
    // Browser redirect to login is UI behaviour; this confirms the API is open.
    // The frontend RequireAuth + from-param resume is covered by LoginScreen.test.ts.
    const { sid: cSid } = await seedAndLogin("E11-C");
    const { joinToken } = await httpCreate(cSid);
    const res = await request(app).get(`/api/duels/join/${joinToken}`); // no cookie
    expect(res.status).toBe(200);
    expect(res.body.usable).toBe(true);
    expect(res.body.reason).toBe("ok");
    expect(res.body).not.toHaveProperty("status"); // never the raw room status
  });

  it("E12: player with no decks may enter and stay in the room (REQUIRES S2 to ready)", async () => {
    // Entering the room itself works; ready is what requires a deck.
    // This test verifies the entry half; the deck_required rejection is covered by E26.
    const { sid: cSid } = await seedAndLogin("E12-C");
    const { sid: oSid } = await seedAndLogin("E12-O"); // O has no decks
    const { joinToken } = await httpCreate(cSid);
    const res = await httpClaim(oSid, joinToken);
    expect(res.status).toBe(200); // P-I can enter
    expect((res.body as RoomSnapshot).you.deckSelected).toBe(false);
  });

  it("E13: user may be in two rooms simultaneously — one-room-at-a-time NOT enforced (PRD)", async () => {
    const { sid: cSid } = await seedAndLogin("E13-C");
    const { sid: oSid } = await seedAndLogin("E13-O");
    const r1 = await httpCreate(cSid);
    const r2 = await httpCreate(cSid); // second room — same creator
    await httpClaim(oSid, r1.joinToken);
    await httpClaim(oSid, r2.joinToken); // same opponent joins both
    const row1 = db.prepare("SELECT status FROM duel_room WHERE id=?").get(r1.roomId) as {
      status: string;
    };
    const row2 = db.prepare("SELECT status FROM duel_room WHERE id=?").get(r2.roomId) as {
      status: string;
    };
    expect(row1.status).toBe("filled");
    expect(row2.status).toBe("filled");
  });
});

// ── §7.2 In the room, before ready (E14–E24) ─────────────────────────────
// E14–E16, E24: REQUIRES S2 (pickDeck / leave routes currently 501)

describe("§7.2 In the room, before ready", () => {
  it("E14: invitee picks a deck — deck_id persisted (REQUIRES S2)", async () => {
    const { sid: cSid } = await seedAndLogin("E14-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E14-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(oId);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId });
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).you.deckSelected).toBe(true);
  });

  it("E15: deck changed multiple times before ready — last pick persists (REQUIRES S2)", async () => {
    const { sid: cSid } = await seedAndLogin("E15-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E15-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const d1 = seedLegalDeck(oId, "D1");
    const d2 = seedLegalDeck(oId, "D2");
    const d3 = seedLegalDeck(oId, "D3");
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId: d1 });
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId: d2 });
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId: d3 });
    expect(res.status).toBe(200);
    const row = db.prepare("SELECT opponent_deck_id FROM duel_room WHERE id=?").get(roomId) as {
      opponent_deck_id: string;
    };
    expect(row.opponent_deck_id).toBe(d3); // last pick
  });

  it("E16: refresh with deck picked — deck_id survives (GET returns deckSelected=true) (REQUIRES S2 to pick)", async () => {
    // Seed the state directly since pickDeck is S2
    const { sid: cSid, userId: cId } = await seedAndLogin("E16-C");
    const { sid: oSid } = await seedAndLogin("E16-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    db.prepare("UPDATE duel_room SET creator_deck_id=? WHERE id=?").run(deckId, roomId);
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).you.deckSelected).toBe(true);
  });

  it("E17: socket drops 30 s — occupant shown as away after 10 s [NOT TESTABLE: requires 10 s sleep]", () => {
    // The AWAY_TIMEOUT_MS = 10_000 in roomBroadcast.ts is the mechanism.
    // Testing it in a unit test would require a 10-second wall-clock delay.
    // Presence derivation is unit-tested in roomBroadcast; the timeout constant is readable.
    // Marked untestable to avoid a flaky/slow test.
  });

  it("E18: server restart mid-room [NOT TESTABLE HERE: covered by restart-resilience tests in roomSocket.integration.test.ts]", () => {
    // See 'restart resilience — file-backed DB, handle closed and reopened (C12 R6)'
    // in packages/server/src/room/roomSocket.integration.test.ts.
  });

  it("E19: nobody readies, 30 min from mint elapses — lazy expiry closes expired_idle", async () => {
    const { sid: cSid } = await seedAndLogin("E19-C");
    const { sid: _oSid } = await seedAndLogin("E19-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(_oSid, joinToken);
    db.prepare("UPDATE duel_room SET room_deadline_at=? WHERE id=?").run(Date.now() - 1, roomId);
    // Any handler call triggers lazy expiry
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200); // snapshot returned even on expiry
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("expired_idle"); // no readies → idle
  });

  it("E20: session expires — 401 on socket; room untouched", async () => {
    const { sid: cSid } = await seedAndLogin("E20-C");
    const { roomId } = await httpCreate(cSid);
    // Invalidate the session
    db.prepare("DELETE FROM sessions WHERE sid=?").run(cSid);
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${cSid}` },
      });
      ws.on("unexpected-response", (_r, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => {
        ws.close();
        resolve(200);
      });
      ws.on("error", () => resolve(0));
    });
    expect(status).toBe(401);
    // Room untouched
    const row = db.prepare("SELECT status FROM duel_room WHERE id=?").get(roomId) as {
      status: string;
    };
    expect(row.status).toBe("open");
  });

  it("E21: occupant opens room on phone and laptop — both sockets accepted (R12, E21)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E21-C");
    const { roomId } = await httpCreate(cSid);
    const [snap1, snap2] = await Promise.all([
      wsFirstMessage(cSid, roomId),
      wsFirstMessage(cSid, roomId),
    ]);
    expect(snap1.status).toBe("open");
    expect(snap2.status).toBe("open");
    expect(snap1.you.userId).toBe(cId);
    expect(snap2.you.userId).toBe(cId);
  });

  it("E22: non-occupant attempts room socket — rejected 403 (R11, E22)", async () => {
    const { sid: cSid } = await seedAndLogin("E22-C");
    const { sid: intruderSid } = await seedAndLogin("E22-I");
    const { roomId } = await httpCreate(cSid);
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${intruderSid}` },
      });
      ws.on("unexpected-response", (_r, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => {
        ws.close();
        resolve(200);
      });
      ws.on("error", () => resolve(0));
    });
    expect(status).toBe(403);
  });

  it("E23: wrong Origin on room socket — rejected 403 (R11, E23)", async () => {
    const { sid: cSid } = await seedAndLogin("E23-C");
    const { roomId } = await httpCreate(cSid);
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${cSid}`, Origin: "https://evil.example.com" },
      });
      ws.on("unexpected-response", (_r, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => {
        ws.close();
        resolve(200);
      });
      ws.on("error", () => resolve(0));
    });
    expect(status).toBe(403);
  });

  it("E24: either leaves before anyone readies — room closed (T8) (REQUIRES S2)", async () => {
    const { sid: cSid } = await seedAndLogin("E24-C");
    const { sid: oSid } = await seedAndLogin("E24-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("left");
  });
});

// ── §7.3 Ready and the flip (E25–E37) ────────────────────────────────────
// E25–E35: REQUIRES S2

describe("§7.3 Ready and the flip", () => {
  it("E25: first ready rebases deadline to +10 min (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E25-C");
    const { sid: oSid } = await seedAndLogin("E25-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    const before = Date.now();
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    const row = db.prepare("SELECT room_deadline_at FROM duel_room WHERE id=?").get(roomId) as {
      room_deadline_at: number;
    };
    expect(row.room_deadline_at).toBeGreaterThan(before + 9 * 60 * 1000);
  });

  it("E26: ready with no deck → 400 deck_required; zero DB change (REQUIRES S2)", async () => {
    const { sid: cSid } = await seedAndLogin("E26-C");
    const { sid: oSid } = await seedAndLogin("E26-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_required");
    const row = db.prepare("SELECT creator_ready_at FROM duel_room WHERE id=?").get(roomId) as {
      creator_ready_at: null;
    };
    expect(row.creator_ready_at).toBeNull();
  });

  it("E27: deck deleted between pick and ready — ref cleared, ready rejected (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E27-C");
    const { sid: oSid } = await seedAndLogin("E27-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    db.prepare("DELETE FROM decks WHERE id=?").run(deckId);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_invalid");
    const row = db
      .prepare("SELECT creator_deck_id, creator_ready_at FROM duel_room WHERE id=?")
      .get(roomId) as {
      creator_deck_id: null;
      creator_ready_at: null;
    };
    expect(row.creator_deck_id).toBeNull();
    expect(row.creator_ready_at).toBeNull();
  });

  it("E28: ready with illegal deck — rejected, zero change to other occupant's snapshot (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E28-C");
    const { sid: oSid } = await seedAndLogin("E28-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    // Illegal deck (1 card)
    const badId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, 'Bad', ?, '[]', '[]', 0, ?, ?)",
    ).run(badId, cId, JSON.stringify([89631139]), now, now);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId: badId });

    // R25 note: we check snapshot.opponent explicitly — do NOT grep raw JSON for "deckName"
    // because you.deckName (the self-view) legitimately contains that key as null.
    const snapBefore = (
      await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oSid}`)
    ).body as RoomSnapshot;

    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("deck_invalid");

    // Zero observable change to the other occupant
    const snapAfter = (
      await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oSid}`)
    ).body as RoomSnapshot;
    expect(snapAfter.opponent?.ready).toBe(snapBefore.opponent?.ready);
    const row = db.prepare("SELECT creator_ready_at FROM duel_room WHERE id=?").get(roomId) as {
      creator_ready_at: null;
    };
    expect(row.creator_ready_at).toBeNull();
  });

  it("E29: ready twice (double-tap) — idempotent, 200 both times (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E29-C");
    const { sid: oSid } = await seedAndLogin("E29-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    const r1 = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    const r2 = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it("E30: deck change while locked → 409 already_ready (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E30-C");
    const { sid: oSid } = await seedAndLogin("E30-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const d1 = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId: d1 });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`);
    const d2 = seedLegalDeck(cId, "New");
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId: d2 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_ready");
  });

  it("E31: both ready in the same instant — exactly one flip fires (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E31-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E31-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const cDeck = seedLegalDeck(cId);
    const oDeck = seedLegalDeck(oId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId: cDeck });
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId: oDeck });
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`),
      request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${oSid}`),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const row = db
      .prepare("SELECT status, flip_winner_user_id, flip_rolled_at FROM duel_room WHERE id=?")
      .get(roomId) as { status: string; flip_winner_user_id: string; flip_rolled_at: number };
    expect(row.status).toBe("awaiting_choice");
    expect([cId, oId]).toContain(row.flip_winner_user_id);
    expect(typeof row.flip_rolled_at).toBe("number");
  });

  it("E32: leave commits while ready is in flight — serialized; T5 requires status=filled (REQUIRES S2)", async () => {
    // The guard on applyReady is status='filled'. After a leave closes the room,
    // status='closed', so any concurrent ready returns wrong_state / room_closed.
    // This is guaranteed by SQLite serialization; we test the outcome.
    const { sid: cSid, userId: cId } = await seedAndLogin("E32-C");
    const { sid: oSid } = await seedAndLogin("E32-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    // Leave and ready in flight
    const [leaveRes, readyRes] = await Promise.all([
      request(app).post(`/api/duels/${roomId}/room/leave`).set("Cookie", `sid=${cSid}`),
      request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`),
    ]);
    // One must succeed, but the final state must be closed (no duel started)
    const row = db.prepare("SELECT status FROM duel_room WHERE id=?").get(roomId) as {
      status: string;
    };
    expect(row.status).toBe("closed");
    void leaveRes;
    void readyRes;
  });

  it("E33: creator leaves while waiting for invitee to ready — room closed (T8) (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E33-C");
    const { sid: oSid } = await seedAndLogin("E33-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).status).toBe("closed");
    expect((res.body as RoomSnapshot).closedReason).toBe("left");
  });

  it("E34: 10 min elapses with only creator ready — expired_ready (lazy expiry)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E34-C");
    const { userId: oId } = await seedAndLogin("E34-O");
    // Seed: filled, creator ready, deadline in the past
    const { roomId } = dbSeedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      creatorReadyAt: Date.now() - 11 * 60 * 1000,
      roomDeadlineAt: Date.now() - 1,
    });
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("expired_ready"); // at least one ready_at → expired_ready
  });

  it("E35: ready arrives after room_deadline_at — closed first, ready rejected (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E35-C");
    const { sid: oSid } = await seedAndLogin("E35-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    db.prepare("UPDATE duel_room SET room_deadline_at=? WHERE id=?").run(Date.now() - 1, roomId);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
    const row = db
      .prepare("SELECT status, creator_ready_at FROM duel_room WHERE id=?")
      .get(roomId) as {
      status: string;
      creator_ready_at: null;
    };
    expect(row.status).toBe("closed");
    expect(row.creator_ready_at).toBeNull(); // never readied — expiry first (E35)
  });

  it("E36: POST /api/duels with perMoveSeconds outside [60,900] — 400 invalid_timer", async () => {
    const { sid: cSid } = await seedAndLogin("E36-C");
    const r1 = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${cSid}`)
      .send({ timer: { perMoveSeconds: 1 } });
    expect(r1.status).toBe(400);
    expect(r1.body.error.code).toBe("invalid_timer");
    const r2 = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${cSid}`)
      .send({ timer: { perMoveSeconds: 901 } });
    expect(r2.status).toBe(400);
    expect(r2.body.error.code).toBe("invalid_timer");
    const r3 = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${cSid}`)
      .send({ timer: { perMoveSeconds: 60 } });
    expect(r3.status).toBe(201); // 60 is the lower bound
    const r4 = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${cSid}`)
      .send({ timer: { perMoveSeconds: 900 } });
    expect(r4.status).toBe(201); // 900 is the upper bound
  });

  it("E37: either refreshes with one player ready — GET returns same room with ready state", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E37-C");
    const { userId: oId } = await seedAndLogin("E37-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      creatorReadyAt: Date.now() - 5000,
    });
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.ready).toBe(true);
    expect(snap.status).toBe("filled");
  });
});

// ── §7.4 Post-flip, pre-engine (E38–E48) ──────────────────────────────────

describe("§7.4 Post-flip, pre-engine", () => {
  it("E38: reconnect in awaiting_choice — flip re-read from row, never re-rolled (I4)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E38-C");
    const { userId: oId } = await seedAndLogin("E38-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: oId,
      flipWinnerUserId: cId,
      flipRolledAt: Date.now() - 5000,
    });
    // Two GET calls — flip winner is the same both times
    const r1 = (await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`))
      .body as RoomSnapshot;
    const r2 = (await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`))
      .body as RoomSnapshot;
    expect(r1.flip?.winnerUserId).toBe(cId);
    expect(r2.flip?.winnerUserId).toBe(cId);
    expect(r1.flip?.rolledAt).toBe(r2.flip?.rolledAt); // same timestamp = not re-rolled
  });

  it("E39: flip winner disconnected at flip time — room stays awaiting_choice, 120 s runs", async () => {
    const { userId: cId } = await seedAndLogin("E39-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E39-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: oId,
      flipWinnerUserId: cId,
    });
    // Loser can still see the room via GET (winner is "away" / offline)
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oSid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("awaiting_choice");
    expect(snap.flip?.winnerUserId).toBe(cId);
  });

  it("E40: 120 s elapses, winner never chooses — expired_choice (CEO: no auto-choice, PRD)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E40-C");
    const { userId: _oId } = await seedAndLogin("E40-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: _oId,
      flipWinnerUserId: cId,
      roomDeadlineAt: Date.now() - 1,
    });
    // Lazy expiry: any read triggers it
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("closed");
    expect(snap.closedReason).toBe("expired_choice");
  });

  it("E41: flip loser submits choice → 403 not_flip_winner", async () => {
    const { userId: cId } = await seedAndLogin("E41-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E41-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: oId,
      flipWinnerUserId: cId, // creator wins
    });
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/choice`)
      .set("Cookie", `sid=${oSid}`) // opponent = loser
      .send({ choice: "first" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_flip_winner");
  });

  it("E42: winner chooses 'first' — seat0=winner; decks ordered by seat", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E42-C");
    const { userId: oId } = await seedAndLogin("E42-O");
    const cDeck = { main: [UNLIMITED_MAIN[0]!, ...Array(39).fill(UNLIMITED_MAIN[1]!)], extra: [] };
    const oDeck = { main: [UNLIMITED_MAIN[2]!, ...Array(39).fill(UNLIMITED_MAIN[3]!)], extra: [] };
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: oId,
      flipWinnerUserId: cId,
    });
    db.prepare("UPDATE duel_room SET creator_deck_json=?, opponent_deck_json=? WHERE id=?").run(
      JSON.stringify(cDeck),
      JSON.stringify(oDeck),
      roomId,
    );
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/choice`)
      .set("Cookie", `sid=${cSid}`)
      .send({ choice: "first" });
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.status).toBe("starting");
    expect(snap.seats?.seat0UserId).toBe(cId); // winner goes first = seat0
    const duel = db
      .prepare("SELECT seat0_user_id, deck0_json FROM duel WHERE id=?")
      .get(roomId) as { seat0_user_id: string; deck0_json: string };
    expect(duel.seat0_user_id).toBe(cId);
    expect((JSON.parse(duel.deck0_json) as { main: number[] }).main[0]).toBe(cDeck.main[0]); // creator's deck in seat0
  });

  it("E43: winner chooses 'second' — seat0=opponent; decks reordered (PRD R3)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E43-C");
    const { userId: oId } = await seedAndLogin("E43-O");
    const cDeck = { main: [UNLIMITED_MAIN[0]!, ...Array(39).fill(UNLIMITED_MAIN[1]!)], extra: [] };
    const oDeck = { main: [UNLIMITED_MAIN[2]!, ...Array(39).fill(UNLIMITED_MAIN[3]!)], extra: [] };
    const { roomId } = dbSeedRoom(cId, {
      status: "awaiting_choice",
      opponentUserId: oId,
      flipWinnerUserId: cId,
    });
    db.prepare("UPDATE duel_room SET creator_deck_json=?, opponent_deck_json=? WHERE id=?").run(
      JSON.stringify(cDeck),
      JSON.stringify(oDeck),
      roomId,
    );
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/choice`)
      .set("Cookie", `sid=${cSid}`)
      .send({ choice: "second" });
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.seats?.seat0UserId).toBe(oId); // opponent first
    const duel = db
      .prepare("SELECT seat0_user_id, deck0_json FROM duel WHERE id=?")
      .get(roomId) as { seat0_user_id: string; deck0_json: string };
    expect(duel.seat0_user_id).toBe(oId);
    expect((JSON.parse(duel.deck0_json) as { main: number[] }).main[0]).toBe(oDeck.main[0]); // opponent's deck in seat0
  });

  it("E44: leave during starting — 409 leave_not_allowed (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E44-C");
    const { userId: oId } = await seedAndLogin("E44-O");
    const { roomId } = dbSeedRoom(cId, { status: "starting", opponentUserId: oId });
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("leave_not_allowed");
  });

  it("E45: refresh during starting — GET room returns starting snapshot; getSeatCredential works", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E45-C");
    const { userId: oId } = await seedAndLogin("E45-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "starting",
      opponentUserId: oId,
      flipWinnerUserId: cId,
    });
    // Insert a duel row (T6 would have done this)
    const seat0Token = randomUUID();
    const seat1Token = randomUUID();
    db.prepare(
      "INSERT INTO duel (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id, seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 'starting', ?)",
    ).run(
      roomId,
      randomUUID(),
      seat0Token,
      seat1Token,
      cId,
      oId,
      '"42"',
      "0",
      JSON.stringify({ main: legalMain(), extra: [] }),
      JSON.stringify({ main: legalMain(), extra: [] }),
      Date.now(),
    );
    const roomRes = await request(app)
      .get(`/api/duels/${roomId}/room`)
      .set("Cookie", `sid=${cSid}`);
    expect(roomRes.status).toBe(200);
    expect((roomRes.body as RoomSnapshot).status).toBe("starting");
    const credRes = await request(app)
      .get(`/api/duels/${roomId}/seat`)
      .set("Cookie", `sid=${cSid}`);
    expect(credRes.status).toBe(200);
    expect(credRes.body.seatToken).toBe(seat0Token);
  });

  it("E46: engine construction fails → room closed engine_failed, no duel result (T10)", async () => {
    const { userId: cId } = await seedAndLogin("E46-C");
    const { userId: oId } = await seedAndLogin("E46-O");
    const { roomId } = dbSeedRoom(cId, { status: "starting", opponentUserId: oId });
    db.prepare(
      "INSERT INTO duel (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id, seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 'starting', ?)",
    ).run(
      roomId,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      cId,
      oId,
      '"42"',
      "0",
      JSON.stringify({ main: legalMain(), extra: [] }),
      JSON.stringify({ main: legalMain(), extra: [] }),
      Date.now(),
    );
    // Import startDuelFromRoom with a failing manager
    const { startDuelFromRoom } = await import("../duel/startDuelFromRoom.js");
    const failingManager = new DuelManager(
      async () => {
        throw new Error("WASM load failed");
      },
      async () =>
        new FakeEdisonDuel([
          { status: "waiting", messages: [], awaiting: { seat: 0 } },
        ]) as DuelEngine,
    );
    await startDuelFromRoom(db, failingManager, roomId);
    const roomRow = db
      .prepare("SELECT status, closed_reason FROM duel_room WHERE id=?")
      .get(roomId) as {
      status: string;
      closed_reason: string;
    };
    expect(roomRow.status).toBe("closed");
    expect(roomRow.closed_reason).toBe("engine_failed");
    const duelRow = db.prepare("SELECT winner, end_reason FROM duel WHERE id=?").get(roomId) as {
      winner: null;
      end_reason: null;
    };
    expect(duelRow.winner).toBeNull();
    expect(duelRow.end_reason).toBeNull();
  });

  it("E47: process dies between T6 and T7 — recoverStartingDuels completes T7 on restart", async () => {
    const { userId: cId } = await seedAndLogin("E47-C");
    const { userId: oId } = await seedAndLogin("E47-O");
    const { roomId } = dbSeedRoom(cId, { status: "starting", opponentUserId: oId });
    db.prepare(
      "INSERT INTO duel (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id, seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 'starting', ?)",
    ).run(
      roomId,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      cId,
      oId,
      '"42"',
      "0",
      JSON.stringify({ main: legalMain(), extra: [] }),
      JSON.stringify({ main: legalMain(), extra: [] }),
      Date.now(),
    );
    const { recoverStartingDuels } = await import("../duel/startDuelFromRoom.js");
    await recoverStartingDuels(db, makeFakeManager());
    const duelRow = db.prepare("SELECT status FROM duel WHERE id=?").get(roomId) as {
      status: string;
    };
    expect(duelRow.status).toBe("active");
  });

  it("E48: either player returns to closed room URL — snapshot returns closed state", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("E48-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("E48-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "closed",
      opponentUserId: oId,
    });
    db.prepare("UPDATE duel_room SET closed_reason='left', closed_by_user_id=? WHERE id=?").run(
      cId,
      roomId,
    );
    const cRes = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${cSid}`);
    expect(cRes.status).toBe(200);
    expect((cRes.body as RoomSnapshot).status).toBe("closed");
    expect((cRes.body as RoomSnapshot).closedReason).toBe("left");
    const oRes = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oSid}`);
    expect(oRes.status).toBe(200);
    expect((oRes.body as RoomSnapshot).status).toBe("closed");
  });
});

// ── PRD overrule assertions ────────────────────────────────────────────────

describe("PRD overrule decisions (CEO 2026-07-28)", () => {
  it("PRD-R34: invitee leave from filled → room reverts to open (not closed)", async () => {
    const { sid: cSid } = await seedAndLogin("PRD-R34-C");
    const { sid: oSid } = await seedAndLogin("PRD-R34-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${oSid}`);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).status).toBe("open"); // REVERTED, not closed
  });

  it("PRD-R28: un-ready is allowed before both ready; does not move deadline (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("PRD-R28-C");
    const { sid: oSid } = await seedAndLogin("PRD-R28-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const deckId = seedLegalDeck(cId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`);
    const deadlineBefore = (
      db.prepare("SELECT room_deadline_at FROM duel_room WHERE id=?").get(roomId) as {
        room_deadline_at: number;
      }
    ).room_deadline_at;
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/unready`)
      .set("Cookie", `sid=${cSid}`);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).you.ready).toBe(false);
    const deadlineAfter = (
      db.prepare("SELECT room_deadline_at FROM duel_room WHERE id=?").get(roomId) as {
        room_deadline_at: number;
      }
    ).room_deadline_at;
    expect(deadlineAfter).toBe(deadlineBefore); // never moved by un-ready
  });

  it("PRD-R35: flip loser may leave from awaiting_choice — closes for both (REQUIRES S2)", async () => {
    const { sid: cSid, userId: cId } = await seedAndLogin("PRD-R35-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("PRD-R35-O");
    const { roomId, joinToken } = await httpCreate(cSid);
    await httpClaim(oSid, joinToken);
    const cDeck = seedLegalDeck(cId);
    const oDeck = seedLegalDeck(oId);
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${cSid}`)
      .send({ deckId: cDeck });
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oSid}`)
      .send({ deckId: oDeck });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${cSid}`);
    const oReady = await request(app)
      .post(`/api/duels/${roomId}/room/ready`)
      .set("Cookie", `sid=${oSid}`);
    const winnerId = (oReady.body as RoomSnapshot).flip!.winnerUserId;
    const loserSid = winnerId === cId ? oSid : cSid;
    const res = await request(app)
      .post(`/api/duels/${roomId}/room/leave`)
      .set("Cookie", `sid=${loserSid}`);
    expect(res.status).toBe(200);
    expect((res.body as RoomSnapshot).status).toBe("closed");
  });

  it("PRD-R25: opponent never sees deck name — check snapshot.opponent, not raw JSON", async () => {
    // IMPORTANT: do NOT check raw JSON for '"deckName"' — the self-view (you.deckName)
    // legitimately contains that key (set to null when no deck picked). Grepping the raw
    // string would give a false positive. Always inspect snapshot.opponent directly.
    const { userId: cId } = await seedAndLogin("PRD-R25-C");
    const { sid: oSid, userId: oId } = await seedAndLogin("PRD-R25-O");
    const { roomId } = dbSeedRoom(cId, {
      status: "filled",
      opponentUserId: oId,
      creatorDeckId: seedLegalDeck(cId, "SecretDeckName"),
    });
    // Opponent's GET snapshot — must not expose creator's deck name
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oSid}`);
    const snap = res.body as RoomSnapshot;
    expect(snap.opponent).toBeDefined();
    // These keys must be absent from the opponent object (RoomOpponentView has no deck fields)
    expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
    // Also confirm the deck name itself doesn't appear anywhere in the raw response
    expect(JSON.stringify(snap)).not.toContain("SecretDeckName");
  });

  it("PRD-no-one-room-limit: no one-room-at-a-time enforcement", async () => {
    const { sid: cSid } = await seedAndLogin("PRD-no-limit-C");
    const r1 = await httpCreate(cSid);
    const r2 = await httpCreate(cSid);
    expect(r1.roomId).not.toBe(r2.roomId);
    // Both exist in DB
    expect(db.prepare("SELECT id FROM duel_room WHERE id=?").get(r1.roomId)).toBeDefined();
    expect(db.prepare("SELECT id FROM duel_room WHERE id=?").get(r2.roomId)).toBeDefined();
  });
});
