/**
 * A4 — Single Field Spell (ONE_FACEUP_FIELD flag).
 *
 * Scenario:
 *   - Player 0 (turn 1): activates Umi [22702055] (Field Spell). It resolves.
 *   - Player 1 (turn 2): activates Mountain [50913601] (Field Spell).
 *
 * With ONE_FACEUP_FIELD (pre-MR3 rule):
 *   When Mountain resolves, Umi is DESTROYED (moves to GRAVE). Only one field spell can
 *   be face-up at a time; activating a new one destroys the existing one.
 *
 * Without ONE_FACEUP_FIELD (MR3+ rule):
 *   Each player keeps their own field spell zone; Umi stays active.
 *   Umi does NOT move to GRAVE.
 *
 * Cards used:
 *   22702055 — Umi (Field Spell, boosts Water/Sea Serpent monsters)
 *   50913601 — Mountain (Field Spell, boosts Dragon/Thunder/Winged Beast monsters)
 */
import createCore, { OcgDuelMode, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';
import { EDISON_FLAGS } from './flags.js';

const UMI      = 22702055;
const MOUNTAIN = 50913601;
const FILLER   = [32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
                  2863439, 2906250, 3134241, 3170832, 3606209];

async function runScenario(flags, label) {
  const lib = await createCore({ sync: true });

  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader:   (code) => getCard(code) ?? null,
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_type, text) => {
      if (!text.includes('deprecated')) process.stderr.write(`[err] ${text.slice(0, 80)}\n`);
    },
  });

  // Player 0: Umi in hand + fillers
  lib.duelNewCard(handle, { code: UMI, team: 0, duelist: 0, controller: 0, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP });
  for (const code of FILLER) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  // Player 1: Mountain in hand + fillers
  lib.duelNewCard(handle, { code: MOUNTAIN, team: 1, duelist: 0, controller: 1, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP });
  for (const code of FILLER) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  lib.startDuel(handle);

  const state = { turn: 0, activatedUmi: false, activatedMountain: false };
  const moves = [];
  const { WAITING, END } = { WAITING: 1, END: 0 };

  for (let i = 0; i < 5000; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);

    for (const m of msgs) {
      if (m.type === OcgMessageType.NEW_TURN) state.turn++;
      if (m.type === OcgMessageType.MOVE) {
        moves.push({ code: m.card, fromLoc: m.from?.location ?? 0, toLoc: m.to?.location ?? 0, turn: state.turn });
      }
    }

    if (status === END) break;

    if (status === WAITING) {
      let r = null;
      for (const msg of msgs) {
        if (msg.type === OcgMessageType.SELECT_IDLECMD) {
          if (state.turn === 1 && !state.activatedUmi) {
            const idx = msg.activates?.findIndex(a => a.code === UMI) ?? -1;
            if (idx >= 0) { r = { type: 1, action: 5, index: idx }; state.activatedUmi = true; break; }
          }
          if (state.turn === 2 && !state.activatedMountain) {
            const idx = msg.activates?.findIndex(a => a.code === MOUNTAIN) ?? -1;
            if (idx >= 0) { r = { type: 1, action: 5, index: idx }; state.activatedMountain = true; break; }
          }
          r = { type: 1, action: 7 }; break;
        } else if (msg.type === OcgMessageType.SELECT_BATTLECMD) { r = { type: 0, action: 3 }; break; }
        else if (msg.type === OcgMessageType.SELECT_EFFECTYN)    { r = { type: 2, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_YESNO)       { r = { type: 3, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_CHAIN)       { r = { type: 8, index: null }; break; }
        else if (msg.type === OcgMessageType.ROCK_PAPER_SCISSORS){ r = { type: 20, value: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_PLACE)       { r = { type: 10, places: [{ player: msg.player, location: OcgLocation.SZONE, sequence: 4 }] }; break; }
        else if (msg.type === OcgMessageType.SELECT_POSITION)    { r = { type: 11, position: msg.positions & -msg.positions }; break; }
        else if (msg.type === OcgMessageType.SELECT_OPTION)      { r = { type: 4, index: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_CARD)        { r = { type: 5, indicies: [0] }; break; }
        else if (msg.type === OcgMessageType.SELECT_TRIBUTE)     { r = { type: 12, indicies: [0] }; break; }
      }
      if (!r) break;
      lib.duelSetResponse(handle, r);
    }

    if (state.activatedMountain && state.turn >= 3) break;
    if (state.turn > 4) break;
  }

  return { label, moves, state };
}

async function main() {
  console.log('=== A4: Single Field Spell (ONE_FACEUP_FIELD) ===\n');
  console.log('Setup:');
  console.log('  Player 0 (turn 1): activates Umi [22702055]');
  console.log('  Player 1 (turn 2): activates Mountain [50913601]');
  console.log('');
  console.log('Assertion: with ONE_FACEUP_FIELD flag, Umi is destroyed (→GRAVE) when Mountain activates.');
  console.log('');

  const GRAVE = OcgLocation.GRAVE; // 0x10

  // WITH flag
  const r1 = await runScenario(EDISON_FLAGS, 'WITH ONE_FACEUP_FIELD (Edison flags)');
  const umiToGrave   = r1.moves.filter(m => m.code === UMI && m.toLoc === GRAVE);
  const umiActivated = r1.moves.some(m => m.code === UMI);
  const mountainActivated = r1.moves.some(m => m.code === MOUNTAIN);

  console.log(`-- Test A4a: ${r1.label} --`);
  console.log(`  Umi moves observed: ${r1.moves.filter(m=>m.code===UMI).map(m=>`turn${m.turn}: 0x${m.fromLoc.toString(16)}→0x${m.toLoc.toString(16)}`).join(', ')}`);
  console.log(`  Mountain moves: ${r1.moves.filter(m=>m.code===MOUNTAIN).map(m=>`turn${m.turn}: 0x${m.fromLoc.toString(16)}→0x${m.toLoc.toString(16)}`).join(', ')}`);
  console.log(`  Umi activated: ${umiActivated}, Mountain activated: ${mountainActivated}`);
  const passA = umiToGrave.length > 0 && mountainActivated;
  console.log(passA
    ? `  [PASS] Umi moved to GRAVE (0x${GRAVE.toString(16)}) when Mountain activated (turn ${umiToGrave[0].turn}) ✓`
    : '  [FAIL] Umi was NOT destroyed when Mountain activated');

  console.log('');

  // WITHOUT flag
  const EDISON_NO_SINGLE_FIELD = EDISON_FLAGS & ~OcgDuelMode.ONE_FACEUP_FIELD;
  const r2 = await runScenario(EDISON_NO_SINGLE_FIELD, 'WITHOUT ONE_FACEUP_FIELD');
  const umiToGrave2   = r2.moves.filter(m => m.code === UMI && m.toLoc === GRAVE);
  const mountainActiv = r2.moves.some(m => m.code === MOUNTAIN);

  console.log(`-- Test A4b: ${r2.label} --`);
  console.log(`  Umi moves observed: ${r2.moves.filter(m=>m.code===UMI).map(m=>`turn${m.turn}: 0x${m.fromLoc.toString(16)}→0x${m.toLoc.toString(16)}`).join(', ')}`);
  console.log(`  Mountain moves: ${r2.moves.filter(m=>m.code===MOUNTAIN).map(m=>`turn${m.turn}: 0x${m.fromLoc.toString(16)}→0x${m.toLoc.toString(16)}`).join(', ')}`);
  const passB = umiToGrave2.length === 0 && mountainActiv;
  console.log(passB
    ? '  [PASS] Umi NOT destroyed; both field spells coexist (modern MR3+ behavior) ✓'
    : `  [FAIL] Unexpected Umi move to grave (${umiToGrave2.length} events) or Mountain not activated (${mountainActiv})`);

  console.log('');
  console.log('--- A4 Verdict ---');
  if (passA && passB) {
    console.log('[PASS] A4: DUEL_1_FACEUP_FIELD (ONE_FACEUP_FIELD) flag EMPIRICALLY CONFIRMED.');
    console.log('       WITH flag:    activating Mountain DESTROYS Umi (pre-MR3 behavior) ✓');
    console.log('       WITHOUT flag: both field spells coexist — modern behavior ✓');
    console.log('');
    console.log('Cards verified:');
    console.log('  [22702055] Umi — Field Spell (destroyed when 2nd field activated, with flag)');
    console.log('  [50913601] Mountain — Field Spell (destroys existing field on activation, with flag)');
  } else {
    console.log('[FAIL] A4: Unexpected behavior');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
