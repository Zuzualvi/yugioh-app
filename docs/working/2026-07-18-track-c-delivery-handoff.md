# Track C — In-App Edison Docs: Delivery Handoff

_Date: 2026-07-18 · Author: Product Lead · Audience: CTO / next engineering thread + CEO_
_Status: **content SHIPPED** to `origin/master` @ `43d4048` (full `npm run verify` green locally). This doc
records what shipped, what's left (residual polish for the CTO), and the acceptance criteria._

---

## Problem & users
The app enforces Edison correctly but had **no in-app rules/help surface** (the one V1 item never shipped).
Users (a closed 6-friend club) need to (J1) get a rule answer at a physical table in ≤2 taps with no engine
assist, (J2) learn Edison from scratch, (J3) learn the app, and (J4) look up how a specific card plays in
Edison. This phase ships that surface at `/learn`, gated on a verified engine↔authoritative-rules parity
audit so the docs are trustworthy for no-engine table play.

## Decisions made (CEO-confirmed)
- **Parity signed off** (107 VERIFIED-PASS / 17 CARVE-OUT / 3 RECONCILE). Record:
  `/decisions/2026-07-18-parity-sign-off.md`.
- **17 carve-outs documented, not fixed** (deeper engine-hardening is V2 backlog). Surfaced in-page as
  "⚠ Known table-difference" callouts.
- **R12 infinite loops = human judge-call** (authority-confirmed; engine doesn't enforce, like every Edison
  sim). Documented as such on Rule #12.
- **3 out-of-pool RECONCILE cards → substitutes accepted in docs**; rules taught via canonical examples
  balanced with in-pool demonstrations (no "the app demonstrates this exact card" claims).
- **SEGOC ordering (Rule #7): Ordering B** — TP-mandatory → opponent-mandatory → TP-optional →
  opponent-optional. Authority-resolved (edisonformat.com Rule #7, explicit 4-step list). Our
  rules-reference §1 + matrix were already B; the docs draft (and an earlier PL mandate) were wrong and were
  corrected before ship. Provenance in RESEARCH.md.

## What shipped (requirements met)
All content lives in `packages/web/src/content/learn/` and renders through the existing B4 shell.
- **MUST — 24 content pages authored from the authority, not the engine:**
  - 5 app how-tos (`how-to/*.md`): getting-started, build-a-deck, start-or-join-a-duel, play-a-turn,
    reading-the-board. Grounded in the live app; cross-link into the rules primer.
  - 5-page base-rules primer (`rules/primer-*.md`): turn structure, summoning, chains & spell speed, battle
    phase, deck building. Verified against edisonformat.com rulebook v7.0.
  - 13 rule-differences (`rules/difference-01..13.md`), frozen to edisonformat #1–13, `ruleNumber` set.
  - Cards That Play Differently (`rules/cards.md`, id `rules.card.reference`, slug `cards`): 36 entries
    (33 cards + 3 archetype groups), each an anchored section; resolves at `/learn/rules/cards`.
- **MUST — carve-outs disclosed:** "⚠ Known table-difference" callouts on Rules #2, #5, #6, #8, #12 and on
  the card entries Black Garden / Light End Dragon / Fortune Lady Light. (R04 Lightsworn mill is NOT
  disclosed — it's verified working in real duels; harness-observability only.)
- **MUST — data corrections applied:** Mark-of-the-Rose wording (Standby regain = continuous, not
  chain-starting). The 7 passcode corrections were confirmed to NOT affect user-facing content (prose uses
  card names; no raw passcodes shown) — they remain a matrix/data-layer note only.
- **MUST — Quick Answers** (`quickAnswers.ts`): 15 curated Q→anchor entries, every target verified to
  resolve against the generated manifest.
- **SHOULD — traceability:** each rules claim traced to (a) an edisonformat source and (b) the parity-matrix
  row + named test. Sidecars: `/workspace/product/track-c/traceability-*.md` (+ mirrored to outputs).

### Engine/renderer fixes made to ship the content
- **Renderer bug fixed** (`buildDocsManifest.mjs`): `flushList()` hard-coded `</ul>`, so any `1.` ordered
  list opened `<ol>` but never closed → everything after nested inside it. Now tracks list type and closes
  the matching tag (also switches ol↔ul cleanly). This already affected the shipped placeholder pages.
- **Removed the unconditional "Placeholder content — do not cite" banner** in `DocArticleScreen.tsx` (it
  rendered on every article) and dropped its test.
- **Stripped the duplicate body `# Title {#top}` H1** from all pages (the shell renders the styled title).
- **Fixed the cards nav active-state** id check (`rules.card.reference`).

## UX flows & screens
Unchanged from the shipped B4 shell and the IA (`docs/working/2026-07-17-docs-information-architecture.md`).
`/learn` landing (Quick Answers + search + section indexes), rules/how-to article shell (breadcrumb, rule
badge, TL;DR, on-this-page TOC, anchored headings, prev/next), single card-reference page, duel-screen "?"
slide-in. All behind `RequireAuth`.

## Residual engineering items (for the CTO — NONE block the shipped docs)
Prioritized from the UX shell-reconciliation note (`/workspace/product/track-c/howto-and-shell-reconciliation.md`):
1. **Confirm CI + deploy went green** for `43d4048` (the prior `1e6a239` Vercel step flaked/cancelled; prod
   was unaffected then). This commit touches app code, so it WILL trigger a deploy — verify it lands.
2. **Necroface (12057781)** is deck-buildable but has NO Lua script → would silently not function in a live
   duel. Add a script or make it non-buildable; audit for other script-less catalog cards. (Also
   `build-catalog.mjs` needs a blocklist for stray image-id `80604092`.)
3. **V2-polish (deferred, non-blocking):** G3 deep-link focus/scroll + `:target` highlight on hash landings;
   G4 Card Inspector "How this card plays in Edison ›" link → `rules.card.reference#<anchor>`; G5 `🔗`
   copies the canonical URL (currently just navigates); G7 filterable card table + per-card routes (the
   single card page is accepted for J4). The orphaned `.docs-placeholder-notice` CSS class can be removed.

## Out of scope (V2+)
In-duel "why did that happen?" chatbot (the anchored manifest is its foundation), event→rule deep-links,
public/SEO docs, native app, exhaustive per-card verification, engine-hardening to close the 17 carve-outs.

## Open questions (non-blocking) — for the CEO
1. **App-flow divergence:** the shipped duel flow has NO Pre-Duel Room / who-goes-first UI and NO Home "Your
   move" async queue (the older design docs describe both). UX wrote the how-tos to the *shipped* reality
   (duel "begins right away"; who-goes-first → Rule #1; async explained via the per-move timer). Are those
   features still planned (add coverage when they ship) or should the design docs be updated to the leaner
   shipped flow?
2. Screenshots for how-to pages are text placeholders (`_[Screenshot: …]_`) — capture + add later, or leave.

## Acceptance criteria
- **AC-4 (content renders) — MET.** 24 real pages build to the manifest (24 entries); `/learn`, article
  shell, Quick Answers, and client search all work; full `verify` green (859 passed / 183 skipped-WASM).
- **AC-5 (traceability) — MET.** Every rules-guide claim traced to edisonformat source + a named passing
  test (traceability sidecars); 15/15 Quick Answers targets and 40/40 internal cross-links resolve.
- **AC-6 (parity sign-off recorded) — MET.** `/decisions/2026-07-18-parity-sign-off.md` + STATUS updated.
- **Track C success bar — MET.** A group member can read the primer + 13 differences + card reference and
  play Edison at a physical table with no engine, with every engine limitation disclosed as a callout.
