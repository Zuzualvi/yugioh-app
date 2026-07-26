---
title: Edison Parity Audit — Scope Depth Decision (rules-level vs card-level)
audience: product owner + engineers scoping the "parity audit" and the user-facing rules docs
author: product-research subagent
date: 2026-07-17
status: decision-input brief (accept / modify / reject the Bottom Line)
sources_of_record:
  - edisonformat.com (rule differences, functional errata, rules page) — group's anchor authority
  - edisonformat.net/beginners/simulators (community simulator accuracy table)
  - prior team memory: domain/edison-format.md, research/edison-engine-rules-flags.md,
    research/edison-functional-errata.md, research/ygopro-engine-landscape.md
confidence_tags: verified = directly sourced; likely = strong inference from sources;
  uncertain = reasoned estimate, needs a spike to firm up
---

# Edison Parity Audit — How Deep Should It Go?

**The question this brief answers:** before we run the "parity audit" (prove the app enforces
Edison the way a live-tournament judge would) and write user-facing docs from it, do we audit at
**rules-level**, **card-level**, or a defined combination? The product owner leans card-level
("that's what the game is built on"). Below are the grounded facts and numbers to choose with.

**TL;DR for the impatient:** "Playing Edison correctly" is overwhelmingly governed by a small,
enumerable set of **core rules** (13 published format-differences + the Master-Rule-1 base rulebook)
plus a small, enumerable set of **~36 card-level deviations** (the functional-errata list). Everything
else — the behavior of the other ~3,645 cards — is handled by shared community card scripts that no
Edison authority audits card-by-card. **No simulator or community body performs exhaustive per-card
verification of the pool.** So "card-level = the whole 3,681 pool" is neither the community bar nor
feasible. Recommended audit = **rules-level (all of it) + card-level scoped to the known-deviation
set, then spot-verified against the competitive staples**. Details and numbers follow.

---

## 1. Rules-level source + full inventory

**Authoritative, enumerable source (verified).** The group's anchor authority publishes the core
rules across two linked artifacts:

- **`edisonformat.com/edison-rule-differences.html`** — a numbered list of the rules that make Edison
  differ from modern Yu-Gi-Oh. It states Edison "was played under the TCG 2008 Rules Change (the
  equivalent of Master Rules [1])" and catalogs the differences. This page holds **exactly 13
  numbered rules** (not the ~7-10 fragments we had previously cited). *(verified — full text fetched)*
