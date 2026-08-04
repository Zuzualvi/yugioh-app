import { describe, expect, it, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { openDb } from "../db/openDb.js";
import { createApp } from "../app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Integration tests for /api/ops endpoints (real HTTP, in-memory SQLite)
// ---------------------------------------------------------------------------

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

const OPS_TOKEN = "test-ops-token-abc123";

let db: Database.Database;
let app: Application;

beforeEach(() => {
  process.env["OPS_ADMIN_TOKEN"] = OPS_TOKEN;
  db = openDb(":memory:");
  app = createApp(db, makeTestCatalog());
});

afterEach(() => {
  delete process.env["OPS_ADMIN_TOKEN"];
  db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedUser(id: string, displayName: string, role: "admin" | "member" = "member"): string {
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, displayName, "hash-not-used", role, new Date().toISOString());
  return id;
}

function seedSession(id: string, userId: string): string {
  db.prepare("INSERT INTO sessions (sid, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    new Date(Date.now() + 86400_000).toISOString(),
  );
  return id;
}

function seedDeck(id: string, ownerId: string, name = "Test Deck"): string {
  db.prepare(
    "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, ownerId, name, "[]", "[]", "[]", 1, new Date().toISOString(), new Date().toISOString());
  return id;
}

function seedInvite(code: string, createdBy: string, consumedBy?: string): string {
  db.prepare(
    "INSERT INTO invites (code, created_by, expires_at, consumed_by) VALUES (?, ?, ?, ?)",
  ).run(code, createdBy, new Date(Date.now() + 86400_000).toISOString(), consumedBy ?? null);
  return code;
}

function seedDuel(
  id: string,
  seat0UserId: string,
  seat1UserId: string | null = null,
  status = "waiting_for_opponent",
): string {
  db.prepare(
    `INSERT INTO duel (id, join_token, seat0_token, seat1_token, seat0_user_id, seat1_user_id,
     seed_json, duel_flags, deck0_json, timer_per_move_seconds, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    randomBytes(16).toString("hex"),
    randomBytes(16).toString("hex"),
    randomBytes(16).toString("hex"),
    seat0UserId,
    seat1UserId,
    "{}",
    "{}",
    "[]",
    300,
    status,
    Date.now(),
  );
  return id;
}

function seedResponseLog(duelId: string, seq: number): void {
  db.prepare(
    "INSERT INTO response_log (duel_id, seq, seat, response_json, received_at) VALUES (?, ?, ?, ?, ?)",
  ).run(duelId, seq, 0, "{}", Date.now());
}

function seedRoom(id: string, creatorUserId: string, opponentUserId: string | null = null): string {
  db.prepare(
    `INSERT INTO duel_room (id, join_token, creator_user_id, opponent_user_id,
     timer_per_move_seconds, seed_json, room_deadline_at, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    randomBytes(16).toString("hex"),
    creatorUserId,
    opponentUserId,
    300,
    "{}",
    Date.now() + 3_600_000,
    Date.now(),
    "open",
  );
  return id;
}

// ---------------------------------------------------------------------------
// 1. Auth middleware — 503 when OPS_ADMIN_TOKEN unset
// ---------------------------------------------------------------------------
describe("requireOpsToken — 503 when OPS_ADMIN_TOKEN unset", () => {
  it("returns 503 ops_disabled when env var is not set", async () => {
    delete process.env["OPS_ADMIN_TOKEN"];
    const res = await request(app).get("/api/ops/migrations");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ops_disabled");
  });

  it("returns 503 when env var is empty string", async () => {
    process.env["OPS_ADMIN_TOKEN"] = "";
    const res = await request(app).get("/api/ops/counts");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ops_disabled");
  });
});

// ---------------------------------------------------------------------------
// 2. Auth middleware — 401 variants
// ---------------------------------------------------------------------------
describe("requireOpsToken — 401 variants", () => {
  it("401 when Authorization header is missing", async () => {
    const res = await request(app).get("/api/ops/migrations");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const res = await request(app).get("/api/ops/migrations").set("Authorization", OPS_TOKEN);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("401 when token is wrong (same length)", async () => {
    const wrongToken = "X".repeat(OPS_TOKEN.length);
    const res = await request(app)
      .get("/api/ops/migrations")
      .set("Authorization", `Bearer ${wrongToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("401 when token is wrong (shorter length — timingSafeEqual must not throw)", async () => {
    const shortToken = OPS_TOKEN.slice(0, -1);
    const res = await request(app)
      .get("/api/ops/migrations")
      .set("Authorization", `Bearer ${shortToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("401 when token is wrong (longer length — timingSafeEqual must not throw)", async () => {
    const longToken = OPS_TOKEN + "X";
    const res = await request(app)
      .get("/api/ops/migrations")
      .set("Authorization", `Bearer ${longToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/ops/migrations
// ---------------------------------------------------------------------------
describe("GET /api/ops/migrations", () => {
  it("returns correct shape with applied migrations", async () => {
    const res = await request(app)
      .get("/api/ops/migrations")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("applied");
    expect(res.body).toHaveProperty("latest");
    expect(res.body).toHaveProperty("expected");
    expect(res.body).toHaveProperty("upToDate");

    expect(Array.isArray(res.body.applied)).toBe(true);
    for (const row of res.body.applied as Array<unknown>) {
      expect(row).toHaveProperty("version");
      expect(row).toHaveProperty("appliedAt");
      expect(typeof (row as { version: unknown }).version).toBe("number");
      expect(typeof (row as { appliedAt: unknown }).appliedAt).toBe("string");
    }

    // All migrations ran in openDb; applied.length should equal expected
    expect(res.body.applied.length).toBe(res.body.expected);
    expect(res.body.upToDate).toBe(true);
    expect(typeof res.body.latest).toBe("number");
    expect(typeof res.body.expected).toBe("number");
  });

  it("upToDate reflects latest === expected", async () => {
    const res = await request(app)
      .get("/api/ops/migrations")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.upToDate).toBe(res.body.latest === res.body.expected);
  });
});

// ---------------------------------------------------------------------------
// 4. GET /api/ops/counts
// ---------------------------------------------------------------------------
describe("GET /api/ops/counts", () => {
  it("returns exactly the seven required keys", async () => {
    const res = await request(app)
      .get("/api/ops/counts")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("counts");
    const counts = res.body.counts as Record<string, number>;
    expect(Object.keys(counts).sort()).toEqual(
      ["decks", "duel", "duelRoom", "invites", "responseLog", "sessions", "users"].sort(),
    );
    for (const v of Object.values(counts)) {
      expect(typeof v).toBe("number");
    }
  });

  it("counts reflect seeded data", async () => {
    seedUser("u1", "Alice");
    seedUser("u2", "Bob");
    const res = await request(app)
      .get("/api/ops/counts")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.body.counts.users).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. GET /api/ops/users?displayName=<exact>
// ---------------------------------------------------------------------------
describe("GET /api/ops/users", () => {
  it("400 invalid_input when displayName is missing", async () => {
    const res = await request(app)
      .get("/api/ops/users")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_input");
  });

  it("400 invalid_input when displayName is empty string", async () => {
    const res = await request(app)
      .get("/api/ops/users?displayName=")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_input");
  });

  it("200 with empty array when no user matches", async () => {
    const res = await request(app)
      .get("/api/ops/users?displayName=nobody")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it("returns matching user with correct camelCase fields", async () => {
    seedUser("u1", "qa-alice");
    const res = await request(app)
      .get("/api/ops/users?displayName=qa-alice")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    const user = res.body.users[0] as Record<string, unknown>;
    expect(user["id"]).toBe("u1");
    expect(user["displayName"]).toBe("qa-alice");
    expect(user["role"]).toBe("member");
    expect(typeof user["createdAt"]).toBe("string");
  });

  it("never returns passwordHash", async () => {
    seedUser("u1", "qa-alice");
    const res = await request(app)
      .get("/api/ops/users?displayName=qa-alice")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const user = res.body.users[0] as Record<string, unknown>;
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("password_hash");
  });

  it("is exact match only (no partial match)", async () => {
    seedUser("u1", "qa-alice");
    const res = await request(app)
      .get("/api/ops/users?displayName=qa-alic")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. GET /api/ops/user/:id
// ---------------------------------------------------------------------------
describe("GET /api/ops/user/:id", () => {
  it("404 not_found for absent user", async () => {
    const res = await request(app)
      .get("/api/ops/user/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("returns user detail with aggregate counts", async () => {
    const uid = seedUser("u1", "Alice");
    seedSession("s1", uid);
    seedDeck("d1", uid, "Deck A");
    seedDeck("d2", uid, "Deck B");
    seedDuel("duel1", uid);
    seedRoom("room1", uid);

    const res = await request(app)
      .get("/api/ops/user/u1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const user = res.body.user as Record<string, unknown>;
    expect(user["id"]).toBe("u1");
    expect(user["displayName"]).toBe("Alice");
    expect(user["role"]).toBe("member");
    expect(typeof user["createdAt"]).toBe("string");
    expect(user["deckCount"]).toBe(2);
    expect(user["sessionCount"]).toBe(1);
    expect(user["duelCount"]).toBe(1);
    expect(user["roomCount"]).toBe(1);
  });

  it("never returns passwordHash", async () => {
    seedUser("u1", "Alice");
    const res = await request(app)
      .get("/api/ops/user/u1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const user = res.body.user as Record<string, unknown>;
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("password_hash");
  });
});

// ---------------------------------------------------------------------------
// 7. GET /api/ops/duel/:id
// ---------------------------------------------------------------------------
describe("GET /api/ops/duel/:id", () => {
  it("404 not_found for absent duel", async () => {
    const res = await request(app)
      .get("/api/ops/duel/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("returns duel detail with correct camelCase fields", async () => {
    const uid = seedUser("u1", "Alice");
    seedDuel("duel1", uid, null, "waiting_for_opponent");
    seedResponseLog("duel1", 0);
    seedResponseLog("duel1", 1);

    const res = await request(app)
      .get("/api/ops/duel/duel1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const duel = res.body.duel as Record<string, unknown>;
    expect(duel["id"]).toBe("duel1");
    expect(duel["status"]).toBe("waiting_for_opponent");
    expect(duel["seat0UserId"]).toBe("u1");
    expect(duel["seat1UserId"]).toBeNull();
    expect(duel["responseLogCount"]).toBe(2);
    expect(duel).toHaveProperty("winner");
    expect(duel).toHaveProperty("endReason");
    expect(duel).toHaveProperty("onClockSeat");
    expect(duel).toHaveProperty("deadlineAt");
    expect(typeof duel["createdAt"]).toBe("number");
  });

  it("never returns seat tokens, deck json, seed_json, or join_token", async () => {
    const uid = seedUser("u1", "Alice");
    seedDuel("duel1", uid);
    const res = await request(app)
      .get("/api/ops/duel/duel1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const duel = res.body.duel as Record<string, unknown>;
    expect(duel).not.toHaveProperty("seat0Token");
    expect(duel).not.toHaveProperty("seat0_token");
    expect(duel).not.toHaveProperty("seat1Token");
    expect(duel).not.toHaveProperty("seat1_token");
    expect(duel).not.toHaveProperty("joinToken");
    expect(duel).not.toHaveProperty("join_token");
    expect(duel).not.toHaveProperty("deck0Json");
    expect(duel).not.toHaveProperty("deck0_json");
    expect(duel).not.toHaveProperty("deck1Json");
    expect(duel).not.toHaveProperty("deck1_json");
    expect(duel).not.toHaveProperty("seedJson");
    expect(duel).not.toHaveProperty("seed_json");
  });
});

// ---------------------------------------------------------------------------
// 8. GET /api/ops/room/:id
// ---------------------------------------------------------------------------
describe("GET /api/ops/room/:id", () => {
  it("404 not_found for absent room", async () => {
    const res = await request(app)
      .get("/api/ops/room/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("returns room detail with correct camelCase fields", async () => {
    const uid = seedUser("u1", "Alice");
    seedRoom("room1", uid);

    const res = await request(app)
      .get("/api/ops/room/room1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const room = res.body.room as Record<string, unknown>;
    expect(room["id"]).toBe("room1");
    expect(room["status"]).toBe("open");
    expect(room["creatorUserId"]).toBe("u1");
    expect(room).toHaveProperty("closedReason");
    expect(room).toHaveProperty("opponentUserId");
    expect(room).toHaveProperty("creatorDeckName");
    expect(room).toHaveProperty("opponentDeckName");
    expect(room).toHaveProperty("creatorReadyAt");
    expect(room).toHaveProperty("opponentReadyAt");
    expect(room).toHaveProperty("flipWinnerUserId");
    expect(room).toHaveProperty("flipChoice");
    expect(room).toHaveProperty("roomDeadlineAt");
    expect(typeof room["createdAt"]).toBe("number");
  });

  it("never returns join_token, creator_deck_json, or opponent_deck_json", async () => {
    const uid = seedUser("u1", "Alice");
    seedRoom("room1", uid);
    const res = await request(app)
      .get("/api/ops/room/room1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const room = res.body.room as Record<string, unknown>;
    expect(room).not.toHaveProperty("joinToken");
    expect(room).not.toHaveProperty("join_token");
    expect(room).not.toHaveProperty("creatorDeckJson");
    expect(room).not.toHaveProperty("creator_deck_json");
    expect(room).not.toHaveProperty("opponentDeckJson");
    expect(room).not.toHaveProperty("opponent_deck_json");
  });
});

// ---------------------------------------------------------------------------
// 9. DELETE /api/ops/duel/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/ops/duel/:id", () => {
  it("404 not_found for absent duel", async () => {
    const res = await request(app)
      .delete("/api/ops/duel/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("deletes duel and response_log rows, returns correct counts", async () => {
    const uid = seedUser("u1", "Alice");
    seedDuel("duel1", uid);
    seedResponseLog("duel1", 0);
    seedResponseLog("duel1", 1);
    seedResponseLog("duel1", 2);

    const res = await request(app)
      .delete("/api/ops/duel/duel1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.duel).toBe(1);
    expect(res.body.deleted.responseLog).toBe(3);

    const duelGone = db.prepare("SELECT 1 FROM duel WHERE id = ?").get("duel1");
    expect(duelGone).toBeUndefined();
    const logsGone = db
      .prepare("SELECT COUNT(*) AS n FROM response_log WHERE duel_id = ?")
      .get("duel1") as { n: number };
    expect(logsGone.n).toBe(0);
  });

  it("deletes duel with zero response_log rows (responseLog: 0)", async () => {
    const uid = seedUser("u1", "Alice");
    seedDuel("duel1", uid);
    const res = await request(app)
      .delete("/api/ops/duel/duel1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.duel).toBe(1);
    expect(res.body.deleted.responseLog).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. DELETE /api/ops/room/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/ops/room/:id", () => {
  it("404 not_found for absent room", async () => {
    const res = await request(app)
      .delete("/api/ops/room/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("deletes room and returns duelRoom: 1", async () => {
    const uid = seedUser("u1", "Alice");
    seedRoom("room1", uid);

    const res = await request(app)
      .delete("/api/ops/room/room1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.duelRoom).toBe(1);

    const gone = db.prepare("SELECT 1 FROM duel_room WHERE id = ?").get("room1");
    expect(gone).toBeUndefined();
  });

  it("does not delete associated duels when deleting a room", async () => {
    const uid = seedUser("u1", "Alice");
    seedRoom("room1", uid);
    seedDuel("duel1", uid);

    await request(app).delete("/api/ops/room/room1").set("Authorization", `Bearer ${OPS_TOKEN}`);

    const duelStillThere = db.prepare("SELECT 1 FROM duel WHERE id = ?").get("duel1");
    expect(duelStillThere).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 11. DELETE /api/ops/user/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/ops/user/:id", () => {
  it("404 not_found for absent user", async () => {
    const res = await request(app)
      .delete("/api/ops/user/does-not-exist")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("409 last_admin when deleting the only admin", async () => {
    seedUser("admin1", "Admin", "admin");

    const res = await request(app)
      .delete("/api/ops/user/admin1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("last_admin");

    // User must still exist — delete nothing
    const stillThere = db.prepare("SELECT 1 FROM users WHERE id = ?").get("admin1");
    expect(stillThere).toBeDefined();
  });

  it("allows deleting an admin when there are multiple admins", async () => {
    seedUser("admin1", "Admin1", "admin");
    seedUser("admin2", "Admin2", "admin");

    const res = await request(app)
      .delete("/api/ops/user/admin1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.user).toBe(1);
  });

  it("deletes user cascade with correct row counts", async () => {
    const uid = seedUser("u1", "qa-alice");
    const admin = seedUser("admin1", "Admin", "admin");

    seedSession("s1", uid);
    seedDeck("d1", uid);
    seedDeck("d2", uid);
    seedInvite("inv1", admin, uid); // consumed_by = uid
    seedInvite("inv2", uid); // created_by = uid
    seedDuel("duel1", uid);
    seedResponseLog("duel1", 0);
    seedResponseLog("duel1", 1);
    seedRoom("room1", uid);
    seedRoom("room2", "admin1", uid); // opponent = uid

    const res = await request(app)
      .delete("/api/ops/user/u1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);

    const deleted = res.body.deleted as Record<string, number>;
    expect(deleted["user"]).toBe(1);
    expect(deleted["sessions"]).toBe(1);
    expect(deleted["decks"]).toBe(2);
    expect(deleted["invites"]).toBe(2); // inv1 (consumed_by) + inv2 (created_by)
    expect(deleted["duelRoom"]).toBe(2); // room1 (creator) + room2 (opponent)
    expect(deleted["duel"]).toBe(1);
    expect(deleted["responseLog"]).toBe(2);

    const userGone = db.prepare("SELECT 1 FROM users WHERE id = ?").get("u1");
    expect(userGone).toBeUndefined();

    const sessionsGone = db
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?")
      .get("u1") as { n: number };
    expect(sessionsGone.n).toBe(0);
    const decksGone = db
      .prepare("SELECT COUNT(*) AS n FROM decks WHERE owner_id = ?")
      .get("u1") as { n: number };
    expect(decksGone.n).toBe(0);
  });

  it("deletes user with no dependents (all counts are 0 except user)", async () => {
    seedUser("u1", "loner");
    const res = await request(app)
      .delete("/api/ops/user/u1")
      .set("Authorization", `Bearer ${OPS_TOKEN}`);
    expect(res.status).toBe(200);
    const deleted = res.body.deleted as Record<string, number>;
    expect(deleted["user"]).toBe(1);
    expect(deleted["sessions"]).toBe(0);
    expect(deleted["decks"]).toBe(0);
    expect(deleted["invites"]).toBe(0);
    expect(deleted["duelRoom"]).toBe(0);
    expect(deleted["duel"]).toBe(0);
    expect(deleted["responseLog"]).toBe(0);
  });
});
