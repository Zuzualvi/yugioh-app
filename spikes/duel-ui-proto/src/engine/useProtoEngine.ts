/**
 * The scripted "engine" behind the prototype.
 *
 * FAKED: data, persistence, auth, concurrency, network failure.
 * REAL:  interaction, sequencing, round-trip latency, mode switching, states.
 *
 * ── ONE mechanism for continuations, and why ────────────────────────────────
 * A step's continuation is `branch(answer) => Step[]`. There is no other way for a
 * step to lead somewhere. Revision 2 had TWO mechanisms — `applySelection` (patch the
 * board) and `declineBranch` (a different path for decline) — and both left a third,
 * implicit path: fall through to a hardcoded next step. That implicit path is keyed to
 * the STEP, so it cannot depend on the ANSWER, and it produced the same bug three
 * times: B3 (tribute ignored), B4 (decline == confirm) and the chain-activation bug
 * (Book of Moon played Solemn Judgment).
 *
 * The rule now: **any decision with more than one legal answer MUST define `branch`.**
 * A step with no `branch` may only be a step with at most one legal answer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChainLink,
  DuelEvent,
  DuelStateSnapshot,
  PendingIntent,
  Seat,
} from "../fixtures/types";
import type { Answer, CardRef, Scenario, Step } from "../fixtures/scenarios";
import { candidateCodes } from "../fixtures/scenarios";

export type Mode = "act" | "answer" | "waiting" | "resolving" | "ended";

export interface EngineView {
  step: Step | null;
  stepIndex: number;
  total: number;
  state: DuelStateSnapshot;
  intent: PendingIntent | null;
  chain: ChainLink[];
  log: DuelEvent[];
  mode: Mode;
  busy: boolean;
  waitLabel: string | null;
  autoReceipt: string | null;
  clockSeconds: number;
  myClockSeconds: number;
  oppClockSeconds: number;
  onClockSeat: Seat;
  highlight: CardRef[];
  autoPush: number | null;
  end: { winner: Seat | null; reason: string } | null;
  note: string | null;
}

const MY_START = 300;
const OPP_START = 300;

export function useProtoEngine(scenario: Scenario, revealAuto: boolean, chooseZones = false) {
  const [track, setTrack] = useState<Step[]>(scenario.steps);
  const [stepIndex, setStepIndex] = useState(0);
  const [applied, setApplied] = useState<Step>(scenario.steps[0]);
  const [log, setLog] = useState<DuelEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [waitLabel, setWaitLabel] = useState<string | null>(null);
  const [autoReceipt, setAutoReceipt] = useState<string | null>(null);
  const [myClock, setMyClock] = useState(MY_START);
  const [oppClock, setOppClock] = useState(OPP_START);
  const [onClockSeat, setOnClockSeat] = useState<Seat>(scenario.steps[0].onClockSeat ?? 0);
  const [end, setEnd] = useState<{ winner: Seat | null; reason: string } | null>(null);
  const [autoPush, setAutoPush] = useState<number | null>(null);
  const [chain, setChain] = useState<ChainLink[]>([]);

  const timers = useRef<number[]>([]);
  const eventId = useRef(0);
  const trackRef = useRef<Step[]>(scenario.steps);
  const stepRef = useRef(0);
  const endedRef = useRef(false);
  const goToRef = useRef<(i: number, steps?: Step[]) => void>(() => {});

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const apply = useCallback((step: Step) => {
    setApplied(step);
    if (step.chain) setChain(step.chain);
    if (step.autoPush) setAutoPush(step.autoPush);
    if (step.myClockSeconds !== undefined) setMyClock(step.myClockSeconds);
    if (step.oppClockSeconds !== undefined) setOppClock(step.oppClockSeconds);
    if (step.onClockSeat !== undefined) setOnClockSeat(step.onClockSeat);
    if (step.events?.length) {
      setLog((prev) => [...prev, ...step.events!.map((e) => ({ ...e, id: eventId.current++ }))]);
    }
    if (step.end) {
      setEnd(step.end);
      endedRef.current = true;
    }
  }, []);

  /**
   * The ONLY way a step leads anywhere. Every path — confirm, decline, and the
   * client's own auto-answer — comes through here with the answer in hand.
   */
  const continueFrom = useCallback((i: number, a: Answer, list: Step[]) => {
    const step = list[i];
    if (!step) return;
    const br = step.branch?.(a);
    if (br && br.length) {
      goToRef.current(0, br);
      return;
    }
    if (a.kind === "decline") {
      // No scripted decline path: replay from the top, which is the honest fixture
      // equivalent of "nothing was consumed".
      goToRef.current(-1);
      return;
    }
    goToRef.current(i + 1);
  }, []);

  /** Present step `i` of the current track. EVERY step goes through here, including 0. */
  const goTo = useCallback(
    (i: number, steps?: Step[]) => {
      if (i === -1) {
        resetRef.current();
        return;
      }
      const list = steps ?? trackRef.current;
      if (steps) {
        trackRef.current = steps;
        setTrack(steps);
      }
      if (i >= list.length) return;
      const step = list[i];
      const latency = step.latencyMs ?? 120;
      setBusy(true);
      setWaitLabel(step.waitLabel ?? null);
      setAutoReceipt(null);
      later(() => {
        setStepIndex(i);
        stepRef.current = i;
        apply(step);
        setBusy(false);
        setWaitLabel(null);

        if (step.end) return;

        // "Choose zones: ON" turns the auto-answered SelectZone back into a real question.
        const suppressAuto = chooseZones && step.decision?.kind === "SelectZone";
        if (step.autoResolved && !suppressAuto) {
          setAutoReceipt(step.autoResolved);
          const hold = revealAuto ? 2200 : 240;
          later(() => {
            setAutoReceipt(null);
            // The client's auto-answer is an ANSWER: it goes through branch() like any
            // other, with an empty selection meaning "use the default".
            continueFrom(i, { kind: "confirm", selection: [], codes: [] }, list);
          }, hold);
          return;
        }
        if (step.decision === null) {
          later(() => goToRef.current(i + 1), 220);
        }
      }, latency);
    },
    [apply, revealAuto, chooseZones, continueFrom],
  );
  goToRef.current = goTo;

  const resetRef = useRef<() => void>(() => {});
  const reset = useCallback(() => {
    clearTimers();
    eventId.current = 0;
    endedRef.current = false;
    trackRef.current = scenario.steps;
    stepRef.current = 0;
    setTrack(scenario.steps);
    setStepIndex(0);
    setApplied(scenario.steps[0]);
    setLog(scenario.seedLog?.map((e) => ({ ...e, id: eventId.current++ })) ?? []);
    setBusy(false);
    setWaitLabel(null);
    setAutoReceipt(null);
    setChain([]);
    setAutoPush(null);
    setEnd(null);
    setMyClock(scenario.steps[0].myClockSeconds ?? MY_START);
    setOppClock(scenario.steps[0].oppClockSeconds ?? OPP_START);
    setOnClockSeat(scenario.steps[0].onClockSeat ?? 0);
    goTo(0, scenario.steps);
  }, [scenario, goTo]);
  resetRef.current = reset;

  useEffect(() => {
    reset();
    return clearTimers;
  }, [reset]);

  // Only the on-clock seat's clock runs. Per handover of control, not per decision.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (endedRef.current) return;
      if (onClockSeat === 0) setMyClock((s) => (s > 0 ? s - 1 : 0));
      else setOppClock((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [onClockSeat]);

  /** Confirm / proceed, carrying WHAT the player chose. */
  const answer = useCallback(
    (selection: CardRef[] = []) => {
      const i = stepRef.current;
      const step = trackRef.current[i];
      const codes = candidateCodes(step?.decision ?? null, selection);
      continueFrom(i, { kind: "confirm", selection, codes }, trackRef.current);
    },
    [continueFrom],
  );

  /** Decline / cancel. NEVER the same thing as answer(). */
  const decline = useCallback(() => {
    const i = stepRef.current;
    continueFrom(i, { kind: "decline" }, trackRef.current);
  }, [continueFrom]);

  const mode: Mode = end
    ? "ended"
    : busy
      ? waitLabel
        ? "waiting"
        : "resolving"
      : autoReceipt
        ? "waiting"
        : applied.decision === null
          ? "waiting"
          : applied.decision.kind === "IdleCommand" || applied.decision.kind === "BattleCommand"
            ? "act"
            : "answer";

  const view: EngineView = {
    step: applied,
    stepIndex,
    total: track.length,
    state: applied.state,
    intent: applied.intent ?? null,
    chain,
    log,
    mode,
    busy,
    waitLabel: waitLabel ?? (applied.decision === null ? (applied.waitLabel ?? null) : null),
    autoReceipt,
    clockSeconds: onClockSeat === 0 ? myClock : oppClock,
    myClockSeconds: myClock,
    oppClockSeconds: oppClock,
    onClockSeat,
    highlight: applied.highlight ?? [],
    autoPush,
    end,
    note: applied.note ?? null,
  };

  return { view, answer, decline, reset, setAutoPush };
}
