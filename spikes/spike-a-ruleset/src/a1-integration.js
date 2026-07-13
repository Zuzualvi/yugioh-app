/**
 * A1 — Integration proof.
 * Create a duel with Edison flags, drive through 6 turns via scripted responses.
 */
import { OcgMessageType, OcgDuelMode, OcgProcessResult } from 'ocgcore-wasm';
import { getLib, createDuel, fillerDeck, passResponder, runLoop, msgTypeName } from './harness.js';
import { EDISON_FLAGS } from './flags.js';

async function main() {
  console.log('=== A1: Integration Proof ===\n');
  console.log('Edison duelFlags (hex):', '0x' + EDISON_FLAGS.toString(16));
  console.log('OcgDuelMode.MODE_GOAT: ', '0x' + OcgDuelMode.MODE_GOAT.toString(16));
  console.log('Same as MODE_GOAT?     ', EDISON_FLAGS === OcgDuelMode.MODE_GOAT);
  console.log('');

  const lib = await getLib();
  const deck = fillerDeck();
  console.log(`Deck (each player): ${deck.length} normal-monster filler cards`);
  console.log('OcgProcessResult: END=', OcgProcessResult.END, 'WAITING=', OcgProcessResult.WAITING, 'CONTINUE=', OcgProcessResult.CONTINUE);
  console.log('');

  const { handle } = createDuel(lib, EDISON_FLAGS, deck, [...deck]);

  let turnCount = 0;
  const all = runLoop(lib, handle, {
    respond: passResponder,
    shouldStop: (all, msgs) => {
      for (const m of msgs) {
        if (m.type === OcgMessageType.NEW_TURN) turnCount++;
        if (m.type === OcgMessageType.WIN) return true;
      }
      return turnCount >= 6;
    },
    verbose: true,
    maxIter: 50000,
  });

  const byType = {};
  for (const m of all) byType[msgTypeName(m.type)] = (byType[msgTypeName(m.type)] ?? 0) + 1;

  const draws  = all.filter(m => m.type === OcgMessageType.DRAW);
  const phases = all.filter(m => m.type === OcgMessageType.NEW_PHASE);
  const turns  = all.filter(m => m.type === OcgMessageType.NEW_TURN);
  const chains = all.filter(m => m.type === OcgMessageType.SELECT_CHAIN);

  console.log('\n--- A1 Summary ---');
  console.log(`Total messages:  ${all.length}`);
  console.log(`Turns:           ${turns.length}`);
  console.log(`Phase changes:   ${phases.length}`);
  console.log(`Draw events:     ${draws.length} (${draws.reduce((s, m) => s + (m.drawn?.length ?? 0), 0)} cards total)`);
  console.log(`Chain prompts:   ${chains.length}`);

  console.log('\nFirst 20 messages:');
  for (const m of all.slice(0, 20)) {
    const det = m.type === OcgMessageType.DRAW ? ` player=${m.player} cards=${m.drawn?.length}`
              : m.type === OcgMessageType.NEW_TURN ? ` player=${m.player}`
              : m.type === OcgMessageType.NEW_PHASE ? ` phase=0x${m.phase?.toString(16)}`
              : '';
    console.log(`  ${msgTypeName(m.type)}${det}`);
  }

  console.log('\nMessage histogram:');
  for (const [n, c] of Object.entries(byType).sort(([,a],[,b]) => b-a)) {
    console.log(`  ${n}: ${c}`);
  }

  const pass = turns.length >= 4 && draws.length >= 2 && phases.length >= 4;
  console.log('\n' + (pass
    ? '[PASS] A1: Engine integration confirmed — turns, draws, phase transitions all observed'
    : '[FAIL] A1: Insufficient duel activity'));
  if (!pass) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
