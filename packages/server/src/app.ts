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
import { createRoomRouter } from "./room/roomRouter.js";
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

  // Room router — handles pre-duel room lifecycle (ZUH-26).
  // Mounted at /api/duels. The GET /join/:token route is unauthenticated-capable;
  // per-route session guards are applied inside the router.
  app.use("/api/duels", createRoomRouter(db, duelManager, catalog));

  // Duel board routes (active-duel relay) — also mounted at /api/duels.
  // The room router is checked first; unmatched paths fall through here.
  if (duelManager) {
    app.use("/api/duels", requireSession(db), createDuelRouter(db, catalog, duelManager));
  }

  if (opts?.webDistPath) {
    const webDist = opts.webDistPath;
    app.use("/api", (_req, res) => {
      res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
    });
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
      res.sendFile(join(webDist, "index.html"));
    });
  } else {
    app.use((_req, res) => {
      res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
    });
  }

  return app;
}
