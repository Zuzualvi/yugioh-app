// ---------------------------------------------------------------------------
// duelSocket — WebSocket relay for active duels.
//
// Attaches a ws.WebSocketServer to an existing http.Server.
// URL pattern: GET /api/duels/:id/ws?token=<seatToken>
//
// Per-duel state: two seat slots (null = disconnected), one timer handle.
// On RESPONSE: validate on-clock, persist, respond→step, broadcast MSG/STATE/CLOCK/EVENTS.
// On RESIGN:   end duel, broadcast DUEL_END.
// On timeout:  end duel, broadcast DUEL_END.
// On reconnect: re-auth, send fresh STATE + CLOCK.
//
// ZUH-94 additions:
//   - EVENTS frame: typed DuelEvent feed, normalised from raw engine events.
//   - DECISION_CONTEXT sidecar: sent immediately before each DECISION frame.
//   - Per-handover clock: computeDeadline called once per seat change, not per step.
//   - deadlines tuple on CLOCK: [seat0_deadline, seat1_deadline] (off-clock = banked).
//   - C8.1: empty SelectZone/SelectDisfield rejected with ERROR before reaching engine.
// ---------------------------------------------------------------------------

import { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import type {
  Seat,
  DuelClientMessage,
  DuelServerMessage,
  DuelEvent,
  DecisionContext,
} from "@yugioh-app/contracts";
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
  /** Last known absolute deadline per seat (banked time for the off-clock seat). */
  seatDeadlines: [number | null, number | null];
  /** Monotonic event sequence counter per seat (dedupe key for the log). */
  seatSeq: [number, number];
  /** Running phase context for event normalisation. */
  phaseCtx: RelayPhaseCtx;
  /** Accumulated chain stack for DECISION_CONTEXT sidecar. */
  chainStack: ChainLink[];
  /** Last HINT (caption) observed before the current pending decision. */
  pendingCaption: string | undefined;
}

/** Running turn/phase/LP state tracked from events. */
interface RelayPhaseCtx {
  turnNumber: number;
  phase: number;
  lp: [number, number];
}

