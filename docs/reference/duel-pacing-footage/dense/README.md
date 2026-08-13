# Dense windows — 4 fps, continuous, no gaps

Six windows requested by the pacing researcher, cut from the same source as `../overview/`.
**Within a window, consecutive frames ARE consecutive moments** — 250 ms apart, nothing
skipped. Unlike `../overview/`, you may read these as a sequence.

Filenames are `MM-SS-F.jpg`, `F` = quarter-second index. `10-20-2.jpg` is 10:20.50.

| Window | Frames | Why it was asked for |
|---|---|---|
| `10-20_11-00` | 160 | **Priority.** Game-1 boundary — is there an editor's cut? If the VOD is cut, VOD elapsed ≠ real elapsed and every duration below is suspect. Validity check, not a finding. |
| `07-50_08-35` | 180 | Densest run of chain prompts with LP moving — duration of a chain exchange, how long each prompt sits |
| `16-20_17-00` | 160 | Most static stretch; a deck-search list open, then a summon animation — how long a player sits inside one open question |
| `04-00_04-45` | 180 | Two turn-change banners — short-turn duration, what the off-turn player does |
| `13-40_14-10` | 120 | A genuine think with nothing on screen — calibration for how long a status label may sit before it reads as a hang |
| `25-35_26-20` | 180 | Final attack, 4100 damage — commit→consequence latency |

🔴 **The read budget still applies.** 980 frames here. Read the window you are working on, a
handful at a time. Bulk-reading a window is ~90k tokens of images and the accumulated-image cap
has previously killed a thread outright with no recovery.

## ⚠️ THREE GAMES, NOT ONE DUEL

Confirmed from the sheets: game 1 ends ~10:35, game 2 `VICTORY` at 18:55, game 3 ends ~26:12 —
about 23 minutes of actual play. Edison is played as matches, so this is one match. **Every
duration figure must say which game it came from.**

## ⚠️ THERE IS NO AUDIO HERE, AND THE COMMENTARY IS A CONFOUND ANYWAY

These are frames. The source VOD has live commentary; **none of it is in this repo**, and the
earlier `../INDEX.md` described the *source* rather than the *artifact*, which is how a brief
came to ask for something that was never delivered. That is corrected here.

🔑 **Before asking for a transcript, know what it would and would not be good for.** These are
streamers narrating for an audience, not players in a private match. Commentary is:

- **Usable** for *what* a player was weighing at a moment — the content of the deliberation,
  which the board cannot show, and which the needs model genuinely lacks.
- **NOT trustworthy** for *how long* anything took. People think slower while narrating and
  keep talking to fill silence. Any duration measured from a commentated VOD is inflated by an
  unknown amount, and that is the number this whole workstream exists to establish.

So: treat every duration here as an **upper bound from a performed match**, and say so in the
deliverable. If a transcript is supplied later it strengthens the *what*, never the *how long*.
