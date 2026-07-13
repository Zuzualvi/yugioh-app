/**
 * A2 — First-Turn Draw (FIRST_TURN_DRAW flag).
 *
 * Assert: WITH the flag, player 0 (going first) has 6 cards after turn-1 Draw Phase.
 *         WITHOUT the flag, player 0 has 5 cards (no draw, modern rule).
 *
 * Methodology: run the duel until the first SELECT_IDLECMD (turn 1 main phase 1),
 * then count how many cards were drawn by player 0.
 */
import { OcgMessageType, OcgDuelMode } from 'ocgcore-wasm';
import { getLib, createDuel, fillerDeck, passResponder, runLoop, countDrawn, msgTypeName } from './harness.js';
import { EDISON_FLAGS, EDISON_NO_FIRST_DRAW } from './flags.js';

function runUntilFirstMainPhase(lib, flags) {
  const deck = fillerDeck();
  const { handle } = createDuel(lib, flags, deck, [...deck]);

  const all = runLoop(lib, handle, {
    respond: passResponder,
    shouldStop: (all, msgs) => {
      // Stop right after the first SELECT_IDLECMD (= Main Phase 1 of turn 1 for the turn player)
      return msgs.some(m => m.type === OcgMessageType.SELECT_IDLECMD);
    },
    maxIter: 10000,
  });

  return all;
}

async function main() {
  console.log('=== A2: First-Turn Draw Validation ===\n');

  const lib = await getLib();

  // ── WITH FIRST_TURN_DRAW ────────────────────────────────────────────────────
  console.log('-- Test A2a: Edison flags (FIRST_TURN_DRAW set) --');
  const msgsWith = runUntilFirstMainPhase(lib, EDISON_FLAGS);
  const drawnWithPlayer0 = countDrawn(msgsWith, 0);
  const drawnWithPlayer1 = countDrawn(msgsWith, 1);

  console.log('Messages until first Main Phase 1:');
  for (const m of msgsWith) {
    if (m.type === OcgMessageType.DRAW || m.type === OcgMessageType.NEW_TURN || m.type === OcgMessageType.NEW_PHASE) {
      const det = m.type === OcgMessageType.DRAW ? ` player=${m.player} cards=${m.drawn?.length} [${m.drawn?.map(d => d.code).join(',')}]`
                : m.type === OcgMessageType.NEW_TURN ? ` player=${m.player}`
                : ` phase=0x${m.phase?.toString(16)}`;
      console.log(`  ${msgTypeName(m.type)}${det}`);
    }
  }
  console.log(`  → Player 0 total cards drawn: ${drawnWithPlayer0}`);
  console.log(`  → Player 1 total cards drawn: ${drawnWithPlayer1}`);
  const passA = drawnWithPlayer0 === 6;
  console.log(passA
    ? '  [PASS] Player 0 drew 6 cards (5 starting + 1 turn-1 draw) ✓'
    : `  [FAIL] Expected 6, got ${drawnWithPlayer0}`);

  console.log('');

  // ── WITHOUT FIRST_TURN_DRAW ─────────────────────────────────────────────────
  console.log('-- Test A2b: No FIRST_TURN_DRAW flag --');
  const msgsWithout = runUntilFirstMainPhase(lib, EDISON_NO_FIRST_DRAW);
  const drawnWithoutPlayer0 = countDrawn(msgsWithout, 0);
  const drawnWithoutPlayer1 = countDrawn(msgsWithout, 1);

  for (const m of msgsWithout) {
    if (m.type === OcgMessageType.DRAW || m.type === OcgMessageType.NEW_TURN || m.type === OcgMessageType.NEW_PHASE) {
      const det = m.type === OcgMessageType.DRAW ? ` player=${m.player} cards=${m.drawn?.length}`
                : m.type === OcgMessageType.NEW_TURN ? ` player=${m.player}`
                : ` phase=0x${m.phase?.toString(16)}`;
      console.log(`  ${msgTypeName(m.type)}${det}`);
    }
  }
  console.log(`  → Player 0 total cards drawn: ${drawnWithoutPlayer0}`);
  console.log(`  → Player 1 total cards drawn: ${drawnWithoutPlayer1}`);
  const passB = drawnWithoutPlayer0 === 5;
  console.log(passB
    ? '  [PASS] Player 0 drew 5 cards (no turn-1 draw, modern rule) ✓'
    : `  [FAIL] Expected 5, got ${drawnWithoutPlayer0}`);

  console.log('');
  console.log('--- A2 Verdict ---');
  console.log(`FIRST_TURN_DRAW flag:  WITH=6 cards  WITHOUT=5 cards`);
  console.log(`Expected:              WITH=6 cards  WITHOUT=5 cards`);
  if (passA && passB) {
    console.log('[PASS] A2: DUEL_1ST_TURN_DRAW (FIRST_TURN_DRAW) flag EMPIRICALLY CONFIRMED.');
    console.log('       The flag gates first-player turn-1 draw exactly as expected.');
  } else {
    console.log('[FAIL] A2: Unexpected card counts — flag behavior differs from expectation');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
