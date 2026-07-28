/**
 * RoomHandoff — S10: 3-2-1 countdown before board mounts.
 * Stub: heading + status line from real room data. S3 fills this out.
 */

import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

export function RoomHandoff({ snapshot }: Props) {
  const seat0 = snapshot.seats?.seat0UserId ?? "…";
  return (
    <section aria-label="Duel starting">
      <h2>Duel Starting</h2>
      <p role="status">Seat 0: {seat0} — get ready!</p>
    </section>
  );
}
