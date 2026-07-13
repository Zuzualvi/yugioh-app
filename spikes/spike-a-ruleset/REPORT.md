# Spike A — Engine Integration + Edison Ruleset Validation

**Date:** 2026-07-13  
**Status:** COMPLETE  
**Scope:** ocgcore-wasm 0.1.2 (prebuilt WASM, Node 22.22, sync mode)

---

## A6 — Embedding Verdict (answered first, gates everything else)

### Prebuilt vs. build-from-source?

**PREBUILT WASM USED. No emscripten required.**

`ocgcore-wasm@0.1.2` on npm (`https://registry.npmjs.org/ocgcore-wasm/-/ocgcore-wasm-0.1.2.tgz`) contains a prebuilt WASM artifact. Installation:
```
npm install ocgcore-wasm
```

### Node flags required?

**None.** The sync variant (`createCore({ sync: true })`) works in Node 22.22.0 with zero special flags. The async/JSPI variant needs `--experimental-wasm-stack-switching` but is NOT needed for our harness.

### WASM payload size?

| File | Size |
|---|---|
| `lib/ocgcore.sync.wasm` | **912 KB** |
| `lib/ocgcore.jspi.wasm` | **913 KB** |
| `dist/index.js` (bindings) | 46 KB |

Total: ~1 MB of WASM. Acceptable for server deployment; borderline for browser cold-load.

### Critical discovery: `DUEL_TCG_FAST_EFFECT_IGNITION` NOT in this build

The research hypothesised a flag at `0x400000000` (TCG-style GY ignition priority). This constant **does NOT exist** in ocgcore-wasm 0.1.2's exposed API. The MODE_GOAT preset in this build is:

```
MODE_GOAT = OBSOLETE_IGNITION | FIRST_TURN_DRAW | ONE_FACEUP_FIELD |
            SPSUMMON_ONCE_OLD_NEGATE | RETURN_TO_DECK_TRIGGERS |
            CANNOT_SUMMON_OATH_OLD | USE_TRAPS_IN_NEW_CHAIN |
            SIX_STEP_BATLLE_STEP | TRIGGER_WHEN_PRIVATE_KNOWLEDGE |
            EQUIP_NOT_SENT_IF_MISSING_TARGET | ZERO_ATK_DESTROYED |
            STORE_ATTACK_REPLAYS | SINGLE_CHAIN_IN_DAMAGE_SUBSTEP |
            CAN_REPOS_IF_NON_SUMPLAYER | TCG_SEGOC_NONPUBLIC |
            TCG_SEGOC_FIRSTTRIGGER
         = 0x3f80d072c
```

No flag at 0x400000000 is present. GY ignition priority for Edison (Plaguespreader Zombie, Destiny HERO – Malicious) CANNOT be tested with this WASM build.

### Script initialization: `c0.lua` required

The engine calls the scriptReader with `"c0.lua"` on initialization. This file must concatenate all base scripts (`constant.lua`, `utility.lua`, `chain.lua`, proc_*.lua etc.). **A synthetic `c0.lua` was created** at `vendor/scripts/official/c0.lua` from the ProjectIgnis CardScripts root files. The engine then requests additional scripts it needs.

### Recommendation

**WASM-in-Node is viable** for server-side headless duel driving (our architecture). The sync API has zero special Node flags, the payload is ~1 MB, and the full processing loop (duelProcess → getMessage → setResponse) works correctly.

**Caveat for GY ignition priority:** If Edison TCG accuracy requires GY ignition effects (Plaguespreader, Malicious), we must either:
1. Use a newer ocgcore-wasm build compiled from a more recent edo9300/ygopro-core that exposes `TCG_FAST_EFFECT_IGNITION (0x400000000)`
2. Fall back to native shared lib via N-API (uses the edo9300 C++ source directly)

For the architecture decision: **WASM-in-Node is the right choice for the server** — deterministic, no native compilation, works now. The GY ignition gap is a flag-exposure gap in the npm package, not a fundamental WASM limitation.

---

## A1 — Integration Proof ✅ PASS

**Edison duelFlags:** `0x3f80d072c` (= `OcgDuelMode.MODE_GOAT`)  
**Decks:** 20-card pure normal-monster filler (no scripts required)

### Real output (6-turn run):

