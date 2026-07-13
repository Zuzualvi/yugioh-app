import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Admin bootstrap — BUG-3 fix (Spec 10)
//
// If BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are set AND no
// admin exists yet, create the first admin user. Idempotent: never overwrites
// an existing admin. Never creates an admin when env vars are absent.
//
// Usage (server startup):
//   await bootstrapAdmin(db);
//
// The server README documents the env vars required.
// ---------------------------------------------------------------------------

interface AdminRow {
  id: string;
}

export async function bootstrapAdmin(db: InstanceType<typeof Database>): Promise<void> {
  const username = process.env["BOOTSTRAP_ADMIN_USERNAME"];
  const password = process.env["BOOTSTRAP_ADMIN_PASSWORD"];

  if (!username || !password) return; // env vars not set → skip

  // Check if any admin already exists (idempotent guard)
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as
    AdminRow | undefined;
  if (existing) return; // admin already present → nothing to do

  const passwordHash = await hash(password);
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
  ).run(id, username, passwordHash, now);

  console.log(`[bootstrap] Created admin user "${username}" (id=${id}).`);
}
