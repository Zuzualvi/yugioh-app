/**
 * DuelEndOverlay (§13 / D5 D6) — centred card over the frozen, inspectable board.
 *
 * Result: "You win" / "You lose" / "Draw"
 * Reason: maps DuelEndReason to a player-readable sentence.
 * Final LP for both seats.
 *
 * Three actions:
 *   - Review board (dismiss overlay, board + log remain readable)
 *   - Open log
 *   - Back to Home
 *
 * Dismissed state: a persistent "Duel ended" pill top-centre with "Result" to reopen.
 */

import React, { useState } from "react";
import type { Seat } from "@yugioh-app/contracts";
import type { DuelEndReason } from "@yugioh-app/contracts";

interface Props {
  winner: Seat | null;
  reason: DuelEndReason | string;
  mySeat: Seat;
  finalLp: [number, number];
  playerNames: [string, string];
  onHome: () => void;
  onOpenLog: () => void;
}

function reasonText(
  reason: DuelEndReason | string,
  iWon: boolean,
  isDraw: boolean,
  opponentName: string,
): string {
  if (reason === "timeout") {
    return iWon
      ? `${opponentName}'s move timer ran out.`
      : "Your move timer ran out — the duel is forfeit.";
  }
  if (reason === "resign") {
    return iWon ? `${opponentName} resigned.` : "You resigned.";
  }
  if (reason === "normal") {
    return iWon ? `${opponentName}'s LP reached 0.` : "Your LP reached 0.";
  }
  // Unknown reason — verbatim per spec.
  return `The duel ended. (${String(reason)})`;
}

export function DuelEndOverlay({
  winner,
  reason,
  mySeat,
  finalLp,
  playerNames,
  onHome,
  onOpenLog,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const isDraw = winner === null;
  const iWon = winner === mySeat;
  const opponentName = playerNames[mySeat === 0 ? 1 : 0];

  const resultText = isDraw ? "Draw" : iWon ? "You win" : "You lose";
  const emoji = isDraw ? "🤝" : iWon ? "🏆" : "💀";

  const validReason =
    reason === "normal" || reason === "timeout" || reason === "resign"
      ? (reason as DuelEndReason)
      : reason;
  const reasonStr = reasonText(validReason, iWon, isDraw, opponentName);

  if (dismissed && !showResult) {
    return (
      <div
        style={{
          position: "fixed",
          top: 48,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 9999,
          padding: "4px 12px",
          fontSize: "0.8rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <span style={{ color: "var(--text-1)" }}>Duel ended</span>
        <button
          onClick={() => {
            setDismissed(false);
            setShowResult(true);
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent,#4a90d9)",
            cursor: "pointer",
            fontSize: "0.8rem",
            padding: 0,
          }}
        >
          Result
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 90,
      }}
      data-testid="duel-end-overlay"
    >
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 40,
          textAlign: "center",
          maxWidth: 400,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>{emoji}</div>
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: "0 0 8px",
            color: isDraw ? "var(--text-0)" : iWon ? "#4a90d9" : "var(--opp,#d94a4a)",
          }}
        >
          {resultText}
        </h2>
        <p
          style={{
            color: "var(--text-1)",
            fontSize: "1rem",
            margin: "0 0 12px",
          }}
          data-testid="duel-end-reason"
        >
          {reasonStr}
        </p>

        {/* Final LP */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginBottom: 28,
            fontSize: "0.875rem",
            color: "var(--text-2)",
          }}
        >
          <span>
            <strong style={{ color: "var(--own,#4a90d9)" }}>{playerNames[mySeat]}</strong>{" "}
            {finalLp[mySeat].toLocaleString()} LP
          </span>
          <span>
            <strong style={{ color: "var(--opp,#d94a4a)" }}>{opponentName}</strong>{" "}
            {finalLp[mySeat === 0 ? 1 : 0].toLocaleString()} LP
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn"
            onClick={() => {
              setDismissed(true);
              setShowResult(false);
            }}
            style={{ minHeight: 44, padding: "10px 20px", fontSize: "0.95rem" }}
          >
            Review board
          </button>
          <button
            className="btn"
            onClick={() => {
              onOpenLog();
              setDismissed(true);
              setShowResult(false);
            }}
            style={{ minHeight: 44, padding: "10px 20px", fontSize: "0.95rem" }}
          >
            Open log
          </button>
          <button
            className="btn btn-primary"
            onClick={onHome}
            style={{ minHeight: 44, padding: "10px 20px", fontSize: "0.95rem" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
