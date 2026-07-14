// ---------------------------------------------------------------------------
// duelRoutes — HTTP lifecycle for duels.
//
//   POST /api/duels       (auth required) — create duel, return joinToken + creatorSeatToken
//   POST /api/duels/join  (auth required) — join via joinToken → start engine
// ---------------------------------------------------------------------------

import { Router } from "express";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { CreateDuelBodySchema, JoinDuelBodySchema } from "@yugioh-app/contracts";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { validateDeck } from "../domain/validateDeck.js";
import { EDISON_FLAGS } from "@yugioh-app/engine";
import type { DuelManager } from "./duelManager.js";
import { createDuel, getDuel, getDuelByJoinToken, joinDuel, setDeadline } from "./duelStore.js";
import { computeDeadline } from "./timer.js";
import type { Seat } from "@yugioh-app/contracts";

interface DeckRow {
  id: string;
  owner_id: string;
  main_json: string;
  extra_json: string;
  side_json: string;
}

function resolveDeck(
  db: InstanceType<typeof Database>,
  deckId: string,
  userId: string,
): { main: number[]; extra: number[] } | { error: string } {
  const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(deckId) as DeckRow | undefined;
  if (!row) return { error: "Deck not found." };
  if (row.owner_id !== userId) return { error: "Not your deck." };
  const main = JSON.parse(row.main_json) as number[];
  const extra = JSON.parse(row.extra_json) as number[];
  return { main, extra };
}

export function createDuelRouter(
  db: InstanceType<typeof Database>,
  catalog: LoadedCatalog,
  manager: DuelManager,
): Router {
  const router = Router();

  // POST /api/duels — create
  router.post("/", (req, res): void => {
    const parsed = CreateDuelBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }

    const userId = req.user!.id;
    const { deckId, timer } = parsed.data;

    const deck = resolveDeck(db, deckId, userId);
    if ("error" in deck) {
      res.status(400).json({ error: { code: "invalid_deck", message: deck.error } });
      return;
    }

    // Validate deck for Edison
    const side: number[] = [];
    const validation = validateDeck({ main: deck.main, extra: deck.extra, side }, catalog);
    if (!validation.legal) {
      res.status(400).json({
        error: { code: "invalid_deck", message: "Deck is not Edison-legal.", validation },
      });
      return;
    }

    const duelId = randomUUID();
    const joinToken = randomUUID();
    const seat0Token = randomUUID();
    const seat1Token = randomUUID();
    // Random seed: combine two 32-bit randoms into a bigint
    const seed =
      BigInt(Math.floor(Math.random() * 0xffffffff)) * 0x100000000n +
      BigInt(Math.floor(Math.random() * 0xffffffff));

    createDuel(db, {
      id: duelId,
      joinToken,
      seat0Token,
      seat1Token,
      seat0UserId: userId,
      seed,
      duelFlags: EDISON_FLAGS,
      deck0: { main: deck.main, extra: deck.extra },
      timerPerMoveSeconds: timer.perMoveSeconds,
    });

    res.status(201).json({
      duelId,
      joinToken,
      creatorSeatToken: seat0Token,
      seat: 0 as Seat,
    });
  });

  // POST /api/duels/join — join
  router.post("/join", (req, res): void => {
    const parsed = JoinDuelBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }

    const userId = req.user!.id;
    const { joinToken, deckId } = parsed.data;

    const duelRow = getDuelByJoinToken(db, joinToken);
    if (!duelRow) {
      res.status(400).json({ error: { code: "invalid_token", message: "Unknown join token." } });
      return;
    }
    if (duelRow.status !== "waiting_for_opponent") {
      res.status(400).json({ error: { code: "already_joined", message: "Duel already started." } });
      return;
    }
    if (duelRow.seat0_user_id === userId) {
      res.status(400).json({ error: { code: "self_join", message: "Cannot join your own duel." } });
      return;
    }

    const deck = resolveDeck(db, deckId, userId);
    if ("error" in deck) {
      res.status(400).json({ error: { code: "invalid_deck", message: deck.error } });
      return;
    }

    const side: number[] = [];
    const validation = validateDeck({ main: deck.main, extra: deck.extra, side }, catalog);
    if (!validation.legal) {
      res.status(400).json({
        error: { code: "invalid_deck", message: "Deck is not Edison-legal.", validation },
      });
      return;
    }

    // Persist join
    joinDuel(db, duelRow.id, userId, { main: deck.main, extra: deck.extra });

    // Start the engine asynchronously; fire-and-forget (engine is ready before first WS connect)
    const deck0 = JSON.parse(duelRow.deck0_json) as { main: number[]; extra: number[] };
    const seed = BigInt(JSON.parse(duelRow.seed_json) as string);

    // Set initial deadline for seat 0 (creator is on clock first)
    const onClockSeat: Seat = 0;
    const deadlineAt = computeDeadline(duelRow.timer_per_move_seconds);
    setDeadline(db, duelRow.id, deadlineAt, onClockSeat);

    // Start engine in background
    manager
      .createAndStart(duelRow.id, seed, deck0, { main: deck.main, extra: deck.extra })
      .catch((err: unknown) => {
        console.error("[duelRoutes] engine start failed:", err);
      });

    res.status(201).json({
      duelId: duelRow.id,
      seat: 1 as Seat,
      seatToken: duelRow.seat1_token,
    });
  });

  // GET /api/duels/:id — duel info (for polling / debugging)
  router.get("/:id", (req, res): void => {
    const row = getDuel(db, req.params["id"]!);
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
