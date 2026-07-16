/**
 * DecisionPanelProps — FROZEN panel contract for Phase 2 decision panels.
 *
 * Per-kind panels (2B/2C/2D) default-export a component typed as
 * DecisionPanelProps<itsKind>. The DecisionDispatcher maps kind → panel file.
 *
 * Per-kind panel file convention (see DecisionDispatcher.tsx for the full map):
 *   src/components/duel/decisions/<Kind>Panel.tsx
 *   e.g. IdleCommandPanel.tsx, BattleCommandPanel.tsx, ChainPromptPanel.tsx …
 *
 * Shared components panel engineers should reuse (already provided by 2A):
 *   - TargetingOverlay  → src/components/duel/TargetingOverlay.tsx
 *   - DecisionBottomSheet → src/components/duel/DecisionBottomSheet.tsx
 *   - ActionContextMenu → src/components/duel/ActionContextMenu.tsx
 *   - CardInspector (duel) → src/components/duel/CardInspector.tsx
 */

import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

/**
 * Props for a decision panel component.
 *
 * @typeParam K - The DuelDecision kind this panel handles.
 *
 * - `decision`    — The typed decision payload for kind K.
 * - `respond`     — Call this with a matching DuelDecisionResponse to answer.
 * - `layoutTier`  — Current viewport tier; panels adapt layout internally.
 * - `disabled`    — When true, all controls are disabled (duel ended, etc.).
 */
export interface DecisionPanelProps<K extends DuelDecision["kind"]> {
  decision: Extract<DuelDecision, { kind: K }>;
  respond: (response: Extract<DuelDecisionResponse, { kind: K }>) => void;
  layoutTier: "phone" | "tablet" | "desktop";
  disabled?: boolean;
}
