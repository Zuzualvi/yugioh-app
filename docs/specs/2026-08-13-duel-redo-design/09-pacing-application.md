---
linear_project: Duel Experience Redo
---

# 09 · What the pacing evidence did to this design — finding by finding

The design's durations were **authored and unverified** and `02`/`03` asked for ZUH-131's pacing
study to land as new token values. It has landed
(`docs/specs/2026-08-13-duel-pacing/`, read on branch `docs/duel-experience-redo-discovery`). This
file is the response: **every budget B1–B6 answered explicitly, whether or not it changed anything**,
plus the values that are still unverified and what would settle them.

**Read the study's own limits first, because they bound every answer below.** Its source is a
broadcast VOD of **MBT vs Cimoooooo on Master Duel — a commercial client that is not ours**. The
researcher had **frames only** (no audio, no transcript), sampled at **5 seconds**, from an **edited
assembly** whose POV seat changes between games, so every duration is a duration in *VOD time*. What
that instrument measures is **what two competitive players sat through without visible complaint** —
an **upper bound on tolerance**, never a specification of how our screen should feel. A budget that
says "2.4 s is too short" is therefore load-bearing; anything that would read as "and 9 s is right"
is not in the evidence and is not written below.

**A second application pass is expected** (ZUH-139, against higher-density footage). It appends a
new `## Pass 2 · …` section to this file and new rows to the summary table; nothing here needs
restructuring for it, and **all timing still lives in the one token block** in
`spikes/duel-redo-proto/src/styles.css`.

---

## Pass 1 · ZUH-131 · summary

| Budget | Verdict | What changed |
|---|---|---|
| **B1** · `--m-receipt` 2400 ms → delete the timer | **Applied — behaviour change** | The receipt has no lifetime. `--m-receipt` is deleted from the token block. Cessation: superseded by a question · the player's next action · control leaves me · `DUEL_END`. `02 §3.3`, `01 §7`, `03 F4a`, `04 §4.3`, prototype. |
| **B2** · error line's 8 s exit → no timeout | **Applied — behaviour change, spec only** | `02 §3.1` error row and `01 §7` lose the 8 s exit. Extended by the same reasoning to the top-bar transport strip (`02 §9`) — flagged below as an extension, one line to revert. **Not driveable: the error strip has no prototype surface.** |
| **B3** · keep "no escalation after 2 s", add "none before 5 s" | **Applied — one clause, no number invented** | `03`'s gap rule gains "and no escalation may be introduced earlier than 5 s". No token changed. |
| **B4** · no question may ever time out | **Confirmed; made normative** | The design already had no question timeout; it was nowhere stated as a rule. Now stated in `02 §3.1` + `04 Q8`. Nothing in the code changed. |
| **B5** · control returns every ~30–35 s; the delta fires 13–15× a game | **No design change; recorded** | `02 §3.5` gains the frequency and size the surface must be built for. Keeps the delta strip **and** the rail mark, as the budget asks. Driving this found the rail mark **never rendering** — **fixed** (ZUH-141); one thing on the same element is filed not fixed (ZUH-145). |
| **B6** · the between-game beat is ~15–20 s | **Partly applied; the register question escalated, not answered** | `03 F9` gains a normative route requirement (rematch re-enters F1 and states turn order before the board arms; no countdown between duels). Making seating a screen of its own is **not** taken — see B6 below. |

