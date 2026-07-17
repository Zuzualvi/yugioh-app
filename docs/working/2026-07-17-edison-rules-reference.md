---
title: Edison Format — Authoritative Rules Reference
subtitle: The "expected behavior" backbone for the parity-audit matrix + the source-of-truth for user-facing rules docs
audience: engineers writing engine parity tests; doc-writers building the in-app rules guide; product owner
author: product-research subagent
date: 2026-07-17
status: authoritative reference (v1) — every item source-cited + confidence-tagged
binding_authority: edisonformat.com (LOCKED group decision; on conflict, this site wins — conflicts flagged, never silently resolved)
sources_of_record:
  - https://www.edisonformat.com/edison-rule-differences.html   (the 13 rule differences — full text fetched 2026-07-17)
  - https://www.edisonformat.com/rules.html + /rulebook.html    (Master Rule 1 base rulebook)
  - https://www.edisonformat.com/functional-errata.html          (the 36 functional-errata entries — full text fetched 2026-07-17)
  - https://www.edisonformat.com/historic-decklists.html + /decks (SJC Edison 2010 + community decklists, via DuelingBook)
builds_on (do not duplicate):
  - /workspace/product/research/edison-parity-scope.md
  - /mnt/memory/yugioh-app-team-memory/research/edison-functional-errata.md
  - /mnt/memory/yugioh-app-team-memory/research/edison-engine-rules-flags.md
  - /mnt/memory/yugioh-app-team-memory/domain/edison-format.md
confidence_tags:
  verified   = directly stated by edisonformat.com (or another cited primary source), or empirically confirmed by our engine tests
  likely     = strong inference from a cited source, not verbatim
  uncertain  = reasoned estimate / needs a spike to firm up
---

# Edison Format — Authoritative Rules Reference

## 0. How to use this document

**Two jobs.** (1) §1 + §3 are the **"expected behavior" column** of the parity-audit matrix — every item is
written precisely enough that an engineer can turn it into a pass/fail test. (2) §1 + §2 + §3 are the
**source-of-truth backbone** for the user-facing in-app rules guide — enough to let the group play Edison
confidently at a live table with no engine assist.

**Stable ID scheme (for the test matrix).** Rules behaviors use `R<rule#>-<class><n>`:
- `R08-S3` = Rule #8 (Damage Step), **S**ubstep 3.
- `R08-A4` = Rule #8, **A**ctivation-legality rule 4.
- `R05-B7d` = Rule #5, **B**ehavior 7, nested case d.
Card errata use `FE-<CardShortName>`. IDs are stable — do not renumber; append if you split a behavior.

**Confidence tags** appear on every behavior: `[verified]`, `[likely]`, `[uncertain]`.

**Authority hierarchy (LOCKED).** edisonformat.com is binding. Where any other source disagrees, edisonformat.com
wins **but the conflict is flagged in §5, never silently resolved.**

**Engine-flag legend** (edo9300/ygopro-core `ocgapi_constants.h`; empirically validated — see
`edison-engine-rules-flags.md`). Our build's Edison bitmask:
`EDISON_FLAGS = MODE_GOAT | 0x400000000 = 0x7f80d072c`.

| Flag | Hex | Governs |
|------|-----|---------|
| `DUEL_OCG_OBSOLETE_IGNITION` | `0x100` | Ignition priority for **Monster-Zone** ignition effects |
| `DUEL_TCG_FAST_EFFECT_IGNITION` | `0x400000000` | Ignition priority extended to **any location incl. GY** |
| `DUEL_1ST_TURN_DRAW` | `0x200` | First player draws turn 1 |
| `DUEL_1_FACEUP_FIELD` | `0x400` | Single active Field Spell; new one destroys old |
| `DUEL_6_STEP_BATLLE_STEP` | `0x08` | Old multi-step Damage Step structure (edisonformat calls it "7-timing") |
| `DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP` | `0x40000000` | One manual chain per damage substep |
| `DUEL_TCG_SEGOC_NONPUBLIC` | `0x100000000` | SEGOC incl. non-public knowledge |
| `DUEL_TCG_SEGOC_FIRSTTRIGGER` | `0x200000000` | Earliest-triggered effect goes on chain first (pre-2017) |
| `DUEL_0_ATK_DESTROYED` | `0x10000000` | 0-ATK battle rule |

**Empirical test status** (Vitest `edisonRules.accuracy.test.ts`, commit 7bc4253 — see engine-rules-flags memory):
R1 GY-ignition **PASS** · R2 MZone-ignition **PASS** · R3 first-turn-draw **PASS** · R4 one-field-spell **PASS** ·
R5 0-ATK-battle **PASS** · R6 LP-cost **it.todo (documented gap)**.

**Total discrete testable behaviors in §1: 78** (breakdown at end of §1).

---

## 1. Rules Behavior Inventory — the 13 published differences, unpacked

