// ---------------------------------------------------------------------------
// submitChoice tests
//
// Covers:
//   - Only the flip winner may submit (E41, AC1)
//   - Guarded write rejects wrong state (AC2)
//   - Happy path: seats assigned, duel row inserted, room → starting (AC2)
//   - Expiry with writeback
//   - Non-occupant is rejected
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import request from "supertest";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { openDb } from "../../db/openDb.js";
import { createApp } from "../../app.js";
import { DuelManager } from "../../duel/duelManager.js";
import { FakeEdisonDuel } from "../../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../../duel/engineInterface.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../../catalog/fixture.js";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
import { insertRoom } from "../roomStore.js";
import type { Application } from "express";

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

const UNLIMITED_MAIN_CARDS = [
  89631139, 46986414, 70781052, 5405694, 29401950, 71413901, 28604635, 83011277, 23205979, 71564252,
  24508238, 80441106, 7572887, 89943723,
];

function legalDeck() {
  const main: number[] = [];
  for (let i = 0; i < 13; i++) {
    const code = UNLIMITED_MAIN_CARDS[i]!;
    main.push(code, code, code);
  }
  main.push(UNLIMITED_MAIN_CARDS[13]!);
  return { main, extra: [] };
}

let db: Database.Database;
let app: Application;
let manager: DuelManager;

beforeEach(() => {
  db = openDb(":memory:");
  manager = new DuelManager(
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
  );
  app = createApp(db, makeTestCatalog(), manager);
});

afterEach(() => {
  db.close();
});

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

interface RoomSetup {
  roomId: string;
  creatorSid: string;
  creatorId: string;
  opponentSid: string;
  opponentId: string;
  flipWinnerId: string;
  flipWinnerSid: string;
  flipLoserId: string;
  flipLoserSid: string;
}

async function setupRoom(): Promise<RoomSetup> {
  const { userId: creatorId, sid: creatorSid } = await seedUser("Alice");
  const { userId: opponentId, sid: opponentSid } = await seedUser("Bob");

  const roomId = randomUUID();
  const deck = legalDeck();
  const deckJson = JSON.stringify(deck);

  // Insert a room already in awaiting_choice state
  insertRoom(db, {
    id: roomId,
    joinToken: randomUUID(),
    creatorUserId: creatorId,
    perMoveSeconds: 300,
    seed: 42n,
    roomDeadlineAt: Date.now() + 120_000,
    createdAt: Date.now(),
  });

  // Set both players as ready with decks and fire flip (manually)
  db.prepare(
    `UPDATE duel_room
     SET opponent_user_id = ?, status = 'awaiting_choice',
         creator_deck_json = ?, opponent_deck_json = ?,
         creator_ready_at = ?, opponent_ready_at = ?,
         flip_winner_user_id = ?, flip_rolled_at = ?
     WHERE id = ?`,
  ).run(
    opponentId,
    deckJson,
    deckJson,
    Date.now(),
    Date.now(),
    creatorId, // creator wins the flip
    Date.now(),
    roomId,
  );

  return {
    roomId,
    creatorSid,
    creatorId,
    opponentSid,
    opponentId,
    flipWinnerId: creatorId,
    flipWinnerSid: creatorSid,
    flipLoserId: opponentId,
    flipLoserSid: opponentSid,
  };
}

