/**
 * SelectOptionPanel — lists resolved option strings; player taps one to confirm.
 *
 * Emits: { kind: "SelectOption", index: number }
 * a11y: ≥44px targets, ≥16px text, keyboard navigable.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_OPTION: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--accent-dim)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
  fontWeight: 500,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectOptionPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectOption">) {
  const { options } = decision;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  return (
    <div>
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-0)",
          marginBottom: 12,
        }}
      >
        Select an option:
      </p>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
        role="list"
        aria-label="Options"
      >
        {options.map((opt, i) => (
          <button
            key={i}
            data-testid="action-option"
            style={dis(BTN_OPTION)}
            disabled={disabled}
            onClick={() => respond({ kind: "SelectOption", index: i })}
            role="listitem"
          >
            ▶ {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
