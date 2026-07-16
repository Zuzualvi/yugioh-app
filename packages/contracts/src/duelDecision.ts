import { z } from "zod";

// ---------------------------------------------------------------------------
// DuelDecision / DuelDecisionResponse typed contract — Phase 0 lock
//
// Ground truth: empirical ocgcore decision catalog
//   docs/working/2026-07-16-ocgcore-decision-catalog.md
// ADR: docs/adr/0001-typed-duel-decision-protocol.md
//
// Design rules (LOCKED — no implementer variance):
//   • Discriminant field: `kind` (string literal) on BOTH unions.
//   • Response `kind` MUST equal its decision `kind`.
//   • Selections are 0-based indices into the decision's candidate array.
//   • No raw ocgcore bitmasks / internal pointers reach the web.
//   • Face-down / hidden cards: code=0, name="".
//   • ChainPrompt only surfaces when forced=true OR selects.length > 0
//     (auto-pass handled by engine adapter — never reaches wire empty+optional).
//   • RockPaperScissors removed — engine auto-resolves, never emits WAITING.
//   • Variants marked [unverified-live] are real (answerable) shapes from the
//     ocgcore-wasm type definitions; no Edison trigger was found in testing.
//     They must never throw — they get a generic UI in Phase 2.
// ---------------------------------------------------------------------------

// ── Named enums (no raw bitmasks reach the web) ───────────────────────────────

export const PositionCodeSchema = z.enum([
  "faceup_attack",
  "facedown_attack",
  "faceup_defense",
  "facedown_defense",
]);
export type PositionCode = z.infer<typeof PositionCodeSchema>;

export const AttributeSchema = z.enum([
  "EARTH",
  "WATER",
  "FIRE",
  "WIND",
  "LIGHT",
  "DARK",
  "DIVINE",
]);
export type Attribute = z.infer<typeof AttributeSchema>;

export const RaceSchema = z.enum([
  "WARRIOR",
  "SPELLCASTER",
  "FAIRY",
  "FIEND",
  "ZOMBIE",
  "MACHINE",
  "AQUA",
  "PYRO",
  "ROCK",
  "WINGEDBEAST",
  "PLANT",
  "INSECT",
  "THUNDER",
  "DRAGON",
  "BEAST",
  "BEASTWARRIOR",
  "DINOSAUR",
  "FISH",
  "SEASERPENT",
  "REPTILE",
  "PSYCHIC",
  "DIVINE_BEAST",
  "CREATORGOD",
  "WYRM",
  "CYBERSE",
  "ILLUSION",
]);
export type Race = z.infer<typeof RaceSchema>;

export const LocationCodeSchema = z.enum([
  "DECK",
  "HAND",
  "MZONE",
  "SZONE",
  "GRAVE",
  "REMOVED",
  "EXTRA",
  "OVERLAY",
  "FZONE",
  "PZONE",
]);
export type LocationCode = z.infer<typeof LocationCodeSchema>;

// ── Shared card entry types ───────────────────────────────────────────────────

/** A card visible in the decision context. Hidden cards: code=0, name="". */
export const CardEntrySchema = z.object({
  code: z.number().int().nonnegative(),
  name: z.string(),
  controller: z.union([z.literal(0), z.literal(1)]),
  location: LocationCodeSchema,
  sequence: z.number().int().nonnegative(),
});
export type CardEntry = z.infer<typeof CardEntrySchema>;

/** A card entry that also carries an activatable-effect label. */
export const ActiveCardEntrySchema = CardEntrySchema.extend({
  description: z.string(), // human-readable effect label resolved from description ID
});
export type ActiveCardEntry = z.infer<typeof ActiveCardEntrySchema>;

/** A card entry for attack declarations. */
export const AttackEntrySchema = CardEntrySchema.extend({
  canDirectAttack: z.boolean(),
});
export type AttackEntry = z.infer<typeof AttackEntrySchema>;

/** A decoded field zone (player + location + sequence, no bitmask). */
export const ZoneEntrySchema = z.object({
  controller: z.union([z.literal(0), z.literal(1)]),
  location: z.enum(["MZONE", "SZONE", "FZONE"]),
  sequence: z.number().int().nonnegative(),
});
export type ZoneEntry = z.infer<typeof ZoneEntrySchema>;

