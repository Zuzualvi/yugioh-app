// ---------------------------------------------------------------------------
// Duel unit tests — all run against FakeEdisonDuel (no WASM required).
//
// Covers: board-socket token auth, persistence, relay routing, timer, reconnect.
// Note: POST /api/duels and POST /api/duels/join HTTP tests are superseded by
//       the room flow (ZUH-26). Tests here seed the DB directly for board-socket setup.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { DuelManager } from "./duelManager.js";
import { attachDuelWsServer } from "./duelSocket.js";
import { createRoomWss } from "../room/roomSocket.js";
import { attachUpgradeRouter } from "../wsUpgradeRouter.js";
import { FakeEdisonDuel } from "./fakeEdisonDuel.js";
import type { DuelEngine, DuelEngineFactory, DuelEngineReplay } from "./engineInterface.js";
import type { DuelServerMessage } from "@yugioh-app/contracts";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import request from "supertest";
import type { Application } from "express";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { EDISON_FLAGS } from "@yugioh-app/engine";
import { computeDeadline } from "./timer.js";
import type { Seat } from "@yugioh-app/contracts";

// ── Catalog (uses fixture for proper deck validation) ─────────────────────

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

// Unlimited, non-extra-deck, non-alias passcodes from fixture (max 3 each)
const UNLIMITED_MAIN_CARDS = [
  89631139, 46986414, 70781052, 5405694, 29401950, 71413901, 28604635, 83011277, 23205979, 71564252,
  24508238, 80441106, 7572887, 89943723,
];

/** Build a legal 40-card main deck: 3 copies of 13 cards + 1 of the 14th. */
function legalDeck(): { main: number[]; extra: number[] } {
  const main: number[] = [];
  for (let i = 0; i < 13; i++) {
    const code = UNLIMITED_MAIN_CARDS[i]!;
    main.push(code, code, code);
  }
  main.push(UNLIMITED_MAIN_CARDS[13]!);
  return { main, extra: [] };
}

// ── Fake engine helpers ────────────────────────────────────────────────────

function twoStepDuel(): FakeEdisonDuel {
  return new FakeEdisonDuel([
    { status: "waiting", messages: [], awaiting: { seat: 0 } },
    { status: "ended", messages: [] },
  ]);
}

let _capturedEngine: FakeEdisonDuel | null = null;

function makeFakeFactory(duel?: FakeEdisonDuel): DuelEngineFactory {
  return async () => {
    const d = duel ?? twoStepDuel();
    _capturedEngine = d;
    return d as DuelEngine;
  };
}

const fakeReplay: DuelEngineReplay = async () => {
  const d = twoStepDuel();
  _capturedEngine = d;
  return d as DuelEngine;
};

// ── DB + App setup ────────────────────────────────────────────────────────

let db: Database.Database;
let app: Application;
let manager: DuelManager;
let catalog: LoadedCatalog;

beforeEach(() => {
  _capturedEngine = null;
  db = openDb(":memory:");
  catalog = makeTestCatalog();
  manager = new DuelManager(makeFakeFactory(), fakeReplay);
  app = createApp(db, catalog, manager);
});

afterEach(() => {
  db.close();
});

// ── Auth helpers ───────────────────────────────────────────────────────────

async function seedUser(displayName: string, password: string): Promise<{ userId: string }> {
  const userId = randomUUID();
  const pw = await hash(password);
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());
  return { userId };
}

async function login(displayName: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ displayName, password });
  const cookies = res.headers["set-cookie"] as string[] | undefined;
  return (
    cookies
      ?.find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? ""
  );
}

async function seedAndLogin(
  displayName: string,
  password: string,
): Promise<{ sid: string; userId: string }> {
  const { userId } = await seedUser(displayName, password);
  const sid = await login(displayName, password);
  return { sid, userId };
}

// ── WebSocket helpers ──────────────────────────────────────────────────────

