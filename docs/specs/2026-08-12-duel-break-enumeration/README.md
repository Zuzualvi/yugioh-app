---
linear_project: Duel Experience Redo
---

# Evidence for the shipped-duel break enumeration

Supporting evidence for `docs/specs/2026-08-12-duel-break-enumeration.md` (discovery issue
ZUH-118, Linear Project **Duel Experience Redo**).

| Folder | What it is |
| --- | --- |
| `logs/` | 15 scenario logs. Each contains the browser console output, **every WebSocket frame in both directions**, and DOM probe results (including `document.elementFromPoint` checks). These are the primary evidence — a finding that cites `logs/sN-*.log` can be checked against the actual wire traffic. ⚠️ **The files here carry a `.log.txt` extension, not `.log`** — the repo's `.gitignore` excludes `*.log`, which would have silently dropped the entire evidence set from this commit. The enumeration's citations name them as `.log`; append `.txt` when you go looking. |
| `driver/` | The Playwright drivers that produced the logs, one per scenario, plus `lib.mjs` and `insertDeck.mjs`. **Re-runnable** — this is what makes the findings reproducible rather than merely recorded. |

## What is NOT here, and why

**The 113 screenshots are not committed.** They were 8.7 MB of PNGs of a surface this project
exists to replace, and the drivers regenerate them. If you need a frame, re-run the scenario
rather than trusting an archived image of a build that has moved on.

## How the run was configured — read this before re-running

Two deliberate departures from the repo's default harness. Both are recorded as repo defects
rather than worked around silently, and both change what you will see if you do *not* apply them:

1. **A custom Edison-legal deck was inserted into the harness database** by `driver/insertDeck.mjs`.
   The repo's seeded E2E deck is 40 vanilla monsters, which cannot reach **any** chain, effect or
   tribute path — so the default harness cannot exercise most of the duel screen. Filed as ZUH-126.
2. **`packages/web` was rebuilt with `VITE_IMAGE_BASE_URL` set.** Without it,
   `cardImageUrl.ts` takes the `import.meta.env.PROD` branch and emits `src="undefined/<id>.jpg"`
   for every card. Filed as ZUH-127. ⚠️ **This means the repo's own `npm run test:e2e` suite runs
   against a board with no card art at all**, and every Playwright screenshot ever taken from that
   suite has been of an empty-looking board.

Neither departure touched a repo file. Both are stated here because a re-run without them produces
materially different results, and because item 2 retroactively devalues visual evidence taken from
the standard suite.

## Confidence

The run was against `master` at `f86683c`, locally, on the repo's own same-origin harness with the
**real ocgcore WASM engine** — not a mock — in two independent browser contexts at 1440×900.
Findings 27–29 were found by reading the running render path and were **never triggered in play**;
they are flagged as such in the enumeration and must not be read as observed. The COVERAGE section
of the enumeration states which flows were driven to completion and which were not reached.
