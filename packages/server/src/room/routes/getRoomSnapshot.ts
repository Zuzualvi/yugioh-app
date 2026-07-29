// ---------------------------------------------------------------------------
// GET /api/duels/:id/room — Returns the caller's room snapshot (R12/R13).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { getPresenceMap, broadcastRoom } from "../roomBroadcast.js";

export function getRoomSnapshot(db: InstanceType<typeof Database>) {
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

    // Expiry with writeback (R17, R20)
    const { expired, reason } = evaluateExpiry(view.row, now);
    if (expired && reason) {
      closeRoom(db, roomId, reason, null);
      const fresh = loadRoomView(db, roomId);
      if (fresh) {
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
    }

    const presence = getPresenceMap(roomId, view.row);
    const snapshot = buildRoomSnapshot(view.row, userId, view.names, presence, now, view.deckInfo);
    res.status(200).json(snapshot);
  };
}
