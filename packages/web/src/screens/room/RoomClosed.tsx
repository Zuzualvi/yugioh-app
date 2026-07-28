/**
 * RoomClosed — D1 creator variant, D4 creator-left, E48.
 * Stub: heading + status line from real room data. S2 fills this out.
 */

import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

const REASON_LABEL: Record<string, string> = {
  left: "The room was left.",
  expired_unclaimed: "The invite link expired.",
  expired_idle: "The room expired — no decks were selected in time.",
  expired_ready: "The room expired — duel did not start in time.",
  expired_choice: "The room expired — no seat choice was made.",
  engine_failed: "The duel engine failed to start.",
};

export function RoomClosed({ snapshot }: Props) {
  const reason = snapshot.closedReason
    ? (REASON_LABEL[snapshot.closedReason] ?? "Room closed.")
    : "Room closed.";
  return (
    <section aria-label="Room closed">
      <h2>Room Closed</h2>
      <p role="status">{reason}</p>
    </section>
  );
}
