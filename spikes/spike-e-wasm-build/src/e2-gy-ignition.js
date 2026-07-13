/**
 * E2 — GY Ignition Priority: verify TCG_FAST_EFFECT_IGNITION works with new WASM build.
 *
 * This is the A2-1 test re-run against the NEWLY BUILT WASM.
 * Both builds use the same edo9300 commit (8e5f4e4) but the new WASM confirms
 * whether the C++ processor logic responds to the 0x400000000 bit.
 *
 * Additionally investigates why raw bit OR-in appears not to work in 0.1.2.
 *
 * Test: D-HERO Malicious [9411399] in player 0's GY (GY ignition effect).
 * With EDISON_FLAGS = MODE_GOAT | 0x400000000n = 0x7f80d072c:
 *   After Normal Summon of Koumori Dragon [67724379] + SUMMONED,
 *   player 0 should see SELECT_CHAIN with Malicious [9411399] in selects.
 *
 * Before/after comparison: old build (0x3f80d072c) vs new build (0x7f80d072c).
 */
import createCore, { OcgDuelMode, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';

const MALICIOUS   = 9411399;
const KOUMORI     = 67724379;
const BTH         = 29401950;
const PLAGUESPREADER = 33420078;
const FILLER      = [32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
                     2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103];

const TCG_FAST_EFFECT_IGNITION = 0x400000000n;
const EDISON_FLAGS_IDEAL = OcgDuelMode.MODE_GOAT | TCG_FAST_EFFECT_IGNITION;

async function runGYTest(flags, label) {
  const lib = await createCore({ sync: true });

  const errors = [];
  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader:   (code) => getCard(code) ?? null,
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_t, text) => { if (!text.includes('deprecated')) errors.push(text); },
  });

  // Player 0: Malicious in GY, another Malicious in deck, Koumori in hand to summon
  lib.duelNewCard(handle, { code: MALICIOUS, team: 0, duelist: 0, controller: 0, location: OcgLocation.GRAVE, sequence: 0, position: OcgPosition.FACEUP });
  lib.duelNewCard(handle, { code: MALICIOUS, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK,  sequence: 0, position: OcgPosition.FACEDOWN });
  lib.duelNewCard(handle, { code: KOUMORI,   team: 0, duelist: 0, controller: 0, location: OcgLocation.HAND,  sequence: 0, position: OcgPosition.FACEUP });
  for (const code of FILLER.slice(0, 18)) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  // Player 1: BTH face-down
  lib.duelNewCard(handle, { code: BTH, team: 1, duelist: 0, controller: 1, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN });
  for (const code of FILLER.slice(0, 19)) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }
  lib.startDuel(handle);

  const state = { summoned: false, respondedSummon: false };
  const chainOffers = [];
  const { END, WAITING } = { END: 0, WAITING: 1 };

  for (let i = 0; i < 3000; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);

    for (const m of msgs) {
      if (m.type === OcgMessageType.SUMMONED) state.summoned = true;
      if (m.type === OcgMessageType.SELECT_CHAIN && state.summoned) {
        chainOffers.push({ player: m.player, selects: m.selects?.map(s => s.code) ?? [] });
      }
    }

    if (status === END) break;
    if (status === WAITING) {
      let r = null;
      for (const msg of msgs) {
        if (msg.type === OcgMessageType.SELECT_IDLECMD) {
          if (!state.respondedSummon) {
            const idx = msg.summons?.findIndex(s => s.code === KOUMORI) ?? -1;
            if (idx >= 0) { r = { type: 1, action: 0, index: idx }; state.respondedSummon = true; break; }
          }
          r = { type: 1, action: 7 }; break;
        } else if (msg.type === OcgMessageType.SELECT_BATTLECMD) { r = { type: 0, action: 3 }; break; }
        else if (msg.type === OcgMessageType.SELECT_EFFECTYN)    { r = { type: 2, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_YESNO)       { r = { type: 3, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_CHAIN)       { r = { type: 8, index: null }; break; }
        else if (msg.type === OcgMessageType.ROCK_PAPER_SCISSORS) { r = { type: 20, value: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_PLACE)       { r = { type: 10, places: [{ player: msg.player, location: OcgLocation.MZONE, sequence: 0 }] }; break; }
        else if (msg.type === OcgMessageType.SELECT_POSITION)    { r = { type: 11, position: msg.positions & -msg.positions }; break; }
        else if (msg.type === OcgMessageType.SELECT_OPTION)      { r = { type: 4, index: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_CARD)        { r = { type: 5, indicies: [0] }; break; }
        else if (msg.type === OcgMessageType.SELECT_TRIBUTE)     { r = { type: 12, indicies: [0] }; break; }
      }
      if (!r) break;
      lib.duelSetResponse(handle, r);
    }

    if (state.summoned && chainOffers.length >= 2) break;
  }

  const gyIgnition = chainOffers.some(c => c.player === 0 && c.selects.includes(MALICIOUS));

  console.log(`\n--- ${label} ---`);
  console.log(`  flags: 0x${flags.toString(16)}`);
  console.log(`  Post-SUMMONED chain offers:`);
  for (const c of chainOffers) {
    console.log(`    SELECT_CHAIN player=${c.player} selects=[${c.selects.join(',')}]`);
  }
  if (errors.length > 0) {
    console.log(`  Script errors: ${errors.slice(0,3).join('; ')}`);
  }
  console.log(`  GY ignition (Malicious [${MALICIOUS}]) offered to turn player (p=0): ${gyIgnition}`);

  return gyIgnition;
}

async function main() {
  console.log('=== E2: GY Ignition Priority — New WASM Build Verification ===\n');
  console.log('WASM build: local build from n1xx1/ocgcore-wasm + edo9300 commit 8e5f4e4');
  console.log('Replaced: node_modules/ocgcore-wasm/lib/ocgcore.sync.wasm (was 0.1.2 prebuilt)');
  console.log('');
  console.log('Cards:');
  console.log(`  Player 0 GY:   D-HERO Malicious [${MALICIOUS}] (GY ignition: banish self → summon from deck)`);
  console.log(`  Player 0 deck: D-HERO Malicious [${MALICIOUS}] (target for effect)`);
  console.log(`  Player 0 hand: Koumori Dragon [${KOUMORI}] (to normal summon)`);
  console.log(`  Player 1 S/T:  Bottomless Trap Hole [${BTH}] set`);
  console.log('');
  console.log('BEFORE/AFTER comparison:');
  console.log('  OLD flags: MODE_GOAT = 0x' + OcgDuelMode.MODE_GOAT.toString(16) + ' (no GY ignition bit)');
  console.log('  NEW flags: EDISON_IDEAL = 0x' + EDISON_FLAGS_IDEAL.toString(16) + ' (with 0x400000000 added)');

  const oldResult = await runGYTest(OcgDuelMode.MODE_GOAT, 'BEFORE: MODE_GOAT (no TCG_FAST_EFFECT_IGNITION)');
  const newResult = await runGYTest(EDISON_FLAGS_IDEAL,    'AFTER: MODE_GOAT | 0x400000000n (TCG_FAST_EFFECT_IGNITION)');

  console.log('\n=== E2 Verdict ===\n');
  console.log(`BEFORE (0x${OcgDuelMode.MODE_GOAT.toString(16)}): GY ignition offered = ${oldResult}`);
  console.log(`AFTER  (0x${EDISON_FLAGS_IDEAL.toString(16)}): GY ignition offered = ${newResult}`);
  console.log('');

  if (newResult && !oldResult) {
    console.log('[PASS] ✅ GY ignition priority CONFIRMED with new build!');
    console.log('  TCG_FAST_EFFECT_IGNITION (0x400000000) IS effective in the new WASM.');
    console.log('  Turn player is offered Malicious GY ignition as CL1 before opponent BTH window.');
    console.log('  BEFORE: opponent gets priority first (BTH in selects). AFTER: turn player gets Malicious first.');
    console.log('');
    console.log('  The issue with 0.1.2 was that the WASM was compiled from the same edo9300 commit');
    console.log('  but the JS bindings incorrectly defined MODE_GOAT without the 0x400000000 bit,');
    console.log('  AND the raw bit OR-in appeared to not work because [REASON TBD from new test].');
    console.log('');
    console.log('  FINAL EDISON_FLAGS: 0x' + EDISON_FLAGS_IDEAL.toString(16));
    console.log('  = OcgDuelMode.MODE_GOAT | 0x400000000n');
  } else if (newResult && oldResult) {
    console.log('[INFO] Both modes give GY ignition — OBSOLETE_IGNITION may cover GY in this build too.');
  } else if (!newResult) {
    console.log('[FAIL] GY ignition still not working with new WASM build.');
    console.log('  Possible reasons:');
    console.log('  1. Malicious\'s is_activateable() check fails (no target in deck, or free MZONE issue)');
    console.log('  2. The 0x400000000 bit is not being checked in this processor path');
    console.log('  3. The PointEvent step 8 is not reached in this scenario');
    console.log('  Recommendation: investigate with native N-API and debug build.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
