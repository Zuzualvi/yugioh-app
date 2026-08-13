---
linear_project: Duel Experience Redo
---

# 07 · Coverage, fixture provenance, and what I did not verify

This document exists because a prototype is never "done" — it is **done to a stated coverage** —
and because on the previous round a specialist reported two things as driven that were not, and
its own words afterwards were *"my delivery report was WRONG."* Everything below is either
something I drove and can point at, or something I am telling you I did not.

---

## 1 · Coverage — what the prototype reaches, and what it does not

**Inventory: 16 surfaces · 94 state rows · 10 flows.**
**Prototype: 14 scenarios · 64 of 94 state rows reachable · 30 not reachable.**

🔴 **This table was RE-DERIVED against the built file on 2026-08-13, and the version it replaces was
wrong.** Every row below was decided by **driving the downloaded reviewable build**
(`raw.githubusercontent.com` → `file://`, headless Chromium 1440×900) and reading the DOM — not by
reading source and not by arithmetic on a previous total. What the earlier version got wrong, in the
direction that costs most:

- **The pile inspector and the chain strip were recorded as `0 / 5` and `0 / 6`, "not implemented at
  all". Both have been built since commit `6742523`** — *"Fix seven usability majors; build the two
  surfaces that had none"* — which landed **before** the SHA this round started from. The rows never
  caught up, and three successive rounds of edits carried them forward. **They are 4/5 and 2/6, driven.**
  See §1.2a.
