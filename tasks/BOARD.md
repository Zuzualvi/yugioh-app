# Stream 2 — Edison Dueling Slice — Work Board

_Last updated: 2026-07-14_

---

## ⚠ Blockers / Notes

- **Slice 10** is blocked until **Slice 00** contracts land (types not yet published).
- **Slice 20** is blocked on both **Slice 00** and **Slice 10** landing.
- **Slice 30** is blocked on **Slice 00** landing.
- **Slice 50** is blocked on **Slice 10** and **Slice 20** landing.
- **No new hosting spend** for scope B: WebSockets ride the existing Fly backend + volume — no new service provisioning needed.
- **Shared-tree env**: run `npm install` after pulling; repo is in detached HEAD state — push with `git push origin HEAD:master`.

---

## Stream 1 — Card-Text Fix — DONE ✅

| Task                                      | Status  | Notes              |
| ----------------------------------------- | ------- | ------------------ |
| Card-text pre-errata overrides (35 cards) | ✅ DONE | Pushed SHA b8ca8d1 |

---

## Stream 2 — Dueling Slice (Scope B: synchronous shareable-link duels)

> Async timers + matchmaking are the **NEXT** slice (out of scope here).

| Slice | Package / Area                                                                                                                                           | Owner | Wave | Dep    | Status                   | Spec                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---- | ------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| 00    | Duel contracts (`packages/contracts`)                                                                                                                    | BE1   | 1    | —      | 🔄 IN PROGRESS           | [stream2-00-duel-contracts.md](/workspace/specs/stream2-00-duel-contracts.md)                 |
| 10    | Engine core (`packages/engine`: WASM build, EDISON_FLAGS bitmask, rule #10 LP-cost patch, per-seat redaction, determinism)                               | BE1   | 1    | 00     | 🟡 QUEUED (behind 00)    | [stream2-10-engine-core.md](/workspace/specs/stream2-10-engine-core.md)                       |
| 40    | Card-script curation diff+stage (`spikes/card-script-curation`)                                                                                          | BE2   | 1    | —      | 🔄 IN PROGRESS           | [stream2-40-card-script-curation.md](/workspace/specs/stream2-40-card-script-curation.md)     |
| 20    | Server duel infra (`packages/server`: relay, redaction routing, persistence/replay, reconnect, shareable-link lifecycle, WS, synchronous per-move timer) | TBD   | 2    | 00, 10 | 🔴 BLOCKED on 00+10      | [stream2-20-server-duel-infra.md](/workspace/specs/stream2-20-server-duel-infra.md)           |
| 30    | Web duel UI (`packages/web`: board, legal actions + priority windows, timer display, create/join-via-link, reconnect)                                    | TBD   | 2    | 00     | 🔴 BLOCKED on 00 landing | [stream2-30-web-duel-ui.md](/workspace/specs/stream2-30-web-duel-ui.md)                       |
| 50    | Rules-validation tests (#5/#9/#11 confirm, #7/#8/#4 test, #10 verify)                                                                                    | QA    | 2    | 10, 20 | 🔴 BLOCKED on 10+20      | [stream2-50-rules-validation-tests.md](/workspace/specs/stream2-50-rules-validation-tests.md) |

### Status legend

| Icon           | Meaning                                |
| -------------- | -------------------------------------- |
| ✅ DONE        | Landed and pushed; SHA recorded        |
| 🔄 IN PROGRESS | Actively being worked                  |
| 🟡 QUEUED      | Ready to start once dependency clears  |
| 🔴 BLOCKED     | Cannot start; waiting on stated dep(s) |
| ⬜ TODO        | Not yet started, no active blocker     |

---

## Dependency graph (reminder)

```
contracts (00)  ←  engine (10)  ←  server (20)
     ↑                                 ↑
    web (30)              rules-tests (50, also ← 10)
card-script (40)  [independent]
```

Full plan: `docs/working/2026-07-14-cto-decisions-and-stream2-plan.md`
