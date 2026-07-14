# HANDOFF — Edison App state & how to pick up (2026-07-14)

**Author:** CTO • **For:** the next CTO session (likely fresh context).
**Read this first, then `docs/working/2026-07-13-CTO-BRIEF.md` for product context.**

> **IMPORTANT:** The CEO is making updates to tooling / harness / process and will give the
> next session a BRIEF on what changed. Read that brief first. Do **not** assume the
> environment or tooling notes below still hold — defer to the CEO's brief. This document
> covers the **code / build state** only; it deliberately does not prescribe how any
> infra/tooling issues will be solved (that's the CEO's call, pending).

---

## TL;DR — where the code is
- **CI (GitHub Actions) is RED on recent master commits.** My local `npm run verify` at
  `bfd86ce` passed (372 pass, 11 WASM-skipped; typecheck/prettier/arch green) — but that is
  **not** the same as CI, and the two disagree. **Treat CI as red / unverified.** Local
  passing means the cause is something local verify doesn't reproduce — most likely the
  deploy job or a CI-environment difference (`npm ci` native builds, or tests that need
  gitignored vendored assets absent in CI), not the local unit suite. Unconfirmed — needs
  real GitHub Actions log visibility.
- **Stream 1 (card-text fix): DONE.**
- **Stream 2 (dueling slice, scope B = synchronous invite-link duels): all four build
  slices LANDED** (contracts, engine, web UI, server infra) + card-script curation done.
- **Remaining engineering = the ACCURACY layer:** empirical rule tests + 13-card Lua
  authoring + QA verification — all pending a runnable engine (the custom WASM artifact
  is not yet built).

## Slice status
| Slice | Package | Status | SHA |
|---|---|---|---|
| 00 Duel contracts | contracts | ✅ DONE (31 tests) | 2c96c8c |
| 10 Engine core (WASM, EDISON_FLAGS, #10 patch, redaction, determinism) | engine | ✅ landed; **empirical tests SKIPPED pending WASM** | eb5e40d (+ cycle fix bfd86ce) |
| 20 Server duel infra (lifecycle, persistence, WS relay, timer, reconnect) | server | ✅ landed (150 pass, 1 skip); scoped-verify only → **needs QA** | 3de754e |
| 30 Web duel UI (board, action panel, timer, create/join-link) | web | ✅ landed (93 tests); full loop vs mock → **needs QA** | 701f548 |
| 40 Card-script curation (diff+stage) | spikes/ | ✅ DONE — 11 drop-in + 1 fixed staged, 5 modern-ok, 6 rules-level, 13 need authoring | b3d28f6 |
| 50 Rules-validation tests (QA) | engine/server | ⏳ pending runnable WASM engine | — |
| CTO Lua authoring — 13 cards | engine overrides | ⏳ pending runnable WASM engine | — |

Board: `tasks/BOARD.md`. Specs: `/workspace/specs/stream2-*.md`.

## Remaining engineering work (code)
1. **Enable the custom WASM engine artifact** so the empirical tests can run — currently
   the engine's 10 empirical tests + the server's 1 integration test skip when it's absent.
   (Build script: `packages/engine/scripts/build-wasm.sh`; artifact expected at
   `packages/engine/vendor/`, plus `packages/engine/assets/cards.cdb` + scripts for the
   tests to execute.)
2. **Author the 13 gap cards** (worklist + gap notes: `spikes/card-script-curation/REPORT.md`)
   and wire the curated/staged `.lua` into `packages/engine/scripts/edison-overrides/`.
3. **QA independently verify** slices 20 (server) + 30 (web) — they landed on scoped verify
   only — and own the end-to-end rules suite.

## Critical path to the accuracy promise (the product's whole point)
Nothing has yet *proven* that two legal Edison decks reproduce March-2010 behavior. The
chain: runnable engine → engine empirical tests (#5/#9/#11 confirm, #7/#8/#4 test, #10
verify) → author the 13 gap cards → wire overrides → QA runs the rules suite end-to-end.
This is the top engineering priority.

## How to pick up (first actions)
1. **Read the CEO's tooling/process brief.**
2. **Get real CI visibility and find why GitHub Actions is red** on recent master commits
   (local `npm run verify` passes, so it's likely the deploy job or a CI-environment
   difference — not the unit suite). Get CI actually green before feature work.
3. Stand QA up as the independent gate for the landed slices (they had scoped verify only).
4. Drive the accuracy critical path above.

## Environment notes (may be superseded by the CEO's brief — do not assume)
- At time of writing I had **no CI/deploy status visibility** from the agent sandbox, and
  **Vercel deploys showed red** for bot-authored commits. The CEO is addressing tooling —
  **await the brief; do not assume these constraints still apply.**
- Working facts: `npm install` first (no node_modules by default); repo is detached HEAD →
  push with `git push origin HEAD:master`; a pre-commit prettier hook is enforced.

## Key pointers
- Product context: `docs/working/2026-07-13-CTO-BRIEF.md`
- Decisions: `docs/working/2026-07-14-cto-decisions-and-stream2-plan.md`; memory `.../decisions/`
- Card-script worklist: `spikes/card-script-curation/REPORT.md`
- CTO self-retrospective (input for the CEO's tooling pass): `/mnt/memory/.../lessons/cto-process-retrospective-2026-07-14.md`

## Agent threads (all idle; work landed & pushed)
Backend×3 (Stream 1, contracts+engine, curation), Frontend (web), Infra (CI), Server
(slice 20), Task Manager (board) — all reported DONE. No open questions outstanding.
