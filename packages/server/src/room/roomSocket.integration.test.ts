// ---------------------------------------------------------------------------
// roomSocket integration — reaches /api/duels/:id/room/ws through the same
// wiring used in production (createApp → httpServer → attachUpgradeRouter).
// Covers: rejection shapes (C9), dual-socket per occupant (C9 criterion 9),
// restart resilience at open/filled/awaiting_choice (C12).
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import type { Server as HttpServer } from "node:http";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { DuelManager } from "../duel/duelManager.js";
import { attachDuelWsServer } from "../duel/duelSocket.js";
import { createRoomWss } from "./roomSocket.js";
import { attachUpgradeRouter } from "../wsUpgradeRouter.js";
import { insertRoom, getRoom, claimSlot } from "./roomStore.js";
import type { DuelRoomRow } from "./roomStore.js";
import { FakeEdisonDuel } from "../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../duel/engineInterface.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Application } from "express";

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

let db: Database.Database;
let app: Application;
let httpServer: HttpServer;
let port: number;

async function seedUserAndLogin(
  displayName: string,
  appOverride?: Application,
): Promise<{ sid: string; userId: string }> {
  const userId = randomUUID();
  const pw = await hash("password123");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());

  const res = await request(appOverride ?? app)
    .post("/api/auth/login")
    .send({ displayName, password: "password123" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  const sid =
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? "";
  return { sid, userId };
}

function buildServer(dbHandle: Database.Database): {
  httpServer: HttpServer;
  app: Application;
  getPort: () => Promise<number>;
} {
  const catalog = makeTestCatalog();
  const manager = new DuelManager(
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
    async () =>
      new FakeEdisonDuel([
        { status: "waiting", messages: [], awaiting: { seat: 0 } },
      ]) as DuelEngine,
  );
  const localApp = createApp(dbHandle, catalog, manager);
  const srv = createServer(localApp);
  const boardWss = attachDuelWsServer(srv, dbHandle, manager);
  const roomWss = createRoomWss();
  attachUpgradeRouter(srv, dbHandle, boardWss, roomWss);

  return {
    httpServer: srv,
    app: localApp,
    getPort: () =>
      new Promise<number>((resolve) => {
        srv.listen(0, "127.0.0.1", () => {
          const addr = srv.address();
          resolve(typeof addr === "object" && addr ? addr.port : 0);
        });
      }),
  };
}

function wsUrl(p: number, roomId: string): string {
  return `ws://127.0.0.1:${p}/api/duels/${roomId}/room/ws`;
}

function collectFirstMessage(
  p: number,
  roomId: string,
  sid: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(p, roomId), { headers: { Cookie: `sid=${sid}` } });
    ws.on("message", (data: Buffer) => {
      ws.close();
      resolve(JSON.parse(data.toString()) as Record<string, unknown>);
    });
    ws.on("error", reject);
    ws.on("unexpected-response", (_req, res) => {
      reject(new Error(`Unexpected HTTP ${res.statusCode}`));
    });
  });
}

beforeEach(async () => {
  db = openDb(":memory:");
  const built = buildServer(db);
  app = built.app;
  httpServer = built.httpServer;
  port = await built.getPort();
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  db.close();
});

// ── Rejection shapes (C9) ─────────────────────────────────────────────────

describe("room socket — rejection shapes (C9)", () => {
  it("rejects with 403 when Origin is not in allowlist", async () => {
    const { userId } = await seedUserAndLogin("Alice");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl(port, roomId), {
        headers: { Origin: "https://evil.example.com" },
      });
      ws.on("unexpected-response", (_req, res) => {
        expect(res.statusCode).toBe(403);
        resolve();
      });
      ws.on("open", () => {
        ws.close();
        reject(new Error("Expected 403 but socket opened"));
      });
      ws.on("error", (err: NodeJS.ErrnoException) => {
        if (err.message?.includes("403") || err.code === "ECONNRESET") resolve();
        else reject(err);
      });
    });
  });

  it("rejects with 401 when no session cookie", async () => {
    const creatorId = randomUUID();
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    ).run(creatorId, "Bob", await hash("pw"), new Date().toISOString());

    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl(port, roomId)); // no cookie
      ws.on("unexpected-response", (_req, res) => {
        expect(res.statusCode).toBe(401);
        resolve();
      });
      ws.on("open", () => {
        ws.close();
        reject(new Error("Expected 401 but socket opened"));
      });
      ws.on("error", (err: NodeJS.ErrnoException) => {
        if (err.message?.includes("401") || err.code === "ECONNRESET") resolve();
        else reject(err);
      });
    });
  });

  it("rejects non-occupant with exactly 403", async () => {
    const { userId: creatorId } = await seedUserAndLogin("Creator");
    const { sid: intruderSid } = await seedUserAndLogin("Intruder");

    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(wsUrl(port, roomId), {
        headers: { Cookie: `sid=${intruderSid}` },
      });
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => {
        ws.close();
        resolve(200); // unexpected success
      });
      ws.on("error", () => resolve(0));
    });
    expect(status).toBe(403);
  });

  it("sends ROOM_STATE on connect for a valid occupant", async () => {
    const { sid, userId } = await seedUserAndLogin("Owner");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const msg = await collectFirstMessage(port, roomId, sid);
    expect(msg["type"]).toBe("ROOM_STATE");
    const snap = msg["snapshot"] as Record<string, unknown>;
    expect(snap["roomId"]).toBe(roomId);
    expect(snap["status"]).toBe("open");
  });
});