interface WsSession {
  ws: WebSocket;
  messages: DuelServerMessage[];
  close(): void;
}

function connectWs(port: number, duelId: string, token: string): Promise<WsSession> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${duelId}/ws?token=${token}`);
    const messages: DuelServerMessage[] = [];
    ws.on("open", () => {
      resolve({ ws, messages, close: () => ws.close() });
    });
    ws.on("message", (data: Buffer) => {
      messages.push(JSON.parse(data.toString()) as DuelServerMessage);
    });
    ws.on("error", reject);
  });
}

function waitForMessage(
  session: WsSession,
  predicate: (m: DuelServerMessage) => boolean,
  timeoutMs = 1000,
): Promise<DuelServerMessage> {
  return new Promise((resolve, reject) => {
    const already = session.messages.find(predicate);
    if (already) {
      resolve(already);
      return;
    }
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), timeoutMs);
    session.ws.on("message", () => {
      const found = session.messages.find(predicate);
      if (found) {
        clearTimeout(timer);
        resolve(found);
      }
    });
  });
}

/** Creates a test HTTP server with both board and room WS upgrade routing. */
function withServer(testFn: (port: number) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const httpServer = createServer(app);
    const boardWss = attachDuelWsServer(httpServer, db, manager);
    const roomWss = createRoomWss();
    attachUpgradeRouter(httpServer, db, boardWss, roomWss);
    const sockets = new Set<import("net").Socket>();
    httpServer.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });

    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      testFn(port)
        .then(() => {
          for (const s of sockets) s.destroy();
          httpServer.close(() => resolve());
        })
        .catch((err: unknown) => {
          for (const s of sockets) s.destroy();
          httpServer.close(() => reject(err));
        });
    });
  });
}

// ── Direct DB duel setup helpers ──────────────────────────────────────────

interface DuelSetup {
  duelId: string;
  joinToken: string;
  seat0Token: string;
  seat1Token?: string;
  aliceSid: string;
  bobSid: string;
  aliceUserId: string;
  bobUserId: string;
}

/** Seeds a duel row directly — bypasses the superseded POST /api/duels endpoint. */
async function createDuelAsAlice(timerSeconds = 60): Promise<DuelSetup> {
  const { sid: aliceSid, userId: aliceUserId } = await seedAndLogin(
    "Alice_" + randomUUID().slice(0, 4),
    "pass123",
  );
  const { sid: bobSid, userId: bobUserId } = await seedAndLogin(
    "Bob_" + randomUUID().slice(0, 4),
    "pass456",
  );

  const duelId = randomUUID();
  const joinToken = randomUUID();
  const seat0Token = randomUUID();
  const seat1Token_unused = randomUUID();
  const seed =
    BigInt(Math.floor(Math.random() * 0xffffffff)) * 0x100000000n +
    BigInt(Math.floor(Math.random() * 0xffffffff));
  const deck = legalDeck();

  db.prepare(
    `INSERT INTO duel
       (id, join_token, seat0_token, seat1_token, seat0_user_id, seed_json,
        duel_flags, deck0_json, timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_for_opponent', ?)`,
  ).run(
    duelId,
    joinToken,
    seat0Token,
    seat1Token_unused,
    aliceUserId,
    JSON.stringify(seed.toString()),
    EDISON_FLAGS.toString(16),
    JSON.stringify(deck),
    timerSeconds,
    Date.now(),
  );

  return {
    duelId,
    joinToken,
    seat0Token,
    aliceSid,
    bobSid,
    aliceUserId,
    bobUserId,
  };
}

