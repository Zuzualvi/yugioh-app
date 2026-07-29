// ---------------------------------------------------------------------------
// deckInfo integration tests — verify that every snapshot path carries the
// viewer's own deckName and deckCardCount, and never the opponent's.
//
// Tests the four requirements from the defect report:
//  1. GET /api/duels/:id/room returns deckName+count after pick and after ready.
//  2. WS ROOM_STATE frame carries the same: on initial connect and on a frame
//     triggered by the OTHER player's action.
//  3. Opponent view never contains deckName or deckCardCount (R25) — GET and
//     both WS paths.
//  4. TypeScript rejects a missing 6th arg to buildRoomSnapshot (in unit test).
//  5. R23: locked deck snapshot is the source of truth — survives source deletion.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { DuelManager } from "../duel/duelManager.js";
import { attachDuelWsServer } from "../duel/duelSocket.js";
import { createRoomWss } from "./roomSocket.js";
import { attachUpgradeRouter } from "../wsUpgradeRouter.js";
import { insertRoom, claimSlot } from "./roomStore.js";
import { FakeEdisonDuel } from "../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../duel/engineInterface.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Application } from "express";
import type { RoomSnapshot } from "@yugioh-app/contracts";

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

// Unlimited, non-extra-deck cards from fixture
const UNLIMITED_MAIN_CARDS = [
  89631139, 46986414, 70781052, 5405694, 29401950, 71413901, 28604635, 83011277, 23205979, 71564252,
  24508238, 80441106, 7572887, 89943723,
];

function legalMainDeck(): number[] {
  const main: number[] = [];
  for (let i = 0; i < 13; i++)
    main.push(UNLIMITED_MAIN_CARDS[i]!, UNLIMITED_MAIN_CARDS[i]!, UNLIMITED_MAIN_CARDS[i]!);
  main.push(UNLIMITED_MAIN_CARDS[13]!);
  return main;
}

let db: Database.Database;
let app: Application;
let httpServer: HttpServer;
let port: number;

