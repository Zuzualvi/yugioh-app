# HANDOFF — Edison Deck-Builder + Duel App (2026-07-15, end of session)

> ⚠️ **SUPERSEDED by `docs/working/2026-07-15-HANDOFF-2-closeout-and-next-build.md`** — read that first.
> (The live-duel E2E is now done + CI-green; two wiring bugs + INVITE-01/02 shipped; the interactive duel UI is
> the greenlit next build.) This file is kept for history.

**Author:** CTO (outgoing) • **For:** next CTO session (fresh context, **Playwright harness now installed**).
**This SUPERSEDES `2026-07-14-HANDOFF-END-OF-SESSION.md`.** Read this first, then
`docs/working/2026-07-13-CTO-BRIEF.md` for product context. Verify live state with `read_ci_status`
and the Vercel MCP tools.

---

## TL;DR — where we are RIGHT NOW
- **Both tiers are live and merge=deploy.** Push to `master` (non-docs) → CI gate → deploys **Fly backend
  (`api.zuhayr.io`)** AND **Vercel frontend (`app.zuhayr.io`)** automatically. The frontend deploy gap is
  CLOSED (fixed 2026-07-15 — token-based `vercel deploy` job; details below).
- **`app.zuhayr.io` serves the current build**, including the duel UI. QA confirmed the live site renders,
  login works, backend healthy (`/healthz` → 3681 cards).
- **master is GREEN** (verify + accuracy + deploy-backend + deploy-frontend). 6 Edison rules pass empirically
  in CI on every push.
- **Subagents WORK** (the 2026-07-14 "quota-blocked until 2026-08-01" note is obsolete — spawned Infra, QA,
  Technical Writer, Task Manager successfully this session).
