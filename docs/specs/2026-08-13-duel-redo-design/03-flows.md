---
linear_project: Duel Experience Redo
---

# 03 · Flows

Sequencing is the substance. For every flow: how many actions to reach the goal, what fills the
gap between an action and the system responding, whether the player can tell what is happening
while they wait, and how they recover from each failure.

**Timing values are named tokens, not numbers in prose.** Every duration below is
`--m-gap` (260 ms, the modelled round trip), `--m-settle` (320 ms) or `--m-narrate` (600 ms).
Two pacing studies have landed and their answers, budget by budget, are in
`09-pacing-application.md`. **`--m-gap` and `--m-settle` are still authored and unverified** — both
studies refuse a number below 250 ms, which is their frame interval. **`--m-narrate` 600 ms is the one
value with corroboration**: a `TURN CHANGE` banner in the reference client is on screen ~1 s and the
`DRAW PHASE` banner after it is gone within 0.5 s, so 600 ms sits inside the observed register for one
narration beat — **two boundaries, medium confidence, the register and not the value.**
`--m-receipt` no longer exists: the auto-answer receipt has **no lifetime** (B1).

**What fills every gap, once, so no flow repeats it.**
1. The dock band **does not unmount**. It swaps its content to the `Resolving…` reading.
2. The **intent line stays**, unchanged, naming the verb and the card.
3. The board **does not move**. Nothing reflows, ever — the feed rail's width is permanent.
4. If the gap exceeds 2 s, the same reading persists; there is no second escalation and no clock.
   **And no escalation may be introduced earlier than 5 s** (ZUH-131 B3, now with measured beats
   rather than sampled ones): in the reference client a full-screen damage band runs **2.00 s and
   2.25 s**, a lethal flash reaches the result screen in **≈6.5 s and ≈6.75 s**, a whole chain exchange
   takes **3.0 s and 4.25 s**, and an answer reaches its visible consequence in **≈2.0 s of which
   ~1.5 s shows nothing happening at all** — with neither player reacting to any of it. A threshold
   below 5 s would be invented. **Above 5 s there is still no number and this design does not supply
   one**: what the evidence licenses is the *negative*. (The 30 s static stretch in that footage is the
   **player** being slow and knowing it. It is not a tolerance measurement and must not be cited as
   one.)
   *That ~1.5 s of visible nothing after an answer is exactly the gap rule 1 fills — it is why the
   `Resolving…` reading exists, though it is not a measurement of `--m-gap`.*
5. **Nothing on this screen ever times out a question, and no rejection removes itself** (B4, B2).

---

## F1 · Seating — the first ten seconds

**Entry:** the room hands off. **Goal:** be oriented enough to make a first move.

| # | Player does | Screen does | Gap |
|---|---|---|---|
| — | nothing | slots at 30%, dock reads `You vs Sakura` / `You go first.` | — |
| — | nothing | first `STATE` lands; hands populate; feed reads `The duel has not started.` | `--m-narrate` |
| — | nothing | first `DECISION` arms the board; dock reads `Your move.` | `--m-gap` |

**Actions to goal: 0.** Turn order comes from `STATE.currentTurn` — no delta. The name comes from
ND-11.
**Failure:** the first `STATE` never arrives → the slots stay at 30% and `← Exit` works. There is
no timeout, so nothing forces an end here; the player leaves.
**No timer dismisses the seating line either** (ZUH-131 B6): it is replaced when the first
`DECISION` arms the board. Whether it deserves a louder register than a dock line is an open
decision, not a duration — `02 §3.7` and `09-pacing-application.md` B6.

---

## F2 · Summon a monster

**Entry:** armed with `IdleCommand`, monster in hand.

| # | Player does | Screen does |
|---|---|---|
| 1 | click the monster | verb chips at the card: `Normal Summon · Set · Inspect` |
| 2 | click `Normal Summon` | intent line appears; dock → `Resolving…` for `--m-gap` |
| 3 | — | zone step: legal zones glow with their slot numbers; sentence reads `Place "Uraby" — click a highlighted zone on the board.` |
| 4 | click a zone | the card lands there in `--m-settle`; feed gains `SUMMON · Uraby · hand → field`; turn-resource flips to `spent` |

**Actions to goal: 3.** The zone step is asked because five zones are five substantive answers
(PRD A1). It costs one click **on the board** and no panel — which is what made the old auto
default attractive, without the contradiction. See 01 §8.1: I am surfacing this rather than
deciding it alone.

