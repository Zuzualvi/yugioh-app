/**
 * S1 — Create challenge screen.
 * Deck picker removed; timer presets 3/5/10/15 min; default 10; no custom field.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../api/room";

const PRESETS = [
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
];

const DEFAULT_SECONDS = 600;

export function CreateDuelScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(DEFAULT_SECONDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPreset = PRESETS.find((p) => p.seconds === selected);
  const selectedMinutes = selectedPreset ? selectedPreset.label.replace(" min", "") : "";

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const result = await createRoom({ timer: { perMoveSeconds: selected } });
      navigate(`/duel/${result.roomId}/room`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong — please try again";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 0",
            borderBottom: "1px solid var(--border)",
            marginBottom: 24,
          }}
        >
          <button
            className="btn btn-ghost"
            style={{ padding: "8px 12px", minHeight: "var(--min-touch)" }}
            onClick={() => navigate("/")}
            aria-label="Go home"
          >
            ← Home
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>⚔ Challenge a friend</h1>
        </div>

        {/* Timer section */}
        <section aria-labelledby="timer-heading">
          <h2 id="timer-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
            Time per move
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: 16 }}>
            Both players get this long for every move.
          </p>

          <div
            role="radiogroup"
            aria-labelledby="timer-heading"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
          >
            {PRESETS.map((preset) => {
              const isSelected = preset.seconds === selected;
              return (
                <button
                  key={preset.seconds}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelected(preset.seconds)}
                  style={{
                    minHeight: "var(--min-touch)",
                    minWidth: 72,
                    padding: "0 16px",
                    border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8,
                    background: isSelected ? "var(--accent-dim)" : "var(--bg-1)",
                    color: isSelected ? "var(--accent-light)" : "var(--text-1)",
                    fontWeight: isSelected ? 700 : 400,
                    cursor: "pointer",
                    fontSize: "0.9375rem",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <p
            style={{
              color: "var(--accent-light)",
              fontSize: "0.875rem",
              marginBottom: 16,
            }}
            aria-live="polite"
          >
            ⏱ Each player gets {selectedMinutes} min to make each move.
          </p>

          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: 24 }}>
            You&rsquo;ll pick your deck in the room, once your opponent is there.
          </p>
        </section>

        {error && (
          <p className="form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: "100%", minHeight: "var(--min-touch)" }}
          onClick={handleCreate}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner" aria-hidden="true" />
              <span>Creating…</span>
            </>
          ) : (
            "Create challenge link ▸"
          )}
        </button>
      </div>
    </main>
  );
}
