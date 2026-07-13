/**
 * E3 — Regression check: first-turn draw, single field spell, MZone ignition
 * all still work correctly on the new WASM build.
 */
import createCore, { OcgDuelMode, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';

const FILLER         = [32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
                        2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103];
const LONEFIRE       = 48686504;  // MZone ignition effect
const UMI            = 22702055;  // Field Spell
const MOUNTAIN       = 50913601;  // Field Spell
const KOUMORI        = 67724379;

const TCG_FAST_EFFECT = 0x400000000n;
const EDISON_FLAGS   = OcgDuelMode.MODE_GOAT | TCG_FAST_EFFECT; // 0x7f80d072c

function makeLib() { return createCore({ sync: true }); }

function makeDuel(lib, flags, opts = {}) {
  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: opts.startCards ?? 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: opts.startCards ?? 5, startingLP: 8000 },
    cardReader:   (code) => getCard(code) ?? null,
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_t, _txt) => {},
  });
  for (const c of (opts.extra1 ?? [])) {
    lib.duelNewCard(handle, { code: c.code, team: 0, duelist: 0, controller: 0, location: c.loc, sequence: c.seq ?? 0, position: c.pos ?? OcgPosition.FACEUP });
  }
  for (const c of (opts.extra2 ?? [])) {
    lib.duelNewCard(handle, { code: c.code, team: 1, duelist: 0, controller: 1, location: c.loc, sequence: c.seq ?? 0, position: c.pos ?? OcgPosition.FACEUP });
  }
  for (const code of (opts.deck1 ?? FILLER.slice(0, 16))) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  for (const code of (opts.deck2 ?? FILLER.slice(0, 16))) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  lib.startDuel(handle);
  return handle;
}

function respond(msgs) {
  for (const m of msgs) {
    switch (m.type) {
      case OcgMessageType.SELECT_IDLECMD:      return { type: 1, action: 7 };
      case OcgMessageType.SELECT_BATTLECMD:    return { type: 0, action: 3 };
      case OcgMessageType.SELECT_EFFECTYN:     return { type: 2, yes: false };
      case OcgMessageType.SELECT_YESNO:        return { type: 3, yes: false };
      case OcgMessageType.SELECT_CHAIN:        return { type: 8, index: null };
      case OcgMessageType.ROCK_PAPER_SCISSORS: return { type: 20, value: 0 };
      case OcgMessageType.SELECT_PLACE:        return { type: 10, places: [{ player: m.player, location: OcgLocation.SZONE, sequence: 4 }] };
      case OcgMessageType.SELECT_POSITION:     return { type: 11, position: m.positions & -m.positions };
      case OcgMessageType.SELECT_OPTION:       return { type: 4, index: 0 };
      case OcgMessageType.SELECT_CARD:         return { type: 5, indicies: [0] };
      case OcgMessageType.SELECT_TRIBUTE:      return { type: 12, indicies: [0] };
    }
  }
  return { type: 3, yes: false };
}

function drive(lib, handle, decide, maxIter = 3000) {
  const all = [];
  for (let i = 0; i < maxIter; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);
    all.push(...msgs);
    if (status === 0 /* END */) break;
    const { stop, r } = decide(all, msgs, status);
    if (stop) break;
    if (status === 1 /* WAITING */) lib.duelSetResponse(handle, r ?? respond(msgs));
  }
  return all;
}

// ── E3a: First-Turn Draw ────────────────────────────────────────────────────

async function testFirstTurnDraw() {
  console.log('\n--- E3a: FIRST_TURN_DRAW (with new WASM, EDISON_FLAGS = 0x7f80d072c) ---');
  const lib = await makeLib();
  const handle = makeDuel(lib, EDISON_FLAGS);
  let player0Cards = 0;
  const msgs = drive(lib, handle,
    (all, msgs) => {
      for (const m of msgs) {
        if (m.type === OcgMessageType.DRAW && m.player === 0) player0Cards += m.drawn?.length ?? 0;
      }
      return { stop: msgs.some(m => m.type === OcgMessageType.SELECT_IDLECMD) };
    }
  );
  console.log(`  Player 0 cards drawn: ${player0Cards} (expected: 6 = 5 start + 1 turn-1 draw)`);
  const pass = player0Cards === 6;
  console.log(pass ? '  [PASS] First-turn draw: 6 cards ✓' : `  [FAIL] Expected 6, got ${player0Cards}`);
  return pass;
}

// ── E3b: Single Field Spell ─────────────────────────────────────────────────

