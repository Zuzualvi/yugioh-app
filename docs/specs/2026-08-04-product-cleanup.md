---
linear_project: Product Cleanup
---

# Product Cleanup — gates that gate, one build, and a readable production

## The problem

Run 1 shipped a working feature and exposed a pattern: several of this repo's
verification gates do not gate. `docs:check` has been printing `✓` while
skipping every rule it owns, because it cannot see its input in a depth-1
checkout and swallows the error. The artifact smoke claims to build "the same
esbuild invocation the Dockerfile uses" and does not. `AGENTS.md`'s
proof-of-delivery check can pass against a local mirror, which nearly lost a
slice of work. Alongside that: build/tooling hygiene, and production is
write-only to this team — it deploys on every merge and cannot read or correct
what it deployed into.

This spec covers all of it in one pass. Source: the Product Cleanup PRD.

## The approach

Four slices, partitioned by file ownership so the merges cannot collide. Slice A
lands first: **§1.1 must be merged before any other slice's PR is merged**,
because two of the checks added in this project are diff-scoped and would
otherwise land in the dead half of a gate that silently passes.

The rejected alternative for §4.2 is the one ZUH-42 asked for: a `FLY_API_TOKEN`
in the agent container for `fly ssh console`. Rejected on three counts — it
grants write where the need is read, it grants a shell, and it puts a credential
inside a sandbox. See `docs/adr/0006-bounded-ops-api.md`.

---

## Slice A — the gates, and build/tooling hygiene

**Owner:** Infra Engineer. **Branch:** `fix/gates-that-gate`.

**Files owned (exclusively):** `.github/workflows/ci.yml`,
`.github/workflows/e2e.yml`, `.github/workflows/deploy.yml`,
`scripts/check-docs-placement.mjs`, `scripts/check-build-single-source.mjs`
(new), `scripts/smoke-artifact.mjs`, `Dockerfile`, `package.json` (root),
`tsconfig.json` (root), `packages/web/vercel.json`.

**Explicitly NOT owned:** `scripts/artifact-routes.json` (Slice B owns it),
`prod-server.ts` (Slice B), anything under `packages/` other than
`packages/web/vercel.json`.

> ⚠️ `.github/workflows/*.yml` cannot be changed by a git push — the git token
> lacks GitHub's Workflows permission. Put the **complete final YAML** for each
> workflow file you change in your report to the CTO, who lands it on your branch
> with `write_repo_file`. Commit and push everything else normally.

### A1 · `docs:check` must fail loudly when it cannot see its input (§1.1)

`scripts/check-docs-placement.mjs:68-79` computes
`git diff --diff-filter=A ${base}...HEAD` with `base = origin/master` inside a
`try/catch` that skips silently. Every `actions/checkout@v5` runs at the default
`fetch-depth: 1`, so `origin/master` does not exist, the diff throws, `added`
stays `[]`, every new-file rule is skipped, and the script exits 0 printing
`✓ docs/ placement OK`. Verified in a *passing* run.

Required:

1. Set `fetch-depth: 0` on the checkout of **every job that runs
   `npm run verify`** — the `ci` job in `ci.yml` and the `verify` job in
   `deploy.yml`. Leave the other jobs at the default; they do not run this check
   and do not need the history.
2. Replace the silent `catch` with a hard failure. The script must exit non-zero
   with a message that names (a) the base it tried to resolve, (b) the
   underlying git error, and (c) `fetch-depth: 0` as the likely fix. Wording is
   yours; the behaviour is not.
3. Keep the `DOCS_CHECK_BASE` env override.

Acceptance: with `DOCS_CHECK_BASE=refs/heads/does-not-exist npm run docs:check`
the command exits non-zero and prints the diagnostic. A shallow clone that
cannot resolve its base fails rather than printing `✓`.

### A2 · Three mechanical checks (§1.2)

These are diff/history-scoped, so they depend on A1. They catch the three
instances seen, deliberately not the class.

**A2a — ADR back-reference.** In `check-docs-placement.mjs`: if `docs/adr/NNNN-*.md`
declares that it amends, supersedes or corrects another ADR, the amended ADR's
file must reference the amending one. Read `docs/adr/0004` and `docs/adr/0005`
first and derive the declaration syntax from what those files actually use —
do not invent a new header. Enforce whole-tree (the corpus satisfies it today,
because ADR 0004 was pointed at its correction in commit `70a0999`).

