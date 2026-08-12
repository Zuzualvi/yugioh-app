---
linear_project: Duel Experience Redo
---

# Supporting material for the duel player-needs model

Companion files to `docs/specs/2026-08-12-duel-player-needs-model.md` (discovery issue ZUH-119,
Linear Project **Duel Experience Redo**).

| File | What it is |
| --- | --- |
| `evidence-index.md` | Every claim in the needs model, with its evidence tag and source. Read this before treating any statement in the model as verified. |
| `frequency-model.md` | The arithmetic behind the "hits per duel" column of the ranked gap list in §4 of the model. |

## How much to trust this, in one paragraph

The needs model was produced **without running the application**. Every claim about shipped
behaviour is tagged in the source: `[C]` means *code read at `file:line`* — what the code does, not
what a player experiences; `[O-118]` means *observed in a screenshot captured by the parallel
ZUH-118 investigation*, one run, one deck, one viewport; `[D]` means *the previous project's design
spec*; `[I]` means *inference*. The needs themselves (§3 of the model) are **inference argued from
the domain**, not research. The frequency ranking is a model, not a measurement — the author rates
the order of gaps 1–5 as robust and the order of 6–15 as not.

Three findings ranked 1, 2 and 3 were **independently re-verified against the code by the Product
Lead** on 2026-08-12 rather than accepted on report; that verification is recorded in the Duel
Experience Redo PRD decision log. The remainder are not independently verified.

The cheapest thing that would convert most of this from inference to evidence is named in §8 of the
model: two Edison players, one match, on the shipped build, screen-recorded.
