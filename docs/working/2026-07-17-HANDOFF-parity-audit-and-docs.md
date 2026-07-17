# HANDOFF — Edison Parity Audit + In-App User Documentation

_Date: 2026-07-17 · Author: Product Lead · Audience: CTO + engineering (Track B), and the Product Lead's own content track (Track C)_

> This is the engineering handoff for a new phase. It is self-contained: a technical reader who was
> not in the planning conversation should be able to build from it. Supporting artifacts are in the
> repo under `docs/working/2026-07-17-*` and in `/workspace/product/`.

---

## Start here (read order + engineering context)

Picking this up cold? Read in this order, then work from the parity matrix:

1. **`AGENTS.md`** (repo root) — the durable engineering rulebook: dependency direction
   (contracts ← engine ← server; web imports contracts only), one-operation-per-file, the
   `npm run verify` gate, and the git/push protocol (`git pull --rebase --autostash origin master` →
   `git push origin master` → verify `local HEAD == remote` → report the SHA) + the pre-commit prettier hook.
2. **`docs/STATUS.md`** — product-wide state: what's live, the accuracy rollup, and a map of every tracker.
3. **This handoff** — the phase (what / why / scope / requirements / acceptance / how to report back).
4. **`docs/working/2026-07-17-parity-matrix.md`** — your working tracker. Its header documents the test
   harness, `EDISON_FLAGS = 0x7f80d072c`, and where the accuracy tests live.
5. **`packages/engine/README.md`** + **`packages/engine/scripts/build-wasm.sh`** — how the custom
   ocgcore WASM is built.

**Environment / gotchas that will bite otherwise:**
- **The custom WASM is NOT committed** (gitignored `packages/engine/vendor/`). Build it with
  `build-wasm.sh` (emsdk ~290 MB) or rely on CI. **The Edison accuracy tests auto-SKIP when the WASM is
  absent** — a local "green" without the artifact is NOT a verified pass. The CI **`accuracy` job**
  (`.github/workflows/ci.yml`) builds the WASM (cached) and runs `edisonRules.accuracy.test.ts`; its
  name still says "Rules 1–6" — **this phase expands that suite to the full matrix, so update the job + name.**
- **CI status visibility:** the sandbox git credential cannot read the GitHub Actions API — confirm CI
  is green via the CEO or by curling the live endpoints, not via `gh` / the Actions tab from the shell.
- **Team memory** (`/mnt/memory/yugioh-app-team-memory/`) holds decision records and hard-won engine
  breadcrumbs worth reading: `decisions/2026-07-17-parity-audit-scope.md` (this phase's scope, also
  inlined below) and `research/edison-engine-rules-flags.md` (flag→behavior mapping + empirical spikes).

---

## Problem & users

The app is a **private, invite-only Yu-Gi-Oh "Edison format" dueling web app** for a small friend group
(non-commercial, self-hosted). Edison = the March 2010 / Master Rule 1 TCG-era retro format.

The founding vision was an accurate rules engine that **doubles as a teaching aid so the group isn't
surprised by judges at in-person tournaments**, plus a "static rules & rulings reference page" (V1
scope that was never shipped — the app today has no rules/help surface at all).

**This phase delivers that.** The end goal is **user-facing documentation, shipped in-app**, in two
sections: (1) app how-to guides, (2) Edison-format rules guides — good enough that a group member can
play Edison confidently **at the table with no engine assist**.

**The gate:** the rules docs are only trustworthy if our app truly enforces Edison the way a live
tournament would. So before writing docs we run a **parity audit** and close the accuracy gaps it
surfaces. **Load-bearing principle:** three things must agree — **authoritative Edison rules ==
our engine's enforcement == our user docs.** Docs are authored from the authoritative sources, NOT
from the engine (writing docs to match the engine would enshrine any engine bug as "the rule").

---

## Decisions made (CEO-confirmed)

1. **Binding authority = edisonformat.com** (edisonformat.net) for both rules and card errata. On
   source conflict, edisonformat.com wins and the conflict is escalated to the CEO — never silently
   resolved. (Q1, LOCKED.)
