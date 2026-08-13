---
linear_project: Duel Experience Redo
---

# 04 · Method — exactly what I read, what I computed, and the four things that did not work

Source: *MBT vs Cimoooooo, Edison format, Yu-Gi-Oh Master Duel — YouTube VOD by MBTYGO_ProGrussys,
1080p, 26:40, downloaded 2026-08-12*, supplied as frames on branch `reference/duel-pacing-footage`.
Worked on 2026-08-13 in my own clone of that branch (read-only) with output on
`docs/duel-experience-redo-discovery`.

## Provenance tags, used in every file

- **[4FPS · window]** — I read named frames from that dense window as images. Frames are 854×480 and
  250 ms apart; within a window consecutive frames are consecutive moments.
- **[BADGES · sheet]** — I read that turn-badge montage sheet (1680×1180, 6×5 captioned cells, native
  1080p crops) as supplied.
- **[SCRIPT]** — a number from pixel statistics over frames that were **never read as images**.
- **[INFERENCE]** — mine, marked at every appearance and not only the first.
- No audio, no transcript, no commentary. Nothing here is a player's stated reasoning.

## What I read as images: 25 reads, 75 of the 980 dense frames

**14 composites I built** (dense frames, or native-scale crops of dense frames, tiled onto one labelled
canvas) **plus the 11 badge sheets exactly as supplied.**

| Composite | Frames it carried | What it settled |
|---|---|---|
| 9 frames, 10:34–10:57 | `10-34-2` `10-38-0` `10-41-1` `10-41-2` `10-42-0` `10-45-0` `10-50-2` `10-51-0` `10-57-0` | the game-1 cut (V4) |
| 6 native plate crops | `10-38-0` `10-42-0` `07-55-0` | plate owner changes inside game 1 (V1) |
| 6 native plate crops | `04-04-3` `04-05-1` `04-34-2` `04-35-0` `08-12-0` `08-13-0` | two-feed edit, by name (V1) |
| 8 frames, 04:04–04:06 | `04-04-1` … `04-06-0` | feed alignment across a cut; banner colour (V3, V5) |
| 6 frames, two cuts | `04-34-2/3` `04-35-0` `08-12-1/2/3` | the 0.25–0.5 s feed lag (V3) |
| 2 frames + 2 badge cells | `10-40-0` `10-41-0` | the badge caption offset (V6) |
| 8 frames, 08:04–08:07 | `08-04-0` … `08-07-1` | the Bottomless chain exchange (M11, M5) |
| 8 frames, 07:53–07:57 | `07-53-3` … `07-57-1` | `Use which effect?`, the Yata-Garasu prompt (M11) |
| 4 native crops, 07:55 | `07-55-0/1/2/3` | **P8 killed**: the green bar is a `1`/`2` step indicator |
| 8 frames, 08:18–08:22 | `08-18-3` … `08-22-3` | `Activate/Resolve a card or effect?`, card-text readout (M6) |
| 4 frames, 13:40–14:09 | `13-40-0` `13-50-0` `14-00-0` `14-09-3` | the 30 s think with no probing (M4) |
| 4 frames, 16:21–16:46 | `16-21-2` `16-30-0` `16-36-0` `16-46-2` | one 25.75 s deck-search question (B4) |
| 8 frames, 26:07–26:16 | `26-07-2` … `26-16-3` | the game-end sequence (M5, M8, B6) |
| 6 frames, 08:07–08:15 | `08-07-3` `08-08-1` `08-08-3` `08-13-2` `08-14-2` `08-15-0` | answer→consequence, the handover banners (M5, M9) |

**Every canvas was measured with PIL and asserted ≤1600 px on its long side before I read it** —
largest built was **1560×518**. This is not fussiness: a previous attempt at this brief was killed
outright, with no recovery, by a composite whose dimensions exceeded the platform's 2000 px cap. Crops
were taken at **native scale and never upscaled**; enlarging a crop adds dimensions and no information.
I read no dense frame's moment twice.

## What I computed without reading frames as images

All of it `PIL` + `numpy`, over the 980 dense frames and the 321 `overview/` frames.

### 1 · Per-frame region change (the validated ZUH-131 recipe, at 4 fps)
Grayscale → Gaussian blur σ=2 → downscale → **facecams masked** (top-left, and bottom-right over
roughly x∈[0.68,1.0] y∈[0.62,1.0]) → mean absolute difference against the previous frame. The blur is
what defeats the particle animation. Run per region: whole field, both facecam boxes, the bottom-centre
panel box, the banner band, the turn-badge box.

This is *not* the dedupe the CEO ruled out; it is a per-250 ms change signal used to locate events,
which are then confirmed by reading the handful of frames that bracket them. It works at 4 fps for the
same reason it worked at 5 s: it is a ranking, not a state classifier.

### 2 · Which player's client is on screen — the finding this unlocked
Mean `(B−R)` over the near life-point plate's owner icon (`x∈[0,36], y∈[412,472]` at 854×480;
`x∈[0,27], y∈[309,354]` at 640×360), gated on "a plate is present at all" (bright-pixel fraction in the
name strip > 0.03).

