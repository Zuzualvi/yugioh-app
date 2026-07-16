/**
 * SelectYesNoPanel — shows a description and asks Yes/No.
 *
 * Emits: { kind: "SelectYesNo", yes: boolean }
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectYesNoPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectYesNo">) {
  const { description } = decision;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  return (
    <div>
      {/* Question */}
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-0)",
          marginBottom: 16,
        }}
      >
        {description || "Yes or No?"}
      </p>

      {/* Yes / No */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          data-testid="action-option"
          style={dis(BTN_CONFIRM)}
          disabled={disabled}
          onClick={() => respond({ kind: "SelectYesNo", yes: true })}
          aria-label="Yes"
        >
          ✓ Yes
        </button>
        <button
          data-testid="action-option"
          style={dis(BTN_CANCEL)}
          disabled={disabled}
          onClick={() => respond({ kind: "SelectYesNo", yes: false })}
          aria-label="No"
        >
          ✕ No
        </button>
      </div>
    </div>
  );
}
