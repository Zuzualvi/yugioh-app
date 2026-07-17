---
title: Edison Format — Parity Matrix (audit instrument + acceptance gate)
subtitle: The single tracker engineers fill in and the Product Lead signs off against
audience: engineers (fill Actual/Evidence + flip Status); Product Lead (sign-off); CTO (spikes/fixes)
author: product-owner subagent (Track A / A2)
date: 2026-07-17
status: DRAFT v1 — "expected" side pre-filled; "actual/evidence" LEFT BLANK for engineering
binding_authority: edisonformat.com (LOCKED). On conflict, edisonformat.com wins; conflicts are flagged, never silently resolved.
inputs:
  - /workspace/product/research/edison-rules-reference.md          (PRIMARY — 78 behaviors, base rules, 36 errata, 17 decklists)
  - /workspace/product/research/edison-parity-scope.md             (tiered scope + community-bar rationale)
  - /mnt/memory/yugioh-app-team-memory/research/edison-engine-rules-flags.md   (engine flags + empirical spike results)
  - /mnt/memory/yugioh-app-team-memory/research/edison-functional-errata.md    (substitutes / REDMD / passcodes)
  - /mnt/memory/yugioh-app-team-memory/research/card-script-curation.md        (per-card script verdicts)
  - /workspace/yugioh-app/packages/engine/src/edisonRules.accuracy.test.ts     (5 passing + LP-cost tests)
---

# Edison Format — Parity Matrix

> **What this is.** BOTH the audit instrument (prove the app enforces Edison as a live-tournament judge
> would) AND the acceptance gate (engineers fill the blank columns; the Product Lead signs off against
> the resulting Status column). Every "expected" cell is pre-filled from the authoritative reference so
> engineers can execute the acceptance test **without re-deriving** the ruling.
>
> **Scope (LOCKED — do not expand).** Three tiers: **(1) rules-level = COMPLETE** (§1 78 behaviors + §2
> base scaffolding); **(2) card-level = EXHAUSTIVE on the 36 functional-errata cards only** (§3);
> **(3) staples = opportunistic SPOT-CHECK** via representative decklists (§4). Plus two tracked
> engineering data items (§5).

---

## 0. How to read / fill this matrix

**Columns (every row).**

| Column | Who fills | Meaning |
|--------|-----------|---------|
| **ID** | pre-filled | Stable ID from the rules reference (`R08-S3`, `R05-B7d`, `ERR-BRIONAC`, `BR-04`, `STP-01`, `ENG-…`). Do not renumber. |
| **Rule / Category** | pre-filled | R01–R13 name, `base`, errata card name, fixture archetype, or eng item. |
| **Expected Edison behavior** | pre-filled | Concise, testable, from the reference. |
| **Source** | pre-filled | See source keys below + specific rule#/errata entry. |
| **Acceptance test** | pre-filled | Concrete setup → action → observable assertion an engineer can implement directly. Named where a passing test already exists. |
| **Actual engine behavior** | **ENGINEERING** | LEFT BLANK. |
| **Evidence** | **ENGINEERING** | LEFT BLANK. Put test name / CI run / commit SHA. |
| **Status** | starts pre-filled; ENGINEERING updates | See Status vocabulary below. |
| **Tier** | pre-filled | 1 / 2 / 3. |
| **Notes** | pre-filled | Nuance, card/fixture dependencies, cross-links. |

The **Actual** and **Evidence** columns are intentionally empty (`·`) — engineering fills them and flips
Status to VERIFIED-PASS (or records a defect) once the acceptance test runs green.

**Status vocabulary.**

| Status | Meaning |
|--------|---------|
| **VERIFIED-PASS** | A passing automated test already asserts this Edison behavior (the ~5 core rules). |
| **NEEDS-TEST** | Expected behavior is defined & testable, but no automated test exists yet. |
| **KNOWN-GAP** | A confirmed engine gap (R10 LP-cost). *(See note: a patch + tests now exist — confirm CI.)* |
| **CARVE-OUT** | Likely human-adjudicated (R12 infinite loops); engine may not enforce. Needs a validation spike. |
| **NEEDS-AUTHORING** | Errata card lacks a correct pre-errata script (author, edit, or wire it). |
| **SUBSTITUTE-WIRED** | Errata card already uses a pre-errata substitute alias — **still NEEDS-TEST to confirm** the wiring is active. |
| **RULES-LEVEL-RULING** | Errata entry that is really a rule (3 damage-step rulings + 3 archetype reps) — cross-linked to the relevant R-row, not duplicated as a script task. |

**Source keys.** `RD` = https://www.edisonformat.com/edison-rule-differences.html (Rules #1–13) ·
`RB` = https://www.edisonformat.com/rulebook.html + /rules.html (Master Rule 1 base) ·
`FE` = https://www.edisonformat.com/functional-errata.html (36 errata entries).

**Engine reference.** `EDISON_FLAGS = OcgDuelMode.MODE_GOAT | 0x400000000n = 0x7f80d072c` (custom WASM).
Accuracy tests live in `packages/engine/src/edisonRules.accuracy.test.ts` and use the low-level harness
`packages/engine/src/testSupport/createDuelWithState.ts` (`createDuelWithState({extraCards0, extraCards1,
deck0, deck1, startingLP, startingDrawCount})` + `driveDuel(lib, handle, cb)` asserting on the ocgcore
message stream). Tests are `describe.skipIf(!WASM_AVAILABLE)` — they only run when the custom WASM
artifact is present.

---

## Rollup summary (seeds the project accuracy STATUS section)

**Acceptance-gate rows (§1 rules + §2 base + §3 errata) = 127.**

| Status | Count | Where |
|--------|------:|-------|
| VERIFIED-PASS | **5** | §1: R01-B1, R02-B2, R06-B2, R06-B3, R13-B1 |
| NEEDS-TEST | **80** | §1 (67) + §2 base (13) |
| KNOWN-GAP | **4** | §1 R10 LP-cost (B1, B2, B2a, B2b) |
| CARVE-OUT | **2** | §1 R12 infinite loops (B1, B2) |
| NEEDS-AUTHORING | **24** | §3 errata |
| SUBSTITUTE-WIRED | **6** | §3 errata (Brionac, Sangan, Rescue Cat, Goyo, Brain Control, Future Fusion) |
| RULES-LEVEL-RULING | **6** | §3 errata (Cyber Phoenix, D.D. Survivor, Jade Knight, Lumina, Machina Gearframe, Susa Soldier) |
| **TOTAL** | **127** | |

**Section breakdown.** §1 rules = 78 (5 VERIFIED-PASS · 67 NEEDS-TEST · 4 KNOWN-GAP · 2 CARVE-OUT) ·
§2 base = 13 (all NEEDS-TEST) · §3 errata = 36 (24 NEEDS-AUTHORING · 6 SUBSTITUTE-WIRED ·
6 RULES-LEVEL-RULING).

**Also tracked (not double-counted above):** §4 staples spot-check = **17 fixture rows** (Tier 3, all
NEEDS-TEST until pool-legality confirmed) · §5 engineering data items = **2** (cross-linked to errata
rows ERR-ULTIMATE-OFFERING and ERR-REDMD).

**Grand total tracked rows = 127 + 17 = 144**, plus 2 engineering annotations.

> **Coverage headline for the STATUS section:** 5 of 127 acceptance-gate behaviors are automated-verified
> today (~4%). The dominant work item is **80 NEEDS-TEST** behaviors (rules + base) and **24
> NEEDS-AUTHORING** errata scripts. LP-cost (4) may already be green pending CI confirmation of the
> patched WASM (see R10 notes).

---

# §1 — Rules-level behaviors (Tier 1, COMPLETE — 78 rows)

