/**
 * DecisionDispatcher — rewritten as a thin wrapper over DecisionRenderer.
 *
 * The W2 rebuild replaces the per-variant panel architecture with one
 * DecisionRenderer that handles all 20 variants via a variant switch.
 * This file is kept for any legacy import paths that may reference it;
 * new code should import DecisionRenderer directly from dock/DecisionRenderer.
 *
 * NOTE: This component does NOT manage selection state. Selection state is
 * owned by useDuelInteraction and lives in ActionPanel / DuelDock.
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import { DecisionRenderer } from "./dock/DecisionRenderer";

interface Props {
  decision: DuelDecision;
  respond: (r: DuelDecisionResponse) => void;
  layoutTier: "phone" | "tablet" | "desktop";
  disabled?: boolean;
}

/**
 * @deprecated Use DuelDock (via ActionPanel) which owns the full state machine.
 *             DecisionDispatcher is kept only for backward-compatible imports.
 */
export function DecisionDispatcher({ decision, respond, disabled }: Props) {
  // selection is stateless here — the full state lives in useDuelInteraction.
  // This wrapper provides a minimal working surface for legacy call sites.
  const [selection, setSelection] = React.useState<
    Array<{ controller: 0 | 1; location: string; sequence: number }>
  >([]);

  const onToggle = (ref: { controller: 0 | 1; location: string; sequence: number }) => {
    setSelection((prev) => {
      const exists = prev.findIndex(
        (r) =>
          r.controller === ref.controller &&
          r.location === ref.location &&
          r.sequence === ref.sequence,
      );
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      return [...prev, ref];
    });
  };

  const onConfirm = () => {
    // Compute response from current selection.
    if (decision.kind === "SelectCard") {
      const indices = selection
        .map((ref) =>
          decision.cards.findIndex(
            (c) =>
              c.controller === ref.controller &&
              c.location === ref.location &&
              c.sequence === ref.sequence,
          ),
        )
        .filter((i) => i >= 0);
      if (indices.length >= decision.min) {
        respond({ kind: "SelectCard", indices });
      }
    } else if (decision.kind === "SelectTribute") {
      const indices = selection
        .map((ref) =>
          decision.cards.findIndex(
            (c) =>
              c.controller === ref.controller &&
              c.location === ref.location &&
              c.sequence === ref.sequence,
          ),
        )
        .filter((i) => i >= 0);
      if (indices.length >= decision.min) {
        respond({ kind: "SelectTribute", indices });
      }
    } else if (decision.kind === "ChainPrompt") {
      if (selection.length > 0) {
        const ref = selection[0]!;
        const index = decision.selects.findIndex(
          (c) =>
            c.controller === ref.controller &&
            c.location === ref.location &&
            c.sequence === ref.sequence,
        );
        if (index >= 0) respond({ kind: "ChainPrompt", index });
      }
    } else if (decision.kind === "SelectEffectYN") {
      respond({ kind: "SelectEffectYN", yes: true });
    } else if (decision.kind === "SelectYesNo") {
      respond({ kind: "SelectYesNo", yes: true });
    }
  };

  const onDecline = () => {
    if (decision.kind === "SelectCard" && decision.cancelable) {
      respond({ kind: "SelectCard", indices: null });
    } else if (decision.kind === "SelectTribute" && decision.cancelable) {
      respond({ kind: "SelectTribute", indices: null });
    } else if (decision.kind === "ChainPrompt" && !decision.forced) {
      respond({ kind: "ChainPrompt", index: null });
    } else if (decision.kind === "SelectEffectYN") {
      respond({ kind: "SelectEffectYN", yes: false });
    } else if (decision.kind === "SelectYesNo") {
      respond({ kind: "SelectYesNo", yes: false });
    }
  };

  return (
    <DecisionRenderer
      decision={decision}
      selection={
        selection as Array<{
          controller: 0 | 1;
          location: "HAND" | "MZONE" | "SZONE" | "FZONE" | "GRAVE" | "REMOVED" | "EXTRA" | "DECK";
          sequence: number;
        }>
      }
      onToggle={onToggle as Parameters<typeof DecisionRenderer>[0]["onToggle"]}
      onConfirm={onConfirm}
      onDecline={onDecline}
      onDirectRespond={respond}
      commitNext={false}
      loading={false}
      disabled={disabled}
    />
  );
}
