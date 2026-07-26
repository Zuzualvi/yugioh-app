# Spec — Interactive Duel, Phase 3: E2E plays a REAL turn (mobile + desktop)

**Author:** CTO • **Date:** 2026-07-16 • **Status:** ACTIVE (delegated) • **Final phase of the interactive-duel epic.**
**Depends on:** Phase 2 DONE (full decision UI live; master `660597b0`). Parent brief:
`docs/working/2026-07-15-interactive-duel-ui-plan.md` (Phase 3).

## Goal
Prove — automatically, in CI — that a human can PLAY A REAL TURN through the browser UI, on BOTH a mobile-portrait
AND a desktop viewport. This is the end-to-end proof the whole epic was building toward: connect → the on-clock
player normal-summons a monster → advances to Battle Phase → attacks → LP changes — all by clicking the real
panels, driven by the real WASM engine over the live relay.

## Scope decision (CTO — not gold-plating)
- **REQUIRED (core):** a real-turn play-through using the EXISTING vanilla seed deck (`e2e/harness/seed.ts` DECK40 —
  all Normal monsters). It deterministically exercises the essential loop: `IdleCommand` (normal summon) →
  `SelectZone` (placement) → advance phase → `BattleCommand` (attack) → damage. Run it at a desktop viewport AND a
  mobile-portrait (Pixel-class) viewport. This is the meaningful proof and must be non-flaky.
- **STRETCH (optional, only if it lands clean & deterministic):** a second play-through seeded with the
  Blackwing / Junk Frog fixtures (`packages/engine/src/testSupport/edisonDecks.ts`) to exercise an effect/chain
  decision. If it proves flaky or time-consuming, DEFER it (note as a follow-up) — do NOT block Phase 3 on it.
  Effect/chain E2E is inherently flakier; the vanilla core is the required bar.

## Work
1. **Read the panels to learn the interaction + testids** (do NOT change them): `packages/web/src/components/duel/
   decisions/{IdleCommandPanel,SelectZonePanel,SelectPositionPanel,BattleCommandPanel}.tsx` and `DuelBoard`/board
   components. Identify the exact selectors to: pick a hand card & choose "Normal Summon", choose a monster zone,
   advance to Battle Phase, declare an attack. If a needed element lacks a stable `data-testid`, add ONE minimal
   testid to that panel (this is the only allowed web edit — keep it surgical; coordinate that it doesn't clash).
2. **Extend `e2e/playwright/duel.spec.ts`** with a real-turn play-through test. Reuse the existing login/create/join
   flow. After both seats are in and Alice (seat 0) is on the clock:
   - Assert Alice sees an actionable `IdleCommand` (not the generic "Waiting…"/placeholder).
   - Normal-summon a monster: interact through the real panels (IdleCommand → summon → SelectZone placement → any
     SelectPosition). Assert a face-up monster now appears in Alice's monster zone (`DuelBoard` state), and the
     opponent (Bob) board reflects it too (both re-render from STATE).
   - Advance to Battle Phase via the IdleCommand phase-advance control; assert the phase ribbon updates.
   - Declare a direct attack (opponent has no monsters); assert Bob's LP dropped from 8000 (STATE/LP display).
   - Keep it robust: the engine auto-passes empty chain windows, so the opponent should not need to act; if a
     `ChainPrompt`/decision surfaces to Bob, pass/handle it so the flow completes.
3. **Run at TWO viewports.** Either two test variants or Playwright `projects` in `playwright.config.ts`:
   desktop (~1280×800) and mobile-portrait (Pixel-class, ~393×851, `isMobile`/touch). The board reflows by width;
   the same play-through must pass at both. Prefer stable testids over layout-specific selectors.
4. Keep the existing backbone + INVITE-01 tests passing. The `e2e.yml` workflow already runs `duel.spec.ts`; if you
   add viewport projects, ensure the workflow still runs them (it runs `npm run test:e2e` / the spec) — do NOT edit
   `.github/workflows/*` yourself (gated; report to CTO if the workflow needs a change).

## Acceptance criteria (verified by a separate QA agent / CI on a clean checkout)
- `npm run verify` stays GREEN repo-wide (any added testids don't break unit tests; arch unaffected).
- `npx playwright test e2e/playwright/duel.spec.ts` passes, INCLUDING the new real-turn play-through at BOTH a
  desktop and a mobile-portrait viewport, plus the existing backbone + INVITE-01 tests.
- The play-through actually asserts observable game progress: a monster in the monster zone AND an LP change (not
  just "a decision was delivered").
- CI `read_ci_status` shows the E2E workflow green on the pushed commit.

## Git / delivery (per AGENTS.md)
- Confirm `git config user.email` == `zuhayralvi@gmail.com` before committing; keep the `Co-Authored-By: Claude
  <noreply@anthropic.com>` trailer. Own `e2e/**` (+ at most minimal panel testids); `git pull --rebase --autostash
  origin master`; never `git add -A`; do NOT touch `.github/workflows/*`. Report your pushed SHA + the full E2E
  output (both viewports) + confirm `npm run verify` green.
