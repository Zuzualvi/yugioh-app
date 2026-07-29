/**
 * RoomChoice — S7 (flip reveal) → S8 (winner chooses) / S9 (loser waits).
 *
 * Shown when status === "awaiting_choice" with a flip result and no choice yet.
 *
 * Phase sequence (timer-driven, never animationend):
 *   Phase "flip"   (0 → 1.1 s from rolledAt): coin reveal animation
 *   Phase "choice" (after 1.1 s):               S8 buttons / S9 wait screen
 *
 * Under prefers-reduced-motion the coin animation is suppressed (global CSS
 * zeroes animation durations) but the phase transition still fires from a
 * timer after the same 1.1 s window.
 */

import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import { submitChoice } from "../../api/room";
import { RoomFlip } from "./RoomFlip";

interface Props {
  snapshot: RoomSnapshot;
}

type Phase = "flip" | "choice";

export function RoomChoice({ snapshot }: Props) {
  const flip = snapshot.flip;
  const isWinner = flip?.winnerUserId === snapshot.you.userId;
  const winnerName = flip?.winnerDisplayName ?? "…";
  const opponentName = snapshot.opponent?.displayName ?? "Your opponent";
  const roomId = snapshot.roomId;

  // Start in flip phase unless the reveal window has already passed
  const FLIP_DURATION = 1100;
  const rolledAt = flip?.rolledAt ?? Date.now();
  const elapsed = Date.now() - rolledAt;
  const [phase, setPhase] = useState<Phase>(elapsed >= FLIP_DURATION ? "choice" : "flip");

  const [submitting, setSubmitting] = useState(false);
  const [chosen, setChosen] = useState<"first" | "second" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase === "flip") {
      const remaining = Math.max(0, FLIP_DURATION - elapsed);
      timerRef.current = setTimeout(() => setPhase("choice"), remaining);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // intentionally empty: phase timer is set once on mount

  async function handleChoice(choice: "first" | "second") {
    if (submitting || chosen) return;
    setChosen(choice);
    setSubmitting(true);
    try {
      await submitChoice(roomId, { choice });
      // The room socket will push the updated snapshot; no navigation needed here.
    } catch {
      setError("Something went wrong. Please try again.");
      setChosen(null);
      setSubmitting(false);
    }
  }

  // Flip reveal phase: delegate to RoomFlip
  if (phase === "flip") {
    return <RoomFlip snapshot={snapshot} onRevealComplete={() => setPhase("choice")} />;
  }

  // Choice phase
  if (isWinner) {
    return (
      <section
        aria-label="Seat choice"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          padding: "24px 24px",
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <p style={{ color: "var(--accent-light)", fontSize: "0.875rem" }}>✓ You won the flip</p>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Choose your seat</h2>

        {error && (
          <p role="alert" style={{ color: "var(--invalid)", fontSize: "0.875rem" }}>
            {error}
          </p>
        )}

        {/* Go First card */}
        <button
          onClick={() => handleChoice("first")}
          disabled={submitting}
          style={{
            minHeight: 88,
            padding: "16px 20px",
            textAlign: "left",
            background: chosen === "first" ? "var(--accent-dim)" : "var(--bg-1)",
            border: `1px solid ${chosen === "first" ? "var(--accent)" : chosen === "second" ? "var(--border)" : "var(--border)"}`,
            borderRadius: 8,
            cursor: submitting ? "default" : "pointer",
            opacity: chosen === "second" ? 0.5 : 1,
            transition:
              "background var(--duration-med, 220ms), border-color var(--duration-med, 220ms)",
          }}
          aria-pressed={chosen === "first"}
        >
          <div style={{ fontSize: "1.125rem", fontWeight: 600 }}>▶ Go first</div>
          <div style={{ fontSize: "0.875rem", color: "var(--text-1)", marginTop: 4 }}>
            You take turn 1.
          </div>
        </button>

        {/* Go Second card */}
        <button
          onClick={() => handleChoice("second")}
          disabled={submitting}
          style={{
            minHeight: 88,
            padding: "16px 20px",
            textAlign: "left",
            background: chosen === "second" ? "var(--accent-dim)" : "var(--bg-1)",
            border: `1px solid ${chosen === "second" ? "var(--accent)" : chosen === "first" ? "var(--border)" : "var(--border)"}`,
            borderRadius: 8,
            cursor: submitting ? "default" : "pointer",
            opacity: chosen === "first" ? 0.5 : 1,
            transition:
              "background var(--duration-med, 220ms), border-color var(--duration-med, 220ms)",
          }}
          aria-pressed={chosen === "second"}
        >
          <div style={{ fontSize: "1.125rem", fontWeight: 600 }}>◀ Go second</div>
          <div style={{ fontSize: "0.875rem", color: "var(--text-1)", marginTop: 4 }}>
            {opponentName} takes turn 1.
          </div>
        </button>

        <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
          Both players draw on every turn, including turn 1.
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
          {opponentName} is waiting on you.
        </p>
      </section>
    );
  }

  // Loser waiting (S9)
  return (
    <section
      aria-label="Waiting for seat choice"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "24px 24px",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <p style={{ color: "var(--text-1)", fontSize: "0.875rem" }}>{winnerName} won the flip</p>

      <p style={{ fontSize: "1.0625rem" }} role="status" aria-live="polite">
        ▮ {winnerName} is choosing who goes first
      </p>

      <p style={{ fontSize: "0.875rem", color: "var(--text-1)" }}>
        You&apos;ll find out in a moment. Either way, the duel starts right after.
      </p>

      {/* Player rows */}
      {snapshot.opponent && (
        <div
          className="panel"
          style={{
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>✓ You</span>
            <span style={{ color: "var(--accent-light)", fontWeight: 700, fontSize: "0.875rem" }}>
              READY
            </span>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>✓ {winnerName}</span>
            <span style={{ color: "var(--accent-light)", fontWeight: 700, fontSize: "0.875rem" }}>
              READY
            </span>
          </div>
        </div>
      )}

      {snapshot.roomDeadlineAt != null && (
        <WaitingElapsed startedAt={flip?.rolledAt ?? Date.now()} />
      )}
    </section>
  );
}

function WaitingElapsed({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - startedAt) / 1000));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const label = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }} aria-live="off">
      Waiting {label}
    </p>
  );
}
