/**
 * The scripted "engine" behind the prototype.
 *
 * FAKED: data, persistence, auth, concurrency, network failure.
 * REAL:  interaction, sequencing, round-trip latency, mode switching, states.
 *
 * It walks a Scenario's Steps. Presenting a step costs `latencyMs` — that is the
 * WebSocket round trip, and it is the gap the Intent Ribbon exists to survive.
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
  autoFlash: string | null;
  clockSeconds: number;
  onClockSeat: Seat;
  highlight: CardRef[];
  autoPush: number | null;
  end: { winner: Seat | null; reason: string } | null;
  note: string | null;
}

export function useProtoEngine(scenario: Scenario, revealAuto: boolean, chooseZones = false) {
  const [stepIndex, setStepIndex] = useState(0);
  const [applied, setApplied] = useState<Step>(scenario.steps[0]);
  const [log, setLog] = useState<DuelEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [waitLabel, setWaitLabel] = useState<string | null>(null);
  const [autoFlash, setAutoFlash] = useState<string | null>(null);
  const [clockSeconds, setClockSeconds] = useState(scenario.steps[0].clockSeconds ?? 300);
  const [onClockSeat, setOnClockSeat] = useState<Seat>(scenario.steps[0].onClockSeat ?? 0);
  const [end, setEnd] = useState<{ winner: Seat | null; reason: string } | null>(null);
  const [autoPush, setAutoPush] = useState<number | null>(null);
  const [chain, setChain] = useState<ChainLink[]>([]);
  const timers = useRef<number[]>([]);
  const eventId = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const reset = useCallback(() => {
    clearTimers();
    eventId.current = 0;
    setStepIndex(0);
    setApplied(scenario.steps[0]);
    setLog([]);
    setBusy(false);
    setWaitLabel(null);
    setAutoFlash(null);
    setChain([]);
    setAutoPush(null);
    setEnd(null);
    setClockSeconds(scenario.steps[0].clockSeconds ?? 300);
    setOnClockSeat(scenario.steps[0].onClockSeat ?? 0);
  }, [scenario]);

  useEffect(() => {
    reset();
    return clearTimers;
  }, [reset]);

  // Server-authoritative clock: the badge ticks locally, purely for display.
  useEffect(() => {
    const t = window.setInterval(() => setClockSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, []);

  const apply = useCallback((step: Step) => {
    setApplied(step);
    if (step.chain) setChain(step.chain);
    if (step.autoPush) setAutoPush(step.autoPush);
    if (step.clockSeconds !== undefined) setClockSeconds(step.clockSeconds);
    if (step.onClockSeat !== undefined) setOnClockSeat(step.onClockSeat);
    if (step.events?.length) {
      setLog((prev) => [...prev, ...step.events!.map((e) => ({ ...e, id: eventId.current++ }))]);
    }
    if (step.end) setEnd(step.end);
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const steps = scenario.steps;
      if (i >= steps.length) {
        // loop back to the top of the scenario rather than dead-ending
        reset();
        return;
      }
      const step = steps[i];
      const latency = step.latencyMs ?? 120;
      setBusy(true);
      setWaitLabel(step.waitLabel ?? null);
      later(() => {
        setStepIndex(i);
        apply(step);
        setBusy(false);
        setWaitLabel(null);

        if (step.end) return;

        // "Choose zones" ON turns the auto-answered SelectZone back into a real question.
        const suppressAuto = chooseZones && step.decision?.kind === "SelectZone";
        if (step.autoResolved && !suppressAuto) {
          setAutoFlash(step.autoResolved);
          const hold = revealAuto ? 1900 : 260;
          later(() => {
            setAutoFlash(null);
            goTo(i + 1);
          }, hold);
          return;
        }
        if (step.decision === null) {
          later(() => goTo(i + 1), 250);
        }
      }, latency);
    },
    [scenario, apply, reset, revealAuto, chooseZones],
  );

  const answer = useCallback(() => {
    goTo(stepIndex + 1);
  }, [goTo, stepIndex]);

  const mode: Mode = end
    ? "ended"
    : busy
      ? waitLabel
        ? "waiting"
        : "resolving"
      : applied.decision === null
        ? "waiting"
        : applied.decision.kind === "IdleCommand" || applied.decision.kind === "BattleCommand"
          ? "act"
          : "answer";

  const view: EngineView = {
    step: applied,
    stepIndex,
    total: scenario.steps.length,
    state: applied.state,
    intent: applied.intent ?? null,
    chain,
    log,
    mode,
    busy,
    waitLabel,
    autoFlash,
    clockSeconds,
    onClockSeat,
    highlight: applied.highlight ?? [],
    autoPush,
    end,
    note: applied.note ?? null,
  };

  return { view, answer, reset, setAutoPush };
}
