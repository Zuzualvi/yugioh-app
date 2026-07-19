# SESSION HANDOFF #1 — Product Lead conversation (Yu-Gi-Oh Edison app)

**Date:** 2026-07-13 · **Reason:** context ~327K, rotating to a fresh session.

> **⚠ Repo status when this doc was written:** the remote had already advanced FAR beyond this discovery session. `origin/master` was at **`617198e` ("deck builder go-live checkpoint")** — a full monorepo (`packages/{engine,server,web,contracts,card-data}`), completed **spikes A–E**, extensive tests, and ~5 days of build work (commits through **2026-07-18**), plus many newer session-handoff docs. **This document is a historical checkpoint of the ORIGINAL product-discovery session** (which produced the engineering handoff at commit `d22756d`, now an ancestor of the current remote). **For CURRENT state, read the latest handoffs (e.g. `docs/working/2026-07-18-*`) and `docs/STATUS.md` — not this file.** This commit is purely additive (adds only this file) and is rebased onto the current remote.

**Role to resume:** Product Lead orchestrating for a product-minded CEO. CEO sets product direction and makes the product calls; you orchestrate/consolidate/execute. Team roster (spawn via `create_agent`, exact names incl. suffix): **`Researcher [yugioh-app]`** (web access), **`Product Owner [yugioh-app]`**, **`UX Designer [yugioh-app]`**. Spawn multiple of a type in parallel with disjoint output files. **There is NO CTO agent** in the roster — the build is picked up externally; the CEO routes the handoff.

## STATUS: V1 discovery/spec COMPLETE and HANDED OFF (CEO greenlit).
There is **no open work in flight.** Do NOT start new work; wait for the CEO. The engineering handoff package is delivered.

- **Product repo:** github.com/Zuzualvi/yugioh-app. All deliverables under `docs/working/`.
- **This discovery session's final engineering-handoff commit:** `d22756d` (now an ancestor of the far-newer remote HEAD; the build team continued from there). This doc is rebased on top of the current `origin/master`.
- **Delivery channel mirror:** `/mnt/session/outputs/` has HANDOFF.md, INDEX.md, RESEARCH.md, DECISIONS.md, v1-requirements.md, v1-ux-flows.md, and 6 research files.
- **Entry point for anyone new:** `docs/working/2026-07-13-INDEX.md` → `2026-07-13-HANDOFF.md`.

