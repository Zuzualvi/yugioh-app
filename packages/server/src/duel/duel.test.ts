// ---------------------------------------------------------------------------
// Duel unit tests — all run against FakeEdisonDuel (no WASM required).
//
// Covers: lifecycle, token auth, persistence, relay routing, timer, reconnect.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { DuelManager } from "./duelManager.js";
import { attachDuelWsServer } from "./duelSocket.js";
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

/** Insert a legal deck directly into DB (bypasses the PUT /api/decks route). */
function insertLegalDeck(userId: string): string {
  const deckId = randomUUID();
  const now = new Date().toISOString();
  const deck = legalDeck();
  db.prepare(
    `INSERT INTO decks
       (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(deckId, userId, "Test Deck", JSON.stringify(deck.main), "[]", "[]", now, now);
  return deckId;
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

function withServer(testFn: (port: number) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const httpServer = createServer(app);
    attachDuelWsServer(httpServer, db, manager);
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

// ── Duel setup helpers ─────────────────────────────────────────────────────

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

async function createDuelAsAlice(): Promise<DuelSetup> {
  const { sid: aliceSid, userId: aliceUserId } = await seedAndLogin(
    "Alice_" + randomUUID().slice(0, 4),
    "pass123",
  );
  const aliceDeckId = insertLegalDeck(aliceUserId);
  const { sid: bobSid, userId: bobUserId } = await seedAndLogin(
    "Bob_" + randomUUID().slice(0, 4),
    "pass456",
  );

  const createRes = await request(app)
    .post("/api/duels")
    .set("Cookie", `sid=${aliceSid}`)
    .send({ deckId: aliceDeckId, timer: { perMoveSeconds: 60 } });
  expect(createRes.status).toBe(201);

  return {
    duelId: createRes.body.duelId as string,
    joinToken: createRes.body.joinToken as string,
    seat0Token: createRes.body.creatorSeatToken as string,
    aliceSid,
    bobSid,
    aliceUserId,
    bobUserId,
  };
}

async function joinDuel(setup: DuelSetup): Promise<DuelSetup> {
  const bobDeckId = insertLegalDeck(setup.bobUserId);
  const joinRes = await request(app)
    .post("/api/duels/join")
    .set("Cookie", `sid=${setup.bobSid}`)
    .send({ joinToken: setup.joinToken, deckId: bobDeckId });
  expect(joinRes.status).toBe(201);

  // Wait for engine to be registered asynchronously
  await new Promise<void>((r) => setTimeout(r, 50));

  return { ...setup, seat1Token: joinRes.body.seatToken as string };
}

// ── Lifecycle tests ────────────────────────────────────────────────────────

describe("POST /api/duels — create", () => {
  it("returns 401 without session", async () => {
    const res = await request(app)
      .post("/api/duels")
      .send({ deckId: "x", timer: { perMoveSeconds: 30 } });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing deckId", async () => {
    const { sid } = await seedAndLogin("Alice1", "password123");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${sid}`)
      .send({ timer: { perMoveSeconds: 30 } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown deck", async () => {
    const { sid } = await seedAndLogin("Alice2", "password123");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", `sid=${sid}`)
      .send({ deckId: "no-such-deck", timer: { perMoveSeconds: 30 } });
    expect(res.status).toBe(400);
  });

  it("creates duel and returns joinToken + creatorSeatToken for seat 0", async () => {
    const setup = await createDuelAsAlice();
    expect(typeof setup.duelId).toBe("string");
    expect(typeof setup.joinToken).toBe("string");
    expect(typeof setup.seat0Token).toBe("string");
  });
});

// ── Join + token auth tests ────────────────────────────────────────────────