**≈ +13 for Cimoooooooo (blue dragon icon) versus ≈ −13 to −17 for MBT (pale skull icon), with nothing
in between on any frame measured.** Validated against nine plate crops whose names I read as images —
it agrees with all nine. Run over the dense windows (feed segments, cut points) and over all 321
`overview/` frames (**34 feed switches across the match**, V2).

**This is the signal ZUH-131 needed and did not find.** Its README limit 3 was "whose turn it is is not
recoverable"; it tried field-edge tint and per-step field change. The plate *owner* was the answer, and
it only became visible because the 4 fps frames are 854 px wide rather than 640.

### 3 · Cut detection
A cut between the two feeds changes both facecam regions at once, which no in-game animation does.
Requiring **both** facecam mean-absolute-differences above ~45 isolates four unambiguous cuts inside the
windows (04:05.00, 04:34.75, 08:12.50, 10:41.50) and agrees with the plate-owner signal on every one.
At lower thresholds full-screen flashes leak in, so the loose version is a false-positive generator and
I did not use it.

### 4 · Bottom-centre panel presence and content change
Fraction of pixels in `x∈[200,570], y∈[315,440]` that are dark **and** desaturated (`luma<70`,
`max−min<50`), threshold 0.30 — ZUH-131's detector, rescaled to 854×480 and clipped to avoid the
bottom-right facecam. Episode boundaries come from threshold crossings; **content** change inside an
episode comes from a blurred mean-absolute-difference over the same box.

**What it conflates, stated because it changes readings:** a question dialog, a selection list, a
card-text readout and a dark card zoom all score alike, and **the two feeds have different baselines**
(≈0.06–0.11 on Cimoooooooo's, ≈0.19–0.23 on MBT's, because the layouts differ). **Every episode this
detector proposed was confirmed or rejected by reading frames**, and several were rejected: 07:54.00,
08:04.25 and 08:20.50 are card animations, not prompts.

### 5 · Full-width banner detection
Per-row coverage of saturated blue (`B>90, B−R>45, B−G>25`) and saturated red (`R>110, R−B>55, R−G>45`)
in `y∈[157,300], x∈[0,581]`; fire above 55 %. Real banners reach 0.90–1.00 or hold red for many frames;
isolated frames at 0.65–0.72 are false positives from mat art and I did not count them. **The
blue/red split turned out to be a per-seat turn-ownership marker** (V5), which is a finding, not a
detector artefact.

### 6 · Badge-sheet ↔ dense-window time alignment
Badge cells (native `x∈[1360,1640], y∈[370,590]`) versus the same region of dense frames
(`x∈[605,729], y∈[164,262]`), both downscaled to 62×55, with **the per-pixel mean across the window
subtracted before correlating**. The subtraction is the whole trick: it removes the badge's fixed
artwork, which is what defeats plain correlation. **24 of 24 cells best-match a frame 1.25–2.5 s after
their printed caption** (V6), filed as ZUH-142.

### 7 · Are `dense/` and `overview/` the same frames?
Grayscale, resized to 160×90, normalised correlation, dense vs overview at all eight 5 s marks in
10:20–11:00: **r = 1.000 on every one.** They are the same frames, which is what forced the badge-offset
conclusion instead of a dense-window offset.

## Four things that did not work — recorded so nobody repeats them

1. **Plain normalised cross-correlation of badge cells against overview badge regions.** Returns 0.97
   against completely unrelated timestamps: the badge artwork dominates the crop. **This is the same
   failure ZUH-131 hit** with template correlation (its 04-method technique 3) and it has the same fix —
   subtract the mean image first (§6 above). Abandoned after one attempt because the fix was obvious.
2. **Matching badge cells to frames by mean luma.** Agreed on 4 of 8 test cells and disagreed on the
   other 4. Ambiguous, abandoned. **Two failed attempts at the alignment question in total before §6
   worked** — I stopped counting techniques and changed the statistic, which is the thing that mattered.
3. **Measuring the green bar's width by green-pixel extent** to test whether it was a countdown. Defeated
   twice over: the mat is green, and the dialog *moves* during its entrance animation, so a fixed region
   does not track it. Abandoned after two attempts and replaced with a native-scale crop read of four
   consecutive frames, which answered it in one image.
4. **A "left card-text panel present" detector.** Fired on 100 % of frames in all six windows — the box I
   chose contains persistent dark UI on both feeds. Useless as presence; I used change-based detection
   and image reads instead. **The card-text readout is not at a fixed position across the two feeds**,
   which is the underlying reason.

## What limits every number in this delivery

- **No audio.** Every duration is an upper bound from a performed, commentated match, and I cannot tell
  when a player was talking rather than playing.
- **No cursor, ever.** Not in one of the 75 frames I read. So no click is directly observable, and
  "the player did not probe" always means "the player made no inspection this client would have
  rendered".
- **Both facecams occlude the field in every frame**, including the bottom-right region where this client
  puts its phase and End-Turn controls. Unchanged from ZUH-131 and unchanged by frame rate.
- **The editor follows the turn player** (V5), so the off-turn player's client is never on screen during
  a turn. This is the single largest limit on M11 and it is an editing limit, not an instrument limit.
- **Six windows, 980 frames, 4 min 5 s of a 26 min 40 s VOD.** Everything tagged [4FPS] is a statement
  about those four minutes.