```
  [DRAW]        player=0 cards=5
  [DRAW]        player=1 cards=5
  [NEW_TURN]    player=0
  [NEW_PHASE]   phase=0x1 (DRAW)
  [DRAW]        player=0 cards=1   ← first-turn draw
  [SELECT_CHAIN] (standby/draw phase fast-effect window, both pass)
  [SELECT_CHAIN]
  [NEW_PHASE]   phase=0x2 (STANDBY)
  [NEW_PHASE]   phase=0x4 (MAIN1)
  [SELECT_IDLECMD]
  [HINT]
  [SELECT_CHAIN]
  [NEW_PHASE]   phase=0x200 (END)
  [NEW_TURN]    player=1
  ...  (6 turns, same pattern)
```

Message histogram (6 turns):
```
  NEW_PHASE: 20
  SELECT_CHAIN: 15
  HINT: 13
  DRAW: 7 (15 cards total)
  NEW_TURN: 6
  SELECT_IDLECMD: 5
  SELECT_CARD: 3
  MOVE: 3
```

**[PASS]** Engine integration confirmed — turns, draws, and phase transitions observed over 6 turns of scripted play.

---

## A2 — First-Turn Draw (FIRST_TURN_DRAW flag) ✅ PASS

### With FIRST_TURN_DRAW (Edison flags):

```
  DRAW player=0 cards=5 [5464695,5434080,5388481,5265750,5053103]
  DRAW player=1 cards=5
  NEW_TURN player=0
  NEW_PHASE phase=0x1 (DRAW)
  DRAW player=0 cards=1 [4148264]   ← turn-1 draw happens
  NEW_PHASE phase=0x2
  NEW_PHASE phase=0x4
  → Player 0 total cards drawn: 6
```

**[PASS]** Player 0 drew 6 cards (5 starting + 1 turn-1 draw).

### Without FIRST_TURN_DRAW:

```
  DRAW player=0 cards=5
  DRAW player=1 cards=5
  NEW_TURN player=0
  NEW_PHASE phase=0x1 (DRAW)
  ← no draw here
  NEW_PHASE phase=0x2
  NEW_PHASE phase=0x4
  → Player 0 total cards drawn: 5
```

**[PASS]** Player 0 drew 5 cards (no turn-1 draw, modern skip-first-draw rule).

**VERDICT:** `DUEL_1ST_TURN_DRAW` (FIRST_TURN_DRAW) flag **EMPIRICALLY CONFIRMED** — it gates the first-player turn-1 draw exactly as specified.

---

## A3 — Ignition-Effect Priority (OBSOLETE_IGNITION flag) ✅ PASS

**Cards:** `48686504` Lonefire Blossom (Ignition Effect Plant) / `29401950` Bottomless Trap Hole (SS2 trap)  
**Setup:** Player 0 (turn player) Normal Summons Lonefire; player 1 has BTH face-down.

### With OBSOLETE_IGNITION (Edison flags):

Message sequence after summon:
```
  SUMMONING code=48686504
  SELECT_CHAIN p=0 n=0 codes=[]      ← pre-SUMMONED response window (both pass)
  SELECT_CHAIN p=1 n=0 codes=[]
  SUMMONED                            ← summon resolves
  SELECT_CHAIN p=0 n=1 codes=[48686504]  ← IGNITION PRIORITY WINDOW: turn player offered Lonefire!
  SELECT_CHAIN p=1 n=0 codes=[]         ← opponent gets empty window after turn player passed
```

**[PASS]** Turn player (player 0) is offered Lonefire Blossom [48686504] as Chain Link 1 BEFORE the opponent's response window. This is the Edison ignition priority rule.

### Without OBSOLETE_IGNITION:

```
  SUMMONING code=48686504
  SELECT_CHAIN p=0 n=0 codes=[]
  SELECT_CHAIN p=1 n=0 codes=[]
  SUMMONED
  SELECT_CHAIN p=0 n=0 codes=[]      ← NO ignition priority window
  SELECT_CHAIN p=1 n=0 codes=[]
```

**[PASS]** Lonefire NOT offered as CL1 — no ignition priority without the flag.

**VERDICT:** `DUEL_OBSOLETE_IGNITION` (OBSOLETE_IGNITION) flag **EMPIRICALLY CONFIRMED.**

