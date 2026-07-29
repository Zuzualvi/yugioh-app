// ---------------------------------------------------------------------------
// roomBroadcast — Socket registry: rooms → sockets → userId.
// Presence tracking and one armed deadline timer per room.
// ---------------------------------------------------------------------------

import { WebSocket } from "ws";
import type { RoomPresence, RoomServerMessage } from "@yugioh-app/contracts";
import type { DuelRoomRow } from "./roomStore.js";
import { closeRoom } from "./roomStore.js";
import { evaluateExpiry } from "./evaluateExpiry.js";
import { buildRoomSnapshot } from "./buildRoomSnapshot.js";
import { loadRoomView } from "./loadRoomView.js";
import type { RoomView } from "./loadRoomView.js";
import type { PresenceMap } from "./buildRoomSnapshot.js";
import Database from "better-sqlite3";

const AWAY_TIMEOUT_MS = 10_000; // 10 s with no socket → 'away'

interface SocketEntry {
  ws: WebSocket;
  userId: string;
}

interface RoomRegistry {
  sockets: Set<SocketEntry>;
  awayTimers: Map<string, ReturnType<typeof setTimeout>>; // userId → timer
  deadlineTimer: ReturnType<typeof setTimeout> | null;
}

// Global registry: roomId → RoomRegistry
const rooms = new Map<string, RoomRegistry>();

function getOrCreate(roomId: string): RoomRegistry {
  let r = rooms.get(roomId);
  if (!r) {
    r = { sockets: new Set(), awayTimers: new Map(), deadlineTimer: null };
    rooms.set(roomId, r);
  }
  return r;
}

/** Derive presence for a userId given current sockets. */
function derivePresence(registry: RoomRegistry, userId: string, row: DuelRoomRow): RoomPresence {
  if (row.creator_user_id !== userId && row.opponent_user_id !== userId) return "left";
  for (const entry of registry.sockets) {
    if (entry.userId === userId) return "connected";
  }
  return "away";
}

export function getPresenceMap(roomId: string, row: DuelRoomRow): PresenceMap {
  const registry = rooms.get(roomId) ?? {
    sockets: new Set(),
    awayTimers: new Map(),
    deadlineTimer: null,
  };
  return {
    creatorPresence: derivePresence(registry, row.creator_user_id, row),
    opponentPresence: row.opponent_user_id
      ? derivePresence(registry, row.opponent_user_id, row)
      : "away",
  };
}

function toWire(msg: RoomServerMessage): string {
  return JSON.stringify(msg);
}

/** Send a snapshot to every socket in this room, per-viewer. */
export function broadcastRoom(
  db: InstanceType<typeof Database>,
  roomId: string,
  view: RoomView,
  now: number,
): void {
  const registry = rooms.get(roomId);
  if (!registry || registry.sockets.size === 0) return;

  const presence = getPresenceMap(roomId, view.row);

  for (const entry of registry.sockets) {
    if (entry.ws.readyState !== WebSocket.OPEN) continue;
    const snapshot = buildRoomSnapshot(
      view.row,
      entry.userId,
      view.names,
      presence,
      now,
      view.deckInfo,
    );
    entry.ws.send(toWire({ type: "ROOM_STATE", snapshot }));
  }
}

/** Register a new socket for a room occupant. */
export function registerSocket(
  db: InstanceType<typeof Database>,
  roomId: string,
  userId: string,
  ws: WebSocket,
): void {
  const registry = getOrCreate(roomId);

  // Cancel any pending 'away' timer for this user
  const existing = registry.awayTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    registry.awayTimers.delete(userId);
  }

  const entry: SocketEntry = { ws, userId };
  registry.sockets.add(entry);

  ws.on("close", () => {
    registry.sockets.delete(entry);

    // Arm a 10 s timer before broadcasting 'away'
    const timer = setTimeout(() => {
      registry.awayTimers.delete(userId);
      const view = loadRoomView(db, roomId);
      if (view) {
        broadcastRoom(db, roomId, view, Date.now());
      }
      if (registry.sockets.size === 0 && registry.awayTimers.size === 0) {
        clearDeadlineTimer(roomId);
      }
    }, AWAY_TIMEOUT_MS);
    registry.awayTimers.set(userId, timer);
  });
}

/** Arm (or re-arm) the per-room deadline timer. */
export function armDeadlineTimer(
  db: InstanceType<typeof Database>,
  roomId: string,
  deadlineAt: number,
): void {
  const registry = getOrCreate(roomId);
  if (registry.deadlineTimer) clearTimeout(registry.deadlineTimer);

  const delay = Math.max(0, deadlineAt - Date.now());
  registry.deadlineTimer = setTimeout(() => {
    registry.deadlineTimer = null;
    const now = Date.now();
    const view = loadRoomView(db, roomId);
    if (!view) return;
    const { expired, reason } = evaluateExpiry(view.row, now);
    if (expired && reason) {
      closeRoom(db, roomId, reason, null);
      const fresh = loadRoomView(db, roomId);
      if (fresh) broadcastRoom(db, roomId, fresh, now);
    }
  }, delay);
}

export function clearDeadlineTimer(roomId: string): void {
  const registry = rooms.get(roomId);
  if (registry?.deadlineTimer) {
    clearTimeout(registry.deadlineTimer);
    registry.deadlineTimer = null;
  }
}
