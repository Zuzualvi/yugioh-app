# Dueling-Slice Readiness Report — Rules-Flag Validation + Card-Script Audit

**Date:** 2026-07-13  •  **Author:** Product Lead  •  **Status:** Pre-dev double-check (CEO-requested before dueling dev starts).

## What this is (and isn't)
This is the accuracy readiness check for the **future dueling slice** (the real-time/async duel engine). It is the spec + gap list the CTO should build the dueling app *from* — the same "audit first, build against it" pattern we used for the card text.

- **Independent of the card-text fix** (`4bc6c70`), which is already delivered and can ship now.
- **I own this audit/spec.** Authoring/curating the actual Lua scripts and running the empirical rule tests is **CTO engineering** (I don't write scripts; I tell them which need what and cite the target behavior).
- Behavior target for every card below = the **verbatim Edison text** locked in `2026-07-13-preerrata-desc-overrides.json`. A script is "correct" when its gameplay matches that text.

---

## PART A — Card-script readiness (the 36 functional-errata cards)

Reminder of the decoupling: the engine runs a **Lua script per passcode** from its own `cards.cdb`; it never reads our display text. Fixing the display text bought **zero** gameplay accuracy. Each of these 36 needs its *script* verified/curated independently.

**Summary:** 6 drop-in ready · 6 available-but-verify · 1 known-wrong (must fix) · 6 rules/ruling-level · 17 need authoring or a diff-vs-modern check.

### Bucket 1 — READY: correct pre-errata script exists, verified OPT-free (drop-in)
| Passcode | Name | Pre-errata script | Note |
|---|---|---|---|
| 50321796 | Brionac, Dragon of the Ice Barrier | 511002993 | no CountLimit (no hard OPT) — correct |
| 26202165 | Sangan | 511002631 | no name-clause / OPT |
| 14878871 | Rescue Cat | 511002992 | no OPT |
| 7391448 | Goyo Guardian | 511002994 | `Synchro.AddProcedure(c,nil,…)` = ANY Tuner (not EARTH) |
| 87910978 | Brain Control | 511002995 | no "can be Normal Summoned/Set" restriction |
| 77565204 | Future Fusion | 511002997 | pre-errata |

These are what the community banlist already substitutes; verified by `.lua` inspection in prior research. CTO action: wire the substitute passcode + alias, confirm at build.

### Bucket 2 — AVAILABLE but UNWIRED: pre-errata script exists in ProjectIgnis repo, community doesn't use it; verify per-line then wire
| Passcode | Name | Pre-errata script |
|---|---|---|
| 47355498 | Necrovalley | 511002998 |
| 21502796 | Ryko, Lightsworn Hunter | 511003007 |
| 95727991 | Catapult Turtle | 511000228 |
| 25862681 | Ancient Fairy Dragon | 25862691 |
| 80168720 | Darkness Approaches | 511003028 |
| 80604091 | Ultimate Offering | 511003023 |
CTO action: line-audit each `.lua` (the `pre-errata/` folder is **not** uniformly Edison-accurate — see Bucket 3), then wire.

### Bucket 3 — KNOWN-WRONG: script exists but is wrong for Edison, MUST edit
| Passcode | Name | Problem | Fix |
|---|---|---|---|
| 88264978 | Red-Eyes Darkness Metal Dragon | ProjectIgnis `pre-errata/c88264978.lua` still enforces once-per-**name** (`SetCountLimit(1,id,…)` on summon + `SetCountLimit(1,{id,1})` on ignition) | Edison has no once-per-name; change to per-copy `SetCountLimit(1)` |
This is the proof that "pre-errata folder" ≠ "Edison-correct." Inspect every script, don't trust the folder name.

### Bucket 4 — RULES/RULING-level (not a card substitution)
| Passcode | Name | Why | Handling |
|---|---|---|---|
| 95503687 | Lumina, Lightsworn Summoner | Lightsworn rep — phase-dependent mandatory trigger re-activation | Engine behavior (Rule #4, Part B) — verify |
| 40473581 | Susa Soldier | Spirit rep — same Rule #4 (note: **no text override**, but IS in engine scope) | Engine behavior — verify |
| 42940404 | Machina Gearframe | Union rep — "1 Union per monster" condition (Rule #3) | Confirm engine enforces union limit, or keep it in the card script |
| 3370104 | Cyber Phoenix | Damage-step "face-up at attack declaration" is a **ruling**, not a text errata | Verify modern script + damage-step flags already produce it |
| 48092532 | D.D. Survivor | same (ruling, not errata) | Verify |
| 44364207 | Jade Knight | same (ruling, not errata) | Verify |

### Bucket 5 — NEEDS AUTHORING / DIFF-vs-MODERN (17)
Armory Arm 29071332 · Black Garden 71645242 · Dark End Dragon 88643579 · Destiny End Dragoon 76263644 (revival **no-OPT**) · Elemental HERO Prisma 89312388 · Fortune Lady Light 34471458 · Light and Darkness Dragon 47297616 · Light End Dragon 25132288 · Mark of the Rose 45247637 · Mausoleum of the Emperor 80921533 · My Body as a Shield 69279219 · Quickdraw Synchron 20932152 · Soul Exchange 68005187 · Strike Ninja 41006930 · Swap Frog 9126351 · Treeborn Frog 12538374 (no repo pre-errata script) · Urgent Tuning 94634433 (Synchro Summon on resolution, not "immediately after")

CTO action per card: **diff the modern script's behavior against the verbatim Edison text** (`preErrataDescClean`). Many differences may be display-only (the modern script is already behavior-correct) — author only where the *behavior* diverges. Do not author blind.

---

## PART B — Rules-flag validation (Edison's 13 documented rule differences)

Sweeping edisonformat.com's rule-difference list against our flag set (`OBSOLETE_IGNITION | TCG_FAST_EFFECT_IGNITION | FIRST_TURN_DRAW | ONE_FACEUP_FIELD | MR1-base | USE_TRAPS_IN_NEW_CHAIN | SIX_STEP_BATLLE_STEP | SINGLE_CHAIN_IN_DAMAGE_SUBSTEP | ZERO_ATK_DESTROYED | TCG_SEGOC_*` — value `0x7f80d072c`). This is the sweep that catches a *missing* flag (how we found the GY-ignition gap).

| Rule | Edison rule | Maps to | Status |
|---|---|---|---|
| #1 | Starting player draws turn 1 | `FIRST_TURN_DRAW` | ✅ empirically confirmed |
| #2 | Only 1 active Field Spell (set doesn't destroy; new one destroys old) | `ONE_FACEUP_FIELD` | ✅ empirically confirmed |
| #6 | Ignition Effect Priority (MZone **and** GY) | `OBSOLETE_IGNITION` + `TCG_FAST_EFFECT_IGNITION` | ✅ both confirmed (GY via custom WASM, Spike E) |
| #13 | 0-ATK mutual destruction; 0-ATK can't destroy defender | `ZERO_ATK_DESTROYED` | ✅ empirically confirmed |
| #7 | SEGOC with the "earlier trigger first" exception | `TCG_SEGOC_NONPUBLIC` + `TCG_SEGOC_FIRSTTRIGGER` | ⚠️ source-verified, **not empirically tested** |
| #8 | 7-timing Damage Step + activation limits | `SIX_STEP_BATLLE_STEP` (confirmed) + `SINGLE_CHAIN_IN_DAMAGE_SUBSTEP` (untested) | ⚠️ partial — verify timing count (7 vs "6-step" flag naming) + single-chain |
| #3 | Union monster "1 per monster" condition | **Card-level** (scripts), not a flag | → Part A Bucket 4 (verify engine vs script) |
| #4 | Phase-dependent mandatory trigger **re-activation** when negated (Spirits/Lightsworns) | No obvious flag | ❓ **needs validation — possible gap** |
| #5 | Trap Monster occupies 1 MZone + 1 S/T zone | No confirmed flag | ❓ needs validation |
| #9 | Trigger recognition mid-chain | `TRIGGER_WHEN_PRIVATE_KNOWLEDGE`? | ❓ needs validation |
| #10 | Can't pay an LP cost that would hit 0 | No confirmed flag | ❓ **needs validation — possible gap** |
| #11 | End-of-turn hand-size discard can't be responded to | Engine behavior | ❓ needs validation |
| #12 | Infinite-loop handling (old procedure) | Engine behavior (edge case) | ❓ low priority, verify |

**Read-out:** 4 rules solidly confirmed, 2 partially covered but untested, 1 is card-level (Part A), and **6 are not yet confirmed against the engine (#4, #5, #9, #10, #11, #12).** These are "not yet validated," not "known broken" — but #4 and #10 in particular are real Edison rules that a friends-group would notice, so they need an empirical test each before we claim accurate Edison rules.

### PART B.1 — Source dig on the 6 unconfirmed rules (edo9300 @ `8e5f4e4`, our pinned commit)
Read the C++ engine to classify each "❓" as handled / card-level / genuine gap. Result: most were era-gated flags GOAT already leaves in the old state.

| Rule | Verdict | Evidence |
|---|---|---|
| #5 Trap Monster zone | ✅ **HANDLED** (confirm) | `DUEL_TRAP_MONSTERS_NOT_USE_ZONE 0x8000` gates the *modern* behavior; MODE_GOAT does **not** set it, so `!is_flag(...)` branches (card.cpp:3810, operations.cpp:1089/1605/1660/4967/5125) enforce the old zone occupancy. |
| #9 Trigger recognition mid-chain | ✅ **HANDLED** (confirm) | Era-gated: `DUEL_TRIGGER_ONLY_IN_LOCATION` (modern, **off** in GOAT) at field.cpp:3247; `DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE` (**on** in GOAT) at effect.cpp:236/256, processor.cpp:632/711/714. GOAT = old permissive recognition. |
| #11 End-of-turn discard | ✅ **LIKELY HANDLED** (confirm) | processor.cpp:529-550 does the hand-size discard as a `REASON_RULE + REASON_ADJUST` action — a game-mechanic action, not a chainable effect, so it opens no response window. Matches "can't respond." |
| #4 Mandatory-trigger re-activation | 🟡 **MOSTLY CARD-LEVEL** + 1 test | The behavior change was *card errata* (Judgment Dragon, Tsukuyomi, Duelist Saga) — so the pre-errata scripts for those named Lightsworn/Spirit cards carry the old behavior. The general engine re-activation behavior still wants one empirical test. Largely subsumed by Part A script curation. |
| #12 Infinite loops | ⚪ **NOT SIM-REPRODUCIBLE** | The old Edison rule is a human-judge "primary cause" procedure; no automated engine reproduces it (they detect/abort). Document as a known non-reproducible edge case; not a build task. |
| #10 LP cost that reduces LP to 0 | 🔴 **GENUINE GAP** | `field::check_lp_cost` (field.cpp:2364) returns true when `val <= player[playerid].lp` — **no era flag** — so the engine allows paying a cost down to exactly 0 (modern). Edison forbids it. Fix = small core-fork patch (`<` instead of `<=`, ideally behind a flag) **or** an accepted, documented exception (low frequency: requires having *exactly* the cost in LP). |

**Net after the dig:** of the 6 "❓", three collapse to "handled, just confirm" (#5, #9, #11), one is mostly covered by the script curation (#4), one is a non-reproducible edge case (#12), and **one is a real but low-frequency engine gap (#10)** needing a core patch or an accepted exception. That leaves the empirical to-do list much smaller: confirm #5/#9/#11, test #7 (SEGOC) and #8 (single-chain-in-damage-substep), one test for #4's general behavior, and decide #10 (patch vs accept).

---

## Residual risks & recommended pre-dev validation (for the CTO to run during the dueling build)
1. **Card scripts:** curate Buckets 1–3 (drop-in / verify-wire / fix-REDMD), then diff Bucket 5's 17 vs the verbatim text and author only real behavior gaps. Maintain a documented "left on modern text" list.
2. **Flag sweep — empirical to-do (much smaller after the source dig):** confirm #5/#9/#11 behave old-style; write a test for #7 (SEGOC ordering) and #8 (single-chain-in-damage-substep); one test for #4's general re-activation behavior.
3. **Rule #10 (LP-cost-to-0) — decision needed:** patch the core fork (`check_lp_cost`/`PayLPCost` use `<` for Edison, ideally behind a duel flag) **or** accept + document the exception. Low frequency, but it's the one genuine unflagged gap.
4. **Express the flag set as an explicit, per-flag-commented bitmask** (not a `MODE_GOAT` reference) — removes the "are we playing GOAT?" ambiguity and forces each bit to carry its Edison justification.

## Provenance / confidence
Script statuses come from prior `.lua`-inspection research (Buckets 1 & 3 verified by source; Buckets 2/5 need re-verification at build since the repo may have changed). Flag statuses come from Spike A/A2/E (empirical where noted) + this rule-difference sweep. Sources: edisonformat.com/edison-rule-differences.html; ProjectIgnis CardScripts; team memory `edison-functional-errata.md`, `edison-engine-rules-flags.md`.
