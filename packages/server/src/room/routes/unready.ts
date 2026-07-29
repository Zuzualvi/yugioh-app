// ---------------------------------------------------------------------------
// POST /api/duels/:id/room/unready — clear ready flag and locked snapshot.
// Works while room is 'filled' and the flip has not fired.
// Never moves room_deadline_at (R28).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom, clearReady } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { broadcastRoom, getPresenceMap, armDeadlineTimer } from "../roomBroadcast.js";

export function unready(db: InstanceType<typeof Database>) {
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
        broadcastRoom(db, roomId, fresh.row, fresh.names, now);
        const presence = getPresenceMap(roomId, fresh.row);
        const snap = buildRoomSnapshot(fresh.row, userId, fresh.names, presence, now);
        res
          .status(410)
          .json({ error: { code: "expired", message: "Room has expired." }, snapshot: snap });
        return;
      }
    }

    if (view.row.status !== "filled") {
      res
        .status(409)
        .json({ error: { code: "wrong_state", message: "Cannot un-ready in this room state." } });
      return;
    }

    const readyAt = role === "creator" ? view.row.creator_ready_at : view.row.opponent_ready_at;

    // Idempotent: if not ready, just return current snapshot
    if (readyAt === null) {
      const presence = getPresenceMap(roomId, view.row);
      const snapshot = buildRoomSnapshot(view.row, userId, view.names, presence, now);
      res.status(200).json(snapshot);
      return;
    }

    // clearReady clears ready_at AND deck_json; guarded on status='filled' AND ready_at IS NOT NULL
    const cleared = clearReady(db, roomId, role);
    if (!cleared) {
      res.status(409).json({ error: { code: "wrong_state", message: "Un-ready guard failed." } });
      return;
    }

    const fresh = loadRoomView(db, roomId);
    if (!fresh) {
      res.status(500).json({ error: { code: "internal_error", message: "Room vanished." } });
      return;
    }

    broadcastRoom(db, roomId, fresh.row, fresh.names, now);
    if (fresh.row.room_deadline_at) {
      armDeadlineTimer(db, roomId, fresh.row.room_deadline_at);
    }
    const presence = getPresenceMap(roomId, fresh.row);
    const snapshot = buildRoomSnapshot(fresh.row, userId, fresh.names, presence, now);
    res.status(200).json(snapshot);
  };
}
