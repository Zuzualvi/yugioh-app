import { Router } from "express";
import Database from "better-sqlite3";
import { hash, verify } from "@node-rs/argon2";
import { randomUUID, randomBytes } from "node:crypto";
import { RedeemInviteBodySchema, LoginBodySchema } from "@yugioh-app/contracts";

// ---------------------------------------------------------------------------
// Auth routes — Spec 13 §3 §4
//
//   POST /api/auth/redeem-invite
//   POST /api/auth/login
//   POST /api/auth/logout
//   GET  /api/me
//   POST /api/admin/invites  (admin only, handled in adminRouter)
// ---------------------------------------------------------------------------

const SESSION_TTL_DAYS = 30;
const SESSION_COOKIE = "sid";

function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

function setCookie(res: import("express").Response, sid: string): void {
  const isProd = process.env["NODE_ENV"] === "production";
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: new Date(sessionExpiresAt()),
    path: "/",
  });
}

interface InviteRow {
  code: string;
  created_by: string;
  expires_at: string;
  consumed_by: string | null;
  consumed_at: string | null;
}

interface UserRow {
  id: string;
  display_name: string;
  role: string;
  password_hash: string;
}

export function createAuthRouter(db: InstanceType<typeof Database>): Router {
  const router = Router();

  // POST /api/auth/redeem-invite
  router.post("/redeem-invite", async (req, res): Promise<void> => {
    const parsed = RedeemInviteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }
    const { inviteCode, displayName, password } = parsed.data;

    const invite = db
      .prepare(
        "SELECT code, created_by, expires_at, consumed_by, consumed_at FROM invites WHERE code = ?",
      )
      .get(inviteCode) as InviteRow | undefined;

    if (!invite) {
      res
        .status(400)
        .json({ error: { code: "invite_invalid", message: "Invite code not found." } });
      return;
    }
    if (invite.consumed_by !== null) {
      res
        .status(400)
        .json({ error: { code: "invite_invalid", message: "Invite code already used." } });
      return;
    }
    if (new Date(invite.expires_at) < new Date()) {
      res.status(400).json({ error: { code: "invite_invalid", message: "Invite code expired." } });
      return;
    }

    const passwordHash = await hash(password);
    const userId = randomUUID();
    const now = new Date().toISOString();

    // Insert user + mark invite consumed in a transaction
    const insertUser = db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)",
    );
    const consumeInvite = db.prepare(
      "UPDATE invites SET consumed_by = ?, consumed_at = ? WHERE code = ?",
    );

    db.transaction(() => {
      insertUser.run(userId, displayName, passwordHash, now);
      consumeInvite.run(userId, now, inviteCode);
    })();

    const sid = randomBytes(32).toString("hex");
    const expiresAt = sessionExpiresAt();
    db.prepare("INSERT INTO sessions (sid, user_id, expires_at) VALUES (?, ?, ?)").run(
      sid,
      userId,
      expiresAt,
    );

    setCookie(res, sid);
    res.status(201).json({ user: { id: userId, displayName, role: "member" } });
  });

  // POST /api/auth/login
  router.post("/login", async (req, res): Promise<void> => {
    const parsed = LoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(401).json({ error: { code: "bad_credentials", message: "Invalid credentials." } });
      return;
    }
    const { displayName, password } = parsed.data;

    // Note: display_name is NOT unique per REQ-AUTH-06; we look up by name but
    // multiple users may share a display name. For login we try the first match.
    // In a real product you'd use a unique handle; the spec explicitly says
    // display_name is non-unique but identity binds to id. We handle it by
    // iterating matches (no account enumeration distinction).
    const users = db
      .prepare("SELECT id, display_name, password_hash, role FROM users WHERE display_name = ?")
      .all(displayName) as UserRow[];

    let matched: UserRow | null = null;
    for (const user of users) {
      const ok = await verify(user.password_hash, password);
      if (ok) {
        matched = user;
        break;
      }
    }

    if (!matched) {
      res.status(401).json({ error: { code: "bad_credentials", message: "Invalid credentials." } });
      return;
    }

    const sid = randomBytes(32).toString("hex");
    const expiresAt = sessionExpiresAt();
    db.prepare("INSERT INTO sessions (sid, user_id, expires_at) VALUES (?, ?, ?)").run(
      sid,
      matched.id,
      expiresAt,
    );

    setCookie(res, sid);
    res.status(200).json({
      user: { id: matched.id, displayName: matched.display_name, role: matched.role },
    });
  });

  // POST /api/auth/logout
  router.post("/logout", (req, res): void => {
    const sid = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (sid) {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  });

  return router;
}

// GET /api/me — needs session middleware applied at app level, handled in app.ts
export function createMeRouter(db: InstanceType<typeof Database>): Router {
  const router = Router();
  router.get("/", (req, res): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: "unauthenticated", message: "Not authenticated." } });
      return;
    }
    res.status(200).json({ user: req.user });
  });
  // db is used indirectly through requireSession middleware; reference to suppress lint
  void db;
  return router;
}

// POST /api/admin/invites
export function createAdminRouter(db: InstanceType<typeof Database>): Router {
  const router = Router();

  router.post("/invites", (req, res): void => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day invite window

    const code = randomBytes(16).toString("hex");
    const createdBy = req.user!.id;

    db.prepare("INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, ?)").run(
      code,
      createdBy,
      expiresAt.toISOString(),
    );

    res.status(201).json({ inviteCode: code, expiresAt: expiresAt.toISOString() });
  });

  return router;
}
