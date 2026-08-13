---
linear_project: Duel Experience Redo
---

# 02 · Surface inventory

Every screen, panel, band and overlay the duel presents. For each: the job it does for the
**player**, entry, exit, every state, and — because motion left unspecified ships as whatever
emerged — **the motion of each state, by token**.

> ⚠️ **Motion values below are named tokens in `spikes/duel-redo-proto/src/styles.css`**
> (`--m-instant` 90ms · `--m-quick` 140ms · `--m-base` 200ms · `--m-settle` 320ms · `--m-narrate`
> 600ms · `--m-gap` 260ms), so revising the whole surface's pace is editing six lines.
>
> **ZUH-131's pacing study has landed and its answer is in `09-pacing-application.md`, finding by
> finding.** What it changed here: `--m-receipt` is **deleted** — the auto-answer receipt has no
> timer (B1, §3.3) — and the 8 s exits on the error lines are gone (B2, §3.1 and §9). What it did
> **not** change: **every one of the six tokens above is still AUTHORED AND UNVERIFIED.** The study
> refuses to give a number for `--m-instant`, `--m-quick`, `--m-base`, `--m-settle` or the 150 ms
> hover threshold, because they sit below its instrument's resolution, and gives none for
> `--m-narrate` or `--m-gap` either. A still frame cannot show a transition that is too slow, too
> abrupt or absent, and neither can a 5-second-sampled VOD. Settling them needs a build and a
> stopwatch, or a capture of our own client.

**Reference viewport 1440 × 900, and that is also the floor** (PRD G1). Below it is out of scope
and untested; nothing sub-1440 may be recorded as passing.

---

## 0 · Layout — what is always on screen

```
┌───────────────────────────────────────────────────────────────┬────────────────┐
│ ← Exit  ● Sakura   YOUR TURN                    ⚙  Resign     │                │ 40px topbar
├───────────────────────────────────────────────────────────────┤   FEED RAIL    │
│  ▓▓▓▓▓ ×5 opponent hand              ┌──────────────────────┐  │   320px        │
│  ┌── SAKURA · red ──────────────────┐│ SAKURA        6,100  │  │   PERMANENT    │
│  │ [GY][BAN] │S│S│S│S│S│ [EX][DECK] │└──────────────────────┘  │                │
│  │           │M│M│M│M│M│            │                          │  MOVE  Kojikocy│
│  └───────────────────────────────────┘                         │  SUMMON Raiza  │
│  ═ DP·SP·▮M1▮·BP·M2·EP ══ Normal Summon: not yet used ══[End Turn]│ ATTACK ...   │
│  ┌── YOU · blue ────────────────────┐                          │  ─ since you ─ │
│  │           │M│M│M│M│M│            │                          │  ...           │
│  │ [GY][BAN] │S│S│S│S│S│ [EX][DECK] │┌──────────────────────┐  │                │
│  └───────────────────────────────────┘│ YOU           8,000  │  │                │
│  ┌─────────── DOCK BAND · 132px RESERVED ──────────────────┐   │                │
│  │  intent line / receipt / delta / question / waiting     │   │                │
│  └─────────────────────────────────────────────────────────┘   │                │
│   🂠 🂠 🂠 🂠 🂠  your hand · 96px RESERVED                      │                │
└───────────────────────────────────────────────────────────────┴────────────────┘
   ↑ 266px permanent left gutter — the inspector floats there, never reflows the board
```

**Two structural changes from the approved design, both of them fixes for observed breaks.**

**(a) The dock band is a LAID-OUT ROW, not an overlay.** ZUH-118 break 3: the shipped panel is
`position: fixed; bottom: 0; maxHeight: 40vh` and grows upward over the hand the moment it has
content, so `document.elementFromPoint` at the centre of every hand card returns
`DIV[action-panel]`. A band that participates in layout **has no mechanism to grow over
anything**. Requirement B3 stops being a rule anyone has to remember. *Driven in the prototype:
`elementFromPoint` over every hand card, every phase button, End Turn, Resign and both dock verbs
in the chain scenario → 0 failures.*

**(b) The feed rail is PERMANENT and 320px wide.** ZUH-118 break 11: the on-demand rail overlaid
the right 320px and covered the clock and `End Turn`. The previous design's rule was "it overlays,
it must never reflow the board" — reserving the width satisfies both halves by construction, since
the board's width never changes. It also gives dead time (half the duel, needs model M10)
something to be, and gives the delta somewhere to expand into. The cost is 320px of board width;
at 1440 the board occupies 1120 and the two 5-slot rows need ~330.

