# Spec 10 — Backend Spine (contracts + auth + persistence + deck + card serving)

**Owner role:** Backend Engineer. **Status:** ready (Phase 2, Slice 1+2). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Goal
Build the entire V1 backend for accounts + deck building: the shared contracts package, SQLite persistence, invite-only auth/sessions, the deck bounded context (CRUD + authoritative legality validation + `.ydk` import/export), and read-only card endpoints served from the card catalog. No dueling (that's Slice 3).

## Read first
- `/workspace/specs/13-contracts-and-api.md` — the LOCKED contracts/API/schema. Implement `packages/contracts` to embody it exactly. Do not vary field names.
- `docs/working/2026-07-13-v1-requirements.md` — §2.1 (deck rules), §2.3 (`.ydk`), §2.4 (identity), §3 REQ-AUTH, §6 REQ-DECK, §14 REQ-DATA. This is the behavior/edge-case source.
- `docs/working/2026-07-13-spec-00-foundation.md` + `AGENTS.md` — the codebase standard you build to.

## Architecture (enforced)
Clean/hexagonal, modular monolith. A deterministic domain core (deck legality rules, `.ydk` parse/emit) that depends on NOTHING (no DB, no framework) — pure functions over `CardDTO`/passcodes. Use cases orchestrate. DB + HTTP are edges. **One operation per file.** The legality validator and the `.ydk` codec are pure library code with their own unit tests — they are the load-bearing correctness pieces.

## Exclusive file ownership
Create/edit ONLY: `packages/contracts/**`, `packages/server/**`, and root `.dependency-cruiser.cjs` (add the `card-data` package rules per Spec 13 §6 — you are the integrator for arch rules this slice). Do NOT touch `packages/web/**`, `packages/card-data/**`, `packages/engine/**`, other root config, `docs/`, `/workspace/specs/`, or any `spikes/**`.

## Card data dependency
The `packages/card-data` package (Spec 11, built in parallel) produces `packages/card-data/out/edison-card-catalog.json` (shape in Spec 13 §2) and exports a typed loader. Code your card endpoints + the legality validator against the `CardCatalog`/`CardDTO` types from Spec 13. If the catalog artifact isn't present yet when you need to run, use a small fixture catalog (a dozen hand-picked Edison cards incl. a Forbidden, a Limited, a Fusion, a Synchro, a Ritual, and an alt-art alias pair) so your tests run; swap to the real artifact once it lands. Do NOT build the catalog yourself — that's Spec 11.

## Definition of done (real output required)
- **Contracts package** embodies Spec 13 (types + Zod schemas for validation at the HTTP boundary).
- **Auth**: invite redemption, login, logout, `/api/me`, admin invite creation; httpOnly `sid` session cookie; argon2id/bcrypt hashing; invite single-use; revocation not required for V1 but roles enforced (admin vs member). Edge cases per REQ-AUTH.
- **Deck legality validator** (pure): enforces §2.1 exactly (Main 40–60, Extra 0–15 Fusion+Synchro only, Side 0–15, ≤3/name, banlist caps Forbidden0/Limited1/Semi2 combined across all three, **alias counts as same card** via the alias index, out-of-pool rejected, Ritual→Main / Fusion+Synchro→Extra). Emits `Violation[]` with the fixed `code` set (Spec 13 §3).
- **`.ydk` codec** (pure): import/export per §2.3 (LF/CRLF tolerant, `!side` marker, one passcode/line, `#created by`, round-trip preserves multiset). Malformed/unknown/foreign handled with specific violations, never crash.
- **Deck endpoints**: full CRUD + duplicate + import + export per Spec 13. Server-side validation authoritative.
- **Card endpoints**: `GET /api/cards` (search/filter/paginate) + `/api/cards/:passcode` from the catalog.
- **Persistence**: SQLite per Spec 13 §5, idempotent migrations.
- **Tests (merge WITH the code)**: unit tests for the validator (positive + every negative in AC-05: 39/61 main, 16 extra, 16 side, 3rd semi across zones, forbidden, out-of-pool, Fusion-in-Main, alt-art evasion) and the `.ydk` codec (round-trip AC-06 + illegal/foreign/malformed AC-07). Integration tests hitting the real HTTP endpoints (spin the server, real requests) for auth + deck CRUD + import/export.
- `npm run verify` green (typecheck+lint+arch:check+test). Paste the output.

## Git / push protocol
Commit locally → `npm run verify` (must pass) → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify `git ls-remote origin master` == `git rev-parse HEAD` → report pushed SHA. Only `git add` your owned paths; NEVER `git add -A`/`clean`/`stash`/`checkout --` outside them (other engineers + untracked spike work are live in this working copy).

## Report back
DoD results, the `npm run verify` output, test counts (esp. validator + `.ydk` cases mapped to AC-04..07), the pushed SHA, and any place Spec 13 was ambiguous (flag it, don't silently diverge).
