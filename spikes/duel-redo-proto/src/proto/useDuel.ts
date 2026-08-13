import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CardEntry, DuelEvent, DuelStateSnapshot, Seat } from "./types";
import { mayAnswerWithoutAsking, theOnlyAnswer, type DecisionResponse } from "./classify";
import { playerCancelExists } from "./playerCancelExists";
import { questionTakesTheBand } from "./questionTakesTheBand";
import type { Continuation, Step } from "./replay";
import { applyEvents, clone } from "./board";
import type { PresenceState, Scenario } from "./scenarios";

export type Control = "mine" | "theirs" | "resolving" | "connecting" | "disconnected" | "ended";

export interface Intent {
  verb: string;
  subject: CardEntry | null;
  subjectName: string;
  /** Can the PLAYER cancel the step that is live right now. */
  cancelable: boolean;
  /** Has an uncancelable step been reached. */
  committed: boolean;
}

export interface Receipt {
  id: number;
  text: string;
  detail: string;
}

export interface DuelModel {
  scenario: Scenario;
  board: DuelStateSnapshot;
  mySeat: Seat;
  control: Control;
  step: Step | null;
  intent: Intent | null;
  receipts: Receipt[];
  feed: DuelEvent[];
  delta: DuelEvent[] | null;
  deltaOpen: boolean;
  /**
   * THE FEED RAIL'S `— since you last acted —` BOUNDARY, AND IT IS NOT THE DELTA'S
   * (ZUH-145). It is the first event that arrived while control was away, held by
   * identity so no arithmetic can move it.
   *
   * 02 §3.5 gives the delta a `dismissed / spent` state whose behaviour is "gone,
   * **feed mark stays**", and 02 §7 triggers the mark on "control just returned" —
   * so the strip is the transient summary and the mark is the durable boundary.
   * This field exists because the boundary was previously derived from `delta`,
   * which meant dismissing the summary silently deleted the transcript's record of
   * where the player's own last action was.
   *
   * Survives: Show · Hide · Dismiss · the player's actions · DUEL_END (the rail
   * stays live after the duel ends, and the boundary is still true).
   * Ceases: replaced by the next handover's boundary · a new duel.
   */
  deltaMark: DuelEvent | null;
  selection: number[];
  presence: PresenceState;
  net: "ok" | "reconnecting";
  ended: ({ winner: Seat | null; reason: string } & { reviewing?: boolean }) | null;
  error: string | null;
  normalSummonSpent: boolean;
  /** The label of the control the player last pressed — the matrix reads this. */
  lastNamed: string | null;
  /** Something the prototype cannot truthfully show at this point. */
  protoNote: string | null;
  /** Refs of monsters that have already declared an attack this Battle Phase. */
  spentAttackers: { controller: Seat; location: string; sequence: number }[];
}

/**
 * The label-fidelity probe.
 *
 * The answer-outcome matrix proved that distinct answers produce distinct
 * OUTCOMES. It did not — and could not — prove that the confirm control NAMED the
 * answer being submitted, and that is the half the chain window failed: the label
 * came from hand-authored fixture data and the response came from the index.
 *
 * So the submit path publishes, for every response it sends: the response payload,
 * and the resolved identity of each card the response actually names. The gate
 * asserts the rendered label and the selection line contain those identities.
 */
export interface LastSubmit {
  kind: string;
  response: DecisionResponse;
  /** Resolved identity of each card the RESPONSE names — never the label's own text. */
  identities: string[];
  /** What the control the player pressed said, captured at press time. */
  label: string;
  /** What the selection line said, captured at press time. */
  selectionLine: string;
}

declare global {
  interface Window {
    __lastSubmit?: LastSubmit;
  }
}

let receiptId = 1;