**Deleted deliberately:** the clock panel and all four urgency bands · the verbosity chip ·
Extra Monster Zones, Pendulum Zones, Link markers (Edison has none).

---

## 1 · Board / Field

**Job:** tell the player the whole game state at a glance, and be the thing they act on.

**Contents.** Two mirrored field groups, owner-outlined (yours blue, theirs red). Each occupied
slot renders **art, and a name, and ATK/DEF** — the name is not conditional on the art. Position
glyph for face-down/defence. Pile badges with counts, permanently placed.

**Entry:** always. **Exit:** none — it is the screen.

| State | Trigger | What the player sees | What they can do | Motion in | Motion out |
|---|---|---|---|---|---|
| loading | before first `STATE` | slots at 30%, no cards, dock reads the seating line | Exit | fade `--m-narrate` | fade `--m-base` |
| default (armed) | `IdleCommand`/`BattleCommand` held | full colour, your field blue | click a card → verb chips | — | — |
| off-clock | `CONTROL` names the other seat | your field desaturates; **nothing is clickable and nothing produces an error** | inspect anything | desaturate `--m-base` | `--m-base` |
| dimmed | a question is up | scrim at 60%; **candidates and only candidates lifted above it** | click a candidate → selects it; click anything else → inspector | scrim fade `--m-base` | `--m-base` |
| candidate | card is named by the pending decision | owner-coloured 2px outline + shadow, raised above the scrim | click to select | outline `--m-quick` | `--m-quick` |
| selected | the player picked it | accent outline; the confirm label names it | click again to deselect | `--m-quick` | `--m-quick` |
| zone-pick | `SelectZone` is live | legal empty zones glow blue with their slot number | click one | glow loop 1.2s | `--m-base` |
| affords-nothing | clicked a card with no legal verb | **200 ms shake, and no text at all** | nothing | `--m-base` shake | — |
| card arriving | the player's answer named a zone | the card appears in that zone | — | `--m-settle` | — |
| art loading | image in flight | the tile's **name and ATK are already readable**; art fades in over them | everything | `--m-quick` fade-in | — |
| art failed / deadline (4 s) | `onError`, or no load in 4 s | **no image, no broken glyph** — the tile is exactly what it was before art existed | everything, unchanged | — | — |
| empty zone | slot null | dashed owner-tinted outline | nothing (armed) / drop target (zone-pick) | — | — |
| empty pile | count 0 | badge rendered flat with `0`, never hidden | click opens the pile's empty state | — | — |
| disconnected | socket closed | board frozen at 60%, dock says `Reconnecting…` | Exit | `--m-base` | `--m-base` |
| duel-ended | `DUEL_END` | frozen at full colour behind the end card, still inspectable | dismiss the card to review | — | — |

**Deliberate:** the board is **never** replaced by a spinner after the first snapshot.

**The `zone-pick` glow loops for as long as the player takes.** A real decision was **measured at
25.75 s** (ZUH-139), so the 1.2 s loop runs **~21 times**, not three. **No change is requested** —
there is no evidence it becomes irritating — but nobody should specify it, review it or test it on the
assumption that it runs a handful of times. (`09-pacing-application.md` B4.)

---

## 2 · Verb chips (ACT mode)

**Job:** form an intent and fire it in two clicks, seeing only legal verbs.

`IdleCommand` and `BattleCommand` are **never rendered as a question panel** — cleared and carried
forward. They arm the board; their `summons[]`, `activates[]`, `attacks[]` become the legal-verb
source. Chips absent from the legal set are **not rendered**, never greyed.

A tribute-requiring summon reads **`Normal Summon — tribute`, with no count.** The count is not on
the wire at idle time (CTO, verified live, 2026-08-07; ND-1 withdrawn) and the screen does not
invent one. It appears at the tribute step, from `SelectTribute.min`/`max`.

**Entry:** click a card you control while armed. **Exit:** pick a chip · `Esc` · click away · a
decision arrives.

| State | Trigger | Sees | Motion in | Motion out |
|---|---|---|---|---|
| default | ≥1 legal verb | 1–5 chips, a `✕`, and `Esc closes — costs nothing` | `--m-quick` scale-in at the card | `--m-quick` |
| dismissed | `Esc` · background click · re-click the same card · `✕` | cluster gone, **nothing sent**, board unchanged | — | `--m-quick` |
| empty | no legal verb | **no cluster; 200 ms shake on the card; no sentence** | — | — |
| disabled | off-clock, or a question is up | cluster does not open; click opens the inspector | — | — |

