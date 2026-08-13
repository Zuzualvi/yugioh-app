---
linear_project: Duel Experience Redo
---

# 02 · The six pending moments, measured at 4 fps

Source: *MBT vs Cimoooooo, Edison format, Yu-Gi-Oh Master Duel — YouTube VOD by MBTYGO_ProGrussys,
1080p, 26:40, downloaded 2026-08-12*, dense windows at `docs/reference/duel-pacing-footage/dense/`
(854×480, 4 fps), read on 2026-08-13.

Tags as in `01-validity-and-turns.md`. **Read `01` first**: the VOD cuts between the two players'
own clients ~34 times (V1, V2), so every measurement below names the feed it came from, and durations
that cross a cut carry an extra ±0.5 s (V3).

⚠️ **Every duration is an upper bound from a performed, commentated match** — no audio, so I cannot
tell when a player was talking instead of playing.

🔴 **The one limitation that governs this whole file: the editor follows the TURN PLAYER (V5).** In all
six windows the feed on screen belongs to the player whose turn it is. **I therefore never see the
off-turn player's client during a turn**, which is precisely where M11 lives. What I can see is the
*turn* player's response prompts and the opponent's card activations arriving on the turn player's
screen. Everything below respects that boundary.

---

## M11 · The interrupt — measured where it is visible, refused where it is not

**Window `07-50_08-35`.** Turn context from the badges: this window is the last ~22 s of **game 1
turn 7 (Cimoooooooo's own turn, on Cimoooooooo's feed)** and the first ~22 s of **turn 8 (MBT's own
turn, on MBT's feed)**, with the feed cut at 08:12.50.

### What I measured — four prompts, and none of them sat for "a few seconds"

**[4FPS · 07-50_08-35]. Confidence: high for the durations, high for the text (read at native scale).**

| At | Prompt, as the client words it | On screen | Feed |
|---|---|---|---|
| 07:55.00 → 07:55.75 | **`Use which effect?`** with one radio option `● Draw 1 card.`, an `OK` button, and a **two-segment step indicator with segment `1` filled and segment `2` empty** | 4 frames = **0.75–1.25 s** | Cimoooooooo |
| 07:56.75 | **`"Legacy of Yata-Garasu" is activated. Chain another card or effect?`** with `Cancel` and `Effect Activation` | 1 frame = **0.25–0.75 s** | Cimoooooooo |
| 08:05.75 → 08:06.50 | **`"Bottomless Trap Hole" is activated. Chain another card or effect?`** with `Cancel` and `Effect Activation`; at 08:06.25 the `Cancel` button is **visibly pressed** (yellow fill) | 4 frames = **0.75–1.25 s** | Cimoooooooo |
| 08:19.00 → 08:20.00 | **`Activate/Resolve a card or effect?`** with `Cancel` and `Effect Activation` | 5 frames = **1.00–1.50 s** | MBT |

Bounds are stated as ranges because onset and dismissal each fall inside a 250 ms frame interval.

**So: a response window in this client, put to two competitive players, is answered in about one
second — not "a few seconds".** In one case (08:05.75) I can see the click land, so that figure is
answer time and not merely display time. **[INFERENCE]** all four were declines or single-option
confirmations, and this window was chosen as *the densest prompt cluster in the match*, so these are
the reflexive end of the distribution. A window where a player actually weighed spending a trap would
be longer, and I did not observe one.

**The needs-model claim this bears on:** M11 says the player is *"deciding in a few seconds whether to
spend a trap now or hold it"* and that line 1 must carry the whole story because *"there is no time for
a second fixation"*. **The second half is confirmed harder than the model states it: the observed budget
is ~1 s, not a few seconds.** A surface that needs two fixations does not fit in one second.

### What I refuse to give, and why

- **"Several times per opponent turn" is not testable from this footage.** The editor is on the turn
  player, so I never see the off-turn player's prompt. What I *can* say: **at least two chain-response
  windows occurred inside a 22-second stretch of one turn** (07:56.75 and 08:05.75), which is the first
  actual count this project has and is consistent with "several". For one of the two I cannot establish
  whose window it was — `"Legacy of Yata-Garasu" is activated. Chain another card or effect?` does not
  say who activated it.
- **How long the *off-turn* player's prompt sits before it is answered: unreachable.** Not weakly
  supported — never on screen. It would take a capture of one player's client that does not cut away,
  which this VOD is not.
- **`--m-instant` 90 ms, `--m-quick` 140 ms, `--m-base` 200 ms, `--m-settle` 320 ms, and the 150 ms
  hover threshold: still no numbers.** 4 fps is 250 ms per frame. ZUH-131's refusal stands unchanged
  and this file adds nothing to it.

### P8 is settled in the negative — and P11's reading of the same object is corrected

**[4FPS · 07-50_08-35, native-scale crop of `07-55-0` … `07-55-3` composited without upscaling.
Confidence: high.]**

ZUH-131 P8 flagged a *possible horizontal green progress bar* at 07:55 as maybe a response countdown,
then P11 resolved it as *"the highlight glow on an `OK` button"* in a dialog whose *"whole content is
`● Draw 1 card.` and a single `OK`"*.

At 4 fps and 854×480 I can read the dialog, and both readings need correcting:

1. **It is not a timer.** Confirmed, and now for a stronger reason than "it is a glow": the green
   element is **a two-segment step indicator at the top of the dialog — a filled segment labelled `1`
   and an empty segment labelled `2`** — and it does not change across all four frames the dialog is up.
   A countdown would shrink. **P8's guess is dead.**
2. **It is not a glow on the `OK` button either.** The `OK` button is a separate control lower in the
   dialog with its own thin outline; the bar sits above the option row.
3. **The dialog is not a receipt — it is a question.** Its title is **`Use which effect?`**, and it
   lists one legal option and waits for `OK`. P11 described it as *"the commercial client's equivalent
   of the design's auto-answer receipt"* and built `03-timing-budgets.md` B1's second argument on that.
   **That identification is wrong, and B1's second argument goes with it** (see `03-budgets-retest.md`
   B1). What the dialog actually shows is different and more useful: **the reference client asks a
   question that has exactly one legal answer rather than answering it for the player, and it tells the
   player the play is 2 steps long while doing so.**