/** A card entry for SELECT_SUM — includes the amount this card contributes. */
export const SumEntrySchema = CardEntrySchema.extend({
  amount: z.number().int().nonnegative(),
});
export type SumEntry = z.infer<typeof SumEntrySchema>;

/** A card entry for SELECT_COUNTER — includes current counter count on the card. */
export const CounterEntrySchema = CardEntrySchema.extend({
  currentCount: z.number().int().nonnegative(),
});
export type CounterEntry = z.infer<typeof CounterEntrySchema>;

/** AnnounceCard filter — resolved from opcodes stack; web never sees raw bytecode. */
export const AnnounceFilterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("any") }),
  z.object({ kind: z.literal("codes"), codes: z.array(z.number().int().positive()) }),
]);
export type AnnounceFilter = z.infer<typeof AnnounceFilterSchema>;

// ── DuelDecision variants ─────────────────────────────────────────────────────

const IdleCommandSchema = z.object({
  kind: z.literal("IdleCommand"),
  player: z.union([z.literal(0), z.literal(1)]),
  summons: z.array(CardEntrySchema),
  specialSummons: z.array(CardEntrySchema),
  posChanges: z.array(CardEntrySchema),
  monsterSets: z.array(CardEntrySchema),
  spellSets: z.array(CardEntrySchema),
  activates: z.array(ActiveCardEntrySchema),
  toBattlePhase: z.boolean(),
  toEndPhase: z.boolean(),
});

const BattleCommandSchema = z.object({
  kind: z.literal("BattleCommand"),
  player: z.union([z.literal(0), z.literal(1)]),
  chains: z.array(ActiveCardEntrySchema),
  attacks: z.array(AttackEntrySchema),
  toMainPhase2: z.boolean(),
  toEndPhase: z.boolean(),
});

// Only reaches wire when forced=true OR selects.length > 0.
// Engine adapter auto-passes empty optional windows.
const ChainPromptSchema = z.object({
  kind: z.literal("ChainPrompt"),
  player: z.union([z.literal(0), z.literal(1)]),
  forced: z.boolean(),
  selects: z.array(ActiveCardEntrySchema),
});

const SelectEffectYNSchema = z.object({
  kind: z.literal("SelectEffectYN"),
  player: z.union([z.literal(0), z.literal(1)]),
  card: CardEntrySchema,
  description: z.string(),
});

const SelectYesNoSchema = z.object({
  kind: z.literal("SelectYesNo"),
  player: z.union([z.literal(0), z.literal(1)]),
  description: z.string(),
});

const SelectOptionSchema = z.object({
  kind: z.literal("SelectOption"),
  player: z.union([z.literal(0), z.literal(1)]),
  options: z.array(z.string()), // human-readable labels resolved from description IDs
});

