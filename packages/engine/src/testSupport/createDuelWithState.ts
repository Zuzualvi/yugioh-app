// ---------------------------------------------------------------------------
// Test-only helper: set up a raw ocgcore duel in an arbitrary board state.
//
// Uses the LOW-LEVEL lib.createDuel / lib.duelNewCard / lib.startDuel API
// (the same approach as the spike scripts) so tests can place cards directly
// into GY, MZONE, SZONE, HAND, etc. without running through normal gameplay.
//
// This file is test-support only and MUST NOT be imported by production code.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  OcgCoreSync,
  OcgDuelHandle,
  OcgLocation as OcgLocationType,
  OcgPosition as OcgPositionType,
} from "ocgcore-wasm";
import { OcgLocation, OcgPosition } from "ocgcore-wasm";
import { createEdisonCore } from "../coreFactory.js";
import { getCard } from "../cardLoader.js";
import { EDISON_FLAGS } from "../edisonFlags.js";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Script loader (test-local) ───────────────────────────────────────────────
// Resolves relative to THIS FILE so the suite is path-independent.
// Correctly routes c0.lua (and other system scripts) to the assets root,
// which the production scriptLoader currently misroutes as a card script.

const ASSETS_SCRIPTS = resolve(__dir, "../../assets/scripts");
const OVERRIDES_DIR = resolve(__dir, "../../scripts/edison-overrides");

function loadScript(name: string): string | null {
  const isCard = /^c\d+\.lua$/.test(name) && name !== "c0.lua";

  const candidates: string[] = [];

  if (isCard) {
    candidates.push(
      resolve(OVERRIDES_DIR, name),
      resolve(ASSETS_SCRIPTS, "official", name),
      resolve(ASSETS_SCRIPTS, "pre-errata", name),
      resolve(ASSETS_SCRIPTS, "goat", name),
    );
  }
  // System scripts and c0.lua always fall through to root
  candidates.push(resolve(ASSETS_SCRIPTS, name));

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        // try next
      }
    }
  }
  return null;
}

// ── Card-placement spec ──────────────────────────────────────────────────────

export interface CardSpec {
  code: number;
  location: number; // OcgLocation.*
  sequence?: number;
  position?: number; // OcgPosition.*
}

// ── Duel setup options ───────────────────────────────────────────────────────

export interface DuelSetupOptions {
  /** Extra cards for player 0 (besides deck). */
  extraCards0?: CardSpec[];
  /** Extra cards for player 1 (besides deck). */
  extraCards1?: CardSpec[];
  /** Main deck passcodes for player 0 (default: FILLER). */
  deck0?: number[];
  /** Main deck passcodes for player 1 (default: FILLER). */
  deck1?: number[];
  /** Starting LP for both players (default: 8000). */
  startingLP?: number;
  /** Starting hand size for both players (default: 5). */
  startingDrawCount?: number;
  /** Custom flags (default: EDISON_FLAGS). */
  flags?: bigint;
}

// Normal-monster fillers: no scripts needed, safe for padding decks.
export const FILLER = [
  32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611, 2863439, 2906250, 3134241,
  3170832, 3606209, 4042268, 4148264, 5053103,
];

