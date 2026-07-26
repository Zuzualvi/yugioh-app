# Spec 21 — Deploy split rework (Vercel frontend + Fly backend)

**Status:** Active. Prerequisite for go-live via `provision_hosting`.
**Why:** The hosting decision was revised to a Vercel(frontend)+Fly(backend) split on a shared
parent domain (`app.<domain>` + `api.<domain>`), but the code @ e20c54e is still single-host. This
spec makes the app work across the two origins. All changes are **env-driven and domain-agnostic** —
the actual domain is injected at deploy time, not hardcoded.

Same-registrable-domain ⇒ `app.` and `api.` are **same-site** but **cross-origin**. Cross-origin ⇒
browser enforces CORS. Same-site ⇒ a `SameSite=Lax` cookie is sent on `app.`→`api.` fetches.

---

## Stream A — Backend (owner: Backend Engineer) — paths: `packages/server/**`

### A1. New file `packages/server/src/middleware/cors.ts` (one operation per file)
Hand-rolled credentialed-CORS allowlist middleware (NO new npm dependency).

```ts
import type { RequestHandler } from "express";

/** Reads CORS_ALLOWED_ORIGINS (comma-separated exact origins) from the environment. */
export function allowedOriginsFromEnv(): string[] {
  return (process.env["CORS_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Echoes an exact allowed origin with credentials; answers preflight. Never uses "*". */
export function corsMiddleware(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
```

Behavior contract (LOCKED — QA tests these):
- Request with `Origin` in the allowlist → response has `Access-Control-Allow-Origin: <that exact origin>`,
  `Access-Control-Allow-Credentials: true`, `Vary: Origin`.
- Request with `Origin` NOT in the allowlist → NONE of the `Access-Control-Allow-*` headers set.
- `OPTIONS` preflight → `204` (with the CORS headers when origin allowed).
- No `Origin` header (same-origin / curl) → passes through untouched (no CORS headers), `next()`.
- The middleware NEVER sets `Access-Control-Allow-Origin: *`.

### A2. Wire CORS as the FIRST middleware in `packages/server/src/app.ts`
In `createApp`, before `express.json()`:
```ts
import { corsMiddleware, allowedOriginsFromEnv } from "./middleware/cors.js";
...
app.use(corsMiddleware(allowedOriginsFromEnv()));
```
(When `CORS_ALLOWED_ORIGINS` is unset, `allowedOriginsFromEnv()` → `[]` → middleware is a no-op for
requests without a matching origin. Dev/tests unaffected.)

### A3. Cookie `SameSite=Lax` in `packages/server/src/routes/auth.ts`
In `setCookie`, change `sameSite: "strict"` → `sameSite: "lax"`. Keep `httpOnly:true`, `secure:isProd`,
`path:"/"`, and the 30-day expiry. (Lax is correct for a same-site subdomain split; Strict would drop
the cookie on cross-site top-level navigation into `app.`.)

### A4. Tests (same commit)
- New `packages/server/src/middleware/cors.test.ts` (or integration) covering the A1 behavior contract:
  allowed origin echoes headers; disallowed origin gets none; OPTIONS → 204; no-Origin passes through;
  never `*`.
- Update any existing auth/integration test asserting `SameSite=Strict` → `Lax`.
- Package gate: `tsc --noEmit` + eslint + prettier + vitest on `packages/server` all green.

---

## Stream B — Frontend (owner: Frontend Engineer) — paths: `packages/web/src/**` ONLY
(Do NOT touch `packages/web/package.json` or add `vercel.json` — those belong to Infra.)

### B1. API base URL in `packages/web/src/api/client.ts`
Prepend an env-driven base to every request path. Dev leaves it empty (so the Vite mock plugin keeps
serving relative `/api`); prod (Vercel) sets it to the Fly origin.
```ts
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
...
const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include", ... });
```
Keep `credentials: "include"` (already present). No other behavior change.

### B2. Image base URL in `packages/web/src/utils/cardImageUrl.ts`
Prod must use `VITE_IMAGE_BASE_URL` (points at `https://api.<domain>/images`); the ygoprodeck CDN
string must NOT appear in the prod bundle (REQ-DATA-02). Structure so PROD strips the dev branch:
```ts
export function cardImageUrl(imageId: number): string {
  if (import.meta.env.PROD) {
    const base = import.meta.env.VITE_IMAGE_BASE_URL as string; // required at build time on Vercel
    return `${base}/${imageId}.jpg`;
  }
  const base =
    (import.meta.env.VITE_IMAGE_BASE_URL as string | undefined) ??
    "https://images.ygoprodeck.com/images/cards_small";
  return `${base}/${imageId}.jpg`;
}
```