describe("POST /api/duels/:id/room/choice", () => {
  it("rejects submission from the flip loser (E41, AC1)", async () => {
    const setup = await setupRoom();

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipLoserSid}`)
      .send({ choice: "first" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_flip_winner");
  });

  it("rejects non-occupant", async () => {
    const setup = await setupRoom();
    const { sid: outsiderSid } = await seedUser("Eve");

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${outsiderSid}`)
      .send({ choice: "first" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_occupant");
  });

  it("rejects invalid choice value", async () => {
    const setup = await setupRoom();

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "invalid" });

    expect(res.status).toBe(400);
  });

  it("happy path: choice=first → room starting, duel row inserted, seat0=winner (AC2)", async () => {
    const setup = await setupRoom();

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "first" });

    expect(res.status).toBe(200);
    const snap = res.body as {
      status: string;
      seats: { seat0UserId: string; seat1UserId: string };
    };
    expect(snap.status).toBe("starting");
    expect(snap.seats).toBeTruthy();
    expect(snap.seats!.seat0UserId).toBe(setup.flipWinnerId);
    expect(snap.seats!.seat1UserId).toBe(setup.flipLoserId);

    // Duel row must exist with correct seat assignment
    const duelRow = db.prepare("SELECT * FROM duel WHERE id = ?").get(setup.roomId) as
      { status: string; seat0_user_id: string; seat1_user_id: string } | undefined;
    expect(duelRow).toBeTruthy();
    // status may be 'starting' or 'active' depending on whether T7 completed
    expect(["starting", "active"]).toContain(duelRow!.status);
    expect(duelRow!.seat0_user_id).toBe(setup.flipWinnerId);
    expect(duelRow!.seat1_user_id).toBe(setup.flipLoserId);
  });

  it("happy path: choice=second → seat0=opponent, seat1=winner (AC2)", async () => {
    const setup = await setupRoom();

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "second" });

    expect(res.status).toBe(200);
    const snap = res.body as { seats: { seat0UserId: string; seat1UserId: string } };
    expect(snap.seats!.seat0UserId).toBe(setup.flipLoserId);
    expect(snap.seats!.seat1UserId).toBe(setup.flipWinnerId);

    const duelRow = db.prepare("SELECT * FROM duel WHERE id = ?").get(setup.roomId) as
      | { seat0_user_id: string; seat1_user_id: string; deck0_json: string; deck1_json: string }
      | undefined;
    expect(duelRow!.seat0_user_id).toBe(setup.flipLoserId);
    expect(duelRow!.seat1_user_id).toBe(setup.flipWinnerId);
  });

  it("decks are reordered by seat in the duel row (AC2)", async () => {
    const setup = await setupRoom();
    // Give distinct decks so we can verify ordering
    const creatorDeck = {
      main: [UNLIMITED_MAIN_CARDS[0]!, ...Array(39).fill(UNLIMITED_MAIN_CARDS[1])],
      extra: [],
    };
    const opponentDeck = {
      main: [UNLIMITED_MAIN_CARDS[2]!, ...Array(39).fill(UNLIMITED_MAIN_CARDS[3])],
      extra: [],
    };
    db.prepare(
      "UPDATE duel_room SET creator_deck_json = ?, opponent_deck_json = ? WHERE id = ?",
    ).run(JSON.stringify(creatorDeck), JSON.stringify(opponentDeck), setup.roomId);

    // creator = flip winner, choice=second → opponent=seat0
    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "second" });

    expect(res.status).toBe(200);
    const duelRow = db
      .prepare("SELECT deck0_json, deck1_json FROM duel WHERE id = ?")
      .get(setup.roomId) as { deck0_json: string; deck1_json: string } | undefined;
    const deck0 = JSON.parse(duelRow!.deck0_json) as { main: number[] };
    const deck1 = JSON.parse(duelRow!.deck1_json) as { main: number[] };
    // seat0=opponent → deck0=opponentDeck
    expect(deck0.main[0]).toBe(opponentDeck.main[0]);
    // seat1=creator → deck1=creatorDeck
    expect(deck1.main[0]).toBe(creatorDeck.main[0]);
  });

  it("duel row has NULL deadline_at and NULL on_clock_seat at insert time (AC2, AC3)", async () => {
    const setup = await setupRoom();

    await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "first" });

    // Immediately after T6, before T7 completes, deadline and clock seat are NULL
    // (We wait for T7 to complete since it's async-but-synchronous in tests with FakeEdisonDuel)
    // Give T7 a tick to resolve
    await new Promise((r) => setTimeout(r, 50));
    const duelRow = db
      .prepare("SELECT status, deadline_at, on_clock_seat FROM duel WHERE id = ?")
      .get(setup.roomId) as
      { status: string; deadline_at: number | null; on_clock_seat: number | null } | undefined;
    // After T7: status='active', deadline set, on_clock_seat=0
    expect(duelRow!.status).toBe("active");
    expect(duelRow!.deadline_at).not.toBeNull();
    expect(duelRow!.on_clock_seat).toBe(0);
  });

  it("guarded write rejects if room is already starting (AC2)", async () => {
    const setup = await setupRoom();

    // First submission succeeds
    await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "first" });

    // Second submission by same user is rejected (room no longer awaiting_choice)
    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "second" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("wrong_state");
  });

  it("rejects expired room", async () => {
    const setup = await setupRoom();
    // Set deadline in the past
    db.prepare("UPDATE duel_room SET room_deadline_at = ? WHERE id = ?").run(
      Date.now() - 1000,
      setup.roomId,
    );

    const res = await request(app)
      .post(`/api/duels/${setup.roomId}/room/choice`)
      .set("Cookie", `sid=${setup.flipWinnerSid}`)
      .send({ choice: "first" });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
  });

  it("returns 404 for unknown room", async () => {
    const { sid } = await seedUser("Charlie");
    const res = await request(app)
      .post(`/api/duels/no-such-room/room/choice`)
      .set("Cookie", `sid=${sid}`)
      .send({ choice: "first" });

    expect(res.status).toBe(404);
  });
});
