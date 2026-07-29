// ---------------------------------------------------------------------------
// POST /api/duels/:id/room/deck — pick or change deck reference.
// T3: Stores only a reference; snapshot is taken at ready (§5.4).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { PickDeckBodySchema } from "@yugioh-app/contracts";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom, setDeckRef } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { broadcastRoom, getPresenceMap, armDeadlineTimer } from "../roomBroadcast.js";

interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  main_json: string;
  extra_json: string;
}

export function pickDeck(db: InstanceType<typeof Database>) {
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
    if (status !== "open" && status !== "filled") {
      res.status(409).json({
        error: { code: "wrong_state", message: "Cannot pick a deck in this room state." },
      });
      return;
    }

    // Check if this occupant is already ready (deck is locked)
    const readyAt = role === "creator" ? view.row.creator_ready_at : view.row.opponent_ready_at;
    if (readyAt !== null) {
      res.status(409).json({
        error: { code: "already_ready", message: "Your deck is locked. Un-ready to change it." },
      });
      return;
    }

    // Parse and validate body
    const parsed = PickDeckBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: "deckId is required." } });
      return;
    }
    const { deckId } = parsed.data;

    // Verify the deck exists and belongs to the caller
    const deck = db
      .prepare("SELECT id, owner_id, name, main_json, extra_json FROM decks WHERE id = ?")
      .get(deckId) as DeckRow | undefined;

    if (!deck) {
      res.status(400).json({ error: { code: "deck_invalid", message: "Deck not found." } });
      return;
    }
    if (deck.owner_id !== userId) {
      res
        .status(400)
        .json({ error: { code: "deck_invalid", message: "Deck does not belong to you." } });
      return;
    }

    // setDeckRef guards on status IN ('open','filled') AND ready_at IS NULL
    const wrote = setDeckRef(db, roomId, role, deckId);
    if (!wrote) {
      res
        .status(409)
        .json({ error: { code: "wrong_state", message: "Could not save deck pick." } });
      return;
    }

    const fresh = loadRoomView(db, roomId);
    if (!fresh) {
      res.status(500).json({ error: { code: "internal_error", message: "Room vanished." } });
      return;
    }

    // Broadcast to others; caller gets their own full view
    broadcastRoom(db, roomId, fresh, now);
    if (fresh.row.room_deadline_at) {
      armDeadlineTimer(db, roomId, fresh.row.room_deadline_at);
    }

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
