/**
 * SelectCardPanel — DecisionPanelProps<"SelectCard">
 *
 * Pulses valid candidate cards; shows running count (selected / max);
 * Confirm is enabled at min; Cancel is shown only when cancelable.
 *
 * Valid candidates get the `targeting-pulse` CSS class (color + outline + scale
 * non-color cue so meaning is never conveyed by color alone — §5.3).
 *
 * a11y: ≥44px targets, ≥16px text, aria-pressed, aria-live count, reduced-motion
 * via CSS, keyboard-navigable list.
 */

import React, { useState } from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Style constants ───────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const MINI_PROMPT: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "var(--bg-2)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const PROMPT_LABEL: React.CSSProperties = {
  flex: 1,
  fontWeight: 600,
  fontSize: "1rem",
  color: "var(--text-0)",
};

const COUNT_BADGE: React.CSSProperties = {
  fontWeight: 700,
  color: "var(--accent-light)",
  fontSize: "1rem",
  minWidth: 40,
  textAlign: "center",
};

const BTN_CONFIRM: React.CSSProperties = {
  minHeight: 44,
  minWidth: 80,
  padding: "8px 14px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "1rem",
};

const BTN_CONFIRM_DISABLED: React.CSSProperties = {
  ...BTN_CONFIRM,
  background: "var(--bg-3)",
  color: "var(--text-2)",
  cursor: "not-allowed",
};

const BTN_CANCEL: React.CSSProperties = {
  minHeight: 44,
  minWidth: 80,
  padding: "8px 14px",
  background: "transparent",
  border: "1px solid var(--invalid)",
  borderRadius: 6,
  color: "var(--invalid)",
  cursor: "pointer",
  fontSize: "1rem",
};

const CARD_LIST: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const CARD_BTN_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 14px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
};

const CARD_BTN_SELECTED: React.CSSProperties = {
  ...CARD_BTN_BASE,
  background: "var(--accent-dim)",
  border: "2px solid var(--accent-light)",
};

// Pulse class applied to valid (selectable) cards via inline style + CSS class.
// Non-color cue: scale + outline animation (see <style> block below).
const PULSE_STYLE: React.CSSProperties = {
  border: "2px solid var(--accent)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectCardPanel({
  decision: d,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectCard">) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const atMax = selectedIndices.length >= d.max;
  const canConfirm = selectedIndices.length >= d.min;

  function toggle(i: number) {
    if (disabled) return;
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= d.max) return prev;
      return [...prev, i];
    });
  }

  function handleConfirm() {
    if (!canConfirm || disabled) return;
    respond({ kind: "SelectCard", indices: selectedIndices });
  }

  function handleCancel() {
    if (disabled) return;
    respond({ kind: "SelectCard", indices: null });
  }

  return (
    <div style={PANEL}>
      {/* CSS for pulse animation — non-color cue via transform scale */}
      <style>{`
        .select-card-pulse {
          animation: select-card-pulse-anim 1.2s ease-in-out infinite;
        }
        @keyframes select-card-pulse-anim {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--accent-rgb,99,102,241), 0.4); }
          50%       { transform: scale(1.015); box-shadow: 0 0 0 4px rgba(var(--accent-rgb,99,102,241), 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .select-card-pulse { animation: none; }
        }
      `}</style>

      {/* Sticky mini-prompt */}
      <div style={MINI_PROMPT} role="status" aria-live="polite">
        <span style={PROMPT_LABEL}>
          Select cards ({d.min}–{d.max})
        </span>
        <span style={COUNT_BADGE} aria-label={`${selectedIndices.length} of ${d.max} selected`}>
          {selectedIndices.length} / {d.max}
        </span>
        <button
          data-testid="confirm-btn"
          style={canConfirm && !disabled ? BTN_CONFIRM : BTN_CONFIRM_DISABLED}
          disabled={!canConfirm || disabled}
          aria-disabled={!canConfirm || disabled}
          onClick={handleConfirm}
        >
          Confirm ✓
        </button>
        {d.cancelable && (
          <button
            data-testid="cancel-btn"
            style={BTN_CANCEL}
            disabled={disabled}
            onClick={handleCancel}
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {/* Card list */}
      <div style={CARD_LIST} role="group" aria-label="Selectable cards">
        {d.cards.map((card, i) => {
          const isSelected = selectedIndices.includes(i);
          const isValid = !isSelected && !atMax;
          return (
            <button
              key={i}
              data-testid="card-option"
              className={isValid ? "select-card-pulse" : undefined}
              style={{
                ...(isSelected ? CARD_BTN_SELECTED : CARD_BTN_BASE),
                ...(isValid ? PULSE_STYLE : {}),
                opacity: disabled ? 0.5 : atMax && !isSelected ? 0.5 : 1,
                cursor: disabled || (atMax && !isSelected) ? "not-allowed" : "pointer",
              }}
              disabled={disabled || (atMax && !isSelected)}
              aria-pressed={isSelected}
              onClick={() => toggle(i)}
            >
              <span aria-hidden="true">{isSelected ? "✓" : isValid ? "▸" : "○"}</span>
              <span>
                {card.name || `Card (code ${card.code})`}
                {card.location ? ` [${card.location}·${card.sequence}]` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
