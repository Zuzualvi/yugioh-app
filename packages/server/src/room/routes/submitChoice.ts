// ---------------------------------------------------------------------------
// POST /api/duels/:id/room/choice — T6: flip winner submits first/second.
//
// In one transaction:
//   1. applyChoice (guarded UPDATE → status='starting', derives seats)
//   2. INSERT duel row with same id, same seed, decks reordered by seat,
//      freshly minted seat tokens, deadline_at=NULL, on_clock_seat=NULL
// Then broadcasts the updated room state and dispatches T7 (engine start).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { SubmitChoiceBodySchema } from "@yugioh-app/contracts";
import { applyChoice } from "../roomStore.js";
import { loadRoomView } from "../loadRoomView.js";
import { requireOccupant } from "../roomAccess.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { closeRoom } from "../roomStore.js";
import { buildRoomSnapshot } from "../buildRoomSnapshot.js";
import { broadcastRoom, getPresenceMap } from "../roomBroadcast.js";
import { dispatchDuelStart } from "../../duel/startDuelFromRoom.js";
import { EDISON_FLAGS } from "@yugioh-app/engine";

export function submitChoice(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const roomId = req.params["id"] as string;
    const userId = req.user!.id;
    const now = Date.now();

    // Validate request body
    const parsed = SubmitChoiceBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_choice", message: "Invalid choice value." } });
      return;
    }
    const { choice } = parsed.data;

    // Load room
    const view = loadRoomView(db, roomId);
    if (!view) {
      res.status(404).json({ error: { code: "not_found", message: "Room not found." } });
      return;
    }

    // Occupant check
    const role = requireOccupant(view.row, userId);
    if (!role) {
      res.status(403).json({ error: { code: "not_occupant", message: "Not an occupant." } });
      return;
    }

    // Expiry with writeback (R17, R20)
    const { expired, reason: expiredReason } = evaluateExpiry(view.row, now);
    if (expired && expiredReason) {
      closeRoom(db, roomId, expiredReason, null);
      const fresh = loadRoomView(db, roomId);
      if (fresh) {
        broadcastRoom(db, roomId, fresh.row, fresh.names, now);
      }
      res.status(410).json({ error: { code: "expired", message: "Room has expired." } });
      return;
    }

    // Flip winner guard (R30, E41)
    if (view.row.flip_winner_user_id !== userId) {
      res
        .status(403)
        .json({ error: { code: "not_flip_winner", message: "Only the flip winner may choose." } });
      return;
    }

    // T6: applyChoice + INSERT duel row — in one transaction
    const row = view.row;
    const txResult = (
      db.transaction(() => {
        // 1. Guard + write flip_choice, status='starting'; derive seats
        const seats = applyChoice(db, roomId, choice, now);
        if (!seats) return null;

        // 2. Mint seat tokens
        const seat0Token = randomUUID();
        const seat1Token = randomUUID();

        // 3. Reorder decks by seat
        const creatorIsS0 = seats.seat0UserId === row.creator_user_id;
        const deck0Json = creatorIsS0 ? row.creator_deck_json : row.opponent_deck_json;
        const deck1Json = creatorIsS0 ? row.opponent_deck_json : row.creator_deck_json;

        // 4. INSERT duel row (same id, same seed, same join_token)
        db.prepare(
          `INSERT INTO duel
             (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id,
              seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds,
              status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'starting', ?)`,
        ).run(
          roomId,
          row.join_token,
          seat0Token,
          seat1Token,
          seats.seat0UserId,
          seats.seat1UserId,
          row.seed_json,
          EDISON_FLAGS.toString(16),
          deck0Json,
          deck1Json,
          row.timer_per_move_seconds,
          now,
        );

        return { seats, seat0Token, seat1Token };
      }) as () => {
        seats: { seat0UserId: string; seat1UserId: string };
        seat0Token: string;
        seat1Token: string;
      } | null
    )();

    if (!txResult) {
      res.status(409).json({
        error: { code: "wrong_state", message: "Room is not in awaiting_choice state." },
      });
      return;
    }

    // Broadcast the new 'starting' room snapshot
    const freshView = loadRoomView(db, roomId);
    if (freshView) {
      broadcastRoom(db, roomId, freshView.row, freshView.names, now);
    }

    // Return caller's snapshot
    const finalView = freshView ?? view;
    const presence = getPresenceMap(roomId, finalView.row);
    const snapshot = buildRoomSnapshot(finalView.row, userId, finalView.names, presence, now);

    // T7: async engine start (fire-and-forget)
    dispatchDuelStart(roomId);

    res.status(200).json(snapshot);
  };
}
