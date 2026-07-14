// ---------------------------------------------------------------------------
// duelStore — SQLite read/write operations for the duel and response_log tables.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import type { Seat, EngineResponse } from "@yugioh-app/contracts";
import type { DeckLists } from "./engineInterface.js";

export type DuelStatus = "waiting_for_opponent" | "active" | "ended";

export interface DuelRow {
  id: string;
  join_token: string;
  seat0_token: string;
  seat1_token: string;
  seat0_user_id: string;
  seat1_user_id: string | null;
  seed_json: string;
  duel_flags: string;
  deck0_json: string;
  deck1_json: string | null;
  timer_per_move_seconds: number;
  deadline_at: number | null;
  on_clock_seat: number | null;
  status: DuelStatus;
  winner: number | null;
  end_reason: string | null;
  created_at: number;
}

export interface ResponseLogRow {
  duel_id: string;
  seq: number;
  seat: number;
  response_json: string;
  received_at: number;
}

export function createDuel(
  db: InstanceType<typeof Database>,
  params: {
    id: string;
    joinToken: string;
    seat0Token: string;
    seat1Token: string;
    seat0UserId: string;
    seed: bigint;
    duelFlags: bigint;
    deck0: DeckLists;
    timerPerMoveSeconds: number;
  },
): void {
  db.prepare(
    `INSERT INTO duel
       (id, join_token, seat0_token, seat1_token, seat0_user_id, seed_json,
        duel_flags, deck0_json, timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_for_opponent', ?)`,
  ).run(
    params.id,
    params.joinToken,
    params.seat0Token,
    params.seat1Token,
    params.seat0UserId,
    JSON.stringify(params.seed.toString()),
    params.duelFlags.toString(16),
    JSON.stringify(params.deck0),
    params.timerPerMoveSeconds,
    Date.now(),
  );
}

export function getDuel(db: InstanceType<typeof Database>, id: string): DuelRow | undefined {
  return db.prepare("SELECT * FROM duel WHERE id = ?").get(id) as DuelRow | undefined;
}

export function getDuelByJoinToken(
  db: InstanceType<typeof Database>,
  joinToken: string,
): DuelRow | undefined {
  return db.prepare("SELECT * FROM duel WHERE join_token = ?").get(joinToken) as
    DuelRow | undefined;
}

export function joinDuel(
  db: InstanceType<typeof Database>,
  id: string,
  seat1UserId: string,
  deck1: DeckLists,
): void {
  db.prepare(
    `UPDATE duel
     SET seat1_user_id = ?, deck1_json = ?, status = 'active'
     WHERE id = ?`,
  ).run(seat1UserId, JSON.stringify(deck1), id);
}

export function setDeadline(
  db: InstanceType<typeof Database>,
  duelId: string,
  deadlineAt: number,
  onClockSeat: Seat,
): void {
  db.prepare("UPDATE duel SET deadline_at = ?, on_clock_seat = ? WHERE id = ?").run(
    deadlineAt,
    onClockSeat,
    duelId,
  );
}

export function appendResponseLog(
  db: InstanceType<typeof Database>,
  duelId: string,
  seq: number,
  seat: Seat,
  response: EngineResponse,
): void {
  db.prepare(
    `INSERT INTO response_log (duel_id, seq, seat, response_json, received_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(duelId, seq, seat, JSON.stringify(response), Date.now());
}

export function getResponseLog(
  db: InstanceType<typeof Database>,
  duelId: string,
): EngineResponse[] {
  const rows = db
    .prepare("SELECT response_json FROM response_log WHERE duel_id = ? ORDER BY seq")
    .all(duelId) as Pick<ResponseLogRow, "response_json">[];
  return rows.map((r) => JSON.parse(r.response_json) as EngineResponse);
}

export function getNextSeq(db: InstanceType<typeof Database>, duelId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM response_log WHERE duel_id = ?")
    .get(duelId) as { c: number };
  return row.c;
}

export function endDuel(
  db: InstanceType<typeof Database>,
  duelId: string,
  winner: Seat | null,
  endReason: string,
): void {
  db.prepare(
    "UPDATE duel SET status = 'ended', winner = ?, end_reason = ?, deadline_at = NULL WHERE id = ?",
  ).run(winner, endReason, duelId);
}
