import { z } from "zod";
import { DuelDecisionSchema, DuelDecisionResponseSchema } from "./duelDecision.js";
import { DuelEventSchema, DecisionContextSchema } from "./duelEvent.js";

// ---------------------------------------------------------------------------
// Duel wire contracts — Stream 2 / Slice 00
// Field names LOCKED — do not vary without a spec update.
// ---------------------------------------------------------------------------

// ── Identifiers / primitives ─────────────────────────────────────────────────

export const SeatSchema = z.union([z.literal(0), z.literal(1)]);
export type Seat = z.infer<typeof SeatSchema>;

export type DuelId = string;

export const PerMoveTimerSchema = z.object({
  perMoveSeconds: z.number().int().min(60).max(900),
});
export type PerMoveTimer = z.infer<typeof PerMoveTimerSchema>;

// ── Duel lifecycle — HTTP ────────────────────────────────────────────────────

export const CreateDuelBodySchema = z.object({
  timer: PerMoveTimerSchema,
});
export type CreateDuelBody = z.infer<typeof CreateDuelBodySchema>;

export const JoinDuelBodySchema = z.object({
  joinToken: z.string(),
});
export type JoinDuelBody = z.infer<typeof JoinDuelBodySchema>;

export const DuelStatusSchema = z.enum(["waiting_for_opponent", "active", "ended", "starting"]);
export type DuelStatus = z.infer<typeof DuelStatusSchema>;

// ── EngineResponse ────────────────────────────────────────────────────────────

/**
 * @deprecated — removed in Phase 2. Use DuelDecisionResponse instead.
 */
export const EngineResponseSchema = z.object({
  type: z.number().int(),
  value: z.unknown().optional(),
});
/** @deprecated — removed in Phase 2. Use DuelDecisionResponse instead. */
export type EngineResponse = z.infer<typeof EngineResponseSchema>;

// ── RedactedEngineMessage ─────────────────────────────────────────────────────

/**
 * ADR: We do NOT exhaustively type all ~50 ocgcore message bodies in V1 contracts.
 * The envelope (name/engineType/player) is strict; message-specific fields pass
 * through. The engine wrapper owns/guards the bodies. Revisit if web needs stronger
 * per-message rendering guarantees.
 */
export const RedactedEngineMessageSchema = z
  .object({
    name: z.string(),
    engineType: z.number().int(),
    player: SeatSchema.optional(),
  })
  .passthrough();
export type RedactedEngineMessage = z.infer<typeof RedactedEngineMessageSchema>;

// ── ZoneCard ──────────────────────────────────────────────────────────────────

