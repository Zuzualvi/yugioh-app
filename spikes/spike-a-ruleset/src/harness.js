/**
 * Minimal headless duel harness for Spike A.
 *
 * Uses ocgcore-wasm in SYNC mode (no JSPI / --experimental-wasm-stack-switching needed).
 * Processing loop: duelProcess → drain messages → if AWAITING (status=1) → feed response → repeat.
 *
 * IMPORTANT: OcgProcessResult values:
 *   END     = 0  (duel finished)
 *   WAITING = 1  (engine needs a player response before continuing)
 *   CONTINUE = 2 (intermediate step, call duelProcess again)
 */
import createCore, { OcgDuelMode, OcgProcessResult, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';

// ── Passcode constants ────────────────────────────────────────────────────────

// Normal monsters (type=17) — safe deck filler with no scripted effects
export const FILLER_IDS = [
  32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
  2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103,
  5265750, 5388481, 5434080, 5464695,
];

export const LONEFIRE_BLOSSOM    = 48686504; // Ignition-Effect Plant monster
export const BOTTOMLESS_TRAP_HOLE = 29401950; // Spell-Speed 2 trap
export const UMI                 = 22702055; // Umi — Field Spell
export const MOUNTAIN            = 50913601; // Mountain — Field Spell

// ── Core initialiser (singleton) ──────────────────────────────────────────────

let _lib = null;

export async function getLib() {
  if (!_lib) {
    _lib = await createCore({ sync: true });
  }
  return _lib;
}

// ── Deck helpers ──────────────────────────────────────────────────────────────

/** Build a `size`-card deck of normal-monster filler, with optional prefix cards. */
export function fillerDeck(prefix = [], size = 20) {
  const deck = [...prefix];
  for (let i = 0; deck.length < size; i++) {
    deck.push(FILLER_IDS[i % FILLER_IDS.length]);
  }
  return deck;
}

// ── Duel factory ──────────────────────────────────────────────────────────────

/**
 * Create, populate and start a duel.
 * Returns { handle, errors }.
 */
export function createDuel(lib, flags, deck1, deck2, {
  lp            = 8000,
  drawCount     = 1,
  startingCards = 5,
} = {}) {
  const errors = [];

  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: drawCount, startingDrawCount: startingCards, startingLP: lp },
    team2: { drawCountPerTurn: drawCount, startingDrawCount: startingCards, startingLP: lp },
    cardReader:   (code) => {
      const c = getCard(code);
      if (!c) errors.push(`missing card ${code}`);
      return c ?? null;
    },
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_type, text) => errors.push(text),
  });

  if (!handle) throw new Error('lib.createDuel() returned null');

  for (const code of deck1) {
    lib.duelNewCard(handle, {
      code, team: 0, duelist: 0, controller: 0,
      location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN,
    });
  }
  for (const code of deck2) {
    lib.duelNewCard(handle, {
      code, team: 1, duelist: 0, controller: 1,
      location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN,
    });
  }

  lib.startDuel(handle);
  return { handle, errors };
}

// ── Message loop ──────────────────────────────────────────────────────────────

/**
 * Drive the duel until END, or until `shouldStop(allMsgs, newMsgs, status)` returns true.
 * When status is WAITING (1), calls `respond(newMsgs)` which must return an OcgResponse.
 *
 * Returns all messages accumulated.
 */
export function runLoop(lib, handle, {
  respond,
  shouldStop = () => false,
  maxIter = 100000,
  verbose = false,
} = {}) {
  const all = [];

  for (let i = 0; i < maxIter; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);

    for (const m of msgs) {
      all.push(m);
      if (verbose) process.stdout.write(`  [${msgTypeName(m.type)}]\n`);
    }

    if (status === OcgProcessResult.END) break;

    if (shouldStop(all, msgs, status)) break;

    if (status === OcgProcessResult.WAITING) {
      // WAITING = 1: engine needs a response
      const resp = respond ? respond(all, msgs) : passResponder(all, msgs);
      lib.duelSetResponse(handle, resp);
    }
    // CONTINUE = 2: just loop again
  }

  return all;
}

// ── Standard responders ───────────────────────────────────────────────────────

/**
 * Always declines / passes / ends turn.
 */
export function passResponder(all, msgs) {
  for (const msg of msgs) {
    switch (msg.type) {
      case OcgMessageType.SELECT_IDLECMD:
        return { type: 1, action: 7 };   // TO_EP
      case OcgMessageType.SELECT_BATTLECMD:
        return { type: 0, action: 3 };   // TO_EP
      case OcgMessageType.SELECT_EFFECTYN:
        return { type: 2, yes: false };
      case OcgMessageType.SELECT_YESNO:
        return { type: 3, yes: false };
      case OcgMessageType.SELECT_CHAIN:
        return { type: 8, index: null };
      case OcgMessageType.ROCK_PAPER_SCISSORS:
        return { type: 20, value: 0 };
      case OcgMessageType.SELECT_PLACE:
        return { type: 10, places: [{ player: msg.player, location: OcgLocation.MZONE, sequence: 0 }] };
      case OcgMessageType.SELECT_POSITION:
        return { type: 11, position: msg.positions & -msg.positions };
      case OcgMessageType.SELECT_OPTION:
        return { type: 4, index: 0 };
      case OcgMessageType.SELECT_CARD:
        return { type: 5, indicies: [0] };
      case OcgMessageType.SELECT_TRIBUTE:
        return { type: 12, indicies: [0] };
      case OcgMessageType.SORT_CHAIN:
      case OcgMessageType.SORT_CARD:
        return { type: 15, order: null };
      default:
        break;
    }
  }
  return { type: 3, yes: false }; // fallback
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function countDrawn(messages, player) {
  return messages
    .filter(m => m.type === OcgMessageType.DRAW && m.player === player)
    .reduce((sum, m) => sum + (m.drawn?.length ?? 0), 0);
}

export function msgTypeName(type) {
  return Object.entries(OcgMessageType).find(([, v]) => v === type)?.[0] ?? `MSG#${type}`;
}
