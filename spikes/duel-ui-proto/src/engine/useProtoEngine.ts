/**
 * The scripted "engine" behind the prototype.
 *
 * FAKED: data, persistence, auth, concurrency, network failure.
 * REAL:  interaction, sequencing, round-trip latency, mode switching, states.
 *
 * It walks a Scenario's Steps. Presenting a step costs `latencyMs` — that is the
 * WebSocket round trip, and it is the gap the Intent Ribbon exists to survive.
 *
 * Three mechanisms exist because the usability pass (ZUH-81) found their absence:
 *   • every step, including step 0, is presented through goTo() — a scenario whose
 *     first step is a wait beat used to dead-end forever (blocker B5);
 *   • a step can carry a DECLINE branch, so "No response" is not "Confirm" (B4);
 *   • a step can apply the player's actual selection to the board (B3).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChainLink,
  DuelEvent,
  DuelStateSnapshot,
  PendingIntent,
  Seat,
} from "../fixtures/types";
import type { CardRef, Scenario, Step } from "../fixtures/scenarios";

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
  /** an auto-answered step is showing its receipt; the bar is NOT a live question */
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
  /** the step list currently being walked — the scenario's, or a decline branch */
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
  const [boardOverride, setBoardOverride] = useState<DuelStateSnapshot | null>(null);

  const timers = useRef<number[]>([]);
  const eventId = useRef(0);
  const trackRef = useRef<Step[]>(scenario.steps);
  const endedRef = useRef(false);
  /**
   * B3/M4 — the player's real choices must persist for the REST of the scenario, not
   * just the next beat. Patching one step made the board revert as soon as the engine
   * moved on, which is exactly what the usability pass saw.
   */
  const patchesRef = useRef<((s: DuelStateSnapshot) => DuelStateSnapshot)[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const apply = useCallback((step: Step) => {
    const patched = patchesRef.current.reduce((acc, fn) => fn(acc), step.state);
    setApplied(patched === step.state ? step : { ...step, state: patched });
    setBoardOverride(null);
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

  /** Present step `i` of the current track. EVERY step goes through here, including 0. */
  const goTo = useCallback(
    (i: number, steps?: Step[]) => {
      const list = steps ?? trackRef.current;
      if (steps) {
        trackRef.current = steps;
        setTrack(steps);
      }
      if (i >= list.length) {
        // A finished branch returns to the scenario's own last step rather than
        // dead-ending; a finished scenario stops on its last frame.
        return;
      }
      const step = list[i];
      const latency = step.latencyMs ?? 120;
      setBusy(true);
      setWaitLabel(step.waitLabel ?? null);
      setAutoReceipt(null);
      later(() => {
        setStepIndex(i);
        apply(step);
        setBusy(false);
        setWaitLabel(null);

        if (step.end) return;

        // "Choose zones: ON" turns the auto-answered SelectZone back into a real question.
        const suppressAuto = chooseZones && step.decision?.kind === "SelectZone";
        if (step.autoResolved && !suppressAuto) {
          setAutoReceipt(step.autoResolved);
          // Hold the RECEIPT (read-only, no primary button) long enough to read when
          // the reviewer has asked to see auto-answered steps; otherwise blink past.
          const hold = revealAuto ? 2200 : 240;
          later(() => {
            setAutoReceipt(null);
            goTo(i + 1);
          }, hold);
          return;
        }
        if (step.decision === null) {
          later(() => goTo(i + 1), 220);
        }
      }, latency);
    },
    [apply, revealAuto, chooseZones],
  );

  const reset = useCallback(() => {
    clearTimers();
    eventId.current = 0;
    endedRef.current = false;
    trackRef.current = scenario.steps;
    setTrack(scenario.steps);
    setStepIndex(0);
    setApplied(scenario.steps[0]);
    setLog(scenario.seedLog?.map((e) => ({ ...e, id: eventId.current++ })) ?? []);
    setBusy(false);
    setWaitLabel(null);
    setAutoReceipt(null);
    setChain([]);
    setAutoPush(null);
    setBoardOverride(null);
    patchesRef.current = [];
    setEnd(null);
    setMyClock(scenario.steps[0].myClockSeconds ?? MY_START);
    setOppClock(scenario.steps[0].oppClockSeconds ?? OPP_START);
    setOnClockSeat(scenario.steps[0].onClockSeat ?? 0);
    // ← B5: step 0 is PRESENTED, not merely assigned. A scenario that opens on a
    //   wait beat now advances instead of hanging forever.
    goTo(0, scenario.steps);
  }, [scenario, goTo]);

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

  /** Confirm / proceed. */
  const answer = useCallback(
    (selection?: CardRef[]) => {
      const step = trackRef.current[stepIndex];
      // B3/M4: honour what the player actually picked, from here to the end.
      if (step?.applySelection && selection?.length) {
        const fn = step.applySelection;
        const sel = selection.slice();
        patchesRef.current = [...patchesRef.current, (st) => fn(st, sel)];
      }
      goTo(stepIndex + 1);
    },
    [goTo, stepIndex],
  );

  /** Decline / cancel. NEVER the same thing as answer(). */
  const decline = useCallback(() => {
    const step = trackRef.current[stepIndex];
    if (step?.declineBranch) {
      goTo(0, step.declineBranch);
      return;
    }
    // No branch scripted: a cancel returns to the top of the scenario, which is the
    // honest fixture equivalent of "nothing was consumed".
    reset();
  }, [goTo, stepIndex, reset]);

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
    state: boardOverride ?? applied.state,
    intent: applied.intent ?? null,
    chain,
    log,
    mode,
    busy,
    // Keep the step's own label while a wait beat is ON SCREEN, not only while it is
    // being fetched — otherwise a labelled gap degrades to the generic string.
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

  return { view, answer, decline, reset, setAutoPush, forfeit: () => answer() };
}
