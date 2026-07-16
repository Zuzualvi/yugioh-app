/**
 * SelectPositionPanel — DecisionPanelProps<"SelectPosition">
 *
 * Choose battle position for a card. Large tappable buttons (≥44px) labeled
 * with icon + text — never position conveyed by orientation alone (§5.3).
 *
 * a11y: ≥44px targets, ≥16px text, keyboard nav, aria, reduced-motion safe.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";
import type { PositionCode } from "@yugioh-app/contracts";

// ── Position metadata ─────────────────────────────────────────────────────────

const POSITION_META: Record<PositionCode, { icon: string; label: string; sublabel: string }> = {
  faceup_attack: {
    icon: "⚔",
    label: "Attack Position",
    sublabel: "Face-up · ATK",
  },
  facedown_attack: {
    icon: "↕",
    label: "Attack Position",
    sublabel: "Face-down",
  },
  faceup_defense: {
    icon: "🛡",
    label: "Defense Position",
    sublabel: "Face-up · DEF",
  },
  facedown_defense: {
    icon: "🔻",
    label: "Defense Position",
    sublabel: "Face-down · DEF",
  },
};

// ── Style constants ───────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const CARD_LABEL: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "1rem",
  color: "var(--text-0)",
  marginBottom: 4,
};

const CARD_SUBLABEL: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--text-2)",
  marginBottom: 12,
};

const BTN_POSITION: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  minHeight: 56, // generous tap target well above 44px
  padding: "12px 16px",
  background: "var(--bg-2)",
  border: "2px solid var(--accent)",
  borderRadius: 10,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SelectPositionPanel({
  decision: d,
  respond,
  disabled = false,
}: DecisionPanelProps<"SelectPosition">) {
  const cardName = d.card.name || `Card (code ${d.card.code})`;

  function handlePick(pos: PositionCode) {
    if (disabled) return;
    respond({ kind: "SelectPosition", position: pos });
  }

  return (
    <div style={PANEL}>
      <p style={CARD_LABEL}>Choose position for:</p>
      <p style={CARD_SUBLABEL}>{cardName}</p>

      {d.positions.map((pos) => {
        const meta = POSITION_META[pos];
        return (
          <button
            key={pos}
            data-testid="position-option"
            style={{
              ...BTN_POSITION,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            disabled={disabled}
            aria-label={`${meta.label} — ${meta.sublabel}`}
            onClick={() => handlePick(pos)}
          >
            <span style={{ fontSize: "1.5rem" }} aria-hidden="true">
              {meta.icon}
            </span>
            <span>
              <strong style={{ display: "block", fontSize: "1rem" }}>{meta.label}</strong>
              <span style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>{meta.sublabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
