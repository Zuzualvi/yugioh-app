---
linear_project: Duel Experience Redo
---

# 03 · Timing budgets the design should be held to

Against `docs/specs/2026-08-13-duel-redo-design/` (`03-flows.md`, and the sequencing parts of
`02-surface-inventory.md`) on branch `docs/duel-experience-redo-discovery`. The design states its own
durations are *"authored and unverified"* and asks for ZUH-131 to land as new token values.

## First, the honest boundary: four of the seven tokens are below this instrument's resolution

`--m-instant` (90 ms) · `--m-quick` (140 ms) · `--m-base` (200 ms) · `--m-settle` (320 ms) are
**not measurable from this footage at any density**. The sampled set is 5-second; even the full 4 fps
capture is 250 ms per frame, so a 90 ms transition is one frame or none. **I give no number for any of
them, and no number for `hover → inspector after 150 ms` either.** A pacing study of a match does not
set sub-second motion values; that needs a build and a stopwatch, or a video of our own client.

**What this footage does reach is the long end** — the durations where a *player's attention*, not a
CSS transition, is the unit. Those are the ones below.

---

## B1 · `--m-receipt` 2400 ms → **remove the timer; if one is required, ≥10 s**

**Grounded in [SCRIPT/SHEETS, medium-high confidence]:** the unit of a real player's attention on one
screen state is **tens of seconds**. A bottom-centre panel was present at every 5-second sample across
**21:05→21:35 (30 s)**, **04:55→05:20 (25 s)** and **16:20→16:45 (25 s)**; the two longest near-static
stretches in the match are 20 s each (`01-pacing-findings.md` P2, P5).

The auto-answer receipt (`02 §3.3`) is the design's answer to "the client answered something for you".
Its stated lifetime is 2.4 s. Against a 25–30 s dwell, **2.4 s is under 10% of the window in which the
player is plausibly still deciding what they were doing.** The design already applies the right rule
to the delta strip — *"It never auto-fades. Recovery for 'I did not read it' is 'read it again'"*
(§3.5). **Apply the same rule to the receipt.** It already has a `superseded` state (a question
arriving clears it), which is the correct cessation. Add "the player's next action" and delete the
timer.

**Balance, stated because it cuts the other way:** the receipt fires immediately after the player's own
click, so their gaze is probably on the dock — an argument that 2.4 s might be enough. The evidence
does not settle gaze. It settles that **the surrounding rhythm is 25–30 s**, and a 2.4 s artefact in a
30 s rhythm is a coin-flip. Cheap to make persistent; expensive to be wrong.

**A second, harder piece of evidence [ZOOM, high confidence].** A 3× zoom of frame **07:55** shows this
client's own version of the same surface: a dialog whose entire content is the sentence `● Draw 1 card.`
and one **`OK`** button (`01-pacing-findings.md` P11). **The reference product does not fade this
information out — it blocks until the player acknowledges it.** I am **not** recommending a modal: a
modal per resolution step, in a genre whose incumbent (DuelingBook) never interrupts the player, would
be its own defect. What this establishes is direction: **2.4 s-and-gone is the aggressive end of the
spectrum and "wait for them" is where the reference product sits.** "Persist until superseded or until
their next action" is between the two.

*(Context: ZUH-118 break 19 measured the shipped receipt in the DOM for 10 ms. 2.4 s was a 240×
correction of that. This finding says the correction was in the right direction and not far enough.)*

## B2 · The error line's `8 s` exit (`02 §3.1`, `error` row) → **no timeout**

**Same grounding, same confidence.** An amber one-line strip explaining that the server rejected an
answer disappears after 8 s. A player who has just been rejected is entering exactly the 25–30 s
re-deciding window observed above. **The line must persist until the question is re-answered or the
question changes.** This is the cheapest fix in this document and the evidence for it is the same
evidence as B1.

## B3 · "If the gap exceeds 2 s, the same reading persists; no second escalation" → **keep it, and do not add an escalation before 5 s**

**Grounded in [SHEETS/SCRIPT, medium confidence]:** in the client these two competitive players chose,
**~8% of live play is a full-width transition banner or full-screen flash** (P3), and both
game-ending damage sequences ran **≥5 s** across two consecutive samples (P9). Multi-second animated
resolution is the norm they are habituated to, and nothing in the frames shows either player reacting
to it as a stall.

**The number I will not give:** *how long a `Resolving…` reading may sit before a real player reads it
as a hang.* I never observed our client, and I never observed a player waiting on a stall. **No number.**
What is grounded is the negative: **2 s is nowhere near the tolerance limit for this audience, so the
design's "no second escalation" rule is safe, and adding an escalation earlier than 5 s would be
inventing a threshold.**

## B4 · A question may sit open for **30 s** and that is normal — nothing may time out a question

