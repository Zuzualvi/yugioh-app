// The replayer. Fixtures in, one client-side model out.
//
// Every continuation goes through ONE mechanism: `branch(answer)`. There is no
// second path and no step-keyed fall-through. That is the single root cause of
// the answer-fidelity defect class (found and reported fixed three times in the
// previous prototype): outcomes keyed to the STEP cannot vary with the ANSWER.
import type {
  CardEntry,
  DecisionContext,
  DuelDecision,
  DuelEvent,
  DuelStateSnapshot,
  Seat,
  ServerFrame,
} from "./types";
import type { DecisionResponse } from "./classify";
import { clone, hand, put, refOf, row, take } from "./board";

export interface Continuation {
  /** Exactly what the control the player pressed SAID, captured at press time. */
  named: string;
  mutate?: (b: DuelStateSnapshot) => void;
  events?: Partial<DuelEvent>[];
  /** Further decisions of the SAME intent. */
  next?: Step[];
  /** Hand control to the opponent when this resolves. */
  handOver?: boolean;
  endDuel?: { winner: Seat | null; reason: string };
  /** A monster that has now declared an attack; the engine stops offering it. */
  attackerSpent?: { controller: Seat; location: string; sequence: number };
  /**
   * Something the PROTOTYPE cannot truthfully show. Rendered in the dock in the
   * prototype's own stub voice so nobody reads a missing outcome as a designed one.
   */
  protoNote?: string;
}

export interface Step {
  decision: DuelDecision;
  context?: DecisionContext;
  /** The intent this step belongs to, if any. */
  intent?: { verb: string; subject: CardEntry | null };
  /**
   * Does the step that follows this one have no cancel the engine will honour?
   * One boolean, not a printed step count. This is the whole of the commit point:
   * the client knows its own verb's step sequence, and uses that knowledge to
   * answer "is the exit about to disappear" — never to print a guessed budget
   * next to an engine fact.
   */
  commitsNext?: boolean;
  branch: (answer: DecisionResponse) => Continuation;
}

export interface Fixture {
  name: string;
  provenance: string;
  source: string;
  note: string;
  mySeat: Seat;
  frames: { dir: "in" | "out"; t: number; frame: ServerFrame }[];
}

export function firstState(fx: Fixture): DuelStateSnapshot {
  const f = fx.frames.find((x) => x.frame.type === "STATE");
  if (!f) throw new Error(`${fx.name}: no STATE frame`);
  return clone((f.frame as { type: "STATE"; state: DuelStateSnapshot }).state);
}

export function lastState(fx: Fixture): DuelStateSnapshot {
  const all = fx.frames.filter((x) => x.frame.type === "STATE");
  return clone((all[all.length - 1]!.frame as { type: "STATE"; state: DuelStateSnapshot }).state);
}

export function firstDecision<K extends DuelDecision["kind"]>(
  fx: Fixture,
  kind: K,
  where?: (d: Extract<DuelDecision, { kind: K }>) => boolean,
): Extract<DuelDecision, { kind: K }> {
  for (const f of fx.frames) {
    if (f.frame.type !== "DECISION") continue;
    const d = f.frame.decision;
    if (d.kind === kind && (!where || where(d as Extract<DuelDecision, { kind: K }>))) {
      return JSON.parse(JSON.stringify(d)) as Extract<DuelDecision, { kind: K }>;
    }
  }
  throw new Error(`${fx.name}: no ${kind} decision`);
}

export function eventsOf(fx: Fixture): DuelEvent[] {
  const out: DuelEvent[] = [];
  for (const f of fx.frames) {
    if (f.frame.type === "EVENTS") out.push(...f.frame.events);
  }
  return out;
}

export function contextOf(fx: Fixture): DecisionContext | undefined {
  const f = fx.frames.find((x) => x.frame.type === "DECISION_CONTEXT");
  return f ? (f.frame as { type: "DECISION_CONTEXT"; context: DecisionContext }).context : undefined;
}

// ── answer-derived helpers, shared by every branch ─────────────────────────────

export function ev(kind: string, extra: Record<string, unknown> = {}): Partial<DuelEvent> {
  return { kind, ...extra };
}

/** Move a named card into a named zone. Both are named BY THE ANSWER. */
export function moveTo(from: CardEntry, seat: Seat, loc: "MZONE" | "SZONE", seq: number, position: number) {
  return (b: DuelStateSnapshot) => {
    const c = take(b, refOf(from));
    if (c) put(b, seat, loc, seq, c, position);
  };
}

/** Send named cards to the graveyard. Named BY THE ANSWER. */
export function sendToGrave(cards: CardEntry[]) {
  return (b: DuelStateSnapshot) => {
    for (const e of cards) {
      const c = take(b, refOf(e));
      if (c) put(b, e.controller, "GRAVE", 0, { ...c, position: 1 });
    }
  };
}

export function faceUp(pos: number) {
  return pos & ~(2 | 8);
}

export { clone, hand, row };
