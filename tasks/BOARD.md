# Stream 2 — Edison Dueling Slice — Work Board

_Last updated: 2026-07-15_

---

## ⚠ Blockers / Notes

- **Live duel BACKBONE is now PROVEN in CI (2026-07-15)** — committed Playwright E2E (`e2e/playwright/duel.spec.ts`, workflow `.github/workflows/e2e.yml`) is green on master: 2 seats connect over the real WS, both boards render real engine STATE, the on-clock decision is delivered, RESIGN round-trips to both. Fixed two wiring bugs to get here (WS path + pending-decision-on-connect).
- **Slice 20 / Slice 30**: exercised end-to-end against the REAL backend by the E2E. A dedicated separate-QA-agent pass is still pending (subagent spawn was DOWN this session).
- **BIG remaining build**: the web interactive decision layer (`decisionOptions.ts` decode + ActionPanel response encode) is MOCK-ONLY — a human cannot yet play a FULL duel through the UI. Deferred completion of Slice 30's real-engine integration; flagged to CEO, OUT of close-out. See `docs/working/2026-07-15-residual-gap-list.md` (A1).
- **Slice 50 / per-card ERRATA assertions**: 6 Edison rules pass in CI; per-card behavioral assertions still NOT written (held pending QA-agent spawn). Priority list in the residual-gap doc (B1).
- **No new hosting spend** for scope B: WebSockets ride the existing Fly backend + volume.
- **Shared-tree env**: run `npm install` after pulling; push with `git push origin HEAD:master`.

## 🔧 Recently Shipped / Fixed

- **Live-duel wiring fixes + E2E — DONE (2026-07-15)**: WS path fix (SHA ca99526), pending-decision-on-connect (SHA a442645), committed Playwright E2E (SHA 10bf0b5) + CI workflow (SHA f36f321, via gated MCP). `E2E` workflow on master = SUCCESS.
- **WASM build in CI — RESOLVED (2026-07-15)**: custom ocgcore WASM now builds via emsdk in the `accuracy` CI job (with caching + card-asset fetch); 6 Edison rules pass empirically on every push to master. Previous CRITICAL PATH BLOCKER is closed.
- **Frontend Vercel deploy — DONE (2026-07-15)**: token-based CI deploy job in `.github/workflows/deploy.yml`; `app.zuhayr.io` now serves the current build on every push to master. The Vercel deploy gap is closed.
- **master went red on the prettier gate** — scoped verify missed it; CTO hand-fixed (SHA f458e4b). Infra added a pre-commit format hook to prevent recurrence.

---

## Stream 1 — Card-Text Fix — DONE ✅

| Task                                      | Status  | Notes              |
| ----------------------------------------- | ------- | ------------------ |
| Card-text pre-errata overrides (35 cards) | ✅ DONE | Pushed SHA b8ca8d1 |

---

## Stream 2 — Dueling Slice (Scope B: synchronous shareable-link duels)

> Async timers + matchmaking are the **NEXT** slice (out of scope here).

