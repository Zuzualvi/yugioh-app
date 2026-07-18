# CTO Follow-ups — Track C close-out (2026-07-18)

Author: CTO thread · Audience: CEO
Scope: the four requested items only. No other backlog/handoff items were picked up.

Master HEAD after this work: **`dcf20dc`** (remote == local VERIFIED).
Pushed commits:
- `5bc1f76` — fix(learn): remove screenshot placeholders + deep-link hash scroll/focus in DocArticleScreen
- `dcf20dc` — docs: audit deck-buildable catalog cards for missing Lua scripts

Independent QA gate (clean `git clone` → `npm ci` → `npm run verify`): **GREEN**
(typecheck · lint · arch:check · actionlint · test = 861 passed / 183 skipped-WASM, exit 0).

---

## 1. CI / deploy confirmation — ✅ GREEN (after re-run)

**Finding:** the Deploy run for `43d4048` was NOT green end-to-end. verify + accuracy + Fly(backend)
passed and Fly deployed, but the **Vercel step was CANCELLED** (`##[error]The operation was
canceled` — the known flake). That production deployment is `BLOCKED` in Vercel, so the Track C docs
shipped in `43d4048` were **never actually live**. (`deploy.yml` ignores `docs/**` + `**/*.md`, so
the docs-only `ba7c92f` did not re-trigger a deploy.)

**Re-run:** the items 2–4 push (`dcf20dc`, which touches `generated/articles.json` +
`DocArticleScreen.tsx` — not path-ignored) re-triggered the full Deploy workflow. Verified via the
Vercel API + live domain:
- Vercel: deployment `dpl_6HuCS3az` (`yugioh-7s6hkteh9…`) — **READY**, `target=production`,
  `githubCommitSha=dcf20dc`, author **Zuhayr Alvi** (passes the team-access deploy gate).
- Fly (backend): **DEPLOYED**, health check passing.
- `https://app.zuhayr.io` → **HTTP 200**, SPA shell (`id="root"`, `<title>Edison Duel</title>`).
- Both deploy jobs are gated on `needs: [verify, accuracy]`, so verify + the full Edison parity
  accuracy gate **passed** for `dcf20dc`.

Net: production is live and green at `dcf20dc`; the Track C docs (plus these two fixes) are now
actually serving.

## 2. Remove screenshot placeholders — ✅ DONE

Deleted the 9 `_[Screenshot: …]_` lines across `packages/web/src/content/learn/how-to/*.md`
(start-or-join-a-duel ×3, build-a-deck ×2, getting-started ×2, play-a-turn ×1, reading-the-board ×1),
regenerated the docs manifest (`node packages/web/scripts/buildDocsManifest.mjs`).
- `grep "\[Screenshot"` over the how-to sources AND the regenerated `generated/` output → **no
  matches**.
- Manifest entry count unchanged at **24** (only article-body HTML changed; `docsManifest.json`
  structure identical).

## 3. Anchor deep-link scroll — ✅ DONE

Added a scroll-to-hash effect in `DocArticleScreen.tsx` (`ArticleView`): on mount and on hash change
it reads `useLocation().hash`, resolves the target heading by id, scrolls it into view (jsdom-guarded)
and **moves focus** to it (`tabindex=-1` then `focus({preventScroll:true})`) — so screen-reader users
land on the heading, not just a visual scroll. Additive only; no other markup/behavior changed.
Tests added to `DocArticleScreen.test.ts` (deep-link hash scroll: focuses + scrolls with a hash;
does not move focus without one) — pass; full web suite green.

## 4. Necroface — ⚠️ premise was a passcode error; no fix warranted (+ broader audit)

**The item was based on a transcription error.** Verified against the catalog and the pinned
CardScripts commit (`105d350…`):
- Passcode **`12057781` = "Goblin Calligrapher"** — a **vanilla `normal` monster** that correctly
  needs no Lua script and functions fine. Making it non-buildable would have deleted a legit playable
  card.
- The real **Necroface = `28297833`** (Effect monster) — its official script `c28297833.lua`
  **exists** in the pinned CardScripts and resolves via the engine's loader → **already playable**.

So neither card is broken; no change was made to either.

**Full asset-backed audit (requested "audit for others").** Fetched CardScripts and checked every
deck-buildable catalog card that needs a script (frame ≠ `normal`): 3,681 total, 3,273 need a script,
3,251 resolve directly, **22 do not resolve by their catalog passcode**:
- **Group A — 14 alt-art alias staples** (incl. **Monster Reborn**, **Harpie's Feather Duster**,
  Spellbinding Circle, Metalmorph, Barrel Dragon, Mystic Tomato, …). Their catalog passcode is the
  alt-art alias `N`; the real card + script live at base `N−1`. cards.cdb contains both (`N → alias
  N−1`), which is the **same mechanism every alt-art card uses**, and ocgcore resolves it to the base
  script. These very likely function in duels (they're the most-played Edison staples and the app has
  had live smoke play). Caveat: our passing accuracy tests reference the **base** passcode, so the
  catalog's alias-code path is technically **untested** — a targeted duel smoke test would confirm.
- **Group B — 8 promo/prize cards** (Get Your Game On!, Ulevo, and six `501000xxx` championship
  prizes) with **no script anywhere** in CardScripts. These would be non-functional if built.

**Decision:** out of scope for this task ("fix only Necroface unless trivial"; the real Necroface
needs no fix, and the Group A/B fixes are neither trivial nor risk-free). Recommended as a small
dedicated follow-up if you want it: (a) a duel smoke test on the 14 Group A cards; if any fail,
normalize the catalog to canonical base passcodes (or add the 14 cdb-alias bridges); (b) decide
whether the 8 promo cards should be scripted or made non-buildable. Full list:
`docs/working/2026-07-18-buildable-cards-script-audit.md`.

---

## Audit trail
- Product repo (system of record): `dcf20dc` on `origin/master` (this report + the script audit doc
  committed under `docs/working/`).
- Outputs: `REPORT.md` + `2026-07-18-buildable-cards-script-audit.md` in `/mnt/session/outputs/`.
