/**
 * Wire types used by the prototype.
 *
 * SOURCE OF TRUTH, per field:
 *   • DuelDecision / DuelDecisionResponse  — copied verbatim in shape from
 *     packages/contracts/src/duelDecision.ts (ALL 20 variants; the brief says 19,
 *     the code and ADR-0001:39 both say 20 — the code wins).
 *   • DuelStateSnapshot / DuelZones        — packages/contracts/src/duel.ts,
 *     EXTENDED with the approved backend delta MH-1 from
 *     docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md:
 *        MH-1.1 ZoneCard.sequence
 *        MH-1.2 dense arrays with explicit null holes for mzone/szone
 *        MH-1.3 typed attack / defense / level / isPublic
 *        MH-1.4 p0_fzone / p1_fzone
 *        MH-1.5 turn number + named phase
 *     Fields added by MH-1 are marked  // MH-1  below.
 *   • DuelEvent                            — the log feed. Shapes are the raw ocgcore
 *     messages from docs/reference/decision-capture-raw.json (MH-2a: keep the existing
 *     MSG passthrough frame), normalised into one row type for rendering.
 */

export type Seat = 0 | 1;

export type LocationCode =
  | "DECK"
  | "HAND"
  | "MZONE"
  | "SZONE"
  | "GRAVE"
  | "REMOVED"
  | "EXTRA"
  | "OVERLAY"
  | "FZONE"
  | "PZONE";

export type PositionCode =
  "faceup_attack" | "facedown_attack" | "faceup_defense" | "facedown_defense";

// ── Board ────────────────────────────────────────────────────────────────────

export interface ZoneCard {
  code: number;
  position: number; // ocgcore bitmask, as today
  sequence: number; // MH-1.1
  attack?: number; // MH-1.3
  defense?: number; // MH-1.3
  level?: number; // MH-1.3
  isPublic?: boolean; // MH-1.3
  /** prototype-only presentation flags, NOT wire fields */
  attacked?: boolean;
  ghost?: boolean;
}

/** MH-1.2: mzone/szone are dense fixed-length with explicit null holes. */
export interface DuelZones {
  p0_hand: ZoneCard[];
  p1_hand: ZoneCard[];
  p0_mzone: (ZoneCard | null)[];
  p1_mzone: (ZoneCard | null)[];
  p0_szone: (ZoneCard | null)[];
  p1_szone: (ZoneCard | null)[];
  p0_fzone: ZoneCard | null; // MH-1.4
  p1_fzone: ZoneCard | null; // MH-1.4
  p0_grave: ZoneCard[];
  p1_grave: ZoneCard[];
  p0_removed: ZoneCard[];
  p1_removed: ZoneCard[];
  p0_extra: ZoneCard[];
  p1_extra: ZoneCard[];
  p0_deckCount: number;
  p1_deckCount: number;
}

export type PhaseName = "DP" | "SP" | "M1" | "BP" | "M2" | "EP";

export interface DuelStateSnapshot {
  seat: Seat;
  duelEnded: boolean;
  currentTurn: Seat;
  currentPhase: PhaseName; // MH-1.5 / NH-4 (integer encoding replaced by a named phase)
  turnNumber: number; // MH-1.5
  lp: [number, number];
  zones: DuelZones;
  clock?: { onClockSeat: Seat; deadlineAt: number };
}

// ── Decisions (packages/contracts/src/duelDecision.ts) ────────────────────────

export interface CardEntry {
  code: number;
  name: string;
  controller: Seat;
  location: LocationCode;
  sequence: number;
}
export interface ActiveCardEntry extends CardEntry {
  description: string;
}
export interface AttackEntry extends CardEntry {
  canDirectAttack: boolean;
}
export interface ZoneEntry {
  controller: Seat;
  location: "MZONE" | "SZONE" | "FZONE";
  sequence: number;
}