- **The feed rail's `empty, turn > 1` was recorded as unreachable.** It renders `Earlier turns are not
  available.` at the load of scenario 7, and has all along.
- **The denominator was wrong too.** 91 (and my 92) undercounted the inventory by two: `02 §2` verb chips
  has **4** state rows and was counted as 3; `02 §4` phase rail has **5** and was counted as 4. The
  mechanical count of state-table rows in `02` is **94** — 93 before budget B1 added the receipt's
  `spent` row. Arithmetic on a wrong total is how the stale rows survived, so the total is now derived
  from the table rather than the table from the total.

**Two conventions, stated so the count can be checked rather than trusted.** (1) *Reachable* means a
reviewer can put the built prototype into that state; it does **not** mean the state is fully rendered as
specified — where it is not, the row says so and names the issue. (2) A row is marked reachable only if
this re-derivation observed it; three rows are marked **not driven** rather than assumed.

| Surface | Reachable / total | Not reachable, and why |
|---|---|---|
| Board / Field | **12 / 15** | `loading` — no pre-`STATE` state exists; every scenario opens from a snapshot · `art loading` — **not driven**, a sub-4 s transient (the art-*failed* end state is driven, scenario 10) · `disconnected` — no socket to drop. ⚠️ `off-clock` counts as reachable because the board *is* off-clock and inert (End Turn and every phase button disabled, a hand click opens the inspector, no `not your turn`), **but the desaturation the inventory specifies is absent** — `filter: none`, `opacity: 1`, no such class in the build. **ZUH-150.** |
| Verb chips | **4 / 4** | — *(was recorded as 3/3; there are four rows. `default`, `dismissed` via `Esc`, `empty` — no cluster and no sentence, driven on a hand card during `BattleCommand` — and `disabled`, driven off-clock: cluster 0 nodes, inspector 1.)* |
| Dock · Question | **5 / 8** | `partial` — no `min !== max` decision in the capture · `empty candidates` — never emitted · `error` — nothing rejects a response. *`gap` is driven: intent line up, dock reading `Resolving…`, 0 question nodes.* |
| Dock · Intent line | **5 / 5** | — *(all five driven, including `across the gap`: the line's text is byte-identical before and after the sub-decision arrives.)* |
| Dock · Receipt | **2 / 4** | `stacked` and `superseded` need two auto-answers in sequence; 4a is the only auto-answer path and no question follows it. *`spent` is driven.* |
| Dock · Waiting | **3 / 4** | `my connection dropped` — no scenario sets `net = reconnecting`. *`opponent is gone` is driven as specified: the dock renders **nothing** while the away banner owns the statement.* |
| Dock · Delta | **3 / 4** | `empty` — the handover scenario always carries events. |
| Dock · Away | **2 / 3** | `returned` — no presence-restore path. |
| Phase rail + turn resource | **5 / 5** | — *(was recorded as 4/4; there are five rows. `question open` is driven — marker stays on `M1` with all 7 buttons disabled, which is F-11's fix — and `turn boundary` is driven: the resource resets to `not yet used` when control returns.)* |
| Feed rail | **4 / 7** | `partial (— feed resumes here —)` — no reconnect path · `unrecognised event` — every recorded kind has a `describe()` case · `duel-ended row` — the rail renders no `Duel ended — {reason}` row. **`empty, turn > 1` was wrongly listed here and is reachable**, driven at the load of scenario 7. |
| Card inspector | **3 / 9** | `auto-push` (needs a resolving chain) · `pinned` (click and hover are the same gesture) · `art loading` (**not driven**, transient) · `provenance` and `provenance, art absent` (no captured card is in the pre-errata corpus) · `hidden card` (no route). *`hover`, `empty` and `art failed / 4 s deadline` are driven — the inspector renders name, type and ATK/DEF with **0** `<img>` nodes in scenario 10.* |
| **Pile inspector** | **4 / 5** | `answer-space` — no decision in the capture has a pile-located candidate. **Built and driven:** `default` (`YOUR GY — 2 CARDS · Uraby · Book of Moon`), `empty` (`Their gy is empty.`), `hidden` (`33 cards. Contents hidden — this is not public information.`), `disabled` — i.e. inspection works **off-clock**, driven. |
| **Chain strip** | **2 / 6** | `resolving`, `end` — no `CHAIN_SOLVING` or `CHAIN_END` event exists in any fixture · `compressed` — recorded chains are single-link · `unknown code` — every recorded link resolves. **Built and driven:** `empty` (absent, 0 nodes) and `default` — activating in scenario 5 renders `CHAIN 1 Book of Moon` with the owner tint (`clink mine`). |
| Top bar | **3 / 4** | `our socket errored` — no transport-error surface exists. |
| Duel-end overlay | **4 / 5** | `unknown reason` — no scenario emits an unrecognised reason. |
| Cross-surface rules | **3 / 6** | `error` · `partial` · `disconnected` — all three for the reasons above. *`loading` is driven negatively as specified — **0** spinner/loader nodes anywhere in the build; `empty` and `ended` are driven.* |

**The arithmetic, so it can be checked in one pass:**
12 + 4 + 5 + 5 + 2 + 3 + 3 + 2 + 5 + 4 + 3 + 4 + 2 + 3 + 4 + 3 = **64**, over
15 + 4 + 8 + 5 + 4 + 4 + 4 + 3 + 5 + 7 + 9 + 5 + 6 + 4 + 5 + 6 = **94**.

**On the 74 / 92 figure that has been quoted elsewhere:** it appears nowhere in this repository, so it is
not a number this document ever published. I cannot reproduce it and I have **not** tuned the table
towards it. The closest reconstruction is crediting the two previously-zeroed surfaces at their **full**
row counts on top of the old figure — 61 + 5 + 6 = **72**, or 63 + 11 = 74 — which is what someone would
get by asking "are they built?" rather than "which of their states can be driven?". Those two questions
have different answers, and this table answers the second: **the surfaces exist and 6 of their 11 states
are reachable.** If the higher figure was meant as "built, therefore covered", both numbers are right
about different things and this one is the one that survives being tapped.

*(Round 2: `end-overlay/dismissed`, `top-bar/duel-ended` review path and the verb-cluster dismissal
states became reachable with the blocker fixes.)*

*(Round 3, the pacing passes: B1's deleted timer gave §3.3 a `spent` state, and two states this table
counted as reachable **were not rendering** — the feed rail's `delta-marked` row never drew until
ZUH-141, then vanished on `Dismiss` until ZUH-145. Both driven now.)*

### 1.2 The two surfaces with zero coverage, stated plainly

> **⚠️ SUPERSEDED — this section was true when it was written and was false by the time it was read.
> Kept verbatim, with the correction appended in §1.2a, because deleting it would hide three rounds in
> which the document said we had not built something we had. The same append-not-rewrite rule as
> `04 §4.4a`.**

**Pile inspector** and **chain strip** are specified in the inventory and **built nowhere in the
prototype.** Both carry forward largely unchanged from the approved design (`2026-08-06-duel-ui-design.md`
§6 and §9), which is why I spent the budget elsewhere — but "carried forward" is not "shown", and
neither has been seen rendered in this design's layout. If the CEO's approval is meant to cover
them, it does not: he has not seen them here.

### 1.2a · Correction — appended 2026-08-13. BOTH SURFACES ARE BUILT, and this document said otherwise for three rounds

**They were built in commit `6742523`** — *"Fix seven usability majors; build the two surfaces that had
none"* — which is an **ancestor of the SHA this round of work started from**. So they were already in the
build when §1.2 above was last certified as accurate, and the `0 / 5` and `0 / 6` rows were carried
forward by rounds of editing that did arithmetic on the headline instead of re-deriving the table.

**What is there, observed by driving the downloaded build — not by reading the source:**

| Surface | State | What the built prototype showed |
|---|---|---|
| Pile inspector | `default` | `YOUR GY — 2 CARDS ✕ Uraby Book of Moon` after the recorded battle in scenario 4c |
| | `empty` | `THEIR GY — 0 CARDS ✕ Their gy is empty.` |
| | `hidden` | `THEIR DECK — 33 CARDS ✕ 33 cards. Contents hidden — this is not public information.` |
| | `disabled` (i.e. never) | inspection **works off-clock**: opened from the pile badge while control was the opponent's |
| | `answer-space` | **not reachable** — no decision in the capture has a pile-located candidate |
| Chain strip | `empty` | absent, 0 nodes, at the load of scenario 5 |
| | `default` | `CHAIN 1 Book of Moon`, owner-tinted (`clink mine`), after activating in scenario 5 |
| | `resolving`, `end`, `compressed`, `unknown code` | **not reachable** — no `CHAIN_SOLVING` or `CHAIN_END` event exists in any fixture, recorded chains are single-link, and every link resolves to a card |

**So the honest statement, which is the one that ships with the invitation to review:** both surfaces are
**built and can be tapped**, **6 of their 11 states are reachable**, and the 5 that are not are all "no
recorded frame exists" gaps rather than missing UI — except `answer-space`, which needs a decision the
capture does not contain. **The CEO asked for these two specifically — "build them or say plainly they are
out; silence is not an option."** They were built and this document kept saying they were out. That is
corrected here, and the mechanism that let it happen — editing a total instead of re-deriving a table — is
recorded in §1.1.

### 1.3 Flows

| Flow | Driven in the prototype? |
|---|---|
| F1 Seating | ✅ |
| F2 Summon, with the zone step asked | ✅ end to end, 3 actions |
| F3 Tribute summon + the commit point | ✅ end to end, 4 actions, both tributes |
| F4a Attack, one target, auto-answered | ✅ receipt reads **`ANSWERED FOR YOU · Attack their face-down monster, Monster 1`** — driven. *(This row previously quoted `Attack Mobius the Frost Monarch`, which is the design's illustrative copy in `03` F4a and **not what this build produces**: the recorded target is a face-down monster, and F-07's fix made the label describe what the player can see rather than name a card the decision never named. Corrected 2026-08-13.)* |
| F4b Attack, several targets, presented | ✅ both targets + player cancel |
| F5 Chain window | ✅ both answers, and both with and without MH-3b/ND-9 applied |
| F6 End-phase discard | ✅ all seven answers |
| F7 Pass / wait / regain control + delta | ✅ |
| F8 Opponent leaves → claim | ⚠️ **partial** — the presence transition and the grace period are driven by a prototype button, not by a frame. No `PRESENCE` frame exists (ND-10). |
| F9 Duel end | ⚠️ **partial** — three reasons render and **`Review board` IS wired** (driven: it dismisses the card and a `Duel over — show result` pill reopens it — that was blocker F-02, fixed on this branch). The remaining gap is provenance, not behaviour: the `DUEL_END` frame is hand-authored (see §2). *`Review board is not wired` was stale — corrected 2026-08-13.* |
| F10 Probing | ✅ verb chips, shake-with-no-text, hover inspector |

---

## 2 · Fixture provenance, per set

| Set | Provenance | Detail |
|---|---|---|
| `s01`–`s08` decisions, states and events | 🟢 **RECORDED** | Captured 2026-08-13 against `master` `f86683c` on the repo's own same-origin E2E harness (`e2e/harness/server.ts`, real WASM ocgcore, real `/api`, real duel WebSocket), two independent Chromium contexts at 1440×900, response-prompt suppression turned **off on both seats** so the engine's real decision sequence was not hidden by the mechanism this redesign deletes. **3,008 frames captured in full** (the ZUH-118 logs truncate at 900 chars, which loses every `STATE` frame). Slicing script: `fixtures/extract.py`. Recorder: `fixtures/record.mjs` + `fixtures/lib.mjs`. |
| `cards.json` | 🟢 **RECORDED** | The 14 passcodes the slices reference, read from the server's own catalog (`loadCatalog()`), not hand-typed. Names, types, ATK/DEF, levels and effect text are the shipped corpus. |
| Continuation branches (`branch(answer)`) | 🟡 **AUTHORED, and deliberately rules-free** | Only one answer was actually taken in the capture, so outcomes for the others are computed. Each is a **card move directly named by the answer**: you named a zone, the card goes in that zone; you named a tribute, that card goes to the graveyard. Nothing adjudicates legality, nothing resolves an effect, nothing computes damage. *The previous round hand-wrote a simulation of rules the engine already implements and spent design budget debugging three defects in the simulation. This is the smallest thing that is not that.* |
| Second attack target (`attack-multi`) | 🟠 **HAND-AUTHORED onto a recorded board** | The card record and the `CardEntry` are taken verbatim from the `s04` capture; **placing it in the opponent's second monster zone is invented**, because no recorded duel ever reached two attackable monsters. Needed because PRD A5 is about the >1-target case. |
| Candidate identities | 🟢 **RECORDED — JOINED, not authored** | Where a decision carries `code: 0` for a card the asking player owns, the identity is resolved from the `STATE` snapshot in the same recorded slice at `(controller, location, sequence)`. **Deleted in this revision:** the previous `chain-fixed` scenario, which hand-authored one card name onto every blank candidate and consequently named the wrong card. Its replacement, `chain-nocontext`, **withholds** the recorded `DECISION_CONTEXT` frame — a removal from recorded data, not an addition to it, and what the wire really gives for a summon-triggered window. |
| `DUEL_END` frames | 🟠 **HAND-AUTHORED** | The capture contains **764 relayed `MSG_WIN` messages and zero `DUEL_END` frames** — see ZUH-132. There was no ending to record. |
| `PRESENCE` / claim | 🟠 **HAND-AUTHORED** | No presence frame exists inside a duel today (ND-10). |
| Art | 🟢 real | `https://api.zuhayr.io/images/<passcode>.jpg`, public, no auth, no delta. Confirmed live: a known passcode returns `200 image/jpeg`; an unknown one returns `404 application/json`, which is why the component trusts `onError` on the `<img>` rather than a status code, and why it has a bounded 4 s deadline. |

