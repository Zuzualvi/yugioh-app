import { openDb } from "./db/openDb.js";
import { loadCatalog } from "./catalog/loadCatalog.js";
import { createApp } from "./app.js";

// ---------------------------------------------------------------------------
// Server entry point — starts the HTTP server.
// The DB path and port can be configured via environment variables.
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const DB_PATH = process.env["DB_PATH"] ?? "./yugioh.db";

const db = openDb(DB_PATH);
const catalog = loadCatalog();
const app = createApp(db, catalog);

app.listen(PORT, () => {
  console.log(`Yu-Gi-Oh server listening on port ${PORT}`);
});
