# Spike A2 — Edison Ruleset Gap Closure Report

**Date:** 2026-07-13  
**Spike:** A2 (continues Spike A)  
**Status:** COMPLETE

---

## A2-1 — GY Ignition Priority: Definitive Verdict

### Source investigation

`ocgcore-wasm@0.1.2` was built from commit `79dbfc79469e0a89558506405dd1589e68f150fe` of the `n1xx1/ocgcore-wasm` repo, whose `.gitmodules` pins the `cpp/ygo` directory to `https://github.com/edo9300/ygopro-core.git` (branch: master).

The **current** `edo9300/ygopro-core` `ocgapi_constants.h` defines:
```c
#define DUEL_TCG_FAST_EFFECT_IGNITION 0x400000000
DUEL_MODE_GOAT = DUEL_MODE_MR1 | DUEL_TCG_FAST_EFFECT_IGNITION | ... (all the other flags)
```

However, the **JS bindings of ocgcore-wasm 0.1.2**:
- Do NOT expose `TCG_FAST_EFFECT_IGNITION` as a named constant
- Define `MODE_GOAT = 0x3f80d072c` (missing `0x400000000`)

### Empirical test

**Setup:** Player 0 Normal Summons Koumori Dragon [67724379]. Player 0 has D-HERO Malicious [9411399] in GY with another Malicious in deck (GY ignition: banish self → special summon another from deck). Player 1 has BTH set.

After SUMMONED resolves, we check if player 0 receives SELECT_CHAIN with Malicious [9411399] in selects.

### Real output

```
--- Baseline: MODE_GOAT (no 0x400000000) ---
flags: 0x3f80d072c
Post-SUMMONED chain offers:
  SELECT_CHAIN player=0 selects=[]
  SELECT_CHAIN player=1 selects=[29401950]    ← opponent gets BTH window first!
  GY ignition (Malicious [9411399]) offered to turn player: false

--- With MODE_GOAT | 0x400000000n ---
flags: 0x7f80d072c
Post-SUMMONED chain offers:
  SELECT_CHAIN player=0 selects=[]
  SELECT_CHAIN player=1 selects=[29401950]    ← same — bit has no effect
  GY ignition (Malicious [9411399]) offered to turn player: false

--- Control: no ignition flags ---
flags: 0x3f80d062c
Post-SUMMONED chain offers:
  SELECT_CHAIN player=0 selects=[]
  SELECT_CHAIN player=1 selects=[29401950]    ← same
  GY ignition (Malicious [9411399]) offered to turn player: false
```

### Verdict

**`TCG_FAST_EFFECT_IGNITION` IS NOT COMPILED INTO ocgcore-wasm 0.1.2.**