**Gap — GY ignition effects:** The research hypothesised `DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000)` for GY ignition effects (Plaguespreader Zombie [33488264], Destiny HERO – Malicious [9411399]). This flag is NOT in the ocgcore-wasm 0.1.2 build. GY ignition priority test is DEFERRED. OBSOLETE_IGNITION covers monster-zone ignition effects. The GOAT preset has always used only OBSOLETE_IGNITION — whether GY effects also get priority under it is untested here.

**Errata note:** Modern Lonefire script (`official/c48686504.lua`) has `e1:SetCountLimit(1)` — a hard once-per-turn limit. Edison pre-errata Lonefire has NO OPT restriction. Pre-errata curation is a Spike B item.

---

## A4 — Single Field Spell (ONE_FACEUP_FIELD flag) ✅ PASS

**Cards:** `22702055` Umi / `50913601` Mountain  
**Setup:** Player 0 activates Umi (turn 1). Player 1 activates Mountain (turn 2).

### With ONE_FACEUP_FIELD (Edison flags):

```
  MOVE code=22702055 from=0x2 to=0x8 turn=1   ← Umi activated (HAND→SZONE)
  CHAINING code=22702055 (Umi)
  NEW_TURN player=1
  MOVE code=50913601 from=0x2 to=0x8 turn=2   ← Mountain activated (HAND→SZONE)
  CHAINING code=50913601 (Mountain)
  MOVE code=22702055 from=0x8 to=0x10 turn=2  ← Umi DESTROYED (SZONE→GRAVE) ✓
  NEW_TURN player=0
```

**[PASS]** Umi moved to GRAVE (0x10) when Mountain activated (turn 2). Pre-MR3 behavior confirmed.

### Without ONE_FACEUP_FIELD:

```
  MOVE code=22702055 from=0x2 to=0x8 turn=1   ← Umi activated
  CHAINING code=22702055
  NEW_TURN player=1
  MOVE code=50913601 from=0x2 to=0x8 turn=2   ← Mountain activated
  CHAINING code=50913601
  NEW_TURN player=0                             ← Umi NOT destroyed (stays active)
```

**[PASS]** Umi NOT destroyed. Modern behavior (both field spells coexist).

**VERDICT:** `DUEL_1_FACEUP_FIELD` (ONE_FACEUP_FIELD) flag **EMPIRICALLY CONFIRMED.**

---

## A5 — Flag Set Verdict

### Final Recommended Edison duelFlags

Built from `OcgDuelMode` constants in ocgcore-wasm 0.1.2:

```
EDISON_FLAGS =
  OBSOLETE_IGNITION         | // 0x000000100  OCG ignition priority (verified A3)
  FIRST_TURN_DRAW           | // 0x000000200  first player draws turn 1 (verified A2)
  ONE_FACEUP_FIELD          | // 0x000000400  single field spell destroys old (verified A4)
  SPSUMMON_ONCE_OLD_NEGATE  | // 0x000040000  negated summons count vs limit (MR1 base)
  RETURN_TO_DECK_TRIGGERS   | // 0x000010000  return-to-deck doesn't trigger leaving-field
  CANNOT_SUMMON_OATH_OLD    | // 0x000080000  old oath rule for summons
  USE_TRAPS_IN_NEW_CHAIN    | // 0x000000004  continuous traps not immediately usable in chain
  SIX_STEP_BATLLE_STEP      | // 0x000000008  pre-2014 damage step structure
  TRIGGER_WHEN_PRIVATE_KNOWLEDGE | // 0x000000020  deck search knowledge check
  EQUIP_NOT_SENT_IF_MISSING_TARGET | // 0x008000000  equip-not-sent if target gone
  ZERO_ATK_DESTROYED        | // 0x010000000  0-ATK battle rule (both destroyed)
  STORE_ATTACK_REPLAYS      | // 0x020000000  attack replays usable later
  SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | // 0x040000000  one chain per damage substep
  CAN_REPOS_IF_NON_SUMPLAYER | // 0x080000000  reposition if controller changed
  TCG_SEGOC_NONPUBLIC       | // 0x100000000  TCG SEGOC non-public knowledge
  TCG_SEGOC_FIRSTTRIGGER    ; // 0x200000000  TCG SEGOC: earlier trigger goes first

= 0x3f80d072c  (BigInt)
```

**This equals `OcgDuelMode.MODE_GOAT` exactly** — the GOAT preset is a superset of MR1 that adds the TCG-era behaviors needed for Edison.