### 2a · Which outcomes are REAL and which are AUTHORED — read this before tapping

The fixtures are recorded. **What happens after you answer is not the engine.** The independent
pass caught the cost of leaving that implicit: it saw a 1900 ATK monster destroy a 2400 ATK monster
for no damage and could not tell whether that was a design decision.

| After you answer… | Truthful? | What it is |
|---|---|---|
| a card lands in the zone you named | 🟢 real | a move the answer names |
| the tributes you named go to the graveyard | 🟢 real | a move the answer names |
| the card you named leaves your hand on a discard | 🟢 real | a move the answer names |
| the card you named is activated and moves to your spell/trap row | 🟢 real | a move the answer names |
| **battle resolution — who wins, what is destroyed, damage** | 🔴 **NOT SHOWN** | The prototype **stops at the declaration.** An earlier revision destroyed the target when the attacker's ATK exceeded the target's DEF, which is not the rule, and produced exactly the impossible outcome the pass reported. Resolving it correctly means implementing rules the engine already implements — the trap the last round fell into. The dock now says so on screen in the prototype's own stub voice: *"(prototype) the engine resolves the battle; this prototype stops at the declaration."* |
| **life points** | 🔴 **never move** | Same reason. No scenario claims otherwise; the `handover` feed contains a recorded `LP_CHANGE` event whose board consequence the prototype does not apply — that mismatch is real and it is the pass's F-04. |
| the feed rail's contents | 🟢 real for recorded events, 🟡 authored for events the answer generates | Every generated row names only what the answer named. No row asserts a consequence. |