/** Seeds the join + starts the engine — bypasses the superseded POST /api/duels/join. */
async function joinDuel(setup: DuelSetup): Promise<DuelSetup> {
  const deck = legalDeck();
  const seat1Token = randomUUID();
  const onClockSeat: Seat = 0;

  // Read timer from the duel row
  const row = db.prepare("SELECT * FROM duel WHERE id = ?").get(setup.duelId) as {
    seed_json: string;
    deck0_json: string;
    timer_per_move_seconds: number;
    seat1_token: string;
  };

  const deadlineAt = computeDeadline(row.timer_per_move_seconds);

  db.prepare(
    `UPDATE duel
     SET seat1_user_id = ?, deck1_json = ?, seat1_token = ?, status = 'active',
         deadline_at = ?, on_clock_seat = ?
     WHERE id = ?`,
  ).run(setup.bobUserId, JSON.stringify(deck), seat1Token, deadlineAt, onClockSeat, setup.duelId);

  // Start engine in background (same as old join route did)
  const seed = BigInt(JSON.parse(row.seed_json) as string);
  const deck0 = JSON.parse(row.deck0_json) as { main: number[]; extra: number[] };
  await manager.createAndStart(setup.duelId, seed, deck0, deck);

  return { ...setup, seat1Token };
}

// ── Board-socket tests ─────────────────────────────────────────────────────

