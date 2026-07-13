/**
 * Shared harness for spike-a2 tests.
 * Reuses patterns from spike-a-ruleset/src/harness.js.
 */
import createCore, { OcgDuelMode, OcgProcessResult, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';

export const FILLER = [32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
                       2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103,
                       5265750, 5388481, 5434080, 5464695];

// D-HERO Malicious — GY ignition (banish self, special summon another from deck)
export const MALICIOUS = 9411399;
// Plaguespreader Zombie — GY ignition (put hand card on deck top, special summon self from GY)
export const PLAGUESPREADER = 33420078;
// Filler normal monster to normal summon  
export const KOUMORI_DRAGON = 67724379;
// BTH
export const BTH = 29401950;
// 0-ATK: Skull Servant
export const SKULL_SERVANT = 8058240;
// Book of Moon (QuickPlay spell) - for damage step test
export const BOOK_OF_MOON = 14087088;

// OcgProcessResult values (WAITING=1, CONTINUE=2, END=0)
export const { WAITING, CONTINUE, END } = OcgProcessResult;

let _lib = null;

/** Fresh lib instance — required per-test to avoid WASM state contamination. */
export async function freshLib() {
  return await createCore({ sync: true });
}

/** Build and start a duel. deck1/deck2 are arrays of main-deck passcodes. */
export function makeDuel(lib, flags, deck1, deck2, {
  extraCards1 = [],  // [{code, location, sequence, position, controller}] to add directly
  extraCards2 = [],
  startingCards = 5,
} = {}) {
  const errors = [];
  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: startingCards, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: startingCards, startingLP: 8000 },
    cardReader:   (code) => { const c = getCard(code); if(!c) errors.push(`missing card ${code}`); return c ?? null; },
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_t, text) => { if (!text.includes('deprecated')) errors.push(text); },
  });
  if (!handle) throw new Error('createDuel returned null');

  for (const code of deck1) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  for (const code of deck2) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  for (const c of extraCards1) {
    lib.duelNewCard(handle, { code: c.code, team: 0, duelist: 0, controller: c.controller ?? 0, location: c.location, sequence: c.sequence ?? 0, position: c.position ?? OcgPosition.FACEUP });
  }
  for (const c of extraCards2) {
    lib.duelNewCard(handle, { code: c.code, team: 1, duelist: 0, controller: c.controller ?? 1, location: c.location, sequence: c.sequence ?? 0, position: c.position ?? OcgPosition.FACEDOWN });
  }

  lib.startDuel(handle);
  return { handle, errors };
}

/** Standard response handler — pass/decline everything. */
export function passRespond(msgs, opts = {}) {
  for (const msg of msgs) {
    switch (msg.type) {
      case OcgMessageType.SELECT_IDLECMD:
        if (opts.onIdleCmd) {
          const r = opts.onIdleCmd(msg);
          if (r) return r;
        }
        return { type: 1, action: 7 }; // TO_EP
      case OcgMessageType.SELECT_BATTLECMD: return { type: 0, action: 3 }; // TO_EP
      case OcgMessageType.SELECT_EFFECTYN:   return { type: 2, yes: false };
      case OcgMessageType.SELECT_YESNO:      return { type: 3, yes: false };
      case OcgMessageType.SELECT_CHAIN:
        if (opts.onChain) {
          const r = opts.onChain(msg);
          if (r !== undefined) return r;
        }
        return { type: 8, index: null };
      case OcgMessageType.ROCK_PAPER_SCISSORS: return { type: 20, value: 0 };
      case OcgMessageType.SELECT_PLACE:      return { type: 10, places: [{ player: msg.player, location: OcgLocation.MZONE, sequence: 0 }] };
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

/** Run a duel until shouldStop() or END. Calls respond() on WAITING. */
export function runLoop(lib, handle, respond, shouldStop, maxIter = 5000) {
  const all = [];
  for (let i = 0; i < maxIter; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);
    all.push(...msgs);
    if (status === END) break;
    if (shouldStop && shouldStop(all, msgs, status)) break;
    if (status === WAITING) {
      const r = respond(all, msgs);
      lib.duelSetResponse(handle, r);
    }
  }
  return all;
}

export function msgTypeName(type) {
  return Object.entries(OcgMessageType).find(([,v]) => v === type)?.[0] ?? `MSG#${type}`;
}
