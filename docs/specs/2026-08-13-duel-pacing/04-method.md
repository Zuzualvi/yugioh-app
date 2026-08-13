---
linear_project: Duel Experience Redo
---

# 04 · Method — what I ran, what I validated it against, what it conflates

## What I read as images

**Thirteen contact sheets** — `sheets/sheet_00.jpg` … `sheet_12.jpg`, 1280×790 each, 5×5 cells, one
cell per 5 seconds of the VOD, timestamp printed under every cell. Each cell is therefore
**≈256×148 px**, which is the resolution limit on everything I read that way: banners and full-screen
statements are legible, four-digit life-point values are marginal, card names are not.

**Then two composited zoom reads, late in the task, covering five frames** — `07-55-0`, `14-00-0`,
`04-15-0`, `08-35-0`, `22-10-0`. I cropped the regions I wanted at 3–5×, pasted them into one labelled
canvas, and read that as a single image, so several regions cost one read. **Fifteen images in total
for the whole task.**

**Those two reads changed the delivery more than the other thirteen did**, which is a method finding in
itself: they **falsified P6** (the "card-text panels at the field edges" are the stream's chat
overlay), produced **P10** (the POV seat changes between games, so the VOD is an edited assembly),
**P11** (the client's effect acknowledgement is a modal that waits, not a fading receipt) and **P12**
(the mat carries a `Turn N` badge), and resolved a guess in **P8** in the negative. **Contact sheets
are a map; a zoom is the only way to know what a small object on the screen actually is.**

**I did not read any frame at native resolution as a whole frame.** The frames supplied in `overview/`
are 640×360 downscales; the ~8 px digits in the turn badge are lost at that scale (P12).


## What I ran over all 321 sampled JPEGs

Three passes, `PIL` + `numpy`, in my own clone. Each produced one number per frame; no frame was read
as an image.

### 1 · Field change per 5-second step
Grayscale → Gaussian blur σ=2 → downscale to 160×90 → **facecams masked** (top-left `y<36, x<45`;
bottom-right `y>54, x>109` in the 160×90 space) → mean absolute difference against the previous
sample. The blur is what makes this work at all: it suppresses the particle and glow animation the
CEO's phash attempt was defeated by, while a card appearing or a banner sweeping across is a
large-area change that survives it.

Play-window distribution (03:20–26:10, 275 samples): median 12.1, p25 6.8, p75 22.9; **15% of steps
below 5.5**. Runs of ≥3 consecutive sub-5.5 steps inside play: **13:45→14:00** and **16:30→16:45**.

**This is not the dedupe the CEO ruled out.** It is not trying to identify distinct states; it is
ranking 5-second intervals by how much changed, and the only claim made from it is "these two spans
are the quietest in the match".

### 2 · Full-width banner / flash detector
Band `y∈[118,225]` of the 640×360 frame → per-row coverage of saturated blue (`B>90, B−R>45, B−G>25`)
and saturated red (`R>110, R−B>55, R−G>45`) → fire if any row exceeds **55% coverage**.

**Validated against 19 banner sightings I had read off the sheets by eye.** It found 15 of them
(recall ~79%), missed 13:25 `DIRECT ATTACK`, 14:55, 15:30 and 21:50 `DRAW PHASE`, and fired on 5 more
— of which 10:35 and 26:10 are the full-screen red damage flashes (true positives of a different
kind) and 09:45, 15:15, 22:00 are frames adjacent to banners I had already logged. Reported total:
**18 banners + 2 flashes by script, plus 4 banners only I saw = 22 of 275 play frames (8.0%)**.

### 3 · Bottom-centre panel detector
Region `y∈[236,330], x∈[150,430]` → fraction of pixels that are dark and desaturated
(`luma<70` and `max−min<50`) → fire above **0.30**.

**The first version of this was wrong and I caught it.** My initial region (`x∈[64,480]`) overlapped
both the bottom-right facecam (dark clothing) and the persistent text blocks at the field edges,
and reported 46% of play — a number that was measuring the wrong thing. The tightened region was
re-validated on **16 hand-labelled positive frames** (all ≥0.33) and **15 hand-labelled negatives**
(12 of them ≤0.20). **Three labelled negatives — 20:45 (0.31), 21:00 (0.28), 21:20 (0.46) — score
above the threshold.** My labels there came from eyeballing 256 px cells and may simply be wrong; I did
not resolve it. Treat the 26.5% figure as **26.5% ± ~3 pp**, with a known handful of ambiguous frames.

**What it conflates, and this is in the finding itself:** a question panel, a card-selection list and
a card-text readout all score alike. The measure is "a text panel is over the bottom centre of the
screen", not "a decision is open". **It does not pick up the stream's chat overlay** — that sits at
roughly x∈[490,640], y∈[177,242], outside this region — which matters because I *did* mistake the chat
overlay for client UI elsewhere (P6, withdrawn).

**Why the 26.5% is trustworthy as a time fraction:** the samples are evenly spaced in time, so the
proportion of samples in a state is an unbiased estimate of the proportion of *time* in that state,
regardless of how long individual episodes lasted. The **count** of episodes (42) is *not* unbiased —
it is a floor, and a weak one, because episodes shorter than ~5 s are mostly missed.

## Two techniques that did not work — recorded so nobody repeats them

1. **OCR of life-point values (tesseract).** The plates are small, overlaid on animated art, and the
   digits are thin. A grid search over crop positions on a frame with known values returned digit
   fragments (`BO00`, `cas00`) and no reliable read. **Abandoned after one attempt.** Consequence:
   there is no life-point timeline in these findings, and every LP value I mention is a
   low-confidence read of a 256 px cell.
2. **Recovering turn ownership from field-edge tint.** Hypothesis: the active player's field edge is
   tinted (blue for the POV seat, pink/red for the opponent). Measured saturated-cyan coverage in a
   bottom-edge strip and saturated-pink in a top-edge strip for all 321 frames. The cyan signal is
   **on in 210 of 275 play frames (76%)** — it is a persistent UI element, not a turn indicator — and it does not
   flip at the `TURN CHANGE` timestamps. **Abandoned after the second attempt** (the first being the
   change-metric, which also carries no ownership information), and reported as README limit 3 rather
   than pursued with a third technique.
3. **Template-correlating the `Turn N` badge** (found by zoom, P12) across all 321 frames to recover the
   turn number. Adjacent-frame correlation on the badge sub-crop is 0.82 median — dominated by the
   badge's fixed artwork rather than by the ~8 px digit — so it does not separate turns. **Abandoned
   after one attempt**, because the fix is not a better algorithm, it is more pixels: the same crop at
   native 1080p (see P12).

**Consequence of (2) and (3), stated plainly because it limits half the brief:** turn count, turn
duration distribution, and the own-turn / opponent-turn split of everything else in this document are
**not established**. Two turns are bracketed by banners; that is all. P12 says exactly what would fix
it and it is a small delivery, not another window.

## Provenance discipline used throughout

- **[SHEETS]** = I looked at a contact-sheet cell, ≈256×148 px, and describe what is visibly in it.
- **[ZOOM]** = a 3–5× crop of a named frame, read as part of one of the two montages. Highest-fidelity
  evidence in this delivery.
- **[SCRIPT]** = a number from one of the three passes above, over the 321 sampled JPEGs.
- **[4FPS · window]** = a continuous full-density window. **No finding in this delivery carries this
  tag** — the windows were requested mid-task and are listed as pending in `03-timing-budgets.md`.
- **[INFERENCE]** = mine, tagged at every appearance, not once.
- The commentary is **not** a source here: there is no audio in what I was given (README limit 1).