export type DuelDecision =
  | {
      kind: "IdleCommand";
      player: Seat;
      summons: CardEntry[];
      specialSummons: CardEntry[];
      posChanges: CardEntry[];
      monsterSets: CardEntry[];
      spellSets: CardEntry[];
      activates: ActiveCardEntry[];
      toBattlePhase: boolean;
      toEndPhase: boolean;
    }
  | {
      kind: "BattleCommand";
      player: Seat;
      chains: ActiveCardEntry[];
      attacks: AttackEntry[];
      toMainPhase2: boolean;
      toEndPhase: boolean;
    }
  | { kind: "ChainPrompt"; player: Seat; forced: boolean; selects: ActiveCardEntry[] }
  | { kind: "SelectEffectYN"; player: Seat; card: CardEntry; description: string }
  | { kind: "SelectYesNo"; player: Seat; description: string }
  | { kind: "SelectOption"; player: Seat; options: string[] }
  | {
      kind: "SelectCard";
      player: Seat;
      cards: CardEntry[];
      min: number;
      max: number;
      cancelable: boolean;
    }
  | {
      kind: "SelectTribute";
      player: Seat;
      cards: CardEntry[];
      min: number;
      max: number;
      cancelable: boolean;
    }
  | { kind: "SelectZone"; player: Seat; count: number; zones: ZoneEntry[] }
  | { kind: "SelectPosition"; player: Seat; card: CardEntry; positions: PositionCode[] }
  | {
      kind: "SelectUnselectCard";
      player: Seat;
      selectCards: CardEntry[];
      unselectCards: CardEntry[];
      min: number;
      max: number;
      canFinish: boolean;
      cancelable: boolean;
    }
  | { kind: "AnnounceRace"; player: Seat; count: number; available: string[] }
  | { kind: "AnnounceAttrib"; player: Seat; count: number; available: string[] }
  | {
      kind: "AnnounceCard";
      player: Seat;
      filter: { kind: "any" } | { kind: "codes"; codes: number[] };
    }
  | { kind: "AnnounceNumber"; player: Seat; options: number[] }
  | { kind: "SortChain"; player: Seat; cards: CardEntry[] }
  | {
      kind: "SelectCounter";
      player: Seat;
      counterType: number;
      count: number;
      cards: (CardEntry & { currentCount: number })[];
    }
  | {
      kind: "SelectSum";
      player: Seat;
      amount: number;
      must: (CardEntry & { amount: number })[];
      optional: (CardEntry & { amount: number })[];
      min: number;
      max: number;
    }
  | { kind: "SelectDisfield"; player: Seat; count: number; zones: ZoneEntry[] }
  | { kind: "SortCard"; player: Seat; cards: CardEntry[] };

export type DecisionKind = DuelDecision["kind"];

// ── Event feed (MH-2) ────────────────────────────────────────────────────────

export type EventVerb =
  | "Draw"
  | "Summon"
  | "Tribute Summon"
  | "Special Summon"
  | "Flip Summon"
  | "Set"
  | "Activate"
  | "Chain"
  | "Resolve"
  | "Negated"
  | "Target"
  | "Attack"
  | "Destroyed"
  | "Damage"
  | "Banish"
  | "Move"
  | "Position";

export interface DuelEvent {
  id: number;
  /** the raw ocgcore message type this row was derived from (capture ground truth) */
  engineType: number;
  owner: Seat;
  code: number; // 0 = hidden
  verb: EventVerb;
  from?: LocationCode;
  to?: LocationCode;
  amount?: number; // damage / LP
  turnNumber: number;
  phase: PhaseName;
}

// ── Chain strip ──────────────────────────────────────────────────────────────

export interface ChainLink {
  ordinal: number;
  code: number;
  owner: Seat;
  location: LocationCode;
  state: "declared" | "resolving" | "resolved";
}

// ── Client-side intent (NOT a wire type — this is the design's own object) ────

export interface PendingIntent {
  label: string; // "Tribute Summoning \"Caius the Shadow Monarch\""
  cardCode: number;
  steps: string[]; // ["Tributes", "Zone", "Position"]
  stepIndex: number;
  /** index into steps[] of the FIRST non-cancelable step — the point of no return */
  commitAt: number;
  cancelable: boolean;
  trailingUnknown?: boolean; // render a "…" step because a trigger may or may not fire
}
