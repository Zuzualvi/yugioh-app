---
linear_project: Duel Experience Redo
---

# Duel screen — independent usability evaluation

**Artefact:** `duel-redo-prototype.html` (self-contained, opened from `file://`)
**Method:** Playwright + Chromium, 1440×900, `ignore_https_errors=True`. All 14 scenarios in the
scenario picker were driven end to end. Every finding below was reproduced from a clean scenario load.
**Isolation:** no design documentation, PRD, or prototype source was read before or during evaluation.
Findings were written from the rendered screen, the accessibility tree, and measured geometry only.
Source was never opened; where a diagnosis is stated (e.g. an off-by-one) it is inferred from observed
behaviour, and the observation is given so it can be checked independently.

**Personas run against every task:** (1) *Learning Edison, fluent in modern YGO* — weighted highest;
(2) *Fluent Edison competitor, DuelingBook native*; (3) *Returning player, first digital client*.

---

## 0. Summary

| Severity | Count |
|---|---|
| blocker | 3 |
| major | 9 |
| minor | 8 |
| cosmetic | 2 |

Open questions: 6. Could-not-assess: 5 areas (§5).

The single thing to fix first: **F-01 — the chain window's confirm button names a card the player did
not select.** It is the only defect that actively misinforms a user at an irreversible commit, and the
window has no cancel, so a careful player's only escape is to answer "No response" — a real, losing
game decision.

**A note on the prototype's canned outcomes.** Several scenarios replay fixed results (e.g. a 1900 ATK
monster attacking a 2400 ATK monster destroys the 2400 and takes no damage; life points never move
even when the history says −1900). Where a finding could be an artefact of fixture data rather than the
screen's design, this is stated explicitly in the finding. In every such case the finding is written
against **what the screen tells the player**, which is a design question regardless of what produced
the numbers.

---

## 1. BLOCKERS

### F-01 — Chain window confirm button names the wrong card
- **Element:** the primary confirm button in the chain/response question (scenario *5b · The same window, with MH-3b and ND-9 shipped*), and the `Chosen: …` line directly above it.
- **Heuristic:** Error prevention; consistency and standards; visibility of system status.
- **What happened:** *Learning Edison*, task 5. The window asks "Sakura Normal Summoned "Thunder King Rai-Oh". Chain a card or effect?" The only responsive card is **Book of Moon**, hand position 5 (0-indexed 4); it is the one the screen amber-outlines when clicked. On selecting it, the screen displays `Chosen: Dimensional Prison` and the confirm button reads **"Activate Dimensional Prison"**. Pressing it activates **Book of Moon** — Book of Moon is what leaves the hand and appears on the field. I expected the button to name the card I had just outlined. I stalled: I could not tell whether the screen or my click was wrong, and there is no Cancel — the only other control is "No response", which forfeits the response for real. Reproduced from clean load; scenario 5a in the same position instead says `your hand card 5`, which is the correct 1-based ordinal for the same card. The 5b label resolves to hand index 5 (0-based) = the *second* Dimensional Prison. **Diagnosis:** the "named" label path treats the 1-based ordinal as a 0-based index.
- **Severity:** blocker.
- **Proposed change:** resolve the label from the same card reference the selection highlight uses, not from an ordinal. Concretely: pass the selected card's id into the confirm label and render `Activate <cardName>`; add a regression assertion that the confirm label's card name equals the `aria-label` of the highlighted slot. Until fixed, prefer 5a's positional form over a wrong name — a wrong name is worse than no name.

### F-02 — All three routes off the end-of-duel card are inert
- **Element:** "Review board", "Play Sakura again", "Back to Home" on the duel-over card (scenarios *9 · Duel end — life points / resign / abandoned*, and the end state reached via "Claim the duel").
- **Heuristic:** User control and freedom; help users recover.
- **What happened:** *All three personas*, task 7. The duel ends; the card offers three routes. Clicking any of them produces **no change whatsoever** — `document.body.innerHTML.length` is byte-identical before and after (316,087 in both), `.endscrim` and `.endcard` remain, and the board behind stays unclickable (`elementFromPoint` on every hand tile returns `DIV.endscrim`). "Review board" is the worst of the three because it is a promise the screen makes and does not keep: I expected the scrim to lift so I could look at the final board and the history rail. Instead nothing happens and there is no error, so I clicked it three more times before concluding it was dead.
- **Severity:** blocker.
- **Proposed change:** wire the three buttons. "Review board" should hide `.endscrim`/`.endcard` and re-enable inspection of slots and piles, with a persistent "Duel over — Show result" chip in the top bar to bring the card back. If any route is deliberately out of prototype scope, mark it the way the prototype already marks its own stub elsewhere (`(prototype) simulate the grace period elapsing`) — an unmarked dead button is indistinguishable from a broken one.

