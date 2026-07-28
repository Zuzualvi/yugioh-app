// ---------------------------------------------------------------------------
// loadRoomView — Row + both display names in one read.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { getRoom } from "./roomStore.js";
import type { DuelRoomRow } from "./roomStore.js";
import type { OccupantNames } from "./buildRoomSnapshot.js";

export interface RoomView {
  row: DuelRoomRow;
  names: OccupantNames;
}

interface UserRow {
  id: string;
  display_name: string;
}

export function loadRoomView(db: InstanceType<typeof Database>, roomId: string): RoomView | null {
  const row = getRoom(db, roomId);
  if (!row) return null;

  const creator = db
    .prepare("SELECT id, display_name FROM users WHERE id = ?")
    .get(row.creator_user_id) as UserRow | undefined;

  let opponentDisplayName: string | null = null;
  if (row.opponent_user_id) {
    const opp = db
      .prepare("SELECT id, display_name FROM users WHERE id = ?")
      .get(row.opponent_user_id) as UserRow | undefined;
    opponentDisplayName = opp?.display_name ?? null;
  }

  return {
    row,
    names: {
      creatorDisplayName: creator?.display_name ?? "",
      opponentDisplayName,
    },
  };
}
