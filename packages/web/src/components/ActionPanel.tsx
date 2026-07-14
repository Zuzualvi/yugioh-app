/**
 * ActionPanel — renders clickable legal actions + priority windows from
 * redacted decision messages and sends the chosen EngineResponse.
 * Also provides the RESIGN control.
 */

import type { DuelClientMessage, EngineResponse, RedactedEngineMessage } from "@yugioh-app/contracts";
import { decisionPrompt, extractOptions } from "../api/decisionOptions";

interface Props {
  /** The current decision message for this seat, or null if no pending decision */
  decision: RedactedEngineMessage | null;
  onSend: (msg: DuelClientMessage) => void;
  disabled?: boolean;
}

export function ActionPanel({ decision, onSend, disabled = false }: Props) {
  function handleOption(value: number | string | null) {
    const response: EngineResponse = { type: 1, value: value ?? undefined };
    onSend({ type: "RESPONSE", response });
  }

  function handleResign() {
    if (!confirm("Resign this duel?")) return;
    onSend({ type: "RESIGN" });
  }

  const options = decision ? extractOptions(decision) : [];
  const prompt = decision ? decisionPrompt(decision) : null;
  const isPriorityWindow =
    decision?.name === "SELECT_CHAIN" && options.some((o) => o.isPass);

  return (
    <div
      data-testid="action-panel"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {decision ? (
        <>
          {isPriorityWindow && (
            <div
              style={{
                background: "rgba(123,94,167,0.18)",
                border: "1px solid var(--accent)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: "0.8125rem",
                color: "var(--accent-light)",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
              data-testid="priority-window"
            >
              ⚡ Priority window — do you wish to respond?
            </div>
          )}

          <p
            style={{
              fontWeight: 600,
              color: "var(--text-0)",
              fontSize: "0.9375rem",
            }}
          >
            {prompt}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => (
              <button
                key={i}
                data-testid={opt.isPass ? "pass-option" : "action-option"}
                onClick={() => handleOption(opt.value)}
                disabled={disabled}
                style={{
                  padding: "10px 16px",
                  minHeight: 44,
                  background: opt.isPass ? "var(--bg-2)" : "var(--accent-dim)",
                  border: `1px solid ${opt.isPass ? "var(--border)" : "var(--accent)"}`,
                  borderRadius: 6,
                  color: opt.isPass ? "var(--text-1)" : "var(--text-0)",
                  cursor: disabled ? "default" : "pointer",
                  textAlign: "left",
                  fontWeight: opt.isPass ? 400 : 500,
                  opacity: disabled ? 0.6 : 1,
                  fontSize: "0.9375rem",
                }}
              >
                {opt.isPass ? "⬜" : "▶"} {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p
          style={{
            color: "var(--text-2)",
            fontSize: "0.875rem",
            fontStyle: "italic",
          }}
          data-testid="no-decision"
        >
          Waiting for engine…
        </p>
      )}

      {/* Resign control — always visible */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          data-testid="resign-btn"
          onClick={handleResign}
          disabled={disabled}
          style={{
            padding: "6px 16px",
            minHeight: 36,
            background: "transparent",
            border: "1px solid var(--invalid)",
            borderRadius: 6,
            color: "var(--invalid)",
            cursor: disabled ? "default" : "pointer",
            fontSize: "0.8125rem",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          ⚑ Resign
        </button>
      </div>
    </div>
  );
}
