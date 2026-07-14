// ---------------------------------------------------------------------------
// EDISON_FLAGS — explicit per-flag-commented bitmask (R1)
//
// Each flag is listed with its hex value and purpose. Do NOT collapse into
// MODE_GOAT — GOAT ≠ Edison; the value coincides only because pre-MR2
// mechanics are shared, but a future reader must see each flag explicitly.
//
// Assert: OR of all flags === 0x7f80d072cn (validated in edisonFlags.test.ts).
// Source-verified against edo9300/ygopro-core @ 8e5f4e4 via spike-e.
// ---------------------------------------------------------------------------

// ── MR1 / Edison-specific flags ──────────────────────────────────────────────

/** 0x100 — OCG-style ignition-effect priority (obsolete in post-MR2). */
const OBSOLETE_IGNITION = 0x100n;

/** 0x200 — First player draws on turn 1 (abolished in MR2). */
const FIRST_TURN_DRAW = 0x200n;

/** 0x400 — Single shared face-up Field Spell zone (pre-MR3). */
const ONE_FACEUP_FIELD = 0x400n;

/** 0x40000 — Negated summons count toward once-per-turn limit (MR1 oath). */
const SPSUMMON_ONCE_OLD_NEGATE = 0x40000n;

/** 0x10000 — Return to deck/extra-deck does not trigger "leaving field" effects. */
const RETURN_TO_DECK_TRIGGERS = 0x10000n;

/** 0x80000 — Old oath rule: negated normal/special summons count. */
const CANNOT_SUMMON_OATH_OLD = 0x80000n;

// ── GOAT-component flags (also correct for Edison; pre-2014 mechanics) ───────

/** 0x4 — Continuous trap effects cannot be activated mid-chain (pre-MR2). */
const USE_TRAPS_IN_NEW_CHAIN = 0x4n;

/** 0x8 — Six-step battle-step structure (pre-2014 damage step). */
const SIX_STEP_BATTLE_STEP = 0x8n;

/** 0x20 — Deck searches don't require public knowledge check. */
const TRIGGER_WHEN_PRIVATE_KNOWLEDGE = 0x20n;

/** 0x8000000 — Equipped card not sent to grave if target is no longer valid. */
const EQUIP_NOT_SENT_IF_MISSING_TARGET = 0x8000000n;

/** 0x10000000 — A 0-ATK monster battling another 0-ATK monster: both destroyed. */
const ZERO_ATK_DESTROYED = 0x10000000n;

/** 0x20000000 — Attack replays can be stored and used later. */
const STORE_ATTACK_REPLAYS = 0x20000000n;

/** 0x40000000 — One chain allowed per damage sub-step. */
const SINGLE_CHAIN_IN_DAMAGE_SUBSTEP = 0x40000000n;

/** 0x80000000 — Cards can be repositioned if control changed. */
const CAN_REPOS_IF_NON_SUMPLAYER = 0x80000000n;

/** 0x100000000 — TCG SEGOC: non-public knowledge ordering. */
const TCG_SEGOC_NONPUBLIC = 0x100000000n;

/** 0x200000000 — TCG SEGOC: earlier-trigger effect goes first on chain. */
const TCG_SEGOC_FIRSTTRIGGER = 0x200000000n;

// ── GY-ignition flag — NOT in ocgcore-wasm@0.1.2 JS constants ───────────────
// Must be used as a raw BigInt. The 0.1.2 npm prebuilt ignores this flag due
// to an emscripten 64-bit comparison bug (see spike-e REPORT.md).
// The custom WASM (emcc 6.0.2) compiles it correctly.

/** 0x400000000 — GY ignition-effect priority (TCG fast-effect ignition rule). */
const TCG_FAST_EFFECT_IGNITION = 0x400000000n;

// ── Combined Edison flags ────────────────────────────────────────────────────

/**
 * Full Edison (March 2010 / Master Rule 1 TCG) flag set.
 *
 * Asserted == 0x7f80d072cn in edisonFlags.test.ts.
 *
 * NOTE: This must be used with the CUSTOM-built ocgcore WASM (emcc 6.0.2).
 * The stock ocgcore-wasm@0.1.2 prebuilt silently ignores TCG_FAST_EFFECT_IGNITION
 * (0x400000000) due to a 64-bit comparison bug in the older emscripten compiler.
 */
export const EDISON_FLAGS: bigint =
  OBSOLETE_IGNITION |
  FIRST_TURN_DRAW |
  ONE_FACEUP_FIELD |
  SPSUMMON_ONCE_OLD_NEGATE |
  RETURN_TO_DECK_TRIGGERS |
  CANNOT_SUMMON_OATH_OLD |
  USE_TRAPS_IN_NEW_CHAIN |
  SIX_STEP_BATTLE_STEP |
  TRIGGER_WHEN_PRIVATE_KNOWLEDGE |
  EQUIP_NOT_SENT_IF_MISSING_TARGET |
  ZERO_ATK_DESTROYED |
  STORE_ATTACK_REPLAYS |
  SINGLE_CHAIN_IN_DAMAGE_SUBSTEP |
  CAN_REPOS_IF_NON_SUMPLAYER |
  TCG_SEGOC_NONPUBLIC |
  TCG_SEGOC_FIRSTTRIGGER |
  TCG_FAST_EFFECT_IGNITION;
