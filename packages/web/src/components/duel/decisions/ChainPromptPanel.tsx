/**
 * ChainPromptPanel — bespoke panel for ChainPrompt decisions (§7 priority/chain window).
 *
 * Mobile (phone/tablet): Shows a compact [Respond ▸] / [Pass] two-button header.
 *   Tapping [Respond ▸] expands the full list of activatable options (selects).
 *   [Pass] is omitted when forced === true (player must respond).
 *
 * Desktop: Shows the full selects list directly plus [Pass] at bottom (if !forced).
 *
 * Emits DuelDecisionResponse kind "ChainPrompt" {index: number | null} (null = pass).
 *
 * a11y: ≥44px targets, ≥16px text, keyboard nav, aria-live count, aria attributes.
 */

import React, { useState } from "react";
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

const BTN_PASS: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  color: "var(--text-1)",
  fontWeight: 400,
  justifyContent: "center",
};

const BTN_RESPOND: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 700,
  justifyContent: "center",
  flex: 1,
};

const PROMPT: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "1rem",
  color: "var(--accent-light, var(--text-0))",
  marginBottom: 8,
};

const OPTION_COUNT: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--text-2)",
  marginBottom: 8,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChainPromptPanel({
  decision,
  respond,
  layoutTier,
  disabled = false,
}: DecisionPanelProps<"ChainPrompt">) {
  const d = decision;
  const isMobile = layoutTier === "phone" || layoutTier === "tablet";

  // Mobile: start collapsed; desktop: always expanded
  const [expanded, setExpanded] = useState(!isMobile);

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : style.opacity,
    cursor: disabled ? "not-allowed" : (style.cursor ?? "pointer"),
  });

  const canPass = !d.forced;
  const hasSelects = d.selects.length > 0;

  // ── Desktop / expanded: show selects list directly ────────────────────────
  if (!isMobile || expanded) {
    return (
      <div role="group" aria-label="Priority window — respond or pass">
        <p style={PROMPT}>⚡ Priority window</p>

        {hasSelects && (
          <>
            <p style={OPTION_COUNT} aria-live="polite">
              {d.selects.length} option{d.selects.length !== 1 ? "s" : ""} available
            </p>
            <div
              role="list"
              style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}
            >
              {d.selects.map((c, i) => {
                const name = c.name || `Card ${i}`;
                const label = c.description ? `${name} — ${c.description}` : name;
                return (
                  <button
                    key={i}
                    role="listitem"
                    data-testid="action-option"
                    style={dis(BTN_BASE)}
                    disabled={disabled}
                    aria-label={`Activate: ${label}`}
                    onClick={() => respond({ kind: "ChainPrompt", index: i })}
                  >
                    ⚡ {label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!hasSelects && !d.forced && (
          <p style={OPTION_COUNT}>No activatable effects. Pass to continue.</p>
        )}

        <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
          {isMobile && hasSelects && (
            <button
              style={dis({
                ...BTN_PASS,
                flex: 1,
                border: "1px solid var(--border)",
              })}
              disabled={disabled}
              aria-label="Collapse options"
              onClick={() => setExpanded(false)}
            >
              ← Back
            </button>
          )}
          {canPass && (
            <button
              data-testid="pass-option"
              style={dis({ ...BTN_PASS, flex: 1 })}
              disabled={disabled}
              aria-label="Pass — no response"
              onClick={() => respond({ kind: "ChainPrompt", index: null })}
            >
              ⬜ Pass
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Mobile: compact [Respond ▸] / [Pass] view ─────────────────────────────
  return (
    <div role="group" aria-label="Priority window — respond or pass">
      <p style={PROMPT}>⚡ Priority window</p>
      {hasSelects && (
        <p style={OPTION_COUNT} aria-live="polite">
          {d.selects.length} option{d.selects.length !== 1 ? "s" : ""} available
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {hasSelects && (
          <button
            data-testid="action-option"
            style={dis(BTN_RESPOND)}
            disabled={disabled}
            aria-label="Respond — view activatable options"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
          >
            Respond ▸
          </button>
        )}
        {canPass && (
          <button
            data-testid="pass-option"
            style={dis({
              ...BTN_PASS,
              flex: 1,
              minHeight: 44,
            })}
            disabled={disabled}
            aria-label="Pass — no response"
            onClick={() => respond({ kind: "ChainPrompt", index: null })}
          >
            ⬜ Pass
          </button>
        )}
        {/* Forced + no selects — edge case, render a disabled prompt */}
        {d.forced && !hasSelects && (
          <p
            style={{ fontSize: "1rem", color: "var(--text-2)", flex: 1 }}
            role="status"
            aria-live="polite"
          >
            Response required…
          </p>
        )}
      </div>
    </div>
  );
}
