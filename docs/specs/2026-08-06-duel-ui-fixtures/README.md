---
linear_project: Duel UI Rebuild
---

# Duel UI Rebuild — fixtures and the F14 reference test

**Date:** 2026-08-06 · **Spec:** `docs/specs/2026-08-06-duel-ui-design.md` · **Discovery issue:** ZUH-81

## Why these files are in `docs/` and not under `packages/`

They were written for the design prototype on branch `proto/duel-ui`, which is **structurally unmergeable by design** — fixture-driven, unreviewed, untested code must not be able to reach the product. But two things on that branch are **dependencies of permanent acceptance criteria**, so they cannot live only on a branch that can never merge:

- **the fixtures** — the design spec's acceptance criteria require auto-answer behaviour to be unit-tested against them, and they are the intended visual-regression baselines;
- **`answer-matrix.py`** — the reference implementation of **requirement F14** (for any decision with more than one legal answer, distinct answers must produce distinct observable outcomes). F14 is a permanent gate; a disposable branch cannot be a dependency of one.

So they are relocated here rather than left dangling. This is deliberate and was called by the CEO on 2026-08-06.

## They are NOT buildable source yet, and that is why they are docs

These are typed against **copied shapes with the MH-1 delta already applied** — `ZoneCard` carrying a zone `sequence` plus `attack`/`defense`/`level`/`isPublic`. Those fields do not exist in `packages/contracts` yet. **These files will not typecheck against the real contracts until MH-1 ships.** Putting them under `packages/` today would break the build for a capability that has not landed.

`docs/` is excluded from `prettier` (`.prettierignore`) and `arch:check` only cruises `packages/`, so nothing in this folder is gated by the normal source pipeline. That is correct for now and is the whole reason they sit here.

## What engineering does with them

**When MH-1 ships**, port them into the test tree:

1. Delete the copied local shapes in `types.ts` and import the real ones from `@yugioh-app/contracts`. If anything fails to typecheck, that is a genuine disagreement between the design's assumed shape and the shipped contract — **raise it, do not reshape the fixture to fit.** The fixtures record what the design was built against.
2. Move the data files into the web package's test fixtures and wire them as visual-regression baselines.
3. Reimplement `answer-matrix.py` as a real test in the repo's test runner. It exits non-zero on any collision; keep that property — it is the gate, not a report.
4. Update the reference paths in `docs/specs/2026-08-06-duel-ui-design.md` in the same PR, so the spec points at the live tests instead of here.

## Contents

| File | What it is |
| --- | --- |
| `types.ts` | The copied contract shapes, **with the MH-1 delta applied**. Read this first — it is the design's assumed data model. |
| `cards.ts` | Card records for the 18 passcodes the design uses. Includes pre-errata text where our corpus overrides the printed card. |
| `preErrata.ts` | The errata-override set the C13 provenance badge keys off. Mirrors `docs/reference/2026-07-13-preerrata-desc-overrides.json`. |
| `board.ts` | Board states. |
| `scenarios.ts` | The four driveable scenarios as step sequences, each multi-answer step carrying its `branch(answer)`. |
| `answer-matrix.py` | The F14 reference test: enumerates every legal answer at every decision point and fails on any collision. 8 decision points, 24 answers, 0 collisions at the time of writing. |

## One warning carried over from the design work

`preErrata.ts` and the pre-errata text in `cards.ts` must stay **verbatim** from `docs/reference/2026-07-13-preerrata-desc-overrides.json`. A paraphrase was found in the Necrovalley entry during the design and corrected: the C13 badge asserts that our text is authoritative over the printed card face, so invented text under that badge would be worse than showing no badge at all. Do not hand-edit these strings.