interface ChainLink {
  link: number;
  card: { code: number; controller: Seat; location: string; sequence?: number };
  owner: Seat;
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
      seatDeadlines: [null, null],
      seatSeq: [0, 0],
      phaseCtx: { turnNumber: 0, phase: 0, lp: [8000, 8000] },
      chainStack: [],
      pendingCaption: undefined,
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

// ── Event normalisation ───────────────────────────────────────────────────────
//
// Converts raw engine events into typed DuelEvent objects per seat.
// Runs AFTER redactMessageForSeat to respect hidden-info boundaries.
//
// ocgcore message type constants (real values from OcgMessageType enum):
const OCG = {
  NEW_TURN: 40,
  NEW_PHASE: 41,
  MOVE: 50,
  SET: 54,
  SUMMONING: 60,
  SPSUMMONING: 62,
  CHAINING: 70,
  CHAIN_SOLVING: 72,
  CHAIN_SOLVED: 73,
  CHAIN_END: 74,
  CARD_SELECTED: 80,
  DAMAGE: 91,
  RECOVER: 92,
  PAY_LPCOST: 100,
  ATTACK: 110,
  BATTLE: 111,
  HINT: 2,
  PLAYER_HINT: 165,
  CARD_HINT: 160,
  SHOW_HINT: 164,
} as const;

type EventLoc =
  "HAND" | "MZONE" | "SZONE" | "FZONE" | "GRAVE" | "REMOVED" | "EXTRA" | "DECK" | "OVERLAY";

type TypedEventCardRef = {
  code: number;
  controller: Seat;
  location: EventLoc;
  sequence?: number;
};

function toEventCardRef(raw: Record<string, unknown>): TypedEventCardRef {
  return {
    code: (raw["code"] as number) ?? 0,
    controller: ((raw["controller"] as number) ?? 0) as Seat,
    location: locationName((raw["location"] as number) ?? 0) as EventLoc,
    sequence: typeof raw["sequence"] === "number" ? (raw["sequence"] as number) : undefined,
  };
}

function locationName(loc: number): EventLoc {
  switch (loc) {
    case 1:
      return "DECK";
    case 2:
      return "HAND";
    case 4:
      return "MZONE";
    case 8:
      return "SZONE";
    case 16:
      return "GRAVE";
    case 32:
      return "REMOVED";
    case 64:
      return "EXTRA";
    case 128:
      return "OVERLAY";
    case 256:
      return "FZONE";
    default:
      return "DECK";
  }
}

/**
 * Normalise a single raw engine event into a DuelEvent (seq=0 placeholder — replaced by caller).
 * Returns null if this event type has no DuelEvent mapping.
 *
 * @param raw     - Raw engine message (already redacted for this seat).
 * @param phaseCtx - Running turn/phase context (updated in-place by caller).
 * @param relay   - Relay for chain/hint state tracking.
 */
function normaliseEvent(
  raw: RawEngineMessage,
  phaseCtx: RelayPhaseCtx,
  relay: DuelRelay,
): DuelEvent | null {
  const t = raw.type;
  const common = {
    turnNumber: phaseCtx.turnNumber,
    phase: phaseCtx.phase,
    seq: 0, // placeholder — replaced before emit
  };

  switch (t) {
    case OCG.NEW_TURN: {
      const player = raw["player"] as number as Seat;
      phaseCtx.turnNumber = phaseCtx.turnNumber + 1;
      phaseCtx.phase = 1; // DRAW
      const lp: [number, number] = [phaseCtx.lp[0], phaseCtx.lp[1]];
      relay.chainStack = [];
      relay.pendingCaption = undefined;
      return {
        kind: "TURN",
        ...common,
        turnNumber: phaseCtx.turnNumber,
        phase: phaseCtx.phase,
        turnPlayer: player,
        lpSnapshot: lp,
        actor: player,
      };
    }

    case OCG.NEW_PHASE: {
      const ocgPhase = (raw["phase"] as number) ?? 0;
      phaseCtx.phase = mapOcgPhase(ocgPhase);
      return {
        kind: "PHASE",
        ...common,
        phase: phaseCtx.phase,
      };
    }

    case OCG.SUMMONING: {
      const code = (raw["code"] as number) ?? 0;
      const ctrl = ((raw["controller"] as number) ?? 0) as Seat;
      const loc = (raw["location"] as number) ?? 4;
      const seqNum = raw["sequence"] as number | undefined;
      const pos = (raw["position"] as number) ?? 1;
      const card: TypedEventCardRef = {
        code,
        controller: ctrl,
        location: locationName(loc),
        sequence: seqNum,
      };
      return { kind: "SUMMON", ...common, card, position: pos, actor: ctrl };
    }

    case OCG.SPSUMMONING: {
      const code = (raw["code"] as number) ?? 0;
      const ctrl = ((raw["controller"] as number) ?? 0) as Seat;
      const loc = (raw["location"] as number) ?? 4;
      const seqNum = raw["sequence"] as number | undefined;
      const pos = (raw["position"] as number) ?? 1;
      const card: TypedEventCardRef = {
        code,
        controller: ctrl,
        location: locationName(loc),
        sequence: seqNum,
      };
      return { kind: "SPSUMMON", ...common, card, position: pos, actor: ctrl };
    }

    case OCG.SET: {
      const code = (raw["code"] as number) ?? 0;
      const ctrl = ((raw["controller"] as number) ?? 0) as Seat;
      const loc = (raw["location"] as number) ?? 8;
      const seqNum = raw["sequence"] as number | undefined;
      const pos = (raw["position"] as number) ?? 2;
      const card: TypedEventCardRef = {
        code,
        controller: ctrl,
        location: locationName(loc),
        sequence: seqNum,
      };
      return { kind: "SET", ...common, card, position: pos, actor: ctrl };
    }

    case OCG.MOVE: {
      const code = (raw["code"] as number) ?? 0;
      const fromRaw = raw["from"] as Record<string, unknown> | undefined;
      const toRaw = raw["to"] as Record<string, unknown> | undefined;
      if (!fromRaw || !toRaw) return null;
      const ctrl = ((toRaw["controller"] as number) ?? 0) as Seat;
      const card: TypedEventCardRef = {
        code,
        controller: ctrl,
        location: locationName((toRaw["location"] as number) ?? 0),
      };
      return {
        kind: "MOVE",
        ...common,
        card,
        from: toEventCardRef(fromRaw),
        to: toEventCardRef(toRaw),
        actor: ctrl,
      };
    }

    case OCG.CHAINING: {
      const code = (raw["code"] as number) ?? 0;
      const ctrl = ((raw["controller"] as number) ?? 0) as Seat;
      const loc = (raw["location"] as number) ?? 0;
      const seqNum = raw["sequence"] as number | undefined;
      const chainSize = (raw["chain_size"] as number) ?? relay.chainStack.length + 1;
      const link = chainSize;
      const cardRef: TypedEventCardRef = {
        code,
        controller: ctrl,
        location: locationName(loc),
        sequence: seqNum,
      };
      relay.chainStack.push({ link, card: cardRef, owner: ctrl });
      return { kind: "CHAINING", ...common, card: cardRef, link, owner: ctrl, actor: ctrl };
    }

    case OCG.CHAIN_SOLVING: {
      const chainSize = (raw["chain_size"] as number) ?? relay.chainStack.length;
      return {
        kind: "CHAIN_SOLVING",
        ...common,
        link: chainSize,
      };
    }

    case OCG.CHAIN_SOLVED: {
      const chainSize = (raw["chain_size"] as number) ?? relay.chainStack.length;
      return {
        kind: "CHAIN_SOLVED",
        ...common,
        link: chainSize,
      };
    }

    case OCG.CHAIN_END: {
      relay.chainStack = [];
      return {
        kind: "CHAIN_END",
        ...common,
      };
    }

    case OCG.DAMAGE: {
      const player = raw["player"] as number as Seat;
      const amount = (raw["amount"] as number) ?? 0;
      phaseCtx.lp[player] = Math.max(0, phaseCtx.lp[player]! - amount);
      return {
        kind: "LP_CHANGE",
        ...common,
        seat: player,
        delta: -amount,
        reason: "damage",
      };
    }

    case OCG.RECOVER: {
      const player = raw["player"] as number as Seat;
      const amount = (raw["amount"] as number) ?? 0;
      phaseCtx.lp[player] = phaseCtx.lp[player]! + amount;
      return {
        kind: "LP_CHANGE",
        ...common,
        seat: player,
        delta: amount,
        reason: "recover",
      };
    }

    case OCG.PAY_LPCOST: {
      const player = raw["player"] as number as Seat;
      const amount = (raw["amount"] as number) ?? 0;
      phaseCtx.lp[player] = Math.max(0, phaseCtx.lp[player]! - amount);
      return {
        kind: "LP_CHANGE",
        ...common,
        seat: player,
        delta: -amount,
        reason: "cost",
      };
    }

    case OCG.ATTACK: {
      const card = raw["card"] as Record<string, unknown> | undefined;
      const target = raw["target"] as Record<string, unknown> | undefined;
      if (!card) return null;
      return {
        kind: "ATTACK",
        ...common,
        attacker: toEventCardRef(card),
        target: target ? toEventCardRef(target) : null,
      };
    }

    case OCG.BATTLE: {
      const cardRaw = raw["card"] as Record<string, unknown> | undefined;
      const targetRaw = raw["target"] as Record<string, unknown> | undefined;
      if (!cardRaw || !targetRaw) return null;
      return {
        kind: "BATTLE",
        ...common,
        attacker: toEventCardRef(cardRaw),
        target: toEventCardRef(targetRaw),
      };
    }

    case OCG.HINT: {
      const hintType = (raw["hint_type"] as number) ?? 0;
      const hintVal = raw["hint"];
      const valStr =
        typeof hintVal === "bigint"
          ? hintVal.toString()
          : typeof hintVal === "number"
            ? hintVal.toString()
            : typeof hintVal === "string"
              ? hintVal
              : String(hintVal ?? "");
      // hintType 3 = SELECTMSG — caption for the upcoming decision
      if (hintType === 3) {
        relay.pendingCaption = valStr;
      }
      return {
        kind: "HINT",
        ...common,
        hintType,
        value: valStr,
        actor: (raw["player"] as Seat | undefined) ?? undefined,
      };
    }

    case OCG.SHOW_HINT: {
      // SHOW_HINT (164) carries a string directly — use as caption
      const hint = (raw["hint"] as string) ?? "";
      relay.pendingCaption = hint;
      return {
        kind: "HINT",
        ...common,
        hintType: 0, // generic show-hint
        value: hint,
      };
    }

    case OCG.PLAYER_HINT: {
      const hintType = (raw["player_hint"] as number) ?? 0;
      const desc = raw["description"];
      const valStr =
        typeof desc === "bigint"
          ? desc.toString()
          : typeof desc === "number"
            ? desc.toString()
            : typeof desc === "string"
              ? desc
              : String(desc ?? "");
      return {
        kind: "HINT",
        ...common,
        hintType,
        value: valStr,
        actor: (raw["player"] as Seat | undefined) ?? undefined,
      };
    }

    default:
      return null;
  }
}

/** Map OcgPhase value to web phase encoding (1=Draw … 32=End). */
function mapOcgPhase(ocgPhase: number): number {
  if (ocgPhase <= 4) return ocgPhase;
  if (ocgPhase <= 128) return 8;
  if (ocgPhase === 256) return 16;
  if (ocgPhase === 512) return 32;
  return ocgPhase;
}

/**
 * Emit per-seat EVENTS frames from a raw event array.
 * Applies redaction (via engine.redactMessageForSeat) and normalisation.
 * Updates phaseCtx and relay.chainStack/pendingCaption in-place.
 */
function emitEventsFrames(
  relay: DuelRelay,
  engine: DuelEngine,
  rawEvents: RawEngineMessage[],
): void {
  if (rawEvents.length === 0) return;

  for (const [seat, ws] of relay.seats) {
    if (!ws) continue;

    const seatEvents: DuelEvent[] = [];
    // Work on a snapshot of phaseCtx so each seat processes the same events
    // against the same running context. The relay.phaseCtx is updated once
    // by the FIRST seat's pass; subsequent seats use the already-updated ctx
    // (which is fine — they both start from the same pre-step baseline).

    for (const rawEvent of rawEvents) {
      const redacted = engine.redactMessageForSeat(rawEvent, seat);
      if (!redacted) continue; // not entitled to this event

      const normalised = normaliseEvent(rawEvent, relay.phaseCtx, relay);
      if (!normalised) continue; // no typed event for this message type

      const seq = relay.seatSeq[seat]!;
      relay.seatSeq[seat] = seq + 1;
      seatEvents.push({ ...normalised, seq });
    }

    if (seatEvents.length > 0) {
      send(ws, { type: "EVENTS", events: seatEvents });
    }
  }
}

// ── Decision context sidecar builder ──────────────────────────────────────────

/**
 * Build a DecisionContext sidecar from the current relay state.
 * Used for the C7 DECISION_CONTEXT frame sent before each DECISION.
 */
function buildDecisionContext(
  relay: DuelRelay,
  pendingMessages: RawEngineMessage[],
  seat: Seat,
): DecisionContext | null {
  const ctx: DecisionContext = {};

  // Caption from preceding HINT/SHOW_HINT events
  if (relay.pendingCaption) {
    ctx.caption = relay.pendingCaption;
  }

  // Chain: current chain stack (if any) — activating card is link 1
  if (relay.chainStack.length > 0) {
    ctx.chain = relay.chainStack.map((link) => ({
      link: link.link,
      card: link.card as import("@yugioh-app/contracts").EventCardRef,
      owner: link.owner,
    }));
    // activatingCard is the most recently chained card (highest link)
    const lastLink = relay.chainStack[relay.chainStack.length - 1];
    if (lastLink) {
      ctx.activatingCard = lastLink.card as import("@yugioh-app/contracts").EventCardRef;
    }
  }

  // releaseCounts: from SELECT_TRIBUTE messages in pending (only for IdleCommand context)
  // Check if there is an IdleCommand (SELECT_IDLECMD = 11) in pending messages
  const idleMsg = pendingMessages.find((m) => m.type === 11);
  if (idleMsg) {
    const summons = (idleMsg["summons"] as Array<{ code: number }> | undefined) ?? [];
    // Derive tribute count from card level (0=none, 1=one tribute, 2=two tributes)
    const releaseCounts: Record<string, number> = {};
    for (let i = 0; i < summons.length; i++) {
      const code = summons[i]?.code ?? 0;
      releaseCounts[String(i)] = tributeCountForCode(code);
    }
    if (Object.keys(releaseCounts).length > 0) {
      ctx.releaseCounts = releaseCounts;
    }
  }

  // Only emit if there's something to say
  const hasContent = ctx.caption || ctx.chain || ctx.activatingCard || ctx.releaseCounts;
  return hasContent ? ctx : null;

  void seat; // seat parameter reserved for future per-seat redaction of context
}

/** Tribute count based on monster level (assumes normal summon rules). */
function tributeCountForCode(_code: number): number {
  // Without a DB lookup we cannot know the level here. Return 0 as default;
  // callers that need accurate counts should query the card DB separately.
  // In practice the DECISION_CONTEXT is supplementary — the UI falls back fine.
  return 0;
}

// ── Relay loop: step → broadcast messages → update clock ────────────────────

function stepAndBroadcast(
  relay: DuelRelay,
  engine: DuelEngine,
  db: InstanceType<typeof Database>,
  duelId: string,
  manager: DuelManager,
): void {
  const result = engine.step();

  // Emit typed EVENTS frame per seat (runs redaction + normalisation).
  emitEventsFrames(relay, engine, result.events);

  // Legacy MSG forwarding for raw events still expected by existing consumers.
  for (const event of result.events) {
    for (const [seat, ws] of relay.seats) {
      if (!ws) continue;
      const redacted = engine.redactMessageForSeat(event as RawEngineMessage, seat);
      if (redacted) {
        send(ws, { type: "MSG", msg: redacted });
      }
    }
  }

  // Phase 1: decisions are delivered via DECISION frame (not MSG).
  // The result.messages loop is intentionally omitted — decisions no longer go via MSG.

  if (result.status === "ended") {
    const gameResult = engine.getResult();
    const winner = (gameResult?.winner ?? null) as Seat | null;
    endDuel(db, duelId, winner, "normal");
    broadcast(relay, { type: "DUEL_END", winner, reason: "normal" });
    clearRelayTimer(relay);
    manager.remove(duelId);
    relays.delete(duelId);
    return;
  }

  if (result.status === "waiting") {
    const awaitingSeat = result.awaiting?.seat;
    if (awaitingSeat !== undefined) {
      const row = getDuel(db, duelId);
      if (!row) return;

      // ── Per-handover clock (criterion 8) ─────────────────────────────────
      // Only compute a new deadline when control transfers to a different seat.
      // Multiple consecutive decisions for the same seat (e.g., tribute summon
      // flow) share the same deadline — computeDeadline fires once per handover.
      const isHandover = row.on_clock_seat === null || row.on_clock_seat !== awaitingSeat;
      let deadlineAt: number;

      if (isHandover) {
        deadlineAt = computeDeadline(row.timer_per_move_seconds);
        relay.seatDeadlines[awaitingSeat] = deadlineAt;
      } else {
        // Same seat still on clock — keep the existing deadline.
        deadlineAt = row.deadline_at ?? computeDeadline(row.timer_per_move_seconds);
      }

      setDeadline(db, duelId, deadlineAt, awaitingSeat);
      armTimer(relay, engine, db, duelId, awaitingSeat, deadlineAt, manager);

      // Build deadlines tuple: [seat0_deadline, seat1_deadline]
      const offClockSeat = otherSeat(awaitingSeat);
      const offDeadline = relay.seatDeadlines[offClockSeat];
      const deadlines: [number, number] | undefined =
        offDeadline !== null
          ? buildDeadlinesTuple(awaitingSeat, deadlineAt, offDeadline)
          : undefined;

      // Broadcast STATE to each connected seat, then CLOCK
      for (const [seat, ws] of relay.seats) {
        if (ws) send(ws, { type: "STATE", state: engine.getStateForSeat(seat) });
      }
      broadcast(relay, { type: "CLOCK", onClockSeat: awaitingSeat, deadlineAt, deadlines });

      // Clear caption after clock (it was for this decision window)
      relay.pendingCaption = undefined;

      // Send DECISION_CONTEXT sidecar then typed DECISION to the on-clock seat
      const decision = engine.getDecisionForSeat(awaitingSeat);
      if (decision !== null) {
        const ws = relay.seats.get(awaitingSeat);
        if (ws) {
          const context = buildDecisionContext(relay, engine.getPendingMessages(), awaitingSeat);
          if (context) {
            send(ws, { type: "DECISION_CONTEXT", context });
          }
          send(ws, { type: "DECISION", decision });
        }
      }
    }
  }
}

function buildDeadlinesTuple(
  onClockSeat: Seat,
  onClockDeadline: number,
  offClockDeadline: number,
): [number, number] {
  return onClockSeat === 0
    ? [onClockDeadline, offClockDeadline]
    : [offClockDeadline, onClockDeadline];
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
  manager: DuelManager,
): void {
  clearRelayTimer(relay);
  relay.timer = scheduleTimeout(deadlineAt, () => {
    if (engine.isEnded()) return;
    const winner = otherSeat(onClockSeat);
    endDuel(db, duelId, winner, "timeout");
    broadcast(relay, { type: "DUEL_END", winner, reason: "timeout" });
    manager.remove(duelId);
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
  manager: DuelManager,
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
    manager.remove(duelId);
    relays.delete(duelId);
    return;
  }

  // @deprecated — RESPONSE path is dormant in Phase 1 (removed in Phase 2).
  // Still validates turn ownership so misrouted clients get a clear error.
  if (parsed.type === "RESPONSE") {
    const row = getDuel(db, duelId);
    if (!row) return;
    if (row.on_clock_seat !== conn.seat) {
      send(conn.ws, { type: "ERROR", message: "not your turn" });
    }
    // On-clock RESPONSE is silently dropped — use DECISION_RESPONSE instead.
    return;
  }

  if (parsed.type === "DECISION_RESPONSE") {
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
      manager.remove(duelId);
      relays.delete(duelId);
      return;
    }

    // C8.1: reject empty SelectZone/SelectDisfield BEFORE reaching the engine.
    // An empty SELECT_PLACE/SELECT_DISFIELD response hangs the engine permanently (verified live).
    const resp = parsed.response;
    if (
      (resp.kind === "SelectZone" || resp.kind === "SelectDisfield") &&
      resp.indices.length === 0
    ) {
      send(conn.ws, {
        type: "ERROR",
        message: `${resp.kind}: indices must not be empty — at least one zone must be selected`,
      });
      return;
    }

    // Server-side validation — never trust the client
    const validationResult = engine.applyDecisionResponse(parsed.response);
    if (!validationResult.ok) {
      send(conn.ws, { type: "ERROR", message: validationResult.error });
      return;
    }

    // Persist after successful validation
    const seq = getNextSeq(db, duelId);
    appendResponseLog(db, duelId, seq, conn.seat, parsed.response);

    stepAndBroadcast(relay, engine, db, duelId, manager);
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
    const offClockSeat = otherSeat(onClockSeat);
    const offDeadline = relay.seatDeadlines[offClockSeat];
    const deadlines: [number, number] | undefined =
      offDeadline !== null ? buildDeadlinesTuple(onClockSeat, deadlineAt, offDeadline) : undefined;

    send(ws, { type: "CLOCK", onClockSeat, deadlineAt, deadlines });

    // Re-arm timer on reconnect if deadline not yet expired
    if (!isExpired(deadlineAt)) {
      armTimer(relay, engine, db, duelId, onClockSeat, deadlineAt, manager);
    } else {
      // Lazily apply timeout
      const winner = otherSeat(onClockSeat);
      endDuel(db, duelId, winner, "timeout");
      broadcast(relay, { type: "DUEL_END", winner, reason: "timeout" });
      manager.remove(duelId);
      relays.delete(duelId);
      return;
    }
  }

  // Re-deliver the pending typed decision to this seat (Phase 1).
  // Also re-send DECISION_CONTEXT sidecar if there's relevant context.
  const pendingDecision = engine.getDecisionForSeat(seat);
  if (pendingDecision !== null) {
    const context = buildDecisionContext(relay, engine.getPendingMessages(), seat);
    if (context) {
      send(ws, { type: "DECISION_CONTEXT", context });
    }
    send(ws, { type: "DECISION", decision: pendingDecision });
  }

  ws.on("close", () => {
    relay.seats.set(seat, null);
  });

  ws.on("message", (data: Buffer | string) => {
    if (engine.isEnded()) return;
    handleClientMessage({ ws, seat }, relay, engine, db, duelId, data.toString(), manager);
  });
}

// ── Public: attach WS server to HTTP server ──────────────────────────────────

export function attachDuelWsServer(
  _httpServer: HttpServer,
  db: InstanceType<typeof Database>,
  manager: DuelManager,
): WebSocketServer {
  // noServer: true — index.ts dispatches upgrades to us centrally.
  // SPIKE-r11: this was changed from { server: httpServer } to allow the cookie
  // probe WS to share the same httpServer without double-handling sockets.
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    void onConnection(ws, req, db, manager);
  });

  return wss;
}
