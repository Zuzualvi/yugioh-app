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
  CreateDuelResult,
  JoinDuelBody,
  JoinDuelResult,
  DuelStatus,
  PreJoinDuelInfo,
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
  CreateDuelResultSchema,
  JoinDuelBodySchema,
  JoinDuelResultSchema,
  DuelStatusSchema,
  PreJoinDuelInfoSchema,
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