- **`edisonformat.com/rulebook.html`** (the official 5D's / Master Rule 1 rulebook PDF) — the *base*
  game rules (turn/phase structure, summoning, chains, battle phase, deck limits). The differences
  page only lists *deltas* from this base. *(verified via prior memory + page nav)*

**Answer to "is the count really ~13?"** The *published deltas* number is **13**. But that is the
count of **format-difference rules**, not the total rules surface — and several of the 13 expand into
many nested sub-rules. So the true rules surface an audit must verify is **substantially larger than
13** once you include the Master-Rule-1 base plus the nested cases inside each numbered rule. Concrete
evidence of the nesting: Rule #8 (Damage Step) alone defines **7 distinct substeps** each with its own
activation legality; Rule #5 (Trap Monsters) enumerates **~12 distinct interactions**; Rule #7 (SEGOC)
defines a **4-step chain-ordering procedure**. *(verified — from the fetched page)*

### The full 13 published rule-differences (one line each, verbatim scope)

Source for all: `https://www.edisonformat.com/edison-rule-differences.html` *(verified)*

| # | Rule | What it governs | Our engine coverage (from memory) |
|---|------|-----------------|-----------------------------------|
| 1 | Starting Player Draws | Player going first draws turn 1 (starts with 6 cards) | `DUEL_1ST_TURN_DRAW` — tested PASS |
| 2 | Only 1 Active Field Spell | One shared face-up Field Spell; new one destroys old (not sent to GY) | `DUEL_1_FACEUP_FIELD` — tested PASS |
| 3 | Union Monster Conditions | Pre-2016 "1 Union per monster" condition + "destroy this instead" only on listed unions | Card-text (functional errata) — Union rep |
| 4 | Phase-Dependent Mandatory Trigger Effects | Negated *activation* of a phase-mandatory trigger (Spirits/Lightsworns) re-activates; negated *effect* does not | Rules behavior (script + engine) |
| 5 | Trap Monster Zone Blocking | Trap Monster occupies 1 MZone + 1 S/T zone; ~12 sub-interactions (Book of Moon, Jinzo, removal, etc.) | Engine/script behavior |
| 6 | Ignition Effect Priority | Turn player may activate an Ignition effect as CL1 in the Summon window if the Summon didn't start a chain; extends to GY ignition effects | `DUEL_OCG_OBSOLETE_IGNITION` + `TCG_FAST_EFFECT_IGNITION` — tested PASS |
| 7 | SEGOC (Simultaneous Effects Go On Chain) | 4-step ordering: TP mandatory → NTP mandatory → TP optional → NTP optional; earlier trigger goes on chain first (changed 2017) | `DUEL_TCG_SEGOC_*` flags |
| 8 | 7-timing Damage Step | 7 substeps + strict activation legality (counter traps/negate-activation/mandatory only, ATK/DEF timing limits) | `DUEL_6_STEP_BATLLE_STEP` + `SINGLE_CHAIN_IN_DAMAGE_SUBSTEP` |
| 9 | Trigger Location & Mid-Chain Triggers | Triggers can be recognized mid-chain and activate from outside trigger location (even from Deck) | Engine/script behavior |
| 10 | Life Points Costs | Cannot pay a cost that would drop LP to 0; LP-maintenance cards self-destruct instead | Engine flag / script (memory notes an LP-cost gap todo) |
| 11 | End-of-Turn Discard | Cannot respond to hand-size discard; special chain rules for mandatory triggers off it | Engine/script behavior |
| 12 | Infinite Loops | "Voluntary" loops are illegal to initiate; only "involuntary" (game-mechanic) loops resolve via primary-cause | **Judge/rules-arbitration behavior — not obviously engine-enforced** |
| 13 | 0 ATK Monsters | Two 0-ATK attackers destroy each other; 0-ATK cannot destroy a 0-DEF defender (overturned 2011) | `DUEL_0_ATK_DESTROYED` — tested PASS |

**Naming caveat to flag for the audit (verified):** the engine flag is `DUEL_6_STEP_BATLLE_STEP`, but
edisonformat.com describes a **"7-timing Damage Step" (Substeps 1-7)**. This is a counting/naming
difference, not a behavioral conflict — but auditors and doc-writers should standardize on one
description to avoid confusion. *(verified)*

**Inference (likely):** Rule #12 (infinite loops) is a *player-legality / judge-arbitration* rule
rather than a mechanic the ocgcore engine will spontaneously enforce the Edison way; it's the most
likely rules-level item to need a documented "judge call" carve-out. Worth explicit validation in the
audit.

---

## 2. Coverage — what core rules cover vs. what only card-checking catches

**Conceptual split (verified reasoning from sources):** Yu-Gi-Oh is a rules engine + a library of
card text. The **core rules apply universally to every one of the ~3,681 cards** — phases, priority,
chain-building, SEGOC ordering, the damage step, field-spell handling, LP/cost rules, summoning. If
those are right, then the *scaffolding* of every game situation is right regardless of which cards are
on the table. The **card scripts** supply each card's individual effect text on top of that
scaffolding.

**What the core rules DO cover (the large majority of real-game situations):** turn/phase flow,
who-draws-first, legal summons, when you may respond, how chains build and resolve, damage
calculation, field-spell replacement, cost legality. Because these are universal, getting them right
covers the *structure* of essentially 100% of games. If the core rules are right **and** the card
scripts carry generally-correct modern text, the great majority of interactions resolve correctly —
because most cards' *current* text is identical to their Edison text.

**What core rules DON'T cover — the card-only failure mode (verified):** the residual risk is cards
whose **current/modern text differs from their April-2010 Edison text**. This is invisible to the
rules layer and only catchable by verifying the individual card. The canonical failure mode is a
**modern "once per turn" clause that didn't exist in 2010**. Concrete, sourced examples from
`edisonformat.com/functional-errata.html` *(verified)*:

- **Brionac, Dragon of the Ice Barrier** — Edison text has **no "once per turn"** on its bounce
  Ignition effect; the modern errata added a hard OPT. A modern script silently makes Brionac
  weaker than Edison-legal.
- **Rescue Cat** — Edison version has **no "once per name"** restriction; modern errata is far more
  restrictive.
- **Sangan** — Edison: searches any ≤1500-ATK monster and you may use searched monster's effects;
  modern PSCT/errata narrowed it.
- **Red-Eyes Darkness Metal Dragon** — Edison: **no "once per name"** on either the summon or the
  revival ignition; modern text restricts both.
- **Goyo Guardian** — Edison: **any Tuner** as material; modern official requires an EARTH Tuner.
- Structural (not OPT) rewrites: **Future Fusion**, **Necrovalley**, **Ryko** (optional target,
  sequential resolution), **Rescue Cat**, and archetype-wide behaviors for **Lightsworns**, **Union
  monsters**, **Spirit monsters**.

**Bottom line for Q2 (likely):** the *fraction of situations* governed by core rules is very high (it
underlies every game), but the *fraction of the pool that needs individual card attention* is
**small and enumerable** — essentially the ~36 functional-errata cards plus a handful of rules-driven
card behaviors. Core-rules-correct + scripts-generally-correct + the ~36 deviations fixed ≈ live-judge
parity for the vast majority of play. The uncovered tail is "some individual script carries modern
text that diverges from 2010 and isn't on the known list" — real but bounded (see §3-§4).

---

## 3. Card-level reality / the community bar

**Does anyone do exhaustive per-card behavioral verification of the pool? No. (verified)** Neither the
Edison community nor any simulator claims card-by-card verification of all ~3,681 cards. The community
establishes "Edison accuracy" through **(a) correct core rules, (b) a curated pre-errata set for the
known deviations, and (c) human judges for edge cases** — not through exhaustive per-card testing.

**How each platform establishes/claims Edison accuracy** (source:
`https://edisonformat.net/beginners/simulators`, the community's own comparison table) *(verified)*:

- **DuelingBook** — **Manual** simulator (no automated rules engine). The board is drag-and-drop;
  the *players and human judges* enforce rulings. The table marks it **"Edison Errata: In-Game"** and
  **"Correct Rulings: Has Judges."** This is the community's **gold standard for accuracy** precisely
  *because* a human judge — not code — adjudicates. It proves the accepted definition of "correct
  Edison" is **judge behavior**, not exhaustive card scripting.
- **Dueling Nexus** — Both manual & automatic. Table: **Edison Errata "Partially,"** Correct Rulings
  ❌. Prior memory notes Nexus officially ships Edison as "Master Rule 1 (2008), March 2010 Banlist,
  Pre-Errata cards, retro Card Pool < May 2010" and confirms ignition priority — i.e. an
  ocgcore-family sim running **core-rule flags + a pre-errata curation set**, exactly our approach.
- **YGO Omega** — Both. Table: **Edison Errata "Partially,"** Correct Rulings ❌.
- **EDOPro** — **Automatic** (same ocgcore family we use). Table: **Edison Errata ❌**, Correct Rulings
  ❌, and it needs an **external community banlist** (the diamonddudetcg custom list) for the card pool.
  Its accuracy for Edison comes from selecting MR1/GOAT-style rule flags + curating the pre-errata
  passcodes — again, **flags + known-deviation curation, not per-card auditing.**
- **Master Duel** — no Edison card pool at all.

**The realistic, community-accepted definition of "card-level Edison accuracy" (verified/likely):**
it means **"the ~36 known functional-errata cards use their pre-errata text, and everything else uses
its normal (modern) script, with a human judge available for genuine edge cases."** Even the
"partially" platforms only tackle the *known* deviation set. **No one operationalizes "card-level"
as "every card in the pool independently verified."** That's the key correction to the product
owner's intuition: the game is "built on cards," but the *community's accuracy contract* is built on
**rules + the deviation list + judges**, not on exhaustive per-card proof.

---

## 4. Sizing the options (concrete numbers)

**Option A — Rules-level.** **~13 published format-difference rules**, expanding to roughly **25-40
discrete testable behaviors** once you count the nested sub-rules (Damage Step's 7 substeps, Trap
Monster's ~12 interactions, SEGOC's 4-step ordering, the 1st-turn-draw / field-spell / ignition /
0-ATK / LP-cost / end-phase-discard / infinite-loop cases), **plus** the Master-Rule-1 base rulebook
(turn/phase/summon/chain scaffolding). *(verified count of 13; ~25-40 discrete behaviors is a likely
estimate.)* Prior spikes already have **5 of the core behaviors passing automated Vitest tests** (1st
turn draw, 1 field spell, MZone ignition, GY ignition, 0-ATK battle), with LP-cost flagged as a
documented gap. This option is **fully enumerable and largely already scaffolded.**

**Option B — Card-level "known-deviation" set.** **Confirmed count: 36 entries** on
`edisonformat.com/functional-errata.html` *(verified — full page fetched and counted).* Composition:
**33 individual cards + 3 archetype representatives** (Lumina → all Lightsworns; Machina Gearframe →
all Union monsters; Susa Soldier → all Spirit monsters). Exact membership (verified list):

> Armory Arm, Ancient Fairy Dragon, Black Garden, Brain Control, Brionac, Catapult Turtle,
> Cyber Phoenix, D.D. Survivor, Dark End Dragon, Darkness Approaches, Destiny End Dragoon,
> Elemental HERO Prisma, Fortune Lady Light, Future Fusion, Goyo Guardian, Jade Knight,
> Light and Darkness Dragon, Light End Dragon, Lumina (+ all Lightsworns), Machina Gearframe
> (+ all Union monsters), Mark of the Rose, Mausoleum of the Emperor, My Body as a Shield,
> Necrovalley, Quickdraw Synchron, Red-Eyes Darkness Metal Dragon, Rescue Cat, Ryko, Sangan,
> Soul Exchange, Strike Ninja, Susa Soldier (+ all Spirit monsters), Swap Frog, Treeborn Frog,
> Ultimate Offering, Urgent Tuning.

Prior memory adds important nuance: **~3 of these (Cyber Phoenix, D.D. Survivor, Jade Knight) are
actually damage-step *rulings*, not card errata** (handled by the rules layer), and the community
banlist only wires up **6 real pre-errata substitutes** (Brionac, Sangan, Rescue Cat, Goyo, Brain
Control, Future Fusion); the rest need per-card script authoring/verification. So Option B's real work
is **~30-33 cards to author/verify + confirm the 3 rulings** — a bounded, one-time task.

**Option C — Card-level "commonly-played staples/archetypes."** The competitively-relevant subset —
the cards that actually show up across top Edison decks. Named tier/rogue archetypes across sources
*(verified from ygoprodeck top-10, thegamer, edisonformat.com/decks, and the 2010 SJC Edison meta):*

- **Quickdraw Dandywarrior / Plant** (Jeff Jones won SJC Edison with it), **Blackwings** &
  **Vayu Turbo / VayuSworn**, **Lightsworn** & **Twilight**, **Gladiator Beast** (incl. Prisma/Test
  Tiger variant), **Zombies / Zombiesworn**, **Machina (Gadget)**, **Frog Monarch (Frognarch) / Chaos
  Monarch**, **Six Samurai**, **X-Sabers**, **Diva Hero / Hero Beat**, **Oppression Gadgets**,
  **Infernity** (constrained by the banlist), **Dragon Turbo** (Future Fusion / Five-Headed Dragon).
  The edisonformat.com decks index enumerates ~15-20 archetype tags total (Ancient Gears, Anti-Meta,
  Burn, Fairies, Fish, Flamvell, Psychic, Volcanics, Stun, etc. as rogue).

- **Estimated unique-card size of this subset: ~400-600 cards (inference / uncertain — needs a data
  pull to firm up).** Reasoning: ~50-80 shared spell/trap + generic-monster staples (Heavy Storm,
  MST, Book of Moon, Bottomless, Solemn, Torrential, Dark Hole, Reborn, Pot of Avarice, Trap
  Dustshoot, Caius, Ryko, Sangan, D.D. Crow, Effect Veiler, Gorz, etc.), + ~30-40 shared Extra-Deck
  Synchro/Fusion toolbox, + ~15 archetypes × ~20-30 archetype-specific cards with heavy overlap. That
  lands around **12-16% of the 3,681 pool.** This is the subset that would matter most for real-game
  parity if you wanted a middle tier between B and D. *(This number is my estimate; a decklist-corpus
  scrape from formatlibrary.com / edisonformat.net decks would convert it to a hard count.)*

**Option D — Card-level "exhaustive" (~3,681 cards).** **Not feasible as *interaction* testing, and
the community doesn't attempt it (verified reasoning + numbers).** Single-card "does its own text
resolve" checks over 3,681 cards is large but finite; the infeasible thing is verifying *interactions*:

- Pairwise combinations of the pool = **C(3,681, 2) = 6,773,040 pairs.** *(computed)*
- Three-card combinations = **C(3,681, 3) ≈ 8.31 billion.** *(computed)*
- Real rulings depend on chains of 3+ cards **plus** board state, zones, phase, position, LP, and
  ordering — so the true interaction space is astronomically larger than even the triple count.

That combinatorial blow-up is exactly *why* the community substitutes **(a) trust in the shared
ocgcore/CardScripts codebase** (already exercised across millions of EDOPro/DuelingBook games),
**(b) curation of the known-deviation set (§Option B),** and **(c) human judges for the long tail**
(DuelingBook's model). Exhaustive per-card interaction proof is not the bar anyone holds — and holding
ourselves to it would be an open-ended, never-"done" task.

---

## 5. Bottom-line recommendation input

**What "parity with a live Edison tournament" actually requires (verified/likely synthesis):** at a
live table, correctness = **the judge applies the core rules correctly + knows which specific cards
use pre-errata text + rules on genuine edge cases as they arise.** It does **not** require anyone to
have pre-verified all 3,681 cards. Our app already replaces the judge's *rules knowledge* with engine
flags and the *pre-errata knowledge* with a curated script/passcode set. So parity maps cleanly onto:

**Recommended audit depth — "rules-level (complete) + card-level (bounded to known deviations),
spot-checked against staples":**

1. **Rules-level: audit ALL of it (the 13 published differences → ~25-40 discrete behaviors + the
   MR1 base scaffolding).** This is enumerable, mostly already scaffolded (5 passing tests), and is
   where "playing Edison correctly" is *universally* determined. Explicitly resolve the two soft
   spots: **Rule #10 LP-cost** (documented gap) and **Rule #12 infinite loops** (likely a judge-call
   carve-out, not engine-enforced). Write the user-facing rules doc directly from this — it maps 1:1
   to edisonformat.com's numbered rules, which the group already trusts.

2. **Card-level: audit the 36-entry functional-errata set exhaustively** (author/verify each
   pre-errata script; reclassify the 3 damage-step rulings as rules items; confirm the 6 wired
   substitutes and the ~24 not-yet-wired ones). This is the *entire* card-specific surface the
   community recognizes as "Edison-different," and it's a **bounded one-time task (~30-33 cards).**

3. **Card-level beyond that: DO NOT attempt exhaustive per-card or per-interaction verification.**
   Instead, **spot-verify the competitive staples/archetypes (~400-600 cards, Option C) opportunistically**
   — e.g. a smoke-test of one representative deck per top archetype — and adopt DuelingBook's residual
   model: **document that non-deviation cards run standard community scripts, and keep a "report a
   ruling discrepancy" escape hatch** for the long tail. This matches every real Edison simulator's
   posture and is honest about where the bar sits.

**Why not the product owner's pure card-level instinct:** "the game is built on cards" is true, but
the *accuracy contract the Edison community actually enforces* is **rules + the ~36 known deviations +
judges** — not per-card proof. Going exhaustive (Option D) is combinatorially impossible for
interactions (6.8M pairs / 8.3B triples / larger for real chains) and isn't the standard any platform
meets. Going rules-only would miss the ~36 cards that genuinely play differently. **The combination
above is the rigorous-but-feasible line: it's exactly what a good judge carries in their head, and
it's fully enumerable so the audit has a real definition of "done."**

**Assumptions made (flag if wrong):** (a) "parity with a live tournament" means judge-equivalent
enforcement, not a formal proof of every card; (b) edisonformat.com is the group's binding authority
for both rules and errata (consistent with prior memory); (c) the ~400-600 staple estimate is a
planning figure, not a verified count — convert it via a decklist scrape if Option C's middle tier is
adopted.

---

### Source URLs (record)
- Rule differences (13 rules): https://www.edisonformat.com/edison-rule-differences.html
- Functional errata (36 entries): https://www.edisonformat.com/functional-errata.html
- Rules index / rulebook: https://www.edisonformat.com/rules.html
- Simulator accuracy table: https://edisonformat.net/beginners/simulators
- Top-10 Edison decks: https://ygoprodeck.com/article/edison-format-s-top-10-decks-to-look-out-for-302221
- Best Edison decks: https://www.thegamer.com/yu-gi-oh-tcg-edison-format-best-decks/
- Deck archetype index: https://www.edisonformat.com/decks / https://edisonformat.net/decks
- 2010 SJC Edison meta thread: https://yugipedia.com/wiki/Forum:What_are_the_Top_10_Meta_Decks_of_2010_in_OCG,_TCG,_or_both%3F
- EDOPro custom Edison banlist: https://github.com/diamonddudetcg/edopro-custom-banlists/releases/tag/Edison
