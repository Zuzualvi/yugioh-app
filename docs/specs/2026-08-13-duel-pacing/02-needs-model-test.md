---
linear_project: Duel Experience Redo
---

# 02 · The fifteen moments, tested against the footage

Testing `docs/specs/2026-08-12-duel-player-needs-model.md` (branch
`docs/duel-experience-redo-discovery`) against *MBT vs Cimoooooo, Edison format, Yu-Gi-Oh Master Duel
— YouTube VOD by MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12*.

The model says of itself: *"No player was observed for this document."* This file is the first
player-shaped evidence the project has. It is two competitive players on **a commercial client that
is not ours**, so it tests **pace and rhythm**, and it tests need-existence only where the client's
own behaviour reveals it.

## What the instrument can and cannot reach

| Reach | Moments |
|---|---|
| Tested here, from 5-second sampling | M1, M3 (partly), M10 (partly), M12, M14 |
| Recorded as a **non-finding** — the footage neither supports nor undermines | M13 |
| Needs a full-density window; requested, marked ⏳ below | M4, M5, M6, M8, M9, M11 |
| Only marginally reachable even at 4 fps | M2, M7 |
| **Not reachable: the event never occurs in the footage** | M15 |

---

# THE CONTRADICTIONS, FIRST

## ✗ C1 · Gap 14 ("the duel ends into a dead end") is ranked far too low — it is the loop, not the edge

The model ranks it **14th of 15**, at **"1 hit per duel"**, filed as *"Design/scope"*.

**What the footage shows [SHEETS, high confidence]:** the video is a **three-game match**
(`01-pacing-findings.md` P1). The duel-end moment fires **three times in 26 minutes**. After the last
game the client puts the players back on a **lobby/room screen with "Begin Duel", table entries and an
`ENTRY` button** (26:20–26:35), which is where the previous two games came from. The route from a
finished duel to the next one against the same person is not an edge case in the product these
players actually use — **it is the shape of the session.**

**What this does to the ranking:** the model's own §1 says *"the unit of the experience is a match,
not a duel"* and then builds a frequency table per duel. On a per-sitting count, M14 fires as often as
M1 and more often than most of the moments ranked above it. **[INFERENCE]** I am not re-ranking the
list; I am saying gap 14's frequency premise is wrong by a factor of three and the "scope fact"
framing does not survive watching a match.

