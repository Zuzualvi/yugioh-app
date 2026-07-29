// ---------------------------------------------------------------------------
// E2E harness server — a SAME-ORIGIN localhost stack for the Playwright duel
// suite: one origin serves the built SPA + the real /api + the real duel WS,
// backed by the real WASM engine. Same-origin means the SameSite=Lax session
// cookie attaches with zero CORS (unlike the prod Vercel/Fly split).
//
// Run from source via tsx (packages expose src/index.ts). Engine WASM + card
// assets must be built (packages/engine/vendor + /assets) — the engine resolves
// them by default relative path, no env needed.
//
// Env: PORT (default 8080), DB_PATH (default /tmp/e2e-duel.db, wiped on boot).
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../../packages/server/src/db/openDb.js";
import { loadCatalog } from "../../packages/server/src/catalog/loadCatalog.js";
import { createApp } from "../../packages/server/src/app.js";
import { DuelManager } from "../../packages/server/src/duel/duelManager.js";
import { attachDuelWsServer } from "../../packages/server/src/duel/duelSocket.js";
import { createRoomWss } from "../../packages/server/src/room/roomSocket.js";
import { attachUpgradeRouter } from "../../packages/server/src/wsUpgradeRouter.js";
import { recoverStartingDuels } from "../../packages/server/src/duel/startDuelFromRoom.js";
import type {
  DuelEngineFactory,
  DuelEngineReplay,
} from "../../packages/server/src/duel/engineInterface.js";
import { createEdisonDuel, replayEdisonDuel } from "@yugioh-app/engine";
import { seedE2E } from "./seed.js";

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);
const DB_PATH = process.env["DB_PATH"] ?? "/tmp/e2e-duel.db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, "../../packages/web/dist");

// Fresh DB every boot for deterministic runs.
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB_PATH}${suffix}`, { force: true });

const db = openDb(DB_PATH);
await seedE2E(db);

const catalog = loadCatalog();

const factory: DuelEngineFactory = (opts) => createEdisonDuel(opts);
const replay: DuelEngineReplay = (seed, deck0, deck1, log) =>
  replayEdisonDuel(seed, deck0, deck1, log);
const duelManager = new DuelManager(factory, replay);

// E47: recover any duels stuck in 'starting' from a previous run.
await recoverStartingDuels(db, duelManager);

const app = createApp(db, catalog, duelManager, { webDistPath });
const httpServer = createServer(app);

// Both WS servers use noServer:true — the upgrade router dispatches to them.
// (board WS was changed to noServer:true in the room-spine commit; the harness
// must use the same dispatcher as index.ts or board WS upgrades are never routed.)
const boardWss = attachDuelWsServer(httpServer, db, duelManager);
const roomWss = createRoomWss();
attachUpgradeRouter(httpServer, db, boardWss, roomWss);

httpServer.listen(PORT, () => {
  console.log(`[e2e-harness] same-origin stack on http://localhost:${PORT}`);
  console.log(`[e2e-harness]   DB:  ${DB_PATH}`);
  console.log(`[e2e-harness]   SPA: ${webDistPath}`);
  console.log(`[e2e-harness]   catalog: ${catalog.catalog.cards.length} cards`);
});
