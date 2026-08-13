---
linear_project: Duel Experience Redo
---

# 01 · Pacing findings

Every finding carries **[SHEETS]** (the thirteen 5×5 contact sheets, 5-second sampling, read at cell
resolution ≈ 256×148 px), **[SCRIPT]** (pixel statistics I computed over all 321 sampled JPEGs — no
images read into context; method and validation in `04-method.md`), or **[4FPS · window]** (a
continuous full-density window). Anything else is marked **[INFERENCE]** every time it appears, not
once.

Source throughout: *MBT vs Cimoooooo, Edison format, Yu-Gi-Oh Master Duel — YouTube VOD by
MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12*.

**Index** (the numbering is chronological in the order I established each finding, not the order they
appear; P6 is withdrawn and says so):

| | |
|---|---|
| P1 | Three-game match; ~22 min of play; one game boundary unexplained |
| P2 | 26.5% of live play has a text panel over the bottom centre |
| P3 | ~8% of live play is a full-width banner or full-screen flash |
| P4 | Two turns measurable, 30 s and 35 s. Not a distribution |
| P5 | Longest near-static stretches are 20–30 s, one with a question open |
| P6 | **WITHDRAWN** — I mistook the stream's chat overlay for the client's UI |
| P7 | The duel-start moment is ~20 s and states turn order in words |
| P8 | No clock identified — recorded as a non-finding |
| P9 | Resolution beats run seconds, not milliseconds |
| P10 | The POV seat changes between games — the VOD is an edited assembly |
| P11 | The client acknowledges a mandatory effect with a modal that waits |
| P12 | The mat has a `Turn N` badge; at 1080p it yields the whole turn timeline |


---

## P1 · The VOD is a three-game match, and only ~22 minutes of it is play

**[SHEETS]** Confidence: **high** for the boundaries listed, **medium** for the two marked ⚠.

| VOD time | What is on screen |
|---|---|
| 00:00–03:15 | Two deck lists in a browser, then facecams only. **No field at all.** |
| 03:20 | First frame with a duel field. |
| 10:35 | Full-screen red damage flash with a large `3800`. |
| 10:40 | Full-screen bright particle flash. |
| 10:45 | Both life-point plates read `8000`, on a field that already has cards on it ⚠ |
| 18:55 | `VICTORY` banner, full width. |
| 19:00 → 19:15 | A result/animation frame → **`You are Going Second.`** stated full-screen → a warp transition → the `DUEL` banner. |
| 26:10 | Full-screen red damage flash with a large `4100`. |
| 26:15 | Full-screen bright flash. |
| 26:20–26:35 | A **lobby/room screen** — "Begin Duel", table entries, an `ENTRY` button, a member count. |
| 26:40 | Facecam only. |

So: **three games** — roughly 03:20→10:35 (7m15s), 10:45→18:55 (8m10s), 19:15→26:10 (6m55s) —
about **22m20s of live play in a 26m40s video**.

⚠ **The 10:35–10:45 transition is the one thing I most want a full-density window for.** The
18:55→19:15 boundary shows a complete between-game sequence (victory → result → turn-order statement
→ transition → `DUEL`) taking about 20 seconds. The 10:35→10:45 boundary shows none of it, and at
10:45 a populated board is already on screen. Either **the VOD is cut there** — in which case VOD
elapsed time is not real elapsed time everywhere and every duration in this document needs re-reading
— or the 5-second sampling landed either side of a 20-second sequence, which the populated board at
10:45 makes hard to believe. **I cannot tell from the sheets, and I have not assumed either.**
`10:20–11:00` at 4 fps settles it.

**Why it matters to the design:** the design's unit is one duel; the observed unit of a sitting is
three. The duel-start moment and the duel-end moment each happened **three times in 26 minutes**, and
the route from a finished duel back to another one against the same person was exercised **twice**.

---

## P2 · A quarter of live play has a text panel over the bottom centre of the screen

**[SCRIPT]** Confidence: **high** for the number, **medium** for what it means.

**73 of 275 sampled play frames = 26.5%** (binomial SE ±2.7 pp) contain a large dark UI panel
occupying the bottom-centre region (x∈[0.23,0.67], y∈[0.66,0.92] of frame). Because the samples are
**evenly spaced in time**, this is an unbiased estimate of the *fraction of duel time* in that state
— it does not depend on how long individual panels last or on how many there were. Of those, **34
(12.4%)** cover more than half the region: the large question / confirmation dialogs rather than the
slimmer selection strips.