**Dismissal — normative, because the cluster advertises it in writing.** The cluster closes on
`Esc`, on a background click, on a re-click of the same card, and on its own `✕`. A control that
states a capability the product does not have is the same class of defect as the screen asserting
a cause the engine never gave, and the independent pass found the cluster advertising `Esc closes —
costs nothing` with no key handler reachable anywhere in the app.

**THE KEYBOARD CONTRACT — normative.** *No keyboard event may submit or commit a decision.*
`Escape` dismisses the verb cluster, then the inspector, then takes **the player's own cancel**
where one exists. It does **not** answer an OFFER: declining a chain window is a substantive game
answer with consequences, not an escape — which is exactly the distinction the classification law
draws. On the previous prototype `Escape` *committed* an irreversible tribute step and destroyed a
card the player never chose.

**D1/D2, and PRD change 5.** `"This monster has already attacked."` is deleted and **nothing
replaces it.** The screen never states why an action is unavailable. A monster that has already
declared simply stops being offered the verb.

---

## 3 · Dock band — the answer surface

**Job:** carry everything the engine or the client needs to say, in one reserved place, without
ever covering the hand.

Six mutually exclusive contents. One height (`--dock-h`).

### 3.1 Question

Three parts: a **sentence**, a **selection line**, and **two verbs**.

**The instruction line names the zones the candidates actually occupy** — `in your hand`, `on the
board`, or `in your hand or on the board`, chosen at render time from the candidate set. One string
was previously used everywhere and was verbatim right in the tribute and attack steps and verbatim
wrong in the chain window and the discard, where every candidate is in the hand.

**Candidates are picked WHERE THEY LIVE.** The dim law lifts every candidate — hand, field, pile
badge — out of the scrim, so a target set spanning three locations is legible in one glance and
the dock does not draw the same card twice. The only candidates the dock renders itself are
those with no tile on the board: cards inside a pile.

**Line 1 always names a subject, and its degradation is STATED.** The previous design never said
what line 1 degrades to when context is unavailable, and what shipped was the bare string
`Chain a card or effect?`. The ladder is:

1. `context.caption` — the engine's own hint (MH-3 / MH-3b);
2. else `context.activatingCard` — `"Book of Moon" was activated.`;
3. else — `Something happened that you may respond to.` + a caption-weight second line reading
   `The engine did not say what.` **Never a bare verb, and never a fabricated cause.**

| State | Trigger | Sees | What they can do | Motion in | Motion out |
|---|---|---|---|---|---|
| default | decision presented | sentence, selection line, two verbs | answer | slide+fade `--m-base` | `--m-base` |
| partial | multi-select below `min` | confirm disabled, `n of m selected` | keep selecting | `--m-instant` | — |
| chosen | ≥ `min` selected | **confirm names the chosen card(s)** | confirm | `--m-instant` | — |
| commit-adjacent | the NEXT step has no cancel | confirm reads `… — after this you cannot cancel` | confirm / cancel | `--m-instant` | — |
| non-cancelable | this step has no cancel | left slot is the flat statement `This step cannot be cancelled`, **not a button** | confirm only | — | — |
| empty candidates | a variant arrives with none | sentence + decline only | decline | `--m-base` | `--m-base` |
| error | server rejected the answer | the same question re-renders with an amber one-line strip | re-answer | `--m-quick` | **none — it persists until the question is re-answered or the question changes** |
| gap | answer sent, next frame not in | replaced by the `resolving` waiting content (§3.4) | wait | `--m-gap` | — |

**A QUESTION NEVER EXPIRES, AND NEITHER DOES A REJECTION. Normative, from ZUH-131 B4 and B2.**
**Measured, not inferred** (ZUH-139 upgraded this from a 5-second-sampled guess): one dialog —
`Select the card(s) to add from your Deck to your hand.` — was open **continuously for 25.75 s**
across 103 consecutive frames at 4 fps, the player browsing inside it, and it ended when **they**
selected. No timeout, no countdown, no auto-answer, no fade. It is not an upper bound; it is the
longest one that happens to fall inside a supplied window. So:

