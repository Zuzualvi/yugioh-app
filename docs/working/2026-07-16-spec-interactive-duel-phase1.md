# Spec — Interactive Duel, Phase 1: engine adapter (ocgcore ⇄ contract) + server relay/persistence

**Author:** CTO • **Date:** 2026-07-16 • **Status:** ACTIVE (delegated)
**Depends on:** Phase 0 (LOCKED) — `packages/contracts/src/duelDecision.ts` (`DuelDecision` + `DuelDecisionResponse`,
20 variants), ADR `docs/adr/0001`, catalog `docs/working/2026-07-16-ocgcore-decision-catalog.md`.
**Parent brief:** `docs/working/2026-07-15-interactive-duel-ui-plan.md`. **Contract-lock record:**
`/mnt/memory/yugioh-app-team-memory/decisions/2026-07-16-duel-decision-contract-lock.md`.

## Goal
Make the engine speak the typed contract: translate real ocgcore decision messages → `DuelDecision` (redacted,
render-ready) and `DuelDecisionResponse` → the ocgcore `OcgResponse`. Swap the server relay + persistence to the
typed frames. **Phase 1 is BACKEND-ONLY.** Do NOT touch `packages/web`. Contract changes are ADDITIVE (keep the old
frames/types so `web` still compiles) — the web migration and the removal of the old `EngineResponse`/`RESPONSE`
path happen in Phase 2. `npm run verify` MUST stay green at the Phase 1 boundary with web untouched.

## LOCKED interfaces (both engineers code to these — no variance)

### Engine public API (owned by Engineer #1, in `packages/engine`)
- `EdisonDuel.getDecisionForSeat(seat: Seat): DuelDecision | null` — the pending decision for that seat, fully
  redacted + render-ready, or `null` if that seat is not on the clock / no decision pending.
- `EdisonDuel.applyDecisionResponse(resp: DuelDecisionResponse): { ok: true } | { ok: false; error: string }` —
  validates `resp` against the CURRENT pending decision (kind match + indices in range + counts within min/max +
  cancel/pass only when allowed); on `ok`, converts to `OcgResponse` and feeds ocgcore (does NOT auto-advance —
  caller then calls `step()`); on `!ok`, returns a human error and does NOT mutate the engine.
- `EdisonDuel.getResponseLog(): DuelDecisionResponse[]` and replay via `applyLog(log: DuelDecisionResponse[])`
  (re-applies each through `applyDecisionResponse` → identical ocgcore input; determinism preserved).
- Adapter behaviors baked into `step()`/the decision layer:
  - **ChainPrompt auto-pass:** when ocgcore emits SELECT_CHAIN with empty `selects` AND not forced, the engine
    auto-responds "no" internally and keeps stepping — it NEVER surfaces an empty optional chain window.
  - **RockPaperScissors auto-resolve:** first turn is server-decided; if ocgcore ever emits RPS, the adapter
    auto-responds internally. RPS is never surfaced as a `DuelDecision`.
- Broadcast/event messages (DRAW, MOVE, SUMMON, etc.) stay as today (`redactMessageForSeat` → `RedactedEngineMessage`
  event stream). Only DECISIONS move to the typed path.

### WS frames (owned by Engineer #2, ADDITIVE in `packages/contracts/src/duel.ts`)
- Add to `DuelServerMessageSchema`: `{ type: "DECISION", decision: DuelDecisionSchema }` (sent only to the
  on-clock seat).
- Add to `DuelClientMessageSchema`: `{ type: "DECISION_RESPONSE", response: DuelDecisionResponseSchema }`.
- KEEP all existing frames (`SEAT_ASSIGNED`, `MSG`, `STATE`, `CLOCK`, `DUEL_END`, `ERROR`, `RESPONSE`, `RESIGN`)
  so `web` still compiles. Mark the old `RESPONSE` frame + `EngineResponse` `@deprecated — removed in Phase 2`.
- Response-log persisted type becomes `DuelDecisionResponse[]` (see persistence below).

## Engineer #1 — Engine adapter + EdisonDuel wiring (owns `packages/engine/**` ONLY)
Structure as one-operation-per-file under `packages/engine/src/decision/`:
- `messageToDecision.ts` — pure mapping: `(rawPendingMessages, seat, view) => DuelDecision`. Decodes EVERY decision
  message type per the catalog: resolve card `code`→`name`, decode locations→`{controller,location,sequence}`,
  decode position/race/attribute bitmasks→named enums, group IdleCommand/BattleCommand options by acting card with
  full identity `{code,name,controller,location,sequence}` (+ effect label), resolve description IDs→strings, apply
  `AnnounceCard` opcode→`filter` ({kind:"any"} default, {kind:"codes"} where resolvable). Redact hidden info
  (face-down/opponent hand → `code:0,name:""`). Exhaustive switch on the ocgcore message type with a
  compile-time-exhaustive `never` default (no silent fallthrough).
