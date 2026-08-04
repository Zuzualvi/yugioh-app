// ---------------------------------------------------------------------------
// @yugioh-app/contracts — ops API types
// Locked contract for the bounded ops API (Slice B, ZUH-62).
// Field names are camelCase throughout, matching the JSON response shapes.
// ---------------------------------------------------------------------------

export interface OpsMigrationRow {
  version: number;
  appliedAt: string;
}

export interface OpsMigrationsResponse {
  applied: OpsMigrationRow[];
  latest: number | null;
  expected: number;
  upToDate: boolean;
}

export interface OpsCountsResponse {
  counts: {
    users: number;
    invites: number;
    sessions: number;
    decks: number;
    duel: number;
    duelRoom: number;
    responseLog: number;
  };
}

export interface OpsUserSummary {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
}

export interface OpsUsersResponse {
  users: OpsUserSummary[];
}

export interface OpsUserDetail {
  id: string;
  displayName: string;
  role: string;
  createdAt: string;
  deckCount: number;
  sessionCount: number;
  roomCount: number;
  duelCount: number;
}

export interface OpsUserResponse {
  user: OpsUserDetail;
}

export interface OpsDuelDetail {
  id: string;
  status: string;
  winner: number | null;
  endReason: string | null;
  seat0UserId: string;
  seat1UserId: string | null;
  onClockSeat: number | null;
  deadlineAt: number | null;
  createdAt: number;
  responseLogCount: number;
}

export interface OpsDuelResponse {
  duel: OpsDuelDetail;
}

export interface OpsRoomDetail {
  id: string;
  status: string;
  closedReason: string | null;
  creatorUserId: string;
  opponentUserId: string | null;
  creatorDeckName: string | null;
  opponentDeckName: string | null;
  creatorReadyAt: number | null;
  opponentReadyAt: number | null;
  flipWinnerUserId: string | null;
  flipChoice: string | null;
  roomDeadlineAt: number;
  createdAt: number;
}

export interface OpsRoomResponse {
  room: OpsRoomDetail;
}

export interface OpsDeleteDuelResponse {
  deleted: { duel: number; responseLog: number };
}

export interface OpsDeleteRoomResponse {
  deleted: { duelRoom: number };
}

export interface OpsDeleteUserResponse {
  deleted: {
    user: number;
    sessions: number;
    decks: number;
    invites: number;
    duelRoom: number;
    duel: number;
    responseLog: number;
  };
}