export const ZoneCardSchema = z
  .object({
    code: z.number(),
    position: z.number(),
    /** Zone index within its location. Equals the array index in mzone/szone. */
    sequence: z.number().int().nonnegative().optional(),
    attack: z.number().int().nullable().optional(),
    defense: z.number().int().nullable().optional(),
    level: z.number().int().nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .passthrough();
export type ZoneCard = z.infer<typeof ZoneCardSchema>;

// ── DuelZones ─────────────────────────────────────────────────────────────────

const ZoneSlotSchema = ZoneCardSchema.nullable();

export const DuelZonesSchema = z.object({
  p0_hand: z.array(ZoneCardSchema), // unchanged: dense-by-nature, no holes
  p1_hand: z.array(ZoneCardSchema),
  p0_mzone: z.array(ZoneSlotSchema), // CHANGED: length 5, nulls preserved
  p1_mzone: z.array(ZoneSlotSchema),
  p0_szone: z.array(ZoneSlotSchema), // CHANGED: length 5, nulls preserved
  p1_szone: z.array(ZoneSlotSchema),
  p0_fzone: ZoneSlotSchema.optional(), // NEW: the single field zone (core szone[5])
  p1_fzone: ZoneSlotSchema.optional(),
  p0_grave: z.array(ZoneCardSchema), // unchanged: piles, order-only
  p1_grave: z.array(ZoneCardSchema),
  p0_removed: z.array(ZoneCardSchema),
  p1_removed: z.array(ZoneCardSchema),
  p0_extra: z.array(ZoneCardSchema),
  p1_extra: z.array(ZoneCardSchema),
  p0_deckCount: z.number().int().nonnegative().optional(), // NEW: count only, never contents
  p1_deckCount: z.number().int().nonnegative().optional(), // NEW
});
export type DuelZones = z.infer<typeof DuelZonesSchema>;

// ── DuelStateSnapshot ─────────────────────────────────────────────────────────

export const DuelStateSnapshotSchema = z.object({
  seat: SeatSchema,
  duelEnded: z.boolean(),
  currentTurn: SeatSchema,
  currentPhase: z.number(),
  lp: z.tuple([z.number(), z.number()]),
  zones: DuelZonesSchema,
  clock: z
    .object({
      onClockSeat: SeatSchema,
      deadlineAt: z.number(),
      /** NEW (C5): absolute deadlines for both seats. [seat0, seat1]. Off-clock entry is banked time. */
      deadlines: z.tuple([z.number(), z.number()]).optional(),
    })
    .optional(),
  turnNumber: z.number().int().positive().optional(), // NEW: top-bar "TURN 4 · THEIRS"
});
export type DuelStateSnapshot = z.infer<typeof DuelStateSnapshotSchema>;

// ── Active duels list — GET /api/duels/active ────────────────────────────────

export const ActiveDuelEntrySchema = z.object({
  duelId: z.string(),
  status: z.enum(["waiting_for_opponent", "active"]),
  mySeat: SeatSchema,
  opponentDisplayName: z.string().nullable(),
  onClockSeat: SeatSchema.nullable(),
  deadlineAt: z.number().nullable(),
  createdAt: z.number(),
});
export type ActiveDuelEntry = z.infer<typeof ActiveDuelEntrySchema>;

export const ActiveRoomEntrySchema = z.object({
  roomId: z.string(),
  status: z.enum(["open", "filled", "awaiting_choice"]),
  myRole: z.enum(["creator", "opponent"]),
  opponentDisplayName: z.string().nullable(),
  roomDeadlineAt: z.number(),
  createdAt: z.number(),
});
export type ActiveRoomEntry = z.infer<typeof ActiveRoomEntrySchema>;

export const ActiveDuelsResponseSchema = z.object({
  duels: z.array(ActiveDuelEntrySchema),
  rooms: z.array(ActiveRoomEntrySchema),
});
export type ActiveDuelsResponse = z.infer<typeof ActiveDuelsResponseSchema>;

// ── DuelEndReason ─────────────────────────────────────────────────────────────

export const DuelEndReasonSchema = z.enum(["normal", "timeout", "resign"]);
export type DuelEndReason = z.infer<typeof DuelEndReasonSchema>;

// ── WebSocket — server → client ───────────────────────────────────────────────

export const DuelServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SEAT_ASSIGNED"), seat: SeatSchema, seatToken: z.string() }),
  z.object({ type: z.literal("MSG"), msg: RedactedEngineMessageSchema }),
  z.object({ type: z.literal("STATE"), state: DuelStateSnapshotSchema }),
  z.object({
    type: z.literal("CLOCK"),
    onClockSeat: SeatSchema,
    deadlineAt: z.number(),
    /** NEW (C5): absolute deadlines for both seats. [seat0, seat1]. Off-clock entry is banked time. */
    deadlines: z.tuple([z.number(), z.number()]).optional(),
  }),
  /** NEW (C6): typed event feed — normalised domain events for the event log. */
  z.object({ type: z.literal("EVENTS"), events: z.array(DuelEventSchema) }),
  /** NEW (C7): decision sidecar — sent immediately before the DECISION it describes. */
  z.object({ type: z.literal("DECISION_CONTEXT"), context: DecisionContextSchema }),
  z.object({
    type: z.literal("DUEL_END"),
    winner: z.union([SeatSchema, z.null()]),
    reason: DuelEndReasonSchema,
  }),
  z.object({ type: z.literal("ERROR"), message: z.string() }),
  /** Phase 1: typed decision frame — sent only to the on-clock seat. */
  z.object({ type: z.literal("DECISION"), decision: DuelDecisionSchema }),
]);
export type DuelServerMessage = z.infer<typeof DuelServerMessageSchema>;

// ── WebSocket — client → server ───────────────────────────────────────────────

export const DuelClientMessageSchema = z.discriminatedUnion("type", [
  /**
   * @deprecated — removed in Phase 2. Use DECISION_RESPONSE instead.
   */
  z.object({ type: z.literal("RESPONSE"), response: EngineResponseSchema }),
  z.object({ type: z.literal("RESIGN") }),
  /** Phase 1: typed decision response — sent by the on-clock seat. */
  z.object({ type: z.literal("DECISION_RESPONSE"), response: DuelDecisionResponseSchema }),
]);
export type DuelClientMessage = z.infer<typeof DuelClientMessageSchema>;
