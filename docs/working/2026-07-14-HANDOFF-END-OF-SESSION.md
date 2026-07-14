# HANDOFF — Edison Deck-Builder + Duel App (2026-07-14, end of session)

**Author:** CTO (outgoing session) • **For:** the next CTO session (fresh context, updated tools).
**This SUPERSEDES `2026-07-14-HANDOFF-STATE.md`.** Read this first, then
`docs/working/2026-07-13-CTO-BRIEF.md` for product context.

---

## TL;DR — where we are RIGHT NOW
- **master is FULLY GREEN.** Latest run `Deploy @ 7ff7b3a` = **SUCCESS** (verify + accuracy + deploy).
  Confirm anytime with the `read_ci_status` tool.
- **The accuracy promise is PROVEN in CI.** All **6 Edison rules** pass empirically on every push
  (GY-ignition priority, MZone ignition, first-turn draw, one-face-up-field, 0-ATK battle, LP-cost-strict).
- **Backend (dueling) is LIVE on Fly** — the dueling engine is wired into `prod-server.ts`, the WASM +
  card assets are baked into the image, `flyctl deploy` succeeded, `/healthz` passing at `api.zuhayr.io`.
- **Frontend (Vercel) is still BLOCKED** — this is the #1 remaining go-live gap (needs CEO action; see NEXT).
- **Subagents are QUOTA-BLOCKED until 2026-08-01** (hit this session). The CTO drove final verification
  directly; a fresh session may hit the same limit until then.

---

## What is VERIFIED GREEN (watched pass, not assumed)
Latest master run `7ff7b3a` (`Deploy` workflow) SUCCESS. Jobs:
- **verify**: `typecheck → lint → arch:check → actionlint → test` — all green (393 tests).
- **accuracy** (cached WASM build + assets fetch): runs `edisonRules.accuracy.test.ts` — **7 tests /
  6 rules all pass** (Rule 6 = two sub-tests: illegal at exactly the LP cost, legal at cost+1).
- **deploy-backend** (`needs: [verify, accuracy]`): builds the dueling Docker image + `flyctl deploy`.

Re-verify locally (clean clone): `npm ci && npm run verify` (structural, ~1 min). For accuracy you must
first build the harness: `bash packages/engine/scripts/build-wasm.sh` (~80s, emcc 6.0.3) +
`bash packages/engine/scripts/fetch-assets.sh`, then `npx vitest run packages/engine/src/edisonRules.accuracy.test.ts`.

## What is DEPLOYED
- **Fly backend `api.zuhayr.io`**: DEPLOYED, health green. Now includes the duel REST routes + WebSocket
  relay + engine (deck-builder API too). Engine runtime assets baked at `/app/engine/{vendor,assets,scripts/edison-overrides}`;
  paths set via `EDISON_*` env in `fly.toml`.