// ── Two concurrent sockets per occupant (C9, criterion 9) ─────────────────

describe("room socket — two sockets for one occupant (C9)", () => {
  it("both sockets receive ROOM_STATE when the same occupant connects twice", async () => {
    const { sid, userId } = await seedUserAndLogin("Dual");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    function openAndCollect(): Promise<Record<string, unknown>> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl(port, roomId), { headers: { Cookie: `sid=${sid}` } });
        ws.on("message", (data: Buffer) => {
          ws.close();
          resolve(JSON.parse(data.toString()) as Record<string, unknown>);
        });
        ws.on("error", reject);
        ws.on("unexpected-response", (_req, res) => {
          reject(new Error(`Rejected with ${res.statusCode}`));
        });
      });
    }

    // Open two sockets for the same occupant simultaneously
    const [msg1, msg2] = await Promise.all([openAndCollect(), openAndCollect()]);

    expect(msg1["type"]).toBe("ROOM_STATE");
    expect(msg2["type"]).toBe("ROOM_STATE");
    // Both see the same roomId
    expect((msg1["snapshot"] as Record<string, unknown>)["roomId"]).toBe(roomId);
    expect((msg2["snapshot"] as Record<string, unknown>)["roomId"]).toBe(roomId);
  });
});

// ── Restart resilience (C12) ──────────────────────────────────────────────
// Kill and rebuild the DB handle + server; verify each status resumes from the
// row alone with the same outcome (flip not re-rolled, status unchanged).

describe("restart resilience (C12)", () => {
  async function buildFreshServer(p: { port: number }) {
    const built = buildServer(db); // same in-memory DB handle
    p.port = await built.getPort();
    return built.httpServer;
  }

  it("open: resumes after restart — same row, same outcome", async () => {
    const { sid, userId } = await seedUserAndLogin("OpenCreator");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: userId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const rowBefore = getRoom(db, roomId)!;

    // "Restart" — close server and open a new one on the same DB
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    const p = { port: 0 };
    const srv2 = await buildFreshServer(p);

    // Re-login (session still valid in DB)
    const msg = await collectFirstMessage(p.port, roomId, sid);
    expect(msg["type"]).toBe("ROOM_STATE");
    const snap = msg["snapshot"] as Record<string, unknown>;
    expect(snap["status"]).toBe("open");
    expect(snap["roomId"]).toBe(roomId);

    const rowAfter = getRoom(db, roomId)!;
    expect(rowAfter.status).toBe(rowBefore.status);
    expect(rowAfter.room_deadline_at).toBe(rowBefore.room_deadline_at);

    await new Promise<void>((resolve) => srv2.close(() => resolve()));
    // Restore for afterEach
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    port = (httpServer.address() as { port: number }).port;
  });

  it("filled: resumes after restart — opponent preserved, no state change", async () => {
    const { userId: creatorId } = await seedUserAndLogin("FilledCreator");
    const { sid: opponentSid, userId: opponentId } = await seedUserAndLogin("FilledOpponent");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    claimSlot(db, roomId, opponentId, Date.now());

    const rowBefore = getRoom(db, roomId)!;
    expect(rowBefore.status).toBe("filled");

    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    const p = { port: 0 };
    const srv2 = await buildFreshServer(p);

    const msg = await collectFirstMessage(p.port, roomId, opponentSid);
    expect(msg["type"]).toBe("ROOM_STATE");
    const snap = msg["snapshot"] as Record<string, unknown>;
    expect(snap["status"]).toBe("filled");

    const rowAfter = getRoom(db, roomId)!;
    expect(rowAfter.opponent_user_id).toBe(rowBefore.opponent_user_id);
    expect(rowAfter.status).toBe("filled");

    await new Promise<void>((resolve) => srv2.close(() => resolve()));
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    port = (httpServer.address() as { port: number }).port;
  });

  it("awaiting_choice: flip survives restart — winner and rolled_at unchanged", async () => {
    const { sid: creatorSid, userId: creatorId } = await seedUserAndLogin("FlipCreator");
    const { userId: opponentId } = await seedUserAndLogin("FlipOpponent");
    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorId,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    // Manually set to awaiting_choice with a persisted flip
    const flipWinner = creatorId;
    const flipRolledAt = 99999;
    db.prepare(
      `UPDATE duel_room SET status='awaiting_choice', opponent_user_id=?,
       flip_winner_user_id=?, flip_rolled_at=? WHERE id=?`,
    ).run(opponentId, flipWinner, flipRolledAt, roomId);

    const rowBefore = getRoom(db, roomId) as DuelRoomRow;
    expect(rowBefore.flip_winner_user_id).toBe(flipWinner);
    expect(rowBefore.flip_rolled_at).toBe(flipRolledAt);

    // Restart
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    const p = { port: 0 };
    const srv2 = await buildFreshServer(p);

    const msg = await collectFirstMessage(p.port, roomId, creatorSid);
    expect(msg["type"]).toBe("ROOM_STATE");
    const snap = msg["snapshot"] as Record<string, unknown>;
    expect(snap["status"]).toBe("awaiting_choice");

    const rowAfter = getRoom(db, roomId) as DuelRoomRow;
    // Flip not re-rolled
    expect(rowAfter.flip_winner_user_id).toBe(rowBefore.flip_winner_user_id);
    expect(rowAfter.flip_rolled_at).toBe(rowBefore.flip_rolled_at);

    await new Promise<void>((resolve) => srv2.close(() => resolve()));
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    port = (httpServer.address() as { port: number }).port;
  });
});
