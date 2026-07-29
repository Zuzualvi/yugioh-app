// ---------------------------------------------------------------------------
// roomSocket — WS upgrade handler for /api/duels/:id/room/ws
// Cookie auth, Origin allowlist, occupant check, initial snapshot.
// ---------------------------------------------------------------------------

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import Database from "better-sqlite3";

/** Parse a raw Cookie header into a name→value map. */
function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}

import { resolveSessionUser } from "../middleware/resolveSessionUser.js";
import { loadRoomView } from "./loadRoomView.js";
import { requireOccupant } from "./roomAccess.js";
import { evaluateExpiry } from "./evaluateExpiry.js";
import { closeRoom } from "./roomStore.js";
import { buildRoomSnapshot } from "./buildRoomSnapshot.js";
import { registerSocket, getPresenceMap, armDeadlineTimer } from "./roomBroadcast.js";
import type { RoomServerMessage } from "@yugioh-app/contracts";

export function createRoomWss(): WebSocketServer {
  return new WebSocketServer({ noServer: true });
}

function toWire(msg: RoomServerMessage): string {
  return JSON.stringify(msg);
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function handleRoomUpgrade(
  wss: WebSocketServer,
  db: InstanceType<typeof Database>,
  allowedOrigins: string[],
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void {
  // 1. Origin check (R11, E23)
  const origin = req.headers.origin ?? "";
  if (allowedOrigins.length === 0) {
    // Same-origin dev: accept same host or no origin
    const host = req.headers.host ?? "";
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        // malformed origin — reject
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }
      if (originHost !== host) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }
    }
  } else {
    const allowed = new Set(allowedOrigins);
    if (!allowed.has(origin)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
  }

  // 2. Cookie auth (R9, R11)
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookieHeader(cookieHeader);
  const sid = cookies["sid"];
  if (!sid) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }
  const user = resolveSessionUser(db, sid);
  if (!user) {
    rejectUpgrade(socket, 401, "Unauthorized");
    return;
  }

  // 3. Extract room id from URL: /api/duels/:id/room/ws
  const url = req.url ?? "";
  const match = /^\/api\/duels\/([^/]+)\/room\/ws/.exec(url);
  if (!match) {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }
  const roomId = match[1]!;

  const view = loadRoomView(db, roomId);
  if (!view) {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }

  // 4. Occupant check (E22)
  const role = requireOccupant(view.row, user.id);
  if (!role) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  // Upgrade
  wss.handleUpgrade(req, socket, head, (ws) => {
    const now = Date.now();

    // Expiry with writeback
    const { expired, reason } = evaluateExpiry(view.row, now);
    if (expired && reason) {
      closeRoom(db, roomId, reason, null);
      const fresh = loadRoomView(db, roomId);
      if (fresh) {
        const presence = getPresenceMap(roomId, fresh.row);
        const snapshot = buildRoomSnapshot(
          fresh.row,
          user.id,
          fresh.names,
          presence,
          now,
          fresh.deckInfo,
        );
        ws.send(toWire({ type: "ROOM_STATE", snapshot }));
      }
      ws.close(4410, "room expired");
      return;
    }

    // Register socket (arms away timer on close)
    registerSocket(db, roomId, user.id, ws);

    // Arm deadline timer while sockets are connected
    const row = view.row;
    if (row.room_deadline_at && row.status !== "starting" && row.status !== "closed") {
      armDeadlineTimer(db, roomId, row.room_deadline_at);
    }

    // Send initial ROOM_STATE (R12)
    const freshView = loadRoomView(db, roomId);
    if (freshView) {
      const presence = getPresenceMap(roomId, freshView.row);
      const snapshot = buildRoomSnapshot(
        freshView.row,
        user.id,
        freshView.names,
        presence,
        now,
        freshView.deckInfo,
      );
      ws.send(toWire({ type: "ROOM_STATE", snapshot }));
    }

    // Room socket is server→client only (R12)
    ws.on("message", () => {
      /* read-only: ignore */
    });
  });
}
