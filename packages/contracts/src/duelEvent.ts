// ---------------------------------------------------------------------------
// DuelEvent — typed event feed contract (ZUH-94, §C6 + §C7).
//
// ADR-0007: the event feed is normalised server-side; knowledge of ocgcore
// message numbers stops at the engine/server boundary.
//
// Every variant carries common fields (seq, turnNumber, phase, actor?).
// The EVENTS frame bundles them; DECISION_CONTEXT is sent immediately before
// each DECISION frame (optional — a DECISION with no preceding context is legal).
// ---------------------------------------------------------------------------

import { z } from "zod";

// SeatSchema redefined locally to avoid a circular import with duel.ts.
// duel.ts imports from this file; this file must not import from duel.ts.
const SeatSchema = z.union([z.literal(0), z.literal(1)]);

// ── Shared sub-schema ─────────────────────────────────────────────────────────

export const EventCardRefSchema = z.object({
  /** 0 when the viewer is not entitled to the identity (hidden/face-down). */
  code: z.number(),
  controller: SeatSchema,
  location: z.enum([
    "HAND",
    "MZONE",
    "SZONE",
    "FZONE",
    "GRAVE",
    "REMOVED",
    "EXTRA",
    "DECK",
    "OVERLAY",
  ]),
  sequence: z.number().int().nonnegative().optional(),
});
export type EventCardRef = z.infer<typeof EventCardRefSchema>;

// Common fields on every DuelEvent variant.
// seq:        monotonic, gap-free per seat — the log's dedupe key.
// turnNumber: which turn this event occurred in.
// phase:      web-encoded phase (1=Draw, 2=Standby, 4=Main1, 8=Battle, 16=Main2, 32=End).
// actor:      the seat that caused it, where the engine identifies one.
const CommonFields = {
  seq: z.number().int().nonnegative(),
  turnNumber: z.number().int().nonnegative(),
  phase: z.number().int(),
  actor: SeatSchema.optional(),
};

// ── DuelEvent discriminated union (§C6) ──────────────────────────────────────

export const DuelEventSchema = z.discriminatedUnion("kind", [
  // Normal summon declared (SUMMONING msg, type 60)
  z.object({
    kind: z.literal("SUMMON"),
    ...CommonFields,
    card: EventCardRefSchema,
    position: z.number().int(),
  }),

  // Special summon declared (SPSUMMONING msg, type 62)
  z.object({
    kind: z.literal("SPSUMMON"),
    ...CommonFields,
    card: EventCardRefSchema,
    position: z.number().int(),
  }),

  // Card set face-down (SET msg, type 54)
  z.object({
    kind: z.literal("SET"),
    ...CommonFields,
    card: EventCardRefSchema,
    position: z.number().int(),
  }),

  // Card moved between zones (MOVE msg, type 50)
  z.object({
    kind: z.literal("MOVE"),
    ...CommonFields,
    card: EventCardRefSchema,
    from: EventCardRefSchema,
    to: EventCardRefSchema,
  }),

  // Chain link added (CHAINING msg, type 70)
  z.object({
    kind: z.literal("CHAINING"),
    ...CommonFields,
    card: EventCardRefSchema,
    link: z.number().int().positive(),
    owner: SeatSchema,
  }),

  // Individual chain link being resolved (CHAIN_SOLVING msg, type 72)
  z.object({
    kind: z.literal("CHAIN_SOLVING"),
    ...CommonFields,
    link: z.number().int().positive(),
  }),

  // Individual chain link resolved (CHAIN_SOLVED msg, type 73)
  z.object({ kind: z.literal("CHAIN_SOLVED"), ...CommonFields, link: z.number().int().positive() }),

  // Chain fully resolved (CHAIN_END msg, type 74)
  z.object({ kind: z.literal("CHAIN_END"), ...CommonFields }),

  // Life point change — ND-4: seat field identifies whose LP moved.
  // MSG_DAMAGE(91) carries player; normalised here for all damage paths.
  z.object({
    kind: z.literal("LP_CHANGE"),
    ...CommonFields,
    /** Whose LP moved. */
    seat: SeatSchema,
    /** Negative = LP lost, positive = LP gained. */
    delta: z.number().int(),
    reason: z.enum(["damage", "cost", "recover", "effect"]),
  }),

  // Attack declared (ATTACK msg, type 110). target null = direct attack.
  z.object({
    kind: z.literal("ATTACK"),
    ...CommonFields,
    attacker: EventCardRefSchema,
    target: EventCardRefSchema.nullable(),
  }),

  // Damage calculation result (BATTLE msg, type 111)
  z.object({
    kind: z.literal("BATTLE"),
    ...CommonFields,
    attacker: EventCardRefSchema,
    target: EventCardRefSchema,
  }),

  // Phase change (NEW_PHASE msg, type 41)
  z.object({ kind: z.literal("PHASE"), ...CommonFields }),

  // Turn change (NEW_TURN msg, type 40)
  z.object({
    kind: z.literal("TURN"),
    ...CommonFields,
    turnPlayer: SeatSchema,
    lpSnapshot: z.tuple([z.number(), z.number()]),
  }),

  // Hint to the entitled player (HINT/PLAYER_HINT/CARD_HINT msgs)
  z.object({
    kind: z.literal("HINT"),
    ...CommonFields,
    hintType: z.number().int(),
    value: z.string(),
    card: EventCardRefSchema.optional(),
  }),
]);
export type DuelEvent = z.infer<typeof DuelEventSchema>;

// ── DecisionContext sidecar (§C7) ─────────────────────────────────────────────
//
// Sent IMMEDIATELY BEFORE the DECISION frame it describes, to the same seat only.
// A DECISION with no preceding context is legal and must render — every field optional.
// ADR-0001 is NOT reopened: no fields added to DuelDecision variants.

export const DecisionContextSchema = z.object({
  /** MSG_HINT caption for the pending decision, when the engine provided one. */
  caption: z.string().optional(),
  /** The card whose effect prompted this decision (from CHAINING event). */
  activatingCard: EventCardRefSchema.optional(),
  /** Current chain stack, link 1 first. */
  chain: z
    .array(
      z.object({
        link: z.number().int().positive(),
        card: EventCardRefSchema,
        owner: SeatSchema,
      }),
    )
    .optional(),
  // releaseCounts (ND-1) is intentionally absent.
  // Live investigation (2026-08-07) confirmed that SELECT_IDLECMD summons[] carries
  // only {code, controller, location, sequence} — no tribute count — under all conditions
  // (tested at level 5 and level 7). release_param appears only in SELECT_TRIBUTE (type 20),
  // which arrives after the player commits to a summon. ND-1 is withdrawn; the count is
  // readable from SelectTribute.min/max at the tribute step, where the engine gives it.
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;