async function testFieldSpell() {
  console.log('\n--- E3b: ONE_FACEUP_FIELD — Umi destroyed when Mountain activated ---');
  const lib = await makeLib();
  const handle = makeDuel(lib, EDISON_FLAGS, {
    extra1: [{ code: UMI, loc: OcgLocation.HAND, pos: OcgPosition.FACEUP }],
    extra2: [{ code: MOUNTAIN, loc: OcgLocation.HAND, pos: OcgPosition.FACEUP }],
    startCards: 1,
  });

  const moves = [];
  let turn = 0;
  const state = { activatedUmi: false, activatedMountain: false };

  drive(lib, handle, (all, msgs, status) => {
    for (const m of msgs) {
      if (m.type === OcgMessageType.NEW_TURN) turn++;
      if (m.type === OcgMessageType.MOVE) moves.push({ code: m.card, to: m.to?.location ?? 0, turn });
    }
    if (turn > 3) return { stop: true };
    if (status === 1 /* WAITING */) {
      for (const m of msgs) {
        if (m.type === OcgMessageType.SELECT_IDLECMD) {
          if (turn === 1 && !state.activatedUmi) {
            const idx = m.activates?.findIndex(a => a.code === UMI) ?? -1;
            if (idx >= 0) { state.activatedUmi = true; return { r: { type: 1, action: 5, index: idx } }; }
          }
          if (turn === 2 && !state.activatedMountain) {
            const idx = m.activates?.findIndex(a => a.code === MOUNTAIN) ?? -1;
            if (idx >= 0) { state.activatedMountain = true; return { r: { type: 1, action: 5, index: idx } }; }
          }
          return { r: { type: 1, action: 7 } };
        }
      }
    }
    return {};
  });

  const umiToGrave = moves.filter(m => m.code === UMI && m.to === OcgLocation.GRAVE);
  console.log(`  Umi [${UMI}] moves to GRAVE: ${umiToGrave.length} (expected: 1 when Mountain activates)`);
  const pass = umiToGrave.length > 0;
  console.log(pass ? '  [PASS] Umi destroyed when Mountain activated ✓' : '  [FAIL] Umi NOT destroyed');
  return pass;
}

// ── E3c: MZone Ignition Priority ────────────────────────────────────────────

async function testMZoneIgnition() {
  console.log('\n--- E3c: OBSOLETE_IGNITION — MZone ignition priority still works ---');
  const lib = await makeLib();
  const handle = makeDuel(lib, EDISON_FLAGS, {
    extra1: [
      { code: LONEFIRE, loc: OcgLocation.HAND, pos: OcgPosition.FACEUP },
      { code: LONEFIRE, loc: OcgLocation.DECK, pos: OcgPosition.FACEDOWN },
    ],
    startCards: 1,
  });

  const state = { summoned: false, respondedSummon: false };
  const chainOffers = [];

  drive(lib, handle, (all, msgs, status) => {
    for (const m of msgs) {
      if (m.type === OcgMessageType.SUMMONED) state.summoned = true;
      if (m.type === OcgMessageType.SELECT_CHAIN && state.summoned) {
        chainOffers.push({ player: m.player, selects: m.selects?.map(s => s.code) ?? [] });
      }
    }
    if (state.summoned && chainOffers.length >= 2) return { stop: true };
    if (status === 1) {
      for (const m of msgs) {
        if (m.type === OcgMessageType.SELECT_IDLECMD) {
          if (!state.respondedSummon) {
            const idx = m.summons?.findIndex(s => s.code === LONEFIRE) ?? -1;
            if (idx >= 0) { state.respondedSummon = true; return { r: { type: 1, action: 0, index: idx } }; }
          }
          return { r: { type: 1, action: 7 } };
        } else if (m.type === OcgMessageType.SELECT_CHAIN) { return { r: { type: 8, index: null } }; }
        else if (m.type === OcgMessageType.SELECT_BATTLECMD) { return { r: { type: 0, action: 3 } }; }
        else if (m.type === OcgMessageType.SELECT_EFFECTYN) { return { r: { type: 2, yes: false } }; }
        else if (m.type === OcgMessageType.SELECT_YESNO) { return { r: { type: 3, yes: false } }; }
        else if (m.type === OcgMessageType.ROCK_PAPER_SCISSORS) { return { r: { type: 20, value: 0 } }; }
        else if (m.type === OcgMessageType.SELECT_PLACE) { return { r: { type: 10, places: [{ player: m.player, location: OcgLocation.MZONE, sequence: 0 }] } }; }
        else if (m.type === OcgMessageType.SELECT_POSITION) { return { r: { type: 11, position: m.positions & -m.positions } }; }
        else if (m.type === OcgMessageType.SELECT_OPTION) { return { r: { type: 4, index: 0 } }; }
        else if (m.type === OcgMessageType.SELECT_CARD) { return { r: { type: 5, indicies: [0] } }; }
      }
    }
    return {};
  });

  const lonefireOffer = chainOffers.some(c => c.player === 0 && c.selects.includes(LONEFIRE));
  console.log('  Post-SUMMONED chain offers:');
  for (const c of chainOffers) console.log(`    player=${c.player} selects=[${c.selects.join(',')}]`);
  console.log(`  Lonefire MZone ignition offered to player 0: ${lonefireOffer}`);
  const pass = lonefireOffer;
  console.log(pass ? '  [PASS] MZone ignition priority still works ✓' : '  [FAIL] MZone ignition broken');
  return pass;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== E3: Regression Check (new WASM build, EDISON_FLAGS = 0x7f80d072c) ===\n');
  console.log('Verifying existing behaviors are not broken by the new build / adding GY flag.');
  console.log(`EDISON_FLAGS: 0x${EDISON_FLAGS.toString(16)} = OcgDuelMode.MODE_GOAT | 0x400000000n`);

  const r1 = await testFirstTurnDraw();
  const r2 = await testFieldSpell();
  const r3 = await testMZoneIgnition();

  console.log('\n=== E3 Summary ===\n');
  const all = r1 && r2 && r3;
  console.log(`  FIRST_TURN_DRAW (A2 regression): ${r1 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  ONE_FACEUP_FIELD (A4 regression): ${r2 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  OBSOLETE_IGNITION MZone (A3 regression): ${r3 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('');
  console.log(all
    ? '[PASS] E3: No regressions — all 3 behaviors confirmed on new build ✓'
    : '[FAIL] E3: Regression detected');
  if (!all) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
