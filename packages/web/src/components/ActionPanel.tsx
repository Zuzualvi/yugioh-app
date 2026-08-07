/**
 * ActionPanel — replaced by the DuelDock in the W2 rebuild.
 *
 * This file keeps the same prop interface as before so DuelScreen.tsx
 * (owned by W1) can continue to import it unchanged until W1 integrates
 * DuelStage and mounts DuelDock directly.
 *
 * The implementation now delegates to DuelDock and the useDuelInteraction
 * state machine.
 *
 * RESIGN has moved: it is now in the settings popover (W1/DuelTopBar).
 * For backward-compatibility with DuelScreen.tsx, the resign button is
 * retained here but will be removed when W1 owns it.
 */

import React from "react";
import type { DuelClientMessage, DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import { DuelDock } from "./duel/dock/DuelDock";
import { useDuelInteraction } from "../duel/useDuelInteraction";

interface Props {
  /** The current typed DuelDecision for this seat, or null if none pending */
  decision: DuelDecision | null;
  respond: (r: DuelDecisionResponse) => void;
  onSend: (msg: DuelClientMessage) => void;
  disabled?: boolean;
}

export function ActionPanel({ decision, respond, onSend, disabled = false }: Props) {
  const interaction = useDuelInteraction({
    decision,
    mySeat: 0, // Stub: DuelScreen provides mySeat to ActionPanel indirectly; W1 will fix.
    duelEnded: disabled,
    respond,
    prefs: { chooseZones: false },
  });

  function handleResign() {
    if (!confirm("Resign this duel?")) return;
    onSend({ type: "RESIGN" });
  }

  // When there is no decision and no intent and no receipts, show the waiting placeholder
  // for backward-compatibility with ActionPanel tests.
  const showNoDecision =
    decision === null &&
    interaction.intent === null &&
    interaction.receipts.length === 0 &&
    interaction.chain.length === 0;

  return (
    <div
      data-testid="action-panel"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {showNoDecision ? (
        <p
          style={{
            color: "var(--text-2)",
            fontSize: "1rem",
            fontStyle: "italic",
          }}
          data-testid="no-decision"
        >
          Waiting for engine…
        </p>
      ) : (
        <DuelDock
          decision={decision}
          selection={interaction.selection}
          chain={interaction.chain}
          receipts={interaction.receipts}
          intent={interaction.intent}
          mySeat={0}
          onToggle={interaction.toggleSelection}
          onConfirm={interaction.confirm}
          onDecline={interaction.decline}
          onDirectRespond={respond}
          onCancelIntent={interaction.cancelIntent}
          onAskNextTime={() => interaction.setPrefs({ chooseZones: true })}
          loading={interaction.status === "Sending…"}
          disabled={disabled}
        />
      )}

      {/* Resign control — temporary: W1 moves this to DuelTopBar settings */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          data-testid="resign-btn"
          onClick={handleResign}
          disabled={disabled}
          style={{
            padding: "6px 16px",
            minHeight: 44,
            background: "transparent",
            border: "1px solid var(--invalid)",
            borderRadius: 6,
            color: "var(--invalid)",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "1rem",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ⚑ Resign
        </button>
      </div>
    </div>
  );
}
