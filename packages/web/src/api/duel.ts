/**
 * HTTP lifecycle for duels — create and join via link.
 * Shapes are exactly the contracts types (CreateDuelBody/Result, JoinDuelBody/Result).
 */

import type {
  CreateDuelBody,
  CreateDuelResult,
  JoinDuelBody,
  JoinDuelResult,
} from "@yugioh-app/contracts";
import { post } from "./client";

export function createDuel(body: CreateDuelBody): Promise<CreateDuelResult> {
  return post<CreateDuelResult>("/api/duels", body);
}

export function joinDuel(body: JoinDuelBody): Promise<JoinDuelResult> {
  return post<JoinDuelResult>("/api/duels/join", body);
}