**What the detector conflates, stated because it changes the reading:** a question panel, a
card-selection list, and a card-text readout all score the same. All three mean *the player is
reading or answering, not looking at the board* — which is the thing that matters for pacing — but
this number is **not** "26.5% of the duel is spent inside a decision".

**Longest spans with a panel present at every sample** (a panel was there at each 5-second mark; I
**cannot** claim it was the *same* panel, because I cannot see between cells):

| Span | Length |
|---|---|
| 21:05 → 21:35 | 30 s |
| 04:55 → 05:20 | 25 s |
| 16:20 → 16:45 | 25 s |
| 17:30 → 17:40, 11:00 → 11:10, 05:30 → 05:40 | 10 s each |

One more run — **18:55 → 19:10 (15 s)** — is **excluded from that table on purpose**: it is the
`VICTORY` / result / going-second sequence (P7), which is a statement, not a question.

**42 distinct panel episodes** were caught during play. That is a **lower bound** and a weak one: any
episode shorter than ~5 s is likely missed entirely, so the true count is higher — probably much
higher. **Do not quote 42 as a count of decisions.**

---

## P3 · About 8% of live play is a full-width transition banner or a full-screen flash

**[SCRIPT] + [SHEETS]** Confidence: **high** for the number, and it is a fact about *Master Duel*,
not a recommendation.

**22 of 275 play frames (8.0%)** show either a full-width phase/turn banner (`TURN CHANGE`,
`STANDBY PHASE`, `DRAW PHASE`, `MAIN PHASE 1`, `MAIN PHASE 2`, `BATTLE PHASE`, `END PHASE`,
`DIRECT ATTACK`) or a full-screen damage flash. 18 were found by script; 4 more (13:25, 14:55, 15:30,
21:50) I read off the sheets and the script missed, so its recall is ~82%.

Timestamps of the banner sightings: 04:05, 04:10, 04:35, 06:00, 09:40, 09:45, 11:25, 13:25, 14:55,
15:15, 15:30, 15:55, 17:55, 18:30, 19:20, 21:50, 21:55, 22:00, 22:25, 24:20, 24:25, 24:55. Full-screen
damage flashes: 10:35, 26:10.

**The one thing this does *not* say:** whether a banner takes 0.5 s or 2 s. 8% of 1340 s ≈ **107
seconds of banner time across three games**, and dividing that by a banner count would give a
per-banner duration — but the banner count depends on the turn count, which I cannot establish
(README limit 3). The arithmetic is set up in `03-timing-budgets.md` and left unfinished on purpose.

---

## P4 · Two turns are measurable. Both are about half a minute. That is not a distribution

**[SHEETS]** Confidence: **medium** for the two spans, **none** for generalising them.

`TURN CHANGE` was visible at **04:05 and again at 04:35** (sheet 02), and at **24:20 and again at
24:55** (sheet 11). Each pair brackets one complete turn: **30 s and 35 s, ±5 s** from the sampling.

Those are the only two turns in the match whose both ends I can see. **I have no basis for a mean, a
spread, or a claim that a long turn does not exist** — a 3-minute turn would show up in these sheets
as nothing at all, because banners are the only turn markers I can read and they are only caught by
luck at 5-second sampling. **Anyone quoting "a turn is 30 seconds" from this document is quoting two
observations.**

**[INFERENCE]** Arithmetic that is consistent with them, offered as arithmetic and not as a
measurement: at ~32 s a turn, a 7m15s game holds **≈13–14 turns**, which is **≈13–14 handovers per
player per game**. This lands inside the needs model's "~12–20 times per duel" for M3/M10 — see
`02-needs-model-test.md` M3.

---

## P5 · The longest stretches where nothing visibly changes are 20–30 seconds, and a question is open through some of them

**[SCRIPT] + [SHEETS]** Confidence: **medium-high** for the spans; the interpretation is inference.

Per-5-second-step field change during play (blurred, downscaled, facecams masked): median 12.1,
p25 6.8, p75 22.9 (arbitrary units); **15% of steps fall below 5.5**, which is the band where the
board is doing essentially nothing but animating.

Runs of ≥3 consecutive near-static steps — the whole match has only two inside live play:

