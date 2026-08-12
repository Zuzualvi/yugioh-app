# Frequency model — how the ZUH-119 gap list was ranked

**This is a model, not a measurement.** Every number here is `[I]` — my estimate from the format,
not from telemetry and not from watching anyone. It exists so the ranking in
`../player-needs-model.md` §4 can be argued with, and so a later measurement can replace it.

---

## 1 · The shape of one Edison duel

| Quantity | Estimate | Basis |
|---|---|---|
| Turns per duel (both players) | **10–16**, call it 12 | Edison is a grindy, trap-heavy, pre-Xyz format; games go to time on paper far more often than modern formats. `[I]` |
| Handovers of control | = turns, **~12** | one per turn boundary, plus a few extra where a response window flips control mid-turn |
| Board actions per player turn | **2–5** | one normal summon, 0–3 sets, 0–2 activations, attacks |
| Engine decisions per board action | **2–6** | measured in the intent-model doc's decision sequences `[D §1]` — a tribute summon is 2–6 |
| Response windows offered per opponent turn, once back rows exist | **0–4** | only offered when a legal response actually exists; the engine auto-passes empty windows `[C EdisonDuel.ts]`, and the verbosity setting narrows further |
| Response windows per duel | **5–20** | above × ~6 opponent turns with meaningful back row |
| Battle phases per duel | **~8** | every turn from turn 2/3 onward |
| Card-identity lookups per duel | **10–40** | lower than it would be for a casual player: a fluent Edison player recognises the pool by art, so lookups skew toward stats, set-card reminders and unfamiliar tech choices `[I]` |
| Duel starts / ends | **1 each** | but 100% incidence, and a match is 2–3 duels |

---

## 2 · How a gap was scored

Two axes, and only the first was used for the ordering:

1. **Hits per duel** — how many times a player lands in the moment *and the need is unmet*.
2. **Incidence** — the share of duels in which it happens at all. Used only to break ties, and to
   keep once-per-duel moments from vanishing (a gap hit once in 100% of duels outranks a gap hit
   twice in 20% of them).

**Stakes were deliberately excluded from the ordering** and noted in prose instead. If stakes were
weighted, gap 1 (the contextless response window) would still be first — it is both the most
frequent decision surface and the most expensive — but gaps 9 and 14 (duel start, duel end) would
rise, because a first impression and a last impression are worth more per occurrence than their
counts suggest.

---

## 3 · The scoring, gap by gap

| Gap | Hits/duel | Incidence | Note |
|---|---|---|---|
| 1 · response window has no subject | 5–20 | ~100% | every window, and each one is a real decision |
| 2 · screen still thinks it is your turn after passing | ~12 | 100% | one per handover, plus every stray click during the opponent's turn |
| 3 · no delta on regaining control | ~12 | 100% | one per handover; more after any reconnect |
| 4 · card identity unobtainable | 10–40 | ~100% | the loop a fluent player runs constantly |
| 5 · fabricated refusal in Battle Phase | ~8+ | ~90% | at least one probe per battle phase; more when the board is wide |
| 6 · clock shows a number that is not yours | ambient | 100% | continuously wrong rather than intermittently |
| 7 · price after commitment | 5–15 | ~90% | every tribute summon and every costed activation |
| 8 · opponent is a string literal | ambient | 100% | low intensity except at the result card |
| 9 · first ten seconds undesigned | 1 | 100% | frames everything after it |
| 10 · layout overflows at the declared floor | ambient | 100% at 1440 | observed in one run at exactly the floor |
| 11 · your priority window vs their response window | 1–4 | ~50% | Edison-specific; only when you hold an ignition effect on your own summon |
| 12 · "have I used my normal summon" | ~6 | ~100% | once per own turn, occasionally twice |
| 13 · no outcome statements | 5–15 | ~90% | one per chain |
| 14 · duel ends into a dead end | 1 | 100% | but the format's unit is a match, so it is really 2–3 per session |
| 15 · a guess and a fact in one widget | 3–6 | ~80% | every multi-step play |

---

## 4 · Where this model is weakest

1. **Response-window count is the softest number in the table** and it drives the top-ranked gap.
   It depends on the deck (a trap-heavy build offers far more windows than a Frog or Quickdraw
   combo build), and on the verbosity setting, which the player controls. If the true number were
   at the bottom of my range (5), gap 1 would still rank first on stakes but would sit closer to
   gaps 2 and 3 on frequency.
2. **Card-identity lookups could be off by a factor of three in either direction.** Fluency cuts
   them down; an unfamiliar opponent deck drives them up. This is the single easiest number to
   measure — one screen recording of one match would settle it.
3. **"Ambient" is doing real work for gaps 6, 8 and 10** and it is not a count. Those three are
   placed by judgement: a persistently wrong clock outranks an anonymous opponent because one
   affects a decision and the other affects a feeling.
4. **Turn count for Edison is from format shape, not from our own data.** We have no telemetry, and
   the app has no completed-duel history to draw on.

**Cheapest way to replace this model with data:** instrument nothing; record one match between two
Edison players and count from the video. Every number above is countable from a single recording.