## The product (one paragraph)
Browser-based, responsive, **rules-ENFORCING** Yu-Gi-Oh duel simulator + deck builder for a **private group of friends**, scoped to the retro **Edison format**. Reuse the community engine (don't hand-write rules); build a modern UI. Accuracy is the founder's #1 value. Remote 1v1, sync or async.

## CEO-confirmed decisions (records in team memory `/decisions/2026-07-13-*.md`)
1. **Reuse `ocgcore` (edo9300 fork) + ProjectIgnis CardScripts + cards.cdb; accept AGPL-3.0; private/self-hosted.**
2. **Edison pool = follow edisonformat.net EXACTLY** — frozen allow-list = their `EdisonCards.json` (~3,681 cards); through Duelist Pack: Kaiba; TSHD+ excluded; March 2010 banlist (43 F / 70 L / 19 S); **27-card Duel Terminal 1 carve-out (NOT "Hidden Arsenal" — that was shorthand; all HA1 legal)**.
3. **V1 enforces rules but does NOT explain illegality** (the "why greyed out?" tooltip + reason-mapping + chatbot = V2). KEEP in V1: legal-action surfacing, priority/quick-effect response windows, chain viz, deck legality badges.
4. **Architecture (native-server vs WASM) + image hosting = CTO's call** (not pre-decided; tradeoffs in engine-landscape research).
5. **Per-duel auto-forfeit timer + async multi-day play.** Inviter sets a per-move timer (presets 5m/15m/1h/12h/24h/48h; **48h hard ceiling, no unlimited**; bounded custom). Per-move deadline, server-authoritative, runs through disconnects, expiry=timeout loss. Async duels are durable/resumable. **Notifications LIGHT in V1** (no push/email; in-app "Your move" queue + out-of-band texting); formal notifications = V2. Single games only (no Bo3).

## Key resolved facts (evidence in the research files; verified)
- **Engine CAN do accurate Edison** (R1 resolved, engine source cited): set `duelFlags` on `OCG_CreateDuel` server-authoritatively (banlist file sets pool NOT rules). Ignition priority (`DUEL_TCG_FAST_EFFECT_IGNITION`), first-turn draw (`DUEL_1ST_TURN_DRAW`), single field spell (`DUEL_1_FACEUP_FIELD`) = out of the box; damage step = compose GOAT-family flags + validate. Use edo9300 fork (MIT core lacks flags).
- **Residual accuracy work = pre-errata card curation** (36 functional-errata cards; scripts ship modern errata). 6 have ready community substitutes, 6 more have unused correct scripts, ~20 to audit/author. **Biggest gap: Red-Eyes Darkness Metal Dragon** (shipped pre-errata script still enforces once-per-NAME — must author). `pre-errata/` folder is NOT uniformly Edison-correct — inspect each. Sources: `ThaSMorato/alt-formarts-lflists` (pool whitelist), `diamonddudetcg` `Edison` git tag (errata substitutions).
- Era rules for QA: first player draws T1 but **no Battle Phase T1**; side deck 0–15; winner of toss chooses play/draw.

## Requirements & UX (delivered)
- Requirements: **113** (91 MUST / 19 SHOULD / 3 COULD), edge cases, **AC-01..22**. Areas incl. new **REQ-TIMER** (11). File: `2026-07-13-v1-requirements.md`.
- UX: **13 screens**, desktop+mobile wireframes, flow map, timer picker + on-field countdown + "Your move" queue. File: `2026-07-13-v1-ux-flows.md`.

## Open items (NONE block; do not act unless CEO asks)
- **Minor product nicety:** default timer preset the picker lands on (engineering can pick, e.g. 24h). Not escalated.
- **Engineering spikes (UNVERIFIED until build; CTO's, not product):** Spike A (validate Edison `duelFlags` vs 2010 rulings — the damage-step subset carries residual uncertainty; GOAT-2005 flags may differ from Edison-2010 micro-rulings); Spike B (pool + pre-errata build); Spike C (2-client hidden-info redaction); **Spike D / R11** (async durability: in-progress duel must survive server restart + days offline — recommend deterministic response-log replay, NOT memory-only); **R12** (timeout-race precision at the deadline).
- **Likely next ask:** support if a CTO spike challenges an assumption (most likely Spike A or R11) → spin the relevant specialist to run it down + update the spec + re-push.

## Operational notes for the next session
- **Delivery DoD (team norm, `/protocols/delivery-definition-of-done.md`):** a deliverable is done only when **pushed AND verified on the remote**. Commit → `git push -u origin master` → confirm `git ls-remote origin` SHA == local HEAD → report the pushed SHA. Push to `master` works here (no 403 seen); commits are ssh-signed via the configured helper — don't disable signing.
- **Commit every CEO-facing deliverable** to `docs/working/YYYY-MM-DD-<name>.md` (audit trail) and mirror to `/mnt/session/outputs/`.
- **Team memory** `/mnt/memory/yugioh-app-team-memory/`: running project state in **`yugioh-edison-app-project.md`** (read this first — it has the full chronology), decision records in `decisions/`, verified domain facts in `domain/edison-format.md`, lessons/standards/protocols dirs. Memory is network FUSE (~100-200ms, 100KiB/file cap).
- Sandbox has full dev loop (Postgres, Playwright, Docker) per `standards/sandbox-capabilities.md` — relevant if build work ever lands here.