- `responseToOcgResponse.ts` — pure mapping: `(DuelDecisionResponse, pendingDecision) => OcgResponse`. Exhaustive.
- `validateDecisionResponse.ts` — pure: response.kind == decision.kind, indices in range, counts within min/max,
  cancel/pass only if allowed. Returns `{ok}|{ok:false,error}`.
- Wire into `EdisonDuel`: `getDecisionForSeat`, `applyDecisionResponse`, `getResponseLog(): DuelDecisionResponse[]`,
  `applyLog(DuelDecisionResponse[])`; store `DuelDecisionResponse` in `responseLog`; auto-pass/auto-RPS in `step()`.
- **Tests (real WASM, per decision kind):** drive the engine (using the Phase 0 fixtures) to each decision kind →
  assert `getDecisionForSeat` produces the expected `DuelDecision` (shape + redaction); then `applyDecisionResponse`
  a valid response → assert the engine advances (next `step()` progresses). Assert an INVALID response returns
  `{ok:false}` and does not mutate. Cover the live-verified kinds concretely; cover the unverified-live kinds
  (SelectSum/SelectCounter/SelectDisfield/SortCard/SortChain) with unit tests over `messageToDecision`/
  `responseToOcgResponse` using catalog/`.d.ts`-shaped fixtures.
- Do NOT edit `packages/contracts` (use the existing `DuelDecision` types) or `packages/server` or `packages/web`.

## Engineer #2 — WS frames + server relay + persistence + replay (owns `packages/contracts/src/duel.ts` + `packages/server/**`)
- `packages/contracts/src/duel.ts`: add the DECISION / DECISION_RESPONSE frames (above), keep the rest, mark old
  `RESPONSE`/`EngineResponse` deprecated. Export any new types from the contracts index if needed.
- Server relay (`packages/server/src/duel/duelSocket.ts` + related): on a WAITING decision, call
  `duel.getDecisionForSeat(onClockSeat)` and send the `DECISION` frame to that seat only (still send `STATE` to both
  and `CLOCK`). Stop sending decisions via the `MSG` frame (events still go via `MSG`). Accept `DECISION_RESPONSE`:
  call `duel.applyDecisionResponse(resp)`; on `!ok` send an `ERROR` frame (do not advance); on `ok` persist the
  response, then `step()` and broadcast the resulting STATE/events/next decision. Ignore/ްreject the old `RESPONSE`
  frame path (dormant; removed in Phase 2).
- Persistence (`packages/server/src/duel/duelStore.ts`): the response log column now stores
  `DuelDecisionResponse[]` (JSON). Replay-on-restart reads it and calls `duel.applyLog(...)`. Since NO real duels
  have completed, old-format logs are discarded/reset — do not write a migration shim.
- Server-side re-validation: the relay MUST validate the response server-side (via `applyDecisionResponse`) — never
  trust the client. An illegal/mismatched response → `ERROR` frame, no state change.
- **Tests:** relay unit/integration tests — a decision is sent only to the on-clock seat; a valid
  `DECISION_RESPONSE` advances + persists; an invalid one yields `ERROR` and no state change; restart→replay
  reproduces state. Use a fake/real engine per existing test patterns.
- Do NOT edit `packages/engine` or `packages/web`.

## Acceptance criteria (Phase 1 gate — verified by a separate QA agent on a clean checkout)
- `npm run verify` GREEN repo-wide, **web untouched and still compiling** (arch:check: web still imports contracts
  only; no new forbidden edges).
- Engine per-decision-kind tests pass against real WASM; invalid-response rejection covered.
- Server relay tests pass: on-clock-only decision delivery, server-side validation, persist + replay.
- The committed E2E backbone (`e2e/playwright/duel.spec.ts`: connect / view board / resign) STILL passes (Phase 1
  must not regress it). NOTE: a real-turn play-through E2E is Phase 3, not now.
- No `packages/web` changes in Phase 1.

## Git / delivery (per AGENTS.md)
- Confirm `git config user.email` == `zuhayralvi@gmail.com` before committing (set it if not). Keep the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.
- Own ONLY your paths; `git pull --rebase --autostash origin master` before push; never `git add -A`. Report pushed SHA.
- Do NOT touch `.github/workflows/*` (gated — CTO handles via GitHub MCP).
