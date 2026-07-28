import { createServer } from "node:http";
import { openDb } from "./db/openDb.js";
import { bootstrapAdmin } from "./db/bootstrapAdmin.js";
import { loadCatalog } from "./catalog/loadCatalog.js";
import { createApp } from "./app.js";
import { DuelManager } from "./duel/duelManager.js";
import { attachDuelWsServer } from "./duel/duelSocket.js";
import { createRoomWss } from "./room/roomSocket.js";
import { attachUpgradeRouter } from "./wsUpgradeRouter.js";
import { createEdisonDuel, replayEdisonDuel } from "@yugioh-app/engine";
import type { DuelEngineFactory, DuelEngineReplay } from "./duel/engineInterface.js";

// ---------------------------------------------------------------------------
// Server entry point.
//
// Environment variables:
//   PORT                      — HTTP port (default 3001)
//   DB_PATH                   — SQLite file path (default ./yugioh.db)
//   BOOTSTRAP_ADMIN_USERNAME  — If set (with BOOTSTRAP_ADMIN_PASSWORD), creates
//                               the first admin user when none exists yet.
//   BOOTSTRAP_ADMIN_PASSWORD  — Paired with the above.
//   ALLOW_FIXTURE_CATALOG=1   — Allow falling back to the 22-card fixture
//                               catalog when the real catalog is absent.
//                               NEVER set this in production.
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const DB_PATH = process.env["DB_PATH"] ?? "./yugioh.db";

const db = openDb(DB_PATH);
await bootstrapAdmin(db);

const catalog = loadCatalog();

const factory: DuelEngineFactory = (opts) => createEdisonDuel(opts);

// Rehydrate by creating a fresh engine and replaying the persisted response log.
const replay: DuelEngineReplay = (seed, deck0, deck1, log) =>
  replayEdisonDuel(seed, deck0, deck1, log);

const duelManager = new DuelManager(factory, replay);
const app = createApp(db, catalog, duelManager);

const httpServer = createServer(app);

// Both WS servers use noServer: true; the upgrade router dispatches to them.
const boardWss = attachDuelWsServer(httpServer, db, duelManager);
const roomWss = createRoomWss();
attachUpgradeRouter(httpServer, db, boardWss, roomWss);

httpServer.listen(PORT, () => {
  console.log(`Yu-Gi-Oh server listening on port ${PORT}`);
});
