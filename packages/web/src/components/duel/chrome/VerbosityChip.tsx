/**
 * VerbosityChip — response-prompt level, state legible as text.
 * Three levels: Minimal | Standard | Every window.
 */
import React, { useState } from "react";

export type VerbosityLevel = "minimal" | "standard" | "every";

interface Props {
  value: VerbosityLevel;
  onChange: (v: VerbosityLevel) => void;
}

const LABELS: Record<VerbosityLevel, string> = {
  minimal: "Minimal",
  standard: "Standard",
  every: "Every window",
};

export function VerbosityChip({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        data-testid="verbosity-chip"
        aria-label={`Response prompts: ${LABELS[value]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "4px 10px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--text-1)",
          fontSize: "0.8125rem",
          cursor: "pointer",
          minHeight: 32,
        }}
      >
        Chain: {LABELS[value]} ▾
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Response prompts"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
            zIndex: 50,
            minWidth: 240,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {(["minimal", "standard", "every"] as VerbosityLevel[]).map((level) => (
            <button
              key={level}
              role="option"
              aria-selected={value === level}
              onClick={() => {
                onChange(level);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                background: value === level ? "var(--accent-dim)" : "transparent",
                border: "none",
                borderRadius: 4,
                color: value === level ? "var(--accent-light)" : "var(--text-1)",
                textAlign: "left",
                fontSize: "0.875rem",
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              {LABELS[level]} {value === level ? "✓" : ""}
            </button>
          ))}
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-2)",
              margin: "8px 12px 4px",
              borderTop: "1px solid var(--border)",
              paddingTop: 8,
            }}
          >
            Mandatory effects are always offered, whatever this is set to.
          </p>
        </div>
      )}
    </div>
  );
}
