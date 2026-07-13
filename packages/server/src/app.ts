import express from "express";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import type { LoadedCatalog } from "./catalog/loadCatalog.js";
import { createAuthRouter, createMeRouter, createAdminRouter } from "./routes/auth.js";
import { createCardsRouter } from "./routes/cards.js";
import { createDecksRouter } from "./routes/decks.js";
import { requireSession, requireAdmin } from "./middleware/requireSession.js";

// ---------------------------------------------------------------------------
// Express app factory — wires all routes and middleware.
// Accepts db and catalog as dependencies so tests can inject in-memory versions.
// ---------------------------------------------------------------------------

export function createApp(db: InstanceType<typeof Database>, catalog: LoadedCatalog): express.Application {
  const app = express();

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

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  return app;
}
