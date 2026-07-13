/**
 * prod-server.ts — Production entry point for Fly.io deployment.
 *
 * Serves: /api/* routes + /images/* (from volume) + /healthz
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
 */

import express from "express";
import cookieParser from "cookie-parser";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

// CORS middleware (Stream A — packages/server/src/middleware/cors.ts)
import {
  corsMiddleware,
  allowedOriginsFromEnv,
} from "./packages/server/src/middleware/cors.js";

// Server internals (imported directly — not modifying packages/**)
import { openDb } from "./packages/server/src/db/openDb.js";
import { bootstrapAdmin } from "./packages/server/src/db/bootstrapAdmin.js";
import {
  createAuthRouter,
  createMeRouter,
  createAdminRouter,
} from "./packages/server/src/routes/auth.js";
import { createCardsRouter } from "./packages/server/src/routes/cards.js";
import { createDecksRouter } from "./packages/server/src/routes/decks.js";
import {
  requireSession,
  requireAdmin,
} from "./packages/server/src/middleware/requireSession.js";
import type { LoadedCatalog } from "./packages/server/src/catalog/loadCatalog.js";
import type { CardDTO, CardCatalog } from "@yugioh-app/contracts";

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
// Express app
// ---------------------------------------------------------------------------
const app = express();

// CORS must be FIRST — before express.json() so preflight OPTIONS is handled immediately
app.use(corsMiddleware(allowedOriginsFromEnv()));

app.use(express.json());
app.use(express.text({ type: "text/plain", limit: "1mb" }));
app.use(cookieParser());

// Service identity (not the app — Vercel serves the SPA)
app.get("/", (_req, res) => {
  res.json({ service: "yugioh-edison-api" });
});

// Health check (no auth required, used by Fly.io health check)
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", cards: catalog.catalog.cards.length });
});

// Card images from mounted volume (/data/images)
app.use("/images", express.static(IMAGES_PATH));

// API routes
app.use("/api/auth", createAuthRouter(db));
app.use("/api/me", requireSession(db), createMeRouter(db));
app.use("/api/cards", requireSession(db), createCardsRouter(catalog));
app.use("/api/decks", requireSession(db), createDecksRouter(db, catalog));
app.use("/api/admin", requireSession(db), requireAdmin, createAdminRouter(db));

// /api/* that didn't match → JSON 404
app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
});

app.listen(PORT, () => {
  console.log(`Yu-Gi-Oh API listening on port ${PORT} (NODE_ENV=${process.env["NODE_ENV"]})`);
  console.log(`  DB:     ${DB_PATH}`);
  console.log(`  Images: ${IMAGES_PATH}`);
});
