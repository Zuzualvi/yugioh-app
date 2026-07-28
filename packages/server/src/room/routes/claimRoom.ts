// ---------------------------------------------------------------------------
// claimRoom — POST /api/duels/join
// T2: claims the open room slot as the opponent.
// Idempotent for existing occupants (R39, E7, E8, E10).
// Two simultaneous claims admit exactly one via guarded write (E4, E9).
// Requires session (mounted with requireSession in roomRouter).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { ClaimRoomBodySchema } from "@yugioh-app/contracts";
import { getRoomByJoinToken, claimSlot, closeRoom } from "../roomStore.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { loadRoomView } from "../loadRoomView.js";
import { getPresenceMap, broadcastRoom } from "../roomBroadcast.js";

export function claimRoom(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const parsed = ClaimRoomBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_token", message: "joinToken is required." } });
      return;
    }

    const { joinToken } = parsed.data;
    const user = req.user!;
    const now = Date.now();

    const row = getRoomByJoinToken(db, joinToken);
    if (!row) {
      res.status(404).json({ error: { code: "invalid_token", message: "Join token not found." } });
      return;
    }

    // Expiry writeback — always first (R20)
    const expiry = evaluateExpiry(row, now);
    if (expiry.expired && expiry.reason) {
      closeRoom(db, row.id, expiry.reason, null);
      res.status(410).json({ error: { code: "expired", message: "This room has expired." } });
      return;
    }

    // Idempotency: existing occupant re-claims → return room (R39, E7, E8, E10)
    if (user.id === row.creator_user_id || user.id === row.opponent_user_id) {
      const view = loadRoomView(db, row.id);
      if (!view) {
        res.status(404).json({ error: { code: "invalid_token", message: "Room not found." } });
        return;
      }
      const presence = getPresenceMap(row.id, view.row);
      const snapshot = buildRoomSnapshot(view.row, user.id, view.names, presence, now);
      res.status(200).json(snapshot);
      return;
    }

    // State checks
    if (row.status === "closed") {
      res.status(409).json({
        error: {
          code: "room_closed",
          message: `Room is closed: ${row.closed_reason ?? "unknown reason"}.`,
        },
      });
      return;
    }
    if (row.status === "starting") {
      res
        .status(409)
        .json({ error: { code: "already_started", message: "Duel has already started." } });
      return;
    }
    if (row.status !== "open") {
      // filled or awaiting_choice — slot taken by another user
      res
        .status(409)
        .json({ error: { code: "already_claimed", message: "Room is already full." } });
      return;
    }

    // Guarded write — T2
    const claimed = claimSlot(db, row.id, user.id, now);
    if (!claimed) {
      // Another request won the race
      res.status(409).json({
        error: { code: "already_claimed", message: "Room was just claimed by someone else." },
      });
      return;
    }

    // Load fresh row + names for snapshot
    const view = loadRoomView(db, row.id);
    if (!view) {
      res
        .status(500)
        .json({ error: { code: "internal", message: "Failed to load room after claim." } });
      return;
    }

    const presence = getPresenceMap(row.id, view.row);
    const snapshot = buildRoomSnapshot(view.row, user.id, view.names, presence, now);

    // Broadcast to any connected sockets (e.g. creator in the room)
    broadcastRoom(db, row.id, view.row, view.names, now);

    res.status(200).json(snapshot);
  };
}