### F-03 — The verb bar promises "Esc closes" and cannot be closed by anything
- **Element:** the verb chip bar that appears after clicking any card (`Normal Summon / Set / Inspect / Attack / Activate`), and its hint text "Esc closes — costs nothing".
- **Heuristic:** User control and freedom; error prevention; help users recover.
- **What happened:** *All three personas*, tasks 2 and 8. Clicking a hand card opens a verb bar with the literal hint "Esc closes — costs nothing". Pressing Escape does nothing. Tested exhaustively from a clean load: Escape with focus on the card, Escape with focus on `document.body`, a synthetic `keydown` dispatched at `document`, clicking empty background at (150,700), clicking the currently-selected card again, and clicking the current phase chip — **the verb bar is still open after all six.** There is no Cancel/× control on the bar. The only way out is to pick a verb (i.e. commit) or click a different card, which just re-arms the bar for that card. The armed state is also sticky and invisible: after clicking Heavy Storm in hand, I clicked around the opponent's board; the bar still read `Set / Activate / Inspect` for Heavy Storm several clicks later, one click away from activating a card I had stopped thinking about.
- **Severity:** blocker (task 8 — backing out — cannot be completed at this step, and the screen states in writing that it can).
- **Proposed change:** add a `keydown` handler on `document` for `Escape` that clears the armed card and closes the verb bar and the inspector; make a click on the playfield background clear it too; make a second click on the already-selected card toggle it off (this already works in the tribute step, so the interaction exists elsewhere in the app). Add a visible `×` on the verb bar. If Escape is not going to be implemented, delete the hint text — a false affordance is worse than none.

---

## 2. MAJOR

### F-04 — Life points never change, while the history rail says they did
- **Element:** the `YOU` / `SAKURA` life-point readouts, versus the `WHAT HAS HAPPENED` rail and the catch-up banner.
- **Heuristic:** Visibility of system status; match with the real world.
- **What happened:** *All three personas*, task 6 (scenario *7 · Pass the turn, wait, get it back*). I press End Turn; ~2 s later control returns with "5 things happened while it was theirs". The rail reads `TURN 4 · MOVE a card MZONE 1 → MZONE · SUMMON Thunder King Rai-Oh hand → field · ATTACK a monster → directly · BATTLE damage step · LIFE POINTS You −1900 · TURN 6`. **My life points still read 8,000** and the opponent's board shows no Thunder King Rai-Oh — only a face-down. I expected 6,100 and a monster on their side. I could not work out my own life total, which is the single most important number on the screen. (Likely fixture data, but the screen presents a history and a state that contradict each other and offers no way to tell which is authoritative.)
- **Severity:** major.
- **Proposed change:** derive the life-point readout from the same event stream the rail renders, and add a delta animation/chip on the LP box (`8,000 → 6,100  −1900`) that persists until the catch-up banner is dismissed. Add a state-vs-log consistency assertion in the fixture harness so a scenario whose log implies a state the board does not show fails to load.

### F-05 — The history rail claims events that did not happen
- **Element:** `WHAT HAS HAPPENED` rail entries written on repeated attack declarations (scenario *4a · Attack — exactly one legal target*).
- **Heuristic:** Visibility of system status; error prevention.
- **What happened:** *Fluent competitor*, task 4. Thunder King Rai-Oh attacks; the opponent's face-down monster is destroyed (their GY 0→1). Clicking the same monster again still offers **"Attack"**, and pressing it writes a second, identical pair of entries — `ATTACK Thunder King Rai-Oh → monster` / `MOVE a card MZONE 1 → GRAVE` — for a zone that is now empty. A third attempt writes a third pair. Board, all eight pile counts and both life totals are **byte-identical** across attacks 1→2→3. So the screen accepted an action that is illegal (a monster attacks once per Battle Phase), did nothing, and then told me in writing that a card had moved to the graveyard. A fluent player reading the rail to reconstruct the turn would count two destroyed monsters.
- **Severity:** major.
- **Proposed change:** (a) do not offer the `Attack` verb on a monster that has already declared an attack this Battle Phase — show it disabled with the reason "already attacked this Battle Phase"; (b) only append to the rail on an event actually emitted by the engine, never optimistically on a command send.

