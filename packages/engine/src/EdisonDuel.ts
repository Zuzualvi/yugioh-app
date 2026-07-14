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
} from "@yugioh-app/contracts";
import type { OcgCoreSync, OcgDuelHandle } from "ocgcore-wasm";
import { OcgProcessResult } from "ocgcore-wasm";
import type { RawEngineMessage } from "./types.js";
import { redactMessageForSeat } from "./redactMessage.js";
import { buildStateForSeat, type DuelPhaseInfo } from "./buildStateForSeat.js";

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
  30: "ROCK_PAPER_SCISSORS",
  31: "ANNOUNCE_RACE",
  32: "ANNOUNCE_ATTRIB",
  33: "ANNOUNCE_CARD",
  34: "ANNOUNCE_NUMBER",
  40: "SUMMONED",
  41: "SPSUMMONED",
  42: "FLIPSUMMONED",
  43: "FLIPSUMMONING",
  50: "MOVE",
  54: "SET",
  60: "SHUFFLE_HAND",
  67: "SHUFFLE_SET_CARD",
  80: "SHOW_HINT",
  81: "CONFIRM_DECKTOP",
  83: "CONFIRM_CARDS",
  85: "DECK_TOP",
  86: "CONFIRM_EXTRATOP",
  90: "DRAW",
  91: "DAMAGE",
  92: "RECOVER",
  100: "WIN",
};

export class EdisonDuel {
  private readonly lib: OcgCoreSync;
  private readonly handle: OcgDuelHandle;
  private readonly responseLog: EngineResponse[] = [];
  private ended = false;
  private winner: Seat | null = null;
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

  /**
   * Advance the engine until the next WAITING decision or END.
   *
   * - `messages`: decision/routing messages from the terminal process step
   *   (SELECT_CHAIN, SELECT_IDLECMD, etc.). These are player-targeted and are
   *   null for the non-targeted seat via redactMessageForSeat().
   * - `events`: broadcast messages from intermediate CONTINUE steps
   *   (DRAW, MOVE, NEW_TURN, etc.). These carry public state and must be
   *   stripped of hidden codes via redactMessageForSeat() before forwarding.
   */
  step(): EngineStepResult {
    const events: RawEngineMessage[] = [];
    const messages: RawEngineMessage[] = [];

    while (true) {
      const result = this.lib.duelProcess(this.handle);

      // Collect messages from this processing step
      const msgs = this.lib.duelGetMessage(this.handle) as unknown[];
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
        // Decision/terminal messages go into messages; broadcast goes into events
        if (isFinal) {
          messages.push(rawMsg);
        } else {
          events.push(rawMsg);
        }
      }

      if (result === OcgProcessResult.END) {
        this.ended = true;
        this.phaseInfo = { ...this.phaseInfo, duelEnded: true };
        return { status: "ended", messages, events };
      }

      if (result === OcgProcessResult.WAITING) {
        // Determine which seat is on the clock (has the awaiting decision)
        const awaitingSeat = this.findAwaitingSeat(messages);
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

  /** Feed the on-clock seat's response to the engine. */
  respond(response: EngineResponse): void {
    this.responseLog.push(response);
    this.lib.duelSetResponse(
      this.handle,
      response as Parameters<OcgCoreSync["duelSetResponse"]>[1],
    );
  }

  /** Redact a raw message for the given seat (null = not entitled). */
  redactMessageForSeat(msg: RawEngineMessage, seat: Seat): RedactedEngineMessage | null {
    return redactMessageForSeat(msg, seat);
  }

  /** Build a per-seat DuelStateSnapshot with hidden codes zeroed. */
  getStateForSeat(seat: Seat): DuelStateSnapshot {
    return buildStateForSeat(this.lib, this.handle, seat, this.phaseInfo);
  }

  isEnded(): boolean {
    return this.ended;
  }

  getResult(): { winner: Seat | null; reason: "normal" } | null {
    if (!this.ended) return null;
    return { winner: this.winner, reason: "normal" };
  }

  getResponseLog(): EngineResponse[] {
    return [...this.responseLog];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private updatePhaseFromMessage(msg: RawEngineMessage): void {
    const { type } = msg;
    // Track LP changes
    if (type === 91 /* DAMAGE */ || type === 92 /* RECOVER */) {
      const player = msg["player"] as 0 | 1 | undefined;
      const val = msg["val"] as number | undefined;
      if (player !== undefined && val !== undefined) {
        const lp = [...this.phaseInfo.lp] as [number, number];
        if (type === 91) lp[player] = Math.max(0, lp[player]! - val);
        else lp[player] = lp[player]! + val;
        this.phaseInfo = { ...this.phaseInfo, lp };
      }
    }
    // Track WIN
    if (type === 100 /* WIN */) {
      const player = msg["player"] as 0 | 1 | undefined;
      this.winner = player ?? null;
    }
  }

  private findAwaitingSeat(messages: RawEngineMessage[]): Seat | null {
    // Last decision message determines which seat is awaiting
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.player === 0 || m.player === 1) return m.player;
    }
    return null;
  }

  /**
   * Apply a response log to this duel (for resume after restart).
   * Steps until each WAITING, then feeds the stored response.
   */
  async applyLog(log: EngineResponse[]): Promise<void> {
    for (const response of log) {
      const result = this.step();
      if (result.status !== "waiting") break;
      this.respond(response);
    }
    // Step to stable boundary after last response
    if (!this.ended) {
      this.step();
    }
  }
}
