# Plan — Interactive Duel UI (make a full Edison duel playable through the web UI)

**Author:** CTO • **Date:** 2026-07-15 • **Status:** PROPOSAL — awaiting CEO greenlight to build.
**Design source:** `docs/working/2026-07-13-v1-ux-flows.md` §6–§9, §15–§17 (locked V1 UX).
**Context:** `docs/working/2026-07-15-residual-gap-list.md` A1; `.../decisions/2026-07-15-live-duel-wiring-bugs.md` (Bug 3).

## The problem in one sentence
The transport + engine + relay loop is proven (E2E green), but the layer that turns a real engine
**decision** into on-screen **actions**, and a click back into a valid engine **response**, was written
against the MOCK and doesn't speak the real ocgcore protocol — so past connect/view/resign, no legal move
can be made. §17-note-1 of the UX spec calls this "the contract this UI depends on."

## Ground truth (measured this session)
- The real engine emits ocgcore decision messages; the opening decision is `SELECT_CHAIN {selects:[],forced:false}`
  (mock expected `{options,canPass}`), and it expects a **typed `OcgResponse` discriminated union** back
  (`SELECT_CHAIN → {index|null}`, `SELECT_IDLECMD → {action,index}`, `SELECT_CARD → {indices}`,
  `SELECT_POSITION → {position}`, `SELECT_PLACE → {...}`, `SELECT_EFFECTYN/YESNO → yes/no`,
  `SELECT_OPTION → {index}`, `SELECT_TRIBUTE`, `SELECT_SUM`, `ANNOUNCE_* → {value}`, …). Current wire uses
  `EngineResponse {type:number,value?}` + ActionPanel `{type:1,value}` — incompatible.

## Architecture decision (the load-bearing one)
**Introduce a stable, TYPED duel-decision protocol in `packages/contracts`, and do the ocgcore⇄contract
translation INSIDE the engine — the web renders/responds purely against the contract.** Rationale:
- **Arch rule:** web imports contracts only; it must never see ocgcore shapes. Keep ocgcore fully inside the
  engine (it already owns `RawEngineMessage` + redaction).
- **Constrain the output space / no drift:** one typed variant per decision kind; schema drift becomes a
  compile error, not a silent mock/real mismatch (exactly the bug class that shipped here).
- **Replaces** the mock-shaped `RedactedEngineMessage` passthrough + `decisionOptions.ts` + `{type:1,value}`.

Two new contract unions (names illustrative — locked in Phase 0):
- `DuelDecision` — per-seat, redacted, everything the UI needs to render one decision. Variants:
  `IdleCommand`, `BattleCommand`, `ChainPrompt`, `SelectCard`, `SelectUnselectCard`, `SelectZone`
  (place/disfield), `SelectPosition`, `YesNo` (effectyn/yesno), `SelectOption`, `SelectTribute`, `SelectSum`,
  `SelectCounter`, `Announce` (attrib/card/number/race). Each carries only redacted, render-ready data
  (candidate cards with name/code/zone, min/max, cancelable, the neutral prompt string, etc.).
- `DuelDecisionResponse` — per-variant user choice (indices / zone / position / bool / announced value).

**Determinism/replay:** the engine converts `DuelDecisionResponse → OcgResponse` internally; the
`response_log` persists the `DuelDecisionResponse` (clean contract domain) and replay re-applies it through
the same adapter → identical ocgcore input. (Migration: existing logs use the old `EngineResponse` shape;
since no real duels have been played to completion, we can reset/ignore old logs — confirm no live duels exist.)

## Phases (each merges with its tests; a green CI + the extended E2E is the sign-off)

### Phase 0 — Lock the protocol (contracts-first; do BEFORE any UI)
- Empirically enumerate the ocgcore decision + response shapes that actually occur in Edison play (drive the
  real engine through: normal/tribute summon, set, flip, activate ignition, attack/battle, chain windows,
  targeting, position select, tribute select, announce). Deliverable: a decision-catalog note.