- **No question surface has a timeout, a countdown, an auto-answer-on-expiry or a fade.** There is
  nothing to remove — the design never had one — but it was never stated as a rule, and the rule is
  what stops one arriving later as a "safety net".
- **The band holds one question for at least a minute with no visual decay.** No pulse that becomes
  irritating, no shimmer that loops forty times. §3.4's 1.6 s pulse belongs to the *waiting* readings
  and stays off questions. ⚠️ **This requirement is kept but NOT measured** — no single question in the
  footage lasts a minute. What does is a **turn**: the longest is 100 s, so a question sitting through
  most of one is plausible. Keep the rule; do not cite a measurement for it.
- **The `error` line has no timer** (it exited after 8 s). A player who has just been rejected is
  entering exactly the 25.75 s re-deciding window above; a line they may not have read must not
  remove itself. Recovery for "I did not read it" is "read it again", as it is for the delta strip.
  ⚠️ **This one is an INFERENCE and is doubly unverified.** **No answer is rejected anywhere in 980
  dense frames** — no error strip, no refusal, no re-ask — so the behaviour has never been observed in
  the reference client; and it has **no surface in our prototype either** (a dead `error` field, no
  renderer, no scenario). Its premise (the 25.75 s dwell) is measured; the surface is not. It must not
  be promoted to an observation.

### 3.2 Intent line

**Job:** make 2–6 engine decisions read as one action the player started, and say where the exit
stops existing. Sits above whatever else the dock holds.

Three renderings, all plain text, no glyph needing a legend:

```
Tribute Summoning "Caius the Shadow Monarch"        [ Cancel tribute summon ]
Tribute Summoning "Caius the Shadow Monarch"          COMMITTED
```

**No step budget, no step dots, no lock glyph.** Deleted — needs model gap 15: the budget was a
client-side guess printed in the same register as an engine fact. What remains is one boolean
("does a non-cancelable step come next") used for the confirm-label warning, and one control.

| State | Trigger | Sees | Motion in | Motion out |
|---|---|---|---|---|
| live | intent in flight, current step cancelable | verb + card + `Cancel <verb>` | `--m-base` | `--m-base` |
| committed | current step has no cancel | `COMMITTED` replaces the button | crossfade `--m-base` | — |
| across the gap | between sub-decisions | **nothing unmounts** — the line persists unchanged | — | — |
| cancelled | player pressed cancel | fades with the board returning to armed | — | `--m-narrate` |
| absent | no intent | not rendered (not an empty box) | — | — |

**Cessation:** response sent and control does not stay mine · player cancels · `DUEL_END` · socket
drop (not restored on reconnect — stated degradation ND-2).

### 3.3 Auto-answer receipt — *told*, not *asked*

**Job:** say that a decision with exactly one legal answer was answered, without asking anything.

One slim row, accent-ruled: `ANSWERED FOR YOU · Attack Mobius the Frost Monarch`.
No primary button, no imperative copy, past tense. There is **no "ask me next time"** link,
because there is no setting for it to flip — the verbosity levels are deleted and the
classification law is not a preference.

| State | Trigger | Sees | Motion in | Motion out |
|---|---|---|---|---|
| default | client answered a single-answer decision | the row, naming what it did | fade `--m-base` | **none — it persists (no timer)** |
| stacked | two auto-answers in a row | both rows, oldest on top | as above | staggered |
| superseded | **a question takes the band** | receipt clears, question takes the band | — | `--m-instant` |
| spent | **the player's next action** · control leaves me · `DUEL_END` | gone | — | `--m-instant` |

