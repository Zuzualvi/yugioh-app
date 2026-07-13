import Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

// ---------------------------------------------------------------------------
// Open (or create) the SQLite database and apply migrations.
// Pass ':memory:' for in-memory (tests).
// ---------------------------------------------------------------------------

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
