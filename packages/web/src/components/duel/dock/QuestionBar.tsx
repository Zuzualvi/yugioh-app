/**
 * QuestionBar — the single answer surface for all 20 DuelDecision variants.
 *
 * One bar, docked bottom-centre, always present in ANSWER mode.
 * IdleCommand and BattleCommand are NOT rendered here — they arm ACT mode.
 *
 * Structure:
 *   Line 1: sentence (always names a card)
 *   Line 2: answer space (variant-specific via DecisionRenderer)
 *   Line 3: verb row (decline left, confirm right)
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §4.
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import type { CardRef } from "../../../duel/contracts";
import { DecisionRenderer } from "./DecisionRenderer";

interface Props {
  decision: DuelDecision;
  selection: CardRef[];
  onToggle: (ref: CardRef) => void;
  onConfirm: () => void;
  onDecline: () => void;
  onDirectRespond: (r: DuelDecisionResponse) => void;
  /** True when the NEXT step after this one is non-cancelable. */
  commitNext: boolean;
  loading: boolean;
  disabled?: boolean;
  caption?: string;
}

export function QuestionBar({
  decision,
  selection,
  onToggle,
  onConfirm,
  onDecline,
  onDirectRespond,
  commitNext,
  loading,
  disabled = false,
  caption,
}: Props) {
  // IdleCommand and BattleCommand are never rendered as a bar.
  if (decision.kind === "IdleCommand" || decision.kind === "BattleCommand") {
    return null;
  }

  return (
    <div
      data-testid="question-bar"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 16px",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.15)",
      }}
    >
      <DecisionRenderer
        decision={decision}
        selection={selection}
        onToggle={onToggle}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onDirectRespond={onDirectRespond}
        commitNext={commitNext}
        loading={loading}
        disabled={disabled}
        caption={caption}
      />
    </div>
  );
}