2. **Parity-audit scope = three tiers** (decision record in team memory:
   `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-17-parity-audit-scope.md`; the decision is
   inlined here so the repo copy is self-sufficient):
   - **Tier 1 — rules-level: COMPLETE.** All 13 published rule-differences (expanded to 78 discrete
     testable behaviors) + the Master-Rule-1 base scaffolding.
   - **Tier 2 — card-level: EXHAUSTIVE on the 36 functional-errata cards ONLY.** These are the entire
     set of cards where 2010 text ≠ modern text; the other ~3,645 have no Edison-specific behavior.
   - **Tier 3 — staples: opportunistic SPOT-CHECK** via representative decklists + a lightweight
     "report a ruling discrepancy" escape hatch. **Do NOT attempt exhaustive per-card/interaction
     verification** (combinatorially impossible; not the community bar).
3. **Docs live IN-APP** (Q4, LOCKED). Working defaults adopted by Product Lead (CEO may override,
   non-blocking): route **`/learn`** (with `/rules` as alias), **behind auth**, as **static in-repo
   Markdown/MDX** (also readable offline at a venue).
4. **Rules-guide style:** self-contained but gotchas/mechanics-that-matter front-and-center. (Q3.)
5. **V2 chatbot seam:** docs structured with stable anchors so a future "why did that happen?" chatbot
   can consume them — AND human-digestible on the front end. (Q5.)

---

## Requirements

Testable requirements, grouped by workstream. IDs are for tracking.

### Track B — Engine parity (needs the custom WASM; only CI/eng env can build+run it)

- **B-REQ-1 (MUST):** Populate the **Actual behavior** + **Evidence** columns of the parity matrix
  (`docs/working/2026-07-17-parity-matrix.md`) for all **127 acceptance-gate rows** (78 rule behaviors
  + 13 base + 36 errata), flipping Status to VERIFIED-PASS or recording a defect. This *is* the audit.
- **B-REQ-2 (MUST):** Every Tier-1 rules behavior ends at **VERIFIED-PASS** or an explicit,
  documented **CARVE-OUT**. Extend `packages/engine/src/edisonRules.accuracy.test.ts` (harness:
  `createDuelWithState` + `driveDuel`) — 5 behaviors already pass; ~80 need tests.
- **B-REQ-3 (MUST):** Resolve **R10 LP-cost**. A patch (`patches/ocgcore-lp-cost-strict.patch`) and
  Brain Control 800/801 tests already exist — **confirm whether the patched WASM is live in CI**; if
  so these 4 rows flip to VERIFIED-PASS with no new work.
- **B-REQ-4 (MUST):** Tier-2 errata — for all 36: author/verify the **~24 needs-authoring** pre-errata
  scripts, **edit REDMD** (`packages/engine/scripts/edison-overrides/c88264978.lua` is still
  once-per-NAME — must be Edison per-copy), **confirm the 6 substitute-wired** aliases are active, and
  add a behavioral test per card. The 6 "rules-level-ruling" errata are cross-linked to R-rows, not
  separate script tasks.
- **B-REQ-5 (MUST):** Resolve **ENG-ULTIMATE-OFFERING** — loader + allow-list must agree on passcode
  (modern `80604091` vs stray image id `80604092` vs repo alias `511003023`).
- **B-REQ-6 (SHOULD):** Empirically test the source-verified-but-untested behaviors
  (SINGLE_CHAIN_IN_DAMAGE_SUBSTEP, TCG_SEGOC_FIRSTTRIGGER).
- **B-REQ-7 (SHOULD):** **HARDEN-ASSETS** — pin `packages/engine/scripts/fetch-assets.sh` CardScripts
  checkout to a fixed commit (reproducibility / accuracy determinism). **MSG_NAMES reconcile** (cosmetic).
- **B-REQ-8 (MUST):** Tier-3 spot-check — verify each of the **17 smoke-test fixtures** (in the rules
  reference §4) is **Edison-pool-legal against our locked banlist BEFORE use** (swap illegal cards),
  then run one duel per archetype and log discrepancies.
