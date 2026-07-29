/**
 * RoomClosed — shown when status='closed'.
 *
 * Handles:
 *   - D1 creator variant: their own room expired
 *   - D1 invitee variant: link they followed expired
 *   - D4 creator-left: invitee sees the room closed by creator
 *   - D4 opponent-left-then-closed: edge case
 *   - General: any closed reason (E48)
 */

import { useNavigate } from "react-router-dom";
import type { RoomSnapshot } from "@yugioh-app/contracts";

interface Props {
  snapshot: RoomSnapshot;
}

export function RoomClosed({ snapshot }: Props) {
  const navigate = useNavigate();
  const { closedReason, closedByUserId, you, opponent } = snapshot;

  // Determine who left when reason is 'left'
  const leftByOpponent =
    closedReason === "left" && closedByUserId !== null && closedByUserId !== you.userId;
  const leftByCreator =
    closedReason === "left" &&
    closedByUserId !== null &&
    closedByUserId !== you.userId &&
    you.role === "opponent";
  const ownRoomExpired =
    you.role === "creator" &&
    (closedReason === "expired_unclaimed" ||
      closedReason === "expired_idle" ||
      closedReason === "expired_ready");

  const otherName =
    leftByOpponent && opponent
      ? opponent.displayName || "Your opponent"
      : opponent?.displayName || null;

  return (
    <section
      aria-label="Room closed"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 0",
      }}
    >
      <div
        className="panel"
        style={{ maxWidth: 400, width: "100%", textAlign: "center", padding: 28 }}
      >
        {/* Icon */}
        <div style={{ fontSize: "2rem", marginBottom: 12 }} aria-hidden>
          {closedReason === "left" ? "🚪" : closedReason === "engine_failed" ? "⚠️" : "⏳"}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {titleFor(closedReason, leftByCreator, ownRoomExpired, otherName)}
        </h2>

        {/* Body */}
        <p
          style={{
            color: "var(--text-1)",
            fontSize: "0.9375rem",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          {bodyFor(closedReason, leftByCreator, ownRoomExpired, otherName)}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate("/duel/new")}>
            {leftByCreator
              ? `Challenge ${otherName ?? "someone"} back ▸`
              : "Create a new challenge ▸"}
          </button>
          <button className="btn" onClick={() => navigate("/")}>
            Home
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Copy helpers ──────────────────────────────────────────────────────────

function titleFor(
  reason: RoomSnapshot["closedReason"],
  creatorLeft: boolean,
  ownExpired: boolean,
  otherName: string | null,
): string {
  if (reason === "left") {
    if (creatorLeft) return `${otherName ?? "Your opponent"} left the room`;
    return "Room closed";
  }
  if (ownExpired) return "Your challenge expired";
  if (reason === "expired_unclaimed") return "This challenge has expired";
  if (reason === "expired_idle") return "The room expired";
  if (reason === "expired_ready") return "The room expired";
  if (reason === "expired_choice") return "The room expired";
  if (reason === "engine_failed") return "Something went wrong";
  return "Room closed";
}

function bodyFor(
  reason: RoomSnapshot["closedReason"],
  creatorLeft: boolean,
  ownExpired: boolean,
  otherName: string | null,
): string {
  if (reason === "left") {
    if (creatorLeft) {
      return "The challenge is over. Nothing was recorded — no duel, no loss.";
    }
    return "The other player left the room. Nothing was recorded.";
  }
  if (ownExpired) {
    return "Nobody joined in 30 minutes.";
  }
  if (reason === "expired_unclaimed") {
    return `${otherName ? `${otherName}'s` : "The"} challenge link was created more than 30 minutes ago. Challenge links don't last longer than that. Ask ${otherName ?? "them"} for a new link — or start your own duel and send them one.`;
  }
  if (reason === "expired_idle") {
    return "This room expired — no decks were selected in time. No duel was recorded.";
  }
  if (reason === "expired_ready") {
    return "This room expired — the duel didn't start in time. No duel was recorded.";
  }
  if (reason === "expired_choice") {
    return "This room expired — no seat choice was made. No duel was recorded.";
  }
  if (reason === "engine_failed") {
    return "Something went wrong starting the duel. No result was recorded.";
  }
  return "This room is closed. No duel was recorded.";
}