- **Vercel frontend `app.zuhayr.io`**: **BLOCKED** — not deploying (see NEXT #1).

---

## WHAT'S NEXT (prioritized)
1. **Unblock the Vercel frontend (CEO action required).** Vercel's git integration blocks bot-authored
   commits (`Claude <noreply@anthropic.com>` doesn't map to a GitHub account). Recommended fix = **Option B**:
   CEO disables the project's **Git auto-deploy** in the Vercel dashboard (else CLI + git-integration fight —
   that conflict is why the team went git-integration-only before) and confirms repo secrets
   `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` exist (provision_hosting likely set them). Then CTO
   wires a `vercel deploy --prod --token=$VERCEL_TOKEN` step (build `packages/web`) into the deploy workflow.
   No new spend. (Alt Option A — map the commit author email — is unreliable and the harness fixes the author.)
2. **Live end-to-end duel smoke against prod.** The dueling backend deployed + health-green, but no real duel
   has been played through the live `api.zuhayr.io` WS yet. Do a prod smoke: create duel → join via invite
   link → step a few actions → confirm WS relay + engine path work end-to-end on the live machine.
3. **Card-errata behavior coverage (accuracy hardening).** The 6 RULES are proven, and the 25 overrides
   load/run clean, but the per-card ERRATA behaviors (e.g. Brionac no-OPT, Strike Ninja per-copy, Quickdraw
   ignition, the 13 authored targeting/cost changes) are NOT each behaviorally asserted. Add targeted tests
   for the high-value/cleanly-assertable ones (count-limit changes are easiest).
4. Minor hardening: pin `superfly/flyctl-actions/setup-flyctl@master` to a release SHA (mutable ref);
   consider relaxing/monitoring the WASM cold-build (~15 min first run; cached after — fallback: cache a
   prebuilt wasm artifact keyed by commit if the emsdk build ever flakes).

---

## OPEN ISSUES / GOTCHAS for the fresh session
- **Subagent quota:** blocked until 2026-08-01 (per the failure this session). If you can't spawn agents,
  drive directly and lean on CI (`read_ci_status`) as the independent gate.
- **`read_ci_status` behavior:** it now surfaces the failing step + log tail. It can show a stale/"ghost"
  run or a secondary "inspected run" line — the **latest-run** verdict is authoritative. It could not surface
  logs for *cancelled* runs (they have no failed job) — avoid churning the CI with rapid pushes +
  `cancel-in-progress: true`, which turns readable failures into unreadable cancellations.
- **Diagnostic discipline (learned the hard way this session):** a red run with **"zero jobs / no failed
  job" = an INVALID WORKFLOW FILE** (not a runtime failure). `actionlint` is now in `npm run verify` to catch
  that class locally. And **CI test commands must match the root `vitest.config.ts` `include` glob** — run
  `npx vitest run packages/engine/src/…` from the repo root, NOT `cd packages/engine && vitest run src/…`
  (the latter finds "No test files").
- **Never bundle-break the engine:** `prod-server.ts` is esbuild-bundled to `/app/server.mjs`, so the engine's
  `__dir`-relative asset paths don't resolve in prod — that's why `coreFactory/cardLoader/scriptLoader` now
  read `EDISON_*` env vars (default to relative paths when unset, so dev/test/CI are unchanged).
- **WASM lifecycle:** each duel gets its OWN ocgcore core (`createEdisonCore` per duel; `destroy()` frees it).
  Sharing a singleton core across concurrent/many duels corrupts memory (deferred Lua GC). The server destroys
  the engine on every duel-end path.

---

## KEY POINTERS
- **Spec:** `/workspace/specs/stream2-60-accuracy-harness.md` (accuracy slice).
- **Curation worklist (13 authored cards + 25 overrides):** `spikes/card-script-curation/REPORT.md`.
- **CEO reports:** `docs/working/2026-07-14-accuracy-milestone-report.md` + `/mnt/session/outputs/REPORT.md`.
- **Team memory decisions/lessons (`/mnt/memory/yugioh-app-team-memory/`):**
  - `decisions/2026-07-14-ci-deploy-health.md` — the full CI/deploy saga + resolution + actionlint closure.
  - `decisions/2026-07-14-accuracy-harness-and-ci.md`; `decisions/2026-07-14-per-duel-wasm-core.md`.
  - `lessons/contract-drift-vitest-vs-typecheck.md`; `lessons/wasm-concurrent-duel-limit.md` (RESOLVED).
- **Workflows:** `.github/workflows/deploy.yml` (verify + accuracy + deploy-backend), `ci.yml` (PR gate).
  `npm run verify` = the local gate (now includes `actionlint` via `scripts/run-actionlint.mjs`).
- **Notable SHAs on master:** `7ff7b3a` (green HEAD) ← `e3c0220` (workflow secrets-in-if fix) ←
  `75b51c7` (CI hardening) ← `e9ab7b2` (dueling in prod) ← `afb1ef8` (Rule 6) ← `1c3dd6f` (per-duel core)
  ← `2243d0c` (25 overrides) ← `8ddd58e` (WASM harness).

## HOW TO RESUME (first actions)
1. Read the CEO's tool-update brief (tools changed for your session).
2. `read_ci_status` on yugioh-app → confirm master still green.
3. Drive **NEXT #1 (Vercel unblock)** — it's the last thing between here and full go-live; needs the CEO's
   dashboard/secret action, then a small CTO wire-up.
4. Then NEXT #2 (prod duel smoke) and #3 (card-errata behavior coverage).
