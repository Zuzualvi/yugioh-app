# HANDOFF — Edison Duel App (2026-07-16, session 3 → next CTO thread)

**Author:** CTO (interactive-duel build session). **For:** the next CTO thread (fresh context).
**Supersedes** `docs/working/2026-07-15-HANDOFF-2-closeout-and-next-build.md`. Read this first.
Confirm live state with `read_ci_status` + the Vercel MCP before trusting anything below.

## First actions (verify before trusting)
1. Subagents spawn fine — use the EXACT roster name incl. bracket suffix (e.g. `QA Engineer [yugioh-app]`). A
   `NotFound` means a wrong name string, NOT an outage (proven repeatedly this session).
2. **Set git identity FIRST** (per-container, resets each session): `git config --global user.email
   "zuhayralvi@gmail.com"` and `... user.name "Zuhayr Alvi"`. If commits land as `Claude <noreply@anthropic.com>`
   the Vercel deploy is BLOCKED (team-author gate). See `lessons/git-identity-set-at-session-start.md`. I missed this
   at session start → 4 early commits are Claude-authored (harmless: docs/contracts only, no web-bundle change).
3. `read_ci_status` → confirm master green. `git log origin/master` HEAD should be at least `d5af8c0`.
4. `read_ci_status` quirk: it keeps echoing a STALE `E2E @ f6be5c3 FAILURE` (a long-fixed run). IGNORE it; trust
   the "latest run" line.

## TL;DR — where we are
**The interactive duel is DONE.** A human can play a full Edison turn through the web UI on **desktop AND mobile** —
connect, summon/set, advance phases, attack, respond to chains — driven by the real ocgcore engine over the live
relay. This closes the prior handoff's #1 gap ("a human cannot yet play a FULL duel through the UI"). Verified green
independently on a clean checkout; deployed live.

- `master` HEAD `d5af8c0` (code complete at `677eb933`; `4d6c13d0` board; `d5af8c0` docs/audit-trail).
- `app.zuhayr.io` (Vercel) READY — fetched HTTP 200, current build. `api.zuhayr.io` (Fly) DEPLOYED, healthcheck passing.
- CI Deploy workflow SUCCESS on `677eb93`.

## What shipped this session (all pushed; CI-green + deployed)
The greenlit "interactive duel UI" build, in verified phases. Key SHAs:
| Phase | What | SHA |
| --- | --- | --- |
| 0 | Typed `DuelDecision`/`DuelDecisionResponse` protocol in `packages/contracts` — MEASURED from the real engine (empirical catalog), 20 variants, ADR `docs/adr/0001`, Edison deck fixtures (Blackwing + Junk Frog) | `d9976070` |
| 0.5 | Mobile engineering spec `docs/working/2026-07-16-mobile-duel-engineering-spec.md` | `1c9cc50` |
| 1 | Engine adapter (ocgcore⇄contract translation) + server relay (`DECISION`/`DECISION_RESPONSE` frames) + persistence | `004e770` |
| 2 | Responsive web decision UI (desktop §6/§7 + mobile §15): DecisionDispatcher + 15 per-kind panels + GenericDecisionPanel (rare kinds) + responsive board; legacy mock-shaped path deleted | `660597b0` |
| 3 | E2E plays a REAL turn (normal summon → battle → direct attack → LP drop) at desktop + mobile viewports | `e1a5fd11` |
| fixes | Playability fixes surfaced by the Phase 3 E2E (see below) | `677eb933` |

CEO decisions locked this session (see decision records): **V1 = full decision coverage** (every engine decision
kind handled; no legal Edison play dead-ends); **test decks = Blackwing + Junk Frog**; **UX = v1-ux-flows §6–§9/§15/§16
as-is** (refine later, no dedicated design role).

## PROVEN vs UNPROVEN (be honest downstream)
**Proven (independent QA on a clean checkout `677eb933`):** `npm run verify` **731/731**; Playwright E2E **6/6**
(backbone + INVITE-01 + real-turn play-through, each at desktop + mobile). Field cards now visible, phase/turn/LP
update. Contract schema tests + per-kind panel tests + 8 playability regression tests all green. arch:check holds
(web imports contracts only).
**Unproven / not done (non-blocking follow-ups, on the board):**
1. **Effect/chain E2E** — the real-turn E2E uses the vanilla Normal-monster seed deck (deterministic). A play-through
   with the Blackwing/Junk Frog fixtures exercising a real effect/chain is DEFERRED (inherently flakier).
