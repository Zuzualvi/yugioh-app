# Turn badges — native resolution, every 5 s, all three games

**This is the ZUH-131 researcher's own highest-value ask, fulfilled.** Its words:

> *"The highest-value ask is no longer a window — the mat carries a `Turn N` badge at a fixed
> position (native-1080p crop `x∈[1360,1640], y∈[370,590]`). Re-export the 321 existing samples
> at native resolution and I get every turn boundary in all three games at ±5 s. Turn duration
> currently rests on **two turns** (30 s, 35 s)."*

**320 crops at native 1080p**, taken directly from the source VOD — not upscaled from the
1280px overview frames, which is why the badge text is legible here and was not there.

## Read the montages, not the crops

11 sheets, 6×5, each cell captioned with its `MM:SS`. **One sheet read gives 30 turn
readings**, so all 320 samples cost 11 image reads instead of 320. Individual crops are not
committed — the montages carry the same pixels.

The badge reads e.g. `Turn 8 / Draw`. Where a badge is absent the mat is not showing one
(between games, result screens, full-screen beats) — **that absence is itself a boundary
signal** and worth recording rather than skipping.

⚠️ **±5 s is the resolution, and it is the floor on every duration derived from this.** A turn
boundary observed between two samples is known to ±5 s, so a 30 s turn is 30 ± 10 s. Do not
report a turn duration to a precision this cannot support — the earlier deliverable was right
to call a 2-second claim *"an untestable number wearing a fact's clothes."*

## Three games, and the badge numbering resets

Game 1 ends ~10:35–10:40 · game 2 `VICTORY` at 18:55 · game 3 ends ~26:12 · room screen 26:20.
**Turn numbers restart each game**, so a sequence that appears to go backwards is a game
boundary, not a misread.
