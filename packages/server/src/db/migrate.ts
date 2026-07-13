import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Idempotent SQLite migrations — Spec 13 §5
//
// Schema (V1):
//   users(id, display_name, password_hash, role, created_at)
//   invites(code, created_by, expires_at, consumed_by, consumed_at)
//   sessions(sid, user_id, expires_at)
//   decks(id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at)
// ---------------------------------------------------------------------------

const MIGRATIONS: string[] = [
  // Migration 1: initial schema
  `
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT NOT NULL PRIMARY KEY,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    code        TEXT NOT NULL PRIMARY KEY,
    created_by  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    consumed_by TEXT,
    consumed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid         TEXT NOT NULL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decks (
    id          TEXT NOT NULL PRIMARY KEY,
    owner_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    main_json   TEXT NOT NULL,
    extra_json  TEXT NOT NULL,
    side_json   TEXT NOT NULL,
    is_valid    INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER NOT NULL PRIMARY KEY,
    applied_at  TEXT NOT NULL
  );
  `,
];

export function runMigrations(db: InstanceType<typeof Database>): void {
  // Ensure migrations table exists first (bootstrap)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    const already = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(version);

    if (!already) {
      db.exec(MIGRATIONS[i] ?? "");
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        version,
        new Date().toISOString(),
      );
    }
  }
}
