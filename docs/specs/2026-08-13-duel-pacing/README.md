---
linear_project: Duel Experience Redo
---

# ZUH-131 · How an Edison duel is actually paced — pointer and limits

**Source, cited in full because everything here rests on it:** *MBT vs Cimoooooo, Edison format,
Yu-Gi-Oh Master Duel — YouTube VOD by MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12*,
supplied as frames on branch `reference/duel-pacing-footage` at
`docs/reference/duel-pacing-footage/`. I read it on 2026-08-13 from my own clone of that branch.

## WHAT I COULD NOT SEE — this leads, and it is meant to be quotable on its own

1. **I have no audio and no transcript.** The repo carries frames only: thirteen contact sheets and
   321 JPEGs. **Every question in the brief that depends on the commentary — "where the commentary
   reveals a player deliberating over something the board does not show" — is unanswered, and it is
   unanswerable from what I was given.** Not "weakly supported": absent. I asked the coordinator for
   a transcript or the VOD URL. Nothing in these files should be read as a player's stated reasoning.
2. **The 5-second sampling cannot see a single action.** A summon, a chain link, a click, a confirm,
   a cancel and a rejection all complete inside one 5-second gap. Everything in
   `01-pacing-findings.md` marked **[SHEETS]** is a statement about *how much of the duel looks like
   X*, never about what happened between two frames. Where full-density windows were supplied, those
   claims are marked **[4FPS]** and name their window.
3. **Whose turn it is is not recoverable from the 5-second samples *as supplied*.** I tried two
   automated signals (field-edge tint; per-step field change) against the five `TURN CHANGE` banner
   timestamps I could read off the sheets. Neither separated. So **turn count, turn duration and the
   split between own-turn and opponent-turn time are not established** — two turns are bounded, and
   that is all. **But there is a cheap fix and it is not another window:** the mat carries a
   **`Turn N` badge at a fixed screen position in every frame** (finding P12). Its digits are ~8 px
   tall at the 640×360 resolution supplied and unreadable; at native 1080p they are ~24 px and
   mechanically readable. **Re-exporting the 321 existing samples at native resolution — or just the
   crop `x∈[1360,1640], y∈[370,590]` of each — would produce a turn-by-turn timeline for all three
   games at ±5 s.** That is the highest-value item on my ask list.
4. **The client's own phase controls are never visible.** The bottom-right facecam overlay covers
   approximately x∈[0.68,1.0], y∈[0.62,1.0] of every frame, which is where Master Duel places its
   phase / End-Turn controls. I never see the player's hand reach a control, and I never see the
   control change state. No claim here rests on one.
5. **This is not one duel, and it is not one capture.** It is a **three-game match** (finding P1) and
   the **seat the camera sits in changes between games** (finding P10) — so the VOD is an edited
   assembly, and every duration in these files is a duration in *VOD time*. Roughly 22 of the 26:40 is
   live play.
6. **I published a finding and then falsified it myself.** An early version of P6 said the client
   "narrates continuously" via card-text panels at the field edges. Zoomed, those panels are the
   **stream's live chat overlay** — a broadcast artefact, not Master Duel. The finding is struck
   through rather than deleted. **This is a broadcast; it carries two facecams and a chat feed that
   are not the product, and anything read off the edge of a frame is suspect until it is zoomed.**
7. **One of the fifteen moments cannot be tested by this footage at all: M15 (disruption) — the event
   never occurs.** No reconnect, no drop, no walk-away in 26:40. Two more, M2 (reading an opening
   hand) and M7 (backing out), are only marginally reachable even at 4 fps, because both are about
   what the player finds out on demand rather than about pace. Saying these are "unconfirmed" would
   misdescribe them: the instrument does not reach them.
8. **No finding in this delivery rests on a full-density window.** I requested six (listed at the end
   of `03-timing-budgets.md` with what each settles); none had arrived when I wrote this. Everything
   here is the 5-second sampled set plus two zoom reads. The numbers I refuse to give are refused
   because those windows are missing, not because I ran out of time.

## Two things I decided on my own, and one I did not decide alone

Nothing here changed a file anyone else owns; I wrote only under `/workspace/product/redo/pacing/` and
committed nothing to any branch. The judgement calls were:

## Files

| File | Holds |
|---|---|
| `01-pacing-findings.md` | The pacing facts P1–P12, each with provenance and confidence, and the numbers behind them |
| `02-needs-model-test.md` | All fifteen moments of `2026-08-12-duel-player-needs-model.md` tested one by one; the contradictions (C1–C6) are listed first |
| `03-timing-budgets.md` | Concrete numbers for the design's timing tokens (B1–B6), the ones I refuse to give, and which window settles each |
| `04-method.md` | Exactly what I ran, what I validated it against, what it conflates, and the three techniques that failed |

## Two things I decided on my own

- **I read 13 contact sheets and 5 individual frames, and nothing else.** Every quantitative finding
  comes from the sheets plus scripted analysis of the 321 JPEGs (pixel statistics, no images into
  context). Late in the task I spent **two image reads** on zoomed crops of 5 frames — `07:55`,
  `14:00`, `04:15`, `08:35`, `22:10` — composited into two montages so several regions cost one read
  each. **That decision paid for itself three times over**: it falsified P6, produced P10, P11 and
  P12, and killed one guess in P8. Total: 15 images.
- **I stopped after two failed attempts at recovering turn ownership** (limit 3 above) and reported it
  as a gap with a cheap fix rather than trying a third technique.
- **The cost of the low read budget:** anything needing legible small text that I did *not* zoom —
  exact life-point values over time, deck counts, the identity of a card inside an open dialog — is
  reported at low confidence or not at all.
