/**
 * SelectEffectYNPanel — shows the activating card + description and asks Yes/No.
 *
 * Emits: { kind: "SelectEffectYN", yes: boolean }
 * a11y: ≥44px targets, ≥16px text, keyboard navigable, no color-only meaning.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  minHeight: 44,
  padding: "10px 16px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
};

const BTN_CONFIRM: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--accent)",
  color: "#fff",
};

const BTN_CANCEL: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--invalid)",
  color: "var(--invalid)",
};

const CARD_BOX: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  marginBottom: 12,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectEffectYNPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectEffectYN">) {
  const { card, description } = decision;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  return (
    <div>
      {/* Card display */}
      <div style={CARD_BOX} aria-label={`Card: ${card.name || `Card (code ${card.code})`}`}>
        <span
          aria-hidden="true"
          style={{
            fontSize: "1.5rem",
            lineHeight: 1,
          }}
        >
          🃏
        </span>
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-0)",
          }}
        >
          {card.name || `Card (code ${card.code})`}
        </span>
      </div>

      {/* Effect description */}
      <p
        style={{
          fontSize: "1rem",
          color: "var(--text-0)",
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        {description || `Activate effect of ${card.name || "this card"}?`}
      </p>

      {/* Yes / No */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          data-testid="action-option"
          style={dis(BTN_CONFIRM)}
          disabled={disabled}
          onClick={() => respond({ kind: "SelectEffectYN", yes: true })}
          aria-label="Yes — activate effect"
        >
          ✓ Yes
        </button>
        <button
          data-testid="action-option"
          style={dis(BTN_CANCEL)}
          disabled={disabled}
          onClick={() => respond({ kind: "SelectEffectYN", yes: false })}
          aria-label="No — do not activate"
        >
          ✕ No
        </button>
      </div>
    </div>
  );
}
