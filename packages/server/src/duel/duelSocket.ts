// ---------------------------------------------------------------------------
// duelSocket — WebSocket relay for active duels.
//
// Attaches a ws.WebSocketServer to an existing http.Server.
// URL pattern: GET /api/duels/:id/ws?token=<seatToken>
//
// Per-duel state: two seat slots (null = disconnected), one timer handle.
// On RESPONSE: validate on-clock, persist, respond→step, broadcast MSG/STATE/CLOCK.
// On RESIGN:   end duel, broadcast DUEL_END.
// On timeout:  end duel, broadcast DUEL_END.
// On reconnect: re-auth, send fresh STATE + CLOCK.
// ---------------------------------------------------------------------------

import { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import type { Seat, DuelClientMessage, DuelServerMessage } from "@yugioh-app/contracts";
import { DuelClientMessageSchema } from "@yugioh-app/contracts";
import type { DuelEngine, RawEngineMessage } from "./engineInterface.js";
import type { DuelManager } from "./duelManager.js";
import { getDuel, setDeadline, appendResponseLog, getNextSeq, endDuel } from "./duelStore.js";
import { computeDeadline, isExpired, scheduleTimeout, otherSeat } from "./timer.js";

// ── Per-duel relay state ────────────────────────────────────────────────────

interface SeatConn {
  ws: WebSocket;
  seat: Seat;
}

interface DuelRelay {
  duelId: string;
  seats: Map<Seat, WebSocket | null>;
  timer: ReturnType<typeof setTimeout> | null;
}

const relays = new Map<string, DuelRelay>();

function getOrCreateRelay(duelId: string): DuelRelay {
  let relay = relays.get(duelId);
  if (!relay) {
    relay = {
      duelId,
      seats: new Map([
        [0, null],
        [1, null],
      ]),
      timer: null,
    };
    relays.set(duelId, relay);
  }
  return relay;
}

// ── Wire helpers ─────────────────────────────────────────────────────────────

function toWire(msg: DuelServerMessage): string {
  return JSON.stringify(msg, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
}

function send(ws: WebSocket, msg: DuelServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(toWire(msg));
}

function broadcast(relay: DuelRelay, msg: DuelServerMessage): void {
  for (const [, ws] of relay.seats) {
    if (ws) send(ws, msg);
  }
}

// ── Relay loop: step → broadcast messages → update clock ────────────────────

function stepAndBroadcast(
  relay: DuelRelay,
  engine: DuelEngine,
  db: InstanceType<typeof Database>,
  duelId: string,
): void {
  const result = engine.step();

  // Broadcast per-seat redacted messages
  for (const msg of result.messages) {
    for (const [seat, ws] of relay.seats) {
      if (!ws) continue;
      const redacted = engine.redactMessageForSeat(msg as RawEngineMessage, seat);
      if (redacted) {
        send(ws, { type: "MSG", msg: redacted });
      }
    }
  }

  if (result.status === "ended") {
    const gameResult = engine.getResult();
    const winner = (gameResult?.winner ?? null) as Seat | null;
    endDuel(db, duelId, winner, "normal");
    broadcast(relay, { type: "DUEL_END", winner, reason: "normal" });
    clearRelayTimer(relay);
    relays.delete(duelId);
    return;
  }

  if (result.status === "waiting") {
    const awaitingSeat = result.awaiting?.seat;
    if (awaitingSeat !== undefined) {
      const row = getDuel(db, duelId);
      if (!row) return;
      const deadlineAt = computeDeadline(row.timer_per_move_seconds);
      setDeadline(db, duelId, deadlineAt, awaitingSeat);
      armTimer(relay, engine, db, duelId, awaitingSeat, deadlineAt);

      // Broadcast STATE to each connected seat, then CLOCK
      for (const [seat, ws] of relay.seats) {
        if (ws) send(ws, { type: "STATE", state: engine.getStateForSeat(seat) });
      }
      broadcast(relay, { type: "CLOCK", onClockSeat: awaitingSeat, deadlineAt });
    }
  }
}

// ── Timer management ─────────────────────────────────────────────────────────

function clearRelayTimer(relay: DuelRelay): void {
  if (relay.timer !== null) {
    clearTimeout(relay.timer);
    relay.timer = null;
  }
}

function armTimer(
  relay: DuelRelay,
  engine: DuelEngine,
  db: InstanceType<typeof Database>,
  duelId: string,
  onClockSeat: Seat,
  deadlineAt: number,
): void {
  clearRelayTimer(relay);
  relay.timer = scheduleTimeout(deadlineAt, () => {
    if (engine.isEnded()) return;
    const winner = otherSeat(onClockSeat);
    endDuel(db, duelId, winner, "timeout");
    broadcast(relay, { type: "DUEL_END", winner, reason: "timeout" });
    relays.delete(duelId);
  });
}

// ── Inbound message handler ──────────────────────────────────────────────────

function handleClientMessage(
  conn: SeatConn,
  relay: DuelRelay,
  engine: DuelEngine,
  db: InstanceType<typeof Database>,
  duelId: string,
  raw: string,
): void {
  let parsed: DuelClientMessage;
  try {
    const result = DuelClientMessageSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      send(conn.ws, { type: "ERROR", message: "invalid message" });
      return;
    }
    parsed = result.data;
  } catch {
    send(conn.ws, { type: "ERROR", message: "invalid JSON" });
    return;
  }

  if (parsed.type === "RESIGN") {
    const winner = otherSeat(conn.seat);
    endDuel(db, duelId, winner, "resign");
    clearRelayTimer(relay);
    broadcast(relay, { type: "DUEL_END", winner, reason: "resign" });
    relays.delete(duelId);
    return;
  }

  if (parsed.type === "RESPONSE") {
    // Lazy timeout enforcement
    const row = getDuel(db, duelId);
    if (!row) return;

    if (row.on_clock_seat !== conn.seat) {
      send(conn.ws, { type: "ERROR", message: "not your turn" });
      return;
    }

    if (isExpired(row.deadline_at)) {
      const winner = otherSeat(conn.seat);
      endDuel(db, duelId, winner, "timeout");
      clearRelayTimer(relay);
      broadcast(relay, { type: "DUEL_END", winner, reason: "timeout" });
      relays.delete(duelId);
      return;
    }

    const seq = getNextSeq(db, duelId);
    appendResponseLog(db, duelId, seq, conn.seat, parsed.response);
    engine.respond(parsed.response);
    stepAndBroadcast(relay, engine, db, duelId);
  }
}

// ── WebSocket connection handler ─────────────────────────────────────────────

async function onConnection(
  ws: WebSocket,
  req: IncomingMessage,
  db: InstanceType<typeof Database>,
  manager: DuelManager,
): Promise<void> {
  // Parse URL: /api/duels/:id/ws?token=<seatToken>
  const url = req.url ?? "/";
  const match = url.match(/\/api\/duels\/([^/?]+)\/ws/);
  if (!match) {
    send(ws, { type: "ERROR", message: "invalid path" });
    ws.close(4000, "invalid path");
    return;
  }
  const duelId = match[1]!;
  const token = new URLSearchParams(url.split("?")[1] ?? "").get("token") ?? "";

  // Load duel row
  const row = getDuel(db, duelId);
  if (!row || row.status === "waiting_for_opponent") {
    send(ws, { type: "ERROR", message: "duel not found or not started" });
    ws.close(4004, "duel not found");
    return;
  }

  // Auth: match token to a seat
  let seat: Seat;
  if (token === row.seat0_token) seat = 0;
  else if (token === row.seat1_token) seat = 1;
  else {
    send(ws, { type: "ERROR", message: "invalid token" });
    ws.close(4001, "invalid token");
    return;
  }

  // If duel already ended, just send the end state
  if (row.status === "ended") {
    send(ws, { type: "SEAT_ASSIGNED", seat, seatToken: token });
    send(ws, {
      type: "DUEL_END",
      winner: row.winner as Seat | null,
      reason: (row.end_reason ?? "normal") as "normal" | "timeout" | "resign",
    });
    ws.close();
    return;
  }

  const relay = getOrCreateRelay(duelId);

  // Reject duplicate seat (no hijack)
  const existing = relay.seats.get(seat);
  if (existing && existing.readyState === WebSocket.OPEN) {
    send(ws, { type: "ERROR", message: "seat already occupied" });
    ws.close(4002, "seat occupied");
    return;
  }

  // Get or rehydrate engine
  const live = await manager.getOrRehydrate(db, duelId);
  if (!live) {
    send(ws, { type: "ERROR", message: "engine unavailable" });
    ws.close(4003, "engine unavailable");
    return;
  }
  const { engine } = live;

  relay.seats.set(seat, ws);

  // Send SEAT_ASSIGNED
  send(ws, { type: "SEAT_ASSIGNED", seat, seatToken: token });

  // Send current STATE
  send(ws, { type: "STATE", state: engine.getStateForSeat(seat) });

  // Send current CLOCK (if active)
  const fresh = getDuel(db, duelId);
  if (fresh !== undefined && fresh.deadline_at !== null && fresh.on_clock_seat !== null) {
    const deadlineAt = fresh.deadline_at;
    const onClockSeat = fresh.on_clock_seat as Seat;

    send(ws, { type: "CLOCK", onClockSeat, deadlineAt });

    // Re-arm timer on reconnect if deadline not yet expired
    if (!isExpired(deadlineAt)) {
      armTimer(relay, engine, db, duelId, onClockSeat, deadlineAt);
    } else {
      // Lazily apply timeout
      const winner = otherSeat(onClockSeat);
      endDuel(db, duelId, winner, "timeout");
      broadcast(relay, { type: "DUEL_END", winner, reason: "timeout" });
      relays.delete(duelId);
      return;
    }
  }

  ws.on("close", () => {
    relay.seats.set(seat, null);
  });

  ws.on("message", (data: Buffer | string) => {
    if (engine.isEnded()) return;
    handleClientMessage({ ws, seat }, relay, engine, db, duelId, data.toString());
  });
}

// ── Public: attach WS server to HTTP server ──────────────────────────────────

export function attachDuelWsServer(
  httpServer: HttpServer,
  db: InstanceType<typeof Database>,
  manager: DuelManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: undefined });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Only handle duel WS paths
    const url = req.url ?? "/";
    if (!url.includes("/api/duels/")) {
      ws.close(4000, "unknown path");
      return;
    }
    void onConnection(ws, req, db, manager);
  });

  return wss;
}
