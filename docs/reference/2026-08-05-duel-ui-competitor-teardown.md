# Duel-screen teardown: Master Duel, EDOPro, DuelingBook, Dueling Nexus

**Date:** 2026-08-05 · **Linear Project:** Duel UI Rebuild · **Discovery issue:** ZUH-78
**Method:** real screens captured and inspected visually, not read about. Every claim is tagged
`[V]` verified from an image in this repo, `[R]` reported by a cited source, or `[I]` inference.

Images referenced below live in `docs/reference/duel-ui-teardown-images/` (recompressed for the
repo). Filenames match the originals with the directory prefix stripped and the extension
normalised to `.jpg`.

**The two decisive frames, if you read nothing else:**
- `masterduel-chain-prompt-and-log.jpg` — the model. One bottom-centre question bar naming the
  card in a sentence, candidate cards as location-badged thumbnails, `Cancel` and `Activate Effect`
  as equal-weight verbs, the relevant card text auto-pushed to the left panel, and a
  phase-structured turn log with LP snapshots down the right rail.
- `edopro-hi-04.jpg` — the pathology, and almost certainly the one our own screen inherited:
  three overlapping grey dialogs at once, a prompt sentence floating unattached in the sky, a
  separate Yes/No box, and an `OK` button, with nothing indicating which one is live.

---


---

# Cross-client comparison + recommendation — Duel UI Rebuild (ZUH-78)

Companion files: `masterduel.md`, `edopro.md`, `duelingbook.md`, `duelingnexus.md`.
Every claim there names the image or URL that evidences it. This file is the synthesis.

Confidence tags used throughout: **[V]** verified (I read it in an image or a primary/official
doc) · **[R]** reported (a secondary source asserts it; I did not see it) · **[I]** inference
(my reading, not evidence).

---

## 0. Executive summary

1. **There is no grammar disagreement to resolve.** All four clients are **select-then-verb, with
   the verbs rendered next to the card**. No client in the competitive set uses drag-to-zone, a
   radial menu, or a global command bar. **[V for DuelingBook and EDOPro; [R] for Master Duel]**
2. **The real differentiator is not how you *act*, it is how the client *asks*.** Master Duel and
   Dueling Nexus put questions in **one composed panel: a sentence naming the card, the candidate
   answers as thumbnails, and explicit Confirm/Cancel.** EDOPro puts each question in **its own
   grey dialog, and lets several overlap at once.** **[V]** We share EDOPro's engine, so EDOPro's
   failure is the one we are most likely to have inherited.
3. **A player-controlled response-verbosity toggle is table stakes.** All three automatic clients
   have one, all three default to a middle/quiet setting, all three expose it *in the duel*.
   **[V across three clients — the most robust finding in this teardown]**
4. **Our audience is DuelingBook-native, and DuelingBook is manual.** They are used to *asserting*
   plays and to *dense, always-on information*. They are **not** used to being asked questions,
   and **not** used to a shot clock. **[V]**
5. **Recommendation in one line:** adopt **DuelingBook's grammar skeleton** (select-then-verb;
   a full phase row; dense always-on state) **rendered with Master Duel's presentation discipline**
   (one question panel at a time, a single ownership colour law, a phase-structured visual log),
   **with legality filtering from ocgcore** — which is the one thing DuelingBook physically
   cannot do, and therefore our clearest visible win.

---

## 1. Desktop-width board layout

| | Master Duel | EDOPro | DuelingBook | Dueling Nexus |
|---|---|---|---|---|
| Board share of width | **~100%** — chrome floats over the board | ~70%; permanent left rail | ~60%; left **and** right rails, inside a browser tab | ~60%; left rail |
| Fields | perspective 3D, opponent top / player bottom | perspective 3D, opp top / player bottom | flat neon-outlined grid, opp top / player bottom | flat neon-outlined grid, opp top / player bottom |
| Persistent panels | **none by default** | card preview + tabbed pane (`Card info/Log/Chat/Quick Settings/Repositories`) | card preview + text; chat/log rail; buttons | card preview + info pane |
| Where LP live | large plates, **bottom-left (you) / top-right (them)** | small gauges + numerals, top edge | plates at **top-right and bottom-right** of the right rail | plate with LP bar **and time bar** |
| Evidence | `duel-ui-teardown-images/masterduel-official-duelscreen-legend.jpg` **[V]** | `duel-ui-teardown-images/edopro-hi-01.jpg` **[V]** | `duel-ui-teardown-images/db-p1-db379cf0.jpg` **[V]** | `duel-ui-teardown-images/edo-p2-b464405e.jpg` **[V]** |

**Reading:** Master Duel's panel-free board is a *deliberate design choice, not a platform
limit* — the same game uses dense three-pane desktop chrome in its deck editor
(`duel-ui-teardown-images/masterduel-steam-08.jpg` **[V]**), and it *does* become a two-pane layout when the duel
log is opened (`duel-ui-teardown-duel-ui-teardown-images/masterduel-chain-prompt-and-log.jpg` **[V]**).

**Recommendation.** **Board-dominant, with one collapsible right rail.**
- Corners carry identity: **your LP + name bottom-left, opponent's LP + name top-right**, mirroring
  Master Duel — it maps position to ownership and needs no label. **[I, grounded in [V]]**
- **One** right rail, collapsed by default, holding the log (§5). Not two rails; not a left rail.
  DuelingBook's left-rail card preview should instead be a **hover/inspect overlay on the board**
  (Master Duel's pattern, `duel-ui-teardown-images/masterduel-steam-01.jpg` **[V]**), because it only matters while
  you are looking at a card.
- **Delete all post-Edison furniture: no Extra Monster Zones, no Pendulum Zones, no Link markers.**
  Two rows of five per side plus a Field Zone. EDOPro confirms the engine family already models
  "this era excludes these card types" — its Master Rule 1 filter reads exactly
  `No Xyz / No Pendulum / No Link` (`duel-ui-teardown-images/edopro-hi-06.jpg` **[V]**), which is the Edison card
  universe. A source also notes Pendulum Zones "won't appear when you duel with the appropriate
  ruleset" **[R]**.
- The freed vertical space is what pays for a readable phase row and a chain display.

---

## 2. "It is my turn" and "which phase"

| | Mechanism | Evidence |
|---|---|---|
| Master Duel | One **circular badge at the right mid-edge** reading e.g. `Turn 8 / Main1`, **tinted by turn ownership** — blue/gold on your turn, **red on theirs**. A **clock badge mirrors it at the left mid-edge** (`474`, `466`). Plus a "light" that "switches from red at the top, to blue on our side" when you are asked. Battle Phase can expand into sub-steps (`S`, `03`, `05`). | badge+clock **[V]** across `masterduel-steam-01/-02/-04` and `md-p1-e2a9f7aa.jpg`; the light and sub-steps **[R]** |
| EDOPro | Turn **number** centred at top between the LP bars; current phase is a **button in the board's centre strip** (`M 1`), with the next legal phase beside it (`E P`). | `duel-ui-teardown-images/edopro-hi-01.jpg` **[V]** |
| DuelingBook | **Horizontal phase row in the board centre**: `DP SP M1 BP M2 EP`, current phase **lit bright red**, plus an `End Turn` pill. Player *declares* phases. | `duel-ui-teardown-images/db-p1-db379cf0.jpg` **[V]** |
| Dueling Nexus | **Vertical phase column at the left**: `DP SP MP1 BP MP2 EP`, current/available highlighted **green**. | `duel-ui-teardown-images/edo-p2-b464405e.jpg` **[V]** |

**Reading.** Three of four clients render **the whole phase sequence as an enumerated control with
the current member highlighted**. Master Duel is the outlier with a display-only badge — and
Master Duel is also the only one of the four not built for players who need to reason about
timing windows. Our audience does need to. **[I]**

**Recommendation.**
- **Take DuelingBook's phase row** (all six phases visible, current one lit, legally-reachable
  ones clickable, unreachable ones dimmed) and **style it like Master Duel**. This is the one
  place where copying the incumbent beats copying the visual target, and it is cheap: the phase
  row is *both* the "which phase" display and the phase-advance affordance, so it removes a
  separate "next phase" button. **[I, high confidence — 3-of-4 convergence]**
- **Encode turn ownership as colour on that row plus the board framing** — Master Duel's law
  below. Do not build a separate "it's your turn" banner; a banner is a thing you miss.
- **Make the Battle Phase expandable into steps** when the response-verbosity setting is `ON`.
  Master Duel does exactly this **[R]**, and it is where Edison-era response timing is finest.

---

## 3. ★ Interaction grammar — initiating intent vs answering a question

This was the coordinator's priority question. The two modes and how each client separates them:

### 3a. Initiating intent (player acts)

| | How | Evidence |
|---|---|---|
| Master Duel | Click card → **command icons appear directly above that card** (`Command Placement: Change`), or at a fixed spot (`Fixed`). Verb set is contextual: activate / attack / change position / confirm. | **[R] only — see §8 gap** |
| EDOPro | Click card → **contextual option set, filtered by legality** — Foolish Burial offers *Activate or Set*; Torrential Tribute offers *Set* only. Piles are actionable: click GY → `Activate` → list of cards there that *can* activate. Zones **glow** when an action is available there (Extra Deck "ring of light"). | **[R]**, corroborated by the selection window in `duel-ui-teardown-images/edopro-hi-04.jpg` **[V]** |
| DuelingBook | Click card → **vertical plain-text menu anchored at the card**, listing **physical operations**: `Move / Target / To B. Deck / To T. Dack / To Extra / Deck FU / Banish FD / Banish / To Hand / Set / To DEF / Declare / To Grave` — 13 entries on a field monster, 3 on another card. | `_harvest/gif/dbx-p1-347de90b/f_050.png`, `f_110.png`, `f_020.png` **[V]** |
| Dueling Nexus | Not directly observed acting; layout implies the same click-then-verb shape. | **[I]** |