### F-06 — "Click a highlighted card on the board" when the card is in your hand
- **Element:** the instruction line under every question panel (chain window scenarios 5a/5b, end-phase discard scenario 6, and the attack/tribute steps).
- **Heuristic:** Match between system and the real world; consistency and standards.
- **What happened:** *Returning player and Learning Edison*, tasks 5 and 8. In the chain window my field is empty; the only responsive card is Book of Moon **in my hand**. The screen says "Click a highlighted card on the board". I spent the whole window scanning the two field boxes for a highlight before noticing the outlined card in the hand strip 400 px lower. The same string appears verbatim in the end-phase discard, where all seven candidates are hand cards and none is on the board. In the tribute and attack steps the same string is correct. So the same sentence is right in two places and wrong in two others.
- **Severity:** major.
- **Proposed change:** generate the instruction from the zones the candidate set actually occupies: "Click a highlighted card in your hand", "…on the board", or "…in your hand or on the board". One string per candidate-zone set, chosen at render time.

### F-07 — Irreversible commits are labelled by hand position, not by card name
- **Element:** the confirm button and `Chosen:` line in the end-phase discard (scenario *6*) and in chain scenario 5a.
- **Heuristic:** Recognition rather than recall; error prevention.
- **What happened:** *All three personas*, task 8 / task 5. At 1,300 life points I am asked to discard 1 of 7 cards. Selecting any card produces `Chosen: your hand card N` and a confirm reading **"Select your hand card 7"**, with `This step cannot be cancelled` beside it. The card's name is rendered on the tile 50 px away and in its `aria-label`, so the screen knows it. To check I had the right card before an irreversible commit I had to count tiles from the left. The *Returning player* did not realise "hand card 7" was a position at all and read it as a card called "Hand Card 7".
- **Severity:** major.
- **Proposed change:** put the card name in the confirm button: `Discard Torrential Tribute`. Where the engine genuinely does not supply a name, fall back to a description of what the player can see — `Discard the 7th card in your hand (Trap)` — never a bare ordinal. Render a thumbnail of the chosen card inside the panel.

### F-08 — The irreversible confirm button expands over the position Cancel occupied
- **Element:** the `Cancel` / confirm button pair in the tribute step (scenario *3*) and the attack-target step (scenario *4b*).
- **Heuristic:** Error prevention.
- **What happened:** *Fluent competitor*, task 3. Before a tribute is chosen: `Cancel` occupies x 593–679 and `Tribute` x 691–781 (both y 755). After choosing a tribute the confirm grows to hold its long label and now occupies **x 454–1018**, while `Cancel` jumps left to **x 356–442**. The old Cancel position (593–679) is now inside the confirm button. A player who clicks a tribute and then reflexively returns the mouse to where Cancel was presses **"Tribute Thunder King Rai-Oh (Monster 1) — after this you cannot cancel"** instead. Same pattern in the attack-target step.
- **Severity:** major.
- **Proposed change:** fix the two buttons' geometry: right-align the pair, keep Cancel at a constant x, and cap the confirm at a fixed width, moving the "after this you cannot cancel" clause out of the button label into the warning line above it (where the discard step already puts it). No control should ever grow into the space another control just vacated.