---

## M6 · Being asked inside my own play — the count is 1–2, and the client states it

**Windows `07-50_08-35`, `16-20_17-00`. [4FPS]. Confidence: medium-high.**

The model claims **2–5 sub-questions per play**. ZUH-131 had only a lower bound (42 panel episodes at
5 s sampling) that could not test it.

- **One play's step count is stated by the client itself: 2.** The `Use which effect?` dialog at 07:55
  carries a step indicator reading **`1` of `2`** (above). That is an engine-sourced count for that
  play, not my inference.
- **No play inside any of my six windows showed more than 2 steps.** Across four turns and ~4 minutes
  of full-density footage I positively identified four prompts (M11 table) plus one long selection
  dialog (below). **The model's 2–5 is not contradicted, but its upper half has no support here and its
  lower bound is what I observe.**
- **The prompts in a chain are separated by seconds, not milliseconds:** 07:55.00, 07:56.75, 08:05.75
  on one feed — so a "play" spreads its sub-questions across ~10 s of animation, not a rapid burst.

**A finding for the design's auto-resolve register.** The design removes the zone question by default
(`D §15`) and the needs model flags that this contradicts "only where exactly one legal answer exists"
(`D §16B`). **The reference client, faced with exactly one legal answer, asks anyway and requires a
click.** I am recording what it does; the decision is not mine.

---

## M4 · Scanning for a play — 30 seconds of a real think, and NO probing in it

**Window `13-40_14-10`. [4FPS] + [SCRIPT]. Confidence: high for the stillness, medium for what it means.**

Turn context: **game 2 turn 5, MBT's own Main Phase 1, on MBT's feed** (badge reads `Turn 5 / Main 1`
across the whole window). MBT LP 5700, Cimoooooooo LP 8000, six cards in MBT's hand.