**Branches**

| Condition | Path |
|---|---|
| `zones.length === 1` | auto-answered; receipt `ANSWERED FOR YOU · Place Uraby in Monster 3`; 2 actions |
| `positions.length > 1` | position step in the dock; +1 action |
| the opponent has a response window | intent line clears; dock → `Sakura is deciding` |

**Failures and recovery**

| Goes wrong | Sees | Recovers by |
|---|---|---|
| server rejects the summon | the question re-renders with an amber line; board returns to armed | clicking again; nothing was consumed |
| round trip stalls | `Resolving…` persists; the intent line still names the card | waiting — and there is no clock to lose |
| socket drops mid-intent | board freezes at 60%, `Reconnecting…` | on reconnect the pending `DECISION` is re-sent; **the intent line is not restored** (ND-2, stated degradation) — the step resumes with its own sentence |
| the summon is negated | chain strip shows the negation resolving; the resolving card's text auto-pushes; feed gains the rows | nothing to do — it happened |

---

## F3 · Tribute summon — the flagship, and where the exit stops existing

**Entry:** armed, a level-6 monarch in hand, two monsters on your field.

| # | Player does | Screen does |
|---|---|---|
| 1 | click the monarch | chips: `Normal Summon — tribute · Inspect` — **no count**, because it is not on the wire at idle time |
| 2 | click it | intent line `Tribute Summon Raiza the Storm Monarch  [Cancel tribute summon]`; `Resolving…` `--m-gap` |
| 3 | — | tribute step: `Tribute 1 monster for Raiza the Storm Monarch.` Both legal tributes lifted out of the scrim **on the board**; selection line reads `Click a highlighted card on the board` |
| 4 | click one | selection line → `Chosen: Thunder King Rai-Oh (Monster 1)`; **confirm reads `Tribute Thunder King Rai-Oh (Monster 1) — after this you cannot cancel`** |
| 5 | confirm | the named monster goes to the graveyard; `Resolving…` |
| 6 | — | zone step. Intent line's cancel is replaced by `COMMITTED`; the dock's left slot is the flat statement `This step cannot be cancelled` |
| 7 | click a zone | the monarch lands; feed gains both rows |

**Actions to goal: 4.**

**The commit point, and why it is drawn.** Not the clock — the clock is gone. `SelectZone` has no
cancel response in the protocol (`RSelectZone.indices` is not nullable; no recorded `SelectZone`
frame carries a `cancelable` field; runtime-facts Q4 records that sending one hangs the engine).
The exit genuinely stops existing at step 6, and PRD A3 means the client will never take it for
you. So the player is told **on the click that costs it**, in words, and told again by the absence
of the control afterwards. There is no step budget, no dots, no glyph.

**Two identical candidates.** The recorded decision offers two cards both named *Thunder King
Rai-Oh*. The confirm label appends the slot — `(Monster 1)` / `(Monster 2)` — because two answers
whose controls say the same thing is the answer-fidelity defect in its purest form. **The
enumeration found this; a sample would not have.**

**Failures**

| Goes wrong | Sees | Recovers by |
|---|---|---|
| player wants out before step 5 | `Cancel tribute summon` is live | pressing it — the client sends the cancel because the **player** asked; it never sends one itself |
| player wants out after step 5 | `COMMITTED` and `This step cannot be cancelled` | nothing. They were told at step 4. |
| a trigger fires after the summon | it arrives as its own decision with its own sentence; the intent line has already ended | answering it |

---

## F4 · Attack — the flow that made the game unwinnable

**Entry:** Battle Phase, `BattleCommand` held with a monster in `attacks[]`.

### 4a · Exactly one legal target

| # | Player does | Screen does |
|---|---|---|
| 1 | click your monster | chips: `Attack · Inspect` |
| 2 | click `Attack` | `Resolving…`; the target step arrives with one card |
| 3 | — | **the client answers it** (one substantive answer) and shows `ANSWERED FOR YOU · Attack Mobius the Frost Monarch`, which **persists** — no timer (B1) |
| 4 | — | the attack resolves; feed gains `ATTACK` and the result rows. **The receipt is still there**: the board re-arming is not a supersession |

**Actions to goal: 2.**

**The receipt's exits are the delta strip's**: a question takes the band · the player's next action ·
control leaves me · `DUEL_END`. `02 §3.3`.

### 4b · More than one legal target — always presented (PRD A5)

