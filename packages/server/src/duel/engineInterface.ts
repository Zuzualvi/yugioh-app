// ---------------------------------------------------------------------------
// DuelEngine — interface the server codes against.
// Lets tests inject FakeEdisonDuel without touching the real WASM engine.
// ---------------------------------------------------------------------------

import type {
  Seat,
  DuelStateSnapshot,
  EngineResponse,
  RedactedEngineMessage,
  DuelDecision,
  DuelDecisionResponse,
} from "@yugioh-app/contracts";
import type { RawEngineMessage, EngineStepResult } from "@yugioh-app/engine";

export type { EngineStepResult, RawEngineMessage };

export interface DuelEngine {
  step(): EngineStepResult;
  /** @deprecated — dormant in Phase 1, removed in Phase 2. Use applyDecisionResponse instead. */
  respond(response: EngineResponse): void;
  redactMessageForSeat(msg: RawEngineMessage, seat: Seat): RedactedEngineMessage | null;
  /** @deprecated — dormant in Phase 1. Decision delivery is now via getDecisionForSeat. */
  getPendingMessages(): RawEngineMessage[];
  getStateForSeat(seat: Seat): DuelStateSnapshot;
  isEnded(): boolean;
  getResult(): { winner: Seat | null; reason: string } | null;

  // ── Phase 1 typed decision API ────────────────────────────────────────────
  /** Returns the pending typed decision for the given seat, or null if that seat is not on the clock. */
  getDecisionForSeat(seat: Seat): DuelDecision | null;
  /** Validates and applies the response; does NOT call step(). Returns ok or an error string. */
  applyDecisionResponse(resp: DuelDecisionResponse): { ok: true } | { ok: false; error: string };
  /** Returns the persisted response log (DuelDecisionResponse[]). */
  getResponseLog(): DuelDecisionResponse[];
  /** Replays a persisted log to restore engine state after restart. */
  applyLog(log: DuelDecisionResponse[]): void | Promise<void>;

  destroy(): void;
}

export interface DeckLists {
  main: number[];
  extra: number[];
}

export type DuelEngineFactory = (opts: {
  seed: bigint;
  deck0: DeckLists;
  deck1: DeckLists;
}) => Promise<DuelEngine>;

export type DuelEngineReplay = (
  seed: bigint,
  deck0: DeckLists,
  deck1: DeckLists,
  log: DuelDecisionResponse[],
) => Promise<DuelEngine>;
