import { z } from "zod";
import { SeatSchema } from "./duel.js";

// ---------------------------------------------------------------------------
// Room wire contracts — ZUH-26 / S0
// Field names LOCKED — do not vary without a spec update.
// All timestamps are epoch milliseconds, integers, absolute, server-generated.
// ---------------------------------------------------------------------------

export const RoomStatusSchema = z.enum(["open", "filled", "awaiting_choice", "starting", "closed"]);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomClosedReasonSchema = z.enum([
  "left",
  "expired_unclaimed",
  "expired_idle",
  "expired_ready",
  "expired_choice",
  "engine_failed",
]);
export type RoomClosedReason = z.infer<typeof RoomClosedReasonSchema>;

export const RoomPresenceSchema = z.enum(["connected", "away", "left"]);
export type RoomPresence = z.infer<typeof RoomPresenceSchema>;

export const OccupantRoleSchema = z.enum(["creator", "opponent"]);
export type OccupantRole = z.infer<typeof OccupantRoleSchema>;

export const SeatChoiceSchema = z.enum(["first", "second"]);
export type SeatChoice = z.infer<typeof SeatChoiceSchema>;

/** What an occupant may know about the OTHER occupant. No deck name, no card counts, ever (R25). */
export const RoomOpponentViewSchema = z.object({
  role: OccupantRoleSchema,
  userId: z.string(),
  displayName: z.string(),
  presence: RoomPresenceSchema,
  deckSelected: z.boolean(),
  ready: z.boolean(),
});
export type RoomOpponentView = z.infer<typeof RoomOpponentViewSchema>;

/** What an occupant may know about THEMSELVES. */
export const RoomSelfViewSchema = RoomOpponentViewSchema.extend({
  deckId: z.string().nullable(),
  deckName: z.string().nullable(),
  deckCardCount: z.number().int().nullable(),
  deckLocked: z.boolean(),
});
export type RoomSelfView = z.infer<typeof RoomSelfViewSchema>;

export const RoomFlipSchema = z.object({
  winnerUserId: z.string(),
  winnerDisplayName: z.string(),
  rolledAt: z.number().int(),
  choice: SeatChoiceSchema.nullable(),
});
export type RoomFlip = z.infer<typeof RoomFlipSchema>;

export const RoomSnapshotSchema = z.object({
  roomId: z.string(),
  status: RoomStatusSchema,
  closedReason: RoomClosedReasonSchema.nullable(),
  closedByUserId: z.string().nullable(),
  perMoveSeconds: z.number().int(),
  createdAt: z.number().int(),
  roomDeadlineAt: z.number().int().nullable(),
  serverNow: z.number().int(),
  /** The shareable token. Non-null ONLY for the creator, and ONLY while status is `open`. */
  joinToken: z.string().nullable(),
  you: RoomSelfViewSchema,
  opponent: RoomOpponentViewSchema.nullable(),
  flip: RoomFlipSchema.nullable(),
  /** Non-null only in `starting`. Lets the UI name who goes first without a second request. */
  seats: z.object({ seat0UserId: z.string(), seat1UserId: z.string() }).nullable(),
});
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

/** The ONLY server→client room frame. The room socket is read-only (R12). */
export const RoomServerMessageSchema = z.object({
  type: z.literal("ROOM_STATE"),
  snapshot: RoomSnapshotSchema,
});
export type RoomServerMessage = z.infer<typeof RoomServerMessageSchema>;

export const PreJoinVerdictSchema = z.enum([
  "ok",
  "expired",
  "claimed_by_other",
  "closed",
  "started",
  "you_are_the_creator",
  "you_are_an_occupant",
]);
export type PreJoinVerdict = z.infer<typeof PreJoinVerdictSchema>;

/** R37: timer + creator name + a purpose-built verdict. NEVER the raw room status. */
export const PreJoinRoomInfoSchema = z.object({
  perMoveSeconds: z.number().int(),
  creatorDisplayName: z.string(),
  usable: z.boolean(),
  reason: PreJoinVerdictSchema,
});
export type PreJoinRoomInfo = z.infer<typeof PreJoinRoomInfoSchema>;

export const CreateRoomBodySchema = z.object({
  timer: z.object({ perMoveSeconds: z.number().int().min(60).max(900) }),
});
export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

export const CreateRoomResultSchema = z.object({
  roomId: z.string(),
  joinToken: z.string(),
});
export type CreateRoomResult = z.infer<typeof CreateRoomResultSchema>;

export const ClaimRoomBodySchema = z.object({ joinToken: z.string() });
export type ClaimRoomBody = z.infer<typeof ClaimRoomBodySchema>;

export const PickDeckBodySchema = z.object({ deckId: z.string() });
export type PickDeckBody = z.infer<typeof PickDeckBodySchema>;

export const SubmitChoiceBodySchema = z.object({ choice: SeatChoiceSchema });
export type SubmitChoiceBody = z.infer<typeof SubmitChoiceBodySchema>;

export const SeatCredentialSchema = z.object({ seat: SeatSchema, seatToken: z.string() });
export type SeatCredential = z.infer<typeof SeatCredentialSchema>;
