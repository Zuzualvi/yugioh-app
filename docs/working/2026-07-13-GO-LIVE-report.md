# Edison Deck Builder — GO-LIVE Report

**Date:** 2026-07-13
**Prepared by:** CTO
**Status:** ✅ LIVE

## It's live

| Tier | URL | Host | Status |
|------|-----|------|--------|
| Frontend | https://app.zuhayr.io | Vercel | ✅ serving |
| Backend | https://api.zuhayr.io | Fly.io (region `ord`) | ✅ healthy |

Verified end-to-end against the live deployment:
- `GET /healthz` → `{"status":"ok","cards":3681}` (real Edison catalog, valid TLS on the custom domain)
- Cross-origin auth: CORS preflight from `app.zuhayr.io` → `204` with exact-origin + credentials; unauthenticated `/api/cards` → `401`
- Frontend bundle calls `https://api.zuhayr.io` for API + `https://api.zuhayr.io/images/` for art; **zero** references to the old image CDN (self-hosting requirement honored)
- **Card images seeded** onto the Fly volume — all sampled cards return real JPEGs
- SPA deep-links (`/decks`, `/builder/:id`) resolve on direct navigation / refresh

## How it's wired

- **Provisioned** via the `provision_hosting` tool: Fly app `yugioh-app` (+ persistent volume `data` for SQLite + card images), Vercel project `yugioh-app`, DNS, and repo CI secrets.
- **Frontend deploys** automatically via **Vercel's Git integration** on every push (uses the project's `VITE_*` env vars).
- **Backend deploys** via GitHub Actions (`.github/workflows/deploy.yml`, merge=deploy): `verify` gate → `fly deploy` → allocate IPs → ensure TLS cert → seed images. Pull requests are gated by `.github/workflows/ci.yml`.
- **First admin** bootstrapped from the `BOOTSTRAP_ADMIN_*` GitHub secrets (username `zuzu`).

## Rework done to enable the split (this session)

The Vercel+Fly split had been decided but never coded. Closed it before go-live:
- Backend: CORS allowlist middleware + `SameSite=Lax` session cookie
- Frontend: env-driven API + image base URLs
- Backend made API-only (Vercel serves the SPA); Docker image slimmed
- Added an admin-only "Invite a friend" UI (invites had no generate button)

All landed with tests; clean-clone `verify` = 179 tests green.

## How to bring in the group

1. Log in at `https://app.zuhayr.io` as `zuzu`.
2. Use **Invite a friend** on the home screen → copy the generated link (`app.zuhayr.io/login?invite=<code>`, valid 7 days).
3. Send it to a friend (text/Discord/etc.) → they open it, pick a display name + password, and they're in. No email involved.

## Notes / minor follow-ups (non-blocking)

- **Region:** landed in Chicago (`ord`), not Ashburn — the provisioner's default won out over the `iad` hint. Negligible latency for a US-East group; `fly.toml` is aligned to `ord`. Migratable later if desired.
- **Vercel Git integration** owns the frontend; the unused `VERCEL_*` repo secrets are harmless leftovers from provisioning.
- **What's live = the deck builder** (Slice 1+2). The dueling slice (real-time/async duels, the rules engine over WebSockets) is the next big build and redeploys the same Fly backend.
