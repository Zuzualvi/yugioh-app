/**
 * DuelTimer — live countdown for the on-clock seat.
 * deadlineAt is server-authoritative epoch-ms.  Client only renders; drift is cosmetic.
 */

import { useEffect, useState } from "react";
import type { Seat } from "@yugioh-app/contracts";

interface Props {
  onClockSeat: Seat;
  deadlineAt: number;
  mySeat: Seat;
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "0s";
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function DuelTimer({ onClockSeat, deadlineAt, mySeat }: Props) {
  const [msLeft, setMsLeft] = useState(() => deadlineAt - Date.now());

  useEffect(() => {
    setMsLeft(deadlineAt - Date.now());
    const interval = setInterval(() => {
      setMsLeft(deadlineAt - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  const isMyTurn = onClockSeat === mySeat;
  const isUrgent = msLeft > 0 && msLeft < 60_000; // under 1 minute
  const label = isMyTurn ? "Your clock" : "Opponent's clock";

  return (
    <div
      data-testid="duel-timer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px",
        background: isUrgent ? "rgba(224,82,82,0.15)" : "var(--bg-2)",
        border: `1px solid ${isUrgent ? "var(--invalid)" : "var(--border)"}`,
        borderRadius: 6,
        fontSize: "0.875rem",
      }}
    >
      <span aria-hidden="true" style={{ color: isUrgent ? "var(--invalid)" : "var(--text-1)" }}>
        ⏱
      </span>
      <span
        style={{
          color: isUrgent ? "var(--invalid)" : isMyTurn ? "var(--accent-light)" : "var(--text-1)",
          fontWeight: isMyTurn ? 700 : 400,
        }}
        aria-label={`${label}: ${formatCountdown(msLeft)}`}
      >
        {label}: {msLeft <= 0 ? "Time up!" : formatCountdown(msLeft)}
      </span>
    </div>
  );
}
