// ---------------------------------------------------------------------------
// POST /api/duels/:id/room/leave — leave the room.
//
// Creator leave: always closes the room (T8), in any non-starting state.
// Opponent leave from filled: T11 — revert to open (or close expired_unclaimed
//   if the restored deadline is already past).
// Any leave from awaiting_choice: closes the room.
// Leave from starting: rejected leave_not_allowed (R36, E44).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom, revertToOpen } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { broadcastRoom, getPresenceMap, armDeadlineTimer } from "../roomBroadcast.js";
import { ROOM_OPEN_TTL_MS } from "../roomState.js";

export function leave(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const roomId = req.params["id"] as string;
    const userId = req.user!.id;
    const now = Date.now();

    const view = loadRoomView(db, roomId);
    if (!view) {
      res.status(404).json({ error: { code: "not_found", message: "Room not found." } });
      return;
    }

    const role = requireOccupant(view.row, userId);
    if (!role) {
      res.status(403).json({ error: { code: "not_occupant", message: "Not an occupant." } });
      return;
    }

    // Expiry-first (R17, R20, E35)
    const { expired, reason } = evaluateExpiry(view.row, now);
    if (expired && reason) {
      closeRoom(db, roomId, reason, null);
      const fresh = loadRoomView(db, roomId);
      if (fresh) {
        broadcastRoom(db, roomId, fresh, now);
        const presence = getPresenceMap(roomId, fresh.row);
        const snap = buildRoomSnapshot(
          fresh.row,
          userId,
          fresh.names,
          presence,
          now,
          fresh.deckInfo,
        );
        res
          .status(410)
          .json({ error: { code: "expired", message: "Room has expired." }, snapshot: snap });
        return;
      }
    }

    const { status } = view.row;

    // Cannot leave once the room is starting (R36, E44)
    if (status === "starting") {
      res.status(409).json({
        error: { code: "leave_not_allowed", message: "Cannot leave once the duel is starting." },
      });
      return;
    }

    if (status === "closed") {
      res.status(409).json({ error: { code: "wrong_state", message: "Room is already closed." } });
      return;
    }

    // T11: opponent leaving from filled — revert to open (§5.1 T11, R34)
    if (role === "opponent" && status === "filled") {
      const restoredDeadline = view.row.created_at + ROOM_OPEN_TTL_MS;

      if (now >= restoredDeadline) {
        // Restored deadline already past — close as expired_unclaimed (§5.1 T11)
        closeRoom(db, roomId, "expired_unclaimed", null);
      } else {
        // Revert to open; original link works again
        const reverted = revertToOpen(db, roomId, restoredDeadline);
        if (!reverted) {
          // Concurrent state change — close anyway
          closeRoom(db, roomId, "left", userId);
        } else {
          armDeadlineTimer(db, roomId, restoredDeadline);
        }
      }

      const fresh = loadRoomView(db, roomId);
      if (!fresh) {
        res.status(500).json({ error: { code: "internal_error", message: "Room vanished." } });
        return;
      }
      broadcastRoom(db, roomId, fresh, now);
      const presence = getPresenceMap(roomId, fresh.row);
      const snapshot = buildRoomSnapshot(
        fresh.row,
        userId,
        fresh.names,
        presence,
        now,
        fresh.deckInfo,
      );
      res.status(200).json(snapshot);
      return;
    }

    // All other cases: close the room (T8)
    // - creator leaving from any state (open, filled, awaiting_choice)
    // - opponent leaving from awaiting_choice
    closeRoom(db, roomId, "left", userId);

    const fresh = loadRoomView(db, roomId);
    if (!fresh) {
      res.status(500).json({ error: { code: "internal_error", message: "Room vanished." } });
      return;
    }
    broadcastRoom(db, roomId, fresh, now);
    const presence = getPresenceMap(roomId, fresh.row);
    const snapshot = buildRoomSnapshot(
      fresh.row,
      userId,
      fresh.names,
      presence,
      now,
      fresh.deckInfo,
    );
    res.status(200).json(snapshot);
  };
}