**The five values the study refused to give are unchanged and still unverified.** See
[§ Still authored and unverified](#still-authored-and-unverified). Its refusal to invent them is the
part of the study to preserve hardest.

---

## B1 · The auto-answer receipt has no timer

**Applied, and it is a behaviour change rather than a number change.**

The receipt (`02 §3.3`) told the player that a decision with exactly one legal answer was answered
for them. It faded after `--m-receipt` (2400 ms). The study puts the surrounding rhythm of a real
match at **25–30 s** with a panel present at every 5-second sample (P2, P5), and found the reference
client answering the same moment — "tell the player what just resolved" — with a dialog reading
`● Draw 1 card.` and an `OK` button that **waits for a click** (P11, zoom, high confidence). 2.4 s in
a 25–30 s rhythm is the aggressive end of the spectrum.

**What the design now says**

- The receipt has **no lifetime**. It persists.
- Cessation, in full: **a question takes the dock band** (the state `02 §3.3` already called
  `superseded`) · **the player's next action** · **control leaves me** · **`DUEL_END`**.
- `--m-receipt` is **deleted** from the token block rather than retuned. If a timer is ever
  reinstated, the study's floor is **≥10 s**, and that number is in this paragraph so nobody has to
  rediscover it.

This is the rule the design already applies to the delta strip — *"It never auto-fades. Recovery for
'I did not read it' is 'read it again'"* (`02 §3.5`) — so B1 is **consistency, not novelty**. What
the study adds is that the receipt's 2.4 s was 240× the shipped build's 10 ms and still too short.

**Two things a reader needs to know about the blast radius.**

1. **The board re-arming does NOT supersede a receipt.** Immediately after the client answers a step
   for you, control comes back and `IdleCommand`/`BattleCommand` arms the board — which is a
   decision, but not a question panel. If that cleared the receipt, the receipt would vanish
   *faster* than the timer it replaced. The test is isolated in one file,
   `spikes/duel-redo-proto/src/proto/questionTakesTheBand.ts`.
2. **It overlaps held usability finding F-17**, which measured the receipt at 2.44 s and proposed
   *either* keeping it until the player's next action *or* tagging the corresponding rail row as
   `auto`. B1 lands the first of those two. **I have not touched `08-usability-findings.md`** — the
   held list is held — but the CEO re-ranking F-17 should know that its first option is now the
   design, and that **its second option (an `auto` tag surviving in the history rail) is untouched
   and still open**.

## B2 · The error line does not time out

**Applied in the spec. It cannot be driven, and here is why.**

`02 §3.1`'s `error` row — the amber one-line strip that appears when the server rejects an answer —
exited after **8 s**. A player who has just been rejected is entering the same 25–30 s re-deciding
window B1 rests on, so the line **persists until the question is re-answered or the question
changes**. `01 §7`'s persistence audit row changes with it. No token is involved; 8 s was a number in
prose.

⚠️ **The error strip does not exist in the prototype.** `useDuel.ts` carries an `error` field and a
`setError` setter that **nothing renders and nothing calls**, no scenario models a rejected answer,
and a DOM query for an error strip in the built file returns **0 nodes**. So there was no timer to
delete in code, and **no observation of this change is possible in this build**. It is a spec change
only, and it should be read as one.

**One extension I made and am flagging because the study did not ask for it.** `02 §9`'s top-bar
transport-error strip also exited after 8 s. Its cessation is now *dismissed · the transport
recovers* rather than a timer, on B2's reasoning: an unread error that removes itself is the defect,
and this strip is already dismissible so the player has a real exit. It is one line in `02 §9` and
one line to revert if the CEO disagrees.

## B3 · Keep the no-escalation rule; do not add one earlier than 5 s

**Applied as one clause. No number invented.**

`03`'s gap rule said: *"If the gap exceeds 2 s, the same reading persists; there is no second
escalation and no clock."* The study confirms the rule is safe — ~8% of live play in the reference
client is a full-width banner or full-screen flash, and both game-ending damage sequences ran **≥5 s**
across two consecutive samples (P3, P9), with nothing in the frames showing either player treating
multi-second resolution as a stall. It then **refuses** to say how long a `Resolving…` reading may
sit before it reads as a hang.

So the rule keeps its shape and gains its floor: **no escalation may be introduced earlier than
5 s**, because below that any threshold would be invented. Above 5 s there is still no number and
this design does not supply one.

*Observed, not assumed:* the one waiting reading reachable in the prototype (`Sakura is deciding`,
after `End Turn`) is a single reading with a 1.6 s `breathe` pulse loop; its text and its animation
are identical at +0.3 s, +0.9 s and +2.0 s. There is no second-escalation code path to remove.

## B4 · No question may ever time out — and 30 s open is normal

**Confirmed. Nothing changed in the code; the rule is now stated, which it was not.**

The study observed three spans of **25–30 s** with a panel present at every sample, one of them
simultaneously the most static stretch of the match with a card-selection list open (P2, P5), and
concludes that a question sitting open for 30 s is ordinary. Its design consequences are now
normative in `02 §3.1`:

- **No question surface has a timeout, a countdown, an auto-answer-on-expiry, or a fade.**
- **The dock band holds one question for at least a minute with no visual decay** — no pulse that
  becomes irritating, no shimmer that loops 40 times. The 1.6 s pulse belongs to the *waiting*
  readings (`02 §3.4`) and stays off questions.
- The `zone-pick` glow loop of 1.2 s (`02 §1`) will run **~25 times** through a 30-second decision.
  The study has no evidence it is annoying and **requests no change**; it is flagged in `02 §1` so
  nobody assumes it runs three times.

*Driven in the built file:* the chain window was left open for **65 s**. Sentence, both control
labels, the disabled state of confirm, the panel's opacity and the (empty) set of looping animations
inside it are **byte-identical** before and after, and clicking a candidate at +65 s still selects it
and still names it on the confirm. The one looping animation in the answer space is the zone-pick
glow, `glow 1.2s infinite`, as designed.

## B5 · The delta is a high-traffic surface: 13–15 times a game, every ~30 s

**No design change. The numbers are recorded where the surface is specified.**

Two turns in the match are measurable — 30 s and 35 s (P4) — which at ~32 s a turn puts **≈13–15
turns in each of the three observed games**. The study is explicit that two turns is not a
distribution, and so is `02 §3.5` now. What follows for the design:

- the delta describes **~30 s of opponent activity**, met **13–15 times a game** — *a handful of
  rows, not a session log*;
- **keep both** the strip and the feed rail's `— since you last acted —` mark; the budget's reading
  is that the rail mark does the load-bearing work, because on a 30-second turn the player's first
  action often comes within a few seconds of control returning and takes the strip with it;
- **if the clock ever returns** (it is deleted), the observed typical turn is **~30 s** — the number
  any per-handover allowance would have to be built around. Recorded, not proposed.

*Not observed, and one thing that had to be fixed before this budget could be true.* The prototype's
handover scenario offers no legal verb after control returns, so **"the strip clears on the player's
first action" (DL2) was not driveable** in this build and I am not claiming it works. And when I drove
this budget, **the feed rail's `— since you last acted —` mark did not render at all** — the half B5
calls load-bearing was absent from every build. **Fixed** (ZUH-141): the mark was a property of a row
and is now a **boundary between rows** owned by the rail, anchored to the first row at or after the
boundary that actually draws. Two mechanisms were killing it, and the one that fired is the second:
the mark's index was in events-space while the rail renders rows-space (which
`withBattleResults` inserts battle-result rows into), **and** `FeedRow` returned `null` for an
undescribable event before rendering the mark — and the recorded opponent turn begins with a `PHASE`
event. Its boundary is also no longer derived from `feed.length - delta.length`, which drifted one row
per event appended after the delta landed.

