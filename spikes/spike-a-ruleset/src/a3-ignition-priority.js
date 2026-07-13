/**
 * A3 — Ignition-Effect Priority (OBSOLETE_IGNITION flag).
 *
 * Scenario:
 *   - Player 0 (turn player) Normal Summons Lonefire Blossom (passcode 48686504).
 *   - Player 1 has Bottomless Trap Hole (passcode 29401950) set face-down in the S/T zone.
 *
 * With OBSOLETE_IGNITION:
 *   After SUMMONED resolves, player 0 receives SELECT_CHAIN with Lonefire Blossom (48686504)
 *   in the selects list — the turn player's ignition effect is offered as Chain Link 1 BEFORE
 *   player 1's response window.
 *
 * Without OBSOLETE_IGNITION:
 *   After SUMMONED resolves, player 0 gets an empty SELECT_CHAIN and player 1 also gets an
 *   empty SELECT_CHAIN — no ignition priority window; turn player cannot activate ignition
 *   before the opponent's fast-effect timing.
 *
 * Note on GY ignition effects (DUEL_TCG_FAST_EFFECT_IGNITION):
 *   The research hypothesised a flag at 0x400000000 for TCG-style GY ignition priority
 *   (e.g. Plaguespreader Zombie, Destiny HERO – Malicious). This flag does NOT exist in the
 *   ocgcore-wasm 0.1.2 build — the WASM exposes no constant at that value. GOAT mode only
 *   includes OBSOLETE_IGNITION (0x100). Testing GY ignition priority is therefore DEFERRED
 *   until we can build a newer WASM or switch to native N-API. This is recorded as a gap.
 *
 * Cards used:
 *   48686504 — Lonefire Blossom (Plant / Effect / ATK 500, Ignition Effect: tribute a Plant
 *               to special summon a Plant from the deck). No cost limit in Edison pre-errata
 *               (the modern script has SetCountLimit(1) — noted as errata gap for Spike B).
 *   29401950 — Bottomless Trap Hole (Normal Trap, SS2, destroys monsters ≥1500 ATK on summon).
 */
