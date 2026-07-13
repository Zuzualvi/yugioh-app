/**
 * E2E Server helper — starts the real Express server against the real catalog.
 *
 * Portable: locates all paths relative to this file via __dirname / import.meta.url.
 * No hardcoded absolute paths.
 *
 * Admin bootstrap: uses BOOTSTRAP_ADMIN_USERNAME + BOOTSTRAP_ADMIN_PASSWORD env vars
 * (BUG-3 fix), then logs in via POST /api/auth/login to obtain a real session cookie.
 */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root: e2e/helpers/ → e2e/ → <repoRoot>
export const REPO_ROOT = resolve(__dirname, "../..");

const SERVER_ENTRY = join(REPO_ROOT, "packages/server/src/index.ts");
const VITE_NODE_BIN = join(REPO_ROOT, "node_modules/.bin/vite-node");

const BOOTSTRAP_USERNAME = "E2EAdmin";
const BOOTSTRAP_PASSWORD = "e2eBootstrap!Secure1";

let serverProcess = null;
let dbPath = null;
let serverPort = null;

/**
 * Wait until the server is ready (any protected endpoint returns 401, meaning
 * the server is up and routing).
 */
async function waitForServer(port, maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://localhost:${port}/api/cards`);
      if (res.status === 401 || res.status === 200) return;
    } catch (_) {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start on port ${port} within ${maxMs}ms`);
}

/**
 * Log in with the bootstrapped admin credentials; return the sid cookie.
 */
async function loginAdmin(baseUrl) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: BOOTSTRAP_USERNAME, password: BOOTSTRAP_PASSWORD }),
  });
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`Admin login failed (${res.status}): ${body}`);
  }
  const sid = extractSid(res);
  if (!sid) throw new Error("Admin login succeeded but no sid cookie was set");
  const { user } = await res.clone().json();
  return { sid, user };
}

/**
 * Start the real server using the real catalog and the env-based admin bootstrap.
 */
export async function startServer() {
  serverPort = 13901;
  dbPath = join(tmpdir(), `yugioh-e2e-${process.pid}.db`);

  serverProcess = spawn(VITE_NODE_BIN, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      DB_PATH: dbPath,
      NODE_ENV: "test",
      BOOTSTRAP_ADMIN_USERNAME: BOOTSTRAP_USERNAME,
      BOOTSTRAP_ADMIN_PASSWORD: BOOTSTRAP_PASSWORD,
    },
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[server-err] ${d}`));

  const baseUrl = `http://localhost:${serverPort}`;
  await waitForServer(serverPort);

  // Log in as the bootstrapped admin to obtain a real session cookie
  const { sid: adminSid, user: adminUser } = await loginAdmin(baseUrl);

  return { baseUrl, admin: { adminSid, user: adminUser } };
}

/**
 * Stop the server and clean up temp DB.
 */
export async function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  if (dbPath && existsSync(dbPath)) {
    try {
      rmSync(dbPath);
    } catch (_) {
      // best-effort
    }
  }
}

/** Make a fetch with a session cookie. */
export function authedFetch(baseUrl, sid, path, options = {}) {
  const headers = { ...(options.headers ?? {}), Cookie: `sid=${sid}` };
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

/** JSON POST with session cookie. */
export function jsonPost(baseUrl, sid, path, body) {
  return authedFetch(baseUrl, sid, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** JSON PUT with session cookie. */
export function jsonPut(baseUrl, sid, path, body) {
  return authedFetch(baseUrl, sid, path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Extract the sid value from a Set-Cookie header. */
export function extractSid(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const m = raw.match(/sid=([^;]+)/);
  return m ? (m[1] ?? null) : null;
}