**Grounded in [SCRIPT, high confidence for panel presence, medium for it being one question]:** three
spans of 25–30 s with a panel present at every sample (B1's evidence). **[INFERENCE]** at least one of
them is one player thinking about one decision: 16:20→16:45 is simultaneously the most static stretch
of the whole match by field-change and has a card-selection list present at all six samples.

Design consequences, all concrete:
- **No question surface may have a timeout, a countdown, an auto-answer-on-expiry, or a fade.** The
  design has none of these — this is a **confirmation with a number attached**, and the number is
  30 s observed, which is not an upper bound because I only see 5-second marks.
- **The dock band must be able to hold one question for at least a minute without visual decay** — no
  pulsing that becomes irritating, no shimmer that loops 40 times. The design's `1.6 s pulse loop`
  belongs to the *waiting* readings (§3.4), not to a held question; keep it off questions.
- The `zone-pick` glow loop of **1.2 s** (`02 §1`) will run **~25 times** through a 30-second decision.
  I have no evidence it is annoying, so **no change requested** — flagged only so nobody assumes it
  runs three times.

## B5 · The player regains control roughly **every 30–35 s**, so the delta fires **13–15 times per game**

**Grounded in [SHEETS, medium confidence — two measured turns, see P4's warning]:** `TURN CHANGE`
banners bracket one turn at **30 s** (04:05→04:35) and another at **35 s** (24:20→24:55). At ~32 s a
turn, the three observed games (7m15s / 8m10s / 6m55s) hold ≈13–15 turns each.

Consequences:
- The "while you were away" delta (`02 §3.5`) is a surface the player meets **13–15 times per game**,
  every ~30 s, describing **~30 s of opponent activity**. Design it for that size — a handful of rows,
  not a session log. **[INFERENCE]**
- It *"clears on the first action or on `Dismiss`"* (§3.5, F7 step 2). On a 30-second turn the first
  action often comes within a few seconds. The design's simultaneous
  `— since you last acted —` rule in the permanent feed rail is what makes this safe. **Keep both; the
  rail mark is doing the load-bearing work, not the strip.**
- **If the clock ever comes back** (it is deleted), the observed typical turn is ~30 s. That is the
  number any per-handover allowance would have to be built around. Recorded, not proposed.

## B6 · The between-game beat is **~20 s**, and the design's `Play Sakura again` should be built for it, not for an instant bounce

**Grounded in [SHEETS, high confidence for the one boundary I can see]:** `VICTORY` (18:55) → result
frame (19:00) → **`You are Going Second.`** full-screen (19:05) → transition (19:10) → `DUEL` (19:15).
**~20 s in which the player reads and does nothing** (P7).

- The end card (`02 §9`, F9) and the proposed `Play Sakura again` (F9 step 1', 02 §10) sit exactly
  here. The real product's precedent is **~15–20 s of read-only screens between games, including an
  explicit turn-order statement before the board exists**.
- F1's `You go first.` as a dock line is the right content in the wrong register **[INFERENCE]** — the
  client these players use gives it a full screen and a beat of its own.

⚠ **One caveat that could move this number:** the *other* game boundary (10:35→10:45) shows none of
this sequence, which suggests the VOD may be **cut** there. If it is cut, ~20 s is still what the
uncut boundary shows; if it is not cut, then game transitions vary a lot more than one observation
suggests. `10:20–11:00` at 4 fps resolves it (P1).

---

## What is still missing, and exactly which window fills it

These are the numbers the design most wants and that **I will not invent**:

| Number the design needs | Status | What settles it |
|---|---|---|
| `--m-narrate` (600 ms) for a phase/turn narration beat | **No number given.** ~107 s of banner time across three games (P3) divided by a banner count I cannot establish. | `04:00–04:45` at 4 fps: a banner spanning *k* frames is *k*×250 ms, measured directly, plus two exact turn boundaries. |
| How long between committing an action and seeing its consequence | **No number given.** | `07:50–08:35` (chain exchange, prompts at 07:55/08:00/08:05/08:10) and `25:35–26:20` (final attack → damage → room screen). |
| How long a chain exchange takes end to end | **No number given.** | `07:50–08:35`. |
| `--m-settle` (320 ms) card-landing | Below resolution even at 4 fps for the value itself; a window can only say "1 frame or 2". | — |
| Whether a response window is *timed* in this client (the possible green bar at 07:55) | **Guess only, flagged as such (P8).** | `07:50–08:35`. |
| How long a real player spends inside one search/select dialog | **≥25 s from the sheets; the boundaries are unresolved.** | `16:20–17:00`. |
| Whether VOD time equals real time (edit cuts) | **Unresolved, and it conditions every duration above.** The VOD is definitely an edited assembly (P10 — the POV seat changes between games). | `10:20–11:00`. |
| Turn duration **distribution** — the headline number the brief asks for, which I have from exactly two turns | **Not established.** | **Not a window.** The mat's `Turn N` badge (P12) at native 1080p: re-export the 321 existing samples, or just the crop `x∈[1360,1640], y∈[370,590]` of each. That yields every turn boundary in all three games at ±5 s. |
