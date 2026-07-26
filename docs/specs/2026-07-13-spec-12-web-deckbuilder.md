# Spec 12 — Web App Shell + Deck Builder UI (Slice 1+2)

**Owner role:** Frontend Engineer. **Status:** ready (Phase 2, Slice 1+2). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Goal
Build the browser UI for accounts + deck building: login, an authenticated home/lobby shell, and the full deck builder + "My Decks". Responsive and tap-first (the requirements' cross-cutting UX rules). No duel field yet (Slice 3).

## Read first
- `/workspace/specs/13-contracts-and-api.md` — the LOCKED API + `CardDTO`/`Deck` types. Import types from `@yugioh-app/contracts`; call the endpoints exactly as specified. If `@yugioh-app/contracts` isn't published yet when you start, define a thin local type shim matching Spec 13 and switch to the package import once it lands (it will — Spec 10 owns it).
- `docs/working/2026-07-13-v1-requirements.md` — §6 REQ-DECK (builder behavior), §13 REQ-UX (responsive/tap/accessibility — these are MUSTs), §2.1 (deck rules), §2.3 (`.ydk`).
- `docs/working/2026-07-13-v1-ux-flows.md` — the UX screens/wireframes: Login, Home/Lobby, Deck Builder (desktop + mobile), My Decks, Card Inspector. Build to these.

## Exclusive file ownership
Create/edit ONLY under `packages/web/**`. Do NOT touch other packages, root config, docs, specs, or spikes. (The foundation already scaffolded `packages/web` as a Vite+React+TS stub — build on it.)

## What to build (screens)
- **Login** — enter via invite (redeem: displayName + password) or login; no public signup UI. On success, land on Home.
- **Home / lobby shell** — the three primary actions (Duel a friend [stub/disabled-with-"coming soon" is fine this slice], **Build a deck**, **Rules & rulings** [may be a stub link this slice]); shows current user; logout. (The "Your move" queue + challenge flow are Slice 3 — leave clear seams, don't build.)
- **Deck Builder** (the core of this slice):
  - Search (name) + filters matching the API (`frame`, `race`, `attribute`, `level`, atk/def range, effect text, banlist), Edison pool only, paginated (`GET /api/cards`).
  - Three zones (Main/Extra/Side) with **live per-zone counts** and a **validity indicator** reflecting §2.1 in real time; Extra accepts only Fusion/Synchro, Ritual routes to Main.
  - **Legality badges** on every card (Forbidden/Limited/Semi/unrestricted) pairing **colour + icon/label** (never colour alone — REQ-UX-06). Prevent adding beyond the allowed copy count (silent — no explanatory tooltip needed in V1).
  - **Card Inspector**: tap art / long-press opens full legible text+stats+art; inspecting is separate from acting (REQ-UX-04). Shared component reused across the app.
  - Save (POST/PUT `/api/decks`) — the server validation result drives the validity display; an invalid deck saves as an explicitly-marked invalid draft (not duel-selectable later).
  - **`.ydk` import/export** via the API (`/api/decks/import`, `/api/decks/export`); import shows a specific per-line/per-card report on problems (never a silent drop).
- **My Decks** — list/open/rename/duplicate/delete own decks.

## UX rules (MUSTs — QA will check)
- One responsive layout: phone-portrait → tablet → desktop (REQ-UX-01). On phone, the builder must be usable without zoom-to-act.
- **Every action completable by tap; drag never required** (drag MAY be a desktop accelerator) (REQ-UX-02).
- Touch targets ≥44px, body text ≥16px, respect OS text scaling (REQ-UX-05). Meaning never by colour alone (REQ-UX-06). Ship a legible dark theme (REQ-UX-08 SHOULD). Reduced-motion setting (REQ-UX-07 SHOULD).

## Verification (EXPECTED, not optional — this is frontend)
Run the app against the real backend if available, else a mock of the Spec-13 endpoints. Use Playwright: assert the DOM for the key flows (login → build a deck → add/remove cards with live counts + badges → save → import a `.ydk` → see a validation report), save screenshots to `/mnt/session/outputs/` (e.g. `web-deckbuilder-desktop.png`, `web-deckbuilder-mobile-375.png`, `web-login.png`), and confirm the 375px-wide mobile builder is usable by tap. Component/unit tests for the legality-count logic and the inspector. `npm run verify` green.

## Git / push protocol
Commit locally → `npm run verify` (pass) → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD → report pushed SHA. Only `git add` under `packages/web/`; NEVER `git add -A`/`clean`/`stash`/`checkout --` outside it (other engineers + untracked spikes are live here).

## Report back
Which screens are done, the Playwright assertions that pass, the screenshot paths (save them to /mnt/session/outputs/), the `npm run verify` output, the pushed SHA, and any API mismatch vs Spec 13 you hit (flag it — do not silently diverge; if the backend isn't up yet, say what you mocked).