**The convergence is the finding: every client is select-then-verb with verbs at the card.**
The differences are only in *what the verbs are*:
- DuelingBook's verbs are **physical** (`To Grave`, `Banish FD`) because it has no engine. Two
  independent sources call this out — "without needing **the janky menu**" (a QoL extension) and
  "rather than select from **a long drawer of options**" (a rival client's guide). **[R]**, and the
  13-entry menu in `f_050.png` **[V]** proves them right. There is even a shipped typo
  (`To T. Dack`).
- EDOPro's verbs are **legal game verbs**, because ocgcore tells it what is legal. **[R]**

→ **We have ocgcore. So we can ship the grammar our audience's fingers already know — click card,
pick verb, verbs appear at the card — while deleting the thing they complain about.** A menu of 3
legal verbs instead of 13 physical ones. This is a large, immediately-felt win that costs us
nothing but discipline. **[I, high confidence]**

### 3b. Answering a question (engine asks)

| | How | Evidence |
|---|---|---|
| **Master Duel** | **ONE bottom-centre panel** containing: a sentence — `"Rebirth of Nephthys" is activated. Chain another card or effect?` with **the card name, the verb and `Chain` each tinted** — the candidate answers as **card thumbnails carrying location badges**, and **`Cancel` / `Activate Effect`** buttons. Board stays readable behind it. Targeting elsewhere annotates eligible cards with **location icons, blue for yours / red for theirs**. | `duel-ui-teardown-duel-ui-teardown-images/masterduel-chain-prompt-and-log.jpg` **[V]**; icons **[V]** from the official legend + `images/masterduel-icon-loc-*.png` |
| **Dueling Nexus** | **One centred panel**: `Do you want to activate The White Stone of Ancients (Graveyard)?` with **green `Yes` / red `No`**. **Location disambiguated inline in parentheses.** | `duel-ui-teardown-images/edo-p2-b464405e.jpg` **[V]** |
| **EDOPro** | **Multiple undifferentiated grey dialogs, simultaneously, overlapping.** One frame shows *three at once*: a top banner `Select the effect you want to activate`; a selection window titled `Graveyard(2)` with cards captioned `Graveyard[1]` / `Graveyard[2]` and an `OK`; and a Yes/No box `Attempting to Normal Summon "Luster Dragon" / Activate a card or effect?`. No hierarchy, no ownership colour, and the card-info pane still shows a **stale** card from an earlier interaction. | `duel-ui-teardown-images/edopro-hi-04.jpg` **[V]** |
| **DuelingBook** | **Does not apply** — it is manual, so nothing asks. The nearest analogue is the `Declare` menu entry, and the log records `<player> declared effect of "<Card>"`. | `f_020.png`, `f_050.png` **[V]** |

**★ How the two modes are made visually distinct — the answer to the coordinator's question.**
Master Duel does **not** rely on a colour change or a mode badge. It uses **a different UI object
in a different screen position**:
- *Acting* = no panel; verbs appear **at the card you touched**.
- *Being asked* = **a docked panel at bottom-centre** with a question sentence, candidate
  thumbnails, and Confirm/Cancel.
**[I, high confidence — grounded in [V] observation of both states]**

That separation is what EDOPro lacks, and EDOPro renders *our* decision union. **Our stated
symptom — "every engine decision is answerable, but a player cannot tell what is happening or
what they may do" — is most probably exactly EDOPro's pathology: one dialog per decision variant,
no single place where questions live.** **[I — the most probable diagnosis, not verified against
our code, which I did not read]**

### 3c. ★ RECOMMENDATION — the grammar to adopt

**Two modes, two distinct UI objects, never both active.**

**ACT mode (default).** Board fully live. Click any card you control →
- **a compact verb chip cluster appears anchored at that card**, containing **only the verbs
  ocgcore says are legal**, with a stable verb order so muscle memory forms;
- clicking a **pile** (GY / banished / Deck / Extra) opens an inspector that is **free, instant,
  silent and never broadcast to the opponent** — see §6;
- zones/piles that currently *afford* an action get a subtle highlight, as EDOPro's "ring of
  light" does **[R]**;
- `Esc` / click-away dismisses, costing nothing.

**ANSWER mode.** When the engine emits a decision, dim the board slightly and raise **one
Question Bar, docked bottom-centre**:
- **Line 1: a sentence naming the card and the decision**, in the Master Duel / Nexus style, e.g.
  `Opponent activated "Torrential Tribute". Chain a card or effect?` — with the card name and the
  verb tinted. Adopt **Nexus's inline parenthetical location** (`... "Premature Burial" (Graveyard)?`)
  because the same card is often activatable from two places and this is nearly free in HTML. **[V]**
- **Line 2: the answer space** — candidate cards as thumbnails **each badged with its location**
  (Master Duel's icons **[V]**; blue = yours, red = theirs).
- **Line 3: explicit verbs** — a highlighted confirm and an equally-present **`Cancel` / `No`**.
  Declining must be a first-class answer, not a dismissal. **[V]**
- **Exactly one Question Bar exists.** If the engine has queued several decisions, they occupy the
  bar in sequence. **Never two question surfaces at once — that is EDOPro's specific failure.**
- Board **targeting highlight** runs *simultaneously*: eligible cards on the board get the
  ownership-coloured outline, so a target set spanning hand + GY + field is legible without
  opening four inspectors.

**Why this satisfies all five constraints:**
- **ocgcore / locked 19-variant union:** the Question Bar is a *single renderer with a variant
  switch*, not 19 dialogs. Every variant is a question sentence + an answer space + confirm/decline.
  **No protocol change is proposed.**
- **Board-addressable cards / `sequence`:** the answer space is "cards", and cards on the board
  are addressable — which is exactly the accepted cost. EDOPro's own selection captions are
  `Graveyard[1]` / `Graveyard[2]`, i.e. **the engine's selection semantics are already positional**,
  so the UI genuinely needs the position. **[V]** — corroborating that the accepted cost is real.
- **Edison:** fewer card types, no Links, no Pendulums → shorter verb clusters and smaller answer
  spaces than any modern client has to handle. The grammar gets *easier*, not harder.
- **Human-vs-human:** see §7.
- **Master-Duel feel + DuelingBook-native audience:** grammar from the incumbent, presentation
  from the target.

---

## 4. Chains and the resolution stack

| | How | Evidence |
|---|---|---|
| **Master Duel** | A **literal chain graphic** links the participating cards diagonally across the board, **each card lifted off the field and tagged with a giant chain-link number** (`2`, `3`, `4` simultaneously legible, link 4 largest/frontmost), **while the inspect panel auto-shows that link's full card text**. Heavy occlusion accepted. | `duel-ui-teardown-images/masterduel-steam-02.jpg` **[V]** |
| **EDOPro** | No stack visualisation observed. Chain participation is handled by prompts. Chain-link **ordering** for simultaneous triggers is now **sequential prompting** — "the first effect you choose will be Chain Link 1, the next Chain Link 2" — replacing an older batch-assignment window. | **[R]** SRC: projectignis.github.io/faq.html |
| **Master Duel (ordering)** | `Activation Order Settings: On` = "you can manually set the activation order"; `Off` = system decides. | **[R]** |
| **DuelingBook** | No stack object; the chain exists only as successive log lines. | **[V]** from `f_050`–`f_110` logs |

**Reading.** Only Master Duel renders the stack as an object, and it is the single most valuable
frame in the whole teardown. Note both automatic clients independently moved toward **asking about
simultaneous-trigger ordering rather than deciding it** — the same direction our locked decision
union already points. **[R]**

**Recommendation.**
- Build a **persistent, ordered chain display**: for each link, **ordinal number + card identity +
  owner colour**, with **the resolving link's full text auto-pushed** into the inspect area.
  We do **not** need the metal-chain artwork; we need **number + identity + text, unprompted.** **[I]**
- Render it as a **compact ordered strip** rather than Master Duel's screen-filling diagonal — we
  are desktop-first with real pixels and no need to occlude the board.
- **Unresolved:** I could not establish how Master Duel's chain display **scales past ~4 links**;
  the only frame I have shows 4. Long chains are rarer in Edison than in modern formats **[I]**,
  which lowers the risk, but the strip should be designed to scroll or compress. **Flagged.**

---

## 5. "What just happened"

| | Log | Other channels |
|---|---|---|
| **Master Duel** | **Right-docked, phase-structured visual timeline**, toggleable, closed by default. `TURN 8` banners tinted by turn owner; an **LP snapshot row under each turn banner**; **phase headers as section bars** (`Draw Phase`, `Standby Phase`, `Main1 Phase`, `End Phase`); each event a row of **card thumbnail + name + verb (`Draw`/`Set`/`Activate`) + source→destination glyphs joined by a coloured arrow**; **names tinted by owner** (blue yours, red theirs). No prose. | Huge red floating damage numerals; ATK/DEF floating beside every monster; auto-pushed card text on activation **[R]**; face-down cards shown translucent to their owner **[R]**; skippable summon cinematics |
| **DuelingBook** | **Complete, searchable, filterable** — official: "shows information about all actions that are taken during the duel", and sanctioned as a competitive aid. But presented as a **plain prose transcript**: `shewthatsme declared effect of "Dark Contract with the Gate"`. | Manual LP entry; dice/coin icons |
| **EDOPro** | **Deliberately incomplete and terse.** Two turns of play produced four lines, all about revealed cards: `Confirm 1 card(s): *[Junk Synchron]`. Summons, sets and phase changes not logged. A tab, not a panel. `Expand log` / `Clear Log`. | ATK/DEF as plain text under cards |
| Evidence | MD `duel-ui-teardown-duel-ui-teardown-images/masterduel-chain-prompt-and-log.jpg` **[V]**; DB duelingbook.com/welcome + /rules **[V]** and `f_080.png` **[V]**; EDOPro `duel-ui-teardown-images/edopro-hi-03.jpg` **[V]** | |

**★ The identified product gap.** DuelingBook has **completeness without structure**. Master Duel
has **structure without (apparent) completeness**. **Nobody ships both.** **[I, high confidence]**

**Recommendation.** Build **Master Duel's structure over DuelingBook's completeness**:
- log **every** engine event (our audience's incumbent promises this, and treats it as a legitimate
  competitive tool — shipping EDOPro's curated log would read as a regression **[I]**);
- render it as **phase-nested rows of thumbnail + name + verb + from→to arrow, tinted by owner**,
  not as prose;
- **LP snapshot at each turn boundary** — cheap, and removes mental arithmetic;
- filterable and searchable; **collapsed by default**, one right rail.
- Because our engine *resolves* rather than trusting a declaration, our verbs can say what
  **happened**, not what was **declared** — strictly better than DuelingBook's vocabulary. **[I]**
- Also adopt **auto-push of the opponent's card text on activation** — cited by players as one of
  Master Duel's best conveniences **[R]** — and **translucent display of your own set cards** **[R]**.
  Both are near-zero-cost and directly attack "a player cannot tell what is happening".

---

## 6. Always on screen vs on demand

| Element | Master Duel | EDOPro | DuelingBook |
|---|---|---|---|
| Both LP | always, **large corner plates** | always, small top gauges | always, right rail |
| Own hand | always, face-up | always, face-up | always, face-up |
| Opponent hand | always, as **card backs** (count by eye) | always, as card backs | always, as card backs |
| GY / Banished | **fixed hexagonal "wells" on the board**, always present | small angled slots, glyph-labelled, **tiny low-contrast counts** | card-back piles with **large legible counts** |
| Deck / Extra Deck | **physical stacks with visible thickness** | as above | as above |
| Pile contents | on demand; **free, any time** **[R]** | on demand; `F1`–`F8` or **double-click the pile** **[R]** | on demand — **but broadcasts `Viewing Deck` to the opponent** **[V]** |
| Log | on demand (toggle) | on demand (tab) | **always** (rail) |
| Phase | always (badge) | always (centre button) | always (full phase row) |

**Reading.** Master Duel gives **every location permanent, fixed real estate** while keeping
*contents* on demand — that is what makes it glanceable. EDOPro shows all the same counts but
renders them illegibly. DuelingBook shows everything always, and our audience is therefore
**comfortable with density** — a useful corrective to copying Master Duel's minimalism wholesale.

**Recommendation.**
- **Every location gets a permanent, fixed, labelled slot with a large readable count**: Deck,
  GY, Banished, Field Zone, plus opponent hand count **as a numeral, not something to count by eye**.
- **Pile inspection must be free, instant, silent and never broadcast.** DuelingBook broadcasts it
  (`f_080.png` **[V]**) and the community pays for browser extensions to stop it; Master Duel
  permits it freely **[R]**. We are automatic, so there is no integrity argument for announcing it.
  **This is a place we can be unambiguously better than the incumbent at zero cost, and the
  audience will notice on day one.** **[I, high confidence]**
- Keep the log **collapsed by default but one click away**, and remember the player's preference.

---

## 7. Waiting on the opponent — and the tell problem

| | Mechanism |
|---|---|
| Master Duel | **Visible per-player decision clock** (`474`, `466`); prompts **interrupt** and "the light switches from red at the top, to blue on our side"; a **per-side Connection Icon** for poor connection **[V from official legend]**; optional spectator count |
| Dueling Nexus | **Per-player time bar + numeral** (`235`) alongside the LP bar **[V]** |
| DuelingBook | **No clock at all.** Official rules: "There is **no end of match procedure or time limit** on Dueling Book"; pace is socially regulated via Slow Play warnings and judges **[V]** |

**★ The tell problem — a genuine hazard for a human-vs-human client.** Because a prompt visibly
interrupts, **the pause itself leaks information**. A guide describes an opponent noticing "tiny
breaks between activation and resolution" and inferring a Maxx "C"; and for Nibiru, "the moment
that light suddenly switches over to your side after the fifth Monster hits the field, the jig is
up." **[R]** Master Duel's mitigation is to let players **suppress their own prompts** (toggle OFF).

**Recommendation.**
- **Show presence and whose decision it is; do NOT default to a shot clock.** Our audience is
  DuelingBook-native and clock-free by norm; a countdown is the single Master-Duel element most
  likely to be rejected. Make any timer **room-configurable and off by default**. **[I — judgement
  call, flagged as such, not evidence]**
- **Do** ship a per-side **connection/presence indicator** — Master Duel treats it as a named,
  designed element, and it is what distinguishes *thinking* from *disconnected*. **[V]**
- **Do** ship the response-verbosity toggle partly *as* the tell mitigation: a player who can turn
  their own prompts off can stop leaking. Note honestly that **we cannot eliminate the tell** — any
  client that only prompts when a legal response exists leaks its existence. Ours must simply not
  be worse than Master Duel here. **[I]**
- Name what you are waiting for. DuelingBook's own strings do this (`Waiting for response from
  host…`, `Siding in progress! Please wait...`) **[V]**. Never a bare spinner.

### Response verbosity — the table-stakes control (repeat, because it is the top borrowable idea)

| Client | Control | States | Default |
|---|---|---|---|
| EDOPro | three buttons in the left rail **[V]** | `Chain: OFF` / `Always pause` / `Chain: ON`; hotkeys `A`/`S`/`D` are **held**, not toggled **[R]** | middle |
| Master Duel | one **state-labelled chip**, bottom-right, **auto-hidden when set to Auto** **[V]** | `OFF` / `Auto` / `ON`, reached via 5 input modes (`Auto`, `Hold①–③`, `Switch`) **[V from the settings screen]** | `Auto` **[R]** |
| Dueling Nexus | one toggle button, bottom-right **[V]** | `Chaining: Auto` / `Chaining: Manual` | `Auto` **[R]** |

**Recommendation.** Ship a **three-state chip in the duel chrome, showing its current state as
text** (Master Duel's form — the state must be legible without opening anything), **plus a held-key
modifier** to temporarily widen/narrow (EDOPro's and Master Duel's `Hold` idiom). Master Duel's
precise state semantics are documented and worth copying as the spec:
- `OFF` — only mandatory and certain trigger effects;
- `Auto` — additionally: on a Summon, attack declaration, Spell/Trap activation, effect activation,
  and before the opponent ends their turn;
- `ON` — additionally: every phase change *including the intention to leave a phase*, each Battle
  Phase step, the moment after an effect resolves, and minor actions like setting or drawing. **[R]**

Also copy **`Self Chain`** (whether *you* get offered windows on your own chain) and
**`Activation Order`** (manual ordering of simultaneous triggers) as separate axes **[R]** — they
are distinct questions and both mature clients separate them.

---

## 8. ⚠ What I could NOT establish (read this before designing)

Unmarked guesses reaching a design become decisions nobody knows are guesses. These are the guesses.

1. **Master Duel's act-mode command cluster was never seen.** §3a of `masterduel.md` rests entirely
   on the `Command Placement: Change/Fixed` setting description from **two independent translations
   of the client's settings** — the setting's existence and semantics are well attested, but **I
   have no frame showing verb icons rendered next to a card.** Two search passes failed.
   → My "verbs at the card" recommendation is nonetheless **[V] for DuelingBook** (13-entry menu at
   the card) and **[R] for EDOPro**, so the *convergence* claim survives; only Master Duel's
   *visual treatment* of it is unverified. **Confidence in the recommendation: high. Confidence in
   "it looks like Master Duel's": low.**
2. **EDOPro's field-border colour semantics contradict Master Duel's.** In `edopro-hi-01/-04`
   the **opponent's field is blue and the player's own is red/pink** **[V]** — the inverse of Master
   Duel's documented blue=mine / red=theirs. I could not determine whether EDOPro's colours mean
   ownership, seat order, or turn. **We must pick one law and apply it globally.** I recommend
   Master Duel's, because it is *documented* rather than inferred and it matches the CEO's steer.
3. **A red/green collision exists in my own recommendation.** Master Duel uses **red = opponent**;
   Dueling Nexus uses **red = No / green = Yes** **[V]**. If we adopt both laws, red means two
   things. **Unresolved — needs a design decision.** My inclination: keep red/blue strictly for
   ownership, and express confirm/decline by **emphasis and position**, not hue. **[I]**
4. **No live DuelingBook duel.** DuelingBook is **Cloudflare-gated and login-walled**; my capture
   attempts landed on a `Verify you are human` page (`duel-ui-teardown-images/db-replay-r1.jpg` **[V]**) and the
   login page (`duel-ui-teardown-images/duelingbook-after-skip.jpg` **[V]**). All DB in-duel evidence comes from
   **one harvested screenshot plus 122 frames of a third-party extension's demo GIF**. I never saw
   DB's log **in a real duel** (only 5 lines), its search/filter UI, or its siding flow.
5. **Pile↔count mapping is unverified in EDOPro, DuelingBook and Nexus.** I can see counts exist
   and change; I could not reliably say which numeral belongs to Deck vs Extra vs GY vs banished
   in any of the three. Do not copy a specific arrangement from my notes.
6. **Chain display beyond ~4 links** — see §4. Only a 4-link frame exists.
7. **Position-select prompts (attack/defence, face-up/face-down) were never observed in any
   client.** This is one of our 19 variants and I have **no reference for it at all.** Notable gap.
8. **Master Duel's `Field Status` button contents were never seen** — I only have Konami's phrase
   "View the Dueling information for the field." What it actually shows is unknown, and it may be
   the answer to several "what is happening" questions.
9. **Timer semantics unverified** — whether Master Duel's `474`/Nexus's `235` is per-turn,
   per-decision, or a total match budget. Matters if we ever ship a clock.
10. **I did not read our own codebase.** The claim in §3b that our screen probably has EDOPro's
    one-dialog-per-variant pathology is **[I]**, a diagnosis from symptom similarity plus shared
    engine lineage. Worth 30 minutes of someone checking before it is treated as fact.
11. **Edison-specific automatic-client behaviour is unverified.** The Edison community's own table
    scores EDOPro **❌ on Edison Errata** and Master Duel **❌ on Card Pool** **[V]** — so no
    automatic client in this set actually plays Edison correctly today. I therefore have **no
    reference implementation of an Edison-correct automatic duel UI**. Card-text/errata correctness
    is outside my scope but is a real, adjacent risk.

---

## 9. The recommendation, condensed

**Adopt DuelingBook's interaction grammar, Master Duel's presentation discipline, and use ocgcore
to do the thing DuelingBook cannot.**

1. **Select-then-verb, verbs anchored at the card** — the grammar all four clients share and our
   audience's fingers already know. **Only legal verbs**, courtesy of the engine. This alone fixes
   the "janky menu" complaint that follows our audience from the incumbent.
2. **Exactly one Question Bar, docked bottom-centre**, for all 19 decision variants: a sentence
   naming the card (with inline `(Graveyard)`-style location), candidate answers as
   ownership-badged thumbnails, explicit confirm and an equal-weight decline. **Never two question
   surfaces at once.** This is the single change most likely to fix "a player cannot tell what they
   may do".
3. **Acting and answering are different objects in different places** — not different colours of
   the same object.
4. **One ownership colour law, applied everywhere**: board framing, phase row, log entries, target
   badges. Blue = yours, red = theirs. Reserve those hues for ownership only.
5. **A three-state response-verbosity chip in the duel chrome**, state legible at a glance, with a
   held-key modifier. Table stakes; every automatic client has one.
6. **Full phase row, centre or top, current phase lit, legal next phases clickable** — the
   incumbent's widget, the target's styling.
7. **A complete, phase-structured, owner-tinted visual log** in one collapsible right rail. Nobody
   ships completeness *and* structure; we can.
8. **Every location permanently on the board with a large count; contents free, instant and silent
   to inspect.** Never broadcast that a player is looking at something.
9. **Auto-push card text on activation**, and show the player their own set cards translucently.
   Cheapest available wins against "I can't tell what is happening".
10. **Delete all post-Edison field furniture.** Two rows of five plus a Field Zone.
11. **Presence yes, shot clock no** — make any timer room-configurable and off by default.
12. **Ship `sequence` (zone choice) as a `Choose Zones`-style toggle, defaulted to auto.** Both the
    incumbent (`☑ Choose Zones`, **[V]**) and the visual target (`Card Position: Manual/Auto`,
    **[R]**) treat exact zone placement as a **player-toggleable preference defaulted for speed** —
    and Edison, having no Link arrows and no Infinite Impermanence, removes most of the strategic
    reasons modern players insist on Manual. The capability is genuinely needed; **always-on
    prompting for it is not.**

---

# Yu-Gi-Oh! Master Duel — teardown

**Why it matters to us:** it is the CEO's stated visual and feel target ("smooth, intuitive
gameplay", assumes players know the game). It is also, structurally, the closest analogue to
our problem: an automated engine mediating **two humans who cannot talk to each other**.

Evidence keys: `IMG:<path>` = image on disk, `SRC:<url>` = text source. Confidence:
**[verified]** = I read it in an image or a primary/official doc; **[reported]** = secondary
source asserts it, I did not see it myself; **[inference]** = my reading, not evidence.

---

## 1. The framing insight (this is the whole brief in one quote)

> "Unlike the Physical card game, Master Duel has no direct communication between players.
> Instead, the game itself has to act as a mediator. This means that Master Duel has to step
> in and ask when and which card should be activated (also known as Activation
> Confirmation)."
> **[reported]** SRC: https://outof.games/realms/yugioh/guides/225-activation-confirmation-toggle-function-how-to-make-the-most-of-master-duels-prompts/

Master Duel's entire interaction design is organised around the fact that **the engine must
ask, and asking is expensive**. Every mechanism below is a device for controlling *how often
the human gets interrupted*. That is exactly our failure mode: our engine asks, the player
cannot tell what is being asked, so the screen feels unanswerable. **[inference]**

---

## 2. Screen chrome — official Konami legend

Source is the in-game Duel Screen info guide, reproduced verbatim by gameplay.tips.
**[verified]** SRC: https://gameplay.tips/guides/yu-gi-oh-master-duel-duel-screen-info-guide-duel-field-menu-and-icons.html
IMG: `duel-ui-teardown-images/masterduel-official-duelscreen-legend.jpg` (the numbered screenshot the legend
annotates), IMG: `duel-ui-teardown-images/masterduel-official-field-zones.jpg` (the field-zone diagram).

Numbered elements of the duel screen, per Konami:
1. **Menu Button** — opens the Menu.
2. **Duel Log Button** — "Toggle the visibility of the Duel Log." → log is **on demand**, not always-on.
3. **Field Status Button** — "View the Dueling information for the field."
4. **Activation Confirmation Button** — "Change the settings that control effect activations.
   **This will not be visible if activation confirmation is set to Auto.**"
   → the response-mode control is a *first-class piece of duel chrome*, and it
   self-hides when it has nothing to offer.
5. Your Hand · 6. Your Life Points · 7. Your Mate · 8. Opponent's Hand · 9. Opponent's LP · 10. Opponent's Mate

So the **always-on set is small**: both hands (yours face-up, theirs as backs), both LP, both
avatars ("Mate"), the field. Everything else — log, field status, card lists — is a button.
**[verified from the legend]**

There is also a **Connection Icon**: "When a player is detected to have poor connection
during a match, this icon will appear on their side." **[verified]** same SRC.
→ Per-side connection health is a named, designed element, not an afterthought. Relevant to
"how the client handles waiting on the opponent": MD distinguishes *thinking* from *lagging*.

### Zones (Konami's own list)
Main Monster Zones (5), Extra Monster Zones, Spell & Trap Zone (5), Pendulum Zone, Field
Zone, Graveyard, Extra Deck Zone, Deck Zone, Banished Cards. **[verified]** same SRC.
→ **Banished is a named, positioned zone on the board**, not a submenu. Same for GY, Deck,
Extra Deck. They occupy real estate and show counts even though their contents are on demand.
→ For **Edison** we must delete Extra Monster Zones, Pendulum Zones and Link furniture
entirely. **[inference]** (EDOPro corroborates that old rulesets simply don't draw them — see `edopro.md`.)

---

## 3. Interaction grammar — how the player initiates intent

### 3a. Click card → command icons appear **above that card**
There is a duel setting **"Command Placement"** (コマンドの表示位置) with two values:
- **Change** — "The command icon (launch/attack/change display/select confirmation, etc.)
  will be directly above the card you selected."
- **Fixed** — "The command icon will be displayed in a fixed position and will not change
  with the card position."
The translator recommends **Change**, "so that the mouse does not need to move around."
**[reported]** SRC: https://daydaynews.cc/en/game/translation-of-yu-gi-oh-master-duel-about-various-settings-in-the.html

This is the core grammar and it is worth being precise about it:
- The verb set is **contextual** (its members are named as activate / attack / change display
  position / confirm selection — i.e. *the legal actions for that card right now*).
- It is **spatially anchored to the card the player touched**, by default.
- It is therefore **not** a drag-to-zone grammar and **not** a global command bar. It is
  *select-then-verb*, with the verbs rendered next to the noun. **[reported → strong]**

### 3b. Zone choice is a separate, explicit step (and it is optional)
Setting **"Card Position" / カード配置位置**:
- **Manual** — "Allows you to manually select the position on the field when the card is activated."
- **Auto** — "The position of the card will be automatically selected. The selection rule is
  to place the card in the center first, and then configure it to the left and the right on
  both sides."
The source calls Manual "strongly recommended," because Link arrow directions and
same-column cards (Infinite Impermanence) make placement strategically load-bearing.
**[reported]** SRC: daydaynews (above)

→ **Directly relevant to our accepted cost of adding a zone `sequence` per card.** Master
Duel treats "which zone exactly" as a *player decision that can be defaulted away*. In
**Edison there are no Link arrows and no Infinite Impermanence**, so the strategic reasons
that force Manual in modern MD largely do not apply to our format. The remaining Edison-era
reasons to care about sequence are narrower (e.g. scoping of column/position-referencing
cards, and simple board legibility across turns). **[inference — flagged, see COMPARISON.md]**

### 3c. Animations are skippable by the player
Special Summon animations (Fusion/Ritual/Synchro/Xyz/Pendulum/Link) are a toggle, and when
on, "This animation can be skipped by manually clicking the left button." **[reported]** SRC: daydaynews
→ Spectacle is opt-in and always interruptible. Never block input on a flourish.

---

## 4. How the client asks the player a question — and how that is made visually distinct

This is the part our screen is failing at, and MD's answer is unusually concrete.

### 4a. The "turn light" — a two-sided directional indicator
When a prompt appears, "the game is interrupted. In this case, **the light switches from red
at the top, to blue on our side**. On top of that, **the timer counts down your own time**
until you've made a decision, forcing your opponent to wait until then."
**[reported]** SRC: outof.games (above)

Three separable mechanisms in that one sentence:
1. A **persistent light/indicator with a side and a colour** — red = opponent side has
   priority, blue = you do. It is not a text banner; it is a coloured region that *moves*.
2. **Colour is bound to ownership, not to state.** Corroborated by the official targeting
   legend: "Cards in your control are marked with a **blue** icon, and cards in your
   opponent's control are marked with a **red** icon." **[verified]** SRC: gameplay.tips
   → **blue = mine / red = theirs is a consistent, whole-screen colour law in MD.**
3. A **decision clock that is per-player and visible**, which doubles as the answer to
   "how do you handle waiting on the opponent" — you are shown *whose* clock is running.

### 4b. Prompt frequency is a player-configurable standing answer
**Activation Confirmation** has three *states* and five *input modes* for reaching them.
**[reported]** SRC: outof.games; corroborated independently by SRC: daydaynews.

States (what the engine is permitted to ask about):
- **OFF** — "The game won't bother you about most optional effects. Exceptions are mandatory
  effects and certain trigger effects."
- **Auto** — additionally offers any appropriate quick effect in response to: Summon of a
  monster; attack declaration; activation of Spells/Traps; activation of Spell/Trap/Monster
  effects; before the opponent ends their turn.
- **ON** — additionally offers a quick effect at *any* possible moment: any change of phases
  including the intention to *leave* a phase, the steps within the Battle Phase, the moment
  after an effect resolves, and minor actions such as setting a card or drawing for turn.

Input modes:
- **Auto** — permanent, no easy switch.
- **Hold 1** — hold LMB for ON, RMB for OFF; neither = Auto.
- **Hold 2** — hold either button for OFF; default Auto.
- **Hold 3** — hold LMB for ON; default OFF.
- **Switch** — holding does nothing; left-click a **symbol in the bottom right** to cycle
  Auto → OFF → ON → Auto.
On controller only **RB/R1** is bound, so Switch is the only mode giving full range.

→ Two design lessons. (a) The prompt-frequency control is **modal by held input** — the
default is a middle setting and the player *leans* on a key to temporarily widen or narrow
what they get asked. (b) Because this is per-moment, **it is not a settings-screen decision,
it is an in-duel motor action**. That is why the Activation Confirmation button lives in the
duel chrome (§2, item 4).

**Competitive side-effect worth knowing (the tell problem):** because a prompt *visibly
interrupts* the opponent, the pauses leak information. The guide describes an opponent
"who keeps noticing how your activations have tiny breaks between activation and
resolution," inferring a Maxx "C" in hand, and describes Nibiru: "The moment that light
suddenly switches over to your side after the fifth Monster hits the field, the jig is up."
**[reported]** SRC: outof.games
→ **For a human-vs-human client this is a real design hazard.** A prompt that only appears
when the player *has* a legal response tells the opponent that they have one. MD's mitigation
is to let players suppress their own prompts (toggle OFF). Ours must at minimum not be
*worse* than MD here. **[inference — important, unresolved; see COMPARISON.md]**

### 4c. Self Chain — whether the engine offers *you* a window on your own chain
**Self Chain** setting: **On** = "A query will be sent to confirm the activation of the chain
on both sides, that is, it will give you the timing and ask if you want to chain the next
card." **Auto** = "It will only ask the other party's chain… it will not give you the timing
of chaining your own card… If the opponent does not chain, it will be executed directly."
**[reported]** SRC: daydaynews
→ Separate axis from Activation Confirmation: *who* gets offered windows, vs *when*.

### 4d. Simultaneous activations — explicit ordering, player-controlled
**Activation Order Settings**: **On** = "When there are multiple cards that need to be
activated at the same time, you can manually set the activation order of the cards."
**Off** = "The order will be determined automatically by the system." **[reported]** SRC: daydaynews
→ Same conclusion as EDOPro's chain-link change: the ordering of simultaneous triggers is a
question the client must be able to put to the player, and mature clients default to asking.

### 4e. Targeting — the location-icon system
"When you can select a target for an effect, the location of each eligible card will be
indicated with one of these icons." Icons exist for **hand, field, Deck, Extra Deck,
Graveyard, banished, and "being used as an Xyz Material"**, coloured blue for your cards and
red for the opponent's. **[verified]** SRC: gameplay.tips
IMG: `duel-ui-teardown-images/masterduel-icon-loc-hand.jpg`, `-field.png`, `-deck.png`, `-gy.png`

→ This is the single most transferable mechanism in the whole teardown. When the engine asks
"choose a target", MD does **not** just open a list; it **annotates every eligible card with
where it lives and whose it is**. A target set that spans hand + GY + field + banished is
made legible without the player opening four pile viewers.

### 4f. Card Status icons — persistent per-card state
Icons indicate: effects negated; cannot be Special Summoned; temporarily banished by an
effect; used as Fusion material; used as Synchro material; destroyed by battle; cannot attack
due to a card effect. Shown "from left to right below its card details" when you select a
card from the Card List. **[verified]** SRC: gameplay.tips
IMG: `duel-ui-teardown-images/masterduel-icon-status-negated.jpg`
→ Note *where* they live: on the card detail panel, not floating on the board. The board stays
clean; the state is available on inspection. **[inference]**

---

## 5. "What just happened" communication
- **Duel Log** exists and is **toggleable chrome** (§2 item 2). **[verified]**
- **Automatic card-description display**: setting "Automatically Display Card Description" —
  On = "The card description will be displayed automatically when the card is summoned/
  activated." **[reported]** SRC: daydaynews
  → i.e. the client **pushes the card text at you when a card resolves**, so you do not have
  to ask what your opponent just played. A second source praises this as "convenient because
  it automatically displays the effects of cards used by your opponent."
  **[reported]** SRC: https://note.com/mamotin/n/n46fc0810fcb8
  → **This is the highest-value, lowest-cost "what just happened" mechanism available to us.**
- **Face-down cards shown translucent to their owner**: "Display Face-Down Cards as
  Transparent" — Show = "The card will be displayed in a translucent state on its own cover
  card." **[reported]** SRC: daydaynews. Second source: "Your set cards will be displayed as
  semi-transparent without needing to hover over them, making it easier to check the
  situation." **[reported]** SRC: note.com
  → Owner-only information revealed *in place*, no interaction needed.
- **Battle Phase detail display**: On shows sub-step markers under "Battle Phase" (observed
  values S / 03 / 05 — start of BP, before damage calculation, and battle-destruction
  effect timing). **[reported]** SRC: daydaynews
  → Phase display is **not** just five phase names; the Battle Phase is expandable into steps,
  because that is where response timing is finest. **[inference]**

## 6. Waiting on the opponent
- The visible **per-player decision timer** (§4a) — you see whose clock runs. **[reported]**
- The **Connection Icon** per side (§2). **[verified]**
- **Spectator count** is an optional display. **[reported]** SRC: daydaynews
- MD explicitly notes the asymmetry does not exist vs AI: "this does not apply for Solo Mode,
  as the computer decides instantaneously." **[reported]** SRC: outof.games
  → We are human-vs-human only, so we are permanently in the case MD had to design for.

---
## 7. Image inventory — observed, batch by batch

### Batch A — the official legend + field diagram
**IMG: `duel-ui-teardown-images/masterduel-official-duelscreen-legend.jpg`** (Konami's numbered duel screen)
**[verified — I read this image]**
- **The board occupies essentially the entire viewport.** There are **no side panels, no
  docked log, no reserved chrome column.** Chrome is *corner-anchored icons and LP plates
  floating over the board art*. This is the single biggest layout difference from
  EDOPro/DuelingBook and the clearest expression of the "Master Duel feel".
- Field is drawn in **slight 3D perspective, top-down-ish**, opponent's half at top, player's
  half at bottom, mirrored about a horizontal centre line.
- **Ownership is encoded in the field framing itself:** the player's half has a **cyan/blue
  glowing edge**; the opponent's half is **warm orange/red**. This corroborates the
  blue=mine / red=theirs colour law from the icon legend (§4a) — it is applied to the *board*,
  not just to icons.
- Positions actually observed:
  - ① gear/Menu — **top-left**
  - ⑨ opponent LP + ⑩ opponent Mate portrait — **top-right**
  - ⑧ opponent hand — **top-centre**, rendered as card backs, fanned
  - ⑤ your hand — **bottom-centre**, face-up, fanned, overlapping the field edge
  - ⑥ your LP + ⑦ your Mate — **bottom-left**
  - ④ Activation Confirmation, ③ Field Status, ② Duel Log — **bottom-right cluster of three
    round icons**, in that left-to-right order.
- **A circular "Turn 1 / Main 1" badge sits on the RIGHT edge at the vertical centre line.**
  Phase and turn number are one compound badge, not a phase strip or ribbon.
- **A circular blue badge reading `474` sits on the LEFT edge at the centre line** — the
  decision/turn clock (§4a), mirroring the phase badge across the field.
  **[verified position; that it is the clock is [inference] from the 3-digit countdown + §4a]**
- → Layout summary: **board ~100% of screen; four corners carry identity/LP/menu; the two
  mid-edge circular badges carry "whose turn / what phase" and "how long left".**

**IMG: `duel-ui-teardown-images/masterduel-official-field-zones.jpg`** (Konami's zone map) **[verified]**
- Three rows per side: **Extra Monster Zones (2)** top, **Main Monster Zones (5)** middle,
  **Spell & Trap Zones (5)** bottom. **Pendulum Zones are the outermost S/T slots** (⑦ bracket
  spans the two ends of the S/T row) — i.e. Master Rule 4 geometry.
- **Field Zone** is a single slot on the **far left of the monster row** (⑤).
- **Extra Deck** bottom-left card stack, **Deck** bottom-right card stack — both drawn as
  *physical stacks with visible thickness*, so depth reads as count at a glance.
- **Graveyard and Banished are two stacked hexagonal "wells" on the right edge** of the
  player's half — always present, always in the same place, adjacent to the field.
- → **All six locations (Deck, Extra, GY, Banished, Field Zone, hand) have permanent, fixed
  board real estate.** Nothing pile-like is hidden behind a menu; only their *contents* are on
  demand. This is the answer to "what is always on screen".
- → **For Edison we delete: Extra Monster Zones and Pendulum Zones.** That frees the top row
  and the outer S/T slots, leaving a much cleaner 5+5 two-row field per side. **[inference]**

### Batch B — in-duel: damage, card inspect, ATK/DEF
**IMG: `duel-ui-teardown-images/masterduel-steam-01.jpg`** (Battle Phase, damage resolving) **[verified]**
- **Card inspect is a LEFT-DOCKED OVERLAY drawn on top of the board**, not a reserved column:
  card name + attribute icon in a coloured title bar, card thumbnail, ★level, ATK, DEF, type
  line (`[Rock/Effect]`), then full scrollable card text. It floats over the field and can
  therefore vanish entirely when not needed.
- **Every monster on the field carries its ATK/DEF as floating text right beside the card**
  (`1900/1600`, `1500/1500`, `2000/1500`). Current-vs-original is colour-coded: a modified
  value appears in **blue** (`2500`, `2000`) where unmodified pairs are white.
  **[verified visually; the exact colour semantics are [inference]]**
- **Damage is communicated as a huge red floating number** (`1200`) at the point of impact,
  over a green swirl effect, with the attacker's value (`2300`) above it. Nothing about damage
  requires reading a log.
- LP are **large numerals** on the corner plates (`7500`, `9000`) — the largest text on screen
  after the damage number.
- **Only TWO round icons appear bottom-right here** (Field Status, Duel Log) — the third,
  Activation Confirmation, is **absent**. This *directly verifies* Konami's note that the
  Activation Confirmation button "will not be visible if activation confirmation is set to
  Auto" (§2). **[verified — nice independent confirmation]**
- The "Mate" is a full character model standing at the right edge of the field, not just a
  portrait. Pure flavour; costs board space; **we should skip it.** **[inference]**
- **No log panel is visible.** The Duel Log is closed by default. **[verified]**

### Batch C — CHAINS (the most valuable image in the set)
**IMG: `duel-ui-teardown-images/masterduel-steam-02.jpg`** **[verified]**
- Master Duel renders a chain as a **literal metal chain** running diagonally across the
  field, physically linking the participating cards, **each card enlarged off the board and
  tagged with a giant chain-link number** — `2`, `3`, `4` are all legible simultaneously,
  with **Chain Link 4 (`Called by the Grave`) largest and frontmost** as the one being added
  or resolved.
- **Simultaneously, the left inspect panel auto-shows the full text of that chain link's card**
  (`Called by the Grave`, `[Spell]`, `Quick-Play Spell`, complete effect text). This is the
  "Automatically Display Card Description" setting (§5) firing during chain resolution.
- → So MD answers *both* "what is the stack?" and "what does this card do?" **in one composed
  frame, with zero player interaction**: the ordinal position is spatial and numeric, the
  identity is the card art itself, and the semantics are the auto-pushed text panel.
- → **This is the mechanism our screen most needs and is the cheapest big win available**:
  a numbered, ordered, always-visible chain display with auto-pushed card text. We do not need
  the metal-chain art; we need **ordinal number + card identity + card text, unprompted.**
  **[inference — my primary recommendation, see COMPARISON.md]**
- Note the chain is drawn **over** the board, obscuring much of it. MD accepts heavy occlusion
  during a chain because nothing else matters at that moment. **[inference]**

### Batch D — summon cinematics, and the Activation Confirmation button in the flesh
**IMG: `duel-ui-teardown-images/masterduel-steam-03.jpg`**, **IMG: `duel-ui-teardown-images/masterduel-steam-04.jpg`** **[verified]**
- Both are **full-screen summon cinematics**: the monster's artwork fills the viewport, the
  board dims to a faint backdrop, and a lower banner carries **star level (★ pips), the card
  name in large italic type, and an `ATK 2800 DEF 2500` plate**.
- Critically, **the persistent chrome survives the cinematic**: gear top-left, own LP plate
  bottom-left, opponent LP top-right, and the round icons bottom-right all remain. In
  steam-04 the `Turn 20 / Main 1` badge and the `466` clock are still faintly visible at the
  right and left mid-edges.
  → **Rule to steal: identity/LP/phase/clock never disappear, whatever spectacle is playing.**
  A player who looks away and back can always re-orient from the four corners and two edges.
- These are the animations the "Special Summon Animation" setting governs, and which are
  click-skippable (§3c). For **Edison** there are no Fusion/Synchro/Xyz/Link summon
  cinematics to build at all — the era's summons are Normal/Tribute/Flip/Ritual — so this is
  largely **not work we need to do**. **[inference]**

**IMG: `duel-ui-teardown-images/masterduel-steam-03.jpg` — bottom-right icon cluster** **[verified, high value]**
- A **third round icon is present here, and it is labelled `Auto`** with a small toggle glyph.
  That is the **Activation Confirmation button in `Switch` mode, rendering its current state
  as text on the button itself.**
- → Two things verified at once: (a) the button appears only when the mode makes it meaningful
  (compare steam-01/-04, where it is absent — Auto mode), and (b) **the current response-mode
  state is legible at a glance without opening anything.** The player always knows how
  talkative the engine currently is.
- → **Directly borrowable for us:** one always-visible chip in the duel chrome reading the
  current response posture (e.g. `AUTO` / `ON` / `OFF`), clickable to cycle.

**IMG: `duel-ui-teardown-images/md-p1-865e28ef.jpg` — the settings screen itself** **[verified — upgrades §4b
from [reported] to [verified]]**
- `Game Settings` → left nav `General / Duel / Audience-Replays`, with **`Duel` selected**.
- An open option list shows exactly **five values: `Auto`, `Hold①`, `Hold②`, `Hold③`,
  `Switch`**, plus `CANCEL`. This confirms the five Activation Confirmation input modes
  from the client UI, not from a guide.
- The partially-occluded settings column behind it shows the sibling rows with their values —
  `On`, **`Switch`** (currently selected, highlighted), `Manual`, `On`, `Show`, `On` — matching
  the documented setting order in §3b/§4c/§4d/§5: Self Chain = On, Activation Confirmation =
  Switch, Card Position = **Manual**, Activation Order = On, Face-down transparent = **Show**.
- One row's description text is partly readable: "…our or your opponent's" and "…Duel screen."
  → consistent with Self Chain ("your or your opponent's" effects) and with the Switch mode
  description referring to a button on the Duel screen. **[inference on the mapping]**
- → Note this is **1280×720 and the dialog is a narrow centred column** — Master Duel's
  settings UI is a phone layout stretched onto desktop. **We are desktop-first and should not
  copy this shape.** **[inference]**

### Batch E — non-duel screen, for layout contrast only
**IMG: `duel-ui-teardown-images/masterduel-steam-08.jpg`** (Deck edit screen) **[verified]**
- Three-pane desktop layout: **left** = selected-card detail (art, ★, ATK/DEF, type line, flavour
  text, `+1`/`-1`, `How to Obtain`, `Related Cards`, `Dismantle`/`Generate`); **centre** = the
  deck as a dense grid with `Main Deck 40` / `Extra Deck 5` counts in the section headers;
  **right** = `Card List` with search-by-name, sort control, filter and tabbed alternates.
- → The instructive contrast: **Master Duel is perfectly willing to use dense multi-pane
  desktop chrome in menus, and uses none of it in the duel.** The panel-free duel screen is a
  deliberate choice, not a platform limitation. **[inference, high confidence]**
- Not evidence about duelling; recorded so nobody later mistakes it for the duel screen.

### Batch F — Solo-mode story screens (no duel evidence)
**IMG: `duel-ui-teardown-images/masterduel-steam-05.jpg`** (Solo mode progression map: SCENARIO / Practice /
DUEL / Goal nodes on a branching track, with `COMPLETE!!` and `CLEAR!` ribbons and `Locked`
gates), **IMG: `duel-ui-teardown-images/masterduel-steam-06.jpg`**, **IMG: `duel-ui-teardown-images/masterduel-steam-07.jpg`**
(story cutscenes: four cards floating over painted backdrops with narration text).
**[verified]**
- **Irrelevant to us and recorded only so they are not mistaken for duel evidence.** These are
  the solo/story layer; we are human-vs-human with no solo play. No interaction-grammar
  content.

### Batch G — ★ THE CHAIN-RESPONSE PROMPT, WITH THE DUEL LOG OPEN ★
**IMG: `duel-ui-teardown-duel-ui-teardown-images/masterduel-chain-prompt-and-log.jpg`** **[verified — the single most useful image in the set]**

Context: it is the **opponent's** Turn 8, they have activated `Rebirth of Nephthys`, and the
client is asking **us** whether to chain. Our LP 150 (`Fliboce`, bottom-left), theirs 8000
(`Circle of the Phoenix`, top-right).

**G1. The question is asked as a sentence, with semantic colour-highlighting.**
The prompt reads:
> `"Rebirth of Nephthys" is activated. Chain another card or effect?`
with **the card name in yellow**, **`activated` in yellow/orange**, and **`Chain` in cyan**.
→ The client writes a *sentence naming the specific card and the specific decision*, and
tints the load-bearing words. It does not say "Select a response" or show a bare Yes/No.
→ **This is the pattern we should adopt for all 19 of our decision variants: a one-line
natural-language question that names the card and the verb.** **[inference — core recommendation]**

**G2. The answer space is presented as selectable card thumbnails + two explicit buttons.**
- The two legal responses are shown as **card thumbnails inside the prompt panel**, each
  carrying a **small location badge in its top-left corner** — the Card Location Icons of §4e,
  in live use. One also carries a **red star badge with `2`**.
- Buttons: **`Cancel`** (left) and **`Activate Effect`** (right, in highlighted yellow-green).
- → Note the shape: **the question, the candidate answers, and the commit/decline verbs are all
  in ONE panel.** The player never has to hunt the board to answer a question. Compare EDOPro,
  where responding means finding the card on the field.
- → Note also that `Cancel` is always present and equally weighted. **Declining is a first-class
  answer, not a dismissal.** **[inference]**

**G3. The prompt panel is bottom-centre, modal-looking, and does NOT occlude the board's
information.** It sits over the lower/empty part of the field, leaving both players' rows,
both LP plates, the phase badge and the log all readable. A small **cyan chevron marker** sits
just above the panel, tying it to the field.
→ **Asking mode is visually distinct from acting mode by *panel presence and position*:** a
docked bottom-centre panel with a question sentence + candidate cards + Cancel/Confirm. Acting
mode has no such panel (commands appear next to the card instead, §3a).
→ **That is the clean answer to the coordinator's central question.** MD does not rely on a
colour or a mode indicator to distinguish "you may act" from "you are being asked" — it uses
**a completely different UI object in a different screen position.** **[inference, high confidence]**

**G4. The turn/phase badge is colour-coded by turn ownership.**
Here the badge reads `Turn 8 / Main1` in a **RED hexagon**. In `masterduel-steam-01/-02`
(our own turn) the equivalent badge is **blue/gold**. Combined with the official
blue=mine/red=theirs law (§4a), this means:
→ **The phase badge doubles as the whose-turn indicator via its colour.** One object, two jobs,
zero extra screen space. **[verified across images — strong]**

**G5. ★ The Duel Log is a right-docked, turn-and-phase-structured timeline — not a text feed.**
This is the most transferable single component in the entire teardown. Observed structure,
top to bottom:
- **`TURN 8` banner** as a full-width divider (in **red**, i.e. coloured by whose turn it is).
- Immediately under each turn banner, an **LP snapshot row**: both players' hex avatars with
  `LP150` and `LP8000`. → *The log records the score at each turn boundary*, so you can read
  the LP history without arithmetic.
- **Phase headers as grey section bars**: `Draw Phase`, `Standby Phase`, `Main1 Phase`,
  `End Phase`, then the next turn's `Draw Phase`, `Standby Phase`, `Main1 Phase`.
  → **The log is indexed by phase, not by timestamp.** Every event is nested under the phase it
  happened in. This is what makes it scannable.
- **Each event is a compact row: card thumbnail + card name + the action verb + a
  source→destination glyph pair joined by a coloured arrow.** Observed rows:
  - `Ash Blossom & Joyous Spring` — `Draw` — [location glyph]
  - `Called by the Grave` — `Set` — [hand glyph] →(blue arrow)→ [field glyph]
  - `Rebirth of Nephthys` — `Activate` — [glyph] →(red arrow)→ [glyph]
- **Card names are tinted by owner**: `Ash Blossom` and `Called by the Grave` in **blue** (ours),
  `Rebirth of Nephthys` in **red** (theirs). Same colour law again.
→ So the log answers "what just happened" *and* "whose was it" *and* "where did it move
from/to" in one glanceable row, with **no prose**. It is a structured event table rendered as
cards+glyphs+arrows.
→ **Recommendation: this is the log we should build** — not a scrolling text transcript.
It also reconciles the DuelingBook expectation of a complete log (see `duelingbook.md` §3) with
the Master-Duel feel the CEO wants: *completeness delivered as structure, not as prose.*
**[inference — core recommendation]**

**G6. Chrome in this frame**: gear top-left; own LP bottom-left; opp LP top-right; the
bottom-right cluster is **`Auto` (activation-confirmation state chip), `i` (field status), and a
blue `▶▶` double-chevron** — the third icon has become a collapse control while the log panel
is open. **[the `▶▶` = collapse-log reading is [inference]]**
→ Note: with the log open, Master Duel **does** become a two-pane desktop layout (board + right
rail). The panel-free look is the *default*, not a constraint. **This matters for us: opening
the log is an accepted, designed state, not a compromise.** **[inference]**

## 8. Addenda from a final source sweep
- **Pile inspection is free and unrestricted in Master Duel:** "you may view the contents of your
  Extra Deck **at any time during the Duel**." **[reported]**
  SRC: https://www.masterduelmeta.com/articles/guides/expanded-rule-book
  → Corroborates the recommendation in `duelingbook.md` C3: inspection should be free, silent and
  unlimited. Master Duel already works this way; DuelingBook does not.
- **Hover reveals relationships:** "Mousing over or tapping the Equip Spell Card will show you
  what monster it is equipped to." **[reported]** SRC: masterduelmeta (above)
  → Cheap pattern for us: hover a card to reveal its *links to other cards* (equip target,
  material, what is negating it), rather than requiring a separate inspector.
- **The in-match default is Auto:** "While in a match, the card activation setting will be set to
  Auto." **[reported]** SRC: https://www.gamepur.com/guides/how-to-turn-off-automation-and-manually-activate-card-effects-on-yu-gi-oh-master-duel
  → Confirms the middle setting is the shipped default, as in EDOPro and Dueling Nexus.

## 9. ⚠ Known gap in this file
**§3a (click card → command icons appear above the card) is `[reported]` only.** It rests on the
`Command Placement: Change/Fixed` setting description from two independent translations of the
Japanese client's settings. **I never obtained a frame showing the command icons rendered next
to a card.** Two search passes for such a screenshot failed. The *existence and semantics* of the
setting are well attested; the *visual form* of the command cluster is not verified.
Treated accordingly in `COMPARISON.md`.

---

# EDOPro / YGOPro — teardown

**Why it matters to us:** same rules engine lineage (ocgcore). Its UI is, effectively,
a thin renderer over the *same decision union we have*. Everything EDOPro does, we can
do without engine work; everything EDOPro fails to do is a UI failure, not an engine one.

Evidence keys: `IMG:<path>` = image on disk, `SRC:<url>` = text source. Confidence marked
per claim: **[verified]** = read it in an image or primary doc; **[reported]** = a
secondary source says so, I did not see it; **[inference]** = my reading, not evidence.

---

## 1. Text-sourced facts (before images)

### Interaction grammar: click-card → contextual action list
- Clicking a card yields **a set of contextual options**, and the option set is filtered by
  legality: a source describes clicking Foolish Burial offering *Activate or Set*, while
  clicking Torrential Tribute (a Trap) offers **only Set**.
  **[reported]** SRC: https://drcakey.blogspot.com/2023/05/edopro-duel-screen-setting-up-duel-ai.html
  → This is the crucial shape: **the client never shows an illegal verb.** The engine's
  legal-action set is rendered as a menu, not validated after the fact.
- **Actions are committing and un-undoable.** "By pressing Normal Summon, Set or Activate,
  you have already committed to performing the action." **[reported]**
  SRC: https://projectignis.github.io/faq.html
  Secondary source phrases it as EDOPro being "ruthless when it comes to taking back your
  moves. Once you've started doing something, you can almost never undo it."
  **[reported]** SRC: drcakey (above)
  → *Design consequence for us:* there is no undo in this family of clients. Cancel exists
  only while a question is open, not after an answer is submitted.
- **Piles are queried, not browsed-then-acted.** Clicking your Graveyard then "Activate"
  lists all cards there that *can* activate an effect; you pick one or cancel.
  **[reported]** SRC: drcakey
  → Pile-as-actionable-location, not just pile-as-viewer.
- **Affordance highlighting exists and is spatial:** a "ring of light" appears over the
  Extra Deck when a Synchro/Xyz Summon is available. **[reported]** SRC: drcakey
  → EDOPro signals *where* an available action lives by lighting the zone, before the
  player commits to opening it.

### Chain / response handling — the important part
- EDOPro exposes a **persistent three-state chain-response mode**, as buttons on the duel
  screen: `Chain: OFF`, `Always pause`, `Chain: ON`. **[reported]** SRC: drcakey
  - Keyboard shortcuts are **held**, not toggled: holding `A` = Chain:OFF, `S` = Chain:ON,
    `D` = Always pause, "as long as the key is held down." **[reported]** SRC: drcakey
  - → This is a *standing answer* to a class of engine questions. The client pre-answers
    "do you respond?" so the player is not interrupted on every priority pass. This is the
    single highest-value borrowable idea in the client: the engine asks constantly; the UI
    decides how often to bother the human.
- **Chain-link ordering is now sequential, not a batch dialog.** Previously a window let
  you assign each simultaneous trigger a chain link number, then all fired at once. Now
  "you're prompted to choose an effect to activate, and the first effect you choose will be
  Chain Link 1, the next will be Chain Link 2, etc," until you stop or there are no more;
  then the opponent gets to add to the chain. **[reported]** SRC: https://projectignis.github.io/faq.html
  → Note the direction of travel: the client moved *away* from a compound modal that
  captures a whole ordering, *toward* repeated single-choice prompts. That is the same
  direction our locked 19-variant decision union already points.

### Always-on-screen vs on-demand
- Pile viewers are **on demand, keyboard-first**: `F1`–`F8` open the GY / banished / etc.
  viewing windows; a later release added **double-click on a pile** as the equivalent.
  **[reported]** SRC: https://github.com/edo9300/edopro/releases (release note: "Double
  clicking/tapping on a card pile (GY, banished, etc) will now open the viewing window for
  that pile (equivalent to using the F1-F8 keys)")
  → Piles are *counted* on the board and *browsed* in an overlay. Nothing pile-like is
  permanently expanded.
- **The log is a tab in a side pane, not a dedicated panel.** The left pane normally shows
  card text; Log is one of several tabs on it. **[reported]** SRC: drcakey
- **The log is curated, not exhaustive:** "EDOPro's log only records only what the
  developers thought would be useful for players to reference" — e.g. cards revealed to the
  opponent, coin tosses, dice rolls. **[reported]** SRC: drcakey
  → *Strong signal for us:* the dominant engine-native client deliberately does **not**
  emit a full event log. A verbose dump of engine messages is not what players read.
- `Surrender` is a large button, top-left, with the three chain buttons beneath it.
  **[reported]** SRC: drcakey
- Settings are reachable in-duel via `Ctrl+0` or a gear in the bottom-left.
  **[reported]** SRC: https://projectignis.github.io/faq.html

### Relevant to Edison specifically
- EDOPro ships **GOAT** as a selectable rule set alongside the Master Rules, Speed and Rush
  Duel, plus custom rules. **[reported]** SRC: https://projectignis.github.io/faq.html
  → Edison/goat-era play is a first-class citizen in this client family. Note it does *not*
  list Edison by name in that source — Edison is typically run as a custom rule + banlist.
  **[inference]**
- Older Master Rules change the field: a source notes Pendulum Zones "won't appear when you
  duel with the appropriate ruleset." **[reported]** SRC: drcakey
  → Our field must not render Pendulum/Extra-Monster/Link furniture at all for Edison.
  Empty-but-present zones are visual noise the era does not have.

---
## 2. Image inventory
(filled in below as batches are read)

## 2. Image inventory — observed

### Batch A — the EDOPro duel screen
**IMG: `duel-ui-teardown-images/edopro-hi-01.jpg`** (fresh duel, turn 1), **IMG: `duel-ui-teardown-images/edopro-hi-02.jpg`**
(monster on field, card info pane populated), **IMG: `duel-ui-teardown-images/edopro-hi-03.jpg`** (Log tab open).
**[verified — I read these images]**

**A1. Layout: a permanent left chrome column takes roughly 30% of the width; the board gets
the remaining ~70%.**
- **Far-left, top:** a large **card image preview** (full card art, ~1/5 of screen height).
- **Far-left, below:** a **tabbed pane** — tabs read `Card info | Log | Chat | Quick Settings |
  Repositories`. Only one is visible at a time.
- **Second column:** a stack of buttons — **`Surrender`** at top, then
  **`Chain: OFF`**, **`Always pause`**, **`Chain: ON`**.
  → **This verifies the three-state chain-response control from §1 visually.** They are three
  separate always-visible push-buttons, not a cycling chip. Compare Master Duel, which
  compresses the same idea into one state-labelled chip (`masterduel.md` Batch D).
- → **Verdict on EDOPro's layout: it is a tool, not a game.** Permanent panels, small board,
  system-styled buttons. This is precisely the aesthetic the CEO's "feel like Master Duel"
  steer is pushing us away from — **while its *behaviour* is the behaviour we must replicate,
  because it speaks our engine.** That tension is the heart of `COMPARISON.md`. **[inference]**

**A2. Life points are horizontal gauges at the top, with names and a turn counter.**
Two magenta/purple **LP bars** span the top-left and top-right, each with `8000` overlaid, the
player names beneath (`drcakey` left, `[4] Horus` right), and a bare **`1`** centred between
them = the turn number.
→ LP as a *depleting bar* plus numeral, which reads change better than a numeral alone; but the
names/bars are small and low-contrast versus Master Duel's large corner plates. **[verified]**

**A3. ★ Phase control is a literal command bar in the centre strip of the field.**
Between the two fields sit three buttons: **`Shuffle`**, **`M 1`**, **`E P`**.
- `M 1` shows the **current phase** (Main Phase 1); `E P` is the **advance-to-End-Phase**
  action; `Shuffle` shuffles the hand.
- → So EDOPro's phase model is: **the current phase is a button, and the phases you may legally
  advance to are adjacent buttons.** Phase display and phase *action* are the same widget.
- → This is a genuinely good idea for us and it is cheap: it makes "what phase am I in" and
  "what may I do about it" the same affordance, and it is **the one place EDOPro is clearer
  than Master Duel** (MD's phase badge is display-only; advancing is elsewhere). **[inference]**

**A4. Field framing colour — and it is the OPPOSITE of Master Duel.**
The **top (opponent) field is outlined in blue/violet**; the **bottom (own) field is outlined in
red/pink**. **[verified visually]**
→ **This directly conflicts with Master Duel's blue=mine / red=theirs law**
(`masterduel.md` §4a). Whether EDOPro's colours mean ownership or something else (e.g. player
1 vs player 2 seat colour) **I could not establish from these stills** — I never saw a frame
with a known-turn-player and a legend. **[flagged as UNRESOLVED — see COMPARISON.md]**
→ Practical consequence: we must **pick one law and apply it everywhere**. Our
DuelingBook-native audience has no strong prior from EDOPro; Master Duel's law is the one the
CEO's steer points at, and it is the one that is *documented* rather than inferred.

**A5. Zones: outer piles are small icon-labelled parallelogram slots along the left and right
edges, with plain numeric counts.**
- Each side's Deck / Extra Deck / GY / Banished / Field Zone / Pendulum zones appear as **small
  angled slots down the outer edges**, each marked with a **glyph** (a book, a diamond, a
  face-like circle, an eight-pointed burst) rather than a word.
- **Counts are rendered as small, low-contrast plain numbers** beside the piles — I read `14`
  and `35` in edopro-hi-01, and `14`, `31`, `5` in edopro-hi-02/03 (the main-deck figure
  decreasing across the two frames is consistent with draws). **[verified that counts exist and
  change; the exact pile↔number mapping I could NOT establish]**
- → **Criticism worth carrying into our design:** EDOPro shows every count but makes none of
  them *readable*. Unlabelled glyphs plus 10px numerals is why players cannot tell what is
  happening. Master Duel's fixed, large, always-in-the-same-place piles (`masterduel.md` Batch A)
  are strictly better and cost no more space. **[inference]**
- Opponent's hand is drawn as **face-down card backs in a row at top-centre**; own hand as
  large face-up cards at bottom-centre. Both hands are always visible; **opponent hand size is
  therefore readable by counting, not by a numeral.** **[verified]**

**A6. On-field monster annotation.**
In edopro-hi-02 the monster on our field shows **`L5` above the card and `700 / 1400` below
it** — level above, ATK/DEF below, as plain text. **[verified]**
→ Same information as Master Duel's floating ATK/DEF, less legibly presented.

**A7. The card info pane is dense and power-user-oriented.**
For `Junk Synchron` it shows: `[Monster|Effect|Tuner] DARK Warrior`, `[★3] 1300/500`,
`Archetype|Synchron|Junk`, **`[63971008] OCG/TCG`** (passcode + legality), then full effect
text. **[verified]**
→ It exposes **passcode and archetype**. That is a *simulator* affordance, and our audience
(competitive Edison players on DuelingBook) plausibly values legality/archetype more than
Master Duel's flavour-first presentation. Cheap to include in a detail pane. **[inference]**

**A8. ★ The log, seen directly — and it confirms the "curated, terse" claim.**
In edopro-hi-03 the `Log` tab is active and its entire contents are:
```
Confirm 1 card(s):
*[Junk Synchron]
Confirm 1 card(s):
*[Quickdraw Synchron]
```
with **`Expand log`** and **`Clear Log`** buttons at the bottom. **[verified — upgrades §1's
[reported] claim to [verified]]**
- Two whole turns of play produced **four lines**, all of them about cards *revealed to the
  opponent*. Summons, sets and phase changes are **not logged at all**.
- It is plain monospace text with no card images, no phase structure, no ownership colour.
→ **This is the anti-pattern.** Set against DuelingBook's complete searchable log
(`duelingbook.md` §3) and Master Duel's phase-structured visual timeline
(`masterduel.md` Batch G5), EDOPro's log is the weakest of the three by a wide margin.
**We should not copy it, despite EDOPro being our engine sibling.** **[inference, high confidence]**

**IMG: `duel-ui-teardown-images/edopro-hi-00.jpg`** — the blogger's site banner. **No content.** Recorded so it
is not opened again.

### Batch B — ★ EDOPro asking the player questions (the decisive image)
**IMG: `duel-ui-teardown-images/edopro-hi-04.jpg`** **[verified — the most important EDOPro image]**

This single frame shows **three engine questions on screen simultaneously**, which is exactly
our situation: ocgcore emitting decisions, the UI having to render them.

**B1. A thin instruction banner at top-centre:** `Select the effect you want to activate`
— dark bar, plain white text, floating over the field art, no card context, no ownership colour.

**B2. A card-selection window floating over the board.** Titled **`Graveyard(2)`**, containing
two cards each captioned **`Graveyard[2]`** and **`Graveyard[1]`** (`Tuning`, `Dark Hole`), with
an **`OK`** button beneath and a stray **`Select`** label.
- → **Note what those captions are: location + ordinal index.** `Graveyard[1]`, `Graveyard[2]`.
  This is EDOPro solving the same problem Master Duel solves with location *icons*
  (`masterduel.md` §4e) — but as **bracketed text**, which requires reading rather than
  glancing.
- → **This is also direct evidence about our `sequence` question.** EDOPro surfaces a
  **per-location index** in its selection UI, because the engine addresses cards that way. That
  corroborates the coordinator's note that adding a zone `sequence` per card is the right,
  known cost: **the engine's own selection semantics are positional, so the UI eventually needs
  the position.** **[inference, but well-grounded]**

**B3. A Yes/No chain prompt, overlapping the selection window:**
> `Attempting to Normal Summon "Luster Dragon"` / `Activate a card or effect?`
with **`Yes`** and **`No`** buttons.
- → The good part: **it names the triggering action and the specific card** ("Attempting to
  Normal Summon 'Luster Dragon'"), which is genuinely informative and is the same instinct as
  Master Duel's coloured sentence (`masterduel.md` G1).
- → The bad part: it is an **undifferentiated grey system dialog**, placed arbitrarily, and it
  **visually overlaps the other open question window**. Two different questions, two identical
  boxes, no hierarchy, no indication of which to answer first.

**B4. ★ The conclusion this image forces.**
EDOPro renders the *same decision union we have* and it is **semantically complete but
presentationally undifferentiated**: every question is a grey box; questions can stack and
overlap; nothing distinguishes "the engine is asking you something" from "a window is open".
- → **This is almost certainly the same failure our current screen has**, since we share the
  engine and therefore share the temptation to render each decision variant as its own dialog.
  **[inference — but it is the most probable diagnosis of our stated symptom, "every engine
  decision is answerable, but a player cannot tell what is happening or what they may do".]**
- → **Therefore: EDOPro is the right map of WHAT to ask, and the wrong model of HOW to ask it.**
  Master Duel's answer (one docked question panel, one question at a time, sentence + candidate
  thumbnails + Cancel/Confirm) is the presentation to adopt. See `COMPARISON.md`.

**B5. Other details in this frame.** Opponent monsters annotated `2200/1400` and `1600/1600`
with `L4`; own hand of two cards; turn counter `3` top-centre; counts `2`, `32`, `14` at the
board edges; `Surrender` + the three `Chain:` buttons still present; card info pane still
showing `Junk Synchron` from an earlier interaction (**the info pane is sticky and does not
follow the current question** — a small but real legibility failure). **[verified]**

### Batch C — lobby / host screens (ruleset evidence, not duel evidence)
**IMG: `duel-ui-teardown-images/edopro-hi-05.jpg`**, **IMG: `duel-ui-teardown-images/edopro-hi-06.jpg`** **[verified]**
- Host panel exposes: `Forbidden List: N/A`, `Allowed Cards: Anything goes`,
  `Duel Mode: Best of 3`, `Starting LP: 8000`, `Starting Hand: 5`, `Cards per Draw: 1`,
  `*Master Rule 3` (hi-05) / `*Master Rule 1` (hi-06), `Select Deck`, `Current Spectators: 0`,
  `Ready` / `Start` / `Exit` / `→Spectate`.
- ★ **A `==Card Type filter==` box lists what the chosen ruleset excludes:** `No Link` under
  Master Rule 3 (hi-05), and **`No Xyz` / `No Pendulum` / `No Link` under Master Rule 1**
  (hi-06).
  → **That MR1 filter set — Synchro yes, Xyz/Pendulum/Link no — is precisely the Edison-era card
  universe.** So the engine family already has a first-class notion of "this era excludes these
  card types", which is what should drive our field furniture (no Extra Monster Zone, no
  Pendulum Zones). **[inference, well-grounded]**
- hi-06 also shows EDOPro running as a **small native desktop window** with a LAN join dialog
  (`Host Address 192.168.21.163`, port `7911`, `Join`/`Cancel`). Confirms it is a desktop app,
  not a browser client — so **none of its layout constraints are ours.** **[verified]**

**IMG: `duel-ui-teardown-images/probe-edopro.jpg`** — Project Ignis homepage. Confirms self-description:
"our flagship is EDOPro, **the open-source automatic duel simulator**", "formerly the team
behind YGOPro Percy", "an evolution of the YGOPro system, available on all major desktop
platforms (Windows, Mac, Linux)". **[verified]** SRC: https://projectignis.github.io/
→ Useful only to nail the lineage claim: **automatic** simulator, YGOPro descendant — same
family as our ocgcore build.

---

# DuelingBook — teardown

**Why it matters to us:** this is what our actual audience already uses. Not a nice-to-have
comparison — the incumbent whose muscle memory we are competing with.

Evidence keys: `IMG:<path>`, `SRC:<url>`. Confidence: **[verified]** / **[reported]** / **[inference]**.

---

## 1. The single most important strategic fact in this whole research task

The Edison community's own reference site publishes a simulator comparison table and its
answer is unambiguous — the page's own meta description reads: "How to play Edison Format
online - and which Yugioh Dueling Simulator to use? **(it's Duelingbook)!**"
**[verified]** SRC: https://edisonformat.net/beginners/simulators

Their table, reproduced:

| | DuelingBook | Dueling Nexus | YGO Omega | EDOPro | Master Duel |
|---|---|---|---|---|---|
| Style | **Manual** | Both | Both | **Automatic** | **Automatic** |
| Edison Errata | **In-Game** | Partially | Partially | ❌ | ❌ |
| Card Pool | ✅ | ✅ | ✅ | ✅ | ❌ |
| Rated Pool | ✅ | ✅ | ❌ | ❌ | ❌ |
| Correct Rulings | **Has Judges** | ❌ | ❌ | ❌ | ❌ |
| Edison Banlist | ✅ | ✅ | ✅ | 🔗 (custom) | ❌ |
| Mobile-Friendly | ❌ | ✅ | ✅ | ✅ | ✅ |

Four consequences, and they shape the recommendation more than any screenshot does:

1. **Our audience's incumbent client is MANUAL. Ours is AUTOMATIC.** On DuelingBook the
   player moves cards; nothing asks them anything. The engine-asks-player grammar that our
   ocgcore build is built around is *not what this audience has trained on*. **[inference,
   high confidence — it follows directly from "Style: Manual"]**
   → This is the central adoption risk for our rebuild, and it is a UI problem: an
   Edison/goat player's expectation is **"I state what I am doing"**, not **"I answer the
   machine."** A screen that only ever presents questions will feel like a loss of agency
   even when it is strictly more correct.
2. **Master Duel is scored ❌ on Card Pool** — it *cannot* play Edison. So the CEO's
   Master-Duel steer is necessarily about **feel and presentation, not about grammar
   fidelity**; there is no Edison-playing Master Duel to copy behaviour from. **[inference]**
3. **EDOPro is scored ❌ on Edison Errata.** Automatic clients in this family get Edison-era
   card text *wrong* because they ship modern errata. Since we are ocgcore-based, this is a
   card-script/database concern for us too — **flagging it as outside my scope but real.**
4. **DuelingBook is scored ❌ on Mobile-Friendly.** Our desktop-first decision matches the
   incumbent exactly. The audience plays this game at a desk. **[inference]**

---

## 2. Interaction grammar: click card → option menu (and the community hates it)

- The grammar is **left-click a card → a menu of actions**. The most telling evidence is how
  third parties describe it. A popular QoL extension advertises: "Left click a card to
  interact with it in many ways **without needing the janky menu**."
  **[reported]** SRC: https://chromewebstore.google.com/detail/dueling-book-unlock/ledilndbpllicfccmdhblnfbodkndjnl
- A rival client's manual-mode guide makes the same criticism structurally: in YGO Omega
  "you just need to point and click to the location where you want to move a card to rather
  then select from **a long drawer of options**" — explicitly contrasted with DuelingBook.
  **[reported]** SRC: https://forum.duelistsunite.org/t/guide-to-manual-mode/7666

→ Two independent sources converge on the same complaint: **DuelingBook's menu is long,
undifferentiated, and slow.** Because DB is manual, its menu must enumerate every *physical*
operation (move to GY, banish, attach, flip, change position, excavate…) rather than the
*legal* ones. It cannot filter by legality because it has no engine to ask.
**[inference, high confidence]**

→ **This is our decisive advantage and we should exploit it explicitly.** We have ocgcore.
Our contextual menu can contain **only the legal verbs**, which is exactly what EDOPro does
(see `edopro.md` §1). We can deliver the grammar DB players already know — *click card, pick
verb* — while removing the thing they complain about: menu length. **[inference]**

### Grammar details worth stealing or avoiding
- **Modifier-click for repeat action:** "Left click a card while pressing CTRL in order to
  perform the last action on that card." **[reported]** (extension, not base DB) SRC: as above
  → A "repeat last verb" accelerator is a known desire in this community.
- **Right-click as a silent/private inspect verb:** extension features include "Right clicking
  lets you silently check GYs", "Right clicking your deck lets you silently view it",
  "Right click on banishment to secretly view it". **[reported]** SRC: as above
  → **Note the norm this reveals:** in a manual client, *looking* at a pile is a public act
  that signals intent, and players want it to be private. In our automatic client, looking at
  a pile has no game effect at all, so pile inspection must be **free and silent by default**
  — never a broadcast, never a committed action. **[inference]**
- **Right-click in the deck editor is "send to main/extra"; shift+right-click sends to side.**
  **[reported]** SRC: https://metaduelist.io/gameplay/ocg/guide/344/huong-dan-su-dung-duelingbook-phan-01
  → Deck-editor convention, not in-duel, but confirms right-click is a *fast path* idiom
  DB users have.
- The community's chosen extensions are about **customizable hotkeys, dark mode, skipping the
  intro movie, and auto-connect**. **[verified]** SRC: https://edisonformat.net/beginners/simulators
  → What this audience actually asks for is **speed and less ceremony**, not more information.

---

## 3. The log: DuelingBook's is exhaustive, searchable, filterable — and official

From DuelingBook's own site: "All duelists have access to the duel log in their games. **The
duel log shows information about all actions that are taken during the duel. It can be
searched and filtered.** In case you missed something, using the duel log can help you."
**[verified — primary source]** SRC: https://www.duelingbook.com/welcome

And from DuelingBook's rules: "Users aren't penalized for taking notes or using resources such
as the internet or **the in-game logs of the duel**." **[verified]** SRC: https://www.duelingbook.com/rules

→ **This is a hard table-stakes finding.** Our audience's incumbent gives them a *complete,
searchable, filterable* record of the duel, sanctioned as a legitimate competitive tool.
Contrast EDOPro, whose log is deliberately curated to "only what the developers thought would
be useful" (`edopro.md`). **If we ship the EDOPro-style curated log, DuelingBook players will
experience it as a regression.** **[inference, high confidence]**
→ Recommendation consequence: log must be **complete and filterable**, even if collapsed by
default. "Searchable" is the cheap part; *completeness* is the promise.

## 4. Time, pace and waiting — the norm is *no clock at all*

"**There is no end of match procedure or time limit on Dueling Book** that dictates how long
the duel or a player's turn may last. Both players are responsible for playing at a reasonable
pace; if a player is not playing at a reasonable pace, they may receive an in-game warning for
Slow Play." **[verified — primary source]** SRC: https://www.duelingbook.com/rules

→ **Direct conflict with the Master Duel model**, which runs a visible per-player decision
timer that forces the opponent to wait (`masterduel.md` §4a). Our audience is
socially-regulated, not clock-regulated.
→ **Recommendation consequence:** show *whose* turn/decision it is and that the client is
waiting on them (presence), but **do not import Master Duel's shot clock** as a default. A
countdown is the one Master-Duel-feel element most likely to be rejected by this specific
audience. **[inference — flagged as a judgement call, not evidence]**

Other pace/waiting facts:
- **Judges can be called mid-duel** for rated disputes, and slow play / AFK are penalisable.
  **[verified]** SRC: https://www.duelingbook.com/rules, https://www.duelingbook.com/welcome
- DB has an **Expert Room** gated behind passing the DuelingBook exam, "to make sure that the
  opponents you play against are experienced players who know what they're doing", and judges
  may flag an unfamiliar player as "beginner", locking them out of rated games. **[verified]**
  SRC: https://www.duelingbook.com/welcome
  → Norm confirmed: **this community explicitly sorts for players who already know the rules.**
  Consistent with the CEO's "assume the players know the game" and with dropping any teaching layer.
- Site strings visible on the DB front end confirm modal waiting states as first-class UI:
  "Waiting for response from host…", "Waiting for server to find dueling partner…", "Partner
  found! Are you ready? Time remaining: 10 seconds", "**Siding in progress! Please wait...**"
  **[verified — strings from the live site]** SRC: https://www.duelingbook.com/
  → Note the shape: DB *names the thing it is waiting for*. Never a bare spinner.

## 5. Format support relevant to us
- DuelingBook hosts **Goat Format** natively — "for duels that only use cards that were
  released before September of 2005" — as a room type in the Duel Room. **[verified]**
  SRC: https://www.duelingbook.com/welcome
- Host options exposed at room creation include Forbidden List, Allowed Cards, Best-of-N, Rule,
  Don't Check Deck / Don't Shuffle Deck, **TCG Ruling** toggle, Starting LP, Starting Hand,
  Cards per Draw. **[reported]** SRC: metaduelist.io guide (above)
  → Edison-era play requires per-room ruleset knobs; the incumbent exposes them at host time.

---
## 6. Image inventory
(filled in below as batches are read)

## 6. Image inventory — observed

### Batch A — ★ the real DuelingBook duel screen
**IMG: `duel-ui-teardown-images/db-p1-db379cf0.jpg`** (full browser window, `duelingbook.com/html5`) and
**IMG: `duel-ui-teardown-images/db-p1-7405afaf.jpg`** (a larger crop of the same board, captioned in the source
guide as "Field, deck, and hand — both sides"). **[verified — I read these images]**

**A1. Layout: three columns. Left rail ~21%, board ~60%, right rail ~19%. Board gets well
under two-thirds of the width, inside a browser tab with its own chrome above.**
- **Left rail (top→bottom):** full card preview (`PSY-Frame Driver` — art, ★ pips, `[Psychic]`,
  `ATK/2500 DEF/0`, passcode) → a **white box with the card's text** → a small white box →
  **`Watchers: 0`** → avatar → buttons **`Begin Siding`**, **`Reset Deck`**, **`View Replay`**,
  **`Quit`** → a **spectator icon and two speech-bubble icons in different colours** (two chat
  channels — plausibly duel chat and watchers' chat). **[the two-channel reading is [inference]]**
- **Right rail (top→bottom):** opponent **LP `8000`** on a blue/green gradient plate with a
  **camera icon** (screenshot) → a **black panel** (empty) → a **large white panel** (empty) —
  together the chat/log area → opponent art with username **`zerato110`** set vertically →
  own **LP `8000`** on an orange/yellow gradient plate → speaker/mute icon.
  → **LP are split to opposite ends of the right rail**, not placed near each player's field.
    Less spatially intuitive than Master Duel's corner plates. **[inference]**
- **Bottom:** own hand, 5 large face-up cards (`Terraforming`, `Shaddoll Beast`,
  `Shaddoll Schism`, `Ash Blossom & Joyous Spring`, `PSY-Frame Driver`).

**A2. The board is drawn as a grid of bright neon-outlined empty rectangles, each zone a
different colour.** Opponent rows outlined green and orange; own rows red and magenta; a
column of purple boxes at the right edge. **[verified]**
→ It reads like a form, not a duel field. Zone *identity* is unmistakable; **game state is not.**
→ This is the strongest visual argument for the CEO's Master-Duel steer: DuelingBook is maximally
explicit and minimally atmospheric, and our audience tolerates it rather than loving it —
witness that the community's top-requested extensions are cosmetic (dark mode, themes).
**[inference]**

**A3. ★ Phase control is a row of buttons in the dead centre of the board — and the player
declares phases manually.**
Observed: round buttons **`DP` `SP` `M1` `BP` `M2` `EP`**, with **`DP` lit bright red/pink as
the current phase** and the rest dark. Beside them: an **`End Turn`** pill button, an **`LP:`
text input with a red apply button**, and **dice, coin, globe and chip/token icons**.
**[verified]**
- → **This is the manual-client signature in one widget.** The player *asserts* the phase, types
  LP changes by hand, and rolls dice for card effects. Nothing is computed.
- → **Convergent evidence with EDOPro** (`edopro.md` A3), which also puts phase state+advance in
  a centre-strip button (`M 1`, `E P`). **Two of three clients place phase control in the middle
  of the board and make the current phase the lit member of a phase row.** Master Duel instead
  uses a display-only badge at the right edge.
- → **Recommendation input:** the phase *row* (all phases visible, current one lit, legal next
  ones clickable) is the convention our audience already reads, and it is strictly more
  informative than Master Duel's single badge. **We can have both: MD's styling on DB's widget.**
  **[inference — carried into COMPARISON.md]**

**A4. ★★ `☑ Choose Zones` — a duel-screen checkbox, bottom-left. And `☑ Auto-Draw`, bottom-right.**
**[verified]**
- **`Choose Zones` is DuelingBook's exact analogue of Master Duel's `Card Position:
  Manual/Auto`** (`masterduel.md` §3b): an opt-in toggle for whether the player picks the
  specific zone a card goes to.
- → **This is the most decision-relevant single pixel in the whole teardown for our accepted
  `sequence` cost.** Both the incumbent *and* the visual target treat "which exact zone" as a
  **player-toggleable preference, defaulted for speed**. Neither treats it as always-on.
  → Implication: we need the *capability* (hence `sequence` is genuinely required), but we
  should ship it as a **toggle that is off/auto by default**, because in Edison — no Link
  arrows, no Infinite Impermanence — precise column choice rarely changes the game.
  **[inference, well-grounded — flagged in COMPARISON.md with confidence]**
- `Auto-Draw` shows the same philosophy applied to the draw step: **automate the ceremonial,
  keep the strategic.**

**A5. Piles and counts.** Deck/GY piles are rendered as **card-back images with a large white
number overlaid** — I read **`15`** (left of own hand) and **`38`** (right). Two **purple boxes
each showing `0`** sit at the right edge of both players' rows. Small card-back thumbnails sit
near the bottom-right. **[verified that counts are large and legible; the exact
pile↔number mapping I could NOT establish from these stills]**
→ Note the contrast with EDOPro's tiny low-contrast numerals (`edopro.md` A5): **DuelingBook's
counts are big and readable.** Our audience is used to counts they can read without squinting.

**A6. What is always on screen here:** both LP, own hand (face-up), all zone outlines for both
players, deck/GY counts, the full phase row, `Watchers:` count, chat/log panels, and the
selected card's full text in the left rail. **Nothing is behind a menu.** **[verified]**
→ DuelingBook's answer to "always-on vs on-demand" is **everything, always** — the opposite of
Master Duel's four-corners-plus-badges minimalism. Our audience is therefore *accustomed to
information density* and will not be frightened by a persistent log or a persistent phase row.
**[inference — important counterweight to copying MD's minimalism wholesale]**

### Batch B — captures that FAILED (recorded as a gap, not as evidence)
- **IMG: `duel-ui-teardown-images/db-replay-r1.jpg`** — shows a **Cloudflare `Verify you are human` interstitial**
  over the DuelingBook background. **The live replay capture never reached a duel.** **[verified]**
- **IMG: `duel-ui-teardown-images/duelingbook-after-skip.jpg`** — the DuelingBook **login page** (logo, Username/
  Password/`Log In`, `register`, `Donate`, a "Welcome to Duelingbook!" news box mentioning
  Genesys Format (9/24/25) and the 2023 Judge Exam). **Not a duel.** **[verified]**
→ **GAP: DuelingBook is bot-protected and login-walled, so I could not capture a live duel,
a live chain/response interaction, or the duel log in use.** Everything in §2–§4 about DB's
menu and log rests on primary text sources plus this one harvested screenshot. See
`COMPARISON.md` "What I could not establish".

### Batch C — ★★ LIVE DuelingBook interaction, frame by frame
Source: the `DuelingBookEnhanced` demo GIF, decomposed to 122 frames.
IMG dir: `_harvest/gif/dbx-p1-347de90b/` — frames read: `f_020.png`, `f_050.png`, `f_080.png`,
`f_110.png`. Provenance: `https://github.com/alexjraymond/DuelingBookEnhanced`
(`_harvest/dbx-manifest.json`). **[verified — this upgrades most of §2 from [reported] to [verified]]**

**C1. ★ The grammar is confirmed: click a card → a vertical plain-text menu appears next to it.**
The menus I read, verbatim:
- **`f_020.png`** (card in hand): `Reveal` · `Declare` · `To S/T` · `To Bottom of Deck` ·
  `To Top of Deck` · …(clipped)
- **`f_050.png`** (monster on own field): `Move` · `Target` · `To B. Deck` · `To T. Dack` [sic] ·
  `To Extra` · `Deck FU` · `Banish FD` · `Banish` · `To Hand` · `Set` · `To DEF` · `Declare` ·
  `To Grave` — **thirteen entries.**
- **`f_110.png`** (another card): `Move` · `Target` · `To Extra Deck` — **three entries.**

→ **"The janky menu" is now verified, and its exact pathology is visible:**
  (a) the entries are **physical operations, not game verbs** — `To Grave`, `Banish FD`,
      `To B. Deck`, `To T. Dack`. The player is operating a card-mover, not declaring plays.
  (b) it is **unstyled small grey text with no icons, no grouping, no separators**, over the board.
  (c) **length swings from 3 to 13 entries** with no visual hierarchy, so the player must
      read the whole list every time.
  (d) there is a **typo shipped in the menu** (`To T. Dack`), which tells you how much design
      attention this surface gets.
→ **BUT note the positive:** the menu is **anchored next to the card the player clicked**.
  That is the same spatial idiom as Master Duel's `Command Placement: Change`
  (`masterduel.md` §3a) and EDOPro's contextual click options.
→ ★ **All three clients are select-then-verb with the verbs rendered next to the card.**
  There is **no drag-to-zone client, no radial menu, and no global command bar** anywhere in the
  competitive set. This is the strongest convergence finding in the whole teardown.
  **[verified across all three clients]**

**C2. ★ The right-rail black panel IS the duel log, and its entries are plain English sentences.**
Entries accumulate across the frames, verbatim:
```
shewthatsme declared effect of "Dark Contract with the Gate"
shewthatsme declared effect of "D/D/D Vice King Requiem"
shewthatsme declared effect of "D/D/D Deviser King Deus Machinex"
shewthatsme declared effect of "Escape of the Unchained"
```
→ Format is **`<player name> <verb phrase> "<Card Name>"`** — prose, one line per event, no
thumbnails, no phase structure, no ownership colour, no arrows.
→ So DuelingBook's log is **complete and searchable (per §3) but presented as a plain text
transcript.** Master Duel's log is **incomplete-looking but structured** (`masterduel.md` G5).
→ **The synthesis available to us: DuelingBook's completeness + Master Duel's structure.**
  Neither incumbent has both. **This is a genuine, identifiable product gap.** **[inference]**
→ Note also the phrase **"declared effect of"** — the vocabulary of a *manual* client, where the
player asserts and the opponent trusts. Our engine actually *resolves*, so our log can say what
happened rather than what was declared. **[inference]**

**C3. ★★ Looking at a pile is BROADCAST to the opponent.**
In **`f_080.png`** a large modal titled **`Viewing Deck`** (green border, red `X` close button)
shows the deck as a scrollable grid of ~8 cards per row — **and simultaneously the player plate
in the right rail displays the text `Viewing Deck`.**
**[verified — this is the strongest single piece of behavioural evidence in the DB set]**
→ This **verifies the norm I had only inferred in §2** from the extension's "silently view"
features: on DuelingBook, **inspecting your own deck/GY/banished tells your opponent you are
doing it**, which leaks information, which is why the community built extensions to defeat it.
→ **Recommendation, high confidence: in our client, pile inspection must be free, instant,
silent and never broadcast.** We are automatic; there is no integrity reason to announce it.
This is a place where we can be *unambiguously better* than the incumbent at zero cost, and our
audience will notice immediately because they currently pay for it with a browser extension.

**C4. Incidental confirmations from these frames.** `☑ Choose Zones` and `☑ Auto-Draw`
checkboxes persist on the duel screen (A4 confirmed). Monsters on field are annotated with
`2800/2000`, `3000/3000`, `2000` as plain white text under the card. Deck counts tick down
across frames (`35` → `35` → `34`) and another counter reads `15` → `14`. Purple edge boxes show
small numbers (`1`, `2`, `4`) — consistent with GY/banished counts incrementing as the turn
proceeds. The left rail's card preview + text updates to whichever card is being interacted
with (`D/D/D Vice King Requiem`, `Escape of the Unchained`, `Unchained Soul Lord of Yama`),
including a separate `Pendulum Effect:` / `Monster Effect:` split. **[verified]**
→ The left-rail preview **does** track the current interaction — unlike EDOPro's sticky info
pane (`edopro.md` B5). Small thing, real difference.

---

# Dueling Nexus — teardown (the closest structural analogue to us)

**Why this file exists even though it was not on the priority list:** Dueling Nexus is
**browser-based AND automatic AND in the ocgcore/YGOPro family**. That is *exactly our technical
shape* — the only client in the set that is. EDOPro is automatic but native desktop;
DuelingBook is browser but manual; Master Duel is neither. So Nexus is the one client that has
already solved "render an ocgcore decision union in a web page", and it is worth more than its
low profile suggests.

It is also a credible Edison client in its own right: the Edison community's table scores it
**Style: Both, Edison Errata: Partially, Card Pool ✅, Rated Pool ✅, Edison Banlist ✅**.
**[verified]** SRC: https://edisonformat.net/beginners/simulators (see `duelingbook.md` §1)

Evidence keys: `IMG:<path>`, `SRC:<url>`. Confidence: **[verified]** / **[reported]** / **[inference]**.

---

## 1. ★ The in-duel screen
**IMG: `duel-ui-teardown-images/edo-p2-b464405e.jpg`** **[verified — I read this image]**
Provenance: a Vietnamese guide's screen recording of `duelingnexus.com/game/EU-E9NCX7`, so it is
a real duel in progress. (The frame includes the video player's own controls at the bottom and
Vietnamese annotation callouts — ignore those.)

**1a. Layout.** Browser tab, no fullscreen. **Left rail** = card art preview above a card-info
pane; **centre** = board; **right edge** = a couple of floating controls. Board gets maybe ~60%
of width. Structurally near-identical to DuelingBook's three-column shape and to EDOPro's
left-rail shape.
- The card-info pane is EDOPro-style dense: **`8165596`** (passcode), `[Monster|Effect|Xyz]
  Warrior/Light`, `[★★★★★★★★] 2500/3000`, then full effect text.
  → Third client to show **passcode + full type line** in the info pane. Confirms this is a
  simulator-audience norm, not an EDOPro quirk. **[verified across EDOPro + Nexus]**

**1b. ★ Phase control is a VERTICAL column of buttons on the left: `DP` `SP` `MP1` `BP` `MP2`
`EP`, with `EP` highlighted green.** **[verified]**
→ Compare: DuelingBook = horizontal phase row in the board centre; EDOPro = two buttons in the
board centre; Nexus = vertical phase column at the left; Master Duel = display-only badge at the
right edge.
→ **Three of four clients render the phases as an enumerated set of buttons where the current /
available one is highlighted.** Master Duel is the outlier, and Master Duel is the only one of
the four that is *not* trying to expose engine timing to a competitive player. **[inference]**

**1c. ★★ The question panel — the single best "engine asks the player" example I found.**
Centred on the board, a dark panel reads:
> **`Do you want to activate The White Stone of Ancients (Graveyard)?`**
with a **green `Yes`** and a **red `No`** button. **[verified]**

Three things to steal verbatim:
1. **The question is a complete natural-language sentence naming the specific card.** Same
   instinct as Master Duel (`masterduel.md` G1) and EDOPro (`edopro.md` B3).
2. **★ The card's LOCATION is disambiguated inline, in parentheses: `(Graveyard)`.** This is the
   cheapest possible solution to the problem Master Duel solves with location icons and EDOPro
   solves with `Graveyard[1]`-style captions. **For a browser client with a text-capable UI,
   inline parenthetical location is nearly free and instantly readable.** **[verified]**
   → Especially valuable for us: the same card can be activatable from hand, GY or field, and
   our engine will offer them as distinct choices. Naming the location *in the question* removes
   the ambiguity without any board highlighting work.
3. **Affirmative/negative are colour-coded green/red.** Note this is a *different* use of red
   from the ownership law (red = opponent) in Master Duel — a collision we must avoid.
   **[inference — flagged in COMPARISON.md]**

A separate **`Cancel`** button floats at the right edge, away from the Yes/No — i.e. Nexus has
*two* different decline affordances in different places. Sloppy; do not copy. **[verified layout,
[inference] on the criticism]**

**1d. ★★ `Chaining: Manual` — a third independent implementation of the response-verbosity toggle.**
A green **`Chaining: Manual`** button sits at the bottom-right. The guide's annotation translates
as: *"Automatic question panel. If you enable `Chaining: Manual` mode (**default is Auto**) the
panel will ask more thoroughly at the processing steps."* **[verified button + [reported] semantics
via the annotation]**

→ **This completes the pattern across every automatic client in the set:**

| Client | Control | States |
|---|---|---|
| EDOPro | three buttons, left rail | `Chain: OFF` / `Always pause` / `Chain: ON` |
| Master Duel | one state-labelled chip, bottom-right | `OFF` / `Auto` / `ON` (+5 input modes) |
| Dueling Nexus | one toggle button, bottom-right | `Chaining: Auto` / `Chaining: Manual` |

→ **Conclusion, high confidence: a player-controlled response-verbosity setting is TABLE STAKES
for an automatic Yu-Gi-Oh client. All three automatic clients have one; all three default to a
middle/quiet setting; all three expose it *in the duel*, not only in a settings menu.**
**[verified across three clients — this is the most robust finding in the teardown]**
→ We must ship one. Without it, an ocgcore client either interrupts constantly (unplayable) or
silently skips windows (loses games). There is no third option and no client has found one.

**1e. ★ Per-player LP bar AND per-player time bar.**
The player's plate shows **`8000`** with a bar, and beneath it **`235`** on a blue bar. The
guide's callout translates as *"note the LP bar (red) and the **time bar** (blue)"*. The
opponent's plate at top-right shows **`2500`** with a red bar. **[verified]**
→ So Nexus, like Master Duel, runs a **visible per-player clock**. DuelingBook is the only client
with no clock at all (`duelingbook.md` §4).
→ Tally: **clock present in Master Duel and Dueling Nexus; absent in DuelingBook.** Since our
audience is DuelingBook-native, the clock is the element to make **optional / room-configurable**
rather than default-on. **[inference — see COMPARISON.md]**

**1f. Board and annotation details.** Zones are neon-outlined rectangles (pink/cyan), very
DuelingBook-like. Monsters carry **ATK/DEF as plain text beneath** (`3000/2500`, `2500/3000`) and
**rank/level above (`R8`, `L9`)** — note `R` for Rank vs `L` for Level, a one-character
disambiguation we should copy for Edison's Levels. Pile counts are plain numerals beside the
piles (`34`, `14`, `11`, `25`, `1`, `2`, `5`, `4`). **[verified]**

## 2. Lobby (context only)
**IMG: `duel-ui-teardown-images/edo-p2-167f32f8.jpg`** — `duelingnexus.com/duel` "DUEL ZONE": **`QUICK PLAY`**
(Join a duel 1v1 single / Join a match 1v1 best of 3 / Join a tag 2v2), **`SINGLE MODE`** (Play
against a basic bot / Create a custom bot game), **`COMPETITIVE PLAY`** (Find a ranked match,
`Current rating: Unranked`), **`CUSTOM GAME`** (Show the custom games), **`SERVER SETTINGS
Region: Europe`**, and a **`● Connected to the lobby`** status indicator. **[verified]**
→ Only relevant point for us: even a browser client of this scale names its connection state
persistently (`● Connected to the lobby`). Cheap, and it is the thing that makes a networked
client feel trustworthy. **[inference]**

## 3. Non-evidence, recorded so it is not re-opened
- **IMG: `duel-ui-teardown-images/dbx-p1-9289b9b3.jpg`** — the `DuelingBookEnhanced` wordmark banner. No content.
- **IMG: `duel-ui-teardown-images/probe-duelingnexus.jpg`, `duel-ui-teardown-images/probe-nexus-www.jpg`** — 11KB each, i.e. blank
  or failed loads. Not opened. **[not evidence]**
