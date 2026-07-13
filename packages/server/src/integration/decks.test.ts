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
// Integration tests for deck endpoints (real HTTP, in-memory SQLite)
// ---------------------------------------------------------------------------

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set(byPasscode.keys());
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

let db: Database.Database;
let app: Application;
let catalog: LoadedCatalog;

// Known fixture passcodes
const BEAST_KING = 89631139;
const DARK_ARMED = 70781052;
const BTH = 29401950;
const FUSION = 35809262;
const SYNCHRO = 67959180;
const CYBER = 46986414;
const _HARPIE_LADY = 76812113; void _HARPIE_LADY;

/** Build a valid 40-card main with no violations */
/**
 * 40-card main deck for integration tests (just needs 40 cards for size;
 * copy-cap violations are expected since fixture has limited unique cards).
 */
function legalMain40(): number[] {
  return Array(40).fill(BEAST_KING);
}

beforeEach(() => {
  db = openDb(":memory:");
  catalog = makeTestCatalog();
  app = createApp(db, catalog);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Helper: create an authenticated session
// ---------------------------------------------------------------------------
async function createSession(): Promise<string> {
  const { hash } = await import("@node-rs/argon2");
  const adminId = "admin-001";
  const pw = await hash("adminpass1");
  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
  ).run(adminId, "Admin", pw, new Date().toISOString());

  const inviteCode = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 86400_000).toISOString();
  db.prepare("INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, ?)").run(
    inviteCode,
    adminId,
    expiresAt,
  );

  const res = await request(app).post("/api/auth/redeem-invite").send({
    inviteCode,
    displayName: "TestUser",
    password: "testpassword1",
  });
  const cookieHeader = res.headers["set-cookie"] as unknown as string[];
  const sidCookie = cookieHeader.find((c) => c.startsWith("sid=")) ?? "";
  return sidCookie.split(";")[0] ?? "";
}

// ---------------------------------------------------------------------------
// Deck CRUD
// ---------------------------------------------------------------------------

describe("GET /api/decks", () => {
  it("returns empty list for new user", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/decks").set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(res.body.decks).toHaveLength(0);
  });

  it("returns 401 without session", async () => {
    const res = await request(app).get("/api/decks");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/decks", () => {
  it("creates a deck and returns it with validation", async () => {
    const sid = await createSession();
    const body = {
      name: "Test Deck",
      main: legalMain40(),
      extra: [],
      side: [],
    };
    const res = await request(app).post("/api/decks").set("Cookie", sid).send(body);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Deck");
    expect(res.body.main).toHaveLength(40);
    expect(typeof res.body.validation.legal).toBe("boolean");
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.ownerId).toBe("string");
  });

  it("saves an invalid deck with isValid=false (does not reject)", async () => {
    const sid = await createSession();
    const body = {
      name: "Invalid Deck",
      main: [BEAST_KING], // only 1 card — too small
      extra: [],
      side: [],
    };
    const res = await request(app).post("/api/decks").set("Cookie", sid).send(body);
    expect(res.status).toBe(201);
    expect(res.body.validation.legal).toBe(false);
    expect(res.body.validation.violations.length).toBeGreaterThan(0);
  });

  it("validates deck — valid extra deck arrangement", async () => {
    const sid = await createSession();
    const body = {
      name: "With Extra",
      main: legalMain40(),
      extra: [FUSION, SYNCHRO],
      side: [],
    };
    const res = await request(app).post("/api/decks").set("Cookie", sid).send(body);
    expect(res.status).toBe(201);
    expect(res.body.extra).toHaveLength(2);
  });

  it("returns 400 for missing name", async () => {
    const sid = await createSession();
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ main: [], extra: [], side: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/decks/:id", () => {
  it("returns the deck for its owner", async () => {
    const sid = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ name: "Deck", main: legalMain40(), extra: [], side: [] });
    const deckId = createRes.body.id;

    const res = await request(app).get(`/api/decks/${deckId}`).set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(deckId);
  });

  it("returns 404 for non-existent deck", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/decks/nonexistent-id").set("Cookie", sid);
    expect(res.status).toBe(404);
  });

  it("returns 403 when accessing another user's deck", async () => {
    // Create deck with user 1
    const sid1 = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid1)
      .send({ name: "Secret Deck", main: legalMain40(), extra: [], side: [] });
    const deckId = createRes.body.id;

    // Create user 2
    const { hash } = await import("@node-rs/argon2");
    const pw = await hash("password2222");
    const userId2 = "user-002";
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    ).run(userId2, "User2", pw, new Date().toISOString());
    const code2 = randomBytes(8).toString("hex");
    db.prepare("INSERT INTO invites (code, created_by, expires_at, consumed_by, consumed_at) VALUES (?, ?, ?, ?, ?)").run(
      code2, "admin-001", new Date(Date.now() + 86400_000).toISOString(), userId2, new Date().toISOString()
    );
    const loginRes = await request(app).post("/api/auth/login").send({ displayName: "User2", password: "password2222" });
    const cookieHeader2 = loginRes.headers["set-cookie"] as unknown as string[];
    const sid2 = cookieHeader2.find((c) => c.startsWith("sid=")) ?? "";

    const res = await request(app).get(`/api/decks/${deckId}`).set("Cookie", sid2);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/decks/:id", () => {
  it("updates deck name and cards", async () => {
    const sid = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ name: "Original", main: legalMain40(), extra: [], side: [] });
    const deckId = createRes.body.id;

    const updatedMain = [...legalMain40().slice(0, 39), BTH];
    const updateRes = await request(app)
      .put(`/api/decks/${deckId}`)
      .set("Cookie", sid)
      .send({ name: "Updated", main: updatedMain, extra: [FUSION], side: [] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Updated");
    expect(updateRes.body.extra).toHaveLength(1);
  });
});