describe("WebSocket relay", () => {
  it("rejects bad token with ERROR", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const errorMsg = await new Promise<DuelServerMessage>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${setup.duelId}/ws?token=bad`);
        ws.on("message", (data: Buffer) => {
          resolve(JSON.parse(data.toString()) as DuelServerMessage);
        });
        ws.on("error", reject);
        ws.on("close", () => resolve({ type: "ERROR", message: "closed" }));
      });
      expect(errorMsg.type).toBe("ERROR");
    });
  });

  it("sends SEAT_ASSIGNED → STATE → CLOCK on valid connect", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");
      const assigned = s0.messages.find((m) => m.type === "SEAT_ASSIGNED");
      expect(assigned?.type).toBe("SEAT_ASSIGNED");
      if (assigned?.type === "SEAT_ASSIGNED") {
        expect(assigned.seat).toBe(0);
        expect(assigned.seatToken).toBe(setup.seat0Token);
      }
      await waitForMessage(s0, (m) => m.type === "STATE");
      await waitForMessage(s0, (m) => m.type === "CLOCK");
      s0.close();
    });
  });

  it("rejects a seat already occupied (no hijack)", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");

      const errorMsg = await new Promise<DuelServerMessage>((resolve, reject) => {
        const ws2 = new WebSocket(
          `ws://127.0.0.1:${port}/api/duels/${setup.duelId}/ws?token=${setup.seat0Token}`,
        );
        ws2.on("message", (data: Buffer) => {
          resolve(JSON.parse(data.toString()) as DuelServerMessage);
        });
        ws2.on("error", reject);
        ws2.on("close", () => resolve({ type: "ERROR", message: "closed" }));
      });
      expect(errorMsg.type).toBe("ERROR");
      if (errorMsg.type === "ERROR") expect(errorMsg.message).toContain("occupied");
      s0.close();
    });
  });

  it("routes DECISION frame only to the on-clock seat (Phase 1)", async () => {
    const customDuel = new FakeEdisonDuel([
      {
        status: "waiting",
        messages: [],
        awaiting: { seat: 0 },
        decision: { kind: "SelectYesNo", player: 0, description: "Test?" },
      },
      { status: "ended", messages: [] },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      const decisionMsg = await waitForMessage(s0, (m) => m.type === "DECISION");
      expect(decisionMsg.type).toBe("DECISION");
      if (decisionMsg.type === "DECISION") {
        expect(decisionMsg.decision.kind).toBe("SelectYesNo");
      }

      await waitForMessage(s1, (m) => m.type === "CLOCK");
      const s1Decisions = s1.messages.filter((m) => m.type === "DECISION");
      expect(s1Decisions.length).toBe(0);

      s0.ws.send(
        JSON.stringify({ type: "DECISION_RESPONSE", response: { kind: "SelectYesNo", yes: true } }),
      );
      await waitForMessage(s0, (m) => m.type === "DUEL_END");

      s0.close();
      s1.close();
    });
  });

  it("re-delivers the pending DECISION to the on-clock seat on connect (Fix #2)", async () => {
    const customDuel = new FakeEdisonDuel([
      {
        status: "waiting",
        messages: [],
        awaiting: { seat: 0 },
        decision: { kind: "SelectYesNo", player: 0, description: "Attack?" },
      },
      { status: "ended", messages: [] },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);

      const decision = await waitForMessage(s0, (m) => m.type === "DECISION");
      expect(decision.type).toBe("DECISION");
      if (decision.type === "DECISION") {
        expect(decision.decision.kind).toBe("SelectYesNo");
      }

      const s0Types = s0.messages.map((m) => m.type);
      expect(s0Types.indexOf("STATE")).toBeLessThan(s0Types.lastIndexOf("DECISION"));

      await waitForMessage(s1, (m) => m.type === "CLOCK");
      const s1Decisions = s1.messages.filter((m) => m.type === "DECISION");
      expect(s1Decisions.length).toBe(0);

      s0.close();
      s1.close();
    });
  });

  it("events in step result are relayed before messages, with per-seat redaction", async () => {
    const customDuel = new FakeEdisonDuel([
      {
        status: "waiting",
        messages: [],
        awaiting: { seat: 0 },
      },
      {
        status: "ended",
        messages: [],
        events: [
          { type: 90, name: "DRAW", player: 1 as 0 | 1 },
          { type: 50, name: "MOVE" },
        ],
      },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      s0.ws.send(
        JSON.stringify({ type: "DECISION_RESPONSE", response: { kind: "SelectYesNo", yes: true } }),
      );

      await waitForMessage(s0, (m) => m.type === "DUEL_END");
      await waitForMessage(s1, (m) => m.type === "DUEL_END");

      const s0Move = s0.messages.filter((m) => m.type === "MSG" && m.msg.name === "MOVE");
      const s1Move = s1.messages.filter((m) => m.type === "MSG" && m.msg.name === "MOVE");
      expect(s0Move.length).toBe(1);
      expect(s1Move.length).toBe(1);

      const s0Draw = s0.messages.filter((m) => m.type === "MSG" && m.msg.name === "DRAW");
      const s1Draw = s1.messages.filter((m) => m.type === "MSG" && m.msg.name === "DRAW");
      expect(s0Draw.length).toBe(0);
      expect(s1Draw.length).toBe(1);

      s0.close();
      s1.close();
    });
  });

  it("RESPONSE from wrong seat (not on clock) returns ERROR", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      s1.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 1 } }));

      const err = await waitForMessage(s1, (m) => m.type === "ERROR");
      expect(err.type).toBe("ERROR");

      s0.close();
      s1.close();
    });
  });

  it("DECISION_RESPONSE from wrong seat (not on clock) returns ERROR", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      s1.ws.send(
        JSON.stringify({ type: "DECISION_RESPONSE", response: { kind: "SelectYesNo", yes: true } }),
      );

      const err = await waitForMessage(s1, (m) => m.type === "ERROR");
      expect(err.type).toBe("ERROR");
      if (err.type === "ERROR") expect(err.message).toBe("not your turn");

      s0.close();
      s1.close();
    });
  });

  it("invalid DECISION_RESPONSE yields ERROR frame and no state change", async () => {
    const customDuel = new FakeEdisonDuel([
      { status: "waiting", messages: [], awaiting: { seat: 0 } },
      { status: "ended", messages: [] },
    ]);
    customDuel.setNextDecisionResponseResult({ ok: false, error: "kind mismatch" });
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      s0.ws.send(
        JSON.stringify({ type: "DECISION_RESPONSE", response: { kind: "SelectYesNo", yes: true } }),
      );

      const err = await waitForMessage(s0, (m) => m.type === "ERROR");
      expect(err.type).toBe("ERROR");
      if (err.type === "ERROR") expect(err.message).toBe("kind mismatch");

      await new Promise<void>((r) => setTimeout(r, 50));
      const duelEnds = s0.messages.filter((m) => m.type === "DUEL_END");
      expect(duelEnds.length).toBe(0);

      const rows = db
        .prepare("SELECT COUNT(*) as c FROM response_log WHERE duel_id = ?")
        .get(setup.duelId) as { c: number };
      expect(rows.c).toBe(0);

      s0.close();
      s1.close();
    });
  });

  it("valid DECISION_RESPONSE advances engine and persists response", async () => {
    const customDuel = new FakeEdisonDuel([
      { status: "waiting", messages: [], awaiting: { seat: 0 } },
      { status: "ended", messages: [] },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      const resp = { kind: "SelectYesNo", yes: true };
      s0.ws.send(JSON.stringify({ type: "DECISION_RESPONSE", response: resp }));

      await waitForMessage(s0, (m) => m.type === "DUEL_END");
      await waitForMessage(s1, (m) => m.type === "DUEL_END");

      const rows = db
        .prepare("SELECT response_json FROM response_log WHERE duel_id = ? ORDER BY seq")
        .all(setup.duelId) as { response_json: string }[];
      expect(rows.length).toBe(1);
      expect(JSON.parse(rows[0]?.response_json ?? "{}")).toEqual(resp);

      s0.close();
      s1.close();
    });
  });

  it("RESIGN broadcasts DUEL_END with reason=resign to both seats", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");
      await waitForMessage(s1, (m) => m.type === "SEAT_ASSIGNED");

      s0.ws.send(JSON.stringify({ type: "RESIGN" }));

      const end0 = await waitForMessage(s0, (m) => m.type === "DUEL_END");
      const end1 = await waitForMessage(s1, (m) => m.type === "DUEL_END");
      expect(end0.type).toBe("DUEL_END");
      expect(end1.type).toBe("DUEL_END");
      if (end0.type === "DUEL_END") {
        expect(end0.reason).toBe("resign");
        expect(end0.winner).toBe(1);
      }
      s0.close();
      s1.close();
    });
  });

  it("destroy() is called on engine when duel ends via resign", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");
      await waitForMessage(s1, (m) => m.type === "SEAT_ASSIGNED");

      expect(_capturedEngine?.destroyed).toBe(false);

      s0.ws.send(JSON.stringify({ type: "RESIGN" }));

      await waitForMessage(s0, (m) => m.type === "DUEL_END");
      await new Promise<void>((r) => setTimeout(r, 20));

      expect(_capturedEngine?.destroyed).toBe(true);
      expect(manager.getLive(setup.duelId)).toBeUndefined();

      s0.close();
      s1.close();
    });
  });

  it(
    "destroy() is called on engine when duel ends via timeout",
    async () => {
      const setup = await joinDuel(await createDuelAsAlice(1)); // 1s timer

      await withServer(async (port) => {
        const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
        const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
        await waitForMessage(s0, (m) => m.type === "CLOCK");

        expect(_capturedEngine?.destroyed).toBe(false);

        await new Promise<void>((r) => setTimeout(r, 2000));

        await waitForMessage(s0, (m) => m.type === "DUEL_END", 500);

        expect(_capturedEngine?.destroyed).toBe(true);
        expect(manager.getLive(setup.duelId)).toBeUndefined();

        s0.close();
        s1.close();
      });
    },
    { timeout: 10_000 },
  );
});