async function seedUser(displayName: string): Promise<{ userId: string; sid: string }> {
  const userId = randomUUID();
  const pw = await hash("password123");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());
  const res = await request(app)
    .post("/api/auth/login")
    .send({ displayName, password: "password123" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  const sid =
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? "";
  return { userId, sid };
}

function insertDeck(userId: string, name: string): string {
  const deckId = randomUUID();
  const now = new Date().toISOString();
  const main = legalMainDeck();
  db.prepare(
    `INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at)
     VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, ?)`,
  ).run(deckId, userId, name, JSON.stringify(main), now, now);
  return deckId;
}

beforeEach(async () => {
  db = openDb(":memory:");
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
  app = createApp(db, catalog, manager);
  httpServer = createServer(app);
  const boardWss = attachDuelWsServer(httpServer, db, manager);
  const roomWss = createRoomWss();
  attachUpgradeRouter(httpServer, db, boardWss, roomWss);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const addr = httpServer.address();
  port = typeof addr === "object" && addr ? addr.port : 0;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  db.close();
});

// ── 1. GET /room returns deckName+count after pick and after ready ─────────

describe("deckInfo — GET /api/duels/:id/room", () => {
  it("returns deckName and deckCardCount after a deck pick", async () => {
    const { sid, userId } = await seedUser("Creator1");
    const deckId = insertDeck(userId, "Blackwings");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    // Seed opponent so room is filled
    const { userId: oppId } = await seedUser("Opponent1");
    claimSlot(db, roomId, oppId, Date.now());

    // Pick deck
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    // GET snapshot
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.deckName).toBe("Blackwings");
    expect(snap.you.deckCardCount).toBe(40); // 40-card deck
  });

  it("returns deckName and deckCardCount after ready", async () => {
    const { sid, userId } = await seedUser("Creator2");
    const deckId = insertDeck(userId, "Quickdraw");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent2");
    claimSlot(db, roomId, oppId, Date.now());

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${sid}`);

    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;
    expect(snap.you.deckName).toBe("Quickdraw");
    expect(snap.you.deckCardCount).toBe(40);
  });
});

// ── 2. WS ROOM_STATE carries deckName on reconnect and on opponent action ──

describe("deckInfo — WS ROOM_STATE frames", () => {
  it("initial frame after reconnect carries the viewer's deckName", async () => {
    const { sid, userId } = await seedUser("Creator3");
    const deckId = insertDeck(userId, "Lightsworn");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent3");
    claimSlot(db, roomId, oppId, Date.now());
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    // Connect WS and collect initial frame
    const snap = await new Promise<RoomSnapshot>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${sid}` },
      });
      ws.on("message", (data: Buffer) => {
        ws.close();
        const msg = JSON.parse(data.toString()) as { type: string; snapshot: RoomSnapshot };
        resolve(msg.snapshot);
      });
      ws.on("error", reject);
    });

    expect(snap.you.deckName).toBe("Lightsworn");
    expect(snap.you.deckCardCount).toBe(40);
  });

  it("frame triggered by opponent's action carries the viewer's deckName", async () => {
    const { sid: creatorSid, userId: creatorId } = await seedUser("Creator4");
    const { sid: oppSid, userId: oppId } = await seedUser("Opponent4");
    // Distinct deck names: swapping them would produce detectable failures
    const creatorDeckId = insertDeck(creatorId, "GradientBlue");
    insertDeck(oppId, "OppDeck");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    claimSlot(db, roomId, oppId, Date.now());

    // Creator picks a deck
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${creatorSid}`)
      .send({ deckId: creatorDeckId });

    // Creator connects WS and waits for the SECOND frame (triggered by opponent's pick)
    const secondFrame = new Promise<RoomSnapshot>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${creatorSid}` },
      });
      let count = 0;
      ws.on("message", (data: Buffer) => {
        count++;
        const msg = JSON.parse(data.toString()) as { type: string; snapshot: RoomSnapshot };
        if (count === 2) {
          ws.close();
          resolve(msg.snapshot);
        }
      });
      ws.on("error", reject);
    });

    // Opponent picks a deck (triggers broadcast to creator)
    const oppDeckId = insertDeck(oppId, "OppTrigger");
    await new Promise<void>((r) => setTimeout(r, 50)); // ensure WS is connected
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${oppSid}`)
      .send({ deckId: oppDeckId });

    const snap = await secondFrame;
    // Creator's own deck info survives the broadcast triggered by the opponent's pick
    expect(snap.you.deckName).toBe("GradientBlue");
    expect(snap.you.deckCardCount).toBe(40);
  });
});

// ── 3. Opponent view never contains deckName or deckCardCount (R25) ────────
// Covers GET, WS reconnect path, and WS broadcast path.
// NOTE: the assertions are scoped to snap.opponent — a raw JSON.stringify grep
// of the whole payload is NOT sufficient because snap.you.deckName legitimately
// appears in the snapshot (for the viewing player). A raw grep would pass for the
// wrong reason (e.g. if both players happened to have the same deck name, a raw
// grep would false-fail even when R25 is correctly implemented).

describe("deckInfo — opponent view contains no deck secrets (R25)", () => {
  it("GET: snapshot seen by opponent carries no creator deckName, deckId, or deckCardCount", async () => {
    const { sid: creatorSid, userId: creatorId } = await seedUser("Creator5");
    const { sid: oppSid, userId: oppId } = await seedUser("Opponent5");
    const creatorDeckId = insertDeck(creatorId, "SecretDeck");
    // Opponent has a DIFFERENT deck name to make the test fail if names are swapped
    insertDeck(oppId, "OppPublicDeck");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    claimSlot(db, roomId, oppId, Date.now());
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${creatorSid}`)
      .send({ deckId: creatorDeckId });

    // Opponent GETs the snapshot
    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${oppSid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;

    // Scoped assertions on snap.opponent — NOT a raw-string grep of the whole payload.
    expect(snap.opponent).not.toBeNull();
    expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
    // Opponent's own view has no deck name (they haven't picked)
    expect(snap.you.deckName).toBeNull();
  });

  it("WS reconnect: initial frame seen by opponent carries no creator deck secrets", async () => {
    const { sid: creatorSid, userId: creatorId } = await seedUser("Creator6");
    const { sid: oppSid, userId: oppId } = await seedUser("Opponent6");
    const creatorDeckId = insertDeck(creatorId, "HiddenArrow");
    insertDeck(oppId, "OppVisible");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    claimSlot(db, roomId, oppId, Date.now());
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${creatorSid}`)
      .send({ deckId: creatorDeckId });

    // Opponent connects WS and reads the initial ROOM_STATE frame
    const snap = await new Promise<RoomSnapshot>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${oppSid}` },
      });
      ws.on("message", (data: Buffer) => {
        ws.close();
        const msg = JSON.parse(data.toString()) as { type: string; snapshot: RoomSnapshot };
        resolve(msg.snapshot);
      });
      ws.on("error", reject);
    });

    // In the opponent's view: snap.opponent is the creator
    expect(snap.opponent).not.toBeNull();
    expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
  });

  it("WS broadcast: frame triggered by creator's action carries no creator deck secrets to opponent", async () => {
    const { sid: creatorSid, userId: creatorId } = await seedUser("Creator7");
    const { sid: oppSid, userId: oppId } = await seedUser("Opponent7");
    const creatorDeckId = insertDeck(creatorId, "SteelTrap");
    insertDeck(oppId, "OppOpenDeck");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    claimSlot(db, roomId, oppId, Date.now());

    // Opponent connects WS first and waits for a broadcast triggered by creator's pick
    const broadcastFrame = new Promise<RoomSnapshot>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${oppSid}` },
      });
      let count = 0;
      ws.on("message", (data: Buffer) => {
        count++;
        const msg = JSON.parse(data.toString()) as { type: string; snapshot: RoomSnapshot };
        if (count === 2) {
          // Second frame: triggered by creator's deck pick
          ws.close();
          resolve(msg.snapshot);
        }
      });
      ws.on("error", reject);
    });

    await new Promise<void>((r) => setTimeout(r, 50)); // ensure WS is connected

    // Creator picks a deck (triggers broadcast to opponent)
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${creatorSid}`)
      .send({ deckId: creatorDeckId });

    const snap = await broadcastFrame;

    // In the opponent's view after the broadcast: snap.opponent is the creator
    expect(snap.opponent).not.toBeNull();
    expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
    expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
  });
});

