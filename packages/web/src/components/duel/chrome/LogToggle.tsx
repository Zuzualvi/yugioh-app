/** LogToggle — ☰ Log button with keyboard shortcut L. */
import React from "react";

interface Props {
  open: boolean;
  onToggle: () => void;
}

export function LogToggle({ open, onToggle }: Props) {
  return (
    <button
      data-testid="log-toggle"
      aria-label={open ? "Close log (L)" : "Open log (L)"}
      aria-expanded={open}
      onClick={onToggle}
      style={{
        padding: "4px 10px",
        background: open ? "var(--accent-dim)" : "var(--bg-2)",
        border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 4,
        color: open ? "var(--accent-light)" : "var(--text-1)",
        fontSize: "0.8125rem",
        cursor: "pointer",
        minHeight: 32,
      }}
    >
      ☰ Log <kbd style={{ fontSize: "0.6875rem", opacity: 0.6 }}>L</kbd>
    </button>
  );
}