// ── Persistence tests ──────────────────────────────────────────────────────

describe("Persistence: response_log ordering and rehydrate", () => {
  it("persists DuelDecisionResponse in sequence order to response_log", async () => {
    const customDuel = new FakeEdisonDuel([
      { status: "waiting", messages: [], awaiting: { seat: 0 } },
      { status: "waiting", messages: [], awaiting: { seat: 0 } },
      { status: "ended", messages: [] },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      const resp1 = { kind: "SelectYesNo", yes: true };
      s0.ws.send(JSON.stringify({ type: "DECISION_RESPONSE", response: resp1 }));
      await waitForMessage(s0, (_m) => {
        const clocks = s0.messages.filter((m2) => m2.type === "CLOCK");
        return clocks.length >= 2;
      });

      const resp2 = { kind: "SelectYesNo", yes: false };
      s0.ws.send(JSON.stringify({ type: "DECISION_RESPONSE", response: resp2 }));
      await new Promise<void>((r) => setTimeout(r, 50));

      const rows = db
        .prepare("SELECT seq, response_json FROM response_log WHERE duel_id = ? ORDER BY seq")
        .all(setup.duelId) as { seq: number; response_json: string }[];
      expect(rows.length).toBe(2);
      expect(rows[0]?.seq).toBe(0);
      expect(rows[1]?.seq).toBe(1);
      expect(JSON.parse(rows[0]?.response_json ?? "{}")).toEqual(resp1);
      expect(JSON.parse(rows[1]?.response_json ?? "{}")).toEqual(resp2);

      s0.close();
      s1.close();
    });
  });

  it("rehydrates engine via replay when evicted from DuelManager", async () => {
    let rehydrateCalled = false;
    const replayFn: DuelEngineReplay = async () => {
      rehydrateCalled = true;
      return twoStepDuel() as DuelEngine;
    };
    manager = new DuelManager(makeFakeFactory(), replayFn);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());

    manager.remove(setup.duelId);
    expect(manager.getLive(setup.duelId)).toBeUndefined();

    await withServer(async (port) => {
      const session = await connectWs(port, setup.duelId, setup.seat0Token);
      await waitForMessage(session, (m) => m.type === "SEAT_ASSIGNED");
      expect(rehydrateCalled).toBe(true);
      session.close();
    });
  });

  it("restart → replay receives persisted DuelDecisionResponse[] log", async () => {
    const customDuel = new FakeEdisonDuel([
      { status: "waiting", messages: [], awaiting: { seat: 0 } },
      { status: "ended", messages: [] },
    ]);
    manager = new DuelManager(async () => {
      _capturedEngine = customDuel;
      return customDuel as DuelEngine;
    }, fakeReplay);
    app = createApp(db, catalog, manager);

    const setup = await joinDuel(await createDuelAsAlice());

    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      await waitForMessage(s0, (m) => m.type === "CLOCK");
      const resp = { kind: "SelectYesNo", yes: true };
      s0.ws.send(JSON.stringify({ type: "DECISION_RESPONSE", response: resp }));
      await waitForMessage(s0, (m) => m.type === "DUEL_END");
      s0.close();
    });

    const rows = db
      .prepare("SELECT response_json FROM response_log WHERE duel_id = ? ORDER BY seq")
      .all(setup.duelId) as { response_json: string }[];
    expect(rows.length).toBe(1);
    const persisted = JSON.parse(rows[0]?.response_json ?? "{}") as unknown;
    expect((persisted as Record<string, unknown>)["kind"]).toBe("SelectYesNo");
    expect((persisted as Record<string, unknown>)["type"]).toBeUndefined();
  });
});

