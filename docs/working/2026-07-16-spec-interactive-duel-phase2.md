# Spec — Interactive Duel, Phase 2: responsive web decision UI (desktop + mobile)

**Author:** CTO • **Date:** 2026-07-16 • **Status:** ACTIVE (2A delegated; 2B/2C/2D gated on 2A)
**Depends on:** Phase 0 contract (`packages/contracts/src/duelDecision.ts`), Phase 1 (engine adapter + relay LIVE:
server sends `DECISION` frames / accepts `DECISION_RESPONSE`).
**Design of record:** `docs/working/2026-07-16-mobile-duel-engineering-spec.md` (breakpoints, 23-component inventory,
tap→sheet→pulse state machine, a11y per component) + `docs/working/2026-07-13-v1-ux-flows.md` §6/§7/§8/§9/§15/§16.

## Goal
A human can play a full Edison turn through the UI — every `DuelDecision` kind renders and can be answered — as ONE
responsive component system across phone-portrait → tablet → desktop, with §16 accessibility in-scope. Replace the
legacy mock-shaped path (`ActionPanel` old rendering, `packages/web/src/api/decisionOptions.ts`, the
`EngineResponse`/`RESPONSE` client frame usage, and the mock's old `MSG`-decision emissions) with the typed
`DuelDecision` → `DuelDecisionResponse` path.

## Architecture (LOCKED)
- Web speaks ONLY the contract: consumes the `DECISION` server frame (`{type:"DECISION", decision: DuelDecision}`)
  and sends the `DECISION_RESPONSE` client frame (`{type:"DECISION_RESPONSE", response: DuelDecisionResponse}`). It
  never touches ocgcore shapes, never computes legality (server-authoritative — the decision payload IS the set of
  legal actions).
- **Decision dispatcher pattern:** a `DecisionDispatcher` keyed on `decision.kind` renders exactly one
  `*Panel` component per kind (one-operation-per-file). Panels are pure: they receive the typed decision + a
  responder and emit a `DuelDecisionResponse`. This is the seam that lets panel work parallelize.
- **Panel component contract (2A defines this, FROZEN for 2B/2C/2D):**
  ```ts
  // packages/web/src/components/duel/decisions/DecisionPanelProps.ts
  export interface DecisionPanelProps<K extends DuelDecision["kind"]> {
    decision: Extract<DuelDecision, { kind: K }>;
    respond: (response: Extract<DuelDecisionResponse, { kind: K }>) => void;
    layoutTier: "phone" | "tablet" | "desktop";
    disabled?: boolean;
  }
  ```
  Each panel file default-exports a component of `DecisionPanelProps<itsKind>`. The dispatcher maps kind→panel.

## Slice 2A — Foundation (ONE Frontend Engineer, FIRST; 2B/2C/2D gate on this)
Owns the shared shell + board + dispatcher + plumbing + a generic fallback panel. Files (create under
`packages/web/src/components/duel/`):
- **Responsive shell + board:** upgrade `DuelBoard.tsx` (or a new `duel/board/` set) to the §6 desktop board AND
  §15 mobile portrait board as ONE reflowed system (breakpoints per the mobile spec §1: phone ≤599 / tablet
  600–1023 / desktop ≥1024). Tablet uses the desktop dual-field layout (CTO ruling); the collapsible
  `OpponentStatusStrip` is phone-only. Include the phase rail, whose-turn ribbon, animated LP, hand fan, zones,
  card inspector (tap-art-to-inspect vs act — mobile spec §3). Keep existing `data-testid`s where the E2E relies on
  them (`duel-board`, `phase-ribbon`, `face-down-card`, `face-up-card`); add new ones as needed.
- **DuelScreen wiring:** consume `DECISION` → hold the typed `DuelDecision`; render `DecisionDispatcher`; provide
  `respond(r: DuelDecisionResponse)` that sends `{type:"DECISION_RESPONSE", response:r}`. Remove the old
  `pendingDecision: RedactedEngineMessage` path and the `MSG`→decision logic. Keep RESIGN.
- **DecisionDispatcher + containers:** `DecisionDispatcher.tsx` (switch on `kind`), `DecisionBottomSheet` (mobile) /
  `ActionContextMenu` (desktop) containers, shared `TargetingOverlay` + `CardInspector` per the mobile spec §2.
- **GenericDecisionPanel.tsx:** a functional fallback that can render+answer ANY `DuelDecision` kind (list the
  candidates/options, min/max, confirm/cancel, pass when allowed). The dispatcher routes every kind here initially;
  it stays the PERMANENT home for the rare kinds (SelectSum/SelectCounter/SelectDisfield/SortCard/SortChain) so
  nothing dead-ends. 2B/2C/2D override specific kinds with polished panels.
- **Realign the mock:** rewrite `packages/web/src/mock/duelSession.ts` to emit `DECISION` frames carrying typed
  `DuelDecision` objects (import the contract) instead of old `MSG`-shaped decisions; update `respond()` to accept a
  `DuelDecisionResponse`. Keep it exercising a representative sequence (idle → chain → battle → selects → announce).
- **Delete the legacy web path:** remove `packages/web/src/api/decisionOptions.ts` (+ its test) and the old
  `ActionPanel` decision rendering / `EngineResponse` usage. (Leave the now-unused `EngineResponse`/`RESPONSE`
  frame + dormant server handler in contracts/server for a later cleanup — do NOT edit contracts/server here.)
- **a11y baseline (§16):** ≥44px targets, ≥16px body text, keyboard on desktop, reduced-motion, no color-only
  meaning, WCAG-AA tokens — bake into the shell + generic panel so panels inherit it.
- **Gate for 2A:** `npm run verify` green (web typecheck/lint/tests; arch:check web→contracts-only holds); the E2E
  backbone (`e2e/playwright/duel.spec.ts`) still passes; a real `IdleCommand` can be answered via the generic panel
  end-to-end (add/adjust a web component test). Report the FROZEN `DecisionPanelProps` + the dispatcher's kind→file
  mapping convention so panel engineers can plug in.

## Slices 2B / 2C / 2D — per-kind panels (parallel Frontend Engineers, AFTER 2A lands)
Each owns a DISJOINT set of `packages/web/src/components/duel/decisions/<Kind>Panel.tsx` (+ tests). They implement
`DecisionPanelProps<Kind>`, render desktop + mobile per the mobile spec §4, and do NOT touch the shell/dispatcher/
DuelScreen (2A's files).

**Collision-free integration via per-group sub-dispatchers (NOT editing `DecisionDispatcher.tsx`):** each group
engineer also creates ONE group sub-dispatcher component that switches over ITS kinds with proper type-narrowing:
- 2B → `CommandDecisionPanels.tsx`, 2C → `SelectionDecisionPanels.tsx`, 2D → `PromptDecisionPanels.tsx`.
Each is a `(props: DecisionPanelProps<its kinds>) => JSX` that `switch`es on `decision.kind` → renders the matching
panel (narrowed, no casts). Group engineers do NOT touch `DecisionDispatcher.tsx` or any other group's files. At
**integration (CTO, once)** the top `DecisionDispatcher.tsx` is edited a single time to route each kind-group to its
sub-dispatcher and everything else to `GenericDecisionPanel` (the 5 rare kinds). Reuse of shared components
(`TargetingOverlay`, `DecisionBottomSheet`, `ActionContextMenu`, `CardInspector`) is READ-ONLY — if one needs a
change, report to the CTO, do not edit it. Follow `GenericDecisionPanel.tsx` as the reference for container
wrapping, `layoutTier` handling, and a11y. Groups:
- **2B — command + chain:** `IdleCommandPanel`, `BattleCommandPanel`, `ChainPromptPanel` (tap-card→action-sheet;
  §7 priority/chain: right-docked chain stack desktop / bottom sheet mobile; respond-with-legal-only).
- **2C — selection/targeting:** `SelectCardPanel`, `SelectUnselectCardPanel`, `SelectTributePanel`,
  `SelectZonePanel`, `SelectPositionPanel` (§8 pulse-valid + running count + confirm/cancel via `TargetingOverlay`).
- **2D — prompts/announce:** `SelectEffectYNPanel`, `SelectYesNoPanel`, `SelectOptionPanel`, `AnnounceRacePanel`,
  `AnnounceAttribPanel`, `AnnounceCardPanel` (card-name search for `filter.kind==="any"`), `AnnounceNumberPanel`.
- Rare kinds (SelectSum/SelectCounter/SelectDisfield/SortCard/SortChain) stay on the GenericDecisionPanel — no
  bespoke panels required (revisit only if a real Edison line surfaces one).

## Acceptance criteria (Phase 2 gate — verified by a separate QA agent on a clean checkout)
- `npm run verify` GREEN repo-wide (arch:check: web still imports contracts only).
- Every non-rare `DuelDecision` kind renders + is answerable at phone AND desktop widths (component tests driving
  each kind from fixture `DuelDecision` objects at both viewports).
- The E2E backbone still passes; a real `IdleCommand`/summon is answerable end-to-end (fuller real-turn E2E is Phase 3).
- No legacy path remains in web (no `decisionOptions.ts`, no `EngineResponse` usage in web).
- a11y checks: keyboard reachable, ≥44px targets, reduced-motion honored (assert in tests where feasible).

## Git / delivery (per AGENTS.md)
- Confirm `git config user.email` == `zuhayralvi@gmail.com` before committing. Keep the `Co-Authored-By: Claude
  <noreply@anthropic.com>` trailer. Own ONLY your files; `git pull --rebase --autostash origin master`; never
  `git add -A`; do NOT touch `.github/workflows/*`. Report pushed SHA.
