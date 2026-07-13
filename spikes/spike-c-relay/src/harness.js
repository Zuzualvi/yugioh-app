/**
 * Minimal duel harness — adapted from spike-a-ruleset/src/harness.js.
 *
 * OcgProcessResult: END=0, WAITING=1, CONTINUE=2
 * Each duel needs its own createCore() (reusing across duels = WASM memory errors).
 */
import createCore, {
  OcgDuelMode, OcgProcessResult, OcgMessageType, OcgLocation, OcgPosition,
} from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';

// ── Passcode constants ────────────────────────────────────────────────────────

// Normal monsters (type=17) — no scripted effects, safe deck filler
export const FILLER_IDS = [
  32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
  2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103,
  5265750, 5388481, 5434080, 5464695,
];

// ── Core initialiser ──────────────────────────────────────────────────────────

let _lib = null;

export async function getLib() {
  if (!_lib) {
    _lib = await createCore({ sync: true });
  }
  return _lib;
}

// ── Deck helpers ──────────────────────────────────────────────────────────────

export function fillerDeck(prefix = [], size = 20) {
  const deck = [...prefix];
  for (let i = 0; deck.length < size; i++) {
    deck.push(FILLER_IDS[i % FILLER_IDS.length]);
  }
  return deck;
}

// ── Duel factory ──────────────────────────────────────────────────────────────

export function createDuel(lib, flags, deck1, deck2, {
  lp = 8000, drawCount = 1, startingCards = 5,
} = {}) {
  const errors = [];

  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: drawCount, startingDrawCount: startingCards, startingLP: lp },
    team2: { drawCountPerTurn: drawCount, startingDrawCount: startingCards, startingLP: lp },
    cardReader:   (code) => { const c = getCard(code); if (!c) errors.push(`missing card ${code}`); return c ?? null; },
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_type, text) => errors.push(text),
  });

  if (!handle) throw new Error('lib.createDuel() returned null');

  for (const code of deck1) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  for (const code of deck2) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  lib.startDuel(handle);
  return { handle, errors };
}

// ── Responder ─────────────────────────────────────────────────────────────────

/**
 * Stateless pass responder — always ends turn / declines chains.
 * Used by scripted test clients to auto-respond to decision messages.
 */
export function passResponder(msgs) {
  for (const msg of msgs) {
    switch (msg.type) {
      case OcgMessageType.SELECT_IDLECMD:    return { type: 1, action: 7 };   // TO_EP
      case OcgMessageType.SELECT_BATTLECMD:  return { type: 0, action: 3 };   // TO_EP
      case OcgMessageType.SELECT_EFFECTYN:   return { type: 2, yes: false };
      case OcgMessageType.SELECT_YESNO:      return { type: 3, yes: false };
      case OcgMessageType.SELECT_CHAIN:      return { type: 8, index: null };
      case OcgMessageType.ROCK_PAPER_SCISSORS: return { type: 20, value: 0 };
      case OcgMessageType.SELECT_PLACE:
        return { type: 10, places: [{ player: msg.player, location: OcgLocation.MZONE, sequence: 0 }] };
      case OcgMessageType.SELECT_POSITION:   return { type: 11, position: msg.positions & -msg.positions };
      case OcgMessageType.SELECT_OPTION:     return { type: 4, index: 0 };
      case OcgMessageType.SELECT_CARD:       return { type: 5, indicies: [0] };
      case OcgMessageType.SELECT_TRIBUTE:    return { type: 12, indicies: [0] };
      case OcgMessageType.SORT_CHAIN:
      case OcgMessageType.SORT_CARD:         return { type: 15, order: null };
      default: break;
    }
  }
  return { type: 3, yes: false };
}

/**
 * Scripted responder: player 0 sets first available monster face-down on T1,
 * then flip-summons it on T3.
 */
export function scriptedResponder(state) {
  return function respond(msgs) {
    for (const msg of msgs) {
      if (msg.type === OcgMessageType.SELECT_IDLECMD && msg.player === 0) {
        if (!state.p0Set && msg.monster_sets?.length > 0) {
          state.p0Set = true;
          return { type: 1, action: 3, cardIndex: 0 }; // SELECT_MONSTER_SET
        }
        if (state.p0Set && !state.p0Flip && msg.pos_changes?.length > 0) {
          state.p0Flip = true;
          return { type: 1, action: 2, cardIndex: 0 }; // SELECT_POS_CHANGE (flip summon)
        }
      }
    }
    return passResponder(msgs);
  };
}

// ── Name helper ───────────────────────────────────────────────────────────────

export function msgTypeName(type) {
  return Object.entries(OcgMessageType).find(([k, v]) => v === type && isNaN(k))?.[0] ?? `MSG#${type}`;
}
