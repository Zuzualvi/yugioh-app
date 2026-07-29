import { z } from "zod";
import { DuelDecisionSchema, DuelDecisionResponseSchema } from "./duelDecision.js";

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
  })
  .passthrough();
export type ZoneCard = z.infer<typeof ZoneCardSchema>;

// ── DuelZones ─────────────────────────────────────────────────────────────────

export const DuelZonesSchema = z.object({
  p0_hand: z.array(ZoneCardSchema),
  p1_hand: z.array(ZoneCardSchema),
  p0_mzone: z.array(ZoneCardSchema),
  p1_mzone: z.array(ZoneCardSchema),
  p0_szone: z.array(ZoneCardSchema),
  p1_szone: z.array(ZoneCardSchema),
  p0_grave: z.array(ZoneCardSchema),
  p1_grave: z.array(ZoneCardSchema),
  p0_removed: z.array(ZoneCardSchema),
  p1_removed: z.array(ZoneCardSchema),
  p0_extra: z.array(ZoneCardSchema),
  p1_extra: z.array(ZoneCardSchema),
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
    })
    .optional(),
});
export type DuelStateSnapshot = z.infer<typeof DuelStateSnapshotSchema>;

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
  }),
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