*And on the same element, also fixed:* the mark **disappeared on `Dismiss`**, where §3.5 says *"gone,
feed mark stays"* — its lifetime was borrowed from the strip's. **ZUH-145.** The mark now has its own
state, set at control return and never unset with the strip, and its lifetime is written down in two
places it was missing from: `01 §7`'s persistence audit (which had no row for it at all) and `02 §7`'s
`delta-marked` row. **The strip is the transient summary; the mark is the durable boundary.**

Also note the prototype compresses a whole opponent turn into **2.6 s** — a review convenience so
nobody waits half a minute at a desaturated board, now commented as such in `useDuel.ts`. **No pacing
decision should be read out of that number.**

## B6 · The between-game beat — route applied, register escalated

**Partly applied. The part I did not take is named here rather than left implied.**

The study reads one complete game boundary: `VICTORY` → result frame → **`You are Going Second.`** as
a full-screen statement → transition → `DUEL`, spanning **~20 s in which the player reads and does
nothing** (P7, high confidence for that boundary; the other boundary shows none of it and may be a
cut). Two consequences, and they are not equally well founded.

**Applied — the route, which is a rule and costs nothing.** `03 F9` now states that
`Play {opponent} again` **re-enters F1 and states turn order before the board arms**; it never returns
the player to an armed board directly. And **there is no countdown, no auto-advance and no
auto-dismiss anywhere between two duels** — the player leaves the end card by pressing something. The
design was already built this way; it was not written down as a requirement, and "not an instant
bounce" is exactly the thing an implementation would quietly get wrong.

*Driven:* the end card is still on screen, unchanged, **12 s** after it appears (it has no exit
timer), and `Play Sakura again` lands on the seating statement with the board not yet armed.

**Not applied — the register.** The study's remark that F1's `You go first.` *"is the right content
in the wrong register"* is marked **[INFERENCE]**, and turning it into a full-screen pre-duel
statement is a new surface, not a duration. Three reasons I am not taking it here:

1. it is an inference from a **different client's** between-game sequence, and the study's own README
   says its durations bound *tolerance*, not our design;
2. it collides with **held** usability finding **F-18** (the seating banner lasts 1.4 s and is
   unrecoverable), which is deliberately being kept for the CEO's own re-ranking — implementing half
   of it now would destroy that;
3. the honest version of "give it a beat" in our design is **not a duration at all**: the seating
   statement is replaced when the engine's first `DECISION` arms the board, and no timer is involved.
   `02 §3.7` now says that, and says that **no timer may be added to dismiss it**.

**So the open question, stated for the CEO and not answered by me:** should seating be a screen of its
own that states turn order before the board exists, as the reference client does? It is worth ranking
next to F-18. The prototype's 1.4 s is a **replay stand-in** for that first `DECISION` frame — not a
designed beat — and is now commented as such in `useDuel.ts`.

---

## Still authored and unverified

<a id="still-authored-and-unverified"></a>

The study gives **no number** for any of these, and says why: the sampled set is 5 seconds and even a
full-density window is 250 ms a frame, so a 90 ms transition is one frame or none. **The absence of a
number is not permission to keep the authored value silently — it is unverified.**

