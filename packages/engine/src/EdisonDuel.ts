// ---------------------------------------------------------------------------
// EdisonDuel — the deterministic, server-side Edison duel object.
//
// Wraps an ocgcore-wasm sync duel handle. All state mutations happen
// synchronously inside step() and respond(). Determinism is preserved by:
//   • Fixed seed (BigInt) passed to createDuel
//   • Fixed EDISON_FLAGS
//   • Logged response sequence replayed identically on restart (spike-d)
// ---------------------------------------------------------------------------

import type {
  Seat,
  DuelStateSnapshot,
  EngineResponse,
  RedactedEngineMessage,
  DuelDecision,
  DuelDecisionResponse,
} from "@yugioh-app/contracts";
import type { OcgCoreSync, OcgDuelHandle } from "ocgcore-wasm";
import { OcgProcessResult, OcgResponseType } from "ocgcore-wasm";
import type { RawEngineMessage } from "./types.js";
import { redactMessageForSeat } from "./redactMessage.js";
import { buildStateForSeat, type DuelPhaseInfo } from "./buildStateForSeat.js";
import { messageToDecision } from "./decision/messageToDecision.js";
import { responseToOcgResponse } from "./decision/responseToOcgResponse.js";
import { validateDecisionResponse } from "./decision/validateDecisionResponse.js";

export interface DeckLists {
  main: number[];
  extra: number[];
}

export interface EngineStepResult {
  status: "waiting" | "continue" | "ended";
  /** Decision/routing messages from the terminal process step (WAITING or END). */
  messages: RawEngineMessage[];
  /** Broadcast/event messages from intermediate CONTINUE steps (draws, moves, etc.). */
  events: RawEngineMessage[];
  awaiting?: { seat: Seat };
}

export interface CreateEdisonDuelOpts {
  seed: bigint | number;
  deck0: DeckLists;
  deck1: DeckLists;
}

/** Name map for human-readable message names (best-effort). */
const MSG_NAMES: Record<number, string> = {
  1: "HINT",
  2: "PLAYER_HINT",
  3: "CARD_HINT",
  10: "SELECT_BATTLECMD",
  11: "SELECT_IDLECMD",
  12: "SELECT_EFFECTYN",
  13: "SELECT_YESNO",
  14: "SELECT_OPTION",
  15: "SELECT_CARD",
  16: "SELECT_CHAIN",
  18: "SELECT_PLACE",
  19: "SELECT_POSITION",
  20: "SELECT_TRIBUTE",
  21: "SORT_CHAIN",
  22: "SELECT_COUNTER",
  23: "SELECT_SUM",
  24: "SELECT_DISFIELD",
  25: "SORT_CARD",
  26: "SELECT_UNSELECT_CARD",
  30: "CONFIRM_DECKTOP",
  40: "NEW_TURN",
  41: "NEW_PHASE",
  50: "MOVE",
  54: "SET",
  60: "SHUFFLE_HAND",
  67: "SHUFFLE_SET_CARD",
  80: "CARD_SELECTED",
  81: "RANDOM_SELECTED",
  83: "BECOME_TARGET",
  85: "DECK_TOP",
  86: "CONFIRM_EXTRATOP",
  90: "DRAW",
  91: "DAMAGE",
  92: "RECOVER",
  100: "WIN",
  132: "ROCK_PAPER_SCISSORS",
  133: "HAND_RES",
  140: "ANNOUNCE_RACE",
  141: "ANNOUNCE_ATTRIB",
  142: "ANNOUNCE_CARD",
  143: "ANNOUNCE_NUMBER",
};

/** Decision message types that require an OcgResponse. */
const DECISION_MSG_TYPES = new Set([
  10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 140, 141, 142, 143,
]);

export class EdisonDuel {
  private lib: OcgCoreSync | null;
  private readonly handle: OcgDuelHandle;
  /** Phase 1: typed DuelDecisionResponse log (replaces old EngineResponse log). */
  private readonly decisionResponseLog: DuelDecisionResponse[] = [];
  /** @deprecated dormant in Phase 1; kept for old respond() call compat. */
  private readonly legacyResponseLog: EngineResponse[] = [];
  private ended = false;
  private destroyed = false;
  private winner: Seat | null = null;
  /** Decision messages from the most recent WAITING step. */
  private lastPendingMessages: RawEngineMessage[] = [];
  /** The typed pending decision computed from lastPendingMessages, with the on-clock seat. */
  private pendingDecision: { seat: Seat; decision: DuelDecision } | null = null;
  private phaseInfo: DuelPhaseInfo = {
    currentTurn: 0,
    currentPhase: 0,
    lp: [8000, 8000],
    duelEnded: false,
  };

