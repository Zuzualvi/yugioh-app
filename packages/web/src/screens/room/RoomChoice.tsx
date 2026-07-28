/**
 * RoomChoice — S8/S9: flip winner picks first or second.
 * Stub: heading + status line from real room data. S3 fills this out.
 */

import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

export function RoomChoice({ snapshot }: Props) {
  const isWinner = snapshot.flip?.winnerUserId === snapshot.you.userId;
  const status = isWinner ? "Choose: go first or second?" : "Waiting for flip winner's choice…";
  return (
    <section aria-label="Seat choice">
      <h2>Choose Your Seat</h2>
      <p role="status">{status}</p>
    </section>
  );
}