**The rule now applied throughout: if a scenario cannot show a truthful outcome, it stops at the
decision and says so, rather than showing a false result.**

**Nothing recorded was reshaped to fit.** Where a recorded frame disagreed with what the design
wanted, the frame won and the disagreement became a delta: `ChainPrompt.selects` carrying
`code:0, name:""` for the asked player's own card became ND-9; `DECISION_CONTEXT` firing twice in
fifteen scenarios with no caption became MH-3b.

---

## 3 · What I drove, with evidence

Run against the built prototype, real mouse events at real coordinates, 1440×900, Chromium,
`ignore_https_errors=True`.

| Claim | Evidence |
|---|---|
| Tribute summon completes and **the chosen tribute is the card that dies** | Driven both ways. Confirm read `Tribute Thunder King Rai-Oh (Monster 1) — after this you cannot cancel` / `(Monster 2)`; the board fingerprints differ in exactly the tributed slot. `06-answer-outcome-matrix.md` §SelectTribute. |
| The attack-target step is never declined by the client | With one legal target the receipt reads **`ANSWERED FOR YOU · Attack their face-down monster, Monster 1`** (driven; the recorded target is face-down — `03` F4a's `Mobius` is illustrative copy, not this build's output) and the attack proceeds. With more than one it is presented (A5). `classify.ts` contains no `cancelable`. |
| **PRD B3 — nothing occludes anything** | `document.elementFromPoint` at the centre of every hand card, every phase button, `End Turn`, `Resign`, and both dock verbs, in the chain scenario with the dock at its tallest: **0 failures**. |
| The answer-fidelity invariant, by **enumeration** | 5 decision points, **19 answers**, **0 collisions**, 1 legitimately converging pair reported in its own section. `answer-matrix.py` exits non-zero on a collision and exited 0. |
| Enumeration found a real defect a sample would not have | Two recorded tribute candidates are both `Thunder King Rai-Oh`. The first run reported a collision on the end-phase discard, because two copies of one card leave an identical board. Fixes: the confirm label appends the slot when two candidates share a name; the feed's `MOVE` row names the source slot. |
| Zero console errors | `pageerror` captured across all 14 scenarios and the whole matrix run: none. |
| Zero inline style objects | `grep -c "style={{" spikes/duel-redo-proto/src` → 0. |
| Every state screenshotted | 23 PNGs in `shots/` — 15 scenario states plus 8 mid-flow frames from the tribute and attack walks. |