> Source for all of §1: **RD** (https://www.edisonformat.com/edison-rule-differences.html), Rules #1–13.
> IDs, expected behavior, and engine-flag mapping are from edison-rules-reference.md §1 (all `[verified]`
> unless the reference tagged otherwise).

## R01 — Starting Player Draws a Card

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R01-B1** | R01 Starting draw | Player going FIRST draws in their turn-1 Draw Phase → hand = 6 (5 + 1). | RD #1 | **EXISTS** — `edisonRules.accuracy.test.ts` › "Edison Rule 3 — first-turn draw (FIRST_TURN_DRAW)" › "seat 0 draws 6 cards total before first IDLECMD". Count player-0 DRAW = 6 before first SELECT_IDLECMD. | · | · | VERIFIED-PASS | 1 | Flag `DUEL_1ST_TURN_DRAW 0x200`. |
| **R01-B2** | R01 No turn-1 BP | The player going first CANNOT conduct a Battle Phase on turn 1. | RD #1 | Start a duel; on player-0 turn-1 SELECT_IDLECMD assert `to_bp` is false/absent; drive turn 1 and assert NO SELECT_BATTLECMD is ever emitted before NEW_TURN(turn 2). | · | · | NEEDS-TEST | 1 | Base MR1 turn structure; confirm engine enforces (reference `[likely]`). |

## R02 — Only 1 Active Field Spell

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R02-B1** | R02 One field | At most ONE Field Spell face-up on the whole field (shared across both players). | RD #2 | Set up P0 active field spell + P1 active field spell attempt; after resolution assert exactly one field-spell card is face-up in a Field Zone. | · | · | NEEDS-TEST | 1 | Flag `DUEL_1_FACEUP_FIELD 0x400`. |
| **R02-B2** | R02 Activate destroys | Activating a new Field Spell while one is active DESTROYS the old (to GY as destroyed). | RD #2 | **EXISTS** — `edisonRules.accuracy.test.ts` › "Edison Rule 4 — one face-up field spell" › "Umi [22702055] sent to GRAVE when Mountain [50913601] is activated". | · | · | VERIFIED-PASS | 1 | Confirms MOVE Umi→GRAVE. |
| **R02-B3** | R02 Set ≠ destroy | SETTING a Field Spell face-down does NOT destroy the opponent's active Field Spell. | RD #2 | P1 active Umi; P0 SETS a field spell face-down (not activate); assert NO MOVE of Umi to GRAVE. | · | · | NEEDS-TEST | 1 | Reference `[likely]`. |
| **R02-B4** | R02 Resolve destroys | Activate Mountain while opp Umi active, no response → on Mountain resolution Umi destroyed. | RD #2 | P0 activates Mountain vs P1 Umi; both decline responses; after CHAIN resolves assert Umi→GRAVE. | · | · | NEEDS-TEST | 1 | Chain-timing case of B2. |
| **R02-B5** | R02 Chained MST | Same setup; P1 chains Dust Tornado at Mountain → Mountain destroyed, Umi survives (new field never resolved). | RD #2 | P0 activates Mountain; P1 chains Dust Tornado [60082869] targeting Mountain; after chain resolves assert Mountain→GRAVE AND Umi still face-up (no Umi MOVE to GRAVE). | · | · | NEEDS-TEST | 1 | Key "never replaced the old" case. |
| **R02-B6** | R02 Set vs Activate legality | You may SET Umi vs opp Secret Village + Spellcaster (Village not destroyed), but cannot ACTIVATE Umi without controlling a Spellcaster. | RD #2 | Opp controls Secret Village [03282221] + a Spellcaster; assert SET Umi is offered & Secret Village not destroyed; assert ACTIVATE Umi NOT offered unless P0 controls a Spellcaster. | · | · | NEEDS-TEST | 1 | Distinguishes "set always legal" vs "activation must be legal". Confirm card passcodes in pool. |
| **R02-B7a** | R02 Set→Geartown | SET Mausoleum over own Geartown → destroyed by game mechanic WITHOUT a chain → Geartown GY effect CAN activate. | RD #2 | P0 SETS Mausoleum [80921533] over own face-up/down Geartown [08067863]; assert Geartown destroyed and its GY trigger IS offered (SELECT_CHAIN). | · | · | NEEDS-TEST | 1 | Chain-timing nuance vs B7b. |
| **R02-B7b** | R02 Activate→Geartown | ACTIVATE Mausoleum over own Geartown → destroyed WHILE starting a chain → Geartown GY effect CANNOT activate. | RD #2 | P0 ACTIVATES Mausoleum over own Geartown; assert Geartown destroyed and its GY trigger is NOT offered. | · | · | NEEDS-TEST | 1 | Contrast with B7a. |

## R03 — Union Monster Conditions

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R03-B1** | R03 1 Union/monster | A monster may be equipped with only 1 Union at a time (applies to ALL Unions in Edison). | RD #3 | Equip a Union to a monster already Union-equipped; assert the 2nd equip is illegal (not offered / rejected). Use Machina Gearframe [42940404] + Machina Peacekeeper [78349103]. | · | · | NEEDS-TEST | 1 | See rep ERR-MACHINAGEARFRAME (RULES-LEVEL-RULING). `aux.AddUnionProcedure` should enforce. |
| **R03-B2** | R03 destroy-instead | "If equipped would be destroyed, destroy this instead" appears ONLY on: Armored Cybern, Oilman, Heavy Mech Support Platform, Spirit of the Six Samurai, Machina Gearframe, Machina Peacekeeper. | RD #3 | For each listed Union: equip to a monster, target the equipped monster for destruction, assert the UNION is destroyed instead (equipped monster survives). | · | · | NEEDS-TEST | 1 | Per-card script. |
| **R03-B3** | R03 no-protect | Unions NOT on the B2 list do NOT protect the equipped monster (destroyed normally). | RD #3 | Equip a non-listed Union; destroy the equipped monster; assert the equipped monster IS destroyed (no substitution). | · | · | NEEDS-TEST | 1 | Reference `[likely]` (inverse of B2). |

## R04 — Phase-Dependent Mandatory Trigger Effects

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R04-B1** | R04 negated-activation re-fires | If the ACTIVATION of a phase-mandatory trigger is negated (Light and Darkness Dragon), it activates AGAIN, repeatedly, until it resolves. | RD #4 | Board: a Lightsworn with End-Phase mill + LADD [47297616] on field. Enter End Phase; assert the mandatory mill re-activates after LADD negates the activation, until it finally resolves. | · | · | NEEDS-TEST | 1 | Drives ERR-LIGHTANDDARKNESS. Curation: LADD script uses EFFECT_COUNT_CODE_CHAIN limiting negate to once/chain — must allow negate every activation. |
| **R04-B2** | R04 negated-effect no re-fire | If the EFFECT is negated (Skill Drain), the effect does NOT activate again. | RD #4 | Same trigger under Skill Drain [82732705]; assert it does NOT re-activate after its effect is negated. | · | · | NEEDS-TEST | 1 | Confirm Skill Drain in pool. |
| **R04-B3** | R04 scope | Covers phase-mandatory triggers: Spirit monsters (End-Phase return), Lightsworns + Judgment Dragon (End-Phase mill). | RD #4 | Enumerate qualifying cards; assert re-activation-when-negated for a representative Spirit (Susa Soldier [40473581]) AND a Lightsworn (Lumina [95503687]). | · | · | NEEDS-TEST | 1 | Reps: ERR-LUMINA, ERR-SUSASOLDIER (RULES-LEVEL-RULING). |

## R05 — Trap Monster Zone Blocking (16 interactions)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R05-B1** | R05 dual-zone | Face-up Trap Monster occupies 1 MZone + 1 S/T Zone; its S/T zone becomes unusable. | RD #5 | Activate a Trap Monster (Embodiment of Apophis [46461247] / Metal Reflect Slime [26593934]); with the S/T zone it came from, assert you cannot Set/activate another S/T there while it is face-up as a monster. | · | · | NEEDS-TEST | 1 | Confirm trap-monster cards in pool + scripted. |
| **R05-B2** | R05 no MZone → no flip | Cannot activate (flip up) a Set Trap Monster with no empty Monster Zone. | RD #5 | Fill all 5 P0 MZones; assert a Set Trap Monster's activation is NOT offered. | · | · | NEEDS-TEST | 1 | |
| **R05-B3** | R05 control-gain needs both | Gaining control of a Trap Monster (Snatch Steal/Creature Swap) needs an open MZone AND an open S/T Zone. | RD #5 | Attempt Creature Swap [31036355] / Snatch Steal of a Trap Monster with a full MZone or full S/T zone; assert the action is illegal unless BOTH have an open zone. | · | · | NEEDS-TEST | 1 | |
| **R05-B4** | R05 Jinzo revert | A Trap Monster negated by Jinzo reverts to a Trap Card in the S/T Zone immediately. | RD #5 | Summon Jinzo [77585513] with a face-up Trap Monster present; assert MOVE MZone→SZone (reverts to trap card). | · | · | NEEDS-TEST | 1 | |
| **R05-B4a** | R05 Jinzo attack | Trap Monster attacks a Set Jinzo; on flip it reverts to a Trap Card; NO damage calculation. | RD #5 | Trap Monster attacks Set Jinzo; assert Jinzo flips, Trap Monster reverts, and BATTLE/damage is not applied. | · | · | NEEDS-TEST | 1 | |
| **R05-B4b** | R05 Jinzo + Snatch | Your Trap Monster stolen by Snatch Steal returns to YOUR S/T Zone when Jinzo is Summoned. | RD #5 | P1 controls P0's Trap Monster via Snatch Steal [45986603]; Summon Jinzo; assert it returns to P0 (owner) S/T Zone. | · | · | NEEDS-TEST | 1 | Ownership, not controller. |
| **R05-B5** | R05 Book of Moon | A Trap Monster that would be Set face-down (Book of Moon) is instead Set to its S/T Zone as a trap card. | RD #5 | Book of Moon [14087893] a face-up Trap Monster; assert MOVE to S/T Zone (trap card), not a face-down monster. | · | · | NEEDS-TEST | 1 | |
| **R05-B5a** | R05 Apophis controller | Opp controls YOUR Embodiment of Apophis and it is flipped face-down → goes to the OPPONENT's (current controller's) S/T Zone. | RD #5 | Opp controls P0's Apophis (via Snatch/Swap); flip it face-down; assert it goes to opponent's S/T Zone. | · | · | NEEDS-TEST | 1 | Current controller, not owner (contrast B4b). |
| **R05-B6a** | R05 vs Heavy Storm | vs Heavy Storm: Fake Trap CAN prevent trap-monster destruction; My Body as a Shield CANNOT. | RD #5 | Heavy Storm [19613556] vs a Trap Monster; assert Fake Trap [69826768] prevents its destruction and My Body as a Shield [69279219] does not. | · | · | NEEDS-TEST | 1 | Ties to ERR-MYBODY. |
| **R05-B6b** | R05 vs Lightning Vortex | vs Lightning Vortex (destroys monsters): My Body as a Shield CAN prevent; Fake Trap CANNOT. | RD #5 | Lightning Vortex [69162969] vs a Trap Monster; assert My Body as a Shield prevents, Fake Trap does not. | · | · | NEEDS-TEST | 1 | |
| **R05-B6c** | R05 vs Raigeki Break | vs Raigeki Break ("a card"): BOTH My Body as a Shield AND Fake Trap can prevent. | RD #5 | Raigeki Break [04178474] vs a Trap Monster; assert both prevent destruction. | · | · | NEEDS-TEST | 1 | |
| **R05-B7** | R05 leaves as trap | A Trap Monster removed from the field is removed AS a Trap Card. | RD #5 | Remove a Trap Monster from field; assert its type on leaving the field is Trap (not Monster). | · | · | NEEDS-TEST | 1 | Umbrella for B7a–B7d. |
| **R05-B7a** | R05 GY as trap | Trap Monster in GY: cannot be revived by Time Machine / Return of the Doomed; won't trigger Shura; cannot activate Michizure. | RD #5 | Send a Trap Monster to GY; assert Time Machine [80987696] / Return of the Doomed / Michizure cannot target it and Blackwing - Shura [58820853] does not trigger. | · | · | NEEDS-TEST | 1 | |
| **R05-B7b** | R05 Caius vs Zoma | Caius banishes Zoma the Spirit (a Trap Monster) → NO damage (banished as trap, not DARK monster). | RD #5 | Caius [09748752] banishes face-up Zoma [79852326]; assert no 1000 burn is inflicted. | · | · | NEEDS-TEST | 1 | |
| **R05-B7c** | R05 Penguin Soldier | Trap Monster bounced by Penguin Soldier returns AS a Trap Card; Major Riot cannot be activated. | RD #5 | Penguin Soldier [93920745] bounces a Trap Monster; assert it returns to hand as a Trap Card and Major Riot cannot activate. | · | · | NEEDS-TEST | 1 | |
| **R05-B7d** | R05 temp removal | Temporarily removed (Dimensionhole / Interdimensional Matter Transporter) → returns AS a Trap Card and is destroyed IMMEDIATELY by game mechanic. With Dimensionhole: MZone unusable while removed, but the S/T zone IS usable. | RD #5 | Interdimensional Matter Transporter [36261276] removes a face-up Trap Monster; assert on return it is a Trap Card destroyed immediately; for Dimensionhole assert MZone blocked but S/T zone free while removed. | · | · | NEEDS-TEST | 1 | Deepest-nested R05 case. |

