/**
 * ActionPanel — decision UI shell + RESIGN control.
 *
 * Renders the DecisionDispatcher when a typed DuelDecision is pending, or a
 * "Waiting for engine…" placeholder when idle.  Always shows the RESIGN button.
 *
 * a11y: ≥44px targets, keyboard nav, no color-only meaning.
 */

import type { DuelClientMessage, DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import { DecisionDispatcher } from "./duel/DecisionDispatcher";

interface Props {
  /** The current typed DuelDecision for this seat, or null if none pending */
  decision: DuelDecision | null;
  respond: (r: DuelDecisionResponse) => void;
  onSend: (msg: DuelClientMessage) => void;
  disabled?: boolean;
}

export function ActionPanel({ decision, respond, onSend, disabled = false }: Props) {
  function handleResign() {
    if (!confirm("Resign this duel?")) return;
    onSend({ type: "RESIGN" });
  }

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
      {decision ? (
        <DecisionDispatcher
          decision={decision}
          respond={respond}
          layoutTier="desktop"
          disabled={disabled}
        />
      ) : (
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
      )}

      {/* Resign control — always visible */}
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