> **THE RECEIPT HAS NO TIMER — ZUH-131 B1, upheld by ZUH-139 on better reasoning. A behaviour change,
> not a retuned number.** It faded after `--m-receipt` (2.4 s); that token is **deleted**.
>
> **Why, in the form that survives.** The reference client's timings are **bimodal with an empty
> valley**: reflexive prompts live **0.25–1.5 s** (four measured at 4 fps) and deliberative surfaces
> live **25–30 s+** (one dialog measured at 25.75 s; a 30.00 s think with no board change at all).
> **A 2.4 s artefact does no work in either mode** — in the fast mode a question supersedes it inside
> ~1 s and the timer never fires; in the slow mode the player is elsewhere for half a minute and it is
> long gone before they look back. It was itself a 240× correction of the shipped build's **10 ms**
> (ZUH-118 break 19), and still not enough.
>
> ⚠️ **Withdrawn, and it must not come back:** the argument that *"the reference product does not fade
> this information out — it blocks until the player acknowledges it"*. That rested on reading the 07:55
> `● Draw 1 card.` dialog as this client's auto-answer receipt; at 4 fps it is a **question** titled
> `Use which effect?`. **Nothing in 980 dense frames is an auto-answer receipt**, so the footage carries
> no reference precedent for this surface at all. **And there is no measured floor: do not print "≥10 s"
> as a figure** — nothing anywhere measures a receipt lifetime.
>
> This is the rule §3.5 already applies to the delta strip, so it is **consistency, not novelty**:
> *it never auto-fades, and recovery for "I did not read it" is "read it again".*
>
> ⚠️ **The board re-arming is not a supersession.** The client answers a step for you and control
> comes straight back with `IdleCommand`/`BattleCommand` — a decision, but not a question panel. If
> that cleared the receipt it would vanish *faster* than the timer it replaced. Only a **question**
> supersedes it. See `09-pacing-application.md` B1, and
> `spikes/duel-redo-proto/src/proto/questionTakesTheBand.ts`, where the test is isolated in one file.

### 3.4 Waiting — three readings that must never look alike

| Reading | Condition | Copy | Motion |
|---|---|---|---|
| opponent is deciding | `CONTROL` names them, presence OK | red pulse + `Sakura is deciding` | pulse 1.6 s loop |
| engine is resolving | `CONTROL` names me, no decision held | accent pulse + `Resolving…` | pulse 1.6 s loop |
| my connection dropped | socket closed | amber pulse + `Reconnecting…` | pulse 1.6 s loop |
| opponent is gone | presence lost | **nothing here** — §3.6 owns the truth | — |

The last row is the rule that "one statement at a time" is enforced by: the shipped screen said
`THEIRS` at the top, offered plays in the middle and errored at you when you took one.

**No string in this design names a component.** `Waiting for engine…` is gone.

### 3.5 While you were away — the delta

**Job:** rebuild an accurate picture of the game before spending anything. Needs model M3, gap 3,
~12–20 hits per duel, and the teardown says no client in the reference set ships it.

```
[4] things happened while it was theirs           [ Show ]  [ Dismiss ]
```
Expanded, it lists the rows and simultaneously marks the feed rail with a
`— since you last acted —` rule, so the transcript and the delta are the same object seen twice.

| State | Trigger | Sees | Motion in | Motion out |
|---|---|---|---|---|
| unread | control returns and ≥1 event arrived | the strip, blue-ruled | `--m-narrate` slide | — |
| expanded | `Show` | the rows | `--m-base` | `--m-base` |
| empty | control returns, nothing happened | **not rendered** | — | — |
| dismissed / spent | player dismisses, or takes their first action | gone, feed mark stays | — | `--m-base` |

**It never auto-fades.** Recovery for "I did not read it" is "read it again".
**Cessation of the STRIP:** first action this turn · dismiss · control leaves me · `DUEL_END`.

**The strip and the mark have DIFFERENT lifetimes, and that is the point of having both.** The strip is
the transient summary; **the feed rail's `— since you last acted —` mark is the durable boundary** and
survives every one of the strip's cessations — dismissal, the player's first action, the duel's end.
It is **replaced** when control returns again, and only then. (Written down because it was not: the
mark had no row in `01 §7`'s persistence audit, and the prototype had borrowed its lifetime from the
strip's, so `Dismiss` silently deleted the transcript's record of where the player last acted. ZUH-145.)

**Build it for the traffic it actually gets — and the traffic was wrong in BOTH directions.** ZUH-131 B5
said this surface is met 13–15 times a game, every ~30 s, describing ~30 s of activity: "a handful of
rows, not a session log". ZUH-139's turn-badge timeline measures the whole match and **corrects both
halves**:

| | ZUH-131 B5 | **ZUH-139 measured** |
|---|---|---|
| turn duration | 30–35 s (n=2) | **median 35 s, mean 44 s, p25–p75 25–65 s, range 10–100 s (n=27)** |
| turns per game | ~13–15 | **12, ≥10, 12 — so each player owns about six** |
| how often the player meets this surface | 13–15× a game | **~6× a game, at intervals of median ~70 s / mean ~88 s** |
| how much each visit describes | ~30 s of activity | **up to 100 s** |

**So it is a low-traffic, deep surface, not a high-traffic, shallow one — and that inverts what matters
about it.** Three consequences, and the third is a refusal:

1. **Recoverability, not glanceability, is the requirement.** A surface met six times a game after
   ~70–88 s away is not something the player learns by repetition; each visit is most of what they know
   about a turn they did not watch. Losing it to an accidental first click costs far more than B5's
   numbers implied.
2. **Therefore the feed rail is the reading surface and the strip is the notification.** The strip is
   cleared by the player's own first action, which on a real turn arrives within seconds; **the
   permanent rail and its `— since you last acted —` mark are the only part that survives, and they are
   what can hold 100 s of opponent activity** — 320 px wide, full height, scrollable, marked at exactly
   the boundary. Under B5's old numbers the mark was a nice-to-have. Under these it is the half that
   does the work, which is why it being absent from every build was a defect and not a detail
   (ZUH-141/ZUH-145).
3. **No row budget is specified, because nobody has measured one.** Neither study counted *events per
   opponent turn* — they counted seconds, and the same evidence shows those seconds are mostly
   **thinking**: a 30.00 s own-turn think with **zero** board change, and 25.75 s of one 100 s turn
   spent inside a single dialog. **Rows scale with what the opponent DID, not with how long they took.**
   The one measurement we have is our own: `fixtures/s07-opponent-turn.json` is one complete recorded
   opponent turn from our own engine — 28 events, 18 after the `HINT` filter, and **5 rendered delta
   rows**. **What would settle it is in-house and cheap**: count relayed `EVENTS` per opponent turn
   across the 3,008-frame capture the fixtures were cut from. Until then the design says the surface
   must not *assume* a handful, and must not break if a turn is unusually busy.

**If the clock ever comes back** (it is deleted), the typical turn is **35 s median and 100 s at the
top**, not ~30 s — and the first turn of a game is an outlier at **≤10 s** (twice). Any per-handover
allowance built around a single figure would be wrong at both ends. Recorded, not proposed.

### 3.6 Opponent has left — and the route out

**Job:** with the clock deleted, this is the ending timeout-forfeit used to provide (PRD C1/C2).

```
Sakura lost connection. Waiting for them to come back.
Sakura lost connection. They have not come back.        [ Claim the duel ]
```

**No duration is displayed anywhere and no countdown exists on screen.** The grace period is a
server fact (ND-10); the player's route out is a control they press.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| away | presence lost | banner, no button; the dock says nothing else | `--m-base` |
| claimable | grace elapsed (server) | banner + `Claim the duel` | button `--m-base` |
| returned | presence restored | banner gone, normal waiting resumes | `--m-base` |

### 3.7 Seating

**Job:** the first ten seconds, which the previous design had no surface for at all (needs model
M1, gap 9). `You vs Sakura` · `You go first.` — read from `STATE.currentTurn` on the first
snapshot, so **no delta is needed for turn order**; only the opponent's name is (ND-11).

**Cessation is an engine event, not a timer — ZUH-131 B6.** The seating statement is replaced when the
first `DECISION` arms the board. **No timer may be added to dismiss it**, and there is no minimum or
maximum duration to hit: how long it is on screen is how long the engine takes. *(The prototype's
1.4 s is a replay stand-in for that frame arriving, not a designed beat.)*

**One thing the study raises here that this design does NOT take.** The reference client spends **~20 s
of read-only screens between games** and states turn order **full-screen, on its own, before the board
exists** (P7); the study reads F1's dock line as *the right content in the wrong register*
**[INFERENCE]**. Making seating a screen of its own is a new surface rather than a duration, it rests
on an inference from another client, and it collides with **held** usability finding F-18. **It is
recorded as an open decision for the CEO in `09-pacing-application.md` B6, not decided here.**

---

## 4 · Phase rail + turn resource + End Turn

**Job:** show the phase, advance it, and end the turn — from a place that can never vanish.

The rail is both display and control. `End Turn` lives at its right end. Nothing overlays it,
because the feed rail no longer overlays anything.

**Turn resource line — new.** `Normal Summon · not yet used` / `· spent`. Derived from the **event
feed** (a `SUMMON` event for my seat in this turn number), not from the absence of an option.
Absence is not a statement; an event is. This is not a cause claim and does not touch D1/D2.