**The measurement.** Over all **120 consecutive frames (30.00 s)** the frame-to-frame change of the
board (grayscale → Gaussian blur σ=2 → downscale → facecams masked → mean absolute difference) has
**median 1.23 and maximum 6.22** in the same arbitrary units in which ZUH-131's 5-second play
distribution had median 12.1 and p75 22.9. The two highest frames (14:04.25, 14:06.25) coincide with
the **stream chat** scrolling in the right-hand overlay, not with the board. Four frames read as images
(13:40.00, 13:50.00, 14:00.00, 14:09.75) are **indistinguishable on the board**: same monster, same
hand size, same set card — only the chat text differs.

**So: ≥30 s of a competitive player's own main phase with literally no board change, and the window
does not contain either end of it — the real think is longer than 30 s.** This upgrades ZUH-131 P5's
"20–30 s near-static stretches at 5 s sampling" to a continuous, gap-free measurement.

**The contradiction, and it is with the needs model.** M4 says *"Fluent players probe constantly: click,
read, escape, click the next"* and builds the whole moment on that behaviour. **In the only 30-second
own-turn think available at full density there is not one visible probe.** No card-text panel appears,
none disappears, nothing highlights. I know what a probe looks like on this client because I have
positively identified its card-text readout elsewhere — a `[Trap]`/`[Spell]`/`[Winged Beast/Tuner/Effect]`
panel that appears at the side of the mat (07:53.75–08:07.25 on Cimoooooooo's feed, 08:19.75–08:22.75 on
MBT's, 16:46.50 inside the search dialog). **None of it happens here.**

**What I cannot exclude, stated because it is the whole weight of the finding:** the cursor is never
visible in any frame of any window, so mouse movement that produces no UI response is invisible to me.
The honest form is: **the player made no inspection that this client would have rendered, for 30 s.**
They were looking, not touching. **[INFERENCE]** if that generalises, "probing must cost nothing" is
solving a problem that is real but rarer than the model implies — and the same 30 s is evidence that a
player will sit and stare at a static board without touching anything.

**On the calibration the brief asked for — "how long a status label may sit before it reads as a
hang" — I still refuse to give a number, for the same reason ZUH-131 did.** This 30 s is the *player*
being slow, and the player knows they are the cause. It says nothing about how long they will tolerate
the *client* being slow. What is grounded is the negative, and it is the same negative as B3: nothing
in this footage puts the tolerance limit anywhere near 2 s.

### The other half of M4: what a probe looks like when it does happen

**Window `16-20_17-00`. [4FPS] + [SCRIPT]. Confidence: high.**

Turn context: **game 2 turn 8, Cimoooooooo's own turn** (a 100 s turn — the longest in the match),
Cimoooooooo's feed.

A bottom-centre panel is present in **103 consecutive frames, 16:21.25 → 16:46.75 = 25.75 s**, with no
single frame below threshold. Read at 16:21.50, 16:30.00, 16:36.00 and 16:46.50, it is **one dialog
throughout**: header `Select the card(s) to add from your Deck to your hand.`, a horizontal strip of
card thumbnails with left/right arrows, and a `Select` button that is **greyed at 16:21.50 and
highlighted at 16:46.50** — i.e. the player had chosen something by the end.

Inside those 25.75 s the panel's *content* changes on ~20 separate frames (blurred panel-region
difference > 3.0, bursts of 20–30 against a median of 2.63), separated by quiet stretches of up to 5 s
(16:31.50 → 16:36.75). At 16:46.50 a **card-text readout** for `Blackwing - Gale the Whirlwind` is open
at the side of the mat.

**This settles the question ZUH-131 explicitly left open** — *"I cannot say whether 16:20–16:45 is one
question or four"*. **It is one question, open for 25.75 s, with the player browsing and reading inside
it, ended by the player's own selection.** See `03-budgets-retest.md` B4.

---

## M5 · Committing — click→consequence is not reachable; answer→consequence is ~2 s

**Windows `07-50_08-35`, `25-35_26-20`. [4FPS]. Confidence: medium (n=1 for the interval).**

