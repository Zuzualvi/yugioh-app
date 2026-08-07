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
  DuelDecision,
  DuelDecisionResponse,
} from "@yugioh-app/contracts";
import type { DuelEngine, RawEngineMessage, EngineStepResult } from "./engineInterface.js";

export interface FakeStep {
  status: "waiting" | "continue" | "ended";
  messages: RawEngineMessage[];
  events?: RawEngineMessage[];
  awaiting?: { seat: Seat };
  /** Typed decision returned by getDecisionForSeat(awaiting.seat) for this step. */
  decision?: DuelDecision | null;
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
    p0_mzone: [null, null, null, null, null],
    p1_mzone: [null, null, null, null, null],
    p0_szone: [null, null, null, null, null],
    p1_szone: [null, null, null, null, null],
    p0_fzone: null,
    p1_fzone: null,
    p0_grave: [],
    p1_grave: [],
    p0_removed: [],
    p1_removed: [],
    p0_extra: [],
    p1_extra: [],
    p0_deckCount: 0,
    p1_deckCount: 0,
  },
};

export class FakeEdisonDuel implements DuelEngine {
  private steps: FakeStep[];
  private stepIndex = 0;
  /** @deprecated kept for dormant RESPONSE path compat */
  private legacyResponses: EngineResponse[] = [];
  private decisionResponses: DuelDecisionResponse[] = [];
  private _ended = false;
  private _winner: Seat | null = null;
  private _destroyed = false;
  private lastPendingMessages: RawEngineMessage[] = [];
  private currentWaitingStep: FakeStep | null = null;
  /** Scripted result for the next applyDecisionResponse call; resets to ok:true after use. */
  private nextDecisionResponseResult: { ok: true } | { ok: false; error: string } = { ok: true };

  constructor(steps: FakeStep[]) {
    this.steps = steps;
  }

  step(): EngineStepResult {
    const s = this.steps[this.stepIndex];
    if (!s) {
      this.currentWaitingStep = null;
      this.lastPendingMessages = [];
      return { status: "ended", messages: [], events: [] };
    }
    this.stepIndex++;
    if (s.status === "ended") {
      this._ended = true;
      this.currentWaitingStep = null;
      this.lastPendingMessages = [];
    } else if (s.status === "waiting") {
      this.currentWaitingStep = s;
      this.lastPendingMessages = s.messages;
    } else {
      this.currentWaitingStep = null;
    }
    return { ...s, events: s.events ?? [] };
  }

  /** @deprecated dormant in Phase 1 */
  respond(response: EngineResponse): void {
    this.legacyResponses.push(response);
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

  /** @deprecated dormant in Phase 1 */
  getPendingMessages(): RawEngineMessage[] {
    return [...this.lastPendingMessages];
  }

  isEnded(): boolean {
    return this._ended;
  }

  getResult(): { winner: Seat | null; reason: string } | null {
    if (!this._ended) return null;
    return { winner: this._winner, reason: "normal" };
  }

  // ── Phase 1 typed decision API ─────────────────────────────────────────────

  getDecisionForSeat(seat: Seat): DuelDecision | null {
    if (!this.currentWaitingStep || this.currentWaitingStep.awaiting?.seat !== seat) return null;
    return this.currentWaitingStep.decision ?? null;
  }

  applyDecisionResponse(resp: DuelDecisionResponse): { ok: true } | { ok: false; error: string } {
    const result = this.nextDecisionResponseResult;
    this.nextDecisionResponseResult = { ok: true }; // reset for next call
    if (result.ok) {
      this.decisionResponses.push(resp);
    }
    return result;
  }

  getResponseLog(): DuelDecisionResponse[] {
    return [...this.decisionResponses];
  }

  async applyLog(log: DuelDecisionResponse[]): Promise<void> {
    for (const resp of log) {
      const result = this.step();
      if (result.status !== "waiting") break;
      this.applyDecisionResponse(resp);
    }
    if (!this._ended) this.step();
  }

  destroy(): void {
    this._destroyed = true;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  /** Force-end the duel (used to simulate timeout/resign in tests). */
  forceEnd(winner: Seat | null): void {
    this._ended = true;
    this._winner = winner;
  }

  /** Script the result for the next applyDecisionResponse call. */
  setNextDecisionResponseResult(result: { ok: true } | { ok: false; error: string }): void {
    this.nextDecisionResponseResult = result;
  }

  /** Factory: builds a FakeEdisonDuel factory for injection. */
  static factory(stepsPerDuel: FakeStep[]): () => FakeEdisonDuel {
    return () => new FakeEdisonDuel([...stepsPerDuel]);
  }
}
