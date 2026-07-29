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

function resolveDeckInfo(
  db: InstanceType<typeof Database>,
  deckId: string | null,
  deckJsonFallback: string | null,
): DeckInfo {
  if (deckId) {
    const deck = db
      .prepare("SELECT name, main_json, extra_json FROM decks WHERE id = ?")
      .get(deckId) as DeckRow | undefined;
    if (deck) {
      const main = JSON.parse(deck.main_json) as number[];
      const extra = JSON.parse(deck.extra_json) as number[];
      return { deckId, deckName: deck.name, deckCardCount: main.length + extra.length };
    }
    // Deck deleted: count from locked snapshot if available
    if (deckJsonFallback) {
      const lists = JSON.parse(deckJsonFallback) as { main: number[]; extra: number[] };
      return { deckId, deckName: null, deckCardCount: lists.main.length + lists.extra.length };
    }
    return { deckId, deckName: null, deckCardCount: null };
  }
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
    creator: resolveDeckInfo(db, row.creator_deck_id, row.creator_deck_json),
    opponent: resolveDeckInfo(db, row.opponent_deck_id, row.opponent_deck_json),
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