---

## 3a · The delta surface is sized for a load nobody has measured, and that is now stated

The permanent 320 px feed rail and the delta strip were specified against ZUH-131 B5: met 13–15 times
a game, ~30 s of activity per visit, "a handful of rows". **ZUH-139 measures both halves and both are
wrong** — ~6 visits a game at ~70–88 s intervals, each describing up to **100 s** (`02 §3.5` carries
the corrected table). What that changes here, stated so nobody has to discover it after tapping the
build:

- **What is measured about the load:** exactly one thing, and it is ours, not the VOD's.
  `fixtures/s07-opponent-turn.json` is one complete recorded opponent turn from our own engine — 28
  events, 18 after the `HINT` filter, **5 rendered delta rows**. **Neither pacing study counted events
  per turn**, and the same footage shows long turns are long because of *thinking* (a 30.00 s think with
  zero board change), so seconds do not convert into rows. **No row budget is claimed by this design.**
- **What is driven about the container:** the dock band holds its reserved **132 px** with a delta of
  10, 20 and 40 rows, and `elementFromPoint` finds **zero** occluded hand cards at every size, so a busy
  turn cannot reproduce ZUH-118 break 3. **What the same probe shows is that the expanded list is ~42 px
  and scrolls with 2 of 5 rows visible** — filed as **ZUH-148**, unfixed, because the remedy is inside a
  reserved-height band that the presentation layer (ZUH-120) owns.
