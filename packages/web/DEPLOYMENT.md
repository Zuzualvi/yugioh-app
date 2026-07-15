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

Every push to `master` that touches non-docs files runs the GitHub Actions pipeline
(`.github/workflows/deploy.yml`). Commits that change only `docs/**` or `*.md` are
path-ignored and do **not** trigger a deploy.

On green `verify` + `accuracy` jobs, the `deploy-frontend` job:

1. Runs `vercel pull --yes --environment=production` to fetch project settings.
2. Runs `vercel deploy --prod` — a **remote build** on Vercel's infrastructure using
   the project's Root Directory (`packages/web`) and the `installCommand`/`buildCommand`
   in `vercel.json`.
3. Runs a fatal health check against `https://app.zuhayr.io` (expects HTTP 200 + SPA
   shell); failure fails the pipeline.

Authentication uses repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
`VERCEL_PROJECT_ID`. This token-based approach is authorship-independent — Vercel's
Git integration is **not** used because it rejects bot-authored commits
(`TEAM_ACCESS_REQUIRED`); the CLI + token always works regardless of commit author,
matching the model the Fly backend uses.

**Rollback:** Vercel dashboard → Instant Rollback, or:

```sh
vercel rollback <deployment-url> --token=$VERCEL_TOKEN
```
