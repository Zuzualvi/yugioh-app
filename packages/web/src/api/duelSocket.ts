/**
 * Typed WebSocket client for the duel endpoint.
 *
 * Opens a WS connection with a seat token query param (`?token=<seatToken>`),
 * parses inbound frames as DuelServerMessage (Zod-validated), exposes typed
 * callbacks, and sends DuelClientMessage (RESPONSE / RESIGN).
 *
 * Reconnect: on unexpected close the client re-opens the WS with the same
 * token; the server replies with a STATE snapshot to restore board state.
 */

import type { DuelClientMessage, DuelServerMessage } from "@yugioh-app/contracts";
import { DuelServerMessageSchema } from "@yugioh-app/contracts";

export interface DuelSocketCallbacks {
  onMessage: (msg: DuelServerMessage) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export interface DuelSocket {
  send: (msg: DuelClientMessage) => void;
  close: () => void;
}

// WS base is derived from the SAME var the REST client uses (VITE_API_BASE_URL),
// converted http→ws. This keeps REST and WS pointed at the same origin: in prod
// that's wss://api.zuhayr.io; on a same-origin localhost stack it's the window
// origin. The server's WS path is /api/duels/:id/ws (see packages/server duelSocket).
// Read at call time so a freshly-set env is always honoured.
function apiBase(): string {
  if (typeof import.meta === "undefined") return "";
  return (import.meta.env as Record<string, string> | undefined)?.VITE_API_BASE_URL ?? "";
}

function buildWsUrl(duelId: string, token: string): string {
  const httpBase =
    apiBase() || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const wsBase = httpBase.replace(/^http/, "ws"); // http→ws, https→wss
  return `${wsBase}/api/duels/${duelId}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Opens a duel WebSocket.  Reconnects on unexpected close (code !== 1000/1001).
 * Each reconnect re-sends the token so the server can restore state via STATE.
 */
export function openDuelSocket(
  duelId: string,
  token: string,
  callbacks: DuelSocketCallbacks,
): DuelSocket {
  let ws: WebSocket;
  let closed = false;
  let reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(buildWsUrl(duelId, token));

    ws.addEventListener("open", () => {
      reconnectDelay = 1000;
      callbacks.onOpen?.();
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      let raw: unknown;
      try {
        raw = JSON.parse(event.data as string);
      } catch {
        return; // ignore non-JSON frames
      }
      const result = DuelServerMessageSchema.safeParse(raw);
      if (result.success) {
        callbacks.onMessage(result.data);
      }
      // silently drop frames that don't match the schema
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      callbacks.onClose?.(event);
      // 1000 = normal, 1001 = going away — don't reconnect on clean close
      if (!closed && event.code !== 1000 && event.code !== 1001) {
        setTimeout(() => {
          if (!closed) {
            reconnectDelay = Math.min(reconnectDelay * 2, 16000);
            connect();
          }
        }, reconnectDelay);
      }
    });

    ws.addEventListener("error", (event: Event) => {
      callbacks.onError?.(event);
    });
  }

  connect();

  return {
    send(msg: DuelClientMessage) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close() {
      closed = true;
      ws.close(1000);
    },
  };
}
