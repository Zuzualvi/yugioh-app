---
linear_project: Duel Experience Redo
---

# 03 · ZUH-131's timing budgets B1–B6, re-tested against 4 fps

Against `docs/specs/2026-08-13-duel-pacing/03-timing-budgets.md` (published, immutable). Source and
tags as in `01-validity-and-turns.md`. **Read `01` first** — the VOD is a two-feed edit and the
game-1 boundary is a hard cut (V1–V4).

## 🔴 The five refusals survive, unchanged and unweakened

`--m-instant` **90 ms** · `--m-quick` **140 ms** · `--m-base` **200 ms** · `--m-settle` **320 ms** ·
the **150 ms** hover threshold. **4 fps is 250 ms per frame. I give no number for any of them.** A
90 ms transition is at most one frame and usually zero. ZUH-131 refused because the instrument does not
reach them, and a four-times-denser instrument that is still 250 ms does not reach them either. **Anyone
who wants those five values needs a build and a stopwatch, or a capture of our own client.**

---

## B1 · `--m-receipt` 2400 ms → **the conclusion survives; one of its two arguments is withdrawn, and it is replaced by a better one**

**ZUH-131's B1: "remove the timer; if one is required, ≥10 s."** It rested on two things.

**Argument 1 — the surrounding rhythm is 25–30 s — is CONFIRMED and upgraded from inference to
measurement.** ZUH-131 had "a panel was present at every 5-second sample across 16:20→16:45" and could
not say whether that was one question or four. **[4FPS · 16-20_17-00]** it is **one dialog, continuously
present for 25.75 s** (103 consecutive frames), ended by the player's own selection
(`02-moments.md` M4). And **[4FPS · 13-40_14-10]** a separate 30.00 s stretch of one player's own main
phase has **no board change at all** (median frame difference 1.23, max 6.22). The claim that a real
player's unit of attention on one screen state is tens of seconds is now measured, not sampled.

