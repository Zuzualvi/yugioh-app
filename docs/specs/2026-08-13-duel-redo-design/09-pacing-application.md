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

*Still open on the same element, filed not fixed:* the mark **disappears on `Dismiss`**, where §3.5
says *"gone, feed mark stays"* — its lifetime is borrowed from the delta's. **ZUH-145.**

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
  The same probe found **0** mark nodes before the fix. **Not fixed:** it still disappears on
  `Dismiss` (ZUH-145).

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
