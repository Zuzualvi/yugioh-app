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

  // Migration 2: duel tables (Spec 20)
  `
  CREATE TABLE IF NOT EXISTS duel (
    id                     TEXT NOT NULL PRIMARY KEY,
    join_token             TEXT NOT NULL UNIQUE,
    seat0_token            TEXT NOT NULL,
    seat1_token            TEXT NOT NULL,
    seat0_user_id          TEXT NOT NULL,
    seat1_user_id          TEXT,
    seed_json              TEXT NOT NULL,
    duel_flags             TEXT NOT NULL,
    deck0_json             TEXT NOT NULL,
    deck1_json             TEXT,
    timer_per_move_seconds INTEGER NOT NULL,
    deadline_at            INTEGER,
    on_clock_seat          INTEGER,
    status                 TEXT NOT NULL DEFAULT 'waiting_for_opponent',
    winner                 INTEGER,
    end_reason             TEXT,
    created_at             INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS response_log (
    duel_id       TEXT NOT NULL REFERENCES duel(id),
    seq           INTEGER NOT NULL,
    seat          INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    received_at   INTEGER NOT NULL,
    PRIMARY KEY (duel_id, seq)
  );
  `,
  // Migration 3: duel_room table (ZUH-26, additive only, no existing table altered)
  `
  CREATE TABLE IF NOT EXISTS duel_room (
    id                     TEXT NOT NULL PRIMARY KEY,
    join_token             TEXT NOT NULL UNIQUE,
    join_token_consumed_at INTEGER,
    creator_user_id        TEXT NOT NULL,
    opponent_user_id       TEXT,
    timer_per_move_seconds INTEGER NOT NULL,
    seed_json              TEXT NOT NULL,
    creator_deck_id        TEXT,
    opponent_deck_id       TEXT,
    creator_deck_json      TEXT,
    opponent_deck_json     TEXT,
    creator_ready_at       INTEGER,
    opponent_ready_at      INTEGER,
    room_deadline_at       INTEGER NOT NULL,
    flip_winner_user_id    TEXT,
    flip_rolled_at         INTEGER,
    flip_choice            TEXT,
    flip_choice_at         INTEGER,
    status                 TEXT NOT NULL DEFAULT 'open',
    closed_reason          TEXT,
    closed_by_user_id      TEXT,
    created_at             INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_duel_room_join_token ON duel_room(join_token);
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