- **B-SPIKE-1:** **R12 infinite loops** — determine whether the engine enforces voluntary-loop
  illegality; report the verdict. (Expected: it does not → document as human-adjudicated carve-out.)

### Track B4 — In-app docs surface (web package; no engine)

- **B4-REQ-1 (MUST):** Add route **`/learn`** (+ `/rules` alias) behind `RequireAuth`; repoint the
  existing dormant Home stub card ("📖 Rules & rulings", currently `comingSoon`) to it; retitle
  "Rules & Guides".
- **B4-REQ-2 (MUST):** Render the static Markdown/MDX content set per the doc IA
  (`docs/working/2026-07-17-docs-information-architecture.md`); emit a **`docs-manifest.json`** at build
  time (single source for search, Quick Answers, prev/next, future chatbot).
- **B4-REQ-3 (MUST):** Fast-find: curated **Quick Answers** Q→anchor index on the landing, client-side
  **search** (titles/headings/keywords/card names), category nav + prev/next.
- **B4-REQ-4 (MUST):** Anchor convention: immutable canonical IDs (`rules.diff.NN` zero-padded) +
  author-assigned `{#slug}` heading anchors (headings may be reworded; anchors never change).
- **B4-REQ-5 (SHOULD):** Duel-screen "?" opens a **generic** docs slide-in (V1-safe). No
  disabled-action deep links, no "why did that happen" reasoning (V2).
- **B4-REQ-6:** Responsive desktop + mobile; match existing design system (`packages/web/src`,
  `global.css` tokens). Content-agnostic shell can be built in parallel with content authoring.

### Track C — Content (Product Lead owns; here for CTO awareness)

- Rules guide authored from the authoritative reference, **each claim traceable to source + test
  evidence**; app how-tos (5 core + 1 optional). **Gated on parity sign-off** (Track B complete).

---

## UX flows & screens