| # | Player does | Screen does |
|---|---|---|
| 3 | — | `Thunder King Rai-Oh attacks — choose a target.` Legal targets lifted out of the scrim on the opponent's field |
| 4 | click a target | confirm reads `Attack Mobius the Frost Monarch` |
| 5 | confirm | that monster is the one that is attacked |

**Actions to goal: 4.**

**What is structurally impossible now.** The shipped client sent
`{"kind":"SelectCard","indices":null}` in the same tick, without rendering, because
`responsePrompts.ts:86` classified "mandatory" as *"has no decline path"* and ocgcore marks the
attack target `cancelable: true`. Under the classification law (01 §3) `SelectCard` is a **STEP**,
the client may never send a decline for a step, and `cancelable` is not read anywhere in the
auto-answer path. **There is no code path left that can decline a step** — asserted by CC-A1, a
source-level check that the identifier does not appear in that module.

**Failures**

| Goes wrong | Sees | Recovers by |
|---|---|---|
| the player changes their mind | `Cancel` — because the ENGINE offers it on this step and the player is a person | pressing it; the board returns to armed and the attack is not declared |
| the attack is negated (Dimensional Prison) | chain strip; the negating card's text auto-pushed; feed rows | nothing — it happened |
| no legal target and no direct attack | the `Attack` chip is simply **not rendered**, and nothing says why | picking something else |

---

## F5 · A chain window opens — the most decisive moment in Edison

**Entry:** an event you may respond to. `ChainPrompt` is an **OFFER**: declining is a real answer
with consequences, so it is presented every time. There is no setting.

| # | Player does | Screen does |
|---|---|---|
| — | — | board dims; every candidate lifted wherever it lives; chain strip if there is a chain |
| — | — | line 1: `"Book of Moon" was activated.` / `Chain a card or effect?` |
| 1 | click a candidate | confirm reads `Activate Dimensional Prison` |
| 2 | confirm, **or** `No response` | either answer is a first-class button of equal weight, decline on the left |

**Actions to goal: 2, or 1 to decline.**

**The budget for this whole surface is about ONE SECOND, measured.** Four response prompts in the
reference client, put to two competitive players, were on screen and answered in **0.25–1.5 s** — and in
one case the click is visible on the frame, so that is answer time and not display time (ZUH-139 M11).
The needs model said *"a few seconds"*; it is ~1 s. **That confirms the "line 1 must carry the whole
story" rule harder than the model stated it — a surface needing two fixations does not fit in one
second — and it raises the priority of the two things here that force a second fixation:** the stated
`The engine did not say what.` fallback (closed by **MH-3b**) and a candidate the engine redacted from
its owner, read as `your set card 1`, which sends the player to the board to work out which card it is
(closed by **ND-9**). Neither is new; both are now on the critical path of a one-second decision rather
than a multi-second one.

**What line 1 does when the engine gave nothing.** Recorded: `DECISION_CONTEXT` fired **twice in
fifteen scenarios**, both times only because a chain already existed, and no observed frame
carried a `caption`. So the commonest window of all — *respond to a summon* — has no subject on
the wire. The screen says `Something happened that you may respond to.` and, in caption weight,
`The engine did not say what.` It is a stated degradation. **MH-3b closes it; scenario 5b in the
prototype is the same window with the delta applied, side by side.**

**The other half of the same moment is unreadable for a different reason.** Recorded:
`{"selects":[{"code":0,"name":"","controller":0,...}]}` — the engine redacted a card **from its
own owner**. The candidate reads `your set card 1`. That is the most it can honestly say. **ND-9
closes it.**

**Failures**

| Goes wrong | Sees | Recovers by |
|---|---|---|
| the player wants to read the card first | hover or click anything → inspector; **inspection never answers the question** | reading, then answering |
| the window is your own priority on your own summon | same surface, and line 1 names *your* card in *your* colour | answering |
| the response is rejected | the question re-renders with an amber line | re-answering |

---

## F6 · End-phase hand discard

**Entry:** `SelectCard` over your own hand, `min=max=1`, seven candidates.

Recorded verbatim, and every candidate arrives `code: 0, name: ""` although all seven belong to
the player being asked. The board shows them by name (the `STATE` frame is not redacted from its
owner); the **decision** does not. So the dock's selection line reads
`Chosen: your hand card 4` while the tile the player clicked reads *Bottomless Trap Hole*.

