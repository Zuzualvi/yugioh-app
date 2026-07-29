// ---------------------------------------------------------------------------
// GET /api/duels/:id/seat — R32: seat credential for authenticated seat holder.
//
// Returns { seat, seatToken } to the authenticated user who holds a seat in
// this duel. Returns 403 to anyone who is not a seat holder.
// Allows DuelScreen to recover credentials after a refresh (E45).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { getDuel } from "../../duel/duelStore.js";
import type { Seat } from "@yugioh-app/contracts";

export function getSeatCredential(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const duelId = req.params["id"] as string;
    const userId = req.user!.id;

    const duelRow = getDuel(db, duelId);
    if (!duelRow) {
      res.status(404).json({ error: { code: "not_found", message: "Duel not found." } });
      return;
    }

    // Match userId to a seat
    let seat: Seat;
    let seatToken: string;

    if (duelRow.seat0_user_id === userId) {
      seat = 0;
      seatToken = duelRow.seat0_token;
    } else if (duelRow.seat1_user_id === userId) {
      seat = 1;
      seatToken = duelRow.seat1_token;
    } else {
      res.status(403).json({ error: { code: "not_occupant", message: "Not a seat holder." } });
      return;
    }

    res.status(200).json({ seat, seatToken });
  };
}
