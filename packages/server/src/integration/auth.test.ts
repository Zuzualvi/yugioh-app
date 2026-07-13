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
// Integration tests for auth endpoints (real HTTP, in-memory SQLite)
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

beforeEach(() => {
  db = openDb(":memory:");
  catalog = makeTestCatalog();
  app = createApp(db, catalog);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Helper: seed an admin user + invite code directly in DB
// ---------------------------------------------------------------------------
async function seedAdminAndInvite(): Promise<{ adminId: string; inviteCode: string }> {
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

  return { adminId, inviteCode };
}

async function adminLogin(): Promise<{ sid: string; adminId: string }> {
  const { adminId } = await seedAdminAndInvite();
  const res = await request(app)
    .post("/api/auth/login")
    .send({ displayName: "Admin", password: "adminpass1" });
  const cookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const sid = cookie?.find((c) => c.startsWith("sid="))?.split(";")[0]?.slice(4) ?? "";
  return { sid, adminId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/redeem-invite", () => {
  it("creates account and sets session cookie for valid invite", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    const res = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.displayName).toBe("Alice");
    expect(res.body.user.role).toBe("member");
    const setCookieHeader = res.headers["set-cookie"] as unknown as string[] | undefined;
    expect(setCookieHeader?.some((c) => c.startsWith("sid="))).toBe(true);
  });

  it("rejects invalid invite code", async () => {
    const res = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode: "does-not-exist",
      displayName: "Alice",
      password: "securepass1",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invite_invalid");
  });

  it("rejects already-consumed invite", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    // First redemption succeeds
    await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });
    // Second redemption fails
    const res2 = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Bob",
      password: "otherpass1",
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("invite_invalid");
  });

  it("rejects expired invite", async () => {
    const adminId = "admin-001";
    const { hash } = await import("@node-rs/argon2");
    const pw = await hash("adminpass1");
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
    ).run(adminId, "Admin", pw, new Date().toISOString());

    const code = randomBytes(8).toString("hex");
    const expired = new Date(Date.now() - 1000).toISOString();
    db.prepare("INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, ?)").run(
      code,
      adminId,
      expired,
    );

    const res = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode: code,
      displayName: "Alice",
      password: "securepass1",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invite_invalid");
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and session cookie for correct credentials", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });

    const res = await request(app).post("/api/auth/login").send({
      displayName: "Alice",
      password: "securepass1",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Alice");
    const setCookieHeader = res.headers["set-cookie"] as unknown as string[] | undefined;
    expect(setCookieHeader?.some((c) => c.startsWith("sid="))).toBe(true);
  });

  it("returns 401 for wrong password (no account enumeration)", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });

    const res = await request(app).post("/api/auth/login").send({
      displayName: "Alice",
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("bad_credentials");
  });

  it("returns 401 for non-existent user", async () => {
    const res = await request(app).post("/api/auth/login").send({
      displayName: "NoSuchUser",
      password: "doesntmatter",
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204 and clears the session cookie", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    const redeemRes = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });
    const cookieHeader = redeemRes.headers["set-cookie"] as unknown as string[];
    const sidCookie = cookieHeader.find((c) => c.startsWith("sid=")) ?? "";

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", sidCookie.split(";")[0] ?? "");
    expect(logoutRes.status).toBe(204);
  });

  it("logout without session returns 204 (idempotent)", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
  });
});

describe("GET /api/me", () => {
  it("returns user for authenticated session", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    const redeemRes = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });
    const cookieHeader = redeemRes.headers["set-cookie"] as unknown as string[];
    const sidCookie = cookieHeader.find((c) => c.startsWith("sid=")) ?? "";

    const meRes = await request(app)
      .get("/api/me")
      .set("Cookie", sidCookie.split(";")[0] ?? "");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.displayName).toBe("Alice");
    expect(meRes.body.user.role).toBe("member");
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/invites", () => {
  it("admin can create an invite code", async () => {
    const { sid } = await adminLogin();
    const res = await request(app)
      .post("/api/admin/invites")
      .set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(201);
    expect(typeof res.body.inviteCode).toBe("string");
    expect(res.body.inviteCode.length).toBeGreaterThan(0);
    expect(typeof res.body.expiresAt).toBe("string");
  });

  it("member cannot create invite (403)", async () => {
    const { inviteCode } = await seedAdminAndInvite();
    const redeemRes = await request(app).post("/api/auth/redeem-invite").send({
      inviteCode,
      displayName: "Alice",
      password: "securepass1",
    });
    const cookieHeader = redeemRes.headers["set-cookie"] as unknown as string[];
    const sidCookie = cookieHeader.find((c) => c.startsWith("sid=")) ?? "";
    const sid = sidCookie.split(";")[0]?.slice(4) ?? "";

    const res = await request(app)
      .post("/api/admin/invites")
      .set("Cookie", `sid=${sid}`);
    expect(res.status).toBe(403);
  });

  it("unauthenticated request to admin endpoint returns 401", async () => {
    const res = await request(app).post("/api/admin/invites");
    expect(res.status).toBe(401);
  });
});
