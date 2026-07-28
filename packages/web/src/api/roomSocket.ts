/**
 * Cookie-authed room WebSocket client.
 * Opens a connection to GET /api/duels/:id/room/ws (no token in URL).
 * Reconnects with exponential backoff. Falls back to polling if the socket
 * is unavailable. Zod-validates every inbound frame.
 */

import type { RoomSnapshot, RoomServerMessage } from "@yugioh-app/contracts";
import { RoomServerMessageSchema } from "@yugioh-app/contracts";

export interface RoomSocketCallbacks {
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onOpen?: () => void;
  onClose?: (code: number) => void;
  onUnavailable?: () => void;
}

export interface RoomSocketHandle {
  close(): void;
}

function apiBase(): string {
  if (typeof import.meta === "undefined") return "";
  return (import.meta.env as Record<string, string> | undefined)?.VITE_API_BASE_URL ?? "";
}

function buildWsUrl(roomId: string): string {
  const httpBase =
    apiBase() || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const wsBase = httpBase.replace(/^http/, "ws");
  return `${wsBase}/api/duels/${roomId}/room/ws`;
}

/**
 * Opens a room WebSocket. Reconnects on unexpected close with backoff.
 * Signals onUnavailable when three consecutive connects fail (triggers poll fallback).
 */
export function openRoomSocket(roomId: string, callbacks: RoomSocketCallbacks): RoomSocketHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectDelay = 1000;
  let failCount = 0;
  const MAX_FAILS = 3;

  function connect() {
    if (closed) return;
    ws = new WebSocket(buildWsUrl(roomId));

    ws.addEventListener("open", () => {
      reconnectDelay = 1000;
      failCount = 0;
      callbacks.onOpen?.();
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      let raw: unknown;
      try {
        raw = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const result = RoomServerMessageSchema.safeParse(raw);
      if (result.success) {
        const msg: RoomServerMessage = result.data;
        if (msg.type === "ROOM_STATE") {
          callbacks.onSnapshot(msg.snapshot);
        }
      }
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      callbacks.onClose?.(event.code);
      if (closed) return;
      if (event.code === 1000 || event.code === 1001) return; // clean close

      failCount++;
      if (failCount >= MAX_FAILS) {
        callbacks.onUnavailable?.();
        return;
      }
      setTimeout(() => {
        if (!closed) {
          reconnectDelay = Math.min(reconnectDelay * 2, 16000);
          connect();
        }
      }, reconnectDelay);
    });

    ws.addEventListener("error", () => {
      failCount++;
      if (failCount >= MAX_FAILS) {
        callbacks.onUnavailable?.();
      }
    });
  }

  connect();

  return {
    close() {
      closed = true;
      ws?.close(1000);
    },
  };
}
