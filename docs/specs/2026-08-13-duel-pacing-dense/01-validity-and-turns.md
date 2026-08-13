---
linear_project: Duel Experience Redo
---

# 01 · The validity check, and turn duration as a distribution

Source for everything in this file: *MBT vs Cimoooooo, Edison format, Yu-Gi-Oh Master Duel — YouTube
VOD by MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12*, supplied as frames on branch
`reference/duel-pacing-footage`. I read the six dense 4 fps windows at
`docs/reference/duel-pacing-footage/dense/` (854×480 frames, 250 ms apart) and the 11 turn-badge
montage sheets at `docs/reference/duel-pacing-footage/turn-badges/` (native-1080p crops, 6×5 captioned
cells per sheet, 1680×1180 each) on 2026-08-13, from my own clone.

Tags: **[4FPS · window]** = I read named frames from that dense window as images. **[BADGES · sheet]**
= I read that montage sheet. **[SCRIPT]** = pixel statistics computed over frames that were *never*
read as images. **[INFERENCE]** = mine, marked at every appearance.

⚠️ **Every duration here is an upper bound from a performed, commentated match.** Two streamers
narrating for an audience think slower and talk to fill silence. There is no audio in the artifact, so
I cannot even tell when they were talking.

---

# PART A · VALIDITY. Read this before you use any duration from ZUH-131 or from this file

## V1 · The VOD is a TWO-FEED multicam edit of two players' own clients, not one capture

**[4FPS · 04-00_04-45, 07-50_08-35, 10-20_11-00] + [SCRIPT]. Confidence: high.**

The bottom-left (near-side) life-point plate names a **different player at different times inside the
same game**. Native-scale crops of the plate region `x∈[0,300], y∈[395,475]` of the 854×480 dense
frames, composited without upscaling and read as one image:

| Frame | Near plate reads |
|---|---|
| `04-04-3.jpg` (04:04.75) | `MBT · LP 8000` |
| `04-05-1.jpg` (04:05.25) | `Cimoooooooo · LP 8000` |
| `04-34-2.jpg` (04:34.50) | `Cimoooooooo · LP 8000` |
| `04-35-0.jpg` (04:35.00) | `MBT · LP 8000` |
| `08-12-0.jpg` (08:12.00) | `Cimoooooooo · LP 6200` |
| `08-13-0.jpg` (08:13.00) | `MBT · LP 3000` |
| `10-38-0.jpg` (10:38.00) | `MBT · LP 1000` |
| `10-42-0.jpg` (10:42.00) | `Cimoooooooo · LP 8000` |
| `07-55-0.jpg` (07:55.00) | `Cimoooooooo · LP 6200` |

Master Duel draws the local player's plate on the near side. So the video **cuts between MBT's client
capture and Cimoooooooo's client capture**, and the two feeds also carry **different facecam layouts**
(in the MBT feed the small camera is bottom-right with a cyan border; in the Cimoooooooo feed the
layouts are swapped and differently sized — visible in every frame pair above). The life-point values
are mutually consistent across each switch (6200/3000 either side of 08:12), so both feeds are of the
same live game, not different games.

**This corrects, not confirms, ZUH-131 P10 / C6.** P10 said *"the seat the camera sits in changes
between games"* and read 07:55 as game 1 from Cimoooooooo's side (which my 07:55 crop reproduces
exactly, so P10's zoom was accurate). What is wrong is the *scope*: the seat changes **many times per
game**, not once per game. The consequence P10 drew — attribute per game to the right person — is too
coarse. **Attribution must be per feed segment, and segments are ~20–45 s long.**

## V2 · There are at least 34 feed switches across the match, i.e. roughly one every 39 s of play

**[SCRIPT]. Confidence: high for the count as a floor.**

