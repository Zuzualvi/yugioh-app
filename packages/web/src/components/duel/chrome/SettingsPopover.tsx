/**
 * SettingsPopover — ⚙ button + popover with duel settings.
 * Four toggles: Choose zones, Self chain, Activation order, Reduce motion.
 * Plus Resign (two-step confirm, never a bare board button).
 */
import React, { useState } from "react";

export interface DuelSettings {
  chooseZones: boolean;
  selfChain: boolean;
  activationOrder: boolean;
  reduceMotion: boolean;
}

interface Props {
  settings: DuelSettings;
  onSettingsChange: (s: DuelSettings) => void;
  onResign: () => void;
  disabled?: boolean;
}

export function SettingsPopover({ settings, onSettingsChange, onResign, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);

  function toggle(key: keyof DuelSettings) {
    onSettingsChange({ ...settings, [key]: !settings[key] });
  }

  function handleResign() {
    if (!resignConfirm) {
      setResignConfirm(true);
      return;
    }
    setResignConfirm(false);
    setOpen(false);
    onResign();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        data-testid="settings-btn"
        aria-label="Settings"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setResignConfirm(false);
        }}
        style={{
          padding: "4px 8px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--text-1)",
          fontSize: "1rem",
          cursor: "pointer",
          minHeight: 32,
          minWidth: 32,
        }}
      >
        ⚙
      </button>
      {open && (
        <div
          data-testid="settings-popover"
          role="dialog"
          aria-label="Duel Settings"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            zIndex: 50,
            minWidth: 260,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {(
            [
              { key: "chooseZones", label: "Choose zones" },
              { key: "selfChain", label: "Self chain" },
              { key: "activationOrder", label: "Activation order" },
              { key: "reduceMotion", label: "Reduce motion" },
            ] as { key: keyof DuelSettings; label: string }[]
          ).map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                color: "var(--text-1)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={() => toggle(key)}
                style={{ width: 16, height: 16 }}
              />
              {label}
            </label>
          ))}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            {resignConfirm ? (
              <div>
                <p style={{ color: "var(--warning)", fontSize: "0.875rem", marginBottom: 8 }}>
                  Confirm resign? This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    data-testid="resign-cancel"
                    onClick={() => setResignConfirm(false)}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      color: "var(--text-1)",
                      cursor: "pointer",
                      minHeight: 36,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="resign-confirm"
                    onClick={handleResign}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      color: "var(--invalid)",
                      cursor: "pointer",
                      minHeight: 36,
                    }}
                  >
                    Resign
                  </button>
                </div>
              </div>
            ) : (
              <button
                data-testid="resign-btn"
                onClick={handleResign}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--invalid)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                Resign
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
