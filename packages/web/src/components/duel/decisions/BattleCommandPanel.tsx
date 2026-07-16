/**
 * BattleCommandPanel — bespoke panel for BattleCommand decisions.
 *
 * Renders attack declarations, chain activations, and phase-advance actions
 * (Main Phase 2 / End Phase) sourced purely from the decision payload.
 *
 * Emits DuelDecisionResponse kind "BattleCommand" {action, index}.
 *
 * a11y: ≥44px targets, ≥16px text, keyboard nav, aria-label per action.
 */

import React from "react";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Style constants ───────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
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

const BTN_ATTACK: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--accent-dim)",
  border: "1px solid var(--accent)",
};

const BTN_CHAIN: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--accent-light, var(--accent))",
  color: "var(--accent-light, var(--text-0))",
};

const BTN_PHASE: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  color: "var(--text-1)",
  fontWeight: 600,
  justifyContent: "center",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--text-2)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
  marginTop: 8,
};

const PROMPT: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "1rem",
  color: "var(--text-0)",
  marginBottom: 12,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BattleCommandPanel({
  decision,
  respond,
  layoutTier,
  disabled = false,
}: DecisionPanelProps<"BattleCommand">) {
  const d = decision;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : style.opacity,
    cursor: disabled ? "not-allowed" : (style.cursor ?? "pointer"),
  });

  const isCompact = layoutTier === "phone";
  const hasChains = d.chains.length > 0;
  const hasAttacks = d.attacks.length > 0;
  const hasPhaseActions = d.toMainPhase2 || d.toEndPhase;

  return (
    <div role="group" aria-label="Battle Phase — choose an action">
      <p style={PROMPT}>Battle Phase</p>

      {/* Chain activations */}
      {hasChains && (
        <div style={{ marginBottom: 8 }}>
          <p style={SECTION_LABEL} aria-hidden="true">
            Activate
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.chains.map((c, i) => {
              const name = c.name || `Card ${i}`;
              const label = c.description ? `${name} — ${c.description}` : name;
              return (
                <button
                  key={`chain:${i}`}
                  data-testid="action-option"
                  style={dis(BTN_CHAIN)}
                  disabled={disabled}
                  aria-label={`Activate chain: ${label}`}
                  onClick={() => respond({ kind: "BattleCommand", action: "chain", index: i })}
                >
                  ⚡ {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Attack declarations */}
      {hasAttacks && (
        <div style={{ marginBottom: 8 }}>
          <p style={SECTION_LABEL} aria-hidden="true">
            Attack
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.attacks.map((c, i) => {
              const name = c.name || `Monster ${i}`;
              const directLabel = c.canDirectAttack ? " (direct attack)" : "";
              return (
                <button
                  key={`attack:${i}`}
                  data-testid="action-option"
                  style={dis(BTN_ATTACK)}
                  disabled={disabled}
                  aria-label={`Attack with ${name}${directLabel}`}
                  onClick={() => respond({ kind: "BattleCommand", action: "attack", index: i })}
                >
                  ⚔ {name}
                  {c.canDirectAttack && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.75rem",
                        color: "var(--text-2)",
                      }}
                      aria-hidden="true"
                    >
                      direct
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase-advance actions */}
      {hasPhaseActions && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: hasChains || hasAttacks ? 12 : 0,
            flexDirection: isCompact ? "column" : "row",
          }}
        >
          {d.toMainPhase2 && (
            <button
              data-testid="action-option"
              style={dis({ ...BTN_PHASE, flex: 1 })}
              disabled={disabled}
              aria-label="Proceed to Main Phase 2"
              onClick={() => respond({ kind: "BattleCommand", action: "toM2", index: null })}
            >
              ↩ Main Phase 2
            </button>
          )}
          {d.toEndPhase && (
            <button
              data-testid="action-option"
              style={dis({ ...BTN_PHASE, flex: 1 })}
              disabled={disabled}
              aria-label="End Phase"
              onClick={() => respond({ kind: "BattleCommand", action: "toEP", index: null })}
            >
              ⏹ End Phase
            </button>
          )}
        </div>
      )}

      {!hasChains && !hasAttacks && !hasPhaseActions && (
        <p
          style={{ fontSize: "1rem", color: "var(--text-2)" }}
          data-testid="no-battle-actions"
          role="status"
        >
          No actions available.
        </p>
      )}
    </div>
  );
}