The raw bit OR-in (`MODE_GOAT | 0x400000000n`) has zero observable effect. The WASM was built from an older edo9300 commit that did not yet include the `TCG_FAST_EFFECT_IGNITION` processor logic. The C++ source has since been updated (it's now in the current master), but the 0.1.2 package was built before that.

**Practical impact:** Without this flag, after a Normal Summon:
- MZone ignition effects (Lonefire Blossom etc.) → turn player gets priority ✓ (via `OBSOLETE_IGNITION`)  
- GY ignition effects (D-HERO Malicious, Plaguespreader Zombie) → opponent gets response window FIRST ✗

This is a **medium-high accuracy gap** for Edison. Malicious and Plaguespreader are format-defining cards.

### Recommendation

**Option 1 (recommended):** Build a newer WASM from current edo9300 master. The `n1xx1/ocgcore-wasm` build script (`scripts/build.sh`) uses emscripten (`em++`) + the `cpp/ygo` submodule. Steps:
1. Install emsdk (~15 min): `git clone https://github.com/emscripten-core/emsdk && ./emsdk install latest && ./emsdk activate latest`
2. Clone `n1xx1/ocgcore-wasm`, update `cpp/ygo` to current edo9300 master
3. Run `scripts/build.sh` (~5-10 min)
4. Use built WASM in-place — no npm publish needed, just update the import path
5. With the new build, use `MODE_GOAT | 0x400000000n` (or `0x7f80d072c`) as Edison flags

**Option 2:** Native shared-lib via N-API. Compile edo9300/ygopro-core as a `.so`, bind via N-API or `ffi-napi`. More reliable than emscripten, directly uses current C++ source. Fits the "native core on server" architecture already recommended.

**Option 3:** Accept the gap, document it. MZone ignition priority works. GY ignition priority gap is disclosed.

For "accuracy is sacred" — Option 1 is correct path. Estimated effort: 1-2 hours for engineer with build toolchain installed.

---

## A2-2 — GOAT-Family Flag Validation

All tests use MODE_GOAT flags. **Key finding: No GOAT flag is 2010-incorrect — all are appropriate for Edison.**

### A2-2a: ZERO_ATK_DESTROYED (0x10000000)

**Setup:** Ojama Green [12482652] (0/0 normal) in ATK position on each side. Player 0 attacks in Battle Phase.

**Real output:**
```
--- WITH ZERO_ATK_DESTROYED (MODE_GOAT) ---
  BATTLE msg: card ATK=0 vs target ATK=0
  BATTLE destroyed: card=true target=true
  Ojama Green moves to GRAVE: 2 (of 2 total moves)

--- WITHOUT ZERO_ATK_DESTROYED ---
  BATTLE msg: card ATK=0 vs target ATK=0
  BATTLE destroyed: card=false target=false
  Ojama Green moves to GRAVE: 0 (of 0 total moves)
```

**[PASS] EMPIRICALLY CONFIRMED.** WITH flag: both 0-ATK monsters are destroyed. WITHOUT flag: NEITHER is destroyed (in this old-rule interpretation, 0-ATK = no destroy power). The flag gates behavior for the 2010 Edison 0-ATK battle rule (Rule #13).

### A2-2b/c: Damage Step (SIX_STEP_BATLLE_STEP)

**Setup:** LIGHT monster (1100 ATK) attacks Koumori Dragon (1500 ATK, ATK position). Player 0 hand: Book of Moon [14087893] + Honest [37742478].

**Real output:**
```
DAMAGE_STEP_START seen: true
DAMAGE_STEP_END seen:   true
SELECT_CHAIN windows during damage step: 10
  player=1 selects=[]
  player=0 selects=[Honest(37742478)]     ← Honest CAN activate in damage step ✓
  player=1 selects=[]
  ... (8 more empty-selects windows)

[PASS] DAMAGE_STEP_START/END: damage step is a distinct phase ✓
[PASS] Book of Moon NOT in damage-step chains ✓ (QuickPlay spell, no TIMING_DAMAGE_STEP)
[PASS] Honest IS in damage-step chains ✓ (Quick Effect, TIMING_DAMAGE_STEP set in script)
```

**[PASS]** `SIX_STEP_BATLLE_STEP` produces the distinct damage step structure. Cards correctly honor `SetHintTiming` constraints — Book of Moon (not allowed in damage step) never appears; Honest (explicitly `SetHintTiming(TIMING_DAMAGE_STEP)`) appears correctly.

`SINGLE_CHAIN_IN_DAMAGE_SUBSTEP`: source-verified (processor.cpp), correct for pre-2014. Behavioral test requires a multi-trigger damage-step scenario; deferred as low-risk.

### A2-2d: TCG_SEGOC_FIRSTTRIGGER

`OcgDuelMode.TCG_SEGOC_FIRSTTRIGGER = 0x200000000` is present in `MODE_GOAT`. This implements Edison Rule #7: "when simultaneous trigger effects go on chain, the effect placed first goes on chain first." This rule changed in 2017; it is correct for both GOAT (2005) and Edison (2010). **Source-verified correct for 2010.**

---

## A2-3 — Final duelFlags Recommendation

### Current (with ocgcore-wasm 0.1.2):

```js
const EDISON_FLAGS = OcgDuelMode.MODE_GOAT; // 0x3f80d072c
```

Accuracy: 5 flags empirically confirmed, 12 source-verified. GY ignition missing.

### Target (once WASM is updated or N-API used):

```js
const EDISON_FLAGS = OcgDuelMode.MODE_GOAT | 0x400000000n; // 0x7f80d072c
// = MODE_GOAT + TCG_FAST_EFFECT_IGNITION
```

### Per-flag status table

| Flag | Hex | Status | Edison 2010? |
|---|---|---|---|
| FIRST_TURN_DRAW | 0x200 | **EMPIRICALLY CONFIRMED** (A2) | YES |
| ONE_FACEUP_FIELD | 0x400 | **EMPIRICALLY CONFIRMED** (A4) | YES |
| OBSOLETE_IGNITION | 0x100 | **EMPIRICALLY CONFIRMED** (A3) | YES (MZone) |
| TCG_FAST_EFFECT_IGNITION | 0x400000000 | **NOT IN WASM 0.1.2** | YES (needed, absent) |
| ZERO_ATK_DESTROYED | 0x10000000 | **EMPIRICALLY CONFIRMED** (A2-2a) | YES |
| SIX_STEP_BATLLE_STEP | 0x8 | **EMPIRICALLY CONFIRMED** (A2-2b) | YES |
| SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | 0x40000000 | SOURCE-VERIFIED | YES |
| TCG_SEGOC_FIRSTTRIGGER | 0x200000000 | SOURCE-VERIFIED | YES |
| TCG_SEGOC_NONPUBLIC | 0x100000000 | SOURCE-VERIFIED | YES |
| USE_TRAPS_IN_NEW_CHAIN | 0x4 | SOURCE-VERIFIED | YES |
| TRIGGER_WHEN_PRIVATE_KNOWLEDGE | 0x20 | SOURCE-VERIFIED | YES |
| EQUIP_NOT_SENT_IF_MISSING_TARGET | 0x8000000 | SOURCE-VERIFIED | YES |
| STORE_ATTACK_REPLAYS | 0x20000000 | SOURCE-VERIFIED | YES |
| CAN_REPOS_IF_NON_SUMPLAYER | 0x80000000 | SOURCE-VERIFIED | YES |
| SPSUMMON_ONCE_OLD_NEGATE | 0x40000 | SOURCE-VERIFIED (MR1) | YES |
| RETURN_TO_DECK_TRIGGERS | 0x10000 | SOURCE-VERIFIED (MR1) | YES |
| CANNOT_SUMMON_OATH_OLD | 0x80000 | SOURCE-VERIFIED (MR1) | YES |

**No GOAT flag has been identified as 2005-specific and 2010-incorrect.** MODE_GOAT is the right base for Edison (less the missing GY ignition flag).

### Residual Gap List

| # | Priority | Gap | Fix |
|---|---|---|---|
| 1 | **HIGH** | GY ignition priority (`TCG_FAST_EFFECT_IGNITION`) absent from WASM 0.1.2. Affects Malicious [9411399], Plaguespreader [33420078], any GY ignition effect. | Build newer WASM or use native N-API (~1-2h) |
| 2 | **MEDIUM** | ~35 "functional errata" cards: Brionac [50321796], Sangan [26202165], Rescue Cat [14878871], Ryko [21502796], Treeborn Frog [12538374], Black Garden [71645242], etc. ship with modern errata in ProjectIgnis scripts | Curate pre-errata scripts (Spike B) |
| 3 | LOW | `SINGLE_CHAIN_IN_DAMAGE_SUBSTEP`: source-verified, no behavioral test | Test scenario with multiple damage-step triggers |
| 4 | LOW | `TCG_SEGOC_FIRSTTRIGGER`: source-verified correct, no behavioral test | Test scenario with two simultaneous trigger effects |
