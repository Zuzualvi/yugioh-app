// ---------------------------------------------------------------------------
// GET /api/duels/active — returns the caller's non-ended duels.
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import type { ActiveDuelEntry } from "@yugioh-app/contracts";

interface ActiveDuelRow {
  id: string;
  status: "waiting_for_opponent" | "active";
  seat0_user_id: string;
  seat1_user_id: string | null;
  on_clock_seat: number | null;
  deadline_at: number | null;
  created_at: number;
  seat1_display_name: string | null;
  seat0_display_name: string | null;
}

export function listActiveDuels(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const userId = req.user!.id;

    const rows = db
      .prepare(
        `SELECT
           d.id,
           d.status,
           d.seat0_user_id,
           d.seat1_user_id,
           d.on_clock_seat,
           d.deadline_at,
           d.created_at,
           u0.display_name AS seat0_display_name,
           u1.display_name AS seat1_display_name
         FROM duel d
         LEFT JOIN users u0 ON u0.id = d.seat0_user_id
         LEFT JOIN users u1 ON u1.id = d.seat1_user_id
         WHERE d.status != 'ended'
           AND (d.seat0_user_id = ? OR d.seat1_user_id = ?)
         ORDER BY d.created_at DESC
         LIMIT 20`,
      )
      .all(userId, userId) as ActiveDuelRow[];

    const duels: ActiveDuelEntry[] = rows.map((row) => {
      const mySeat = row.seat0_user_id === userId ? 0 : 1;
      const opponentDisplayName = mySeat === 0 ? row.seat1_display_name : row.seat0_display_name;

      return {
        duelId: row.id,
        status: row.status,
        mySeat: mySeat as 0 | 1,
        opponentDisplayName: opponentDisplayName ?? null,
        onClockSeat: (row.on_clock_seat as 0 | 1 | null) ?? null,
        deadlineAt: row.deadline_at ?? null,
        createdAt: row.created_at,
      };
    });

    res.status(200).json({ duels });
  };
}