## R06 — Ignition Effect Priority

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R06-B1** | R06 CL1 ignition | After a Summon that did NOT start a chain, TP may activate an Ignition Effect as CL1 before opponent responds. | RD #6 | After Special Summoning Chaos Sorcerer [09596126] (or Ritual-summoning Demise), assert seat 0 is offered its ignition as CL1 before the opponent's response window. | · | · | NEEDS-TEST | 1 | Flags `OBSOLETE_IGNITION 0x100` + `FAST_EFFECT_IGNITION 0x400000000`. Generalizes B2/B3. |
| **R06-B2** | R06 MZone ignition | Priority applies to Monster-Zone ignition effects. | RD #6 | **EXISTS** — `edisonRules.accuracy.test.ts` › "Edison Rule 2 — MZone ignition priority" › "seat 0 offered SELECT_CHAIN with Lonefire [48686504] as CL1 after Normal Summon". | · | · | VERIFIED-PASS | 1 | `OBSOLETE_IGNITION`. |
| **R06-B3** | R06 GY ignition | Priority extends to GY ignition effects (discard Malicious → SS, banish-self before D.D. Crow). | RD #6 | **EXISTS** — `edisonRules.accuracy.test.ts` › "Edison Rule 1 — GY ignition priority" › "seat 0 is offered SELECT_CHAIN with Malicious [9411399] BEFORE opponent after Normal Summon". | · | · | VERIFIED-PASS | 1 | Needs `FAST_EFFECT_IGNITION 0x400000000` (custom WASM only). |
| **R06-B4a** | R06 opp trigger starts chain | If opponent's trigger (Black Garden) starts the chain in response to the SS, TP may only add fast effects — NOT insert a fresh CL1 ignition. | RD #6 | P0 Special Summons into opp face-up Black Garden [71645242]; assert P0 canNOT activate a monster ignition as a fresh CL1 (only fast-effect responses onto the existing chain). | · | · | NEEDS-TEST | 1 | |
| **R06-B4b** | R06 material trigger starts chain | If the material's own trigger starts a chain (Sangan as Synchro Material), TP cannot activate the new monster's ignition (Brionac) in that window. | RD #6 | Synchro-summon Brionac [50321796] using Sangan [26202165] as material; assert Brionac's ignition is NOT offered while Sangan's trigger holds the chain. | · | · | NEEDS-TEST | 1 | |
| **R06-B4c** | R06 Normal-summon trigger | On Normal Summon of a monster with a Trigger (Armageddon Knight), TP may use THAT trigger or pass — no other card as CL1; opp may respond with Torrential. | RD #6 | Normal Summon Armageddon Knight [28985331]; assert only its own trigger (or pass) is available as CL1, and Torrential Tribute [53582587] is a valid opponent response. | · | · | NEEDS-TEST | 1 | |
| **R06-B5** | R06 priority-as-right | Priority is a right that exists whether or not TP declares intent (fast-effect-timing flowchart + ignition priority). | RD #6 | **Documentation-only** — verify via rules-guide review; no discrete engine assertion. See "Needs clarification" callout. | · | · | NEEDS-TEST | 1 | Reference marks engine mapping `n/a (documentation)`. |

## R07 — Simultaneous Effects Go On Chain (SEGOC)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R07-B1** | R07 4-step order | Chain built: (1) TP mandatory → (2) NTP mandatory → (3) TP optional → (4) NTP optional, each in trigger order. | RD #7 | Construct a board with one trigger in each of the 4 buckets firing simultaneously; assert the SELECT_CHAIN / chain-link ordering matches TP-mand → NTP-mand → TP-opt → NTP-opt. | · | · | NEEDS-TEST | 1 | Flags `SEGOC_NONPUBLIC 0x100000000` + `SEGOC_FIRSTTRIGGER 0x200000000`. |
| **R07-B2** | R07 earlier-first | Within a step, effects triggered at DIFFERENT times → the EARLIER trigger goes on chain FIRST (pre-2017). | RD #7 | Two same-step triggers with distinct trigger times; assert the earlier-triggered one is the lower chain link. | · | · | NEEDS-TEST | 1 | `SEGOC_FIRSTTRIGGER`. |
| **R07-B3** | R07 Sangan+Caius | Tribute Sangan to Tribute-Summon Caius (both TP mandatory) → Sangan (sent to GY) = CL1, Caius (summon success, later) = CL2. | RD #7 | Tribute own Sangan [26202165] for Caius [09748752]; assert Sangan trigger = CL1, Caius trigger = CL2. | · | · | NEEDS-TEST | 1 | |
| **R07-B4** | R07 Soul Exchange ownership | Soul Exchange opp's Sangan; tribute it for Caius → TP-mandatory Caius (Step1) = CL1; NTP-mandatory Sangan (Step2) = CL2 (ownership decides step). | RD #7 | Soul Exchange [68005187] opp's Sangan, tribute for Caius; assert Caius = CL1, Sangan = CL2. | · | · | NEEDS-TEST | 1 | Ties to ERR-SOULEXCHANGE. |

## R08 — The 7-timing Damage Step (9 activation-legality + 7 substeps)

> Engine flags: `DUEL_6_STEP_BATLLE_STEP 0x08` + `DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP 0x40000000`.
> Naming: engine says "6-step"; edisonformat says "7-timing" — same behavior (docs standardize on "7 substeps").
> Spike-verified: Damage Step is a distinct phase; **Book of Moon NOT offered** in DS; **Honest IS offered**.

