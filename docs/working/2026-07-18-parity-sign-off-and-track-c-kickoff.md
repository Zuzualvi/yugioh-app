# Parity Sign-Off + Track C Kickoff

_Date: 2026-07-18 · Author: Product Lead · Audience: CEO + CTO/next thread · Status: sign-off recorded; Track C authoring in progress_

## 1. Parity sign-off (CEO-confirmed)
The CEO reviewed the CTO completion report + parity matrix and **signed off on the Edison
engine↔authoritative-rules parity audit**. This is the accuracy gate that unblocks Track C (authoring the
in-app `/learn` docs). Decision record: team memory `/decisions/2026-07-18-parity-sign-off.md`.

**Final rollup accepted** (127 acceptance-gate rows, 100% populated, QA-verified on a clean checkout):

| Status | Count | Meaning |
|--------|------:|---------|
| VERIFIED-PASS | 107 | A passing automated accuracy test asserts the Edison behavior. |
| CARVE-OUT | 17 | Engine cannot match the ruling; accepted as a DOCUMENTED "known table-difference." |
| RECONCILE | 3 | Reference example card out-of-pool; the RULE is verified via sibling rows. |

Plus §4 = 17 Tier-3 staple fixtures PASS; §5 = 2 eng-items RESOLVED. `npm run verify` green (1038 tests);
the CI accuracy gate now runs the full parity suite (`1e6a239`).

**Honest read:** 107 of 127 behaviors are proven by a passing test. The 17 carve-outs are structural
ocgcore limits — real-duel gameplay is correct; every one is disclosed to the player in the rules guide.

## 2. CEO decisions (the three calls)
1. **Sign off on the audit** as-is (vs. push engine to close more gaps first). Rationale: 107/127 covers all
   real gameplay; carve-outs are honest, rare, and match every Edison simulator.
2. **17 carve-outs → document permanently now** as visible callouts; deeper engine-hardening is **V2 backlog,
   non-blocking**. Includes the **R12 infinite-loops verdict** — spike-confirmed ocgcore does not enforce
   voluntary-loop illegality (like every Edison sim) → documented as a human judge-call.
3. **3 out-of-pool RECONCILE cards** (Necroface / Aslla Piscu / Peten + Red-Eyes Wyvern) → **accept
   substitutes in the docs** (rule already verified via sibling cards).

## 3. Product Lead in-lane fixes (applied during authoring, no CEO call)
- **7 passcode corrections** (CTO report §4A): Secret Village 68462976 · Geartown 37694547 · Monster
  Reincarnation 74848038 · Degenerate Circuit 36995273 · Embodiment of Apophis 28649820 · Metal Reflect
  Slime 26905245 · Fake Trap 3027001.
- **Mark of the Rose** (§4C): Standby "regain control" is CONTINUOUS (silently re-applies), not a
  chain-starting Trigger.

## 4. Track C kickoff — authoring the `/learn` content
Content is authored FROM the authority (edisonformat.com) + the rules reference, NOT the engine. Every claim
is traced to (a) an edisonformat source + (b) the parity-matrix row + named test. Four parallel workstreams,
each owning disjoint files, staged in `/workspace/product/track-c/content/learn/`:

| Workstream | Owner | Output |
|-----------|-------|--------|
| The 13 rule-differences (rules.diff.01–13) | Product Owner | `rules/difference-01..13.md` + carve-out callouts + traceability |
| Base-rules primer (5 pages) | Researcher | `rules/primer-*.md` + traceability |
| Cards that play differently (36 entries, one page) | Product Owner | `rules/cards.md` + traceability |
| App how-to guides (5 pages) + shell reconciliation | UX Designer | `how-to/*.md` + shell-gap note |

Authored against the shipped shell's real constraints: a **minimal Markdown renderer** (no tables/images/
code-fences/nested-lists) and **no card-index route** yet. Carve-outs render as `> **⚠ Known
table-difference —** …` blockquote callouts. The 13 rule-numbers are frozen to edisonformat #1–13.

## 5. Known shell gap (for the CTO handoff, non-blocking)
The IA envisioned a filterable card-reference table at `/learn/rules/cards` with per-card routes; the shipped
shell has neither (no table support; the LeftNav link `/learn/rules/cards` has no server). Track C authors the
card reference as a **single page** (slug `cards`, id `rules.card.reference`) that resolves at
`/learn/rules/cards` via the existing `/learn/rules/:slug` route — zero shell change. A filterable table is
V2-polish. The UX reconciliation note enumerates any other gaps.

## 6. Playability follow-ups routed to CTO (non-blocking)
- **Necroface (12057781)** deck-buildable but script-less → add script or make non-buildable; audit for other
  script-less catalog cards.
- `build-catalog.mjs` blocklist for stray image-id `80604092`.
- Optional cosmetic re-deploy of the cancelled `1e6a239` Vercel frontend step (prod healthy).

## Next
On Track C completion: I consolidate, finalize Quick Answers against the real anchors, validate the manifest
build, and produce the engineering handoff (`/mnt/session/outputs/HANDOFF.md` + `RESEARCH.md`) routing the
content into `packages/web/src/content/learn/` + the shell-gap items to the CTO.