**A2b — handoff SHAs must be on `master`.** In `check-docs-placement.mjs`: for
each file in `docs/working/`, extract tokens matching `\b[0-9a-f]{7,40}\b`. For
each token, `git cat-file -e <token>^{commit}`:
* resolves and is an ancestor of the base → pass;
* resolves and is **not** an ancestor → fail ("names a commit that is not on
  master — the work it describes may never have landed");
* does not resolve → fail, same message.
This is the check that would have caught an engineer reporting a pushed SHA for
984 tests that existed only inside its container. Requires the full history, so
it must be skipped-with-a-loud-error, never skipped silently, when the base is
unresolvable — same rule as A1. Note in a comment that a prose hex string of
7+ chars is a known false-positive class; the fix is to not write one.

**A2c — one build invocation, and drift fails.** See A3. New script
`scripts/check-build-single-source.mjs`, added to the `verify` chain in root
`package.json`. It asserts:
* `Dockerfile` invokes `npm run build:server`;
* `Dockerfile` contains no `esbuild` invocation outside a comment;
* `scripts/smoke-artifact.mjs` invokes `npm run build:server`.

Acceptance: reverting A3's Dockerfile change makes `npm run verify` fail.

### A3 · One source of truth for the server build (§1.3)

`scripts/smoke-artifact.mjs:227` runs `npm run build:server`. `Dockerfile:42-51`
runs its own inline `RUN node_modules/.bin/esbuild prod-server.ts …` — a second
hand-maintained copy of the flags. They agree today; nothing checks they keep
agreeing. PR #19's claim that the smoke uses the same invocation as the
Dockerfile is false as merged, and this is the same shape as the outage the gate
was built to prevent.

Fix: `package.json`'s `build:server` script is the single definition. Replace the
Dockerfile's inline esbuild `RUN` with `RUN npm run build:server`. The builder
stage already has `package.json` (line 14) and `node_modules` (line 29), so this
works as-is. Preserve the "Bundle size:" echo. Keep the surrounding comment but
update it to say the flags live in `package.json` and are guarded by
`check-build-single-source`.

Do **not** touch the runtime stage, `deploy/native-package.json`, or the image
layout. The fourth-dependency-manifest problem the PRD notes is real and is out
of scope here.

Acceptance: `npm run smoke:artifact` passes, `check-build-single-source` passes,
and `esbuild` appears in exactly one executable place in the repo.

### A4 · `concurrency` on `ci.yml` and `e2e.yml` (§1.4)

Neither has one, so superseded PR runs never cancel and every push pays for a
full run of obsolete work — including the 30-minute `accuracy` job. Add
top-level to both:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Do **not** change `deploy.yml`'s existing `deploy-master` group — it is
deliberately `cancel-in-progress: false` and a cancelled deploy is worse than a
queued one.

### A5 · `npm ci` for the production frontend (§2.1)

`packages/web/vercel.json` has `"installCommand": "cd ../.. && npm install"`.
Every other install in the repo is `npm ci`, so the artifact served at
`app.zuhayr.io` is built with dependency resolution no gate has tested. Change
it to `cd ../.. && npm ci`. Nothing else in that file.

### A6 · Solution-style root `tsconfig.json` (§2.2, ZUH-50)

Root `tsconfig.json` is `{"extends": "./tsconfig.base.json", "include":
["packages/*/src/**/*"]}`, so a bare `npx tsc` from the root emits ~904
`.js`/`.d.ts`/`.map` files as untracked. Cleaning them needs `git clean -f`,
which also removes gitignored `packages/engine/assets/` and breaks the next E2E
run. The same misconfiguration produces the phantom-2817-errors trap.

Make it solution-style — `{"files": [], "references": [...]}` — pointing at each
workspace package. **Verify the referenced tsconfigs support it** (project
references require `composite`); if they do not, choose the minimal change that
meets the acceptance below rather than adding `composite` across five packages,
and say in your report which you did and why.

Acceptance, all three:
* `npx tsc` from the repo root exits 0 and `git status --porcelain` is clean
  afterwards — zero emitted files;
* `npm run typecheck` still passes;
* `npm run verify` still passes.

The `/assets/` half of ZUH-50 is already done (`packages/engine/.gitignore`).

### A7 · Stage the ops token as a Fly secret (supports Slice B)

Slice B adds an ops API authenticated by a bearer token read from the
`OPS_ADMIN_TOKEN` environment variable. In `deploy.yml`'s `deploy-backend` job,
extend the existing "Stage admin-bootstrap secrets" step (or add a sibling step)
to stage `OPS_ADMIN_TOKEN` from `secrets.OPS_ADMIN_TOKEN`, using the **same
non-empty guard** the `BOOTSTRAP_ADMIN_*` step uses — the secret will not exist
in the repo until the CEO sets it, and flyctl rejects empty values. A missing
secret must print a warning and leave the pipeline green.

Never echo the value. Landing this before Slice B is harmless: the server treats
an unset token as "ops disabled".

---

## Slice B — bounded reads and hard deletes on production (§4.2)

**Owner:** Full-Stack Engineer. **Branch:** `feat/ops-read-delete`.

**Files owned (exclusively):** `packages/server/src/routes/ops.ts` (new),
`packages/server/src/middleware/requireOpsToken.ts` (new),
`packages/server/src/integration/ops.test.ts` (new),
`packages/server/src/app.ts`, `prod-server.ts`, `scripts/artifact-routes.json`,
`packages/server/src/db/migrate.ts` (only to export the migration count),
`packages/contracts/src/ops.ts` (new) + its barrel export in
`packages/contracts/src/index.ts`.

**Explicitly NOT owned:** anything under `packages/web/`, any workflow file, the
`Dockerfile`, `scripts/*.mjs`.

### The problem

`createAdminRouter` in `packages/server/src/routes/auth.ts` routes only
`/invites`. There is no read and no delete. The store is SQLite
(`better-sqlite3`) at `/data/yugioh.db` on an encrypted Fly volume: no network
port, no read-only role — a file inside the machine. So the team deploys to
production on every merge and cannot observe what it deployed into. It can
change what it cannot see. An Infra agent asked to confirm `schema_migrations`
in production could not connect and inferred the answer from code and deploy
history; the question terminated at a human. And QA's authenticated production
pass left `qa-alice`, `qa-bob`, four rooms and one ACTIVE duel in the live
database with no way to remove them.

### Decisions already taken — do not revisit

* **Hard delete, admin-only.** Not soft delete: `qa-alice` would still hold the
  username and every read path would grow a filter. Not self-service: account
  deletion is a user-facing feature and is out of scope.
* **A separate `/api/ops` mount with its own bearer-token middleware**, not an
  extension of `/api/admin`. `/api/admin` is session+role gated for a browser;
  these routes are machine-authenticated. Two auth schemes on one mount point is
  how gates get bypassed. Scoping is structural, not conditional.
* **Named, bounded queries only. No arbitrary SQL, ever.** This is a live app
  with real users and anything read here lands in a session transcript.
* **The credential does not exist yet — build it.** Do not design around a token
  you think is already there.

### Auth contract

`packages/server/src/middleware/requireOpsToken.ts` exports
`requireOpsToken(req, res, next)`:

* Reads `process.env["OPS_ADMIN_TOKEN"]`. If unset or empty → **503**
  `{"error":{"code":"ops_disabled","message":"Ops API is not configured."}}`.
  This is what makes A7 landing early harmless.
* Requires header `Authorization: Bearer <token>`. Missing or malformed → **401**
  `{"error":{"code":"unauthenticated","message":"Ops credential required."}}`.
* Compares with `crypto.timingSafeEqual` over `Buffer.from(...,"utf8")`. A length
  mismatch must **not** throw — compare lengths first and return the same 401.
* No cookie, no session, no `req.user`, no role check. The token is the whole
  credential.
* **Never** log, echo, or include the token or any prefix of it in a response.

Mounted in **both** `packages/server/src/app.ts` and `prod-server.ts`:

```ts
app.use("/api/ops", requireOpsToken, createOpsRouter(db));
```

> `prod-server.ts` is what actually ships; `app.ts` is what the tests exercise.
> A route mounted in only one of them is the exact 2026-07-28 outage. Add the new
> paths to `scripts/artifact-routes.json` so the artifact smoke asserts the
> shipped bundle serves them.

Every ops request logs exactly one line to stdout: method, path, response
status, and for deletes the row counts. No token, no password hash, no seat or
join token.

### Read contract (locked — the harness tool will be written against this)

All responses `application/json`. All errors use the repo's existing shape,
`{"error":{"code":"...","message":"..."}}`. Field names are `camelCase` even
where the column is `snake_case`. A missing nullable value is `null`, never
omitted.

**`GET /api/ops/migrations`** → 200
```json
{ "applied": [{ "version": 1, "appliedAt": "2026-07-20T…Z" }],
  "latest": 3, "expected": 3, "upToDate": true }
```
`applied` ordered by `version` ascending. `expected` is the length of the
`MIGRATIONS` array — export it from `packages/server/src/db/migrate.ts` as
`export const MIGRATION_COUNT = MIGRATIONS.length;` and read it, so the number
cannot drift. `latest` is `null` on an empty table. `upToDate` is
`latest === expected`. This is the endpoint that answers "did that migration
actually apply in production?" without escalating to a human.

**`GET /api/ops/counts`** → 200
```json
{ "counts": { "users": 7, "invites": 3, "sessions": 2, "decks": 5,
              "duel": 1, "duelRoom": 4, "responseLog": 12 } }
```
Exactly these seven keys, from a hardcoded table allowlist. No parameters.

**`GET /api/ops/users?displayName=<exact>`** → 200
```json
{ "users": [{ "id": "…", "displayName": "qa-alice", "role": "member",
              "createdAt": "…" }] }
```
Exact match only, no `LIKE`, no wildcards. Capped at 50 rows. Missing or empty
`displayName` → 400 `invalid_input`. Empty result is 200 with `[]`, not 404.
This exists because the production cleanup needs to resolve `qa-alice` and
`qa-bob` to ids. **Never** returns `passwordHash`.

**`GET /api/ops/user/:id`** → 200
```json
{ "user": { "id": "…", "displayName": "…", "role": "member", "createdAt": "…",
            "deckCount": 2, "sessionCount": 1, "roomCount": 4, "duelCount": 1 } }
```
`roomCount` counts `duel_room` rows where the user is creator or opponent;
`duelCount` counts `duel` rows where the user holds either seat. 404 `not_found`.
**Never** returns `passwordHash`.

**`GET /api/ops/duel/:id`** → 200
```json
{ "duel": { "id": "…", "status": "active", "winner": null, "endReason": null,
            "seat0UserId": "…", "seat1UserId": null, "onClockSeat": 0,
            "deadlineAt": 1754000000, "createdAt": 1754000000,
            "responseLogCount": 12 } }
```
404 `not_found`. **Never** returns `seat0_token`, `seat1_token`, `join_token`,
`deck0_json`, `deck1_json` or `seed_json`. Seat tokens are live credentials.

**`GET /api/ops/room/:id`** → 200
```json
{ "room": { "id": "…", "status": "open", "closedReason": null,
            "creatorUserId": "…", "opponentUserId": null,
            "creatorDeckName": "…", "opponentDeckName": null,
            "creatorReadyAt": null, "opponentReadyAt": null,
            "flipWinnerUserId": null, "flipChoice": null,
            "roomDeadlineAt": 1754000000, "createdAt": 1754000000 } }
```
404 `not_found`. **Never** returns `join_token`, `creator_deck_json` or
`opponent_deck_json`.

### Delete contract (locked)

Hard deletes. Each runs in a single `db.transaction`. Each returns the row counts
it actually removed, so the caller can verify rather than trust.

**`DELETE /api/ops/duel/:id`** → 200
`{"deleted":{"duel":1,"responseLog":12}}`. Deletes `response_log` rows for the
duel, then the `duel` row. 404 `not_found` if absent — **not** a silent 204.

**`DELETE /api/ops/room/:id`** → 200 `{"deleted":{"duelRoom":1}}`. 404 if absent.
Deleting a room does not touch any `duel` started from it; delete that
separately.

**`DELETE /api/ops/user/:id`** → 200
```json
{ "deleted": { "user": 1, "sessions": 1, "decks": 2, "invites": 1,
               "duelRoom": 4, "duel": 1, "responseLog": 12 } }
```
Cascade, in this order, all in one transaction: `response_log` rows of every
`duel` the user holds a seat in → those `duel` rows → every `duel_room` where
the user is creator or opponent → `decks` owned → `sessions` held → `invites`
where the user is `created_by` **or** `consumed_by` → the `users` row. 404 if
absent.

**Guard:** if the target's `role` is `'admin'` and the number of admin users is
1, refuse with **409**
`{"error":{"code":"last_admin","message":"Refusing to delete the only admin."}}`
and delete nothing. Locking ourselves out of production over a cleanup task is
not an acceptable failure mode.

### Testing

`packages/server/src/integration/ops.test.ts`, following the existing style in
`packages/server/src/integration/auth.test.ts`. Must cover: 503 when
`OPS_ADMIN_TOKEN` is unset; 401 with no header, a malformed header, a wrong
token, and a token of different length (proving `timingSafeEqual` does not
throw); the exact response shape of all six reads including the absence of every
forbidden field; 404s; each delete's cascade counts against seeded fixtures; and
the `last_admin` 409. Assert on shape, not on prose.

### Done means

`npm run verify` and `npm run smoke:artifact` pass; the new routes appear in
`scripts/artifact-routes.json` and the smoke asserts them; the six reads and
three deletes behave exactly as above. The production cleanup itself (removing
`qa-alice`, `qa-bob`, the four rooms and the ACTIVE duel) happens **after**
deploy, driven by the CEO or the harness with the real credential — it is not
part of this slice.

---

## Slice C — tab-close recovery, and web hygiene (§4.1, §2.3, §2.4)

**Owner:** Full-Stack Engineer. **Branch:** `fix/duel-resume-and-web-hygiene`.

**Files owned (exclusively):** everything under `packages/web/src/`.

**Explicitly NOT owned:** `packages/web/vercel.json` (Slice A),
`packages/server/**`, `prod-server.ts`, `packages/contracts/**`, any workflow
file.

### C0 · Verify what is actually broken — do this FIRST and report before building

The PRD says the seat token lives only in React Router `location.state` and is
never persisted, so closing the tab loses the duel and the player is shown a
**mock** duel instead of an error. **Reading the code, both halves look at least
partly fixed already, and I do not want a fix built on a stale premise:**

* `packages/web/src/screens/DuelScreen.tsx:52` — `useMock` is already
  explicit-only (`locationState.useMock === true`), documented as fixing exactly
  this ZUH-21 symptom under R32/R43.
* `DuelScreen.tsx:74-97` already falls back to `getSeatCredential(duelId)` when
  `location.state.seatToken` is absent, and
  `packages/server/src/room/routes/getSeatCredential.ts` imposes **no** status
  restriction — any authenticated seat holder gets their token back. So a new
  tab opened on `/duel/:duelId` should already recover.

So the residual gap is probably **not** the token — it is that closing the tab
loses the *URL*, and there is no route back to an in-progress duel from
anywhere in the app. Plus the mock module still ships inside the production
bundle even though nothing routes to it.

**Your first deliverable is evidence, not a fix.** Write the tests that
reproduce the three scenarios below against the real app, and report what each
one actually does today:

1. Fresh tab navigated straight to `/duel/:duelId` with an authenticated
   session and empty `location.state` — does the board recover the seat and
   connect?
2. Same, but the duel's status has left `waiting` — same question.
3. From the app's entry point (Home / post-login) with no URL in hand — is there
   any path back to an in-progress duel at all?

Then **stop and report** with: what is genuinely broken, what the PRD claims
that is already fixed, and your proposed mechanism. I will confirm the mechanism
before you build it, because if the answer is "we need a resume affordance on
Home", that is a visible product surface and the CEO decides its shape.

Do **not** add `localStorage` persistence of the seat token on the strength of
the PRD alone. If the server-side recovery already works, `localStorage` is the
strictly weaker mechanism — it does not survive a different device, and it puts
a live credential where the session cookie already does the job better.

### C1 · Make the mock duel unreachable in production

Regardless of what C0 finds, this stands. `useMock` being explicit-only means
nothing *routes* to the mock — but `packages/web/src/mock/duelSession.ts` is
still bundled into the production artifact and still reachable by navigating
with crafted router state.

Gate the mock behind a build-time condition (`import.meta.env.DEV`) so it is
tree-shaken out of the production bundle entirely, and so the production build
cannot render a mock board under any router state. Where the mock would have
rendered in production, render the same hard, explanatory failure the
credential-error path already renders, with a route back to safety. A plausible
fake is the worst available failure: it looks like it works.

Acceptance: a production build (`npm run build:web`) contains no reference to
the mock session module, and `useMock: true` in router state against a
production build renders the error path, not a board. Assert this with a test
that greps the built output — a claim about tree-shaking that nothing checks is
the same class of defect as the rest of this project.

### C2 · A test must not assert stub copy (§2.3, ZUH-40)

`RoomScreen.test.ts` asserts on "Waiting Room" text that only existed in the old
stub, which forced an `sr-only` element into the real implementation purely to
satisfy the test. Rewrite those assertions to use `getByRole` / `aria-label` /
structure, then remove the `sr-only` element that exists only for the test.
Do not remove any `sr-only` that carries real accessibility value — say which
you removed and why in your report.

### C3 · Delete the dead duel stubs (§2.4, ZUH-55)

`packages/web/src/api/duel.ts` exports `createDuel` and `joinDuel`, both
`@deprecated`, both wired to no UI, superseded by `api/room.ts` under ZUH-26.
They are harmless at runtime and actively misleading — they look like the
supported path. Delete both. If the file is then empty, delete the file. Remove
any now-unused imports; do **not** touch `packages/contracts` to chase types
(the contract schemas stay — Slice B does not own them either, and §2.5 of the
PRD is precisely about not deleting shared contracts from inside a slice).

### Done means

`npm run verify` passes, `npm run test:e2e` passes, and the C1 acceptance test
exists and passes.

---

## Slice D — the agent-facing repo contract (§3.1, §3.2, §2.5)

**Owner:** CTO, directly. **Branch:** `fix/agents-md-delivery-proof`.

**Files owned:** `AGENTS.md`, the `rawUpgrade` helper in
`scripts/smoke-artifact.mjs` (coordinated with Slice A, which also owns that
file — sequenced after A merges, not parallel to it).

* **§3.1** — `github.com` does not appear anywhere in `AGENTS.md`. Specialists
  cloned the shared *local* checkout instead of the remote, and `AGENTS.md`'s own
  "verify remote == local" proof-of-delivery check passed against that local
  repo. An engineer reported "SHA pushed, VERIFIED (remote == local)" for 984
  green tests that existed only inside its container. `AGENTS.md` must name the
  GitHub remote as the only clone source, and its proof-of-delivery step must
  compare against a remote on `github.com` — a check that can pass against a
  local mirror is not a check.
* **§3.2** — document the 16-byte `Sec-WebSocket-Key` requirement where the
  `rawUpgrade` helper lives, and use `crypto.randomBytes(16)`. A 21-byte key made
  the server return 400 and produced a false "prod board WS is broken" reading.
* **§2.5** — a spec that deletes a shared contract must list the
  collateral-damage files or define a deprecation shim. This is a specification
  rule, so it belongs in the codebase standard, not only in this repo.

---

## Slice E — a route back to an in-progress duel (§4.1, the real gap)

**Owner:** Full-Stack Engineer. **Branch:** `feat/resume-active-duel`.

**Files owned (exclusively):** `packages/server/src/room/routes/listActiveDuels.ts`
(new), `packages/server/src/room/roomRouter.ts`, `packages/contracts/src/duel.ts`,
`packages/web/src/screens/HomeScreen.tsx`, `packages/web/src/api/room.ts`, and the
test files for each.

**Explicitly NOT owned:** `packages/web/src/screens/DuelScreen.tsx`,
`packages/web/src/screens/room/**`, `scripts/**`, any workflow file, anything
under `packages/server/src/routes/`.

### Why this exists, and what it is NOT

Slice C's investigation refuted most of what the PRD claimed about §4.1. Both
halves the PRD worried about are already fixed:

* `DuelScreen.tsx:52` — `useMock` is explicit-only (R32/R43), so no mock board
  renders on a missing credential.
* `DuelScreen.tsx:74-97` — the screen already falls back to
  `getSeatCredential(duelId)`, and `getSeatCredential.ts` imposes no status
  restriction, so **a new tab opened on `/duel/:duelId` already recovers the
  seat**, on any device, after the duel has left `waiting`.

The residual gap is narrower and purely navigational: **closing the tab loses the
URL, and nothing in the app links back to an in-progress duel.** `HomeScreen`
renders only a seam comment where the queue should be.

So this slice does **not** persist the seat token. `localStorage` is the strictly
weaker mechanism — it does not survive a device change, and it would put a live
credential in storage where the session cookie already does the job better. The
fix is discovery, not storage.

### Contract (locked)

**`GET /api/duels/active`** — session-authenticated, same `requireSession(db)` as
its siblings in `roomRouter`. Returns the caller's in-progress duels:

```json
{ "duels": [
  { "duelId": "…", "status": "active", "mySeat": 0,
    "opponentDisplayName": "…", "onClockSeat": null,
    "deadlineAt": null, "createdAt": 1754000000 }
  ],
  "rooms": [
    { "roomId": "…", "status": "open", "myRole": "creator",
      "opponentDisplayName": null, "roomDeadlineAt": 1754000000,
      "createdAt": 1754000000 }
  ] }
```

**Duels** (`duels` array):

* "In progress" is `duel.status != 'ended'` — that is, `waiting_for_opponent` and
  `active`. Derive the terminal set from the existing code rather than inventing
  one; `duelStore.ts:147` is the only place `'ended'` is written.
* A duel where the caller holds **either** seat. `mySeat` is the caller's seat.
* `opponentDisplayName` is `null` when the other seat is unfilled.
* `onClockSeat` and `deadlineAt` are **nullable** — both columns are `NULL` in
  SQLite until the engine starts the first move clock (`duel.on_clock_seat`,
  `duel.deadline_at` in migration 2). A duel in `waiting_for_opponent` will
  always return `null` for both.
* Ordered by `createdAt` **descending**. Capped at 20.
* **Returns no credentials.** No `seat0_token`, no `seat1_token`, no
  `join_token`. The client navigates to `/duel/:duelId` and the existing
  `getSeatCredential` flow supplies the token.
* Empty result is `200` with `[]`, never 404.

**Rooms** (`rooms` array) — ZUH-74:

* "In progress" for a room is `status NOT IN ('closed', 'starting')` — derived
  from `isTerminal()` in `roomState.ts`, which returns `true` for `'closed'` and
  `'starting'`. The terminal set is two values: `'closed'` (ended/expired/left)
  and `'starting'` (duel engine being created — room's job is done; a duel row
  already exists). Active statuses are `'open'`, `'filled'`, `'awaiting_choice'`.
* Room expiry is lazy in this codebase: a room whose `room_deadline_at` has passed
  but whose `status` has not yet been written `'closed'` will appear in the list.
  The player navigates to it, the next request evaluates the expiry, and they see
  the result. `status` is the authority — do not filter on `room_deadline_at`.
* `myRole` is `"creator"` or `"opponent"` depending on which user-ID column
  matches the caller (`creator_user_id` / `opponent_user_id`).
* `opponentDisplayName` is `null` when the other side is unfilled.
* **No `join_token` in the payload, ever, and no deck JSON.** `join_token` is a
  live credential — it is the whole security of the invite link.
* Ordered by `createdAt` **descending**. Capped at 20. Empty is `[]`, never 404.

⚠️ **Route registration order.** `roomRouter` already carries parameterised
routes such as `/:id/seat`. Register `/active` **before** any route that could
capture it, or the literal will be swallowed by a parameter.

### UI

Fill the existing seam in `HomeScreen.tsx`. Render both duels and rooms as a
combined list (one section, one empty state). Each entry links to `/duel/:roomId`
or `/duel/:duelId`. The empty state (`"No games in progress."`) shows only when
**both** arrays are empty. Use the components and patterns already in
`HomeScreen`; this is a list with links, not a new design system.

### Done means

`npm run verify` and `npm run test:e2e` pass. Tests cover: the endpoint excludes
ended duels and terminal rooms; it returns entries for both seat/role positions;
it never returns a token or deck-JSON field; ordering and the cap hold; an
unauthenticated call is rejected; Home renders a working link for each active
duel and room, and the empty state only when both arrays are empty.

## Sequencing

1. **Slice A merges first** (A1 at minimum). Nothing else merges into a CI whose
   docs gate is dead.
2. **Slices B and C build in parallel** with A and merge after it.
3. **Slice D** after A, because it shares `scripts/smoke-artifact.mjs`.
4. §4.3 (pending-invites list and creator-cancel, ZUH-22) is **cut** — the
   30-minute expiry means a stale link dies on its own, so there is little to
   list and little to manage. The PRD names it first to cut.

## Acceptance for the project

* A PR that adds a doc in the wrong place fails, and a run that cannot resolve
  its base fails loudly rather than printing `✓`.
* The smoke and the Dockerfile provably build the same artifact, and drift fails
  CI.
* `AGENTS.md`'s proof-of-delivery cannot pass against a local mirror.
* No mock duel is reachable in a production build, and tab-close recovery
  behaves as C0 establishes it should.
* The `qa-alice` / `qa-bob` rows and the ACTIVE duel are gone from production,
  removed through the new delete path rather than by hand.
* A lead can answer "did that migration actually apply in production?" without
  escalating to the CEO, and without any credential entering a container.
