/**
 * AutoAnswerReceipt — tells the player that a decision was answered for them.
 *
 * NOT a QuestionBar. No primary button. Past tense. Auto-dismisses.
 * See: docs/specs/2026-08-06-duel-ui-design.md §4b.
 */

import React from "react";
import type { AutoAnswerReceipt as Receipt } from "../../../duel/contracts";

interface Props {
  receipts: Receipt[];
  onAskNextTime?: (id: string) => void;
}

export function AutoAnswerReceiptRow({
  receipt,
  onAskNextTime,
}: {
  receipt: Receipt;
  onAskNextTime?: (id: string) => void;
}) {
  return (
    <div
      data-testid="auto-answer-receipt"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px",
        background: "color-mix(in srgb, var(--accent) 8%, var(--bg-1))",
        borderRadius: 4,
        fontSize: "0.875rem",
        color: "var(--text-2)",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: "var(--text-2)",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: "1px 5px",
          flexShrink: 0,
        }}
      >
        AUTO
      </span>
      <span style={{ flex: 1 }}>{receipt.summary}</span>
      {onAskNextTime && receipt.reason === "engine-unrestricted-placement" && (
        <button
          onClick={() => onAskNextTime(receipt.id)}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "0.8rem",
            padding: "0 4px",
            flexShrink: 0,
          }}
        >
          Ask me next time
        </button>
      )}
    </div>
  );
}

export function AutoAnswerReceiptList({ receipts, onAskNextTime }: Props) {
  if (receipts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {receipts.map((r) => (
        <AutoAnswerReceiptRow key={r.id} receipt={r} onAskNextTime={onAskNextTime} />
      ))}
    </div>
  );
}
