# Edison Deck Builder — Go-Live Status Report

**Date:** 2026-07-13
**Prepared by:** CTO
**Repo state:** `master` @ `b27186e` (clean-clone `npm run verify` green)

## TL;DR

The Edison deck builder is **code-complete and deploy-ready** for the Vercel-frontend +
Fly-backend split. We found and closed a gap first: the split you'd decided on was recorded
but never actually built into the code (it was still wired single-host). That rework is now
done and QA-verified. Going live is now gated only on three inputs from you and your approval
of the `provision_hosting` card.

## What we deployed against

The `provision_hosting` tool stands up a **Vercel frontend + Fly backend** on a shared parent
domain — `app.<domain>` (the app) + `api.<domain>` (the backend). Shared parent domain keeps
the login session on a clean `SameSite=Lax; Secure; httpOnly` cookie.

## Work completed this session (Spec 21 — deploy split rework)

| Stream | Change | Commit |
|--------|--------|--------|
| Backend | Credentialed CORS allowlist middleware (no new dep) + session cookie `SameSite=Lax` | `b295fb75` |
| Frontend | API + card-image calls point at the backend origin via build-time env vars | `2cd7f47c` |
| Infra | Fly backend is API-only (Vercel serves the SPA); Dockerfile slimmed; Vercel monorepo build; DEPLOY.md rewritten | `1be936a1` |
| CTO | Repo-wide formatting fix so `verify` is green | `b27186e` |

## QA verification (integrated, clean clone) — PASS

- Full `npm run verify` green: typecheck + lint + architecture guardrails (0 violations) + **175 tests**.
- Production web build: bundle is **clean of the image CDN** (self-hosted images, REQ-DATA-02) and
  has the backend API URL baked in.
- Cross-origin smoke on the real backend + real **3,681-card** catalog: allowed origin gets CORS +
  credentials, a disallowed origin gets nothing, login sets a `SameSite=Lax; HttpOnly; Secure` cookie,
  authenticated card list returns all 3,681, deck validation runs.
- Backend image has no frontend dependency.

## What I need from you (to provision)

1. **Domain** — the registrable domain to use (`app.<domain>` + `api.<domain>`). Owned already or register?
2. **First admin login** — add `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD` as GitHub repo
   secrets (values never touch chat/repo/CTO). You'll invite the group from that admin account.
3. **Region** — default Chicago (`ord`); tell me roughly where the group is and I'll pick the closest.

## Cost

- Fly ~$8–15/mo (1 GB always-on machine + small volume) on your Fly account.
- Vercel free (Hobby tier — private, non-commercial).
- Domain ~$12–20/yr if not already owned.

`provision_hosting` is the spend gate: **approving that card is what provisions and starts billing.**

## Sequence to live

1. ✅ Rework landed + QA green (done).
2. You provide domain + region and add the two GitHub secrets.
3. You approve the `provision_hosting` card → Fly + Vercel + domain/DNS + CI secrets stand up.
4. CTO finalizes the domain values, commits the merge=deploy CI workflow, deploys, seeds the ~3,681
   card images to the volume.
5. Verify live → you log in as admin and start inviting the group.
