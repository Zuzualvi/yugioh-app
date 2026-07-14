// ---------------------------------------------------------------------------
// duelManager — in-memory registry of live DuelEngine instances.
//
// On cache-miss (process restart), rehydrates from the response_log via replay.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import type { DuelEngine, DuelEngineFactory, DuelEngineReplay } from "./engineInterface.js";
import { getDuel, getResponseLog } from "./duelStore.js";

interface LiveDuel {
  engine: DuelEngine;
  /** Next response_log seq to use (= current log length). */
  nextSeq: number;
}

export class DuelManager {
  private readonly live = new Map<string, LiveDuel>();
  private readonly factory: DuelEngineFactory;
  private readonly replay: DuelEngineReplay;

  constructor(factory: DuelEngineFactory, replay: DuelEngineReplay) {
    this.factory = factory;
    this.replay = replay;
  }

  /** Register a freshly-created engine for a duel (called at join time). */
  register(duelId: string, engine: DuelEngine): void {
    this.live.set(duelId, { engine, nextSeq: 0 });
  }

  /**
   * Get the live engine for a duel, rehydrating from DB if necessary.
   * Returns undefined if the duel does not exist in DB or is not active.
   */
  async getOrRehydrate(
    db: InstanceType<typeof Database>,
    duelId: string,
  ): Promise<LiveDuel | undefined> {
    const cached = this.live.get(duelId);
    if (cached) return cached;

    const row = getDuel(db, duelId);
    if (!row || row.status !== "active" || !row.deck1_json) return undefined;

    const seed = BigInt(JSON.parse(row.seed_json) as string);
    const deck0 = JSON.parse(row.deck0_json) as { main: number[]; extra: number[] };
    const deck1 = JSON.parse(row.deck1_json) as { main: number[]; extra: number[] };
    const log = getResponseLog(db, duelId);

    const engine = await this.replay(seed, deck0, deck1, log);
    const live: LiveDuel = { engine, nextSeq: log.length };
    this.live.set(duelId, live);
    return live;
  }

  /**
   * Create and start a new engine (at join time).
   * Steps to first WAITING boundary, registers in the live map.
   */
  async createAndStart(
    duelId: string,
    seed: bigint,
    deck0: { main: number[]; extra: number[] },
    deck1: { main: number[]; extra: number[] },
  ): Promise<DuelEngine> {
    const engine = await this.factory({ seed, deck0, deck1 });
    // Advance to first WAITING (initial draws, etc.)
    engine.step();
    this.register(duelId, engine);
    return engine;
  }

  remove(duelId: string): void {
    this.live.delete(duelId);
  }

  getLive(duelId: string): LiveDuel | undefined {
    return this.live.get(duelId);
  }

  incrementSeq(duelId: string): void {
    const live = this.live.get(duelId);
    if (live) live.nextSeq++;
  }
}