  constructor(lib: OcgCoreSync, handle: OcgDuelHandle) {
    this.lib = lib;
    this.handle = handle;
  }

  private getLib(): OcgCoreSync {
    if (!this.lib) throw new Error("EdisonDuel: core already released (internal error)");
    return this.lib;
  }

  /**
   * Release the duel handle back to ocgcore, freeing native heap memory.
   * Must be called when a duel is no longer needed; omitting it leaks WASM
   * memory and eventually corrupts the shared core heap (OOB crash).
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.lib!.destroyDuel(this.handle);
    // Drop the core reference so this duel's isolated WASM instance can be GC'd.
    this.lib = null;
  }

  /**
   * Advance the engine until the next WAITING decision or END.
   *
   * Auto-behaviors (transparent to callers):
   *   • SELECT_CHAIN with empty selects AND not forced → auto-pass (never surfaced).
   *   • RockPaperScissors (132) → auto-respond with value=1 (never surfaced).
   *
   * - `messages`: decision/routing messages from the terminal process step
   *   (SELECT_CHAIN, SELECT_IDLECMD, etc.). These are player-targeted and are
   *   null for the non-targeted seat via redactMessageForSeat().
   * - `events`: broadcast messages from intermediate CONTINUE steps
   *   (DRAW, MOVE, NEW_TURN, etc.). These carry public state and must be
   *   stripped of hidden codes via redactMessageForSeat() before forwarding.
   */
  step(): EngineStepResult {
    if (this.destroyed) throw new Error("EdisonDuel.step() called after destroy()");
    const lib = this.getLib();
    const events: RawEngineMessage[] = [];
    const messages: RawEngineMessage[] = [];

    while (true) {
      const result = lib.duelProcess(this.handle);

      // Collect messages from this processing step
      const msgs = lib.duelGetMessage(this.handle) as unknown[];
      const isFinal = result === OcgProcessResult.END || result === OcgProcessResult.WAITING;
      for (const m of msgs) {
        if (m == null) continue;
        const raw = m as Record<string, unknown>;
        const rawMsg: RawEngineMessage = {
          type: raw["type"] as number,
          name: raw["type"] != null ? (MSG_NAMES[raw["type"] as number] ?? "UNKNOWN") : "UNKNOWN",
          player: raw["player"] as 0 | 1 | undefined,
          ...raw,
        };
        this.updatePhaseFromMessage(rawMsg);
        if (isFinal) {
          messages.push(rawMsg);
        } else {
          events.push(rawMsg);
        }
      }

      if (result === OcgProcessResult.END) {
        this.ended = true;
        this.phaseInfo = { ...this.phaseInfo, duelEnded: true };
        this.lastPendingMessages = [];
        this.pendingDecision = null;
        return { status: "ended", messages, events };
      }

      if (result === OcgProcessResult.WAITING) {
        // ── Auto-resolve RockPaperScissors ─────────────────────────────
        const rpsMsg = messages.find((m) => m.type === 132);
        if (rpsMsg) {
          lib.duelSetResponse(this.handle, {
            type: OcgResponseType.ROCK_PAPER_SCISSORS,
            value: 1,
          });
          messages.length = 0; // clear — continue stepping
          continue;
        }

        // ── Auto-pass empty optional chain window ───────────────────────
        const chainMsg = messages.find((m) => m.type === 16);
        if (
          chainMsg &&
          !(chainMsg["forced"] as boolean) &&
          ((chainMsg["selects"] as unknown[]) ?? []).length === 0
        ) {
          lib.duelSetResponse(this.handle, {
            type: OcgResponseType.SELECT_CHAIN,
            index: null,
          });
          messages.length = 0;
          continue;
        }

        // ── Real WAITING decision — compute typed DuelDecision ──────────
        const awaitingSeat = this.findAwaitingSeat(messages);
        this.lastPendingMessages = messages;

        if (awaitingSeat !== null) {
          try {
            const decision = messageToDecision(messages, awaitingSeat);
            this.pendingDecision = { seat: awaitingSeat, decision };
          } catch {
            // messageToDecision threw (e.g., unknown type) — clear pending
            this.pendingDecision = null;
          }
        } else {
          this.pendingDecision = null;
        }

        return {
          status: "waiting",
          messages,
          events,
          awaiting: awaitingSeat !== null ? { seat: awaitingSeat } : undefined,
        };
      }

      // CONTINUE — keep stepping
    }
  }

  // ── Phase 1 typed decision API ───────────────────────────────────────────

  /**
   * Returns the pending typed DuelDecision for the given seat, or null if that
   * seat is not on the clock or there is no pending decision.
   */
  getDecisionForSeat(seat: Seat): DuelDecision | null {
    if (this.destroyed) throw new Error("EdisonDuel.getDecisionForSeat() called after destroy()");
    if (!this.pendingDecision || this.pendingDecision.seat !== seat) return null;
    return this.pendingDecision.decision;
  }

