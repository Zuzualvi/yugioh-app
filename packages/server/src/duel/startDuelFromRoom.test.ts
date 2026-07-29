// ---------------------------------------------------------------------------
// startDuelFromRoom tests
//
// Covers:
//   - T7: duel becomes active + first deadline set for seat 0 (AC3)
//   - E46: engine failure → room closed engine_failed, no loss (AC4)
//   - E47: idempotent — already-active duel is a no-op (AC5)
//   - recoverStartingDuels: completes stuck T7 rows (AC5)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { openDb } from "../db/openDb.js";
import { DuelManager } from "./duelManager.js";
import { FakeEdisonDuel } from "./fakeEdisonDuel.js";
import type { DuelEngine } from "./engineInterface.js";
import { EDISON_FLAGS } from "@yugioh-app/engine";
import { insertRoom } from "../room/roomStore.js";
import { startDuelFromRoom, recoverStartingDuels } from "./startDuelFromRoom.js";

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
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

function seedUsers(): { creatorId: string; opponentId: string } {
  const creatorId = randomUUID();
  const opponentId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(creatorId, "Alice", "hash", new Date().toISOString());
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(opponentId, "Bob", "hash", new Date().toISOString());
  return { creatorId, opponentId };
}

function insertStartingDuel(seat0UserId: string, seat1UserId: string): string {
  const duelId = randomUUID();
  const deck = JSON.stringify(legalDeck());
  db.prepare(
    `INSERT INTO duel
       (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id,
        seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 'starting', ?)`,
  ).run(
    duelId,
    randomUUID(),
    randomUUID(),
    randomUUID(),
    seat0UserId,
    seat1UserId,
    JSON.stringify("42"),
    EDISON_FLAGS.toString(16),
    deck,
    deck,
    Date.now(),
  );
  return duelId;
}

function insertStartingRoom(creatorId: string, opponentId: string, duelId: string): void {
  insertRoom(db, {
    id: duelId,
    joinToken: randomUUID(),
    creatorUserId: creatorId,
    perMoveSeconds: 300,
    seed: 42n,
    roomDeadlineAt: Date.now() + 120_000,
    createdAt: Date.now(),
  });
  db.prepare(
    `UPDATE duel_room SET opponent_user_id = ?, status = 'starting',
     flip_choice = 'first', flip_winner_user_id = ?
     WHERE id = ?`,
  ).run(opponentId, creatorId, duelId);
}

describe("startDuelFromRoom", () => {
  it("T7: activates duel and writes first deadline for seat 0 (AC3)", async () => {
    const { creatorId, opponentId } = seedUsers();
    const duelId = insertStartingDuel(creatorId, opponentId);
    insertStartingRoom(creatorId, opponentId, duelId);

    await startDuelFromRoom(db, manager, duelId);

    const row = db
      .prepare("SELECT status, deadline_at, on_clock_seat FROM duel WHERE id = ?")
      .get(duelId) as
      { status: string; deadline_at: number | null; on_clock_seat: number | null } | undefined;
    expect(row!.status).toBe("active");
    expect(row!.deadline_at).not.toBeNull();
    expect(row!.on_clock_seat).toBe(0);
  });

  it("T7: deadline is approximately now + timer_per_move_seconds (AC3)", async () => {
    const { creatorId, opponentId } = seedUsers();
    const duelId = insertStartingDuel(creatorId, opponentId);
    insertStartingRoom(creatorId, opponentId, duelId);

    const before = Date.now();
    await startDuelFromRoom(db, manager, duelId);
    const after = Date.now();

    const row = db.prepare("SELECT deadline_at FROM duel WHERE id = ?").get(duelId) as
      { deadline_at: number } | undefined;
    // timer_per_move_seconds = 300 → deadline ≈ now + 300_000
    expect(row!.deadline_at).toBeGreaterThanOrEqual(before + 300_000);
    expect(row!.deadline_at).toBeLessThanOrEqual(after + 300_000);
  });

  it("E46: engine failure → room closed engine_failed, duel has no winner (AC4)", async () => {
    const { creatorId, opponentId } = seedUsers();
    const duelId = insertStartingDuel(creatorId, opponentId);
    insertStartingRoom(creatorId, opponentId, duelId);

    // Make the engine factory throw
    const failingManager = new DuelManager(
      async () => {
        throw new Error("WASM failed to load");
      },
      async () =>
        new FakeEdisonDuel([
          { status: "waiting", messages: [], awaiting: { seat: 0 } },
        ]) as DuelEngine,
    );

    await startDuelFromRoom(db, failingManager, duelId);

    const roomRow = db
      .prepare("SELECT status, closed_reason FROM duel_room WHERE id = ?")
      .get(duelId) as { status: string; closed_reason: string } | undefined;
    expect(roomRow!.status).toBe("closed");
    expect(roomRow!.closed_reason).toBe("engine_failed");

    // No winner written on the duel row
    const duelRow = db.prepare("SELECT winner, end_reason FROM duel WHERE id = ?").get(duelId) as
      { winner: number | null; end_reason: string | null } | undefined;
    expect(duelRow!.winner).toBeNull();
    expect(duelRow!.end_reason).toBeNull();
  });

  it("E47: no-ops for an already-active duel (AC5)", async () => {
    const { creatorId, opponentId } = seedUsers();
    const duelId = insertStartingDuel(creatorId, opponentId);
    insertStartingRoom(creatorId, opponentId, duelId);

    // Manually mark as active
    db.prepare("UPDATE duel SET status = 'active' WHERE id = ?").run(duelId);

    await startDuelFromRoom(db, manager, duelId);

    // Engine should NOT be registered (no createAndStart called)
    expect(manager.getLive(duelId)).toBeUndefined();
  });

  it("no-ops for an unknown duel id", async () => {
    await expect(startDuelFromRoom(db, manager, "does-not-exist")).resolves.toBeUndefined();
  });
});

describe("recoverStartingDuels", () => {
  it("completes T7 for all duels in starting state (AC5)", async () => {
    const { creatorId, opponentId } = seedUsers();
    const id1 = insertStartingDuel(creatorId, opponentId);
    const id2 = insertStartingDuel(creatorId, opponentId);
    insertStartingRoom(creatorId, opponentId, id1);
    insertStartingRoom(creatorId, opponentId, id2);

    await recoverStartingDuels(db, manager);

    for (const id of [id1, id2]) {
      const row = db.prepare("SELECT status FROM duel WHERE id = ?").get(id) as
        { status: string } | undefined;
      expect(row!.status).toBe("active");
    }
  });

  it("skips duels already active", async () => {
    const { creatorId, opponentId } = seedUsers();
    const duelId = insertStartingDuel(creatorId, opponentId);
    db.prepare("UPDATE duel SET status = 'active' WHERE id = ?").run(duelId);

    // Should not throw or double-activate
    await expect(recoverStartingDuels(db, manager)).resolves.toBeUndefined();
  });
});