> Source for the entire section unless noted: **https://www.edisonformat.com/edison-rule-differences.html**
> (Rules #1–#13). Verbatim text was fetched 2026-07-17.

### R01 — The Starting Player Draws a Card
> Edison text: *"a card is drawn during the first draw phase of the duel. Thus, the player who goes first
> starts the duel with 6 cards."* (Rule #1)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R01-B1** | The player who goes **first** DRAWS during their turn-1 Draw Phase. After the draw their hand = **6** (5 opening + 1). (In modern MR3+ the first player skips this draw — the Edison difference.) | verified | `DUEL_1ST_TURN_DRAW 0x200` — **tested PASS (R3)**: player 0 total DRAW count = 6 before first IDLECMD |
| **R01-B2** | The player going first **cannot conduct a Battle Phase on turn 1** (no first-turn attacks). | verified (5D's rulebook + edisonformat.com Rule #1 context; see domain memory) | Base MR1 turn structure — **verify engine enforces** `[likely]` |

### R02 — Only 1 Active Field Spell
> Edison text: *"only one Field Spell can be active at a time. Setting a Field Spell does not destroy an
> opponent's active Field Spell."* (Rule #2)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R02-B1** | At most **one** Field Spell may be face-up/active on the entire field at any time (shared across both players). | verified | `DUEL_1_FACEUP_FIELD 0x400` |
| **R02-B2** | **Activating** a new Field Spell while another is active **destroys** the existing one (it is sent to the GY as destroyed, not merely swapped out). | verified | `DUEL_1_FACEUP_FIELD` — **tested PASS (R4)**: Umi MOVE→GRAVE when Mountain activated |
| **R02-B3** | **Setting** a Field Spell face-down does **NOT** destroy the opponent's active Field Spell. | verified | `DUEL_1_FACEUP_FIELD` `[likely]` |
| **R02-B4** | Player A activates Mountain (starts a chain) while B's Umi is active → on Mountain's **resolution**, Umi is destroyed. | verified | rules/engine |
| **R02-B5** | Same setup, but B chains Dust Tornado targeting Mountain → when the chain resolves, Dust Tornado destroys Mountain and **Umi is NOT destroyed** (the new field never resolved, so it never replaced the old). | verified | rules/engine |
| **R02-B6** | You may **Set** Umi even while opponent controls Secret Village of the Spellcasters + a Spellcaster (Secret Village is not destroyed), but you **cannot Activate** Umi unless you control a Spellcaster. (Distinguishes "set is always legal" from "activation must be legal.") | verified | rules/engine |
| **R02-B7a** | Player A **Sets** Mausoleum of the Emperor over their own (face-up or face-down) Geartown → Geartown is destroyed by game mechanic **without starting a chain**, so Geartown **CAN** activate its GY trigger-like effect. | verified | rules/engine (chain-timing) |
| **R02-B7b** | Player A **Activates** Mausoleum over their Geartown → Geartown destroyed by game mechanic **while starting a chain**, so Geartown **CANNOT** activate its GY trigger-like effect. | verified | rules/engine (chain-timing) |

### R03 — Union Monster Conditions
> Edison text: pre-2016 Union monsters carry a Condition. (Rule #3; the Conditions were removed in 2016 with
> Structure Deck: Seto Kaiba.)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R03-B1** | **"A monster can only be equipped with 1 Union Monster at a time."** — this Condition applies to **ALL** Union monsters in Edison. Attempting to equip a 2nd Union to an already-Union-equipped monster is illegal. | verified | rules/script (functional-errata rep: Machina Gearframe) |
| **R03-B2** | The replacement effect **"If the equipped monster would be destroyed, destroy this card instead"** appears **ONLY** on these Unions: **Armored Cybern, Oilman, Heavy Mech Support Platform, Spirit of the Six Samurai, Machina Gearframe, Machina Peacekeeper.** | verified | per-card script |
| **R03-B3** | Union monsters **not** on the R03-B2 list do **NOT** protect the equipped monster — the equipped monster is destroyed normally (the "destroy this instead" clause is absent in Edison). | likely (inverse of B2 as stated) | per-card script |

### R04 — Phase-Dependent Mandatory Trigger Effects
> Edison text: *"any mandatory Trigger Effect that activates during a certain Phase will keep activating if its
> activation is negated, until it finally resolves."* (Rule #4; changed when Tsukuyomi/Judgment Dragon got
> errata in Duelist Saga.)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R04-B1** | If the **ACTIVATION** of a phase-dependent mandatory trigger(-like) effect is **negated** (e.g. by **Light and Darkness Dragon**), that effect **activates again** — repeatedly, until it finally resolves. | verified | rules/script |
| **R04-B2** | If the **EFFECT** of a phase-dependent mandatory trigger(-like) effect is **negated** (e.g. by **Skill Drain**), that effect does **NOT** activate again. | verified | rules/script |
| **R04-B3** | Scope: this covers phase-dependent **mandatory** triggers — **Spirit monsters** (return-to-hand during End Phase), **Lightsworns** and **Judgment Dragon** (mill during End Phase). (Doc carve-out: enumerate qualifying cards.) | verified | rules/script |

### R05 — Trap Monster Zone Blocking (~16 discrete interactions)
> Edison text: a Trap Monster occupies 1 Monster Card Zone **and** 1 Spell/Trap Card Zone; physical location is
> the Monster Zone. (Rule #5)

| ID | Expected Edison behavior (testable) | Confidence |
|----|-------------------------------------|-----------|
| **R05-B1** | A face-up Trap Monster occupies **1 Monster Zone + 1 S/T Zone** simultaneously. Its location is the Monster Zone; it isn't *counted* as a card in the S/T Zone, but that S/T Zone becomes unusable. | verified |
| **R05-B2** | You **cannot activate** (flip face-up) a Set Trap Monster if you have **no empty Monster Zone**. | verified |
| **R05-B3** | To **gain control** of a Trap Monster (Snatch Steal / Creature Swap), the new controller must have **both an open Monster Zone AND an open S/T Zone**. | verified |
| **R05-B4** | A Trap Monster whose effect is **negated by Jinzo** reverts to a **Trap Card in the S/T Zone immediately**. | verified |
| **R05-B4a** | A Trap Monster that **attacks a Set Jinzo** reverts to a Trap Card when Jinzo is flipped; **damage calculation is not applied**. | verified |
| **R05-B4b** | Your Trap Monster stolen by **Snatch Steal** returns to **your** S/T Zone when **Jinzo is Summoned** (negation → reverts to trap card of its owner). | verified |
| **R05-B5** | If a Trap Monster **would be Set face-down** (e.g. by **Book of Moon**), it is instead **Set to its corresponding S/T Zone** (as a trap card). | verified |
| **R05-B5a** | If your opponent controls **your** Embodiment of Apophis (via Snatch Steal/Creature Swap) and it is flipped face-down, it goes to the **opponent's** S/T Zone (current controller). | verified |
| **R05-B6a** | vs **Heavy Storm** (destroys S/T): **Fake Trap** can prevent its destruction; **My Body as a Shield cannot**. | verified |
| **R05-B6b** | vs **Lightning Vortex** (destroys monsters): **My Body as a Shield** can prevent; **Fake Trap cannot**. | verified |
| **R05-B6c** | vs **Raigeki Break** (destroys "a card"): **both** My Body as a Shield **and** Fake Trap can prevent its destruction. | verified |
| **R05-B7** | If a Trap Monster is **removed from the field, it is removed as a Trap Card** (not a monster). | verified |
| **R05-B7a** | A Trap Monster sent to GY: **cannot** be revived by Time Machine, retrieved by Return of the Doomed, will **not** trigger Blackwing - Shura the Blue Flame, and you **cannot** activate Michizure. | verified |
| **R05-B7b** | If **Caius the Shadow Monarch** banishes **Zoma the Spirit** (a Trap Monster), **no damage** is inflicted (banished as a trap card, not a DARK monster). | verified |
| **R05-B7c** | A Trap Monster returned to hand by **Penguin Soldier** returns **as a Trap Card**; you cannot activate **Major Riot**. | verified |
| **R05-B7d** | A Trap Monster **temporarily removed** (Dimensionhole / Interdimensional Matter Transporter) returns to the field **as a Trap Card and is destroyed IMMEDIATELY** by game mechanic. With **Dimensionhole**, you cannot use the Monster Zone while it is removed, but you **can** use the S/T Zone it was occupying. | verified |

### R06 — Ignition Effect Priority
> Edison text: the Turn Player may activate an Ignition Effect as **Chain Link 1 in the Summon response
> timing, so long as that Summon did not start a Chain.** (Rule #6). Priority exists whether or not declared.

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R06-B1** | After a Summon that **did NOT start a chain**, the Turn Player may activate an **Ignition Effect as CL1** in the Summon-response window, **before** the opponent may respond. | verified | `OCG_OBSOLETE_IGNITION 0x100` + `TCG_FAST_EFFECT_IGNITION 0x400000000` |
| **R06-B2** | Priority applies to **Monster-Zone** ignition effects — e.g. after Special Summoning **Chaos Sorcerer**, TP banishes with its effect before opponent's Bottomless; after Ritual Summoning **Demise**, TP retains priority for Demise's ignition before opponent's Torrential. | verified | `OCG_OBSOLETE_IGNITION` — **tested PASS (R2)**: Lonefire 48686504 offered CL1 after SUMMONED |
| **R06-B3** | Priority extends to **GY ignition effects** — e.g. discard **Destiny Hero - Malicious** to SS Dark Grepher, then activate Malicious's banish-self ignition **before** opponent's D.D. Crow. | verified | needs `TCG_FAST_EFFECT_IGNITION 0x400000000` (NOT in stock ocgcore-wasm 0.1.2; present in our custom WASM) — **tested PASS (R1)**: Malicious 9411399 CL1 |
| **R06-B4a** | The TP does **NOT** get ignition priority when the Summon **starts a chain**: if the **opponent's** trigger (e.g. Black Garden) starts the chain in response to the Special Summon, priority passes to the TP only to **build onto the chain with fast effects** — the TP cannot insert an Ignition as a fresh CL1. | verified | rules/engine |
| **R06-B4b** | If the **summon material's own trigger** starts a chain (e.g. **Sangan** used as Synchro Material triggers on being sent to GY), the TP **cannot** activate the newly-Summoned monster's Ignition (e.g. **Brionac**) in that window. | verified | rules/engine |
| **R06-B4c** | On a **Normal Summon** whose monster has a Trigger Effect (e.g. **Armageddon Knight**), the TP may activate **that Trigger Effect** OR pass priority — but has **no** priority to activate any **other** card/effect as CL1 (incl. ignition effects). Opponent may respond with Torrential Tribute. | verified | rules/engine |
| **R06-B5** | "Priority" is a **right that exists whether or not the TP declares intent**; Konami's fast-effect-timing / open-and-closed-gamestate flowchart applies, **plus** ignition priority. | verified (doc rule) | n/a (documentation) |

### R07 — Simultaneous Effects Go On Chain (SEGOC)
> Edison text: SEGOC applies with one exception — **if two+ effects in the same "step" triggered at different
> times, the earlier trigger(s) go on the chain before the later ones** (this was changed in 2017). (Rule #7)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R07-B1** | When multiple trigger(-like) effects trigger simultaneously, build the chain in **4 steps**: **(1)** Turn Player's **Mandatory** → **(2)** Non-Turn Player's **Mandatory** → **(3)** Turn Player's **Optional** → **(4)** Non-Turn Player's **Optional**, each in trigger order. | verified | `TCG_SEGOC_NONPUBLIC 0x100000000` + `TCG_SEGOC_FIRSTTRIGGER 0x200000000` |
| **R07-B2** | **Edison-specific bit:** within a step, if effects triggered at **different times**, the **earlier** trigger goes on the chain **first** (pre-2017 rule; modern reverses this ordering nuance). | verified | `TCG_SEGOC_FIRSTTRIGGER 0x200000000` |
| **R07-B3** | Example (testable): Tribute **Sangan** to Tribute Summon **Caius** — both are Turn-Player mandatory (Step 1). Sangan triggers on being sent from field to GY → **CL1**; Caius triggers only on successful Summon (later) → **CL2**. | verified | engine |
| **R07-B4** | Example (testable): **Soul Exchange** targets opponent's **Sangan**; TP tributes it to Tribute Summon **Caius**. TP-mandatory Caius (Step 1) = **CL1**; **Non-Turn-Player**-mandatory Sangan (Step 2) = **CL2** (ownership, not who tributed, decides the step). | verified | engine |

### R08 — The 7-timing Damage Step (16 discrete behaviors: 9 activation-legality + 7 substeps)
> Edison text: seven distinct timings in the Damage Step; only specific cards/effects may be activated. (Rule #8)
> **Naming caveat (flag):** our engine flag is `DUEL_6_STEP_BATLLE_STEP`; edisonformat.com describes a
> **"7-timing" Damage Step**. Same behavior, different count — standardize doc language. Engine mapping for the
> whole rule: `DUEL_6_STEP_BATLLE_STEP 0x08` + `DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP 0x40000000`
> (empirically: Damage Step is a distinct phase; Book of Moon **not** offered in DS; Honest **is** offered).

**Activation-legality rules (apply across the whole Damage Step):**

| ID | Expected Edison behavior (testable) | Confidence |
|----|-------------------------------------|-----------|
| **R08-A1** | **Counter Trap Cards** may be activated at **any** point in the Damage Step. | verified |
| **R08-A2** | **Monster Effects that negate ACTIVATIONS** (e.g. Herald of Orange Light) may be activated at **any** point in the DS. | verified |
| **R08-A3** | Monster effects that only negate **EFFECTS** (not activations) **CANNOT** be activated in the DS. | verified |
| **R08-A4** | **Spell Speed 2 Spells/Traps that negate ACTIVATIONS** (e.g. My Body as a Shield) **CANNOT** activate in the DS. | verified |
| **R08-A5** | **Spell Speed 2 Spells/Traps that negate EFFECTS** (e.g. Royal Oppression) **CANNOT** activate in the DS. | verified |
| **R08-A6** | **Mandatory** Effects (e.g. Doomcaliber Knight) may be activated at **any** point in the DS. | verified |
| **R08-A7** | An effect **can** activate if its card **moves location** (flipped face-up, changes battle position, sent to GY) **or performs an action** (inflicts battle damage, destroys a monster by battle) — e.g. Flip Effects; a Green Gadget Special Summoned by Giant Rat; Geartown destroyed by battle/effect. | verified |
| **R08-A8** | **Fast/Continuous effects that directly modify ATK/DEF** can activate/apply in the DS. | verified |
| **R08-A9** | **Spell/Trap cards that change ATK/DEF** (e.g. Forbidden Chalice) **CANNOT** activate in or after **Substep 4 (Damage Calculation)**. | verified |

**The 7 substeps:**

| ID | Substep | What may activate / happens (testable) | Confidence |
|----|---------|----------------------------------------|-----------|
| **R08-S1** | 1 — Start of the Damage Step | "During the Damage Step" effects now apply; "at the start of the Damage Step" triggers activate; Quick Effects & S/T that modify ATK/DEF can activate. | verified |
| **R08-S2** | 2 — Flip Sets Face-up | A face-down attack target is flipped face-up (**Flip Effects NOT yet activated**); effects affecting a *set* attack target begin applying; Quick Effects & S/T affecting ATK/DEF may activate. | verified |
| **R08-S3** | 3 — Before Damage Calculation | "Before damage calculation" effects activate/apply; Quick Effects & S/T affecting ATK/DEF may activate. | verified |
| **R08-S4** | 4 — During Damage Calculation | "Damage calculation" effects activate/apply; **Quick Effects of monsters** that modify ATK/DEF **can** activate, **Spells/Traps that modify ATK/DEF CANNOT**; a **single** manual chain may be built; after the chain, battle damage is inflicted and monsters are **marked "destroyed by battle."** | verified |
| **R08-S5** | 5 — After Damage Calculation | Monsters marked destroyed-by-battle **stop applying continuous effects**; continuous(-like)/self-destruct effects apply (Berserk Gorilla, Gozen Match, Rivalry of Warlords); **a single manual chain** is built (+additional chains if effects trigger while resolving — e.g. **Gorz**); "when battle damage is inflicted" triggers activate; Quick monster ATK/DEF effects can activate. | verified |
| **R08-S6** | 6 — Resolve Effects | Destroyed-by-battle monsters don't apply continuous effects; **a single manual chain** (+additional if triggered while resolving — e.g. **Ryko** mills Peten as CL1); "after damage calculation" effects activate; **Flip Effects activate** and form a chain with other effects activating now; Quick monster ATK/DEF effects. | verified |
| **R08-S7** | 7 — End of the Damage Step | Monsters marked destroyed-by-battle are **now sent to GY**; **a single manual chain** (+additional if triggered while resolving — e.g. **Mystic Tomato** SS Armageddon Knight as CL1); "when a monster is destroyed by battle" effects activate now; Quick monster ATK/DEF effects. | verified |

### R09 — Trigger Location & Recognition (Mid-Chain Triggers)
> Edison text: triggers can be recognized as met **mid-chain**, and Trigger Effects activate from **outside
> their trigger location** unless the card specifies otherwise — **even from within the Deck**. (Rule #9)

| ID | Expected Edison behavior (testable) | Confidence |
|----|-------------------------------------|-----------|
| **R09-B1** | A trigger condition can be **recognized as met in the middle of a chain** (modern format generally does not allow this). | verified |
| **R09-B2** | Trigger Effects **activate from outside their trigger location** (unless the card requires it to remain there) — **including from within the Deck**. | verified |
| **R09-B2a** | Discard **Dandylion** as cost for **Monster Reincarnation** and add that Dandylion back to hand → the "Special Summon 2 Fluff Tokens" effect **still triggers and activates from the GY** (even though Dandylion is now in the hand). | verified |
| **R09-B2b** | **Necroface** Normal Summoned with **Future Visions** active; if CL1 is Necroface's effect, on resolution Necroface returns to Deck with all banished cards, then its **other** effect (banish top 5 of both Decks) **starts a new chain because it was banished by Future Visions** — trigger recognized/activating from the Deck. | verified |
| **R09-B2c** | Contrast: **Earthbound Immortal Aslla Piscu** returned to the **Deck** from the field (by Phoenix Wing Wind Blast) → its destroy-and-burn leave-field effect **does NOT activate**. | verified |
| **R09-B2d** | Contrast: face-up **Elemental HERO Absolute Zero** returned to the **Extra Deck** from the field (by Phoenix Wing Wind Blast) → its "destroy all monsters the opponent controls" effect **DOES activate** (triggers from the Extra Deck). | verified |

### R10 — Life Points Costs
> Edison text: you **cannot pay costs if doing so would reduce your LP to 0**; a card with an LP maintenance
> cost that can't be paid **self-destructs**. (Rule #10)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R10-B1** | You **cannot pay an LP cost** if it would reduce your LP to **0** (the action is illegal). | verified | **KNOWN ENGINE GAP** — Vitest R6 `it.todo` (see §5) |
| **R10-B2** | A card with an **LP maintenance cost** that would reduce LP to 0 **cannot pay it and self-destructs instead**. | verified | KNOWN GAP |
| **R10-B2a** | If LP ≤ **2000**, you cannot pay **Mirror Wall's** optional maintenance cost → **it self-destructs**. | verified | KNOWN GAP |
| **R10-B2b** | If LP ≤ **500**, you cannot pay **Degenerate Circuit's** mandatory maintenance cost → **it self-destructs**. | verified | KNOWN GAP |

### R11 — End-of-Turn Discard (hand-size)
> Edison text: players **can't respond** to the end-of-turn discard for hand size — it must be the last action
> of the turn. But a **mandatory Trigger Effect** triggered by the discard builds a chain with special
> properties. (Rule #11)

| ID | Expected Edison behavior (testable) | Confidence |
|----|-------------------------------------|-----------|
| **R11-B1** | Players **cannot respond** to the end-of-turn hand-size discard at all (it is the last action of the turn). | verified |
| **R11-B2a** | When a **mandatory Trigger Effect** is triggered by the discard, **Spell Speed 2** effects may be chained **ONLY IF** they negate activations or effects. | verified |
| **R11-B2b** | In that same chain, **Spell Speed 3** (Counter Trap) effects may be chained **regardless** of whether they negate. | verified |
| **R11-B3** | Example (mandatory): discard **White Stone of Legend** for hand size → its mandatory trigger must activate. You **cannot** chain **Super Rejuvenation** (SS2, non-negating) to it; opponent **CAN** chain Set **Divine Wrath** (SS3, negates activation); a face-up **Doomcaliber Knight** immediately tributes itself and adds a chain link (its Quick Effect is mandatory). | verified |
| **R11-B4** | Example (optional): discarding **Peten the Dark Clown** and **Red-Eyes Wyvern** for hand size → you **cannot** activate the optional Trigger Effects of either discarded card. | verified |

### R12 — Infinite Loops  ⚠️ LIKELY HUMAN JUDGE-CALL (documentation carve-out — verify with engine)
> Edison text: **"voluntary" loops are illegal to initiate**; only **"involuntary"** (game-mechanic) loops
> resolve via the "primary cause" being sent to the GY by game mechanics. (Rule #12)

| ID | Expected Edison behavior (testable) | Confidence |
|----|-------------------------------------|-----------|
| **R12-B1** | Any **voluntary action** (a Summon, an activation) that **would create an infinite loop is simply ILLEGAL** — the player may not perform it. Examples: cannot Summon X-Head Cannon into a Luminous Spark/Pole Position loop (Ex.1); cannot target Blue-Eyes with Ring of Destruction into an Opticlops/Axe/Pole Position loop (Ex.2); cannot chain/activate Pole Position when it would loop with Axe of Despair (Ex.3). | verified (as a *rule*) |
| **R12-B2** | An **involuntary loop** (created by a game mechanic the player couldn't avoid — e.g. Muka Muka's ATK rising on a forced draw) resolves via the **"primary cause"** procedure: the primary-cause card is **destroyed by game mechanics** (Ex.4: Pole Position destroyed). | verified (as a *rule*) |
| **R12-CARVE-OUT** | ⚠️ This is a **player-legality / judge-arbitration** rule. The ocgcore engine **likely does NOT** spontaneously enforce "voluntary-loop illegality" the Edison way — treat as a **human judge-call** in the user docs and **flag for an engine-validation spike.** | likely (needs spike) — see §5 |

### R13 — 0 ATK Monsters
> Edison text: two Attack-Position 0-ATK monsters that battle **destroy each other**; a 0-ATK Attack-Position
> monster **cannot destroy** a 0-DEF Defense-Position monster. (Rule #13; overturned in 2011, Rulebook v7.2.)

| ID | Expected Edison behavior (testable) | Confidence | Engine mapping |
|----|-------------------------------------|-----------|----------------|
| **R13-B1** | Two **Attack-Position monsters with 0 ATK** that battle each other **destroy one another** by battle. | verified | `DUEL_0_ATK_DESTROYED 0x10000000` — **tested PASS (R5)**: both cards `destroyed=true`, both to GRAVE (Ojama Green vs Ojama Green) |
| **R13-B2** | An **Attack-Position monster with 0 ATK cannot destroy** a **Defense-Position monster with 0 DEF** by battle. | verified | `DUEL_0_ATK_DESTROYED` `[likely]` (flag confirmed; this specific case source-verified, spot-tested via B1 mechanism) |

### §1 behavior count (for the parity matrix)
R01 = 2 · R02 = 8 · R03 = 3 · R04 = 3 · R05 = 16 · R06 = 7 · R07 = 4 · R08 = 16 (9 activation-legality + 7
substeps) · R09 = 6 · R10 = 4 · R11 = 5 · R12 = 2 (+1 carve-out flag) · R13 = 2. **Total = 78 discrete testable
behaviors.** (Prior estimate was ~25–40 "once nested cases are counted"; the Damage Step and Trap-Monster
rules nest more deeply than that estimate assumed, so the test-matrix granularity is ~78.)

---

## 2. Base-Rules Scaffolding — Master Rule 1 (teaching layer, not exhaustively tested)

> Edison runs the **TCG 2008 Rules Change = Master Rule 1** (edisonformat.com Rule Differences intro).
> These base mechanics are inherited by every card; they are the foundation the §1 deltas modify. Kept
> lighter than §1 — enough to teach, not to exhaustively test. Sources: edisonformat.com/rulebook.html
> (5D's / MR1 rulebook PDF); Yugipedia *Master Rules*; domain memory `edison-format.md` (all `[verified]`
> unless tagged).

### 2.1 Deck / hand / LP / field constants
- **Main Deck 40–60** cards; **Extra Deck 0–15**; **Side Deck 0–15** (fixed size across a match; 1-for-1 swaps).
- **Max 3 copies** of a card by name (Forbidden 0 / Limited 1 / Semi-Limited 2, per the **March 2010** list).
- **Starting Life Points = 8000.** Opening hand = **5 cards** for both players.
- **Field zones (pre-Link):** 5 Monster Zones + 5 Spell/Trap Zones + 1 Field Spell Zone per player. **No**
  Extra Monster Zones, **no** Pendulum Zones. Only **one** Field Spell active at a time (see R02).
- **Extra Deck contents (this era):** **Fusion + Synchro monsters only** (no Xyz/Pendulum/Link).

### 2.2 Turn & phase structure
Order each turn: **Draw Phase → Standby Phase → Main Phase 1 → Battle Phase → Main Phase 2 → End Phase.**
- **Battle Phase sub-steps:** Start Step → Battle Step (declare attacks; the **replay** rule applies when the
  set of the opponent's monsters changes) → **Damage Step** (the heavily-nested R08) → End Step.
- **Turn 1:** the first player **draws** (R01-B1) but **cannot conduct a Battle Phase** (R01-B2).
- **End Phase:** hand-size limit is **6**; excess cards are discarded (see R11 for the special no-response rule).
- Each player may **Normal Summon/Set once per turn** (baseline; cards like Ultimate Offering / Swap Frog grant extra).

### 2.3 Who goes first / match structure
- Winner of die-roll/coin-toss/RPS chooses **play or draw**; in later games of a match the **loser of the
  previous duel** chooses. Matches are best-of-3.

### 2.4 Priority basics (pairs with R06)
- The **turn player** has priority to act first in each phase; after any action resolves, the turn player may
  act again or pass; passing lets the opponent respond.
- **Spell Speeds:** SS1 = Normal/Continuous Spells, Ignition & most Normal/Ignition monster effects (slow);
  SS2 = Quick-Play Spells, most Traps, Quick Effects (can respond); SS3 = Counter Traps (can respond to SS2).
  A chain link can only be answered by an **equal or higher** spell speed.
- Edison adds **Ignition Effect Priority** (R06) on top of the standard fast-effect-timing flowchart.

### 2.5 How chains build & resolve
- A **chain** forms when an effect is activated and others respond. Chain Links resolve **Last-In-First-Out**
  (the last link resolves first).
- When multiple effects trigger **simultaneously**, order them by **SEGOC** (R07).
- Costs are paid on **activation**; targets (if any) are chosen on activation; effects apply on **resolution**.

### 2.6 Summoning types (era-correct)
- **Normal Summon / Set** (1/turn): Levels 1–4 with no tribute; **L5–6** need **1 tribute**; **L7+** need **2**.
- **Flip Summon:** flip a face-down Defense monster to face-up Attack (activates Flip Effects).
- **Special Summon:** by card effect / inherent (e.g. Cyber Dragon), any number, subject to conditions.
- **Fusion Summon:** via Polymerization/Fusion-type effect, sending listed Fusion Materials from field/hand.
- **Ritual Summon:** via a Ritual Spell + tributes meeting the level requirement.
- **Synchro Summon (the era's signature):** **1 Tuner + 1 or more non-Tuner monsters** whose **Levels sum
  exactly** to the Synchro Monster's Level; performed from the Extra Deck. **Tuner** monsters are the enabling
  card type introduced this era. (No Xyz/Rank mechanic yet.)

### 2.7 Win conditions
- Reduce opponent's **LP to 0**; opponent **cannot draw** when required (deck-out); or a card-specific
  win condition (e.g. **Exodia** — all 5 pieces in hand).

---

## 3. Functional-Errata Card Table (36 entries)

> Source: **https://www.edisonformat.com/functional-errata.html** (all 36 entries fetched 2026-07-17; card
> text `[verified]`). Passcodes cross-checked against ProjectIgnis/BabelCDB (see functional-errata memory).
> **Classification tags:** `[substitute-already-wired]` (our banlist already loads a pre-errata alias) ·
> `[rules-level-ruling]` (handled by the rules layer, not a card script) · `[needs-script-authoring]`
> (a pre-errata script must be authored or verified). Where a pre-errata script **exists in-repo but is not
> wired**, or is **wrong**, it is noted inline.

**Headline counts (reconciles the prior "6 wired / 3 damage rulings / ~30-33 to author"):**
- **6 `[substitute-already-wired]`**: Brionac, Sangan, Rescue Cat, Goyo, Brain Control, Future Fusion.
- **6 `[rules-level-ruling]`**: Cyber Phoenix, D.D. Survivor, Jade Knight (**3 damage-step rulings**) +
  Lumina/Lightsworns, Susa Soldier/Spirits (Rule #4) + Machina Gearframe/Unions (Rule #3) (**3 archetype reps**).
- **24 `[needs-script-authoring]`** (of which **6** have an unwired pre-errata script in-repo, and **REDMD's**
  in-repo pre-errata script is **WRONG**). → 24 authoring + 6 rules-reps (+3 damage rulings) ≈ the "~30-33".

| # | Card | Passcode(s) | Edison (pre-errata) behavior — the difference | Modern behavior | Tag |
|---|------|-------------|-----------------------------------------------|-----------------|-----|
| 1 | Armory Arm | 29071332 | [Trigger] inflicts damage **even if the destroyed monster leaves the GY**, equal to the ATK it had on the field (incl. modifiers). Colossal Fighter + Armory Arm OTK works. | narrower PSCT wording | `needs-script-authoring` |
| 2 | Ancient Fairy Dragon | 25862681 (pre-errata alias **25862691**) | 2nd Ignition (destroy a Field Spell) **does not target**; if it doesn't destroy, don't gain LP / don't add; destroy+gain-LP resolve simultaneously, add-field happens after. | targets; different sequencing | `needs-script-authoring` (pre-errata script exists in-repo, **not wired**) |
| 3 | Black Garden | 71645242 | [Trigger] activates even if a monster is **Special Summoned face-down**. | face-up only | `needs-script-authoring` |
| 4 | Brain Control | 87910978 → **511002995** | No modern restriction; if target flipped face-down before resolve, control unchanged; control still restored at End Phase even if flipped later. | restricted (no Special-Summoned targets etc.) | `substitute-already-wired` |
| 5 | Brionac, Dragon of the Ice Barrier | 50321796 → **511002993** | Ignition (discard N → bounce N) has **NO "once per turn."** Discard is cost; targets either field. | hard OPT added | `substitute-already-wired` |
| 6 | Catapult Turtle | 95727991 (pre-errata alias **511000228**) | Ignition (Tribute 1 → burn ½ ATK) has **no OPT.** | (unchanged-ish; verify) | `needs-script-authoring` (pre-errata script exists, **not wired**) |
| 7 | Cyber Phoenix | 3370104 | Must be **face-up before being selected as attack target** for its draw [Trigger] to meet its condition; cannot trigger if attacked while face-down. | — | `rules-level-ruling` (Damage Step) |
| 8 | D.D. Survivor | 48092532 | Same face-up-before-target ruling for its End-Phase revival [Trigger]. | — | `rules-level-ruling` (Damage Step) |
| 9 | Dark End Dragon | 88643579 | Pre-PSCT the "**and**" in its Ignition works as "**and if you do**"; if target leaves before resolve, this card **still loses 500 ATK/DEF**. | strict "and" sequencing | `needs-script-authoring` |
| 10 | Darkness Approaches | 80168720 (pre-errata alias **511003028**) | Can flip to **face-down Attack Position** (can't attack; can be Flip Summoned to face-up ATK). | changes position differently | `needs-script-authoring` (pre-errata script exists, **not wired**) |
| 11 | Destiny End Dragoon | 76263644 | Standby-Phase revival [Trigger] has **NO "once per turn."** | OPT added | `needs-script-authoring` |
| 12 | Elemental HERO Prisma | 89312388 | Reveal+send is **on resolution, not a cost**; if Prisma isn't face-up on resolve, don't send. | — | `needs-script-authoring` |
| 13 | Fortune Lady Light | 34471458 | 2nd [Trigger] (leaves field → SS a Fortune Lady) can activate **even while face-down** (reveal it). | face-up only | `needs-script-authoring` |
| 14 | Future Fusion | 77565204 → **511002997** | Send Fusion Material on resolution; if you can't Special Summon later, you can't activate. | reworked / OPT etc. | `substitute-already-wired` |
| 15 | Goyo Guardian | 7391448 → **511002994** | **Any Tuner** (incl. non-EARTH) may be material. | requires an EARTH Tuner | `substitute-already-wired` |
| 16 | Jade Knight | 44364207 | Same face-up-before-target ruling for its destroyed-by-battle search [Trigger]. | — | `rules-level-ruling` (Damage Step) |
| 17 | Light and Darkness Dragon | 47297616 | Death [Trigger] resolves **sequentially**: destroy all cards you control, **then** Special Summon the target. (Also **drives R04**: its activation-negation makes phase-mandatory triggers re-activate.) | different sequencing | `needs-script-authoring` |
| 18 | Light End Dragon | 25132288 | Pre-PSCT the "**and**" works as "**and if you do**"; if opponent's monster leaves before resolve, this card **still loses 500 ATK/DEF**. | strict sequencing | `needs-script-authoring` |
| 19 | Lumina, Lightsworn Summoner (**+ all Lightsworns**) | 95503687 | The phase-dependent mandatory End-Phase mill [Trigger] **re-activates if its activation is negated** (LADD) until it resolves (per R04). Applies to Judgment Dragon + all Lightsworns. | modern rules differ | `rules-level-ruling` (Rule #4) |
| 20 | Machina Gearframe (**+ all Union Monsters**) | 42940404 | Carries the Union **[Condition] "1 Union per monster"** (per R03); listed unions also have "destroy this instead." | condition removed 2016 | `rules-level-ruling` (Rule #3) |
| 21 | Mark of the Rose | 45247637 | Has **2 [Trigger] effects, both start a Chain** (End Phase give control; Standby Phase regain). If opponent's Cold Wave stops the Standby trigger, it won't activate. | reworked | `needs-script-authoring` |
| 22 | Mausoleum of the Emperor | 80921533 | Uses your **Normal Summon/Set for the turn** (not extra); LP payment is a cost; Summon happens **on resolution** → **Solemn Judgment cannot negate it**, but **Torrential can respond after** it resolves. | — | `needs-script-authoring` |
| 23 | My Body as a Shield | 69279219 | Can **chain to a card/effect** (e.g. face-up Royal Oppression); **cannot** be activated in the Damage Step (see R08-A4). | — | `needs-script-authoring` |
| 24 | Necrovalley | 47355498 (pre-errata alias **511002998**) | 1st [Continuous] **only negates effects that TARGET** the GY; non-targeting effects (Rekindling, Treeborn Frog, REDMD) are **not** negated; Types/Attributes in GY may be changed if not by targeting. | broader negation | `needs-script-authoring` (pre-errata script exists, **not wired**) |
| 25 | Quickdraw Synchron | 20932152 | Ignition performs a **Special Summon**; **send (not discard)** the hand monster **on resolution, not as cost.** | — | `needs-script-authoring` |
| 26 | Red-Eyes Darkness Metal Dragon | 88264978 | **NO "once per name"** on either the [Summon] (banish a Dragon to SS this) **or** the [Ignition] (SS a Dragon); Ignition **does not target** the GY. | once-per-name added | `needs-script-authoring` ⚠️ **in-repo pre-errata script is WRONG — still has once-per-name; must EDIT** |
| 27 | Rescue Cat | 14878871 → **511002992** | **NO "once per name"**; does not negate the summoned monsters' effects. | heavily restricted | `substitute-already-wired` |
| 28 | Ryko, Lightsworn Hunter | 21502796 (pre-errata alias **511003007**) | [Flip] target is **OPTIONAL** (if no target, only mills 3); resolves **sequentially**: destroy (optional) then mill 3 (mandatory). | mandatory target / different | `needs-script-authoring` (pre-errata script exists, **not wired**) |
| 29 | Sangan | 26202165 → **511002631** | Searches any monster ≤1500 ATK; **you may use the searched monster's effects.** | restricted PSCT | `substitute-already-wired` |
| 30 | Soul Exchange | 68005187 | Tributing the opponent's monster is **optional**; you're **not forced** to tribute it at the earliest opportunity. | — | `needs-script-authoring` |
| 31 | Strike Ninja | 41006930 | OPT is **per copy** — multiple Strike Ninja may each use the banish-self effect the same turn. | — | `needs-script-authoring` |
| 32 | Susa Soldier (**+ all Spirit Monsters**) | 40473581 | Phase-dependent mandatory return-to-hand [Trigger] **re-activates if its activation is negated** until it resolves (per R04). Applies to all Spirits. | modern rules differ | `rules-level-ruling` (Rule #4) |
| 33 | Swap Frog | 9126351 | Ignition usable **once per copy**; only **1 extra Normal Summon** is gained even if resolved multiple times. | — | `needs-script-authoring` |
| 34 | Treeborn Frog | 12538374 | Revival [Trigger] has **NO "once per turn"**; cannot activate if a monster is in your S/T Zone being treated as a Spell. | OPT added | `needs-script-authoring` |
| 35 | Ultimate Offering | 80604091 (errata-page image / pre-errata alias **80604092**; repo alias **511003023**) | Summon/Set happens **on resolution** → Solemn Judgment can't negate it; Torrential can respond if it was CL1. | — | `needs-script-authoring` (pre-errata script exists, **not wired**) |
| 36 | Urgent Tuning | 94634433 | Synchro Summon happens **on resolution** → Solemn Judgment **cannot** negate that Synchro Summon. | — | `needs-script-authoring` |

---

## 4. Representative Decklists (smoke-test fixtures)

> **These are canonical, real lists** (not reconstructed cores) pulled live from DuelingBook via the deck IDs
> embedded in edisonformat.com's own historic/decks pages, except where labeled "post-2020 event." Card
> `[passcode]` is DuelingBook's `serial_number` (matches the ProjectIgnis passcode). Extra/Side included where
> present. All `[verified]` — fetched 2026-07-17.
>
> **Sources:** SJC Edison 2010 lists = https://www.edisonformat.com/historic-decklists.html →
> `/decks/sjc-edison-*` (each embeds a DuelingBook deck). Post-2020 lists = category pages under
> https://www.edisonformat.com/decks (X-Sabers, Diva Hero, Vayu Turbo, Zombies, Frog Monarch). Archetype
> framing cross-checked against https://ygoprodeck.com/article/edison-format-s-top-10-decks-to-look-out-for-302221.

### 4.1 Quickdraw Dandywarrior — 1st, SJC Edison (Jeff Jones) · DuelingBook 6539169
**Main (41):** 3 Ryko, Lightsworn Hunter [21502796] · 3 Pot of Avarice [67169062] · 2 Caius the Shadow Monarch
[09748752] · 2 Dandylion [15341821] · 2 Debris Dragon [14943837] · 2 Lonefire Blossom [48686504] · 2 Quickdraw
Synchron [20932152] · 2 Super-Nimble Mega Hamster [05220687] · 2 Book of Moon [14087893] · 2 Bottomless Trap
Hole [29401950] · 2 Dimensional Prison [70342110] · 2 Dust Tornado [60082869] · 1 Card Trooper [85087012] · 1
Light and Darkness Dragon [47297616] · 1 Morphing Jar [33508719] · 1 Night Assailant [16226786] · 1 Sangan
[26202165] · 1 Tytannial, Princess of Camellias [11819616] · 1 Brain Control [87910978] · 1 Foolish Burial
[81439173] · 1 Heavy Storm [19613556] · 1 Mystical Space Typhoon [05318639] · 1 Call of the Haunted [97077563] ·
1 Mirror Force [44095762] · 1 Solemn Judgment [41420027] · 1 Starlight Road [58120309] · 1 Torrential Tribute
[53582587].
**Extra (15):** 2 Drill Warrior [03429238] · 2 Iron Chain Dragon [19974580] · 2 Stardust Dragon [44508094] · 1
Chimeratech Fortress Dragon [79229522] · 1 Ally of Justice Catastor [26593852] · 1 Ancient Fairy Dragon
[25862681] · 1 Black Rose Dragon [73580471] · 1 Brionac, Dragon of the Ice Barrier [50321796] · 1 Junk Archer
[42810973] · 1 Nitro Warrior [18013090] · 1 Red Dragon Archfiend [70902743] · 1 Turbo Warrior [46195773].
**Side (15):** 2 Consecrated Light [02980764] · 2 D.D. Crow [24508238] · 2 My Body as a Shield [69279219] · 2
System Down [18895832] · 2 Gottoms' Emergency Call [13504844] · 2 Pulling the Rug [34717238] · 2 Swallow Flip
[10651797] · 1 Trap Hole [04206964].

### 4.2 Plant Toolbox (Quickdraw Plant variant) — notable, SJC Edison · DuelingBook 6571840
**Main (40):** 3 Mark of the Rose [45247637] · 3 Pot of Avarice [67169062] · 2 Cyber Valley [03657444] · 2
Dandylion [15341821] · 2 Lonefire Blossom [48686504] · 2 Mystic Tomato [83011277] · 2 Bottomless Trap Hole
[29401950] · 2 Dimensional Prison [70342110] · 1 Blackwing - Gale the Whirlwind [02009101] · 1 Breaker the
Magical Warrior [71413901] · 1 Cactus Bouncer [31615285] · 1 Caius the Shadow Monarch [09748752] · 1 Card
Trooper [85087012] · 1 Dark Armed Dragon [65192027] · 1 Debris Dragon [14943837] · 1 Gorz the Emissary of
Darkness [44330098] · 1 Koa'ki Meiru Gravirose [41201555] · 1 Plaguespreader Zombie [33420078] · 1 Sangan
[26202165] · 1 Tragoedia [98777036] · 1 Tytannial, Princess of Camellias [11819616] · 1 Brain Control
[87910978] · 1 Foolish Burial [81439173] · 1 Heavy Storm [19613556] · 1 Mind Control [37520316] · 1 Mystical
Space Typhoon [05318639] · 1 Call of the Haunted [97077563] · 1 Mirror Force [44095762] · 1 Solemn Judgment
[41420027] · 1 Torrential Tribute [53582587].
**Extra (15):** 2 Colossal Fighter [23693634] · 2 Iron Chain Dragon [19974580] · 2 Stardust Dragon [44508094] ·
1 Ally of Justice Catastor [26593852] · 1 Ancient Fairy Dragon [25862681] · 1 Black Rose Dragon [73580471] · 1
Brionac [50321796] · 1 Dark End Dragon [88643579] · 1 Goyo Guardian [07391448] · 1 Magical Android [43385557] ·
1 Red Dragon Archfiend [70902743] · 1 Thought Ruler Archfiend [70780151].

### 4.3 Doomcaliber Gadgets (rogue Gadgets) — 2nd, SJC Edison (Renaldo Lainez) · DuelingBook 6539011
**Main (40):** 3 Doomcaliber Knight [78700060] · 3 Green Gadget [41172955] · 3 Red Gadget [86445415] · 3 Yellow
Gadget [13839120] · 3 Fissure [66788016] · 3 Smashing Ground [97169186] · 3 Dimensional Prison [70342110] · 2
Cyber Dragon [70095154] · 2 Hammer Shot [26412047] · 2 Bottomless Trap Hole [29401950] · 2 Royal Oppression
[93016201] · 1 Blackwing - Gale the Whirlwind [02009101] · 1 Gorz the Emissary of Darkness [44330098] · 1
Plaguespreader Zombie [33420078] · 1 Tragoedia [98777036] · 1 Heavy Storm [19613556] · 1 Lightning Vortex
[69162969] · 1 Limiter Removal [23171610] · 1 Mystical Space Typhoon [05318639] · 1 Mirror Force [44095762] · 1
Phoenix Wing Wind Blast [63356631] · 1 Torrential Tribute [53582587].
**Extra (15):** 2 Chimeratech Fortress Dragon [79229522] · 2 Stardust Dragon [44508094] · 1 Brionac [50321796] ·
1 Flamvell Uruquizas [53714009] · 1 Gaia Knight, the Force of Earth [97204936] · 1 Goyo Guardian [07391448] · 1
Ancient Fairy Dragon [25862681] · 1 Black Rose Dragon [73580471] · 1 Blackwing Armor Master [69031175] · 1
Avenging Knight Parshath [69514125] · 1 Colossal Fighter [23693634] · 1 Red Dragon Archfiend [70902743] · 1
Thought Ruler Archfiend [70780151].

### 4.4 Machina (Gadget) — 16th, SJC Edison · DuelingBook 6539132
**Main (44):** 3 Green Gadget [41172955] · 3 Red Gadget [86445415] · 3 Yellow Gadget [13839120] · 3 Machina
Gearframe [42940404] · 3 Solidarity [86780027] · 3 Smashing Ground [97169186] · 3 Nobleman of Crossout
[71044499] · 3 Creature Swap [31036355] · 3 Dimensional Prison [70342110] · 2 Machina Fortress [05556499] · 2
Machina Peacekeeper [78349103] · 2 Bottomless Trap Hole [29401950] · 2 Royal Oppression [93016201] · 2 Ultimate
Offering [80604091] · 1 Limiter Removal [23171610] · 1 Mystical Space Typhoon [05318639] · 1 Mirror Force
[44095762] · 1 Solemn Judgment [41420027] · 1 Starlight Road [58120309] · 1 Torrential Tribute [53582587] · 1
Trap Dustshoot [64697231].
**Extra (15):** 3 Chimeratech Fortress Dragon [79229522] · 2 Stardust Dragon [44508094] · 1 Armory Arm
[29071332] · 1 Ally of Justice Catastor [26593852] · 1 Brionac [50321796] · 1 Goyo Guardian [07391448] · 1
Black Rose Dragon [73580471] · 1 Blackwing Armor Master [69031175] · 1 Power Tool Dragon [02403771] · 1
Colossal Fighter [23693634] · 1 Thought Ruler Archfiend [70780151] · 1 Mist Wurm [27315304].

### 4.5 Synchro / Caliber Cat (Rescue Cat) — 3rd, SJC Edison · DuelingBook 6538938
**Main (41):** 3 Doomcaliber Knight [78700060] · 3 Ryko, Lightsworn Hunter [21502796] · 3 X-Saber Airbellum
[90508760] · 3 Dimensional Prison [70342110] · 2 Cyber Dragon [70095154] · 2 Gravekeeper's Spy [24317029] · 2
Book of Moon [14087893] · 2 Pot of Avarice [67169062] · 2 Bottomless Trap Hole [29401950] · 1 Caius
[09748752] · 1 Chaos Sorcerer [09596126] · 1 Dark Armed Dragon [65192027] · 1 Gorz [44330098] · 1 Gravekeeper's
Descendant [30213599] · 1 Rescue Cat [14878871] · 1 Sangan [26202165] · 1 Summoner Monk [00423585] · 1 Allure
of Darkness [01475311] · 1 Brain Control [87910978] · 1 Heavy Storm [19613556] · 1 Mind Control [37520316] · 1
My Body as a Shield [69279219] · 1 Mystical Space Typhoon [05318639] · 1 Smashing Ground [97169186] · 1 Dust
Tornado [60082869] · 1 Solemn Judgment [41420027] · 1 Starlight Road [58120309] · 1 Trap Dustshoot [64697231].
**Extra (15):** 2 Arcanite Magician [31924889] · 2 Stardust Dragon [44508094] · 1 Chimeratech Fortress Dragon
[79229522] · 1 Ally of Justice Catastor [26593852] · 1 Black Rose Dragon [73580471] · 1 Brionac [50321796] · 1
Colossal Fighter [23693634] · 1 Goyo Guardian [07391448] · 1 Magical Android [43385557] · 1 Mist Wurm
[27315304] · 1 Red Dragon Archfiend [70902743] · 1 Thought Ruler Archfiend [70780151] · 1 X-Saber Urbellum
[80108118].

### 4.6 Gladiator Beasts (Prisma / Test Tiger variant) — 5th, SJC Edison (Jake Mattern) · DuelingBook 7798916
**Main (42):** 3 Test Tiger [92373006] · 3 Book of Moon [14087893] · 3 Dimensional Prison [70342110] · 3 Dust
Tornado [60082869] · 2 Elemental HERO Prisma [89312388] · 2 Gladiator Beast Darius [25924653] · 2 Gladiator
Beast Laquari [78868776] · 2 Enemy Controller [98045062] · 2 Bottomless Trap Hole [29401950] · 2 Compulsory
Evacuation Device [94192409] · 2 Gladiator Beast War Chariot [96216229] · 2 Starlight Road [58120309] · 1
Elemental HERO Stratos [40044918] · 1 Gladiator Beast Bestiari [41470137] · 1 Gladiator Beast Equeste
[57731460] · 1 Gladiator Beast Hoplomus [04253484] · 1 Gladiator Beast Murmillo [05975022] · 1 Gladiator Beast
Retiari [00612115] · 1 Gladiator Beast Secutor [77642288] · 1 Morphing Jar [33508719] · 1 Cold Wave [60682203]
· 1 Mystical Space Typhoon [05318639] · 1 Reinforcement of the Army [32807846] · 1 Call of the Haunted
[97077563] · 1 Solemn Judgment [41420027] · 1 Trap Dustshoot [64697231].
**Extra (15):** 3 Chimeratech Fortress Dragon [79229522] · 3 Gladiator Beast Gyzarus [48156348] · 3 Gladiator
Beast Heraklinos [27346636] · 2 Stardust Dragon [44508094] · 1 Black Rose Dragon [73580471] · 1 Colossal
Fighter [23693634] · 1 Goyo Guardian [07391448] · 1 Magical Android [43385557].

### 4.7 Lightsworn Monarchs — 6th, SJC Edison (Jarel Winston) · DuelingBook 6539120
**Main (42):** 3 Caius the Shadow Monarch [09748752] · 3 Ryko, Lightsworn Hunter [21502796] · 3 Pot of Avarice
[67169062] · 2 Cyber Dragon [70095154] · 2 Dandylion [15341821] · 2 Jain, Lightsworn Paladin [96235275] · 2
Lyla, Lightsworn Sorceress [22624373] · 2 Super-Nimble Mega Hamster [05220687] · 2 Thestalos the Firestorm
Monarch [26205777] · 2 Book of Moon [14087893] · 2 Solar Recharge [00691925] · 2 Bottomless Trap Hole
[29401950] · 2 Dimensional Prison [70342110] · 2 Phoenix Wing Wind Blast [63356631] · 1 Blackwing - Gale the
Whirlwind [02009101] · 1 Card Trooper [85087012] · 1 Debris Dragon [14943837] · 1 Gorz [44330098] · 1 Sangan
[26202165] · 1 Treeborn Frog [12538374] · 1 Brain Control [87910978] · 1 Heavy Storm [19613556] · 1 Mystical
Space Typhoon [05318639] · 1 Mirror Force [44095762] · 1 Torrential Tribute [53582587].
**Extra (15):** 2 Chimeratech Fortress Dragon [79229522] · 2 Stardust Dragon [44508094] · 1 Ally of Justice
Catastor [26593852] · 1 Magical Android [43385557] · 1 Brionac [50321796] · 1 Goyo Guardian [07391448] · 1
Ancient Fairy Dragon [25862681] · 1 Black Rose Dragon [73580471] · 1 Zeman the Ape King [22858242] · 1 Colossal
Fighter [23693634] · 1 Red Dragon Archfiend [70902743] · 1 Thought Ruler Archfiend [70780151] · 1 Mist Wurm
[27315304].

### 4.8 Twilight (Lightsworn + Chaos) — 13th, SJC Edison · DuelingBook 6539238
**Main (40):** 3 Caius [09748752] · 3 Lyla, Lightsworn Sorceress [22624373] · 3 Ryko [21502796] · 3 Book of Moon
[14087893] · 3 Solar Recharge [00691925] · 2 Super-Nimble Mega Hamster [05220687] · 2 Pot of Avarice
[67169062] · 2 Bottomless Trap Hole [29401950] · 2 Dimensional Prison [70342110] · 1 Blackwing - Gale
[02009101] · 1 Card Trooper [85087012] · 1 Celestia, Lightsworn Angel [94381039] · 1 Chaos Sorcerer
[09596126] · 1 Dark Armed Dragon [65192027] · 1 Gorz [44330098] · 1 Necro Gardna [04906301] · 1 Plaguespreader
Zombie [33420078] · 1 Sangan [26202165] · 1 Spirit Reaper [23205979] · 1 Wulf, Lightsworn Beast [58996430] · 1
Allure of Darkness [01475311] · 1 Brain Control [87910978] · 1 Charge of the Light Brigade [94886282] · 1 Heavy
Storm [19613556] · 1 Mirror Force [44095762] · 1 Royal Oppression [93016201].
**Extra (15):** 1 Armory Arm [29071332] · 1 Ally of Justice Catastor [26593852] · 1 Magical Android [43385557]
· 1 Brionac [50321796] · 1 Goyo Guardian [07391448] · 1 Tempest Magician [63101919] · 1 Arcanite Magician
[31924889] · 1 Black Rose Dragon [73580471] · 1 Blackwing Armor Master [69031175] · 1 Colossal Fighter
[23693634] · 1 Red Dragon Archfiend [70902743] · 1 Stardust Dragon [44508094] · 1 Thought Ruler Archfiend
[70780151] · 1 Avenging Knight Parshath [69514125] · 1 Mist Wurm [27315304].

### 4.9 Blackwings — 14th, SJC Edison · DuelingBook 6538847
**Main (40):** 3 Blackwing - Blizzard the Far North [22835145] · 3 Blackwing - Bora the Spear [49003716] · 3
Blackwing - Kalut the Moon Shadow [85215458] · 3 Blackwing - Shura the Blue Flame [58820853] · 3 Blackwing -
Sirocco the Dawn [75498415] · 3 Book of Moon [14087893] · 3 Icarus Attack [53567095] · 2 Blackwing - Vayu the
Emblem of Honor [72714392] · 2 Black Whirlwind [91351370] · 2 Bottomless Trap Hole [29401950] · 2 Royal
Oppression [93016201] · 1 Blackwing - Gale the Whirlwind [02009101] · 1 Dark Armed Dragon [65192027] · 1 Allure
of Darkness [01475311] · 1 Brain Control [87910978] · 1 Heavy Storm [19613556] · 1 My Body as a Shield
[69279219] · 1 Mystical Space Typhoon [05318639] · 1 Delta Crow - Anti Reverse [59839761] · 1 Mirror Force
[44095762] · 1 Torrential Tribute [53582587] · 1 Trap Dustshoot [64697231].
**Extra (15):** 3 Blackwing Armed Wing [76913983] · 2 Blackwing Armor Master [69031175] · 2 Stardust Dragon
[44508094] · 1 Ally of Justice Catastor [26593852] · 1 Magical Android [43385557] · 1 Brionac [50321796] · 1
Goyo Guardian [07391448] · 1 Black Rose Dragon [73580471] · 1 Blackwing - Silverwind the Ascendant [33236860] ·
1 Colossal Fighter [23693634] · 1 Mist Wurm [27315304].

### 4.10 Vayu Turbo (Blackwing variant) — DD5 2nd place (Samoopusteno), post-2020 event · DuelingBook 13793230
**Main (40):** 3 Blackwing - Sirocco the Dawn [75498415] · 3 Blackwing - Vayu the Emblem of Honor [72714392] ·
3 Ryko [21502796] · 2 Armageddon Knight [28985331] · 2 Caius [09748752] · 2 Dark Grepher [14536035] · 2
Super-Nimble Mega Hamster [05220687] · 2 Bottomless Trap Hole [29401950] · 2 Dimensional Prison [70342110] · 1
Blackwing - Gale [02009101] · 1 Card Trooper [85087012] · 1 Chaos Sorcerer [09596126] · 1 Dark Armed Dragon
[65192027] · 1 Gorz [44330098] · 1 Necro Gardna [04906301] · 1 Plaguespreader Zombie [33420078] · 1 Allure of
Darkness [01475311] · 1 Brain Control [87910978] · 1 Burial from a Different Dimension [48976825] · 1 Heavy
Storm [19613556] · 1 Mystical Space Typhoon [05318639] · 1 Reinforcement of the Army [32807846] · 1 Mirror
Force [44095762] · 1 Return from the Different Dimension [27174286] · 1 Royal Oppression [93016201] · 1 Solemn
Judgment [41420027] · 1 Torrential Tribute [53582587] · 1 Trap Dustshoot [64697231].
**Extra (15):** 2 Blackwing Armed Wing [76913983] · 2 Blackwing Armor Master [69031175] · 1 Ally of Justice
Catastor [26593852] · 1 Armory Arm [29071332] · 1 Black Rose Dragon [73580471] · 1 Blackwing - Silverwind the
Ascendant [33236860] · 1 Brionac [50321796] · 1 Colossal Fighter [23693634] · 1 Dark End Dragon [88643579] · 1
Flamvell Uruquizas [53714009] · 1 Goyo Guardian [07391448] · 1 Stardust Dragon [44508094] · 1 Thought Ruler
Archfiend [70780151].

### 4.11 Six Samurai — notable, SJC Edison · DuelingBook 6550608
**Main (41):** 3 Grandmaster of the Six Samurai [83039729] · 3 Hand of the Six Samurai [78792195] · 3 The Six
Samurai - Irou [27782503] · 3 The Six Samurai - Yaichi [64398890] · 3 The Six Samurai - Zanji [95519486] · 3
Gateway of the Six [27970830] · 3 Six Samurai United [72345736] · 3 Solidarity [86780027] · 3 Dimensional
Prison [70342110] · 3 Starlight Road [58120309] · 2 Shrink [55713623] · 2 The Warrior Returning Alive
[95281259] · 1 The Six Samurai - Kamon [90397998] · 1 Heavy Storm [19613556] · 1 Backs to the Wall [32603633] ·
1 Call of the Haunted [97077563] · 1 Mirror Force [44095762] · 1 Solemn Judgment [41420027] · 1 Torrential
Tribute [53582587].
**Extra (15):** 3 Chimeratech Fortress Dragon [79229522] · 3 Stardust Dragon [44508094] · 1 Ally of Justice
Catastor [26593852] · 1 Ancient Fairy Dragon [25862681] · 1 Armory Arm [29071332] · 1 Black Rose Dragon
[73580471] · 1 Brionac [50321796] · 1 Gaia Knight, the Force of Earth [97204936] · 1 Goyo Guardian [07391448] ·
1 Magical Android [43385557] · 1 Mist Wurm [27315304].

### 4.12 X-Sabers — post-2020 event · DuelingBook 9222333
**Main (40):** 3 X-Saber Airbellum [90508760] · 3 XX-Saber Emmersblade [42737833] · 3 XX-Saber Faultroll
[51808422] · 3 XX-Saber Fulhelmknight [78422252] · 3 Book of Moon [14087893] · 3 Upstart Goblin [70368879] · 3
Gottoms' Emergency Call [13504844] · 2 Ryko [21502796] · 2 XX-Saber Ragigura [87292536] · 1 Rescue Cat
[14878871] · 1 Sangan [26202165] · 1 Summoner Monk [00423585] · 1 Super-Nimble Mega Hamster [05220687] · 1
Brain Control [87910978] · 1 Cold Wave [60682203] · 1 Heavy Storm [19613556] · 1 Mind Control [37520316] · 1
Mystical Space Typhoon [05318639] · 1 One for One [02295440] · 1 Reinforcement of the Army [32807846] · 1 Call
of the Haunted [97077563] · 1 Mirror Force [44095762] · 1 Solemn Judgment [41420027] · 1 Trap Dustshoot
[64697231].
**Extra (15):** 2 XX-Saber Gottoms [52352005] · 1 Chimeratech Fortress Dragon [79229522] · 1 Ally of Justice
Catastor [26593852] · 1 Arcanite Magician [31924889] · 1 Armory Arm [29071332] · 1 Black Rose Dragon
[73580471] · 1 Brionac [50321796] · 1 Colossal Fighter [23693634] · 1 Goyo Guardian [07391448] · 1 Magical
Android [43385557] · 1 Mist Wurm [27315304] · 1 Stardust Dragon [44508094] · 1 X-Saber Urbellum [80108118] · 1
XX-Saber Hyunlei [02203790].

### 4.13 Diva Hero — DD4 5th place (Moom), post-2020 event · DuelingBook 13365596
**Main (40):** 3 Caius [09748752] · 3 Deep Sea Diva [78868119] · 3 Miracle Fusion [45906428] · 2 Evil HERO
Infernal Prodigy [50304345] · 2 Destiny HERO - Malicious [09411399] · 2 Snowman Eater [91133740] · 2 Bottomless
Trap Hole [29401950] · 2 Dimensional Prison [70342110] · 1 Gorz [44330098] · 1 Plaguespreader Zombie
[33420078] · 1 Elemental HERO Stratos [40044918] · 1 Elemental HERO Neos Alius [69884162] · 1 Spined Gillman
[42463414] · 1 Dark Grepher [14536035] · 1 Spirit Reaper [23205979] · 1 Allure of Darkness [01475311] · 1
Reinforcement of the Army [32807846] · 1 E - Emergency Call [00213326] · 1 Future Fusion [77565204] · 1 Brain
Control [87910978] · 1 Heavy Storm [19613556] · 1 Mystical Space Typhoon [05318639] · 1 Gold Sarcophagus
[75500286] · 1 Phoenix Wing Wind Blast [63356631] · 1 Mirror Force [44095762] · 1 Torrential Tribute
[53582587] · 1 Solemn Judgment [41420027] · 1 Return from the Different Dimension [27174286] · 1 Trap Dustshoot
[64697231].
**Extra (15):** 3 Elemental HERO Absolute Zero [40854197] · 1 Chimeratech Fortress Dragon [79229522] · 1 Armory
Arm [29071332] · 1 Ally of Justice Catastor [26593852] · 1 Magical Android [43385557] · 1 Goyo Guardian
[07391448] · 1 Brionac [50321796] · 1 Black Rose Dragon [73580471] · 1 Stardust Dragon [44508094] · 1 Dark End
Dragon [88643579] · 1 Thought Ruler Archfiend [70780151] · 1 Colossal Fighter [23693634] · 1 Elemental HERO
Gaia [16304628].

### 4.14 Zombies (Zombiesworn-adjacent) — DD4 2nd place (ThatGoodPizza), post-2020 event · DuelingBook 13365417
**Main (41):** 2 Caius [09748752] · 2 Cyber Dragon [70095154] · 2 D.D. Crow [24508238] · 2 Deep Sea Diva
[78868119] · 2 Goblin Zombie [63665875] · 2 Mystic Tomato [83011277] · 2 Pyramid Turtle [77044671] · 2 Book of
Life [02204140] · 2 Bottomless Trap Hole [29401950] · 2 Dimensional Prison [70342110] · 2 Dust Tornado
[60082869] · 1 Dark Armed Dragon [65192027] · 1 Gorz [44330098] · 1 Mezuki [92826944] · 1 Plaguespreader Zombie
[33420078] · 1 Sangan [26202165] · 1 Spirit Reaper [23205979] · 1 Zombie Master [17259470] · 1 Allure of
Darkness [01475311] · 1 Brain Control [87910978] · 1 Heavy Storm [19613556] · 1 Mind Control [37520316] · 1
Mystical Space Typhoon [05318639] · 1 Call of the Haunted [97077563] · 1 Mirror Force [44095762] · 1 Return
from the Different Dimension [27174286] · 1 Solemn Judgment [41420027] · 1 Starlight Road [58120309] · 1
Torrential Tribute [53582587] · 1 Trap Dustshoot [64697231].
**Extra (15):** 1 Chimeratech Fortress Dragon [79229522] · 1 Ally of Justice Catastor [26593852] · 1 Armory Arm
[29071332] · 1 Black Rose Dragon [73580471] · 1 Brionac [50321796] · 1 Colossal Fighter [23693634] · 1 Dark End
Dragon [88643579] · 1 Doomkaiser Dragon [06021033] · 1 Flamvell Uruquizas [53714009] · 1 Gaia Knight, the Force
of Earth [97204936] · 1 Goyo Guardian [07391448] · 1 Mist Wurm [27315304] · 1 Revived King Ha Des [05309481] ·
1 Stardust Dragon [44508094] · 1 Thought Ruler Archfiend [70780151].

### 4.15 Frognarch / Frog Monarch — DD03 3rd place (Corinna), post-2020 event · DuelingBook 12421850
> ⚠️ This list runs **3 Substitoad [20663556]**, which is **Forbidden** on some Edison banlists — confirm
> against our locked banlist before using this as a fixture (see §5, note 6).

**Main (40):** 3 Substitoad [20663556] · 3 Swap Frog [09126351] · 3 Junk Synchron [63977008] · 3 Caius
[09748752] · 2 Treeborn Frog [12538374] · 2 Dupe Frog [46239604] · 2 Raiza the Storm Monarch [73125233] · 2
Battle Fader [19665973] · 2 Gold Sarcophagus [75500286] · 2 Enemy Controller [98045062] · 2 Threatening Roar
[36361633] · 1 Unifrog [56052205] · 1 Mobius the Frost Monarch [04929256] · 1 Dark Armed Dragon [65192027] · 1
Gorz [44330098] · 1 Tragoedia [98777036] · 1 Reinforcement of the Army [32807846] · 1 Allure of Darkness
[01475311] · 1 One for One [02295440] · 1 Scapegoat [73915051] · 1 Brain Control [87910978] · 1 Mystical Space
Typhoon [05318639] · 1 Heavy Storm [19613556] · 1 Cold Wave [60682203] · 1 Mirror Force [44095762].
**Extra (15):** 2 Ally of Justice Catastor [26593852] · 1 Armory Arm [29071332] · 1 Junk Warrior [60800381] · 1
Magical Android [43385557] · 1 Flamvell Uruquizas [53714009] · 1 Brionac [50321796] · 1 Goyo Guardian
[07391448] · 1 X-Saber Urbellum [80108118] · 1 Black Rose Dragon [73580471] · 1 Stardust Dragon [44508094] · 1
Thought Ruler Archfiend [70780151] · 1 Colossal Fighter [23693634] · 1 Red Dragon Archfiend [70902743] · 1 Mist
Wurm [27315304].

### 4.16 Flamvell (rogue) — 7th, SJC Edison · DuelingBook 6539021
**Main (40):** 3 Caius [09748752] · 3 Flamvell Firedog [23297235] · 3 Flamvell Magician [95621257] · 3
Gravekeeper's Spy [24317029] · 3 Ryko [21502796] · 3 Book of Moon [14087893] · 3 Rekindling [74845897] · 2
Bottomless Trap Hole [29401950] · 2 Dimensional Prison [70342110] · 1 Blackwing - Gale [02009101] · 1 Chaos
Sorcerer [09596126] · 1 Cyber Dragon [70095154] · 1 Gorz [44330098] · 1 Gravekeeper's Descendant [30213599] · 1
Super-Nimble Mega Hamster [05220687] · 1 Brain Control [87910978] · 1 Heavy Storm [19613556] · 1 Mind Control
[37520316] · 1 Mystical Space Typhoon [05318639] · 1 Dust Tornado [60082869] · 1 Mirror Force [44095762] · 1
Royal Oppression [93016201] · 1 Solemn Judgment [41420027] · 1 Trap Dustshoot [64697231].
**Extra (15):** 2 Colossal Fighter [23693634] · 2 Stardust Dragon [44508094] · 1 Ally of Justice Catastor
[26593852] · 1 Magical Android [43385557] · 1 Brionac [50321796] · 1 Goyo Guardian [07391448] · 1 Flamvell
Uruquizas [53714009] · 1 Arcanite Magician [31924889] · 1 Black Rose Dragon [73580471] · 1 X-Saber Urbellum
[80108118] · 1 Blackwing Armor Master [69031175] · 1 Red Dragon Archfiend [70902743] · 1 Thought Ruler
Archfiend [70780151].

### 4.17 Black Garden (rogue control/burn) — notable, SJC Edison · DuelingBook 6571645
> Note: this "Black Garden" list is a **Gravekeeper/Volcanic control-burn** build using Black Garden as its
> engine (not a pure Plant build) — representative of the rogue Black Garden archetype tag.

**Main (40):** 3 Don Zaloog [76922029] · 3 Gravekeeper's Spy [24317029] · 3 Volcanic Rocket [76459806] · 3
Volcanic Shell [33365932] · 3 Black Garden [71645242] · 3 Dimensional Prison [70342110] · 2 Dekoichi the
Battlechanted Locomotive [87621407] · 2 Blaze Accelerator [69537999] · 2 Pot of Avarice [67169062] · 2
Bottomless Trap Hole [29401950] · 2 Divine Wrath [49010598] · 2 Phoenix Wing Wind Blast [63356631] · 1
Blackwing - Gale [02009101] · 1 Card Trooper [85087012] · 1 Gravekeeper's Descendant [30213599] · 1 Morphing
Jar [33508719] · 1 Terraforming [73628505] · 1 Dust Tornado [60082869] · 1 Mirror Force [44095762] · 1 Solemn
Judgment [41420027] · 1 Starlight Road [58120309] · 1 Torrential Tribute [53582587].
**Extra (15):** 3 Stardust Dragon [44508094] · 1 Ally of Justice Catastor [26593852] · 1 Arcanite Magician
[31924889] · 1 Black Rose Dragon [73580471] · 1 Blackwing Armor Master [69031175] · 1 Brionac [50321796] · 1
Colossal Fighter [23693634] · 1 Flamvell Uruquizas [53714009] · 1 Goyo Guardian [07391448] · 1 Magical Android
[43385557] · 1 Red Dragon Archfiend [70902743] · 1 Thought Ruler Archfiend [70780151] · 1 X-Saber Urbellum
[80108118].

### 4.18 Infernity (rogue) — NOTE, no full list provided
Infernity was a recognized rogue archetype but is **banlist-constrained in Edison** (its later key enablers
fall outside the March-2010 pool / are limited), so it did not put up a canonical SJC list and is intentionally
represented by a note rather than a fixture. If a fixture is needed, build a core around **Infernity Archfiend,
Infernity Necromancer, Infernity Gun, Infernity Launcher, Stygian Street Patrol** + the shared generic Synchro
toolbox, and validate legality against the locked banlist. `[uncertain — needs a list source + banlist check]`

**Shared "generic toolbox" observation (for fixture reuse):** nearly every list above shares a common
Extra-Deck Synchro core — **Stardust Dragon [44508094], Colossal Fighter [23693634], Black Rose Dragon
[73580471], Brionac [50321796], Goyo Guardian [07391448], Ally of Justice Catastor [26593852], Mist Wurm
[27315304], Red Dragon Archfiend [70902743], Thought Ruler Archfiend [70780151], Magical Android [43385557],
Chimeratech Fortress Dragon [79229522]** — plus a Spell/Trap staple core (**Heavy Storm, Mystical Space
Typhoon, Book of Moon, Bottomless Trap Hole, Dimensional Prison, Mirror Force, Torrential Tribute, Solemn
Judgment, Brain Control, Trap Dustshoot, Starlight Road**). These are the highest-value cards to verify first.

---

## 5. Source conflicts & open items needing the product owner's call

1. **Damage-Step naming (flag, not a conflict).** Engine flag is `DUEL_6_STEP_BATLLE_STEP`; edisonformat.com
   calls it the **"7-timing Damage Step."** Same behavior — but the user docs and test names should
   standardize on **one** description. *Recommend: use edisonformat.com's "7 substeps" language in user docs,
   note the engine flag name in the test matrix.* `[verified]`

2. **Rule #12 (Infinite Loops) is likely NOT engine-enforced.** This is a player-legality / judge-arbitration
   rule ("voluntary loops are illegal to initiate"). ocgcore almost certainly won't refuse a voluntary
   loop-causing action the Edison way. **Needs an engine-validation spike; document as a human judge-call
   carve-out in the user docs regardless.** `[likely]`

3. **Rule #10 (LP costs) is a confirmed engine gap.** The strict "can't pay a cost to 0 LP / self-destruct"
   behavior is currently `it.todo` in the Vitest suite. Author-side fix + test needed. `[verified]`

4. **Rule #6 GY-ignition needs our custom WASM.** `DUEL_TCG_FAST_EFFECT_IGNITION (0x400000000)` is absent from
   stock `ocgcore-wasm@0.1.2`; our custom build (Spike E) has it and R1 passes. Ensure the deployed engine is
   the custom WASM, not the npm default. `[verified]`

5. **Ultimate Offering passcode ambiguity.** Modern passcode **80604091**; the functional-errata page's image
   filename is **80604092** (a pre-errata alias), and the in-repo pre-errata script alias is **511003023**.
   Not a rules conflict — just make sure the passcode allow-list and script loader agree on which entry maps
   to the pre-errata behavior. `[verified]`

6. **Banlist vs. decklist mismatch (Frognarch fixture).** The post-2020 Frognarch list (§4.15) runs **3×
   Substitoad [20663556]**, which the ygoprodeck top-10 article calls **"now-Forbidden."** Some Edison
   banlists forbid it; the SJC-era pool allowed it. **Confirm Substitoad's status on our locked banlist**
   before using §4.15 as a fixture; if Forbidden, either swap the fixture or annotate it as a period-piece.
   `[likely — needs banlist check]`

7. **REDMD in-repo script is wrong for Edison.** ProjectIgnis's only Red-Eyes Darkness Metal Dragon script
   (pre-errata/c88264978.lua) **still carries once-per-name**; Edison REDMD has none on either effect. This is
   `needs-script-authoring` with an **EDIT-not-wire** action. `[verified]` (from functional-errata memory)

8. **No direct textual conflicts found** between edisonformat.com's three rules pages (rule-differences,
   functional-errata, rulebook index). All 13 rules and 36 errata entries were fetched cleanly. Secondary
   sources (ygoprodeck, formatlibrary) were used only for archetype framing/decklists and agree with the
   primary source. `[verified]`

---

## Appendix — Source URLs (record)
- Rule differences (13 rules): https://www.edisonformat.com/edison-rule-differences.html
- Functional errata (36 entries): https://www.edisonformat.com/functional-errata.html
- Rules index / rulebook: https://www.edisonformat.com/rules.html · https://www.edisonformat.com/rulebook.html
- Priority explainer: https://www.edisonformat.com/priority.html
- Battle Phase explainer: https://www.edisonformat.com/battle-phase.html
- Historic decklists (SJC Edison 2010): https://www.edisonformat.com/historic-decklists.html
- Decks index / archetype categories: https://www.edisonformat.com/decks
- Top-10 Edison decks (archetype framing): https://ygoprodeck.com/article/edison-format-s-top-10-decks-to-look-out-for-302221
- Konami fast-effect-timing flowchart (referenced by Rule #6): https://www.yugioh-card.com/en/gameplay/fasteffects_timing.html
- DuelingBook deck JSON endpoint (needs browser UA + Referer header): https://www.duelingbook.com/php-scripts/load-deck.php?id=<ID>
