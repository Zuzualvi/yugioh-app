# HANDOFF — Edison App state & how to pick up (2026-07-14)

**Author:** CTO • **For:** the next CTO session (likely fresh context, updated harness/persona).
**Read this first, then `docs/working/2026-07-13-CTO-BRIEF.md` for product context.**

---

## TL;DR — where things are
- **master is GREEN** at **`bfd86ce`**. I ran the full CI pipeline (`npm run verify`) on a
  clean state: **372 tests pass, 11 skipped** (only the WASM-gated empirical tests),
  typecheck + prettier + arch:check all green.
- **Stream 1 (card-text fix): DONE & live-ready.**
- **Stream 2 (dueling slice, scope B): all four build slices LANDED** (contracts, engine,
  web UI, server infra) + card-script curation done. What's NOT done: empirical accuracy
  validation (blocked on the WASM build) and the 13-card Lua authoring.
- **Two standing problems the CEO is fixing via harness/persona:** (1) I can't see
  GitHub CI/deploy status; (2) QA was never an independent gate. See the retrospective:
  `/mnt/memory/yugioh-app-team-memory/lessons/cto-process-retrospective-2026-07-14.md`.

---

## HOW TO PICK UP (first actions, in order)
1. **Confirm CI status with your new tooling.** master is `bfd86ce`; I verified green
   locally but could not see GitHub Actions. First thing: check the actual CI + deploy
   result. (If you now have a GH token: `gh api /repos/Zuzualvi/yugioh-app/commits/bfd86ce/check-runs`.)
2. **Expect a RED Vercel deploy on every commit** until the deploy-email fix lands — this
   is the "wall of red" the CEO saw. It is NOT the CI/verify gate (that's green); it's the
   Vercel git-integration blocking bot-authored commits. Decision options are below.
3. **Stand up QA as the gate.** No slice should be "done" until QA runs full repo-wide
   `verify` on a clean checkout + the spec's acceptance criteria. Slices 20/30 landed on
   scoped verify only — have QA independently verify them.
4. **Unblock the WASM build** (critical path — see below). Docker IS available; the
   `emscripten/emsdk` image can build `packages/engine/scripts/build-wasm.sh`.
5. **Then** the 13-card Lua authoring can proceed (needs a runnable engine to verify).

---

## Slice status (Stream 2, scope B = synchronous invite-link duels; NO auto-matchmaking)
| Slice | Package | Status | SHA |
|---|---|---|---|
| 00 Duel contracts | contracts | ✅ DONE (31 tests) | 2c96c8c |
| 10 Engine core (WASM, EDISON_FLAGS, #10 patch, redaction, determinism) | engine | ✅ landed; **empirical tests SKIPPED pending WASM** | eb5e40d (+ cycle fix bfd86ce) |
| 20 Server duel infra (lifecycle, persistence, WS relay, timer, reconnect) | server | ✅ landed (150 pass, 1 skip); scoped-verify only → **needs QA** | 3de754e |
| 30 Web duel UI (board, action panel, timer, create/join-link) | web | ✅ landed (93 tests); runs full loop vs mock → **needs QA** | 701f548 |
| 40 Card-script curation (diff+stage) | spikes/ | ✅ DONE — 11 drop-in + 1 fixed staged, 5 modern-ok, 6 rules-level, 13 need authoring | b3d28f6 |
| Infra CI/deploy health | .github, hooks | ✅ format hook + Node@v5 + Discord steps (guarded) | 719c748 |
| 50 Rules-validation tests (QA) | engine/server | 🔴 BLOCKED on WASM | — |
| CTO Lua authoring — 13 cards | engine overrides | 🔴 BLOCKED on runnable WASM engine | — |

Board: `tasks/BOARD.md`. All specs in `/workspace/specs/stream2-*.md` + `infra-ci-deploy-health.md`.

---

## KNOWN ISSUES / what's red and why
1. **CI observability (highest):** the GitHub API is firewalled (403) from the agent
   sandbox; the git token only works for push/pull. I cannot read Actions/deploy status.
   → CEO provisioning a read token (`GH_CI_READ_TOKEN`) unlocks it. `gh` v2.45 is installed.
2. **Vercel deploys BLOCKED:** git-integration rejects bot commits
   (`noreply@anthropic.com` maps to no GitHub account). Every push shows a red Vercel
   deployment. Deck builder stays live; nothing new deploys. Fix options below.
3. **WASM build (critical path):** custom ocgcore WASM can't build where agents run (no
   emsdk). Gates: engine's 10 empirical tests, server's 1 integration test, the 13-card
   authoring verification, and QA's rules suite. **Docker IS available** → build via
   `docker run --rm -v $PWD:/src emscripten/emsdk bash -c "cd /src && bash packages/engine/scripts/build-wasm.sh"`,
   then artifact lands at `packages/engine/vendor/ocgcore-custom.sync.{wasm,mjs}` (gitignored;
   also need `packages/engine/assets/cards.cdb` + scripts present for the tests to run).

---

## CEO ACTION ITEMS (from Infra memo `docs/working/2026-07-14-ci-deploy-health.md`)
| # | Item | Why | CTO recommendation |
|---|---|---|---|
| 1 | Provision GH read token → secret `GH_CI_READ_TOKEN` | Unlocks CI observability for agents | Do it — this is the core fix |
| 2 | Discord webhook → secret `DISCORD_WEBHOOK_URL` | Real-time failure alerts (steps already wired, no-op until set) | Do it — highest-leverage notification |
| 3 | Vercel unblock | Deploys are red on every commit | **Option B** (Vercel CLI+token in CI, symmetric w/ Fly) is cleanest; needs `VERCEL_TOKEN`+`ORG_ID`+`PROJECT_ID` + disable dashboard auto-deploy. **Option A** (set git email to CEO's GH no-reply) is the zero-secret quick unblock but attributes commits to CEO |
| 4 | Build WASM once in emsdk env → commit artifact | Un-skips all empirical accuracy tests | Do via docker (available); ~870KB |
| 5 | Branch protection + required checks | Stop master going red silently | Consider — implies PR-based flow (workflow change) |

---

## Critical path to the ACCURACY promise (the product's whole point)
Nothing has yet verified that two legal Edison decks reproduce March-2010 behavior. The
chain is: build WASM → engine empirical tests pass (#5/#9/#11 confirm, #7/#8/#4 test, #10
verify) → author the 13 gap cards (`spikes/card-script-curation/REPORT.md` worklist) →
wire curated `.lua` into `packages/engine/scripts/edison-overrides/` → QA runs the rules
suite end-to-end. This is the top priority once observability + WASM are unblocked.

---

## Key pointers
- Product context: `docs/working/2026-07-13-CTO-BRIEF.md`
- Decisions: `docs/working/2026-07-14-cto-decisions-and-stream2-plan.md`; team memory
  `/mnt/memory/yugioh-app-team-memory/decisions/`
- Infra/CI memo: `docs/working/2026-07-14-ci-deploy-health.md`
- Card-script worklist: `spikes/card-script-curation/REPORT.md`
- Process retrospective: `/mnt/memory/.../lessons/cto-process-retrospective-2026-07-14.md`
- Env facts every agent needs: `npm install` first (no node_modules); detached HEAD →
  `git push origin HEAD:master`; pre-commit prettier hook now enforced.

## Agent threads (all idle; work landed & pushed)
Backend×3 (Stream1, contracts+engine, curation), Frontend (web), Infra (CI), Server
(slice 20), Task Manager (board) — all reported DONE. No open questions outstanding.
