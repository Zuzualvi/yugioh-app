// ---------------------------------------------------------------------------
// startDuelFromRoom — T7: construct engine + write first per-move deadline.
//
// Called fire-and-forget from submitChoice after T6 commits.
// Also exports recoverStartingDuels for process-restart E47 recovery.
//
// The module-level dispatch registry decouples the room route (which has no
// DuelManager) from the engine lifecycle, without modifying roomRouter.ts.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import type { DuelManager } from "./duelManager.js";
import { getDuel, setDeadline } from "./duelStore.js";
import { loadRoomView } from "../room/loadRoomView.js";
import { broadcastRoom } from "../room/roomBroadcast.js";

// ── Module-level dispatch ──────────────────────────────────────────────────

type DispatchFn = (duelId: string) => Promise<void>;
let _dispatch: DispatchFn | null = null;

/**
 * Register the function that will be called by dispatchDuelStart.
 * Must be called once at server startup (index.ts) before any duel can start.
 */
export function registerDuelStart(fn: DispatchFn): void {
  _dispatch = fn;
}

/**
 * Trigger T7 for a duel that just completed T6. Fire-and-forget:
 * errors are logged, never thrown. No-op if no handler is registered.
 */
export function dispatchDuelStart(duelId: string): void {
  if (_dispatch) {
    _dispatch(duelId).catch((err: unknown) => {
      console.error("[startDuelFromRoom] Unhandled error for duel", duelId, err);
    });
  }
}

// ── T7 ────────────────────────────────────────────────────────────────────────

/**
 * T7: construct the engine and write the first per-move deadline.
 *
 * Idempotent: if the duel row is already 'active' or 'ended', returns early.
 * On engine failure: closes the room 'engine_failed' and broadcasts (E46).
 */
export async function startDuelFromRoom(
  db: InstanceType<typeof Database>,
  manager: DuelManager,
  duelId: string,
): Promise<void> {
  const duelRow = getDuel(db, duelId);
  // DuelRow.status is typed without "starting", but the DB can hold it (ZUH-29, ADR 0002)
  if (!duelRow || (duelRow.status as string) !== "starting") return;
  if (!duelRow.deck1_json) return; // should never be null for a 'starting' duel

  const seed = BigInt(JSON.parse(duelRow.seed_json) as string);
  const deck0 = JSON.parse(duelRow.deck0_json) as { main: number[]; extra: number[] };
  const deck1 = JSON.parse(duelRow.deck1_json) as { main: number[]; extra: number[] };

  try {
    // createAndStart steps to first WAITING boundary; registers in live map.
    await manager.createAndStart(duelId, seed, deck0, deck1);

    // Activate: set status='active' and write first deadline for seat 0.
    // ocgcore always starts team 0, so on_clock_seat = 0 (R3 / engine spec §5.1 T7).
    db.prepare("UPDATE duel SET status = 'active' WHERE id = ? AND status = 'starting'").run(
      duelId,
    );
    const deadlineAt = Date.now() + duelRow.timer_per_move_seconds * 1000;
    setDeadline(db, duelId, deadlineAt, 0);

    // Broadcast updated room snapshot (room stays 'starting' — its job is done).
    const view = loadRoomView(db, duelId);
    if (view) broadcastRoom(db, duelId, view.row, view.names, Date.now());
  } catch (err) {
    // E46: engine failed — close room, broadcast, record no loss.
    // closeRoom() guards against closing 'starting' rooms, so we write directly.
    // The guard exists because a normal 'starting' room is terminal — this is the
    // exceptional T10 path where the engine failed before becoming active.
    console.error("[startDuelFromRoom] Engine construction failed for duel", duelId, err);
    manager.remove(duelId);
    db.prepare(
      `UPDATE duel_room SET status = 'closed', closed_reason = 'engine_failed'
       WHERE id = ? AND status = 'starting'`,
    ).run(duelId);
    const view = loadRoomView(db, duelId);
    if (view) broadcastRoom(db, duelId, view.row, view.names, Date.now());
  }
}

// ── E47 recovery ──────────────────────────────────────────────────────────────

/**
 * On server restart, complete T7 for any duel rows still in 'starting' state.
 * Called once from index.ts after registerDuelStart().
 */
export async function recoverStartingDuels(
  db: InstanceType<typeof Database>,
  manager: DuelManager,
): Promise<void> {
  const rows = db.prepare("SELECT id FROM duel WHERE status = 'starting'").all() as {
    id: string;
  }[];
  for (const { id } of rows) {
    await startDuelFromRoom(db, manager, id);
  }
}
