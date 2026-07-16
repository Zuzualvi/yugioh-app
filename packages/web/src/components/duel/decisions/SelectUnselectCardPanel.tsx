/**
 * SelectUnselectCardPanel — DecisionPanelProps<"SelectUnselectCard">
 *
 * Iterative select/unselect protocol: each tap on a card immediately emits a
 * response with that card's combined index; the server processes the toggle and
 * re-sends the decision with updated selectCards/unselectCards lists.
 *
 * Finish (index: null) is shown when canFinish is true and the selected count
 * satisfies min. Cancel (index: null) is shown only when cancelable.
 *
 * a11y: ≥44px targets, ≥16px text, aria-pressed, aria-live, reduced-motion safe.
 */

import React from "react";
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

const BTN_FINISH: React.CSSProperties = {
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

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 700,
  color: "var(--text-2)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "10px 0 6px",
};

const CARD_LIST: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const BTN_SELECT: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 14px",
  background: "var(--bg-2)",
  border: "2px solid var(--accent)",
  borderRadius: 8,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
};

const BTN_UNSELECT: React.CSSProperties = {
  ...BTN_SELECT,
  background: "var(--accent-dim)",
  border: "2px solid var(--accent-light)",
};

const PULSE_STYLE: React.CSSProperties = {};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectUnselectCardPanel({
  decision: d,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectUnselectCard">) {
  // selectCards: candidates to add; unselectCards: currently selected (can be removed)
  const currentSelectedCount = d.unselectCards.length;
  const canFinishNow = d.canFinish && currentSelectedCount >= d.min;

  function handleCardClick(globalIndex: number) {
    if (disabled) return;
    respond({ kind: "SelectUnselectCard", index: globalIndex });
  }

  function handleFinish() {
    if (disabled) return;
    respond({ kind: "SelectUnselectCard", index: null });
  }

  function handleCancel() {
    if (disabled) return;
    respond({ kind: "SelectUnselectCard", index: null });
  }

  return (
    <div style={PANEL}>
      <style>{`
        .select-unselect-pulse {
          animation: su-pulse-anim 1.2s ease-in-out infinite;
        }
        @keyframes su-pulse-anim {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--accent-rgb,99,102,241), 0.4); }
          50%       { transform: scale(1.015); box-shadow: 0 0 0 4px rgba(var(--accent-rgb,99,102,241), 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .select-unselect-pulse { animation: none; }
        }
      `}</style>

      {/* Sticky mini-prompt */}
      <div style={MINI_PROMPT} role="status" aria-live="polite">
        <span style={PROMPT_LABEL}>
          Select / unselect ({d.min}–{d.max})
        </span>
        <span style={COUNT_BADGE} aria-label={`${currentSelectedCount} currently selected`}>
          {currentSelectedCount} selected
        </span>
        {canFinishNow && (
          <button
            data-testid="finish-btn"
            style={BTN_FINISH}
            disabled={disabled}
            onClick={handleFinish}
          >
            Finish ✓
          </button>
        )}
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

      {/* Cards available to select */}
      {d.selectCards.length > 0 && (
        <>
          <p style={SECTION_LABEL} aria-hidden="true">
            ▸ Available to select
          </p>
          <div style={CARD_LIST} role="group" aria-label="Cards available to select">
            {d.selectCards.map((card, i) => (
              <button
                key={`sel-${i}`}
                data-testid="card-option"
                className="select-unselect-pulse"
                style={{
                  ...BTN_SELECT,
                  ...PULSE_STYLE,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                disabled={disabled}
                aria-pressed={false}
                onClick={() => handleCardClick(i)}
              >
                <span aria-hidden="true">▸</span>
                <span>
                  {card.name || `Card (code ${card.code})`}
                  {card.location ? ` [${card.location}·${card.sequence}]` : ""}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Currently selected cards (can be unselected) */}
      {d.unselectCards.length > 0 && (
        <>
          <p style={SECTION_LABEL} aria-hidden="true">
            ✓ Currently selected
          </p>
          <div style={CARD_LIST} role="group" aria-label="Currently selected cards">
            {d.unselectCards.map((card, i) => {
              const globalIndex = d.selectCards.length + i;
              return (
                <button
                  key={`unsel-${i}`}
                  data-testid="card-option"
                  style={{
                    ...BTN_UNSELECT,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                  disabled={disabled}
                  aria-pressed={true}
                  onClick={() => handleCardClick(globalIndex)}
                >
                  <span aria-hidden="true">✓</span>
                  <span>
                    {card.name || `Card (code ${card.code})`}
                    {card.location ? ` [${card.location}·${card.sequence}]` : ""}
                  </span>
                  <span
                    style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-2)" }}
                    aria-hidden="true"
                  >
                    (tap to remove)
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
