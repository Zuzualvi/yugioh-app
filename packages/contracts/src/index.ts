// ---------------------------------------------------------------------------
// @yugioh-app/contracts — public surface
// Spec 13 §1-3: types + Zod schemas for the entire V1 API surface.
// Field names are LOCKED — do not vary without a spec update.
// ---------------------------------------------------------------------------

// Legacy WebSocket contract (used by engine package)
export { WsMessageSchema } from "./ws.js";
export type { WsMessage } from "./ws.js";

export type { Banlist, CardDTO, CardCatalog, CardSearch, CardListResponse } from "./card.js";
export {
  BanlistSchema,
  CardDTOSchema,
  CardCatalogSchema,
  CardSearchSchema,
  CardListResponseSchema,
} from "./card.js";

export type { User, RedeemInviteBody, LoginBody } from "./user.js";
export { UserSchema, RedeemInviteBodySchema, LoginBodySchema } from "./user.js";

export type {
  Seat,
  DuelId,
  PerMoveTimer,
  CreateDuelBody,
  JoinDuelBody,
  DuelStatus,
  EngineResponse,
  RedactedEngineMessage,
  ZoneCard,
  DuelZones,
  DuelStateSnapshot,
  DuelEndReason,
  DuelServerMessage,
  DuelClientMessage,
} from "./duel.js";
export {
  SeatSchema,
  PerMoveTimerSchema,
  CreateDuelBodySchema,
  JoinDuelBodySchema,
  DuelStatusSchema,
  EngineResponseSchema,
  RedactedEngineMessageSchema,
  ZoneCardSchema,
  DuelZonesSchema,
  DuelStateSnapshotSchema,
  DuelEndReasonSchema,
  DuelServerMessageSchema,
  DuelClientMessageSchema,
} from "./duel.js";

export type {
  Violation,
  ViolationCode,
  DeckValidation,
  DeckSummary,
  Deck,
  DeckBody,
  DeckExportBody,
  DeckImportResult,
} from "./deck.js";
export {
  ViolationSchema,
  DeckValidationSchema,
  DeckSummarySchema,
  DeckSchema,
  DeckBodySchema,
  DeckExportBodySchema,
  DeckImportResultSchema,
} from "./deck.js";

export type {
  DocsSection,
  DocsGroup,
  DocsFrontmatter,
  DocsAnchor,
  DocsManifestEntry,
  DocsManifest,
  QuickAnswer,
} from "./docsManifest.js";

export type {
  PositionCode,
  Attribute,
  Race,
  LocationCode,
  CardEntry,
  ActiveCardEntry,
  AttackEntry,
  ZoneEntry,
  SumEntry,
  CounterEntry,
  AnnounceFilter,
  DuelDecision,
  DuelDecisionResponse,
  IdleCommandActionType,
  BattleCommandActionType,
} from "./duelDecision.js";
export {
  PositionCodeSchema,
  AttributeSchema,
  RaceSchema,
  LocationCodeSchema,
  CardEntrySchema,
  ActiveCardEntrySchema,
  AttackEntrySchema,
  ZoneEntrySchema,
  SumEntrySchema,
  CounterEntrySchema,
  AnnounceFilterSchema,
  DuelDecisionSchema,
  DuelDecisionResponseSchema,
  IdleCommandAction,
  BattleCommandAction,
} from "./duelDecision.js";

// Ops API types — ZUH-62 / Slice B
export type {
  OpsMigrationRow,
  OpsMigrationsResponse,
  OpsCountsResponse,
  OpsUserSummary,
  OpsUsersResponse,
  OpsUserDetail,
  OpsUserResponse,
  OpsDuelDetail,
  OpsDuelResponse,
  OpsRoomDetail,
  OpsRoomResponse,
  OpsDeleteDuelResponse,
  OpsDeleteRoomResponse,
  OpsDeleteUserResponse,
} from "./ops.js";

// Room contracts — ZUH-26 / S0
export type {
  RoomStatus,
  RoomClosedReason,
  RoomPresence,
  OccupantRole,
  SeatChoice,
  RoomOpponentView,
  RoomSelfView,
  RoomFlip,
  RoomSnapshot,
  RoomServerMessage,
  PreJoinVerdict,
  PreJoinRoomInfo,
  CreateRoomBody,
  CreateRoomResult,
  ClaimRoomBody,
  PickDeckBody,
  SubmitChoiceBody,
  SeatCredential,
} from "./room.js";
export {
  RoomStatusSchema,
  RoomClosedReasonSchema,
  RoomPresenceSchema,
  OccupantRoleSchema,
  SeatChoiceSchema,
  RoomOpponentViewSchema,
  RoomSelfViewSchema,
  RoomFlipSchema,
  RoomSnapshotSchema,
  RoomServerMessageSchema,
  PreJoinVerdictSchema,
  PreJoinRoomInfoSchema,
  CreateRoomBodySchema,
  CreateRoomResultSchema,
  ClaimRoomBodySchema,
  PickDeckBodySchema,
  SubmitChoiceBodySchema,
  SeatCredentialSchema,
} from "./room.js";
