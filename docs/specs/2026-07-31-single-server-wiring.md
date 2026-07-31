---
linear_project: Duel Invite Improvements
---

# Collapse the three server wirings onto `createApp()`

## The problem

Three files independently wire the Express app, and they drift:

| File | What it is | Who exercises it |
| --- | --- | --- |
| `packages/server/src/app.ts` (`createApp`) | the factory | every unit test, the acceptance suite |
| `prod-server.ts` (repo root) | **what ships** — esbuild bundles it into `dist/server.mjs` | nothing, until 2026-07-31 |
| `e2e/harness/server.ts` | the Playwright stack | the E2E suite |

All three carried the same class of defect within one day. The harness was missing
`attachUpgradeRouter` and silently dropped every WebSocket upgrade. `prod-server.ts` was missing
both the room router and the upgrade dispatcher, which took the pre-duel room *and* the live duel
board down in production. Only `app.ts` was correct, and it is the one nothing deploys.

1181 unit tests, a 53/53 acceptance suite, 6/6 Playwright runs and an independent QA pass on a
clean clone were all green throughout. Every gate passed. None executed the file that ships.

Two gates have since closed the mechanical hole — `npm run typecheck` now covers `prod-server.ts`
(PR #18) and CI boots the real bundle and asserts its route table before the backend may deploy
(PR #19). Those make the drift *detectable*. This spec makes it *impossible*: one wiring, three
entry points that only supply environment.

## Approach

`prod-server.ts` and `e2e/harness/server.ts` both call `createApp()`. Each entry point keeps only
what is genuinely environmental: which port, which database file, where the catalog and images
live, and which WebSocket servers to attach.

Everything that decides *what the app is* — middleware order, route mounts, the 404 shape — lives
in `createApp()` and nowhere else.

**Rejected: extract a shared `wireApp()` helper and have all three call it.** That is the same
number of wiring sites with an extra indirection, and nothing stops the next entry point from
skipping it. It also leaves `app.ts` and the helper as two places a route can be registered.
`createApp()` already exists, is already the thing every test exercises, and is already correct.
Use it.

**Rejected: leave `prod-server.ts` alone now that CI boots it.** The smoke job catches a *missing*
mount, but only for routes whose unauthenticated response differs when absent — and 9 of the room
router's 10 routes are indistinguishable that way, because they fall through to the duel router
behind `requireSession` and answer 401 either side. Detection through a single canary route is not
the same as not being able to get it wrong.

## The contract

This is the part that must not drift. An implementer has no discretion here.

### `createApp` signature

```ts
export function createApp(
  db: InstanceType<typeof Database>,
  catalog: LoadedCatalog,
  duelManager?: DuelManager,
  opts?: { webDistPath?: string; imagesPath?: string },
): express.Application;
```

`imagesPath` is new. When present, card images are served from it; when absent, `/images` is not
mounted. No other signature change.

### Mount order — exact, and load-bearing

Order is behaviour here, not style. CORS must precede body parsing so preflight `OPTIONS` is
answered immediately; the room router must precede the duel router because both mount at
`/api/duels` and unmatched paths fall through.

1. `corsMiddleware(allowedOriginsFromEnv())`
2. `express.json()`
3. `express.text({ type: "text/plain", limit: "1mb" })`
4. `cookieParser()`
5. `GET /` → `{ service: "yugioh-edison-api" }`
6. `GET /healthz` → `{ status: "ok", cards: <catalog card count> }`
7. `/images` → `express.static(opts.imagesPath)` — **only if `imagesPath` is set**
8. `/api/auth` → `createAuthRouter(db)`
9. `/api/me` → `requireSession(db)`, `createMeRouter(db)`
10. `/api/cards` → `requireSession(db)`, `createCardsRouter(catalog)`
11. `/api/decks` → `requireSession(db)`, `createDecksRouter(db, catalog)`
12. `/api/admin` → `requireSession(db)`, `requireAdmin`, `createAdminRouter(db)`
13. `/api/duels` → `createRoomRouter(db, duelManager, catalog)` — **per-route** session guards,
    because `GET /api/duels/join/:joinToken` must answer unauthenticated
14. `/api/duels` → `requireSession(db)`, `createDuelRouter(db, catalog, duelManager)` — only if
    `duelManager` is supplied
15. `/api` → JSON 404 `{ error: { code: "not_found", message: "Route not found." } }`
16. if `webDistPath`: `express.static(webDistPath)`, then the SPA fallback for non-`/api`,
    non-`/ws` GETs
17. terminal JSON 404, same body as step 15

### `GET /healthz` is load-bearing

`fly.toml` health-checks `GET /healthz` every 30s. If it stops answering 200, the machine fails
its checks and cycles. `e2e/playwright/prod-smoke.spec.ts` additionally asserts
`status === "ok"` and `cards > 0`. The response body shape is pinned, not incidental.

### The one intentional behaviour change

Today a request to a non-`/api` path that matches nothing gets Express's default **HTML** 404
(`prod-server.ts` only mounts a JSON 404 under `/api`). After this change it gets the same JSON
404 as everything else — step 17. This is deliberate: one 404 shape across the surface, and it
removes the inconsistency QA recorded against `/images/<missing>` in the production baseline.

Nothing else changes. Any other observable difference is a defect in the implementation, not a
consequence of the design.

### Explicitly out of scope

`recoverStartingDuels` (E47 crash recovery) runs in `packages/server/src/index.ts` and the E2E
harness but **not** in `prod-server.ts`, so a crash mid-duel-start does not auto-recover in
production. This is pre-existing, not introduced here. Adding it changes production boot
behaviour, which is a different change with a different risk profile — it does not ride along with
a refactor whose entire claim is that behaviour is unchanged. Left as-is, deliberately.

## Slice boundaries

One slice, one engineer. The three wirings are a single tightly-coupled change: `createApp` grows
`imagesPath` and two routes, and both callers must move in the same commit or the intermediate
state is broken.

**Files owned:** `packages/server/src/app.ts`, `prod-server.ts`, `e2e/harness/server.ts`,
`packages/server/src/app.test.ts` (or the equivalent new test file), and
`scripts/artifact-routes.json` *only* if the 404-shape change requires a manifest update.

**Not owned, do not touch:** `packages/server/src/index.ts`, anything else under `packages/`,
`Dockerfile`, `fly.toml`, `deploy/`, `.github/workflows/`.

## Done means

1. `prod-server.ts` contains no `app.use` or `app.get` route registration of its own. Its only
   responsibilities are environment resolution, catalog loading, `bootstrapAdmin`, calling
   `createApp`, attaching the two WebSocket servers, and listening.
2. `e2e/harness/server.ts` likewise — it already calls `createApp`; it must not regain local
   routes.
3. `grep -c "app.use(\"/api" prod-server.ts` returns 0.
4. `npm run verify` green from a clean clone: whole-repo typecheck, lint, arch, actionlint,
   docs:check, and the full test suite.
5. `npm run smoke:artifact` green — the bundle boots and answers every route in
   `scripts/artifact-routes.json`, plus both WebSocket upgrade paths.
6. The smoke gate still *fails* when the room router mount is removed from `createApp`, and when
   `attachUpgradeRouter` is removed from `prod-server.ts`. Re-prove both after the refactor: the
   gate protecting this change must be shown to still work *on the changed code*, not just on the
   code it was written against.
7. A test asserts `GET /healthz` returns 200 with `{ status: "ok", cards: > 0 }` and `GET /`
   returns the service identity — through `createApp`, so no future edit can silently drop the
   route Fly depends on.
8. A test asserts `imagesPath` mounts `/images` and that omitting it does not.
9. The E2E Playwright suite passes against the harness.
10. Production A/B: the unauthenticated probe matrix in
    `docs/reference/2026-07-31-production-baseline.md` is re-run against `api.zuhayr.io` after
    deploy and every response matches the pre-merge capture, except the non-`/api` 404 body
    documented above.