import createCore, { OcgDuelMode, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';
import { EDISON_FLAGS, EDISON_NO_FIRST_DRAW } from './flags.js';

const LONEFIRE = 48686504;
const BTH      = 29401950;
const FILLER   = [32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611,
                  2863439, 2906250, 3134241, 3170832, 3606209, 4042268, 4148264, 5053103,
                  5265750, 5388481, 5434080, 5464695];

async function runScenario(flags, label) {
  // Each test gets its own core instance to avoid WASM state contamination
  const lib = await createCore({ sync: true });

  const handle = lib.createDuel({
    flags,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader:   (code) => getCard(code) ?? null,
    scriptReader: (name) => getScript(name) ?? null,
    errorHandler: (_type, text) => {
      if (!text.includes('deprecated') && !text.includes('missing card')) {
        process.stderr.write(`[script err] ${text.slice(0, 80)}\n`);
      }
    },
  });

  // Player 0: Lonefire Blossom in hand; another Lonefire in deck (for ignition effect's target)
  lib.duelNewCard(handle, { code: LONEFIRE, team: 0, duelist: 0, controller: 0, location: OcgLocation.HAND,  sequence: 0, position: OcgPosition.FACEUP   });
  lib.duelNewCard(handle, { code: LONEFIRE, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK,  sequence: 0, position: OcgPosition.FACEDOWN });
  for (const code of FILLER.slice(0, 18)) {
    lib.duelNewCard(handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  // Player 1: BTH face-down in S/T zone (simulates an available SS2 trap)
  lib.duelNewCard(handle, { code: BTH, team: 1, duelist: 0, controller: 1, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN });
  for (const code of FILLER.slice(0, 19)) {
    lib.duelNewCard(handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
  }

  lib.startDuel(handle);

  const state    = { respondedSummon: false, summoned: false };
  const chainOffers = [];
  const { WAITING, END } = { WAITING: 1, END: 0 };

  for (let i = 0; i < 3000; i++) {
    const status = lib.duelProcess(handle);
    const msgs   = lib.duelGetMessage(handle);

    for (const m of msgs) {
      if (m.type === OcgMessageType.SUMMONED) state.summoned = true;
      if (m.type === OcgMessageType.SELECT_CHAIN) {
        chainOffers.push({ player: m.player, selects: m.selects?.map(s => s.code) ?? [], afterSummoned: state.summoned });
      }
    }

    if (status === END) break;

    if (status === WAITING) {
      let r = null;
      for (const msg of msgs) {
        if (msg.type === OcgMessageType.SELECT_IDLECMD) {
          if (!state.respondedSummon) {
            const idx = msg.summons?.findIndex(s => s.code === LONEFIRE) ?? -1;
            if (idx >= 0) { r = { type: 1, action: 0, index: idx }; state.respondedSummon = true; break; }
          }
          r = { type: 1, action: 7 }; break; // TO_EP
        } else if (msg.type === OcgMessageType.SELECT_BATTLECMD)   { r = { type: 0, action: 3 }; break; }
        else if (msg.type === OcgMessageType.SELECT_EFFECTYN)       { r = { type: 2, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_YESNO)          { r = { type: 3, yes: false }; break; }
        else if (msg.type === OcgMessageType.SELECT_CHAIN)          { r = { type: 8, index: null }; break; }
        else if (msg.type === OcgMessageType.ROCK_PAPER_SCISSORS)   { r = { type: 20, value: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_PLACE)          { r = { type: 10, places: [{ player: msg.player, location: OcgLocation.MZONE, sequence: 0 }] }; break; }
        else if (msg.type === OcgMessageType.SELECT_POSITION)       { r = { type: 11, position: msg.positions & -msg.positions }; break; }
        else if (msg.type === OcgMessageType.SELECT_OPTION)         { r = { type: 4, index: 0 }; break; }
        else if (msg.type === OcgMessageType.SELECT_CARD)           { r = { type: 5, indicies: [0] }; break; }
        else if (msg.type === OcgMessageType.SELECT_TRIBUTE)        { r = { type: 12, indicies: [0] }; break; }
      }
      if (!r) break;
      lib.duelSetResponse(handle, r);
    }

    const postSummonedChains = chainOffers.filter(c => c.afterSummoned).length;
    if (state.summoned && postSummonedChains >= 2) break;
  }

  const postSummoned = chainOffers.filter(c => c.afterSummoned);
  return { label, postSummoned };
}

async function main() {
  console.log('=== A3: Ignition-Effect Priority ===\n');
  console.log('Setup:');
  console.log('  Player 0 (turn player): Lonefire Blossom [48686504] in hand');
  console.log('  Player 0 deck: 1× Lonefire Blossom (ignition effect target) + fillers');
  console.log('  Player 1 S/T zone: Bottomless Trap Hole [29401950] set face-down');
  console.log('');
  console.log('Assertion: with OBSOLETE_IGNITION flag, after Normal Summon of Lonefire resolves,');
  console.log('  player 0 receives SELECT_CHAIN with Lonefire [48686504] in selects');
  console.log('  BEFORE player 1 can respond (player 1 gets empty selects afterward).');
  console.log('');

  // WITH ignition priority
  const r1 = await runScenario(EDISON_FLAGS, 'WITH OBSOLETE_IGNITION (Edison flags)');
  console.log(`-- Test A3a: ${r1.label} --`);
  console.log('Post-SUMMONED chain offers:');
  for (const c of r1.postSummoned) {
    console.log(`  player=${c.player} selects=[${c.selects.join(',')}]`);
  }
  const ignitionOffer = r1.postSummoned.find(c => c.player === 0 && c.selects.includes(LONEFIRE));
  const opponentAfter = r1.postSummoned.find(c => c.player === 1 && r1.postSummoned.indexOf(c) > (r1.postSummoned.indexOf(ignitionOffer) ?? -1));
  const passA = !!ignitionOffer && !!opponentAfter;
  console.log(passA
    ? `  [PASS] Turn player (p=0) offered Lonefire [${LONEFIRE}] as CL1 BEFORE opponent's window ✓`
    : '  [FAIL] Turn player was NOT offered ignition effect before opponent');

  console.log('');

  // WITHOUT ignition priority
  const EDISON_NO_IGNITION = EDISON_FLAGS & ~OcgDuelMode.OBSOLETE_IGNITION;
  const r2 = await runScenario(EDISON_NO_IGNITION, 'WITHOUT OBSOLETE_IGNITION');
  console.log(`-- Test A3b: ${r2.label} --`);
  console.log('Post-SUMMONED chain offers:');
  for (const c of r2.postSummoned) {
    console.log(`  player=${c.player} selects=[${c.selects.join(',')}]`);
  }
  const noIgnitionOffer = r2.postSummoned.every(c => !c.selects.includes(LONEFIRE));
  console.log(noIgnitionOffer
    ? `  [PASS] Lonefire [${LONEFIRE}] NOT offered as CL1 (no ignition priority) ✓`
    : '  [FAIL] Ignition effect appeared despite flag being off');

  console.log('');
  console.log('--- A3 Verdict ---');
  if (passA && noIgnitionOffer) {
    console.log('[PASS] A3: DUEL_OBSOLETE_IGNITION flag EMPIRICALLY CONFIRMED.');
    console.log('       Turn player IS offered ignition effect as CL1 after summon — before opponent window.');
    console.log('');
    console.log('Note: Research also hypothesised DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000) for');
    console.log('      GY ignition effects (Plaguespreader, Malicious). This flag is NOT exposed in');
    console.log('      ocgcore-wasm 0.1.2. GOAT preset only has OBSOLETE_IGNITION (0x100).');
    console.log('      GY ignition priority test is DEFERRED (gap item for architecture decision).');
    console.log('');
    console.log('Cards verified:');
    console.log(`  [48686504] Lonefire Blossom — Ignition Effect confirmed activatable as CL1`);
    console.log(`  [29401950] Bottomless Trap Hole — confirmed present in test setup (SS2 trap)`);
    console.log('');
    console.log('Errata note: Modern Lonefire script has SetCountLimit(1) (hard OPT).');
    console.log('  Edison pre-errata: NO once-per-turn limit (format-defining card).');
    console.log('  Pre-errata script curation is a Spike B item.');
  } else {
    console.log('[FAIL] A3: Flag behavior not as expected');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
