---
linear_project: Duel UI Rebuild
---

# Duel screen — design deliverable (surface inventory · flows · component contract · usability findings · answer-outcome matrix)

**Date:** 2026-08-06 · **Discovery issue:** ZUH-81 · **Revision 4** (adds the card-provenance badge and the deferred-findings register)
**Companions:** `docs/reference/2026-08-05-duel-ui-competitor-teardown.md` (visual baseline) · `docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md` (intent/protocol disagreements and the backend delta)
**Prototype:** branch `proto/duel-ui`, commit `7e71813ff0d681cad5b0d9ad090bcaedb7734283`, code in `spikes/duel-ui-proto/`. A **pointer, not an approval** — it records which prototype this document describes once both have moved on. `proto/*` is structurally unmergeable and disposable; what survives is this document, the fixtures, and the backend deltas.

This is the artifact engineering builds from. Five parts: **surface inventory** · **flows** · **component contract** (§0a and §13a are normative) · **usability findings** with the fixed/deferred triage · **answer-outcome matrix**.

## The two rules this document exists to enforce

**1 · The answer-fidelity invariant (§0a).** The action performed must be the action the confirming control named, and for any decision with more than one legal answer, distinct answers must produce distinct observable outcomes. **Test by enumeration, never by sample.** This is here because the same defect was found and reported fixed three times — tribute selection ignored, decline-equals-confirm, and a chain prompt whose button read `Activate "Book of Moon"` while the engine resolved Solemn Judgment and charged its pay-half-your-LP cost. The single root cause was two continuation mechanisms plus an implicit hardcoded fall-through keyed to the *step*, so it could not vary with the answer; replaced with one `branch(answer) => Step[]` that every path goes through. `answer-matrix.py` on the prototype branch is the reference implementation and exits non-zero on any collision. **Enumeration immediately found a bug sampling would not have:** a single pre-selected candidate deselected on click and dead-ended the step.

**2 · State causes, never generate them (§13a, PRD requirement H).** Where the engine states a cause, the screen may state it. Where it does not, the screen says nothing — a fabricated cause in a rules-enforcing client is a rules claim. Three usability findings are **deferred under this rule with their unblocking capability named**, not rejected: a computed activation cost needs a structured cost on the wire; a generated reason for an absent option needs an omission reason on the wire; the LP-polarity label waits on evidence rather than on a delta.

**What the rule does not forbid — stating facts about our own data.** The images are modern post-errata card faces; our rendered text is the pre-errata 2010 text the engine enforces. 36 cards disagree (`docs/reference/2026-07-13-preerrata-desc-overrides.json`). The **provenance badge** — copy fixed at `Edison text differs from this printing`, one clause, no second clause — appears **wherever a card image and our rendered effect text are shown together**, which today is the inspector alone. Keyed off set membership, so a 37th entry badges itself with no UI change. **No printing visible, no badge:** if art is loading or failed, the badge is suppressed, because it would otherwise assert a difference from something the player cannot see.

## Verified independently by the Product Lead, not accepted on report

Re-driven by hand with real mouse events on the shipped static build: the flagship tribute summon completes with zero console errors and **the chosen tribute is the card that dies**; every visible control returns itself from `document.elementFromPoint`; **four pairwise-distinguishable clock states** and a **timeout forfeit at t+38.3s** naming its cause; **three chain branches producing three distinct rules-correct outcomes** (Book of Moon → no cost, Torrential still resolves · Solemn Judgment → LP 8000→4000, Torrential negated, monsters survive · decline → both traps still set); **art loads with zero broken images and degrades to the exact pre-art layout when the host is blocked**; **badge present on Sangan, absent on Caius, absent when art fails.**

⚠️ **Not assessed and therefore NOT cleared:** damage-number animation, audio, anything below 1440×900, and all timing and motion — the board reflow when the log opens and the beat between attack-confirm and the LP change. Simulated evaluation systematically under-detects these; the CEO is reviewing them directly. ACT-mode card/verb combinations are not enumerated: the prototype scripts one line and refuses the others explicitly by name, which promises nothing and so is outside the §0a defect class.

---


---

# Duel screen — surface inventory

**Issue:** ZUH-81 · **Project:** Duel UI Rebuild · **Scope:** desktop duel screen, human vs human,
Edison, ocgcore. Mobile out of scope (§14 says where the layout gives).

Companion files: `flows.md` (sequencing), `component-contract.md` (what engineering builds),
`usability-findings.md` (the independent pass, and the triage of all 38 findings).

**Revision 2** — amended after the independent usability pass. Changes forced by a **design**
defect are tagged with the finding id.

---

## 0 · The two laws everything else obeys

**Law 1 — ACT and ANSWER are different objects in different places, never both live.**

| | ACT (default) | ANSWER |
|---|---|---|
| Who started it | the player | the engine |
| The object | **Verb Chips** — a chip cluster anchored *at the card you clicked* | **Question Bar** — one bar docked *bottom-centre* |
| Board | fully live, undimmed | dimmed, except candidates/targets |
| Cost to leave | zero (`Esc` / click-away) | an answer (confirm **or** decline) — never a dismissal |
| How many can exist | one cluster at a time | **exactly one bar, ever** |

There is no third question **surface**. If the engine has queued several decisions they occupy the
one bar in sequence. This is the single rule whose violation produced `edopro-hi-04.jpg`
(three overlapping dialogs, a prompt sentence floating unattached, nothing showing which is live).

**There is, however, a third OBJECT, and revision 1 was missing it.**  [B1][M2] A decision the
client answers on the player's behalf is neither acting nor being asked — it is being *told*. It
gets an **Auto-answer receipt**: read-only, past tense, no primary button, auto-dismissing. See §4b.
Revision 1 said auto-answering "is not auto-hide" but never said what the player sees, so the
prototype rendered an answered decision as a live question with an enabled button that could not
work. **A question the player cannot answer is worse than no question.**

⚠ **`Esc` NEVER commits anything, anywhere.**  [B2] This was a blocker: `Esc` cancelled correctly on
the verb cluster and then *committed* the irreversible tribute step, destroying a card the player
never chose. The full keyboard contract is normative in `component-contract.md` §2.

**Law 2 — the dim law.** When the Question Bar is up, *everything dims to 45% except*:
(a) the Question Bar itself, (b) any card anywhere on screen — hand, field, GY badge, banished
badge, deck badge — that is a **candidate or target** of the pending decision, (c) the chain strip,
(d) the clock. Nothing else. A target set spanning hand + graveyard + field is therefore legible
in one glance without opening a single inspector.

**Ownership colour law (applies to every surface below, no exceptions):**
`--own` **blue** = yours · `--opp` **red** = theirs. Board outlines, log name tints, location
badges, chain-link ordinals, LP plates. Confirm/decline are expressed by **emphasis and position**
(filled vs outlined, right vs left), *never* by green/red — red is spoken for.

---

## 1 · Layout — what is always on screen

Reference viewport **1440 × 900**. Minimum supported **1280 × 800**.

```
┌──────────────────────────────────────────────────────────────────────────────┬─────────┐
│ ⟵ Exit   ● Sakura            TURN 4 · THEIRS          [Chain: Auto ▾] [⚙] [☰ Log]      │ 40px
├──────────────────────────────────────────────────────────────────────────────┤         │
│                                    ▓▓▓▓▓▓  ×6  (opponent hand, backs)        │  LOG    │
│                                                        ┌───────────────────┐ │  RAIL   │
│   ┌─────── OPPONENT FIELD — red outline ─────────────┐  │ Sakura   LP 6200 │ │ (320px, │
│   │ [BAN 1][GY 3][FZ ·] │S│S│S│S│S│ [EX 15][DECK 32] │  └───────────────────┘ │ collapsed│
│   │                     │M│M│M│M│M│                  │                        │ by      │
│   └───────────────────────────────────────────────────┘                       │ default)│
│                                                                               │         │
│ ⏱4:12 ══ DP · SP · ▮M1▮ · BP · M2 · EP ═════════════════════════ [ End Turn ] │         │
│                                                                               │         │
│   ┌─────── YOUR FIELD — blue outline ────────────────┐                        │         │
│   │                     │M│M│M│M│M│                  │                        │         │
│   │ [DECK 30][EX 14]    │S│S│S│S│S│ [FZ ·][GY 2][BAN 0]                       │         │
│   └───────────────────────────────────────────────────┘                       │         │
│  ┌──────────────┐                                                             │         │
│  │ You  LP 8000 │        ⛓ CL1 ◆ Torrential Tribute   (chain strip)          │         │
│  └──────────────┘   ┌───────────────────────────────────────────┐             │         │
│                     │            QUESTION BAR                   │             │         │
│                     └───────────────────────────────────────────┘             │         │
│                       🂠 🂠 🂠 🂠 🂠   ×5  (your hand, face-up)                 │         │
└───────────────────────────────────────────────────────────────────────────────┴─────────┘
```

**Always present, never behind a click:**

| Element | Where | Why it is permanent |
|---|---|---|
| Your LP + name | bottom-left plate | position encodes ownership; no label needed |
| Opponent LP + name | top-right plate | mirror of yours (Master Duel polarity) |
| Your hand | bottom centre, face-up, fanned | it is the answer space for half of all decisions |
| Opponent hand | top centre, card backs **+ numeral count** | "count by eye" is a defect; the numeral is the fix |
| Both monster rows (5) | centre | — |
| Both spell/trap rows (5) | centre | — |
| Both field zones (1 each) | inboard of the pile cluster | Necrovalley is a real Edison deck |
| Deck / Extra / GY / Banished, both sides | fixed labelled slots with **large counts** | every location has permanent real estate; only *contents* are on demand |
| Phase rail (DP SP M1 BP M2 EP) | centre strip between the fields | it is *both* the phase display and the phase-advance control, so no separate "next phase" button exists |
| End Turn | right end of the phase rail | must never live inside a decision panel that can vanish |
| Turn number + turn owner | top bar, tinted | — |
| Clock | left end of the phase rail, mid-edge | see §7 |
| Presence dot | top bar next to opponent name | distinguishes *thinking* from *disconnected* |
| Verbosity chip | top bar, **state legible as text** | table stakes; all three automatic clients ship one |

**Deleted deliberately:** Extra Monster Zones, Pendulum Zones, Link markers. Edison has none.
The freed vertical space pays for the phase rail and the chain strip.

**On demand only:** pile contents, card inspector, verb chips, the Question Bar, the log rail,
settings.

---

## 2 · Surface: Board / Field

**Job:** tell the player the whole game state at a glance, and be the thing they act on.

**Contents.** Two mirrored field groups. Each card slot renders: art (or back), a
position glyph (↑ attack / → defence / ⌄ face-down), ATK/DEF as plain numerals under face-up
monsters, and an owner-tinted outline. **Your own set cards render translucent to you** and opaque
to the opponent. **Opponent face-up monsters render face-up** (this is build item §4 of the brief —
`DuelBoard.tsx:48`'s `if (hidden || !isOwn)` is being deleted; the design assumes it is gone).

**Entry:** always on screen. **Exit:** none — it is the screen.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| loading | before first `STATE` | field skeleton at 30% opacity, "Dealing…" on the phase rail | nothing; Exit works |
| empty zone | zone has no card | dashed owner-tinted slot outline, no glyph | nothing (ACT) / drop target (during zone choice) |
| empty pile | count 0 | slot rendered flat with `0`, not hidden | click still opens inspector, which shows the empty state |
| default | on-clock, ACT | full colour, your field outlined blue | click any card → verb chips |
| dimmed | Question Bar up | 45%, except candidates/targets | click a highlighted card → answers the pending question |
| targeted | card is a candidate | owner-coloured 3px outline + pulsing location badge | click to select |
| already-attacked | monster absent from `attacks[]` this Battle Phase | ⚔ glyph greyed on the card corner | nothing — this is state, not a control |
| off-clock | opponent on clock | your field outline desaturates; phase rail tinted red | inspect anything; nothing else |
| stale / partial | `STATE` arrived, `DECISION` has not | board is current; the ribbon reads "…" spinner inline | wait; Exit works |
| error | malformed snapshot | board frozen at last good state + top-bar error strip | Exit / Reconnect |
| disconnected | socket closed | board frozen at 60% + amber "Reconnecting…" strip pinned under the top bar | nothing but Exit |
| duel-ended | `DUEL_END` | board frozen at full colour behind the end overlay | dismiss overlay to inspect the final board, then Exit |

**Deliberate:** the board is *never* replaced by a spinner after the first snapshot. A frozen board
with a banner tells you more than a spinner does.

---

## 3 · Surface: Verb Chips (ACT mode)

**Job:** let the player form an intent and fire it in two clicks, seeing only legal verbs.

**Contents.** A compact horizontal chip cluster anchored to the clicked card (above it if there is
room, below if not). Each chip = one verb ocgcore says is legal, in a **stable fixed order** so
muscle memory forms:

`Summon · Set · Tribute Summon · Special Summon · Activate · Change Position · Attack · Inspect`

Chips absent from the legal set are **not rendered** (not greyed). Chips that cost something carry
the cost inline — `Tribute Summon (2)` — because `release_param` is on the wire and the player
must not learn the cost *after* committing.

**Entry:** click / `Enter` on any card you control, in ACT mode, while an `IdleCommand` or
`BattleCommand` is pending for you.
**Exit:** pick a chip (→ intent begins) · `Esc` · click away · the engine emits a decision
(→ ANSWER mode takes over and the cluster is dismissed with no cost).

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | legal verbs exist | 1–5 chips, first focused | click / arrow-keys + `Enter` |
| empty | card is yours but affords nothing right now | **no cluster; a 200ms "no verbs" shake on the card** | nothing — cheaper than a menu of greys |
| loading | n/a — derived from the decision already in hand | — | — |
| error | n/a | — | — |
| disabled | off-clock, or Question Bar up | cluster does not open; click opens the **inspector** instead | inspect |

**Note.** Clicking an *opponent* card, or a pile, never opens verb chips — it opens the inspector.
Inspection is free, instant, silent, and never broadcast.

---

## 4 · Surface: Question Bar (ANSWER mode) — one renderer, all 20 variants

> ⚠ The brief says 19 `DuelDecision` variants. **The code has 20** —
> `packages/contracts/src/duelDecision.ts:309-330` and `docs/adr/0001…:39` ("with 20 variants").
> Design is built for 20. Nothing about the design changes; flagged because the brief and the
> code disagree and the code wins.

**Job:** answer the engine's question without the player having to work out what is being asked.

**Anatomy** — three lines, identical for every variant:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⏱▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ 3:41  (clock hairline) │
│                                                                            │
│ 1 │ Sakura activated "Torrential Tribute" (Spell/Trap Zone).               │
│   │ Chain a card or effect?                                                │
│   │   ^card name tinted red    ^verb tinted     ^location inline           │
│                                                                            │
│ 2 │   ┌──────┐   ┌──────┐   ┌──────┐                                       │
│   │   │ art  │   │ art  │   │ art  │      ← candidates as thumbnails       │
│   │   │ 🖐   │   │ ⚰    │   │ 🃏   │      ← each badged with its LOCATION  │
│   │   └──────┘   └──────┘   └──────┘         badge tinted by owner         │
│   │    Solemn     Bottomless   Book                                        │
│                                                                            │
│ 3 │  [  No response  ]                        [ ▶ Activate Effect ]        │
│   │   ^equal visual weight, left                ^filled, right, default    │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Line 1 is always a sentence naming a card.** Where the engine gives no usable description
  (`SELECT_EFFECTYN` with `description: "0n"`, or a raw system-string integer — see the
  intent-model doc §6), the client substitutes **card name + the card's own effect text** resolved
  from `/api/cards?passcodes=`. It **never** renders a bare "Yes or No?" and never a raw integer.
  This is not a teaching layer: it is the card's own printed text, which is on the table in paper.
- **Location goes inline in parentheses** when the same card is activatable from more than one
  place (Nexus's idiom) *and* on the thumbnail badge always.
- **Line 3 always has two verbs.** Decline is a first-class answer with equal weight, positioned
  left. Never an ✕. Never a dismissal. For a decision with `cancelable === false` and no legal
  decline, the left slot renders the **commit statement** instead of a button (§6).

**Variant → line-1 sentence / line-2 answer space** (all 20):

| Variant | Line 1 sentence pattern | Line 2 answer space |
|---|---|---|
| `IdleCommand` | *(never shown as a bar — see note)* | — |
| `BattleCommand` | *(never shown as a bar — see note)* | — |
| `ChainPrompt` | `{Owner} activated "{card}" ({loc}). Chain a card or effect?` | candidate thumbnails, location-badged |
| `SelectEffectYN` | `Activate "{card}" ({loc})?` + card text | none (verbs only) |
| `SelectYesNo` | `{description}` — or card name + text if empty | none |
| `SelectOption` | `"{card}" — choose an effect:` | option rows, radio-selected |
| `SelectCard` | `{caption} — choose {min}–{max}:` | candidate thumbnails **+ board highlight** |
| `SelectTribute` | `Tribute {min}–{max} monsters for "{card}":` | thumbnails + board highlight + running count |
| `SelectZone` | `Place "{card}".` | **the board itself** — legal zones glow, click one |
| `SelectPosition` | `Summon "{card}" in which position?` | 2–4 position tiles (↑ATK / →DEF / ⌄Set) |
| `SelectUnselectCard` | `Select materials for "{card}" — Level {n}/{needed}:` | thumbnails, multi-select, running total |
| `AnnounceRace` | `Declare {count} Type:` | type grid |
| `AnnounceAttrib` | `Declare {count} Attribute:` | attribute grid |
| `AnnounceCard` | `Declare a card name:` | search field + result thumbnails |
| `AnnounceNumber` | `Declare a number:` | number chips |
| `SortChain` | `Order these chain links:` | drag-reorder strip |
| `SortCard` | `Order these cards:` | drag-reorder strip |
| `SelectCounter` | `Remove {count} {counter} counters:` | thumbnails + steppers |
| `SelectSum` | `Select cards totalling {amount}:` | thumbnails + running sum |
| `SelectDisfield` | `Choose a zone to disable:` | board zone highlight |

The last five have **no known Edison trigger** (ADR variant table). They get the same bar with a
generic answer space — they must never throw, and they must never get a bespoke surface.

**`IdleCommand` and `BattleCommand` are deliberately NOT rendered as a Question Bar.** They are not
questions — they are "the board is yours". Rendering them as a bar is precisely the reactive
pathology we are removing. Instead they **arm ACT mode**: their `summons[]`, `activates[]`,
`attacks[]` etc. become the legal-verb source for the verb chips, and `toBattlePhase`/`toEndPhase`
light the phase rail. The player never sees a panel; they see a live board. *This is the single
biggest structural change in the design.*

**Entry:** a `DECISION` frame arrives for your seat and is not auto-resolved (§9).
**Exit:** confirm · decline · timeout (→ forfeit) · duel ends.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | decision pending | full bar, confirm focused | answer |
| loading | answer sent, next frame not yet in | bar collapses to a 3px progress hairline in place, board un-dims, **intent ribbon stays** | wait (~1 frame); nothing flashes |
| empty | a variant arrives with zero candidates | cannot happen for `ChainPrompt` (engine auto-passes); for others, bar shows the sentence and only the decline verb | decline |
| partial | multi-select below `min` | confirm disabled + `2 of 3 selected` under the verbs | keep selecting |
| error | response rejected by server | bar re-renders unchanged with a one-line amber strip: `Not accepted — try again` | re-answer |
| disabled | duel ended mid-question | bar greys, verbs inert | dismiss to end overlay |
| non-cancelable | `cancelable === false` | left slot is the **commit statement**, not a button | confirm only |

---

## 4b · Surface: Auto-answer receipt  [B1][M2]

**Job:** tell the player that a decision with exactly one legal answer was answered for them,
without asking them anything.

**Contents.** One slim row above the intent ribbon: a `ANSWERED FOR YOU` tag, a past-tense
sentence naming the answer (`Zone — the freed monster zone`), and, where a preference governs it,
a single `Ask me next time` link that flips that preference.

**It is not a Question Bar, and it must not be built as one.** No primary button, no imperative
copy, no confirm. It auto-dismisses; the player never has to clear it.

**Entry:** the client answers a decision per the §15 register. **Exit:** auto, after ~240ms
(or ~2s when a reviewer has asked to see auto-answers).

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | client auto-answered | the receipt row | click `Ask me next time` |
| loading | N/A — the answer is already sent | — | — |
| empty | nothing auto-answered | absent | — |
| error | server rejected the auto-answer | receipt replaced by the real Question Bar for that decision | answer it |
| waiting-on-opponent | irrelevant — receipts are for your own decisions | — | — |
| disconnected | reconnect discards it; the re-sent `DECISION` decides afresh | — | — |
| duel-ended | absent | — | — |

## 5 · Surface: Intent Ribbon

**Job:** make a 2–6 decision engine sequence feel like **one action the player started**, and say
where the point of no return is.

This surface does not correspond to any engine message. It is client-side memory, and it is the
answer to "the panel is remounted from scratch at every step" (intent-model R1.1) and to the CEO's
"if one clock now covers a six-decision summon, the UI has to be honest about where the point of
no return is."

**Contents.** A single slim strip that sits *immediately above* the Question Bar and **persists
across every sub-decision of one intent**, including across the `STATE`-then-`DECISION` gap that
currently blanks the panel.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚔ Tribute Summoning "Caius the Shadow Monarch"                             │
│    ●━━━━━━━━━━●━━━━━━━━━━🔒━━━━━━━━━━○      [ Cancel summon ]              │
│    Tributes   ✓done      Zone        Position                              │
│                          ↑ committed here                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

- The **🔒 marker sits on the first non-cancelable step** of the sequence. Before it, `Cancel
  summon` is a live button and maps to the current decision's cancel response (`indices: null` /
  `index: null`). At and after it, the button is replaced by the flat text **`Committed`**.
- The confirm button of the **last cancelable step** carries the lock inline:
  `Tribute 2 & commit 🔒`. The player is told the price of the click *on the click*.
- Steps are drawn from the client's own intent template, not from the engine — the engine does not
  announce how many decisions are coming. Where the template is uncertain (a trigger may or may not
  fire), the trailing step renders as `…` rather than a fake step count.

**Entry:** the player picks a verb chip, or answers an `IdleCommand`/`BattleCommand`.
**Exit:** the intent's last decision is answered · the player cancels · timeout · duel ends.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | intent in flight | ribbon with step dots, current dot pulsing | cancel (if before 🔒) |
| loading | between decisions | same ribbon, current dot animates — **nothing unmounts** | wait |
| empty | no intent in flight | ribbon absent (not an empty box) | — |
| committed | past the 🔒 | `Cancel summon` → `Committed`, lock glyph solid | answer only |
| error | server rejects a sub-answer | ribbon gains an amber underline + `Not accepted` | re-answer that step |
| aborted | player cancelled | ribbon fades with a 400ms `Cancelled` label, board returns to ACT | act again |
| disabled | duel ended mid-intent | ribbon greys out | — |

---

## 6 · Surface: Chain Strip

**Job:** show, unprompted and persistently, what is on the chain and what is resolving.

**Contents.** A horizontal ordered strip docked bottom-centre, above the intent ribbon.
Per link: **ordinal · 24px card thumbnail · card name · owner colour**. The **resolving link** is
outlined and its **full card text is auto-pushed into the inspector** with no click.

```
⛓  ①[art] Torrential Tribute   ②[art] Solemn Judgment   ▶③[art] My Body as a Shield
   red                          blue                      blue · RESOLVING
```

- Resolution runs **right-to-left** and the strip animates each link out as it resolves, so the
  player watches the stack unwind. This is the only animation in the design that carries meaning.
- **Past ~4 links** (flagged as unknown in the teardown): the strip **compresses** — links
  collapse to ordinal + owner-coloured dot from link 5 onward, expanding on hover. It never
  scrolls horizontally and never wraps; a chain of 12 must still fit in one 720px strip.

**Entry:** first `MSG_CHAINING`. **Exit:** `MSG_CHAIN_END` + 600ms.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | chain length ≥ 1 | ordered links | hover a link → inspector |
| empty | no chain | strip absent | — |
| loading | link declared, card identity not yet resolved from `/api/cards` | ordinal + grey placeholder tile + card name from the decision | hover |
| compressed | ≥ 5 links | links 1–4 full, 5+ as dots | hover to expand |
| resolving | `CHAIN_SOLVING` | the resolving link outlined, text auto-pushed | read |
| error | a link references an unknown code | tile shows `?` and the passcode | hover |
| disabled | duel ended | strip fades | — |

---

## 7 · Surface: Clocks (plural)  [M8][M9][B5]

**Job:** answer "how long do I have?" at any instant — including while it is not my turn.

**The rule (CEO):** the clock starts when you become on-clock and **does not reset until you hand
control away**. Not per turn, not per decision. **A timeout forfeits the duel.**

⚠ **Revision 1 specified ONE clock, owner-tinted, and that was wrong.** The pass found that
ownership was carried by colour alone with no label, and that while off-clock the only clock on
screen was the *opponent's* — so the player could not see their own banked time at exactly the
moment they were deciding whether to spend it. With a per-handover clock, banked time is a resource
carried across the opponent's whole turn; hiding it makes the resource invisible.

**Both clocks are always on screen, at the left end of the phase rail, each labelled:**

```
┌──────────────────────────────┐
│ You      0:34   RUNNING      │  ← double border = the clock that is counting
├──────────────────────────────┤
│ Sakura   4:23   BANKED       │
└──────────────────────────────┘
  TIMEOUT FORFEITS THE DUEL       ← appears at ≤60s, on YOUR clock only
```

Owner is text. Running/banked is text. Colour is redundant reinforcement, never the only channel.

**Plus one in-fovea rendering:** a labelled track across the top of the Question Bar reading
`YOUR TURN CLOCK m:ss`. [M9] Revision 1 left it unlabelled, and its position made it read as a
per-question timer — a player would mis-scale their thinking time from it. Label it or remove it.

**Escalation — YOUR clock only.** The opponent running out is not your emergency.

| Remaining | Treatment |
|---|---|
| > 60s | 14px numeral, ordinary row |
| ≤ 60s | 17px numeral, amber border, standing line `timeout forfeits the duel` |
| ≤ 30s | 20px numeral, amber-tinted row |
| ≤ 10s | filled amber alarm plate, 22px numeral, board-edge pulse, `{n}s — TIMEOUT FORFEITS THE DUEL` |
| 0 | terminal result card. **Never a screen that sits at `0:00`.** [B5] |

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | both known, > 60s | two labelled rows, active one outlined | — |
| warning / high / alarm | thresholds above, yours | per the table | hurry |
| loading | no `CLOCK` frame yet | `—:—`, never `0:00` | — |
| empty | N/A — a duel always has two clocks | — | — |
| error / disconnected | socket dropped | both rows grey with `?` and stop; the reconnect banner owns the truth | reconnect |
| waiting-on-opponent | their clock running | their row outlined and counting, **yours still visible and labelled BANKED** | inspect anything |
| expired (yours) | 0 | duel-end overlay, `Your move timer ran out — the duel is forfeit.` | leave / review |
| expired (theirs) | 0 | duel-end overlay, you win on time | leave / review |
| duel-ended | `DUEL_END` | both rows frozen at their final values | read |

## 8 · Surface: Card Inspector

**Job:** answer "what does this card do" in zero clicks when it matters, and one click
otherwise.

**Contents.** A 254px floating panel over the **left** edge of the board (never reflows the
board):

1. **the real card image** — the full card face, served from `VITE_IMAGE_BASE_URL`
   (`https://api.zuhayr.io/images/<passcode>.jpg`), 813 × 1185, public static files, **no
   backend work**;
2. a **provenance badge**, on the 36 cards whose Edison text differs from the printing shown in
   the image (see below);
3. the **rendered** name, type line, ATK/DEF/Level/Attribute, full effect text, and — for a card
   on the field — its position and whether it has attacked.

**Both, not one.** The image contains the card's own text, so the obvious economy is to drop the
rendered text. Do not. At panel width the printed text is unreadable; it is also unselectable,
unsearchable and invisible to a screen reader, and it is a JPEG of an errata-era card rather than
our own pre-errata corpus. **The image is for recognition, the rendered text is for reading**,
which is what Master Duel does and why its inspector carries both. The image is marked
`alt=""` and `aria-hidden` precisely because it duplicates text already on the page.

**Three entry points, in priority order:**
1. **Auto-push (no click):** the opponent activates a card → its text appears here immediately;
   a chain link starts resolving → that link's text appears here.
2. **Hover** any card anywhere (150ms delay).
3. **Click** an opponent card, or any card while the Question Bar is up.

**Exit:** `Esc`, mouse-out (if hover-entered), or the next auto-push replaces it.

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | a card is inspected, art loaded | full card image, then the rendered record | scroll long text; `Esc` |
| **provenance** | the card is in the override corpus **and** art is loaded | a one-clause badge between the image and the name | read the text below it |
| provenance, art absent | overridden card but art `loading`/`failed` | **no badge** — nothing on screen to differ from | read the record, unchanged |
| **art loading** | image request in flight | a placeholder **holding the exact 813:1185 aspect ratio** with a slow shimmer; **all the text is already rendered and readable underneath** | read, scroll, `Esc` — nothing waits on the image |
| **art failed / offline / unknown passcode** | `onError`, or no load within 5s | **no image, no placeholder, no broken-image icon** — the panel collapses to exactly the layout it had before art existed | everything, unchanged |
| loading (record) | `/api/cards` in flight | art placeholder + name from the decision + shimmer on the text block | wait / `Esc` |
| empty | nothing inspected | **panel absent**, not an empty frame | — |
| unknown card | passcode not in the card DB | no art, `Unknown card ({code})`, no text | `Esc` |
| hidden card | `code === 0` | no art (there is none we are entitled to), `Face-down card` + its location | `Esc` |
| error | `/api/cards` failed | name + `Card text unavailable — retry` link | retry / `Esc` |
| pinned | player clicked rather than hovered | thin blue rule on the panel edge; auto-push **queues** behind it with a `1 new` chip | unpin (`Esc`) |

**The provenance badge.** The image is the modern printing; our text is the 2010 text the engine
enforces. For **36 cards** — the corpus in `packages/card-data/src/preErrataDescOverrides.json` —
those disagree, and this panel shows both at once. Sangan is one of them and it is on the board in
the flagship flow, so the contradiction is visible on the first thing anyone clicks.

The badge sits **directly under the image, above the name** — at the seam between the two things
it reconciles, so the eye path is image → badge → text. It reads:

> `Edison text differs from this printing`

One clause, caption weight, and that is the entire copy. It states a fact about our data and stops:
no description of the difference, no reason, no year, no consequence. The correct text is the very
next thing on the page. **It is gated on the image having loaded** — with no printing on screen
there is nothing to differ from, so a badge would be a statement about something invisible.

It appears **only where a card image and our rendered effect text are shown together**, which today
means this panel alone. Not on thumbnails or board tiles (art but no effect text), and not in the
Question Bar's text panes (effect text but no art).

⚠ **The art states are the panel's first network dependency, and the failure state is the one that
matters.** It must fail *into the current design*, not into a hole: a card whose art will not load
is still completely usable, because everything that was there before is still there. The load
deadline exists so a request that never resolves cannot leave a permanent grey rectangle where a
card should be — an unbounded placeholder is the hole, not the fix.

**A slow image blocks nothing.** The board, the clocks, the phase rail and the panel's own text all
render while images are still in flight; verified with the host throttled and with it removed.

## 9 · Surface: Pile Inspector

**Job:** let the player read GY / Banished / Deck / Extra Deck — **free, instant, silent, never
broadcast to the opponent.** DuelingBook broadcasts `Viewing Deck`; the community pays for
extensions to stop it. We are automatic; there is no integrity argument. This is a day-one win.

**Contents.** A grid overlay of the pile's contents **as card images** (own GY/banished/extra:
face-up; own deck: count only, cards not revealed; opponent GY/banished: face-up; opponent
deck/extra: count only, plus whatever `isPublic` permits). Header: `Your Graveyard — 7 cards`.
A filter row (Monster/Spell/Trap) appears at ≥ 12 cards.

