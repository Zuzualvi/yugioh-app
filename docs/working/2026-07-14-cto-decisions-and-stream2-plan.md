# CTO Decisions & Stream 2 Plan (scope B) — 2026-07-14

**From:** CTO  •  **To:** CEO (audit trail)  •  Entry context: `2026-07-13-CTO-BRIEF.md`

## Decisions

### D1 — Edison rule #10 (LP cost that reduces LP to exactly 0): PATCH the fork
The engine allows paying an LP cost down to exactly 0 (`<=`, modern); Edison forbids
it (must survive with ≥1 LP). Delegated to CTO on fork-maintenance grounds. Decided:
**patch** (`<=` → `<` in `check_lp_cost` field.cpp and `PayLPCost` operations.cpp),
as a checked-in patch file applied by our reproducible WASM build, plus an empirical
test. Rationale: we already OWN the source build (Spike E: reproducible `build-wasm.sh`,
pinned edo9300 `@8e5f4e4`, and we already alter engine behavior there), so the marginal
cost is a 2-operator patch. Accuracy is the non-negotiable. Full record in team memory
`decisions/2026-07-14-lp-cost-to-zero-patch.md`.

### D2 — V1 dueling scope: B (synchronous shareable-link duels first) — CEO call
Chosen by CEO. V1 ships rules-ENFORCING **synchronous** duels created via a shareable
link (get a real, accurate duel in front of the player group sooner; de-risk engine
integration before layering async on top). **Async/multi-day timers + matchmaking are
the immediate NEXT slice**, not V1. The contracts already accommodate async (a deadline
is a deadline). No "why is this illegal?" explainer in V1 (that stays V2).

### D3 — Execution calls (CTO-owned, from the brief's open items)
- Script curation: **diff before authoring**; author only real gaps.
- Empirical rule tests (#5/#9/#11 confirm, #7/#8/#4 test, #10 verify) fold into the
  dueling suite; `npm run verify` gates them.
- Maintain a documented residual-gap list for anything knowingly left on modern behavior.
- Duel wire contracts: envelope + lifecycle are strictly typed; the ~50 ocgcore
  message BODIES are not exhaustively typed in V1 (engine owns both sides). Revisit if
  web needs stronger per-message guarantees.

## Stream 1 (card-text fix) — DELIVERED
35 verbatim March-2010 overrides applied as a build-pipeline data layer + regression
test. Committed catalog diff = exactly 35 `desc` fields. 221 tests green.
Pushed: **b8ca8d1**.

## Stream 2 (scope B) — build plan & slices
Dependency order per `AGENTS.md` (contracts ← engine ← server; web ← contracts):

| Slice | Package | Owner | Depends on | Spec |
|---|---|---|---|---|
| 00 Duel contracts | contracts | BE1 | — | stream2-00-duel-contracts |
| 10 Engine core (WASM, EDISON_FLAGS, #10 patch, redaction, determinism) | engine | BE1 | 00 | stream2-10-engine-core |
| 20 Server duel infra (relay, redaction routing, persistence/replay, reconnect, shareable-link lifecycle, WS, sync timer) | server | BE (next wave) | 00,10 | (next) |
| 30 Web duel UI (board, legal actions + priority windows, timer, create/join-link, reconnect) | web | FE (next wave) | 00 | (next) |
| 40 Card-script curation (diff + stage; authoring = CTO) | spikes/ standalone | BE2 | — | stream2-40-card-script-curation |
| 50 Rules-validation tests (#5/#9/#11/#7/#8/#4/#10) | engine/server | QA (next wave) | 10,20 | (next) |

**Mobilized now (wave 1):** slice 00→10 (BE1, contracts-first so it unblocks web),
slice 40 (BE2, independent), task board (Task Manager). Web/server/QA fan out on the
contracts+engine landing signal. **No new hosting spend** — WebSockets ride the
existing Fly backend + volume.

## Definition of done (accuracy bar, unchanged)
Two legal Edison decks reproduce March-2010 behavior on the format-defining
interactions, every knowing deviation documented; green `verify` is sign-off.
