# HANDOFF — Edison Duel App (2026-07-15, close-out session → next CTO thread)

**Author:** CTO (close-out session). **For:** the next CTO thread (fresh context).
**This SUPERSEDES `docs/working/2026-07-15-HANDOFF-END-OF-SESSION.md`.** Read this first, then
`docs/working/2026-07-15-interactive-duel-ui-plan.md` (your main build brief). Confirm live state with
`read_ci_status` + the Vercel MCP before trusting anything.

> ⚠️ **CORRECTION (2026-07-16, CEO-side investigation):** the "subagent outage" this handoff
> works around **never existed**. `Look up subagent config failed (NotFound)` means the
> `agent_name` string didn't exactly match a roster name. Spawns work when `agent_name` is the
> EXACT roster name **including the bracketed suffix** (e.g. `QA Engineer [yugioh-app]`, copied
> verbatim from the create_agent tool's "Agents available in this session" list) — proven 4/4
> deterministic. Do NOT treat NotFound as an outage; re-check the name and retry. Full story:
> `docs/working/2026-07-16-SUBAGENT-OUTAGE-CORRECTION.md`. All "outage / once spawning is
> restored" framing below and in the 07-15 closeout report / residual-gap list is superseded.

**First actions:** (1) verify subagents spawn — spawn a throwaway QA "connectivity check" using the
EXACT roster name `QA Engineer [yugioh-app]`; on NotFound, fix the name string (see CORRECTION above)
rather than stopping. (2) `read_ci_status` → confirm master green + `E2E` workflow green.
(3) `git log origin/master` HEAD should be at least `e7d003e` (see SHAs below).

---

## TL;DR — where we are
- The **live 2-player duel BACKBONE is proven end-to-end and green in CI.** The prior handoff's #1 gap
  ("the live duel has never been played") is closed at the transport+engine+relay level: a committed Playwright
  E2E (two browser contexts, real WASM engine + WS + backend on a same-origin harness) shows both seats connect,
  both boards render real per-seat STATE, the on-clock decision is delivered, and a RESIGN round-trips to both.
- Getting there uncovered that the live duel was genuinely **broken** (three layers). Two were small wiring bugs
  — **fixed, CI-green, deployed live.** The third is large and is the greenlit next build (below).
- **INVITE-01 + INVITE-02** (the two invite papercuts) — done, CI-green, live.
- `master` green · `app.zuhayr.io` (Vercel) READY · `api.zuhayr.io` (Fly) DEPLOYED.

## What shipped this session (all pushed; CI-green + deployed)
| SHA | What |
| --- | --- |
| `ca99526` | **Fix #1 — WS path.** Web client now dials `/api/duels/:id/ws` (was `/ws/duels/:id`, which the server rejected with code 4000); WS base derived from `VITE_API_BASE_URL` (http→ws) so prod hits `api.zuhayr.io`, not the Vercel SPA. + URL-assertion tests. |
| `a442645` | **Fix #2 — deliver pending decision on connect** (`EdisonDuel.getPendingMessages()` + `DuelEngine` iface + FakeEdisonDuel; `onConnection` re-sends the redacted pending decision AFTER STATE+CLOCK). **+ INVITE-02 backend:** `GET /api/duels/join/:joinToken` → `{timerPerMoveSeconds,status}`; new `PreJoinDuelInfo`/`DuelStatus` contracts. |
| `be9c2b2` | **INVITE-01** (RequireAuth captures intended path; LoginScreen resumes to it) **+ INVITE-02 frontend** (JoinDuelScreen shows the per-move timer pre-Accept, disables if already started). |
| `10bf0b5` | **Committed Playwright E2E** — same-origin harness (`e2e/harness/server.ts` + `seed.ts`), `playwright.config.ts`, `e2e/playwright/duel.spec.ts` (backbone + INVITE-01) + `prod-smoke.spec.ts`. `createApp` gained an opt-in `webDistPath`. Added `@playwright/test` + `tsx` devDeps + `test:e2e`. |
| `f36f321` | **`.github/workflows/e2e.yml`** (committed via the gated GitHub MCP — a plain push can't touch workflows). Runs the E2E on every non-docs push to master. **`E2E` workflow on master = SUCCESS.** |
| `fcf93f0` | Docs: close-out report + residual-gap list; board reconciled (INVITE-01/02 done). |
| `de439a5`, `e7d003e` | The interactive-duel-UI build **plan** (mobile made first-class). |

Local == origin/master == `e7d003e` at handoff.

## PROVEN vs UNPROVEN (be honest downstream)
**Proven:** duel backbone E2E green in CI; 6 Edison rules empirical in CI; deck builder/auth/deploys live;
INVITE-01/02 live.
**Unproven / not done:**
1. **A human cannot yet play a FULL duel through the UI.** Past connect/view-board/resign, no legal move can be
   made — the interactive decision layer is mock-only (see next section). THIS IS THE BIG ONE.
2. **Independent QA of Slice 20/30 by a separate QA agent** — the E2E exercises both against the real backend,
   but a dedicated QA-agent pass was not done (held this session). Do it.
3. **Per-card errata behavioral tests** — the 6 Edison *rules* are CI-green; the ~25 per-*card* override
   behaviors are NOT individually asserted. Priority list in the residual-gap doc §B1.

## THE BIG FINDING → your main build (greenlit by CEO)
The web duel UI's interactive layer (`decisionOptions.ts` decode + ActionPanel `{type:1,value}` encode +
`EngineResponse` contract) was built against the MOCK and does not speak the real ocgcore protocol (real first
decision is `SELECT_CHAIN {selects:[],forced:false}`; real responses are a typed `OcgResponse` union). So it must
be rebuilt.
- **Build plan (your brief):** `docs/working/2026-07-15-interactive-duel-ui-plan.md`.
- **Decision record + rationale:** `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-15-interactive-duel-ui-build.md`.
- **Architecture (decided):** typed `DuelDecision` + `DuelDecisionResponse` protocol in `packages/contracts`;
  ocgcore⇄contract translation lives IN the engine; web speaks only the contract (schema drift → compile error).
- **CEO calls locked:** **mobile is FIRST-CLASS** (built alongside desktop as one responsive system — the club
  plays on the go); accessibility (§16) is in the core build.
- **Phasing:** 0 protocol contract + ADR (gate before any UI) · 0.5 mobile eng spec from §15 (Technical Writer +
  Frontend) · 1 engine adapter + relay/persistence · 2 responsive web (desktop §6/§7 + mobile §15) · 3 E2E plays
  a real turn in mobile + desktop viewports.
- **Open questions the CEO still owes an answer on** (ask early): playable-V1 decision-kind scope; canonical
  Edison test deck(s) for real-effect E2E (current E2E uses a vanilla 40-card deck); dedicated product-design
  role (none exists — §15 is the design of record).

## KEY POINTERS
- **UX spec (design of record):** `docs/working/2026-07-13-v1-ux-flows.md` — §6 desktop board, §7 priority/chain,
  §8 targeting, §9 inspector, §15 **mobile board**, §16 a11y, §17 open questions to the CTO.
- **Residual-gap list (honest):** `docs/working/2026-07-15-residual-gap-list.md` (A1 interactive layer, A2
  refresh→mock, A3 creator-connect-before-join, A4 logout DELETE/POST mismatch, B1 errata coverage, B2 modern-ok
  cards, C deferred).
- **CEO report:** `docs/working/2026-07-15-cto-closeout-report.md` (+ `/mnt/session/outputs/REPORT.md`).
- **Board:** `tasks/BOARD.md`.
- **Memory decisions:** `2026-07-15-live-duel-wiring-bugs.md` (root-cause of all 3 layers),
  `2026-07-15-interactive-duel-ui-build.md`, `2026-07-15-e2e-playwright-plan.md`, `2026-07-14-ci-deploy-health.md`.

## HOW TO RUN / VERIFY THINGS
- **Local gate:** `npm run verify` (typecheck → lint → arch:check → actionlint → test; 404 tests green).
- **Engine WASM + assets:** `bash packages/engine/scripts/build-wasm.sh` then `fetch-assets.sh` (produces
  `packages/engine/vendor/` + `assets/`, both gitignored). ~3–4 min in this container; CI caches them.
- **E2E locally:** `npm run build:web` then `npx playwright test e2e/playwright/duel.spec.ts` (Playwright +
  chromium are available; browsers at `/opt/pw-browsers`). The `webServer` boots the harness via `tsx`.
- **CI E2E:** `.github/workflows/e2e.yml` runs it on push to master. Verify green via `read_ci_status`
  (workflow name "E2E").
- **Workflow edits** go via the GitHub MCP `create_or_update_file` (gated → CEO approval); a plain `git push`
  cannot modify `.github/workflows/*`.
- **read_ci_status quirk:** it keeps echoing a stale `inspected run: Deploy @ 75b51c7 FAILURE` — that's a
  long-fixed historic run. IGNORE it; trust the "latest run" line.
- **Git:** identity is set globally to Zuhayr Alvi; push with `git push origin HEAD:master`; keep the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

## RESUME (recommended first moves for the build)
1. Verify subagents spawn + master/E2E green (First actions above).
2. Ask the CEO the three open questions (scope, test decks, design role).
3. Start **Phase 0** (typed decision contract + empirical ocgcore decision catalog + ADR) — gate it before any
   UI. Kick off **Phase 0.5** (mobile eng spec) in parallel. Then fan out Phases 1–2.