// ── 4. R23: locked snapshot is the authoritative source of truth ──────────
// Once a player readies, creator_deck_json + creator_deck_name are locked.
// Renaming, rebuilding, or deleting the source deck afterwards has zero effect.

describe("deckInfo — R23: locked snapshot survives post-ready source deck changes", () => {
  it("locked name and count both returned after source deck deletion", async () => {
    const { sid, userId } = await seedUser("Creator8");
    const deckId = insertDeck(userId, "MirrorForce");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent8");
    claimSlot(db, roomId, oppId, Date.now());

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${sid}`);

    // Confirm lock is in place before deletion
    const beforeDel = await request(app)
      .get(`/api/duels/${roomId}/room`)
      .set("Cookie", `sid=${sid}`);
    expect(beforeDel.body.you.deckName).toBe("MirrorForce");
    expect(beforeDel.body.you.deckCardCount).toBe(40);

    // Delete the source deck row
    db.prepare("DELETE FROM decks WHERE id = ?").run(deckId);

    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;

    // Both name and count come from the locked snapshot (R23)
    expect(snap.you.deckName).toBe("MirrorForce");
    expect(snap.you.deckCardCount).toBe(40);
  });

  it("locked name is returned after source deck is renamed", async () => {
    const { sid, userId } = await seedUser("Creator9");
    const deckId = insertDeck(userId, "LockedName");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent9");
    claimSlot(db, roomId, oppId, Date.now());

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${sid}`);

    // Rename the source deck to a different name
    db.prepare("UPDATE decks SET name = ? WHERE id = ?").run("RenamedAfterReady", deckId);

    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;

    // Room still shows the locked name, not the new name
    expect(snap.you.deckName).toBe("LockedName");
    expect(snap.you.deckName).not.toBe("RenamedAfterReady");
  });

  it("locked card count is returned after cards are added to the source deck", async () => {
    const { sid, userId } = await seedUser("Creator10");
    const deckId = insertDeck(userId, "CountLock");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent10");
    claimSlot(db, roomId, oppId, Date.now());

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${sid}`);

    // Add cards to the source deck (locked count is 40; new count would be 43)
    const expandedMain = [
      ...legalMainDeck(),
      UNLIMITED_MAIN_CARDS[0]!,
      UNLIMITED_MAIN_CARDS[1]!,
      UNLIMITED_MAIN_CARDS[2]!,
    ];
    db.prepare("UPDATE decks SET main_json = ? WHERE id = ?").run(
      JSON.stringify(expandedMain),
      deckId,
    );

    const res = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    const snap = res.body as RoomSnapshot;

    // Room still shows the locked count (40), not the edited count (43)
    expect(snap.you.deckCardCount).toBe(40);
    expect(snap.you.deckCardCount).not.toBe(43);
  });

  it("before ready, renaming the source deck DOES change the displayed name", async () => {
    const { sid, userId } = await seedUser("Creator11");
    const deckId = insertDeck(userId, "OriginalName");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent11");
    claimSlot(db, roomId, oppId, Date.now());

    // Pick deck only (no ready — no lock)
    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });

    const before = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(before.body.you.deckName).toBe("OriginalName");

    // Rename source deck before readying
    db.prepare("UPDATE decks SET name = ? WHERE id = ?").run("RenamedBeforeReady", deckId);

    const after = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(after.body.you.deckName).toBe("RenamedBeforeReady");
    expect(after.body.you.deckName).not.toBe("OriginalName");
  });

  it("un-ready clears the locked name (lock does not linger)", async () => {
    const { sid, userId } = await seedUser("Creator12");
    const deckId = insertDeck(userId, "LockLinger");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const { userId: oppId } = await seedUser("Opponent12");
    claimSlot(db, roomId, oppId, Date.now());

    await request(app)
      .post(`/api/duels/${roomId}/room/deck`)
      .set("Cookie", `sid=${sid}`)
      .send({ deckId });
    await request(app).post(`/api/duels/${roomId}/room/ready`).set("Cookie", `sid=${sid}`);

    // Confirm lock is set
    const locked = await request(app).get(`/api/duels/${roomId}/room`).set("Cookie", `sid=${sid}`);
    expect(locked.body.you.deckName).toBe("LockLinger");

    // Un-ready
    await request(app).post(`/api/duels/${roomId}/room/unready`).set("Cookie", `sid=${sid}`);

    // After un-ready, the locked name must be gone — live row drives it again
    const afterUnready = await request(app)
      .get(`/api/duels/${roomId}/room`)
      .set("Cookie", `sid=${sid}`);
    expect(afterUnready.body.you.deckName).toBe("LockLinger"); // live row still has the same name
    // But verify it's reading from the live row by renaming and checking it tracks
    db.prepare("UPDATE decks SET name = ? WHERE id = ?").run("LiveName", deckId);
    const afterRename = await request(app)
      .get(`/api/duels/${roomId}/room`)
      .set("Cookie", `sid=${sid}`);
    expect(afterRename.body.you.deckName).toBe("LiveName");
  });
});