- **What the rail is for, under the corrected numbers:** the strip is the notification, the **rail is
  the reading surface**, and the mark is how the player finds the boundary after the strip is gone. That
  is the honest answer to "does 320 px earn its space": it is the only surface that can hold a
  100-second turn, and it is the only part that survives the player's first click.

## 4 · What I did NOT verify, and will not claim

- **All motion.** Every duration, easing and transition in this design is **authored and
  unverified**, with exactly one exception. A still frame cannot show a transition that is too slow,
  too abrupt or absent. The CEO reviews motion. Values are six tokens in one file so revision is cheap.
  **This survives both pacing studies:** each refuses a number for `--m-instant`, `--m-quick`,
  `--m-base`, `--m-settle` and the 150 ms hover threshold, because **4 fps is 250 ms a frame** and a
  90 ms transition is at most one frame. A denser instrument that is still 250 ms does not reach them.
  **The exception is `--m-narrate` 600 ms**, which ZUH-139 places inside the observed register for one
  narration beat (a `TURN CHANGE` banner is up ~1 s; the `DRAW PHASE` banner after it is gone within
  0.5 s) — **two boundaries, medium confidence, the register and not the value.**
- **Pace and feel.** Same reason. The `--m-gap` round-trip beat (260 ms) is a guess at what a real
  WebSocket round trip feels like; the recorded capture has real inter-frame timings I did not
  mine for it. What *is* measured is that the gap exists and is worth filling: in the reference client
  an answer reaches its visible consequence in **≈2.0 s, of which ~1.5 s shows nothing happening**.
- **The pacing footage.** Both studies read and applied — `09-pacing-application.md`, budget by budget,
  one section per study. What they changed is the **long** durations (the receipt's and the error line's
  timers, both deleted) and the **load** on the delta surface (§3a). What neither could touch is
  everything sub-second, and **no number in either is a measurement of our own client.**
- **Anything below 1440×900.** Out of scope per G1 and not tested. Nothing sub-1440 is recorded as
  passing.
- **Audio.** Not designed.
- **Accessibility beyond `aria-label` and role attributes.** Not audited.
- ~~**The pile inspector and the chain strip.** Specified, not built, not seen. §1.2.~~
  **STRUCK 2026-08-13 — false.** Both are built (commit `6742523`) and both have now been **driven** in
  the built file: pile inspector 4 of 5 states, chain strip 2 of 6. What remains genuinely unverified
  about them is the five states no fixture reaches — `answer-space`, and the chain strip's `resolving`,
  `end`, `compressed` and `unknown code`. See §1.2a.
- **That any of this works against the real server.** The prototype replays recorded frames; it has
  no socket. Reconnect, error handling, concurrency and persistence are all faked.
- **The claim that ND-9's replay implications are safe.** I reasoned that responses are index-based
  so adding identity to decision payloads cannot change replay. I did not test it. It is flagged in
  `05-backend-delta.md` §3 as the one delta with a replay question attached.
