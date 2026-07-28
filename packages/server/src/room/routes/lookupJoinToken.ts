// ---------------------------------------------------------------------------
// lookupJoinToken — GET /api/duels/join/:joinToken
// Unauthenticated-capable pre-join verdict (R41, REQ-LINK-01).
// Evaluates expiry with writeback before responding.
// Returns PreJoinRoomInfo; never the raw room status.
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import type { PreJoinVerdict } from "@yugioh-app/contracts";
import { getRoomByJoinToken, closeRoom } from "../roomStore.js";
import { evaluateExpiry } from "../evaluateExpiry.js";
import { resolveSessionUser } from "../../middleware/resolveSessionUser.js";

interface UserRow {
  id: string;
  display_name: string;
}

function getDisplayName(db: InstanceType<typeof Database>, userId: string): string {
  const row = db.prepare("SELECT id, display_name FROM users WHERE id = ?").get(userId) as
    UserRow | undefined;
  return row?.display_name ?? "";
}

export function lookupJoinToken(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const rawToken = req.params["joinToken"];
    const joinToken = typeof rawToken === "string" ? rawToken : "";
    const now = Date.now();

    const row = getRoomByJoinToken(db, joinToken);
    if (!row) {
      res.status(404).json({ error: { code: "invalid_token", message: "Join token not found." } });
      return;
    }

    // Expiry writeback — always first (R20, REQ-LINK-01)
    const expiry = evaluateExpiry(row, now);
    if (expiry.expired && expiry.reason) {
      closeRoom(db, row.id, expiry.reason, null);
      row.status = "closed";
      row.closed_reason = expiry.reason;
    }

    const creatorDisplayName = getDisplayName(db, row.creator_user_id);
    const perMoveSeconds = row.timer_per_move_seconds;

    // Resolve the caller's identity if a session cookie is present (optional auth)
    let callerId: string | null = null;
    const rawSid = req.cookies?.sid;
    const sid = typeof rawSid === "string" ? rawSid : undefined;
    if (sid) {
      const sessionUser = resolveSessionUser(db, sid);
      if (sessionUser) callerId = sessionUser.id;
    }

    // Determine verdict
    let verdict: PreJoinVerdict;
    const status = row.status;

    if (status === "closed") {
      const reason = row.closed_reason ?? "";
      if (
        reason === "expired_unclaimed" ||
        reason === "expired_idle" ||
        reason === "expired_ready" ||
        reason === "expired_choice"
      ) {
        verdict = "expired";
      } else {
        verdict = "closed";
      }
    } else if (status === "starting") {
      verdict = "started";
    } else if (status === "filled" || status === "awaiting_choice") {
      // Slot is taken
      if (callerId) {
        if (callerId === row.creator_user_id) {
          verdict = "you_are_the_creator";
        } else if (callerId === row.opponent_user_id) {
          verdict = "you_are_an_occupant";
        } else {
          verdict = "claimed_by_other";
        }
      } else {
        verdict = "claimed_by_other";
      }
    } else {
      // status === 'open'
      if (callerId) {
        if (callerId === row.creator_user_id) {
          verdict = "you_are_the_creator";
        } else if (callerId === row.opponent_user_id) {
          // shouldn't happen for open, but be safe
          verdict = "you_are_an_occupant";
        } else {
          verdict = "ok";
        }
      } else {
        verdict = "ok";
      }
    }

    const usable = verdict === "ok";

    res.status(200).json({
      perMoveSeconds,
      creatorDisplayName,
      usable,
      reason: verdict,
    });
  };
}