Full spec: `docs/working/2026-07-17-docs-information-architecture.md` (580 lines, wireframes desktop +
mobile). Summary: two never-blended sections on one `/learn` landing — **"Using the App"** (how-tos)
and **"Edison Format Rules"** (Quick Answers → Base-Rules Primer → the 13 rule-differences frozen 1:1
to edisonformat #1–13 → "Cards That Play Differently" = the 36 errata). Wireframes provided for the
landing/index, a rules-guide article page (with TL;DR box + anchored headings + related-cards +
prev/next), and an app how-to page.

---

## Out of scope

- Exhaustive per-card or per-interaction verification (Tier-3 is opportunistic only).
- "Why did that happen?" in-duel teaching chatbot; disabled-action deep-links (both V2).
- Public / SEO docs surface (docs are behind auth unless the CEO flips that default).
- A formal all-staples audit (~400–600 cards) — deliberately not committed to.
- Native app, AI opponent (V2+, unchanged).

---

## Open questions (non-blocking — do not hold Track B)

1. **R12 infinite loops:** spike-confirm-then-document as a human-judge carve-out, or accept the
   carve-out outright? Product Lead recommendation: **spike then document**; verdict goes to CEO after
   `B-SPIKE-1`.
2. **Route `/learn` vs `/rules`; docs behind-auth vs public** — defaults adopted; CEO may override.
3. **Substitoad / banlist authority:** our catalog has Substitoad **Unlimited** (matches our locked
   March-2010 list per edisonformat.com); community "now-Forbidden" refers to a later era. Treated as
   **resolved** unless the CEO says otherwise. Engineering still verifies every fixture per B-REQ-8.

---

## Acceptance criteria

- **AC-1:** Parity matrix fully populated (Actual + Evidence for all 127 rows); every Tier-1 behavior
  is VERIFIED-PASS or a documented CARVE-OUT.
- **AC-2:** All 36 functional-errata cards are VERIFIED-PASS (correct pre-errata behavior) or documented.
- **AC-3:** All 17 fixtures confirmed pool-legal; one duel per archetype smoke-tested green (Tier-3).
- **AC-4:** `/learn` ships behind auth; the content set renders; `docs-manifest.json` builds; Quick
  Answers + search work on desktop and mobile.
- **AC-5:** Every rules-guide claim is traceable to (a) an edisonformat.com source and (b) passing
  test evidence.
- **AC-6:** Product Lead records a **parity sign-off** before any rules-guide content ships.

---

## Reporting back & resume contract (how to hand this back so the Product Lead can resume seamlessly)

**Why this is mandatory:** there is **no live thread** between the build team and the Product Lead, and
the CTO is session-based (cannot be async-paged). The *only* clean handback is a **written, in-repo
trail a fresh Product Lead session can read cold and resume from.** Do not rely on any conversational
handback.

1. **The parity matrix is the live tracker.** As each row is verified, fill **Actual behavior** +
   **Evidence** (test name + CI run / commit SHA) and set **Status**:
   - `VERIFIED-PASS` — acceptance test green.
   - `DEFECT` — engine behavior ≠ expected; add a one-line expected-vs-actual note. *(Use this status.)*
   - `CARVE-OUT` — confirmed not engine-enforced; note the rationale + that it's documented as
     human-adjudicated.
   Keep the top-of-file rollup counts current.

2. **Do NOT silently reconcile the engine to the docs (or vice-versa).** If the engine behaves
   differently from the authoritative reference, that is a **DEFECT to fix** — not a reason to edit the
   expected column. If you believe the *authoritative reference itself* is wrong, flag the row
   `RECONCILE-TO-PRODUCT-LEAD` and leave it for adjudication (edisonformat.com is the authority;
   conflicts escalate to the CEO). This protects the load-bearing principle: **authority == engine == docs.**

3. **Completion report = the resume trigger.** When Track B (and/or B4) is done, write
   `docs/working/YYYY-MM-DD-parity-audit-CTO-report.md` — the single artifact that tells the Product
   Lead "you can resume." It MUST contain:
   - Final matrix rollup (counts by status) + confirmation the matrix is **100% populated**.
   - **Defects found & fixed** (each with fix commit SHA) and **any open defects** (with why).
   - **Carve-outs** with rationale — including the **R12 verdict** from `B-SPIKE-1`.
   - **RECONCILE list** — every place engine and authoritative reference disagree and the Product Lead
     must decide doc wording / re-sourcing. *This is the single input the Product Lead most needs to
     author correct docs — do not omit it.*
   - **AC-1…AC-6:** met / not-met, one line each.
   - **CI green** on the final commit (state the SHA).
   - **B4:** `/learn` shell status + the exact `docs-manifest.json` frontmatter/anchor **schema** the
     content must satisfy, so Track C content slots in without rework.

4. **Delivery Definition of Done** (team protocol): every deliverable is **pushed to `origin/master`
   and verified there** (`local HEAD == remote`), with the **pushed SHA reported** in the completion
   report. A local commit is not delivered. After any slice lands, **confirm CI is green** before proceeding.

5. **Keep the living docs current as work lands:** update `docs/STATUS.md` (accuracy rollup + phase row)
   and `tasks/BOARD.md`, so the product-wide status never goes stale.

**Product Lead resume point (on the completion report):** review the populated matrix + RECONCILE list
→ record the **parity sign-off** (decision record + STATUS update) → adjudicate reconcile items (fix vs
doc-nuance vs CEO escalation) → start **Track C** (write the docs) against the verified matrix + the
`docs-manifest.json` schema.

---

## Pointers

- Parity matrix (audit instrument + acceptance gate): `docs/working/2026-07-17-parity-matrix.md`
- Authoritative rules reference (78 behaviors + 36 errata + 17 decklists): `docs/working/2026-07-17-edison-rules-reference.md`
- Scope rationale + community bar: `docs/working/2026-07-17-parity-scope.md`
- Doc information architecture + wireframes: `docs/working/2026-07-17-docs-information-architecture.md`
- Scope decision record: team memory `/decisions/2026-07-17-parity-audit-scope.md`
- Live status rollup: `docs/STATUS.md`
