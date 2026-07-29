/**
 * Integration tests for S1 room-entry routes:
 *   POST /api/duels          — createRoom
 *   GET  /api/duels/join/:t  — lookupJoinToken
 *   POST /api/duels/join     — claimRoom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";
import { openDb } from "../../db/openDb.js";
import { createApp } from "../../app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../../catalog/fixture.js";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
// ── helpers ──────────────────────────────────────────────────────────────────

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

beforeEach(() => {
  db = openDb(":memory:");
  app = createApp(db, makeTestCatalog());
});

afterEach(() => {
  db.close();
});

// Seed a user and return a session cookie
async function seedUserAndLogin(displayName: string): Promise<string> {
  const userId = `user-${displayName}`;
  const pw = "password123";
  const passwordHash = await hash(pw);
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, passwordHash, new Date().toISOString());

  const res = await request(app).post("/api/auth/login").send({ displayName, password: pw });

  const cookies: string[] = res.headers["set-cookie"] as unknown as string[];
  const sidCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
    c.startsWith("sid="),
  );
  if (!sidCookie) throw new Error("No sid cookie from login");
  return sidCookie.split(";")[0] ?? ""; // "sid=<value>"
}

// ── POST /api/duels ───────────────────────────────────────────────────────────

describe("POST /api/duels — createRoom", () => {
  it("returns 401 without a session", async () => {
    const res = await request(app)
      .post("/api/duels")
      .send({ timer: { perMoveSeconds: 600 } });
    expect(res.status).toBe(401);
  });

  it("creates a room and returns roomId + joinToken", async () => {
    const cookie = await seedUserAndLogin("Creator");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 600 } });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("roomId");
    expect(res.body).toHaveProperty("joinToken");
  });

  it("rejects perMoveSeconds below 60 with invalid_timer", async () => {
    const cookie = await seedUserAndLogin("Creator2");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 30 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_timer");
  });

  it("rejects perMoveSeconds above 900 with invalid_timer", async () => {
    const cookie = await seedUserAndLogin("Creator3");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 1200 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_timer");
  });

  it("accepts perMoveSeconds exactly 60", async () => {
    const cookie = await seedUserAndLogin("Creator4");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 60 } });
    expect(res.status).toBe(201);
  });

  it("accepts perMoveSeconds exactly 900", async () => {
    const cookie = await seedUserAndLogin("Creator5");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 900 } });
    expect(res.status).toBe(201);
  });

  it("stores correct perMoveSeconds in the DB row", async () => {
    const cookie = await seedUserAndLogin("Creator6");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 300 } });
    expect(res.status).toBe(201);

    const row = db.prepare("SELECT * FROM duel_room WHERE id = ?").get(res.body.roomId) as
      { timer_per_move_seconds: number; status: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.timer_per_move_seconds).toBe(300);
    expect(row!.status).toBe("open");
  });

  it("does not create a duel row", async () => {
    const cookie = await seedUserAndLogin("Creator7");
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 600 } });
    expect(res.status).toBe(201);

    const duelRow = db.prepare("SELECT * FROM duel WHERE id = ?").get(res.body.roomId);
    expect(duelRow).toBeUndefined();
  });

  it("sets room_deadline_at to ~now + 30 min", async () => {
    const cookie = await seedUserAndLogin("Creator8");
    const before = Date.now();
    const res = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 600 } });
    const after = Date.now();

    const row = db
      .prepare("SELECT room_deadline_at FROM duel_room WHERE id = ?")
      .get(res.body.roomId) as { room_deadline_at: number } | undefined;
    const expectedMin = before + 30 * 60 * 1000;
    const expectedMax = after + 30 * 60 * 1000;
    expect(row!.room_deadline_at).toBeGreaterThanOrEqual(expectedMin);
    expect(row!.room_deadline_at).toBeLessThanOrEqual(expectedMax);
  });
});

// ── GET /api/duels/join/:joinToken ────────────────────────────────────────────

describe("GET /api/duels/join/:joinToken — lookupJoinToken", () => {
  it("returns 404 for an unknown token", async () => {
    const res = await request(app).get("/api/duels/join/unknowntoken");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("invalid_token");
  });

  it("is accessible without authentication", async () => {
    const cookie = await seedUserAndLogin("Owner");
    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    // No auth
    const res = await request(app).get(`/api/duels/join/${joinToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reason");
  });

  it("returns ok + usable=true for an open room (unauthenticated)", async () => {
    const cookie = await seedUserAndLogin("Creator9");
    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    const res = await request(app).get(`/api/duels/join/${joinToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("ok");
    expect(res.body.usable).toBe(true);
    expect(res.body.perMoveSeconds).toBe(300);
    expect(typeof res.body.creatorDisplayName).toBe("string");
  });

  it("returns you_are_the_creator for the creator", async () => {
    const cookie = await seedUserAndLogin("Creator10");
    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    const res = await request(app).get(`/api/duels/join/${joinToken}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("you_are_the_creator");
    expect(res.body.usable).toBe(false);
  });

  it("returns expired for an expired room and writes back the close", async () => {
    const now = Date.now();
    const id = "room-expired-1";
    const token = "expired-token-1";
    db.prepare(
      `INSERT INTO duel_room (id, join_token, creator_user_id, timer_per_move_seconds, seed_json, room_deadline_at, status, created_at)
       VALUES (?, ?, 'user-x', 300, '"42"', ?, 'open', ?)`,
    ).run(id, token, now - 1000, now - 60_000);

    const res = await request(app).get(`/api/duels/join/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("expired");
    expect(res.body.usable).toBe(false);

    // Writeback: row should now be closed
    const row = db.prepare("SELECT status FROM duel_room WHERE id = ?").get(id) as
      { status: string } | undefined;
    expect(row?.status).toBe("closed");
  });

  it("returns claimed_by_other when room is filled (unauthenticated)", async () => {
    const creator = await seedUserAndLogin("CreatorA");
    const opponent = await seedUserAndLogin("OpponentA");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    // Claim it
    await request(app).post("/api/duels/join").set("Cookie", opponent).send({ joinToken });

    // Unauthenticated lookup
    const res = await request(app).get(`/api/duels/join/${joinToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("claimed_by_other");
    expect(res.body.usable).toBe(false);
  });

  it("returns you_are_an_occupant for the opponent", async () => {
    const creator = await seedUserAndLogin("CreatorB");
    const opponent = await seedUserAndLogin("OpponentB");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    await request(app).post("/api/duels/join").set("Cookie", opponent).send({ joinToken });

    const res = await request(app).get(`/api/duels/join/${joinToken}`).set("Cookie", opponent);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("you_are_an_occupant");
  });

  it("returns started for a started room", async () => {
    const now = Date.now();
    const id = "room-started-1";
    const token = "started-token-1";
    db.prepare(
      `INSERT INTO duel_room (id, join_token, creator_user_id, timer_per_move_seconds, seed_json, room_deadline_at, status, created_at)
       VALUES (?, ?, 'user-x', 300, '"42"', ?, 'starting', ?)`,
    ).run(id, token, now + 120_000, now - 60_000);

    const res = await request(app).get(`/api/duels/join/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("started");
    expect(res.body.usable).toBe(false);
  });

  it("returns closed for a closed room", async () => {
    const now = Date.now();
    const id = "room-closed-x";
    const token = "closed-token-x";
    db.prepare(
      `INSERT INTO duel_room (id, join_token, creator_user_id, timer_per_move_seconds, seed_json, room_deadline_at, status, closed_reason, created_at)
       VALUES (?, ?, 'user-x', 300, '"42"', ?, 'closed', 'left', ?)`,
    ).run(id, token, now + 30 * 60 * 1000, now - 60_000);

    const res = await request(app).get(`/api/duels/join/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("closed");
    expect(res.body.usable).toBe(false);
  });

  it("never returns raw status field in the response", async () => {
    const cookie = await seedUserAndLogin("Creator11");
    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", cookie)
      .send({ timer: { perMoveSeconds: 300 } });
    const { joinToken } = createRes.body;

    const res = await request(app).get(`/api/duels/join/${joinToken}`);
    expect(res.body).not.toHaveProperty("status");
  });
});

// ── POST /api/duels/join — claimRoom ─────────────────────────────────────────

describe("POST /api/duels/join — claimRoom", () => {
  it("returns 401 without a session", async () => {
    const res = await request(app).post("/api/duels/join").send({ joinToken: "anytoken" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown token", async () => {
    const cookie = await seedUserAndLogin("User1");
    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", cookie)
      .send({ joinToken: "unknowntoken" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("invalid_token");
  });

  it("successfully claims an open room and returns a RoomSnapshot", async () => {
    const creator = await seedUserAndLogin("CreatorC");
    const opponent = await seedUserAndLogin("OpponentC");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 600 } });
    const { joinToken, roomId } = createRes.body as { joinToken: string; roomId: string };

    const claimRes = await request(app)
      .post("/api/duels/join")
      .set("Cookie", opponent)
      .send({ joinToken });
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.roomId).toBe(roomId);
    expect(claimRes.body.status).toBe("filled");
  });

  it("returns the room (idempotent) for the creator claiming their own token", async () => {
    const creator = await seedUserAndLogin("CreatorD");
    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 600 } });
    const { joinToken } = createRes.body;

    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", creator)
      .send({ joinToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roomId");
  });

  it("returns the room (idempotent) for an existing opponent", async () => {
    const creator = await seedUserAndLogin("CreatorE");
    const opponent = await seedUserAndLogin("OpponentE");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 600 } });
    const { joinToken } = createRes.body;

    // First claim
    await request(app).post("/api/duels/join").set("Cookie", opponent).send({ joinToken });

    // Second claim by same opponent — idempotent
    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", opponent)
      .send({ joinToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roomId");
  });

  it("rejects a third party with already_claimed", async () => {
    const creator = await seedUserAndLogin("CreatorF");
    const opponent = await seedUserAndLogin("OpponentF");
    const third = await seedUserAndLogin("ThirdF");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 600 } });
    const { joinToken } = createRes.body;

    await request(app).post("/api/duels/join").set("Cookie", opponent).send({ joinToken });

    const res = await request(app).post("/api/duels/join").set("Cookie", third).send({ joinToken });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_claimed");
  });

  it("returns 410 expired for an expired room", async () => {
    const cookie = await seedUserAndLogin("User2");
    const now = Date.now();
    const id = "room-expired-claim";
    const token = "expired-token-claim";
    db.prepare(
      `INSERT INTO duel_room (id, join_token, creator_user_id, timer_per_move_seconds, seed_json, room_deadline_at, status, created_at)
       VALUES (?, ?, 'user-x', 300, '"42"', ?, 'open', ?)`,
    ).run(id, token, now - 1000, now - 60_000);

    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", cookie)
      .send({ joinToken: token });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("expired");
  });

  it("concurrent claims admit exactly one", async () => {
    const creator = await seedUserAndLogin("CreatorG");
    const opp1 = await seedUserAndLogin("Opp1G");
    const opp2 = await seedUserAndLogin("Opp2G");

    const createRes = await request(app)
      .post("/api/duels")
      .set("Cookie", creator)
      .send({ timer: { perMoveSeconds: 600 } });
    const { joinToken } = createRes.body;

    const [r1, r2] = await Promise.all([
      request(app).post("/api/duels/join").set("Cookie", opp1).send({ joinToken }),
      request(app).post("/api/duels/join").set("Cookie", opp2).send({ joinToken }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // One 200, one 409
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body.error.code).toBe("already_claimed");
  });

  it("returns already_started for a starting room", async () => {
    const cookie = await seedUserAndLogin("User3");
    const now = Date.now();
    const id = "room-starting-1";
    const token = "starting-token-1";
    db.prepare(
      `INSERT INTO duel_room (id, join_token, creator_user_id, timer_per_move_seconds, seed_json, room_deadline_at, status, created_at)
       VALUES (?, ?, 'user-x', 300, '"42"', ?, 'starting', ?)`,
    ).run(id, token, now + 120_000, now - 60_000);

    const res = await request(app)
      .post("/api/duels/join")
      .set("Cookie", cookie)
      .send({ joinToken: token });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_started");
  });
});
