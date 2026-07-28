/**
 * RoomWaiting — S2/S4/S5/S6 phases (waiting, deck pick, ready, etc.)
 * Stub: heading + status line from real room data. S2 fills this out.
 */

import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

export function RoomWaiting({ snapshot }: Props) {
  const status = snapshot.opponent ? "Opponent joined" : "Waiting for opponent…";
  return (
    <section aria-label="Waiting room">
      <h2>Waiting Room</h2>
      <p role="status">{status}</p>
    </section>
  );
}
