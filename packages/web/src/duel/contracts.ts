// ---------------------------------------------------------------------------
// Duel UI Rebuild — the SHARED INTERFACE between the three web slices.
//
// ⚠️ THIS FILE IS OWNED BY THE CTO AND IS FROZEN. No slice may edit it.
//    W1 (board + ACT mode), W2 (answer dock) and W3 (inspectors + log) all
//    build against these types. If you need a change here, STOP and ask —
//    a change to this file is a change to someone else's slice.
//
// Why it exists: three engineers build one screen in parallel. Every type
// that crosses a slice boundary is declared here once, so the shapes cannot
// drift. Everything NOT crossing a boundary stays inside its own slice and
// is nobody else's business.
//
// Spec: docs/specs/2026-08-07-duel-ui-rebuild-engineering.md
// Design authority: docs/specs/2026-08-06-duel-ui-design.md
// ---------------------------------------------------------------------------

import type {
  DuelDecision,
  DuelDecisionResponse,
  DuelEvent,
  DuelStateSnapshot,
  Seat,
} from "@yugioh-app/contracts";

// ── Addressing a card on the board ──────────────────────────────────────────

/**
 * Every engine target is {controller, location, sequence}. MH-1 put `sequence`
 * on the board snapshot so a rendered tile can be matched to one; this is the
 * shared way to name a tile. `sequence` indexes directly into the dense
 * mzone/szone arrays — index === sequence, guaranteed by the contract.
 */
export interface CardRef {
  controller: Seat;
  location: "HAND" | "MZONE" | "SZONE" | "FZONE" | "GRAVE" | "REMOVED" | "EXTRA" | "DECK";
  sequence: number;
}

/** Value equality for CardRef. Never compare these with ===. */
export function sameCardRef(a: CardRef, b: CardRef): boolean {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
}

// ── The two interaction modes (design spec §0, Law 1) ───────────────────────

/**
 * ACT and ANSWER are different objects in different places and are NEVER both
 * live. `waiting` is off-clock; `ended` is after DUEL_END.
 */
export type DuelMode = "act" | "answer" | "waiting" | "ended";

// ── Player intent spanning several engine decisions (design spec §5) ────────

/**
 * One player intent decomposes into 2-6 engine decisions. This object survives
 * the STATE-then-DECISION message order and must NOT be cleared by a STATE
 * frame — that is the bug that blanks the panel today (DuelScreen.tsx:128-131).
 */
export interface PendingIntent {
  /** Stable for the life of the intent. */
  id: string;
  /** e.g. "Tribute Summoning \"Caius the Shadow Monarch\"" */
  label: string;
  /** The card the intent is about. */
  subject: CardRef;
  /** Client-owned step templates — the engine does not announce step counts. */
  steps: IntentStep[];
  /** Index into `steps`. */
  currentStep: number;
  /**
   * Index of the last step from which the player can still back out. Steps at
   * or after this index are past the point of no return. -1 means the intent
   * is not cancelable at all.
   */
  commitStep: number;
  /** True when the total number of steps is not knowable in advance. */
  stepCountUncertain: boolean;
}

export interface IntentStep {
  /** Short label, e.g. "Choose tributes". */
  label: string;
  /** Filled once the step is answered — what the player actually chose. */
  answered?: { summary: string; auto: boolean };
}

// ── Chain (design spec §6) ──────────────────────────────────────────────────

export interface ChainLink {
  /** 1-based ordinal. */
  link: number;
  card: CardRef;
  code: number;
  name: string;
  owner: Seat;
  /** True for the link currently resolving. */
  resolving: boolean;
}

// ── Auto-answer receipts (design spec §4b, requirement C9) ──────────────────

/**
 * A decision the client answered on the player's behalf. The player is being
 * TOLD, not asked: read-only, past tense, no primary button. Requirement C9
 * makes this recoverable rather than invisible.
 */
export interface AutoAnswerReceipt {
  id: string;
  /** What was answered, past tense. */
  summary: string;
  /**
   * Why it needed no input. Both values are facts about the decision we were
   * handed — never an inferred rules explanation (requirement H).
   * "prompt-level-suppressed" is added in C4: the player set a prompt level
   * that opted out of this window type; the client declined on their behalf.
   */
  reason: "only-one-legal-answer" | "engine-unrestricted-placement" | "prompt-level-suppressed";
  at: number;
}

