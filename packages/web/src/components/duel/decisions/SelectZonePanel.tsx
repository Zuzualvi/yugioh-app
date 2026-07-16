/**
 * SelectZonePanel — DecisionPanelProps<"SelectZone">
 *
 * Choose `count` zones from the decoded `zones[]` list (each {controller, location, sequence}).
 * Valid (unselected) zones pulse; selected zones are highlighted.
 *
 * If count === 1: clicking a zone immediately responds (no confirm step).
 * If count > 1: multi-select with a Confirm button enabled at count.
 *
 * SelectZone has no cancelable field — cancel is never shown.
 *
 * a11y: ≥44px targets, ≥16px text, aria-pressed, aria-live, reduced-motion safe.
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

const ZONE_GRID: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const ZONE_BTN_BASE: React.CSSProperties = {
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

const ZONE_BTN_SELECTED: React.CSSProperties = {
  ...ZONE_BTN_BASE,
  background: "var(--accent-dim)",
  border: "2px solid var(--accent-light)",
};

const ZONE_BTN_DONE: React.CSSProperties = {
  ...ZONE_BTN_BASE,
  border: "1px solid var(--border)",
  opacity: 0.45,
  cursor: "not-allowed",
};

// ── Zone label helper ─────────────────────────────────────────────────────────

function zoneLabel(z: { controller: 0 | 1; location: string; sequence: number }) {
  const owner = z.controller === 0 ? "Your" : "Opponent's";
  const loc =
    z.location === "MZONE"
      ? "Monster Zone"
      : z.location === "SZONE"
        ? "Spell/Trap Zone"
        : "Field Zone";
  return `${owner} ${loc} ${z.sequence + 1}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectZonePanel({
  decision: d,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectZone">) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const isSingle = d.count === 1;
  const canConfirm = selectedIndices.length >= d.count;
  const atMax = selectedIndices.length >= d.count;

  function handleZoneClick(i: number) {
    if (disabled) return;
    if (isSingle) {
      respond({ kind: "SelectZone", indices: [i] });
      return;
    }
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= d.count) return prev;
      return [...prev, i];
    });
  }

  function handleConfirm() {
    if (!canConfirm || disabled) return;
    respond({ kind: "SelectZone", indices: selectedIndices });
  }

  return (
    <div style={PANEL}>
      <style>{`
        .select-zone-pulse {
          animation: sz-pulse-anim 1.2s ease-in-out infinite;
        }
        @keyframes sz-pulse-anim {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--accent-rgb,99,102,241), 0.4); }
          50%       { transform: scale(1.015); box-shadow: 0 0 0 4px rgba(var(--accent-rgb,99,102,241), 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .select-zone-pulse { animation: none; }
        }
      `}</style>

      {/* Sticky mini-prompt (only for multi-select) */}
      {!isSingle && (
        <div style={MINI_PROMPT} role="status" aria-live="polite">
          <span style={PROMPT_LABEL}>
            Select {d.count} zone{d.count !== 1 ? "s" : ""}
          </span>
          <span style={COUNT_BADGE} aria-label={`${selectedIndices.length} of ${d.count} selected`}>
            {selectedIndices.length} / {d.count}
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
        </div>
      )}

      {isSingle && (
        <p style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-0)", marginBottom: 10 }}>
          Select a zone:
        </p>
      )}

      {/* Zone list */}
      <div style={ZONE_GRID} role="group" aria-label="Available zones">
        {d.zones.map((zone, i) => {
          const isSelected = selectedIndices.includes(i);
          const isValid = !isSelected && !atMax;
          let btnStyle: React.CSSProperties;
          if (isSingle) {
            btnStyle = ZONE_BTN_BASE;
          } else if (isSelected) {
            btnStyle = ZONE_BTN_SELECTED;
          } else if (atMax) {
            btnStyle = ZONE_BTN_DONE;
          } else {
            btnStyle = ZONE_BTN_BASE;
          }
          return (
            <button
              key={i}
              data-testid="zone-option"
              className={isValid || isSingle ? "select-zone-pulse" : undefined}
              style={{
                ...btnStyle,
                opacity: disabled ? 0.5 : btnStyle.opacity,
                cursor: disabled ? "not-allowed" : btnStyle.cursor,
              }}
              disabled={disabled || (!isSingle && atMax && !isSelected)}
              aria-pressed={isSingle ? undefined : isSelected}
              onClick={() => handleZoneClick(i)}
            >
              <span aria-hidden="true">{isSelected ? "✓" : "▸"}</span>
              <span>{zoneLabel(zone)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
