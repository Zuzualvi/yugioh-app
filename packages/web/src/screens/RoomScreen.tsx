/**
 * RoomScreen — Shell: header, permanent rules strip, single aria-live status line, phase switch.
 * Renders real data from useRoom. Phase components are stubs until their slice lands.
 */

import { useParams } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import { RoomWaiting } from "./room/RoomWaiting";
import { RoomFlip } from "./room/RoomFlip";
import { RoomChoice } from "./room/RoomChoice";
import { RoomHandoff } from "./room/RoomHandoff";
import { RoomClosed } from "./room/RoomClosed";

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const { snapshot, loading, error } = useRoom(roomId);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="loading-spinner" aria-label="Loading room…" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p role="alert">{error ?? "Room not found."}</p>
      </div>
    );
  }

  const { status } = snapshot;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>⚔ Duel Room</h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-1)" }}>
          {snapshot.perMoveSeconds / 60} min per move · Room {snapshot.roomId.slice(0, 8)}
        </p>
      </header>

      {/* Single aria-live region for status updates (accessibility) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </div>

      <main style={{ flex: 1, padding: 24 }}>
        {(status === "open" || status === "filled") && <RoomWaiting snapshot={snapshot} />}
        {status === "awaiting_choice" &&
          snapshot.flip?.choice === null &&
          snapshot.flip !== null && <RoomChoice snapshot={snapshot} />}
        {status === "awaiting_choice" && !snapshot.flip && <RoomWaiting snapshot={snapshot} />}
        {status === "starting" && snapshot.seats !== null && <RoomHandoff snapshot={snapshot} />}
        {status === "starting" && snapshot.seats === null && <RoomFlip snapshot={snapshot} />}
        {status === "closed" && <RoomClosed snapshot={snapshot} />}
      </main>
    </div>
  );
}