- **Every outcome after an answer.** See §2a. Battle and life points are not modelled at all.
- **Six of the nine major findings from the usability pass.** Three are fixed: F-06 and F-05 fell
  directly out of a blocker fix, and **F-11 was fixed on its own merits** — the phase rail reporting
  `M1` while an attack-target question is open is the screen stating something untrue, which is
  requirement D1's class, on the surface the player uses to orient. The remaining six majors, all
  minors and both cosmetics are **deliberately held** pending the CEO's own pass, so his findings
  can re-rank them and remain attributable.

---

## 8 · The independent usability pass, and what changed because of it

An independent evaluator drove all 14 scenarios with no access to the design rationale or the
source: **3 blockers, 9 major, 8 minor, 2 cosmetic.** Full findings at `../usability/findings.md`.

| Blocker | Fixed | How |
|---|---|---|
| **F-01** — the confirm control named a card the player had not selected | ✅ | Root cause was **not** the evaluator's guessed off-by-one. A hand-authored fixture assigned one literal card name to every blank candidate, so the **label and the response came from different sources**. The literal is deleted; identity is now joined from the recorded `STATE` snapshot. See §2a and `05-backend-delta.md` §2a. |
| **F-02** — all three end-card routes inert | ✅ | `Review board` lifts the scrim, re-enables inspection and leaves a `Duel over — show result` pill; `Play Sakura again` starts a fresh duel; `Back to Home` is **disabled and labelled** `(prototype: outside the duel screen)`. `Resign`, `Exit` and `Settings` were inert too — `Resign` is now a two-step confirm that ends the duel, because requirement **E1** calls it the guarantee of last resort and an inert one made E1 a claim the screen did not honour. `Exit` and `Settings` are disabled and labelled. |
| **F-11** — the phase rail reports the wrong phase while a question is open | ✅ | Not a blocker on the list, fixed anyway: the rail now reads `STATE.currentPhase`, the engine's own value carried on every snapshot, instead of inferring the phase from the kind of decision being held. Verified identical before / during / after an attack-target question, and still following the engine when the phase really advances. |
| **F-03** — `Esc closes` advertised, no key handler anywhere | ✅ | `Escape` dismisses the verb cluster, then the inspector, then takes the player's own cancel where one exists. Background click and re-clicking the same card also dismiss; the cluster has a visible `✕`. **`Escape` deliberately does NOT answer an OFFER** — declining a chain window is a substantive game answer, not an escape, and that is the distinction the classification law draws. My reading; flagged. |

### The finding that mattered more than the instance

**The answer matrix passed 19 of 19 while F-01 was live**, because it compares end *states* and
never reads the *label*. Those are two invariants, not one. The gate now checks both:

- **A · distinct outcomes** — unchanged.
- **B · label fidelity** — the app publishes `window.__lastSubmit`, whose card identities are
  resolved **from the response's own indices**, and the gate asserts the confirm label and the
  selection line contain them. Two independent paths; a label sourced from anywhere else fails.

**Verified the gate can fail:** the original defect was deliberately reintroduced and the gate
reported 6 label-fidelity failures naming the exact mismatch (`submits 'Heavy Storm' but confirm
label says 'Select Dimensional Prison'`). A gate that passes but cannot fail is not a gate.

---

## 5 · The one prototype-only affordance

`away` scenario: a button reading `(prototype) simulate the grace period elapsing`. It exists
because no `PRESENCE` frame exists to drive the transition (ND-10). It is labelled as prototype
chrome on screen so nobody mistakes it for product.

---

## 6 · How to open it

**There are no branch preview deployments for `proto/*` on this repo** (`deploy.yml` fires on
`master` only). Delivery is:

1. **A single self-contained HTML file** — `spikes/duel-redo-proto/dist/index.html` after
   `npm install && npm run build` in that folder. It opens straight from `file://` with no
   toolchain, no server and no network except card art.
2. **Screenshots of every reachable state** — `design/shots/*.png`, 23 files.
3. **The branch and SHA** — see `00-README.md`.

To re-run the gate: `npx vite preview --port 4321 --strictPort` then
`python3 answer-matrix.py http://localhost:4321/ <out.md>`. It exits non-zero on a collision.