2. **Per-card errata behavioral tests** (pre-existing gap, residual-gap §B1) — still not individually asserted.
3. Only the 15 common decision kinds have bespoke UI; the 5 rare kinds (SelectSum/SelectCounter/SelectDisfield/
   SortCard/SortChain) use the functional GenericDecisionPanel — none observed in Edison play, but they will not
   dead-end.

## Bugs the E2E gate caught + fixed this session (each now has a regression test)
- LP never updated: ocgcore DAMAGE/RECOVER field is `amount`, not `val`.
- Own face-up field cards rendered face-down (`code=0`): the `TYPE` query flag mis-parses in this ocgcore-wasm build
  (byte misalignment) + a spread-order clobber in `buildStateForSeat.ts`. Fixed by dropping the TYPE flag + fixing spread.
- `currentPhase`/`currentTurn` frozen at 0: `EdisonDuel.updatePhaseFromMessage` never handled NEW_PHASE(41)/NEW_TURN(40)
  and used wrong constants (WIN was 100, actually 5). Now uses the real `OcgMessageType` enum.

## Open follow-ups (non-blocking — on `tasks/BOARD.md`)
- EFFECT-CHAIN-E2E (Blackwing/Junk Frog effect play-through, deferred stretch).
- MSG-NAMES-RECONCILE: `EdisonDuel.ts` `MSG_NAMES` map has several wrong type→name entries vs the real
  `OcgMessageType` enum (cosmetic — event-stream naming only; decisions use the typed adapter, not this map).
- CLEANUP: remove the now-deprecated `EngineResponse`/`RESPONSE` WS frame + dormant server handler (web is fully off it).
- HARDEN-ASSETS: `fetch-assets.sh` builds CardScripts from upstream HEAD, not pinned `847f559` (determinism risk).
- CI-HARDENING: bound long CI steps with `timeout` so a hang fails fast + logs stay readable.
- UI polish: consolidate 2C's inline selection mini-prompt onto the shared `TargetingOverlay`.

## KEY POINTERS
- **Specs (this session):** `docs/working/2026-07-16-spec-interactive-duel-{phase0,phase1,phase2,phase3,playability-fixes}.md`.
- **Epic closeout report:** `docs/working/2026-07-16-interactive-duel-EPIC-COMPLETE.md` (+ `/mnt/session/outputs/REPORT.md`).
- **Design of record:** `docs/working/2026-07-16-mobile-duel-engineering-spec.md`, `docs/working/2026-07-13-v1-ux-flows.md`.
- **ADR:** `docs/adr/0001-typed-duel-decision-protocol.md`. **Decision catalog:** `docs/working/2026-07-16-ocgcore-decision-catalog.md`.
- **Board:** `tasks/BOARD.md` (Stream 3 epic COMPLETE + follow-ups).
- **Memory (team):** `decisions/2026-07-16-interactive-duel-v1-scope.md`, `decisions/2026-07-16-duel-decision-contract-lock.md`,
  `phase1-integration-state.md`, `phase2-state.md`, `phase3-state.md`, `lessons/git-identity-set-at-session-start.md`,
  `decisions/2026-07-14-ci-deploy-health.md` (the BLOCKED-deploy / team-author-gate explainer).

## HOW TO RUN / VERIFY
- **Local gate:** `npm run verify` (typecheck → lint → arch:check → actionlint → test; 731 tests).
- **Engine WASM + assets:** `bash packages/engine/scripts/build-wasm.sh` then `fetch-assets.sh` (~3–4 min; both gitignored).
- **E2E:** `npm run build:web` then `npx playwright test e2e/playwright/duel.spec.ts` (desktop + mobile projects → 6 tests).
- **Workflow edits** go via the GitHub MCP `create_or_update_file` (gated → CEO approval); a plain `git push` cannot
  touch `.github/workflows/*`.

## RESUME (recommended first moves for the next session)
1. Verify state (First actions above): subagents, git identity, master green, `app.zuhayr.io` 200.
2. **Await the CEO's hands-on feedback** — the CEO was invited to play a few turns; board UX / mobile feel is the
   most valuable next input. Turn feedback into a polish slice.
3. Otherwise, pick up the non-blocking follow-ups above (effect-chain E2E and the deprecated-frame cleanup are the
   highest-value). Nothing is on fire; the epic is complete.