  /**
   * Validate and apply the player's response to the current pending decision.
   * Does NOT advance the engine — caller must call step() after ok:true.
   *
   * On ok: converts to OcgResponse, feeds ocgcore, records in response log.
   * On !ok: returns a human error string and does NOT mutate the engine.
   */
  applyDecisionResponse(resp: DuelDecisionResponse): { ok: true } | { ok: false; error: string } {
    if (this.destroyed)
      throw new Error("EdisonDuel.applyDecisionResponse() called after destroy()");

    if (!this.pendingDecision) {
      return { ok: false, error: "No pending decision to respond to" };
    }

    const validation = validateDecisionResponse(resp, this.pendingDecision.decision);
    if (!validation.ok) return validation;

    let ocgResp;
    try {
      ocgResp = responseToOcgResponse(resp, this.pendingDecision.decision);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Response conversion failed",
      };
    }

    this.getLib().duelSetResponse(this.handle, ocgResp);
    this.decisionResponseLog.push(resp);
    this.pendingDecision = null;
    return { ok: true };
  }

  /**
   * Returns the persisted typed response log (DuelDecisionResponse[]).
   * Used for persistence and replay.
   */
  getResponseLog(): DuelDecisionResponse[] {
    return [...this.decisionResponseLog];
  }

  /**
   * Replay a persisted response log to restore engine state after restart.
   * Steps to each WAITING, then applies the stored response; deterministic.
   */
  applyLog(log: DuelDecisionResponse[]): void {
    for (const resp of log) {
      const result = this.step();
      if (result.status !== "waiting") break;
      const applyResult = this.applyDecisionResponse(resp);
      if (!applyResult.ok) break; // corrupt log — stop
    }
  }

  // ── Legacy API (dormant in Phase 1) ─────────────────────────────────────

  /**
   * @deprecated Phase 1: use applyDecisionResponse() instead.
   * Kept for backward compat with old RESPONSE frame path (dormant).
   * Feed the on-clock seat's response to the engine.
   */
  respond(response: EngineResponse): void {
    if (this.destroyed) throw new Error("EdisonDuel.respond() called after destroy()");
    this.legacyResponseLog.push(response);
    this.getLib().duelSetResponse(
      this.handle,
      response as Parameters<OcgCoreSync["duelSetResponse"]>[1],
    );
  }

  /** Redact a raw message for the given seat (null = not entitled). */
  redactMessageForSeat(msg: RawEngineMessage, seat: Seat): RedactedEngineMessage | null {
    return redactMessageForSeat(msg, seat);
  }

  /**
   * @deprecated Phase 1: use getDecisionForSeat() instead.
   * The decision message(s) the engine is currently awaiting a response to.
   */
  getPendingMessages(): RawEngineMessage[] {
    return [...this.lastPendingMessages];
  }

  /** Build a per-seat DuelStateSnapshot with hidden codes zeroed. */
  getStateForSeat(seat: Seat): DuelStateSnapshot {
    return buildStateForSeat(this.getLib(), this.handle, seat, this.phaseInfo);
  }

  isEnded(): boolean {
    return this.ended;
  }

  getResult(): { winner: Seat | null; reason: "normal" } | null {
    if (!this.ended) return null;
    return { winner: this.winner, reason: "normal" };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private updatePhaseFromMessage(msg: RawEngineMessage): void {
    const { type } = msg;
    if (type === 91 /* DAMAGE */ || type === 92 /* RECOVER */) {
      const player = msg["player"] as 0 | 1 | undefined;
      // ocgcore-wasm emits "amount" for DAMAGE/RECOVER, not "val".
      const val = (msg["amount"] as number | undefined) ?? (msg["val"] as number | undefined);
      if (player !== undefined && val !== undefined) {
        const lp = [...this.phaseInfo.lp] as [number, number];
        if (type === 91) lp[player] = Math.max(0, lp[player]! - val);
        else lp[player] = lp[player]! + val;
        this.phaseInfo = { ...this.phaseInfo, lp };
      }
    }
    if (type === 100 /* WIN */) {
      const player = msg["player"] as 0 | 1 | undefined;
      this.winner = player ?? null;
    }
  }

  private findAwaitingSeat(messages: RawEngineMessage[]): Seat | null {
    // Scan from the end to find the last decision message with a player field.
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (DECISION_MSG_TYPES.has(m.type) && (m.player === 0 || m.player === 1)) {
        return m.player;
      }
    }
    // Fallback: any message with player field
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.player === 0 || m.player === 1) return m.player;
    }
    return null;
  }
}
