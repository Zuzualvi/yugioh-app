#!/usr/bin/env node
/**
 * smoke-artifact.mjs — Boots the esbuild bundle (dist/server.mjs) and asserts
 * the full route table plus both WebSocket upgrade paths.
 *
 * Local mode  (default):
 *   node scripts/smoke-artifact.mjs
 *   Builds the bundle, stages catalog files, boots it locally, probes localhost.
 *
 * Remote mode:
 *   SMOKE_TARGET=https://api.zuhayr.io node scripts/smoke-artifact.mjs
 *   Skips build/boot entirely and probes the given host.
 *   SMOKE_ORIGIN=https://app.zuhayr.io  — override the "valid" CORS origin used
 *     for the room-WS no-session assertion. Defaults to replacing the first
 *     hostname segment: api.zuhayr.io → app.zuhayr.io.
 *
 * Exit 0 = all route/WS assertions passed (even if TLS-layer checks report
 *          CANNOT VERIFY due to egress interception — see below).
 * Exit 1 = build failed, boot timed out, or one or more route/WS assertions failed.
 *
 * Output is deterministic and diffable: per-assertion lines carry no timestamps,
 * durations, or run IDs so two clean runs produce identical output.
 *
 * ⚠ TLS-LAYER ASSERTIONS AND EGRESS INTERCEPTION:
 * Agent containers (e.g. Anthropic sandboxes) route outbound TLS through an
 * intercepting proxy that presents its own certificate for every host. ALPN
 * negotiation and HTTP/2 SETTINGS frames observed from inside such a container
 * belong to the proxy, not to the target server. The two ALPN/h2 checks below
 * detect this condition and report CANNOT VERIFY rather than a false pass or
 * false fail. HTTP status codes and WebSocket upgrade responses are forwarded
 * faithfully by the proxy and are trustworthy. See ADR 0005.
 */

import { execSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { createServer, connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import http2 from "node:http2";
import { randomBytes } from "node:crypto";
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
async function waitForHealthz(baseUrl, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
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
 * Raw WebSocket upgrade request over plain TCP or TLS — returns the HTTP status.
 *
 * TLS path uses ALPNProtocols: ['http/1.1'] to prevent HTTP/2 negotiation.
 * HTTP/2 ignores the Upgrade header, which would cause false results.
 * Plain TCP is used for localhost (never HTTP/2).
 *
 * Sec-WebSocket-Key is exactly 16 random bytes, base64-encoded, as the RFC requires.
 */
function rawUpgrade(host, port, path, extraHeaders, useTls) {
  return new Promise((resolve) => {
    const wsKey = randomBytes(16).toString("base64");
    const headerLines = [
      `GET ${path} HTTP/1.1`,
      `Host: ${host}${port === 443 || port === 80 ? "" : `:${port}`}`,
      "Connection: Upgrade",
      "Upgrade: websocket",
      `Sec-WebSocket-Key: ${wsKey}`,
      "Sec-WebSocket-Version: 13",
      ...Object.entries(extraHeaders).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ].join("\r\n");

    const connectOpts = useTls
      ? { host, port, servername: host, ALPNProtocols: ["http/1.1"] }
      : { host, port };

    const socket = useTls
      ? tlsConnect(connectOpts, () => socket.write(headerLines))
      : netConnect(connectOpts, () => socket.write(headerLines));

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
    }, 8000);
  });
}

/** WebSocket upgrade that expects 101 + reads first text frame. */
function wsUpgrade101(wsUrl, origin) {
  const WebSocket = req(join(ROOT, "node_modules", "ws", "index.js"));

  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, { headers: { Origin: origin } });
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
    }, 8000);
  });
}

// ---------------------------------------------------------------------------
// Mode: local (default) vs remote (SMOKE_TARGET set)
// ---------------------------------------------------------------------------
const smokeTarget = process.env["SMOKE_TARGET"];
const isRemote = Boolean(smokeTarget);

let baseUrl;
let wsScheme;
let wsHost;
let wsPort;
let useTls;
let validOrigin;
let child = null;
let tmpDir = null;

