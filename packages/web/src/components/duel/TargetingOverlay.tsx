/**
 * TargetingOverlay — in-field selection mode for SelectCard, SelectZone,
 * SelectTribute, SelectSum and related decisions (§8, mobile spec §2.10).
 *
 * Renders a sticky mini-prompt banner with a running selection count, Confirm
 * and Cancel controls. Callers supply the list of valid targets and handle
 * which zones/cards pulse (CSS class `targeting-pulse` is applied externally
 * when this overlay is active).
 *
 * Shared component for panel engineers (2B/2C/2D).
 */

import React from "react";

interface Props {
  /** Prompt text, e.g. "Select 1 monster to target" */
  prompt: string;
  /** Current number of selected items */
  selected: number;
  /** Total items required */
  required: number;
  /** Minimum needed to confirm */
  min?: number;
  /** Whether the overlay is active (visible) */
  active: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TargetingOverlay({
  prompt,
  selected,
  required,
  min = 1,
  active,
  onConfirm,
  onCancel,
}: Props) {
  if (!active) return null;

  const canConfirm = selected >= min;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${prompt} — ${selected} of ${required} selected`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--bg-2)",
        border: "1px solid var(--accent)",
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        fontSize: "1rem",
      }}
    >
      <span style={{ flex: 1, fontWeight: 600, color: "var(--text-0)" }}>{prompt}</span>
      <span style={{ color: "var(--accent-light)", fontWeight: 700 }}>
        {selected} / {required}
      </span>
      <button
        onClick={onConfirm}
        disabled={!canConfirm}
        style={{
          minHeight: 44,
          minWidth: 80,
          padding: "8px 14px",
          background: canConfirm ? "var(--accent)" : "var(--bg-3)",
          border: "none",
          borderRadius: 6,
          color: canConfirm ? "#fff" : "var(--text-2)",
          fontWeight: 600,
          cursor: canConfirm ? "pointer" : "not-allowed",
          fontSize: "1rem",
        }}
        aria-disabled={!canConfirm}
      >
        Confirm ✓
      </button>
      <button
        onClick={onCancel}
        style={{
          minHeight: 44,
          minWidth: 80,
          padding: "8px 14px",
          background: "transparent",
          border: "1px solid var(--invalid)",
          borderRadius: 6,
          color: "var(--invalid)",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        ✕ Cancel
      </button>
    </div>
  );
}