### R08 activation-legality (apply across the whole Damage Step)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R08-A1** | R08 Counter Traps | Counter Trap Cards may activate at ANY point in the DS. | RD #8 | In a Damage Step, assert a Counter Trap (Divine Wrath [49010598] / Solemn Judgment [41420027]) is offered. | · | · | NEEDS-TEST | 1 | |
| **R08-A2** | R08 negate-activation monsters | Monster effects that negate ACTIVATIONS (Herald of Orange Light) may activate at any point in DS. | RD #8 | In DS, assert Herald of Orange Light [26649759] is offered when a trigger to negate is present. | · | · | NEEDS-TEST | 1 | |
| **R08-A3** | R08 negate-effect monsters | Monster effects that only negate EFFECTS cannot activate in DS. | RD #8 | In DS, assert an effect-only-negation monster effect is NOT offered. | · | · | NEEDS-TEST | 1 | |
| **R08-A4** | R08 SS2 negate-activation S/T | SS2 Spells/Traps that negate ACTIVATIONS (My Body as a Shield) CANNOT activate in DS. | RD #8 | In DS, assert My Body as a Shield [69279219] is NOT offered. | · | · | NEEDS-TEST | 1 | Ties to ERR-MYBODY (curation: remove DAMAGE_STEP flags). |
| **R08-A5** | R08 SS2 negate-effect S/T | SS2 Spells/Traps that negate EFFECTS (Royal Oppression) CANNOT activate in DS. | RD #8 | In DS, assert Royal Oppression [93016201] is NOT offered. | · | · | NEEDS-TEST | 1 | |
| **R08-A6** | R08 mandatory | Mandatory effects (Doomcaliber Knight) may activate at any point in DS. | RD #8 | In DS with the trigger condition met, assert Doomcaliber Knight [78700060] mandatory effect fires. | · | · | NEEDS-TEST | 1 | |
| **R08-A7** | R08 move/action | An effect can activate if its card moves location or performs an action (Flip effect; Green Gadget SS'd by Giant Rat; Geartown destroyed by battle). | RD #8 | In DS, trigger a Flip effect via battle flip and a Giant Rat [91190709]→Green Gadget [41172955] SS; assert those effects are offered. | · | · | NEEDS-TEST | 1 | |
| **R08-A8** | R08 ATK/DEF fast effects | Fast/continuous effects that directly modify ATK/DEF can activate/apply in DS. | RD #8 | In DS, assert Honest [37742478] IS offered (spike-verified). | · | · | NEEDS-TEST | 1 | Spike A2 empirically saw Honest offered; formalize as a test. |
| **R08-A9** | R08 chalice cutoff | S/T that change ATK/DEF (Forbidden Chalice) CANNOT activate in or after Substep 4 (Damage Calculation). | RD #8 | Drive to damage-calc substep; assert Forbidden Chalice [25789292] is NOT offered at/after S4. | · | · | NEEDS-TEST | 1 | |

### R08 substeps

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R08-S1** | R08 S1 Start of DS | "During the DS" effects apply; "start of DS" triggers activate; Quick + S/T ATK/DEF modifiers can activate. | RD #8 | Enter DS; assert a "start of Damage Step" trigger and an ATK/DEF modifier are offered at S1. | · | · | NEEDS-TEST | 1 | |
| **R08-S2** | R08 S2 Flip face-up | Face-down attack target flipped face-up (Flip effect NOT yet activated); set-target effects begin applying. | RD #8 | Attack a face-down monster; assert it is flipped face-up at S2 but its Flip effect is NOT yet on the chain. | · | · | NEEDS-TEST | 1 | |
| **R08-S3** | R08 S3 Before damage calc | "Before damage calculation" effects activate/apply; Quick + S/T ATK/DEF modifiers can activate. | RD #8 | Drive to S3; assert a "before damage calculation" effect is offered. | · | · | NEEDS-TEST | 1 | |
| **R08-S4** | R08 S4 Damage calc | Monster Quick ATK/DEF CAN activate, S/T ATK/DEF CANNOT; single manual chain; then battle damage + monsters marked "destroyed by battle". | RD #8 | At S4 assert a monster Quick ATK/DEF effect is offered but an S/T ATK/DEF (Forbidden Chalice) is not; assert only one chain; assert destroyed-by-battle marking. | · | · | NEEDS-TEST | 1 | Pairs with A9. |
| **R08-S5** | R08 S5 After damage calc | Destroyed monsters stop continuous effects; self-destruct/continuous (Gozen/Rivalry) apply; single chain (+ Gorz); "when battle damage is inflicted" triggers. | RD #8 | Deal battle damage; assert Gorz [44330098] can activate at S5 and continuous effects of a destroyed monster stop. | · | · | NEEDS-TEST | 1 | |
| **R08-S6** | R08 S6 Resolve effects | Single chain (+ additional if triggered while resolving, e.g. Ryko mill as CL1); "after damage calc" effects; Flip effects activate. | RD #8 | Battle-flip Ryko [21502796]; assert its Flip effect activates at S6 and forms/extends a chain. | · | · | NEEDS-TEST | 1 | |
| **R08-S7** | R08 S7 End of DS | Destroyed-by-battle monsters sent to GY now; single chain (+ Mystic Tomato SS as CL1); "when destroyed by battle" effects. | RD #8 | Battle-destroy Mystic Tomato [83011277]; assert it is sent to GY at S7 and its search/SS trigger fires there. | · | · | NEEDS-TEST | 1 | |

## R09 — Trigger Location & Mid-Chain Triggers

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R09-B1** | R09 mid-chain recognition | A trigger condition can be recognized as met in the MIDDLE of a chain. | RD #9 | Construct a chain where a condition becomes met during resolution; assert the trigger is recognized and offered. | · | · | NEEDS-TEST | 1 | |
| **R09-B2** | R09 outside location | Trigger effects activate from outside their trigger location (incl. from within the Deck) unless the card requires otherwise. | RD #9 | Umbrella — assert via B2a–B2d. | · | · | NEEDS-TEST | 1 | |
| **R09-B2a** | R09 Dandylion cost | Discard Dandylion as cost for Monster Reincarnation and add it back to hand → the Fluff-Token effect still triggers/activates from the GY. | RD #9 | Discard Dandylion [15341821] as cost for Monster Reincarnation [08491961], returning it to hand; assert the 2-Fluff-Token effect still activates. | · | · | NEEDS-TEST | 1 | |
| **R09-B2b** | R09 Necroface deck | Necroface + Future Visions: its banish effect starts a new chain triggering from the Deck. | RD #9 | Necroface [12057781] under Future Visions [05043010]; assert its "banish top 5" effect starts a new chain from the Deck. | · | · | NEEDS-TEST | 1 | |
| **R09-B2c** | R09 Aslla contrast | Aslla Piscu returned to the DECK from the field → its destroy-and-burn leave-field effect does NOT activate. | RD #9 | Phoenix Wing Wind Blast [63356631] returns Aslla Piscu [05334927] to Deck; assert no destroy/burn. | · | · | NEEDS-TEST | 1 | Negative assertion. |
| **R09-B2d** | R09 Absolute Zero contrast | Absolute Zero returned to the EXTRA DECK from the field → its "destroy opp monsters" effect DOES activate. | RD #9 | PWWB returns face-up Absolute Zero [40854197] to Extra Deck; assert its destroy-all-opp-monsters effect DOES trigger. | · | · | NEEDS-TEST | 1 | Positive assertion, contrasts B2c. |

## R10 — Life Points Costs  ⚠️ KNOWN-GAP (patch + tests may already resolve — confirm CI)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R10-B1** | R10 cost-to-0 illegal | Cannot pay an LP cost that would reduce LP to 0 (action illegal). | RD #10 | **EXISTS (require patched WASM)** — `edisonRules.accuracy.test.ts` › "Edison Rule 6 — LP-cost strict patch" › "Brain Control [87910978] absent from activates when LP=800 (exact cost — ILLEGAL)" + "...present when LP=801...". | · | · | KNOWN-GAP | 1 | Patch `patches/ocgcore-lp-cost-strict.patch` (`<=`→`<` in field.cpp/operations.cpp) per decision 2026-07-14. **If patched WASM is live in CI, flip to VERIFIED-PASS.** |
| **R10-B2** | R10 maintenance self-destruct | A card with an LP maintenance cost that can't be paid self-destructs. | RD #10 | Board a maintenance-cost card at threshold LP; enter the maintenance timing; assert MOVE self→GRAVE (self-destruct). | · | · | KNOWN-GAP | 1 | Depends on same patch. |
| **R10-B2a** | R10 Mirror Wall | LP ≤ 2000 → Mirror Wall's OPTIONAL maintenance can't be paid → it self-destructs. | RD #10 | Set P0 LP ≤ 2000 with Mirror Wall [22359980] active; at Standby assert Mirror Wall→GRAVE. | · | · | KNOWN-GAP | 1 | |
| **R10-B2b** | R10 Degenerate Circuit | LP ≤ 500 → Degenerate Circuit's MANDATORY maintenance can't be paid → it self-destructs. | RD #10 | Set P0 LP ≤ 500 with Degenerate Circuit [39168895] active; at Standby assert it self-destructs. | · | · | KNOWN-GAP | 1 | Confirm card in pool. |

## R11 — End-of-Turn Discard (hand size)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R11-B1** | R11 no response | Players cannot respond to the end-of-turn hand-size discard (last action of the turn). | RD #11 | Force a hand-size discard at End Phase; assert NO SELECT_CHAIN / response window is offered around the discard. | · | · | NEEDS-TEST | 1 | |
| **R11-B2a** | R11 SS2 only if negates | When a mandatory Trigger is triggered by the discard, SS2 effects may chain ONLY IF they negate activations/effects. | RD #11 | Discard a card with a mandatory discard-trigger; assert a non-negating SS2 cannot chain but a negating SS2 can. | · | · | NEEDS-TEST | 1 | |
| **R11-B2b** | R11 SS3 always | In that chain, SS3 (Counter Trap) effects may chain regardless of whether they negate. | RD #11 | Same chain; assert a Counter Trap can chain even if non-negating. | · | · | NEEDS-TEST | 1 | |
| **R11-B3** | R11 White Stone example | Discard White Stone of Legend for hand size → mandatory trigger must activate; canNOT chain Super Rejuvenation (SS2 non-negating); opp CAN chain Divine Wrath (SS3); face-up Doomcaliber Knight tributes itself, adding a chain link. | RD #11 | Discard White Stone of Legend [30596061]; assert its trigger fires, Super Rejuvenation [27770341] cannot chain, Divine Wrath [49010598] can, and a face-up Doomcaliber Knight [78700060] self-tributes adding a link. | · | · | NEEDS-TEST | 1 | |
| **R11-B4** | R11 optional blocked | Discarding Peten / Red-Eyes Wyvern for hand size → their OPTIONAL triggers CANNOT activate. | RD #11 | Discard Peten the Dark Clown [40991692] and Red-Eyes Wyvern [10068575] for hand size; assert neither optional trigger is offered. | · | · | NEEDS-TEST | 1 | |

## R12 — Infinite Loops  ⚠️ CARVE-OUT (likely human-adjudicated)

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R12-B1** | R12 voluntary illegal | Any voluntary action that would create an infinite loop is ILLEGAL (e.g. X-Head Cannon into Luminous Spark/Pole Position loop; Ring of Destruction into Opticlops/Axe/Pole Position loop). | RD #12 | **Exploratory spike** — attempt the loop-causing action; document whether the engine offers or blocks it. Likely NOT enforced → treat as human judge-call. | · | · | CARVE-OUT | 1 | ocgcore likely won't refuse a voluntary loop the Edison way. Needs engine-validation spike (see clarification). Document as human-adjudicated in user docs. |
| **R12-B2** | R12 involuntary primary-cause | An involuntary (game-mechanic) loop resolves via the "primary cause" being destroyed by game mechanics (Muka Muka forced-draw → Pole Position destroyed). | RD #12 | **Exploratory spike** — set up an involuntary loop; observe whether the engine applies the primary-cause resolution. | · | · | CARVE-OUT | 1 | Same spike. |

## R13 — 0 ATK Monsters

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **R13-B1** | R13 mutual destroy | Two Attack-Position 0-ATK monsters that battle destroy each other. | RD #13 | **EXISTS** — `edisonRules.accuracy.test.ts` › "Edison Rule 5 — 0-ATK battle rule" › "both Ojama Greens [12482652] (0 ATK) destroyed when one attacks the other". | · | · | VERIFIED-PASS | 1 | Flag `DUEL_0_ATK_DESTROYED 0x10000000`. |
| **R13-B2** | R13 can't destroy 0-DEF | A 0-ATK Attack-Position monster CANNOT destroy a 0-DEF Defense-Position monster by battle. | RD #13 | P0 attacks a 0-DEF Defense-Position monster with a 0-ATK attacker; assert BATTLE.target.destroyed = false (defender survives). | · | · | NEEDS-TEST | 1 | Reference `[likely]` for this specific case. |

---

# §2 — Base-rules scaffolding (Master Rule 1) (Tier 1 — 13 rows)

> Source: **RB** (https://www.edisonformat.com/rulebook.html + /rules.html), Master Rule 1 rulebook.
> Teaching layer, kept lighter than §1. Deck-construction rows (BR-01/02/03) are already asserted by the
> deck-legality layer (`packages/server/src/domain/validateDeck.ts`, tests `validateDeck.test.ts` +
> `edisonDeckLegality.test.ts`) — confirm & cite that evidence rather than re-implement.

| ID | Rule / Category | Expected Edison behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **BR-01** | base deck sizes | Main 40–60, Extra 0–15, Side 0–15 (fixed match size). | RB §deck | `validateDeck(deck, catalog)` returns violations for out-of-range sizes; legal for in-range. Cite `validateDeck.test.ts`. | · | · | NEEDS-TEST | 1 | Already covered by validateDeck layer — confirm & cite (candidate VERIFIED-PASS). |
| **BR-02** | base copy cap | Max 3 copies by name; Forbidden 0 / Limited 1 / Semi 2 per March-2010 list. | RB §banlist | `validateDeck` flags `banlist_forbidden/limit` and `copy_limit`; cite `validateDeck.test.ts`. | · | · | NEEDS-TEST | 1 | Combined across all zones by resolved base passcode. |
| **BR-03** | base Extra contents | Extra Deck = Fusion + Synchro only (no Xyz/Pendulum/Link); Ritual → Main. | RB §extra | `validateDeck` flags `wrong_zone` for non-Fusion/Synchro in Extra. Cite test. | · | · | NEEDS-TEST | 1 | Era-correct Extra pool. |
| **BR-04** | base starting LP | Starting LP = 8000 for both players. | RB §setup | Start a duel; assert both seats begin at 8000 LP (message stream / LP query). | · | · | NEEDS-TEST | 1 | |
| **BR-05** | base opening hand | Opening hand = 5 cards for both players. | RB §setup | Start a duel with startingDrawCount 5; assert 5 opening draws per seat before turn-1 draw. | · | · | NEEDS-TEST | 1 | Implied by R01-B1 (6 = 5+1). |
| **BR-06** | base field zones | 5 Monster + 5 S/T + 1 Field per player; NO Extra Monster / Pendulum zones. | RB §field | Assert SELECT_PLACE field masks expose 5 MZone + 5 SZone + 1 Field only. | · | · | NEEDS-TEST | 1 | Pre-Link board. |
| **BR-07** | base turn/phase | Phase order: Draw → Standby → Main1 → Battle → Main2 → End. | RB §phases | Drive a full turn; assert the phase-message sequence matches this order. | · | · | NEEDS-TEST | 1 | |
| **BR-08** | base normal summon | One Normal Summon/Set per turn (baseline). | RB §summon | Attempt a 2nd Normal Summon same turn; assert not offered (absent extra-summon cards). | · | · | NEEDS-TEST | 1 | Ultimate Offering / Swap Frog grant extras (see §3). |
| **BR-09** | base hand-size | End Phase hand-size limit = 6; excess discarded. | RB §endphase | Hold 7+ cards at End Phase; assert a discard-to-6 is required. | · | · | NEEDS-TEST | 1 | Pairs with R11. |
| **BR-10** | base win conditions | Win by LP to 0, deck-out (can't draw when required), or card-specific (Exodia). | RB §win | Assert a duel ends with a win when LP hits 0 and when a required draw fails. | · | · | NEEDS-TEST | 1 | |
| **BR-11** | base Synchro | Synchro = 1 Tuner + non-Tuner(s) whose Levels sum EXACTLY to the Synchro's Level; from Extra. | RB §summon | Attempt a Synchro with a non-matching level sum; assert illegal; matching sum legal. | · | · | NEEDS-TEST | 1 | Era signature mechanic. |
| **BR-12** | base tributes | L5–6 need 1 tribute; L7+ need 2. | RB §summon | Attempt tribute summons at each threshold; assert tribute-count enforcement. | · | · | NEEDS-TEST | 1 | |
| **BR-13** | base chains/spell speed | Chains resolve LIFO; a link can only be answered by equal/higher spell speed (SS1<SS2<SS3). | RB §chains | Build a 2-link chain; assert LIFO resolution and that SS1 cannot respond to SS2. | · | · | NEEDS-TEST | 1 | Priority basics pair with R06. |

---

# §3 — Functional-errata cards (Tier 2, EXHAUSTIVE — 36 rows)

> Source: **FE** (https://www.edisonformat.com/functional-errata.html), all 36 entries.
> Status derives from the reference §3 3-way tag. Notes carry the curation verdict
> (DROP-IN / EDIT / MODERN-OK / real authoring) from `card-script-curation.md` and the passcode/alias map.
> **RULES-LEVEL-RULING** rows are cross-linked to the relevant R-row and are NOT script tasks.

| ID | Card | Passcode → alias | Expected Edison (pre-errata) behavior | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|----|
| **ERR-ARMORYARM** | Armory Arm | 29071332 | Trigger inflicts damage even if the destroyed monster leaves the GY, = ATK it had on field (incl. modifiers). Colossal Fighter + Armory Arm OTK works. | FE | Equip Armory Arm; destroy a monster by battle; remove it from GY before resolution; assert damage still = its field ATK. | · | · | NEEDS-AUTHORING | 2 | Curation: MODERN-OK — diff-verify modern script already matches; author only if it diverges. |
| **ERR-ANCIENTFAIRY** | Ancient Fairy Dragon | 25862681 → 25862691 | 2nd ignition (destroy a Field Spell) does NOT target; if it doesn't destroy, don't gain LP / don't add; destroy+LP simultaneous, add-field after. Usable in MP2. | FE | Activate the destroy-field ignition; assert non-targeting + correct sequencing + MP2 legality. | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo (25862691) but curation flags fixes: e1 PHASE_MAIN1-only (allow MP2), e2 destroys ALL zones (should choose one). AUTHOR. |
| **ERR-BLACKGARDEN** | Black Garden | 71645242 | Trigger activates even if a monster is Special Summoned FACE-DOWN. | FE | Special Summon a monster face-down into Black Garden; assert its token/ATK-halving trigger still fires. | · | · | NEEDS-AUTHORING | 2 | Curation: MODERN-OK — diff-verify. Drives R06-B4a. |
| **ERR-BRAINCONTROL** | Brain Control | 87910978 → 511002995 | No modern restriction; flipped-face-down target → control unchanged; control still restored at End Phase even if flipped later. | FE | Use the wired 511002995 alias; assert no modern restriction on target selection + End-Phase return. | · | · | SUBSTITUTE-WIRED | 2 | Alias wired in banlist. Also the LP-cost test card (R10-B1). Still NEEDS-TEST to confirm wiring. |
| **ERR-BRIONAC** | Brionac, Dragon of the Ice Barrier | 50321796 → 511002993 | Ignition (discard N → bounce N) has NO once-per-turn; discard is cost; targets either field. | FE | Load 511002993; activate Brionac's bounce twice in one turn; assert both allowed (no OPT). | · | · | SUBSTITUTE-WIRED | 2 | Pre-errata alias confirmed OPT-free. Confirm wiring active. |
| **ERR-CATAPULTTURTLE** | Catapult Turtle | 95727991 → 511000228 | Ignition (Tribute 1 → burn ½ ATK) has NO OPT. | FE | Load 511000228; use the tribute-burn ignition twice in one turn; assert both allowed. | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo, UNWIRED → WIRE (drop-in). |
| **ERR-CYBERPHOENIX** | Cyber Phoenix | 3370104 | Must be FACE-UP before being selected as attack target for its draw trigger; cannot trigger if attacked while face-down. | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Damage-step ruling → cross-link **R08-S2** (flip-target timing). Curation: modern `IsPreviousPosition(POS_FACEUP)` handles it. NOT a script task. |
| **ERR-DDSURVIVOR** | D.D. Survivor | 48092532 | Same face-up-before-target ruling for its End-Phase revival trigger. | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Damage-step ruling → cross-link **R08-S2**. Modern script handles it. |
| **ERR-DARKENDDRAGON** | Dark End Dragon | 88643579 | Pre-PSCT "and" works as "and if you do"; if target leaves before resolve, this card STILL loses 500 ATK/DEF. | FE | Activate its ignition; remove target before resolution; assert Dark End Dragon still loses 500/500. | · | · | NEEDS-AUTHORING | 2 | Curation: modern uses EFFECT_FLAG_CARD_TARGET; Edison non-targeting — remove card target, move selection to operation. AUTHOR. |
| **ERR-DARKNESSAPPROACHES** | Darkness Approaches | 80168720 → 511003028 | Can flip to face-down ATTACK Position (can't attack; Flip-summonable to face-up ATK). | FE | Load 511003028; assert it can set a monster to face-down Attack Position (position preserved). | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo, UNWIRED → WIRE (drop-in). |
| **ERR-DESTINYENDDRAGOON** | Destiny End Dragoon | 76263644 | Standby-Phase revival trigger has NO once-per-turn. | FE | Trigger the Standby revival twice in one game where possible; assert no OPT block. | · | · | NEEDS-AUTHORING | 2 | Curation: revival SetCountLimit(1) is per-copy = correct; but targeting issue like Dark End Dragon + damage-for-face-down gap. AUTHOR. |
| **ERR-PRISMA** | Elemental HERO Prisma | 89312388 | Reveal+send is ON RESOLUTION, not a cost; if Prisma isn't face-up on resolve, don't send. | FE | Activate Prisma; negate/flip it before resolution; assert nothing is sent (reveal+send was not a cost). | · | · | NEEDS-AUTHORING | 2 | Curation: modern does reveal+send in SetCost — move to operation. AUTHOR. |
| **ERR-FORTUNELADYLIGHT** | Fortune Lady Light | 34471458 | 2nd trigger (leaves field → SS a Fortune Lady) can activate even while FACE-DOWN (reveal it). | FE | Send a face-down Fortune Lady Light to GY; assert its SS-a-Fortune-Lady trigger still activates. | · | · | NEEDS-AUTHORING | 2 | Curation: remove `IsPreviousPosition(POS_FACEUP)` check. AUTHOR. |
| **ERR-FUTUREFUSION** | Future Fusion | 77565204 → 511002997 | Send Fusion Material on resolution; if you can't Special Summon later, you can't activate. | FE | Load 511002997; assert send-on-resolution semantics + can't-activate-if-no-SS. | · | · | SUBSTITUTE-WIRED | 2 | Alias wired; override script present at `packages/engine/scripts/edison-overrides/c511002997.lua`. Confirm wiring. |
| **ERR-GOYO** | Goyo Guardian | 7391448 → 511002994 | ANY Tuner (incl. non-EARTH) may be material. | FE | Load 511002994; Synchro-summon Goyo using a non-EARTH Tuner; assert it is legal. | · | · | SUBSTITUTE-WIRED | 2 | Pre-errata uses `Synchro.AddProcedure(c,nil,...)` = any tuner. Confirm wiring. |
| **ERR-JADEKNIGHT** | Jade Knight | 44364207 | Same face-up-before-target ruling for its destroyed-by-battle search trigger. | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Damage-step ruling → cross-link **R08-S2 / R08-S7**. Curation notes a ① protection gap (Attack Position vs Face-up) — CTO may author ① override. |
| **ERR-LIGHTANDDARKNESS** | Light and Darkness Dragon | 47297616 | Death trigger resolves SEQUENTIALLY: destroy all cards you control, THEN Special Summon the target. Also DRIVES R04 (its activation-negation re-fires phase-mandatory triggers). | FE | Destroy LADD; assert destroy-then-SS ordering. Also assert R04-B1 re-activation. | · | · | NEEDS-AUTHORING | 2 | Curation: EFFECT_COUNT_CODE_CHAIN limits negate to once/chain (Edison allows every activation); destroy+SS uses card target (Edison non-targeting). AUTHOR. Cross-link **R04-B1**. |
| **ERR-LIGHTENDDRAGON** | Light End Dragon | 25132288 | Pre-PSCT "and" = "and if you do"; if opp monster leaves before resolve, this card STILL loses 500 ATK/DEF. | FE | Activate its ignition vs a target; remove target before resolve; assert Light End Dragon still loses 500/500 (incl. vs face-down defender). | · | · | NEEDS-AUTHORING | 2 | Curation: remove `tc:IsFaceup()` check on target. AUTHOR. |
| **ERR-LUMINA** | Lumina, Lightsworn Summoner (+ all Lightsworns) | 95503687 | Phase-mandatory End-Phase mill trigger RE-ACTIVATES if its activation is negated (LADD) until it resolves. Applies to Judgment Dragon + all Lightsworns. | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Rule #4 archetype rep → cross-link **R04-B1 / R04-B3**. Engine-level, not a per-card script. |
| **ERR-MACHINAGEARFRAME** | Machina Gearframe (+ all Union Monsters) | 42940404 | Carries Union [Condition] "1 Union per monster"; listed unions also have "destroy this instead". | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Rule #3 archetype rep → cross-link **R03-B1 / R03-B2**. `aux.AddUnionProcedure` handles it. |
| **ERR-MARKOFTHEROSE** | Mark of the Rose | 45247637 | Has 2 [Trigger] effects, BOTH start a Chain (End Phase give control; Standby regain). If opp Cold Wave stops the Standby trigger, it won't activate. | FE | Assert both triggers start chains; with Cold Wave [60682203] active at Standby, assert the regain trigger does not activate. | · | · | NEEDS-AUTHORING | 2 | Curation: MODERN-OK — diff-verify. |
| **ERR-MAUSOLEUM** | Mausoleum of the Emperor | 80921533 | Uses your Normal Summon/Set for the turn (not extra); LP payment is a cost; Summon on resolution → Solemn Judgment can't negate it, but Torrential can respond after. | FE | Activate Mausoleum's summon; assert it consumes the Normal Summon, Solemn Judgment [41420027] cannot negate, Torrential can respond post-resolution. | · | · | NEEDS-AUTHORING | 2 | Curation: MODERN-OK — diff-verify. Also drives R02-B7a/b (as a field-spell replacement). |
| **ERR-MYBODY** | My Body as a Shield | 69279219 | Can chain to a card/effect (e.g. face-up Royal Oppression); CANNOT be activated in the Damage Step. | FE | Assert it can chain to an activation; assert it is NOT offered in the Damage Step. | · | · | NEEDS-AUTHORING | 2 | Curation: remove EFFECT_FLAG_DAMAGE_STEP + EFFECT_FLAG_DAMAGE_CAL. AUTHOR. Cross-link **R08-A4**, **R05-B6a/b/c**. |
| **ERR-NECROVALLEY** | Necrovalley | 47355498 → 511002998 | 1st [Continuous] only negates effects that TARGET the GY; non-targeting (Rekindling, Treeborn, REDMD) NOT negated; GY Types/Attributes changeable if not by targeting. | FE | Load 511002998; assert Rekindling / Treeborn / REDMD are NOT negated by Necrovalley; targeting-GY effects ARE. | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo, UNWIRED → WIRE. Uses EFFECT_NECRO_VALLEY (broad Edison negation). |
| **ERR-QUICKDRAW** | Quickdraw Synchron | 20932152 | Ignition performs a Special Summon; SEND (not discard) the hand monster ON RESOLUTION, not as cost. | FE | Activate Quickdraw's SS ignition; assert chainable (ignition, not SPSUMMON_PROC) and send-on-resolution (REASON_EFFECT). | · | · | NEEDS-AUTHORING | 2 | Curation: modern uses EFFECT_SPSUMMON_PROC (not chainable) + REASON_COST — MAJOR REWRITE. AUTHOR. |
| **ERR-REDMD** | Red-Eyes Darkness Metal Dragon | 88264978 | NO "once per name" on either the [Summon] (banish a Dragon to SS this) OR the [Ignition] (SS a Dragon); Ignition does NOT target the GY. | FE | With 2 copies / repeated use, assert each REDMD can use its ignition once per turn PER COPY (no once-per-name) and the summon effect has no OPT. | · | · | NEEDS-AUTHORING | 2 | **⚠️ Repo script c88264978.lua is WRONG — still per-name. EDIT** `SetCountLimit(1,id,...)`/`{id,1}` → per-copy `SetCountLimit(1)`. See §5 ENG-REDMD. |
| **ERR-RESCUECAT** | Rescue Cat | 14878871 → 511002992 | NO "once per name"; does not negate the summoned monsters' effects. | FE | Load 511002992; assert no OPT and summoned monsters' effects are not negated. | · | · | SUBSTITUTE-WIRED | 2 | Alias wired. Confirm wiring. |
| **ERR-RYKO** | Ryko, Lightsworn Hunter | 21502796 → 511003007 | [Flip] target is OPTIONAL (if no target, only mills 3); resolves sequentially: destroy (optional) then mill 3 (mandatory). | FE | Load 511003007; flip Ryko with no valid/desired destroy target; assert it still mills 3. | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo, UNWIRED → WIRE. Also fixture card in many §4 lists. |
| **ERR-SANGAN** | Sangan | 26202165 → 511002631 | Searches any monster ≤1500 ATK; you MAY use the searched monster's effects. | FE | Load 511002631; assert search of any ≤1500-ATK monster + no "cannot use its effects" clause. | · | · | SUBSTITUTE-WIRED | 2 | Alias wired. Confirm. Also drives R07-B3/B4. |
| **ERR-SOULEXCHANGE** | Soul Exchange | 68005187 | Tributing the opponent's monster is OPTIONAL; you are NOT forced to tribute it at the earliest opportunity. | FE | Activate Soul Exchange targeting opp monster; assert you are not forced to tribute it; also if activation negated, BP is not skipped. | · | · | NEEDS-AUTHORING | 2 | Curation: BP-skip in cost is wrong (move to operation); EFFECT_EXTRA_RELEASE forces tribute — remove. AUTHOR. Drives R07-B4. |
| **ERR-STRIKENINJA** | Strike Ninja | 41006930 | OPT is PER COPY — multiple Strike Ninja may each use the banish-self effect the same turn. | FE | With 2 Strike Ninja, assert each can use its banish-self effect the same turn. | · | · | NEEDS-AUTHORING | 2 | Curation: `SetCountLimit(1,id)` per-name → per-copy `SetCountLimit(1)`; cost should be GRAVE only. AUTHOR. |
| **ERR-SUSASOLDIER** | Susa Soldier (+ all Spirit Monsters) | 40473581 | Phase-mandatory return-to-hand trigger RE-ACTIVATES if its activation is negated until it resolves. Applies to all Spirits. | FE | — cross-link. | · | · | RULES-LEVEL-RULING | 2 | Rule #4 archetype rep → cross-link **R04-B1 / R04-B3**. |
| **ERR-SWAPFROG** | Swap Frog | 9126351 | Ignition usable once per COPY; only 1 extra Normal Summon gained even if resolved multiple times. | FE | With 2 Swap Frog, assert each ignition usable; assert only 1 extra Normal Summon net. | · | · | NEEDS-AUTHORING | 2 | Curation: Frog the Jam [68999286] not excluded from extra summon (Edison keeps it); allow face-down field monsters. AUTHOR. |
| **ERR-TREEBORN** | Treeborn Frog | 12538374 | Revival [Trigger] has NO once-per-turn; cannot activate if a monster is in your S/T Zone treated as a Spell. | FE | Assert Treeborn's Standby revival can re-activate after negation in the same Standby Phase (no OPT). | · | · | NEEDS-AUTHORING | 2 | Curation: remove `SetCountLimit(1)`. AUTHOR. Semi-Limited (2) in our catalog. |
| **ERR-ULTIMATEOFFERING** | Ultimate Offering | 80604091 (image 80604092) → repo alias 511003023 | Summon/Set on resolution → Solemn Judgment can't negate it; Torrential can respond if it was CL1. | FE | Load 511003023; assert summon-on-resolution semantics (Solemn can't negate; Torrential can respond). | · | · | NEEDS-AUTHORING | 2 | Pre-errata script in repo, UNWIRED → WIRE. **Passcode ambiguity — see §5 ENG-ULTIMATE-OFFERING.** Semi-Limited (2) in our catalog. |
| **ERR-URGENTTUNING** | Urgent Tuning | 94634433 | Synchro Summon on resolution → Solemn Judgment CANNOT negate that Synchro Summon. | FE | Activate Urgent Tuning; assert Solemn Judgment cannot negate the resulting Synchro Summon. | · | · | NEEDS-AUTHORING | 2 | Curation: MODERN-OK — diff-verify. |

---

# §4 — Staples spot-check (Tier 3 — 17 fixture rows)

> Purpose: opportunistic smoke-test — NOT a per-card audit. Each of the 17 canonical decklists
> (edison-rules-reference.md §4) becomes a **fixture** that must (a) be **Edison-pool-legal** and (b)
> **load & step** in the engine. Source lists: SJC Edison 2010 (edisonformat.com/historic-decklists) +
> post-2020 events (edisonformat.com/decks), via DuelingBook deck IDs.
>
> **⚠️ Engineering MUST confirm every fixture against our locked March-2010 banlist FIRST** (a card legal
> in the SJC-era pool may be restricted on our list). The reference lists are real tournament decks and
> can contain now-restricted counts.
>
> **Shared acceptance-test pattern (all rows):** (1) `validateDeck({main, extra, side}, catalog)` returns
> `legal: true` with zero violations (adapt from `packages/server/src/domain/validateDeck.test.ts` /
> `edisonDeckLegality.test.ts`); (2) `createEdisonDuel({ deck0, deck1 })` + `step()` reaches a
> `waiting/continue/ended` status without throwing (pattern: `edisonDecks.test.ts`). The two existing
> in-repo fixtures `BLACKWING_DECK` / `JUNK_FROG_DECK` (`packages/engine/src/testSupport/edisonDecks.ts`)
> already pass both and are the reference implementation.

| ID | Fixture (archetype) | DB deck id | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **STP-01** | Quickdraw Dandywarrior (1st SJC, Jeff Jones) | 6539169 | edisonformat.com/historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | 41 main / 15 extra / 15 side. Contains Ryko, Sangan, Brionac, LADD, Brain Control (errata cards). |
| **STP-02** | Plant Toolbox (Quickdraw Plant) | 6571840 | edisonformat.com/decks | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Mark of the Rose ×3, Dark End Dragon, Goyo, Brionac. |
| **STP-03** | Doomcaliber Gadgets (2nd SJC, Renaldo Lainez) | 6539011 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Royal Oppression, Doomcaliber (R08/R11 cards). |
| **STP-04** | Machina (Gadget) (16th SJC) | 6539132 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | 44 main. **Ultimate Offering ×2 [80604091]** (Semi in our catalog → 2 legal); Machina Gearframe/Peacekeeper (R03); Armory Arm. |
| **STP-05** | Synchro Cat / Rescue Cat (3rd SJC) | 6538938 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Rescue Cat, Sangan, My Body as a Shield. |
| **STP-06** | Gladiator Beasts (Prisma/Test Tiger, 5th SJC, Jake Mattern) | 7798916 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Elemental HERO Prisma ×2; Cold Wave; Starlight Road ×2. |
| **STP-07** | Lightsworn Monarchs (6th SJC, Jarel Winston) | 6539120 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Lightsworns (R04); Treeborn Frog; Sangan. |
| **STP-08** | Twilight (Lightsworn + Chaos) (13th SJC) | 6539238 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Lightsworns (R04); Chaos Sorcerer (R06-B1). |
| **STP-09** | Blackwings (14th SJC) | 6538847 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Royal Oppression; My Body as a Shield; overlaps repo BLACKWING_DECK fixture. |
| **STP-10** | Vayu Turbo (Blackwing) (post-2020, DD5 2nd) | 13793230 | edisonformat.com/decks | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | **Post-2020 list — verify banlist counts.** Dark Grepher + Malicious-style GY plays (R06-B3). |
| **STP-11** | Six Samurai (notable SJC) | 6550608 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Spirit of the Six Samurai (R03-B2 union). |
| **STP-12** | X-Sabers (post-2020) | 9222333 | edisonformat.com/decks | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | **Post-2020 — verify counts.** Rescue Cat, Sangan, Cold Wave, One for One. |
| **STP-13** | Diva Hero (post-2020, DD4 5th, Moom) | 13365596 | edisonformat.com/decks | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | **Post-2020 — verify counts.** Future Fusion (wired), Absolute Zero (R09-B2d), Malicious (R06-B3). |
| **STP-14** | Zombies (Zombiesworn-adjacent) (post-2020, DD4 2nd) | 13365417 | edisonformat.com/decks | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | **Post-2020 — verify counts.** Mezuki, Book of Life, Dark End Dragon. |
| **STP-15** | Frognarch / Frog Monarch (post-2020, DD03 3rd, Corinna) | 12421850 | edisonformat.com/decks | validateDeck legal + engine load/step. **Verify Substitoad ×3 pool-legality; swap if illegal.** | · | · | NEEDS-TEST | 3 | **⚠️ Runs 3× Substitoad [20663556].** Our catalog currently has Substitoad **UNLIMITED** → 3× would PASS validateDeck today. But community lists call it "now-Forbidden" → **banlist-authority question for CEO** (see clarification #3). Swap 1 if we decide to forbid/limit. |
| **STP-16** | Flamvell (rogue, 7th SJC) | 6539021 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Rekindling ×3 (Necrovalley interaction, R09/ERR-NECROVALLEY). |
| **STP-17** | Black Garden (GK/Volcanic control-burn, notable SJC) | 6571645 | historic-decklists | validateDeck legal + engine load/step. | · | · | NEEDS-TEST | 3 | Black Garden engine (ERR-BLACKGARDEN / R06-B4a); Divine Wrath (R11-B3). |

> **Infernity** is intentionally NOT a fixture (banlist-constrained in Edison; no canonical SJC list) —
> represented by a note only. If a fixture is later needed, build a core (Infernity Archfiend/Necromancer/
> Gun/Launcher + generic Synchro toolbox) and validate against the banlist.

---

# §5 — Engineering data items (tracked; cross-linked, not double-counted)

> Not rules or scripts per se, but must be resolved for accuracy. Cross-linked to the errata rows they
> affect; excluded from the §1–§3 rollup to avoid double-counting.

| ID | Item | Expected resolution | Source | Acceptance test | Actual | Evidence | Status | Tier | Notes |
|----|----|----|----|----|----|----|----|----|----|
| **ENG-ULTIMATE-OFFERING** | Ultimate Offering passcode ambiguity | Loader + allow-list must AGREE on which passcode maps to the pre-errata behavior: modern **80604091** vs errata-page image **80604092** vs repo pre-errata alias **511003023**. | FE #35 + memory (PASSCODE_CORRECTIONS) | Assert the catalog `aliasIndex` resolves 511003023 → 80604091 (same base), `legalPasscodes` accepts the display passcode, `validateDeck` treats them as one card, and the script loader loads the pre-errata script (NOT 80604092). Add a unit test in card-data/server. | · | · | NEEDS-TEST | 2 | Cross-link **ERR-ULTIMATEOFFERING**. Our catalog has 80604091 = Semi-Limited. 80604092 is a stray image filename — must NOT be used as a script/passcode. |
| **ENG-REDMD** | REDMD pre-errata script is WRONG | Edit repo `pre-errata/c88264978.lua`: both `SetCountLimit(1,id,EFFECT_COUNT_CODE_OATH)` (summon) and `SetCountLimit(1,{id,1})` (ignition) → per-copy `SetCountLimit(1)` (or remove name arg) so Edison per-copy behavior holds. | FE #26 + memory | After the edit, in a duel with 2 REDMD, assert each can use its ignition once/turn PER COPY (no once-per-name) and the summon effect has no OPT. | · | · | NEEDS-AUTHORING | 2 | Cross-link **ERR-REDMD**. EDIT-not-wire — the only repo REDMD script is the wrong one; the folder name "pre-errata" is not a guarantee of Edison accuracy. |

---

# ⚠️ Needs clarification (route to Product Lead → CEO/research)

Behaviors/items that could NOT be turned into a clean, self-contained pass/fail engine acceptance test,
or that hinge on a product-direction decision. **Not forced into the matrix as testable** — surfaced here.

1. **R06-B5 — "priority is a right whether or not declared" (documentation-only).** The reference itself
   maps this to `n/a (documentation)`. There is no discrete engine assertion; it is a framing rule for the
   user rules-guide. *Recommendation:* verify via rules-guide review, not an automated test; keep the matrix
   row as NEEDS-TEST but do not expect an engine test. **Route:** confirm this is acceptable (no engine gap).

2. **R12-B1 / R12-B2 — infinite loops (CARVE-OUT: enforcement scope is a product question).** The engine
   almost certainly does NOT enforce "voluntary loops are illegal to initiate" the Edison way, and the
   community treats infinite loops as a **human judge-call**. The acceptance tests can only be *exploratory
   spikes* (document actual engine behavior) until the CEO/CTO decide whether engine enforcement is even
   in-scope. *Open question:* Do we (a) accept + document as human-adjudicated, or (b) attempt engine
   enforcement? **Route:** CEO decision after CTO validation spike.

3. **Frognarch fixture (STP-15) — Substitoad banlist authority.** Our locked catalog currently has
   **Substitoad [20663556] = UNLIMITED**, so 3× is pool-legal and the fixture passes `validateDeck` *today*.
   But community/post-2020 lists describe Substitoad as **"now-Forbidden."** Whether our March-2010 list
   should forbid/limit it is a **banlist-authority / product-direction question**, not an engine bug.
   **Route:** CEO confirms the authoritative banlist entry for Substitoad; if it should be forbidden/limited,
   update the catalog banlist and swap the fixture; otherwise keep 3× and annotate as period-accurate.

4. **R10 LP-cost status (VERIFIED-PASS vs KNOWN-GAP) needs a CI confirmation.** The reference calls R10 a
   gap (`it.todo`), but the current test file contains **real** Brain Control tests (LP=800 illegal / LP=801
   legal) and decision `2026-07-14-lp-cost-to-zero-patch.md` mandates a patch. Marked **KNOWN-GAP** here per
   the task, but *if the patched WASM is live in CI and those tests pass, these 4 rows flip to VERIFIED-PASS*
   (which would change the rollup to 9 VERIFIED-PASS / 76 NEEDS-TEST / 0 KNOWN-GAP). **Route:** engineering
   confirms whether `patches/ocgcore-lp-cost-strict.patch` is applied in the deployed custom WASM.

5. **Card/fixture dependencies for several R05 / R08 / R09 tests.** A number of acceptance tests name
   specific cards (trap monsters — Embodiment of Apophis, Metal Reflect Slime, Zoma; Necroface + Future
   Visions; Fake Trap; Degenerate Circuit; Herald of Orange Light) whose **pool membership and correct
   scripting** must be confirmed before the test can run. This is a normal execution dependency, not a
   blocker — but engineering should confirm availability and substitute an equivalent in-pool card where a
   named card is out-of-pool. **Route:** engineering confirms during test authoring.

---

## Assumptions made (flag if wrong)

- **Rollup scope** = §1 (78) + §2 (13) + §3 (36) = 127 acceptance-gate rows; §4 (17 fixtures) and §5 (2 eng
  items) are tracked separately to avoid double-counting (§5 items cross-link to errata rows).
- **VERIFIED-PASS** is reserved for the 5 already-passing engine accuracy tests (per the task). Base-rule
  deck-construction rows (BR-01/02/03) are already covered by `validateDeck.test.ts` but kept NEEDS-TEST
  here so the "5 passing" headline stays clean; engineering can cite that evidence and flip them.
- **R10 marked KNOWN-GAP** per the task, despite real LP-cost tests now existing (see clarification #4).
- **Base-rules granularity** (13 rows) is a reasonable teaching-layer selection from reference §2; it is not
  claimed to be exhaustive (reference explicitly keeps §2 "lighter than §1").
- **Errata Status** follows the reference §3 3-way tag; the curation report's finer verdicts (MODERN-OK /
  DROP-IN / EDIT / real-authoring) are carried in Notes so engineering knows the *kind* of work per card.
- **Card passcodes** in acceptance tests are from the reference/memory where given; a few illustrative cards
  (e.g. Herald of Orange Light, Fake Trap, Degenerate Circuit) use widely-known passcodes and should be
  confirmed against our catalog before use.