**Argument 2 — "the reference product does not fade this information out, it blocks until the player
acknowledges it" — is WITHDRAWN.** It rested on ZUH-131 P11's identification of the 07:55 dialog as *the
commercial client's equivalent of the auto-answer receipt*. At 4 fps that dialog reads **`Use which
effect?`**, with one radio option, an `OK` button and a **two-segment step indicator (`1` filled, `2`
empty)** (`02-moments.md` M11). **It is a question, not a receipt.** Nothing in the six dense windows is
an auto-answer receipt, so **this footage contains no reference-product precedent for that surface at
all.** Delete that argument; do not quote "the reference product waits for you" as evidence about
receipts.

**The replacement argument, which is stronger than the one it replaces. [4FPS, medium-high confidence.]**
The client's own timings are **bimodal**, with nothing in between:

- **reflexive prompts live 0.25–1.5 s** and are answered inside that (four measured, `02-moments.md` M11);
- **deliberative surfaces live 25–30 s+** (the 25.75 s search dialog; the 30 s static think).

**A 2.4 s artefact falls in the empty valley between the two modes.** In a fast sequence the next
question arrives in ~1 s, so the design's existing `superseded` state clears the receipt long before
2.4 s and the timer never fires. In a slow sequence the player is elsewhere for 25–30 s, so 2.4 s is
gone before they look back and the timer is worse than useless. **The timer does no work in either mode.**
ZUH-131's conclusion — *persist until superseded or until the player's next action, and delete the
timer* — is therefore supported by the density, by a different route.

**One correction to make loudly: do not print "≥10 s" as a measured figure.** Nothing here or in
ZUH-131 measures a receipt lifetime. If a timer is mandatory the evidence gives no value for it; it only
says 2.4 s is in the gap between the two observed modes.

## B2 · The error line's 8 s exit → **UNTESTED. No rejection ever occurs**

**Confidence: high in the refusal.** B2 argued the amber "the server rejected your answer" line must
persist, on the same 25–30 s dwell evidence as B1. **That dwell evidence is confirmed (B1 above), so B2's
premise is stronger than it was.** But **no answer is rejected anywhere in the 980 dense frames** — no
error strip, no refusal message, no re-ask. **The specific behaviour B2 is about is not in this footage
and 4 fps does not change that.** B2 remains a reasonable inference from B1's evidence; it is not an
observation, and it should not be promoted to one.

## B3 · "No second escalation before 5 s" → **CONFIRMED, with two measured animation lengths, and the number I still will not give**

**[4FPS · 25-35_26-20, 10-20_11-00, 07-50_08-35]. Confidence: medium-high.**

ZUH-131 had "both game-ending damage sequences ran ≥5 s across two consecutive samples". Measured:

| Beat | Measured length | Where |
|---|---|---|
| Full-screen red damage band, game 3 | **2.00 s** (26:09.50 → 26:11.25) | `25-35_26-20` |
| Full-screen red damage band, game 1 | **2.25 s** (10:34.50 → 10:36.50) | `10-20_11-00` |
| Lethal damage flash → result screen, game 3 | **≈6.5 s** | `25-35_26-20` |
| Lethal damage flash → result screen, game 1 | **≈6.75 s** | `10-20_11-00` |
| A chain answer → its visible consequence | **≈2.0 s**, of which ~1.5 s shows nothing happening | `07-50_08-35` |
| A whole chain exchange, end to end | **3.0 s** (07:54.00 → 07:57.00) and **4.25 s** (08:04.50 → 08:08.75) | `07-50_08-35` |

**So this client routinely runs 2–6.75 s of animation with no input available, including a 1.5 s stretch
after an answer in which nothing visibly happens, and neither player shows any reaction to any of it.**
B3's negative claim — *2 s is nowhere near the tolerance limit for this audience, so "no second
escalation" is safe and an escalation earlier than 5 s would be inventing a threshold* — **holds, now
with measured beats rather than sampled ones.**

**The number I will not give, for the same reason ZUH-131 did not:** how long a `Resolving…` reading may
sit before a real player reads it as a hang. I never observed our client and I never observed a player
waiting on a stall. The 30 s static stretch in `13-40_14-10` is the **player** being slow and knowing it
— it is not a tolerance measurement and must not be quoted as one.

## B4 · "A question may sit open for 30 s and nothing may time out a question" → **CONFIRMED, and its inference is now a measurement**

**[4FPS · 16-20_17-00] + [SCRIPT]. Confidence: high.**

ZUH-131's B4 was *"[INFERENCE] at least one of them is one player thinking about one decision"*. It is
no longer an inference: **`Select the card(s) to add from your Deck to your hand.` is open continuously
for 25.75 s** (16:21.25 → 16:46.75, 103 frames, no frame below threshold), the player browses inside it
(~20 content changes, with quiet stretches up to 5 s), and it ends when they select
(`02-moments.md` M4). **One question. 25.75 s. No timeout, no countdown, no auto-answer, no fade.**

Two refinements to B4's numbers:

- **25.75 s measured, not 30 s.** B4's 30 s came from 5-second sampling of a different span. The
  measured single-question maximum in this footage is 25.75 s, and it is still not an upper bound —
  it is the longest one that happens to fall inside a supplied window.
- **B4's "the dock band must hold one question for at least a minute without visual decay" is not
  contradicted and is not measured.** No single question in these windows lasts a minute. What *does*
  last longer than a minute is a **turn**: the longest is 100 s (`01-validity-and-turns.md` V7), so a
  question sitting through most of a turn is plausible. Keep the requirement; do not cite a
  measurement for it.
- B4's note that the `zone-pick` 1.2 s glow loop *"will run ~25 times through a 30-second decision"* is
  confirmed in scale: through the measured 25.75 s decision it would run **~21 times**.

## B5 · "Control returns every 30–35 s, the delta fires 13–15 times per game" → **WRONG TWICE. See `01-validity-and-turns.md` V8**

**[BADGES · sheets 01–10]. Confidence: high.** The full turn timeline gives:

- **turn duration: median 35 s, mean 44 s, p25–p75 25–65 s, range 10–100 s, n = 27**;
- **turns per game: 12, ≥10, 12** — so **each player owns about six turns per game**;
- therefore **control returns to a given player ~6 times per game, at intervals of median ~70 s /
  mean ~88 s** — not "13–15 times, every 30–35 s".

B5's per-turn value of ~30 s was close to the median and its *count* double-counted: it counted every
turn boundary rather than every *own*-turn boundary. **The design consequence inverts: the delta strip
is met about half as often as B5 says, and each visit has to describe up to 100 s of opponent activity
rather than ~30 s.** B5's instruction to design it as "a handful of rows, not a session log" is the part
that needs revisiting. Full detail and the knock-on to the needs model's M3 frequency is in V8.

## B6 · "The between-game beat is ~20 s" → **STILL n = 1, and the second instance was destroyed by the edit, not by the instrument**

**[4FPS · 10-20_11-00]. Confidence: high for the reason, unchanged for the number.**

B6 carried a caveat: *"the other game boundary (10:35→10:45) shows none of this sequence, which suggests
the VOD may be cut there"*. **It is cut** — `10-41-1.jpg` is game 1's `VICTORY` and `10-41-2.jpg`, 250 ms
later, is game 2's `TURN CHANGE` with both plates at 8000 (V4). The whole between-game sequence and at
least game 2's first turn were removed by the editor.

So B6's ~20 s still rests on the single 18:55 → 19:15 boundary, **and no dense window covers it**, so
4 fps neither confirms nor refines it. **Report it as n = 1.** What 4 fps does add is the *front* of that
beat, from the two game endings that windows do cover: **the lethal damage flash to the result screen is
≈6.5 s, twice**, and the result screen at 26:16.75 carries an **`OK` button** — it blocks rather than
auto-advancing, for at least the 3 s I can see before the window ends. **[INFERENCE]** so ~20 s of
between-game reading plausibly decomposes as ~6.5 s of animation, then a result screen that waits, then
the turn-order statement and the `DUEL` banner. The decomposition is inference; the 6.5 s is measured.

---

## The "no number given" table from ZUH-131, now closed where it can be

| Number the design needs | ZUH-131 status | Now |
|---|---|---|
| `--m-narrate` 600 ms for a phase/turn narration beat | no number | **The `TURN CHANGE` banner is on screen ≈1 s** (partial sweep → ~0.5 s full-width → a visible ghost/fade → gone) and **the `DRAW PHASE` banner that follows is gone within 0.5 s**; the whole `END PHASE → TURN CHANGE → DRAW` handover runs **≈2.5 s** (`02-moments.md` M9). **600 ms is inside the observed register for a single phase banner.** Two turn boundaries, medium confidence. |
| Committing → seeing the consequence | no number | **Click → consequence is unreachable** (no cursor, controls occluded). **Answer → consequence ≈2.0 s**, n=1 (`02-moments.md` M5). |
| A chain exchange end to end | no number | **3.0 s and 4.25 s**, two observations, one feed, game 1 turn 7 (B3 table). |
| `--m-settle` 320 ms card-landing | below resolution | **Still below resolution. No number.** |
| Whether a response window is *timed* in this client | guess only (P8) | **It is not timed.** The green bar at 07:55 is a two-segment step indicator (`1` filled, `2` empty), static across all four frames. **P8 is dead** (`02-moments.md` M11). |
| How long a player spends inside one search/select dialog | ≥25 s, boundaries unresolved | **25.75 s, one continuous question, boundaries resolved** (B4). |
| Whether VOD time equals real time | unresolved | **Mostly yes, to ±0.5 s across a feed switch; NO at the game-1 boundary, which is a hard cut with material removed** (V3, V4). |
| Turn duration distribution | not established | **Established: median 35 s, mean 44 s, 10–100 s, n=27** (V7). |
| How long a response prompt sits before it is answered | not asked | **0.25–1.5 s, four observations** (`02-moments.md` M11). |