const SelectCardSchema = z.object({
  kind: z.literal("SelectCard"),
  player: z.union([z.literal(0), z.literal(1)]),
  cards: z.array(CardEntrySchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  cancelable: z.boolean(),
});

const SelectTributeSchema = z.object({
  kind: z.literal("SelectTribute"),
  player: z.union([z.literal(0), z.literal(1)]),
  cards: z.array(CardEntrySchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  cancelable: z.boolean(),
});

// Decoded from field_mask bitmask — no raw number reaches the web.
const SelectZoneSchema = z.object({
  kind: z.literal("SelectZone"),
  player: z.union([z.literal(0), z.literal(1)]),
  count: z.number().int().positive(),
  zones: z.array(ZoneEntrySchema),
});

// Decoded from positions bitmask — named position codes, not a raw number.
const SelectPositionSchema = z.object({
  kind: z.literal("SelectPosition"),
  player: z.union([z.literal(0), z.literal(1)]),
  card: CardEntrySchema,
  positions: z.array(PositionCodeSchema),
});

const SelectUnselectCardSchema = z.object({
  kind: z.literal("SelectUnselectCard"),
  player: z.union([z.literal(0), z.literal(1)]),
  selectCards: z.array(CardEntrySchema),
  unselectCards: z.array(CardEntrySchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  canFinish: z.boolean(),
  cancelable: z.boolean(),
});

const AnnounceRaceSchema = z.object({
  kind: z.literal("AnnounceRace"),
  player: z.union([z.literal(0), z.literal(1)]),
  count: z.number().int().positive(),
  available: z.array(RaceSchema),
});

const AnnounceAttribSchema = z.object({
  kind: z.literal("AnnounceAttrib"),
  player: z.union([z.literal(0), z.literal(1)]),
  count: z.number().int().positive(),
  available: z.array(AttributeSchema),
});

// Filter resolved from opcodes stack — raw opcodes never reach the web.
const AnnounceCardSchema = z.object({
  kind: z.literal("AnnounceCard"),
  player: z.union([z.literal(0), z.literal(1)]),
  filter: AnnounceFilterSchema,
});

const AnnounceNumberSchema = z.object({
  kind: z.literal("AnnounceNumber"),
  player: z.union([z.literal(0), z.literal(1)]),
  options: z.array(z.number().int().positive()),
});

// [unverified-live] — no known Edison trigger; shaped from ocgcore-wasm type defs.
// Real variant (answerable); generic UI in Phase 2.
const SortChainSchema = z.object({
  kind: z.literal("SortChain"),
  player: z.union([z.literal(0), z.literal(1)]),
  cards: z.array(CardEntrySchema),
});

// [unverified-live] — no known Edison trigger; shaped from ocgcore-wasm type defs.
const SelectCounterSchema = z.object({
  kind: z.literal("SelectCounter"),
  player: z.union([z.literal(0), z.literal(1)]),
  counterType: z.number().int().nonnegative(),
  count: z.number().int().positive(),
  cards: z.array(CounterEntrySchema),
});

// [unverified-live] — no known Edison trigger; shaped from ocgcore-wasm type defs.
// Ritual summons use SelectUnselectCard (type 26), not this message (type 23).
const SelectSumSchema = z.object({
  kind: z.literal("SelectSum"),
  player: z.union([z.literal(0), z.literal(1)]),
  amount: z.number().int().positive(),
  must: z.array(SumEntrySchema),
  optional: z.array(SumEntrySchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
});

// [unverified-live] — no known Edison trigger; shaped from ocgcore-wasm type defs.
// Zones decoded from field_mask bitmask.
const SelectDisfieldSchema = z.object({
  kind: z.literal("SelectDisfield"),
  player: z.union([z.literal(0), z.literal(1)]),
  count: z.number().int().positive(),
  zones: z.array(ZoneEntrySchema),
});

// [unverified-live] — no known Edison trigger; shaped from ocgcore-wasm type defs.
const SortCardSchema = z.object({
  kind: z.literal("SortCard"),
  player: z.union([z.literal(0), z.literal(1)]),
  cards: z.array(CardEntrySchema),
});

export const DuelDecisionSchema = z.discriminatedUnion("kind", [
  IdleCommandSchema,
  BattleCommandSchema,
  ChainPromptSchema,
  SelectEffectYNSchema,
  SelectYesNoSchema,
  SelectOptionSchema,
  SelectCardSchema,
  SelectTributeSchema,
  SelectZoneSchema,
  SelectPositionSchema,
  SelectUnselectCardSchema,
  AnnounceRaceSchema,
  AnnounceAttribSchema,
  AnnounceCardSchema,
  AnnounceNumberSchema,
  SortChainSchema,
  SelectCounterSchema,
  SelectSumSchema,
  SelectDisfieldSchema,
  SortCardSchema,
]);
export type DuelDecision = z.infer<typeof DuelDecisionSchema>;

// ── DuelDecisionResponse variants ─────────────────────────────────────────────

export const IdleCommandAction = z.enum([
  "summon",
  "specialSummon",
  "posChange",
  "monsterSet",
  "spellSet",
  "activate",
  "toBP",
  "toEP",
  "shuffle",
]);
export type IdleCommandActionType = z.infer<typeof IdleCommandAction>;

export const BattleCommandAction = z.enum(["chain", "attack", "toM2", "toEP"]);
export type BattleCommandActionType = z.infer<typeof BattleCommandAction>;

const RIdleCommandSchema = z.object({
  kind: z.literal("IdleCommand"),
  action: IdleCommandAction,
  index: z.number().int().nonnegative().nullable(),
});

const RBattleCommandSchema = z.object({
  kind: z.literal("BattleCommand"),
  action: BattleCommandAction,
  index: z.number().int().nonnegative().nullable(),
});

const RChainPromptSchema = z.object({
  kind: z.literal("ChainPrompt"),
  index: z.number().int().nonnegative().nullable(), // null = pass
});

const RSelectEffectYNSchema = z.object({
  kind: z.literal("SelectEffectYN"),
  yes: z.boolean(),
});

const RSelectYesNoSchema = z.object({
  kind: z.literal("SelectYesNo"),
  yes: z.boolean(),
});

const RSelectOptionSchema = z.object({
  kind: z.literal("SelectOption"),
  index: z.number().int().nonnegative(),
});

const RSelectCardSchema = z.object({
  kind: z.literal("SelectCard"),
  indices: z.array(z.number().int().nonnegative()).nullable(), // null = cancel
});

const RSelectTributeSchema = z.object({
  kind: z.literal("SelectTribute"),
  indices: z.array(z.number().int().nonnegative()).nullable(), // null = cancel
});

const RSelectZoneSchema = z.object({
  kind: z.literal("SelectZone"),
  indices: z.array(z.number().int().nonnegative()), // 0-based into zones[]
});

const RSelectPositionSchema = z.object({
  kind: z.literal("SelectPosition"),
  position: PositionCodeSchema,
});

const RSelectUnselectCardSchema = z.object({
  kind: z.literal("SelectUnselectCard"),
  index: z.number().int().nonnegative().nullable(), // null = finish/cancel
});

const RAnnounceRaceSchema = z.object({
  kind: z.literal("AnnounceRace"),
  races: z.array(RaceSchema),
});

const RAnnounceAttribSchema = z.object({
  kind: z.literal("AnnounceAttrib"),
  attributes: z.array(AttributeSchema),
});

const RAnnounceCardSchema = z.object({
  kind: z.literal("AnnounceCard"),
  code: z.number().int().positive(),
});

const RAnnounceNumberSchema = z.object({
  kind: z.literal("AnnounceNumber"),
  valueIndex: z.number().int().nonnegative(), // 0-based index into options[]
});

const RSortChainSchema = z.object({
  kind: z.literal("SortChain"),
  order: z.array(z.number().int().nonnegative()).nullable(), // null = default order
});

const RSelectCounterSchema = z.object({
  kind: z.literal("SelectCounter"),
  counters: z.array(z.number().int().nonnegative()), // per-card counter amounts
});

const RSelectSumSchema = z.object({
  kind: z.literal("SelectSum"),
  indices: z.array(z.number().int().nonnegative()),
});

const RSelectDisfieldSchema = z.object({
  kind: z.literal("SelectDisfield"),
  indices: z.array(z.number().int().nonnegative()), // 0-based into zones[]
});

const RSortCardSchema = z.object({
  kind: z.literal("SortCard"),
  order: z.array(z.number().int().nonnegative()).nullable(), // null = default order
});

export const DuelDecisionResponseSchema = z.discriminatedUnion("kind", [
  RIdleCommandSchema,
  RBattleCommandSchema,
  RChainPromptSchema,
  RSelectEffectYNSchema,
  RSelectYesNoSchema,
  RSelectOptionSchema,
  RSelectCardSchema,
  RSelectTributeSchema,
  RSelectZoneSchema,
  RSelectPositionSchema,
  RSelectUnselectCardSchema,
  RAnnounceRaceSchema,
  RAnnounceAttribSchema,
  RAnnounceCardSchema,
  RAnnounceNumberSchema,
  RSortChainSchema,
  RSelectCounterSchema,
  RSelectSumSchema,
  RSelectDisfieldSchema,
  RSortCardSchema,
]);
export type DuelDecisionResponse = z.infer<typeof DuelDecisionResponseSchema>;
