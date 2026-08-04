// ---------------------------------------------------------------------------
// roomRouter — Express router for all pre-duel room endpoints.
// Owned by S0; not edited afterwards. Stubs respond 501 until their slice lands.
// ---------------------------------------------------------------------------

import { Router } from "express";
import Database from "better-sqlite3";
import { requireSession } from "../middleware/requireSession.js";
import type { DuelManager } from "../duel/duelManager.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { createRoom } from "./routes/createRoom.js";
import { lookupJoinToken } from "./routes/lookupJoinToken.js";
import { claimRoom } from "./routes/claimRoom.js";
import { getRoomSnapshot } from "./routes/getRoomSnapshot.js";
import { pickDeck } from "./routes/pickDeck.js";
import { ready } from "./routes/ready.js";
import { unready } from "./routes/unready.js";
import { leave } from "./routes/leave.js";
import { submitChoice } from "./routes/submitChoice.js";
import { getSeatCredential } from "./routes/getSeatCredential.js";
import { listActiveDuels } from "./routes/listActiveDuels.js";

export function createRoomRouter(
  db: InstanceType<typeof Database>,
  duelManager: DuelManager | undefined,
  catalog: LoadedCatalog,
): Router {
  const router = Router();

  // POST /api/duels — create room (replaces old create-duel, S1)
  router.post("/", requireSession(db), createRoom(db));

  // GET /api/duels/join/:joinToken — unauthenticated-capable pre-join verdict (R41, S1)
  // Mounted BEFORE requireSession so unauthenticated users can access it.
  router.get("/join/:joinToken", lookupJoinToken(db));

  // POST /api/duels/join — claim room (S1)
  router.post("/join", requireSession(db), claimRoom(db));

  // GET /api/duels/active — list non-ended duels for the caller (Slice E / ZUH-72)
  // Registered BEFORE /:id routes so the literal "active" is not captured by a param.
  router.get("/active", requireSession(db), listActiveDuels(db));

  // All :id routes require session
  router.get("/:id/room", requireSession(db), getRoomSnapshot(db));
  router.post("/:id/room/deck", requireSession(db), pickDeck(db));
  router.post("/:id/room/ready", requireSession(db), ready(db, catalog));
  router.post("/:id/room/unready", requireSession(db), unready(db));
  router.post("/:id/room/choice", requireSession(db), submitChoice(db, duelManager));
  router.post("/:id/room/leave", requireSession(db), leave(db));
  router.get("/:id/seat", requireSession(db), getSeatCredential(db));

  return router;
}