**What is not reachable, and it is the thing the model's M5 is about.** The player's own click is never
visible: there is no cursor in any frame, and the bottom-right facecam covers the region where this
client puts its phase and confirm controls (ZUH-131 README limit 4, unchanged at 4 fps). **So
"click → consequence" cannot be measured from this footage at any frame rate.** ZUH-131 asked for these
two windows to settle it; they do not settle it, and no window of this VOD could.

**What is reachable: answer → consequence, once.** The 08:05.75 chain prompt gives a complete chain of
observable events on one feed:

| Frame | What is on screen |
|---|---|
| `08-05-3` (08:05.75) | prompt `"Bottomless Trap Hole" is activated. Chain another card or effect?` |
| `08-06-1` (08:06.25) | the same prompt with **`Cancel` visibly pressed** |
| `08-06-3` (08:06.75) | prompt gone, board unchanged |
| `08-08-1` (08:08.25) | **the summoned monster is destroyed** — centre-field explosion, the card is gone from the zone |

**Answer → prompt dismissed: ≤0.5 s. Answer → visible consequence on the board: ≈2.0 s** (08:06.25 →
08:08.25), of which ~1.5 s is after the dialog cleared and shows *nothing happening yet*. **[INFERENCE]**
that 1.5 s of apparent nothing between an answer and its effect is exactly the gap the design's
`Resolving…` reading exists to fill, and the reference client fills it with silence and then a large
animation.

**One observation. Do not treat 2.0 s as a distribution.**

