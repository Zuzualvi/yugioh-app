// ---------------------------------------------------------------------------
// timer — per-move deadline math and scheduling.
// ---------------------------------------------------------------------------

import type { Seat } from "@yugioh-app/contracts";

/** Compute the absolute deadline for a new move. */
export function computeDeadline(timerPerMoveSeconds: number): number {
  return Date.now() + timerPerMoveSeconds * 1000;
}

/** True if a stored deadline has already elapsed. */
export function isExpired(deadlineAt: number | null): boolean {
  if (deadlineAt === null) return false;
  return Date.now() >= deadlineAt;
}

/**
 * Schedule a timeout callback at the given deadline.
 * Returns the NodeJS.Timeout handle; cancel with clearTimeout.
 */
export function scheduleTimeout(
  deadlineAt: number,
  onExpire: () => void,
): ReturnType<typeof setTimeout> {
  const delay = Math.max(0, deadlineAt - Date.now());
  return setTimeout(onExpire, delay);
}

/** Return the other seat. */
export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}
