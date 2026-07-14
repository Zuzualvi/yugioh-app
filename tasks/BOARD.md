# Stream 2 — Edison Dueling Slice — Work Board

_Last updated: 2026-07-14_

---

## 🚨 CRITICAL PATH BLOCKER

> **Custom ocgcore WASM cannot be built in agent envs (emsdk ~290 MB).**
> This gates: engine empirical rule tests (10 skipped), the 13-card Lua authoring worklist, server integration tests, and the QA rules suite.
> **Infra is assessing (P1.5).**

---

## ⚠ Blockers / Notes

- **Slice 10** landed structurally but 10 empirical rule tests are SKIPPED — blocked on custom WASM build (see critical path above).
- **Slice 20** in progress; server integration tests will be blocked on WASM.
- **Slice 50 (QA)** blocked on the WASM build (empirical rules cannot be validated without it).
- **CTO Lua authoring worklist (13 cards)** blocked on a runnable/testable WASM engine.
- **No new hosting spend** for scope B: WebSockets ride the existing Fly backend + volume — no new service provisioning needed.
- **Shared-tree env**: run `npm install` after pulling; repo is in detached HEAD state — push with `git push origin HEAD:master`.

## 🔧 Recently Fixed

- **master went red on the prettier gate** — scoped verify missed it; CTO hand-fixed (SHA f458e4b). Infra is adding a pre-commit format hook to prevent recurrence.

---

## Stream 1 — Card-Text Fix — DONE ✅

| Task                                      | Status  | Notes              |
| ----------------------------------------- | ------- | ------------------ |
| Card-text pre-errata overrides (35 cards) | ✅ DONE | Pushed SHA b8ca8d1 |

---

## Stream 2 — Dueling Slice (Scope B: synchronous shareable-link duels)

> Async timers + matchmaking are the **NEXT** slice (out of scope here).

| Slice | Package / Area                                                                                                                                           | Owner            | Wave | Dep    | Status                                                                                                     | Spec                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---- | ------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 00    | Duel contracts (`packages/contracts`)                                                                                                                    | BE1              | 1    | —      | ✅ DONE (SHA 2c96c8c, 31 tests)                                                                            | [stream2-00-duel-contracts.md](/workspace/specs/stream2-00-duel-contracts.md)                 |
| 10    | Engine core (`packages/engine`: WASM build, EDISON_FLAGS bitmask, rule #10 LP-cost patch, per-seat redaction, determinism)                               | BE1              | 1    | 00     | ⚠️ LANDED; empirical validation BLOCKED on WASM (SHA eb5e40d, 10 tests skipped)                            | [stream2-10-engine-core.md](/workspace/specs/stream2-10-engine-core.md)                       |
| 40    | Card-script curation diff+stage (`spikes/card-script-curation`)                                                                                          | BE2              | 1    | —      | ✅ DONE (SHA b3d28f6) — 11 drop-in + 1 fixed (REDMD) staged, 5 modern-ok, 6 rules-level, 13 need authoring | [stream2-40-card-script-curation.md](/workspace/specs/stream2-40-card-script-curation.md)     |
| 20    | Server duel infra (`packages/server`: relay, redaction routing, persistence/replay, reconnect, shareable-link lifecycle, WS, synchronous per-move timer) | Backend Engineer | 2    | 00, 10 | 🔄 IN PROGRESS                                                                                             | [stream2-20-server-duel-infra.md](/workspace/specs/stream2-20-server-duel-infra.md)           |
| 30    | Web duel UI (`packages/web`: board, legal actions + priority windows, timer display, create/join-via-link, reconnect)                                    | —                | 2    | 00     | ✅ DONE (SHA 701f548, 93 tests) — full duel loop against mock                                              | [stream2-30-web-duel-ui.md](/workspace/specs/stream2-30-web-duel-ui.md)                       |
| 50    | Rules-validation tests (#5/#9/#11 confirm, #7/#8/#4 test, #10 verify)                                                                                    | QA               | 2    | 10, 20 | 🔴 BLOCKED on WASM build (empirical)                                                                       | [stream2-50-rules-validation-tests.md](/workspace/specs/stream2-50-rules-validation-tests.md) |

### Additional work items

| Item                                     | Owner          | Dep                  | Status                                      | Source                                                                  |
| ---------------------------------------- | -------------- | -------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Infra — CI/deploy health + observability | Infra Engineer | —                    | 🔄 IN PROGRESS                              | [infra-ci-deploy-health.md](/workspace/specs/infra-ci-deploy-health.md) |
| CTO Lua authoring worklist — 13 cards    | CTO            | WASM engine runnable | 🔴 BLOCKED on runnable/testable WASM engine | `spikes/card-script-curation/REPORT.md`                                 |

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

## Dependency graph (reminder)

```
contracts (00)  ←  engine (10)  ←  server (20)
     ↑                                 ↑
    web (30)              rules-tests (50, also ← 10)
card-script (40)  [independent]
WASM build        [critical path — gates 10 empirical, 50, Lua authoring, server integration]
```

Full plan: `docs/working/2026-07-14-cto-decisions-and-stream2-plan.md`