| Value | Now | Status | What would settle it |
|---|---|---|---|
| `--m-instant` | 90 ms | **Authored, unverified.** Below the instrument's resolution. | A build and a stopwatch, or a capture of **our own** client. |
| `--m-quick` | 140 ms | **Authored, unverified.** Same. | Same. |
| `--m-base` | 200 ms | **Authored, unverified.** Same. | Same. |
| `--m-settle` | 320 ms | **Authored, unverified.** Below resolution even at 4 fps. | Same. |
| hover → inspector | 150 ms | **Authored, unverified.** The study explicitly refuses a number. | Same. |
| `--m-narrate` | 600 ms | **No number given.** ~107 s of banner time across three games divided by a banner count the study could not establish. | The study's window `04:00–04:45` at 4 fps: a banner spanning *k* frames is *k*×250 ms. |
| `--m-gap` | 260 ms | **No number given** for "how long between committing an action and seeing its consequence". | Windows `07:50–08:35` and `25:35–26:20` at 4 fps. |
| 1.6 s waiting pulse · 1.2 s zone glow | unchanged | Loop periods, not lifetimes. No evidence either way; **no change requested** (B4). | A human looking at a built screen. |

Both of the last two rows in the "no number given" group have a **named window that settles them**;
neither window had arrived when the study was written. That is a cheap ask, not a research project.

---

## What was driven, and what was only edited

Temporal claims are the class a designer cannot verify by reading their own diff, so this is split
explicitly. Everything in the first list was observed in the **built reviewable file**
(`spikes/duel-redo-proto/review/duel-redo-prototype.html`) opened from `file://` in headless
Chromium at 1440×900.

**Observed**

- **B1 · the receipt persists.** Scenario *4a*, pressed the `Attack` verb chip. The receipt reads
  `ANSWERED FOR YOU · Attack their face-down monster, Monster 1` and is present and textually
  unchanged at **+1 s, +2 s, +2.5 s, +3 s, +5 s, +10 s, +20 s, +40 s and +62 s**. On the same build
  before the change it was **gone between +3 s and +5 s**, consistent with the 2.4 s timer.
- **B1 · the player's next action clears it.** With the receipt on screen at +62 s, pressing
  `End Turn` removed it (count 1 → 0).
- **B4 · a question does not decay.** Scenario *5*, chain window left open **65 s**: identical
  sentence, labels, disabled state, opacity, and no looping animation inside the panel; still
  answerable afterwards.
- **B3 · one waiting reading, no escalation.** `Sakura is deciding` with a `breathe 1.6s infinite`
  pulse, identical at +0.3 s / +0.9 s / +2.0 s.
- **B6 · the end card has no exit timer** (present at +12 s) and `Play Sakura again` re-enters
  seating.
- **B2 · there is no error strip in the built file** (0 matching nodes) — which is the evidence that
  B2 could not be driven.
- **B5 · the feed rail's delta mark, after fixing it** (ZUH-141). First handover: one mark node,
  immediately above `TURN 4` — the first *drawing* row of the recorded opponent turn, whose own first
  event is a `PHASE` that draws nothing. Pressing `End Turn` again grows the feed and the row below the
  mark is **unchanged**, so the boundary does not drift. Second handover, with the recorded delta
  replayed: **a battle-result row now precedes the mark** — the state where the events-space /
  rows-space divergence bites — and the mark sits above the *second* replay's `TURN 4`, not the first.
  The same probe found **0** mark nodes before the fix.
- **B5 · the mark's own lifetime** (ZUH-145), all seven states driven in one session: absent at load
  (no handover yet) · created at control return, above the first drawing row · unmoved by `Show` ·
  **survives `Dismiss`** (strip 1→0 nodes, mark stays at 1, same boundary) · unmoved by the player's
  own next action although the feed grew · **replaced** at the second handover, with a battle-result
  row above it · **survives `DUEL_END`** (resign: overlay up, mark still at the same boundary) · absent
  again in a fresh scenario and in scenarios with no handover.

**Edited but NOT observed**

- **B1 · the `superseded` branch.** "A question takes the band clears the receipt" is implemented
  (`questionTakesTheBand.ts`, two call sites) and **is not reachable in this prototype**: the only
  auto-answer path is *4a*, and no question follows it. Worth knowing that the `superseded` state
  `02 §3.3` has always specified was **never implemented at all** before this change — the 2.4 s
  timer was the receipt's only exit.
- **B1 · `control leaves me` and `DUEL_END` cessation.** Added at three call sites; not separately
  driven with a receipt on screen.
- **B2** in its entirety, for the reason above.
- **B5 ·** the delta strip's clear-on-first-action, for the reason above.

---
---

# Pass 2 · ZUH-139 · the dense-footage re-test

`docs/specs/2026-08-13-duel-pacing-dense/` — six 4 fps windows (980 frames) and eleven native-1080p
turn-badge sheets, against the same VOD. **It re-tests B1–B6 and it does not agree with Pass 1
everywhere.** Where the two conflict, ZUH-139 wins on the facts it measures directly and Pass 1's
sections above are left standing as the record of what was applied when — the design text itself is
corrected in place, per finding, below.

