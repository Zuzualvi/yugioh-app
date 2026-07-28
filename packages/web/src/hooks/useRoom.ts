/**
 * useRoom — single source of room state.
 *
 * Subscribes to the room WebSocket for live updates.
 * Falls back to 3-second polling of GET /api/duels/:id/room when the
 * socket is unavailable (R13).
 *
 * All countdowns derive from `roomDeadlineAt - serverNow` (server clock).
 * The hook corrects for client/server skew using the serverNow field in
 * each snapshot (R18).
 */

import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import { openRoomSocket } from "../api/roomSocket";
import { getRoomSnapshot } from "../api/room";

const POLL_INTERVAL_MS = 3000;

export interface UseRoomResult {
  snapshot: RoomSnapshot | null;
  loading: boolean;
  error: string | null;
  /** Milliseconds remaining until room_deadline_at (based on server clock skew). */
  msUntilDeadline: number | null;
}

export function useRoom(roomId: string | undefined): UseRoomResult {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);

  // Skew: (clientNow - serverNow) at the time of the last snapshot
  const skewRef = useRef<number>(0);

  function applySnapshot(snap: RoomSnapshot) {
    skewRef.current = Date.now() - snap.serverNow;
    setSnapshot(snap);
    setLoading(false);
    setError(null);
  }

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (usePolling) {
      // Polling fallback (R13)
      let active = true;

      async function poll() {
        try {
          const snap = await getRoomSnapshot(roomId!);
          if (active) applySnapshot(snap);
        } catch {
          if (active) setError("Failed to load room.");
        }
      }

      void poll();
      const interval = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_MS);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    // WebSocket path
    const handle = openRoomSocket(roomId, {
      onSnapshot: applySnapshot,
      onUnavailable: () => {
        setUsePolling(true);
      },
      onClose: (code) => {
        if (code === 4403 || code === 4410) {
          setError("Not authorized for this room.");
        }
      },
    });

    return () => {
      handle.close();
    };
  }, [roomId, usePolling]);

  // Compute msUntilDeadline from server clock
  const msUntilDeadline =
    snapshot?.roomDeadlineAt != null
      ? snapshot.roomDeadlineAt - (Date.now() - skewRef.current)
      : null;

  return { snapshot, loading, error, msUntilDeadline };
}
