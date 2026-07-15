/**
 * HTTP lifecycle for duels — create and join via link.
 * Shapes are exactly the contracts types (CreateDuelBody/Result, JoinDuelBody/Result).
 */

import type {
  CreateDuelBody,
  CreateDuelResult,
  JoinDuelBody,
  JoinDuelResult,
  PreJoinDuelInfo,
} from "@yugioh-app/contracts";
import { get, post } from "./client";

export function createDuel(body: CreateDuelBody): Promise<CreateDuelResult> {
  return post<CreateDuelResult>("/api/duels", body);
}

export function joinDuel(body: JoinDuelBody): Promise<JoinDuelResult> {
  return post<JoinDuelResult>("/api/duels/join", body);
}

/** Safe pre-join lookup: per-move timer + status, before accepting (INVITE-02). */
export function getDuelJoinInfo(joinToken: string): Promise<PreJoinDuelInfo> {
  return get<PreJoinDuelInfo>(`/api/duels/join/${joinToken}`);
}
