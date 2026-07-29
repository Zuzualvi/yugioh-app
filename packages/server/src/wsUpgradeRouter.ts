// ---------------------------------------------------------------------------
// wsUpgradeRouter — One httpServer.on("upgrade") dispatcher.
// Routes /api/duels/:id/room/ws → room WS server
//        /api/duels/:id/ws     → board WS server
//        anything else         → destroy
// ---------------------------------------------------------------------------

import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import type { WebSocketServer } from "ws";
import Database from "better-sqlite3";
import { handleRoomUpgrade } from "./room/roomSocket.js";
import { allowedOriginsFromEnv } from "./middleware/cors.js";

export function attachUpgradeRouter(
  httpServer: HttpServer,
  db: InstanceType<typeof Database>,
  boardWss: WebSocketServer,
  roomWss: WebSocketServer,
): void {
  const allowedOrigins = allowedOriginsFromEnv();

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? "";

    if (/^\/api\/duels\/[^/]+\/room\/ws/.test(url)) {
      // Room socket
      handleRoomUpgrade(roomWss, db, allowedOrigins, req, socket, head);
    } else if (/^\/api\/duels\/[^/]+\/ws/.test(url)) {
      // Board socket (existing duel relay)
      boardWss.handleUpgrade(req, socket, head, (ws) => {
        boardWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });
}
