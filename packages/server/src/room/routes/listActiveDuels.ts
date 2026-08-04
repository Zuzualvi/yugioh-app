// ---------------------------------------------------------------------------
// GET /api/duels/active — returns the caller's non-ended duels and
// non-terminal rooms in a single response.
//
// "In progress" definitions:
//   duel:  status != 'ended'            (only 'ended' is written by duelStore.endDuel)
//   room:  status NOT IN ('closed', 'starting')  (derived from isTerminal() in roomState.ts)
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import type { ActiveDuelEntry, ActiveRoomEntry } from "@yugioh-app/contracts";

interface ActiveDuelRow {
  id: string;
  status: "waiting_for_opponent" | "active";
  seat0_user_id: string;
  seat1_user_id: string | null;
  on_clock_seat: number | null;
  deadline_at: number | null;
  created_at: number;
  seat0_display_name: string | null;
  seat1_display_name: string | null;
}

interface ActiveRoomRow {
  id: string;
  status: "open" | "filled" | "awaiting_choice";
  creator_user_id: string;
  opponent_user_id: string | null;
  room_deadline_at: number;
  created_at: number;
  creator_display_name: string | null;
  opponent_display_name: string | null;
}

export function listActiveDuels(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const userId = req.user!.id;

    const duelRows = db
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

    const duels: ActiveDuelEntry[] = duelRows.map((row) => {
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

    const roomRows = db
      .prepare(
        `SELECT
           r.id,
           r.status,
           r.creator_user_id,
           r.opponent_user_id,
           r.room_deadline_at,
           r.created_at,
           uc.display_name AS creator_display_name,
           uo.display_name AS opponent_display_name
         FROM duel_room r
         LEFT JOIN users uc ON uc.id = r.creator_user_id
         LEFT JOIN users uo ON uo.id = r.opponent_user_id
         WHERE r.status NOT IN ('closed', 'starting')
           AND (r.creator_user_id = ? OR r.opponent_user_id = ?)
         ORDER BY r.created_at DESC
         LIMIT 20`,
      )
      .all(userId, userId) as ActiveRoomRow[];

    const rooms: ActiveRoomEntry[] = roomRows.map((row) => {
      const myRole = row.creator_user_id === userId ? "creator" : "opponent";
      const opponentDisplayName =
        myRole === "creator" ? row.opponent_display_name : row.creator_display_name;

      return {
        roomId: row.id,
        status: row.status,
        myRole,
        opponentDisplayName: opponentDisplayName ?? null,
        roomDeadlineAt: row.room_deadline_at,
        createdAt: row.created_at,
      };
    });

    res.status(200).json({ duels, rooms });
  };
}