**Actions to goal: 2.** This flow exists in the inventory mainly as the cheapest possible
demonstration of what ND-9 costs.

---

## F7 · Pass the turn, wait, get it back

| # | Player does | Screen does |
|---|---|---|
| 1 | click `End Turn` | **the decision is cleared in the same tick** — before any ack. Dock → `Sakura is deciding`; the board desaturates; every control disables |
| — | nothing | the feed rail narrates events as they arrive; the inspector auto-pushes their activations; the chain strip builds |
| — | — | control returns: dock shows `[4] things happened while it was theirs  [Show] [Dismiss]`, and the feed gains a `— since you last acted —` rule |
| 2 | `Show`, or just act | the delta lists the rows; it clears on the first action or on `Dismiss` |

**What this kills.** ZUH-118 breaks 2 and 4 are one defect: `DuelScreen.tsx:162` sets
`pendingDecision` and nothing ever clears it, so after passing the player sat on a stale question,
board dimmed, `End Turn` disabled, hand physically covered — and clicking their own hand produced
the raw string `⚠ not your turn`. **Cessation is the fix, and it is stated: a decision stops being
the player's the instant the client responds** (01 §7).

**Requirement B2 falls out of the derivation, not out of discipline.** `Control` is `mine` only
while an unanswered decision is held for my seat; every control's enabled-ness reads that one
value. Off-clock nothing is enabled, so no interaction can produce a `not your turn` response —
there is nothing to click.

**Failures**

| Goes wrong | Sees | Recovers by |
|---|---|---|
| the opponent takes a long time | the waiting reading persists; the feed keeps narrating; **no clock is running on anyone** | inspecting, reading, waiting |
| the opponent disconnects | F8 |
| I reload mid-opponent-turn | on reconnect the board and any pending decision are restored; the feed reads `Earlier turns are not available.` and the delta is not reconstructable | reading the board |

---

## F8 · The opponent leaves — the ending the clock used to provide

PRD C1/C2. With timeout-forfeit deleted, this must still reach a **definite end**, **tell the
player what happened**, and **give them a route out**.

| # | State | Screen |
|---|---|---|
| 1 | presence lost | top-bar dot amber; banner `Sakura lost connection. Waiting for them to come back.` The dock says nothing else — one statement at a time |
| 2 | they return | banner clears; normal waiting resumes |
| 2' | grace elapses (server, ND-10) | banner → `They have not come back.` + `Claim the duel` |
| 3 | player claims | `DUEL_END { winner: me, reason: "abandoned" }`; end card reads `Sakura left the duel and did not come back.` |

**No duration is displayed and no countdown exists on screen.** The grace period is a server fact.
The player presses a button; the duel ends; they get the same route onward as any other ending.

**If the player leaves too.** A duel with neither seat present is server housekeeping, not a
screen concern — noted as a nice-to-have in the delta list so it is not lost.

**And the guarantee of last resort.** `Resign` is reachable from the top bar in **every** state of
the screen. That is requirement **E1**, and it is new: with no clock, a player who reaches a
decision the client cannot answer has nothing to release them. ZUH-118 finding 27 lists five
variants that render read-only with no confirm and no decline; under the old build a player who
reached one was locked until the clock forfeited. The clock is gone, so (a) every variant gets an
answer path in the component contract, and (b) `Resign` is the floor.

---

## F9 · The duel ends

**Entry:** `DUEL_END`.

| # | Player does | Screen does |
|---|---|---|
| — | — | board freezes at full colour, still inspectable; end card fades in over `--m-narrate` |
| 1 | `Review board` | the card dismisses; a `Duel ended` pill top-centre reopens it |
| 1' | `Play Sakura again` | (proposed scope — see 02 §10) **re-enters F1: the seating statement and turn order come back before the board arms** |
| 1'' | `Back to Home` | leaves |

**Cause, in game terms and only where we have one:** `Sakura's life points reached 0.` /
`You resigned.` / `Sakura left the duel and did not come back.` An unrecognised reason renders
`The duel ended.` plus the reason string verbatim — never a guess.

**Nothing here is on a timer — ZUH-131 B6, and it is a requirement rather than an observation.** The
reference client spends **~15–20 s** of read-only screens between two games and states turn order
full-screen before the board exists. So: **the end card has no exit timer and no countdown**, and the
rematch route **must** land on F1 rather than on an armed board. Both were already true of this
design; neither was written down, and "not an instant bounce" is exactly what an implementation
quietly gets wrong.