| Slice | Package / Area                                                                                                                                           | Owner            | Wave | Dep    | Status                                                                                                              | Spec                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 00    | Duel contracts (`packages/contracts`)                                                                                                                    | BE1              | 1    | —      | ✅ DONE (SHA 2c96c8c, 31 tests)                                                                                     | [stream2-00-duel-contracts.md](/workspace/specs/stream2-00-duel-contracts.md)                 |
| 10    | Engine core (`packages/engine`: WASM build, EDISON_FLAGS bitmask, rule #10 LP-cost patch, per-seat redaction, determinism)                               | BE1              | 1    | 00     | ✅ DONE — empirical rule tests RUN and PASS in CI (`accuracy` job; 6 Edison rules green, SHA eb5e40d)               | [stream2-10-engine-core.md](/workspace/specs/stream2-10-engine-core.md)                       |
| 40    | Card-script curation diff+stage (`spikes/card-script-curation`)                                                                                          | BE2              | 1    | —      | ✅ DONE (SHA b3d28f6) — 11 drop-in + 1 fixed (REDMD) staged, 5 modern-ok, 6 rules-level, 13 need authoring          | [stream2-40-card-script-curation.md](/workspace/specs/stream2-40-card-script-curation.md)     |
| 20    | Server duel infra (`packages/server`: relay, redaction routing, persistence/replay, reconnect, shareable-link lifecycle, WS, synchronous per-move timer) | Backend Engineer | 2    | 00, 10 | ✅ LANDED + deployed (`api.zuhayr.io`) — needs independent QA; live 2-player e2e NOT yet smoke-tested               | [stream2-20-server-duel-infra.md](/workspace/specs/stream2-20-server-duel-infra.md)           |
| 30    | Web duel UI (`packages/web`: board, legal actions + priority windows, timer display, create/join-via-link, reconnect)                                    | —                | 2    | 00     | ✅ LANDED (SHA 701f548, 93 tests, tested vs mock) — needs QA against real backend                                   | [stream2-30-web-duel-ui.md](/workspace/specs/stream2-30-web-duel-ui.md)                       |
| 50    | Rules-validation tests (#5/#9/#11 confirm, #7/#8/#4 test, #10 verify)                                                                                    | QA               | 2    | 10, 20 | 🟡 PARTIAL — 6 Edison rules validated in CI (`accuracy` job); per-card ERRATA behavioral assertions NOT yet written | [stream2-50-rules-validation-tests.md](/workspace/specs/stream2-50-rules-validation-tests.md) |

### Additional work items

| Item                                     | Owner          | Dep                  | Status                                                                                                           | Source                                                                  |
| ---------------------------------------- | -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Infra — CI/deploy health + observability | Infra Engineer | —                    | 🔄 IN PROGRESS                                                                                                   | [infra-ci-deploy-health.md](/workspace/specs/infra-ci-deploy-health.md) |
| CTO Lua authoring worklist — 13 cards    | CTO            | WASM engine runnable | 🟡 AUTHORED (25 override scripts in `packages/engine/scripts/edison-overrides/`) — behavioral assertions pending | `spikes/card-script-curation/REPORT.md`                                 |

### Status legend

| Icon                | Meaning                                            |
| ------------------- | -------------------------------------------------- |
| ✅ DONE             | Landed and pushed; SHA recorded                    |
| ⚠️ LANDED (partial) | Code merged but validation blocked on external dep |
| 🔄 IN PROGRESS      | Actively being worked                              |
| 🟡 QUEUED           | Ready to start once dependency clears              |
| 🔴 BLOCKED          | Cannot start; waiting on stated dep(s)             |
| ⬜ TODO             | Not yet started, no active blocker                 |

---

## Duel initiation (invite-link) — spec-vs-build gaps (CTO analysis 2026-07-15)

> Context: the invite-link-to-start-a-duel flow IS built and the happy path works, but it's a leaner model than the spec (`docs/working/2026-07-14-link-first-lobby-change.md` + `-link-first-initiation-flow.md`). join = immediate duel start (no pre-duel room). The items below track the gap between spec and build.

### MVP fixes — recommended before real use

| ID        | Item                                                                                 | Priority | Status  | Notes                                                                                           |
| --------- | ------------------------------------------------------------------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| INVITE-01 | Preserve duel-invite link through login — capture intended path + resume after auth. | MVP      | ✅ DONE | SHA be9c2b2; `RequireAuth` state.from + LoginScreen resume; E2E-covered.                        |
| INVITE-02 | Show per-move timer on Join screen BEFORE "Accept" (informed consent, REQ-TIMER-11). | MVP      | ✅ DONE | SHA a442645 (GET /api/duels/join/:token) + be9c2b2 (JoinDuelScreen timer + disable-if-started). |

### Deferred — conscious decision, safe for a trusted 6-person club

| ID        | Item                                                                                                                                                                                                                                | Priority  | Status             | Notes                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------ | -------------------------------------------------------------------------- |
| INVITE-03 | Pre-duel room (REQ-ROOM): both players ready-up, timer shown to both, first-turn decision, then Start. Currently join = immediate start.                                                                                            | Deferred  | ⬜ TODO (deferred) | Spec: `docs/working/2026-07-14-link-first-lobby-change.md`                 |
| INVITE-04 | Randomize first turn (coin/dice neither can rig). Currently creator (seat 0) always goes first.                                                                                                                                     | Deferred  | ⬜ TODO (deferred) | Server-side RNG at duel start                                              |
| INVITE-05 | Link expiry (default 24h) + creator revoke of an unclaimed link. Currently links never expire and cannot be revoked.                                                                                                                | Deferred  | ⬜ TODO (deferred) | `packages/server/src/duel/duelStore.ts`, `duel/duelRoutes.ts`              |
| INVITE-06 | Distinct link-open states (already-claimed / expired-revoked / members-only) instead of single generic error toast in `JoinDuelScreen`.                                                                                             | Deferred  | ⬜ TODO (deferred) | `packages/web/src/screens/JoinDuelScreen.tsx`                              |
| INVITE-07 | Home async surfaces: pending-invite card (Copy/Share/Revoke + "opponent joined"), "Your move" queue, "waiting on opponent". Currently placeholder seams in `HomeScreen.tsx`; invite link only transiently visible on create screen. | Deferred  | ⬜ TODO (deferred) | `packages/web/src/screens/HomeScreen.tsx`                                  |
| INVITE-08 | Copy/UX polish: "Start a duel"/"invite to play" framing (vs current "Duel a friend"/"You've been challenged"); deck legality chips + disabled action on illegal deck.                                                               | Deferred  | ⬜ TODO (deferred) | Web screens                                                                |
| INVITE-09 | Atomic seat-claim DB compare-and-set (`UPDATE duel SET ... WHERE id=? AND status='waiting_for_opponent'`, check affected rows). Safe TODAY (single Fly instance + synchronous handler); would double-claim if ever multi-instance.  | Hardening | ⬜ TODO (deferred) | `packages/server/src/duel/duelStore.ts` (`joinDuel`), `duel/duelRoutes.ts` |

---

## Dependency graph (reminder)

```
contracts (00)  ←  engine (10)  ←  server (20)
     ↑                                 ↑
    web (30)              rules-tests (50, also ← 10)
card-script (40)  [independent]
WASM build        [CI-green — gates 10 empirical, 50, Lua authoring]
```

Full plan: `docs/working/2026-07-14-cto-decisions-and-stream2-plan.md`
