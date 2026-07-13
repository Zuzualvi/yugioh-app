# Yu-Gi-Oh Edison Duel App

A real-time Yu-Gi-Oh Edison-format dueling application built as a
TypeScript monorepo. This repo is at the **skeleton / guardrail** stage —
no game features yet, just the foundational structure that every later
feature builds into.

## Repo layout

```
packages/
  contracts/   Shared types + Zod schemas (innermost ring — no internal deps)
  engine/      ocgcore adapter boundary (depends on contracts only)
  server/      WebSocket / HTTP backend (depends on contracts + engine)
  web/         Vite + React frontend (depends on contracts only)
ci/
  github-actions-ci.yml   Pipeline definition (see ci/README.md to enable)
  README.md               How to activate GitHub Actions
```

See [`packages/README.md`](packages/README.md) for per-package notes.
See [`AGENTS.md`](AGENTS.md) for the durable engineering rulebook.

## Quick start

```sh
# Requires Node 22+
npm ci

# Full local check (same steps as CI — run before every push)
npm run verify
```

`verify` runs: `typecheck → lint → arch:check → test`. Green = ready to push.

## Individual checks

```sh
npm run typecheck   # tsc --noEmit across all packages
npm run lint        # ESLint + Prettier format check
npm run arch:check  # dependency-cruiser forbidden-import guardrail
npm test            # Vitest (all packages)
```

## Architecture

Dependencies flow inward only — `web` and `engine` never import from
`server`; `web` never imports from `engine`; `contracts` imports nothing
internal. This is enforced at every `verify` run by `dependency-cruiser`.

See `AGENTS.md` for the full dependency-direction rule and instructions on
adding new packages.

## Enabling GitHub Actions

The CI workflow definition is at `ci/github-actions-ci.yml`. A one-time
step (requires a token with `workflow` scope) copies it into
`.github/workflows/`. See `ci/README.md`.