**How strong that evidence is, precisely: n = 1.** ZUH-139 proved the other game boundary was **cut by
the editor** — game 1's `VICTORY` and game 2's `TURN CHANGE` are 250 ms apart in the same VOD — so the
second instance was destroyed, not missed. Do not present ~20 s as typical; it is the only one ever
seen. **What is measured twice is the front of that beat: the lethal damage flash reaches the result
screen in ≈6.5 s and ≈6.75 s, and the result screen carries an `OK` that blocks rather than
auto-advancing.** Both support the rule above — the requirement is "no timer", which does not depend on
the 20 s at all. (The louder-register question this raises for F1 is *not* answered here — see
`09-pacing-application.md` B6.)

🔴 **A finding that lands squarely on this flow.** Driving a full duel against the real engine on
2026-08-13, **life points reached 0 and the duel did not end**: `duelEnded` stayed `false`, play
continued for many more turns, and across 3,008 captured frames there were **764 relayed
`MSG_WIN` messages and zero `DUEL_END` frames**. Filed as **ZUH-132**. Combined with the clock's
deletion, that currently leaves **resign as the only ending a duel can reach**. It does not block
this design — the surface is specified — but nothing in the inventory can be exercised end to end
until it is fixed.

---

## F10 · Probing — the flow whose frequency is invisible

Fluent or learning, players probe: click, read, escape, click the next. Its frequency is invisible
because a player who cannot back out stops probing altogether.

⚠️ **"Players probe constantly" is FALSIFIED where it could be tested, and this flow keeps its shape
anyway.** In the only full-density own-turn think available — **30.00 s**, one competitive player's own
Main Phase 1 — there is **not one visible probe**: no card-text panel appears or disappears, nothing
highlights, and the board's frame-to-frame change never rises above noise. The researcher's own limit
is that no cursor is visible in any frame, so the honest form is *"the player made no inspection this
client would have rendered, for 30 s"* — they were **looking, not touching**. Two things follow, and
they point in opposite directions, so both are stated:
- **Nothing below changes.** Every consequence of this flow — probing costs nothing, `Esc` closes, the
  inspector is free and never broadcast, a card that affords nothing gets a shake and no sentence — is
  correct whether the behaviour happens 50 times a turn or twice. The cost of being wrong about the
  frequency is zero; the cost of a probe that charges the player is unbounded. **A flow whose value does
  not depend on its frequency should not be resized by a frequency finding.**
- **What is weakened is the ARGUMENT, not the flow:** "its frequency is invisible" was doing work as a
  reason to prioritise this, and there is now one measurement suggesting the frequency is lower than the
  needs model assumed. **It should not be quoted as high-traffic.** (ZUH-139 M4;
  `09-pacing-application.md` Pass 2.) Backing out was also never observed at all in four minutes of
  full-density footage — untested, not disconfirmed.

- Clicking a card you control while armed → verb chips. `Esc` closes, costs nothing, and the chip
  cluster says so.
- Clicking anything else → the inspector. Free, instant, silent, **never broadcast** — DuelingBook
  broadcasts `Viewing Deck` and its community pays for extensions to stop it.
- Clicking a card that affords nothing → a 200 ms shake and **no sentence**.
- Hovering anything → the inspector after 150 ms. **(Authored and unverified: ZUH-131 explicitly
  refuses a number for this threshold — it is below the footage's resolution. It needs a build and a
  stopwatch.)**
- While a question is up, clicking a non-candidate inspects rather than answering.

**No keyboard event may submit a decision. `Esc` never commits anything, anywhere.** Carried
forward from the previous design's keyboard contract, which exists because `Esc` once committed an
irreversible tribute step and destroyed a card the player never chose.

---

## Appendix · Actions to goal

| Flow | This design | Shipped |
|---|---|---|
| Normal summon | 3 (2 if one legal zone) | 2 + a zone panel + two panel-flashes |
| Tribute summon | 4 | not reachable — the board never survived to a second Main Phase |
| Attack, one legal target | 2 | ∞ — the attack silently evaporated, forever |
| Attack, several targets | 4 | ∞ |
| Respond to a chain | 2 (1 to decline) | 0 — declined for you in 25 ms |
| End the turn | 1 | 1, then a stale question panel with the hand covered |
| Find out what a card is | 1 (0 on hover) | not reachable — every route returns "Face-down card" |
| Find out what changed | 0 | not reachable |