### F-09 — Graveyard, banished, deck and Extra Deck piles look clickable and are not
- **Element:** the eight pile tiles (`GY`, `BAN`, `EX`, `DECK`) on both fields.
- **Heuristic:** Visibility of system status; recognition rather than recall; flexibility and efficiency.
- **What happened:** *Fluent competitor*, task 4 (and all personas, task 6). After destroying the opponent's face-down monster, the rail says only `MOVE a card MZONE 1 → GRAVE` — the destroyed card is never named. Its identity is public information in the real game and it is now in a graveyard whose count went 0→1. I clicked the GY tile to look. The tiles are `<div>`s with **`cursor: pointer`** but no click handler, no `role`, no tab stop; clicking opens nothing. I tried both players' GY, then BAN. There is no graveyard viewer anywhere in the screen. So "what did my attack destroy?" is unanswerable — the task completes but its point does not.
- **Severity:** major.
- **Proposed change:** make each pile open a scrollable list of its contents (own GY/BAN and opponent's GY/BAN are public; DECK and face-down contents are not — those should show the count and say "contents hidden"). Until that exists, remove `cursor: pointer` from the piles so they stop advertising an interaction that does not exist.

### F-10 — Nothing on the screen states the result of a battle
- **Element:** the post-attack receipt (`ANSWERED FOR YOU · Attack their card 1`) and the two rail entries it produces.
- **Heuristic:** Visibility of system status; help users recognise what happened.
- **What happened:** *Learning Edison*, task 4 ("then work out what the attack did"). After the attack the screen tells me: a card was attacked, and a card moved to the graveyard. It never tells me **who won the battle, whether either player took damage, or what the attacked card was**. I inferred "no damage" only by re-reading the life totals before and after. In scenario 4b, attacking Mobius the Frost Monarch (2400) with Thunder King Rai-Oh (1900) destroyed Mobius and cost me nothing — the outcome a modern-YGO-fluent player would find impossible — and the screen said nothing that would let me question it. This is the persona this app is for, and the one moment where the format's unfamiliar cards will surprise them.
- **Severity:** major.
- **Proposed change:** emit one battle-result line to the rail and the receipt: `Thunder King Rai-Oh (1900) attacked Mobius the Frost Monarch (2400) — Mobius destroyed — no damage`, i.e. attacker + values, defender + values, what was destroyed, and the damage figure (explicitly `no damage` when zero). Where the defender was face-down, name it after it is destroyed, since it is now public.

### F-11 — The phase rail silently reports the wrong phase while a question is open
- **Element:** the `DP SP M1 BP M2 EP` phase rail.
- **Heuristic:** Visibility of system status; consistency and standards.
- **What happened:** *Fluent competitor*, task 4 (scenario *4b*). At rest the rail correctly marks **BP** current (`class="phase current legal"`, background `rgb(255,204,85)`). The moment the attack-target question opens, `current` moves to **M1** and BP goes plain — while I am mid-declaration of an attack, which cannot happen in Main Phase 1. It reverts to BP when the attack resolves *and also* when I cancel. I stopped and re-read the rail twice, assuming I had misclicked into Main Phase.
- **Severity:** major.
- **Proposed change:** freeze the phase rail's `current` marker for the duration of a question rather than recomputing it from a pre-question snapshot; assert in tests that the `current` phase before opening a question equals the `current` phase while it is open.

### F-12 — Card effect text is clipped to three lines in the inspector, with 330 px of art above it
- **Element:** the card inspector panel (left gutter), specifically its `.tb-body` effect-text paragraph.
- **Heuristic:** Aesthetic and minimalist design (misallocated space); recognition rather than recall.
- **What happened:** *Learning Edison*, tasks 1 and 5 — the persona defined as *not knowing this format's card pool*. Clicking Thunder King Rai-Oh opens a 254×483 px panel: 329 px of card art, then name, then attributes, then the effect text in a box that is **50 px tall for 107 px of content** (`clientHeight 50`, `scrollHeight 107`, `overflow:auto` with no visible scrollbar). The text cuts mid-sentence at "During either player's turn, when". The half of Thunder King's effect that decides whether the card is dangerous — the Special Summon negation — is the half that is hidden. I did not realise the box scrolled at all; there is no scrollbar, gradient, or "more" affordance.
- **Severity:** major.
- **Proposed change:** give `.tb-body` the panel's remaining height (`flex: 1 1 auto; min-height: 0`) and shrink `.inspector-art` to `max-height: 200px`, so a typical Edison-era effect fits without scrolling. Add a visible scroll affordance (fade + thin scrollbar) for the cards that still overflow.

---

## 3. MINOR

### F-13 — Clicking an illegal card during a question does nothing at all
- **Element:** non-candidate cards during any selection step (chain window, discard, tribute, attack target).
- **Heuristic:** Help users recognise and recover from errors.
- **What happened:** *Returning player*, task 5. In the chain window I clicked hand cards 1–4 in turn. Nothing happened — no shake, no message, no change to the `Chosen:` line, no sound. I could not tell whether my clicks were landing. (`elementFromPoint` confirms they were.) Same in the discard step. Worse: if a valid card is already chosen and you then click an invalid one, the old `Chosen:` line stays, so it reads as if your new click succeeded.
- **Severity:** minor.
- **Proposed change:** on a click that lands on a non-candidate card during a question, flash the card's border red for 200 ms and set the instruction line to "That card cannot respond here" for 2 s. Do not change the `Chosen:` line.

### F-14 — Clicking the opponent's face-down card gives no response of any kind
- **Element:** opponent slots holding a face-down card.
- **Heuristic:** Visibility of system status; help users recognise errors.
- **What happened:** *Returning player*, task 1. The face-down tile is a focusable `<button>` with `aria-label="Face-down card"`. Clicking it from a clean state opens no inspector, no verb bar, and prints nothing. I clicked it four times, assuming the client was slow.
- **Severity:** minor.
- **Proposed change:** open the inspector with a face-down placeholder: "Face-down card — Sakura's Spell & Trap Zone 1. You cannot see this card." That also solves the zone-labelling problem in F-16.

### F-15 — A Set Spell/Trap is drawn rotated, exactly like a face-down monster
- **Element:** the face-down card tile in the Spell & Trap row (`span.card.back.def`).
- **Heuristic:** Match between system and the real world; consistency and standards.
- **What happened:** *Returning player and Fluent competitor*, task 1. Both the Set card in the Spell & Trap Zone and the face-down monster in the Monster Zone render with `transform: rotate(90deg) scale(0.82)` — i.e. defence-position styling. In the physical game and in every digital client, a Set Spell/Trap sits upright and only a face-down *monster* lies sideways. Orientation is how experienced players read a board at a glance; here it carries no information, and the only remaining cue is which row the card is in — and the rows are unlabelled. (The mirroring itself is correct: opponent Spell/Trap outermost, opponent monsters adjacent to the rail, my monsters adjacent, my Spell/Trap outermost.)
- **Severity:** minor.
- **Proposed change:** apply `back def` only in the Monster Zone; render Set Spell/Trap cards upright (`back`), reserving rotation for defence position.

### F-16 — The board carries no zone labels
- **Element:** the two five-slot rows on each field.
- **Heuristic:** Recognition rather than recall.
- **What happened:** *Returning player*, task 1. Four unlabelled dashed rows and no legend. I worked out which row was which only after summoning a monster and seeing where it landed. Compounded by F-15 (orientation no longer distinguishes the two) and by the fact that questions refer to positions ("their card 1", "MZONE 1") that appear nowhere on the board except during the zone step.
- **Severity:** minor.
- **Proposed change:** a small persistent label at the left end of each row (`MONSTERS` / `SPELL & TRAP`), and render the 1–5 zone-number badges (which the zone step already draws) on the relevant row whenever a question refers to a zone by number.

### F-17 — The "ANSWERED FOR YOU" receipt disappears after 2.4 s and cannot be recalled
- **Element:** the auto-answer receipt in the dock (scenario *4a*).
- **Heuristic:** Visibility of system status; user control and freedom.
- **What happened:** *Returning player*, task 4. When exactly one target is legal, the client answers for you and shows `ANSWERED FOR YOU · Attack their card 1`. Measured: appears at 0.26 s, gone at 2.70 s — **visible for 2.44 s**, at the bottom of the screen, ~470 px below where the action happened on the board. If your eyes are on the opponent's field you will not see that the client answered a question on your behalf, and there is no way to bring it back. The rail keeps a terser version that omits the "answered for you" fact entirely.
- **Severity:** minor. *This one depends on time and my method under-detects timing — see §5.*
- **Proposed change:** either keep the receipt until the player's next action (as the turn-catch-up banner already does), or mark the corresponding rail entry with an "auto" tag so the fact that a decision was taken for you survives in the history.

### F-18 — The seating banner is on screen for 1.4 s and then unrecoverable
- **Element:** the dock banner `You vs Sakura / Sakura goes first.` (scenario *1 · The first ten seconds*).
- **Heuristic:** Recognition rather than recall.
- **What happened:** *All three personas*, task 1. Measured from scenario load: the banner is replaced by "Your move." after **1.41 s**. Who went first is a fact that matters for the rest of the duel and it is not recorded anywhere else — not in the top bar, not in the history rail (the rail reads "The duel has not started." at that moment; see F-21).
- **Severity:** minor.
- **Proposed change:** keep the seat and first-player facts in the top bar for the whole duel — e.g. `You (2nd) vs Sakura (1st)` beside the turn chip — and write a `Sakura went first` entry as the first row of the history rail.

### F-19 — The vacated Monster Zone is sometimes offered as a placement zone and sometimes not
- **Element:** the zone-choice step after a tribute (scenario *3*).
- **Heuristic:** Consistency and standards.
- **What happened:** *Fluent competitor*, task 3. Two identical Thunder King Rai-Ohs occupy Monster Zones 1 and 2. Tributing the one in **zone 1** offers zones **1, 3, 4, 5** — the vacated zone is offered. Tributing the one in **zone 2** offers zones **3, 4, 5** — the vacated zone 2 is *not* offered, though it is empty and the DOM still renders `slot-MZONE-1` as an empty slot. Same action, two different option sets.
- **Severity:** minor (no rule makes the vacated zone illegal; the cost is one lost legal choice and a dent in trust).
- **Proposed change:** compute the zone options from the post-tribute board state in both branches; add a test asserting that after tributing from zone *n*, zone *n* is among the offered options.

### F-20 — Card names on tiles are clipped, and with no art a tile carries almost no identity
- **Element:** the 60×84 px card tile name label (`.tilename`, `scrollHeight 40` vs `clientHeight 26`, `overflow: hidden`).
- **Heuristic:** Recognition rather than recall; aesthetic and minimalist design.
- **What happened:** *All three personas*, task 1 ("what are you holding"). Names read "Thunder King Rai-", "Dimensiona Prison", "Mystical Space". In scenario *10 · Every card image fails* the tile is a plain dark rectangle plus that clipped name — the two Dimensional Prisons are then completely indistinguishable from each other, and Spell/Trap/Monster is indistinguishable too, because with art suppressed nothing carries card type. Working out a 7-card hand required clicking each card in turn.
- **Severity:** minor.
- **Proposed change:** widen the hand tiles (there is ~250 px of unused width available, see F-22) so a two-line name fits; and in the no-art fallback add a card-type strip (monster / spell / trap colour band) plus level/ATK/DEF, so the tile stays classifiable without the image.

---

## 4. COSMETIC

### F-21 — The history rail reads "The duel has not started." during and after the duel
- **Element:** `WHAT HAS HAPPENED` rail.
- **Heuristic:** Visibility of system status.
- **What happened:** In scenarios 2, 3, 4a, 4b, 6, 8, and all three duel-end scenarios, the rail says "The duel has not started." while a duel is visibly in progress or has just ended. On the duel-over card in particular, the rail is the only place that could explain *why* you lost, and it says the duel never began. Almost certainly fixture data rather than the design — filed as cosmetic on that basis, but if a real duel can ever reach an end screen with an empty rail, this is a major.
- **Severity:** cosmetic (with the caveat above).
- **Proposed change:** seed each fixture's rail from its own event list; render an explicit "No events recorded" state rather than "The duel has not started." when the duel is demonstrably over.

### F-22 — The board is not centred and the rotated face-down tile overhangs its zone
- **Element:** playfield layout; `span.card.back.def`.
- **Heuristic:** Aesthetic and minimalist design.
- **What happened:** At 1440×900 the playfield spans x 266–1108 inside an available x 0–1120, because a 254 px inspector gutter is reserved on the left and stands empty whenever no card is inspected. The board's centre sits 127 px right of the area's centre. Separately, the rotated face-down tile measures 67 px wide inside a 60 px slot and starts at x 523 against a slot at x 527 — it visibly breaks the left edge of its dashed zone outline in every screenshot, and its "Face-down" label is rotated bottom-to-top and clipped.
- **Severity:** cosmetic.
- **Proposed change:** reduce the rotated card's scale so its rotated width is ≤ the slot width (at the current geometry `scale(0.82)` yields 67 px in a 60 px slot; ≈`0.73` fits) and centre it in the slot; and either centre the playfield when the inspector is closed, or use the reserved gutter for something (e.g. the graveyard viewer from F-09).

---

## 5. WHAT I TESTED, WHAT PASSED, AND WHAT I COULD NOT ASSESS

These are three different claims. I am not writing "no usability issues found" anywhere.

### Tested and passed

- **Mechanical check 1 — does every visible control receive its own clicks?** `document.elementFromPoint` was run at the centre of every visible interactive element in **13 states**: all 14 scenario defaults, verb bar open, zone step, tribute step (before and after selection), attack-target step, chain window (before and after selection), discard window, catch-up banner collapsed and expanded, inspector open, and the all-images-fail state. **Zero occlusions** in every one. The only failures are the 12 board controls under `.endscrim` on the duel-over screen, which is a modal scrim behaving correctly (and is what makes F-02's "Review board" matter).
- **Mechanical check 2 — do different answers produce different outcomes?** Every multi-answer question was taken twice from an identical starting state and the resulting board, hand, all eight pile counts, both life totals and the full history rail compared:
  - tribute Monster 1 vs Monster 2 (scenario 3) → **different** (different survivor, different zone options);
  - attack the face-down vs attack Mobius (scenario 4b) → **different** (different card destroyed, different rail text);
  - chain: Activate vs No response (scenarios 5a and 5b) → **different** (card moves hand→field; two extra rail entries);
  - discard candidate 1 vs candidate 7 (scenario 6) → **different** (different card leaves the hand, rail says `HAND 1` vs `HAND 7`);
  - catch-up: Show vs Dismiss (scenario 7) → **different**.
  No case of two answers collapsing to one outcome was found.
- **Point-of-no-return declaration.** The tribute and discard steps state cancellability *before* you press: `This step cannot be cancelled` in the discard; `COMMITTED` + `This step cannot be cancelled` in the zone step; `Tribute … — after this you cannot cancel` on the tribute confirm. This is genuinely good and the discard step is the best-designed panel on the screen apart from its label (F-07). *Caveat:* the verb chip that precedes the tribute step reads only `Normal Summon — tribute` and does not state the count; the count (`Tribute 1 monster for Raiza the Storm Monarch`) appears only on the next screen. That next screen is cancellable, so task 3's "work out the cost before you commit" **succeeds** — but only by one step. Putting the count on the chip (`Normal Summon — tribute 1`) would close the gap.
- **Re-clicking a chosen candidate deselects it** in the tribute and chain steps. Consistent and discoverable.
- **Hovering a card opens the inspector** without clicking — good for the fluent persona. (The inspector has no close control and does not close on background click; minor, folded into F-03's proposed change.)
- **Turn ownership is always visible**: the top-bar chip reads `YOUR TURN` / `THEIR TURN` / `DUEL OVER`, and the dock reads `Sakura is deciding` while waiting. Task 1's "whose turn is it" is answered immediately by all three personas.
- **No JavaScript console errors or page errors** were emitted in any scenario or interaction path.

### Could not assess

1. **Anything that depends on how the screen feels over time.** Animations, transitions, the disorientation of the board mutating during resolution, and whether the 2.44 s receipt (F-17) or the ~1.4 s seating banner (F-18) *feel* long enough. Screenshot-and-assert systematically under-detects motion. **These need a human look and must not be recorded as clean.** Specifically flagged for a human: the ~2 s gap between End Turn and control returning (scenario 7), the resolution delay after an attack, and whether the catch-up banner arrives before or after the board has finished changing.
2. **The resign flow.** `Resign` in the top bar is a fully enabled, prominently styled button that produces **no observable effect at all** — no confirmation, no dialog, no state change — both mid-duel and after `DUEL OVER`. There is therefore no resign confirmation for me to evaluate for task 8. Whether resigning should be confirmable is a product decision; that the control is currently silent is not.
3. **`← Exit` and `⚙ Settings`.** Both also inert. Whatever leaving a duel mid-game is supposed to do (forfeit? abandon? confirm?) is untested, and it is the second-most-likely way a real player backs out of something.
4. **Rematch and return-to-home.** Inert (F-02), so the post-duel journey ends at the end card.
5. **Whether the underlying rules engine is correct.** The prototype's outcomes are canned (1900 beats 2400 with no damage; life points never move; the rail names events the board does not reflect). I evaluated *what the screen says*, not whether it says the truth. Any finding here that could be fixture data says so.

### Tasks I could not complete

- **Task 5, "respond, then decline, then compare"** — completed mechanically, but not completable *knowingly* in scenario 5b, because the confirm names a card I did not choose (F-01) and the window has no cancel.
- **Task 7, "what can you do next"** — not completable. All three routes are dead (F-02).
- **Task 8, "back out of it"** — not completable at the verb bar, where the screen explicitly says it is (F-03). Completable and well-signposted at the tribute and attack-target steps. Not applicable at the discard and chain windows, which is itself worth noting: **the chain window offers no cancel and gives no advance warning that it cannot be escaped**, and its only alternative — `No response` — is a real, losing game answer rather than a way out. The discard window does warn (`This step cannot be cancelled`); the chain window should carry the same line.
- **Task 4, "work out what the attack did"** — the attack completes; working out what it did does not (F-09, F-10).

---

## 6. HEURISTIC SCORECARD

Scored on what the screen does today, worst-case per heuristic.

| Heuristic | Verdict | Evidence |
|---|---|---|
| Visibility of system status | **Poor** | LP contradicts the log (F-04); rail claims events that did not occur (F-05); phase rail shows the wrong phase mid-question (F-11); battle results never stated (F-10); rail says "The duel has not started" mid-duel (F-21). |
| Match with the real world | **Poor** | `CHAIN_SOLVED`, `LP_CHANGE`, `MOVE a card MZONE 1 → GRAVE`, `BATTLE damage step` are engine enums shown to players; a Set Spell/Trap is drawn as a defence-position monster (F-15). |
| User control and freedom | **Poor** | Verb bar cannot be dismissed and lies about Escape (F-03); no cancel and no warning in the chain window; end-card routes dead (F-02). |
| Consistency and standards | **Poor** | Same instruction string right in two panels and wrong in two (F-06); two differently-labelled cancels in one panel (`Cancel` and `Cancel tribute summon`); one question names cards, its twin numbers them (F-01/F-07); vacated zone offered in one branch, not the other (F-19). |
| Error prevention | **Poor** | Confirm names the wrong card (F-01); confirm grows over Cancel's old position (F-08); already-attacked monster still offers Attack (F-05); stale armed verb bar (F-03). |
| Recognition over recall | **Weak** | "your hand card 7" at an irreversible commit (F-07); "their card 1" with no matching badge on the board; clipped names (F-20); no zone labels (F-16); seating facts vanish in 1.4 s (F-18). |
| Flexibility and efficiency | **Weak** | No keyboard shortcuts at all (no key handler fires); no graveyard viewer (F-09); hover-to-inspect is the one genuine efficiency win. |
| Aesthetic and minimalist design | **Adequate** | Board is calm and legible; dimming of non-candidates during questions is effective. Space is misallocated (F-12, F-22) rather than cluttered. |
| Recognise and recover from errors | **Poor** | Illegal clicks are silent (F-13, F-14); six controls are silent no-ops; nothing ever explains why an action is unavailable (no disabled-state reasons anywhere — `title` is empty on every disabled control checked). |
| Help and documentation | **N/A by design** | The screen deliberately does not teach the rules; not scored. Note the distinction held: this report files "the screen fails to say what just happened / what you may do now", never "it should explain the rules". |

---

## 7. OPEN QUESTIONS (product decisions — not mine to answer)

1. **Should the graveyard be browsable?** F-09 assumes yes, because it is public information in the real game and every competing client offers it. If the answer is no, then F-10's battle-result line becomes the *only* way to learn what you destroyed, and its priority rises.
2. **Should `Resign` require confirmation?** A resign is irreversible and the button sits 12 px from `⚙ Settings`. The screen currently does nothing at all, so there is no existing behaviour to preserve either way.
3. **Should the chain window be cancellable?** The discard window declares "cannot be cancelled" and the tribute window offers Cancel. The chain window does neither — it offers `No response`, which is a game answer, not an escape. Whether a chain response can be backed out of before it is sent is a protocol decision.
4. **Should the "answered for you" fact be permanent?** When exactly one target is legal the client answers on the player's behalf. Should that be visible forever in the history, visible until the next action, or transient as now? This is a trust/tempo trade-off, not a usability defect I can settle.
5. **Should a player see how long an opponent has been disconnected?** Scenario 8 shows "Sakura lost connection. Waiting for them to come back." with no elapsed time and no indication that a "Claim the duel" control will eventually appear. With the clock deleted this may be deliberate; if so, the wait still needs *some* status, and the copy should say a claim option will become available.
6. **Is zone choice meaningful enough to be a question?** The zone step is the app's one uncancellable step (`COMMITTED`). If placement rarely matters in this format, auto-placing and offering a "change zone" affordance afterwards would remove the only point of no return that has no in-game cost. Not a defect — a scope call.

---

## 8. NOTES FOR IMPLEMENTATION (not usability findings)

- The prototype renders duplicate `data-testid` values: `slot-MZONE-0`…`4` and `slot-SZONE-0`…`4` exist on both fields, so a testid selector matches two elements. Scoping via `[data-testid=my-field]` / `[data-testid=opp-field]` works; prefixing the testids would be safer for whoever writes the real tests.
- The `pile-0-*` / `pile-1-*` prefix does not consistently identify the same player across scenarios (`pile-0` is inside `my-field` in scenario 3 and inside `opp-field` in scenario 4a). Fixture-level, but it will bite anyone asserting on pile counts.
- Every disabled control checked has an empty `title` and no `aria-describedby`; there is no mechanism anywhere for saying *why* something is unavailable.
- No `keydown` listener is reachable from `document` — Escape, Enter and every other key are inert throughout.

---

## 9. REPRODUCTION

Every finding above was produced by loading `duel-redo-prototype.html` from `file://` in Chromium at
1440×900 with `ignore_https_errors=True`, selecting the named scenario from the picker, waiting ~1.6–2.2 s
for the scenario to settle, and performing the clicks described in the finding. Geometry figures come
from `getBoundingClientRect()`, occlusion figures from `document.elementFromPoint()` at element centres,
and timing figures from an 50–100 ms poll of `innerText`. Missing-glyph boxes in screenshots are a
container font limitation and are excluded from every finding.