**From `25-35_26-20`, what the client does between a commit and its consequence at the largest scale**
(game 3, turn 12, MBT's feed, the final attack):

| Frame | Elapsed | What is on screen |
|---|---|---|
| `26-09-0` (26:09.00) | 0 | quiet board; MBT 8000, Cimoooooooo 2000 |
| `26-09-2` (26:09.50) | +0.5 s | **full-screen red damage flash, `4100`** |
| `26-12-0` (26:12.00) | +3.0 s | white impact rays; **the opponent's LP plate is still counting down — it reads `1703`** |
| `26-14-2` (26:14.50) | +5.5 s | second full-screen particle beat |
| `26-16-3` (26:16.75) | +7.75 s | **`VICTORY`** with a result line and an **`OK` button** |

**[SCRIPT]** the full-red band lasts **26:09.50 → 26:11.25 = 8 frames = 2.0 s**, and change stays high
until 26:12.75. The same measurement on game 1's ending (`10-20_11-00`): red band **10:34.50 → 10:36.50
= 2.25 s**, `VICTORY` on screen at 10:41.25. **Damage flash → result screen: ≈6.5 s (game 3) and ≈6.75 s
(game 1) — two independent observations that agree.** This replaces ZUH-131 P9's *"≥5 s"* with a
measurement.

⚠️ The vertical yellow `! Final Blow !` strips at the frame edges in 26:07–26:09 are a **broadcast
overlay, not the client** — the same class of mistake as the withdrawn P6. Do not read them as UI.

---

## M8 · Battle — ZUH-131's judgement that it is partly unreachable HOLDS, and here is why

**Window `25-35_26-20`. [4FPS] + [SCRIPT]. Confidence: high for the refusal.**

ZUH-131 judged M8 partly unreachable *in principle* because the model's need — *the comparison, ATK vs
ATK, as a subtraction* — is about information, not pace. **That judgement holds at 4 fps, and 4 fps adds
two specific reasons rather than a verdict:**

1. **No attack-declaration surface is ever visible.** Across the 45 s of this window the bottom-centre
   panel detector fires only at 25:46–25:54 (card activations) and from 26:15.75 (the result screen).
   **There is no dialog, no confirm and no target prompt at the moment of the attack.** Consistent with
   "declaration is not cancelable", but I cannot distinguish "the client asks nothing" from "the client
   asks in the region the facecam covers".
2. **The comparison itself is not on screen anywhere I can see.** ATK values are printed on the tiles
   (`4100`, `1900`, `1800` are legible at 26:07.50); nothing states a subtraction. That matches what
   both the shipped screen and the design do, and it is an *information* observation, not a pace one.

**What 4 fps does add to M8, and it is about the outcome rather than the choice:** the damage beat is
**2.0 s of full-screen red**, the **opponent's life-point plate animates its own countdown for at least
2.5 s after the flash** (`1703` mid-tick at 26:12.00), and the result screen **waits for `OK`**. So the
client spends ~6.5 s narrating the consequence of one attack and then blocks.

**I am not manufacturing a verdict on the model's M8 need. It is untested.**

---

## M9 · Passing the turn — the self-check is still unreachable; the handover beat is now measured

**Windows `04-00_04-45`, `07-50_08-35`. [4FPS] + [SCRIPT]. Confidence: medium-high.**

**Unreachable, as ZUH-131 said, and for a reason 4 fps confirms rather than removes:** the model's M9 need
is the internal self-check *"have I used my Normal Summon?"*, and the phase rail / End Turn control that
would answer it sits under the bottom-right facecam in every frame of every window. **No 4 fps window can
reach it. Untested, not unconfirmed.**

**What is now measured is the handover itself — three banners, ~2.5 s end to end.** From the turn 7 → 8
boundary (`07-50_08-35`, both feeds):

| At | Banner | Feed / colour |
|---|---|---|
| 08:12.25 | `END PHASE` fully swept | Cimoooooooo, **blue** (their own end phase) |
| 08:12.50 | `END PHASE` ~half swept | MBT, **red** (the opponent's end phase) — after the cut |
| 08:13.50 → 08:14.00 | `TURN CHANGE` | MBT, **blue** (their turn beginning) |
| 08:14.50 | `DRAW` | MBT, blue |
| 08:15.00 | clear | — |

**≈2.5 s from `END PHASE` to a clear board on the new turn.** The turn 2 → 3 and turn 3 → 4 boundaries in
`04-00_04-45` agree on the middle element: the `TURN CHANGE` banner is on screen about **1 s** (partial
sweep → ~0.5 s at full width → a visible ghost/fade → gone), and the `DRAW PHASE` banner that follows is
gone within **0.5 s**.

**The banner colour is a per-seat turn-ownership marker** (V5): blue when the phase belongs to the feed's
owner, red when it belongs to the opponent. Observed on four banners across three boundaries.

**What the off-turn player does while the turn passes: still not observable.** The editor cuts to the
incoming turn player at the boundary (V5), so the outgoing player's screen is gone within a frame of the
banner. ZUH-131 asked this window for *"what the off-turn player does"*; **the window cannot answer it,
and the reason is the edit, not the frame rate.**

---

## M2 · Opening hand — NOT REACHED. No supplied window covers a game's opening

**Confidence: high (this is an inventory fact, not a judgement).**

Game openings are at 03:20 (game 1), somewhere inside the excised material after 10:41 (game 2, V4) and
19:15 (game 3). The six supplied windows are 04:00, 07:50, 10:20, 13:40, 16:20 and 25:35. **None of them
contains a game's first 30 seconds.** The `10-20_11-00` window reaches 19 s of game 2 — but that is game
2's *turn 2*, because the editor removed game 2's opening (V4), so it is not the opening-hand moment
either.

**M2 stays exactly where ZUH-131 left it: the instrument does not reach it.** What would reach it is one
dense window over **03:20–03:55** (game 1's opening, uncut) — the same ask ZUH-131 said it would make next
and did not.

## M7 · Backing out — NOT REACHED. No back-out occurs in any window

**Confidence: medium.**

I looked for the signature ZUH-131 named: a dialog that opens and closes with no board change. What I
found instead is four prompts that were **answered** (M11 table) — the `Cancel` press at 08:06.25 is a
*decline on a chain prompt*, which is an answer, not a back-out — and one selection dialog that ended
with `Select` becoming available (16:46.50), which is a commit. **No instance of a player entering
something and leaving it with nothing sent.** Absence in 4 minutes of footage is not evidence that
players do not back out; it is evidence this footage does not show it. **Untested.**
