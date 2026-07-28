// ---------------------------------------------------------------------------
// buildRoomSnapshot — Pure. Assembles a RoomSnapshot for a specific viewer.
// No DB, no Date.now(). `now` is always a parameter.
// This is the ONLY place one occupant's data is assembled for the other's eyes.
// ---------------------------------------------------------------------------

import type {
  RoomSnapshot,
  RoomSelfView,
  RoomOpponentView,
  RoomPresence,
  OccupantRole,
  RoomFlip,
} from "@yugioh-app/contracts";
import type { DuelRoomRow } from "./roomStore.js";

export interface OccupantNames {
  creatorDisplayName: string;
  opponentDisplayName: string | null;
}

export interface PresenceMap {
  creatorPresence: RoomPresence;
  opponentPresence: RoomPresence;
}

interface DeckInfo {
  deckId: string | null;
  deckName: string | null;
  deckCardCount: number | null;
}

export function buildRoomSnapshot(
  row: DuelRoomRow,
  viewerUserId: string,
  names: OccupantNames,
  presence: PresenceMap,
  now: number,
  deckInfo?: { creator?: DeckInfo; opponent?: DeckInfo },
): RoomSnapshot {
  const isCreator = row.creator_user_id === viewerUserId;
  const viewerRole: OccupantRole = isCreator ? "creator" : "opponent";

  const creatorDeck = deckInfo?.creator ?? { deckId: null, deckName: null, deckCardCount: null };
  const opponentDeck = deckInfo?.opponent ?? {
    deckId: null,
    deckName: null,
    deckCardCount: null,
  };

  const selfDeck = isCreator ? creatorDeck : opponentDeck;
  const selfReadyAt = isCreator ? row.creator_ready_at : row.opponent_ready_at;
  const selfDeckId = isCreator ? row.creator_deck_id : row.opponent_deck_id;
  const selfDeckLocked = isCreator ? row.creator_ready_at !== null : row.opponent_ready_at !== null;
  const selfPresence = isCreator ? presence.creatorPresence : presence.opponentPresence;

  const you: RoomSelfView = {
    role: viewerRole,
    userId: viewerUserId,
    displayName: isCreator ? names.creatorDisplayName : (names.opponentDisplayName ?? ""),
    presence: selfPresence,
    deckSelected: selfDeckId !== null,
    ready: selfReadyAt !== null,
    deckId: selfDeck.deckId ?? selfDeckId,
    deckName: selfDeck.deckName,
    deckCardCount: selfDeck.deckCardCount,
    deckLocked: selfDeckLocked,
  };

  let opponent: RoomOpponentView | null = null;
  if (row.opponent_user_id !== null) {
    const opponentUserId = isCreator ? row.opponent_user_id : row.creator_user_id;
    const opponentRole: OccupantRole = isCreator ? "opponent" : "creator";
    const opponentReadyAt = isCreator ? row.opponent_ready_at : row.creator_ready_at;
    const opponentDeckId = isCreator ? row.opponent_deck_id : row.creator_deck_id;
    const opponentPresence = isCreator ? presence.opponentPresence : presence.creatorPresence;

    // R25: NEVER emit the opponent's deck name, deck id or card count.
    opponent = {
      role: opponentRole,
      userId: opponentUserId,
      displayName: isCreator ? (names.opponentDisplayName ?? "") : names.creatorDisplayName,
      presence: opponentPresence,
      deckSelected: opponentDeckId !== null,
      ready: opponentReadyAt !== null,
    };
  }

  let flip: RoomFlip | null = null;
  if (row.flip_winner_user_id !== null && row.flip_rolled_at !== null) {
    const winnerIsCreator = row.flip_winner_user_id === row.creator_user_id;
    const winnerDisplayName = winnerIsCreator
      ? names.creatorDisplayName
      : (names.opponentDisplayName ?? "");
    flip = {
      winnerUserId: row.flip_winner_user_id,
      winnerDisplayName,
      rolledAt: row.flip_rolled_at,
      choice: (row.flip_choice as "first" | "second" | null) ?? null,
    };
  }

  const seats = row.status === "starting" && row.flip_choice !== null ? buildSeats(row) : null;

  // joinToken: non-null ONLY for the creator, and ONLY while status is 'open'
  const joinToken = isCreator && row.status === "open" ? row.join_token : null;

  return {
    roomId: row.id,
    status: row.status as RoomSnapshot["status"],
    closedReason: (row.closed_reason as RoomSnapshot["closedReason"]) ?? null,
    closedByUserId: row.closed_by_user_id,
    perMoveSeconds: row.timer_per_move_seconds,
    createdAt: row.created_at,
    roomDeadlineAt:
      row.status === "starting" || row.status === "closed" ? null : row.room_deadline_at,
    serverNow: now,
    joinToken,
    you,
    opponent,
    flip,
    seats,
  };
}

function buildSeats(row: DuelRoomRow): { seat0UserId: string; seat1UserId: string } | null {
  if (!row.flip_winner_user_id || !row.flip_choice || !row.opponent_user_id) return null;
  const flipWinner = row.flip_winner_user_id;
  const other = flipWinner === row.creator_user_id ? row.opponent_user_id : row.creator_user_id;
  const seat0UserId = row.flip_choice === "first" ? flipWinner : other;
  const seat1UserId = row.flip_choice === "first" ? other : flipWinner;
  return { seat0UserId, seat1UserId };
}
