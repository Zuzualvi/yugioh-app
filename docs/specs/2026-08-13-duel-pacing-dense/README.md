---
linear_project: Duel Experience Redo
---

# ZUH-139 · The Edison duel at full density — what the 4 fps windows and the turn badges answer

**Source, cited in full because everything here rests on it:** *MBT vs Cimoooooo, Edison format,
Yu-Gi-Oh Master Duel — YouTube VOD by MBTYGO_ProGrussys, 1080p, 26:40, downloaded 2026-08-12*, supplied
as frames on branch `reference/duel-pacing-footage`. I read the six dense 4 fps windows
(`dense/`, 980 frames, 854×480) and the 11 turn-badge montage sheets (`turn-badges/`, native-1080p crops,
1680×1180 each) on 2026-08-13, from my own clone of that branch. This delivery answers the half of
ZUH-131 that was waiting on that footage.

---

## WHAT I COULD NOT SEE. This leads, and each item is written to survive being quoted on its own

1. **The off-turn player's screen is never shown during a turn, so M11 — the interrupt — is only half
   measurable.** The VOD cuts between the two players' own clients and **the editor follows the player
   whose turn it is** (`01` V5). I therefore measured the *turn* player's response prompts (four of them,
   0.25–1.5 s each) and **could not measure the off-turn player's prompt at all**. The model's *"several
   times per opponent turn"* is **not testable from this footage** — not weakly supported, absent. What
   would fix it is a capture of one player's client that never cuts away, which this VOD is not.
2. **There is no cursor in any of the 75 frames I read, and the client's phase / End-Turn controls are
   under a facecam in every frame.** So **no click is directly observable**: "click → consequence"
   cannot be measured from this VOD at any frame rate, and **M9's self-check ("have I used my Normal
   Summon?") is unreachable**, exactly as ZUH-131 judged. When I say a player did not probe, it always
   means "made no inspection this client would have rendered".
3. **No supplied window reaches a game's opening, so M2 (reading an opening hand) is unreached** — and
   game 2's opening does not exist in the artifact at all, because the editor cut it (item 5). One window
   over **03:20–03:55** would reach it.
4. **M7 (backing out) does not occur.** No player enters something and leaves it with nothing sent, in
   four minutes of full-density footage. Untested, not disconfirmed.
5. **The game-1 → game-2 boundary is a hard editorial cut with material removed.** `10-41-1.jpg` is
   game 1's `VICTORY`; `10-41-2.jpg`, **250 ms later**, is game 2's `TURN CHANGE` with both life-point
   plates at 8000. The between-game sequence *and at least game 2's first turn* were excised. **So
   ZUH-131's "game 2 = 8 m 10 s" and "22 m 20 s of live play" are lower bounds, not measurements**, and
   its ~20 s between-game beat rests on **one** boundary — the second instance was destroyed by the edit.
6. **The five sub-second design tokens still have no numbers, and this is the part of ZUH-131 I am most
   confident in.** `--m-instant` 90 ms · `--m-quick` 140 ms · `--m-base` 200 ms · `--m-settle` 320 ms ·
   the 150 ms hover threshold. **4 fps is 250 ms per frame.** Anyone quoting a number for these is
   quoting an invention.
7. **Every timestamp printed on the turn-badge montages is ≈2.3 s earlier than the frame it shows**
   (`01` V6, filed as ZUH-142). A constant offset, so **durations are unaffected**; absolute placements
   move by ~2.3 s. I found it because the badges and the dense windows contradicted each other outright
   at the game boundary.
8. **Every duration in this delivery is an upper bound from a performed, commentated match.** No audio
   was supplied, so I cannot even tell when a player was talking instead of playing. Two streamers
   narrating think slower and talk to fill silence.
9. **Four minutes of a twenty-six minute video.** Everything tagged `[4FPS]` describes 980 frames from
   six windows. The turn distribution is the only finding that covers the whole match.

---

## The five things a reader should take away

1. **VOD time is real time to ±0.5 s across a feed switch, and NOT real time at the game-1 boundary.**
   Validity checked first, as asked (`01` Part A).
2. **Turn duration is not 30 s. Median 35 s, mean 44 s, p25–p75 25–65 s, range 10–100 s, n = 27**, across
   all three games from the badges (`01` V7). A quarter of turns run 65–100 s.
3. **Control returns to a given player about six times per game, not 13–15** — 12, ≥10 and 12 turns per
   game, half of them each. ZUH-131's B5/C5 and the needs model's M3 frequency are both 2–3× too high
   (`01` V8).
4. **A response prompt in the reference client is answered in about one second** (four measured,
   0.25–1.5 s), while a deliberative question stays open **25.75 s** and a player's own think runs
   **≥30 s with no board change at all**. The client's rhythm is bimodal with nothing in between — and a
   2.4 s receipt falls in the empty middle (`02`, `03` B1).
5. **The needs model's M4 is wrong about behaviour in the one place we can check it.** It says fluent
   players probe constantly; in the only 30-second own-turn think available at full density there is **not
   one visible probe** (`02` M4).

## Where the prior work is corrected rather than confirmed

| Prior claim | What the density says |
|---|---|
| P10 / C6: "the POV seat changes **between games**" | **Wrong in scope.** It changes **~34 times across the match**, many times per game (`01` V1, V2). P10's two zoom reads were accurate; the generalisation was not. |
| P1 ⚠: the 10:35→10:45 boundary might be a cut | **It is a cut** (`01` V4). |
| P4: "two turns, 30 s and 35 s — not a distribution" | **Its refusal was right and its two numbers were lucky** — they straddle the true median. Its coverage was the problem: the real range is 10–100 s (`01` V7, V8). |
| P8: a possible green response-countdown bar | **Dead.** The green element is a **two-segment step indicator, `1` filled and `2` empty**, static across all four frames (`02` M11). |
| P11: the 07:55 dialog is "the client's equivalent of the auto-answer receipt" | **Misidentified.** It is a **question** titled `Use which effect?`. **B1's second argument is withdrawn** and replaced by a stronger one (`03` B1). |
| B5: "control returns every 30–35 s, delta fires 13–15×/game" | **Wrong twice** (`01` V8, `03` B5). |
| B4: "[INFERENCE] at least one of those spans is one player on one decision" | **No longer an inference** — one dialog, 25.75 s, measured (`03` B4). |
| C5 / model M3: "~12–20 handovers per duel" | **2–3× too high** if it means control coming back to *me* (`01` V8). |

## Files

| File | Holds |
|---|---|
| `01-validity-and-turns.md` | The validity check (V1–V6) and the turn distribution per game (V7–V9). **Read V1–V4 before using any duration from ZUH-131.** |
| `02-moments.md` | M11, M6, M4, M5, M8, M9 measured; M2 and M7 declared unreached with reasons |
| `03-budgets-retest.md` | B1–B6 re-tested one by one, plus ZUH-131's "no number given" table closed where it can be |
| `04-method.md` | Every image read, every script, the four techniques that failed, and the limits on every number |

## Two things this delivery deliberately does not contain

- **No layout, styling or visual-design recommendation of any kind.** Master Duel's interface is covered
  by the separate competitor teardown. Where I describe a surface (a step indicator, a blocking result
  screen) it is to establish **whether the information exists and how long it lives**, never how ours
  should look.
- **No number for anything below 250 ms**, and no replacement value for `--m-receipt` beyond "delete the
  timer". ZUH-131's refusals are the part of it I trust most, and they survive intact.
