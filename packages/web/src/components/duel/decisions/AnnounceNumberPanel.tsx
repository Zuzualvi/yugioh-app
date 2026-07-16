/**
 * AnnounceNumberPanel — pick one number from the `options` list.
 *
 * Emits: { kind: "AnnounceNumber", valueIndex: number }
 * a11y: ≥44px targets, ≥16px text, keyboard navigable.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_NUMBER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  minWidth: 64,
  padding: "10px 16px",
  background: "var(--accent-dim)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  color: "var(--text-0)",
  cursor: "pointer",
  fontSize: "1.125rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnnounceNumberPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"AnnounceNumber">) {
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
        Announce a number:
      </p>

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        role="group"
        aria-label="Number options"
      >
        {options.map((num, i) => (
          <button
            key={i}
            data-testid="action-option"
            style={dis(BTN_NUMBER)}
            disabled={disabled}
            onClick={() => respond({ kind: "AnnounceNumber", valueIndex: i })}
            aria-label={`Announce ${num}`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
