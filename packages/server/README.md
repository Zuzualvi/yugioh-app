# @yugioh-app/server

The backend HTTP server for the Yu-Gi-Oh Edison Duel App.

## Running the server

```sh
# From repo root
node --import tsx packages/server/src/index.ts
# or via vite-node:
npx vite-node packages/server/src/index.ts
```

## Environment variables

| Variable                   | Default       | Description                                               |
| -------------------------- | ------------- | --------------------------------------------------------- |
| `PORT`                     | `3001`        | HTTP port                                                 |
| `DB_PATH`                  | `./yugioh.db` | SQLite database file path                                 |
| `BOOTSTRAP_ADMIN_USERNAME` | _(none)_      | See admin bootstrap below                                 |
| `BOOTSTRAP_ADMIN_PASSWORD` | _(none)_      | See admin bootstrap below                                 |
| `ALLOW_FIXTURE_CATALOG=1`  | _(none)_      | Permit 22-card fixture — tests only, **never production** |

## Admin bootstrap (first-time setup)

The app is invite-only: a new account requires an invite issued by an existing admin. This creates a chicken-and-egg problem on a fresh database with no users at all.

**Solution:** set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` on the **first startup only**. When both are set and **no admin exists yet**, the server creates a single admin user automatically. This is:

- **Idempotent** — runs only when no admin exists; subsequent startups with the same env vars do nothing.
- **Never overwrites** an existing admin.
- **Env-driven** — credentials are never hardcoded; unset the env vars after the first admin is set up.

```sh
BOOTSTRAP_ADMIN_USERNAME=founder \
BOOTSTRAP_ADMIN_PASSWORD=a-strong-password \
DB_PATH=./yugioh.db \
npx vite-node packages/server/src/index.ts
```

After startup, use `POST /api/auth/login` with those credentials to log in, then `POST /api/admin/invites` to generate invite codes for the rest of the group.

**Security:** unset or omit `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` after the first admin is created — once an admin exists, these env vars are ignored by the bootstrap guard.

## Card catalog

The server loads `packages/card-data/out/edison-card-catalog.json` at startup. Build that artifact first via the `card-data` package. The server will throw a clear error if the catalog is missing (do **not** use `ALLOW_FIXTURE_CATALOG=1` in production).
