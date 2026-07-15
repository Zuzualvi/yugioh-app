# CTO Report — Edison Duel App close-out session (2026-07-15)

## Headline
The #1 gap is closed and **proven in CI**: the live 2-player duel **backbone works end-to-end**. Getting there
surfaced that the loop was genuinely broken (you called this) — I found and fixed the causes, proved the fix with
a committed Playwright E2E that is now green in CI, and fixed both invite papercuts. One large piece — making a
human able to play a *full* duel through the UI — is honestly bigger than a close-out and is flagged for your
call, not silently absorbed.

## What was broken (found by reading + running the real engine)
1. **WS never connected.** The web client dialed `/ws/duels/:id`; the server only accepts `/api/duels/:id/ws`
   (and in prod the WS host defaulted to the Vercel SPA, which has no socket). No real duel could start.
2. **On-clock player got stuck.** On connect the server sent the board + clock but never the *pending decision*,
   and the UI only shows actions when it has one → the player sat on a running clock with nothing to click → lost
   on timeout.
3. **(Bigger) The duel UI's interactive layer is mock-only.** Turning a real engine decision into buttons, and a
   click into an engine response, was written entirely against the mock; the real engine speaks a different
   message/response format. So a human can connect, see the board, and resign — but cannot yet play a full duel.

## What I shipped (all CI-green + deployed live)
- **Fix #1 — WS path/host** (`ca99526`): client connects to `/api/duels/:id/ws`, WS base derived from the same
  var REST uses. Added the URL-assertion tests the old suite never had.
- **Fix #2 — deliver the pending decision on connect** (`a442645`): engine exposes it; the relay re-sends it to
  the connecting seat (initial connect *and* reconnect).
- **INVITE-01** (`be9c2b2`): a duel link opened while logged-out now resumes to the duel after login (was
  dropping you on Home).
- **INVITE-02** (`a442645` backend + `be9c2b2` frontend): the Join screen shows the per-move timer *before* you
  Accept, and disables Accept if the duel already started.
- **Committed Playwright E2E** (`10bf0b5`) + its **CI workflow** (`f36f321`, via the gated path you approved):
  a same-origin localhost harness boots the real WASM engine + WS + built SPA, seeds two players, and a
  two-browser-context test proves: both connect, both boards render real engine state, the on-clock decision is
  delivered, and a resign round-trips to both. **`E2E` workflow run on master = SUCCESS.**

## Verification (how I know, without a QA teammate)
Subagent spawning was down the entire session (platform outage — see below), so I couldn't use the normal
"separate QA agent" gate. Instead I leaned on gates that aren't me grading myself:
- **CI green via `read_ci_status`** — the whole pipeline (typecheck, lint, arch, actionlint, 404 unit/integration
  tests, the Edison-rules accuracy job, and now the Playwright E2E) runs on a clean checkout in GitHub Actions.
  `master` is green; `E2E on master@f36f321` = SUCCESS; Vercel READY; Fly DEPLOYED.
- A **real local run** of the E2E against the real engine (2 passed) before pushing.

## Honestly NOT done (and why)
- **Human-playable full duel (the interactive decode/encode layer).** This is the deferred completion of the duel
  UI — a real multi-file, cross-package build, not a papercut. I kept it OUT of close-out per your "no new dev /
  stop & report" instruction. Recommend greenlighting it as the next slice; I can bring a scoped plan.
- **Independent QA of Slice 20/30 by a separate agent** and **per-card errata behavioral tests.** The E2E already
  exercises Slice 20 (server duel infra) + Slice 30 (web duel UI) against the *real* backend, and the 6 Edison
  *rules* are CI-green — but the separate-QA-agent judgment and the per-*card* errata assertions specifically need
  a teammate I couldn't spawn. Held (not faked); I'll route them through QA the moment spawning recovers. The full
  honest gap list is in `docs/working/2026-07-15-residual-gap-list.md`.

## The subagent outage
`create_agent` returned `Look up subagent config failed (NotFound)` for every role, all session, across many
retries — a platform/config regression (it worked earlier today). It blocked my delegate→QA model; I proceeded
solo with CI as the independent gate, per your "keep going." Still retrying periodically.

## Live deploy state
`app.zuhayr.io` (Vercel) READY · `api.zuhayr.io` (Fly) DEPLOYED · `master` green. The wiring fixes + invite
papercuts are live now.

## Recommended next (for your call)
1. Greenlight the **interactive duel UI** build (make a full duel playable) — the real remaining product work.
2. When spawning is back: **per-card errata behavioral tests** + a dedicated **QA pass** on Slice 20/30.
3. Optional hardening from the gap list (A2 refresh→mock, A4 logout verb) — low risk for the club.

_Commits: ca99526, a442645, be9c2b2, 10bf0b5 (git) + f36f321 (workflow via MCP). Stale note: `read_ci_status`
keeps echoing an old “Deploy @ 75b51c7 FAILURE” — that's a long-fixed historic run; trust the "latest run" line._