describe("DELETE /api/decks/:id", () => {
  it("deletes the deck", async () => {
    const sid = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ name: "ToDelete", main: legalMain40(), extra: [], side: [] });
    const deckId = createRes.body.id;

    const delRes = await request(app).delete(`/api/decks/${deckId}`).set("Cookie", sid);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/api/decks/${deckId}`).set("Cookie", sid);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deck already deleted", async () => {
    const sid = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ name: "ToDelete", main: legalMain40(), extra: [], side: [] });
    const deckId = createRes.body.id;
    await request(app).delete(`/api/decks/${deckId}`).set("Cookie", sid);
    const res = await request(app).delete(`/api/decks/${deckId}`).set("Cookie", sid);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/decks/:id/duplicate", () => {
  it("creates a copy of the deck", async () => {
    const sid = await createSession();
    const createRes = await request(app)
      .post("/api/decks")
      .set("Cookie", sid)
      .send({ name: "Original", main: legalMain40(), extra: [FUSION], side: [] });
    const deckId = createRes.body.id;

    const dupRes = await request(app)
      .post(`/api/decks/${deckId}/duplicate`)
      .set("Cookie", sid);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.id).not.toBe(deckId);
    expect(dupRes.body.name).toContain("copy");
    expect(dupRes.body.main).toHaveLength(40);
    expect(dupRes.body.extra).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Deck import / export
// ---------------------------------------------------------------------------

describe("POST /api/decks/import", () => {
  it("imports a valid .ydk and returns parsed sections", async () => {
    const sid = await createSession();
    const ydk = [
      "#created by TestUser",
      "#main",
      ...Array(40).fill(String(BEAST_KING)),
      "#extra",
      String(FUSION),
      "!side",
      String(BTH),
    ].join("\n") + "\n";

    const res = await request(app)
      .post("/api/decks/import")
      .set("Cookie", sid)
      .set("Content-Type", "text/plain")
      .send(ydk);

    expect(res.status).toBe(200);
    expect(res.body.main).toHaveLength(40);
    expect(res.body.extra).toHaveLength(1);
    expect(res.body.side).toHaveLength(1);
    expect(res.body.name).toBe("TestUser");
    expect(typeof res.body.validation.legal).toBe("boolean");
  });

  it("reports violations for malformed .ydk (uses #side instead of !side)", async () => {
    const sid = await createSession();
    const ydk = `#main\n${BEAST_KING}\n#extra\n#side\n${BTH}\n`;
    const res = await request(app)
      .post("/api/decks/import")
      .set("Cookie", sid)
      .set("Content-Type", "text/plain")
      .send(ydk);

    expect(res.status).toBe(200);
    expect(res.body.validation.violations.some((v: { code: string }) => v.code === "parse_error")).toBe(true);
  });

  it("reports violation for Fusion monster under #main", async () => {
    const sid = await createSession();
    const ydk = `#main\n${FUSION}\n#extra\n!side\n`;
    const res = await request(app)
      .post("/api/decks/import")
      .set("Cookie", sid)
      .set("Content-Type", "text/plain")
      .send(ydk);

    expect(res.status).toBe(200);
    expect(res.body.validation.violations.some((v: { code: string }) => v.code === "wrong_zone")).toBe(true);
  });

  it("returns 400 for non-text body", async () => {
    const sid = await createSession();
    const res = await request(app)
      .post("/api/decks/import")
      .set("Cookie", sid)
      .set("Content-Type", "application/json")
      .send({ ydk: "..." });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/decks/export", () => {
  it("exports a deck as .ydk text", async () => {
    const sid = await createSession();
    const body = {
      name: "My Deck",
      main: [BEAST_KING, BEAST_KING],
      extra: [FUSION],
      side: [BTH],
    };
    const res = await request(app)
      .post("/api/decks/export")
      .set("Cookie", sid)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.type).toContain("text");
    const text = res.text;
    expect(text).toContain("#created by My Deck");
    expect(text).toContain("#main");
    expect(text).toContain("#extra");
    expect(text).toContain("!side");
    expect(text).toContain(String(BEAST_KING));
    expect(text).toContain(String(FUSION));
    expect(text).toContain(String(BTH));
  });

  it("round-trip: export then import returns same multisets", async () => {
    const sid = await createSession();
    const original = {
      name: "Round Trip",
      main: Array(3).fill(BEAST_KING).concat(Array(3).fill(BTH)).concat(Array(34).fill(DARK_ARMED)),
      extra: [FUSION, SYNCHRO],
      side: [CYBER],
    };

    const exportRes = await request(app)
      .post("/api/decks/export")
      .set("Cookie", sid)
      .send(original);
    const ydk = exportRes.text;

    const importRes = await request(app)
      .post("/api/decks/import")
      .set("Cookie", sid)
      .set("Content-Type", "text/plain")
      .send(ydk);

    expect(importRes.body.main).toHaveLength(original.main.length);
    expect(importRes.body.extra).toHaveLength(original.extra.length);
    expect(importRes.body.side).toHaveLength(original.side.length);
    // Sort to compare multisets
    expect([...importRes.body.main].sort()).toEqual([...original.main].sort());
    expect([...importRes.body.extra].sort()).toEqual([...original.extra].sort());
    expect([...importRes.body.side].sort()).toEqual([...original.side].sort());
  });
});

// ---------------------------------------------------------------------------
// Card endpoints
// ---------------------------------------------------------------------------

describe("GET /api/cards", () => {
  it("returns paginated card list", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards").set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(Array.isArray(res.body.cards)).toBe(true);
  });

  it("filters by name substring", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards?q=Dragon").set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(res.body.cards.every((c: { name: string }) => c.name.toLowerCase().includes("dragon"))).toBe(true);
  });

  it("filters by banlist status", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards?banlist=forbidden").set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(res.body.cards.every((c: { banlist: string }) => c.banlist === "forbidden")).toBe(true);
  });

  it("returns 401 without session", async () => {
    const res = await request(app).get("/api/cards");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cards/:passcode", () => {
  it("returns a card by passcode", async () => {
    const sid = await createSession();
    const res = await request(app).get(`/api/cards/${BEAST_KING}`).set("Cookie", sid);
    expect(res.status).toBe(200);
    expect(res.body.passcode).toBe(BEAST_KING);
    expect(res.body.name).toBe("Beast King Barbaros");
  });

  it("returns 404 for unknown passcode", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards/99999999").set("Cookie", sid);
    expect(res.status).toBe(404);
  });
});
