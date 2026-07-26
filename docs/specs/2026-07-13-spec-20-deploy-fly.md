# Spec 20 — Deploy the Deck Builder on Fly.io (single always-on Machine)

**Owner role:** Infra Engineer. **Status:** ready (CEO approved Fly.io hosting). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Goal
Make the current app (the DECK BUILDER: React SPA + REST API + SQLite + self-hosted card catalog/images) deploy-ready on **Fly.io** as ONE always-on Machine serving everything same-origin, with a persistent volume for the DB + images. Produce all deploy artifacts + docs, and VERIFY by running the production container locally. Execute the live `fly deploy` only if a Fly token is present in the environment; otherwise stop at "ready" and document the exact one-command finish.

Decision context: `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-13-hosting-flyio.md`. Architecture: `.../decisions/2026-07-13-architecture-server-authoritative.md`.

## Key constraints
- **One host serves everything same-origin:** the Node/Express server serves the built web static assets AND `/api/*`. (WebSockets + the game engine arrive with the dueling slice — same container, later. Do NOT build them now.)
- **Always-on:** `min_machines_running = 1`; the app must never sleep (avoids cold-start; required later for wall-clock timers). Do NOT enable scale-to-zero.
- **Persistent volume** mounted for: the SQLite file AND the card images. Both must survive redeploys. The server already reads the catalog JSON from `packages/card-data/out/` (baked into the image, fine); IMAGES are large (~few hundred MB) → put them on the volume, not the image.
- **Real catalog:** ensure `ALLOW_FIXTURE_CATALOG` is NOT set in production, so the server loads the real 3,681-card catalog (it throws if missing — good).
- **Admin bootstrap:** first admin via `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD` set as **Fly secrets** (never in `fly.toml`, never in git, never in team memory).
- **HTTPS:** launch on the free `*.fly.dev` subdomain (automatic TLS). Force HTTPS. (Custom domain later — leave a note how.)
- **Secure cookies:** the `sid` session cookie is httpOnly + Secure + SameSite; confirm it works over the fly.dev HTTPS origin (same-origin, so SameSite=Strict/Lax is fine).

## Exclusive file ownership
Create/edit ONLY: `Dockerfile`, `.dockerignore`, `fly.toml`, a `deploy/` dir (scripts: image-seed, backup, local-verify), and `docs/working/2026-07-13-DEPLOY.md`. You MAY add a root `package.json` script (e.g. `start:prod`, `build:all`) if needed — if you touch root `package.json`, do it surgically (add scripts only, don't reformat). Do NOT modify `packages/**` source logic (if the server needs a small prod entrypoint change, flag it to the CTO rather than editing packages/server yourself). Do NOT touch other specs, other packages' internals, or spikes.

## Deliverables
1. **`Dockerfile`** (multi-stage, Node 22): install + `npm ci`; build the web app (`vite build` in packages/web) and the server (tsc/tsx); produce a lean runtime image that runs the server which serves the web static build + `/api`. Include the committed card catalog JSON. Do NOT bake the image blobs.
2. **`fly.toml`**: app config; primary region near the group (pick a sensible US/EU region, note it's changeable); `[mounts]` a volume at the data path used for SQLite + images; `[http_service]` internal_port, `force_https = true`, health check hitting a `/healthz` or `GET /api/cards?pageSize=1`; `min_machines_running = 1`; `[env]` NODE_ENV=production (NO ALLOW_FIXTURE_CATALOG). Memory ~1GB.
3. **`deploy/seed-images.sh`** (or .mjs): fetch the full ~3,681 card-image set onto the mounted volume (reuse `packages/card-data/scripts/download-images.mjs` full-pull; respect the 20 req/s cap). Idempotent (skip existing). Document running it once post-first-deploy (e.g. via `fly ssh console` or a release step). Confirm the server serves images from the volume path.
4. **`deploy/backup.md`** (or script): rely on Fly automatic daily volume snapshots + document a manual SQLite dump via `fly ssh console` (`sqlite3 .backup` or file copy). Keep simple.
5. **`docs/working/2026-07-13-DEPLOY.md`**: (a) the CEO's one-time account steps (create Fly account, add payment, `fly tokens create deploy` or dashboard token, provide token via secure env — NOT chat), (b) the team deploy commands (`fly launch`/`fly deploy`, `fly volumes create`, `fly secrets set BOOTSTRAP_ADMIN_*`), (c) how bootstrap admin + image seed work, (d) how to add a custom domain later, (e) the live URL once deployed.

## Verification (REQUIRED — paste real output)
- Build the image: `docker build`. Run it locally: `docker run` with a local volume mount + `BOOTSTRAP_ADMIN_*` env + a subset of images (or the fixture path is DISABLED, so mount the real catalog — the catalog JSON is in the image; images optional for the smoke test). 
- Prove the running container: `curl` the served web page (200 + HTML), `curl /api/cards?pageSize=1` returns `total: 3681` (real catalog, NOT 22 — if you see 22 the catalog path is wrong in the image), redeem/login flow works (bootstrap admin created from env), and a deck POST validates. Paste outputs.
- If `FLY_API_TOKEN` (or equivalent) is present in the env: run the real `fly deploy`, report the live `*.fly.dev` URL + a curl against it. If NOT present: STOP at "container verified locally, ready to deploy", and report the exact remaining commands for the CTO/CEO to run once the token is provided.

## Git / push protocol
Gate on your own artifacts (docker build succeeds + local run verified). Commit → `git pull --rebase --autostash origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD. Only `git add` your owned paths; never `git add -A`/`clean`/`stash`/`checkout --` outside them. Do NOT commit any secret/token.

## Report back
Deploy artifacts produced; the LOCAL container verification output (esp. `total: 3681` proving the real catalog loads in the image); whether the live deploy ran (URL) or is waiting on the CEO's Fly token (with the exact remaining commands); any change you think packages/server needs for prod (flag, don't edit); the pushed SHA.
