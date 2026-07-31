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
  opts?: { webDistPath?: string; imagesPath?: string },
): express.Application {
  const app = express();

  // 1. CORS must be FIRST — before body parsing so preflight OPTIONS is answered immediately
  app.use(corsMiddleware(allowedOriginsFromEnv()));

  // 2. Body parsers
  app.use(express.json());
  // 3. Accept raw text body for .ydk import
  app.use(express.text({ type: "text/plain", limit: "1mb" }));
  // 4. Cookie parser
  app.use(cookieParser());

  // 5. Service identity
  app.get("/", (_req, res) => {
    res.json({ service: "yugioh-edison-api" });
  });

  // 6. Health check (no auth required, used by Fly.io health check every 30s)
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", cards: catalog.catalog.cards.length });
  });

  // 7. Card images — only mounted when imagesPath is supplied
  if (opts?.imagesPath) {
    app.use("/images", express.static(opts.imagesPath));
  }

  // 8. Auth routes (no session required)
  app.use("/api/auth", createAuthRouter(db));

  // 9. /api/me — requires session
  app.use("/api/me", requireSession(db), createMeRouter(db));

  // 10. Card routes — requires session
  app.use("/api/cards", requireSession(db), createCardsRouter(catalog));

  // 11. Deck routes — requires session
  app.use("/api/decks", requireSession(db), createDecksRouter(db, catalog));

  // 12. Admin routes — requires session + admin role
  app.use("/api/admin", requireSession(db), requireAdmin, createAdminRouter(db));

  // 13. Room router — handles pre-duel room lifecycle.
  // Mounted at /api/duels BEFORE the duel router: both mount at /api/duels,
  // the room router is checked first, and unmatched paths fall through.
  // Applies per-route session guards (not a global one) because
  // GET /api/duels/join/:joinToken must answer unauthenticated.
  app.use("/api/duels", createRoomRouter(db, duelManager, catalog));

  // 14. Duel board routes (active-duel relay) — also mounted at /api/duels.
  // The room router is checked first; unmatched paths fall through here.
  if (duelManager) {
    app.use("/api/duels", requireSession(db), createDuelRouter(db, catalog, duelManager));
  }

  // 15. /api/* that didn't match → JSON 404
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  // 16. SPA static files + fallback (only when webDistPath is supplied)
  if (opts?.webDistPath) {
    const webDist = opts.webDistPath;
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
      res.sendFile(join(webDist, "index.html"));
    });
  }

  // 17. Terminal JSON 404 — catches anything not matched above
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  return app;
}
