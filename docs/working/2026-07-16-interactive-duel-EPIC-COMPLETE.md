# Interactive Duel UI — Epic Closeout Report

**Date:** 2026-07-16 · **Audience:** CEO · **Author:** Engineering

---

## What shipped

A full Edison-format duel is now **PLAYABLE through the web UI** — desktop and mobile — against the real `ocgcore-wasm` engine. This replaces the mock-only interactive layer that existed at the start of the epic.

The delivered stack, end-to-end:

1. **Typed `DuelDecision` protocol** — a `z.discriminatedUnion` of 20 decision variants (`IdleCommand`, `BattleCommand`, `ChainPrompt`, `SelectCard`, `SelectUnselectCard`, `SelectTribute`, `SelectZone`, `SelectPosition`, `YesNo`, `SelectOption`, `SelectCounter`, `AnnounceAttribute`, `AnnounceRace`, `AnnounceCard`, `AnnounceNumber`, `SortCard`, `RockPaperScissors`, and the rare gate-coverage kinds). Shaped by empirical measurement against the real ocgcore engine — no invented wire formats.

2. **Engine ⇄ contract translation** — `messageToDecision` (ocgcore → `DuelDecision`, with per-seat redaction baked in) and `responseToOcgResponse` (`DuelDecisionResponse` → `OcgResponse`), with compile-time-exhaustive switches and per-kind real-WASM tests.

3. **Server relay** — the relay delivers a typed `DECISION` frame to the on-clock seat only, validates `DECISION_RESPONSE` server-side before advancing the engine, and persists `DuelDecisionResponse[]` for replay-on-restart.

4. **Responsive board + all 15 decision-kind panels** — a single reflowed component system (phone ≤599 / tablet 600–1023 / desktop ≥1024): board, phase rail, whose-turn ribbon, animated LP, hand fan, zones, card inspector, `DecisionDispatcher`, `DecisionBottomSheet` (mobile) / `ActionContextMenu` (desktop), `TargetingOverlay`, and polished panels for every non-rare decision kind. Rare kinds (SelectSum / SelectCounter / SelectDisfield / SortCard / SortChain) fall through to `GenericDecisionPanel` — no dead ends.

5. **E2E that plays a real turn** — Playwright test drives two browser seats, Alice normal-summons a monster → SelectZone placement → advances to Battle Phase → direct attack → asserts Bob's LP dropped from 8000. Runs at both desktop (1280×800) and mobile-portrait (Pixel-class, 393×851).

---

## Phase timeline and key SHAs

| Phase | Description | SHA |
|-------|-------------|-----|
| Phase 0 | Typed `DuelDecision` / `DuelDecisionResponse` contract locked; ocgcore decision catalog; Edison fixture decks; ADR `0001` | `d9976070` |
| Phase 0.5 | Contract addenda: per-entity action grouping in `IdleCommand`/`BattleCommand`; `cancelable`/`canPass` on every variant; `prompt` string pre-rendered in payload; RPS auto-resolve rule | `1c9cc50` |
| Phase 1 | Engine adapter (`messageToDecision`, `responseToOcgResponse`, `validateDecisionResponse`); `EdisonDuel.getDecisionForSeat` / `applyDecisionResponse` / `getResponseLog` / `applyLog`; server relay + persistence swap; ChainPrompt auto-pass + RPS auto-resolve in `step()` | `004e770` |
| Phase 2 | Responsive board + all 15 decision panels + `DecisionDispatcher`; legacy `decisionOptions.ts` / `EngineResponse` web path removed; mock realigned to typed frames | `660597b0` |
| Phase 3 | E2E real-turn play-through at desktop + mobile-portrait viewports | `e1a5fd11` |
| Playability fixes | Bug A (field cards face-down) + Bug B (phase/turn frozen) — engine-only fixes with real-WASM tests | `677eb933` |

---

## Verification

Independently QA-verified on a clean checkout:

- **`npm run verify` — 731/731 passing** (typecheck → lint → arch:check → test suite, including all new per-decision-kind engine tests and panel component tests).
- **Playwright E2E — 6/6 passing**: backbone, INVITE-01, and the real-turn play-through at both desktop and mobile-portrait viewports.
- **CI Deploy — SUCCESS** on the pushed commit.
- **Vercel READY** — `app.zuhayr.io` live.
- **Fly DEPLOYED** — `api.zuhayr.io` live.

---

## Bugs caught and fixed by the E2E gate

Three pre-existing engine bugs surfaced when the Phase 3 E2E drove a real turn for the first time:

| Bug | Root cause | Fix |
|-----|-----------|-----|
| **LP not updating** | Board was reading `amount` from the RECOVER/DAMAGE message; the real field name is `val` | Corrected field name in the LP update handler |
| **Field cards showing face-down** (own face-up monsters displayed as `code=0`) | Spread-order bug in `buildStateForSeat.ts`: `{ code: <computed>, ...card }` — the `...card` spread clobbered the computed `code` with the raw query object's `0` value | Restored correct spread precedence; now `{ ...card, code: <computed> }` |
| **Phase/turn display frozen at 0** | `updatePhaseFromMessage` only handled DAMAGE/RECOVER/WIN; `NEW_PHASE` and `NEW_TURN` messages were unhandled, so `currentPhase`/`currentTurn` never advanced | Added handlers for the correct ocgcore `NEW_PHASE` / `NEW_TURN` message-type constants (read from the installed `.d.ts`; not guessed) |

All three were fixed in the playability-fixes commit (`677eb933`) with real-WASM regression tests.

---

## Known follow-ups (non-blocking — the duel is playable today)

- **Effect/chain E2E** (Blackwing / Junk Frog fixture decks): deferred as a stretch goal from Phase 3. Inherently flakier than the vanilla-deck core; revisit once the team has bandwidth.
- **Remove deprecated `EngineResponse` / `RESPONSE` frame**: the old passthrough types are still in `packages/contracts` and the dormant server handler exists; they are dead code. A cleanup pass can remove them safely.
- **Reconcile `EdisonDuel` `MSG_NAMES` vs real ocgcore enum**: some string-name constants in the engine adapter were reconstructed from the `.d.ts` rather than a live enum; should be reconciled against an authoritative source.
- **Pin `CardScripts`**: the ocgcore script assets are fetched at build time from a floating URL; should be pinned to a content-addressed ref for reproducible builds.
- **CI step timeouts**: the WASM build step in CI is close to the timeout threshold under load; consider caching the WASM artifact.
- **Consolidate 2C's inline mini-prompt onto `TargetingOverlay`**: `SelectCardPanel` / `SelectUnselectCardPanel` render a small confirmation prompt inline; this could be unified with the shared `TargetingOverlay` confirm rail in a later UI pass.
