/**
 * CommandDecisionPanels — sub-dispatcher for Slice 2B command + chain kinds.
 *
 * Handles: IdleCommand | BattleCommand | ChainPrompt
 *
 * Uses explicit type-guard functions so TypeScript fully narrows both
 * `decision` AND `respond` in each branch — no casts required.
 *
 * Returns null for any other kind (safe fallback; parent routes rare kinds
 * to GenericDecisionPanel).
 *
 * The CTO wires this into DecisionDispatcher at integration time.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";
import IdleCommandPanel from "./IdleCommandPanel";
import BattleCommandPanel from "./BattleCommandPanel";
import ChainPromptPanel from "./ChainPromptPanel";

// Discriminated union: each variant has a specific (decision, respond) pair.
export type CommandDecisionPanelsProps =
  | DecisionPanelProps<"IdleCommand">
  | DecisionPanelProps<"BattleCommand">
  | DecisionPanelProps<"ChainPrompt">;

// ── Type guards ───────────────────────────────────────────────────────────────
// Explicit guards fully narrow the union including the `respond` type.

function isIdleProps(
  props: CommandDecisionPanelsProps,
): props is DecisionPanelProps<"IdleCommand"> {
  return props.decision.kind === "IdleCommand";
}

function isBattleProps(
  props: CommandDecisionPanelsProps,
): props is DecisionPanelProps<"BattleCommand"> {
  return props.decision.kind === "BattleCommand";
}

function isChainProps(
  props: CommandDecisionPanelsProps,
): props is DecisionPanelProps<"ChainPrompt"> {
  return props.decision.kind === "ChainPrompt";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandDecisionPanels(props: CommandDecisionPanelsProps): React.JSX.Element | null {
  // Each branch is fully narrowed by its type guard — no casts needed.
  if (isIdleProps(props)) {
    return <IdleCommandPanel {...props} />;
  }
  if (isBattleProps(props)) {
    return <BattleCommandPanel {...props} />;
  }
  if (isChainProps(props)) {
    return <ChainPromptPanel {...props} />;
  }

  // Unreachable when typed correctly — satisfies the exhaustive-check contract.
  return null;
}
