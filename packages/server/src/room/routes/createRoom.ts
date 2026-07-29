// ---------------------------------------------------------------------------
// createRoom — POST /api/duels
// T1: mints a duel_room row, returns { roomId, joinToken }.
// Requires session (mounted with requireSession in roomRouter).
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { CreateRoomBodySchema } from "@yugioh-app/contracts";
import { insertRoom } from "../roomStore.js";
import { ROOM_OPEN_TTL_MS } from "../roomState.js";

function generateId(): string {
  return randomBytes(12).toString("hex");
}

function generateJoinToken(): string {
  return randomBytes(16).toString("base64url");
}

export function createRoom(db: InstanceType<typeof Database>) {
  return (req: Request, res: Response): void => {
    const parsed = CreateRoomBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: "invalid_timer", message: "perMoveSeconds must be between 60 and 900." },
      });
      return;
    }

    const { timer } = parsed.data;
    const user = req.user!;
    const now = Date.now();
    const id = generateId();
    const joinToken = generateJoinToken();
    // seed is a large random bigint for the shuffle
    const seed = BigInt(`0x${randomBytes(8).toString("hex")}`);

    insertRoom(db, {
      id,
      joinToken,
      creatorUserId: user.id,
      perMoveSeconds: timer.perMoveSeconds,
      seed,
      roomDeadlineAt: now + ROOM_OPEN_TTL_MS,
      createdAt: now,
    });

    res.status(201).json({ roomId: id, joinToken });
  };
}