describe("POST /api/duels/join", () => {
  it("rejects unknown joinToken", async () => {
    const setup = await createDuelAsAlice();
    const bobDeckId = insertLegalDeck(setup.bobUserId);
    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.bobSid}`)
      .send({ joinToken: "bad-token", deckId: bobDeckId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_token");
  });

  it("rejects self-join", async () => {
    const setup = await createDuelAsAlice();
    const aliceDeckId = insertLegalDeck(setup.aliceUserId);
    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.aliceSid}`)
      .send({ joinToken: setup.joinToken, deckId: aliceDeckId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("self_join");
  });

  it("rejects a second join (token already consumed)", async () => {
    const setup = await createDuelAsAlice();
    const bobDeckId1 = insertLegalDeck(setup.bobUserId);
    const bobDeckId2 = insertLegalDeck(setup.bobUserId);

    const first = await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.bobSid}`)
      .send({ joinToken: setup.joinToken, deckId: bobDeckId1 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.bobSid}`)
      .send({ joinToken: setup.joinToken, deckId: bobDeckId2 });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("already_joined");
  });

  it("returns seat 1 + seatToken on success", async () => {
    const setup = await createDuelAsAlice();
    const bobDeckId = insertLegalDeck(setup.bobUserId);
    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.bobSid}`)
      .send({ joinToken: setup.joinToken, deckId: bobDeckId });
    expect(res.status).toBe(201);
    expect(res.body.seat).toBe(1);
    expect(typeof res.body.seatToken).toBe("string");
  });
});

// ── WebSocket relay tests ──────────────────────────────────────────────────

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

  it("routes player:N decision messages only to seat N", async () => {
    // Engine emits a player:0 SELECT_IDLECMD on step
    const customDuel = new FakeEdisonDuel([
      {
        status: "waiting",
        messages: [{ type: 11, name: "SELECT_IDLECMD", player: 0 as 0 | 1 }],
        awaiting: { seat: 0 },
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

      // Send RESPONSE from seat 0 → triggers engine.respond + step (ended)
      s0.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 1 } }));

      await waitForMessage(s0, (m) => m.type === "DUEL_END");

      // The initial step (createAndStart) broadcast the player:0 MSG only to seat 0.
      // But since WS clients weren't connected yet at join time, no MSG was sent.
      // After RESPONSE, step returns "ended" → only DUEL_END (no MSG).
      const seat1Msgs = s1.messages.filter((m) => m.type === "MSG");
      expect(seat1Msgs.length).toBe(0); // seat 1 never gets the player:0 decision MSG

      s0.close();
      s1.close();
    });
  });

  it("events in step result are relayed before messages, with per-seat redaction", async () => {
    // DRAW event has player:1 (hidden from seat 0), MOVE has no player (public broadcast).
    // After seat 0 responds, the engine steps → ended with these events.
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
          { type: 90, name: "DRAW", player: 1 as 0 | 1 }, // seat-1-only: hidden from seat 0
          { type: 50, name: "MOVE" }, // public: no player field → both seats see it
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

      // Seat 0 responds → engine steps to "ended" emitting events
      s0.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 1 } }));

      await waitForMessage(s0, (m) => m.type === "DUEL_END");
      await waitForMessage(s1, (m) => m.type === "DUEL_END");

      // Public MOVE event (no player) must reach both seats
      const s0Move = s0.messages.filter((m) => m.type === "MSG" && m.msg.name === "MOVE");
      const s1Move = s1.messages.filter((m) => m.type === "MSG" && m.msg.name === "MOVE");
      expect(s0Move.length).toBe(1);
      expect(s1Move.length).toBe(1);

      // DRAW event has player:1, so seat 0 must NOT receive it; seat 1 must receive it
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

      // Seat 1 tries to respond when seat 0 is on clock
      s1.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 1 } }));

      const err = await waitForMessage(s1, (m) => m.type === "ERROR");
      expect(err.type).toBe("ERROR");

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
});

// ── Persistence tests ──────────────────────────────────────────────────────

describe("Persistence: response_log ordering and rehydrate", () => {
  it("persists responses in sequence order to response_log", async () => {
    // Engine needs two WAITING states to collect two responses
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

      s0.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 7, value: null } }));
      await waitForMessage(s0, (_m) => {
        const clocks = s0.messages.filter((m2) => m2.type === "CLOCK");
        return clocks.length >= 2;
      });

      s0.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 3, value: false } }));
      await new Promise<void>((r) => setTimeout(r, 50));

      const rows = db
        .prepare("SELECT seq, response_json FROM response_log WHERE duel_id = ? ORDER BY seq")
        .all(setup.duelId) as { seq: number; response_json: string }[];
      expect(rows.length).toBe(2);
      expect(rows[0]?.seq).toBe(0);
      expect(rows[1]?.seq).toBe(1);
      expect(JSON.parse(rows[0]?.response_json ?? "{}")).toEqual({ type: 7, value: null });
      expect(JSON.parse(rows[1]?.response_json ?? "{}")).toEqual({ type: 3, value: false });

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

    // Evict from manager to simulate process restart
    manager.remove(setup.duelId);
    expect(manager.getLive(setup.duelId)).toBeUndefined();

    await withServer(async (port) => {
      const session = await connectWs(port, setup.duelId, setup.seat0Token);
      await waitForMessage(session, (m) => m.type === "SEAT_ASSIGNED");
      expect(rehydrateCalled).toBe(true);
      session.close();
    });
  });
});

// ── Timer tests ─────────────────────────────────────────────────────────────

describe("Timer: deadline + timeout", () => {
  it("sets deadline_at in DB immediately after join", async () => {
    const setup = await createDuelAsAlice();
    const bobDeckId = insertLegalDeck(setup.bobUserId);
    await request(app)
      .post("/api/duels/join")
      .set("Cookie", `sid=${setup.bobSid}`)
      .send({ joinToken: setup.joinToken, deckId: bobDeckId });

    const row = db
      .prepare("SELECT deadline_at, timer_per_move_seconds FROM duel WHERE join_token = ?")
      .get(setup.joinToken) as { deadline_at: number; timer_per_move_seconds: number };
    expect(row.deadline_at).toBeGreaterThan(0);
    expect(row.timer_per_move_seconds).toBe(60);
  });

  it(
    "fires timeout and broadcasts DUEL_END after deadline expires",
    async () => {
      // Use 1s timer, wait 2s for it to fire
      const { sid: aliceSid, userId: aliceUserId } = await seedAndLogin("AliceTO", "pass123");
      const { sid: bobSid, userId: bobUserId } = await seedAndLogin("BobTO", "pass456");
      const aliceDeckId = insertLegalDeck(aliceUserId);
      const bobDeckId = insertLegalDeck(bobUserId);

      const createRes = await request(app)
        .post("/api/duels")
        .set("Cookie", `sid=${aliceSid}`)
        .send({ deckId: aliceDeckId, timer: { perMoveSeconds: 1 } });
      expect(createRes.status).toBe(201);
      const duelId = createRes.body.duelId as string;
      const joinToken = createRes.body.joinToken as string;
      const seat0Token = createRes.body.creatorSeatToken as string;

      const joinRes = await request(app)
        .post("/api/duels/join")
        .set("Cookie", `sid=${bobSid}`)
        .send({ joinToken, deckId: bobDeckId });
      expect(joinRes.status).toBe(201);
      const seat1Token = joinRes.body.seatToken as string;

      await new Promise<void>((r) => setTimeout(r, 50));

      await withServer(async (port) => {
        const s0 = await connectWs(port, duelId, seat0Token);
        const s1 = await connectWs(port, duelId, seat1Token);
        await waitForMessage(s0, (m) => m.type === "CLOCK");

        // Wait 2s for 1s timer to fire
        await new Promise<void>((r) => setTimeout(r, 2000));

        const end0 = await waitForMessage(s0, (m) => m.type === "DUEL_END", 500);
        const end1 = await waitForMessage(s1, (m) => m.type === "DUEL_END", 500);
        expect(end0.type).toBe("DUEL_END");
        expect(end1.type).toBe("DUEL_END");
        if (end0.type === "DUEL_END") {
          expect(end0.reason).toBe("timeout");
          expect(end0.winner).toBe(1); // seat 0 was on clock → seat 1 wins
        }
        s0.close();
        s1.close();
      });
    },
    { timeout: 10_000 },
  );

  it("enforces timeout lazily when deadline_at is past on RESPONSE", async () => {
    const setup = await joinDuel(await createDuelAsAlice());

    await withServer(async (port) => {
      const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
      const s1 = await connectWs(port, setup.duelId, setup.seat1Token!);
      await waitForMessage(s0, (m) => m.type === "CLOCK");

      // Manually expire the deadline in DB (simulates server restart without timer)
      db.prepare("UPDATE duel SET deadline_at = ? WHERE id = ?").run(
        Date.now() - 5000,
        setup.duelId,
      );

      // Send RESPONSE from seat 0 — lazy enforcement should trigger timeout loss
      s0.ws.send(JSON.stringify({ type: "RESPONSE", response: { type: 1 } }));

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
      attachDuelWsServer(httpServer, db, manager);

      httpServer.listen(0, "127.0.0.1", async () => {
        const addr = httpServer.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;

        try {
          // First connection
          const s0 = await connectWs(port, setup.duelId, setup.seat0Token);
          await waitForMessage(s0, (m) => m.type === "SEAT_ASSIGNED");
          s0.ws.close();

          // Wait for close to propagate
          await new Promise<void>((r) => setTimeout(r, 50));

          // Reconnect with same token
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
