# Spike E — ocgcore WASM Build (Spike A GY-Ignition Gap Closure)

**Date:** 2026-07-13  
**Status:** COMPLETE  
**Purpose:** Build ocgcore WASM from current edo9300 source to enable `DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000)`, closing the GY ignition priority gap from Spike A2.

---

## Build artifact (E1)

| Item | Value |
|---|---|
| **WASM file** | `vendor/ocgcore-wasm/lib/ocgcore.sync.wasm` (gitignored) |
| **WASM size** | **870 KB** (vs 912 KB for 0.1.2 prebuilt — slightly smaller with emcc 6.0.2) |
| **Build time** | ~102 seconds on this machine (clean build, -Os optimization) |
| **emcc version** | 6.0.2 (emsdk latest at 2026-07-13) |
| **n1xx1/ocgcore-wasm commit** | `79dbfc79469e0a89558506405dd1589e68f150fe` (0.1.3 head) |
| **edo9300/ygopro-core commit** | `8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272` |
| **Lua version** | 5.3 (submodule `75ea9ccbea7c4886f30da147fb67b693b2624c26`) |

## Reproducible build

```bash
./build-wasm.sh
```

Requirements: `git`, `python3` (for emsdk), network access (downloads emsdk + submodules).

emsdk is downloaded into `vendor/emsdk/` (gitignored).  
Source is in `vendor/ocgcore-wasm/` (gitignored).

## How to use the built WASM

Replace the npm package's prebuilt files:

```bash
# After running build-wasm.sh:
cp vendor/ocgcore-wasm/lib/ocgcore.sync.wasm node_modules/ocgcore-wasm/lib/
cp vendor/ocgcore-wasm/lib/ocgcore.sync.mjs  node_modules/ocgcore-wasm/lib/
```

Then in your code:

```js
import createCore, { OcgDuelMode } from 'ocgcore-wasm';

// TCG_FAST_EFFECT_IGNITION is NOT in the JS constants — use raw BigInt
const TCG_FAST_EFFECT_IGNITION = 0x400000000n;
const EDISON_FLAGS = OcgDuelMode.MODE_GOAT | TCG_FAST_EFFECT_IGNITION; // 0x7f80d072c

const lib = await createCore({ sync: true });
// ... use lib.createDuel({ flags: EDISON_FLAGS, ... })
```

## Why the 0.1.2 prebuilt binary ignored the raw bit

Both the 0.1.2 prebuilt and our new build use the same edo9300 commit (`8e5f4e4f`), which contains `TCG_FAST_EFFECT_IGNITION` in the C++ source. However, the 0.1.2 WASM binary was built with an older emscripten that caused the 64-bit flag check to behave differently (possibly aggressive optimization of the 64-bit comparison in a 32-bit WASM target). The new build with emcc 6.0.2 correctly implements the flag check.

---

## E2 — GY Ignition Priority: PASS

**Test:** D-HERO Malicious [9411399] in player 0's GY. Normal summon Koumori Dragon [67724379]. After SUMMONED:

```
BEFORE (MODE_GOAT = 0x3f80d072c — old behavior):
  SELECT_CHAIN player=0 selects=[]       ← no GY ignition priority
  SELECT_CHAIN player=1 selects=[29401950]  ← opponent gets BTH window first

AFTER (EDISON_FLAGS = 0x7f80d072c — new build):
  SELECT_CHAIN player=0 selects=[9411399]  ← GY ignition offered to turn player! ✓
  SELECT_CHAIN player=1 selects=[29401950]  ← opponent window after turn player passed
```

Turn player is offered D-HERO Malicious's GY ignition effect as Chain Link 1 **BEFORE** the opponent's response window. Edison GY ignition priority is now fully implemented.

**Cards verified:**
- `[9411399]` D-HERO Malicious — GY ignition, offered as CL1 before opponent window ✓
- `[29401950]` Bottomless Trap Hole — opponent SS2 response, appears AFTER turn player passed ✓

## E3 — Regression Check: PASS

All three behaviors confirmed on new build with `EDISON_FLAGS = 0x7f80d072c`:

```
FIRST_TURN_DRAW:     Player 0 draws 6 cards (5 start + 1 turn-1 draw) ✓
ONE_FACEUP_FIELD:    Umi [22702055] destroyed → GRAVE when Mountain [50913601] activates ✓
OBSOLETE_IGNITION:   Lonefire [48686504] offered in MZone SELECT_CHAIN after SUMMONED ✓
```

---

## E4 — Final Edison duelFlags Recommendation

```js
const EDISON_FLAGS = OcgDuelMode.MODE_GOAT | 0x400000000n; // 0x7f80d072c
```

**Components:**

| Flag | Hex | Status |
|---|---|---|
| OBSOLETE_IGNITION | 0x100 | MZone ignition priority |
| **TCG_FAST_EFFECT_IGNITION** | **0x400000000** | **GY ignition priority — NOW WORKING** |
| FIRST_TURN_DRAW | 0x200 | First player draws on turn 1 |
| ONE_FACEUP_FIELD | 0x400 | Single field spell zone |
| SIX_STEP_BATLLE_STEP | 0x8 | Pre-2014 damage step |
| ZERO_ATK_DESTROYED | 0x10000000 | 0-ATK battle rule |
| SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | 0x40000000 | One chain per damage substep |
| TCG_SEGOC_FIRSTTRIGGER | 0x200000000 | SEGOC earlier-trigger-first |
| (+ 9 other GOAT flags) | … | All source-verified for Edison 2010 |

**pinned edo9300 commit:** `8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272`

**Build friction encountered:**
1. emsdk download was slow (~290 MB) but automatic — no manual steps
2. The `--closure 1` flag requires Node.js in emsdk's own copy (auto-managed)  
3. WASM build warnings about C-in-C++ mode are harmless (same as 0.1.2 source)
4. No emscripten installation was needed on the host — emsdk is self-contained

**Recommendation for production:**
- Add `build-wasm.sh` to CI. Pin edo9300 commit in the script. Run once to generate the WASM artifact and cache it between builds.
- Alternatively, host the built WASM as a project-private artifact (npm registry, S3, etc.) and pull it in `npm install`.
