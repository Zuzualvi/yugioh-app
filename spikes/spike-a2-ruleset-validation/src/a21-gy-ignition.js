/**
 * A2-1 — GY Ignition Priority: does raw bit 0x400000000 work in ocgcore-wasm 0.1.2?
 *
 * Background:
 *   - Current edo9300/ygopro-core (master) defines:
 *       #define DUEL_TCG_FAST_EFFECT_IGNITION 0x400000000
 *       DUEL_MODE_GOAT includes this flag
 *   - ocgcore-wasm 0.1.2 JS bindings DO NOT expose this constant and their
 *     MODE_GOAT = 0x3f80d072c (missing the 0x400000000 bit).
 *   - The submodule used by n1xx1/ocgcore-wasm (commit 79dbfc79) points to
 *     edo9300/ygopro-core branch=master. If it was built from a version that
 *     already had TCG_FAST_EFFECT_IGNITION in the C++ source, the WASM binary
 *     would respond to that bit even though the JS bindings omit the constant.
 *
 * Test:
 *   Setup: Player 0 has D-HERO Malicious [9411399] in GY (GY ignition effect:
 *          banish self, special summon another Malicious from deck) and another
 *          Malicious in deck (as the target). Player 0 normal summons a filler
 *          monster. After SUMMONED, check SELECT_CHAIN selects for player 0.
 *
 *   Expected if TCG_FAST_EFFECT_IGNITION IS in the compiled WASM:
 *     With MODE_GOAT | 0x400000000n: SELECT_CHAIN p=0 codes=[9411399] (GY priority)
 *     With MODE_GOAT (no extra bit): SELECT_CHAIN p=0 codes=[] (no GY priority)
 *
 *   Expected if TCG_FAST_EFFECT_IGNITION is NOT in the compiled WASM:
 *     Both produce the same result (empty selects or no difference).
 */
import createCore, { OcgDuelMode, OcgMessageType, OcgLocation, OcgPosition } from 'ocgcore-wasm';
import { freshLib, makeDuel, runLoop, passRespond, FILLER, MALICIOUS, KOUMORI_DRAGON, BTH, msgTypeName } from './harness.js';

const TCG_FAST_EFFECT_IGNITION = 0x400000000n;

async function runGYIgnitionScenario(flags, label) {
  const lib = await freshLib();

  // Player 0: Malicious in GY, another in deck (target), filler monster in hand to summon
  const { handle } = makeDuel(lib, flags,
    [KOUMORI_DRAGON, ...FILLER.slice(0, 18)], // deck (Koumori + fillers)
    [...FILLER.slice(0, 19)],                  // opponent deck (fillers)
    {
      extraCards1: [
        { code: MALICIOUS, location: OcgLocation.GRAVE },              // Malicious in GY
        { code: MALICIOUS, location: OcgLocation.DECK },               // Malicious in deck (target)
        { code: KOUMORI_DRAGON, location: OcgLocation.HAND, position: OcgPosition.FACEUP }, // to summon
      ],
      extraCards2: [
        { code: BTH, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN },
      ],
    }
  );

  const state = { summoned: false, respondedSummon: false };
  const chainOffers = [];

  const msgs = runLoop(lib, handle,
    (all, msgs) => passRespond(msgs, {
      onIdleCmd: (msg) => {
        if (!state.respondedSummon) {
          const idx = msg.summons?.findIndex(s => s.code === KOUMORI_DRAGON) ?? -1;
          if (idx >= 0) { state.respondedSummon = true; return { type: 1, action: 0, index: idx }; }
        }
        return null; // fall through to TO_EP
      },
    }),
    (all, msgs) => {
      for (const m of msgs) {
        if (m.type === OcgMessageType.SUMMONED) state.summoned = true;
        if (m.type === OcgMessageType.SELECT_CHAIN && state.summoned) {
          chainOffers.push({ player: m.player, selects: m.selects?.map(s => s.code) ?? [] });
        }
      }
      return state.summoned && chainOffers.length >= 2;
    },
    3000
  );

  const postSummoned = chainOffers;
  console.log(`\n--- ${label} ---`);
  console.log('flags: 0x' + flags.toString(16));
  console.log('Post-SUMMONED chain offers:');
  for (const c of postSummoned) {
    console.log(`  SELECT_CHAIN player=${c.player} selects=[${c.selects.join(',')}]`);
  }
  const gyIgnitionOffered = postSummoned.some(c => c.player === 0 && c.selects.includes(MALICIOUS));
  console.log(`  GY ignition (Malicious [${MALICIOUS}]) offered to turn player: ${gyIgnitionOffered}`);
  return gyIgnitionOffered;
}

