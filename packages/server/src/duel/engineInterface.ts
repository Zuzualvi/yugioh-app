// ---------------------------------------------------------------------------
// DuelEngine — interface the server codes against.
// Lets tests inject FakeEdisonDuel without touching the real WASM engine.
// ---------------------------------------------------------------------------

import type {
  Seat,
  DuelStateSnapshot,
  EngineResponse,
  RedactedEngineMessage,
} from "@yugioh-app/contracts";
import type { RawEngineMessage, EngineStepResult } from "@yugioh-app/engine";

export type { EngineStepResult, RawEngineMessage };

export interface DuelEngine {
  step(): EngineStepResult;
  respond(response: EngineResponse): void;
  redactMessageForSeat(msg: RawEngineMessage, seat: Seat): RedactedEngineMessage | null;
  getStateForSeat(seat: Seat): DuelStateSnapshot;
  isEnded(): boolean;
  getResult(): { winner: Seat | null; reason: string } | null;
  getResponseLog(): EngineResponse[];
  applyLog(log: EngineResponse[]): Promise<void>;
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
  log: EngineResponse[],
) => Promise<DuelEngine>;
