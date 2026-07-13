/**
 * E2E Server helper — starts the real Express server against the real catalog.
 *
 * Portable: locates all paths relative to this file via __dirname / import.meta.url.
 * No hardcoded /workspace paths.
 *
 * Bug workarounds (documented bugs reported to engineering team):
 *
 * BUG-1 (loadCatalog.ts path): The server resolves the card catalog via
 *   join(__dirname, "../../../../card-data/out/...") which resolves to
 *   <repoRoot>/card-data/out/ but the actual artifact is at
 *   <repoRoot>/packages/card-data/out/. A symlink <repoRoot>/card-data →
 *   <filteredCatalogDir> is created at setup time.
 *
 * BUG-2 (passcode 0 in catalog): The catalog contains "Orichalcos Shunoros"
 *   with passcode 0, but CardDTOSchema requires z.number().int().positive()
 *   (> 0), so schema validation rejects the full catalog. The filtered catalog
 *   (3680 cards) is written to a temp dir; the symlink above points there.
 *
 * ADMIN BOOTSTRAP: No seed script or env-based bootstrap admin exists.
 *   The invite-only flow has a chicken-and-egg problem. This helper inserts
 *   an admin row directly into SQLite (as documented in the test report).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root: e2e/helpers/ → e2e/ → <repoRoot>
export const REPO_ROOT = resolve(__dirname, "../..");

// The server entry point
const SERVER_ENTRY = join(REPO_ROOT, "packages/server/src/index.ts");
const VITE_NODE_BIN = join(REPO_ROOT, "node_modules/.bin/vite-node");

// The real card catalog (from card-data package)
const REAL_CATALOG_PATH = join(REPO_ROOT, "packages/card-data/out/edison-card-catalog.json");
// Path the server actually resolves (BUG-1: wrong relative path)
const SERVER_CATALOG_SYMLINK = join(REPO_ROOT, "card-data");

let serverProcess = null;
let dbPath = null;
let adminSid = null;
let adminId = null;
let filteredCatalogDir = null;
let serverPort = null;

/**
 * Prepare filtered catalog to work around BUG-2 (passcode 0 rejected by schema).
 * Writes to a temp dir; symlinks <repoRoot>/card-data → temp dir (BUG-1 workaround).
 */
function prepareCatalog() {
  // Create temp dir for filtered catalog
  filteredCatalogDir = join(tmpdir(), `yugioh-e2e-catalog-${process.pid}`);
  const outDir = join(filteredCatalogDir, "out");
  mkdirSync(outDir, { recursive: true });

  const raw = JSON.parse(readFileSync(REAL_CATALOG_PATH, "utf-8"));
  const originalCount = raw.cards.length;
  // BUG-2 workaround: filter out cards with passcode 0
  raw.cards = raw.cards.filter((c) => c.passcode > 0);
  raw.count = raw.cards.length;

  writeFileSync(join(outDir, "edison-card-catalog.json"), JSON.stringify(raw));

  // BUG-1 workaround: create symlink so server resolves to filtered catalog
  // Remove existing symlink/dir if present
  try {
    const stat = existsSync(SERVER_CATALOG_SYMLINK);
    if (stat) {
      // Remove only if it's a symlink (lstat)
      rmSync(SERVER_CATALOG_SYMLINK, { recursive: false, force: true });
    }
  } catch (_) {}

  symlinkSync(filteredCatalogDir, SERVER_CATALOG_SYMLINK);

  return { filteredCount: raw.count, originalCount };
}

/**
 * Wait until the server is ready (GET /api/cards returns 401, meaning it's up
 * and routing, even before we have a session).
 */
async function waitForServer(port, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://localhost:${port}/api/cards`);
      if (res.status === 401 || res.status === 200) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start on port ${port} within ${maxMs}ms`);
}

/**
 * Bootstrap admin user + session directly into SQLite.
 * This is necessary because there is no seed/bootstrap mechanism in the server.
 */
async function bootstrapAdmin(db) {
  const { hash } = await import("@node-rs/argon2");
  const { randomUUID } = await import("node:crypto");

  adminId = randomUUID();
  const passwordHash = await hash("e2eAdminPass!1");
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO users (id, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
  ).run(adminId, "E2EAdmin", passwordHash, now);

  adminSid = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (sid, user_id, expires_at) VALUES (?, ?, ?)").run(
    adminSid,
    adminId,
    expiresAt,
  );

  return { adminId, adminSid, displayName: "E2EAdmin", password: "e2eAdminPass!1" };
}

/**
 * Start the real server, return helpers for tests.
 */
export async function startServer() {
  // Pick a free port in a safe range
  serverPort = 13901;
  dbPath = join(tmpdir(), `yugioh-e2e-${process.pid}.db`);

  // Prepare catalog (BUG-1 + BUG-2 workarounds)
  const catalogInfo = prepareCatalog();

  // Start server subprocess
  serverProcess = spawn(VITE_NODE_BIN, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      DB_PATH: dbPath,
      NODE_ENV: "test",
    },
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[server-err] ${d}`));

  await waitForServer(serverPort);

  // Open the DB and bootstrap admin
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(dbPath);
  const admin = await bootstrapAdmin(db);
  db.close();

  const baseUrl = `http://localhost:${serverPort}`;

  return {
    baseUrl,
    catalogCount: catalogInfo.filteredCount,
    admin,
    catalogInfo,
  };
}

/**
 * Stop the server and clean up.
 */
export async function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  // Clean up temp files
  if (dbPath && existsSync(dbPath)) {
    try {
      rmSync(dbPath);
    } catch (_) {}
  }
  // Remove the symlink we created
  try {
    if (existsSync(SERVER_CATALOG_SYMLINK)) {
      rmSync(SERVER_CATALOG_SYMLINK, { recursive: false, force: true });
    }
  } catch (_) {}
  // Clean up temp catalog dir
  if (filteredCatalogDir && existsSync(filteredCatalogDir)) {
    try {
      rmSync(filteredCatalogDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Utility: make a fetch with a session cookie.
 */
export function authedFetch(baseUrl, sid, path, options = {}) {
  const headers = { ...(options.headers || {}), Cookie: `sid=${sid}` };
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

/**
 * Utility: JSON POST
 */
export function jsonPost(baseUrl, sid, path, body) {
  return authedFetch(baseUrl, sid, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Utility: JSON PUT
 */
export function jsonPut(baseUrl, sid, path, body) {
  return authedFetch(baseUrl, sid, path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Utility: extract Set-Cookie sid from response headers
 */
export function extractSid(response) {
  const raw = response.headers.get("set-cookie") || "";
  const m = raw.match(/sid=([^;]+)/);
  return m ? m[1] : null;
}
