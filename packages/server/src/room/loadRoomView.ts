// ---------------------------------------------------------------------------
// loadRoomView — Row + display names + deck info in one read.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { getRoom } from "./roomStore.js";
import type { DuelRoomRow } from "./roomStore.js";
import type { OccupantNames } from "./buildRoomSnapshot.js";
import type { DeckInfo, OccupantDeckInfo } from "./buildRoomSnapshot.js";

export interface RoomView {
  row: DuelRoomRow;
  names: OccupantNames;
  deckInfo: OccupantDeckInfo;
}

interface UserRow {
  id: string;
  display_name: string;
}

interface DeckRow {
  name: string;
  main_json: string;
  extra_json: string;
}

// Precedence rule (R23): the lock wins when deck_json is set — the decks table is not consulted.
// 1. deck_json non-null → locked snapshot wins: name from deck_name column, count from deck_json.
// 2. deck_id non-null, no lock → picked but not readied → read the live decks row.
// 3. Otherwise (no deck_id, or live row gone) → all three fields null.
function resolveDeckInfo(
  db: InstanceType<typeof Database>,
  deckId: string | null,
  deckJson: string | null,
  deckName: string | null,
): DeckInfo {
  // Step 1: lock wins
  if (deckJson !== null) {
    const lists = JSON.parse(deckJson) as { main: number[]; extra: number[] };
    return {
      deckId,
      deckName,
      deckCardCount: lists.main.length + lists.extra.length,
    };
  }

  // Step 2: picked but not readied — read the live row
  if (deckId) {
    const deck = db
      .prepare("SELECT name, main_json, extra_json FROM decks WHERE id = ?")
      .get(deckId) as DeckRow | undefined;
    if (deck) {
      const main = JSON.parse(deck.main_json) as number[];
      const extra = JSON.parse(deck.extra_json) as number[];
      return { deckId, deckName: deck.name, deckCardCount: main.length + extra.length };
    }
    // Live row gone (E27 will clear the stale ref on next ready)
    return { deckId, deckName: null, deckCardCount: null };
  }

  // Step 3: no deck associated
  return { deckId: null, deckName: null, deckCardCount: null };
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

  const deckInfo: OccupantDeckInfo = {
    creator: resolveDeckInfo(db, row.creator_deck_id, row.creator_deck_json, row.creator_deck_name),
    opponent: resolveDeckInfo(
      db,
      row.opponent_deck_id,
      row.opponent_deck_json,
      row.opponent_deck_name,
    ),
  };

  return {
    row,
    names: {
      creatorDisplayName: creator?.display_name ?? "",
      opponentDisplayName,
    },
    deckInfo,
  };
}