**Its own limits, which bound every answer here.** The VOD is a **two-feed multicam edit of both
players' clients** switching ~34 times, so a duration crossing a cut carries ±0.5 s; **the editor
follows the turn player**, so the off-turn player's screen — where the interrupt lives — is never on
screen; the **game-1 boundary is a hard editorial cut** with the whole between-game sequence and at
least one turn removed; there is **no cursor in any frame** and the client's own phase controls are
under a facecam, so **no click is directly observable**; and it is still four minutes of a performed,
commentated match with no audio. Every duration remains an **upper bound on what a player tolerates**.

## Pass 2 · summary

| Budget | Verdict | What it did here |
|---|---|---|
| **B1** | **Conclusion survives; one argument WITHDRAWN and replaced** | The receipt still has no timer. But "the reference product waits for you" is deleted from `02 §3.3` — the dialog it rested on is a **question**, not a receipt — and replaced by the **bimodal-valley** argument. "≥10 s" is struck as a measured figure. Prototype comment corrected too. |
| **B2** | **Change stands; its STATUS is corrected** | Now labelled an **inference** in `02 §3.1` and `04 Q9`: no answer is rejected in 980 frames, and it has no prototype surface either. **Doubly unverified**, stated in both places. |
| **B3** | **Confirmed, with measured beats** | `03`'s gap rule swaps "≥5 s sampled" for 2.00 / 2.25 s damage bands, ≈6.5 / ≈6.75 s to a result screen, 3.0 / 4.25 s chain exchanges, ≈2.0 s answer→consequence with ~1.5 s of visible nothing. Still **no number** above 5 s. |
| **B4** | **Confirmed; inference → measurement, with the number corrected** | **25.75 s, one dialog, 103 frames**, not "30 s". `02 §3.1` and `04 Q8` now say so, and the ≥1-minute requirement is explicitly **kept but not measured**. Zone glow ~21×, not ~25×. |
| **B5** | 🔴 **WRONG TWICE — the design-changing one. `02 §3.5` rewritten, `07 §3a` added** | ~6 visits a game at ~70–88 s, each up to 100 s. The surface is **low-traffic and deep**, not high-traffic and shallow. My judgement is below. |
| **B6** | **Change stands; the evidence is weaker than it read** | **n = 1**, and the second instance was destroyed by an editorial cut. `03 F9` now says so, and adds the measured **≈6.5 s** front and the **blocking `OK`** on the result screen. |
| **`--m-narrate`** | **New: 600 ms is inside the observed register** | Adopted at **two boundaries, medium confidence**, in `03`, `07 §4` and the token comment. The register, not the value. |
| **M4 / M11** | **Two needs-model contradictions land on my flows** | `03 F10`'s "probe constantly" is falsified where testable; `03 F5` gains the measured **~1 s** response budget. Both below. |

## B5 · What the corrected load does to the delta surface — my judgement

**The load was wrong by 2–3× in both directions at once**: met **~6 times a game** rather than 13–15,
at intervals of **median ~70 s / mean ~88 s** rather than 30–35 s, each visit describing **up to 100 s**
of opponent activity rather than ~30 s. ZUH-131's instruction — *a handful of rows, not a session log* —
was written for the opposite shape of problem. My answer is in three parts, and one of them is a refusal.

**1 · The frequency correction changes the surface's ROLE, and the design absorbs that — because of the
half it already had.** A surface met six times a game after ~70–88 s away is not learned by repetition
and is not glanceable furniture: each visit is most of what the player knows about a turn they did not
watch. So **recoverability**, not glanceability, is the requirement — and the design's answer to
recoverability already exists and is now the load-bearing half: **the strip is the notification, the
permanent 320 px rail and its `— since you last acted —` mark are the reading surface.** The strip is
cleared by the player's own first action, which on a real turn arrives within seconds of control
returning; the rail is what survives, and it is the only surface on the screen that can hold 100 s of
anything. **This is also the honest answer to "does the rail earn its 320 px": under Pass 1's numbers the
mark was a nice-to-have, and under these it is the mechanism.** Which is exactly why the mark never
rendering (ZUH-141) and then vanishing on `Dismiss` (ZUH-145) were defects rather than details — both
fixed and driven before this pass.

**2 · The depth correction does NOT convert into a row count, and I will not invent one.** Neither study
counted **events per opponent turn**; both counted seconds. And the same footage shows why seconds do not
convert: a **30.00 s** own-turn think with **zero** board change, and **25.75 s** of the single longest
turn (100 s) spent inside one dialog. **Rows scale with what the opponent DID, not with how long they
took.** The one measurement anyone has is **ours**: `fixtures/s07-opponent-turn.json` is one complete
recorded opponent turn from our own engine — 28 events, 18 after the `HINT` filter, **5 rendered delta
rows**, from 11.9 s of captured wire time. **What would settle it is in-house and cheap: count relayed
`EVENTS` per opponent turn across the 3,008-frame capture the fixtures were cut from.** Until then the
design states the size it must survive rather than the size it expects, which is the change made to
`02 §3.5`.

