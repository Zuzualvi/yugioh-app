/**
 * Edison format (March 2010 / Master Rule 1) duel flag set.
 *
 * Built from ocgcore-wasm 0.1.2's OcgDuelMode constants.
 * Note: DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000) from the research hypothesis
 * does NOT appear in this WASM build's exposed constants. The highest ignition-
 * priority flag available is OBSOLETE_IGNITION (0x100), which is the OCG-style
 * priority flag. This is documented in the A6 verdict.
 */
import { OcgDuelMode } from 'ocgcore-wasm';

const {
  // MR1 base flags
  OBSOLETE_IGNITION,         // 0x100 - OCG-style ignition-effect priority (covers MZone, may cover GY in this build)
  FIRST_TURN_DRAW,           // 0x200 - first player draws on turn 1
  ONE_FACEUP_FIELD,          // 0x400 - single shared face-up Field Spell (pre-MR3)
  SPSUMMON_ONCE_OLD_NEGATE,  // 0x40000 - negated summons count vs once-per-turn limit
  RETURN_TO_DECK_TRIGGERS,   // 0x10000 - return to deck doesn't trigger "leaving field"
  CANNOT_SUMMON_OATH_OLD,    // 0x80000 - old oath rule for summons

  // GOAT-family flags also needed for pre-2014 (Edison-era) behavior:
  USE_TRAPS_IN_NEW_CHAIN,         // 0x4   - continuous trap effects not immediately usable in chain
  SIX_STEP_BATLLE_STEP,           // 0x8   - pre-2014 damage step structure
  TRIGGER_WHEN_PRIVATE_KNOWLEDGE, // 0x20  - searching deck doesn't require knowledge check
  EQUIP_NOT_SENT_IF_MISSING_TARGET, // 0x8000000 - equip not sent if target gone (GOAT rule)
  ZERO_ATK_DESTROYED,             // 0x10000000 - 0-ATK monster battle rule
  STORE_ATTACK_REPLAYS,           // 0x20000000 - attack replays can be used later
  SINGLE_CHAIN_IN_DAMAGE_SUBSTEP, // 0x40000000 - one chain per damage substep
  CAN_REPOS_IF_NON_SUMPLAYER,     // 0x80000000 - reposition if control changed
  TCG_SEGOC_NONPUBLIC,            // 0x100000000 - TCG SEGOC non-public knowledge
  TCG_SEGOC_FIRSTTRIGGER,         // 0x200000000 - TCG SEGOC: earlier trigger goes first
} = OcgDuelMode;

/**
 * Full Edison flag set — all flags we assert are correct for Edison (March 2010 / MR1 TCG).
 */
export const EDISON_FLAGS =
  OBSOLETE_IGNITION |
  FIRST_TURN_DRAW |
  ONE_FACEUP_FIELD |
  SPSUMMON_ONCE_OLD_NEGATE |
  RETURN_TO_DECK_TRIGGERS |
  CANNOT_SUMMON_OATH_OLD |
  USE_TRAPS_IN_NEW_CHAIN |
  SIX_STEP_BATLLE_STEP |
  TRIGGER_WHEN_PRIVATE_KNOWLEDGE |
  EQUIP_NOT_SENT_IF_MISSING_TARGET |
  ZERO_ATK_DESTROYED |
  STORE_ATTACK_REPLAYS |
  SINGLE_CHAIN_IN_DAMAGE_SUBSTEP |
  CAN_REPOS_IF_NON_SUMPLAYER |
  TCG_SEGOC_NONPUBLIC |
  TCG_SEGOC_FIRSTTRIGGER;

/**
 * MR1 flags only (no GOAT extra flags).
 * This is what a naive "MR1 preset" would give; does NOT include GOAT-era damage-step behavior.
 */
export const MR1_BASE_FLAGS =
  OBSOLETE_IGNITION |
  FIRST_TURN_DRAW |
  ONE_FACEUP_FIELD |
  SPSUMMON_ONCE_OLD_NEGATE |
  RETURN_TO_DECK_TRIGGERS |
  CANNOT_SUMMON_OATH_OLD;

/**
 * Modern flags (no Edison era flags).
 * Used to prove flags actually gate behavior (A2 negative case).
 */
export const MODERN_FLAGS = OcgDuelMode.MODE_MR5;

/**
 * Flags without FIRST_TURN_DRAW — used in A2 negative assertion.
 */
export const EDISON_NO_FIRST_DRAW = EDISON_FLAGS & ~FIRST_TURN_DRAW;

/**
 * Flags without ONE_FACEUP_FIELD — used in A4 negative assertion.
 */
export const EDISON_NO_SINGLE_FIELD = EDISON_FLAGS & ~ONE_FACEUP_FIELD;
