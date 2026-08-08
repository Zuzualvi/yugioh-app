/**
 * ResponsePromptControl — labelled menu, not a cycler.
 *
 * Three states: Minimal, Standard (default), Every window.
 * A standing note assures mandatory effects are always offered.
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §11b.
 */

import React, { useRef, useState } from "react";

export type PromptLevel = "minimal" | "standard" | "every-window";

interface Props {
  value: PromptLevel;
  onChange: (v: PromptLevel) => void;
}

const LEVELS: Array<{ value: PromptLevel; label: string; desc: string }> = [
  {
    value: "minimal",
    label: "Minimal",
    desc: "Only mandatory effects and certain triggers.",
  },
  {
    value: "standard",
    label: "Standard",
    desc: "Also on summons, attacks and activations.",
  },
  {
    value: "every-window",
    label: "Every window",
    desc: "Also every phase change and battle step.",
  },
];

export function ResponsePromptControl({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const current = LEVELS.find((l) => l.value === value) ?? LEVELS[1]!;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        data-testid="response-prompt-control"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "4px 10px",
          border: "1px solid var(--border)",
          borderRadius: 4,
          background: "var(--bg-1)",
          color: "var(--text-1)",
          cursor: "pointer",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        Response prompts: <strong>{current.label}</strong> ▾
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Response prompt level"
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
            minWidth: 280,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {LEVELS.map((level) => (
            <button
              key={level.value}
              role="option"
              aria-selected={value === level.value}
              onClick={() => {
                onChange(level.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: value === level.value ? "var(--accent-dim)" : "transparent",
                color: "var(--text-0)",
                cursor: "pointer",
                borderRadius: 4,
                textAlign: "left",
              }}
            >
              <span style={{ width: 16, flexShrink: 0 }}>{value === level.value ? "✓" : ""}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{level.label}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>{level.desc}</div>
              </div>
            </button>
          ))}

          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              fontSize: "0.8rem",
              color: "var(--text-2)",
              padding: "8px 10px",
            }}
          >
            Mandatory effects are always offered, whatever this is set to — this cannot make you
            miss a forced response.
          </div>
        </div>
      )}
    </div>
  );
}
