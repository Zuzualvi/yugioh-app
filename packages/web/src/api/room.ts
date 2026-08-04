/**
 * HTTP API client for pre-duel room endpoints (ZUH-26, S0).
 * One typed function per endpoint, via the existing client.ts.
 */

import type {
  CreateRoomBody,
  CreateRoomResult,
  ClaimRoomBody,
  RoomSnapshot,
  PreJoinRoomInfo,
  PickDeckBody,
  SubmitChoiceBody,
  SeatCredential,
  ActiveDuelsResponse,
} from "@yugioh-app/contracts";
import { get, post } from "./client";

/** POST /api/duels — create a new room. */
export function createRoom(body: CreateRoomBody): Promise<CreateRoomResult> {
  return post<CreateRoomResult>("/api/duels", body);
}

/** GET /api/duels/join/:joinToken — unauthenticated-capable pre-join verdict. */
export function lookupJoinToken(joinToken: string): Promise<PreJoinRoomInfo> {
  return get<PreJoinRoomInfo>(`/api/duels/join/${encodeURIComponent(joinToken)}`);
}

/** POST /api/duels/join — claim the room as the opponent. Returns the caller's snapshot. */
export function claimRoom(body: ClaimRoomBody): Promise<RoomSnapshot> {
  return post<RoomSnapshot>("/api/duels/join", body);
}

/** GET /api/duels/:id/room — polling snapshot read (fallback when socket unavailable). */
export function getRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  return get<RoomSnapshot>(`/api/duels/${roomId}/room`);
}

/** POST /api/duels/:id/room/deck — pick or change deck. */
export function pickDeck(roomId: string, body: PickDeckBody): Promise<RoomSnapshot> {
  return post<RoomSnapshot>(`/api/duels/${roomId}/room/deck`, body);
}

/** POST /api/duels/:id/room/ready — lock deck and signal ready. */
export function ready(roomId: string): Promise<RoomSnapshot> {
  return post<RoomSnapshot>(`/api/duels/${roomId}/room/ready`);
}

/** POST /api/duels/:id/room/unready — unlock deck and un-ready. */
export function unready(roomId: string): Promise<RoomSnapshot> {
  return post<RoomSnapshot>(`/api/duels/${roomId}/room/unready`);
}

/** POST /api/duels/:id/room/leave — leave the room. */
export function leaveRoom(roomId: string): Promise<RoomSnapshot> {
  return post<RoomSnapshot>(`/api/duels/${roomId}/room/leave`);
}

/** POST /api/duels/:id/room/choice — flip winner submits first/second. */
export function submitChoice(roomId: string, body: SubmitChoiceBody): Promise<RoomSnapshot> {
  return post<RoomSnapshot>(`/api/duels/${roomId}/room/choice`, body);
}

/** GET /api/duels/:id/seat — retrieve seat credential after room reaches starting. */
export function getSeatCredential(roomId: string): Promise<SeatCredential> {
  return get<SeatCredential>(`/api/duels/${roomId}/seat`);
}

/** GET /api/duels/active — list the caller's non-ended duels. */
export function listActiveDuels(): Promise<ActiveDuelsResponse> {
  return get<ActiveDuelsResponse>("/api/duels/active");
}
