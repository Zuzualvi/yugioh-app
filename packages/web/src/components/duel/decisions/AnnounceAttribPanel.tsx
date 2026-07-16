/**
 * AnnounceAttribPanel — choose `count` attributes from the decoded `available` list.
 *
 * Emits: { kind: "AnnounceAttrib", attributes: Attribute[] }
 * a11y: ≥44px targets, ≥16px text, aria-pressed toggles, aria-live count.
 */

import React, { useState } from "react";
import type { Attribute } from "@yugioh-app/contracts";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_SECONDARY: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-1)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
  fontWeight: 400,
};

const SELECTED_BORDER: React.CSSProperties = {
  border: "2px solid var(--accent-light)",
};

const BTN_CONFIRM: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
};

// ── Attribute display (icon + label — no color-only meaning) ──────────────────

const ATTR_DISPLAY: Record<string, { icon: string; label: string }> = {
  EARTH: { icon: "🌍", label: "EARTH" },
  WATER: { icon: "💧", label: "WATER" },
  FIRE: { icon: "🔥", label: "FIRE" },
  WIND: { icon: "🌀", label: "WIND" },
  LIGHT: { icon: "✨", label: "LIGHT" },
  DARK: { icon: "🌑", label: "DARK" },
  DIVINE: { icon: "⚡", label: "DIVINE" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnnounceAttribPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"AnnounceAttrib">) {
  const { count, available } = decision;
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= count) return prev;
      return [...prev, i];
    });
  };

  const canConfirm = selectedIndices.length === count;

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
          marginBottom: 8,
        }}
      >
        Announce {count} attribute{count !== 1 ? "s" : ""}:
      </p>

      {/* Running count */}
      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: "0.875rem",
          color: "var(--text-2)",
          marginBottom: 8,
        }}
      >
        {selectedIndices.length} / {count} selected
      </div>

      {/* Attribute list */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}
        role="group"
        aria-label={`Select ${count} attribute${count !== 1 ? "s" : ""}`}
      >
        {available.map((attr, i) => {
          const sel = selectedIndices.includes(i);
          const display = ATTR_DISPLAY[attr] ?? { icon: "•", label: attr };
          return (
            <button
              key={attr}
              data-testid="action-option"
              style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
              disabled={disabled}
              onClick={() => toggle(i)}
              aria-pressed={sel}
              aria-label={`${display.label}${sel ? " (selected)" : ""}`}
            >
              <span aria-hidden="true">{sel ? "✓" : display.icon}</span>
              {display.label}
            </button>
          );
        })}
      </div>

      {/* Confirm */}
      <button
        style={dis({ ...BTN_CONFIRM, opacity: canConfirm ? 1 : 0.4 })}
        disabled={disabled || !canConfirm}
        onClick={() =>
          respond({
            kind: "AnnounceAttrib",
            attributes: selectedIndices.map((i) => available[i] as Attribute),
          })
        }
        aria-disabled={!canConfirm}
      >
        Confirm ✓
      </button>
    </div>
  );
}