The design already proposes `Play Sakura again` (03 F9 step 1', 02 §10, marked *proposed scope*).
**The footage argues for promoting it out of "proposed".**

## ✗ C2 · M1 is not "the first ten seconds" — it is about twenty, and the real client spends them talking

**Model:** *"M1 · Seating — the first ten seconds, before anything has happened"*, and *"Once per
duel. 100% of duels."*

**Footage [SHEETS, high confidence]:** the observable pre-duel sequence at the 18:55→19:15 boundary
runs `VICTORY` → result frame → **`You are Going Second.`** full-screen → warp transition → `DUEL`
→ mat drawn. That is **~20 seconds in which the player does nothing but read** (P7). And it happens
three times per sitting, not once.

**The substance of M1 is confirmed hard.** The model argues turn order in Edison "is not a formality"
and that the shipped screen never states it. The commercial client **stops the world and states it in
one sentence on its own screen.** The design's F1 line `You go first.` is the right instinct; the
footage says it can afford to be much louder than a dock line.

## ✗ C3 · "No client ships a delta" is confirmed — and my attempt to explain it away was wrong

**Model M3 / gap 3**, citing the teardown: no client in the reference set ships a delta, so this is a
design-first gap.

**Footage [SHEETS + SCRIPT, medium confidence]:** confirmed. I saw **no delta-like surface** in 275
sampled play frames — no summary strip, no "since you last acted" mark, nothing that reconstructs the
opponent's turn after the fact.

**A correction I am making to my own work, in place, because the wrong version may have been quoted.**
An earlier version of this section argued that the commercial client answers M3 by *narrating
continuously* — evidenced by "card-text panels at the left and right field edges" in most frames. A
zoom shows the right-hand ones are the **stream's live chat overlay**, not the client
(`01-pacing-findings.md` P6, withdrawn). **The claim that this client substitutes live narration for a
delta is withdrawn. It is unproven, not disproven** — the client does narrate with full-width phase
banners (~8% of play, P3) and it does put a text panel over the bottom centre for 26.5% of play (P2),
but I no longer have evidence that this amounts to a substitute for a delta.

**What the design should take from this:** gap 3 stands exactly as the model wrote it, with the
footage adding **frequency** — the delta surface is met **13–15 times per game** (C5 below), every
~30 s, summarising ~30 s of activity. It is a high-traffic surface, not an occasional one.

## ✗ C6 · One of the two "players" being studied is not the same seat all the way through

**[ZOOM, high confidence on the observation; medium on the interpretation]** The top life-point plate
reads **`MBT · LP 3000`** at 07:55 and **`Cimooooooo · LP 8000`** at 14:00, and Master Duel's plates are
fixed to seats — so the **camera changes seats between game 1 and game 2** (P10). The VOD is an edited
assembly of more than one capture.

**Why this belongs in the contradictions list:** the model's M10 ("what a player does during the
opponent's turn") and M3 ("control returns") describe *one* player's experience. This footage does not
give 22 continuous minutes of one player — it gives one seat for game 1 and the other for game 2.
Anyone using it to characterise "the player" must attribute per game. It also means **every duration in
these files is VOD time**, and the unexplained 10:35→10:45 game boundary is more likely to be a cut
(P1 ⚠).

## ✗ C4 · M3's "this is a scan, not a read, and it happens in about two seconds" is untestable and should stop being stated as fact

The model prints a duration for the scan. Nothing in this footage measures it, and no frame rate
available to me would — it requires eye-tracking or the player's own account. **It is an [I] claim
wearing a number.** Delete the number or tag it.

---

# THE CONFIRMATIONS

## ✓ C5 · M3 / M10 frequency: "~12–20 handovers per duel" survives contact

**[SHEETS + INFERENCE, medium confidence.]** Two turns are bracketed by `TURN CHANGE` banners at
30 s and 35 s (P4). At ~32 s a turn, the three observed games (7m15s, 8m10s, 6m55s) hold **≈13–15
turns each**. The model's 12–20 is the right order of magnitude and its low end is closer to the
truth than its high end. **Two turns is not a distribution — see P4's warning.**

## ✓ M10 "Dead time — half the duel"

**[INFERENCE from the above, medium confidence.]** With turns alternating at ~30 s, each player is
off-clock for about half the game in stretches of about half a minute. Nothing in the footage
contradicts the model's framing. What I **cannot** do is attribute the panel-time of P2 to own-turn or
opponent-turn, because turn ownership is not recoverable from the sampled set (README limit 3).

**One nuance the model may have backwards.** It says of dead time: *"Eyes: free to wander — this is
the only moment the player can look away."* **[INFERENCE, low-medium confidence]** On this client the
opponent's turn is when the screen is *most* active — banners, card texts, animations. If our screen
is quiet during the opponent's turn while theirs narrates, "free to wander" becomes "nothing to watch",
and that is a different design problem from the one the model names.

## ✓ M12 "Watching it resolve" — resolution is a multi-second beat, and the real client waits for you

**[SHEETS + SCRIPT, medium confidence; the modal is ZOOM, high confidence.]** Both game-ending damage
sequences occupy two consecutive 5-second samples, so each ran **≥5 s** (P9). The design's
`--m-narrate` (600 ms) is the *fade* of a statement, which is a different thing — but the footage says a
real client is willing to spend seconds on the beat where an outcome lands, and these players sit
through it.

**And a harder-edged one.** A zoom of frame 07:55 shows the client acknowledging a mandatory effect with
a dialog whose entire content is `● Draw 1 card.` and an `OK` button (P11). **The reference product's
answer to "tell the player what just resolved" is a modal that blocks until they click.** The design's
equivalent — the auto-answer receipt — fades after 2.4 s. I am not recommending a modal; I am saying
the 2.4 s fade is the aggressive end of the spectrum, not the safe end. See
`03-timing-budgets.md` B1.

## ✓ M14's "must KNOW: the reason in game terms" — the real client leads with the verdict

**[SHEETS, high confidence.]** `VICTORY` at 18:55 is a full-width single word before any detail. The
design's end card (02 §9) states result, cause and totals together. The footage does not contradict
it; it does show that the verdict itself gets a full beat of its own.

---

# THE REST, MOMENT BY MOMENT

| # | Moment | Verdict from this footage |
|---|---|---|
| **M1** | Seating | **Exists, and is bigger than modelled.** ~20 s, three times per sitting, turn order stated in words on its own screen. See C2. |
| **M2** | Opening hand | **Not reachable.** Reading five cards is hovers and eye movement; the facecam occludes part of the field and I cannot see a cursor at 5 s sampling. Marginally reachable at 4 fps *if* card-text panels flicker while a hand is being read — worth checking in a window covering a game's first 30 s, which I did **not** request and would ask for next. |
| **M3** | Control returns | **Frequency confirmed (≈13–15/game). Need reframed** — see C3. The "two second scan" is untestable — see C4. |
| **M4** | Scanning for a play | ⏳ **Reachable at 4 fps and not at 5 s.** Probing would appear as card-text panels changing without any board change. My requested window `13:40–14:10` (a 20 s near-static stretch, P5) is the best place in the match to look for it. |
| **M5** | Committing | ⏳ Requires seeing a click and its consequence in the same second. Windows `07:50–08:35` and `25:35–26:20`. |
| **M6** | Being asked inside my own play | ⏳ The model claims **2–5 sub-questions per play**. At 5 s sampling I caught **42 panel episodes in 22 minutes of play** (P2) — a lower bound that is consistent with the claim and cannot test it. A 4 fps window resolves the sub-question count for the plays inside it, and only those. |
| **M7** | Backing out | Marginally reachable: a dialog that opens and closes with no board change. Not attempted; no window requested for it. |
| **M8** | Battle | ⏳ Partly visible already: the client gives an attack its own full-width banner (`DIRECT ATTACK`, 13:25) and a full-screen damage flash. The model's need — *the comparison, ATK vs ATK, as a subtraction* — is about information, not pace, and this footage cannot test it. |
| **M9** | Passing the turn | ⏳ The self-check ("have I used my Normal Summon?") is internal. Unreachable. What *is* reachable is the turn-pass beat itself: `TURN CHANGE` banners at 04:05, 04:35, 18:30, 24:20, 24:55. |
| **M10** | Dead time | Confirmed in shape; see above, including the nuance that may be backwards. |
| **M11** | The interrupt | ⏳ **The most important pending item.** The model calls it *"the moment Edison games are decided in"* and claims *"several times per opponent turn"* and *"a few seconds"* to decide. The footage's densest prompt cluster is `07:50–08:35` (a prompt visible at 07:55, 08:00, 08:05, 08:10 with life points moving) — that window measures how long a chain exchange takes end to end and how long each prompt sits. One frame at 07:55 appears to contain a horizontal green progress bar which *might* be a response countdown (P8, explicitly a guess). |
| **M12** | Watching it resolve | Confirmed as a multi-second beat. |
| **M13** | Clock pressure | **Non-finding, recorded so it is not upgraded.** I identified no clock in any sampled frame, at a cell resolution that would lose one, in a private room where the rules may differ. This footage says **nothing** about whether deleting the clock is right. |
| **M14** | The duel ends | **Confirmed and under-ranked** — see C1. |
| **M15** | Disruption | **The event never occurs.** No reconnect, no drop, no walk-away in 26:40. Untestable here — not "unconfirmed". |

---

## The decompositions

The model's per-moment decomposition (achieving · must KNOW + where the eyes are · must DO · heard me
· recovery) is a **structure**, and this footage cannot validate a structure. It can validate
*frequency* and *duration*, which is what is above. **Two specific decomposition elements are
falsified as stated:** the "about two seconds" scan in M3 (C4), and M1's "first ten seconds" (C2).
Everything else in the decompositions is untouched by this evidence, and should keep its `[I]` tag
rather than being promoted because a pacing study happened.