function cleanup() {
  if (child) {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  if (tmpDir) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

if (isRemote) {
  // ---- Remote mode ----
  const targetUrl = new URL(smokeTarget);
  baseUrl = smokeTarget.replace(/\/$/, "");
  useTls = targetUrl.protocol === "https:";
  wsScheme = useTls ? "wss" : "ws";
  wsHost = targetUrl.hostname;
  wsPort = targetUrl.port ? parseInt(targetUrl.port, 10) : useTls ? 443 : 80;

  // Derive valid CORS origin: default replaces first hostname segment (api.→app.)
  const defaultOrigin = useTls
    ? `https://${wsHost.replace(/^[^.]+\./, "app.")}`
    : `http://${wsHost.replace(/^[^.]+\./, "app.")}`;
  validOrigin = process.env["SMOKE_ORIGIN"] ?? defaultOrigin;

  info(`Remote mode: target=${baseUrl}`);
  info(`Valid CORS origin for WS assertions: ${validOrigin}`);
} else {
  // ---- Local mode: build, stage, boot ----
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

  const port = await getFreePort();
  tmpDir = mkdtempSync(join(tmpdir(), "smoke-"));
  const dbPath = join(tmpDir, "smoke.db");
  const imagesPath = tmpDir;
  validOrigin = `http://127.0.0.1:${port}`;
  baseUrl = validOrigin;
  wsScheme = "ws";
  wsHost = "127.0.0.1";
  wsPort = port;
  useTls = false;

  info(`Booting dist/server.mjs on port ${port}`);
  child = spawn("node", [join(ROOT, "dist", "server.mjs")], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      IMAGES_PATH: imagesPath,
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: validOrigin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {}); // drain
  child.stderr.on("data", () => {}); // drain

  const alive = await waitForHealthz(baseUrl);
  if (!alive) {
    cleanup();
    console.error(`${RED}Server did not become healthy within 20 s — aborting.${RESET}`);
    process.exit(1);
  }
  info(`Server healthy at ${baseUrl}/healthz`);
}

// ---------------------------------------------------------------------------
// Route assertions
// ---------------------------------------------------------------------------
const routes = JSON.parse(readFileSync(join(ROOT, "scripts", "artifact-routes.json"), "utf-8"));

const failures = [];
info(`Checking ${routes.length} routes from artifact-routes.json …`);

for (const route of routes) {
  const url = `${baseUrl}${route.path}`;
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
const boardWsUrl = `${wsScheme}://${wsHost}${wsPort === 443 || wsPort === 80 ? "" : `:${wsPort}`}/api/duels/test-duel-id/ws`;
const boardResult = await wsUpgrade101(boardWsUrl, validOrigin);
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
//    Raw TCP/TLS socket forces HTTP/1.1 — no ALPN negotiation to HTTP/2.
const roomBadOriginStatus = await rawUpgrade(
  wsHost,
  wsPort,
  "/api/duels/test-duel-id/room/ws",
  { Origin: "http://evil.example.com" },
  useTls,
);
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
const roomNoSessionStatus = await rawUpgrade(
  wsHost,
  wsPort,
  "/api/duels/test-duel-id/room/ws",
  { Origin: validOrigin },
  useTls,
);
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
// Remote-only: ALPN + HTTP/2 extended CONNECT guards
//
// These assertions are skipped entirely in local mode: a locally-booted bundle
// does not go through Fly's TLS edge, so ALPN and extended CONNECT are not
// meaningful properties of it. They are properties of the deployed edge only.
//
// WHY THIS MATTERS: Chrome 121+ (Jan 2024) uses RFC 8441 extended CONNECT for
// wss:// when the server advertises SETTINGS_ENABLE_CONNECT_PROTOCOL. Fly's
// proxy advertises it under HTTP/2 but returns 502 when used. The fix is
// fly.toml [http_service.tls_options] alpn = ["http/1.1"], which prevents h2
// negotiation. If someone removes those two lines, duels break in browsers and
// nothing catches it until a player reports it. This gate does.
// See docs/adr/0004-fly-edge-serves-http1-only.md.
//
// INTERCEPTION DETECTION: egress TLS proxies (present in agent containers)
// terminate TLS before it reaches the target server, so ALPN negotiation and
// HTTP/2 SETTINGS frames reflect the proxy's config, not the target's. We
// detect this by comparing the TLS peer certificate issuer for the target and
// for example.com. A legitimate CA issues certs for one domain at a time; a
// transparent proxy signs both with the same issuer. When detected, these two
// checks report CANNOT VERIFY instead of a false pass or false fail.
// See docs/adr/0005-alpn-guard-cannot-run-behind-intercepting-egress.md.
// ---------------------------------------------------------------------------

/** Get a canonical "O|CN" string from the TLS peer certificate issuer for host:443.
 *  Comparing both fields narrows the false-positive window: public CA intermediate
 *  CNs are well-known strings ("R11", "DigiCert TLS RSA SHA256 2020 CA1", …) that
 *  will not accidentally collide with each other, while a gateway's CN is distinctly
 *  non-public ("Egress Gateway SDS Issuing CA (production)").
 */
function getTlsIssuer(host) {
  return new Promise((resolve) => {
    const s = tlsConnect({ host, port: 443, servername: host }, () => {
      const cert = s.getPeerCertificate(true);
      s.destroy();
      const issuer = cert?.issuer ?? {};
      const o = issuer.O ?? "";
      const cn = issuer.CN ?? "";
      resolve(o || cn ? `${o}|${cn}` : null);
    });
    s.on("error", () => resolve(null));
    setTimeout(() => {
      s.destroy();
      resolve(null);
    }, 8000);
  });
}

const cannotVerify = []; // TLS-layer checks that could not run

if (isRemote && useTls) {
  // ---- Interception detection ----
  info("Detecting egress TLS interception …");
  const [targetIssuer, exampleIssuer] = await Promise.all([
    getTlsIssuer(wsHost),
    getTlsIssuer("example.com"),
  ]);
  const intercepted =
    targetIssuer !== null && exampleIssuer !== null && targetIssuer === exampleIssuer;

  if (intercepted) {
    const ORANGE = "\x1b[33m";
    console.warn(
      `${ORANGE}  ⚠ CANNOT VERIFY${RESET} Edge TLS ALPN — egress TLS is intercepted by "${targetIssuer}". ` +
        `ALPN negotiation and HTTP/2 SETTINGS observed here belong to the intercepting proxy, ` +
        `not to ${wsHost}. These checks must be run from an un-intercepted network. ` +
        `See docs/adr/0005-alpn-guard-cannot-run-behind-intercepting-egress.md.`,
    );
    console.warn(
      `${ORANGE}  ⚠ CANNOT VERIFY${RESET} HTTP/2 SETTINGS_ENABLE_CONNECT_PROTOCOL — same reason.`,
    );
    cannotVerify.push("TLS ALPN negotiation", "HTTP/2 SETTINGS_ENABLE_CONNECT_PROTOCOL");
  } else {
    info(`No TLS interception detected (target issuer: ${targetIssuer ?? "unknown"})`);

    // 1. ALPN must negotiate http/1.1, NOT h2.
    info("Checking edge TLS ALPN …");
    const alpnResult = await new Promise((resolve) => {
      const s = tlsConnect(
        { host: wsHost, port: wsPort, servername: wsHost, ALPNProtocols: ["h2", "http/1.1"] },
        () => {
          const proto = s.alpnProtocol;
          s.destroy();
          resolve(proto);
        },
      );
      s.on("error", () => resolve(null));
      setTimeout(() => {
        s.destroy();
        resolve(null);
      }, 8000);
    });

    if (alpnResult === "http/1.1") {
      ok(`Edge ALPN → http/1.1 (h2 not negotiated)`);
    } else {
      fail(
        `Edge ALPN → ${alpnResult ?? "null"} — expected http/1.1. ` +
          `The edge is offering HTTP/2. Chrome 121+ will use RFC 8441 extended CONNECT for wss:// ` +
          `and Fly returns 502, so duels will not load in any browser. ` +
          `Fix: set [http_service.tls_options] alpn = ["http/1.1"] in fly.toml and redeploy. ` +
          `See docs/adr/0004-fly-edge-serves-http1-only.md.`,
      );
      failures.push({
        route: { method: "TLS", path: "ALPN negotiation", expectedStatus: "http/1.1" },
        actual: alpnResult ?? "null",
      });
    }

    // 2. HTTP/2 extended CONNECT must NOT succeed. Connect with h2 (no ALPN
    //    restriction so h2 is available if the edge offers it), then check
    //    remoteSettings.enableConnectProtocol. If h2 was not negotiated (because
    //    the ALPN fix is in place), the session will not establish at all.
    info("Checking HTTP/2 SETTINGS_ENABLE_CONNECT_PROTOCOL …");
    const h2Check = await new Promise((resolve) => {
      let settled = false;
      const client = http2.connect(`https://${wsHost}`, { rejectUnauthorized: true });

      client.on("remoteSettings", (settings) => {
        if (settled) return;
        settled = true;
        const enabled = Boolean(settings.enableConnectProtocol);
        client.destroy();
        resolve({ connected: true, enableConnectProtocol: enabled });
      });

      client.on("error", () => {
        if (settled) return;
        settled = true;
        resolve({ connected: false, enableConnectProtocol: false });
      });

      setTimeout(() => {
        if (settled) return;
        settled = true;
        client.destroy();
        resolve({ connected: false, enableConnectProtocol: false });
      }, 8000);
    });

    if (!h2Check.connected) {
      ok(`HTTP/2 not negotiated → extended CONNECT unavailable (expected)`);
    } else if (!h2Check.enableConnectProtocol) {
      ok(
        `HTTP/2 connected but SETTINGS_ENABLE_CONNECT_PROTOCOL is false → extended CONNECT unavailable`,
      );
    } else {
      fail(
        `HTTP/2 connected and SETTINGS_ENABLE_CONNECT_PROTOCOL is true. ` +
          `Chrome 121+ will attempt extended CONNECT for wss:// and Fly will return 502, ` +
          `breaking duels in every browser that has an open h2 session to this host. ` +
          `Fix: [http_service.tls_options] alpn = ["http/1.1"] in fly.toml. ` +
          `See docs/adr/0004-fly-edge-serves-http1-only.md.`,
      );
      failures.push({
        route: {
          method: "H2",
          path: "SETTINGS_ENABLE_CONNECT_PROTOCOL",
          expectedStatus: "false",
        },
        actual: "true",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
cleanup();

const wsCheckCount = 3;
const tlsCheckCount = isRemote && useTls ? 2 : 0;
const totalPassed = routes.length + wsCheckCount - failures.length;

console.log("");
if (failures.length > 0) {
  console.error(
    `${RED}SMOKE FAILED — ${failures.length} assertion(s) failed, ` +
      `${totalPassed} passed` +
      (cannotVerify.length ? `, ${cannotVerify.length} cannot-verify (TLS intercepted)` : "") +
      `.${RESET}`,
  );
  for (const f of failures) {
    const r = f.route;
    console.error(`  ${r.method} ${r.path}: expected ${r.expectedStatus ?? "?"}, got ${f.actual}`);
  }
  process.exit(1);
} else if (cannotVerify.length > 0) {
  console.log(
    `${GREEN}Routes and WS assertions passed (${routes.length} routes + ${wsCheckCount} WS checks).${RESET}`,
  );
  console.warn(
    `\x1b[33m${cannotVerify.length} TLS-layer assertion(s) could not run (egress TLS intercepted): ` +
      cannotVerify.join(", ") +
      `.\x1b[0m`,
  );
  console.warn(
    `\x1b[33mRun from an un-intercepted network to verify ALPN and extended CONNECT. ` +
      `See docs/adr/0005-alpn-guard-cannot-run-behind-intercepting-egress.md.\x1b[0m`,
  );
  process.exit(0);
} else {
  const tlsLine = tlsCheckCount > 0 ? ` + ${tlsCheckCount} TLS checks` : "";
  console.log(
    `${GREEN}All smoke assertions passed (${routes.length} routes + ${wsCheckCount} WS checks${tlsLine}).${RESET}`,
  );
  process.exit(0);
}
