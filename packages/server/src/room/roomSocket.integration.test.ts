// ---------------------------------------------------------------------------
// roomSocket integration — reaches /api/duels/:id/room/ws through the same
// wiring used in production (createApp → httpServer → attachUpgradeRouter).
// This exercises acceptance criterion 9: the upgrade router is live, not just
// unit-tested in isolation.
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
import { insertRoom } from "./roomStore.js";
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

async function seedUserAndLogin(displayName: string): Promise<string> {
  const userId = randomUUID();
  const pw = await hash("password123");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());

  const res = await request(app)
    .post("/api/auth/login")
    .send({ displayName, password: "password123" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  return (
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? ""
  );
}

beforeEach(async () => {
  db = openDb(":memory:");
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
  app = createApp(db, catalog, manager);
  httpServer = createServer(app);

  // Wired identically to production index.ts
  const boardWss = attachDuelWsServer(httpServer, db, manager);
  const roomWss = createRoomWss();
  attachUpgradeRouter(httpServer, db, boardWss, roomWss);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = httpServer.address();
  port = typeof addr === "object" && addr ? addr.port : 0;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  db.close();
});

describe("room socket — through real server wiring", () => {
  it("rejects /api/duels/:id/room/ws with 403 when Origin is not in allowlist", async () => {
    const userId = randomUUID();
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    ).run(userId, "Alice", await hash("pw"), new Date().toISOString());

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
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
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

  it("rejects /api/duels/:id/room/ws with 401 when no session cookie", async () => {
    const roomId = randomUUID();
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    ).run(randomUUID(), "Bob", await hash("pw"), new Date().toISOString());
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: randomUUID(),
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    await new Promise<void>((resolve, reject) => {
      // No Origin header (same-host allowed in dev), no cookie
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`);
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

  it("rejects non-occupant with close code 4403", async () => {
    const sid = await seedUserAndLogin("Creator");
    const creatorRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `sid=${sid}`)
      .catch(() => null);
    // Seed creator's userId
    const creatorRow = db.prepare("SELECT id FROM users WHERE display_name = 'Creator'").get() as {
      id: string;
    };

    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorRow.id,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    // A different user who is not an occupant
    const intruderSid = await seedUserAndLogin("Intruder");

    const closeCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${intruderSid}` },
      });
      ws.on("close", (code) => resolve(code));
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("error", () => resolve(0));
    });
    expect([403, 4403]).toContain(closeCode);
    void creatorRes;
  });

  it("sends ROOM_STATE on connect for a valid occupant", async () => {
    const sid = await seedUserAndLogin("Owner");
    const creatorRow = db.prepare("SELECT id FROM users WHERE display_name = 'Owner'").get() as {
      id: string;
    };

    const roomId = randomUUID();
    insertRoom(db, {
      id: roomId,
      joinToken: randomUUID(),
      creatorUserId: creatorRow.id,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/duels/${roomId}/room/ws`, {
        headers: { Cookie: `sid=${sid}` },
      });
      ws.on("message", (data: Buffer) => {
        ws.close();
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      });
      ws.on("error", reject);
      ws.on("unexpected-response", (_req, res) => {
        reject(new Error(`Unexpected HTTP ${res.statusCode}`));
      });
    });

    expect(msg["type"]).toBe("ROOM_STATE");
    const snap = msg["snapshot"] as Record<string, unknown>;
    expect(snap["roomId"]).toBe(roomId);
    expect(snap["status"]).toBe("open");
  });
});