// ── The interaction state machine's published surface ────────────────────────

/**
 * What the state machine publishes to every slice.
 *
 * IMPLEMENTED BY W2 (the answer dock owns intent continuity, selection and the
 * chain). CONSUMED BY W1 for the dim law and mode switching, and by W3 for the
 * log and the inspectors. W1 ships a stub satisfying this interface in its
 * first push so it is never blocked waiting for W2.
 */
export interface DuelInteraction {
  mode: DuelMode;
  /** The decision currently being answered, or null. */
  decision: DuelDecision | null;
  /**
   * Every card that is a candidate or target of the pending decision, wherever
   * it lives. Law 2 (the dim law): when the Question Bar is up everything dims
   * EXCEPT these, the bar, the chain strip and the clock. Empty in `act` mode.
   * Requirement A10 is checked against exactly this set.
   */
  candidates: CardRef[];
  /** Cards the player has selected for the pending decision. Requirement A11. */
  selection: CardRef[];
  intent: PendingIntent | null;
  chain: ChainLink[];
  receipts: AutoAnswerReceipt[];
  /** Requirement C8: no beat is silent. Null when nothing is in flight. */
  status: string | null;
}

// ── Props DuelStage passes down (design spec §1) ────────────────────────────

/**
 * OWNED BY W1. W2 and W3 mount into the slots DuelStage exposes; neither may
 * change this shape, and neither may edit DuelScreen.tsx.
 */
export interface DuelStageProps {
  state: DuelStateSnapshot;
  decision: DuelDecision | null;
  mySeat: Seat;
  /**
   * ND-5: BOTH deadlines, indexed by seat. Requirement D2 renders both clocks
   * at all times, each labelled running or banked.
   */
  clock: { onClockSeat: Seat; deadlines: [number, number] } | null;
  events: DuelEvent[];
  respond: (r: DuelDecisionResponse) => void;
  connection: "open" | "reconnecting" | "closed";
}

// ── Card identity lookup (NH-1) ─────────────────────────────────────────────

/**
 * The duel-scoped card cache. IMPLEMENTED BY W3, consumed by W1 (board tiles,
 * verb chip labels) and W2 (confirm-control labels).
 *
 * `code === 0` means the viewer is not entitled to the identity — a redacted
 * card. Return null for it; never render a placeholder name.
 */
export interface CardLookup {
  get(code: number): CardInfo | null;
  /** True while a fetch for this code is outstanding. */
  isLoading(code: number): boolean;
}

export interface CardInfo {
  passcode: number;
  name: string;
  frame: "normal" | "effect" | "ritual" | "fusion" | "synchro" | "spell" | "trap";
  level: number | null;
  atk: number | null;
  def: number | null;
  race: string;
  attribute: string | null;
  desc: string;
  /**
   * ND-6 / requirement C13. True when our rendered text was substituted from
   * the pre-errata corpus and therefore differs from the printed card face
   * shown in the art. The provenance badge keys off THIS, never a hand-kept
   * passcode list — and only where an image and our effect text are shown
   * together, because with no printing visible there is nothing to differ from.
   */
  preErrataText: boolean;
}

// ── Inspector control (W3 implements, W1/W2 call) ───────────────────────────

export interface InspectorControl {
  inspectCard(ref: CardRef, code: number): void;
  inspectPile(controller: Seat, location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK"): void;
  close(): void;
}

// ── Ownership colour law (design spec §0) ───────────────────────────────────

/**
 * Yours blue, theirs red — applied without exception to board outlines, log
 * name tints, location badges, chain ordinals and LP plates.
 *
 * Confirm and decline are distinguished by EMPHASIS AND POSITION (filled vs
 * outlined, right vs left), NEVER by green/red: red is spoken for by ownership.
 *
 * W1 declares these custom properties once. W2 and W3 consume them and must
 * not redefine them.
 */
export const OWNERSHIP_CSS_VARS = {
  own: "--own",
  opp: "--opp",
  /** Law 2: everything not a candidate dims to this opacity in answer mode. */
  dimOpacity: "--dim-opacity",
} as const;
