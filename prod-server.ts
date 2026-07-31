/**
 * prod-server.ts — Production entry point for Fly.io deployment.
 *
 * Serves: /api/* routes + /images/* (from volume) + /healthz + duel WS
 * The SPA is served separately by Vercel.
 *
 * This file is bundled by esbuild into dist/server.mjs (see Dockerfile).
 * import.meta.url in the bundle → file:///app/server.mjs, so __dirname = /app.
 *
 * Environment variables:
 *   PORT                    — HTTP port (default 8080)
 *   DB_PATH                 — SQLite file path (default /data/yugioh.db)
 *   IMAGES_PATH             — Card images directory on the volume (default /data/images)
 *   NODE_ENV                — Should be "production" (set in fly.toml / docker env)
 *   CORS_ALLOWED_ORIGINS    — Comma-separated allowed origins (e.g. https://app.example.com)
 *   BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD — See bootstrapAdmin.ts
 *   EDISON_WASM_PATH        — Override path to ocgcore-custom.sync.wasm
 *   EDISON_CDB_PATH         — Override path to cards.cdb
 *   EDISON_SCRIPTS_DIR      — Override path to scripts/assets directory
 *   EDISON_OVERRIDES_DIR    — Override path to edison-overrides directory
 */

import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

import { openDb } from "./packages/server/src/db/openDb.js";
import { bootstrapAdmin } from "./packages/server/src/db/bootstrapAdmin.js";
import { createApp } from "./packages/server/src/app.js";
import { DuelManager } from "./packages/server/src/duel/duelManager.js";
import { attachDuelWsServer } from "./packages/server/src/duel/duelSocket.js";
import { createRoomWss } from "./packages/server/src/room/roomSocket.js";
import { attachUpgradeRouter } from "./packages/server/src/wsUpgradeRouter.js";
import type {
  DuelEngineFactory,
  DuelEngineReplay,
} from "./packages/server/src/duel/engineInterface.js";
import type { LoadedCatalog } from "./packages/server/src/catalog/loadCatalog.js";
import type { CardDTO, CardCatalog } from "@yugioh-app/contracts";

import { createEdisonDuel, replayEdisonDuel } from "@yugioh-app/engine";

// ---------------------------------------------------------------------------
// Paths — resolved relative to the bundle (import.meta.url = file:///app/server.mjs)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);
const DB_PATH = process.env["DB_PATH"] ?? "/data/yugioh.db";
const IMAGES_PATH = process.env["IMAGES_PATH"] ?? "/data/images";
const CATALOG_DIR = join(__dirname, "packages/card-data/out");

// ---------------------------------------------------------------------------
// Load catalog — done here (not via loadCatalog()) to avoid import.meta.url
// path confusion inside the esbuild bundle.
// ---------------------------------------------------------------------------
function buildLoadedCatalog(): LoadedCatalog {
  const catalogPath = join(CATALOG_DIR, "edison-card-catalog.json");
  const aliasIndexPath = join(CATALOG_DIR, "alias-index.json");

  if (!existsSync(catalogPath)) {
    throw new Error(
      `[prod-server] Card catalog not found at ${catalogPath}. ` +
        `Is the image built correctly? Expected COPY in Dockerfile.`,
    );
  }

  const raw = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
    cards: CardDTO[];
    count?: number;
    [k: string]: unknown;
  };

  // Filter passcode=0 cards (same guard as loadCatalog.ts)
  raw.cards = raw.cards.filter((c) => c.passcode !== 0);
  raw.count = raw.cards.length;

  const catalog = raw as unknown as CardCatalog;

  const byPasscode = new Map<number, CardDTO>();
  const aliasIndex = new Map<number, number>();

  for (const card of catalog.cards) {
    byPasscode.set(card.passcode, card);
    if (card.aliasOf !== null && card.aliasOf !== undefined) {
      aliasIndex.set(card.passcode, card.aliasOf);
    }
  }

  if (existsSync(aliasIndexPath)) {
    const externalAliases = JSON.parse(readFileSync(aliasIndexPath, "utf-8")) as Record<
      string,
      number
    >;
    for (const [aliasStr, base] of Object.entries(externalAliases)) {
      const alias = parseInt(aliasStr, 10);
      if (!isNaN(alias) && !aliasIndex.has(alias)) {
        aliasIndex.set(alias, base);
      }
    }
  }

  const legalPasscodes = new Set<number>([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog, byPasscode, aliasIndex, legalPasscodes };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const db = openDb(DB_PATH);
await bootstrapAdmin(db);

const catalog = buildLoadedCatalog();
console.log(`[prod-server] Catalog loaded: ${catalog.catalog.cards.length} cards`);

// ---------------------------------------------------------------------------
// Duel engine wiring
// ---------------------------------------------------------------------------
const factory: DuelEngineFactory = (opts) => createEdisonDuel(opts);
const replay: DuelEngineReplay = (seed, deck0, deck1, log) =>
  replayEdisonDuel(seed, deck0, deck1, log);
const duelManager = new DuelManager(factory, replay);

// ---------------------------------------------------------------------------
// Express app — all wiring lives in createApp()
// ---------------------------------------------------------------------------
const app = createApp(db, catalog, duelManager, { imagesPath: IMAGES_PATH });

// ---------------------------------------------------------------------------
// HTTP server (wraps Express so the WS server can share the same port)
// ---------------------------------------------------------------------------
const httpServer = createServer(app);

// Both WS servers are created with noServer: true and have NO upgrade listener of
// their own — a single dispatcher routes /api/duels/:id/room/ws to the room server
// and /api/duels/:id/ws to the board server. Discarding attachDuelWsServer's
// return value and omitting attachUpgradeRouter leaves NOTHING listening for
// upgrades, which silently kills every WebSocket while HTTP stays perfectly
// healthy. That is exactly what shipped here, and it took the live duel board
// down alongside the absent room. Mirrors packages/server/src/index.ts.
const boardWss = attachDuelWsServer(httpServer, db, duelManager);
const roomWss = createRoomWss();
attachUpgradeRouter(httpServer, db, boardWss, roomWss);

httpServer.listen(PORT, () => {
  console.log(`Yu-Gi-Oh API listening on port ${PORT} (NODE_ENV=${process.env["NODE_ENV"]})`);
  console.log(`  DB:     ${DB_PATH}`);
  console.log(`  Images: ${IMAGES_PATH}`);
});
