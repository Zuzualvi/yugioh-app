// ---------------------------------------------------------------------------
// duelRoutes — Board-lifecycle routes for active duels.
// POST /api/duels and POST /api/duels/join are superseded by the room router
// (createRoom / claimRoom) and are no longer handled here.
// ---------------------------------------------------------------------------

import { Router } from "express";
import Database from "better-sqlite3";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import type { DuelManager } from "./duelManager.js";
import { getDuel } from "./duelStore.js";

export function createDuelRouter(
  db: InstanceType<typeof Database>,
  _catalog: LoadedCatalog,
  _manager: DuelManager,
): Router {
  const router = Router();

  // GET /api/duels/:id — duel info (for polling / debugging)
  router.get("/:id", (req, res): void => {
    const row = getDuel(db, req.params["id"] as string);
    if (!row) {
      res.status(404).json({ error: { code: "not_found", message: "Duel not found." } });
      return;
    }
    res.status(200).json({
      duelId: row.id,
      status: row.status,
      winner: row.winner,
      endReason: row.end_reason,
    });
  });

  return router;
}
