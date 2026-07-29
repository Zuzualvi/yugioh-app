// ---------------------------------------------------------------------------
// roomAccess — requireOccupant: resolves the caller's role in a room.
// ---------------------------------------------------------------------------

import type { OccupantRole } from "@yugioh-app/contracts";
import type { DuelRoomRow } from "./roomStore.js";

/** Returns the caller's role, or null if they are not an occupant. */
export function requireOccupant(row: DuelRoomRow, userId: string): OccupantRole | null {
  if (row.creator_user_id === userId) return "creator";
  if (row.opponent_user_id !== null && row.opponent_user_id === userId) return "opponent";
  return null;
}