### B3. Tests (same commit)
- Update `packages/web/src/utils/cardImageUrl.test.ts` for the new behavior (dev fallback + honoring
  VITE_IMAGE_BASE_URL). If PROD-branch behavior can't be unit-tested easily, cover the dev branch and
  leave the prod path to QA's real build check.
- Add/adjust a client test that `VITE_API_BASE_URL` is prepended when set (mock `import.meta.env`).
- Package gate: `tsc --noEmit` + eslint + prettier + vitest on `packages/web` all green.

---

## Stream C — Infra (owner: Infra Engineer) — paths: `prod-server.ts`, `Dockerfile`, `.dockerignore`, `fly.toml`, root `package.json` build scripts, `packages/web/vercel.json` (NEW), `docs/working/2026-07-13-DEPLOY.md`

### C1. `prod-server.ts` → API + images + health ONLY (drop SPA/static)
- Remove `express.static(STATIC_DIR)` and the SPA fallback `app.get(/.*/, ...)`. Vercel serves the SPA.
- Keep: `/healthz`, `/images` static from volume, all `/api/*` routers, `/api` JSON-404.
- Add CORS as FIRST middleware (reuse Stream A):
  `import { corsMiddleware, allowedOriginsFromEnv } from "./packages/server/src/middleware/cors.js";`
  then `app.use(corsMiddleware(allowedOriginsFromEnv()));` before `express.json()`.
- Add a root `GET /` returning `res.json({ service: "yugioh-edison-api" })` (nice-to-have; not the app).

### C2. `Dockerfile` — drop the web build
- Remove the web build stage and the `public/` copy (backend no longer serves the SPA). Keep the
  server esbuild bundle, native modules (better-sqlite3, @node-rs/argon2), catalog + alias-index copy,
  and the sandbox BuildKit CA secret mount. Result: smaller/faster image.
- `build:all` in root `package.json`: `build:server` only is required for the image; keep `build:web`
  available (Vercel uses it) but the Docker image build must not depend on the web dist.

### C3. `fly.toml`
- Add to `[env]`: `CORS_ALLOWED_ORIGINS = "https://app.<DOMAIN>"` — leave `<DOMAIN>` as a clearly-marked
  placeholder; the CTO finalizes it once the CEO picks the domain. (Non-secret → fine in fly.toml.)
- Leave `app` name as-is for now; CTO reconciles it to the provision_hosting-created app post-provision.
- Everything else (volume, always-on, force_https, healthz) unchanged.

### C4. `packages/web/vercel.json` (NEW) — monorepo build
`packages/web` imports the workspace sibling `@yugioh-app/contracts` (consumed from source by Vite),
so Vercel must install at the REPO ROOT to get the workspace symlink. With Vercel Root Directory =
`packages/web`:
```json
{
  "installCommand": "cd ../.. && npm install",
  "buildCommand": "cd ../.. && npm run build:web",
  "outputDirectory": "dist"
}
```
Document that `VITE_API_BASE_URL` and `VITE_IMAGE_BASE_URL` must be set as Vercel project env vars
(values filled from the provisioned domain).

### C5. `docs/working/2026-07-13-DEPLOY.md` — rewrite for provision_hosting
Replace the manual `fly launch`/checklist with the new flow: provision_hosting provisions Fly+Vercel+
secrets; CTO commits `.github/workflows/deploy.yml`; admin bootstrap via GitHub repo secrets forwarded
by the deploy workflow; image seed as a post-deploy step. Keep the local docker verify recipe.

### C6. Verify
Local docker build + run of the API-only backend: `/healthz` → `{status:ok,cards:3681}`, a
preflight `OPTIONS /api/cards` from an allowed origin returns the CORS headers, and login sets a
`SameSite=Lax` cookie. Report exact output.

---

## Acceptance (CTO + QA gate before provisioning)
1. Clean-clone `npm ci && npm run verify` GREEN (typecheck + lint + arch:check 0 violations + all tests).
2. `npm run build:web` produces `packages/web/dist` with a working `VITE_API_BASE_URL`/`VITE_IMAGE_BASE_URL`
   substituted, and the bundle is **grep-clean of `ygoprodeck`** (REQ-DATA-02).
3. Cross-origin smoke: web build served from origin X calling backend at origin Y (both in
   CORS_ALLOWED_ORIGINS) → login succeeds, cookie attaches, `/api/cards` returns 3,681, deck save works.
4. Backend docker image builds without any web/dist dependency; `/healthz` green.