**The current-phase marker is read from `STATE.currentPhase`, never inferred.** It was previously
derived from the kind of decision being held, so an attack-target question — a `SelectCard`, not a
`BattleCommand` — silently moved the marker to Main Phase 1 while the player was declaring an
attack. A question does not change the board, so a question cannot move the marker.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| default | armed | current phase filled, legal phases outlined, illegal ones flat and disabled | `--m-quick` |
| question open | any decision held that is not `IdleCommand`/`BattleCommand` | **the marker does not move**; every phase button is disabled | — |
| off-clock | not my control | every button disabled, `End Turn` disabled — **and no click produces `not your turn`** | `--m-base` |
| resource spent | own `SUMMON` event this turn | `spent`, struck through | `--m-instant` |
| turn boundary | `turnNumber` changes | resource resets to `not yet used` | `--m-instant` |

---

## 5 · Feed rail (permanent)

**Job:** "what just happened" — game state, not teaching. It is also what fills dead time and what
the delta expands into.

**Structural, never prose:** `SUMMON · Raiza the Storm Monarch · hand → field`. Never "Bob
summoned Raiza". Names tinted by owner; **every name resolved through `mySeat`**, never a
seat-indexed array (ZUH-118 breaks 9, 10, 25 are all that one defect).

A `MOVE` row names the **slot** it came from, not only the card. Two copies of one card leave an
identical board, so without the slot the feed cannot record which one moved — **the answer-outcome
enumeration reported exactly that as a collision, and this is the fix.**

| State | Trigger | Sees | Motion |
|---|---|---|---|
| empty, turn 1 | duel just started | `The duel has not started.` | — |
| empty, turn > 1 | joined or reconnected mid-duel | `Earlier turns are not available.` — never "the duel has not started" | — |
| default | events exist | grouped rows, newest at the bottom, auto-scrolled | row slide-in `--m-base` |
| delta-marked | control just returned — **not** the strip being expanded | `— since you last acted —` rule above the first new row; **it survives the strip's dismissal and the duel's end, and is replaced only by the next handover** (§3.5) | `--m-narrate` |
| partial | reconnected, no backfill | dashed `— feed resumes here —` above the first post-reconnect row | — |
| unrecognised event | unknown `kind` | the row renders the kind verbatim; the rail keeps going | — |
| duel-ended | `DUEL_END` | final row `Duel ended — {reason}` | `--m-narrate` |

---

## 6 · Card inspector

**Job:** answer "what does this card do" in zero clicks when it matters, one click otherwise.
Floats in the permanent left gutter; **never reflows the board and never occludes a control.**

The acceptance criterion the previous design was missing, and the seam the implementation fell
through: **the panel shows the card the player touched.** ZUH-118 breaks 6/7 are one hard-coded
`0` passed as the passcode at three call sites.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| auto-push | a chain link starts resolving; the opponent activates | that card's text, no click | `--m-base` |
| hover | 150 ms over any card | the card | `--m-quick` |
| pinned | explicit click | thin blue rule; auto-push queues behind it | `--m-quick` |
| art loading | image in flight | **all the text already readable**; a placeholder holding 813:1185 | shimmer 1.1 s |
| art failed / 4 s deadline | `onError` or deadline | no image, no placeholder, no broken glyph — the panel is what it was before art | — |
| provenance | card is in the pre-errata corpus **and** art loaded | one clause: `Edison text differs from this printing` | `--m-quick` |
| provenance, art absent | overridden card, art not shown | **no badge** — nothing on screen to differ from | — |
| hidden card | `code === 0` **and the card is not yours** | `Face-down card` + its location | — |
| empty | nothing inspected | **panel absent**, not an empty frame | `--m-quick` |

**A hand card is never "face-down".** ocgcore reports every hand card with `position: 10`
(`FACEDOWN_ATTACK|FACEDOWN_DEFENSE`); those bits are meaningless in the hand. Reading them there
is how the shipped inspector came to say `Face-down card` about a card the player was holding —
and, in the prototype, how a hand card first rendered rotated 90°.

---

## 7 · Pile inspector

**Job:** read GY / banished / deck / extra — **free, instant, silent, never broadcast.** A day-one
win over DuelingBook, which broadcasts `Viewing Deck`.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| default | pile has cards | grid of art tiles, each with its name, newest first | `--m-base` |
| empty | count 0 | `Graveyard is empty`, panel still opens | `--m-base` |
| hidden | opponent deck / extra | `32 cards` + a stack graphic, no contents | `--m-base` |
| answer-space | a candidate lives in this pile | candidates outlined and clickable, others dimmed | `--m-base` |
| disabled | never | inspection is permitted off-clock and after the duel ends | — |

