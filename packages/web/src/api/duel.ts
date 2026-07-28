/**
 * HTTP lifecycle for duels — legacy board join helpers.
 * NOTE: createDuel/joinDuel/getDuelJoinInfo are superseded by api/room.ts (ZUH-26).
 * This file is kept for the board socket flow.
 */

import type { CreateDuelBody, JoinDuelBody } from "@yugioh-app/contracts";
import { post } from "./client";

/** @deprecated Use createRoom from api/room.ts */
export function createDuel(body: CreateDuelBody): Promise<unknown> {
  return post<unknown>("/api/duels", body);
}

/** @deprecated Use claimRoom from api/room.ts */
export function joinDuel(body: JoinDuelBody): Promise<unknown> {
  return post<unknown>("/api/duels/join", body);
}
