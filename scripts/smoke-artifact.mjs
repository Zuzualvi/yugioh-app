#!/usr/bin/env node
/**
 * smoke-artifact.mjs — Boots the esbuild bundle (dist/server.mjs) and asserts
 * the full route table plus both WebSocket upgrade paths.
 *
 * Usage: node scripts/smoke-artifact.mjs
 *
 * Exit 0 = all assertions passed.
 * Exit 1 = build failed, boot timed out, or one or more assertions failed.
 */

import { execSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { createServer, connect as netConnect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const req = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function ok(msg) {
  console.log(`${GREEN}  ✓${RESET} ${msg}`);
}
function fail(msg) {
  console.error(`${RED}  ✗${RESET} ${msg}`);
}
function info(msg) {
  console.log(`${YELLOW}  >${RESET} ${msg}`);
}

/** Find a free TCP port by binding to :0 and reading the assigned port. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

/** Poll /healthz until it responds 200 or timeout. */
async function waitForHealthz(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** HTTP request helper — returns { status, body }. */
async function request(method, url, opts = {}) {
  const res = await fetch(url, {
    method,
    headers: opts.headers ?? {},
    body: opts.body ?? undefined,
  });
  const body = await res.text();
  return { status: res.status, body };
}

/**
 * Raw HTTP/1.1 upgrade request — returns the numeric HTTP status of the
 * server's response (e.g. 101, 401, 403).
 *
 * NOTE: --http1.1 is implicit here because we use a raw TCP socket, so
 * HTTP/2 negotiation cannot occur. This keeps assertions correct even if
 * someone points the script at a TLS host.
 */
function rawUpgrade(port, path, extraHeaders) {
  return new Promise((resolve) => {
    const wsKey = Buffer.from("smoketest12345678901").toString("base64");
    const headerLines = [
      `GET ${path} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      "Connection: Upgrade",
      "Upgrade: websocket",
      `Sec-WebSocket-Key: ${wsKey}`,
      "Sec-WebSocket-Version: 13",
      ...Object.entries(extraHeaders).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ].join("\r\n");

    const socket = netConnect({ host: "127.0.0.1", port }, () => {
      socket.write(headerLines);
    });

    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
      const firstLine = data.split("\r\n")[0] ?? "";
      const m = firstLine.match(/HTTP\/1\.1 (\d+)/);
      if (m) {
        socket.destroy();
        resolve(parseInt(m[1], 10));
      }
    });
    socket.on("error", () => resolve(null));
    setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, 4000);
  });
}

/** WebSocket upgrade that expects 101 + reads first text frame. */
function wsUpgrade101(port, path, origin) {
  const WebSocket = req(join(ROOT, "node_modules", "ws", "index.js"));

  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      headers: { Origin: origin },
    });
    const result = { upgraded: false, firstFrame: null };
    ws.on("open", () => {
      result.upgraded = true;
    });
    ws.on("message", (msg) => {
      result.firstFrame = msg.toString();
      ws.close();
    });
    ws.on("error", () => {});
    ws.on("close", () => resolve(result));
    setTimeout(() => {
      ws.terminate();
      resolve(result);
    }, 5000);
  });
}

// ---------------------------------------------------------------------------
// Build + stage
// ---------------------------------------------------------------------------
info("Building bundle: npm run build:server");
try {
  execSync("npm run build:server", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.error(`${RED}Build failed — aborting.${RESET}`);
  process.exit(1);
}

info("Staging catalog files into dist/packages/card-data/out/");
const catalogDest = join(ROOT, "dist", "packages", "card-data", "out");
mkdirSync(catalogDest, { recursive: true });
for (const file of ["edison-card-catalog.json", "alias-index.json"]) {
  const src = join(ROOT, "packages", "card-data", "out", file);
  if (!existsSync(src)) {
    console.error(`${RED}Missing catalog file: ${src}${RESET}`);
    process.exit(1);
  }
  copyFileSync(src, join(catalogDest, file));
}

// ---------------------------------------------------------------------------
// Boot the bundle
// ---------------------------------------------------------------------------
const port = await getFreePort();
const tmpDir = mkdtempSync(join(tmpdir(), "smoke-"));
const dbPath = join(tmpDir, "smoke.db");
const imagesPath = tmpDir;
const origin = `http://127.0.0.1:${port}`;

info(`Booting dist/server.mjs on port ${port}`);
const child = spawn("node", [join(ROOT, "dist", "server.mjs")], {
  env: {
    ...process.env,
    PORT: String(port),
    DB_PATH: dbPath,
    IMAGES_PATH: imagesPath,
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: origin,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", () => {}); // drain
child.stderr.on("data", () => {}); // drain

function cleanup() {
  try {
    child.kill("SIGTERM");
  } catch {}
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

const alive = await waitForHealthz(port);
if (!alive) {
  cleanup();
  console.error(`${RED}Server did not become healthy within 20 s — aborting.${RESET}`);
  process.exit(1);
}
info(`Server healthy at ${origin}/healthz`);

// ---------------------------------------------------------------------------
// Route assertions
// ---------------------------------------------------------------------------
const routes = JSON.parse(readFileSync(join(ROOT, "scripts", "artifact-routes.json"), "utf-8"));

const failures = [];
info(`Checking ${routes.length} routes from artifact-routes.json …`);

for (const route of routes) {
  const url = `http://127.0.0.1:${port}${route.path}`;
  let body;
  const headers = {};
  if (route.method === "POST" || route.method === "PUT") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({});
  }
  const { status } = await request(route.method, url, { headers, body });
  if (status === route.expectedStatus) {
    ok(`${route.method} ${route.path} → ${status}`);
  } else {
    fail(
      `${route.method} ${route.path} → expected ${route.expectedStatus}, got ${status}` +
        (route.note ? ` (${route.note})` : ""),
    );
    failures.push({ route, actual: status });
  }
}

// ---------------------------------------------------------------------------
// WebSocket assertions
// ---------------------------------------------------------------------------
info("Checking WebSocket upgrade paths …");

// 1. Board WS — valid origin → must upgrade (101) + deliver an error frame for nonexistent duel
const boardResult = await wsUpgrade101(port, "/api/duels/test-duel-id/ws", origin);
if (boardResult.upgraded) {
  ok(`Board WS (valid origin) → 101 Upgrade accepted`);
  if (boardResult.firstFrame) {
    ok(`Board WS first frame: ${boardResult.firstFrame.slice(0, 100)}`);
  } else {
    fail("Board WS upgraded but received no message frame within timeout");
    failures.push({
      route: { method: "WS", path: "/api/duels/:id/ws", expectedStatus: "frame" },
      actual: "no frame",
    });
  }
} else {
  fail(
    "Board WS (valid origin) → did NOT upgrade to 101. " +
      "Is attachUpgradeRouter wired in prod-server.ts?",
  );
  failures.push({
    route: { method: "WS", path: "/api/duels/:id/ws", expectedStatus: 101 },
    actual: "no upgrade",
  });
}

// 2. Room WS — bad origin → must return 403 (CORS rejection at upgrade router level)
const roomBadOriginStatus = await rawUpgrade(port, "/api/duels/test-duel-id/room/ws", {
  Origin: "http://evil.example.com",
});
if (roomBadOriginStatus === 403) {
  ok(`Room WS (bad origin) → 403 Forbidden`);
} else {
  fail(`Room WS (bad origin) → expected 403, got ${roomBadOriginStatus}`);
  failures.push({
    route: { method: "WS", path: "/api/duels/:id/room/ws (bad origin)", expectedStatus: 403 },
    actual: roomBadOriginStatus,
  });
}

// 3. Room WS — valid origin, no session → must return 401
const roomNoSessionStatus = await rawUpgrade(port, "/api/duels/test-duel-id/room/ws", {
  Origin: origin,
});
if (roomNoSessionStatus === 401) {
  ok(`Room WS (valid origin, no session) → 401 Unauthorized`);
} else {
  fail(`Room WS (valid origin, no session) → expected 401, got ${roomNoSessionStatus}`);
  failures.push({
    route: { method: "WS", path: "/api/duels/:id/room/ws (no session)", expectedStatus: 401 },
    actual: roomNoSessionStatus,
  });
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
cleanup();

console.log("");
if (failures.length > 0) {
  console.error(`${RED}SMOKE FAILED — ${failures.length} assertion(s) failed:${RESET}`);
  for (const f of failures) {
    const r = f.route;
    console.error(`  ${r.method} ${r.path}: expected ${r.expectedStatus ?? "?"}, got ${f.actual}`);
  }
  process.exit(1);
} else {
  console.log(
    `${GREEN}All smoke assertions passed (${routes.length} routes + 3 WS checks).${RESET}`,
  );
  process.exit(0);
}
