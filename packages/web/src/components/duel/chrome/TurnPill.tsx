/** TurnPill — "TURN N · YOURS / THEIRS" in the top bar. */
import React from "react";
import type { Seat } from "@yugioh-app/contracts";

interface Props {
  turnNumber: number | null;
  currentTurn: Seat;
  mySeat: Seat;
}

export function TurnPill({ turnNumber, currentTurn, mySeat }: Props) {
  const isMyTurn = currentTurn === mySeat;
  const owner = isMyTurn ? "YOURS" : "THEIRS";
  const label = turnNumber != null ? `TURN ${turnNumber} · ${owner}` : owner;

  return (
    <span
      data-testid="turn-pill"
      aria-label={label}
      style={{
        fontWeight: 700,
        fontSize: "0.9375rem",
        color: isMyTurn ? "var(--own)" : "var(--opp)",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}
