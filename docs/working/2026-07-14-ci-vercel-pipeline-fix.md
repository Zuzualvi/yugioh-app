# Pipeline & Deploy Readout — Edison App (2026-07-14)

**Author:** CTO • **For:** CEO • **Status at write time:** GitHub Actions GREEN · Fly backend LIVE · Vercel frontend unblock in progress

---

## TL;DR
- **GitHub Actions CI is GREEN.** The red run flagged by the CEO was a CI *invocation* bug (not the engine); it was root-caused and the fix is already on master (`7ff7b3a`). Latest `Deploy` run = SUCCESS.
- **Backend is live** at `api.zuhayr.io` (Fly) — health checks passing, dueling engine included.
- **Frontend (Vercel) was blocked** because every recent commit is authored by the automation bot, and our Vercel plan refuses to deploy commits whose author isn't a team member. Landing a team-authored commit to unblock it, with a durable CI-based fix to follow so it can't recur.

---

## What was red, and why
The CI job `accuracy (Edison rules 1–6)` ran its test step as:

```
cd packages/engine && npx vitest run src/edisonRules.accuracy.test.ts
```

The root `vitest.config.ts` discovers tests with the glob `packages/*/src/**/*.test.ts`, resolved from wherever vitest starts. The `cd packages/engine` moved that start point, so the glob resolved to a path that doesn't exist → **"No test files found" → exit 1.** The tests never ran; the engine, the fork patch, and all 7 accuracy tests were fine the whole time. Proven on a clean checkout (WASM built, assets fetched, 7/7 pass when invoked from the repo root).

**Fix (already on master as `7ff7b3a`):** run vitest from the repo root. Confirmed green.

## What is verified green now
- **verify** job: typecheck · lint · arch · actionlint · 393 tests — all pass.
- **accuracy** job: builds the custom WASM engine + fetches card assets, runs all **6 Edison rules** empirically (GY/MZone ignition priority, first-turn draw, one-field-spell, 0-ATK battle, LP-cost-strict) — 7/7 pass on every push.
- **deploy-backend** job: builds the dueling Docker image and deploys to Fly. Live at `api.zuhayr.io`, health green.

## The Vercel block (the one remaining go-live gap)
`app.zuhayr.io` is serving a *past* deployment, but the latest commits are blocked. Cause: 100% of recent commits are authored by `Claude <noreply@anthropic.com>`, which doesn't map to a GitHub/Vercel team member — Vercel's git integration refuses to deploy them (`TEAM_ACCESS_REQUIRED`). The backend is unaffected because it deploys via a CI token, not the git-author gate.

**Two-part fix:**
1. **Immediate:** land a commit authored by a team member (the `Zuzualvi` account, via the GitHub integration). That should let Vercel's git integration deploy the current frontend — bringing the accumulated, previously-blocked UI work (including the duel UI) live.
2. **Durable (recommended):** move frontend deploys to a **token-based `vercel deploy` step in CI**, the same authorship-independent model the backend already uses — so a bot-authored commit can never block a deploy again. This needs a one-time dashboard action (disable Vercel's Git auto-deploy so the two deployers don't fight) and confirming the `VERCEL_*` repo secrets exist.

## Next priorities (engineering)
1. **Durable Vercel deploy** (item 2 above) — remove the authorship dependency for good.
2. **Live end-to-end duel smoke** against prod: create a duel → join by invite link → step a few actions → confirm the WebSocket relay + engine path work on the live Fly machine.
3. **Card-errata behavior coverage:** the 6 rules are proven and the 25 script overrides load clean, but per-card errata behaviors aren't each behaviorally asserted yet. Add targeted tests for the high-value, cleanly-assertable ones.
