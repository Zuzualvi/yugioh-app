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
// Integration tests: GET /api/cards?passcodes=…
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

let db: Database.Database;
let app: Application;

// Known fixture passcodes (ascending order in catalog)
const BEAST_KING = 89631139;
const DARK_MAGICIAN = 46986414;
const DARK_ARMED = 70781052;

beforeEach(() => {
  db = openDb(":memory:");
  const catalog = makeTestCatalog();
  app = createApp(db, catalog);
});

afterEach(() => {
  db.close();
});

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
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const sidCookie = cookies.find((c: string) => c.startsWith("sid=")) ?? "";
  return sidCookie.split(";")[0] ?? "";
}

describe("GET /api/cards?passcodes — batch filter", () => {
  it("returns exactly the requested cards in catalog order", async () => {
    const sid = await createSession();
    const res = await request(app)
      .get(`/api/cards?passcodes=${BEAST_KING},${DARK_MAGICIAN}`)
      .set("Cookie", sid);

    expect(res.status).toBe(200);
    const passcodes: number[] = res.body.cards.map((c: { passcode: number }) => c.passcode);
    // Both requested cards are returned
    expect(new Set(passcodes)).toEqual(new Set([BEAST_KING, DARK_MAGICIAN]));
    expect(passcodes.length).toBe(2);
    expect(res.body.total).toBe(2);
    // Order matches catalog order (fixture has BEAST_KING before DARK_MAGICIAN)
    const bkIdx = passcodes.indexOf(BEAST_KING);
    const dmIdx = passcodes.indexOf(DARK_MAGICIAN);
    expect(bkIdx).toBeLessThan(dmIdx);
  });

  it("silently skips unknown passcodes", async () => {
    const sid = await createSession();
    const unknown = 99999999;
    const res = await request(app)
      .get(`/api/cards?passcodes=${BEAST_KING},${unknown}`)
      .set("Cookie", sid);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.cards[0].passcode).toBe(BEAST_KING);
  });

  it("returns all matches even when list exceeds default pageSize", async () => {
    const sid = await createSession();
    // Use more passcodes than would fit in a single default page (pageSize=60 by default,
    // but the fixture only has ~22 cards — use all of them to verify bypass)
    const allFixturePasscodes = FIXTURE_CARDS.map((c) => c.passcode).join(",");
    const res = await request(app)
      .get(`/api/cards?passcodes=${allFixturePasscodes}`)
      .set("Cookie", sid);

    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBe(res.body.total);
    expect(res.body.total).toBe(FIXTURE_CARDS.length);
    // pageSize must equal total (positive int guard)
    expect(res.body.pageSize).toBe(FIXTURE_CARDS.length);
    expect(res.body.page).toBe(1);
  });

  it("returns pageSize=1 and total=0 when no passcodes match", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards?passcodes=99999998,99999999").set("Cookie", sid);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.cards).toEqual([]);
  });

  it("rejects an invalid passcodes value (non-numeric)", async () => {
    const sid = await createSession();
    const res = await request(app).get(`/api/cards?passcodes=${DARK_ARMED},abc`).set("Cookie", sid);

    expect(res.status).toBe(400);
  });

  it("with passcodes absent, existing pagination behavior is unchanged", async () => {
    const sid = await createSession();
    const res = await request(app).get("/api/cards?pageSize=2&page=1").set("Cookie", sid);

    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeLessThanOrEqual(2);
    expect(res.body.pageSize).toBe(2);
  });
});
