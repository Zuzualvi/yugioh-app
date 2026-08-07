/**
 * AutoAnswerReceiptBanner (§4b / C9) — tells the player that a decision with
 * exactly one legal answer was answered on their behalf.
 *
 * This is a receipt, not a question:
 * - No primary button. Ever.
 * - Copy is past tense and names what was answered.
 * - Auto-dismisses; never a step the player must clear.
 * - Optional "Ask me next time" link for decisions governed by a preference.
 *
 * W2 populates `DuelInteraction.receipts`; this component renders them.
 * Caller places it above the intent ribbon.
 */

import React from "react";
import type { AutoAnswerReceipt } from "../../../duel/contracts";

const REASON_LABELS: Record<AutoAnswerReceipt["reason"], string> = {
  "only-one-legal-answer": "Only one legal answer",
  "engine-unrestricted-placement": "Unrestricted placement",
};

interface Props {
  receipts: AutoAnswerReceipt[];
  /** For SelectZone auto-answers, present an opt-out. */
  onAskNextTime?: (receipt: AutoAnswerReceipt) => void;
}

export function AutoAnswerReceiptBanner({ receipts, onAskNextTime }: Props) {
  if (receipts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {receipts.map((r) => (
        <div
          key={r.id}
          data-testid="auto-answer-receipt"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            background: "var(--bg-2)",
            borderLeft: "2px solid var(--text-3,#666)",
            fontSize: "0.75rem",
            color: "var(--text-2)",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-3,#666)",
              flexShrink: 0,
            }}
          >
            ANSWERED FOR YOU
          </span>
          <span style={{ flex: 1, color: "var(--text-1)" }}>{r.summary}</span>
          <span
            style={{ color: "var(--text-3,#666)", flexShrink: 0 }}
            title={REASON_LABELS[r.reason]}
          >
            ({REASON_LABELS[r.reason]})
          </span>
          {onAskNextTime && (
            <button
              onClick={() => onAskNextTime(r)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent,#4a90d9)",
                cursor: "pointer",
                fontSize: "0.75rem",
                padding: 0,
                flexShrink: 0,
                textDecoration: "underline",
              }}
            >
              Ask me next time
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