function makeFiller(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; out.length < n; i++) {
    out.push(FILLER[i % FILLER.length]!);
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DuelHandle {
  lib: OcgCoreSync;
  handle: OcgDuelHandle;
  /** Call at the end of every test to release WASM memory. */
  destroy: () => void;
}

/**
 * Create and start a raw ocgcore duel in the specified board state.
 * Call `destroy()` on the returned handle at the end of each test.
 */
export async function createDuelWithState(opts: DuelSetupOptions = {}): Promise<DuelHandle> {
  const lib = await createEdisonCore();

  const flags = opts.flags ?? EDISON_FLAGS;
  const startingLP = opts.startingLP ?? 8000;
  const startingDrawCount = opts.startingDrawCount ?? 5;

  const errors: string[] = [];

  const rawHandle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount, startingLP },
    team2: { drawCountPerTurn: 1, startingDrawCount, startingLP },
    cardReader: (code) => getCard(code) ?? null,
    scriptReader: (name) => loadScript(name),
    errorHandler: (_type, text) => {
      if (!text.includes("deprecated")) errors.push(text);
    },
  });
  if (!rawHandle) throw new Error("createDuel returned null — WASM may be in a bad state");
  const handle = rawHandle;

  // Place extra cards (GY, MZONE, SZONE, etc.)
  for (const c of opts.extraCards0 ?? []) {
    lib.duelNewCard(handle, {
      code: c.code,
      team: 0,
      duelist: 0,
      controller: 0,
      location: c.location as OcgLocationType,
      sequence: c.sequence ?? 0,
      position: (c.position ?? OcgPosition.FACEUP) as OcgPositionType,
    });
  }
  for (const c of opts.extraCards1 ?? []) {
    lib.duelNewCard(handle, {
      code: c.code,
      team: 1,
      duelist: 0,
      controller: 1,
      location: c.location as OcgLocationType,
      sequence: c.sequence ?? 0,
      position: (c.position ?? OcgPosition.FACEUP) as OcgPositionType,
    });
  }

  // Fill decks
  const deck0 = opts.deck0 ?? makeFiller(20);
  const deck1 = opts.deck1 ?? makeFiller(20);
  for (const code of deck0) {
    lib.duelNewCard(handle, {
      code,
      team: 0,
      duelist: 0,
      controller: 0,
      location: OcgLocation.DECK,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  }
  for (const code of deck1) {
    lib.duelNewCard(handle, {
      code,
      team: 1,
      duelist: 0,
      controller: 1,
      location: OcgLocation.DECK,
      sequence: 0,
      position: OcgPosition.FACEDOWN,
    });
  }

  lib.startDuel(handle);

  let _lib: typeof lib | null = lib;
  return {
    lib,
    handle,
    destroy: () => {
      if (!_lib) return;
      _lib.destroyDuel(handle);
      _lib = null;
    },
  };
}

// ── Duel driver ──────────────────────────────────────────────────────────────

/** Return value of a decide() call. */
export interface DriveDecision {
  /** Stop the loop (without responding). */
  stop?: boolean;
  /**
   * Response to send on WAITING status. Typed as `unknown` so test code can
   * pass partial response objects without satisfying the full OcgResponse union.
   * The value is forwarded directly to lib.duelSetResponse.
   */
  response?: unknown;
}

/**
 * Drive a duel until `decide` returns `{ stop: true }`, or END, or maxIter.
 * Returns all messages seen.
 */
export function driveDuel(
  lib: OcgCoreSync,
  handle: OcgDuelHandle,
  decide: (allMsgs: unknown[], latestMsgs: unknown[], status: number) => DriveDecision,
  maxIter = 10_000,
): unknown[] {
  const END = 0;
  const WAITING = 1;
  const all: unknown[] = [];

  for (let i = 0; i < maxIter; i++) {
    const status = lib.duelProcess(handle);
    const msgs = lib.duelGetMessage(handle);
    all.push(...msgs);
    if (status === END) break;
    const decision = decide(all, msgs, status);
    if (decision.stop) break;
    if (status === WAITING) {
      const r = decision.response ?? defaultRespond(msgs as OcgMsg[]);
      lib.duelSetResponse(handle, r as Parameters<OcgCoreSync["duelSetResponse"]>[1]);
    }
  }
  return all;
}

// ── Default responder ────────────────────────────────────────────────────────

// Minimal interface for messages we need to pattern-match here.
interface OcgMsg {
  type: number;
  player?: number;
  positions?: number;
  [key: string]: unknown;
}

const T = {
  SELECT_IDLECMD: 11,
  SELECT_BATTLECMD: 10,
  SELECT_EFFECTYN: 12,
  SELECT_YESNO: 13,
  SELECT_CHAIN: 16,
  SELECT_PLACE: 18,
  SELECT_POSITION: 19,
  SELECT_OPTION: 14,
  SELECT_CARD: 15,
  SELECT_TRIBUTE: 20,
  SORT_CHAIN: 21,
  SORT_CARD: 25,
  ROCK_PAPER_SCISSORS: 132,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = any;

/**
 * Default pass-everything responder:
 * - IDLE → end phase (TO_EP)
 * - BATTLE → end phase
 * - CHAIN → decline (pass priority)
 * - YES/NO/EFFECTYN → false
 * - PLACE → first available MZONE, then SZONE (reads field_mask)
 * - everything else → no / decline
 *
 * Typed as `any` internally so test code can return partial response objects
 * without satisfying the full OcgResponse union (which has required index fields).
 */
export function defaultRespond(msgs: OcgMsg[]): AnyResponse {
  for (const m of msgs) {
    switch (m.type) {
      case T.SELECT_IDLECMD:
        return { type: 1, action: 7 }; // TO_EP
      case T.SELECT_BATTLECMD:
        return { type: 0, action: 3 }; // TO_EP
      case T.SELECT_EFFECTYN:
        return { type: 2, yes: false };
      case T.SELECT_YESNO:
        return { type: 3, yes: false };
      case T.SELECT_CHAIN:
        return { type: 8, index: null }; // pass
      case T.ROCK_PAPER_SCISSORS:
        return { type: 20, value: 0 };
      case T.SELECT_PLACE: {
        // field_mask encodes OCCUPIED/FORBIDDEN zones: a 1-bit means that zone is unavailable.
        // Bit layout (per player, using shift = player * 16):
        //   bits 0-4  = MZONE positions 0-4
        //   bits 8-12 = SZONE positions 0-4
        // A CLEAR bit (0) means the zone is AVAILABLE.
        // Strategy: find the first available (CLEAR) MZONE position; fall back to SZONE.
        const fieldMask: number = (m as unknown as { field_mask: number }).field_mask ?? 0;
        const shift = (m.player ?? 0) * 16;
        const playerMask = (fieldMask >> shift) & 0xffff;
        let loc = OcgLocation.MZONE;
        let seq = 0;
        let found = false;
        for (let s = 0; s < 5; s++) {
          if (!(playerMask & (1 << s))) {
            seq = s;
            found = true;
            break;
          }
        }
        if (!found) {
          loc = OcgLocation.SZONE as unknown as typeof OcgLocation.MZONE;
          for (let s = 0; s < 5; s++) {
            if (!(playerMask & (1 << (s + 8)))) {
              seq = s;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          loc = OcgLocation.SZONE as unknown as typeof OcgLocation.MZONE;
          seq = 4;
        }
        return { type: 10, places: [{ player: m.player ?? 0, location: loc, sequence: seq }] };
      }
      case T.SELECT_POSITION:
        return { type: 11, position: (m.positions as number) & -(m.positions as number) };
      case T.SELECT_OPTION:
        return { type: 4, index: 0 };
      case T.SELECT_CARD:
        return { type: 5, indicies: [0] };
      case T.SELECT_TRIBUTE:
        return { type: 12, indicies: [0] };
      case T.SORT_CHAIN:
      case T.SORT_CARD:
        return { type: 15, order: null };
    }
  }
  return { type: 3, yes: false };
}