// ── Timer tests ─────────────────────────────────────────────────────────────

describe("Timer: deadline + timeout", () => {
  it("sets deadline_at in DB after join", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    const row = db
      .prepare("SELECT deadline_at, timer_per_move_seconds FROM duel WHERE id = ?")
      .get(setup.duelId) as { deadline_at: number; timer_per_move_seconds: number };
    expect(row.deadline_at).toBeGreaterThan(0);
    expect(row.timer_per_move_seconds).toBe(60);
  });

  it(
    "fires timeout and broadcasts DUEL_END after deadline expires",
    async () => {
      const setup = await joinDuel(await createDuelAsAlice(1)); // 1s timer

      await withServer(async (port) => {
        const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
        const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
        await waitForMessage(s0, (m) => m.type === "CLOCK");

        await new Promise<void>((r) => setTimeout(r, 2000));

        const end0 = await waitForMessage(s0, (m) => m.type === "DUEL_END", 500);
        const end1 = await waitForMessage(s1, (m) => m.type === "DUEL_END", 500);
        expect(end0.type).toBe("DUEL_END");
        expect(end1.type).toBe("DUEL_END");
        if (end0.type === "DUEL_END") {
          expect(end0.reason).toBe("timeout");
          expect(end0.winner).toBe(1);
        }
        s0.close();
        s1.close();
      });
    },
    { timeout: 10_000 },
  );

  it("enforces timeout lazily when deadline_at is past on DECISION_RESPONSE", async () => {
    const setup = await joinDuel(await createDuelAsAlice());

    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      db.prepare("UPDATE duel SET deadline_at = ? WHERE id = ?").run(
        Date.now() - 5000,
        setup.duelId,
      );

      s0.ws.send(
        JSON.stringify({ type: "DECISION_RESPONSE", response: { kind: "SelectYesNo", yes: true } }),
      );

      const end0 = await waitForMessage(s0, (m) => m.type === "DUEL_END", 1000);
      expect(end0.type).toBe("DUEL_END");
      if (end0.type === "DUEL_END") {
        expect(end0.reason).toBe("timeout");
        expect(end0.winner).toBe(1);
      }

      s0.close();
      s1.close();
    });
  });

  it("CLOCK message contains onClockSeat=0 and valid deadlineAt", async () => {
    const setup = await joinDuel(await createDuelAsAlice());
    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const clock = await waitForMessage(s0, (m) => m.type === "CLOCK");
      expect(clock.type).toBe("CLOCK");
      if (clock.type === "CLOCK") {
        expect(clock.onClockSeat).toBe(0);
        expect(clock.deadlineAt).toBeGreaterThan(Date.now());
      }
      s0.close();
    });
  });
});

