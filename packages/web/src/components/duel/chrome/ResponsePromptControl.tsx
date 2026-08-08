/**
 * ResponsePromptControl — labelled menu for response-prompt level.
 *
 * Design spec §11b. Replaces the three-state VerbosityChip cycler.
 *
 * Closed state: "Response prompts: <value> ▾"
 * Open state: all three options with one-line descriptions + the standing note.
 * Disabled when the duel has ended.
 */
import React, { useCallback, useState } from "react";
import type { PromptLevel } from "../../../duel/responsePrompts";

interface Props {
  value: PromptLevel;
  onChange: (v: PromptLevel) => void;
  disabled?: boolean;
}

const OPTIONS: { value: PromptLevel; description: string }[] = [
  { value: "Minimal", description: "Only mandatory effects and certain triggers." },
  { value: "Standard", description: "Also on summons, attacks and activations." },
  { value: "Every window", description: "Also every phase change and battle step." },
];

const STANDING_NOTE =
  "Mandatory effects are always offered, whatever this is set to — this cannot make you miss a forced response.";

export function ResponsePromptControl({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (v: PromptLevel) => {
      onChange(v);
      setOpen(false);
    },
    [onChange],
  );

  const handleToggle = useCallback(() => {
    if (!disabled) setOpen((v) => !v);
  }, [disabled]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }, []);

  return (
    <div style={{ position: "relative" }} onBlur={handleBlur}>
      <button
        data-testid="response-prompt-control"
        aria-label={`Response prompts: ${value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          padding: "4px 10px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: disabled ? "var(--text-2)" : "var(--text-1)",
          fontSize: "0.8125rem",
          cursor: disabled ? "default" : "pointer",
          minHeight: 32,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Response prompts: {value} ▾
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
            minWidth: 300,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                background: value === opt.value ? "var(--accent-dim)" : "transparent",
                border: "none",
                borderRadius: 4,
                color: value === opt.value ? "var(--accent-light)" : "var(--text-1)",
                textAlign: "left",
                fontSize: "0.875rem",
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              <span style={{ fontWeight: 600 }}>{opt.value}</span>
              {value === opt.value ? " ✓" : ""}
              <br />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
                {opt.description}
              </span>
            </button>
          ))}

          <p
            data-testid="response-prompt-standing-note"
            style={{
              fontSize: "0.75rem",
              color: "var(--text-2)",
              margin: "8px 12px 4px",
              borderTop: "1px solid var(--border)",
              paddingTop: 8,
              lineHeight: 1.4,
            }}
          >
            {STANDING_NOTE}
          </p>
        </div>
      )}
    </div>
  );
}
