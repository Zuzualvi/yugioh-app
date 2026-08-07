/**
 * IntentRibbon — makes 2-6 engine decisions read as one player action.
 *
 * Persists across sub-decisions including the STATE-then-DECISION gap.
 * Draws the point of no return (🔒).
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §5.
 */

import React from "react";
import type { PendingIntent } from "../../../duel/contracts";

interface Props {
  intent: PendingIntent;
  onCancel: () => void;
  disabled?: boolean;
}

export function IntentRibbon({ intent, onCancel, disabled = false }: Props) {
  const { steps, currentStep, commitStep, stepCountUncertain, label } = intent;
  const isPastCommit = commitStep >= 0 && currentStep >= commitStep;
  const isPreCommit = commitStep >= 0 && currentStep < commitStep;

  return (
    <div
      data-testid="intent-ribbon"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "6px 12px",
        background: "var(--bg-1)",
        borderTop: "1px solid var(--border)",
        fontSize: "0.875rem",
      }}
    >
      {/* Label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-0)" }}>⚔ {label}</span>
        {isPastCommit ? (
          <span
            data-testid="ribbon-committed"
            style={{ color: "var(--text-2)", fontSize: "0.8rem" }}
          >
            Committed
          </span>
        ) : (
          <button
            data-testid="ribbon-cancel"
            onClick={onCancel}
            disabled={disabled}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 10px",
              cursor: disabled ? "not-allowed" : "pointer",
              color: "var(--text-1)",
              fontSize: "0.8rem",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Step dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflowX: "auto",
        }}
      >
        {steps.map((step, i) => {
          const isCurrent = i === currentStep;
          const isDone = step.answered !== undefined;
          const isCommitPoint = commitStep >= 0 && i === commitStep;

          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: isDone ? "var(--accent)" : "var(--border)",
                    minWidth: 16,
                  }}
                />
              )}
              {isCommitPoint && (
                <span
                  data-testid="ribbon-lock"
                  title="Point of no return"
                  style={{ fontSize: "0.75rem", color: "var(--text-2)", flexShrink: 0 }}
                >
                  🔒
                </span>
              )}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isDone
                    ? "var(--accent)"
                    : isCurrent
                      ? "var(--accent-light)"
                      : "var(--border)",
                  border: isCurrent ? "2px solid var(--accent)" : "none",
                  flexShrink: 0,
                  animation: isCurrent ? "pulse 1s ease-in-out infinite" : undefined,
                }}
              />
            </React.Fragment>
          );
        })}
        {stepCountUncertain && (
          <>
            <div style={{ flex: 1, height: 2, background: "var(--border)", minWidth: 16 }} />
            <span style={{ color: "var(--text-2)", fontSize: "0.75rem" }}>…</span>
          </>
        )}
      </div>

      {/* Step labels */}
      <div style={{ display: "flex", gap: 4, fontSize: "0.75rem", color: "var(--text-2)" }}>
        {steps.map((step, i) => (
          <span
            key={i}
            style={{
              fontWeight: i === currentStep ? 600 : 400,
              color: i === currentStep ? "var(--text-0)" : "var(--text-2)",
            }}
          >
            {step.label}
            {i < steps.length - 1 ? " →" : ""}
          </span>
        ))}
      </div>

      {/* Commit caption [M1] — always visible when at or past commit */}
      {isPastCommit && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-2)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>🔒</span>
          <span>Past this point you cannot cancel</span>
        </div>
      )}

      {/* Step budget [M13] */}
      {steps.length > 1 && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
          {steps.length} step{steps.length !== 1 ? "s" : ""} ·{" "}
          {Math.max(0, steps.length - currentStep - 1)} left
          {stepCountUncertain ? ", possibly more if a trigger fires" : ""}
        </div>
      )}

      {isPreCommit && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontStyle: "italic" }}>
          Next step commits — cannot be undone
        </div>
      )}
    </div>
  );
}