// ── Reconnect test ──────────────────────────────────────────────────────────

describe("Reconnection", () => {
  it("reconnects with same seatToken and receives fresh SEAT_ASSIGNED + STATE + CLOCK", async () => {
    const setup = await joinDuel(await createDuelAsAlice());

    let httpServer: HttpServer;

    await new Promise<void>((resolve, reject) => {
      httpServer = createServer(app);
      const boardWss = attachDuelWsServer(httpServer, db, manager);
      const roomWss = createRoomWss();
      attachUpgradeRouter(httpServer, db, boardWss, roomWss);

      httpServer.listen(0, "127.0.0.1", async () => {
        const addr = httpServer.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;

        try {
          const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
          await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");
          s0.ws.close();

          await new Promise<void>((r) => setTimeout(r, 50));

          const s0b = await connectWs(port, setup.duelId, setup.seat0Token);
          const assigned = await waitForMessage(s0b, (m) => m.type === "SEAT_ASSIGNED");
          expect(assigned.type).toBe("SEAT_ASSIGNED");
          const state = await waitForMessage(s0b, (m) => m.type === "STATE");
          expect(state.type).toBe("STATE");
          const clock = await waitForMessage(s0b, (m) => m.type === "CLOCK");
          expect(clock.type).toBe("CLOCK");
          s0b.close();

          httpServer.close(() => resolve());
        } catch (err) {
          httpServer.close(() => reject(err));
        }
      });
    });
  });
});

// ── Per-handover clock tests (ZUH-94, criterion 8) ──────────────────────────

