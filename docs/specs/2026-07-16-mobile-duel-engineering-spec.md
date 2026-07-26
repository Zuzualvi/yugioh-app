# Mobile Duel Engineering Spec — Phase 0.5

**Author:** Technical Writer · **Date:** 2026-07-16 · **Status:** ENGINEERING READY (Phase 0.5 deliverable)
**Design source:** `docs/working/2026-07-13-v1-ux-flows.md` §6, §7, §8, §9, §15, §16, §17 (locked V1 UX).
**Build brief:** `docs/working/2026-07-15-interactive-duel-ui-plan.md` Phase 0.5.
**Audience:** Frontend Engineers implementing Phase 2 of the interactive duel UI.

> **Scope of this document.** This spec engineers the §15 mobile board design into implementation
> requirements. It does NOT invent new UX flows. All eight implementation questions raised on
> initial delivery were resolved by the CTO on 2026-07-16 — their rulings are recorded in §7 and
> folded into the relevant body sections. Decision-kind field names reference the taxonomy from
> the build brief; exact field schemas lock in Phase 0.

---

## Table of contents

1. [Responsive breakpoints and board reflow](#1-responsive-breakpoints-and-board-reflow)
2. [Component inventory](#2-component-inventory)
3. [Interaction state machine](#3-interaction-state-machine)
4. [DuelDecision → UI mapping](#4-dueldecision--ui-mapping)
5. [Accessibility requirements](#5-accessibility-requirements)
6. [Async resume behavior](#6-async-resume-behavior)
7. [Resolved decisions (CTO, 2026-07-16)](#7-resolved-decisions-cto-2026-07-16)

---

## 1. Responsive breakpoints and board reflow

Per §15(f): phone-portrait → tablet → desktop is **one component system reflowed**, not separate
apps. The interaction grammar (tap → action-sheet → pulsing destination; tap-art-to-inspect) is
identical at every width. A friend on a couch phone and a friend at a desk are equally competent.

### 1.1 Breakpoint tiers

| Tier | Viewport width | Canonical device | Board layout |
|---|---|---|---|
| **Phone-portrait** | ≤ 599 px | ~375–430 px phone | Your-field-first vertical stack (§15a); opponent field collapsed behind strip |
| **Tablet / small-laptop** | 600 px – 1023 px | ~768–1024 px tablet, landscape phone | Desktop dual-field layout, scaled down; opponent field always visible, no collapse (CTO, OQ-1) |
| **Desktop** | ≥ 1024 px | Laptop / monitor | Full board (§6) |

The **collapse/expand opponent strip is phone-portrait only** (≤ 599 px). At tablet and desktop
widths both fields fit, so `OpponentStatusStrip` (with its expand toggle) is not rendered; instead
the full `OpponentField` and `OpponentStatusBar` are always shown. A landscape-oriented phone
(landscape width ≈ 600–800 px) therefore gets the tablet-tier dual-field reflow — this is
acceptable since Phase 2 does not target a bespoke landscape layout (see §7, OQ-7).

Use CSS custom properties for breakpoint values so a single source-of-truth feeds both media queries
and any JS that needs to check layout tier at runtime:

```css
:root {
  --bp-tablet: 600px;
  --bp-desktop: 1024px;
}
```

### 1.2 Phone-portrait layout (≤ 599 px)

The §15a "your-field-first vertical stack" in implementation order, top → bottom:

```
┌─────────────────────────────────────┐  ← viewport top
│  OpponentStatusStrip                │  ~10% height — LP, hand count, expand toggle
│    [m][m][m][m][m] mini thumbnails  │
│    [s][s][s][s][s] mini thumbnails  │
├─────────────────────────────────────┤
│  TurnPhaseRibbon                    │  ~8% height — phase label + per-move countdown
├─────────────────────────────────────┤
│  YourField (Spell/Trap row)         │  ~15% height — 5 S/T zones + Field + GY/Banish
│  YourField (Monster row)            │  ~15% height — 5 Monster zones
│  YourField (accessories row)        │  ~5% height  — Deck, Extra Deck labels/counts
├─────────────────────────────────────┤
│  HandFan (horizontally scrollable)  │  ~15% height — your hand cards
├─────────────────────────────────────┤
│  PhaseRail + EndTurn button         │  ~8% height  — DP SP [MP1] BP MP2 EP + [End Turn]
└─────────────────────────────────────┘  ← viewport bottom (safe area padding for home bar)
```

- **All interactive targets ≥ 44 px** in both dimensions (see §5).
- Bottom of the layout respects the device safe-area inset (`env(safe-area-inset-bottom)`) so the
  phase rail and End Turn button are never hidden behind a home-bar gesture bar.
- When a `DuelDecision` prompt is active, the **DecisionBottomSheet** slides up from the bottom
  edge; the rest of the board remains visible above it.

### 1.3 Tablet layout (600–1023 px)

The tablet tier uses the **same dual-field layout as desktop**, scaled down to fit the smaller
viewport. Key differences from phone-portrait:

- Both `OpponentField` and `YourField` are always visible — no collapse strip.
- `OpponentStatusBar` (LP, hand count) is a compact bar above `OpponentField`, as on desktop.
- `DuelLogRail` may be hidden behind a slide-in toggle at tablet widths (same as mobile log access,
  see §2.7) to recover horizontal space — preferred over forcing a horizontal scroll.
- `DecisionBottomSheet` and `TargetingOverlay` behave identically to mobile.
- Tap targets remain ≥ 44 px (tablet users may be touch-only).

A landscape-oriented phone landing in this tier gets a functional board without special handling.

### 1.4 Desktop layout (≥ 1024 px)

Mirrors §6 exactly:

```
┌────────────────────────────────────────────────────────────────┐
│  OpponentStatusBar (LP bar + number, face-down hand count)     │
├──────────────────────────────────────────────┬─────────────────┤
│  OpponentField (zones mirrored, top half)    │  DuelLogRail    │
│  TurnPhaseRibbon (center — "Alex's Battle    │  (collapsible)  │
│    Phase · ⏱ Alex 21h 40m")                  │                 │
│  YourField (zones, bottom half)              │                 │
├──────────────────────────────────────────────┤                 │
│  HandTray (fanned, actionable markers)       │                 │
├──────────────────────────────────────────────┴─────────────────┤
│  PhaseRail  DP · SP · [MP1] · BP · MP2 · EP    [ End Turn ▸ ]  │
└────────────────────────────────────────────────────────────────┘
```

- On desktop, card click → context menu of legal actions (same grammar, different widget skin).
- Drag is offered as an optional accelerator but never required (the tap grammar always works).
- Right-docked `ChainPanel` for chain-stack visualization; appears when a chain is building.

### 1.5 Component reflow contract

Each component must implement both presentations internally and switch via CSS breakpoints or a
`layoutTier` prop — the caller never renders two separate component trees. Pattern:

```tsx
// Example — component decides its own layout internally
function YourField({ zones, ...props }: YourFieldProps) {
  return (
    <div className={styles.yourField}>
      {/* shared zone rendering — CSS grid reflowed by media query */}
    </div>
  );
}
```

The `layoutTier` prop (derived once from `window.innerWidth` with a `ResizeObserver`) is optional
context for components that need to switch non-CSS behavior (e.g., action sheet vs. context menu).

---

## 2. Component inventory

One component per responsibility (AGENTS.md: one operation per file). Each entry names the file,
its single responsibility, and its mobile vs. desktop presentation. Components are listed in
dependency order (leaf → root).

### 2.1 Card rendering

#### `CardZone` — `src/components/duel/CardZone.tsx`

**Responsibility:** Render a single zone slot (monster, spell/trap, field spell, graveyard, banish,
deck, extra deck). Shows the card currently in the zone or an empty-zone placeholder.

| Presentation | Mobile (≤ 599 px) | Desktop (≥ 1024 px) |
|---|---|---|
| Empty zone | Faint outline, zone label, ≥ 44 px tap target | Same, larger area |
| Card in zone | Card art thumbnail + ATK/DEF overlay + state marker | Same, more breathing room |
| Actionable state | Glow ring + corner dot `•` | Same |
| Selected state | Solid accent border + checkmark icon | Same |
| Valid target (pulse) | CSS pulse animation or reduced-motion equivalent | Same |
| Face-down | Card-back art — **never the face** | Same |
| Dimmed | ~55% opacity, no highlight | Same |

**Accessibility:** Each zone has an `aria-label` describing its contents and current state
(e.g., "Your Monster Zone 1 — Stardust Dragon, ATK 2500, actionable"). Keyboard-focusable on
desktop (`tabindex="0"`; Enter/Space triggers the same action as click).

#### `CardThumbnail` — `src/components/duel/CardThumbnail.tsx`

**Responsibility:** Render a card's art image at a given size. Handles the `code: 0` → face-down
back substitution (hidden-information rule). Never renders an opponent's face-down card face.

- **Sizes:** `mini` (opponent status strip thumbnails), `zone` (field zones), `hand` (hand fan
  cards), `inspector` (full-size in the Inspector overlay).
- Loading / missing image: show the card-back as the placeholder (never a broken image).

#### `CardStateMarker` — `src/components/duel/CardStateMarker.tsx`

**Responsibility:** Render the non-color state cues (corner dot `•` for actionable; checkmark for
selected; aria attributes). Composited over `CardThumbnail` by parent components. Exists as a
separate file so the "no meaning by color alone" contract is maintained in one place.

### 2.2 Your field

#### `YourField` — `src/components/duel/YourField.tsx`

**Responsibility:** Render the five monster zones, five spell/trap zones, field spell zone, extra
deck, deck, graveyard, and banish pile for the local player. Owns the zone-tap → action-sheet
dispatch (fires `onZoneTap(zone)` → parent opens `DecisionBottomSheet` or `ActionContextMenu`).

- **Mobile:** CSS grid, two rows (S/T above, Monster below), full-width, each zone ≥ 44 px.
- **Desktop:** same grid scaled up; zones have more padding.

#### `OpponentField` — `src/components/duel/OpponentField.tsx`

**Responsibility:** Render the opponent's field zones (mirrored). Opponent cards are always rendered
as face-down if their code is `0`; tapping opponent zones during selection steps (targeting) emits
`onZoneTap` for the parent to handle. All opponent face-down zones show "Set card" and are
**not** inspectable (no Inspector launch from opponent hidden cards).

### 2.3 Hand

#### `HandFan` — `src/components/duel/HandFan.tsx`

**Responsibility:** Render the local player's hand as a horizontally scrollable fan. Each card:
- Tap (anywhere on the card) → launch `CardInspector`. The Inspector then surfaces that card's
  **legal actions as buttons** within the overlay (e.g., "Normal Summon," "Set," "Activate").
  Tapping an action button inside the Inspector dispatches `onCardAct(cardIndex, action)` to the
  parent, which opens the full decision flow. This is the **inspect-first** model for the hand fan.
- Actionable cards have `CardStateMarker` glow/dot; idle cards have none.
- If no `DuelDecision` is currently pending for this seat (opponent's turn, or between decisions),
  tapping any hand card opens the Inspector with read-only info and no action buttons.

**Engineering note (CTO ruling, OQ-2):** The §15c split-hit-region (art = inspect, action strip =
act) applies to **field cards** (larger, non-overlapping zone area). Splitting a small fanned hand
card into two ~44 px hit regions is not practical. The inspect-first model achieves the same safety
guarantee — a tap cannot accidentally trigger a play — while fitting the hand fan's constrained
geometry.

**Mobile:** horizontal scroll, cards ~64–80 px wide, swipeable.  
**Desktop:** fan spread in the hand tray; click → `CardInspector` with action buttons (same
inspect-first model), or right-click for context menu as optional shortcut.

#### `OpponentHandCount` — `src/components/duel/OpponentHandCount.tsx`

**Responsibility:** Display the opponent's hand as a count + face-down card-back icons only.
Never renders the opponent's actual card faces. Used in both `OpponentStatusStrip` and the
desktop `OpponentStatusBar`.

### 2.4 Opponent strip / status

#### `OpponentStatusStrip` — `src/components/duel/OpponentStatusStrip.tsx`

**Responsibility:** The compressed opponent view on mobile (phone-portrait tier only; not rendered
at tablet or desktop widths). Tapping the expand toggle (`▾/▴`) shows or hides the full
`OpponentField` overlay. Contains: LP display, hand count, mini zone thumbnails, expand toggle.

- **Phone-portrait only** (≤ 599 px). Collapsed by default on fresh mount and on resume.
- Expanded state slides the full opponent field into view (or overlays it) without leaving the
  screen or abandoning the local board context.
- **Expanded state persists in component state across moves and engine decisions within a page
  session** (CTO ruling, OQ-6). Do not reset to collapsed on each decision — that would be jarring
  if a player expanded it to read the opponent's board mid-chain. It resets to collapsed only on
  a fresh mount (new page load, or resume navigation from Home). Low-stakes, phone-only state;
  does not need to survive across sessions.

#### `OpponentStatusBar` — `src/components/duel/OpponentStatusBar.tsx`

**Responsibility:** The full-width opponent header on desktop (§6). Contains: opponent name/avatar,
LP bar + number, hand count (face-down icons), surrender shortcut.

### 2.5 LP display

#### `LPDisplay` — `src/components/duel/LPDisplay.tsx`

**Responsibility:** Render a player's LP as both a progress bar and a numeric label. Animate LP
delta ("−1800" floats, bar drains) on damage. In reduced-motion mode, snap to new value without
animation but still update both bar and number.

- **Shared by** `OpponentStatusBar`, `OpponentStatusStrip`, and the local player's LP area.
- `aria-live="polite"` so screen readers announce LP changes without interrupting.

### 2.6 Phase and turn

#### `TurnPhaseRibbon` — `src/components/duel/TurnPhaseRibbon.tsx`

**Responsibility:** Display whose turn it is, the current phase in words, and the per-move
countdown. This is the ribbon that answers "what is happening and who is on the clock."

| Element | Detail |
|---|---|
| Turn label | "YOUR MAIN PHASE 1" / "ALEX'S BATTLE PHASE" (text, never only color) |
| Countdown | `MoveCountdown` component (see below); visible here |
| Layout | Mobile: one full-width strip above your field. Desktop: center-board ribbon. |

#### `MoveCountdown` — `src/components/duel/MoveCountdown.tsx`

**Responsibility:** Render the per-move deadline countdown for whoever is currently awaited by the
engine. Implements adaptive granularity:

- Comfortable time remaining (> ~10% of move budget): shows days/hours ("21h 40m"), calm neutral
  color, no icon.
- Final stretch (≤ ~10%, floored so a 5-min blitz warns in the last minute): escalates to warning
  color + ⚠ icon, switches to mm:ss.
- Opponent's clock: rendered at reduced visual weight (it's information, not a call to act).
- Your clock in the final stretch: full emphasis.
- Reduced-motion: counter still updates numerically; no CSS animation on the color transition.
- `aria-live="off"` by default (screen reader doesn't read every tick); switches to
  `aria-live="polite"` on entering the final stretch to announce the urgency once.

#### `PhaseRail` — `src/components/duel/PhaseRail.tsx`

**Responsibility:** Display the phase sequence (DP · SP · MP1 · BP · MP2 · EP) with the current
phase highlighted and reachable phases enabled. Advancing to the next phase and the End Turn
button live here.

| Presentation | Mobile | Desktop |
|---|---|---|
| Layout | Compact horizontal strip, phases abbreviated | Full labels, more spacing |
| End Turn | Button at right end of rail, ≥ 44 px | Same |
| Disabled phases | Dimmed (current format rules; no tappable-for-reason in V1) | Same |
| Keyboard | N/A (mobile) | Phase rail items and End Turn button are focusable/activatable |

### 2.7 Log

#### `DuelLogRail` — `src/components/duel/DuelLogRail.tsx`

**Responsibility:** Scrollable log of neutral duel events (turn #, actor, action — never a "why"
judgment). Collapsible on desktop (right-docked). On mobile and tablet, accessible via a
**peekable slide-in panel** toggled by a small "log" button in the top bar or phase rail area
(CTO ruling, OQ-3). The panel overlays the board without blocking it and can be dismissed by
tapping outside or re-tapping the log button.

- Entries use neutral language only: "Alex activated Bottomless Trap Hole," not evaluative prose.
- Each entry is tappable to launch `CardInspector` for the card involved (on all form factors).
- The log is available **during the duel**, not post-duel only. It is also shown in the post-duel
  `DuelSummary` screen.
- The log toggle button (mobile/tablet) must be ≥ 44 px and must not conflict with the
  `ChainPanel` peek strip when both are active simultaneously.

### 2.8 Chain and priority

#### `ChainPanel` — `src/components/duel/ChainPanel.tsx`

**Responsibility:** Display the chain stack — CL1 (resolves last) at bottom → highest link at top.
Each link shows a mini card thumbnail + owner color/hatch cue + owner label. The panel also hosts
the "Add to chain / Let it resolve" controls during chain building.

| Presentation | Mobile | Desktop |
|---|---|---|
| Layout | Peekable panel — peeked at ~80px strip above DecisionBottomSheet, expandable | Right-docked panel alongside the board |
| Peek trigger | Tap the peek strip or drag up | Always visible when chain is active |

- **Ownership indicator** uses both color and a hatch/dash pattern (never color alone — §16).

#### `PriorityPrompt` — `src/components/duel/PriorityPrompt.tsx`

**Responsibility:** The unmissable-but-non-blocking bar that appears when the engine issues a
`ChainPrompt` decision. States the triggering event neutrally. Offers [Respond ▸] and [Pass].
The board remains visible behind it.

- **Mobile:** This prompt is the header of the `DecisionBottomSheet` (it is always the top of the
  sheet, board visible above).
- **Desktop:** A non-modal banner below the center ribbon; board still interactive behind it.
- Contains a `MoveCountdown` instance (the response window is on the per-move clock).
- Neutral language only: "Alex activated Bottomless Trap Hole. You may respond."

### 2.9 Decision prompt surface

#### `DecisionBottomSheet` — `src/components/duel/DecisionBottomSheet.tsx`

**Responsibility:** The primary decision prompt surface on mobile. A sheet that slides up from the
bottom of the screen when the engine issues a `DuelDecision` that needs user input. The board
remains visible above; the sheet's drag handle allows the player to resize it. [Confirm] and
[Cancel] (where applicable) are thumb-reachable at the bottom of the sheet.

- The `DecisionDispatcher` (see §3) renders the correct inner component into this shell.
- Renders a **Cancel** button unless `DuelDecision.cancelable === false` (CTO ruling, OQ-5). When
  `cancelable` is false the Cancel affordance is suppressed entirely — the player must complete the
  decision. The Phase 0 schema confirms that every `DuelDecision` variant carries `cancelable`.
  Similarly, `canPass` (where a pass is legal in addition to acting) controls the [Pass] button in
  `ChainPrompt` variants.
- Contains the `MoveCountdown` for the current awaited player.

#### `ActionContextMenu` — `src/components/duel/ActionContextMenu.tsx`

**Responsibility:** The desktop equivalent of `DecisionBottomSheet` for local-action decisions
(card tap → legal actions appear near the card). Used for `IdleCommand` and `BattleCommand`
actions that originate from clicking a specific card or zone on desktop.

- Lists legal actions only (V1: no greyed "why not" lines).
- Dismiss with Escape key or click-outside.

#### `ActionSheet` — `src/components/duel/ActionSheet.tsx`

**Responsibility:** The mobile action sheet shown after tapping a field card's action region. Lists
that card's currently-legal actions as tappable rows (e.g., "▸ Normal Summon," "▸ Set,"
"✕ Cancel"). No "why not" rows in V1. Launched by `CardZone` on mobile (and by `CardInspector`
action buttons for hand-fan cards — see §2.3).

**Population rule (CTO ruling, OQ-4):** The `ActionSheet` is populated **purely from the current
`IdleCommand` or `BattleCommand` `DuelDecision` payload**. The engine already enumerates every
legal action grouped by actionable card; the UI filters that list to the tapped card's index. The
UI **never issues a separate per-card legality query** and **never computes legality itself**
(server-authoritative; the engine owns legality). Consequence:

- If an `IdleCommand` or `BattleCommand` decision is pending and the tapped field card appears in
  its candidate list → show the `ActionSheet` with that card's actions.
- If no decision is pending (not the player's turn, or between decisions) → tapping a field card
  opens the Inspector only (no ActionSheet, no action buttons).
- The Phase 0 `IdleCommand` / `BattleCommand` contract must group options per acting card so the
  UI can perform this filter; the CTO has added this grouping requirement to the Phase 0 spec.

### 2.10 Targeting overlay

#### `TargetingOverlay` — `src/components/duel/TargetingOverlay.tsx`

**Responsibility:** The in-field selection mode for `SelectCard`, `SelectZone`, `SelectTribute`,
`SelectSum`, and related decisions (§8). Valid destinations pulse; invalid ones stay flat (dimmed,
§0). A persistent mini-prompt banner states the ask and running count.

**Mini-prompt banner:**

```
Select 1 monster to target · 0 / 1          [Confirm ✓]   [✕ Cancel]
```

| Element | Detail |
|---|---|
| Selection count | "X / N" running count; updates live |
| Confirm | Enabled only when the minimum selection is met |
| Cancel | Always available; unwinds to before the action started |
| Valid targets | CSS pulse animation (or opacity blink in reduced-motion) |
| Invalid zones/cards | Dimmed, not pulsing, not tappable-for-action (still tappable-for-inspect) |

- **Mobile:** the mini-prompt is a thin sticky bar between the opponent strip and your field (stays
  visible as you scroll the hand fan).
- **Desktop:** the mini-prompt overlays the board near the top.
- `aria-live="polite"` on the count label so screen readers announce selection progress.

### 2.11 Card Inspector

#### `CardInspector` — `src/components/duel/CardInspector.tsx`

**Responsibility:** Full-detail card view (§9). Art, name, type line, Attribute, Level, ATK/DEF,
complete effect text at readable size, set/passcode, static Edison rulings where available. Pure
overlay — opening it changes no game state.

- Launched by: tap card art on the field/hand fan, long-press on mobile, or any card in the log.
- **Never** launched by tapping a face-down opponent card (shows "Set card" message instead; hidden
  info is never revealed).
- **Mobile:** full-screen sheet. Dismiss via ✕, tap-outside, or back-gesture.
- **Desktop:** right-docked panel or centered modal.
- Nav: ‹ › arrows to page between cards when launched from a list (hand fan, log, builder).
- Rulings block shown only when verified content exists; hidden otherwise (never invent).

### 2.12 Orchestration

#### `DuelBoard` — `src/components/duel/DuelBoard.tsx`

**Responsibility:** The top-level board component. Assembles `OpponentStatusStrip` /
`OpponentStatusBar`, `OpponentField`, `TurnPhaseRibbon`, `YourField`, `HandFan`, and `PhaseRail`.
Holds the layout-tier context and the current `DuelDecision` state. Delegates prompt rendering
to `DecisionDispatcher`.

Does **not** own network I/O — receives the current `DuelDecision` and `DuelBroadcastEvent` props
from its parent (`DuelScreen`), and fires callbacks (`onDecisionResponse`) up to it.

#### `DecisionDispatcher` — `src/components/duel/DecisionDispatcher.tsx`

**Responsibility:** Switch on the `DuelDecision` discriminant and render the correct inner
component into `DecisionBottomSheet` (mobile) or `ActionContextMenu` (desktop). One component
per decision kind mounted inside this dispatcher. This is the seam that isolates each decision
kind's rendering into its own file.

```
DuelDecision.kind →
  IdleCommand        → IdleCommandPanel
  BattleCommand      → BattleCommandPanel
  ChainPrompt        → ChainPromptPanel
  SelectCard         → SelectCardPanel
  SelectUnselectCard → SelectUnselectCardPanel
  SelectSum          → SelectSumPanel
  SelectTribute      → SelectTributePanel
  SelectZone         → SelectZonePanel
  SelectPosition     → SelectPositionPanel
  YesNo              → YesNoPanel
  SelectOption       → SelectOptionPanel
  SelectCounter      → SelectCounterPanel
  Announce*          → AnnouncePanel
  SortCard           → SortCardPanel
  RockPaperScissors  → (engine-internal; no player-facing panel in Phase 2 — see §4.6)
```

Each `*Panel` component lives in its own file under `src/components/duel/decisions/`. It receives
the typed decision payload and fires `onResponse(DuelDecisionResponse)`.

---

## 3. Interaction state machine

The tap → action-sheet → pulsing-destination grammar is the universal interaction model on mobile
(§15b). On desktop the same transitions use a context menu and a click, but the state machine
is identical.

### 3.1 States

```
IDLE
  (it's opponent's turn, or no legal action exists for this player)
  Board is read-only except: tap card art → inspect; phase rail disabled.

AWAITING_PLAYER_DECISION
  (engine has issued a DuelDecision for this seat)
  Decision payload is live. Dispatcher shows the appropriate panel.
  ActionSheet / ContextMenu accessible from individual cards/zones where applicable.
  Per-move clock is running.

SELECTING_TARGET
  (player has started an action that requires picking target(s)/zone(s))
  TargetingOverlay active: valid zones/cards pulse, invalid ones dimmed.
  MiniPromptBar shows "Select N · X/N · [Confirm] [Cancel]".
  Confirm enabled only when minimum selection is met.
  Cancel always available — unwinds completely.

INSPECTING
  (CardInspector is open)
  Overlay on top of any board state.
  Board state underneath is unchanged.
  Close: ✕ / tap-outside / back-gesture.

CHAIN_BUILDING
  (a chain is being extended; engine is asking each player in turn)
  ChainPanel is open / peeked.
  PriorityPrompt or ChainPromptPanel active.
  Per-move clock runs for the awaited player.

RESOLVING
  (chain is resolving, or an action is animating through its result)
  Board is read-only; LP/zone updates animate.
  Reduced-motion: snap updates instead of animate.
  Returns to IDLE or AWAITING_PLAYER_DECISION after resolution.

DUEL_OVER
  (engine has emitted a duel-end signal)
  Board frozen; transition to DuelSummary screen.
```

### 3.2 Transition diagram (simplified)

```
           ┌──────────────────────────────────────────────────┐
           │                      IDLE                         │
           │  (opponent's turn, or waiting for engine decision) │
           └────┬─────────────────────┬────────────────────────┘
                │ engine issues        │ tap card art
                │ DuelDecision         │ (any state)
                ▼                      ▼
  ┌─────────────────────────┐    ┌──────────┐
  │ AWAITING_PLAYER_DECISION │    │ INSPECTING│
  │  DecisionDispatcher      │◄───┤  overlay │
  │  shows relevant panel    │    │  (close) │
  └──────────┬──────────────┘    └──────────┘
             │ player picks
             │ action requiring
             │ target selection
             ▼
  ┌─────────────────────┐
  │  SELECTING_TARGET    │
  │  TargetingOverlay   │
  │  pulsing + count    │
  └───────┬─────────────┘
          │ Confirm         │ Cancel
          ▼                 ▼
  ┌─────────────┐     back to AWAITING_PLAYER_DECISION
  │  RESOLVING  │     (action unwound)
  │  (animate)  │
  └──────┬──────┘
         │ done
         ▼
       IDLE  (or AWAITING_PLAYER_DECISION if engine issues another)
```

### 3.3 Inspect-vs-act gesture separation (§15c)

This separation is the core safety mechanism: a player can always read a card without risking
triggering it. The implementation differs between **field cards** and **hand-fan cards** (CTO
ruling, OQ-2):

**Field cards (CardZone) — split-hit-region model:**

| Gesture | Target | Outcome |
|---|---|---|
| Tap **art region** (top ~70% of zone card) | Any visible field card | Opens `CardInspector` — no game-state change |
| Long-press | Any visible field card | Opens `CardInspector` (alternate gesture) |
| Tap **action region** (bottom ~30%, ≥ 44 px tall, shows "▸" when actionable) | Your field card with legal actions, in AWAITING_PLAYER_DECISION | Opens `ActionSheet` → player picks action |
| Tap empty zone | A zone during SELECTING_TARGET | Selects that zone as a target |
| Tap opponent face-down | Any state | Shows "Set card" notice — no card face, no Inspector |

The field card renders two distinct, non-overlapping `<div>` / `<button>` elements. The action
region is ≥ 44 px tall. Minimum field-card zone height on phone-portrait: sufficient to fit both
regions (≥ 88 px combined, or sized so neither region falls below 44 px).

**Hand-fan cards (HandFan) — inspect-first model:**

Splitting a small fanned card into two ~44 px hit regions is impractical. Instead:

| Gesture | Target | Outcome |
|---|---|---|
| Tap (anywhere on card) | Any hand card | Opens `CardInspector` |
| Long-press | Any hand card | Opens `CardInspector` (alternate gesture) |
| Tap action button **inside the Inspector** | Legal action listed in the Inspector overlay | Dispatches the action; Inspector closes → decision flow continues |

The Inspector surfaces the tapped card's legal actions (from the current `IdleCommand` /
`BattleCommand` payload) as large, thumb-reachable buttons within the overlay. If no decision is
pending, the Inspector shows read-only info with no action buttons. This achieves the same
"read without risk of triggering" guarantee as the split-hit model.

---

## 4. DuelDecision → UI mapping

The table below maps each `DuelDecision` kind (Phase 0 taxonomy) to how it is presented and
answered on mobile vs. desktop, and any specific UI component(s) involved.

Field-level schema details (exact field names, min/max fields, candidate card shape, etc.) are
**not locked until Phase 0**. This table references the kinds only.

### 4.1 Turn-action decisions

| Decision kind | Trigger | Mobile presentation | Desktop presentation | Response |
|---|---|---|---|---|
| `IdleCommand` | Player's main or end phase; engine offers normal/tribute summon, set, activate, change position, etc. | Cards with legal actions show `CardStateMarker` glow. Tap action region → `ActionSheet` listing legal actions for that card. Sheet anchored to bottom. | Cards with legal actions show glow. Click → `ActionContextMenu` near card listing legal actions. | Player picks an action (or a specific card + action); response encodes the action type + card index. |
| `BattleCommand` | Player's battle phase; engine offers attacks and BP-end. | Same as `IdleCommand`; attacking monsters glow. Tap attack target → `SelectCard` flow for target selection. | Same; click monster → context menu with "Attack" → target selection. | Action type (attack / move to MP2) + attacking monster index + optional target index. |

### 4.2 Chain and response decisions

| Decision kind | Trigger | Mobile presentation | Desktop presentation | Response |
|---|---|---|---|---|
| `ChainPrompt` | Engine asks if a player wants to add to the chain (after an activation, or an ignition-priority window after summon). | `PriorityPrompt` as header of `DecisionBottomSheet`: neutral event caption + ⏱ countdown + [Respond ▸] / [Pass]. If [Respond ▸]: sheet expands to show legal responses (cards/effects, from the `ChainPrompt` payload). `ChainPanel` peeked above the sheet showing current chain stack. | `PriorityPrompt` as non-modal banner. [Respond ▸] opens a `ChainPromptPanel` in the right-docked area. `ChainPanel` always visible in right dock. | Bool (pass) or selected card/effect index. |

**Chain stack display:** regardless of form factor, the chain panel lists CL1 at bottom → highest
at top ("resolves top-down"). Each link shows mini art + owner color + owner label. The `[Let it
resolve ▸]` action advances resolution once both players pass.

**Resolution playback:** top-down, one link at a time, each with a neutral plain-text caption (e.g.,
"Link 3: Solemn Judgment — negates and destroys Bottomless Trap Hole."). LP and board deltas animate
during resolution (or snap in reduced-motion).

### 4.3 Selection decisions

| Decision kind | Trigger | Mobile presentation | Desktop presentation | Response |
|---|---|---|---|---|
| `SelectCard` | Engine requests the player pick N card(s) from a set (target, material, hand discard, etc.). | `TargetingOverlay` activates. Valid cards pulse; invalid cards dimmed. Mini-prompt bar shows "Select N · X/N · [Confirm] [Cancel]". On confirm, sheet closes, move proceeds. | Same overlay and mini-prompt on desktop; same pulse grammar. | Array of selected card indices (length ≥ min, ≤ max). |
| `SelectUnselectCard` | Engine allows toggling a selection (add or remove from a set). | Same as `SelectCard` but tapping a selected card deselects it. Running count updates. | Same. | Array of currently-selected indices. |
| `SelectSum` | Tribute-for-Synchro or similar sum-to-N selection. | `SelectSumPanel` inside `DecisionBottomSheet`: shows candidate cards with their values and the target sum; running total displayed; [Confirm] when sum reached exactly. | Same panel, right-docked or inline. | Indices of selected cards. |
| `SelectTribute` | Tribute summon material selection. | `SelectTributePanel` inside `DecisionBottomSheet`. Valid tribute targets pulse. Running count "Select N tributes · X/N". | Same. | Indices of tribute targets. |
| `SelectZone` | Engine requests a specific zone placement (e.g., "place this card in a monster zone"). | `TargetingOverlay` activates over the board. Valid zones pulse; invalid dimmed. Tap a zone to select. | Same. | Zone identifier. |
| `SelectPosition` | Engine requests a battle position (ATK / DEF / face-down DEF). | `SelectPositionPanel` inside `DecisionBottomSheet`: three large tap targets labeled ATK / DEF / Face-down DEF, each with icon + label (never position conveyed by orientation alone). | Same panel. | Position enum value. |

### 4.4 Confirmation decisions

| Decision kind | Trigger | Mobile presentation | Desktop presentation | Response |
|---|---|---|---|---|
| `YesNo` | Engine asks a yes/no question about a card effect (effectyn, yesno). | `YesNoPanel` inside `DecisionBottomSheet`: neutral question string (from the decision payload) + [Yes] / [No] as large tappable buttons, thumb-reachable. | Same panel, modal or inline. | Boolean. |

### 4.5 Option and value decisions

| Decision kind | Trigger | Mobile presentation | Desktop presentation | Response |
|---|---|---|---|---|
| `SelectOption` | Engine presents a list of options (e.g., which effect of a multi-effect card to activate). | `SelectOptionPanel` inside `DecisionBottomSheet`: option labels as a tappable list, one row each. No greyed options in V1. | Same panel. | Index of chosen option. |
| `SelectCounter` | Engine asks the player to declare a number of counters to use/place. | `SelectCounterPanel` inside `DecisionBottomSheet`: counter type label + stepper input (− / count / +), bounded by min/max from the decision payload. [Confirm] button. | Same panel. | Integer count. |
| `Announce*` (attrib, card, number, race) | Engine asks the player to declare a value (e.g., for Prohibition, Dark Designator). | `AnnouncePanel` inside `DecisionBottomSheet`: the sub-type (attribute / card name / number / race) determines the input widget (dropdown/search, numeric stepper). Label states the ask neutrally. | Same panel. | Declared value. |

### 4.6 Rare / minimal-handling decisions

| Decision kind | Mobile + Desktop presentation | Response |
|---|---|---|
| `SortCard` | `SortCardPanel`: shows the cards to order as a draggable (mobile: tap to cycle positions; drag is an accelerator, not required) list. Confirm when ordered. | Ordered array of indices. |
| `RockPaperScissors` | **Engine-internal in Phase 2; no player-facing panel required.** First-turn determination is handled server-side (seat 0 goes first in the current setup), so the engine adapter resolves RPS automatically without prompting either player. The protocol retains the `RockPaperScissors` variant for full coverage and the Phase 0 catalog will confirm empirically whether the engine emits it under our duelFlags. If it does surface to the client in a later phase, add `RockPaperScissorsPanel` then. | N/A for Phase 2. |

### 4.7 Announce decisions: neutral prompt strings

All decision payloads must carry a **neutral, pre-rendered prompt string** (e.g., "Alex activated
Bottomless Trap Hole. You may respond.") that the UI renders verbatim. The UI does not reconstruct
prompt text from raw card IDs — that is the engine adapter's job (Phase 1). This preserves the
"state events neutrally, never raw engine state" contract (§7 of the UX spec).

---

## 5. Accessibility requirements

§16 states these as non-negotiable. This section translates each into a concrete per-component
requirement so they can be verified in CI and PR review.

### 5.1 Tap targets ≥ 44 px

**Applies to:** every interactive element on mobile (card zones, hand cards, phase rail steps, End
Turn, Respond/Pass buttons, Confirm/Cancel in targeting, chain panel controls, Inspector launch,
collapse/expand toggles, all `*Panel` buttons inside `DecisionBottomSheet`).

- Use `min-height: 44px; min-width: 44px` on all `<button>` and tappable `<div role="button">`
  elements.
- For card zones smaller than 44 px visually (e.g., mini thumbnails in the opponent strip), use a
  CSS pseudo-element or negative-margin technique to extend the tap target beyond the visual
  boundary without affecting layout.
- Verified in component tests via `@testing-library` queries and viewport size assertions, and in
  Playwright e2e at Pixel-class portrait viewport.

### 5.2 Body text ≥ 16 px on mobile

**Applies to:** all card names, effect text in the Inspector, prompt strings in `PriorityPrompt`
and `*Panel` components, phase rail labels, LP numbers, log entries, option labels.

- Set base font size to `1rem` (browser default 16 px); never use `px` values below 16 for body
  content.
- The in-app Text-size setting (Settings §14) uses `font-size` on the `<html>` element so `rem`
  values scale with it.
- Honor the OS/browser text-size setting (`prefers-reduced-motion` and viewport meta `user-scalable`
  must not be `no` — do not disable pinch-zoom on mobile).
- `CardZone` thumbnails show only art + name + key stats; full effect text never needs to be
  legible at zone size.

### 5.3 No meaning by color alone

**Applies to:** every card state (actionable, idle, dimmed, selected, valid-target), ownership
(your cards vs. opponent's), banlist badges, the per-move countdown urgency escalation, LP bar.

Per-component requirements:

| Component | State | Color cue | Non-color cue required |
|---|---|---|---|
| `CardStateMarker` | Actionable | Glow ring | Corner dot `•` |
| `CardStateMarker` | Selected | Accent border | Checkmark icon |
| `CardZone` / `CardThumbnail` | Valid target (pulse) | Pulse animation | Pulsing border/outline shape |
| `CardZone` / `CardThumbnail` | Dimmed/invalid | ~55% opacity | No highlight / no pulse |
| `ChainPanel` link | Owner (you vs. opp) | Color fill | Hatch pattern + owner name label |
| `MoveCountdown` | Urgent | Warning color | ⚠ icon + mm:ss format switch |
| `LPDisplay` | Damage | Bar drains | Floating delta label ("−1800") |
| Banlist badges (builder) | Status | Badge color | 🚫 / ① / ② icon/glyph |

In colorblind-safe mode (user setting, §14): `CardStateMarker` and `ChainPanel` strengthen
their non-color cues (larger dot, heavier hatch, bolder label) so the state is legible with
any color-vision variant.

### 5.4 Reduced-motion support

**Applies to:** `LPDisplay` damage animation, `MoveCountdown` color transition, `CardZone`
valid-target pulse, chain resolution step highlights, `ChainPanel` slide animations,
`DecisionBottomSheet` slide-up.

Implementation: wrap all animation with `@media (prefers-reduced-motion: reduce)` and provide
an instant, still-legible alternative (value snap, opacity toggle, no slide). Functional
information (the new LP value, the resolved chain step) is never lost — only the motion is removed.

The `MoveCountdown` still counts down numerically in reduced-motion; only the CSS animation
on the urgency color transition is removed.

### 5.5 WCAG-AA contrast — light and dark themes

**Applies to:** all text on background, icon fills on background, LP bar fill on track, card
state markers on card art.

- Ship light / dark / system themes (§14 Settings).
- Every text + background pair must meet WCAG 2.1 AA: ≥ 4.5:1 for normal text (< 18 pt),
  ≥ 3:1 for large text (≥ 18 pt or ≥ 14 pt bold) and UI components.
- Use CSS custom properties for all color tokens; the theme toggle swaps the token set on
  the `<html>` element. Never hardcode color values in component files.
- Verify contrast ratios in automated tests or a Storybook a11y plugin before shipping.

### 5.6 Keyboard navigation on desktop

**Applies to:** phase rail, End Turn button, `ActionContextMenu` items, [Respond]/[Pass] in
`PriorityPrompt`, [Confirm]/[Cancel] in `TargetingOverlay`, all `*Panel` controls,
`CardInspector` dismiss and navigation arrows, `DuelLogRail` entries.

- All interactive elements are reachable via Tab/Shift-Tab.
- Activation via Enter or Space.
- Escape closes overlays and sheets, equivalent to clicking Cancel/✕.
- Focus is trapped within `DecisionBottomSheet` and `CardInspector` while they are open
  (keyboard users must not be able to Tab past them into the board behind).
- Focus returns to the triggering element on close.
- The enforcing model means keyboard users can't make illegal moves either (§16 note).

### 5.7 aria attributes (summary)

| Component | Key aria requirements |
|---|---|
| `CardZone` | `role="button"` (interactive), `aria-label` with zone contents and state |
| `CardInspector` | `role="dialog"`, `aria-labelledby` (card name heading), focus trap |
| `DecisionBottomSheet` | `role="dialog"`, `aria-labelledby` (prompt heading), focus trap |
| `MoveCountdown` | `aria-live="off"` default; `aria-live="polite"` in final stretch |
| `LPDisplay` | `aria-live="polite"` for LP updates |
| `TargetingOverlay` mini-prompt | `aria-live="polite"` for selection count updates |
| `ChainPanel` links | `role="list"` / `role="listitem"` with descriptive `aria-label` per link |
| `PhaseRail` items | `aria-pressed` (current phase), `aria-disabled` (unreachable phases) |

---

## 6. Async resume behavior

Async play is first-class (§15g, §17-note-9). A player can close the app and return to a
days-old duel. This section specifies what the UI must handle on resume.

### 6.1 Resume entry path

The primary mobile entry into an in-progress duel is:

```
Home ("Your move" queue) → tap [Resume] → DuelField at current game state
```

There is no Pre-Duel Room on resume. The board appears immediately at the live game state.

### 6.2 Board state on resume

When `DuelScreen` mounts on resume:

1. The current board state is fetched / delivered via the WebSocket connection (the server owns
   the durable game state per §17-note-9).
2. The board renders as it was when the player last acted — zones, hand, GY, LP, phase, turn number.
3. **The per-move countdown is already running** (server-owned wall-clock deadline). The client
   reads the `deadlineAt` timestamp from the server and renders `MoveCountdown` against it,
   accounting for clock skew.
4. If it is this player's turn, a `DuelDecision` is waiting. `DecisionDispatcher` renders it
   immediately.
5. If it is the opponent's turn, the board is in `IDLE` state (read-only except inspect).

### 6.3 Turn/phase ribbon on resume

The `TurnPhaseRibbon` shows:
- Whose turn it is and the current phase (same as mid-duel).
- The `MoveCountdown` for whoever is awaited, showing how much time remains.
- If it is this player's clock and the budget is in the final stretch, the urgency styling applies
  immediately on mount — not after a delay.

### 6.4 Reconnection after disconnection

`duelSocket.ts` already implements exponential-backoff reconnect on non-clean close. On
reconnect after going offline mid-duel:
- Re-subscribe to the duel channel.
- Receive current board state snapshot from server.
- If the player's move-timer has expired during the absence, the server will have adjudicated
  the timeout; `DuelScreen` receives a `DUEL_END` message and transitions to `DuelSummary`.
- If the timer has not expired, the board resumes at the live state.

### 6.5 What must NOT happen on resume

- The board must never show a stale LP, stale zone contents, or a stale clock.
- The client must not "trust" any locally-cached board state across sessions — always reconcile
  against server state on mount.
- The per-move timer must not be computed client-side from a local start time. The client renders
  the server's `deadlineAt` timestamp only.

---

## 7. Resolved decisions (CTO, 2026-07-16)

All eight implementation questions from the initial delivery were ruled on by the CTO on
2026-07-16. Rulings are canonical; they have been folded into the relevant body sections above.
This section records each ruling in one place for auditability.

**OQ-1 — Tablet tier layout.**
_Ruling:_ Tablet (600–1023 px) follows the **desktop dual-field layout**, scaled down — not the
phone stack. The collapsible opponent strip (`OpponentStatusStrip`) is **phone-portrait only**;
at tablet and above, both fields are always visible with no collapse. This keeps collapse a
phone-tier behavior and avoids a third distinct layout. See §1.1, §1.3, §2.4.

**OQ-2 — Inspect vs. act on hand-fan cards.**
_Ruling:_ The §15c split-hit-region (art = inspect, action strip = act) applies to **field cards**
(larger zones). For the **hand fan**, use **inspect-first**: a tap opens the Inspector, which
surfaces the card's legal actions as buttons inside the overlay. Do not split a fanned card into
two tiny hit regions. Field-card action strip remains ≥ 44 px tall. This is an engineering
refinement of §15c for the constrained hand-fan geometry. See §2.3, §3.3.

**OQ-3 — Duel log access on mobile.**
_Ruling:_ **Peekable slide-in panel**, available during the duel via a small "log" button in the
top bar or phase rail. The panel overlays without blocking the board; toggled by a button. Also
shown in the post-duel summary. Not post-duel only. See §2.7.

**OQ-4 — ActionSheet population.**
_Ruling:_ The `ActionSheet` is populated **purely from the current `IdleCommand` / `BattleCommand`
`DuelDecision` payload**. The engine enumerates every legal action grouped per actionable card;
the UI filters to the tapped card's index. The UI **never issues a separate per-card legality
query** and **never computes legality itself** (server-authoritative). Tap a card with no actions
in the current decision, or when no decision is pending → inspect only. The CTO has added the
grouping-per-card requirement to the Phase 0 contract spec. See §2.9, §4.1.

**OQ-5 — Forced / cancelable decisions.**
_Ruling:_ **Confirmed.** Every `DuelDecision` variant carries a `cancelable` boolean (and `canPass`
where a pass is separately legal). `cancelable: false` → `DecisionBottomSheet` suppresses the
Cancel affordance entirely. See §2.9.

**OQ-6 — Opponent strip expanded state.**
_Ruling:_ **Persist within the page session** across moves and engine decisions; do not reset on
each decision (jarring). **Default to collapsed** on fresh mount and on resume from Home. Component
state is sufficient — no session-level store needed. See §2.4.

**OQ-7 — Landscape mode.**
_Ruling:_ **Deferred from Phase 2.** Phase 2 targets phone-portrait + tablet + desktop. The
responsive system must not visually break in landscape (a landscape phone landing in the tablet
tier reflow is acceptable), but no bespoke landscape layout is designed or required. Landscape
is deferred, not unsupported — §15e's "offered, not required" is preserved for a later phase. See §1.1.

**OQ-8 — RockPaperScissors.**
_Ruling:_ **Not a Phase 2 player-facing panel.** First-turn determination is handled server-side
(seat 0 goes first in the current setup); the engine adapter auto-resolves RPS without surfacing
it to either player. The protocol retains the `RockPaperScissors` variant; the Phase 0 empirical
catalog will confirm whether the engine emits it under the Edison duelFlags. No
`RockPaperScissorsPanel` is needed for Phase 2. See §4.6.

---

*End of Phase 0.5 mobile duel engineering spec. All eight CTO rulings have been incorporated.
Components, breakpoints, and the decision-UI mapping are ready for Phase 2 Frontend implementation
once the Phase 0 contract schema is locked.*
