// ---------------------------------------------------------------------------
// evaluateExpiry — Pure. (row, now) → { expired, reason }.
// No DB, no Date.now() inside. Called first by every handler and snapshot read.
// ---------------------------------------------------------------------------

import type { RoomClosedReason } from "@yugioh-app/contracts";
import type { DuelRoomRow } from "./roomStore.js";

export interface ExpiryResult {
  expired: boolean;
  reason: RoomClosedReason | null;
}

export function evaluateExpiry(row: DuelRoomRow, now: number): ExpiryResult {
  if (row.status === "closed" || row.status === "starting") {
    return { expired: false, reason: null };
  }

  if (row.room_deadline_at === null || now < row.room_deadline_at) {
    return { expired: false, reason: null };
  }

  // Deadline has passed — determine reason by status
  switch (row.status) {
    case "open":
      return { expired: true, reason: "expired_unclaimed" };
    case "filled": {
      // expired_ready if at least one ready_at is non-null, otherwise expired_idle
      const anyReady = row.creator_ready_at !== null || row.opponent_ready_at !== null;
      return { expired: true, reason: anyReady ? "expired_ready" : "expired_idle" };
    }
    case "awaiting_choice":
      return { expired: true, reason: "expired_choice" };
    default:
      return { expired: false, reason: null };
  }
}
