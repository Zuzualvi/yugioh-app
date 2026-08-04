// ---------------------------------------------------------------------------
// Integration tests for GET /api/duels/active (Slice E / ZUH-72, ZUH-74)
//
// Covers duels:
//   - Returns 401 for unauthenticated requests
//   - Returns 200 with empty arrays when caller has nothing active
//   - Returns duels where caller is seat 0
//   - Returns duels where caller is seat 1
//   - Excludes ended duels
//   - opponentDisplayName is null when seat 1 is unfilled (waiting_for_opponent)
//   - Never returns credential fields (seat0_token, seat1_token, join_token)
//   - Duel results ordered by createdAt DESC
//   - Duel results capped at 20
//
// Covers rooms:
//   - Returns room where caller is creator
//   - Returns room where caller is opponent
//   - Excludes closed rooms
//   - Excludes starting rooms (terminal — duel already created)
//   - opponentDisplayName null when opponent_user_id is null
//   - Never returns join_token or deck JSON
//   - Room results ordered by createdAt DESC
//   - Room results capped at 20
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import request from "supertest";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { openDb } from "../../db/openDb.js";
import { createApp } from "../../app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../../catalog/fixture.js";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
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

beforeEach(() => {
  db = openDb(":memory:");
  app = createApp(db, makeTestCatalog());
});