**Art belongs here.** The job of this surface is scanning a pile for a card you remember by its
picture; a grid of name-labels makes you read twenty strings instead of recognising one image.
Tiles lazy-load and degrade to the labelled tile individually, so one missing image costs one
tile, not the grid.

**Entry:** click any pile badge, in any mode. **Exit:** `Esc`, click-away, or picking a card if
the pile was opened *as the answer space* of a pending decision.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | pile has cards | grid, newest first | hover → inspector; `Esc` |
| empty | count 0 | `Graveyard is empty` centred, panel still opens | `Esc` — the click was not swallowed |
| hidden pile | opponent deck / extra | `32 cards` + a stack graphic, no contents | `Esc` |
| loading | card records in flight | placeholder tiles, count already correct | `Esc` |
| answer-space | opened because a `SelectCard` candidate lives there | candidate cards outlined and clickable; non-candidates dimmed | pick / `Esc` back to the bar |
| error | records failed | tiles show passcodes | `Esc` |
| disabled | never | inspection is always permitted, including off-clock and after the duel ends | — |

---

## 10 · Surface: Event Log Rail

**Job:** "what just happened" — game state, not teaching. *That is the line.*

**Contents.** One right rail, **320px, collapsed by default**, preference remembered.
Master Duel's structure over DuelingBook's completeness: **every** engine event is logged; the
rendering is structural, never prose.

```
┌────────────────────────────────┐
│ [🔍 search      ] [filter ▾] ✕ │
├────────────────────────────────┤
│ ▌ TURN 4 — Sakura              │  ← banner tinted by turn owner (red)
│   You 8000    Sakura 6200      │  ← LP snapshot at the turn boundary
│ ── Draw Phase ─────────────────│  ← phase header, section bar
│  [▪] Sakura   Draw             │
│ ── Main Phase 1 ───────────────│
│  [▪] Caius…   Summon  🖐 → ⬛  │  ← thumbnail · name · verb · from→to arrow
│  [▪] Torrent… Activate ⬛ → ⛓  │
│  [▪] Caius…   Destroyed ⬛ → ⚰ │
│ ── Battle Phase ───────────────│
│  [▪] Gorz     Attack   ⚔ 2700  │
└────────────────────────────────┘
```

- **No prose sentences.** `[thumb] Caius the Shadow Monarch · Summon · 🖐 → ⬛` — never
  "Bob summoned Caius". Names tinted by owner.
- LP snapshot row under every turn banner. Removes mental arithmetic.
- Filter chips: `Summons · Activations · Battle · Movement · Phases · Draws`. Search matches card
  names.
- The rail **overlays the board; it never reflows it.** [m13] Expanding it must not move a single
  card, because cards moving under the cursor mid-duel is its own defect. Collapsed it is a 34px
  spine with an unread-count dot, and that 34px is the only width the board ever gives up.
- **One entry point**, labelled, carrying its `L` shortcut. [m11]

**Entry:** `☰ Log` in the top bar, or `L`. **Exit:** `✕`, `Esc`, or `L`.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| collapsed (default) | first load | 32px spine, unread dot | expand |
| default | expanded, events exist | grouped rows, auto-scrolled to newest | scroll, search, filter, click a row → inspector |
| empty, turn 1 | duel just started | `The duel has not started.` | — |
| empty, turn > 1 | joined or reconnected mid-duel | `Earlier turns are not available.` [M12] — **never** "the duel has not started" while the board shows turn 8 | — |
| empty-after-filter | filter excludes everything | `No {filter} events this duel.` + `Clear filter` | clear |
| loading | reconnect, backfill in flight | skeleton rows + `Restoring log…` | wait |
| partial | reconnected and the pre-disconnect log is not persisted (`NH-2`) | a dashed rule reading `— log resumes here —` above the first post-reconnect row | scroll |
| error | event stream malformed | affected row renders `Unrecognised event ({type})`, the rail keeps going | — |
| duel-ended | `DUEL_END` | final row `Duel ended — {reason}`, rail auto-expands | search / export-free reading |

**Partial is the important one.** Today, reconnect delivers an empty log (`duelSocket.ts:311-349`).
Rendering that as "nothing happened" would be a lie; the dashed `log resumes here` rule is the
honest surface, and it costs nothing.

---

## 11 · Surface: Duel chrome — top bar, verbosity chip, settings, presence

**Job:** carry the controls that must never be inside a panel that can vanish.

**Response-prompt control** [M10] — a labelled menu, **not** a three-state cycler. Revision 1's
cycling chip never explained its states, hid the option set until you clicked through it, and could
not be stepped back. And `OFF` read as "never prompt me", which sounds like it could silently lose a
duel.

`Response prompts: [Minimal] [Standard ✓] [Every window]`, each with a one-line description, and a
**standing note in the same view**: *"Mandatory effects are always offered, whatever this is set to
— this cannot make you miss a forced response."* Default **Standard**, matching all three reference
clients. The three states are Master Duel's documented `OFF / Auto / ON`; only the labels change.
- `Minimal` — mandatory and certain trigger effects only;
- `Standard` — additionally on a summon, attack declaration, spell/trap activation, effect
  activation, and before the opponent ends their turn;
- `Every window` — additionally every phase change, each Battle Phase step, after each effect
  resolves, and minor actions.

A held-key modifier is nice-to-have. **Do not advertise it until it is bound** — revision 1's
tooltip promised `hold A to widen, D to narrow` and nothing happened. [m12]

**Settings popover** (⚙): `Response prompts` (the three states), `Choose zones` (off by default —
CEO call), `Self chain`, `Activation order`, `Reduce motion`. Four toggles and a radio; not a page.

**Presence dot:** green = connected · amber = degraded · grey = disconnected, with a text label,
never colour alone.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | connected | `● Sakura` green + name | — |
| loading | pre-`SEAT_ASSIGNED` | `○ Connecting…` | Exit |
| opponent-away | no heartbeat > 10s | `◌ Sakura — connection lost` amber, **and their clock keeps running** | wait |
| error | our socket errored | red strip under the top bar with the message + `Retry` | retry / Exit |
| disabled | duel ended | verbosity chip and settings inert; Exit and Log live | read / leave |

---

## 12 · Surface: Waiting on the opponent

Not a panel — a **mode of the whole screen**, because the off-clock player is served worst today
(`ActionPanel.tsx:47-57` renders "Waiting for engine…" for every one of those states).

Three states that currently render identically and **must not**:

| Player-visible state | Rendering | Source of truth |
|---|---|---|
| **Opponent is thinking** | phase rail tinted red, their clock counting down, `Sakura is deciding` on the ribbon line, board fully readable and inspectable | `CLOCK.onClockSeat !== mySeat` + presence OK |
| **Engine is busy** | a 3px indeterminate hairline on the phase rail only, ≤ 400ms; if it exceeds 2s it becomes `Engine is resolving…` | on-clock seat is me but no `DECISION` yet |
| **My connection dropped** | amber banner `Reconnecting… attempt 2`, board frozen at 60%, clock greys with `?` | socket state |

While waiting, the log rail **narrates events as they arrive**, the inspector **auto-pushes**
opponent activations, and the chain strip builds. The waiting player is never looking at a spinner.

---

## 13 · Surface: Duel-end overlay · Resign confirm · Error strip

**Duel end.** A centred card over a frozen, still-inspectable board:
result (`You win` / `You lose` / `Draw`), reason (`Sakura's LP reached 0` / `Your move timer ran
out` / `Sakura resigned`), final LP for both, and three actions: `Review board` (dismisses the card,
leaves the board and log readable), `Open log`, `Back to Home`.

Reasons map to `DuelEndReason = "normal" | "timeout" | "resign"`.

| State | Trigger | What the player sees | What they can do |
|---|---|---|---|
| default | `DUEL_END` | result card | review / log / home |
| timeout | `reason: "timeout"` | `Your move timer ran out — the duel is forfeit.` | as above |
| loading | never — `DUEL_END` is terminal | — | — |
| empty | never | — | — |
| error | `DUEL_END` with an unknown reason | `The duel ended.` + reason string verbatim | as above |
| dismissed | `Review board` | frozen board, a persistent `Duel ended` pill top-centre with `Result` to reopen | reopen / home |

**Resign** is a two-step confirm in the settings popover, never a bare button on the board — a
misclick that forfeits is not acceptable when the board is now fully clickable.

**Error strip** — one line under the top bar, amber, dismissible, never a modal. Modals are for
things the player must act on; a transport error is not one.

---

## 14 · Where this layout gives, for a later mobile adaptation

Mobile is out of scope. It is not painted into a corner, because every surface below is already
either bottom-docked or collapsible:

- **Survives unchanged:** Question Bar (already bottom-centre, already ≤ 720px), intent ribbon,
  chain strip, verbosity chip, duel-end overlay.
- **Collapses:** log rail → a full-screen sheet from the right; inspector → a bottom sheet;
  pile inspector → full-screen grid.
- **Must give:** the two 5-slot rows plus pile clusters cannot fit at 390px without either
  (a) a horizontal scroll on the field, or (b) collapsing the opponent's pile cluster into a
  single tappable `▾ 4 piles` badge. **(b) is the right answer** and it is the one thing a mobile
  adaptation would have to design.
- **Must give:** hover-to-inspect has no mobile equivalent; it becomes long-press. The auto-push
  entry point is unaffected, which is why auto-push matters more than hover.
- **Must NOT be reintroduced:** the 2026-07-16 mobile spec's per-variant bottom sheets. One
  Question Bar at any width. A phone gets a taller bar, not more surfaces.

---

## 15 · Auto-resolve register — every decision the player never sees

The rule (CEO): **auto-answer only where exactly one legal answer exists. Never where a real
choice exists.** Enumerated exhaustively so nobody has to re-derive it:

| Variant | Auto-answered when | Player sees |
|---|---|---|
| `SelectZone` | `zones.length === 1` | nothing; the card lands |
| `SelectZone` | `Choose zones` is OFF (default) — **CEO product call, see §16** | nothing; leftmost free zone |
| `SelectPosition` | `positions.length === 1` | nothing |
| `SelectTribute` | `min === max === cards.length` | **nothing to decide, but the tributed cards flash on the board and appear in the ribbon** — auto-answer is not auto-hide |
| `ChainPrompt` | `forced === true` **and** `selects.length === 1` | a 700ms narration chip on the chain strip; no bar |
| `SelectOption` | `options.length === 1` | nothing |
| `AnnounceRace` / `AnnounceAttrib` | `count === 1` **and** `available.length === 1` | nothing |
| `SelectCard` | `min === max === cards.length` **and** `cancelable === false` | flash + ribbon, as `SelectTribute` |
| `SelectUnselectCard` | **never auto-answered** — but the *iteration* is hidden: one player multi-select drives N protocol round trips | one running-total multi-select |
| everything else | never | the bar |

**Never auto-answered under any circumstance:** `IdleCommand`, `BattleCommand`, `SelectYesNo`,
`SelectEffectYN`, `AnnounceCard`, `AnnounceNumber`, and any variant with `min !== max`.

---

## 16 · Flagged: two places where "exactly one legal answer" is ambiguous

Reported rather than guessed, per the brief.

**A. `SelectCard` / `SelectTribute` with `min === max === cards.length` AND `cancelable === true`.**
The selection itself is forced, but **cancel is a second legal answer** (`indices: null`). Strictly,
two legal answers exist, so the rule says do not auto-answer. That produces a bar reading
"choose these 2 of 2", which is exactly the noise we are removing.
**My resolution, which I have built:** auto-answer the *selection*, and keep the cancel reachable —
the intent ribbon's `Cancel summon` button maps to that same cancel response for as long as the
step is live. No legal answer is lost; the question is just not asked. **Confirm this reading.**