**3 · What I drove rather than reasoned, because a claim about a container is testable.** The dock band's
height is **reserved** (`--dock-h`), and a deep delta is exactly the thing that reproduced ZUH-118
break 3 last time. Driven in the built file at delta sizes **10, 20 and 40 rows**: the band measures
**132 px** at every size, its scroll never grows, the hand's top stays at 798 px and `elementFromPoint`
over every hand card returns **0 occlusions**. **The layout contract survives the corrected load by
construction.** The same probe found the thing I did **not** fix: expanded, the list is **~42 px tall and
scrolls with 2 of its 5 rows visible** — at the *recorded* delta size, before any of this. Filed as
**ZUH-148** and reported, not fixed, because the remedy is a flex/height change inside the reserved band
and the presentation layer (ZUH-120) owns that; changing shrink behaviour in the band that requirement B3
depends on is not a change to make in passing.

**What I did not do:** resize, group, paginate or scroll the delta's content, or move `Show` to point at
the rail. Each is a real option (ZUH-139's own `[INFERENCE]` suggests scrollable-or-grouped), each is a
surface decision rather than an application of a measurement, and the row count that would justify one is
the number nobody has measured. **The design now says what the surface must survive; it does not claim a
size.**

## B1 · The conclusion stands. The argument under it does not

`02 §3.3`'s blockquote cited *"the reference product does not fade this information out — it blocks until
the player acknowledges it"*, from ZUH-131 P11's reading of a `● Draw 1 card.` + `OK` dialog as the
reference client's auto-answer receipt. **At 4 fps that dialog is titled `Use which effect?` and carries a
two-segment step indicator: it is a question with one legal option, not a receipt.** Nothing in 980 dense
frames is an auto-answer receipt at all, so **this footage carries no reference precedent for the
surface** and that sentence is gone from the spec and from my own comment in `useDuel.ts`.

**What replaces it is stronger.** The client's timings are **bimodal with an empty valley**: reflexive
prompts live **0.25–1.5 s** (four measured, one with the click visible), deliberative surfaces live
**25–30 s+** (25.75 s dialog; 30.00 s think). **A 2.4 s artefact does no work in either mode** —
superseded inside ~1 s in the fast mode, long gone before the player looks back in the slow one. And
**"≥10 s" is struck as a measured floor**: nothing in either study measures a receipt lifetime, so if a
timer is ever mandatory the evidence supplies no value for it.

*A precedent that cuts the other way, recorded not resolved:* **the reference client, faced with exactly
one legal answer, asks anyway and requires a click** — where our classification law answers it and shows a
receipt. That is a PRD A1/A2 question, already on the escalation list at `01 §8.1`, and it is not mine to
reopen. Its step indicator (`1` of `2`) is also the thing our design deliberately deleted as *"a
client-side guess printed next to an engine fact"* — **that deletion still holds**, because the reference
client prints a count its engine knows and ours would be guessing.

## B2 · The change stands; it is an inference and is now labelled one

No answer is rejected anywhere in 980 frames — no error strip, no refusal, no re-ask. B2's **premise**
(the 25–30 s re-deciding dwell) is now measured, so the reasoning is stronger than it was; the
**behaviour** has never been observed. Combined with my own Pass 1 finding that the strip has **no
surface in the prototype** — a dead `error` field, no renderer, no scenario — this requirement is
**unverified twice over**, and `02 §3.1` and `04 Q9` both say so in those words.

## B3 · Confirmed, with beats to cite instead of inference

The gap rule keeps its shape and its floor and now cites measurements: damage bands **2.00 s / 2.25 s**;
lethal flash → result screen **≈6.5 s / ≈6.75 s**; chain exchanges **3.0 s / 4.25 s**; answer → visible
consequence **≈2.0 s, of which ~1.5 s shows nothing happening**. Neither player reacts to any of it. **The
number above 5 s is still refused**, and the 30 s static stretch is **the player** being slow and knowing
it — it is not a tolerance measurement and `03` now says so explicitly, because it is exactly the figure
someone would misquote.

## B4 · Confirmed; the inference is now a measurement and the number moved

**25.75 s, one dialog, 103 consecutive frames, ended by the player's own selection** — replacing "30 s
from 5-second sampling". `02 §3.1` and `04 Q8` carry the measurement; the **hold-for-a-minute requirement
is kept and explicitly not measured**, since no observed question lasts a minute (what lasts longer than a
minute is a *turn*, at 100 s). The zone-pick glow runs **~21 times** through the measured decision, not
~25 — still flagged, still no change requested.

## B6 · The change stands; the number under it is n = 1 and provably so

The rematch requirement in `03 F9` never depended on the 20 s — it is "no timer, and re-enter F1 before
the board arms" — so it stands unchanged. What changes is how the evidence may be quoted: **n = 1**, with
the second instance destroyed by an editorial cut rather than missed by the instrument. Two measured
additions support the same rule: the **≈6.5 s** front of the beat (twice, agreeing), and a result screen
that **blocks on `OK`** rather than auto-advancing — which is the reference client doing exactly what
`02 §10` and `03 F9` now require of the end card.

## `--m-narrate` · the one value that gained corroboration

A `TURN CHANGE` banner is on screen **~1 s** (partial sweep → ~0.5 s at full width → ghost → gone), the
`DRAW PHASE` banner after it is gone within **0.5 s**, and the whole `END PHASE → TURN CHANGE → DRAW`
handover runs **≈2.5 s**. **600 ms is inside that register for a single narration beat.** Adopted at the
confidence it was given — **two boundaries, medium** — in `03`, `07 §4` and the token comment, and stated
as corroboration of the **register** rather than a measurement of the value. **The token is unchanged.**

## The two needs-model contradictions that land on my flows

**M4 · "fluent players probe constantly" is falsified where it could be tested**, and `03 F10` keeps its
shape anyway. 30.00 s of a competitive player's own Main Phase 1 with **not one visible probe** — no
card-text panel appearing or disappearing, nothing highlighting — and the researcher's own caveat that no
cursor is visible, so the honest form is *"no inspection this client would have rendered, for 30 s"*.
**Every consequence of F10 is correct whether probing happens fifty times a turn or twice** (probing costs
nothing; `Esc` closes; the inspector is free and never broadcast; a card that affords nothing shakes and
says nothing) — the cost of over-serving it is zero and the cost of charging for a probe is unbounded, so
**a flow whose value does not depend on its frequency is not resized by a frequency finding.** What is
weakened is the *argument* — "its frequency is invisible" was doing work as a reason to prioritise it, and
it must not be quoted as high-traffic. Backing out (M7) was never observed at all: untested.

**M11 · a response prompt is answered in ~1 s, not "a few seconds"** — four measured, one with the click
visible. `03 F5` now carries that budget, and the consequence is a **priority** claim rather than a design
change: the two things in that surface that force a **second fixation** are the stated
`The engine did not say what.` fallback (**MH-3b**) and a candidate the engine redacted from its own owner,
rendered `your set card 1` (**ND-9**). In a one-second decision those are on the critical path. Neither is
new; both now matter more.

**V9 · the first turn of a game is ≤10 s, twice** — nothing in this design budgets an opening turn, so
nothing changes; recorded so that nobody later builds a per-turn allowance around a single median.

## 🔴 Still authored and unverified, after two studies

**Unchanged and unweakened:** `--m-instant` 90 ms · `--m-quick` 140 ms · `--m-base` 200 ms ·
`--m-settle` 320 ms · the **150 ms** hover threshold. **4 fps is 250 ms per frame**, so a 90 ms transition
is at most one frame and usually zero; a four-times-denser instrument that is still 250 ms does not reach
them. **`--m-gap` 260 ms** likewise has no measurement — what is measured is that the gap it fills is real
(≈2.0 s answer → consequence, ~1.5 s of it visibly empty). **And there is still no number for how long a
`Resolving…` reading may sit before it reads as a hang.**

**Do not let the arrival of numbers elsewhere make these blanks look like oversights.** They are the
part of both studies to preserve hardest. What settles them is unchanged and is not more footage: **a
build and a stopwatch, or a capture of our own client.**

## Pass 2 · what was driven, and what was only edited

**Observed** in the built reviewable file from `file://` (headless Chromium 1440×900), after the Pass 2
edits and a rebuild:

- **B5 · the container under the corrected load.** Delta cloned to **10, 20 and 40** rendered rows: dock
  band **132 px** at every size, never scrolling; hand top **798 px**; `elementFromPoint` over every hand
  card → **0 occlusions**. And at the **recorded** size of 5 rows: expanded list **42 px**, scrolling,
  **2 rows visible** (ZUH-148).
- **B5 · the rail is the surviving half.** Re-driven end to end after the edits: mark at the right
  boundary, surviving `Dismiss`, surviving the player's next action, replaced at the next handover with a
  battle-result row above it, surviving `DUEL_END`.
- **B1 / B3 / B4 / B6 regressions**, all unchanged by this pass: receipt still present at **+62 s** and
  cleared by the player's next action; chain question **byte-identical after 65 s** and still answerable;
  end card alive at **+12 s**; `Play Sakura again` re-enters seating; `answer-matrix.py` 5 points / 19
  answers / **0 collisions / 0 label failures**.
- **The row-count input**, read from our own recorded fixture rather than from the VOD: 28 events → 18
  after `HINT` → **5 delta rows** for one complete opponent turn.

**Edited but NOT observed**

- **Every ZUH-139 number itself.** I did not read the footage; I applied a published study. Its
  measurements are its own, with its own confidence labels, and I have quoted them with those labels
  attached rather than flattening them.
- **B2**, still, for the same two reasons as Pass 1 — no rejection in the footage and no surface in the
  prototype.
- **`--m-narrate`.** Nothing about our own client's narration beat was measured here; the token is
  unchanged and its status moved from "no number" to "register corroborated, medium confidence".
- **The delta's clear-on-first-action (DL2).** Still not driveable: the handover scenario offers no legal
  verb when control returns.

---

## Pass 2 · closing items — ZUH-148 and ZUH-147, fixed after the pass

Both were **filed, not fixed**, during the pass above. The Product Lead's call was to fix them before the
build goes to review, on a rule worth writing down: **a defect inside the thing the CEO is being asked to
judge is never held.** He is being asked whether the feed rail earns its 320 px; a delta surface that
silently truncates, and a criterion that contradicts the build, would both make his answer describe
something other than the design.

### ZUH-148 · the expanded delta list showed 2 of its 5 rows

**What was wrong.** Expanded, `[data-testid=delta-list]` measured **42 px** and showed **2 of 5 rows** —
at the *recorded* delta size, before any of ZUH-139's corrections — scrolling with nothing to say it
scrolled.

**Why it could not be fixed by making the list taller.** The dock band's **132 px is reserved** and may
never grow: that is requirement **B3**, the structural fix for ZUH-118 break 3 (a `position: fixed`
panel that grew over the hand until `elementFromPoint` returned the panel for every hand card). Measured
rather than assumed: the band's children at that moment are `deltastrip: 41` + `deltalist: 42` +
`quiet: 25` and the band is **exactly full**. Freeing the list's own `max-height` cap changed **nothing**
(the cap is 100 px and was never the binding constraint — flex shrink was). **There was no spare space to
give it.**

**What actually changed, and it is content, not CSS.** While the delta is expanded, the dock's armed hint
`Your move — click a card, or use the phase rail.` does not render. **One statement at a time** (`02 §3.4`)
— the player who pressed `Show` is reading the delta, the hint is redundant in that moment (the board is
armed, the phase rail is on screen and `End Turn` is in it), and its **32 px is the only space that
exists**. A **question is never** suppressed this way; only the armed hint. `02 §3.5` and contract **DL7**
carry the rule.

**On the ownership constraint, precisely, because it was overridden deliberately.** The Product Lead
authorised a targeted fix inside ZUH-120's surface under the never-hold rule, and **ZUH-120 may revise
it**. In the event **no stylesheet change was needed at all** — not one line of `styles.css` was touched —
so the override was not spent: the space was funded by a **component decision in `Dock.tsx`**, which is
this design's own. Recorded so that "the Product Lead let someone edit the stylesheet" cannot become a
precedent from a change that did not do it.

**Driven, and the B3 check re-run because a change inside the reserved band is exactly what could
un-establish it:**

| State | Band | List | Rows visible | Controls occluded |
|---|---|---|---|---|
| collapsed (unread) | **132 px**, no scroll | — | — | **0 of 14** |
| expanded, recorded size | **132 px**, no scroll | **74 px** (was 42) | **4 of 5** (was 2 of 5) | **0 of 14** |
| expanded, cloned to 10 rows | **132 px**, no scroll | 74 px | 4, scrolls | **0 of 14** |
| expanded, cloned to 20 rows | **132 px**, no scroll | 74 px | 4, scrolls | **0 of 14** |
| expanded, cloned to 40 rows | **132 px**, no scroll | 74 px | 4, scrolls | **0 of 14** |
| collapsed again | **132 px** | — | hint **returns** | **0 of 14** |

The 14 controls are every hand card, both legal phase buttons, `End Turn`, `Resign` and both delta
buttons, each checked with `elementFromPoint` at its own centre. The hand's top stays at **798 px** in
every row of that table. **Break 3 still cannot recur.** And anything deeper than the band can hold still
scrolls, with the rail holding all of it — which is the division of labour B5 above settles on.

### ZUH-147 · DL3 said the mark appears on expand

Corrected as an **appended** entry at `04 §4.4a`, with DL3's original wording left exactly as written and
a pointer added to it. The mark appears **when control returns**; expanding the strip neither creates nor
moves it, which `02 §7`, `03` F7 and the build all already agreed on. A criterion reworded in place by
whoever is nearest is worse than one that is visibly wrong, so the original conclusion is not rewritten —
the same rule the ADRs run on.

### The follow-up this chain is NOT allowed to start

B5 above names what would settle the delta's row count: **count relayed `EVENTS` per opponent turn across
the 3,008-frame capture the fixtures were cut from.** It is in-house, cheap, and **it waits until after
the CEO has reviewed** — filed as ZUH-149. The CEO's own condition: *"if 139 spins off a follow-up the way
131 spun off 139, that one waits until after I've looked — otherwise this chains forever and I never see
it."* **No one on this pass counted them.**
