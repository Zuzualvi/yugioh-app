/**
 * Spike C — Relay Server
 *
 * Holds ONE authoritative duel (ocgcore-wasm, sync mode).
 * Two WebSocket clients connect on seats 0/1; each receives only its per-seat
 * redacted view of the engine message stream (REQ-NET-01/02, AC-12/13).
 *
 * Architecture: the server owns the duel and drives the game loop internally
 * using a scripted auto-responder (filler deck, normal-monster pass strategy).
 * Clients are authoritative observers: they receive the redacted message stream
 * over WebSocket.  This proves the relay/redaction layer without needing
 * bidirectional game control in this spike.
 *
 * Wire protocol (JSON over WS):
 *   Server → Client:
 *     { type: 'SEAT_ASSIGNED', seat, token }        — initial handshake
 *     { type: 'MSG', name, engineType, ...fields }  — redacted engine message
 *     { type: 'STATE', seat, zones, ... }            — board snapshot on reconnect
 *     { type: 'DUEL_END' }                           — duel finished
 *     { type: 'ERROR', message }                     — protocol/auth error
 *
 *   Client → Server: (reserved for future interactive play)
 *     { type: 'RESPONSE', data: <OcgResponse> }     — (ignored in this spike)
 */

import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import createCore, {
  OcgDuelMode, OcgProcessResult, OcgMessageType, OcgLocation, OcgPosition,
} from 'ocgcore-wasm';
import { getCard } from './db.js';
import { getScript } from './scripts.js';
import { fillerDeck, msgTypeName, scriptedResponder, passResponder } from './harness.js';
import { redactForViewer, buildBoardSnapshot } from './redactor.js';

// ── BigInt-safe JSON serialiser ───────────────────────────────────────────────

