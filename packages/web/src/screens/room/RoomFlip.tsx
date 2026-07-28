/**
 * RoomFlip — S7: coin flip reveal (~1.6 s).
 * Stub: heading + status line from real room data. S3 fills this out.
 */

import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

export function RoomFlip({ snapshot }: Props) {
  const winner = snapshot.flip?.winnerDisplayName ?? "…";
  return (
    <section aria-label="Coin flip">
      <h2>Coin Flip</h2>
      <p role="status">{winner} won the flip!</p>
    </section>
  );
}
