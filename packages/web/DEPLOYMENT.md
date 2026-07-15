# Web app — build & deploy notes

The frontend (`@yugioh-app/web`, Vite + React) is deployed on **Vercel**.

## Vercel project settings

- **Root Directory:** `packages/web` — Vercel only rebuilds when a commit changes
  files under this directory (monorepo change detection).
- **Build:** see `vercel.json` — `installCommand`/`buildCommand` `cd ../..` to the repo
  root so the workspace install/build (`npm run build:web`) resolves `@yugioh-app/*`
  workspace deps. Output: `packages/web/dist`.
- **SPA routing:** `vercel.json` rewrites all paths to `/index.html`.

## API base

The production bundle talks to the real backend at `api.zuhayr.io` via the project's
`VITE_*` environment variables (set in Vercel). The `mock-api` plugin in
`vite.config.ts` is **dev/Playwright only** (`configureServer` middleware) and is never
part of the production build.

## Deploy trigger

Pushes to `master` deploy the frontend. Note the plan's git-author gate: deploys are
only accepted for commits authored by a team member. The durable path is a token-based
`vercel deploy` in CI (authorship-independent, matching the Fly backend).
