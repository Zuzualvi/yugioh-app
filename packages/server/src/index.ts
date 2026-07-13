import { openDb } from "./db/openDb.js";
import { bootstrapAdmin } from "./db/bootstrapAdmin.js";
import { loadCatalog } from "./catalog/loadCatalog.js";
import { createApp } from "./app.js";

// ---------------------------------------------------------------------------
// Server entry point.
//
// Environment variables:
//   PORT                      — HTTP port (default 3001)
//   DB_PATH                   — SQLite file path (default ./yugioh.db)
//   BOOTSTRAP_ADMIN_USERNAME  — If set (with BOOTSTRAP_ADMIN_PASSWORD), creates
//                               the first admin user when none exists yet.
//   BOOTSTRAP_ADMIN_PASSWORD  — Paired with the above.
//   ALLOW_FIXTURE_CATALOG=1   — Allow falling back to the 22-card fixture
//                               catalog when the real catalog is absent.
//                               NEVER set this in production.
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const DB_PATH = process.env["DB_PATH"] ?? "./yugioh.db";

const db = openDb(DB_PATH);
await bootstrapAdmin(db);

const catalog = loadCatalog();
const app = createApp(db, catalog);

app.listen(PORT, () => {
  console.log(`Yu-Gi-Oh server listening on port ${PORT}`);
});