async function main() {
  console.log('=== A2-1: GY Ignition Priority — TCG_FAST_EFFECT_IGNITION (0x400000000) ===\n');

  console.log('Source investigation findings:');
  console.log('  ocgcore-wasm@0.1.2 git commit: 79dbfc79469e0a89558506405dd1589e68f150fe');
  console.log('  Submodule: cpp/ygo → https://github.com/edo9300/ygopro-core.git (branch: master)');
  console.log('  Current edo9300 ocgapi_constants.h defines:');
  console.log('    #define DUEL_TCG_FAST_EFFECT_IGNITION 0x400000000');
  console.log('    DUEL_MODE_GOAT INCLUDES this flag in the C++ source');
  console.log('  But ocgcore-wasm@0.1.2 JS bindings:');
  console.log('    - Do NOT expose TCG_FAST_EFFECT_IGNITION as a named constant');
  console.log('    - MODE_GOAT = 0x3f80d072c (missing the 0x400000000 bit)');
  console.log('  KEY QUESTION: Was the WASM built from a edo9300 commit that already');
  console.log('  had this flag in the C++ logic (in which case raw OR-in works),');
  console.log('  or from an older commit that did not (in which case the bit is dead)?');
  console.log('');
  console.log('Setup: Player 0 normal summons Koumori Dragon [' + KOUMORI_DRAGON + ']');
  console.log('       Player 0 GY: D-HERO Malicious [' + MALICIOUS + '] (GY ignition, LOCATION_GRAVE)');
  console.log('       Player 0 deck: another D-HERO Malicious (target for effect)');
  console.log('       Player 1: BTH face-down');
  console.log('');
  console.log('Assertion: if 0x400000000 is live in the WASM, player 0 receives');
  console.log('  SELECT_CHAIN with Malicious [' + MALICIOUS + '] in selects after SUMMONED.');
  console.log('');

  // Baseline: MODE_GOAT (OBSOLETE_IGNITION = 0x100, no GY flag)
  const base1 = await runGYIgnitionScenario(OcgDuelMode.MODE_GOAT, 'Baseline: MODE_GOAT (no 0x400000000)');

  // With raw bit OR-in
  const withBit = await runGYIgnitionScenario(OcgDuelMode.MODE_GOAT | TCG_FAST_EFFECT_IGNITION, 'With MODE_GOAT | 0x400000000n');

  // Without any ignition flags (control)
  const noIgnition = OcgDuelMode.MODE_GOAT & ~OcgDuelMode.OBSOLETE_IGNITION;
  const base2 = await runGYIgnitionScenario(noIgnition, 'Control: no ignition flags');

  console.log('\n=== A2-1 Verdict ===\n');
  console.log(`MODE_GOAT (baseline):         GY ignition offered = ${base1}`);
  console.log(`MODE_GOAT | 0x400000000n:     GY ignition offered = ${withBit}`);
  console.log(`No ignition flags (control):  GY ignition offered = ${base2}`);
  console.log('');

  if (withBit && !base1) {
    console.log('[PASS] ✅ TCG_FAST_EFFECT_IGNITION IS COMPILED INTO THE WASM.');
    console.log('  The raw bit 0x400000000n works — ORing it into MODE_GOAT activates GY ignition priority.');
    console.log('  The JS bindings just omit the named constant; the C++ logic is present in the binary.');
    console.log('');
    console.log('RECOMMENDATION: Use (MODE_GOAT | 0x400000000n) as the Edison duelFlags.');
    console.log('  - This = MODE_GOAT + TCG_FAST_EFFECT_IGNITION');
    console.log('  - No rebuild required. No native N-API needed.');
    console.log('  - EFFORT: zero — just add the raw bit to the JS constant.');
  } else if (!withBit && !base1) {
    console.log('[RESULT] ❌ TCG_FAST_EFFECT_IGNITION is NOT compiled into this WASM build.');
    console.log('  The bit 0x400000000n has no effect. The WASM was built from an older edo9300');
    console.log('  commit that did not yet have this flag in the processor logic.');
    console.log('');
    console.log('RECOMMENDATION: Build a newer WASM from current edo9300 master, which has');
    console.log('  TCG_FAST_EFFECT_IGNITION in DUEL_MODE_GOAT. Steps:');
    console.log('  1. Install emscripten toolchain (~30 min)');
    console.log('  2. Clone n1xx1/ocgcore-wasm, update cpp/ygo submodule to latest edo9300 master');
    console.log('  3. Run scripts/build.sh (~10 min)');
    console.log('  4. Bump version and use local build');
    console.log('  ALTERNATIVE: Fall back to native shared-lib via N-API (more infra, more reliable).');
  } else if (withBit && base1) {
    console.log('[RESULT] ⚠️  OBSOLETE_IGNITION already covers GY effects in this build.');
    console.log('  Both modes give GY ignition — the distinction between OCG/TCG variants');
    console.log('  may not apply in this WASM version. Flag difference not observable.');
  } else {
    console.log('[RESULT] ⚠️  Neither flag activates GY ignition — unexpected. Scenario setup may need review.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
