// ---------------------------------------------------------------------------
// roomStore — Every SQL statement touching duel_room.
// All writes are guarded single-row UPDATEs; `changes === 1` is the decision.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import type { RoomClosedReason, OccupantRole, SeatChoice } from "@yugioh-app/contracts";
import { ROOM_READY_TTL_MS, ROOM_CHOICE_TTL_MS } from "./roomState.js";

// ── Row type ──────────────────────────────────────────────────────────────────

export interface DuelRoomRow {
  id: string;
  join_token: string;
  join_token_consumed_at: number | null;
  creator_user_id: string;
  opponent_user_id: string | null;
  timer_per_move_seconds: number;
  seed_json: string;
  creator_deck_id: string | null;
  opponent_deck_id: string | null;
  creator_deck_json: string | null;
  opponent_deck_json: string | null;
  creator_ready_at: number | null;
  opponent_ready_at: number | null;
  room_deadline_at: number;
  flip_winner_user_id: string | null;
  flip_rolled_at: number | null;
  flip_choice: string | null;
  flip_choice_at: number | null;
  status: string;
  closed_reason: string | null;
  closed_by_user_id: string | null;
  created_at: number;
}

export interface DeckLists {
  main: number[];
  extra: number[];
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function insertRoom(
  db: InstanceType<typeof Database>,
  p: {
    id: string;
    joinToken: string;
    creatorUserId: string;
    perMoveSeconds: number;
    seed: bigint;
    roomDeadlineAt: number;
    createdAt: number;
  },
): void {
  db.prepare(
    `INSERT INTO duel_room
       (id, join_token, creator_user_id, timer_per_move_seconds, seed_json,
        room_deadline_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(
    p.id,
    p.joinToken,
    p.creatorUserId,
    p.perMoveSeconds,
    JSON.stringify(p.seed.toString()),
    p.roomDeadlineAt,
    p.createdAt,
  );
}

export function getRoom(db: InstanceType<typeof Database>, id: string): DuelRoomRow | undefined {
  return db.prepare("SELECT * FROM duel_room WHERE id = ?").get(id) as DuelRoomRow | undefined;
}

export function getRoomByJoinToken(
  db: InstanceType<typeof Database>,
  token: string,
): DuelRoomRow | undefined {
  return db.prepare("SELECT * FROM duel_room WHERE join_token = ?").get(token) as
    DuelRoomRow | undefined;
}

// ── Guarded writes ────────────────────────────────────────────────────────────

/** T9/T10. Guarded: only closes a room in a non-terminal state. */
export function closeRoom(
  db: InstanceType<typeof Database>,
  id: string,
  reason: RoomClosedReason,
  byUserId: string | null,
): boolean {
  const result = db
    .prepare(
      `UPDATE duel_room
       SET status = 'closed', closed_reason = ?, closed_by_user_id = ?
       WHERE id = ? AND status NOT IN ('closed', 'starting')`,
    )
    .run(reason, byUserId, id);
  return result.changes === 1;
}

/** T2. Guarded: UPDATE WHERE status='open' AND opponent_user_id IS NULL. */
export function claimSlot(
  db: InstanceType<typeof Database>,
  id: string,
  userId: string,
  now: number,
): boolean {
  const result = db
    .prepare(
      `UPDATE duel_room
       SET opponent_user_id = ?, join_token_consumed_at = ?, status = 'filled'
       WHERE id = ? AND status = 'open' AND opponent_user_id IS NULL`,
    )
    .run(userId, now, id);
  return result.changes === 1;
}

/** T3. Guarded: occupant not yet ready. */
export function setDeckRef(
  db: InstanceType<typeof Database>,
  id: string,
  role: OccupantRole,
  deckId: string,
): boolean {
  const col = role === "creator" ? "creator_deck_id" : "opponent_deck_id";
  const readyCol = role === "creator" ? "creator_ready_at" : "opponent_ready_at";
  const result = db
    .prepare(
      `UPDATE duel_room SET ${col} = ? WHERE id = ? AND ${readyCol} IS NULL AND status = 'filled'`,
    )
    .run(deckId, id);
  return result.changes === 1;
}

/**
 * T4 + T5 in ONE transaction (R24, R29).
 * - writes deck_json snapshot and ready_at for the given role
 * - if first ready: rebases room_deadline_at to now + 600_000
 * - if both ready: rolls flip, persists, sets status='awaiting_choice', deadline = now + 120_000
 * Guarded on status='filled' AND that occupant's ready_at IS NULL.
 * Returns null if the guard failed.
 */
export function applyReady(
  db: InstanceType<typeof Database>,
  id: string,
  role: OccupantRole,
  deckSnapshot: DeckLists,
  now: number,
): { flipFired: boolean; flipWinnerUserId: string | null; roomDeadlineAt: number } | null {
  const deckJsonCol = role === "creator" ? "creator_deck_json" : "opponent_deck_json";
  const readyCol = role === "creator" ? "creator_ready_at" : "opponent_ready_at";

  return db.transaction(() => {
    // Guarded update: set this occupant's ready_at and deck_json
    const writeReady = db.prepare(
      `UPDATE duel_room SET ${deckJsonCol} = ?, ${readyCol} = ?
       WHERE id = ? AND status = 'filled' AND ${readyCol} IS NULL`,
    );
    const r = writeReady.run(JSON.stringify(deckSnapshot), now, id);
    if (r.changes !== 1) return null;

    // Read back the row to check if both are now ready
    const row = db.prepare("SELECT * FROM duel_room WHERE id = ?").get(id) as
      DuelRoomRow | undefined;
    if (!row) return null;

    const otherReady =
      role === "creator" ? row.opponent_ready_at !== null : row.creator_ready_at !== null;

    if (!otherReady) {
      // First ready — rebase deadline to now + 10 min
      const newDeadline = now + ROOM_READY_TTL_MS;
      db.prepare("UPDATE duel_room SET room_deadline_at = ? WHERE id = ?").run(newDeadline, id);
      return { flipFired: false, flipWinnerUserId: null, roomDeadlineAt: newDeadline };
    }

    // Both ready — roll flip
    const flipResult = randomInt(2); // 0 = creator wins, 1 = opponent wins
    const winnerUserId = flipResult === 0 ? row.creator_user_id : (row.opponent_user_id as string);
    const newDeadline = now + ROOM_CHOICE_TTL_MS;

    db.prepare(
      `UPDATE duel_room
       SET flip_winner_user_id = ?, flip_rolled_at = ?,
           status = 'awaiting_choice', room_deadline_at = ?
       WHERE id = ?`,
    ).run(winnerUserId, now, newDeadline, id);

    return { flipFired: true, flipWinnerUserId: winnerUserId, roomDeadlineAt: newDeadline };
  })() as ReturnType<typeof applyReady>;
}

/** T4′. Clears that occupant's ready_at AND deck_json. Never moves the deadline (R28). */
export function clearReady(
  db: InstanceType<typeof Database>,
  id: string,
  role: OccupantRole,
): boolean {
  const readyCol = role === "creator" ? "creator_ready_at" : "opponent_ready_at";
  const deckJsonCol = role === "creator" ? "creator_deck_json" : "opponent_deck_json";
  const result = db
    .prepare(
      `UPDATE duel_room SET ${readyCol} = NULL, ${deckJsonCol} = NULL
       WHERE id = ? AND status = 'filled' AND ${readyCol} IS NOT NULL`,
    )
    .run(id);
  return result.changes === 1;
}

/**
 * T6. Guarded on status='awaiting_choice'. Writes flip_choice, flip_choice_at,
 * status='starting'. Returns the seat mapping or null if guard failed.
 */
export function applyChoice(
  db: InstanceType<typeof Database>,
  id: string,
  choice: SeatChoice,
  now: number,
): { seat0UserId: string; seat1UserId: string } | null {
  return db.transaction(() => {
    const row = db
      .prepare("SELECT * FROM duel_room WHERE id = ? AND status = 'awaiting_choice'")
      .get(id) as DuelRoomRow | undefined;
    if (!row) return null;

    const r = db
      .prepare(
        `UPDATE duel_room
         SET flip_choice = ?, flip_choice_at = ?, status = 'starting'
         WHERE id = ? AND status = 'awaiting_choice'`,
      )
      .run(choice, now, id);
    if (r.changes !== 1) return null;

    // Seat derivation (R3): seat0 = flip_winner if choice==='first', else seat0 = the other
    const flipWinner = row.flip_winner_user_id as string;
    const other =
      flipWinner === row.creator_user_id ? (row.opponent_user_id as string) : row.creator_user_id;

    const seat0UserId = choice === "first" ? flipWinner : other;
    const seat1UserId = choice === "first" ? other : flipWinner;

    return { seat0UserId, seat1UserId };
  })() as ReturnType<typeof applyChoice>;
}

/**
 * T11. Guarded on status='filled'. Clears BOTH ready flags and BOTH snapshots.
 * Restores room_deadline_at to the provided value.
 */
export function revertToOpen(
  db: InstanceType<typeof Database>,
  id: string,
  restoredDeadlineAt: number,
): boolean {
  const result = db
    .prepare(
      `UPDATE duel_room
       SET status = 'open',
           opponent_user_id = NULL,
           join_token_consumed_at = NULL,
           creator_ready_at = NULL,
           opponent_ready_at = NULL,
           creator_deck_json = NULL,
           opponent_deck_json = NULL,
           room_deadline_at = ?
       WHERE id = ? AND status = 'filled'`,
    )
    .run(restoredDeadlineAt, id);
  return result.changes === 1;
}
