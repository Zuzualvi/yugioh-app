/** PresenceIndicator — opponent connection state dot + label. */
import React from "react";

interface Props {
  name: string;
  connection: "open" | "reconnecting" | "closed";
}

export function PresenceIndicator({ name, connection }: Props) {
  const dotColor =
    connection === "open"
      ? "var(--valid)"
      : connection === "reconnecting"
        ? "var(--warning)"
        : "var(--text-2)";
  const label =
    connection === "open"
      ? name
      : connection === "reconnecting"
        ? `${name} — reconnecting`
        : `${name} — connection lost`;
  const dot = connection === "open" ? "●" : connection === "reconnecting" ? "◌" : "○";

  return (
    <span
      data-testid="presence-indicator"
      title={label}
      aria-label={`Opponent: ${label}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: "0.875rem",
        color: "var(--text-1)",
      }}
    >
      <span aria-hidden="true" style={{ color: dotColor }}>
        {dot}
      </span>
      <span>{label}</span>
    </span>
  );
}
