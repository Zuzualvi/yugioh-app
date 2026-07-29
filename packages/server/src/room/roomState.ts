// ---------------------------------------------------------------------------
// roomState — Pure transition guards and helpers. No DB, no clock.
// `now` is always a parameter. Invariants are tested here.
// ---------------------------------------------------------------------------

import type { RoomClosedReason, RoomStatus } from "@yugioh-app/contracts";

export const ROOM_OPEN_TTL_MS = 30 * 60 * 1000; // 30 min at mint
export const ROOM_READY_TTL_MS = 10 * 60 * 1000; // 10 min after first ready
export const ROOM_CHOICE_TTL_MS = 2 * 60 * 1000; // 2 min after flip

/** The closed reason for a given status at expiry. `null` means this status never expires. */
export function closedReasonForExpiry(status: RoomStatus): RoomClosedReason | null {
  switch (status) {
    case "open":
      return "expired_unclaimed";
    case "filled":
      return null; // determined by evaluateExpiry (idle vs ready)
    case "awaiting_choice":
      return "expired_choice";
    case "starting":
      return null; // never expires
    case "closed":
      return null; // terminal
  }
}

/** Statuses that are terminal — no transition out. */
export function isTerminal(status: RoomStatus): boolean {
  return status === "closed" || status === "starting";
}
