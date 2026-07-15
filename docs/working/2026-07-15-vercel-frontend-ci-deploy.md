# Frontend Deploy Fix — Vercel now ships on every push

**Author:** CTO • **For:** CEO • **Date:** 2026-07-15
**Status:** ✅ DONE and verified live. Master `5344b59`. `app.zuhayr.io` serving the current build.

---

## The problem (what you asked me to confirm)

Pushing to `master` was **not** deploying the frontend. `app.zuhayr.io` had been
serving a build from **Jul 13** — none of the accumulated UI work (including the
duel UI) was going live.

**Root cause, confirmed with the Vercel API:** the project *is* connected to
GitHub, but Vercel's git integration **refuses to deploy commits whose author
isn't a team member** (`TEAM_ACCESS_REQUIRED`). Our real frontend commits are
authored by the automation bot (`Claude <noreply@anthropic.com>`), so Vercel
silently created no deployment. Proof: the project had only **2 deployments in
its entire history**, both from commits that no longer even exist in the repo —
every commit since produced nothing.

## The fix (what I did, after your greenlight)

Stopped relying on Vercel's git integration. The frontend now deploys from
**GitHub Actions using a Vercel token** — the same authorship-independent model
the Fly backend already uses. A token deploy is attributed to the **token owner
(a team member)**, so the git-author gate can never block it again, no matter who
(or what) authored the commit.

Shipped in two safe steps:
1. **Preview first** (`cb9bb03`) — proved the mechanism on a throwaway URL without
   touching the live domain. New deployment came back **READY**, authored as
   "Zuhayr Alvi", rendering the current app.
2. **Production** (`5344b59`) — flipped the job to `--prod` with a **fatal health
   check** against `app.zuhayr.io` that gates the pipeline (200 + real SPA shell,
   with retries for domain propagation).

## Verified (not just "pushed")

- **CI pipeline green** on `5344b59`: verify · accuracy · deploy-backend ·
  deploy-frontend all SUCCESS. The frontend health check passing is *required*
  for the run to be green.
- **`app.zuhayr.io` now serves the current build** — `last-modified` moved from
  Jul 13 22:25 → today 01:09, serving the current JS bundle that includes the
  duel UI.
- **Vercel production deployment** `dpl_58mpt72p` = READY, `target: production`,
  commit `5344b59`, author "Zuhayr Alvi" (team member — gate bypassed).
- A live functional QA smoke of the site is running; result appended below.

## What this means going forward

**Merge = deploy, for both tiers.** Every push to `master` (that changes code,
not just docs) now runs the full gate and, if green, deploys the Fly backend
**and** the Vercel frontend automatically. No manual steps, no author gymnastics.

- **Rollback** (if a bad build ships): Vercel dashboard → *Instant Rollback*, or
  `vercel rollback <deployment-url> --token=…`. The previous good deployment is
  retained as a rollback candidate.

## One optional cleanup for you (non-blocking)

In the Vercel dashboard (Project → Settings → Git), you can **disable git
auto-deploy** so the CI token job is the unambiguous sole deployer. Low urgency —
git integration is already dormant for our bot-authored commits, so nothing is
fighting today.

## A gap I closed along the way

A doc file had reached `master` with a formatting violation because **direct docs
pushes bypass CI** (the deploy workflow ignores `docs/**`/`*.md`, and the PR check
only runs on PRs). Fixed the file (`cc338aa`). Flagging the class: a doc pushed
straight to `master` isn't lint-gated. Not urgent; if it recurs I'll add a
lightweight guard.

---

### Commits
| SHA | What |
|---|---|
| `cc338aa` | fix pre-existing DEPLOYMENT.md formatting (unblock the gate) |
| `cb9bb03` | add token-based Vercel deploy job (preview) — mechanism proven |
| `5344b59` | promote frontend job to production + `app.zuhayr.io` health check |

### Live QA smoke result — ✅ FUNCTIONAL

Independent QA smoke of the live `app.zuhayr.io` (headless Chromium):

- **App renders** — no white screen; landing/login screen hydrates ("⟡ EDISON
  DUEL — a private duel club", Sign in form).
- **Backend healthy & reachable** — the SPA calls `api.zuhayr.io`; `/healthz`
  returns `{"status":"ok","cards":3681}` (card DB loaded).
- **Auth gate + login form work** — bad credentials produce the correct inline
  error; duel screens are behind the private-club login (by design).
- **No fatal errors** — the only console message is an expected `401` on the
  unauthenticated session check (`/api/me`).

**Scope note:** the duel screens (Create/Join) are gated behind the private-club
login, so QA verified the app is live and functional up to the auth wall but did
**not** exercise the full duel flow — that needs test invite credentials. That
end-to-end live duel smoke is the natural next validation now that the frontend
actually ships.

### Docs updated
- `packages/web/DEPLOYMENT.md` — corrected the deploy-trigger section to describe
  the token-based CI deploy (`5ae3312`).
