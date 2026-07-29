// ---------------------------------------------------------------------------
// POST /api/duels/:id/room/ready — validate-then-write (§5.4).
// Re-resolves and re-validates the deck at this moment; only then calls
// applyReady. Failure changes nothing the other player can observe (R24, E27-28).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom, applyReady } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { broadcastRoom, getPresenceMap, armDeadlineTimer } from "../roomBroadcast.js";
import { validateDeck } from "../../domain/validateDeck.js";

interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  main_json: string;
  extra_json: string;
  side_json: string;
}

export function ready(db: InstanceType<typeof Database>, catalog: LoadedCatalog) {
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

    if (view.row.status !== "filled") {
      res
        .status(409)
        .json({ error: { code: "wrong_state", message: "Room is not in the filled state." } });
      return;
    }

    const deckId = role === "creator" ? view.row.creator_deck_id : view.row.opponent_deck_id;
    const readyAt = role === "creator" ? view.row.creator_ready_at : view.row.opponent_ready_at;

    // No deck picked
    if (!deckId) {
      res.status(400).json({
        error: { code: "deck_required", message: "You must pick a deck before readying." },
      });
      return;
    }

    // Already ready (E29 idempotent, E30 reject different deck)
    if (readyAt !== null) {
      // Re-read to confirm which deck is locked
      // applyReady uses the stored deck_json, not deckId — we just need to
      // check if the caller is submitting ready again idempotently.
      // Since deck is locked, any further ready is either idempotent or already_ready.
      // The deck is already snapshotted; deckId can't change while locked.
      const presence = getPresenceMap(roomId, view.row);
      const snapshot = buildRoomSnapshot(
        view.row,
        userId,
        view.names,
        presence,
        now,
        view.deckInfo,
      );
      res.status(200).json(snapshot);
      return;
    }

    // Re-resolve the deck (validate-then-write, §5.4)
    const deck = db
      .prepare(
        "SELECT id, owner_id, name, main_json, extra_json, side_json FROM decks WHERE id = ?",
      )
      .get(deckId) as DeckRow | undefined;

    if (!deck) {
      // Deck deleted since picking — clear the stale reference (E27)
      const deckCol = role === "creator" ? "creator_deck_id" : "opponent_deck_id";
      db.prepare(`UPDATE duel_room SET ${deckCol} = NULL WHERE id = ?`).run(roomId);
      res.status(400).json({
        error: { code: "deck_invalid", message: "That deck no longer exists — pick another." },
      });
      return;
    }

    if (deck.owner_id !== userId) {
      // Deck transferred / ownership mismatch — clear the stale reference
      const deckCol = role === "creator" ? "creator_deck_id" : "opponent_deck_id";
      db.prepare(`UPDATE duel_room SET ${deckCol} = NULL WHERE id = ?`).run(roomId);
      res
        .status(400)
        .json({ error: { code: "deck_invalid", message: "That deck does not belong to you." } });
      return;
    }

    const main = JSON.parse(deck.main_json) as number[];
    const extra = JSON.parse(deck.extra_json) as number[];
    const side = JSON.parse(deck.side_json) as number[];

    // Validate against the live catalog (E28)
    const validation = validateDeck({ main, extra, side }, catalog);
    if (!validation.legal) {
      res.status(400).json({
        error: {
          code: "deck_invalid",
          message: "Deck is not Edison-legal.",
          validation,
        },
      });
      return;
    }

    // Snapshot includes main + extra only (DeckLists; side is never stored in the room)
    const deckSnapshot = { main, extra };

    // applyReady does T4 (+T5 if both ready) in one transaction (R24, R29)
    const result = applyReady(db, roomId, role, deckSnapshot, deck.name, now);
    if (!result) {
      res.status(409).json({
        error: { code: "wrong_state", message: "Ready guard failed — room state changed." },
      });
      return;
    }

    // Re-arm deadline timer with the new deadline
    armDeadlineTimer(db, roomId, result.roomDeadlineAt);

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