export function useDuel(scenario: Scenario) {
  const [board, setBoard] = useState<DuelStateSnapshot>(() => clone(scenario.board));
  const [control, setControl] = useState<Control>(scenario.control as Control);
  const [step, setStep] = useState<Step | null>(scenario.open);
  const [queue, setQueue] = useState<Step[]>([]);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [feed, setFeed] = useState<DuelEvent[]>(scenario.feed);
  const [delta, setDelta] = useState<DuelEvent[] | null>(null);
  const [deltaOpen, setDeltaOpen] = useState(false);
  const [deltaMark, setDeltaMark] = useState<DuelEvent | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [presence, setPresence] = useState<PresenceState>(scenario.presence ?? "connected");
  const [net, setNet] = useState<"ok" | "reconnecting">(scenario.net ?? "ok");
  const [ended, setEnded] = useState<
    ({ winner: Seat | null; reason: string } & { reviewing?: boolean }) | null
  >(scenario.ended ?? null);
  const [error, setError] = useState<string | null>(null);
  const [normalSummonSpent, setSpent] = useState(false);
  const [lastNamed, setLastNamed] = useState<string | null>(null);
  const [protoNote, setProtoNote] = useState<string | null>(null);
  const [spentAttackers, setSpentAttackers] = useState<DuelModel["spentAttackers"]>([]);
  const timers = useRef<number[]>([]);

  const reset = useCallback(
    (s: Scenario) => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setBoard(clone(s.board));
      setControl(s.control as Control);
      setStep(s.open);
      setQueue([]);
      setIntent(null);
      setReceipts([]);
      setFeed(s.feed);
      setDelta(null);
      setDeltaOpen(false);
      setDeltaMark(null);
      setSelection([]);
      setPresence(s.presence ?? "connected");
      setNet(s.net ?? "ok");
      setEnded(s.ended ?? null);
      setError(null);
      setSpent(false);
      setLastNamed(null);
      setProtoNote(null);
      setSpentAttackers([]);
      if (typeof window !== "undefined") delete window.__lastSubmit;
    },
    [],
  );

  useEffect(() => reset(scenario), [scenario, reset]);

  // SC1 only: the seating statement is replaced when the ENGINE's first DECISION
  // arms the board. There is no fixture socket here, so 1400 ms stands in for that
  // frame arriving — a replay stand-in, NOT a designed duration and not a beat.
  // ZUH-131 B6 observed ~15–20 s of read-only screens between games in the
  // reference client; the register question that raises (a dock line vs a screen of
  // its own) is recorded in `09-pacing-application.md` B6 and is not answered here.
  useEffect(() => {
    if (scenario.id !== "start") return;
    const t = window.setTimeout(() => setControl("mine"), 1400);
    timers.current.push(t);
    return () => window.clearTimeout(t);
  }, [scenario]);

  /**
   * THE RECEIPT HAS NO TIMER (ZUH-131 budget B1).
   *
   * It was removed after `--m-receipt` (2400 ms). The pacing study measured the
   * surrounding rhythm of a real match at 25–30 s per screen state, and the
   * reference client answers the same moment with a dialog that waits for a
   * click — so 2.4 s-and-gone is the aggressive end of the spectrum. This is the
   * rule the design already applies to the delta strip: it never auto-fades, and
   * recovery for "I did not read it" is "read it again".
   *
   * Cessation is below, in four places, and nowhere else:
   *   · a question takes the band (superseded)   · the player's next action
   *   · control leaves me                        · DUEL_END
   */
  const pushReceipt = useCallback((text: string, detail: string) => {
    setReceipts((rs) => [...rs, { id: receiptId++, text, detail }]);
  }, []);

  const applyContinuation = useCallback(
    (c: Continuation, from: Step) => {
      setLastNamed(c.named);
      setProtoNote(c.protoNote ?? null);
      if (c.attackerSpent) setSpentAttackers((xs) => [...xs, c.attackerSpent!]);
      if (c.mutate) {
        setBoard((b) => {
          const nb = clone(b);
          c.mutate!(nb);
          return nb;
        });
      }
      // Recorded engine events move the board. This is what makes the life-point
      // plate and the history rail agree instead of contradicting each other.
      if (c.applyRecorded && c.events?.length) {
        setBoard((b) => applyEvents(clone(b), c.events as { kind: string }[]));
      }
      // A PHASE event moves the board's own phase, exactly as the next STATE frame
      // would. The rail reads the board and never re-derives the phase itself.
      const phaseEv = c.events?.find((e) => e.kind === "PHASE" && typeof e["phase"] === "number");
      if (phaseEv) {
        const next = phaseEv["phase"] as number;
        setBoard((b) => ({ ...b, currentPhase: next }));
      }
      if (c.events?.length) {
        setFeed((f) => [
          ...f,
          ...c.events!.map((e, i) => ({
            turnNumber: 0,
            phase: 0,
            seq: f.length + i,
            ...e,
          }) as DuelEvent),
        ]);
        if (c.events.some((e) => e.kind === "SUMMON")) setSpent(true);
      }
      // ── CESSATION. The decision stops being the player's the instant it is
      // answered — not when an ack arrives, not when the next frame lands.
      setStep(null);
      if (c.endDuel) {
        setEnded(c.endDuel);
        setControl("ended");
        setIntent(null);
        setReceipts([]); // B1 cessation · DUEL_END
        return;
      }
      if (c.next?.length) {
        const [head, ...rest] = c.next;
        // B1 cessation · superseded. Only a QUESTION supersedes a receipt; the
        // board re-arming does not, which is why this is not `if (head)`.
        if (questionTakesTheBand(head!.decision)) setReceipts([]);
        setQueue(rest);
        const nextIntent = head!.intent ?? from.intent ?? null;
        if (nextIntent) {
          const nextCancelable = playerCancelExists(head!.decision);
          setIntent({
            verb: nextIntent.verb,
            subject: nextIntent.subject,
            subjectName: nextIntent.subject?.name ?? "",
            cancelable: nextCancelable,
            committed: !nextCancelable,
          });
        }
        // one frame of "resolving" so the gap between a click and the engine's
        // answer is a real, visible thing rather than an instant swap.
        setControl("resolving");
        const t = window.setTimeout(() => {
          setControl("mine");
          setStep(head!);
          setSelection([]);
        }, 260);
        timers.current.push(t);
        return;
      }
      setIntent(null);
      setQueue([]);
      if (c.handOver) {
        setControl("theirs");
        setReceipts([]); // B1 cessation · control leaves me
        // Everything the opponent does while it is theirs, then control back.
        if (scenario.delta?.length) {
          // 2.6 s stands in for a whole opponent turn, which ZUH-131 B5 measured
          // at ~30 s (two turns, 30 s and 35 s). It is a REVIEW COMPRESSION so a
          // reviewer is not left staring at a desaturated board — not a designed
          // duration, and no pacing decision should be read out of it.
          const t = window.setTimeout(() => {
            setDelta(scenario.delta!);
            // The boundary is set HERE — at control return, with the strip — and is
            // never unset with it. 02 §7: the mark's trigger is "control just
            // returned", not "a summary is open".
            setDeltaMark(scenario.delta![0] ?? null);
            setFeed((f) => [...f, ...scenario.delta!]);
            // The delta's own recorded LP_CHANGE / MOVE events move the board.
            // Narrating them without applying them is what made the life-point
            // plate read 8,000 beside a rail row saying -1900.
            setBoard((b) => applyEvents(clone(b), scenario.delta as { kind: string }[]));
            setControl("mine");
            setStep(scenario.open);
            setSpent(false);
          }, 2600);
          timers.current.push(t);
        }
        return;
      }
      setControl("resolving");
      const t = window.setTimeout(() => {
        setControl("mine");
        setStep(scenario.open);
        // B1 cessation · superseded, on the return to the scenario's own open
        // decision. Same test: a question supersedes, an armed board does not.
        if (questionTakesTheBand(scenario.open?.decision)) setReceipts([]);
      }, 320);
      timers.current.push(t);
    },
    [scenario],
  );

  // ── auto-answer, per the classification law, on arrival ─────────────────────
  useEffect(() => {
    if (!step) return;
    if (!mayAnswerWithoutAsking(step.decision)) return;
    const answer = theOnlyAnswer(step.decision);
    const c = step.branch(answer);
    pushReceipt("Answered for you", c.named);
    const t = window.setTimeout(() => applyContinuation(c, step), 220);
    timers.current.push(t);
    return () => window.clearTimeout(t);
  }, [step, applyContinuation, pushReceipt]);

  const answer = useCallback(
    (a: DecisionResponse, probe?: { identities: string[]; label: string; selectionLine: string }) => {
      if (!step) return;
      if (typeof window !== "undefined" && probe) {
        window.__lastSubmit = {
          kind: step.decision.kind,
          response: a,
          identities: probe.identities,
          label: probe.label,
          selectionLine: probe.selectionLine,
        };
      }
      const c = step.branch(a);
      // B1 cessation · the player's next action. Anything the player submits
      // clears a receipt they have had every opportunity to read.
      setReceipts([]);
      applyContinuation(c, step);
    },
    [step, applyContinuation],
  );

  const cancelIntent = useCallback(() => {
    if (!step || !intent?.cancelable) return;
    const k = step.decision.kind;
    const a: DecisionResponse =
      k === "SelectTribute" || k === "SelectCard"
        ? ({ kind: k, indices: null } as DecisionResponse)
        : ({ kind: "SelectUnselectCard", index: null } as DecisionResponse);
    const c = step.branch(a);
    setLastNamed(c.named);
    setStep(null);
    setIntent(null);
    setReceipts([]); // B1 cessation · the player's next action (their own cancel)
    setControl("resolving");
    const t = window.setTimeout(() => {
      setControl("mine");
      setStep(scenario.open);
      setSelection([]);
    }, 260);
    timers.current.push(t);
  }, [step, intent, scenario]);

  const resign = useCallback(() => {
    setEnded({ winner: (1 - scenario.mySeat) as Seat, reason: "resign" });
    setControl("ended");
    setStep(null);
    setIntent(null);
    setReceipts([]); // B1 cessation · DUEL_END
  }, [scenario]);

  const reviewBoard = useCallback(() => setEnded((e) => (e ? { ...e, reviewing: true } : e)), []);

  const claim = useCallback(() => {
    setEnded({ winner: scenario.mySeat, reason: "abandoned" });
    setControl("ended");
    setStep(null);
    setReceipts([]); // B1 cessation · DUEL_END
  }, [scenario]);

  const model: DuelModel = useMemo(
    () => ({
      scenario,
      board,
      mySeat: scenario.mySeat,
      control,
      step,
      intent,
      receipts,
      feed,
      delta,
      deltaOpen,
      deltaMark,
      selection,
      presence,
      net,
      ended,
      error,
      normalSummonSpent,
      lastNamed,
      protoNote,
      spentAttackers,
    }),
    [scenario, board, control, step, intent, receipts, feed, delta, deltaOpen, deltaMark, selection, presence, net, ended, error, normalSummonSpent, lastNamed, protoNote, spentAttackers],
  );

  return {
    model,
    answer,
    cancelIntent,
    claim,
    setSelection,
    setPresence,
    setNet,
    setError,
    dismissDelta: () => {
      setDelta(null);
      setDeltaOpen(false);
    },
    toggleDelta: () => setDeltaOpen((o) => !o),
    resign,
    reviewBoard,
    showResult: () => setEnded((e) => (e ? { ...e, reviewing: false } : e)),
    reset: () => reset(scenario),
    queueLength: queue.length,
  };
}
