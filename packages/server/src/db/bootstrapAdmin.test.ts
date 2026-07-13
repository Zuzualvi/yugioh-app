import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDb } from "./openDb.js";
import { bootstrapAdmin } from "./bootstrapAdmin.js";
import Database from "better-sqlite3";
import { verify } from "@node-rs/argon2";

// ---------------------------------------------------------------------------
// Tests for BUG-3 fix — admin bootstrap via env vars
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  display_name: string;
  role: string;
  password_hash: string;
}

let db: InstanceType<typeof Database>;

beforeEach(() => {
  db = openDb(":memory:");
  delete process.env["BOOTSTRAP_ADMIN_USERNAME"];
  delete process.env["BOOTSTRAP_ADMIN_PASSWORD"];
});

afterEach(() => {
  db.close();
  delete process.env["BOOTSTRAP_ADMIN_USERNAME"];
  delete process.env["BOOTSTRAP_ADMIN_PASSWORD"];
});

describe("bootstrapAdmin — BUG-3 fix", () => {
  it("creates admin when env vars are set and no admin exists", async () => {
    process.env["BOOTSTRAP_ADMIN_USERNAME"] = "founder";
    process.env["BOOTSTRAP_ADMIN_PASSWORD"] = "strongpassword1";

    await bootstrapAdmin(db);

    const user = db
      .prepare("SELECT id, display_name, role, password_hash FROM users WHERE display_name = ?")
      .get("founder") as UserRow | undefined;

    expect(user).toBeDefined();
    expect(user?.role).toBe("admin");
    expect(user?.display_name).toBe("founder");
    // Password must be hashed (argon2id), never stored plaintext
    expect(user?.password_hash).not.toBe("strongpassword1");
    const ok = await verify(user!.password_hash, "strongpassword1");
    expect(ok).toBe(true);
  });

  it("does nothing when env vars are not set", async () => {
    await bootstrapAdmin(db);
    const count = (db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number }).n;
    expect(count).toBe(0);
  });

  it("does nothing when only one env var is set", async () => {
    process.env["BOOTSTRAP_ADMIN_USERNAME"] = "founder";
    await bootstrapAdmin(db);
    const count = (db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number }).n;
    expect(count).toBe(0);
  });

  it("is idempotent — does not create a second admin if one already exists", async () => {
    process.env["BOOTSTRAP_ADMIN_USERNAME"] = "founder";
    process.env["BOOTSTRAP_ADMIN_PASSWORD"] = "strongpassword1";

    await bootstrapAdmin(db);
    await bootstrapAdmin(db); // second call

    const count = (
      db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get() as { n: number }
    ).n;
    expect(count).toBe(1); // still only 1 admin
  });

  it("does not create admin when an admin already exists (even different username)", async () => {
    // Insert an existing admin manually
    db.prepare(
      "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
    ).run("existing-admin", "ExistingAdmin", "hash", new Date().toISOString());

    process.env["BOOTSTRAP_ADMIN_USERNAME"] = "newadmin";
    process.env["BOOTSTRAP_ADMIN_PASSWORD"] = "newpassword1";

    await bootstrapAdmin(db);

    const count = (
      db.prepare("SELECT COUNT(*) as n FROM users WHERE role='admin'").get() as { n: number }
    ).n;
    expect(count).toBe(1); // no second admin created
    const names = db.prepare("SELECT display_name FROM users WHERE role='admin'").all() as {
      display_name: string;
    }[];
    expect(names[0]?.display_name).toBe("ExistingAdmin"); // original admin unchanged
  });
});
