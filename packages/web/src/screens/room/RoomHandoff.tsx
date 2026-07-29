/**
 * RoomHandoff — S10: 3-2-1 countdown before the board mounts.
 *
 * Both players see the same beat. The sequence is timer-driven (never
 * animationend), so the room cannot get stuck under prefers-reduced-motion.
 *
 * After the countdown completes, navigates to /duel/:id with the seat
 * credential from the room's seats assignment.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import { getSeatCredential } from "../../api/room";

interface Props {
  snapshot: RoomSnapshot;
}

const COUNTDOWN_FROM = 3; // 3 → 2 → 1 → navigate
const TICK_MS = 1000;

export function RoomHandoff({ snapshot }: Props) {
  const navigate = useNavigate();
  const seats = snapshot.seats!;
  const youUserId = snapshot.you.userId;
  const opponentName = snapshot.opponent?.displayName ?? "Your opponent";

  const youGoFirst = seats.seat0UserId === youUserId;
  const seat0Name =
    seats.seat0UserId === youUserId ? "You" : (snapshot.opponent?.displayName ?? "Your opponent");

  const [count, setCount] = useState(COUNTDOWN_FROM);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          // Navigate to the board; fetch credential in DuelScreen if not in state
          navigate(`/duel/${snapshot.roomId}`, { state: { fromRoom: true } });
          return 0;
        }
        return c - 1;
      });
    }, TICK_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // intentionally empty: countdown runs once on mount

  const clockMessage = youGoFirst
    ? `Your ${Math.floor(snapshot.perMoveSeconds / 60)} min clock starts in`
    : `Their clock is running. You're up next.`;

  const subLine = youGoFirst ? `vs ${opponentName}` : null;

  return (
    <section
      data-testid="room-handoff"
      aria-label="Duel starting"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "48px 24px",
        textAlign: "center",
        minHeight: 320,
      }}
    >
      <div style={{ fontSize: "2.5rem" }} aria-hidden="true">
        ⚔
      </div>

      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Duel starting
      </p>

      <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} role="status">
        {youGoFirst ? "You go first" : `${seat0Name} goes first`}
      </h2>

      <p style={{ color: "var(--text-1)" }}>{clockMessage}</p>

      {/* Countdown number */}
      <div
        aria-label={`Starting in ${count}`}
        style={{
          fontSize: "3rem",
          fontWeight: 700,
          color: "var(--accent-light)",
          lineHeight: 1,
        }}
      >
        {count > 0 ? count : ""}
      </div>

      {subLine && <p style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>{subLine}</p>}
    </section>
  );
}

/**
 * Fetch the seat credential if it is not already in router state.
 * Exported for use by DuelScreen.
 */
export async function fetchSeatCredential(duelId: string) {
  return getSeatCredential(duelId);
}