function toWire(obj) {
  return JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

// ── Relay class ───────────────────────────────────────────────────────────────

class DuelRelay {
  constructor(lib) {
    this.lib = lib;
    /** @type {Map<0|1, WebSocket|null>} */
    this.seats = new Map([[0, null], [1, null]]);
    /** token → seat */
    this.tokens = new Map();
    this.seatTokens = {};
    this.handle = null;
    this.duelStarted = false;
    this.duelEnded = false;
    // Game state tracking (for reconnect snapshot)
    this.currentTurn = 0;
    this.currentPhase = 0;
    this.lp = [8000, 8000];

    // Track hand contents from DRAW/MOVE messages (engine hides codes in queries for hand cards)
    // hand[player] = Map<sequence, code>  (simplified: just tracks all known hand codes)
    this.handCodes = { 0: new Set(), 1: new Set() };

    for (const seat of [0, 1]) {
      const token = randomUUID();
      this.tokens.set(token, seat);
      this.seatTokens[seat] = token;
    }
  }

  tokenForSeat(seat) { return this.seatTokens[seat]; }

  onConnect(ws, url) {
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const token = params.get('token');

    if (!token || !this.tokens.has(token)) {
      ws.send(toWire({ type: 'ERROR', message: 'invalid token' }));
      ws.close(4001, 'invalid token');
      return null;
    }

    const seat = this.tokens.get(token);

    // Reject if seat already has an active connection (no hijack)
    const existing = this.seats.get(seat);
    if (existing && existing.readyState === WebSocket.OPEN) {
      ws.send(toWire({ type: 'ERROR', message: 'seat already occupied' }));
      ws.close(4002, 'seat occupied');
      return null;
    }

    this.seats.set(seat, ws);
    ws.send(toWire({ type: 'SEAT_ASSIGNED', seat, token }));

    // Reconnect path: duel running or ended → send board snapshot
    if (this.duelStarted && this.handle) {
      const snapshot = buildBoardSnapshot(this.lib, this.handle, seat);
      // Augment with known hand codes (duelQueryLocation doesn't return codes for non-public cards)
      if (snapshot.zones?.p0_hand && this.handCodes[0].size > 0) {
        snapshot.zones.p0_hand = [...this.handCodes[0]].map(code => ({ code }));
      }
      if (snapshot.zones?.p1_hand) {
        // Opponent hand: show count (from engine query) but codes always 0
        snapshot.zones.p1_hand = (snapshot.zones.p1_hand ?? [])
          .filter(Boolean)
          .map(() => ({ code: 0 }));
      }
      ws.send(toWire({
        type: 'STATE',
        seat,
        duelEnded: this.duelEnded,
        currentTurn: this.currentTurn,
        currentPhase: this.currentPhase,
        lp: [...this.lp],
        ...snapshot,
      }));
    }

    ws.on('close', () => { this.seats.set(seat, null); });

    // Start duel when both seats filled for the first time
    if (!this.duelStarted && this.seats.get(0) && this.seats.get(1)) {
      this.duelStarted = true;
      this._runDuel(); // no await: runs synchronously with periodic event-loop yields
    }

    return seat;
  }

  /**
   * Run the duel to completion using an internal scripted auto-responder.
   * Yields to the event loop periodically so WS broadcasts can flush.
   */
  async _runDuel() {
    const lib = this.lib;

    // Player-0 uses scripted responder (set+flip); player-1 passes always
    const scriptState = {};
    const p0Responder = scriptedResponder(scriptState);
    const respond = (msgs) => p0Responder(msgs);

    const deck0 = fillerDeck();
    const deck1 = fillerDeck();

    const errors = [];
    this.handle = lib.createDuel({
      flags: OcgDuelMode.MODE_GOAT,
      seed: [100n, 200n, 300n, 400n],
      team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
      team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
      cardReader:   (code) => { const c = getCard(code); if (!c) errors.push(`missing:${code}`); return c ?? null; },
      scriptReader: (name) => getScript(name) ?? null,
      errorHandler: (_t, txt) => errors.push(txt),
    });

    if (!this.handle) {
      this._broadcastAll({ type: 'ERROR', message: 'failed to create duel' });
      return;
    }

    for (const code of deck0) {
      lib.duelNewCard(this.handle, { code, team: 0, duelist: 0, controller: 0, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
    }
    for (const code of deck1) {
      lib.duelNewCard(this.handle, { code, team: 1, duelist: 0, controller: 1, location: OcgLocation.DECK, sequence: 0, position: OcgPosition.FACEDOWN });
    }
    lib.startDuel(this.handle);

    let iter = 0;
    const MAX_ITER = 200000;
    let yieldCounter = 0;
    let turnCount = 0;
    const TURN_LIMIT = 8; // Stop after 8 turns (enough to prove redaction)

    while (iter++ < MAX_ITER) {
      const status = lib.duelProcess(this.handle);
      const msgs   = lib.duelGetMessage(this.handle);

      for (const m of msgs) {
        if (m.type === OcgMessageType.NEW_TURN) turnCount++;
        this._trackState(m);
        this._broadcastMsg(m);
      }

      if (status === OcgProcessResult.END || turnCount >= TURN_LIMIT) {
        this.duelEnded = true;
        this._broadcastAll({ type: 'DUEL_END' });
        break;
      }

      if (status === OcgProcessResult.WAITING) {
        const resp = respond(msgs);
        lib.duelSetResponse(this.handle, resp);
      }

      // Yield to event loop every 100 iterations so WS messages flush
      if (++yieldCounter % 100 === 0) {
        await new Promise(r => setImmediate(r));
      }
    }

    if (errors.length > 0) {
      console.error('  Duel errors:', errors.slice(0, 5).join('; '));
    }
  }

  _trackState(msg) {
    if (msg.type === OcgMessageType.NEW_TURN)  this.currentTurn = msg.player;
    if (msg.type === OcgMessageType.NEW_PHASE) this.currentPhase = msg.phase;
    if (msg.type === OcgMessageType.LPUPDATE)  this.lp[msg.player] = msg.lp;
    if (msg.type === OcgMessageType.DAMAGE)    this.lp[msg.player] = Math.max(0, (this.lp[msg.player] ?? 8000) - (msg.damage ?? 0));
    if (msg.type === OcgMessageType.RECOVER)   this.lp[msg.player] = (this.lp[msg.player] ?? 0) + (msg.recover ?? 0);
    // Track hand codes for reconnect STATE (engine withholds codes in duelQueryLocation for non-public cards)
    if (msg.type === OcgMessageType.DRAW && msg.drawn) {
      for (const c of msg.drawn) {
        if (c.code) this.handCodes[msg.player].add(c.code);
      }
    }
    if (msg.type === OcgMessageType.MOVE) {
      const { from, to } = msg;
      // Card leaving hand
      if (from && (from.location & OcgLocation.HAND) !== 0 && msg.card) {
        this.handCodes[from.controller]?.delete(msg.card);
      }
      // Card entering hand (from grave, removed zone, etc.)
      if (to && (to.location & OcgLocation.HAND) !== 0 && msg.card) {
        this.handCodes[to.controller]?.add(msg.card);
      }
    }
  }

  _broadcastMsg(msg) {
    const name = msgTypeName(msg.type);
    for (const seat of [0, 1]) {
      const redacted = redactForViewer(msg, seat);
      if (!redacted) continue;
      // Keep engineType separate so envelope `type: 'MSG'` is not overwritten
      const { type: engineType, ...fields } = redacted;
      const wire = toWire({ type: 'MSG', name, engineType, ...fields });
      const ws = this.seats.get(seat);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(wire);
      }
    }
  }

  _broadcastAll(obj) {
    const wire = toWire(obj);
    for (const ws of this.seats.values()) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(wire);
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function createRelayServer(port = 0) {
  const lib = await createCore({ sync: true });
  const relay = new DuelRelay(lib);

  const httpServer = createHttpServer();
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    relay.onConnect(ws, req.url ?? '/');
  });

  await new Promise(resolve => httpServer.listen(port, '127.0.0.1', resolve));
  const actualPort = httpServer.address().port;

  return { server: httpServer, wss, relay, port: actualPort };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const PORT = parseInt(process.env.PORT ?? '7777');
  const { relay, port } = await createRelayServer(PORT);
  console.log(`Relay server listening on ws://127.0.0.1:${port}`);
  console.log('Seat tokens:');
  console.log(`  Seat 0: ${relay.tokenForSeat(0)}`);
  console.log(`  Seat 1: ${relay.tokenForSeat(1)}`);
}
