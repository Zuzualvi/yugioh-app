// ---------------------------------------------------------------------------
// getSeatCredential tests
//
// Covers:
//   - Returns seat+seatToken to the correct seat holder (AC6)
//   - Returns 403 to non-holders (AC6)
//   - Returns 404 for unknown duel
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import request from "supertest";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { openDb } from "../../db/openDb.js";
import { createApp } from "../../app.js";
import { DuelManager } from "../../duel/duelManager.js";
import { FakeEdisonDuel } from "../../duel/fakeEdisonDuel.js";
import type { DuelEngine } from "../../duel/engineInterface.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../../catalog/fixture.js";
import type { LoadedCatalog } from "../../catalog/loadCatalog.js";
import { EDISON_FLAGS } from "@yugioh-app/engine";
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
  app = createApp(db, makeTestCatalog(), manager);
});

afterEach(() => {
  db.close();
});

async function seedUser(displayName: string): Promise<{ userId: string; sid: string }> {
  const userId = randomUUID();
  const pw = await hash("password123");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
  ).run(userId, displayName, pw, new Date().toISOString());
  const res = await request(app)
    .post("/api/auth/login")
    .send({ displayName, password: "password123" });
  const cookies = (res.headers["set-cookie"] as string[] | undefined) ?? [];
  const sid =
    cookies
      .find((c) => c.startsWith("sid="))
      ?.split(";")[0]
      ?.slice(4) ?? "";
  return { userId, sid };
}

function insertTestDuel(seat0UserId: string, seat1UserId: string) {
  const duelId = randomUUID();
  const seat0Token = randomUUID();
  const seat1Token = randomUUID();
  const deck = JSON.stringify({ main: [89631139, 89631139, 89631139], extra: [] });

  db.prepare(
    `INSERT INTO duel
       (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id,
        seed_json, duel_flags, deck0_json, deck1_json, timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 300, 'active', ?)`,
  ).run(
    duelId,
    randomUUID(),
    seat0Token,
    seat1Token,
    seat0UserId,
    seat1UserId,
    JSON.stringify("42"),
    EDISON_FLAGS.toString(16),
    deck,
    deck,
    Date.now(),
  );

  return { duelId, seat0Token, seat1Token };
}

describe("GET /api/duels/:id/seat", () => {
  it("returns seat 0 credential to seat0 holder", async () => {
    const { userId: u0, sid: s0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    const { duelId, seat0Token } = insertTestDuel(u0, u1);

    const res = await request(app).get(`/api/duels/${duelId}/seat`).set("Cookie", `sid=${s0}`);

    expect(res.status).toBe(200);
    expect(res.body.seat).toBe(0);
    expect(res.body.seatToken).toBe(seat0Token);
  });

  it("returns seat 1 credential to seat1 holder", async () => {
    const { userId: u0 } = await seedUser("Alice");
    const { userId: u1, sid: s1 } = await seedUser("Bob");
    const { duelId, seat1Token } = insertTestDuel(u0, u1);

    const res = await request(app).get(`/api/duels/${duelId}/seat`).set("Cookie", `sid=${s1}`);

    expect(res.status).toBe(200);
    expect(res.body.seat).toBe(1);
    expect(res.body.seatToken).toBe(seat1Token);
  });

  it("returns 403 to a non-seat holder (AC6)", async () => {
    const { userId: u0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    const { duelId } = insertTestDuel(u0, u1);

    const { sid: outsiderSid } = await seedUser("Eve");

    const res = await request(app)
      .get(`/api/duels/${duelId}/seat`)
      .set("Cookie", `sid=${outsiderSid}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("not_occupant");
  });

  it("returns 404 for unknown duel", async () => {
    const { sid } = await seedUser("Alice");

    const res = await request(app).get(`/api/duels/no-such-duel/seat`).set("Cookie", `sid=${sid}`);

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const { userId: u0 } = await seedUser("Alice");
    const { userId: u1 } = await seedUser("Bob");
    const { duelId } = insertTestDuel(u0, u1);

    const res = await request(app).get(`/api/duels/${duelId}/seat`);
    expect(res.status).toBe(401);
  });
});