| Span | Length | What is also on screen |
|---|---|---|
| **13:45 → 14:00** | 20 s | no bottom-centre panel (the text blocks at the right of these frames are the stream's chat overlay, not the client — P6) |
| **16:30 → 16:45** | 20 s | **a card-selection list, present at every sample from 16:20 to 16:45** |

**[INFERENCE]** These are the two best candidates in the match for *a player thinking*, and the
second is thinking **with a question open on screen for at least 25 seconds**. Both facecams are
live and the players are visibly still / leaning / hand-to-face in these cells, which supports the
reading — but body language is my interpretation of a video of someone's face, not evidence of what
they were deciding.

**What I cannot say:** whether 16:20–16:45 is one question or four. Consecutive cells are not
consecutive moments.

---

## P6 · ~~The client narrates the opponent's turn continuously~~ — WITHDRAWN, and here is why

**This finding was written and then falsified by my own follow-up. I am leaving it in, struck
through, because the mistake is instructive and because the withdrawn version may already have been
quoted.**

**What I claimed:** that a large fraction of frames carry *card-text panels at the left and right
field edges*, and that the commercial client therefore answers "what changed while I was away" by
narrating continuously rather than by showing a delta.

**What killed it [ZOOM, high confidence]:** a 2× zoom of the right-hand region of frame `14:00` shows
the text blocks are **live stream chat** — coloured usernames followed by messages ("we have A line",
"Set snow, pass"). They are a **broadcast overlay, not the product.** I had attributed a Twitch/YouTube
chat feed to Master Duel's UI from 256 px contact-sheet cells.

**What survives:** text blocks in the **upper-left** area are a different object and read like genuine
Master Duel card text (e.g. a block beginning `[…Beast Effect] Cannot be Special Summoned…` at 08:35).
I did **not** verify that one at zoom, so I make no claim about it either.

**What remains true regardless:** I saw **no delta-like surface** in 275 sampled play frames, and the
teardown's "no client in the set ships a delta" is unchallenged. The *explanation* I offered for it is
withdrawn. `02-needs-model-test.md` C3 is revised accordingly.

**The general lesson, for anyone else reading this footage:** this is a *broadcast*, and it carries
overlays — two facecams and a live chat feed — that are not the client. Anything read off the edges of
the frame is suspect until it is zoomed.

---

## P10 · The POV seat changes between games — the VOD is edited from more than one capture

**[ZOOM, high confidence for what the plates read; medium for the interpretation]**

At 5× zoom on the life-point plates:

| Frame | Top-right plate | Bottom-left plate |
|---|---|---|
| 07:55 (game 1) | **`MBT` · `LP 3000`** | **`Cimoooooooo` · `6200`** |
| 14:00 (game 2) | **`Cimooooooo` · `LP 8000`** | not captured |

The top-right plate names a **different player in game 1 than in game 2**. Master Duel renders the
local player's own plate on their own side of the mat and the opponent's opposite — that is domain
knowledge, **not** something this footage proves — and the full-screen `You are Going Second.` at 19:05
confirms this is a player's own client rather than a spectator view. On that reading, **the seat the
camera is sitting in changes between games**: game 1 is viewed from Cimoooooooo's side and game 2 from
MBT's. The two facecam overlays also appear in different positions at different points in the video.

**Two consequences, and the second one is the important one:**
1. "What a player does during the opponent's turn" has to be attributed **per game to the right
   person** — it is not one player's experience for 22 minutes.
2. **The VOD is definitely an edited assembly, not a single continuous capture.** That does not by
   itself mean there are cuts *inside* a game, but it removes the assumption that there are none, and
   it makes the unexplained 10:35→10:45 game boundary (P1 ⚠) considerably more likely to be a cut.
   **Every duration in this document is a duration in VOD time.**

---

## P11 · The commercial client acknowledges a mandatory effect with a modal that waits for a click

**[ZOOM, high confidence]** A 3× zoom of the bottom-centre region of frame **07:55** shows a dialog
whose whole content is the sentence **`● Draw 1 card.`** and a single **`OK`** button (the button
carries a green highlight glow — which is what I had guessed might be a response countdown in P8; it
is not).

This is the commercial client's equivalent of the design's **auto-answer receipt** (`02 §3.3`) — and
it is the opposite shape: **it does not fade, it does not decay, it blocks until the player
acknowledges it.** The design's receipt fades after 2.4 s.

I am **not** recommending a modal — a modal per resolution step in a client this players' incumbent
(DuelingBook) never interrupts them in would be its own defect, and this footage is one client. What
it does give is a grounded artefact behind `03-timing-budgets.md` **B1**: the reference product's
answer to "tell the player what just resolved" is **wait for them**, not *2.4 seconds*.

---

## P7 · The duel-start moment exists in the real client, is explicit about turn order, and takes ~20 seconds

**[SHEETS]** Confidence: **high**.

At the 18:55→19:15 boundary the client shows, in order: `VICTORY` (18:55) → a result/animation frame
(19:00) → **`You are Going Second.`** as a full-screen statement (19:05) → a warp transition (19:10)
→ **`DUEL`** (19:15) → first field frame with the mat drawn. The sequence spans **about 20 seconds in
which the player does nothing but read.**

This is the moment the needs model calls M1 and says "the first ten seconds", and which the previous
design "assumed away". The real product **states turn order in words, on its own screen, before the
board exists.** See `02-needs-model-test.md` M1.

---

## P8 · There is no visible clock, and I am not claiming there is no clock

**[SHEETS]** Confidence: **low — this is a non-finding, recorded so nobody upgrades it.**

I did not identify a countdown timer in any sampled frame, and the players are in a private room
(the lobby screen at 26:20 shows table entries and an `ENTRY` button). But I was reading 256×148 px
cells; a small timer element is exactly the sort of thing that resolution loses, and Master Duel's
timer behaviour differs between ranked and room play. **This footage neither supports nor undermines
the design's deletion of the clock.**

**One sub-claim here is now resolved, in the negative.** I had flagged a horizontal green bar in the
07:55 prompt as *possibly* a response-window countdown. A 3× zoom shows it is the **highlight glow on
an `OK` button** in a dialog reading `● Draw 1 card.` (P11). **It is not a timer.**

---

## P12 · The mat carries a "Turn N / phase" badge — the cheapest way to get the whole turn timeline

**[ZOOM, high confidence that the badge exists and what it contains; the numbers themselves are not
reliably readable at the resolution I have.]**

A 5× zoom at a fixed screen position — **x∈[455,545], y∈[125,195] in the 640×360 frames**, i.e.
**x∈[1365,1635], y∈[375,585] at native 1920×1080** — shows a circular badge reading **`Turn N`** over
the current phase (`Main 1`). Present in ordinary play frames at 04:15, 14:00 and 22:10.

**This is the turn counter, at a fixed position, in every frame.** It is the direct answer to the one
thing this footage otherwise cannot give (README limit 3): turn boundaries, turn count per game and the
own-turn / opponent-turn split, for the **whole match**, at ±5 s, with no full-density windows needed.

**Why I could not use it.** The digits are ~8 px tall in the 640-wide frames supplied. I
template-correlated the `Turn N` sub-crop across all 321 frames; adjacent-frame correlation is 0.82
median and is dominated by the badge's fixed artwork rather than the digit, so it does not separate
turns. I stopped there rather than try a third technique.

**The ask that unlocks it, and it is far cheaper than more windows:** the **321 existing 5-second
samples re-exported at native 1080p** — or just the crop `x∈[1360,1640], y∈[370,590]` of each of them at
native resolution. At 3× the current scale the digits are ~24 px tall and mechanically readable. That
one small delivery converts P4 from "two turns, both about half a minute" into a turn-by-turn timeline
for three games.

---

## P9 · Resolution beats in this client run for seconds, not milliseconds

**[SHEETS] + [SCRIPT]** Confidence: **medium**.

The two game-ending damage sequences each occupy **two consecutive samples** — 10:35 (red flash,
`3800`) then 10:40 (particle flash); 26:10 (red flash, `4100`) then 26:15 (bright flash) — so each is
**≥5 s of animation** before the next state. Large circular summon animations appear as single cells
at 12:55 and 17:10; single cells put no lower bound on their length beyond "it was on screen when the
sample landed".

**[INFERENCE]** These players are habituated to multi-second resolution animation and neither of
them appears to be waiting on it in a way the frames show. That bears on how long our own
`Resolving…` reading can sit before it reads as a hang — but it is a statement about *tolerance*,
not a measurement of *the threshold*, and `03-timing-budgets.md` refuses to turn it into a number.
