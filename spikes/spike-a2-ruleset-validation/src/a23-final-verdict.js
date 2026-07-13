/**
 * A2-3 — Final Edison duelFlags Recommendation
 *
 * Synthesises all findings from Spike A and A2-1/A2-2 into a definitive recommendation.
 */
import { OcgDuelMode } from 'ocgcore-wasm';

export async function main() {
  console.log('=== A2-3: Final Edison duelFlags Recommendation ===\n');

  // ── What we know about the flags ──────────────────────────────────────────

  const {
    OBSOLETE_IGNITION, FIRST_TURN_DRAW, ONE_FACEUP_FIELD,
    SPSUMMON_ONCE_OLD_NEGATE, RETURN_TO_DECK_TRIGGERS, CANNOT_SUMMON_OATH_OLD,
    USE_TRAPS_IN_NEW_CHAIN, SIX_STEP_BATLLE_STEP, TRIGGER_WHEN_PRIVATE_KNOWLEDGE,
    EQUIP_NOT_SENT_IF_MISSING_TARGET, ZERO_ATK_DESTROYED, STORE_ATTACK_REPLAYS,
    SINGLE_CHAIN_IN_DAMAGE_SUBSTEP, CAN_REPOS_IF_NON_SUMPLAYER,
    TCG_SEGOC_NONPUBLIC, TCG_SEGOC_FIRSTTRIGGER, MODE_GOAT,
  } = OcgDuelMode;

  const TCG_FAST_EFFECT_IGNITION = 0x400000000n; // NOT in npm package, but exists in current edo9300 source

  // ── Current best flag set ─────────────────────────────────────────────────

  const EDISON_FLAGS_0_1_2 = MODE_GOAT; // 0x3f80d072c — what we use with ocgcore-wasm 0.1.2

  const EDISON_FLAGS_IDEAL =
    OBSOLETE_IGNITION | TCG_FAST_EFFECT_IGNITION | // ignition priority (both MZone + GY)
    FIRST_TURN_DRAW |
    ONE_FACEUP_FIELD |
    SPSUMMON_ONCE_OLD_NEGATE | RETURN_TO_DECK_TRIGGERS | CANNOT_SUMMON_OATH_OLD |
    USE_TRAPS_IN_NEW_CHAIN |
    SIX_STEP_BATLLE_STEP |
    TRIGGER_WHEN_PRIVATE_KNOWLEDGE |
    EQUIP_NOT_SENT_IF_MISSING_TARGET |
    ZERO_ATK_DESTROYED |
    STORE_ATTACK_REPLAYS |
    SINGLE_CHAIN_IN_DAMAGE_SUBSTEP |
    CAN_REPOS_IF_NON_SUMPLAYER |
    TCG_SEGOC_NONPUBLIC |
    TCG_SEGOC_FIRSTTRIGGER;

  console.log('── For use with ocgcore-wasm 0.1.2 (current npm package) ──────────────────');
  console.log('');
  console.log('  const EDISON_FLAGS = OcgDuelMode.MODE_GOAT; // 0x' + EDISON_FLAGS_0_1_2.toString(16));
  console.log('');
  console.log('  THIS IS THE SAME AS MODE_GOAT. No modifications needed for now.');
  console.log('  GY ignition flag (0x400000000) is absent from this build (raw bit has no effect).');
  console.log('');

  console.log('── Ideal flag set (requires newer WASM or native N-API) ─────────────────────');
  console.log('');
  console.log('  const EDISON_FLAGS_IDEAL = ');
  console.log('    OcgDuelMode.OBSOLETE_IGNITION         | // 0x100        OCG ignition (MZone)');
  console.log('    0x400000000n                          | // TCG_FAST_EFFECT_IGNITION (GY ignition)');
  console.log('    OcgDuelMode.FIRST_TURN_DRAW           | // 0x200');
  console.log('    OcgDuelMode.ONE_FACEUP_FIELD          | // 0x400');
  console.log('    OcgDuelMode.SPSUMMON_ONCE_OLD_NEGATE  | // 0x40000');
  console.log('    OcgDuelMode.RETURN_TO_DECK_TRIGGERS   | // 0x10000');
  console.log('    OcgDuelMode.CANNOT_SUMMON_OATH_OLD    | // 0x80000');
  console.log('    OcgDuelMode.USE_TRAPS_IN_NEW_CHAIN    | // 0x4');
  console.log('    OcgDuelMode.SIX_STEP_BATLLE_STEP      | // 0x8');
  console.log('    OcgDuelMode.TRIGGER_WHEN_PRIVATE_KNOWLEDGE | // 0x20');
  console.log('    OcgDuelMode.EQUIP_NOT_SENT_IF_MISSING_TARGET | // 0x8000000');
  console.log('    OcgDuelMode.ZERO_ATK_DESTROYED        | // 0x10000000');
  console.log('    OcgDuelMode.STORE_ATTACK_REPLAYS      | // 0x20000000');
  console.log('    OcgDuelMode.SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | // 0x40000000');
  console.log('    OcgDuelMode.CAN_REPOS_IF_NON_SUMPLAYER | // 0x80000000');
  console.log('    OcgDuelMode.TCG_SEGOC_NONPUBLIC       | // 0x100000000');
  console.log('    OcgDuelMode.TCG_SEGOC_FIRSTTRIGGER;   // 0x200000000');
  console.log('  // = 0x' + EDISON_FLAGS_IDEAL.toString(16));
  console.log('');
  console.log('  = MODE_GOAT | TCG_FAST_EFFECT_IGNITION');
  console.log('  = 0x' + MODE_GOAT.toString(16) + ' | 0x400000000 = 0x' + (MODE_GOAT | TCG_FAST_EFFECT_IGNITION).toString(16));
  console.log('');

  // ── Per-flag status table ─────────────────────────────────────────────────

  console.log('── Per-flag validation status ───────────────────────────────────────────────');
  console.log('');
  console.log('Flag                          | Hex         | Status                   | Edison 2010 correct?');
  console.log('------------------------------|-------------|--------------------------|---------------------');
  console.log('FIRST_TURN_DRAW               | 0x200       | EMPIRICALLY CONFIRMED A2 | YES');
  console.log('ONE_FACEUP_FIELD              | 0x400       | EMPIRICALLY CONFIRMED A4 | YES');
  console.log('OBSOLETE_IGNITION             | 0x100       | EMPIRICALLY CONFIRMED A3 | YES (MZone effects)');
  console.log('TCG_FAST_EFFECT_IGNITION      | 0x400000000 | NOT IN WASM 0.1.2        | YES (needed for GY)');
  console.log('ZERO_ATK_DESTROYED            | 0x10000000  | EMPIRICALLY CONFIRMED A2-2a | YES');
  console.log('SIX_STEP_BATLLE_STEP          | 0x8         | EMPIRICALLY CONFIRMED A2-2b | YES (pre-2014)');
  console.log('SINGLE_CHAIN_IN_DAMAGE_SUBSTEP| 0x40000000  | SOURCE-VERIFIED          | YES (pre-2014)');
  console.log('TCG_SEGOC_FIRSTTRIGGER        | 0x200000000 | SOURCE-VERIFIED          | YES (pre-2017)');
  console.log('TCG_SEGOC_NONPUBLIC           | 0x100000000 | SOURCE-VERIFIED          | YES (TCG SEGOC)');
  console.log('USE_TRAPS_IN_NEW_CHAIN        | 0x4         | SOURCE-VERIFIED          | YES (pre-2014)');
  console.log('TRIGGER_WHEN_PRIVATE_KNOWLEDGE| 0x20        | SOURCE-VERIFIED          | YES');
  console.log('EQUIP_NOT_SENT_IF_MISSING_TARG| 0x8000000   | SOURCE-VERIFIED          | YES');
  console.log('STORE_ATTACK_REPLAYS          | 0x20000000  | SOURCE-VERIFIED          | YES');
  console.log('CAN_REPOS_IF_NON_SUMPLAYER    | 0x80000000  | SOURCE-VERIFIED          | YES');
  console.log('SPSUMMON_ONCE_OLD_NEGATE      | 0x40000     | SOURCE-VERIFIED (MR1)    | YES');
  console.log('RETURN_TO_DECK_TRIGGERS       | 0x10000     | SOURCE-VERIFIED (MR1)    | YES');
  console.log('CANNOT_SUMMON_OATH_OLD        | 0x80000     | SOURCE-VERIFIED (MR1)    | YES');
  console.log('');

  // ── GY Ignition gap ──────────────────────────────────────────────────────

  console.log('── GY Ignition Gap (HIGH priority) ─────────────────────────────────────────');
  console.log('');
  console.log('FINDING: TCG_FAST_EFFECT_IGNITION (0x400000000) exists in current edo9300 master');
  console.log('  (ocgapi_constants.h: #define DUEL_TCG_FAST_EFFECT_IGNITION 0x400000000)');
  console.log('  and MODE_GOAT in the C++ source INCLUDES it. However:');
  console.log('  - ocgcore-wasm@0.1.2 JS bindings DO NOT expose it');
  console.log('  - MODE_GOAT in the JS = 0x3f80d072c (missing 0x400000000)');
  console.log('  - Raw bit OR-in (0x400000000n | MODE_GOAT) empirically tested → NO EFFECT');
  console.log('  - Conclusion: WASM was built from an older edo9300 commit that lacked the C++');
  console.log('    processor logic for this flag. The bit is dead in this binary.');
  console.log('');
  console.log('WHAT DOES THIS MEAN FOR ACCURACY?');
  console.log('  With ONLY OBSOLETE_IGNITION: the turn player gets priority to activate ignition');
  console.log('  effects of monsters IN THE MONSTER ZONE (face-up on field) before opponents.');
  console.log('  This covers: Lonefire Blossom, any face-up monster with ignition effect.');
  console.log('');
  console.log('  MISSING: GY ignition priority. In Edison TCG, a player can also activate the');
  console.log('  ignition effect of a monster in the GY (e.g. Plaguespreader Zombie [33420078],');
  console.log('  D-HERO Malicious [9411399]) as Chain Link 1 BEFORE the opponent responds.');
  console.log('  Without TCG_FAST_EFFECT_IGNITION, this does NOT happen — the opponent gets their');
  console.log('  response window first after a summon, and can activate BTH before you use Malicious.');
  console.log('');
  console.log('  PRACTICAL IMPACT: GY ignition effects (Malicious, Plaguespreader) are key cards');
  console.log('  in Edison. Missing this priority is a MEDIUM-HIGH accuracy gap. It changes:');
  console.log('  - Whether you can activate Malicious GY effect before BTH banishes a monster');
  console.log('  - Whether Plaguespreader from GY can be activated as CL1 in response windows');
  console.log('');
  console.log('RECOMMENDATION TO CLOSE THE GAP:');
  console.log('');
  console.log('  Option 1 (RECOMMENDED): Build a newer ocgcore-wasm from current edo9300 master.');
  console.log('    Effort: 1-2 hours of toolchain setup + build. emscripten is NOT installed on');
  console.log('    this machine but can be installed in ~15 min (emsdk from GitHub). The build');
  console.log('    script is at n1xx1/ocgcore-wasm/scripts/build.sh; just need to update the');
  console.log('    cpp/ygo submodule to current master and run the script. The built WASM can be');
  console.log('    used in-place (no npm publish needed). Key advantage: gets TCG_FAST_EFFECT_IGNITION');
  console.log('    at no extra architectural cost (same Node sync API, same bindings pattern).');
  console.log('');
  console.log('  Option 2: Native N-API binding (ocgcore.so + ffi or node-addon-api).');
  console.log('    Uses current edo9300 master directly. More reliable (no emscripten). More');
  console.log('    infra: need a C++ compiler, node-gyp, and to author N-API bindings. For');
  console.log('    the ARCHITECTURE DECISION, Option A (native N-API server) was already the');
  console.log('    recommended architecture in Spike A; this just moves the WASM path to a');
  console.log('    build-your-own-WASM path instead of native.');
  console.log('');
  console.log('  Option 3: Accept the gap for the initial build, document it in the accuracy');
  console.log('    disclosure. MZone ignition priority (OBSOLETE_IGNITION) still works. Revisit');
  console.log('    when time allows. Risk: format-defining cards (Malicious, Plaguespreader)');
  console.log('    will have incorrect priority behavior.');
  console.log('');
  console.log('  → For a private friends group who understand the gap: Option 3 is acceptable');
  console.log('    short-term. For "accuracy is sacred" promise: Option 1 is the right path.');
  console.log('');

  // ── Residual gap list ─────────────────────────────────────────────────────

  console.log('── Residual Gap List (post A2) ─────────────────────────────────────────────');
  console.log('');
  console.log('GAP-1 [HIGH]  GY ignition priority. TCG_FAST_EFFECT_IGNITION absent from WASM 0.1.2.');
  console.log('              Affects: D-HERO Malicious [9411399], Plaguespreader Zombie [33420078],');
  console.log('              and any other GY ignition effect card.');
  console.log('              Fix: build newer WASM or use native N-API (1-2 hours of toolchain work).');
  console.log('');
  console.log('GAP-2 [MEDIUM] Card-level pre-errata (Spike B). ~35 "functional errata" cards');
  console.log('              ship with modern errata in ProjectIgnis scripts. Key cards:');
  console.log('              Brionac [50321796] (hard OPT in modern, NO OPT in Edison),');
  console.log('              Sangan [26202165], Rescue Cat [14878871], Ryko [21502796],');
  console.log('              Treeborn Frog [12538374], Black Garden [71645242].');
  console.log('              Fix: curate per-errata scripts for these ~35 cards.');
  console.log('');
  console.log('GAP-3 [LOW]   SINGLE_CHAIN_IN_DAMAGE_SUBSTEP: source-verified but not');
  console.log('              behaviorally tested. Needs a scenario with multiple simultaneous');
  console.log('              activatable effects during a specific damage substep.');
  console.log('');
  console.log('GAP-4 [LOW]   TCG_SEGOC_FIRSTTRIGGER: source-verified correct for 2010 but');
  console.log('              no empirical test of ordering behavior. Needs two simultaneous-');
  console.log('              trigger cards in one destruction event.');
  console.log('');

  // ── Final recommendation ──────────────────────────────────────────────────

  console.log('── FINAL RECOMMENDATION ─────────────────────────────────────────────────────');
  console.log('');
  console.log('For ocgcore-wasm 0.1.2 (current state, NOT ideal):');
  console.log('  duelFlags = OcgDuelMode.MODE_GOAT  // 0x3f80d072c');
  console.log('  Accuracy: MZone ignition priority, first-turn draw, single field spell, old');
  console.log('  damage step, 0-ATK rule, SEGOC — all validated. GY ignition MISSING.');
  console.log('');
  console.log('For production (once WASM is updated or N-API used):');
  console.log('  duelFlags = OcgDuelMode.MODE_GOAT | 0x400000000n  // 0x7f80d072c');
  console.log('  = full Edison ruleset including GY ignition priority');
  console.log('  This = MODE_GOAT + DUEL_TCG_FAST_EFFECT_IGNITION');
  console.log('');
  console.log('[PASS] A2-3: Final flag recommendation delivered.');
}

main().catch(e => { console.error(e); process.exit(1); });