### Per-behavior status

| Behavior | Flag | Hex | Status |
|---|---|---|---|
| First player draws turn 1 | FIRST_TURN_DRAW | 0x200 | **EMPIRICALLY CONFIRMED** (A2) |
| Single face-up field spell | ONE_FACEUP_FIELD | 0x400 | **EMPIRICALLY CONFIRMED** (A4) |
| Ignition priority (MZONE) | OBSOLETE_IGNITION | 0x100 | **EMPIRICALLY CONFIRMED** (A3) |
| Ignition priority (GY/TCG) | TCG_FAST_EFFECT_IGNITION | 0x400000000 | **NOT IN THIS BUILD** — gap |
| Pre-2014 damage step | SIX_STEP_BATLLE_STEP | 0x8 | **NOT YET VALIDATED** (flag exists, logic verified in source, not empirically tested here) |
| One chain per damage substep | SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | 0x40000000 | **NOT YET VALIDATED** |
| 0-ATK battle rule | ZERO_ATK_DESTROYED | 0x10000000 | **NOT YET VALIDATED** |
| TCG SEGOC earlier-trigger | TCG_SEGOC_FIRSTTRIGGER | 0x200000000 | **NOT YET VALIDATED** |
| Continuous trap in new chain | USE_TRAPS_IN_NEW_CHAIN | 0x4 | **NOT YET VALIDATED** |
| Equip not sent if target gone | EQUIP_NOT_SENT_IF_MISSING_TARGET | 0x8000000 | **NOT YET VALIDATED** |
| Old summon oath | CANNOT_SUMMON_OATH_OLD + SPSUMMON_ONCE_OLD_NEGATE | 0x80000+0x40000 | **NOT YET VALIDATED** |

### Correction to research hypothesis

The research recommended `DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000)` for Edison GY ignition effects. **This flag does not exist in the ocgcore-wasm 0.1.2 build.** The GOAT mode includes only OBSOLETE_IGNITION. Whether this means:
1. The flag was added to the edo9300 source after this WASM was compiled, or
2. The WASM was built from a different branch

...requires investigation. GY ignition effects (Plaguespreader, Malicious) are Edison-format-defining; this is a **medium-risk gap** requiring validation before production.

### Gap list

| Item | Risk | Action |
|---|---|---|
| GY ignition priority (`TCG_FAST_EFFECT_IGNITION`) not in this WASM | **HIGH** for Edison accuracy | Build newer WASM or use native N-API; test with Plaguespreader [33488264] / Malicious [9411399] |
| Damage-step micro-rulings (SIX_STEP_BATLLE_STEP, SINGLE_CHAIN_IN_DAMAGE_SUBSTEP) | **MEDIUM** — flagged, from GOAT preset, inferred valid for 2010 | Write test with damage-step-relevant scenario (e.g. Book of Moon in damage step) |
| 0-ATK battle rule (ZERO_ATK_DESTROYED) | LOW | Write test with two 0-ATK attacking monsters |
| TCG SEGOC (TCG_SEGOC_FIRSTTRIGGER) — 2010 vs modern | LOW | Write SEGOC test with simultaneous triggers |
| Equip behavior (EQUIP_NOT_SENT_IF_MISSING_TARGET) | LOW | Write equip-target-missing test |
| Pre-2014 damage-step micro-rulings (2005 GOAT vs 2010 exact) | **MEDIUM** — research flagged this as INFERENCE | Community Edison ruling review; targeted test |
| DUEL_USE_TRAPS_IN_NEW_CHAIN 2010 applicability | LOW | Confirm with continuous trap in response chain |

---

## Summary

| Test | Result |
|---|---|
| A1 Integration | **PASS** — duel runs, turns/draws/phases confirmed over 6 turns |
| A2 First-Turn Draw | **PASS** — WITH=6 cards, WITHOUT=5 cards |
| A3 Ignition Priority | **PASS** — turn player offered CL1 ignition before opponent (MZONE effects) |
| A4 Single Field Spell | **PASS** — old field destroyed when new one activated; modern behavior without flag |
| A5 Flag Verdict | **DELIVERED** — Edison flags = MODE_GOAT (0x3f80d072c); 3 flags confirmed, GY ignition gap identified |
| A6 Embedding Verdict | **DELIVERED** — WASM-in-Node viable; sync mode; no special flags; ~1 MB payload |
