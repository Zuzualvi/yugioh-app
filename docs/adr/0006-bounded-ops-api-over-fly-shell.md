# ADR 0006 — Production is read and corrected through a bounded ops API, not a Fly shell

**Status:** Accepted  
**Date:** 2026-08-04  
**Decided by:** CTO, with CEO approval on the delete semantics and the auth shape.  
**Relates to:** `packages/server/src/routes/ops.ts`, `packages/server/src/middleware/requireOpsToken.ts`, `.github/workflows/deploy.yml`, `docs/specs/2026-08-04-product-cleanup.md`

---

## Context

This team deploys to production on every merge to `master` and cannot observe
what it deployed into. It can change what it cannot see.

The store is SQLite (`better-sqlite3`) at `/data/yugioh.db` on an encrypted Fly
volume. It has no network port and no read-only role — it is a file inside the
machine. `createAdminRouter` in `packages/server/src/routes/auth.ts` routes only
`/redeem-invite`, `/login`, `/logout`, `/` and `/invites`: there is no read and
no delete.

Two incidents forced the decision. An Infra agent asked to confirm
`schema_migrations` in production found the DB path, could not connect, and fell
back to inferring the answer from source and deploy history — honestly, but by
proxy — after which the question terminated at a human. And QA's authenticated
production pass left `qa-alice`, `qa-bob`, four rooms and one ACTIVE duel in the
live database with no clean way to remove them.

The low incident count is not evidence of low value. **The absence of a
capability suppresses demand for it:** a lead does not ask questions it knows
cannot be answered, it infers instead — and inferring production state from a
proxy is the failure this project has already paid for once, in ADR 0004.

## Decision

Production is read and corrected through **named, bounded HTTP endpoints under
`/api/ops`, authenticated by a bearer token that lives only as a Fly secret and
is held server-side by the harness.** No shell, no arbitrary SQL, and no
credential inside any agent container.

Specifically: six read endpoints (migration state, table counts, exact-match user
lookup, and the state of one named user / duel / room) and three hard-delete
endpoints (user / room / duel), on their own mount with their own middleware.
Deletes are hard and admin-only. The full contract is locked in
`docs/specs/2026-08-04-product-cleanup.md` §Slice B.

## Alternatives considered

**A `FLY_API_TOKEN` in the agent's container for `fly ssh console` — what ZUH-42
actually asked for. Rejected outright, not deferred.** It fails on three counts:
it grants *write* where the need is *read*; it grants a *shell*, so the
capability is unbounded and unauditable; and it puts a long-lived credential
*inside a sandbox*, breaking the one invariant this system holds everywhere else
— the harness holds the key, the agent gets the capability (see `read_ci_status`,
and every Linear and GitHub tool). The reporter named the mechanism it knew, not
the requirement underneath it.

**Arbitrary read-only SQL over HTTP.** Rejected. This is a live app with real
users, and anything an agent reads lands in a session transcript. A `SELECT *`
would put password hashes and live seat tokens there. Bounded queries also let
the response shape be a contract the harness tool can be written against, which
a SQL passthrough cannot.

**Extending the existing `/api/admin` router.** Rejected. `/api/admin` is gated
by `requireSession` + `requireAdmin` for a browser holding a session cookie;
these routes are machine-authenticated with a bearer token. Two auth schemes on
one mount point is how a gate gets bypassed by accident. A separate mount makes
the scoping structural rather than conditional.

**Soft delete.** Rejected. The purpose is to remove test detritus from a live
database. A soft-deleted `qa-alice` still holds the display name, and every read
path in the app grows a filter it did not need. Self-service deletion was also
rejected as out of scope: account deletion is a user-facing feature, not a
cleanup capability.

## Consequences

* A lead can answer "did that migration actually apply in production?" from a
  tool, without escalating to a human and without inferring from a proxy.
* The bearer token is a new production credential. It is staged as a Fly secret
  from a GitHub repo secret, guarded so that an unset secret leaves the pipeline
  green, and the server returns **503 `ops_disabled`** when the variable is
  absent — so the capability is off by default and its absence is legible rather
  than silent.
* **What becomes harder:** every new production question needs a new named
  endpoint. That is the intended cost. It is the price of never having an
  unbounded read, and it keeps each capability reviewable in a diff.
* The endpoints are mounted in both `app.ts` and `prod-server.ts` and asserted by
  the artifact smoke. A route mounted in only one of them is the 2026-07-28
  outage, and this ADR's capability is worthless if it is not in the artifact
  that ships.