describe("Per-handover clock: computeDeadline fires once per handover, not per decision", () => {
  it(
    "same seat making multiple consecutive decisions does not trigger a new deadline (6-decision tribute summon scenario)",
    async () => {
      // Simulate a tribute summon: 6 waiting steps all for seat 0, then ended.
      // Deadline should be computed once (on first handover from null→seat0),
      // not 6 times.
      const tributeSummonDuel = new FakeEdisonDuel([
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "IdleCommand",
            player: 0,
            summons: [],
            specialSummons: [],
            posChanges: [],
            monsterSets: [],
            spellSets: [],
            activates: [],
            toBattlePhase: false,
            toEndPhase: false,
          },
        },
        { status: "ended", messages: [] },
      ]);

      manager = new DuelManager(async () => {
        return tributeSummonDuel as DuelEngine;
      }, fakeReplay);
      app = createApp(db, catalog, manager);
      const setup = await joinDuel(await createDuelAsAlice());

      await withServer(async (port) => {
        const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
        const _s1 = await connectWs(port, setup.duelId, setup.seat1Token!);

        // Wait for first CLOCK (from initial connection)
        const firstClock = await waitForMessage(s0, (m) => m.type === "CLOCK");
        expect(firstClock.type).toBe("CLOCK");
        const firstDeadline = firstClock.type === "CLOCK" ? firstClock.deadlineAt : 0;
        expect(firstDeadline).toBeGreaterThan(0);

        // Helper: wait until session.messages has at least N CLOCKs
        const waitForNCLocks = (n: number): Promise<void> =>
          new Promise((resolve) => {
            const check = () => {
              if (s0.messages.filter((m) => m.type === "CLOCK").length >= n) {
                resolve();
              }
            };
            check();
            s0.ws.on("message", check);
          });

        // Send 5 more responses (6 total decisions for seat 0)
        for (let i = 0; i < 5; i++) {
          s0.ws.send(
            JSON.stringify({
              type: "DECISION_RESPONSE",
              response: { kind: "SelectYesNo", yes: true },
            }),
          );
        }

        // Wait until we have 6 CLOCKs total
        await waitForNCLocks(6);

        // All CLOCK frames for seat 0 decisions should have the SAME deadline
        const clocks = s0.messages.filter((m) => m.type === "CLOCK");
        expect(clocks.length).toBeGreaterThanOrEqual(6);

        const deadlines = clocks.map((m) => (m.type === "CLOCK" ? m.deadlineAt : 0));
        // All deadlines should be equal (same handover window — one computeDeadline call)
        const uniqueDeadlines = new Set(deadlines);
        expect(uniqueDeadlines.size).toBe(1);

        s0.close();
        _s1.close();
      });
    },
    { timeout: 15_000 },
  );
});

// ── C8.1: empty SelectZone/SelectDisfield rejected at socket level ───────────

describe("C8.1: empty SELECT_PLACE rejected at socket with ERROR", () => {
  it(
    "DECISION_RESPONSE with SelectZone and empty indices returns ERROR (not forwarded to engine)",
    async () => {
      // Script the engine to expect a SelectZone decision
      const selectZoneDuel = new FakeEdisonDuel([
        {
          status: "waiting",
          messages: [],
          awaiting: { seat: 0 },
          decision: {
            kind: "SelectZone",
            player: 0,
            count: 1,
            zones: [{ controller: 0, location: "MZONE", sequence: 0 }],
          },
        },
        { status: "ended", messages: [] },
      ]);

      manager = new DuelManager(async () => selectZoneDuel as DuelEngine, fakeReplay);
      app = createApp(db, catalog, manager);
      const setup = await joinDuel(await createDuelAsAlice());

      await withServer(async (port) => {
        const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
        const _s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
        await waitForMessage(s0, (m) => m.type === "CLOCK");

        s0.ws.send(
          JSON.stringify({
            type: "DECISION_RESPONSE",
            response: { kind: "SelectZone", indices: [] },
          }),
        );

        const error = await waitForMessage(s0, (m) => m.type === "ERROR");
        expect(error.type).toBe("ERROR");

        s0.close();
        _s1.close();
      });
    },
    { timeout: 10_000 },
  );
});
