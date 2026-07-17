# Yu-Gi-Oh Edison Duel App — Product STATUS

> **Canonical, living "what's built / what's in flight / what's left" doc.** Start here.
> This is the evergreen rollup; it POINTS to the detailed trackers rather than duplicating them.
> Update at each epic close (and when accuracy status changes). Keep claims honest — if something is
> unverified, say so.
>
> _Last updated: 2026-07-17 (Product Lead) — Edison Parity Audit + In-App Docs phase kicked off._

## What this product is

A **private, invite-only Yu-Gi-Oh "Edison format" dueling web app** for a small friend group
(non-commercial, self-hosted, accuracy-first). Edison = March 2010 / Master Rule 1 TCG-era retro
format. Live at **app.zuhayr.io** (Vercel frontend) / **api.zuhayr.io** (Fly backend, ord region).

## Shipped & live

| Area | Status | Notes |
|------|--------|-------|
| Accounts / auth | ✅ Live | Invite-only; admin (`zuzu`) generates single-use invite links; no email. |
| Deck builder | ✅ Live | Full Edison pool (3,681 cards), March-2010 banlist, live legality + copy-cap badges, `.ydk` import/export, My Decks. QA-signed-off. |
| Interactive dueling | ✅ Live | Real Edison duel end-to-end through the UI, desktop + mobile. Server-authoritative custom ocgcore WASM, WS relay + per-seat hidden-info redaction, response-log replay persistence, per-duel forfeit timer (5m–48h), invite-link → duel. All 15 decision-kind panels, chain viz, phase/turn/LP. E2E green in CI (6 tests). |
| Deployment | ✅ Live | CI green; Vercel READY; Fly deployed. |
| **In-app rules/help docs** | ❌ Not built | Was in original V1 scope; no rules/help route exists. **← current phase delivers this.** |

## Engine accuracy status (the "accuracy is sacred" promise)

Core Edison rule-flags locked at `EDISON_FLAGS = 0x7f80d072c` (custom WASM). Empirical validation is
tracked in the **parity matrix** — the single source of truth for accuracy.

- **Parity matrix:** `docs/working/2026-07-17-parity-matrix.md` — 127 acceptance-gate rows.
- **Rollup (2026-07-17):** 5 VERIFIED-PASS · 80 NEEDS-TEST · 4 KNOWN-GAP (R10 LP-cost — patch exists,
  confirm CI) · 2 CARVE-OUT (R12 infinite loops) · 24 NEEDS-AUTHORING (errata) · 6 SUBSTITUTE-WIRED ·
  6 RULES-LEVEL-RULING · + 17 Tier-3 fixtures + 2 engineering data items.
- **Honest read:** the *framework* rules are configured and 5 are proven; the bulk (80 rules behaviors
  + 24 errata cards) are **defined and testable but not yet empirically verified**. Closing this is the
  active phase.

## In flight — Edison Parity Audit + In-App User Docs (started 2026-07-17)

Goal: user-facing in-app docs (app how-tos + Edison rules guides) authoritative enough for
no-engine-assist table play, gated on **verified engine ↔ authoritative-rules parity**.

| Track | Owner | Status |
|-------|-------|--------|
| A — Authoritative rules reference + parity matrix + doc IA | Product Lead's team | ✅ Done |
| B — Engine parity: fill matrix, close gaps, errata scripts+tests, staples spot-check | CTO / eng | ⬜ Handed off 2026-07-17 |
| B4 — In-app `/learn` docs surface | CTO / eng (UX designed) | ⬜ Handed off |
| Convergence — parity sign-off (joint) | Product Lead + CTO | ⬜ Pending B |
| C — Write & ship the docs | Product Lead's team | ⬜ Gated on sign-off |

Handoff: `docs/working/2026-07-17-HANDOFF-parity-audit-and-docs.md`.
Scope decision: team memory `/decisions/2026-07-17-parity-audit-scope.md`.

## Known deferred items / backlog

Engineering work board (detail + SHAs): **`tasks/BOARD.md`**. Notable deferred:

- **Invite/lobby polish** (INVITE-03…09): pre-duel ready-up room, randomized first turn, link
  expiry/revoke, distinct link-error states, Home async "Your move" queue, copy polish, atomic
  seat-claim. All consciously deferred; safe for a trusted small club.
- **HARDEN-ASSETS:** pin CardScripts checkout for reproducibility (folded into the parity phase).
- **Tech-debt:** deprecated WS frame cleanup, `MSG_NAMES` reconcile, effect/chain E2E.

## Explicitly out of scope (V2+)

In-duel "why did that happen?" teaching chatbot (the current docs are its future foundation), native
mobile app, AI opponent, public/SEO docs surface, exhaustive per-card verification.

## Map of the trackers (so nothing is orphaned)

- **This file** — product-wide rollup (start here).
- `tasks/BOARD.md` — engineering work board (streams, slices, SHAs).
- `docs/working/2026-07-17-parity-matrix.md` — accuracy audit / acceptance gate.
- `docs/working/YYYY-MM-DD-*` — dated handoffs, specs, research, reports (audit trail).
- Team memory `/decisions/*` — decision records (the "why").
- Team memory `docs-and-parity-phase.md` — current phase working notes.
