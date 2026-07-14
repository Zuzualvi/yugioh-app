// ---------------------------------------------------------------------------
// FakeEdisonDuel — scripted stub implementing DuelEngine for unit tests.
//
// Does NOT import or instantiate the real engine (no WASM needed).
// Callers script the step() results and state snapshots up-front.
// ---------------------------------------------------------------------------

import type {
  Seat,
  DuelStateSnapshot,
  EngineResponse,
  RedactedEngineMessage,
} from "@yugioh-app/contracts";
import type { DuelEngine, RawEngineMessage, EngineStepResult } from "./engineInterface.js";

export interface FakeStep {
  status: "waiting" | "continue" | "ended";
  messages: RawEngineMessage[];
  awaiting?: { seat: Seat };
}

const EMPTY_STATE: DuelStateSnapshot = {
  seat: 0,
  duelEnded: false,
  currentTurn: 0,
  currentPhase: 0,
  lp: [8000, 8000],
  zones: {
    p0_hand: [],
    p1_hand: [],
    p0_mzone: [],
    p1_mzone: [],
    p0_szone: [],
    p1_szone: [],
    p0_grave: [],
    p1_grave: [],
    p0_removed: [],
    p1_removed: [],
    p0_extra: [],
    p1_extra: [],
  },
};

export class FakeEdisonDuel implements DuelEngine {
  private steps: FakeStep[];
  private stepIndex = 0;
  private responses: EngineResponse[] = [];
  private _ended = false;
  private _winner: Seat | null = null;

  constructor(steps: FakeStep[]) {
    this.steps = steps;
  }

  step(): EngineStepResult {
    const s = this.steps[this.stepIndex];
    if (!s) return { status: "ended", messages: [] };
    this.stepIndex++;
    if (s.status === "ended") {
      this._ended = true;
    }
    return s;
  }

  respond(response: EngineResponse): void {
    this.responses.push(response);
  }

  redactMessageForSeat(msg: RawEngineMessage, seat: Seat): RedactedEngineMessage | null {
    // Seat-specific messages route only to the entitled seat; others broadcast.
    if (msg.player !== undefined && msg.player !== seat) return null;
    const name = typeof msg["name"] === "string" ? msg["name"] : "UNKNOWN";
    return { name, engineType: msg.type, player: msg.player };
  }

  getStateForSeat(seat: Seat): DuelStateSnapshot {
    return { ...EMPTY_STATE, seat };
  }

  isEnded(): boolean {
    return this._ended;
  }

  getResult(): { winner: Seat | null; reason: string } | null {
    if (!this._ended) return null;
    return { winner: this._winner, reason: "normal" };
  }

  getResponseLog(): EngineResponse[] {
    return [...this.responses];
  }

  async applyLog(log: EngineResponse[]): Promise<void> {
    for (const response of log) {
      const result = this.step();
      if (result.status !== "waiting") break;
      this.respond(response);
    }
    if (!this._ended) this.step();
  }

  /** Force-end the duel (used to simulate timeout/resign in tests). */
  forceEnd(winner: Seat | null): void {
    this._ended = true;
    this._winner = winner;
  }

  /** Factory: builds a FakeEdisonDuel factory for injection. */
  static factory(stepsPerDuel: FakeStep[]): () => FakeEdisonDuel {
    return () => new FakeEdisonDuel([...stepsPerDuel]);
  }
}
