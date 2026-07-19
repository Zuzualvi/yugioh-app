# PRODUCT LEAD — SESSION HANDOFF (Track C shipped)

_Date: 2026-07-18 · Author: Product Lead (outgoing session) · Audience: next Product Lead session + CEO_
_Read order: this file → `docs/STATUS.md` → team memory `track-c-authoring-log.md` +
`product-lead-handoff.md`. This supersedes the "waiting on CTO / Track C gated" framing in the older PL
handoff for this phase._

---

## TL;DR — where we are
The in-app Edison docs feature (the last V1 gap) is **authored, integrated, and pushed to master.** Parity
was signed off by the CEO; Track C content shipped. The only true blocker to "docs live" is **confirming
CI/deploy** for the content commit — which I could **not** verify from the PL shell (marked UNVERIFIED
below). A tightly-scoped 4-item CTO ticket is embedded in §5 for a fresh CTO session.

## 1. What shipped this session (VERIFIED)
Master history (verified `local == remote`):
- `03cb3c0` — parity sign-off + decision record + STATUS.
- `43d4048` — **Track C content: 24 `/learn` pages** + renderer fix + placeholder-banner removal.
- `ba7c92f` — delivery handoff (`docs/working/2026-07-18-track-c-delivery-handoff.md`) + research brief + STATUS. **← current master HEAD**

Content at `packages/web/src/content/learn/` (behind auth at `/learn`): 5 app how-tos, 5-page Edison primer,
13 rule-differences, 36-entry card reference (`cards.md`). Authored from edisonformat.com + the verified
parity matrix (not the engine); 17 carve-outs shown as "⚠ Known table-difference" callouts.

**Evidence (all VERIFIED locally):**
- Full `npm run verify` GREEN: 859 passed / 183 skipped (skips are WASM-gated accuracy tests — untouched by
  docs work). Deps were installed this session (`npm install`) to run it.
- Manifest builds to 24 pages; **15/15 Quick Answers** targets and **40/40 internal cross-links** resolve
  (checked programmatically against the generated manifest).
- SEGOC Rule #7 corrected to authoritative **Ordering B** (edisonformat.com Rule #7, explicit 4-step list;
  our reference/matrix were already B — the docs draft was wrong and was fixed pre-ship).

## 2. What is UNVERIFIED (the resume trigger)
- **CI + deploy status for `43d4048`.** The PL shell can't read CI or build/run the custom WASM. This commit
  touches app code (`.tsx/.ts/.mjs`), so it WILL trigger the Deploy workflow (not docs-ignored). The Vercel
  step has flaked/cancelled before. **A fresh CTO or a CI check must confirm the run went green** (verify +
  accuracy gate + Vercel READY at app.zuhayr.io + Fly deployed). Docs are not "verified live" until then.

## 3. Decisions recorded this session (team memory `/decisions/`)
- `2026-07-18-parity-sign-off.md` — CEO signed off (107 VP / 17 CO / 3 REC); carve-outs documented not
  fixed; out-of-pool RECONCILE → substitutes in docs; R12 infinite loops → human judge-call.
- `2026-07-18-track-c-integration-approach.md` — why the PL integrated content + made small shell/build
  fixes directly (isolated to `packages/web`, fully testable without WASM) rather than a raw-content handoff.

## 4. Open CEO question (non-blocking; docs already shipped to the leaner reality)
**App-flow divergence.** The shipped duel flow has NO Pre-Duel Room / who-goes-first UI and NO Home "Your
move" async queue, though older design docs describe both. UX wrote the how-tos to the *shipped* reality
(duel "begins right away"; who-goes-first → Rule #1; async explained via the per-move timer). CEO to decide:
update the design docs to match shipped, or build those features (then add doc coverage). PL rec: update the
docs unless the features are wanted. **Not started — awaiting CEO.**

## 5. CTO TICKET (CEO-approved scope — do ONLY these four, then STOP)
For a fresh CTO session. No refactors, no extra polish, no scope-adds. Gate each on `npm run verify` green;
follow `AGENTS.md` git protocol (`pull --rebase --autostash`, push `master`, confirm remote==local, report SHAs).

1. **Confirm CI/deploy** for master @ `43d4048` went green end-to-end (verify + accuracy, Vercel READY, Fly
   deployed). If the Vercel step stalled/cancelled, re-run the deploy. Report run status + SHA.
2. **Remove screenshot placeholders** — 9 lines rendering as visible `_[Screenshot: …]_` italic text in
   `packages/web/src/content/learn/how-to/*.md` (build-a-deck ×2, getting-started ×2, start-or-join-a-duel
   ×3, play-a-turn ×1, reading-the-board ×1). Delete the lines (leave surrounding content), rerun
   `node packages/web/scripts/buildDocsManifest.mjs`, then `npm run verify`.
3. **Fix anchor deep-link scroll** — navigating to a docs URL with a `#hash` (Quick Answers/search, e.g.
   `/learn/rules/primer-how-a-turn-works#who-goes-first`) lands at the top instead of the heading. Headings
   already render `id="<slug>"`. Add a scroll-to-hash effect on the docs article route (`DocArticleScreen`)
   that scrolls to AND moves focus to the target heading on mount/hash-change (focus, for a11y — not just
   scroll). Add a test.
4. **Fix Necroface (passcode 12057781)** — deck-buildable but no Lua script → silently non-functional in a
   duel. Add its script OR make it non-buildable. Audit for other deck-buildable script-less catalog cards
   and list them (fix only Necroface unless trivial). (Related, optional: `build-catalog.mjs` blocklist for
   stray image-id `80604092`.)

**Then stop.** Do not pick up other handoff/backlog items.

## 6. Explicitly V2 / out of scope (do NOT build now)
Card Inspector → card-reference link (G4), filterable card table + per-card routes (G7), `🔗` copy-canonical-
URL (G5), in-duel "why did that happen?" chatbot, event→rule deep-links, engine-hardening to close the 17
carve-outs, screenshots (deferred with the placeholders removed).

## 7. Artifact map
- `docs/STATUS.md` — product rollup (updated: docs shipped).
- `docs/working/2026-07-18-track-c-delivery-handoff.md` — full delivery handoff + acceptance criteria.
- `docs/working/2026-07-18-track-c-RESEARCH.md` — sourcing/provenance (incl. SEGOC resolution).
- `docs/working/2026-07-18-parity-sign-off-and-track-c-kickoff.md` — sign-off + kickoff.
- `/mnt/session/outputs/HANDOFF.md` + `RESEARCH.md` — same, in the delivery channel.
- Staged content + traceability sidecars: `/workspace/product/track-c/` (mirrored to
  `/mnt/session/outputs/track-c/`).
- Team memory: `track-c-authoring-log.md` (full working trail), `/decisions/2026-07-18-*`,
  `research/edison-base-rules-primer-sources.md`.

## 8. Watch-outs
- **Deps aren't installed in a fresh PL shell** — run `npm install` before any `npm run verify` (~7s here).
- **WASM caveat:** accuracy tests auto-skip without the (uncommitted) custom WASM; "local green" ≠ accuracy-
  verified. This session's changes were web-docs only, so it doesn't apply here — but trust CI for anything
  engine-related.
- **Renderer is a minimal custom Markdown subset** (`buildDocsManifest.mjs`): no tables/images/code-fences/
  nested lists. Ordered-list close-tag bug was FIXED this session.
- **Git:** `git push origin master` works on this repo (no claude/-branch 403); always
  `pull --rebase --autostash` first, verify remote==local, report SHA. Note: the working tree may present as
  a detached HEAD — reattach to `master` before pushing.
