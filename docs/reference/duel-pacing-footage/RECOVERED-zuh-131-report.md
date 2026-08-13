# RECOVERED — the ZUH-131 pacing report, as delivered, before its files were lost

⚠️ **PROVENANCE, READ THIS FIRST.** This is the Researcher's own delivery message, recovered
verbatim from the CMA session trace of `sesn_01S5dntbNHbM3L8xrpuD31My` after that session was
terminated mid-handoff. **It was not written by the researcher into this repo, and nobody has
re-derived or re-verified it.** The underlying files — `README.md`, `01-pacing-findings.md`
(P1–P12), `02-needs-model-test.md` (contradictions C1–C6), `03-timing-budgets.md` (B1–B6),
`04-method.md` — were written to `/workspace/product/redo/pacing/` in a sandbox that no longer
exists. **They are gone.** What follows is the summary that survived; treat every figure as
reported-not-reproduced.

Method it declared: **15 image reads total** — 13 contact sheets plus 2 composited zoom
montages. No audio was available (see `dense/README.md` for why chasing a transcript is the
wrong move).

---

## The three headline pacing facts

1. **It is a three-game MATCH, not a duel** — ~22 minutes of play across 3 games of ~7–8
   minutes. **The duel-start and duel-end moments each fire 3× in 26 minutes**, and players are
   returned to a room screen *with the same opponent* and restart.
2. **26.5% of live play (73 of 275 evenly-spaced samples, ±3pp) has a text panel over the
   bottom centre of the screen**, with three spans of 25–30 s where a panel is present at every
   5 s mark. 🔑 **The unit of a real player's attention on one screen state is tens of seconds,
   not seconds.**
3. **~8% of play is a full-width phase banner or full-screen flash**, and both game-ending
   damage beats ran **≥5 s**.

## Where it CONTRADICTED the needs model

- 🔴 **Gap 14 / M14 — "the duel ends into a dead end"** was ranked **14th of 15** at *"1 hit per
  duel"*. **Wrong by 3×, and it is the session loop, not an edge case.** `Play {opponent} again`
  should come out of "proposed".
- **M1 is not "the first ten seconds"** — the real client spends **~20 s** on `VICTORY` → result
  → a full-screen `You are Going Second.` → `DUEL`.
- **M3's "the scan happens in about two seconds"** is *"an untestable number wearing a fact's
  clothes."*
- **Confirmed:** M3/M10's 12–20 handovers (≈13–15 per game), M10's "half the duel", and M12.

## Timing budgets it proposed

| Token / rule | Verdict |
|---|---|
| `--m-receipt` 2400 ms | **Delete the timer.** Persist until superseded or the next action; ≥10 s if a timer is mandatory. The reference client's equivalent is a modal reading `● Draw 1 card.` + `OK` that **waits for a click**. |
| Error strip 8 s exit | **No timeout.** |
| "No escalation after 2 s" | **Keep, and add none before 5 s.** |
| Question timeouts | 🔴 **No question may ever time out. 30 s open is normal.** |
| Between-game beat | ≈ **15–20 s** |
| `--m-instant` / `quick` / `base` / `settle`, hover, hang threshold | **It gives no number** — below the instrument's resolution or unobserved. |

✅ **Note what it refused to do.** It declined to invent five numbers it could not measure, and
said so explicitly. That refusal is the most trustworthy thing in this report and it should
survive into whatever replaces it.

## What it still wanted

**Its highest-value ask has been fulfilled** — see `turn-badges/`. It asked for the 321 samples
re-exported at native resolution to read the mat's `Turn N` badge, because **turn duration
currently rests on two observed turns (30 s and 35 s)**.

Dense 4 fps windows, still wanted, its ranking: `07:50–08:35` · `16:20–17:00` · `04:00–04:45` ·
`10:20–11:00` · `13:40–14:10` · `25:35–26:20`. **All six are already in `dense/`.** Note the PL
promoted `10:20–11:00` to first on the grounds that it is the game-1 boundary and settles
whether the VOD is cut — if it is, VOD elapsed ≠ real elapsed and every duration above is
suspect. **That validity check has not been done.**