**B. `SelectZone` with `zones.length > 1` and `Choose zones` OFF.**
This *does* remove a real choice, and it therefore contradicts "never where a real choice exists".
It is nonetheless an explicit CEO call ("zone placement defaults to auto, with an opt-in choose
zones toggle"), and Edison has no Link arrows and no Infinite Impermanence. **I have built the CEO
call.** Flagging only so the contradiction is on the record and not discovered later as a bug.
The escape hatch is one toggle in settings, and the design also auto-prompts regardless of the
toggle when the zone is contested — i.e. when `zones.length < the number of empty zones`, which
means the engine is already restricting placement and the restriction is probably load-bearing.

---

# Duel screen — flows

**Issue:** ZUH-81 · **Project:** Duel UI Rebuild.
Companions: `surface-inventory.md` (surfaces + states), `component-contract.md` (handover).

Decision sequences below are taken from
`docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md` Part 1 and from the empirical
capture `docs/reference/decision-capture-raw.json`. They are what the engine **actually** emits.

---

## 0 · The three mechanisms every flow depends on

Read these once; every flow below assumes them.

### M1 · The pending-intent object

The client holds **one** intent object from the moment the player picks a verb until the engine
stops asking about it: `{verb, cardCode, cardName, steps[], stepIndex, commitAt}`. It is what the
Intent Ribbon renders, and it is what makes 2–6 decisions read as one action.

Today the panel is destroyed at every sub-step: the server sends `STATE` before `DECISION`
(`duelSocket.ts:118-128`), the client nulls the decision on `STATE` (`DuelScreen.tsx:128-131`), and
the player watches *"Waiting for engine…"* flash between every sub-step **of their own single
action** (`ActionPanel.tsx:47-57`). The intent object exists specifically to survive that gap.
**Nothing unmounts mid-intent. Ever.**

### M2 · What fills the gap between a click and the engine's answer

Every answer is a WebSocket round trip. In the gap:

1. The Question Bar **collapses in place** to a 3px indeterminate hairline. It does not unmount, so
   nothing reflows.
2. The Intent Ribbon **stays**, current step dot pulsing.
3. **Optimistic placement ghost.** Where the client has just answered the decision that determines
   a card's destination — `SelectZone`, `SelectTribute`, `SelectPosition` — it immediately draws
   the result at 60% opacity with a dashed outline. If the confirming `STATE` disagrees, the ghost
   snaps to truth in 150ms. The client never guesses beyond what it just answered.
4. If the gap exceeds **2s**, the hairline is replaced by `Engine is resolving…` on the phase rail.

The player can always tell what is happening because the ribbon names the intent and the step.

### M3 · The commit point

`SelectZone` has no cancel in the protocol (`duelDecision.ts:211-216`; `RSelectZone.indices` is not
nullable at `:393-396`). So for any intent that reaches a zone step, **the last cancelable step is
the point of no return**. The design is honest about it in two places at once:

- the Intent Ribbon draws a **🔒 on the first non-cancelable step** and swaps `Cancel` for
  `Committed` when it is passed;
- the **confirm button of the last cancelable step carries the lock in its label** —
  `Tribute 2 & commit 🔒`.

The player is told the price *on the click that costs it*, not afterwards.

---

## Flow: "Summon this monster"

**Entry:** your Main Phase, an `IdleCommand` is pending, the monster is in your hand.
**Success:** the monster is on your field, face-up attack, and you are still in Main 1.

### Decision sequence the engine emits

| # | kind | Player sees |
|---|---|---|
| 1 | `IdleCommand` → `{action:"summon", index}` | **no bar** — the board is armed; verb chips at the card |
| 2 | `SelectZone` | nothing (auto, `Choose zones` off) — or the board glows if on |
| 3 | `SelectPosition` — *only some monsters* | position tiles, or nothing if `positions.length === 1` |
| 4 | `ChainPrompt` to the **opponent** | your ribbon reads `Sakura may respond…`; their clock starts |

### Happy path

1. Click the monster in your hand → chips appear at the card: `Summon · Set · Inspect`.
   *You now know exactly what this card can do right now, because ocgcore said so.*
2. Click `Summon` → ribbon appears: `⚔ Summoning "Gorz the Emissary of Darkness"`; the card lifts
   out of the hand and a ghost lands in the leftmost free monster zone.
3. Engine answers zone and (usually) position automatically. Ghost solidifies. Log gains
   `[▪] Gorz · Summon · 🖐 → ⬛`. Ribbon fades.
4. If the opponent has a response window, the ribbon becomes `Sakura may respond…` and their clock
   starts. Otherwise you are back in ACT mode immediately.

**Actions to goal: 2 clicks.** Today: 2 clicks *plus* a zone panel *plus* two panel-flashes.

### Branches

| At step | Condition | Path |
|---|---|---|
| 2 | `Choose zones` ON | board enters zone-pick: legal zones glow blue, click one. +1 click |
| 3 | `positions.length > 1` | Question Bar with 2–3 position tiles. +1 click |
| 4 | opponent chains | chain strip appears; see *"Respond to what they just did"* from their side |
| 1 | monster needs tributes | this is a different verb chip — see the tribute flow |

### Failure modes

| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Server rejects the summon | bar/ribbon gains amber `Not accepted`; board returns to ACT unchanged | click again; nothing was consumed |
| Round trip stalls > 2s | `Engine is resolving…` on the phase rail; ribbon persists | wait; clock is still theirs to lose only if it is your clock |
| Socket drops mid-summon | board freezes at 60%, `Reconnecting… attempt 1` | on reconnect the pending `DECISION` is re-sent (`duelSocket.ts:311-349`); the ribbon **cannot** be restored (client-only state) so it resumes at the current step with the intent name recovered from the decision's `card` |
| Summon negated (Solemn) | chain strip shows the negation resolving, inspector auto-pushes Solemn's text, log row `Gorz · Negated · ⬛ → ⚰` | nothing to do — it happened |

### Sequencing notes
Actions to goal: **2**. Longest wait: the opponent's response window (their clock).
What fills it: chain strip + auto-pushed card text + log rows. Never a spinner.

---

## Flow: "Set a card and pass"

**Entry:** Main Phase, `IdleCommand` pending. **Success:** the card is face-down in your back row
and the turn has passed.

### Decision sequence
`IdleCommand{action:"spellSet"|"monsterSet", index}` → `SelectZone` → *(later)*
`IdleCommand{action:"toEP"}` → end-phase `ChainPrompt` windows for both seats → opponent `NEW_TURN`.

### Happy path
1. Click the card in hand → chips: `Set · Inspect` (a Trap offers only `Set` — ocgcore says so).
2. Click `Set` → ghost lands face-down in the leftmost free spell/trap zone. **Your own set card
   renders translucent to you** and opaque to the opponent, so you can always read your own board.
3. Click `EP` on the phase rail (or `End Turn` at its right end). Turn passes.

**Actions to goal: 3 clicks** (set = 2, pass = 1).

`End Turn` is on the **persistent phase rail**, not inside a decision panel. Today it lives at
`IdleCommandPanel.tsx:211-221` and vanishes with the panel — which is why "pass" currently feels
conditional on being asked.

### Branches
| At step | Condition | Path |
|---|---|---|
| 2 | back row full | the `Set` chip is simply not rendered — ocgcore did not list the card in `spellSets[]` |
| 3 | you have an end-phase effect | `ChainPrompt` to you first; bar rises before the turn passes |
| 3 | opponent has an end-phase response | ribbon `Sakura may respond…`; turn passes when they decline |

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Clicked `EP` by accident | **no undo — phase advance is a real engine action.** Mitigated: the `EP` cell requires the pointer to land on it, has no hover-fire, and sits 24px clear of `M2` | play on |
| A mandatory end-phase effect fires | bar rises with the card named; ribbon reads `End Phase` | answer |

### Sequencing notes
Actions to goal: **3**. Longest wait: the two end-phase response windows.
What fills it: `Sakura may respond…` on the ribbon + their live clock.

---

## Flow: ★ "Tribute summon Caius and pop their monster" — the flagship

**This is the 2–6 decision case. It is the flow the whole design is built around.**

**Entry:** Main Phase, `IdleCommand` pending, Caius in hand, two monsters on your field.
**Success:** Caius is on the field, two of your monsters are in the graveyard, Caius's trigger has
targeted and destroyed something.

### Decision sequence the engine actually emits

| # | kind | Emitted because | Cancelable? |
|---|---|---|---|
| 1 | `IdleCommand` → `{action:"summon", index}` | main-phase action list | — (it is the start) |
| 2 | `SelectTribute` | ocgcore asks for releases | **yes** (`can_cancel: true` in the capture) |
| 3 | `SelectZone` | `SELECT_PLACE`, `field_mask` decoded | **NO — this is the commit point** |
| 4 | `SelectPosition` | some monsters only | no |
| 5 | `ChainPrompt` to the **opponent** | summon-response window (Bottomless, Solemn) | theirs |
| 6 | `ChainPrompt` + `SelectCard` back to **you** | Caius's own on-summon trigger and its target | yes (`SelectCard.cancelable`) |

**One intent = up to 6 typed decisions, each a full round trip, all inside ONE clock.**

### Happy path

```
CLICK 1  Caius in hand
         → chips:  [ Tribute Summon (2) ]  [ Set ]  [ Inspect ]
                    ^ the cost is ON the chip. release_param is on the wire and
                      is thrown away today (messageToDecision.ts:505-515), so the
                      player currently learns the cost AFTER committing.

CLICK 2  "Tribute Summon (2)"
         → RIBBON:  ⚔ Tribute Summoning "Caius the Shadow Monarch"
                       ●━━━━━━━━━🔒━━━━━━━━━○
                       Tributes   Zone      Position
                                  ↑ committed here      [ Cancel summon ]
         → BAR:     Tribute 2 monsters for "Caius the Shadow Monarch".
                    [thumb ⬛][thumb ⬛][thumb ⬛]        ← board ALSO highlights them
                    0 of 2 selected
                    [ Cancel ]                [ Tribute 2 & commit 🔒 ]  (disabled)

CLICK 3  first tribute            → 1 of 2 selected; that monster dims on the board
CLICK 4  second tribute           → 2 of 2 selected; confirm enables
CLICK 5  "Tribute 2 & commit 🔒"  → the lock label is the whole warning. Nothing else needed.
         → both monsters fly to the GY (ghost), Caius ghost lands in the free zone,
           RIBBON:  ●━━━━━━━━━●━━━━━━━━━○   "Committed"   (Cancel is gone, not greyed-out-and-lying)
         → SelectZone auto-answered (Choose zones OFF)

CLICK 6  position tile "Attack ↑"  (skipped entirely if positions.length === 1)

         → opponent's response window. RIBBON: "Sakura may respond…", their clock runs.
           If they chain, the CHAIN STRIP builds and the INSPECTOR auto-pushes their card text.

CLICK 7  Caius's trigger:  BAR: 'Activate "Caius the Shadow Monarch"?'  [ No ] [ Activate ]
CLICK 8  target:           BAR: 'Banish 1 card — choose 1:'  → THE BOARD HIGHLIGHTS their monsters
                           click the monster on the board. Not a list. Not a modal.
```

**Actions to goal: 5 in the minimum case, 8 in the full case.** Every one of them is a click the
player *meant*. The 3 protocol steps they never see (`SelectZone`, and any single-option
`SelectPosition` / forced trigger) are the ones with exactly one legal answer.

### Branches

| At step | Condition | Path |
|---|---|---|
| 2 | `min === max === cards.length` (exactly 2 monsters, need 2) | **auto-answered.** No bar. The two monsters flash and fly to the GY, the ribbon shows them. The 🔒 moves to step 1, and the *verb chip itself* becomes the commit — it reads `Tribute Summon (2) 🔒` |
| 2 | more than 2 candidates | as drawn above |
| 3 | `Choose zones` ON | the board becomes the answer space: legal zones glow, click one. Still the commit |
| 4 | `positions.length === 1` | auto; no click |
| 5 | opponent chains Bottomless | chain strip: `①[art] Bottomless Trap Hole` red. Caius is banished. Log row. **Your intent ribbon ends with `Summon negated`** — it does not just vanish |
| 6 | Caius's trigger is `forced` with one select | auto-answered, narrated on the chain strip for 700ms |
| 6 | no legal target | ocgcore does not emit the `SelectCard`; nothing appears |

### Failure modes

| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Player wants out **before** click 5 | `Cancel summon` on the ribbon, or `Cancel` on the bar — both send `{kind:"SelectTribute", indices:null}` | board returns to ACT, nothing consumed, ribbon shows `Cancelled` for 400ms |
| Player wants out **after** click 5 | `Committed` on the ribbon. **There is no way out — this is real, and the UI said so before the click** | play on |
| Clock expires mid-intent | at ≤60s the bar hairline goes amber; at ≤10s `0:08 — timeout forfeits`; at 0 the duel-end overlay reads `Your move timer ran out — the duel is forfeit` | none. This is why the commit point and the single clock must both be visible |
| Server rejects a sub-answer | that step's bar re-renders with an amber `Not accepted — try again`; the ribbon keeps the intent | re-answer that one step |
| Disconnect mid-intent | board freezes 60%, `Reconnecting…`; **their** clock is unaffected, **yours keeps running** | on reconnect the pending decision is re-sent; the ribbon is rebuilt from the decision (it will name the card but may lose the step count — flagged in `component-contract.md` as backend delta ND-2) |

### Sequencing notes
Actions to goal: **5–8**. Longest wait: the opponent's summon-response window at step 5.
What fills it: their clock counting, the ribbon naming what is being waited on, and — if they
chain — the strip and the auto-pushed card text. **The player is never told "Waiting for engine".**

---

## Flow: "Activate this from my hand"

**Entry:** Main Phase, `IdleCommand` pending, a Spell in hand.
**Success:** the spell resolves.

### Decision sequence
`IdleCommand{action:"activate", index}` → *(optional)* `SelectCard` for its target →
opponent `ChainPrompt` → `CHAINING`/`CHAINED`/`CHAIN_SOLVING`/`CHAIN_SOLVED`/`CHAIN_END`.

### Happy path
1. Click the spell → chips: `Activate · Set · Inspect`. The `activates[]` entries carry a
   `description` label, so a card with two activatable effects yields **two chips**, each labelled.
2. Click `Activate` → ribbon `✦ Activating "Pot of Avarice"`. Chain strip appears with
   `①[art] Pot of Avarice` in blue.
3. If a target is needed, the bar rises: `Return 5 monsters from your Graveyard — choose 5:` and
   **the GY pile inspector opens as the answer space** with only the candidates lit.
4. Opponent's window. Then resolution: the strip's link outlines, the inspector auto-pushes the
   text, the log gains the outcome rows.

**Actions to goal: 2 (no target) / 3+ (targeted).**

### Branches
| At step | Condition | Path |
|---|---|---|
| 1 | card has 2+ activatable effects | 2+ labelled chips — `SelectOption` is pre-empted where possible; where the engine insists, the bar shows the options |
| 3 | candidates span hand + GY + field | **all three highlight simultaneously** under the dim law; the bar's thumbnails carry location badges |
| 4 | opponent chains | strip grows; when it is your turn to respond again you get the bar |

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Activation negated | strip shows the negating link resolving; log row `Pot of Avarice · Negated` | nothing |
| Wrong target picked, still selecting | `Cancel` on the bar (`cancelable: true`) | reselect |
| Wrong target picked, already confirmed | no undo — engine has it | play on |

### Sequencing notes
Actions to goal: **2–3**. Longest wait: opponent's response window. Filled by the chain strip.

---

## Flow: "Swing with everything"

**Entry:** your Battle Phase, `BattleCommand` pending, two monsters that can attack.
**Success:** both attacks are declared and resolved.

### Decision sequence, **per attack**
`BattleCommand{action:"attack", index}` → `SelectCard` (attack target) → opponent `ChainPrompt` →
`ATTACK`(110) / `DAMAGE_STEP_START`(113) / `BATTLE`(111) / `DAMAGE`(91) / `DAMAGE_STEP_END`(114)
→ **a fresh `BattleCommand` whose `attacks[]` has been rebuilt and RE-INDEXED**.

### Happy path
1. Click `BP` on the phase rail. The board enters battle: monsters that can attack gain a ⚔ corner
   glyph; monsters that already attacked show it greyed.
2. Click your first monster → chips: `Attack · Inspect`.
3. Click `Attack` → the **opponent's monsters highlight on the board** and their LP plate
   highlights if a direct attack is legal. Click the defender. *No list, no modal.*
   - `canDirectAttack === true` → the client answers the follow-up `SelectCard` itself; clicking
     `Attack` swings directly and the LP plate flashes. **2 clicks, not 3.**
4. Battle resolves: ATK numerals rise off both cards, the loser flips to the GY, a large red LP
   delta floats over the damaged plate, log gains `Gorz · Attack · ⚔ 2700 → Caius destroyed`.
5. Board returns to battle-armed ACT with a **fresh** `attacks[]`. Repeat for the second monster.

**Actions to goal: 1 (enter BP) + 3 per attack, or 2 per direct attack.**

### Branches
| At step | Condition | Path |
|---|---|---|
| 3 | opponent has no monsters | every attacker is `canDirectAttack`; each attack is 2 clicks |
| 3 | opponent chains a trap | chain strip; your ribbon reads `Sakura may respond…`; attack may be negated |
| 5 | you want to stop attacking | `M2` or `EP` on the phase rail — always there, never inside a panel |

### The re-indexing trap — a hard implementation rule
Indices are **per-decision** (ADR: "0-based indices into the decision's `cards[]`/`selects[]`"). A
monster that has attacked simply **stops appearing** in `attacks[]`. Any queue that caches an index
across `BattleCommand` cycles is a mis-attack bug. The design therefore does **not** offer
"nominate all attackers up front" as a batch: each attack is nominated on the board, and the client
re-resolves the clicked card to the *current* `attacks[]` entry by
`{controller, location, sequence}` — never by index. See `component-contract.md` AC-BATTLE-3.

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Clicked a monster that already attacked | no `Attack` chip — it is not in `attacks[]`; the greyed ⚔ glyph already said so | pick another |
| Attack negated | strip shows the negation; log row; the monster is back to un-attacked or not, per the engine | read the board |
| You lose the battle | LP delta floats over **your** plate, your monster flips to GY | play on |
| Disconnect between attacks | frozen board + reconnect banner; the pending `BattleCommand` is re-sent on reconnect | resume |

### Sequencing notes
Actions to goal: **3 per attack**. Longest wait: the opponent's per-attack response window.
What fills it: their clock + the strip. Damage is *shown*, not inferred from an LP snapshot —
`MSG_BATTLE` already carries `attack`, `defense`, `destroyed` for both cards and is unread today.

---

## Flow: ★ "No — Solemn that" (responding to a chain)

**The interaction the format is built on.** This is where our current screen fails hardest:
the player is asked *"Respond?"* with **no statement of what to**.

**Entry:** the opponent does something in a window where you hold a response.
**Success:** your card is on the chain, or you have declined in one keystroke.

### Decision sequence
opponent's action → `MSG_CHAINING`(70) carrying `code`, `description`, `chain_size` →
`MSG_BECOME_TARGET`(83) → **you** get `ChainPrompt{forced, selects}` → your `{index}` →
*(optional)* `SelectCard` for your own target → opponent gets another `ChainPrompt` →
`CHAINED`(71) → `CHAIN_SOLVING`(72) → `CHAIN_SOLVED`(73) → `CHAIN_END`(74).

### Happy path

```
  (their action)   → CHAIN STRIP appears:  ⛓ ①[art] Torrential Tribute  (red)
                   → INSPECTOR auto-pushes Torrential Tribute's full text. No click.
                   → any card of yours it TARGETS gains a red pulsing outline on the board.

  BAR rises:
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Sakura activated "Torrential Tribute" (Spell/Trap Zone).              │
  │ Chain a card or effect?                                              │
  │    [Solemn Judgment 🃏]   [My Body as a Shield 🃏]                    │
  │    [ No response ]                        [ ▶ Activate Effect ]       │
  └──────────────────────────────────────────────────────────────────────┘

  CLICK 1  Solemn Judgment    CLICK 2  Activate Effect      → 2 clicks
  or       ESC / click "No response"                        → 1 keystroke, no confirm
```

The sentence in line 1 is the whole fix. Today `ChainPromptPanel.tsx` renders `selects` and a Pass
button, and **the trigger is nowhere on screen** — the identity of the card you are responding to
is not in the `ChainPrompt` variant at all (`duelDecision.ts:166-171`), only in the `MSG_CHAINING`
event, which the client discards (`DuelScreen.tsx:145-146`) and the server sometimes never forwards
(`duelSocket.ts:93-95`). This flow is **blocked on backend MH-2** and cannot ship without it.

### Branches
| At step | Condition | Path |
|---|---|---|
| — | `forced === true` and `selects.length === 1` | **auto-answered**; a 700ms chip on the chain strip names it. No bar, no click |
| — | `forced === true` and `selects.length > 1` | bar rises; the decline verb is replaced by the commit statement `You must chain one of these` (no legal decline exists) |
| — | your chained card needs a target | a second bar in sequence — **never a second surface** |
| — | you already declined this chain | with `No response this chain` armed, you are not re-prompted at each link |
| — | verbosity chip = `OFF` | you are only prompted for mandatory and certain trigger effects |

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| You decline by mistake | **no undo** — pass is an answer. Mitigation: `No response` is a button, not `Esc`-only… but `Esc` **is** bound to it, because one-keystroke passing is required for pace. Accepted trade, flagged | play on |
| The chain resolves against you | the strip unwinds right-to-left, each link outlining as it resolves and pushing its text to the inspector; the log records every effect | read |
| A long chain (5+ links) | the strip compresses to ordinal + owner dot from link 5, expanding on hover | hover |
| The activating card's identity never arrives (MH-2 not shipped) | line 1 degrades to `Sakura activated a card. Chain a card or effect?` — **honest, not fabricated** | answer |

### Sequencing notes
Actions to goal: **1 to decline, 2 to chain.** Longest wait: the rest of the chain resolving.
What fills it: the strip unwinding + auto-pushed text + log rows.

**The tell problem is real and unfixable.** Any client that only prompts when a legal response
exists leaks the existence of that response by the pause itself. The verbosity chip set to `OFF` is
the mitigation, exactly as in Master Duel. We must not be *worse* than Master Duel here; we cannot
be better.

---

## Flow: "Synchro into Brionac with these two"

Included because it is the second multi-decision intent and it shares the flagship's machinery.

### Decision sequence
`IdleCommand{action:"specialSummon", index}` → **`SelectUnselectCard` once per material,
iteratively** (`min`/`max` around 1, answered one index per decision, finish/cancel via
`index: null` when `canFinish`) → `SelectPosition` → sometimes `SelectZone` → the Synchro's own
triggers → opponent's window.

### Happy path
1. Click Brionac in the Extra Deck (the Extra pile is clickable in ACT mode) → chip
   `Synchro Summon`.
2. **One** bar: `Select materials for "Brionac, Dragon of the Ice Barrier" — Level 6/6`, thumbnails
   with **Level and a ⚙ Tuner mark** (resolved client-side from `/api/cards`, no backend change),
   and a running total. Click two cards; the total reads `6/6`; confirm enables.
3. Underneath, the client sends one `SelectUnselectCard` response per click. **The player never
   sees the iteration.** This is *protocol iteration hidden*, not auto-answering — every round trip
   corresponds to a click the player actually made.
4. Position tile, then the summon completes.

**Actions to goal: 4.** Ritual summons (Advanced Ritual Art, Black Illusion Ritual) take the same
path and share the implementation.

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Wrong material clicked | click it again — the client sends the unselect index; total drops | reselect |
| Total never reaches the requirement | confirm stays disabled with `4 / 6`; `Cancel` is live while `cancelable` | cancel |
| `canFinish` goes true early | confirm enables early; the running total tells you why | confirm or keep adding |

---

## Flow: "End my turn"

### Decision sequence
`IdleCommand{action:"toEP"}` → end-phase `ChainPrompt` windows for **both** seats → opponent's
`NEW_TURN`(40) → `NEW_PHASE`(41) ×n.

### Happy path
1. Click `EP` on the phase rail (or `End Turn`). One click. It is **always** there.
2. If you hold an end-phase effect, a bar rises first.
3. The opponent's window opens: ribbon `Sakura may respond…`, their clock starts.
4. `NEW_TURN` → the phase rail retints red, the top bar reads `TURN 5 · THEIRS`, the log gains a
   red `TURN 5 — Sakura` banner with an LP snapshot row, and the screen enters the waiting mode.

**Actions to goal: 1.**

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| You still had a play | no undo | — |
| Hand size > 6 | the engine emits `SelectCard` to discard; the bar names it and the hand highlights | discard |

---

## Flow: "It's their turn — what is happening?"

**This is half of every duel and it is the state served worst today.** All three of the situations
below currently render the identical string *"Waiting for engine…"*.

| Situation | What the screen shows | What tells us |
|---|---|---|
| **Opponent thinking** | phase rail tinted red, **their clock counting down**, ribbon line `Sakura is deciding`, board fully live for inspection | `CLOCK.onClockSeat !== mySeat`, presence OK |
| **Engine busy** | 3px indeterminate hairline on the phase rail; after 2s, `Engine is resolving…` | on-clock is me, no `DECISION` yet |
| **You are disconnected** | amber banner `Reconnecting… attempt 2`, board frozen at 60%, clock greys to `?` | socket state |

**What the waiting player can do — all of it free, instant and never broadcast:**
inspect any pile, hover any card, read the log, expand the chain strip, change the verbosity chip.
**Nothing they do is visible to the opponent.**

**What arrives while they wait:** log rows in real time, auto-pushed card text on every opponent
activation, the chain strip building, LP deltas floating, damage numerals.

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Opponent disconnects | presence dot goes grey with `Sakura — connection lost`; **their clock keeps running** so the state resolves itself by timeout | wait |
| Reconnect succeeds | banner clears, board un-freezes, log shows `— log resumes here —` if backfill is unavailable | continue |
| Reconnect fails 4× | banner becomes `Could not reconnect.` with `Retry` and `Back to Home`; **the clock stays greyed and honest** | retry / leave |

---

## Flow: "My clock is running out"

**The clock is per handover of control. A timeout forfeits the duel.**

| Remaining | Screen |
|---|---|
| > 60s | ambient blue badge on the phase rail; hairline on the bar when a bar is up |
| ≤ 60s | badge amber and doubled in size; bar hairline amber |
| ≤ 10s | board edge gains a 2px amber pulse; badge reads `0:08 — timeout forfeits` |
| 0 | `DUEL_END{reason:"timeout"}` → overlay: `Your move timer ran out — the duel is forfeit.` |

**Why the escalation is three-stage and not one.** One clock now covers an entire six-decision
tribute summon. A player deep inside a multi-select is not looking at the phase rail — so the
in-fovea hairline on the Question Bar exists precisely for them. And because the intent may be
past its commit point, the design cannot offer "abandon and save your clock": the honest answer is
to make the remaining time impossible to miss.

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| Timeout while committed mid-intent | forfeit overlay | none — this is why the 🔒 is drawn before the click |
| Clock disagrees with the server | the badge is server-authoritative (`CLOCK.deadlineAt`), re-synced on every frame; local ticking is display only | — |
| No `CLOCK` frame yet | badge reads `—:—`, never `0:00` | — |

---

## Flow: "The duel ended"

### Entry
`DUEL_END{winner, reason}` — `reason ∈ {"normal","timeout","resign"}`.

### Happy path
1. Board freezes at full colour. A centred card: result, reason, both final LP totals.
2. `Review board` dismisses the card → the frozen board and the full log stay readable and
   inspectable. A `Duel ended` pill top-centre reopens the result.
3. `Open log` expands the rail with the final `Duel ended — {reason}` row.
4. `Back to Home`.

**Actions to goal: 1.** The board and log remaining inspectable after the end is deliberate — it is
where a player reconstructs what beat them, and it costs nothing because the state is already there.

### Branches
| Condition | Reason line |
|---|---|
| `normal`, you won | `Sakura's LP reached 0.` |
| `normal`, you lost | `Your LP reached 0.` |
| `timeout`, you lost | `Your move timer ran out — the duel is forfeit.` |
| `timeout`, you won | `Sakura's move timer ran out.` |
| `resign` | `Sakura resigned.` / `You resigned.` |
| `winner === null` | `Draw.` |

### Failure modes
| What goes wrong | What the player sees | How they recover |
|---|---|---|
| `DUEL_END` arrives while a bar is up | the bar greys and goes inert **before** the overlay animates in, so no click lands on a dead question | dismiss |
| Unknown reason string | `The duel ended.` plus the raw reason | home |
| Socket dropped before `DUEL_END` | the reconnect path fetches state and finds the duel ended; overlay shows with reason from the server | home |

---

## Appendix · Action-count comparison

| Intent | Today | This design | What was removed |
|---|---|---|---|
| Normal summon | 2 clicks + zone panel + 2 panel flashes | **2 clicks** | the zone panel, the flashes |
| Set + pass | 2 + zone panel + find End Phase in the panel | **3 clicks** | the zone panel; End Turn is now permanent |
| Tribute summon | 2 + tribute panel + zone panel + position panel + 2 chain panels, each remounting | **5–8 clicks, one continuous ribbon** | 3 panel remounts, the "Waiting for engine…" flashes, the hidden cost |
| Attack | attack button → target list → repeat | **3 clicks, target picked on the board** | the target list |
| Chain response | "Respond?" with no context | **1 to decline, 2 to chain** | the guessing |
| End turn | only when the panel offers it | **1 click, always** | the conditionality |

---

# Duel screen — component contract

**Issue:** ZUH-81 · **Project:** Duel UI Rebuild
**Prototype:** branch `proto/duel-ui`, commit `857219b56dcd125d1224cfb93c41cc73ef6235f6`
(`spikes/duel-ui-proto/`). Pointer, not an approval gate.
Companions: `surface-inventory.md`, `flows.md`, `usability-findings.md`.

**Revision 2** — amended after the independent usability pass. Every change forced by a
**design** defect (as opposed to a prototype defect) is tagged with its finding id, e.g. `[M8]`.
The triage of all 38 findings is recorded at the bottom of `usability-findings.md`.

**Revision 3** — adds §0a, the answer-fidelity invariant. It is the durable value of a bug the
CEO found, and it is a **QA gate**, not a nicety.

**Revision 4** — card art. `CardArt` (§10a) is a new shared component; `CardInspector` gains an
image binding and three network states. No backend delta: the images are public static files
already served at `VITE_IMAGE_BASE_URL`.

**Revision 5** — the provenance badge (§10b), backend delta **ND-6**, ND-1/ND-4/ND-5 marked
**APPROVED**, and §13a: the three findings previously recorded as rejected are re-recorded as
**deferred pending a named capability**.

---

## 0a · The answer-fidelity invariant — normative, and it applies to EVERY decision

> **For any decision with more than one legal answer, distinct answers must produce distinct
> observable outcomes, and the outcome must be the one the confirm control named.**

**Why this is a contract clause and not a test note.** The prototype broke this three times, and
each time it was reported fixed after a spot check on one answer:

| Instance | What the screen promised | What happened |
|---|---|---|
| **B3** | `Tribute Sangan` | Card Trooper was tributed, every time |
| **B4** | `No response` | Solemn Judgment activated and 4000 LP was paid |
| **CEO** | `Activate "Book of Moon"` | Solemn Judgment resolved and 4000 LP was paid |

One defect, three symptoms. The cause was always the same shape: **the outcome was keyed to the
step rather than to the answer**, so it could not vary with what the player chose. A spot check on
one answer cannot detect that — the one path you check is the one path that works.

### What engineering must do about it

1. **Never key a state transition to a step or a screen.** The response you send is a function of
   the answer; so is everything the player then sees. In the real client this is mostly free,
   because ocgcore computes the outcome — but the same shape recurs in any optimistic update,
   any client-side ghost, and any narration string. Every one of those must read the answer.
2. **The confirm control's label and the submitted response must be derived from the same value.**
   The B3/CEO bugs both had a *correct* label next to an *incorrect* action, which is the worst
   possible failure: the interface lied and looked confident. Compute the label from the same
   selection object you are about to send. Do not build it from a parallel source.
3. **Test by enumeration, never by sample.** For each decision under test, loop over *every* legal
   answer including the decline, drive to a settled state, fingerprint the observable result, and
   assert pairwise distinctness. `spikes/duel-ui-proto/answer-matrix.py` is a working reference
   implementation, and `answer-outcome-matrix.md` is its output.
4. **A pair that legitimately converges must be named and justified.** Some answers genuinely reach
   the same place — a Book of Moon flip before a Torrential Tribute resolves is inconsequential to
   the final board because everything dies regardless of position. That is a domain fact, not a
   pass. It must be listed, with its reason, and the two answers must still be distinguishable
   through **some** observable channel (in that case the event log records which card was flipped).

### Acceptance criteria — apply to every decision-bearing component
- [ ] For every decision variant with `min !== max`, or with more than one candidate, or with a
      legal decline: an enumerating test walks all answers and asserts pairwise-distinct observable
      outcomes. **Sampling one answer is not evidence.**
- [ ] The string on the confirm control and the `DuelDecisionResponse` that control sends are
      derived from the same selection value, in the same expression where practical.
- [ ] Any pair of answers that share an outcome is listed in the test's own output with the domain
      reason, and is distinguishable through at least one observable channel.
- [ ] A face-down candidate is still named unambiguously on the confirm control — by **location**,
      since we are not entitled to its identity: `Target Sakura's set card in S/T 1`.
- [ ] Clicking the only candidate of a `min === max === 1` decision **selects** it. Radio
      semantics, never toggle — deselecting the only option disables the only button and dead-ends
      the step. (Found by the enumerating test, not by a human.)

This is what engineering builds. The prototype dies; this, the fixtures in
`spikes/duel-ui-proto/src/fixtures/`, and the backend deltas in §12 do not.

---

## 0 · Component tree

```
DuelScreen                                   packages/web/src/screens/DuelScreen.tsx   (extend)
├── DuelTopBar                               new
│   ├── PresenceIndicator                    new
│   ├── TurnPill                             new
│   ├── VerbosityChip                        new
│   ├── SettingsPopover                      new  (Choose zones · Self chain · Activation order · Resign)
│   └── LogToggle                            new
├── DuelStage                                new  (positioning context for everything below)
│   ├── DuelBoard                            packages/web/src/components/DuelBoard.tsx (rewrite)
│   │   ├── FieldGroup       ×2              new
│   │   │   ├── ZoneSlot     ×11             new  (5 MZONE + 5 SZONE + 1 FZONE)
│   │   │   │   └── CardTile                 packages/web/src/components/CardTile.tsx (extend)
│   │   │   └── PileBadge    ×4              new  (Deck · Extra · GY · Banished)
│   │   ├── HandRow          ×2              new
│   │   └── PhaseRail                        new  (replaces DuelBoard's phase ribbon)
│   ├── LifePointPlate       ×2              new
│   ├── ClockBadge                           packages/web/src/components/DuelTimer.tsx (extend)
│   ├── DimScrim                             new  ← the dim law
│   ├── VerbChipCluster                      packages/web/src/components/duel/ActionContextMenu.tsx (extend)
│   ├── CardInspector                        packages/web/src/components/duel/CardInspector.tsx (extend)
│   ├── PileInspector                        new
│   ├── DuelDock                             new
│   │   ├── ChainStrip                       new
│   │   ├── IntentRibbon                     new
│   │   └── QuestionBar                      packages/web/src/components/ActionPanel.tsx (replace)
│   │       └── DecisionRenderer             packages/web/src/components/duel/DecisionDispatcher.tsx (rewrite)
│   ├── WaitBanner                           new
│   └── DuelEndOverlay                       DuelScreen.tsx `DuelEndBanner` (extend)
└── EventLogRail                             new  (`DuelLogRail` was specified 2026-07-16, never built)
```

**Deleted, not extended:**
- `packages/web/src/components/duel/DecisionBottomSheet.tsx` — phone-first, superseded.
- `packages/web/src/components/duel/TargetingOverlay.tsx` — dead code (already scheduled).
- `packages/web/src/components/duel/decisions/*Panel.tsx` — **all of them.** They are 20 dialogs;
  the design is one renderer with a variant switch. Their *content logic* (index mapping, min/max
  validation, cancel wiring) is worth reading before deleting; their *shells* are the pathology.
- `packages/web/src/components/ActionPanel.tsx`'s "Waiting for engine…" placeholder.

---

## 1 · `DuelStage`

**Job:** own the two interaction modes and guarantee only one question surface exists.
**Existing component?** none (new). It is the state machine `DuelScreen` currently lacks.

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `state` | `DuelStateSnapshot` | ✓ | — | MH-1 extended |
| `decision` | `DuelDecision \| null` | ✓ | — | |
| `mySeat` | `Seat` | ✓ | — | |
| `clock` | `{onClockSeat, deadlineAt}` | ✓ | — | server-authoritative |
| `events` | `DuelEvent[]` | ✓ | — | MH-2 |
| `respond` | `(r: DuelDecisionResponse) => void` | ✓ | — | |
| `connection` | `"open"\|"reconnecting"\|"closed"` | ✓ | — | |

### Derived state it owns
| Field | Type | Notes |
|---|---|---|
| `mode` | `"act"\|"answer"\|"waiting"\|"ended"` | see variants |
| `intent` | `PendingIntent \| null` | **survives across sub-decisions** — the whole point |
| `selection` | `CardRef[]` | cleared on every new decision, never across |
| `chain` | `ChainLink[]` | built from `MSG_CHAINING`/`CHAINED`/`CHAIN_END` |

### Variants (modes)
| Variant | When used |
|---|---|
| `act` | `decision.kind ∈ {IdleCommand, BattleCommand}` and it is my seat |
| `answer` | any other decision kind for my seat |
| `waiting` | no decision for my seat |
| `ended` | `DUEL_END` received |

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | steady | per mode above | per mode above |
| loading | no `STATE` yet | board skeleton, "Dealing…" | Exit |
| empty | N/A — a duel always has a board | — | — |
| error | `ERROR` frame | amber strip under the top bar; **board keeps last good state** | dismiss / Exit |
| disabled | `connection !== "open"` | board frozen 60% + reconnect banner; clock greyed with `?` | Exit |

### Acceptance criteria
- [ ] At most one of `VerbChipCluster` and `QuestionBar` is mounted at any instant. A test that
      mounts both fails.
- [ ] `intent` is **not** cleared by a `STATE` frame. Today `DuelScreen.tsx:128-131` nulls the
      pending decision on `STATE`; the intent object must not follow it.
- [ ] Between answering sub-decision *n* and receiving *n+1*, no component under `DuelDock`
      unmounts (assert by ref identity across the round trip).
- [ ] `selection` is empty whenever a new `DECISION` frame is applied.

---

## 2 · `QuestionBar` + `DecisionRenderer`

**Job:** answer the engine's question without the player working out what is being asked.
**Existing component?** `packages/web/src/components/ActionPanel.tsx` (replace) and
`packages/web/src/components/duel/DecisionDispatcher.tsx` (rewrite as a *renderer*, not a router).

### Structure
```
<QuestionBar>
  <ClockTrack />                        ← LABELLED "your turn clock m:ss"  [M9]
  <QuestionSentence />                  ← line 1, always names a card
  <AnswerSpace variant={decision.kind}/>← line 2
  <TextPane>                            ← line 2b  [M5][M6][m2][m3]
    <CardText role="trigger" pinned />  ←   what you are responding to
    <CardText role="candidate" />       ←   what you are about to play
  <VerbRow>                             ← line 3
    <DeclineButton kbd="Esc" /> | <CommitStatement />
    <SelectionCounter />
    <ConfirmButton />                   ←   NAMES the card and the consequence  [M1][M5]
```

**`TextPane` is not optional.** [M6] A chain decision is a *comparison* of the trigger and
your candidate. Pushing the candidate's text into the far-corner inspector destroyed the
trigger's text, so a player could see one or the other but never both — and the natural click
target (the thumbnail in the bar) was the one that showed *nothing*. [M5] Both texts live in
the bar, adjacent to the buttons, owner-tinted, trigger first.

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `decision` | `DuelDecision` | ✓ | — | all 20 variants |
| `caption` | `string \| undefined` | | — | **MH-3.1** — the engine's `MSG_HINT` caption. Without it a `SelectCard` cannot say what it is for |
| `chainContext` | `ChainLink \| null` | | `null` | the card being responded to; **not in the `ChainPrompt` variant** (`duelDecision.ts:166-171`) — comes from `MSG_CHAINING` |
| `selection` | `CardRef[]` | ✓ | — | lifted, because the board is also an answer space |
| `onToggle` | `(r: CardRef) => void` | ✓ | — | |
| `onConfirm` | `() => void` | ✓ | — | |
| `onDecline` | `() => void` | ✓ | — | maps to the variant's cancel/pass response |
| `commitNext` | `boolean` | ✓ | — | the *next* step is non-cancelable → confirm says so **in words** [M1] |
| `clock` | `{remainingMs, totalMs}` | ✓ | — | |

### Confirm-button label rule  [M1][M5][B3]
The confirm button **must name the object of the action**, and where the next step is
non-cancelable it must say so in words. A bare glyph is not a warning.

| Situation | Label |
|---|---|
| `SelectTribute`, commit next | `Tribute Sangan — cannot be undone` |
| `SelectTribute`, more steps cancelable | `Tribute Sangan` |
| `SelectCard` target | `Target Krebons` |
| `ChainPrompt` | `Activate "Solemn Judgment"` |
| `SelectEffectYN` | `Activate "Ryko, Lightsworn Hunter"` |
| multi-select | join the names with `+`, truncate past three with `+2 more` |

**Not required, and deliberately not done:** computing a card's cost into the label
(`— pay 4000 LP`). The wire carries no structured cost; deriving it would mean parsing card
text. The cost is legible in the `TextPane`, which is now always present. [M5, partially rejected]

### Variants
20 — one per `DuelDecision.kind`. The **sentence pattern** and **answer space** per variant are
tabulated in `surface-inventory.md` §4. `IdleCommand` and `BattleCommand` are **not rendered here
at all** — they arm ACT mode.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | decision pending | full bar, confirm focused | answer |
| loading | answer sent, next frame pending | bar collapses **in place** to a 3px hairline; no unmount, no reflow | wait |
| empty | zero candidates (non-`ChainPrompt`) | sentence + decline only | decline |
| partial | `selection.length < min` | confirm disabled, counter reads `n of m` | keep selecting |
| error | server `ERROR` after a response | bar unchanged + amber `Not accepted — try again` | re-answer |
| disabled | duel ended mid-question | greyed, inert, **before** the end overlay animates | dismiss |
| non-cancelable | `cancelable === false` / `forced` | left slot renders the commit statement, not a button | confirm |

### Interactions
| Trigger | Result | Feedback within 100ms? |
|---|---|---|
| click a candidate thumbnail | toggles selection; the **same card on the board** also highlights | yes |
| click a highlighted card **on the board** | identical to clicking its thumbnail | yes |
| `Enter` | confirm, if enabled | yes |
| `Esc` | **see the keyboard contract below** | yes |
| confirm | `respond(...)`, bar collapses to hairline | yes |

### Keyboard contract — normative  [B2]
**`Esc` never commits anything, anywhere, ever. No keyboard event may submit a decision.**
This was a blocker: `Esc` cancelled correctly on the verb cluster and then *committed* the
irreversible tribute step, destroying a card the player never chose.

| Context | `Esc` does |
|---|---|
| a pile inspector is open | close it |
| a verb cluster is open | dismiss it, no response sent |
| the inspector is pinned | unpin it |
| Question Bar up **and** a legal decline exists (`cancelable`, or `ChainPrompt` not `forced`) | the **decline** action — identical to clicking the decline button |
| Question Bar up and **no** legal decline (`SelectZone`, `SelectPosition`, forced `ChainPrompt`) | **nothing.** No advance, no submit, no dismissal |
| any other time | nothing |

`Enter` submits **only** when the confirm button is enabled and focused. It is never a global
accelerator on a non-cancelable step.
Every decline control renders its `Esc` binding as a visible `kbd` chip, and the verb cluster
renders `Esc closes — costs nothing`, because a player who cannot see the back-out affordance
invents one. [B2]

### Data bindings
| Field | Source | Shape |
|---|---|---|
| candidate identity | `decision.cards[] / selects[] / …` | `CardEntry` — already carries `sequence` |
| card name / art / ATK / DEF / level / text | `GET /api/cards?passcodes=` via a **duel-scoped code→CardDTO cache** | `CardDTO` (`contracts/src/card.ts:42-56`) |
| location badge | `CardEntry.location` | `LocationCode` |
| owner tint | `CardEntry.controller === mySeat` | blue / red |
| trigger identity | `MSG_CHAINING.code` | **MH-2** |
| caption | `MSG_HINT` (`hint_type = HINT_SELECTMSG`) | **MH-3** |

### Acceptance criteria
- [ ] All 20 `DuelDecision.kind` values render **without throwing**, including the five with no
      known Edison trigger (`SortChain`, `SortCard`, `SelectCounter`, `SelectSum`, `SelectDisfield`).
- [ ] Line 1 always contains at least one card name, or — when the trigger's identity is genuinely
      unavailable — the honest degraded string `{Owner} activated a card.` Never a bare
      "Yes or No?" and never a raw description integer.
      *(`SelectYesNoPanel.tsx:64` renders `description || "Yes or No?"` today; captured
      `SELECT_EFFECTYN` has `description: "0n"`, and `resolveDescription` returns a raw integer
      for system strings — `cardName.ts:52-62`.)*
- [ ] A decision with `cancelable === true` renders a decline button of the same height and font
      weight as the confirm button.
- [ ] A decision with no legal decline renders a commit statement in the decline slot — never a
      disabled button.
- [ ] Selecting on the board and selecting in the bar produce the identical
      `DuelDecisionResponse` for the same card.
- [ ] Response indices are computed **at submit time** from the current decision's array, never
      cached from a previous decision.
- [ ] **No keyboard event ever produces a `DuelDecisionResponse` on a non-cancelable decision.**
      Test: focus the bar at a `SelectZone`/`SelectPosition` step, press `Esc` and `Enter`; the
      pending decision is unchanged. [B2]
- [ ] Declining a `ChainPrompt` sends `{kind:"ChainPrompt", index:null}` and produces a board
      state that differs from the confirm branch. Regression fixture asserts LP is **unchanged**
      after a decline. [B4]
- [ ] Selecting a candidate applies a visible selected state **on the thumbnail itself** — an
      outline plus a text band. A counter alone is not feedback. [B3]
- [ ] Every candidate thumbnail selected in the bar shows that card's text in the `TextPane`
      without displacing the trigger's text. [M5][M6]
- [ ] Clicking a candidate on the **board** and in the **bar** produce identical side effects,
      including revealing card text. [m2]
- [ ] `SelectPosition` tiles answer the decision on a single click; there is no second Confirm.
      Each tile shows the resulting orientation. [m7]
- [ ] The location badge on a candidate thumbnail is rendered **only** when the candidate set
      spans more than one `{controller, location}`. [c2]

---

## 2b · `AutoAnswerReceipt` — NEW  [B1][M2]

**Job:** tell the player, without asking them anything, that the client answered a decision
that had exactly one legal answer.
**Existing component?** none (new).

This component did not exist in revision 1, and its absence was the top blocker. The design
said auto-answering "is not auto-hide" but never specified *what the player sees*, so the
prototype rendered an already-answered `SelectZone` as a live Question Bar with an enabled
primary button and imperative copy — a control that could not work, on the flagship flow,
while the ribbon simultaneously read `COMMITTED` and the footer read "there is no cancel at
this step". A player was told they were past the point of no return **and** could not proceed.

**An answered decision is a receipt, not a question.** It is structurally incapable of being
mistaken for one:

| Rule | Why |
|---|---|
| It is **not** a `QuestionBar`. Different component, different styling. | A greyed-out question is still a question |
| **No primary button.** Ever. | A primary button is a promise |
| Copy is **past tense** and names what was answered | "Place the card" is a command; "Zone — the freed monster zone" is a receipt |
| It carries one optional link: **`Ask me next time`** → flips the relevant preference | Recovery without a settings hunt |
| It auto-dismisses; it is never a step the player must clear | It is information, not an interaction |

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `text` | `string` | ✓ | — | past tense, names the answer |
| `onAskNextTime` | `() => void` | | — | present only where a preference governs it (`SelectZone`) |

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | client auto-answered a decision | receipt row above the ribbon | click `Ask me next time` |
| loading | N/A — the answer is already sent | — | — |
| empty | nothing auto-answered | absent | — |
| error | the auto-answer was rejected | receipt is replaced by the real `QuestionBar` for that decision | answer it |
| disabled | N/A | — | — |

### Acceptance criteria
- [ ] While a receipt is showing, `document.querySelector('[data-testid=question-bar]')` is
      **null**. The two surfaces are mutually exclusive.
- [ ] The receipt contains no element with the primary-button class.
- [ ] `elementFromPoint` at the centre of every interactive element inside the dock returns
      that element — the dock never intercepts a click meant for its own child. [B1]
- [ ] Turning the governing preference on converts that decision into a real question with a
      board affordance, on the next occurrence. [B1]

### Implementation note that cost a blocker
`.dock` is a **positioning shell only**. Give it `pointer-events: none` and its direct
children `pointer-events: auto`. In revision 1 the dock (z-index 5) painted over its own
child button, so a real mouse click at that button's centre activated a *different* control.
`elementFromPoint` at the visible button's coordinates returned the dock. Do not rely on
`.click()` in tests — it dispatches on the node and hides exactly this class of bug. [B1]

## 3 · `VerbChipCluster` (ACT mode)

**Job:** two clicks from intent to action, with only the verbs ocgcore says are legal.
**Existing component?** `packages/web/src/components/duel/ActionContextMenu.tsx` (extend).

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `anchor` | `DOMRect` | ✓ | — | the clicked card |
| `verbs` | `Verb[]` | ✓ | — | derived from the pending `IdleCommand`/`BattleCommand` |
| `onPick` | `(v: Verb) => void` | ✓ | — | |
| `onDismiss` | `() => void` | ✓ | — | costs nothing |

### Verb derivation (the whole contract)
| Verb | Source array | Label |
|---|---|---|
| Normal Summon | `IdleCommand.summons[]`, card level ≤ 4 | `Normal Summon` [m17] |
| Normal Summon (tribute) | `IdleCommand.summons[]`, card level ≥ 5 | `Normal Summon — n tribute(s)` — **n from `release_param`**. The number carries its unit; `(1)` read as an option index [m4][m17] |
| Special Summon | `IdleCommand.specialSummons[]` | `Special Summon` |
| Set | `IdleCommand.monsterSets[]` ∪ `spellSets[]` | `Set` |
| Activate | `IdleCommand.activates[]` | one chip per entry; label from `ActiveCardEntry.description` when there is more than one |
| Change Position | `IdleCommand.posChanges[]` | `Change Position` |
| Attack | `BattleCommand.attacks[]` | `Attack` / `Attack directly` when `canDirectAttack` |
| Inspect | always | `Inspect` |

Order is **fixed and global**, exactly as listed. Absent verbs are not rendered — never greyed.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | ≥1 legal verb | chip cluster at the card, first focused | click / arrows + Enter |
| loading | N/A — derived from a decision already in hand | — | — |
| empty | card affords nothing | **no cluster**; a refusal chip anchored **at that card** [M7] | inspect instead |
| error | N/A | — | — |
| disabled | off-clock, or `mode === "answer"` | cluster never opens; the click opens the inspector | inspect |

### Refusal copy — normative  [M7]
When a card affords nothing, the message appears **within 40px of the card**, not at the far
edge of the screen, and it uses game words. "No legal verbs for that card right now" is
implementation vocabulary; no player knows what a verb is.

| Case | Copy |
|---|---|
| monster in MZONE, Battle Phase, absent from `attacks[]` | `This monster has already attacked.` |
| anything else | `Nothing you can do with this card right now.` |

**We do not generate a reason in the general case, and this is deliberate.** ocgcore does not
say *why* it omitted a card; a fabricated reason would be a rules claim, and a rules-explanation
layer was explicitly dropped. The one exception above is derivable from state we hold
(`attacks[]` membership during BP), not from inference. [M7, partially rejected]

### Placement rule  [m5]
The cluster is anchored above the card, and **flips below it whenever it would cover the phase
rail**. Losing sight of the current phase while choosing an attack is not an acceptable trade.

### Acceptance criteria
- [ ] A monster with 3 legal verbs shows 3 chips, in the global order, with `Inspect` last.
- [ ] The tribute cost is on the chip, with its unit, before the player commits. Backend **ND-1**.
- [ ] `Esc`, click-away, and a new `DECISION` frame all dismiss the cluster with no response sent.
- [ ] The cluster renders a visible `Esc closes — costs nothing` hint. [B2]
- [ ] The cluster never overlaps the phase rail. [m5]
- [ ] Clicking an opponent card or a pile never opens a cluster.

---

## 4 · `IntentRibbon`

**Job:** make 2–6 engine decisions read as one player action, and draw the point of no return.
**Existing component?** none (new). There is nothing like it in the codebase.

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `intent` | `PendingIntent` | ✓ | — | `{label, cardCode, steps[], stepIndex, commitAt, cancelable, trailingUnknown}` |
| `onCancel` | `() => void` | ✓ | — | maps to the **current** decision's cancel response |

### Step templates (client-owned; the engine does not announce step counts)
| Verb | `steps[]` | `commitAt` |
|---|---|---|
| Summon (no tribute) | `["Zone"]` | 0 |
| Tribute Summon | `["Tributes","Zone","Position"]` | 1 |
| Set | `["Zone"]` | 0 |
| Special / Synchro / Ritual | `["Materials","Position","Zone"]` | 2 |
| Activate | `["Target"]` | — (no zone step) |
| Attack | `["Target","Declared"]` | **1** [M11] |

`trailingUnknown: true` renders a `…` step wherever a trigger may or may not fire. **Do not invent
a step count you cannot know.**

**One commit model, everywhere.**  [M11] Revision 1 gave the summon flow a lock and left the
attack flow with no lock and a live Cancel that persisted *after* the opponent gained priority.
A player who learns "the lock means committed" from summoning then infers attacks are never
committed — and in Edison a declared attack cannot be rescinded. The resolution follows the
engine, not a preference: the attack **target** step is cancelable (`SELECT_CARD` arrives with
`can_cancel: true`), and once it is answered the attack is **declared** and the ribbon shows
`COMMITTED`. This also answers evaluator open question 2.

**The lock is captioned in words.**  [M1] A bare glyph carried the entire commit model with no
title, no legend and no explanation. The ribbon now renders a persistent second line:
`▮ past this point you cannot cancel`, and the confirm button of the last cancelable step says
`— cannot be undone` in words.

**The step budget is visible text, not a hover title.**  [M13] `3 steps · 2 left · possibly more,
if a trigger fires`, inline. "How many more decisions am I buying?" is the question a player asks
*before* committing, while their clock runs; it cannot live behind a hover on an ellipsis.

**The ribbon's control says what it cancels.**  [m1] `Cancel summon` / `Cancel attack` — never a
bare `Cancel`, because the Question Bar has one too and they are different scopes: the ribbon
cancels the intent, the bar cancels the step.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | intent live, pre-commit | step dots, current pulsing, live `Cancel` | cancel |
| loading | between sub-decisions | identical ribbon, dot animating — **nothing unmounts** | wait |
| empty | no intent | ribbon absent (not an empty box) | — |
| committed | `stepIndex ≥ commitAt` | `Cancel` replaced by flat `COMMITTED` | answer only |
| error | sub-answer rejected | amber underline + `Not accepted` | re-answer that step |
| disabled | duel ended mid-intent | greyed | — |

### Acceptance criteria
- [ ] The ribbon's DOM node is not replaced between sub-decisions of one intent.
- [ ] The confirm button of the step at index `commitAt - 1` carries the lock in its label.
- [ ] `Cancel` is never shown when the current decision has no cancel response.
- [ ] An intent that ends in a negated summon shows `Summon negated` for 600ms before unmounting —
      it does not silently vanish.
- [ ] The lock has a visible textual caption in the ribbon at all times it is present. [M1]
- [ ] The remaining-step count is rendered as text, never only as a `title`. [M13]
- [ ] The ribbon's cancel control names its scope. [m1]
- [ ] After an attack target is answered, the ribbon shows `COMMITTED` and no cancel control
      exists anywhere on screen for that attack. [M11]

---

## 5 · `ChainStrip`

**Job:** show what is on the chain and what is resolving, unprompted.
**Existing component?** none. `ChainPanel` was specified 2026-07-16 §2.8 and never built.

### Props
| Prop | Type | Required | Default |
|---|---|---|---|
| `links` | `ChainLink[]` | ✓ | — |
| `mySeat` | `Seat` | ✓ | — |
| `onHover` | `(code: number) => void` | | — |

`ChainLink = {ordinal, code, owner, location, state: "declared"|"resolving"|"resolved"}` — built
client-side from `MSG_CHAINING`(70) / `CHAINED`(71) / `CHAIN_SOLVING`(72) / `CHAIN_SOLVED`(73) /
`CHAIN_END`(74). `chain_size` is already on the wire.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | 1–4 links | ordinal + name + owner tint | hover → inspector |
| empty | no chain | strip absent | — |
| loading | identity not yet resolved from `/api/cards` | ordinal + grey tile + name | hover |
| compressed | ≥ 5 links | links 1–4 full, 5+ as ordinal dots | hover to expand |
| resolving | `CHAIN_SOLVING` | resolving link outlined; **its text auto-pushed to the inspector** | read |
| error | unknown passcode | tile shows `?` + the passcode | hover |
| disabled | duel ended | fades out | — |

### Acceptance criteria
- [ ] A 12-link chain fits in one 720px strip with no horizontal scroll and no wrap.
- [ ] The strip persists across the multiple `ChainPrompt`s one chain produces.
- [ ] `CHAIN_SOLVING` pushes that link's card text to the inspector with zero clicks.

---

## 6 · `DuelBoard`, `ZoneSlot`, `CardTile`, `PileBadge`

**Job:** the whole game state at a glance, and the primary thing the player acts on.
**Existing component?** `packages/web/src/components/DuelBoard.tsx` — **rewrite**, keeping the E2E
`data-testid` contract (`duel-board`, `phase-ribbon`, `face-down-card`, `face-up-card`,
`resign-btn`, `duel-end-banner`).

### `CardTile` props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `card` | `ZoneCard` | ✓ | — | **MH-1**: needs `sequence`, `attack`, `defense`, `level`, `isPublic` |
| `owner` | `Seat` | ✓ | — | ownership colour law |
| `mySeat` | `Seat` | ✓ | — | |
| `target` | `boolean` | | `false` | candidate of the pending decision |
| `selected` | `boolean` | | `false` | |
| `actionable` | `boolean` | | `false` | affords a verb right now (subtle glow) |
| `spent` | `boolean \| undefined` | | — | monster absent from `attacks[]` → the badge greys and reads `USED` [m18] |

### `CardTile` states
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | face-up | art, name, ATK/DEF, position glyph | click |
| own set card | face-down **and mine** | **translucent, readable** | click |
| their face-down | face-down and theirs | card back — no fabricated identity | click → inspector says "Face-down card" |
| **their face-up** | face-up and theirs | **fully rendered.** `DuelBoard.tsx:48`'s `if (hidden \|\| !isOwn)` is deleted | click → inspector |
| loading | card record in flight | frame stripe + name from the decision, shimmer on stats | click |
| empty | no card in slot | dashed owner-tinted outline | drop target during zone choice |
| error | passcode unknown to the card DB | `#{code}` and no stats | click |
| disabled | dimmed by the dim law and not a candidate | 45% | click → inspector only |

### The dim law — implementation note
Do **not** implement it as `opacity` on containers: a candidate in a dimmed container cannot be
lifted back out. Use a `DimScrim` at `z-index: 2` covering the stage, and give
`.target` / `.selected` cards `position: relative; z-index: 3`. Verified in the prototype.

### `PileBadge`
Fixed labelled slot, **large numeral count**, always present, always clickable — including
off-clock and after the duel ends. Opens `PileInspector`.

### Acceptance criteria
- [ ] An opponent face-up monster renders its art, name and ATK/DEF.
- [ ] **A face-up defence-position monster is rotated 90° and shows DEF as the prominent stat.**
      [M4] Revision 1 said only "visually distinguishable", and the prototype rendered defence
      upright with ATK forward — indistinguishable from attack position, so a player could not
      read the board state they had just created. Every other client in the teardown rotates the
      card; this is the convention the audience reads a board by, and it is verifiable
      (`getComputedStyle(el).transform !== "none"`).
- [ ] A face-down defence monster is the card back, rotated. [M4]
- [ ] Every pile shows a numeral count, including `0`.
- [ ] Opponent hand shows a numeral, not something to count by eye.
- [ ] No Extra Monster Zone, Pendulum Zone or Link marker is rendered anywhere.
- [ ] A candidate card is at full opacity while the rest of the board is dimmed, whether it is in
      the hand, on the field, or reachable through a pile badge — **including when the dock would
      otherwise cover its row.** Candidates are lifted above the dock with a drop shadow, so the
      dim law's promise holds in every layout.
- [ ] The attack-availability badge is a **labelled** badge (`ATK` / `USED`) clear of the card
      title, not a sub-8px glyph over it. [m18] Weighed against the teardown: every client in the
      set marks attack availability *somewhere*, and none of them relies on a mark small enough to
      collide with the card name.
- [ ] A card being placed by an as-yet-unanswered `SelectZone`/`SelectPosition` renders as a
      **translucent dashed ghost** until placement resolves, never as a settled card. [m6]

---

## 7 · `PhaseRail`

**Job:** be both the phase display and the phase-advance control, permanently.
**Existing component?** the phase ribbon inside `DuelBoard.tsx` (replace).

| Prop | Type | Notes |
|---|---|---|
| `phase` | `PhaseName` | **NH-4** — a named enum, not the invented integer encoding duplicated at `EdisonDuel.ts:99-112` and `DuelBoard.tsx:21-32` |
| `turnOwner` | `Seat` | tints the rail |
| `legalPhases` | `PhaseName[]` | from `toBattlePhase` / `toEndPhase` / `toMainPhase2` |
| `onAdvance` | `(p) => void` | |

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | my turn | all six phases, current lit, legal ones clickable | advance |
| theirs | their turn | rail tinted red, nothing clickable | — |
| loading | no state yet | rail present, all dim, "Dealing…" | — |
| empty | N/A | — | — |
| error | unknown phase value | renders the raw value; rail still works | — |
| disabled | off-clock or duel ended | all cells inert at 22% | — |

### Acceptance criteria
- [ ] `End Turn` is reachable at all times during my turn, whether or not a decision panel exists.
      *(Today it lives at `IdleCommandPanel.tsx:211-221` and vanishes with the panel.)*
- [ ] No separate "next phase" button exists anywhere.
- [ ] **The current phase is the highest-contrast element on the rail.** [m16] It must not inherit
      a disabled treatment merely because it is not a legal *destination* — "where am I" outranks
      "where can I go". Verifiable: computed opacity of the current cell ≥ every other cell.

---

## 8 · `EventLogRail`

**Job:** "what just happened" — game state, not teaching.
**Existing component?** none (`DuelLogRail` specified 2026-07-16 §2.7, never built).

| Prop | Type | Notes |
|---|---|---|
| `events` | `DuelEvent[]` | **MH-2** |
| `open` | `boolean` | collapsed by default; preference persisted |
| `lpByTurn` | `Record<number,[number,number]>` | snapshot at each turn boundary |

Row shape: `thumbnail · name (owner-tinted) · verb · from → to`. Grouped: turn banner (owner-tinted)
→ LP snapshot → phase header → rows. **No prose sentences.**

**LP movement is attributed to the seat that lost it.**  [m14] `Damage −1200` on the attacker's
row reads as damage *taken*. A damage row must render `Sakura −1200 LP`, which requires the event
to carry which seat's LP moved — see backend delta **ND-4**.

**The rail OVERLAYS the board; it never reflows it.**  [m13] Expanding it in revision 1 shrank the
board from 1260px to 1030px and moved every card under the cursor mid-duel. The rail is absolutely
positioned over the right edge, and the board reserves only the 34px collapsed spine.

**One entry point.**  [m11] A labelled `Log` control carrying its own `L` shortcut. The bare
second glyph is deleted.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| collapsed | default | 32px spine + unread dot | expand |
| default | events exist | grouped rows, auto-scrolled | scroll / search / filter / click → inspector |
| empty, turn 1 | duel just started | `The duel has not started.` | — |
| empty, turn > 1 | joined or reconnected mid-duel | `Earlier turns are not available.` — **never "the duel has not started"** [M12] | — |
| empty-after-filter | filter excludes all | `No {filter} events this duel.` + `Clear filter` | clear |
| loading | reconnect backfill | skeleton rows + `Restoring log…` | wait |
| partial | reconnect with no persisted log (**NH-2**) | dashed `— log resumes here —` rule | scroll |
| error | unrecognised event type | `Unrecognised event ({type})`; the rail keeps going | — |
| disabled / ended | `DUEL_END` | final `Duel ended — {reason}` row; rail auto-expands | read |

### Acceptance criteria
- [ ] Every event type listed in MH-2.1 produces a row.
- [ ] No row contains a sentence with a verb conjugated against a player name.
- [ ] Search matches card names; filter chips are additive to search.
- [ ] Collapsed, the rail costs ≤ 34px of board width, and **expanding it does not change the
      position of any card on the board.** [m13]
- [ ] The log never claims the duel has not started while `turnNumber > 1`. [M12]
- [ ] A damage row names the seat whose LP changed. [m14]
- [ ] Exactly one control opens the log, and it displays its keyboard shortcut. [m11]

---

## 9 · `ClockPanel` — REWRITTEN  [M8][M9][B5]

**Job:** answer "how long do I have?" at any instant, given that the clock runs **per handover of
control** and **a timeout forfeits the duel**.
**Existing component?** `packages/web/src/components/DuelTimer.tsx` (extend).

Revision 1 specified **one** clock, owner-tinted. That was wrong, and it is the finding closest to
blocker-grade outside the blockers themselves:

- ownership was carried by **colour alone**, with no label;
- only the *active* clock was ever rendered, so while off-clock the player could see the
  opponent's remaining time and **not their own** — which is precisely the number needed to decide
  whether to spend time thinking;
- with a per-handover clock, your banked time is a resource you carry across the opponent's whole
  turn. Hiding it makes the resource invisible.

### Structure
```
<ClockPanel>                       ← left end of the phase rail, always present
  <ClockRow seat="me"    label="You"      state="running|banked" />
  <ClockRow seat="opp"   label={name}     state="running|banked" />
  <ForfeitWarning />               ← only at urgency ≥ warn
```

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `myDeadlineAt` | `number \| null` | ✓ | — | server-authoritative; local tick is display only |
| `oppDeadlineAt` | `number \| null` | ✓ | — | requires backend **ND-5** |
| `onClockSeat` | `Seat` | ✓ | — | drives which row is `running` |
| `mySeat` | `Seat` | ✓ | — | |

### Both clocks are always rendered. Both are labelled. Neither relies on hue.
Each row shows: the player's name, the numeral, and the word `RUNNING` or `BANKED`. The active row
is outlined at double border weight. Colour is redundant reinforcement, never the only channel.

### Urgency escalation — normative, and it applies only to YOUR clock
| Remaining (yours) | Treatment |
|---|---|
| > 60s | 14px numeral, ordinary row |
| ≤ 60s | numeral to 17px, row border amber, standing line `timeout forfeits the duel` |
| ≤ 30s | numeral to 20px, row background amber-tinted |
| ≤ 10s | row inverts to a filled amber alarm plate, numeral 22px, 2px board-edge pulse, line reads `{n}s — TIMEOUT FORFEITS THE DUEL` |
| 0 | `DUEL_END{reason:"timeout"}` handling — a terminal result card, never a stuck screen |

The opponent's row does **not** escalate. Their running out is not your emergency, and animating
it would be one more thing competing with the question you are answering.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | both known, > 60s | two labelled rows, active one outlined | — |
| warning / high / alarm | thresholds above, **your** clock | escalation table | hurry |
| loading | no `CLOCK` frame | `—:—`, **never `0:00`** | — |
| empty | N/A — a duel always has clocks | — | — |
| error / disconnected | socket not open | both rows grey with `?`, ticking stops; the reconnect banner owns the truth | reconnect |
| expired | your clock hits 0 | duel-end overlay, reason `timeout` | leave / review |
| opponent expired | their clock hits 0 | duel-end overlay, you win on time | leave / review |

### The in-question clock is LABELLED  [M9]
The bar's clock track duplicates the turn clock, and in revision 1 its position made it read as a
per-question timer — a player would mis-scale their thinking time from it. It now carries the text
`YOUR TURN CLOCK m:ss` inside the track. Either label it or remove it; an unlabelled progress bar
next to a question is a lie about scope.

### Acceptance criteria
- [ ] Both clocks are visible in every mode, including while off-clock and after the duel ends.
- [ ] Each clock's owner is identified by **text**, not only by colour.
- [ ] Each clock states whether it is running or banked.
- [ ] Your clock is visually distinct at > 60s, ≤ 60s, ≤ 30s and ≤ 10s. Verifiable: computed
      font-size and background of the row differ across all four bands. [B5]
- [ ] Your clock reaching 0 produces a terminal result card within one animation frame; it never
      sits at `0:00`. [B5]
- [ ] The clock does **not** reset between sub-decisions of one intent. Requires backend **NH-3**;
      until it ships, the *displayed* clock is the minimum seen since the seat became on-clock, so
      the UI never lies in the player's favour.
- [ ] The in-bar clock track is labelled with what it measures. [M9]

## 10a · `CardArt` — NEW

**Job:** show the real card face, and fail invisibly when it cannot.
**Existing component?** none (new). URL resolution already exists:
`packages/web/src/utils/cardImageUrl.ts`, which reads `VITE_IMAGE_BASE_URL` — **reuse it, do not
hardcode a host.**

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `code` | `number` | ✓ | — | passcode. `0` (face-down/unknown) renders nothing and is **not** a failure |
| `width` | `number` | ✓ | — | height is derived from the ratio so the box never changes shape |
| `fill` | `boolean` | | `false` | absolutely fill the parent tile; the tile's own overlays sit on top |
| `eager` | `boolean` | | `false` | the inspector's art is the thing the player asked for — never defer it. Everything else lazy-loads |

### Data bindings
| Field | Source | Shape |
|---|---|---|
| image URL | `cardImageUrl(passcode)` → `${VITE_IMAGE_BASE_URL}/${passcode}.jpg` | public static JPEG |
| intrinsic size | **813 × 1185** (measured from the served files) — the FULL card face, not an art crop | ratio `813/1185` |
| passcode | `ZoneCard.code` / `CardEntry.code` / `ChainLink.code` | already on the wire |

**No backend delta.** These are public static files with no auth and no CORS setup needed for
`<img>`.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default (`ok`) | image decoded | the card face, faded in over 120ms | — |
| loading | request in flight | a placeholder at the **exact aspect ratio**, slow shimmer. Never a spinner — the surrounding text is already readable | everything else |
| failed | `onError`, **or no load within 5000ms** | **nothing is rendered.** No box, no icon, no gap | everything else |
| empty | `code === 0` | nothing. A face-down card has no art we are entitled to show, and this is not an error state | — |
| error | same as failed | — | — |
| disabled | N/A | — | — |

### Acceptance criteria
- [ ] The intrinsic aspect ratio is reserved while loading, so no surface reflows when an image
      lands. Verifiable: the panel's height is identical before and after load.
- [ ] `failed` renders **zero** DOM. Verifiable: with the image host blocked, the page contains no
      `<img>` with `naturalWidth === 0` and no art node at all.
- [ ] A request that never resolves resolves to `failed` within 5s. **An unbounded placeholder is
      the hole this state machine exists to prevent.**
- [ ] An unknown passcode — which the host answers with a JSON 404, not an image — reaches
      `failed`. A `200` is not a guarantee of a JPEG; rely on `onError`, not on the status.
- [ ] No surface waits on an image. Board, clocks, phase rail and all text render while images are
      in flight. Verified with the host throttled and with it removed.
- [ ] `alt=""` and `aria-hidden`. The image duplicates text that is already on the page; naming it
      would make a screen reader say the card twice.

## 10b · `ProvenanceBadge` — NEW

**Job:** tell the player, in one clause, that our rendered text is not the text printed on the
card image they are looking at.
**Existing component?** none (new).

**Why it exists.** The card image is the **modern, post-errata printing**. Our rendered text is the
**2010 text the engine actually enforces**. For 36 cards those disagree, and the inspector shows
both at once — Sangan says one thing in the image's text box and another in our record, six inches
apart, on the first screen of the flagship flow.

**Why it is not a rules explanation.** It states a fact about *our data*: our text differs from
that printing. It does not say what differs, why Edison differs, what the card does, or what to do.
Per the CEO: *"saying our text differs from the printing is a fact about our data, not a rules
explanation. That's the line."*

### Copy — normative, and this is the hard part of the component
> **`Edison text differs from this printing`**

**One clause. If you are writing a second clause you are explaining.** The correct text is the very
next thing on the page, so the badge does not have to carry any of it. Specifically it must not:
name the difference, say "pre-errata" as a justification, mention the year, link to a source,
compare the two wordings, or hint at play consequences.

### Placement — normative
**Directly beneath the image, above the name.** It sits at the *seam* between the two things it
reconciles: it reads as a caption on the image (`this printing`) and as an introduction to the
record below it (`Edison text`). The eye path is image → badge → text, in that order.

Not on the image (it would obscure the card face, which is what the image is for) and not in the
meta line (that line is a type/stat readout; a provenance note there mixes two kinds of information
and is easy to miss). Caption weight, not alert weight — it is a fact, not a warning.

### The rule for WHERE it appears, which is not "the inspector"
> **The badge appears wherever a card image and our rendered effect text are shown together.**

Today that is exactly one surface, the inspector. Stating the rule rather than the location tells
engineering what to do when a future surface shows both.

| Surface | Badge? | Why |
|---|---|---|
| `CardInspector` | **yes** | image + full rendered text, together |
| Question Bar candidate thumbnails | no | art + name only. No effect text to contradict |
| Question Bar `TextPane` | no | rendered effect text but **no image**. Nothing on screen to differ *from* |
| Board / hand tiles, pile grid | no | art + name/stats. No effect text |
| Chain strip, log rows | no | neither |

### The state interaction that is easy to miss
**No printing on screen → no badge.** If the art is `loading` or `failed`, there is no "this
printing" for the player to see, and a badge contrasting our text with an invisible image would be
a statement about nothing. The badge is gated on `CardArt` reporting `ok`, which is why `CardArt`
lifts its state (§10a `onState`).

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| — | — | — | — | The badge takes no props. Whether to render it is the caller's decision, from the data binding below |

### Data bindings
| Field | Source | Shape |
|---|---|---|
| is this card overridden? | **`CardDTO.preErrataText`** — see backend delta **ND-6** | `boolean` |
| is a printing visible? | `CardArt` `onState === "ok"` | `ArtState` |

**Key off set membership, never a hand-list.** The corpus is
`packages/card-data/src/preErrataDescOverrides.json` (36 cards). A card that gains or loses an
override must gain or lose the badge with **no UI change**. In the prototype the set is *generated*
from that file into `src/fixtures/preErrata.ts`; in the real client it rides on the DTO.

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | overridden card **and** art `ok` | the badge | read the text below it |
| empty | not an overridden card | nothing | — |
| art loading | art not yet `ok` | nothing — the badge appears with the image | — |
| art failed | no image at all | nothing. There is no printing to differ from | read the text, unchanged |
| loading | N/A — the flag arrives with the `CardDTO` | — | — |
| error | `CardDTO` missing the field | **nothing.** Absent flag means no badge; never guess | — |
| disabled | N/A | — | — |

### Acceptance criteria
- [ ] The badge renders for all 36 passcodes in the override corpus and for **no others**.
      Verifiable by iterating the corpus, not by checking a sample.
- [ ] The badge renders **only** while `CardArt` is `ok`. With the image host blocked, an
      overridden card shows the record with no badge.
- [ ] The copy is one clause and contains no description of the difference.
- [ ] Adding a 37th entry to the override corpus badges that card with no change to any component.
- [ ] The rendered text for an overridden card is the corpus's `preErrataDescClean`, verbatim.
      A badge asserting provenance over paraphrased text is worse than no badge.

## 10 · `CardInspector` and `PileInspector`

**Existing component?** `packages/web/src/components/duel/CardInspector.tsx` (extend) /
`packages/web/src/components/CardInspector.tsx` (two files exist today — consolidate to one).

| Prop | Type | Notes |
|---|---|---|
| `code` | `number \| null` | `null` → **component absent**, not an empty frame |
| art | `<CardArt code={code} width={228} eager />` at the top, **above** the rendered record | §10a |
| provenance | `<ProvenanceBadge />` between the art and the name, when `CardDTO.preErrataText && artState === "ok"` | §10b |
| `source` | `"hover" \| "click" \| "autopush"` | `click` pins; `autopush` queues behind a pin |
| `onClose` | `() => void` | |

Auto-push triggers: opponent activation (`MSG_CHAINING`), and `CHAIN_SOLVING` on any link.

### Image AND rendered text — the decision, and why it is not either/or
The served image is the **full card face**, so it already contains the name, type line, stats and
effect text. Dropping our rendered text would still be wrong:

| | image | rendered text |
|---|---|---|
| recognise the card in <200ms | ✔ | ✖ |
| read the effect at panel width | ✖ unreadable | ✔ |
| select / search the text | ✖ | ✔ |
| screen reader | ✖ | ✔ |
| **our** pre-errata corpus rather than the printed errata | ✖ | ✔ |

So: image on top for recognition, rendered record below for reading. This is Master Duel's
inspector and it is the reason it has both.

### Where art appears, and where it deliberately does not
| Surface | Art? | Why |
|---|---|---|
| `CardInspector` | **yes**, primary | the surface whose whole job is "what is this card" |
| `PileInspector` grid | **yes**, lazy | scanning a pile means recognising a picture, not reading twenty labels |
| Question Bar **candidate thumbnails** | **yes** | this is the answer space — the place you are choosing *between* cards. The Master Duel frame we are copying (`masterduel-chain-prompt-and-log.jpg`) shows exactly this: candidates as card thumbnails with location badges |
| Question Bar **`TextPane`** (`RESPONDING TO` / `YOU WOULD PLAY`) | **no** | it sits directly beside the thumbnail, which already carries recognition. Its job is reading, mid-decision, under a clock. Adding a second copy of the same card costs width and buys nothing |
| Board / hand tiles | **yes, behind the tile's own overlays** | the name, ATK/DEF, position glyph, ownership outline, targeting outline and `ATK`/`USED` badge all stay on top with a scrim. Art alone at 58×82 cannot carry that state; art *plus* the overlays reads as Yu-Gi-Oh without losing a single annotation. **Revisit if the CEO wants larger tiles** — at a bigger size the stats should move off the card face, as Master Duel floats them |
| Chain strip links | **no** | ordinal + name + owner colour is a *sequence* readout; thumbnails would make a 12-link chain unreadable |
| Event log rows | **no** | already a dense scrolling list; the frame-coloured bar carries type at a glance |

**Scope narrowed.**  [M5][M6][m3] The floating inspector is the channel for *what is happening* —
auto-pushed opponent activations and resolving chain links. It is **not** the channel for
"the candidate I just clicked in the Question Bar"; that text belongs in the bar's own `TextPane`,
next to the buttons. Revision 1 routed both through one panel in the opposite corner of the
screen, ~700px from the click, and they overwrote each other.

### States (CardInspector)
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | inspecting | full record | scroll, Esc |
| loading | `/api/cards` in flight | name + shimmer | Esc |
| empty | nothing inspected | absent | — |
| unknown | passcode not in DB | `Unknown card ({code})` | Esc |
| hidden | `code === 0` | `Face-down card` + location; no fabricated identity | Esc |
| error | fetch failed | `Card text unavailable — retry` | retry / Esc |
| pinned | click-entered | blue edge rule; auto-push queues with a `1 new` chip | unpin |

### Acceptance criteria
- [ ] Opening a pile is never broadcast to the opponent — **no client message is sent**.
- [ ] A pile inspector opens for an empty pile and says so; the click is not swallowed.
- [ ] An auto-push never replaces a pinned card.
- [ ] With the image host unreachable, the inspector renders **exactly** its pre-art layout —
      frame stripe, name, meta line, effect text, close — and every other surface keeps its
      labelled tiles. No surface loses information when art is unavailable.
- [ ] The pile grid degrades per-tile: one missing image costs one tile, never the grid.

---

## 11 · Auto-resolve rules (implementation-level)

Implement as one pure function, so it is testable in isolation and reviewable in one place:

```ts
// packages/web/src/duel/autoResolve.ts
export function autoAnswer(
  d: DuelDecision,
  prefs: { chooseZones: boolean },
): DuelDecisionResponse | null;
```

Return non-null **only** for the cases in `surface-inventory.md` §15. Returning non-null for
anything else is a product bug, not a style choice.

### Acceptance criteria
- [ ] `autoAnswer` returns `null` for every `IdleCommand`, `BattleCommand`, `SelectYesNo`,
      `SelectEffectYN`, `AnnounceCard`, `AnnounceNumber`, and any decision with `min !== max`.
- [ ] Auto-answered `SelectTribute` / `SelectCard` still flash the affected cards on the board and
      still write log rows. **Auto-answer is not auto-hide.**
- [ ] Every auto-answered decision renders an `AutoAnswerReceipt` (§2b) — never a `QuestionBar`.
      [B1][M2]
- [ ] `chooseZones: true` disables `SelectZone` auto-answering except when `zones.length === 1`.
- [ ] Every auto-answer is unit-tested against a fixture in `spikes/duel-ui-proto/src/fixtures/`.

---

## 11b · `ResponsePromptControl` — REWRITTEN  [M10]

**Job:** let the player choose how often the engine interrupts them, and know what they chose.
**Existing component?** none (new). Replaces the "three-state cycling chip".

Revision 1 specified a chip that cycles `OFF → Auto → ON`. That fails on three counts: the states
are never explained, the option set is invisible until you click through it, and you cannot step
back without a full cycle. Worse, `OFF` plausibly reads as "never prompt me to respond", which
sounds like it could silently lose a duel.

### Structure — a labelled menu, not a cycler
```
[ Response prompts: Standard ▾ ]
  ┌────────────────────────────────────────────────┐
  │ Minimal        Only mandatory effects and      │
  │                certain triggers.               │
  │ Standard  ✓    Also on summons, attacks and    │
  │                activations.                    │
  │ Every window   Also every phase change and     │
  │                battle step.                    │
  ├────────────────────────────────────────────────┤
  │ Mandatory effects are always offered, whatever │
  │ this is set to — this cannot make you miss a   │
  │ forced response.                               │
  └────────────────────────────────────────────────┘
```

The three states map exactly onto Master Duel's documented `OFF / Auto / ON`; only the labels
change, because `OFF` was read as "off" rather than "fewest prompts". Default is **Standard**,
matching all three reference clients. The standing note under the list is the answer to evaluator
open question 1 and must ship with the control.

### Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `value` | `"Minimal" \| "Standard" \| "Every window"` | ✓ | `"Standard"` | persisted per player |
| `onChange` | `(v) => void` | ✓ | — | |

### States
| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| default | closed | `Response prompts: Standard ▾` — the state is legible without opening | open |
| open | clicked | three labelled options with descriptions + the standing note | choose / dismiss |
| loading | N/A | — | — |
| empty | N/A | — | — |
| error | preference write failed | reverts to the previous value with a one-line notice | retry |
| disabled | duel ended | inert | — |

### Acceptance criteria
- [ ] The current state is readable without opening anything.
- [ ] All three options and their descriptions are visible in one view. [M10]
- [ ] The "mandatory effects are always offered" note is present in the same view.
- [ ] The held-key modifier is **nice-to-have and must not be advertised until it works.** The
      revision-1 tooltip promised `hold A to widen, D to narrow`; nothing was bound, and the
      vocabulary did not match the labels. Documented interactions that do nothing are worse than
      undocumented ones. [m12]

## 12 · Backend delta

### Already in `docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md` — required by this design

| # | Item | Why this design needs it | Must / nice |
|---|---|---|---|
| MH-1 | `ZoneCard.sequence`, dense arrays, typed `attack`/`defense`/`level`/`isPublic`, `p*_fzone`, turn number | Board targeting, click-to-attack, drag-to-zone, the whole ACT mode | **must** |
| MH-2 | Complete, correctly-routed event feed (Cuts 1–4) | Question Bar line 1, chain strip, log rail, auto-push, off-clock narration. **The chain-response flow cannot ship without it** | **must** |
| MH-3 | Decision caption + activating effect + chain stack | `SelectCard` sentences; `ChainPrompt` naming the trigger | **must** |
| MH-4a | Explicit `SelectZone` commit point (web-only) | the 🔒 in the Intent Ribbon | **must** (web-only) |
| NH-1 | card names/ATK/DEF/text from `/api/cards` | already served; needs a duel-scoped cache | must (web-only) |
| NH-2 | Event persistence across reconnect | the log rail's `partial` state exists **because** this is missing | nice |
| NH-3 | Per-intent clock | one clock across a six-decision summon | **must** — the CEO has ruled the clock is per handover. §9's escalation is meaningless if the clock resets mid-intent |
| NH-4 | Named phase enum | `PhaseRail`; kills two hand-maintained tables | nice |
| NH-5 | Extra-deck visibility audit | possible hidden-info leak | must, if confirmed |

### New — discovered here, not in that document

**ND-1, ND-4 and ND-5 are APPROVED**, not proposed. On ND-5 the CEO: *"especially. I've got both
clocks on my screen right now and I'd rather they were real than faked."* The two-clock panel in
§9 is therefore confirmed product, not prototype dressing, and it needs both deadlines on the wire
to be honest.

| # | Item | Why | Must / nice | Size |
|---|---|---|---|---|
| **ND-1** | **Surface the tribute cost on `CardEntry` in `IdleCommand.summons[]`.** The raw `SELECT_IDLECMD` message carries `release_param` (confirmed in `decision-capture-raw.json` → `SELECT_TRIBUTE`); `messageToDecision.ts:505-515` reads it as a type alias (`:228`) and discards it | Without it the verb chip cannot read `Tribute Summon (2)` and the player learns the cost **after** committing. Part 1 R1.5 identifies the need; Part 2 does not list it as a delta | **must** ✅ **APPROVED by the CEO** | S–M. Either an additive optional `releaseCount?: number` on `CardEntry` (**additive change to a locked variant → needs a CTO ruling against ADR-0001**) or a sidecar frame alongside the decision, consistent with MH-3's recommended shape. **Sidecar is my recommendation** — same outcome, ADR untouched |
| **ND-2** | **Intent recovery on reconnect.** The pending-intent object is client-only. On reconnect the server re-sends `SEAT_ASSIGNED`+`STATE`+`CLOCK`+`DECISION` (`duelSocket.ts:311-349`) and the client can name the card but cannot know *which step of which intent* it is on | The ribbon degrades to a single-step ribbon after a reconnect mid-summon. Tolerable, but it should be a known degradation and not a bug report | nice | S. Either the client persists the intent in `sessionStorage`, or MH-3's sidecar carries an intent correlation id |
| **ND-3** | **`IdleCommand.shuffle` is answerable but unadvertised.** `responseToOcgResponse.ts:101` maps `"shuffle"`, the raw message has `shuffle: true`, and `messageToDecision.ts:275-352` never reads it | Not needed by this design — there is no shuffle verb. Listed so it is decided rather than left as dead surface: either advertise it or drop the response value | nice | S |
| **ND-4** | **Damage/LP events must name the seat whose LP moved.** `MSG_DAMAGE`(91) carries `player`, but `MSG_PAY_LPCOST`(100) and the battle-damage path do not consistently identify the losing seat in a form the log can render | Without it a log row reads `Caius — Damage −1200`, which a player reads as damage *taken by Caius*. The row must read `Sakura −1200 LP` | **must** ✅ **APPROVED by the CEO** | S. Server-local, inside MH-2a's normalisation — no contracts change |
| **ND-5** | **Both seats' deadlines must be on the wire.** `CLOCK` carries `{onClockSeat, deadlineAt}` — one deadline, the active one. The design now requires **both** clocks permanently (§9/M8) | A player off-clock cannot see their own banked time, which is the number they need to decide whether to think. With a per-handover clock this is not a nicety | **must** ✅ **APPROVED by the CEO** | S. Additive: `CLOCK` gains `deadlines: [number, number]`, or `deadlineAt` is sent per seat. `DuelServerMessage` variant is additive, so nothing breaks |
| **ND-6** | **`CardDTO` must carry a `preErrataText: boolean`.** `packages/card-data` already applies `preErrataDescOverrides.json` when it builds the catalog, so it knows which cards it overrode; today it discards that knowledge. `CardDTO` is `packages/contracts/src/card.ts` and is already returned by `GET /api/cards?passcodes=` | The provenance badge (§10b) keys off it. The only alternative is shipping the 36-passcode corpus into the web bundle, which duplicates card-data and drifts silently the moment an override is added | **must** (blocks §10b) | S. Additive optional field on an existing DTO. No duel-wire change, no new endpoint, no engine change. `web` reads it from a response it already fetches |

### Constraints inventory
- **Live users:** near-zero usage — that is the premise of the project. There is no meaningful
  install base to break.
- **Production data:** duel state is server-derived per snapshot; the response log is persisted and
  replayed (`duelStore.appendResponseLog` → `replayEdisonDuel`). MH-1 changes the *snapshot*, not
  the response log, so **replay of existing duels is unaffected** if the new fields are optional.
- **Migrations:** none required if MH-1 fields land as optional.
- **Cannot break:** the E2E `data-testid` contract listed in §6; the response-log replay path;
  ADR-0001's 20-variant union.

---

## 13a · Deferred findings, and the capability each one waits on

Three findings from the usability pass were recorded as **rejected**. That was the wrong word.
They are **deferred**, and each is waiting on a specific thing — named here so that whoever adds
that thing knows what it unblocks, and so nobody has to reverse a decision to bring them back.

### The principle they turn on — Requirement H
> **H rules out causes we GENERATE, not causes the engine gives us.** — CEO

That is the whole test. A cause we *invent* by reasoning about the rules is a rules-explanation
layer and is out. A cause the engine, the card corpus, or the wire *hands us* is data, and
presenting data is not explaining. The provenance badge (§10b) is on the right side of that line
because we know for a fact that we substituted the text — it is a property of our own corpus. The
three below are on the wrong side **today** and cross over the moment their cause reaches us.

| Finding | What it asked for | Why deferred, not rejected | **Unblocks when…** |
|---|---|---|---|
| **M5** (part) | The confirm control should read `Activate Solemn Judgment — pay 4000 LP` | The cost is not on the wire. Producing "4000" means parsing *"Pay half your LP"* out of card text and doing the arithmetic — a cause we generate, and one that would be confidently wrong on any card whose cost we mis-parse | **an activation cost reaches the wire as data.** Concretely: an optional `cost` on `ActiveCardEntry` — `{kind:"lp"; amount}` / `{kind:"lpFraction"; denominator}` / `{kind:"discard"; count}` / `{kind:"tribute"; count}` — or the engine's own resolved cost string. Then the label states what the engine said, and it is the same class of change as ND-1 (which is approved and does exactly this for tribute cost) |
| **M7** (part) | Clicking a card that affords nothing should say **why** | ocgcore publishes the legal list, not the reasons for omissions. Any general reason would be inferred by us. The one case we kept — *"This monster has already attacked"* — is derived from state we hold (absence from `attacks[]` during BP), not inferred | **an omission reason reaches the wire.** Concretely: a per-card reason code alongside `IdleCommand`/`BattleCommand`, or a `MSG_HINT`-carried annotation, saying why a card was excluded. At that point the message quotes the engine and H is satisfied |
| **c1** | Stack both LP plates in one corner instead of diagonally opposite | **This one is not waiting on a wire capability, and it would be dishonest to file it as though it were.** It is a layout judgement: diagonal placement is Master Duel's polarity and makes position carry ownership without a label, which the pass's own "what passed" section credits. The cost — a long saccade to compare totals — is real but small, and the log's per-turn LP snapshot already removes the arithmetic | **evidence, not a delta.** It reopens if a usability pass shows players actually failing the LP comparison, or if the ownership colour law is ever weakened so position stops carrying the meaning on its own |

**None of these needs a decision reversed.** Ship the capability and the finding returns on its own
merits.

## 13 · Where the code contradicted the brief

| Brief says | Code says | Resolution |
|---|---|---|
| "19-variant `DuelDecision` union" | **20 variants** — `duelDecision.ts:309-330`, and ADR-0001:39 itself says "with 20 variants" | Designed for 20. No design consequence; recorded so nobody discovers a 20th panel later |
| "`packages/web/src/components/duel/decisions/` has roughly one panel per variant" | Correct, **but the render path is `DuelScreen → ActionPanel → DecisionDispatcher → {Command,Selection,Prompt,Generic}DecisionPanels`**. `DecisionBottomSheet` and `TargetingOverlay` are not on any render path | The replacement target is `ActionPanel` + `DecisionDispatcher`, not the individual panels |
| Decision `cards[]` are not board-addressable | `CardEntry` **already has `sequence`** (`duelDecision.ts:97`). It is the **board** (`ZoneCard`) that lacks it | MH-1 is still required — but only on the snapshot, not on the decisions. Halves the perceived risk of "board targeting" |
| — | `DuelZones` has **no field-spell zone** while `ZoneEntry` already admits `"FZONE"` (`duelDecision.ts:116`) | The two contracts already disagree. MH-1.4 |

---

## 14 · Mobile — where this gives

Out of scope, not painted into a corner. Full analysis in `surface-inventory.md` §14.
One line: everything is already bottom-docked or collapsible; the only thing a phone adaptation
must *design* is collapsing each side's four pile badges into one tappable `▾ 4 piles` chip. The
2026-07-16 per-variant bottom sheets must **not** be reintroduced — one Question Bar at any width.

---

# Duel UI prototype — independent usability findings

**Artefact:** `/mnt/session/outputs/duel-ui-prototype/index.html` (single file, `file://`, Chromium 1600×900).
**Evaluator:** independent; did not read `surface-inventory.md`, `flows.md` or `component-contract.md`.
**Method:** scripted Chromium (Playwright, `ignore_https_errors=True`), real mouse events and real
keyboard events at real coordinates — not synthetic DOM dispatch. Every state screenshotted,
downscaled and viewed. Evidence paths in the Evidence appendix.

**Counts:** 5 blockers · 13 major · 18 minor · 2 cosmetic · 5 open questions.

Two functional defects found during the pass are already filed: **ZUH-91** (tribute selection
ignored) and **ZUH-92** (chain decline not wired).

---

## Persona / task matrix

Personas:
- **P1 Fluent competitor** — plays Edison on DuelingBook, fast, impatient, strong muscle memory.
- **P2 Returning player** — knows the game, has never used a digital client.
- **P3 Under time pressure** — P1's knowledge, clock running, timeout forfeits.

| Task | Scen. | P1 | P2 | P3 | Findings |
|---|---|---|---|---|---|
| Tribute Summon a monster | 1 | ✖ dead end (default toggles); ✔ after changing a toggle | ✖ dead end, no recovery path | ✖ dead end; ✖ Esc commits | B1 B2 B3 M1 M2 M3 M4 M13 |
| — choose *which* monster to tribute | 1 | ✖ wrong card tributed | ✖ wrong card tributed | ✖ wrong card tributed | B3 m2 m4 |
| — back out before the lock | 1 | ◑ Esc/bg-click work on the hand menu only | ✖ no visible back-out affordance | ✖ Esc *commits* at the tribute step | B2 M1 m1 |
| Respond to opponent's card | 2 | ✔ | ✔ (strongest screen in the build) | ◑ can't see decision time | M5 M6 M9 m2 m3 |
| — answer the opposite way | 2 | ✖ identical outcome | ✖ identical outcome | ✖ identical outcome | B4 |
| Attack with >1 monster | 3 | ✔ | ◑ 6px `»` glyph is the only cue | ✔ | M7 M11 m5 m8 m18 |
| — tell which have attacked | 3 | ✔ (glyph absent + dimmed) | ◑ subtle, overloaded visual | ✔ | m18 |
| Sit off-clock, run out of time | 4 | ✖ no timeout fires | ✖ no timeout fires | ✖ **no warning, no forfeit** | B5 M8 M9 |
| Find out what just happened | any | ✖ "The duel has not started." | ✖ same | ✖ same | M12 m13 m14 |
| Understand the two toggles | — | ◑ | ✖ | ◑ | M2 M10 m10 m12 |

✔ completed · ◑ completed with friction or partial · ✖ could not complete

---

# BLOCKERS

### B1 — Auto-answered "Place here" zone step is inert; the flagship task dead-ends in the shipped default state
- **Element:** Question Bar zone step — the `Place here` button and the player monster zones, when reached with **`Choose zones: OFF`** and **`Showing auto-answered steps: ON`** (both are the state on load).
- **Heuristic:** Visibility of system status; user control and freedom; error recovery.
- **What happened:** P1/P2/P3, task "Tribute Summon a monster". After `Tribute 1 & commit ▲` the panel reads *"Place the card — click a highlighted zone on the board. / The board is the answer space."* with a primary `Place here` button. A **real mouse click at the button's own centre (1088, 864) does nothing** — `document.elementFromPoint` at that point returns the parent `<div class="dock">` (rect 403,686 760×210, z-index 5), which paints over its own child; Playwright reports `<div class="dock"> intercepts pointer events`. Real mouse clicks on **all 11** `.slot.mine` zones also do nothing. Waiting 4s+ does not advance. The header simultaneously reads `▲ COMMITTED` and the footer reads *"There is no cancel at this step"* — so the user is told they are past the point of no return **and** cannot proceed. Expected: the summon completes, or the panel makes clear it is a replay and requires nothing. Turning **either** toggle makes the step live and clickable (verified: `elementFromPoint` then returns `BUTTON.btn primary`).
- **Severity:** **blocker**
- **Proposed change:** Do not render an already-answered step with an enabled-looking primary button. Render auto-answered steps as a **read-only receipt row** — greyed, no button, prefixed *"Answered for you: leftmost free zone"* with an `Undo this answer` / `Ask me next time` link — and drop the imperative copy. Separately fix the stacking so `.dock` never intercepts its own children (`pointer-events: none` on the dock, `auto` on its interactive descendants).

### B2 — `Esc` commits the irreversible tribute step instead of cancelling it
- **Element:** Tribute-selection step of the Tribute Summon flow; the `Escape` key.
- **Heuristic:** Error prevention; consistency and standards; user control and freedom.
- **What happened:** P3 (and P1 by reflex) hit `Esc` to back out of the tribute picker. Instead of cancelling, the app **immediately advances past the `▲` lock to `▲ COMMITTED`**. With **zero** tributes selected it commits anyway and silently picks Card Trooper — GY goes 1→2, Caius takes its zone, and the panel then states there is no cancel. Deterministic: the state does not advance at all if `Esc` is not pressed (verified to 4s). One step earlier, on the hand action menu, the *same key correctly cancels* — so the user learns `Esc` = back out and is then punished for it. P2 has no visible back-out affordance at all (no `Esc` hint on the action menu; the hint appears only on the card-detail popover), so `Esc` is exactly what they would try after seeing it there.
- **Severity:** **blocker** (destroys a card the user never chose, irreversibly)
- **Proposed change:** Bind `Escape` at every pre-lock step to the same action as the `Cancel` button, and bind it to nothing at all past the `▲` lock. Never let a keyboard event submit a step; require the explicit confirm control. Add a visible `Esc` hint next to every `Cancel`.

### B3 — Tribute Summon always tributes Card Trooper regardless of what you selected
- **Element:** Tribute picker (both the board copies and the panel list) → `Tribute 1 & commit ▲`.
- **Heuristic:** Visibility of system status; error prevention; user control and freedom.
- **What happened:** P1, task "Tribute Summon Caius". Selected Sangan (counter correctly reads `1 of 1 selected`), committed — **Card Trooper** left the field and the duel Log recorded *"Card Trooper"*. Verified for all three legal tributes, via both the board copy and the panel copy: survivors were `['Sangan','Junk Synchron']` every time. In Edison this is a real decision (Sangan's GY trigger vs Card Trooper's draw), so the user's actual goal — *lose the one I chose* — cannot be achieved. Compounding it, the panel list never applies a selected class to any card (`.sel` never present), so the only confirmation a selection registered is a counter that reads correctly while the engine does something else.
- **Severity:** **blocker** — filed as **ZUH-91**. May be fixture scripting rather than intended design; either way the UI offers a choice it does not honour.
- **Proposed change:** Honour the selection. Until then, do not render a three-card picker for a decision that is fixed — show the one card that will be tributed. Independently: name the cards on the confirm button (`Tribute Sangan & commit ▲`) so the destructive action is legible before it fires, and give the panel list a real selected state.

### B4 — "No response" performs the same action as "Activate Effect"
- **Element:** Chain prompt footer — `No response` (decline) vs `Activate Effect` (primary).
- **Heuristic:** Error prevention; user control and freedom; match with the real world.
- **What happened:** P1/P2/P3, task "respond to the opponent's card, then answer the opposite way". Clicking **`No response`** with nothing selected still activated Solemn Judgment: LP 8000→4000, Torrential Tribute destroyed, Solemn Judgment to GY. Both branches produce byte-identical end states. Expected on decline: Torrential Tribute resolves, my monsters are destroyed, LP unchanged. Paying 4000 LP is the single most expensive action available and the *decline* button triggers it.
- **Severity:** **blocker** — filed as **ZUH-92**. Also blocks evaluation of the decline path (see "Could not assess").
- **Proposed change:** Wire the decline branch to pass priority without activating anything. Add a regression fixture asserting LP is unchanged after `No response`.

### B5 — The clock reaches 0:00 and nothing happens; no warning at any point on the way down
- **Element:** Clock pill at the left of the phase rail, scenario 4.
- **Heuristic:** Visibility of system status; help users recognise and recover from errors.
- **What happened:** P3, task "sit off-clock and run out of time". Ran scenario 4 for **288 s**. The clock counted 4:25 → 0:00 (reached zero at ~267 s) and then **sat at 0:00 indefinitely** — still `TURN 11 · THEIRS`, still "Sakura is deciding", no forfeit, no result screen, no message, no state change of any kind. The README states it forfeits after ~60 s; nothing fired at 60 s or at zero. Worse for P3: the clock is styled **pixel-identically at 4:20, 0:03 and 0:00** — same 11px red pill, same border, no colour shift, no size change, no pulse. There is no escalation whatsoever, so the event that ends the duel arrives with no warning. Expected: escalating urgency from ~60 s, and an unmistakable terminal state.
- **Severity:** **blocker** (the outcome that decides the match is neither signalled nor delivered)
- **Proposed change:** (a) Escalate the clock: at 60 s enlarge it and move it adjacent to the active question; at 30 s switch to a high-contrast alarm treatment; at 10 s count seconds down in a size that is readable in peripheral vision, plus one audio cue. (b) On zero, replace the question panel with a terminal result card — *"Time — Sakura wins the duel"* — with the final board frozen behind it and a single `Return to lobby` action.

---

# MAJOR

### M1 — The `▲` lock glyph is the only point-of-no-return marker and it is never defined
`span.lock` = `▲`. No `title`, no `aria-label`, no legend, no first-run explanation (verified across
every step). It carries the entire commit model: it marks the boundary in the step ribbon and rides
on `Tribute 1 & commit ▲`. P2 has no way to learn it; P3 must decide whether to commit while the
clock runs. *Heuristic:* recognition over recall; help and documentation. **Severity: major.**
**Fix:** replace the bare glyph on the confirm button with words — `Tribute Sangan — cannot be undone`.
Keep `▲` in the ribbon only, with a persistent one-line key under it: `▲ = past here you cannot cancel`.

### M2 — Auto-answered steps are presented as live questions
The zone step is already answered (`auto-answered · SelectZone — answered from your zone preference
(leftmost free)`) yet is rendered with imperative copy, an enabled-looking primary button, and no
visual difference from a real question. This is the root cause of **B1**. *Heuristic:* visibility of
system status; consistency. **Severity: major.** **Fix:** as B1 — a distinct read-only receipt
treatment (greyed panel, no primary button, past-tense copy).

### M3 — "click a highlighted zone on the board" — no zone is highlighted
All 11 `.slot.mine` share identical computed style: border `rgba(74,158,255,0.35)`, `cursor: auto`,
`box-shadow: none`, transparent background — **including when `Choose zones: ON` makes this a genuine
live question**. The copy names an affordance that does not exist and the cursor never signals
clickability. *Heuristic:* visibility of system status; recognition over recall. **Severity: major.**
**Fix:** on any board-as-answer-space step, give legal slots a filled tint + 2px accent border +
`cursor: pointer` + hover lift, and dim illegal ones — the same treatment already used correctly for
tribute and attack targets.

### M4 — Defence position renders identically to Attack position
Chose `→ Defence` and confirmed; Caius renders upright showing `2400 1000`, computed `transform: none`
— indistinguishable from Attack. Every other client rotates the card 90°. P1 cannot read the board
state they just created; P2 cannot verify their choice landed. *Heuristic:* match between system and
the real world. **Severity: major.** **Fix:** rotate defence-position cards 90° and show DEF as the
prominent stat; face-down defence gets the card back rotated.

### M5 — Activating Solemn Judgment never shows its Life Point cost on the route users take
Clicking Solemn Judgment **in the panel list** (immediately adjacent to the buttons, the natural
target) selects it and shows **no card text at all**. Clicking the **board** copy shows the full text
including *"Pay half your LP"*. The confirm button reads `Activate Effect` in both cases — it never
names the card or the cost. P1/P3 pay 4000 LP with nothing on screen stating the price.
*Heuristic:* error prevention; visibility of system status. **Severity: major.**
**Fix:** make the panel list show card text on selection exactly as the board does, and label the
button with the consequence: `Activate Solemn Judgment — pay 4000 LP`.

### M6 — The card-text panel replaces the card you are responding to
The auto-pushed panel shows Torrential Tribute (excellent — no click needed). Selecting your own
Solemn Judgment **overwrites it**, so you can see *what you are responding to* or *what you are about
to play*, never both. A chain decision is precisely a comparison of the two. *Heuristic:* recognition
over recall; minimalist design misapplied. **Severity: major.** **Fix:** stack the two cards — the
trigger pinned with its `AUTO-PUSHED` badge, your candidate below it — and place the pair beside the
chain panel rather than in the opposite corner.

### M7 — "No legal verbs for that card right now"
Clicking an already-attacked monster produces this message at the bottom of the screen, ~500px from
the click. "Verbs" is implementation vocabulary; no player knows it. It also never says *why*.
*Heuristic:* match between system and the real world; error recovery. **Severity: major.**
**Fix:** state the reason in game terms, anchored to the card: *"Caius has already attacked this turn."*

### M8 — One unlabelled clock; you cannot see your own remaining time off-clock
The clock pill carries no owner label or icon; ownership is encoded **only** in colour (blue = yours,
red = theirs), and only one clock is ever shown. Off-clock in scenario 4 the visible clock is Sakura's,
so P3's core question — *how much time do I have banked?* — is unanswerable exactly when they are
deciding whether to spend it thinking. *Heuristic:* visibility of system status; recognition over
recall. **Severity: major.** **Fix:** show both clocks permanently, stacked, each labelled with the
player name, the active one outlined and ticking. Never rely on colour alone for whose clock it is.

### M9 — An unlabelled 3px hairline reads as a per-question timer but is the whole-turn clock
`.hair` (blue) sits along the top edge of the question panel and shrinks as time passes. It is exactly
proportional to the main clock (width = seconds × 2.528; full width = 5:00) — i.e. it duplicates the
turn clock, but its position makes it read as "time remaining to answer *this* question". P3 will
mis-scale their thinking time from it. *Heuristic:* visibility of system status; consistency.
**Severity: major.** **Fix:** either label it and scope it to the current question's own deadline, or
remove it and put the numeric clock inside the question panel where the user is already looking.

### M10 — `Chain: Auto / ON / OFF` is a three-state cycling control whose states are never explained
Clicking cycles Auto → ON → OFF → Auto. No state says what it does; nothing on screen changes visibly
when it changes. `OFF` plausibly means "never prompt me to respond", which would silently lose duels.
Cycling also hides the state set: you cannot see the options without clicking through, and cannot step
back without a full cycle. *Heuristic:* visibility of system status; user control; help and
documentation. **Severity: major.** **Fix:** replace with a labelled segmented control
`Response prompts: [Always] [Only when useful] [Never]`, each with a one-line description, and a
persistent warning line under `Never`.

### M11 — The commit model contradicts itself between summoning and attacking
The summon flow is explicit and strict: `▲` lock, `▲ COMMITTED`, *"There is no cancel at this step"*,
and Cancel is removed. The attack flow has **no lock marker anywhere**, and `Cancel` stays live in the
header *after* `Confirm`, through "Sakura may respond…" — and it works (LP stays 8000, Krebons
survives). A player who learns "▲ means committed" from the summon flow will infer attacks are never
committed; in real Edison a declared attack cannot be rescinded. *Heuristic:* consistency and
standards; match with the real world. **Severity: major.** **Fix:** apply one commit model. Attack
declaration should carry the same `▲` lock and drop its Cancel once the opponent gains priority.

### M12 — The Log says "The duel has not started." while the board shows turn 8
Every scenario opens mid-duel (turn 4 / 6 / 8 / 11, GY populated, deck 25–32) and the Log panel reads
*"The duel has not started."* The task "find out what just happened" fails outright. It does populate,
well, for actions taken in the session. *Heuristic:* visibility of system status; error recovery.
**Severity: major.** **Fix:** seed the log from the scenario fixture so prior turns are present, and
never show "not started" while turn > 1 — use *"Earlier turns not available"* if history is genuinely
absent.

### M13 — The "step count is unknown" warning is hover-only on a three-character glyph
The ribbon ends `— …`, whose `title` reads *"a trigger may or may not fire — the step count is not
knowable in advance"*. That is exactly what P3 needs before committing — how many more decisions am I
buying? — and it is reachable only by hovering an ellipsis. *Heuristic:* visibility of system status;
help and documentation. **Severity: major.** **Fix:** put it inline in the ribbon as visible text —
`3 steps, possibly more` — and show the count remaining on the confirm button.

---

# MINOR

| # | Element | Heuristic | What happened / expected | Proposed change |
|---|---|---|---|---|
| m1 | Two `Cancel` buttons in the tribute panel (header-right and footer-left), both `btn decline`, same label | Consistency | P2 stalled deciding whether they differ; expected one | Keep the footer `Cancel`; make the header control a labelled `Close` or drop it |
| m2 | Duplicate picker with divergent side effects — board click selects **and** shows card text; panel click selects only | Consistency | Same gesture, different information; users take the less informative route | Make both routes identical (select + reveal card text) |
| m3 | Card-detail popover renders top-left, ~700px diagonally from both the click and the decision buttons; covers the scenario picker | Aesthetic/minimalist; recognition | P2 lost the card they clicked | Anchor the popover beside the clicked card, or dock it next to the question panel |
| m4 | `Tribute Summon (1)` — `(1)` has no unit | Recognition over recall | P2 read it as an option index | `Tribute Summon — 1 tribute` |
| m5 | Board action menu renders on top of the phase rail, hiding `DP SP M1 BP` | Visibility of system status | Cannot see the current phase while choosing an attack | Offset the menu below the card, or shift the rail |
| m6 | Summoned card appears in a zone before Zone and Position are chosen | Visibility of system status | Board says done while the panel still asks | Render it as a translucent ghost until placement resolves |
| m7 | Position step: pick `↑ Attack`/`→ Defence`, then a separate `Confirm` | Flexibility and efficiency | P1: an extra click on a binary choice | Make each position button the commit |
| m8 | `Attack directly` fires in 2 clicks with no confirmation; attacking a monster takes 4 and offers Cancel | Consistency; error prevention | P3 clicking fast triggers unblocked damage with no undo | Same ceremony for both attack variants |
| m9 | `Sakura may respond…` pill appears at y≈86, ~630px from the panel the user has been clicking in | Visibility of system status | Missed the hand-off | Show waiting state in the question panel the user is already looking at |
| m10 | Toggle idioms differ: `Showing auto-answered steps` / `Auto-answered steps hidden` (state sentence) vs `Choose zones: OFF` (name: value) | Consistency and standards | Ambiguous whether the label is state or action | Use `Name: value` for both |
| m11 | Two log entry points — the `Log` chip and a bare `=` glyph at top-right (`title="Open log (L)"`); only the glyph names the `L` shortcut | Consistency; recognition | P2 didn't recognise `=` | One entry point, labelled, with the shortcut on it |
| m12 | `Chain: Auto` tooltip says *"hold A to widen, D to narrow"* — holding A or D changes nothing, and the vocabulary (widen/narrow) doesn't match the label (Auto/ON/OFF) | Help and documentation | Documented interaction does not work | Fix or remove; align vocabulary |
| m13 | Opening the Log resizes the board from 1260px to 1030px, reflowing every card | User control | Cards move under the cursor mid-duel | Overlay the log, or reserve its width permanently |
| m14 | Log rows: two near-identical `Caius the Shadow Monarch — Attack` entries; `Damage −1200` attributed to the attacker, reading as damage taken | Match with the real world | Ambiguous who lost LP | Merge declaration/resolution rows; write `Sakura −1200` |
| m15 | ~320px of empty vertical space between board and hand; board zones occupy ~40% of width at 1600px | Aesthetic and minimalist design | Long eye travel between board and question panel | Scale the board to the space, or bring hand and panel closer |
| m16 | Current phase `M1` is `opacity: 0.5` — dimmer than the phases you can move to (`opacity: 1`) | Visibility of system status | Where-am-I is the least prominent element on the rail | Make the current phase the brightest |
| m17 | `Summon` (level 3) vs `Tribute Summon (1)` (level 6) | Consistency and standards | Two forms for one game concept | `Normal Summon` / `Normal Summon — 1 tribute` |
| m18 | The `»` attack glyph is ~6px, and on Caius it overlaps the card name | Recognition over recall | Only cue for "can still attack"; P2 missed it | Enlarge, move clear of the title, and pair with a border treatment |

---

# COSMETIC

- **c1** — LP counters sit diagonally opposite (`You` bottom-left, `Sakura` top-right), so comparing the two scores crosses the whole viewport. *Consistency.* Stack them in one corner.
- **c2** — Candidate cards in question panels carry a redundant `Field` / `S/T` tag; every legal tribute is on the field. *Minimalist design.* Show the location only when candidates span more than one zone.

---

# What passed

Tested and working — worth protecting through the rebuild:

- **Illegal options are suppressed, not disabled.** A level-6 monster offers only `Tribute Summon`; no `Normal Summon` to mis-click.
- **Confirm buttons are correctly disabled until the step is satisfiable** (`opacity 0.35`, real `disabled`), with a live `n of m selected` counter.
- **Legal targets are highlighted on the board and everything else dimmed**, for tributes and for attack targets. The board genuinely works as the answer space where it is wired.
- **The chain prompt names who, what and where** — *"Sakura activated "Torrential Tribute" (Spell/Trap Zone)"* — and pushes the card text with no click. This is the strongest screen in the build.
- **Attack bookkeeping is legible.** After attacking, a monster loses its `»` glyph and dims; the untapped one keeps it. "Which of mine have attacked" is answerable.
- **Turn ownership is unambiguous.** `TURN 8 · YOURS` in blue vs `TURN 11 · THEIRS` in red, echoed by the active phase pill and the clock. Colour is doing real work here (though see M8 — it is doing it *alone*).
- **`End Turn` is correctly disabled off-clock.**
- **The Log's row format is good** once populated: turn header, LP snapshot, phase grouping, per-actor colour bars, filters and card search.
- **Esc and background-click both dismiss the hand action menu** (the one place Esc behaves correctly — see B2).

---

# Could not assess

- **The decline path of a chain.** B4/ZUH-92 makes both branches identical, so whether declining is
  distinguishable, understandable or recoverable is untested.
- **Whether tribute choice is communicated correctly**, because B3/ZUH-91 means no choice is honoured.
- **The forfeit experience.** B5 — it never fired in 288 s, so the terminal state, its copy and its
  recovery path do not exist to be evaluated.
- **Timing, motion and animation — flag for a human look.** This method under-detects these
  systematically. Specifically: (a) the ~2.0 s gap between `Confirm` and the LP change on an attack,
  during which no textual feedback appears — whether that reads as "resolving" or as "frozen" needs a
  human; (b) whether any damage number is animated (none appears in the DOM at 250 ms sampling);
  (c) the board reflow when the Log opens (m13); (d) whether the `Sakura is deciding` pill's motion
  reads as alive.
- **Audio.** None observed; not assessable from this harness.
- **Reliability of this pass generally.** A duel screen is far from ordinary web patterns, so the
  heuristic scoring is less dependable here than on a conventional flow. The findings most affected
  are M4 (defence rotation), M11 (commit model) and m18 (attack glyph) — all three rest on
  conventions from other Yu-Gi-Oh clients rather than general usability, and should be checked
  against how real Edison players read a board.
- **Anything below 1440×900**, single-monitor ergonomics, and non-Chromium browsers.

---

# Open questions

1. Is `Chain: OFF` intended to suppress response prompts entirely? If so, what stops a player from
   silently losing a duel to a setting they cycled past?
2. Should a declared attack be cancellable (M11)? The attack flow currently allows it; the summon
   flow explicitly forbids the analogous thing.
3. Is the clock a single shared match clock or one per player? Only one is ever rendered (M8).
4. What is `Chain: Auto` meant to auto-decide, and how does the player find out what it decided on
   their behalf?
5. Is `Showing auto-answered steps` intended to reach end users at all, or is it purely
   instrumentation? B1 only bites in that mode — but that mode is on by default, so anyone opening
   the prototype cold hits it on the flagship task.

---

# Evidence appendix

Screenshots: `/tmp/ux-7731-shots/small/` · raw: `/tmp/ux-7731-shots/raw/` · drivers and DOM dumps:
`/tmp/ux-7731-notes/`.

| Finding | File |
|---|---|
| B1 zone dead end | `s1-06-after-commit.png`, `tog-place-zonesON+autoshown.png` |
| B2 Esc commits with 0 tributes | `s1-05-esc-zero-tributes.png` |
| B3 wrong tribute removed | `s1-03-board-tribute-selected.png` → `s1-06-after-commit.png` |
| B4 identical chain branches | `s2-06-no-response.png` |
| B5 clock at 0:00, no forfeit | `s4L-lowclock-278.png`; styling comparison `clock-compare.png` (4:20 / 0:03 / 0:00 identical); full trace `s4-long.log` |
| M4 defence = attack | `s1-14-after-confirm-defence.png` |
| M5/M6 card text swap | `s2-04-solemn-selected.png`, `s2-05-solemn-boardclick.png` |
| M7 "no legal verbs" | `s3-09-caius-attacked-menu.png` |
| M12 empty log | `s1-07-log.png`; populated log `log-after-attack.png` |
| m5 menu over phase rail | `s3-08-trooper-menu.png` |
| m18 `»` glyph | `s3-zoom-attackers.png`, `s3-zoom-after-attack.png` |

---

# Triage and disposition (designer, ZUH-81 rev 2)

Every finding above is dispositioned here. **Nothing was dropped silently.**

Two buckets, and the distinction is the one that matters:
- **PROTOTYPE** — the disposable code was wrong. Fixed on `proto/duel-ui`; costs nothing once
  engineering builds the real thing.
- **DESIGN** — the design itself was wrong. Fixed in the prototype **and** landed in
  `component-contract.md` / `surface-inventory.md`, because a design defect fixed only in the
  prototype ships as a bug.

`✅ fixed` · `⛔ rejected (reason given)` · `◑ partially accepted`

## Blockers

| # | Bucket | Disposition |
|---|---|---|
| **B1** zone step inert | **BOTH** | ✅ Two independent causes. (1) *Prototype:* `.qbar.auto { pointer-events: none }` — my own rule — made the visible button unclickable and let the click fall through to `.dock`. `.dock` is now `pointer-events: none` with `auto` on its children, so it can never intercept its own child. (2) *Design:* the design had **no surface** for "the client answered this for you", so the prototype reused the Question Bar. New component `AutoAnswerReceipt` — read-only, past tense, no primary button, auto-dismissing, with `Ask me next time`. Landed as contract §2b and inventory §4b. The evaluator's proposed fix is what shipped. **Verified:** with Reveal ON + Choose zones OFF, `question-bar` count = 0 and `auto-receipt` count = 1; with Choose zones ON, `elementFromPoint` at a legal zone returns that zone (`DIV.slot mine zonepick`), cursor is `pointer`, and clicking it advances. |
| **B2** `Esc` commits | **BOTH** | ✅ *Prototype:* `Esc` was wired to `answer()`, which in a scripted engine means "advance" — i.e. confirm. Now wired to a separate `decline()`. *Design:* your reading is right and I agree without reservation — a normative **keyboard contract** is now in contract §2: *no keyboard event may submit a decision; `Esc` never commits anything, anywhere, ever*; where a legal decline exists `Esc` performs it, where none exists `Esc` does nothing. Also added: every decline control renders a visible `Esc` chip, and the verb cluster shows `Esc closes — costs nothing`, because a player who cannot see the back-out affordance invents one. **Verified:** `Esc` at the tribute step with 0 selected leaves GY at 1 and returns to ACT; `Esc` at the position step (past the lock) is a no-op. |
| **B3** tribute ignored | **BOTH** | ✅ *Prototype (ZUH-91):* the fixture hard-coded the post-tribute board. Selections now feed an accumulating board patch — and note the first fix was still wrong, because patching only the *next* step made the board revert one beat later; it took a second pass to catch. *Design:* two real items. (a) The confirm button must **name the card it destroys** — `Tribute Sangan — cannot be undone`, contract §2 "Confirm-button label rule". (b) A selection needs a visible selected state **on the thumbnail**, not only a counter. **Verified:** selecting Sangan removes Sangan; Card Trooper survives. |
| **B4** decline == confirm | **PROTOTYPE** | ✅ (ZUH-92) `onDecline` was literally `onConfirm`. Steps now carry a `declineBranch`. **Verified:** decline → LP 8000/8000, both boards wiped by Torrential; confirm → LP 4000/8000, board saved. Byte-different. Contract gains an acceptance criterion and a regression fixture requirement asserting LP is unchanged after a decline. |
| **B5** no forfeit, no escalation | **BOTH** | ✅ **Straight answer, since it contradicted my delivery report: the escalation was implemented in code but was UNREACHABLE, and my report was wrong.** *Prototype:* `reset()` applied step 0 directly instead of presenting it through `goTo()`, so a scenario whose first step is a wait beat — scenario 4 — dead-ended on step 0 forever. The clock the evaluator watched fall 4:25→0:00 was the **opponent's**, which by design does not escalate; the player's clock never became active, so no threshold could ever fire. I never walked scenario 4 to the end; I screenshotted its first two beats and named one `31-clock-amber` when it showed 4:22 red. That is my error, not the evaluator's. *Design:* the escalation was also too weak — one threshold at 60s. Now four bands (60/30/10/0) each differing in size, colour and motion, plus §9 rewritten around M8. **Verified end to end:** 14px → 17px (≤60) → 20px (≤30) → 22px alarm plate + board-edge pulse + `10S — TIMEOUT FORFEITS THE DUEL` (≤10) → at t=38.6s `You lose · Your move timer ran out — the duel is forfeit.` |

## Major

| # | Bucket | Disposition |
|---|---|---|
| **M1** lock glyph undefined | **DESIGN** | ✅ Confirm button says it in words (`— cannot be undone`); the ribbon carries a persistent caption `past this point you cannot cancel`. Contract §4. |
| **M2** auto-answers as live questions | **DESIGN** | ✅ Same fix as B1 — `AutoAnswerReceipt`. |
| **M3** no zone highlighted | **BOTH** | ✅ *Prototype:* `.slot.zonepick` existed in CSS and was never wired. *Design:* the contract's `ZoneSlot` state table lacked a `zone-pick` row; added, with filled tint, 2px accent border, `cursor: pointer`, hover lift, `Place here` label. |
| **M4** defence = attack | **BOTH** | ✅ Weighed against the teardown rather than accepted flat: the intent-model doc already records this as a live defect (F3, "face-up-attack and face-up-defense look identical"), and every client in the teardown rotates the card. So it is convention *and* an existing known gap. Contract AC strengthened from "visually distinguishable" to "rotated 90°, DEF prominent, verifiable via computed `transform`". **Verified:** `matrix(0, 0.82, -0.82, 0, 0, 0)`. |
| **M5** LP cost invisible on the route users take | **DESIGN** ◑ | ◑ Accepted in part; **the unaccepted half is now DEFERRED, not rejected — see `component-contract.md` §13a.** Accepted: the panel route now reveals card text exactly as the board route does, and the confirm button **names the card** (`Activate "Solemn Judgment"`). Rejected: computing `— pay 4000 LP` into the label. The wire carries no structured cost; deriving it means parsing card text, which is guesswork we would ship as fact. The cost is legible in the new in-bar text pane, which is now always present. Recorded in contract §2. |
| **M6** card text replaces the trigger | **DESIGN** | ✅ The best finding in the pass. A chain decision *is* a comparison, and revision 1 made the two texts mutually exclusive and put them 700px from the buttons. New `TextPane` inside the Question Bar shows both, owner-tinted, trigger first. Contract §2 structure + §10 scope narrowed. |
| **M7** "no legal verbs" | **DESIGN** ◑ | ◑ Accepted; **the unaccepted half is now DEFERRED, not rejected — see `component-contract.md` §13a.** the message is anchored **at the card**, and "verbs" is gone. Rejected: generating a reason in the general case. ocgcore does not say *why* it omitted a card, and a fabricated reason is a rules claim — the rules-explanation layer was explicitly dropped. One exception kept because it is derivable from state we hold: a monster missing from `attacks[]` during BP reads `This monster has already attacked.` Everything else reads `Nothing you can do with this card right now.` Contract §3 "Refusal copy". |
| **M8** one unlabelled clock | **DESIGN** | ✅ Treated as blocker-grade, as you asked. Contract §9 and inventory §7 rewritten: **both** clocks always on screen, owner in text, `RUNNING`/`BANKED` in text, active row double-bordered, colour redundant only. New backend delta **ND-5** — `CLOCK` carries one deadline today, so both-clocks needs the wire to carry both. |
| **M9** unlabelled hairline | **DESIGN** | ✅ It *was* the turn clock by design, and the evaluator is right that position made it read as per-question. Now labelled `YOUR TURN CLOCK m:ss` inside the track. Contract §9. |
| **M10** three-state cycler | **DESIGN** | ✅ Replaced with a labelled menu: `Minimal / Standard / Every window`, each with a description, plus a standing note that mandatory effects are always offered. Kept Master Duel's semantics; changed only the labels, because `OFF` read as "off". New contract §11b. |
| **M11** commit model contradicts itself | **DESIGN** | ✅ Real and important. Resolved from the engine rather than by preference: the attack **target** step is cancelable (`SELECT_CARD` arrives `can_cancel: true`); once answered the attack is **declared** and cannot be rescinded. Attack intent template is now `["Target","Declared"], commitAt: 1`. Also answers open question 2. **Verified:** after target confirm the ribbon reads `COMMITTED — no going back` and no cancel control exists. |
| **M12** "duel has not started" on turn 8 | **BOTH** | ✅ *Prototype:* every scenario now seeds prior-turn events. *Design:* the log's empty state must branch on turn number — `Earlier turns are not available.` above turn 1. Contract §8, inventory §10. |
| **M13** step budget hover-only | **DESIGN** | ✅ Inline text: `3 steps · 2 left · possibly more, if a trigger fires`. Contract §4. |

## Minor

| # | Bucket | Disposition |
|---|---|---|
| m1 two Cancels | **DESIGN** | ✅ The ribbon's control now names its scope (`Cancel summon` / `Cancel attack`); the bar's cancels the step. They are genuinely different scopes and must read that way. |
| m2 divergent picker routes | **DESIGN** | ✅ Both routes select **and** reveal text. Contract AC. |
| m3 popover far from the click | **DESIGN** ◑ | ◑ Split by channel rather than moved wholesale: the floating left panel keeps *what is happening* (auto-push, resolving links) because that channel must not move; the candidate you clicked now renders in the bar's `TextPane`, beside the buttons. The 700px trip is gone for the interactive case. |
| m4 `(1)` no unit | **DESIGN** | ✅ `Normal Summon — 1 tribute`. |
| m5 menu over the phase rail | **DESIGN** | ✅ Cluster flips below the card when it would cover the rail. Contract §3 "Placement rule". |
| m6 card lands before placement resolves | **PROTOTYPE** | ✅ The contract already specified a translucent dashed ghost; the prototype rendered it solid. Ghost now rendered, and promoted to an explicit AC. |
| m7 extra Confirm on a binary choice | **DESIGN** | ✅ Each position tile is the commit. Also fixed a stale-closure bug the change exposed. |
| m8 direct attack ceremony | **DESIGN** ⛔◑ | ◑ Mostly rejected, with reason. `canDirectAttack === true` must **not** ask for a target — that is intent-model R3.4, it is what Master Duel does, and pace is the point of the whole redesign. Adding a confirm to make the two paths symmetric would slow the common case to fix an asymmetry the player benefits from. Accepted from it: the verb chip reads `Attack directly` (not `Attack`), so the shorter ceremony is *announced* before it fires, and the ribbon shows `COMMITTED` immediately. |
| m9 waiting pill 630px away | **DESIGN** | ✅ Waiting state now renders **in the dock**, where the bar was. Also the fix for your "~2.0s silent gap" note — see housekeeping below. |
| m10 mixed toggle idioms | **PROTOTYPE** | ✅ All chrome uses `Name: value`. |
| m11 two log entry points | **DESIGN** | ✅ One labelled control carrying its `L` shortcut; the bare glyph is deleted. |
| m12 tooltip promises unbound keys | **DESIGN** | ✅ Claim removed. Contract §11b: the held-key modifier stays nice-to-have and **must not be advertised until it is bound** — a documented interaction that does nothing is worse than an undocumented one. |
| m13 log reflows the board | **DESIGN** | ✅ The rail overlays; expanding it moves no card. Contract §8, inventory §10. |
| m14 damage attributed to the attacker | **BOTH** | ✅ Rows read `Sakura −1200 LP`. Needs the event to carry which seat's LP moved → new backend delta **ND-4**. |
| m15 empty vertical space, small board | **PROTOTYPE** | ✅ Board scaled up, vertical budget retuned so the dock no longer overlaps the field. Candidates are additionally lifted above the dock with a drop shadow, so the dim law's promise holds in every layout. |
| m16 current phase dimmest | **BOTH** | ✅ *Prototype:* the current phase inherited `:disabled { opacity: .5 }` because it is not a legal *destination*. *Design:* added an AC — "where am I" outranks "where can I go"; the current cell must be the highest-contrast element on the rail. |
| m17 `Summon` vs `Tribute Summon` | **DESIGN** | ✅ `Normal Summon` / `Normal Summon — 1 tribute`. |
| m18 6px attack glyph over the title | **DESIGN** | ✅ Weighed against the teardown as asked: every client in the set marks attack availability somewhere, and none relies on a mark small enough to collide with the card name — so this is not merely convention. Now a labelled badge (`ATK` / `USED`) offset clear of the title. |

## Cosmetic

| # | Bucket | Disposition |
|---|---|---|
| c1 LP counters diagonal | — | ⛔ **Held, not rejected — reopens on evidence, not on a backend delta. See `component-contract.md` §13a.** This is Master Duel's documented polarity and it is load-bearing: position maps to ownership with no label, which is why the pass's own "what passed" section notes turn ownership is unambiguous. Stacking both plates in one corner would need a label to say which is which and would put the opponent's LP inside your own hand's reading zone. The comparison cost is real but small, and the log's per-turn LP snapshot already exists to remove the arithmetic. |
| c2 redundant location tags | **DESIGN** | ✅ The badge renders only when candidates span more than one `{controller, location}`. |

## Evaluator's open questions — answered

1. **Does `Minimal` (was `OFF`) suppress response prompts entirely?** No. Mandatory effects and
   certain triggers are **always** offered at every setting; it cannot make you miss a forced
   response. It can cost you an *optional* response, which is the accepted trade and doubles as the
   only available mitigation for the tell problem. The guarantee now ships **in the control**, as a
   standing note in the same view as the options.
2. **Should a declared attack be cancellable?** Target selection: yes — the engine says so
   (`can_cancel: true`). Declaration: no. See M11.
3. **One shared clock or one per player?** One per player, running per handover of control, and
   **both are now permanently on screen**. See M8 / ND-5.
4. **What does the prompt setting auto-decide, and how does the player find out?** It decides *when
   you are offered a response window* — it never answers for you. Answering on your behalf is a
   separate mechanism (the §15 auto-resolve register, restricted to exactly-one-legal-answer cases),
   and it is now surfaced by the `AutoAnswerReceipt`. The two were conflated in revision 1 and that
   conflation is what made B1 possible.
5. **Is `Showing auto-answered steps` meant for end users?** No — pure instrumentation. **It now
   defaults to OFF**, so the CEO lands in the real screen, and it sits with the other prototype-only
   controls left of the divider in the top bar.

## Housekeeping raised with the pass

- **The ~2.0s gap between attack Confirm and the LP change.** Fixed, and it was a fair hit: the
  redesign exists to fix exactly this. Every beat of that gap now carries its own label, rendered in
  the dock where the player is already looking: `Attack declared — Sakura may respond…` →
  `Damage step — Caius 2400 vs Krebons 1200…` → `Direct attack resolving…`. There is no unlabelled
  moment left in the battle sequence. (A damage-number animation is still absent — see below.)
- **Board reflow when the log opens.** Fixed — the rail overlays (m13).
- **Still not assessed, and honestly flagged rather than claimed:** damage-number animation (the
  design calls for a floating LP delta; the prototype does not animate it, and a flow instrument is
  the wrong place to judge it), audio, and anything below 1440×900.
- **M4/M11/m18 weighed against the teardown**, not accepted flat — reasoning recorded in each row
  above. All three survived the weighing; M4 and m18 are corroborated by the teardown or by the
  intent-model doc's own defect list, and M11 was resolved from the engine's `can_cancel` rather
  than from convention.

---

# Answer × outcome matrix — the distinct-outcomes invariant

**Generated by** `spikes/duel-ui-proto/answer-matrix.py` on the built prototype,
real mouse events at real coordinates.

**Invariant:** for any decision with more than one legal answer, distinct answers must
produce distinct observable outcomes, and the outcome must be the one the confirm
control named.

**Decision points walked:** 8 · **answers exercised:** 24 · **collisions:** 0

## ✔ No collisions. Every answer produced a distinct end state.

## ◑ Distinguished by the event log, not by the final board

Not bugs — the domain makes the boards converge. Listed so it is visible.

- **SelectCard — Book of Moon flips which monster** — `flip Krebons` and `flip Card Trooper` reach the same final board; the log records which.
- **SelectCard — Book of Moon flips which monster** — `flip Card Trooper` and `flip Junk Synchron` reach the same final board; the log records which.

---

## SelectTribute — which monster to tribute

*Scenario:* `tribute-summon`

*Candidates offered:* Card Trooper, Sangan, Junk Synchron

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **tribute Card Trooper** | `Tribute Card Trooper — cannot be undone` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |
| **tribute Sangan** | `Tribute Sangan — cannot be undone` | `8000/8000` | `Card Trooper,Caius the Shadow Monarch,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |
| **tribute Junk Synchron** | `Tribute Junk Synchron — cannot be undone` | `8000/8000` | `Card Trooper,Sangan,Caius the Shadow Monarch,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |
| **decline (Esc/Cancel)** | `Cancel Esc` | `8000/8000` | `Card Trooper,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:1 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | — |

<details><summary>log tails</summary>

- **tribute Card Trooper** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY
- **tribute Sangan** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Sangan Move Field → GY
- **tribute Junk Synchron** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Junk Synchron Move Field → GY
- **decline (Esc/Cancel)** — Krebons Summon Hand → Field ; Sakura Set Hand → S/T ; Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field

</details>

---

## SelectZone — where Caius lands (Choose zones: ON)

*Scenario:* `tribute-summon`

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **zone 1 (freed slot)** | `Place here (legal zone #1 of 3)` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |
| **zone 4** | `Place here (legal zone #2 of 3)` | `8000/8000` | `.,Sangan,Junk Synchron,Caius the Shadow Monarch,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |
| **zone 5** | `Place here (legal zone #3 of 3)` | `8000/8000` | `.,Sangan,Junk Synchron,.,Caius the Shadow Monarch // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Summon “Caius the Shadow Monarch” in which position? |

<details><summary>log tails</summary>

- **zone 1 (freed slot)** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY
- **zone 4** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY
- **zone 5** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY

</details>

---

## SelectPosition — Caius's battle position

*Scenario:* `tribute-summon`

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **Attack position** | `Attack position · upright · ATK forward` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Activate “Caius the Shadow Monarch” (Monster Zone)? Banish 1 card on the field |
| **Defence position** | `Defence position · sideways · DEF forward` | `8000/8000` | `Caius the Shadow Monarch(def),Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Activate “Caius the Shadow Monarch” (Monster Zone)? Banish 1 card on the field |

<details><summary>log tails</summary>

- **Attack position** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY
- **Defence position** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY

</details>

---

## ChainPrompt — activate Caius's trigger?

*Scenario:* `tribute-summon`

*Candidates offered:* Caius the Shadow Monarch

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **activate** | `Activate "Caius the Shadow Monarch"` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | Banish 1 card on the field — "Caius the Shadow Monarch" |
| **no response** | `No response Esc` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | — |

<details><summary>log tails</summary>

- **activate** — Sakura Set Hand → S/T ; You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY
- **no response** — You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY ; Caius the Shadow Monarch Resolve

</details>

---

## SelectCard — Caius banishes which card

*Scenario:* `tribute-summon`

*Candidates offered:* Krebons, Set card, Set card

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **banish Krebons (DARK)** | `Target Krebons` | `8000/7000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // .,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:1 GY:0 EXTRA:0 DECK:32` | — |
| **banish set card #1** | `Target Sakura's set card in S/T 1` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `.,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:1 GY:0 EXTRA:0 DECK:32` | — |
| **banish set card #2** | `Target Sakura's set card in S/T 2` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,.,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:1 GY:0 EXTRA:0 DECK:32` | — |
| **cancel** | `Cancel Esc` | `8000/8000` | `Caius the Shadow Monarch,Sangan,Junk Synchron,.,. // Mystical Space Typhoon,.,.,.,.` | `FD,FD,.,.,. // Krebons,.,.,.,.` | `DECK:30 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:32` | — |

<details><summary>log tails</summary>

- **banish Krebons (DARK)** — Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY ; Caius the Shadow Monarch Chain Field → Field ; Krebons Target Field → Field ; Krebons Banish Field → Banished ; Caius the Shadow Monarch Damage Sakura −1000 LP
- **banish set card #1** — Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY ; Caius the Shadow Monarch Chain Field → Field ; Bottomless Trap Hole Target S/T → S/T ; Bottomless Trap Hole Banish S/T → Banished
- **banish set card #2** — Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY ; Caius the Shadow Monarch Chain Field → Field ; Dimensional Prison Target S/T → S/T ; Dimensional Prison Banish S/T → Banished
- **cancel** — You Move ; Card Trooper Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Card Trooper Move Field → GY ; Caius the Shadow Monarch Resolve

</details>

---

## ChainPrompt — respond to Torrential Tribute

*Scenario:* `chain-response`

*Candidates offered:* Solemn Judgment, Book of Moon

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **Solemn Judgment** | `Activate "Solemn Judgment"` | `4000/8000` | `Card Trooper,Junk Synchron,.,.,. // .,Book of Moon,.,.,.` | `.,FD,.,.,. // Krebons,.,.,.,.` | `DECK:31 EXTRA:0 GY:1 BAN:0` | `BAN:0 GY:1 EXTRA:0 DECK:29` | — |
| **Book of Moon** | `Activate "Book of Moon"` | `8000/8000` | `Card Trooper,Junk Synchron,.,.,. // Solemn Judgment,Book of Moon,.,.,.` | `Torrential Tribute,FD,.,.,. // Krebons,.,.,.,.` | `DECK:31 EXTRA:0 GY:0 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:29` | Target 1 face-up monster — "Book of Moon" |
| **No response** | `No response Esc` | `8000/8000` | `.,.,.,.,. // Solemn Judgment,Book of Moon,.,.,.` | `.,FD,.,.,. // .,.,.,.,.` | `DECK:31 EXTRA:0 GY:2 BAN:0` | `BAN:0 GY:2 EXTRA:0 DECK:29` | — |

<details><summary>log tails</summary>

- **Solemn Judgment** — Junk Synchron Summon Hand → Field ; Solemn Judgment Chain S/T → S/T ; Solemn Judgment Damage You −4000 LP ; Solemn Judgment Resolve ; Torrential Tribute Negated S/T → GY ; Solemn Judgment Move S/T → GY
- **Book of Moon** — Krebons Summon Hand → Field ; Sakura Set Hand → S/T ; You Move ; Junk Synchron Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Book of Moon Chain S/T → S/T
- **No response** — Junk Synchron Summon Hand → Field ; Torrential Tribute Resolve ; Junk Synchron Destroyed Field → GY ; Card Trooper Destroyed Field → GY ; Krebons Destroyed Field → GY ; Torrential Tribute Move S/T → GY

</details>

---

## SelectCard — Book of Moon flips which monster

*Scenario:* `chain-response`

*Candidates offered:* Krebons, Card Trooper, Junk Synchron

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **flip Krebons** | `Target Krebons` | `8000/8000` | `.,.,.,.,. // Solemn Judgment,.,.,.,.` | `.,FD,.,.,. // .,.,.,.,.` | `DECK:31 EXTRA:0 GY:3 BAN:0` | `BAN:0 GY:2 EXTRA:0 DECK:29` | — |
| **flip Card Trooper** | `Target Card Trooper` | `8000/8000` | `.,.,.,.,. // Solemn Judgment,.,.,.,.` | `.,FD,.,.,. // .,.,.,.,.` | `DECK:31 EXTRA:0 GY:3 BAN:0` | `BAN:0 GY:2 EXTRA:0 DECK:29` | — |
| **flip Junk Synchron** | `Target Junk Synchron` | `8000/8000` | `.,.,.,.,. // Solemn Judgment,.,.,.,.` | `.,FD,.,.,. // .,.,.,.,.` | `DECK:31 EXTRA:0 GY:3 BAN:0` | `BAN:0 GY:2 EXTRA:0 DECK:29` | — |
| **cancel activation** | `Cancel Esc` | `8000/8000` | `Card Trooper,Junk Synchron,.,.,. // Solemn Judgment,Book of Moon,.,.,.` | `Torrential Tribute,FD,.,.,. // Krebons,.,.,.,.` | `DECK:31 EXTRA:0 GY:0 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:29` | Sakura activated “Torrential Tribute” (Spell/Trap Zone). Chain a card or effect? |

<details><summary>log tails</summary>

- **flip Krebons** — Krebons Position Field → Field ; Junk Synchron Destroyed Field → GY ; Card Trooper Destroyed Field → GY ; Krebons Destroyed Field → GY ; Torrential Tribute Move S/T → GY ; Book of Moon Move S/T → GY
- **flip Card Trooper** — Card Trooper Position Field → Field ; Junk Synchron Destroyed Field → GY ; Card Trooper Destroyed Field → GY ; Krebons Destroyed Field → GY ; Torrential Tribute Move S/T → GY ; Book of Moon Move S/T → GY
- **flip Junk Synchron** — Junk Synchron Position Field → Field ; Junk Synchron Destroyed Field → GY ; Card Trooper Destroyed Field → GY ; Krebons Destroyed Field → GY ; Torrential Tribute Move S/T → GY ; Book of Moon Move S/T → GY
- **cancel activation** — Krebons Summon Hand → Field ; Sakura Set Hand → S/T ; You Move ; Junk Synchron Draw Deck → Hand ; Junk Synchron Summon Hand → Field ; Book of Moon Chain S/T → S/T

</details>

---

## SelectCard — attack target (cancelable)

*Scenario:* `battle`

*Candidates offered:* Krebons

| answer | the control you pressed said | LP | your field | their field | your piles | their piles | screen now asks |
|---|---|---|---|---|---|---|---|
| **attack Krebons** | `Target Krebons` | `8000/6800` | `Caius the Shadow Monarch,Card Trooper,.,.,. // Book of Moon,.,.,.,.` | `FD,.,.,.,. // .,.,.,.,.` | `DECK:28 EXTRA:0 GY:0 BAN:0` | `BAN:0 GY:1 EXTRA:0 DECK:27` | — |
| **cancel the attack** | `Cancel Esc` | `8000/8000` | `Caius the Shadow Monarch,Card Trooper,.,.,. // Book of Moon,.,.,.,.` | `FD,.,.,.,. // Krebons,.,.,.,.` | `DECK:28 EXTRA:0 GY:0 BAN:0` | `BAN:0 GY:0 EXTRA:0 DECK:27` | — |

<details><summary>log tails</summary>

- **attack Krebons** — Gorz the Emissary of Darkness Draw Deck → Hand ; Caius the Shadow Monarch Tribute Summon Hand → Field ; Caius the Shadow Monarch Attack ; Caius the Shadow Monarch Attack 2400 ; Krebons Destroyed Field → GY ; Caius the Shadow Monarch Damage Sakura −1200 LP
- **cancel the attack** — You Move ; Sakura Draw Deck → Hand ; Sakura Set Hand → S/T ; You Move ; Gorz the Emissary of Darkness Draw Deck → Hand ; Caius the Shadow Monarch Tribute Summon Hand → Field

</details>