The near plate's owner icon is a clean binary signal: mean `(B−R)` over the icon box (`x∈[0,36],
y∈[412,472]` at 854×480; `x∈[0,27], y∈[309,354]` at 640×360) is **≈ +13 for Cimoooooooo** (blue dragon
icon) and **≈ −13 to −17 for MBT** (pale skull icon), with no values in between on any frame I
measured. Validated against the nine plate crops in V1 — it agrees with all nine.

Run over all 321 sampled `overview/` frames (5 s spacing, no frame read as an image), gated on "a
plate is present at all": **34 owner changes between 03:20 and 26:10.** That is a **floor** — a switch
that begins and ends inside one 5 s gap is invisible. Over ~22 min of play that is one switch every
~39 s on average.

## V3 · The switches themselves mostly preserve elapsed time — to about ±0.5 s, not better

**[4FPS · 04-00_04-45, 07-50_08-35]. Confidence: medium-high.**

A turn-change banner is one server event rendered by both clients, so it is a shared stopwatch across
a cut. Three cuts, read frame by frame:

- **04:05.00 cut (MBT → Cimoooooooo).** `04-04-3.jpg` (04:04.75, MBT feed) shows the turn-change
  banner **about 40 % swept in, in red**. `04-05-0.jpg` (04:05.00, Cimoooooooo feed) shows the same
  banner **fully swept, in blue**. That is one animation continuing across the cut: **the two feeds are
  aligned to within about one frame (250 ms) here.**
- **04:34.75 cut (Cimoooooooo → MBT).** `04-34-2.jpg` shows **no banner**; `04-34-3.jpg`, 250 ms later
  on the other feed, shows the banner **fully swept**. Consistent with alignment, but it does not
  prove it — the sweep would have to complete inside one frame.
- **08:12.50 cut (Cimoooooooo → MBT).** `08-12-1.jpg` (08:12.25, Cimoooooooo feed) shows `END PHASE`
  **fully swept, blue**. `08-12-2.jpg` (08:12.50, MBT feed) shows the same banner **about half swept,
  red** — *less* advanced 250 ms *later*. **The MBT feed lags the Cimoooooooo feed by roughly a quarter
  to a half second at this point.**

**[INFERENCE]** Part of that lag is not editing at all: two clients receive the same server event with
their own network latency and animate locally. Either way the working number is the same.

**The rule this produces, and it is the one to quote:** a duration measured **inside one feed segment**
is good to **±250 ms** (one frame). A duration measured **across a feed switch** carries an extra
**±0.5 s**. Any window with a switch in it must have its measurements segmented — which is why every
duration in `02-moments.md` names its segment.

## V4 · The game-1 → game-2 boundary is a HARD EDITORIAL CUT with material removed. VOD elapsed time is not real elapsed time there

**[4FPS · 10-20_11-00]. Confidence: high. This is the question the window was cut for, and the answer is not the boring one.**

- `10-41-1.jpg` (**10:41.25**) — MBT feed — full-width **`VICTORY`** banner over a game-1 board.
- `10-41-2.jpg` (**10:41.50**) — Cimoooooooo feed — full-width **`TURN CHANGE`** banner, in blue, over
  a clean board with **both life-point plates at 8000**.

Those frames are **250 ms apart**. A game cannot be showing a turn change a quarter of a second after
the previous game's victory banner, and it cannot be showing 8000/8000 on a board that has already had
a turn end on it. Both facecam regions also change discontinuously at exactly that frame (`[SCRIPT]`:
mean absolute frame-to-frame difference in the top-left facecam region jumps to 53 and in the
bottom-right to 48, against a within-segment median under 3). **The editor cut out the whole between-game
sequence and at least the first turn of game 2.**

**ZUH-131's P1 ⚠ resolves as: cut.** Its 10:35–10:45 puzzle ("a populated board is already on screen at
10:45") was correctly suspected and is now settled. Concretely:

- **ZUH-131's game-2 span (10:45 → 18:55, 8 m 10 s) is a lower bound, not a measurement**, and so is its
  "22 m 20 s of live play in 26 m 40 s". Real game 2 was longer by the excised material.
- **ZUH-131 B6's ~20 s between-game beat now rests on exactly one observed boundary** (18:55 → 19:15).
  Its own caveat asked whether the other boundary was cut. It was. The number does not get stronger and
  it does not get weaker: **n = 1**, and the second instance was destroyed by the edit, not by the
  instrument. Do not present ~20 s as a typical value; present it as the only one ever seen.
- Nothing else in ZUH-131 spans 10:41.375, so no other duration in it is invalidated by this cut.
  **The 34 switches of V2 are the wider risk, and V3 bounds them at ±0.5 s.**

Also visible at this boundary and worth recording: the client's game-1 end sequence itself is
**≈6.75 s of read-only screens** — full-screen damage flash beginning at `10-34-2.jpg` (10:34.50),
running through `10-38-0.jpg` (10:38.00) where a board with `MBT · LP 1000` is still up, to the
`VICTORY` banner at 10:41.25 — and then the cut. **[4FPS · 10-20_11-00]**, one observation, MBT feed
only, so it is a single sample and not a distribution.

## V5 · What the feed switching gives back: turn ownership, which ZUH-131 could not recover

**[4FPS · 04-00_04-45] + [INFERENCE]. Confidence: medium-high for the mechanism, medium for using it as a signal.**

Two things line up:

1. **The turn-change banner is coloured per seat.** At the 04:05 turn change the banner is **red on
   MBT's feed** (`04-04-3.jpg`) and **blue on Cimoooooooo's feed** (`04-05-0.jpg`). At the 04:34.75 turn
   change it is **blue on MBT's feed** (`04-34-3.jpg`). Same for `END PHASE`: blue on Cimoooooooo's feed
   at 08:12.25, red on MBT's feed at 08:12.50. **Blue = this is my phase / my turn beginning; red = it is
   the opponent's.** That is a per-seat ownership marker readable in one frame.
2. **The editor cuts to the feed of the player whose turn is starting** — observed at both turn changes
   in the 04:00 window (cut to Cimoooooooo as Cimoooooooo's turn starts; cut to MBT as MBT's turn
   starts).

**[INFERENCE]** If (2) holds generally, then the 34 feed switches of V2 are turn changes, and the
`overview` plate-owner signal is a turn-ownership timeline for the whole match — the exact thing
ZUH-131 recorded as unreachable (its README limit 3). I am **not** publishing that timeline as a
finding: I verified the mechanism at two turn changes, in one window, in one game. Part B derives the
turn distribution from the badges instead, which is direct evidence, and then uses the switch count
only as a cross-check.

---

# PART B · Turn duration as a distribution

## V6 · FIRST: every timestamp printed on the turn-badge montages is ≈2.3 s EARLIER than the frame it shows

**[SCRIPT] + [4FPS · 10-20_11-00]. Confidence: high. Read this before using the badge sheets, and note that it does not affect any duration.**

I found this because the badge sheets and the dense windows flatly contradicted each other at one
point: the cell captioned **`10:40`** shows **game 2, `Turn 2 / Draw`**, while `dense/10-20_11-00/10-40-0.jpg`
shows **game 1's `VICTORY` banner sweeping in**. I verified that `dense/` and `overview/` are the *same*
frames (normalised correlation r = 1.000 for all eight 5 s marks in 10:20–11:00, so the dense window is
not itself offset).

I then matched each badge cell against every dense frame in three windows, using the badge region
(native `x∈[1360,1640], y∈[370,590]` → dense `x∈[605,729], y∈[164,262]`) with the per-pixel mean across
the window subtracted first — which is what defeats the fixed badge artwork that beat ZUH-131's
template correlation (its 04-method technique 3). **24 of 24 cells best-match a frame 1.25–2.5 s later
than their caption, median +2.25 s:**

| Badge cell caption | Best-matching dense frame | Offset |
|---|---|---|
| `08:10` | `08-12-1` (08:12.25) | +2.25 s |
| `10:40` | `10-42-2` (10:42.50) | +2.50 s |
| `04:05` | `04-07-2` (04:07.50) | +2.50 s |
| `13 others in 04:00/07:50/10:20 windows` | — | +1.25 s … +2.50 s |

With that correction every badge reading becomes consistent with the dense windows — including cell
`08:10` = `Turn 7 / End`, which lands exactly on the frame where I independently see the `END PHASE`
banner (V3). **The offset is a constant, so it cancels in every *difference*: turn durations below are
unaffected.** Only *absolute* placements move, by ~2.3 s. I have filed this as a defect against the
artifact; it does not need fixing for this brief.

## V7 · The distribution: 27 complete turns across three games. Median 35 s, mean 44 s, range 10–100 s

**[BADGES · sheets 01–10]. Confidence: high for turn numbers, medium for phase labels, ±10 s on every duration.**

The badge reads `Turn N / phase` legibly at native resolution. I transcribed all 11 sheets. **Turn
numbers reset per game**, which is how the game boundaries fall out of the data (`Turn 12` → `Turn 2`
between sheets 04's rows; `Turn 10` → `Turn 1` on sheet 07).

⚠️ **±5 s is the sampling floor on each boundary, so every duration below is ±10 s.** A "30 s" turn is
30 ± 10 s. Two turns are better than that because a dense window brackets them (marked ✚).

**Game 1 — 12 turns, 03:20 → 10:41 (VOD).** Cimoooooooo took the odd turns, MBT the even ones
(V5: the banner is blue on the feed of the player whose turn starts, and turn 3 starts blue on
Cimoooooooo's feed).

| Turn | Duration | Turn | Duration |
|---|---|---|---|
| 1 | **≤10 s** | 7 | 30 s ✚ |
| 2 | 35 s | 8 | 45 s |
| 3 | **29.75 s ✚** (04:05.00 → 04:34.75, both banners seen at 4 fps, ±0.25 s) | 9 | 25 s |
| 4 | 80 s | 10 | 20 s |
| 5 | 40 s | 11 | 25 s |
| 6 | 70 s | 12 | ~25–30 s then the game ends |

**Game 2 — at least 10 turns, 10:41 → 18:55 (VOD).** MBT odd, Cimoooooooo even. **Turn 1 does not
exist in the artifact — the editor cut it (V4)**, and turn 2 is truncated at its start for the same
reason.

| Turn | Duration | Turn | Duration |
|---|---|---|---|
| 1 | **excised** | 6 | 40 s |
| 2 | ≥40 s (start excised) | 7 | 35 s |
| 3 | 55 s | 8 | **100 s** |
| 4 | 65 s | 9 | 45 s |
| 5 | 80 s | 10 | ~25–30 s then the game ends |

**Game 3 — 12 turns, 19:15 → 26:10 (VOD).** Cimoooooooo odd, MBT even.

| Turn | Duration | Turn | Duration |
|---|---|---|---|
| 1 | **≤10 s** | 7 | 25 s |
| 2 | 50 s | 8 | 35 s |
| 3 | 20 s | 9 | 10 s |
| 4 | 85 s | 10 | ~10–15 s |
| 5 | 35 s | 11 | ~20 s |
| 6 | 85 s | 12 | ~35 s then the game ends |

**The distribution over the 27 complete, non-first, non-final turns:**

| | |
|---|---|
| median | **35 s** |
| mean | **44 s** |
| p25 – p75 | **25 s – 65 s** |
| min – max | **10 s – 100 s** |
| n | 27 (10 in game 1, 7 in game 2, 10 in game 3) |

**Per game:** game 1 median 32.5 s / mean 40 s; game 2 median 55 s / mean 60 s; game 3 median 30 s /
mean 37.6 s. **Game 2 is visibly slower than the other two** — its shortest complete turn (35 s) is
longer than the median turn of the other two games.

**Turns per game: 12, ≥10, 12.** ZUH-131's P4 arithmetic guessed 13–14. Close, and slightly high.

## V8 · What this does to ZUH-131 P4, C5 and B5 — one confirmation and two corrections

**P4 ("two turns, 30 s and 35 s; that is not a distribution") — its refusal was correct and its two
numbers were lucky.** 30 s and 35 s straddle the true median of 35 s. But P4's own warning is the part
that mattered: **a quarter of all turns run 65–100 s**, and the longest is 100 s — more than three times
the value anyone would have quoted from P4. Turn 3 of game 1, one of P4's two turns, is confirmed
independently at 4 fps as **29.75 s** (V7 ✚), so P4's measurement was accurate; it was its *coverage*
that was not.

**C5 / B5 "the player regains control every 30–35 s, so the delta fires 13–15 times per game" — this is
wrong twice, and the second error is the bigger one.**

1. **The interval is wrong.** Control returns to a given player once per *pair* of turns, so the gap
   between one of my turns and the next is theirs plus mine: **median ~70 s, mean ~88 s**, not 30–35 s.
2. **The count is wrong by 2×.** There are 12, ≥10 and 12 turns per game, so **each player owns about
   six turns per game** — the "control returns" moment (M3) fires **~6 times per game**, not 13–15.
   ZUH-131 counted every turn boundary rather than every *own*-turn boundary. **The needs model's M3
   frequency of "~12–20 times per duel" is therefore 2–3× too high** if "handover" means *control comes
   back to me*; it is right at its low end only if it means *any* turn boundary.
3. **The design consequence points the other way from B5's.** B5 says design the delta strip for "~30 s
   of opponent activity — a handful of rows, not a session log". The measured opponent turn is **median
   35 s, p75 65 s, max 100 s**. **A delta surface must be able to summarise a 100-second turn**, and it
   is met about six times a game, not fifteen. Fewer visits, each carrying up to three times more to
   say. **[INFERENCE]** that argues for the delta being scrollable or grouped rather than a fixed
   handful of rows — I am recording the size, not designing the surface.

## V9 · The first turn of a game is an outlier: ≤10 s, twice

**[BADGES · sheets 01, 07]. Confidence: medium.** Game 1: `Turn 1 / Main 1` at cell `03:25`, `Turn 2 /
Standby` at cell `03:30`. Game 3: `Turn 1 / Draw` at cell `19:15`, `Turn 2 / Draw` at cell `19:20`. In
both games the entire first turn falls inside one 5 s sampling gap, so it is **≤10 s** and no Main-phase
sample of it was ever caught in game 3.

**[INFERENCE]** the player going first opens with a very short turn — set and pass. The alternative
reading I cannot exclude at 5 s sampling is that the client numbers part of its duel-start animation as
turn 1. Either way, **the first turn is nothing like the 35 s median**, and a design that budgets the
opening turn like any other turn will be wrong about it.

