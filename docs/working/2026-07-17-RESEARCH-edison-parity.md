# RESEARCH BRIEF — Edison Parity Audit (scope + authoritative rules reference)

_Date: 2026-07-17 · Author: Product Lead (consolidating Researcher + Product Owner output) · Audience: technical readers not in the planning conversation_

This brief backs the [HANDOFF](2026-07-17-HANDOFF-parity-audit-and-docs.md). It answers: *how much
verification does "parity with authentic Edison" actually require, where do the rules come from, and
how big is the work?* Two deeper artifacts sit behind it:

- `2026-07-17-parity-scope.md` — the scope-depth analysis (rules-level vs card-level, with numbers).
- `2026-07-17-edison-rules-reference.md` — the authoritative rules reference (78 behaviors, base
  scaffolding, the 36-errata table, 17 canonical decklists). This is the "expected behavior" source
  for the parity matrix and the source-of-truth for the user rules docs.

All findings are sourced to **edisonformat.com** (the group's binding authority) and confidence-tagged
in the underlying files.

## The core question, answered

"Parity with a live Edison tournament" means **judge-equivalent enforcement, not a proof of every
card.** At a real table, correctness = the judge applies the core rules correctly + knows which
specific cards use pre-errata text + rules on genuine edge cases. Our engine flags replace the judge's
rules knowledge; a curated pre-errata script set replaces their errata knowledge.

**Key finding that settles the "rules vs cards" debate:** there are only **~36 cards in the entire
~3,681 pool where Edison differs from modern Yu-Gi-Oh** (the published "functional errata" list). Every
other card has *no Edison-specific behavior to audit* — its 2010 text equals its modern text, so it
plays exactly as the shared community engine already runs it (code exercised across millions of
EDOPro/DuelingBook games). So auditing those 36 **is** auditing card-level, completely.

What is genuinely infeasible — and what **no** simulator or the Edison community itself attempts — is
verifying card **interactions**: C(3681,2) = 6,773,040 pairs, C(3681,3) ≈ 8.31 billion triples, more
for real chains + board state. The community's accepted definition of "Edison-accurate" is therefore:
**correct core rules + pre-errata text on the ~36 known cards + a human judge for the rare tail**
(DuelingBook, a *manual* sim with human judges, is the community's accuracy gold standard).

## What the rules layer is (and how big)

- **Source of record:** `edisonformat.com/edison-rule-differences.html` publishes **exactly 13 numbered
  rule-differences** from modern YGO; `edisonformat.com/rulebook.html` is the Master-Rule-1 base.
- The 13 are *deltas*, not the full surface. Unpacked to individually-testable behaviors they expand to
  **78 discrete behaviors** — because several nest deeply: Rule #8 Damage Step = 9 activation-legality
  rules + 7 substeps (16); Rule #5 Trap Monsters = 16 interactions; Rule #6 Ignition Priority = 7;
  Rule #7 SEGOC = 4-step ordering.
- Engine mapping: `EDISON_FLAGS = MODE_GOAT | 0x400000000n = 0x7f80d072c` on a custom-built ocgcore
  WASM. 5 core behaviors already pass automated tests (first-turn draw, single field spell, MZone +
  GY ignition priority, 0-ATK battle).
- **Two soft spots:** Rule #10 (LP-cost) — a known gap that a patch + tests may already close (confirm
  in CI); Rule #12 (infinite loops) — likely a human-judge call the engine won't enforce (spike to
  confirm, then document as a carve-out).

## The card layer (the 36)

Full table with passcodes + Edison-vs-modern behavior in the rules reference §3. Composition:
**6 already substitute-wired** (Brionac, Sangan, Rescue Cat, Goyo, Brain Control, Future Fusion),
**6 are actually rules-level rulings** (3 damage-step rulings + 3 archetype reps: Lightsworn / Union /
Spirit — cross-linked to R-rules, not scripts), **~24 need script authoring/verification** (note:
REDMD's existing repo script is wrong — still once-per-name — and must be edited to per-copy). Canonical
failure mode: a modern "once per turn" clause that didn't exist in 2010 (e.g. Brionac).

## Sizing / audit output

The Product Owner converted the reference into a **parity matrix** (`2026-07-17-parity-matrix.md`) —
the audit instrument and acceptance gate. Rollup at handoff: **127 acceptance-gate rows** — 5
VERIFIED-PASS, 80 NEEDS-TEST, 4 KNOWN-GAP (LP-cost, possibly already fixed), 2 CARVE-OUT (infinite
loops), 24 NEEDS-AUTHORING (errata), 6 SUBSTITUTE-WIRED, 6 RULES-LEVEL-RULING — plus 17 Tier-3 fixtures
and 2 tracked engineering data items.

## Primary sources

- Rule differences (13): https://www.edisonformat.com/edison-rule-differences.html
- Functional errata (36): https://www.edisonformat.com/functional-errata.html
- MR1 rulebook / rules index: https://www.edisonformat.com/rulebook.html · https://www.edisonformat.com/rules.html
- Simulator accuracy table (community bar): https://edisonformat.net/beginners/simulators
- Representative decklists: edisonformat.com deck index (DuelingBook IDs), formatlibrary.com, ygoprodeck top-10
