/**
 * WaitBanner (§12 / F8) — waiting-on-opponent surface.
 *
 * Three distinct states that must not render identically:
 *   1. opponent-thinking: phase rail tinted, "Sakura is deciding" on ribbon
 *   2. engine-busy: 3px indeterminate hairline ≤ 400ms, then "Engine is resolving…"
 *   3. disconnected: amber banner "Reconnecting… attempt N"
 *
 * This component covers states 1 and 3 (the visible banner states).
 * State 2 is rendered inline on the phase rail by W1.
 */

import React from "react";

export type WaitState =
  { kind: "opponent-thinking"; opponentName: string } | { kind: "reconnecting"; attempt: number };

interface Props {
  state: WaitState | null;
}

export function WaitBanner({ state }: Props) {
  if (!state) return null;

  if (state.kind === "reconnecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 40, // below top bar
          left: 0,
          right: 0,
          padding: "8px 20px",
          background: "rgba(200,144,42,0.15)",
          borderBottom: "1px solid #c8902a",
          color: "#c8902a",
          fontSize: "0.875rem",
          fontWeight: 500,
          zIndex: 50,
          textAlign: "center",
        }}
      >
        Reconnecting… attempt {state.attempt}
      </div>
    );
  }

  if (state.kind === "opponent-thinking") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "4px 12px",
          fontSize: "0.75rem",
          color: "var(--opp,#d94a4a)",
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        {state.opponentName} is deciding…
      </div>
    );
  }

  return null;
}