---

## 8 · Chain strip

**Job:** show, unprompted, what is on the chain and what is resolving. Sits directly above the
dock band.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| empty | no chain | absent | — |
| default | ≥1 link | ordinal · thumb · name · owner colour | link in `--m-base` |
| resolving | `CHAIN_SOLVING` | that link outlined; its text auto-pushed to the inspector | `--m-narrate` |
| compressed | ≥5 links | links 1–4 full, 5+ as owner-coloured dots, expanding on hover | `--m-quick` |
| unknown code | link references a code we cannot resolve | `?` + the passcode | — |
| end | `CHAIN_END` | strip clears after `--m-narrate` | `--m-narrate` |

---

## 9 · Top bar

`← Exit` · presence dot + **the opponent's real name** (ND-11) · turn pill tinted by owner ·
`⚙ Settings` · `Resign`.

**Resign is permanently reachable, and that is now load-bearing.** With no clock, a player who
reaches a state the client cannot answer has no timeout to release them. **E1 · Every state of the
screen offers at least one action that ends or advances the duel** — and `Resign` is the
guarantee of last resort. It is a two-step confirm, never a bare one-click on the board.

**Settings contains:** `Reduce motion` only. Everything else the shipped popover offered is gone:
`Response prompts` (deleted by the PRD), `Choose zones` (see 01 §8.1 — under A1 the zone step is
asked), `Self chain` and `Activation order` (never wired; ZUH-118 break 16).

| State | Trigger | Sees | Motion |
|---|---|---|---|
| default | connected | green dot + name | — |
| opponent away | presence lost | amber dot + name; §3.6 carries the sentence | `--m-base` |
| our socket errored | transport error | one-line amber strip under the bar, dismissible, **never a modal** | `--m-quick` in, **no timeout out** — dismissed, or gone when the transport recovers |
| duel ended | `DUEL_END` | `DUEL OVER` pill; Exit and the feed stay live | `--m-base` |

---

## 10 · Duel-end overlay

**Job:** result, cause in game terms, both totals, and a route onward.

```
                    You lose
        Sakura's life points reached 0.
        You 0        Sakura 6,100
  [ Review board ] [ Play Sakura again ] [ Back to Home ]
```

**`Play Sakura again` is new**, and it is the one place I am proposing scope. Edison is played
best-of-three; the product's unit is a duel and the format's unit is a match (needs model gap 14).
The button is drawn because the player will have the moment whether or not we designed it — if the
CEO does not want the scope, it is one control to delete, and its absence should then be a
decision rather than an oversight.

| State | Trigger | Sees | Motion |
|---|---|---|---|
| life points | `reason: "normal"` | `{loser}'s life points reached 0.` | card in `--m-narrate` |
| resign | `reason: "resign"` | `{who} resigned.` | as above |
| abandoned | `reason: "abandoned"` (ND-10) | `{who} left the duel and did not come back.` | as above |
| unknown reason | anything else | `The duel ended.` + the reason string verbatim | as above |
| dismissed | `Review board` | frozen but **fully inspectable** board; a `Duel over — show result` pill top-centre reopens the card | `--m-base` |

**There is no timeout ending.** It is deleted with the clock.

**And nothing between two duels runs on a timer either — ZUH-131 B6.** The reference client spends
**~15–20 s** of read-only screens between games (`VICTORY` → result → turn order → transition →
`DUEL`), so this card is **not a bounce**: it has no exit timer, no countdown, and no auto-advance.
The player leaves it by pressing something, and `Play {opponent} again` lands on the seating statement
(§3.7) with turn order stated **before** the board arms — never straight onto an armed board. See
`03-flows.md` F9 and `09-pacing-application.md` B6.

---

## 11 · States that exist across every surface

| State | Rule |
|---|---|
| loading | The board is never replaced by a spinner after the first snapshot. |
| empty | Every surface has an authored empty state; none of them is a blank rectangle. |
| error | One amber line under the top bar. Never a modal. Never a raw server string — `not your turn` is not shown to anyone, because off-clock nothing is clickable. |
| partial | Named per surface (feed `— feed resumes here —`; multi-select `n of m`). |
| disconnected | Board frozen at 60%, dock says `Reconnecting…`, everything else inert. |
| ended | Board frozen at full colour, still inspectable; every control except review/exit inert. |