- Author `DuelDecision` + `DuelDecisionResponse` Zod schemas + types in `packages/contracts/src/duelDecision.ts`
  (export from index). Redaction rules baked in (hidden info never in the contract).
- Write the ADR + review with CEO/CTO. **Gate:** contracts typecheck + schema unit tests.

### Phase 1 — Engine adapter (ocgcore ⇄ contract) + relay/persistence swap
- Engine: `getDecisionForSeat(seat): DuelDecision | null` (typed, redacted; replaces raw decision passthrough
  for decisions) and `applyDecisionResponse(resp: DuelDecisionResponse): void` (validates against the pending
  decision, converts to `OcgResponse`, feeds ocgcore). Keep broadcast/event messages (draws/moves) as-is.
- Server relay (`duelSocket.ts`): send `DuelDecision` frames; accept `DuelDecisionResponse` frames; persist the
  response in the log; server-side validate the response matches the pending decision (reject illegal shapes).
- **Gate:** per-decision-kind engine unit tests (real WASM produces each decision → assert the mapping; apply a
  response → assert the engine advances). Server relay tests. Full `verify` green.

### Phase 2 — Web: render + respond against the contract, to §6/§7 fidelity
- Replace `decisionOptions.ts` + ActionPanel encode with a **decision dispatcher** keyed on the `DuelDecision`
  discriminant; one component per decision kind (one-operation-per-file):
  - §6 board: phase rail + End Turn, whose-turn/phase ribbon, actionable markers, card-click → legal-actions
    menu (from `IdleCommand`/`BattleCommand`), animated LP.
  - §7: priority prompt + "respond with (legal only)" picker (`ChainPrompt`), chain stack + top-down resolution.
  - §8: targeting/selection mode (`SelectCard`/`SelectZone`/`SelectTribute`/`SelectSum`) — pulse valid,
    confirm/cancel, running count.
  - `SelectPosition`, `YesNo`, `SelectOption`, `Announce*` components.
- Delete the mock duel session's now-divergent decision shapes (or realign the mock to the contract so unit
  tests stay meaningful).
- **Gate:** component tests driving each decision variant from fixture contract objects.

### Phase 3 — E2E upgrade: PLAY a real turn (the real proof)
- Extend `e2e/playwright/duel.spec.ts`: seat 0 normal-summons a monster + advances phases; assert the monster
  appears in a monster zone and the turn/phase ribbon advances; seat 1 takes its turn; ideally reach a battle +
  LP change or a win. This turns the CI proof from "backbone" into "a real duel is playable end-to-end."

### Phase 4 (follow-on slice) — Mobile board (§15) + accessibility (§16)
- The mobile 2-player board (flagged as *the* central V1 UX risk) + a11y (tap targets, no-color-alone,
  reduced-motion, contrast/dark mode, keyboard). Desktop-playable is the MVP gate; this is the next slice.

## Delegation shape (once subagent spawn is restored)
- Phase 0: CTO + 1 Backend (contract design + empirical catalog).
- Phase 1: 1–2 Backend Engineers (engine adapter + relay), disjoint by decision-kind groups.
- Phase 2: 2–3 Frontend Engineers, disjoint files (board / prompts+chain / targeting+selects).
- Phase 3: QA. Everything gated by CI + a separate QA agent.

## Risks / decisions to make
- **Scope of "playable V1":** which decision kinds are in-scope (all that arise in the Edison meta; some
  ocgcore messages — SORT_CARD, ROCK_PAPER_SCISSORS — are rare/absent and can be minimally handled).
- **Mobile+a11y in this slice vs a follow-on** (recommend follow-on; desktop-playable first).
- **Log migration:** confirm no in-progress real duels before changing the response-log shape.
- This is a substantial build spanning contracts + engine + web (Phases 0–3 to reach desktop-playable); it is
  NOT a close-out papercut.