afterEach(() => {
  db.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedUser(displayName: string): Promise<{ userId: string; sid: string }> {
  const userId = randomUUID();
  const pw = await hash("pw");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());
  const res = await request(app).post("/api/auth/login").send({ displayName, password: "pw" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  const sid =
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? "";
  return { userId, sid };
}

const DECK = JSON.stringify({ main: [89631139, 89631139, 89631139], extra: [] });

function insertDuel(
  seat0UserId: string,
  seat1UserId: string | null,
  status: "waiting_for_opponent" | "active" | "ended",
  createdAt: number = Date.now(),
): string {
  const duelId = randomUUID();
  db.prepare(
    `INSERT INTO duel
       (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id,
        seed_json, duel_flags, deck0_json, deck1_json,
        timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    duelId,
    randomUUID(),
    randomUUID(), // seat0_token — must NOT appear in response
    randomUUID(), // seat1_token — must NOT appear in response
    seat0UserId,
    seat1UserId,
    '"0"',
    "0",
    DECK,
    seat1UserId ? DECK : null,
    300,
    status,
    createdAt,
  );
  return duelId;
}

function insertRoom(
  creatorUserId: string,
  opponentUserId: string | null,
  status: "open" | "filled" | "awaiting_choice" | "starting" | "closed",
  createdAt: number = Date.now(),
): string {
  const roomId = randomUUID();
  db.prepare(
    `INSERT INTO duel_room
       (id, join_token, creator_user_id, opponent_user_id,
        timer_per_move_seconds, seed_json,
        room_deadline_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    roomId,
    randomUUID(), // join_token — must NOT appear in response
    creatorUserId,
    opponentUserId,
    300,
    '"0"',
    Date.now() + 30 * 60 * 1000,
    status,
    createdAt,
  );
  return roomId;
}

// ── Duel tests ────────────────────────────────────────────────────────────────

describe("GET /api/duels/active — duels", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(app).get("/api/duels/active");
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty arrays when caller has nothing active", async () => {
    const { sid } = await seedUser("Alice");
    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ duels: [], rooms: [] });
  });

  it("returns a duel where caller is seat 0", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    const duelId = insertDuel(u0, u1, "active");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.duels).toHaveLength(1);
    expect(res.body.duels[0].duelId).toBe(duelId);
    expect(res.body.duels[0].mySeat).toBe(0);
    expect(res.body.duels[0].opponentDisplayName).toBe("Bob");
    expect(res.body.duels[0].status).toBe("active");
  });

  it("returns a duel where caller is seat 1", async () => {
    const { userId: u0 } = await seedUser("Alice");
    const { userId: u1, sid: s1 } = await seedUser("Bob");
    const duelId = insertDuel(u0, u1, "active");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s1}`);

    expect(res.status).toBe(200);
    expect(res.body.duels).toHaveLength(1);
    expect(res.body.duels[0].duelId).toBe(duelId);
    expect(res.body.duels[0].mySeat).toBe(1);
    expect(res.body.duels[0].opponentDisplayName).toBe("Alice");
  });

  it("excludes ended duels", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    insertDuel(u0, u1, "ended");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.duels).toHaveLength(0);
  });

  it("returns waiting_for_opponent duels with null opponentDisplayName", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const duelId = insertDuel(u0, null, "waiting_for_opponent");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.duels).toHaveLength(1);
    expect(res.body.duels[0].duelId).toBe(duelId);
    expect(res.body.duels[0].opponentDisplayName).toBeNull();
    expect(res.body.duels[0].status).toBe("waiting_for_opponent");
  });

  it("never returns credential fields in duel entries", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    insertDuel(u0, u1, "active");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    const duel = res.body.duels[0] as Record<string, unknown>;
    expect(duel["seat0_token"]).toBeUndefined();
    expect(duel["seat1_token"]).toBeUndefined();
    expect(duel["join_token"]).toBeUndefined();
    expect(duel["seatToken"]).toBeUndefined();
  });

  it("orders duel results by createdAt descending", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    const older = insertDuel(u0, u1, "active", Date.now() - 10_000);
    const newer = insertDuel(u0, u1, "active", Date.now());

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.duels[0].duelId).toBe(newer);
    expect(res.body.duels[1].duelId).toBe(older);
  });

  it("caps duel results at 20", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    for (let i = 0; i < 25; i++) {
      insertDuel(u0, u1, "active", Date.now() - i * 1000);
    }

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.duels).toHaveLength(20);
  });
});

// ── Room tests ────────────────────────────────────────────────────────────────

describe("GET /api/duels/active — rooms", () => {
  it("returns a room where caller is creator", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    const roomId = insertRoom(creator, opponent, "filled");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].roomId).toBe(roomId);
    expect(res.body.rooms[0].myRole).toBe("creator");
    expect(res.body.rooms[0].opponentDisplayName).toBe("Bob");
    expect(res.body.rooms[0].status).toBe("filled");
  });

  it("returns a room where caller is opponent", async () => {
    const { userId: creator } = await seedUser("Alice");
    const { userId: opponent, sid } = await seedUser("Bob");
    const roomId = insertRoom(creator, opponent, "filled");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].roomId).toBe(roomId);
    expect(res.body.rooms[0].myRole).toBe("opponent");
    expect(res.body.rooms[0].opponentDisplayName).toBe("Alice");
  });

  it("excludes closed rooms", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    insertRoom(creator, opponent, "closed");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(0);
  });

  it("excludes starting rooms (duel already created — terminal)", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    insertRoom(creator, opponent, "starting");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(0);
  });

  it("returns null opponentDisplayName when opponent_user_id is null", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const roomId = insertRoom(creator, null, "open");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].roomId).toBe(roomId);
    expect(res.body.rooms[0].opponentDisplayName).toBeNull();
  });

  it("never returns join_token or deck JSON in room entries", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    insertRoom(creator, opponent, "filled");

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    const room = res.body.rooms[0] as Record<string, unknown>;
    expect(room["join_token"]).toBeUndefined();
    expect(room["creator_deck_json"]).toBeUndefined();
    expect(room["opponent_deck_json"]).toBeUndefined();
  });

  it("orders room results by createdAt descending", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    const older = insertRoom(creator, opponent, "open", Date.now() - 10_000);
    const newer = insertRoom(creator, opponent, "open", Date.now());

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms[0].roomId).toBe(newer);
    expect(res.body.rooms[1].roomId).toBe(older);
  });

  it("caps room results at 20", async () => {
    const { userId: creator, sid } = await seedUser("Alice");
    const { userId: opponent } = await seedUser("Bob");
    for (let i = 0; i < 25; i++) {
      insertRoom(creator, opponent, "open", Date.now() - i * 1000);
    }

    const res = await request(app).get("/api/duels/active").set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(20);
  });
});
