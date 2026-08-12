# Reference footage — a real Edison match, for PACE and DECISION RHYTHM

## What this is, exactly

**MBT vs Cimoooooo, Edison format duel, Yu-Gi-Oh Master Duel — YouTube VOD by
MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12.** Two competitive players, one
complete match, both on camera with live commentary.

Not "gameplay footage" and not a live capture of anything we built. Cite it by that name.

## What it is EVIDENCE for — and what it is not

**It is evidence for pace, thinking time and decision rhythm.** How long a real turn takes,
where players stop and think, how quickly control passes back and forth, what a player does
during the opponent's turn. That is the thing the player-needs model is currently inferring
rather than observing.

⚠️ **It is NOT a UI reference, and using it as one would be a mistake.** Master Duel's
interface is already covered by the competitor teardown. It is a polished commercial client
with an animated mat, particle effects and cinematic summons — reading "game feel" off it
without noting that attributes production budget to interaction design.

⚠️ **Both players' faces are on screen** (top-left and bottom-right overlays). Incidental to
the source, and worth knowing because they occlude part of the field in every frame.

## HOW TO READ THIS — a budget, not a suggestion

**Start with `sheets/` and read ONLY those.** Thirteen contact sheets, 5×5, covering the
whole match at 5-second intervals with a visible timestamp under every cell. All thirteen
together cost about 17k tokens.

**Then pull individual frames from `overview/` by timestamp**, a handful at a time. Files are
named `MM-SS-F.jpg` where `F` is the quarter-second index, so `09-45-0.jpg` is 09:45.00.

🔴 **Do not bulk-read a directory of frames.** The image cap is on *accumulated* images per
request, and one oversized read late in a long session has previously killed a thread outright
(`retry_status: terminal`, no recovery). Read what you need to judge; do not read the same
moment twice.

## The 5-second sampling is a REAL gap — treat it as one

`overview/` samples one frame every 5 seconds. **That skips actions.** On a single contact
sheet covering 08:20–10:20, life points move 6200 → 4400 → 3000 → 1000 → 2600 — several
plays happen between adjacent cells. The timestamps are printed so the gaps stay visible.

**Consecutive cells are NOT consecutive moments. Do not narrate them as a sequence.**

**Full 4 fps capture exists for the entire match** — 6,401 frames — held outside this repo.
**Name any window you want at full density (e.g. "04:10–04:40") and it will be added here as
a continuous 4 fps set with no gaps.** That is the intended way to study a specific exchange;
this directory is the map, not the territory.

## A method finding, so nobody repeats the work

Frame-differencing **does not** identify distinct states on a continuously-animated client.
Perceptual-hash dedupe was tried across all 6,401 frames, first whole-frame and then cropped
to the playfield to exclude the facecams. Consecutive-frame distances came out smooth —
median 9, p75 17, p90 34 on a 256-bit hash — with no separation between "animation jitter"
and "a real state change". Only 907 of 6,400 frames were near-static.

The field is never still: glows, particles and mat animation change every frame even when
nothing is happening. So sampling by time and indexing by timestamp is the workable approach
here, not deduplication. Frame extraction remains the right technique; **dedupe is the part
that does not transfer to animated commercial UIs.**
