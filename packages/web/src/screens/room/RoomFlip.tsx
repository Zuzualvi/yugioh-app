/**
 * RoomFlip — S7: coin flip reveal (~1.6 s).
 *
 * Shown while status === "awaiting_choice" before the winner taps a choice,
 * and also for the starting/no-seats edge case in RoomScreen's phase switch.
 *
 * The sequence is driven entirely from timers (never animationend), so the room
 * cannot get stuck under prefers-reduced-motion.
 *
 * Under prefers-reduced-motion the coin motion is suppressed but the result is
 * revealed after the same 1.1 s window via a crossfade.
 */

import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@yugioh-app/contracts";

// Timing constants (ms)
const FLIP_DURATION = 1100; // motion phase
const RESULT_HOLD = 500; // hold result before handing to choice screen
const TOTAL_DURATION = FLIP_DURATION + RESULT_HOLD; // 1600 ms

type Phase = "flipping" | "result";

interface Props {
  snapshot: RoomSnapshot;
  /** Called after the full reveal so the parent can advance to the choice step. */
  onRevealComplete?: () => void;
}

export function RoomFlip({ snapshot, onRevealComplete }: Props) {
  const flip = snapshot.flip;
  const youWon = flip?.winnerUserId === snapshot.you.userId;
  const winnerName = flip?.winnerDisplayName ?? "…";

  // Compute elapsed time since the flip was rolled so both clients sync up.
  const rolledAt = flip?.rolledAt ?? Date.now();
  const elapsed = Date.now() - rolledAt;

  // How long is left in the flip phase at mount time (capped, never negative).
  const flipRemaining = Math.max(0, FLIP_DURATION - elapsed);
  // How long until the full reveal is done.
  const totalRemaining = Math.max(0, TOTAL_DURATION - elapsed);

  // If we're already past the flip phase at mount, start directly in result.
  const [phase, setPhase] = useState<Phase>(elapsed >= FLIP_DURATION ? "result" : "flipping");

  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase === "flipping" && flipRemaining > 0) {
      flipTimerRef.current = setTimeout(() => setPhase("result"), flipRemaining);
    }

    if (totalRemaining > 0 && onRevealComplete) {
      totalTimerRef.current = setTimeout(() => {
        onRevealComplete();
      }, totalRemaining);
    } else if (totalRemaining === 0 && onRevealComplete) {
      onRevealComplete();
    }

    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      if (totalTimerRef.current) clearTimeout(totalTimerRef.current);
    };
  }, []); // intentionally empty: timers are set once on mount from stable snapshot values

  const isFlipping = phase === "flipping";

  // Coin visual
  const coinStyle: React.CSSProperties = {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.5rem",
    margin: "0 auto",
    transition: `background var(--duration-med, 220ms), border-color var(--duration-med, 220ms)`,
    ...(isFlipping
      ? {
          background: "var(--bg-2)",
          border: "2px solid var(--accent)",
          animation: "spin 0.4s linear infinite",
        }
      : youWon
        ? {
            background: "var(--accent-dim)",
            border: "2px solid var(--accent)",
          }
        : {
            background: "var(--bg-2)",
            border: "2px solid var(--border)",
          }),
  };

  return (
    <section
      aria-label="Coin flip"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "32px 24px",
        textAlign: "center",
      }}
    >
      {/* Player rows stay at top so nobody loses their bearings */}
      {snapshot.opponent && (
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            color: "var(--text-1)",
            fontSize: "0.875rem",
            marginBottom: 8,
          }}
        >
          <span>✓ You READY</span>
          <span>·</span>
          <span>✓ {snapshot.opponent.displayName} READY</span>
        </div>
      )}

      {/* Coin */}
      <div style={coinStyle} aria-hidden="true">
        {isFlipping ? "◐" : youWon ? "✓" : "●"}
      </div>

      {/* Status text */}
      {isFlipping ? (
        <>
          <p style={{ fontSize: "1rem", color: "var(--text-1)" }} role="status">
            Flipping a coin…
          </p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
            The winner chooses who goes first.
          </p>
        </>
      ) : youWon ? (
        <>
          <p
            style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-light)" }}
            role="status"
          >
            You won the flip
          </p>
          <p style={{ color: "var(--text-1)" }}>You choose who goes first.</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-0)" }} role="status">
            {winnerName} won the flip
          </p>
          <p style={{ color: "var(--text-1)" }}>{winnerName} chooses who goes first.</p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
            You&apos;ll take whichever seat they don&apos;t.
          </p>
        </>
      )}
    </section>
  );
}
