# Track C — Research & Sourcing Brief (In-App Edison Docs)

_Date: 2026-07-18 · Author: Product Lead (consolidating Researcher / Product Owner / UX Designer output)_
_Companion to `HANDOFF.md`. Records the research provenance behind the shipped `/learn` content so a
technical reader who was not in this session can trust and re-verify every claim._

## Load-bearing principle
**Authoritative Edison rules == our engine == our docs.** Docs are authored FROM the authority
(edisonformat.com) + the verified parity matrix — NEVER from the engine — so an engine bug can never be
enshrined as a "rule." Every rules claim is traceable to (a) an edisonformat.com source and (b) the
parity-matrix row + the named passing accuracy test that proves the engine matches it.

## Authority & sources (LOCKED)
- **edisonformat.com** is THE authority. Primary pages used:
  - `edison-rule-differences.html` — the 13 rule-differences (frozen numbering #1–13) + Rule #7 SEGOC.
  - `rulebook.html` → the 5D's Official Rulebook **v7.0** (the correct Edison-era edition; 0-ATK was
    overturned later in v7.2) — base Master-Rule-1 mechanics for the primer.
  - `battle-phase.html`, `priority.html`, `summons.html`, `banlist.html` — cross-checks for primer claims.
  - `functional-errata.html` — the 36 functional-errata entries for the card reference.
- Internal inputs: `docs/working/2026-07-17-edison-rules-reference.md` (78 behaviors + base rules + 36
  errata), `docs/working/2026-07-17-parity-matrix.md` (row→status→source→test), the CTO completion report
  (carve-outs + RECONCILE), and the doc IA.

## Key research findings this session
- **Base-rules primer verified with NO source conflicts.** The Researcher checked every base mechanic
  directly against edisonformat.com's hosted rulebook v7.0 + the Edison rule pages; the rulebook, the Edison
  pages, and rules-reference §2 agree throughout. (Framing note: the base rulebook counts a 4-step Battle
  Phase while edisonformat's page enumerates 7 Damage-Step timings — consistent, because the 7 are substeps;
  cross-linked to Rule #8.)
- **SEGOC ordering (Rule #7) — resolved by the authority.** An internal contradiction existed: an earlier
  PL mandate / the placeholder / Quick Answers implied "group by player" (Ordering A), while rules-reference
  §1 + matrix R07-B1 stated "all-mandatory-first" (Ordering B). The named tests exercise only mandatory
  triggers, so evidence didn't settle it. edisonformat.com Rule #7 states an explicit 4-step list →
  **Ordering B: turn-player mandatory → opponent mandatory → turn-player optional → opponent optional.**
  The shipped Rule #7 page uses B; the reference/matrix were already B; the docs draft was corrected. No CEO
  escalation needed (authority unambiguous). The base rulebook v7.0 p.43 gives only the coarse
  "turn player builds first, then opponent" — consistent with B, not contradicting it.
- **Card reference (36 entries) sourced from functional-errata.html + reference §3.** Display passcodes
  re-verified against `edison-card-catalog.json` (all 36 correct by name). Pre-errata alias passcodes kept
  in the traceability sidecar only (not surfaced in-page — a player-facing choice).
- **Mark of the Rose:** its Standby "regain control" effect is CONTINUOUS (silently re-applies), not a
  chain-starting Trigger — the reference's "both triggers start chains" was imprecise; corrected in-page.
- **The 7 passcode corrections don't touch user-facing content.** Those cards are rules-difference example
  cards; the docs name them in prose (no raw passcodes shown), so the corrections stay a data-layer note.

## Traceability artifacts
Per-section sidecars map each claim → matrix row(s) → edisonformat source:
`/workspace/product/track-c/traceability-{differences,primer,cards}.md` (mirrored to
`/mnt/session/outputs/track-c/`). Researcher base-rules sourcing notes:
team memory `research/edison-base-rules-primer-sources.md`.

## Validation performed before ship
- Manifest builds to 24 pages (13 diff + 5 primer + 1 card + 5 how-to).
- 15/15 Quick Answers canonicalIds resolve to real page/anchor targets.
- 40/40 internal `/learn/...` cross-links resolve to real page/anchor URLs.
- Full `npm run verify` (typecheck → lint → arch:check → test) green: 859 passed, 183 skipped (WASM-gated
  accuracy tests, untouched by this docs work).

## Known limits (documented, not hidden)
The 17 carve-outs are real ocgcore-level limits (field-spell zone model, trap-monster reversion, a
face-down-trigger cluster, Gorz-at-S5, Black-Garden ignition priority, infinite loops). Gameplay is correct
at a real table; each is disclosed to the player as a "known table-difference" callout so they know when to
call a judge rather than trust the app.
