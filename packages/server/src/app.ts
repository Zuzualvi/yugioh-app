import express from "express";
import cookieParser from "cookie-parser";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { LoadedCatalog } from "./catalog/loadCatalog.js";
import { createAuthRouter, createMeRouter, createAdminRouter } from "./routes/auth.js";
import { createCardsRouter } from "./routes/cards.js";
import { createDecksRouter } from "./routes/decks.js";
import { requireSession, requireAdmin } from "./middleware/requireSession.js";
import { corsMiddleware, allowedOriginsFromEnv } from "./middleware/cors.js";
import { createDuelRouter } from "./duel/duelRoutes.js";
import type { DuelManager } from "./duel/duelManager.js";

// ---------------------------------------------------------------------------
// Express app factory — wires all routes and middleware.
// Accepts db and catalog as dependencies so tests can inject in-memory versions.
// ---------------------------------------------------------------------------

export function createApp(
  db: InstanceType<typeof Database>,
  catalog: LoadedCatalog,
  duelManager?: DuelManager,
  opts?: { webDistPath?: string },
): express.Application {
  const app = express();

  app.use(corsMiddleware(allowedOriginsFromEnv()));
  app.use(express.json());
  // Accept raw text body for .ydk import
  app.use(express.text({ type: "text/plain", limit: "1mb" }));
  app.use(cookieParser());

  // Auth routes (no session required)
  app.use("/api/auth", createAuthRouter(db));

  // /api/me — requires session
  app.use("/api/me", requireSession(db), createMeRouter(db));

  // Card routes — requires session
  app.use("/api/cards", requireSession(db), createCardsRouter(catalog));

  // Deck routes — requires session
  app.use("/api/decks", requireSession(db), createDecksRouter(db, catalog));

  // Admin routes — requires session + admin role
  app.use("/api/admin", requireSession(db), requireAdmin, createAdminRouter(db));

  // Duel routes — requires session
  if (duelManager) {
    app.use("/api/duels", requireSession(db), createDuelRouter(db, catalog, duelManager));
  }

  if (opts?.webDistPath) {
    // Same-origin dev / E2E mode: this one origin serves the built SPA AND the
    // API + WS, so the SameSite=Lax session cookie attaches with zero CORS.
    // NOT used in production (Vercel serves the SPA there); active only when
    // webDistPath is provided.
    const webDist = opts.webDistPath;
    app.use("/api", (_req, res) => {
      res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
    });
    app.use(express.static(webDist));
    // SPA fallback: any non-API, non-WS GET serves index.html (client routing).
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
      res.sendFile(join(webDist, "index.html"));
    });
  } else {
    // 404 fallback (default: API-only server, e.g. unit tests / prod split).
    app.use((_req, res) => {
      res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
    });
  }

  return app;
}