- **The Playwright E2E harness is being installed by the CEO** (their Part 1). Your job includes Part 2 —
  writing the actual duel E2E suite (see NEXT #1 + the Playwright plan in memory).

## What is DEPLOYED / LIVE
- **Fly backend `api.zuhayr.io`** — DEPLOYED, health green. Duel REST + WebSocket relay + engine + deck-builder API.
- **Vercel frontend `app.zuhayr.io`** — LIVE on current build. Production deploy `dpl_58mpt72p` (READY),
  authored as team member (token deploy bypasses the git-author gate). Rollback: Vercel dashboard Instant
  Rollback or `vercel rollback <url> --token=$VERCEL_TOKEN`.

---

## PROVEN vs UNPROVEN (read this before claiming anything is "done")

**Proven (watched pass / verified live):**
- CI pipeline green; 6 Edison rules empirical; deck builder live; auth/login live; frontend+backend deploy live.

**Built but UNPROVEN / unfinished (the real risk list):**
1. **The live 2-player duel loop has NEVER been played end-to-end.** Backend deployed + healthy and UI renders,
   but no real duel has run through the live `api.zuhayr.io` WebSocket + engine. "Deployed" ≠ "a duel works."
   **This is the #1 gap.**
2. **Duel UI (Slice 30)** — landed with tests, but only against a MOCK server; never QA'd vs the real backend.
3. **Server duel infra (Slice 20)** — landed + deployed on scoped self-verify only; no independent end-to-end QA.
4. **Per-card accuracy is under-tested.** The RULES are proven; the individual functional-errata card behaviors
   (25 override scripts incl. the 13 authored cards) are NOT each behaviorally asserted. We can say "the engine
   behaves like Edison"; we cannot yet prove "every errata card behaves like Edison."
5. **Residual-gap list** (cards knowingly left on modern behavior) exists in working docs but isn't consolidated
   or surfaced to users — accuracy-honesty was an explicit product principle.
6. **Invite-link flow is a lean model** (see board `INVITE-01`–`09`): join = immediate duel start; no pre-duel
   room; two MVP papercuts (`INVITE-01` link dropped through login, `INVITE-02` timer not shown before accept).

---

## WHAT'S NEXT (recommended order)
1. **Prove the live duel loop — Playwright E2E (Part 2).** The single highest-value next step; turns "deployed"
   into "verified." Plan + prerequisites in memory: `decisions/2026-07-15-e2e-playwright-plan.md`. Needs: the
   harness (CEO's Part 1), **two seeded test accounts**, and a **same-origin** setup for authenticated flows
   (localhost stack, or prod `app.zuhayr.io` which is same-site with `api.zuhayr.io` — NOT `*.vercel.app`
   previews, where the `SameSite=Lax` cookie won't attach). Use two browser CONTEXTS for the 2 players.
   While here, also fix `INVITE-01`/`INVITE-02` (they're part of making this flow solid for real users).
2. **Per-card errata behavioral coverage + consolidated residual-gap list.** Targeted tests for the
   high-value/cleanly-assertable errata cards; publish the honest gap list. Serves the core accuracy promise.
3. **Async / multi-day duels + Home surfaces.** The per-move timer already supports async, but the async slice
   was deferred; Home's "Your move" queue / "waiting on opponent" / pending-invite card are placeholder seams
   (`HomeScreen.tsx`). This is the async loop.
4. **Club operations UX.** Account creation (admin-bootstrap only today), invite-link polish, surfacing match
   history/replay (persistence exists in infra, not exposed in UI).
5. **Minor hardening.** Pin `superfly/flyctl-actions/setup-flyctl@master` to a release SHA; prebuilt-WASM cache
   fallback if emsdk build flakes; close the "docs pushed straight to master bypass CI lint" gap; `INVITE-09`
   atomic seat-claim (single-instance-safe today, would double-claim if multi-instance).
6. **Deferred / non-goals.** Pre-duel room + coin-toss first turn = deferred (board `INVITE-03/04`). "Why is
   this illegal?" explainer = V2. Automated matchmaking/ranked = PERMANENT non-goal (link-first club by design).

---

## HOW THE FRONTEND DEPLOYS NOW (so you don't regress it)
- `.github/workflows/deploy.yml` job `deploy-frontend` (`needs: [verify, accuracy]`) runs
  `vercel pull --environment=production` + `vercel deploy --prod` with repo secrets `VERCEL_TOKEN` /
  `VERCEL_ORG_ID` (`team_h8Gtm9WN7tZ4bTXBBquNVCUr`) / `VERCEL_PROJECT_ID` (`prj_MBiBUi7UdyGdjAISSEpXMzik8HET`),
  then a FATAL health check on `https://app.zuhayr.io` (200 + `id="root"`).
- **The Vercel project is NOT git-connected** (CEO confirmed) — the token CI job is the SOLE deployer. Do not
  re-introduce git auto-deploy. Full story: `decisions/2026-07-14-ci-deploy-health.md`.

## KEY POINTERS
- **Board:** `tasks/BOARD.md` (reconciled 2026-07-15; `INVITE-01`–`09`, slice status, Recently Shipped).
- **Invite-link spec vs build:** analysis lives in the board `INVITE-*` items; specs are
  `docs/working/2026-07-14-link-first-lobby-change.md` + `-link-first-initiation-flow.md`.
- **Memory (`/mnt/memory/yugioh-app-team-memory/`):** `decisions/2026-07-14-ci-deploy-health.md` (deploy saga
  + Vercel fix + Playwright Part-1 prereqs), `decisions/2026-07-15-e2e-playwright-plan.md` (E2E plan),
  `decisions/2026-07-14-accuracy-harness-and-ci.md`.
- **CEO report (this session):** `docs/working/2026-07-15-vercel-frontend-ci-deploy.md` + `/mnt/session/outputs/REPORT.md`.
- **Local gate:** `npm run verify` (typecheck → lint → arch:check → actionlint → test). Accuracy harness:
  `bash packages/engine/scripts/build-wasm.sh` + `fetch-assets.sh` then run `edisonRules.accuracy.test.ts` from repo root.

## HOW TO RESUME (first actions)
1. Read the CEO's Playwright/tooling brief for your session.
2. `read_ci_status` → confirm master green; Vercel MCP `list_deployments` → confirm latest prod deploy READY.
3. Drive NEXT #1 (live duel E2E via Playwright) — see `decisions/2026-07-15-e2e-playwright-plan.md`.
