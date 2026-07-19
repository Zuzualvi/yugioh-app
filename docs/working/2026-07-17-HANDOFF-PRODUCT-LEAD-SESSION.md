# PRODUCT LEAD — SESSION HANDOFF / RESUME DOC (keywords: product-lead, handoff, resume, pick-up, state, parity, docs, edison, next, waiting-on-cto)

_Written 2026-07-17 by the Product Lead. If you are a fresh Product Lead session on yugioh-app, **read this first**, then `docs/STATUS.md`, then check whether the CTO completion report exists (see "What I'm waiting on"). This supersedes earlier PL end-of-session handoffs for the current phase._

> **⏩ UPDATE 2026-07-18 — the phase below is essentially COMPLETE.** The CTO completion report landed; CEO
> **signed off** on parity (`/decisions/2026-07-18-parity-sign-off.md`); **Track C docs are AUTHORED +
> SHIPPED** to origin/master @ `ba7c92f` (content @ `43d4048`, full `npm run verify` green). 24 real `/learn`
> pages live behind auth. For the current state read **`track-c-authoring-log.md`** (this dir) +
> `docs/STATUS.md` + `docs/working/2026-07-18-track-c-delivery-handoff.md` FIRST — they supersede the
> "waiting on CTO / Track C gated" framing in the sections below. Only residual CTO polish remains (confirm
> CI/deploy for 43d4048; Necroface script-less card; V2 polish). One open CEO question: app-flow divergence
> (no Pre-Duel Room / no Home async queue) — update design docs vs. ship those features.

---

## Who you are / how this team works

You are the **Product Lead** of a small product team, working **FOR a product-minded CEO**. The CEO
sets product direction and makes the product calls; **you orchestrate, consolidate, and execute.** On
process / requirement-quality / research-rigor you are the expert and should flag concerns plainly; on
product direction you **advise softly and the CEO decides.** Treat CEO messages as discussion by
default; only mobilize the team on a clear go.

Your roster (delegate via coordinator; use EXACT names incl. the bracket suffix or you get NotFound):
- **`Researcher [yugioh-app]`** — competitive space, personas, domain/rules research (web access).
- **`Product Owner [yugioh-app]`** — requirements, flow-breaks, edge cases, matrices.
- **`UX Designer [yugioh-app]`** — flows, screens, IA.
- **There is NO CTO agent in your roster.** The CTO / build team is **external**; the CEO routes your
  handoff to them. You cannot page them — hand off via written, in-repo artifacts.

Specialists don't share your context — every task must be self-contained (paths, constraints, output
file, report-back format). Parallel instances must own **disjoint** output files. Specialists write to
`/workspace/product/`. You mirror CEO-facing deliverables to `/mnt/session/outputs/` AND commit them to
the repo under `docs/working/YYYY-MM-DD-*` and push (delivery isn't done until it's on origin/master).

## The product in one paragraph

Private, invite-only **Yu-Gi-Oh "Edison format"** (March 2010 / Master Rule 1 TCG-era) dueling web app
for a small friend group; non-commercial, self-hosted, accuracy-first. **Live** at app.zuhayr.io
(Vercel) / api.zuhayr.io (Fly). Already shipped: invite-only auth, full Edison deck builder (3,681-card
pool + March-2010 banlist), and a fully interactive server-authoritative duel (custom ocgcore WASM,
desktop+mobile). The one V1 item never shipped: an **in-app rules/help surface** — which the current
phase delivers.

## Current phase (started 2026-07-17)

**Edison Parity Audit → close accuracy gaps → ship in-app user documentation.** The CEO worked backward
from the final deliverable: **user-facing in-app docs** in two sections — (1) app how-tos, (2) Edison
rules guides — good enough to play Edison confidently **at the table with no engine assist.** The docs
are gated on a **parity audit** proving our engine enforces Edison the way a live-tournament judge
would. **Load-bearing principle: authoritative Edison rules == our engine == our docs.** Docs are
authored from the authority (edisonformat.com), NOT from the engine.

**Scope is LOCKED (do not re-expand):** three tiers — (1) rules-level COMPLETE (13 rule-differences →
78 testable behaviors + MR1 base); (2) card-level EXHAUSTIVE on the **36 functional-errata cards only**
(the entire set where 2010 text ≠ modern); (3) staples opportunistic SPOT-CHECK + a discrepancy escape
hatch. **Explicitly NOT** exhaustive per-card/interaction verification. Rationale + decision record:
`/mnt/memory/yugioh-app-team-memory/decisions/2026-07-17-parity-audit-scope.md`.

## Where we are RIGHT NOW

- **Track A (yours) = ✅ DONE and pushed.** Rules reference (78 behaviors, 36-errata table, 17 canonical
  decklists), the **parity matrix** (127 acceptance-gate rows; "expected" side pre-filled, "actual"
  blank), doc information architecture (+wireframes), the CTO handoff, RESEARCH brief, and a new
  evergreen `docs/STATUS.md`. All on **origin/master @ 92ae483** (verified). Mirrored to
  `/mnt/session/outputs/`.
- **Track B (engine parity) + Track B4 (`/learn` docs surface) = HANDED OFF, awaiting the CTO.** These
  are the CTO's to build. The handoff is `docs/working/2026-07-17-HANDOFF-parity-audit-and-docs.md` —
  it is self-contained (start-here read order, requirements B-REQ-1..8 + B-SPIKE-1 + B4-REQ-1..6,
  AC-1..6, and a **reporting-back & resume contract**).
- **Track C (write the docs) = YOURS, but GATED** on the parity sign-off (i.e., gated on Track B).

## What you're WAITING ON from the CTO (your resume trigger)

A **completion report** at `docs/working/YYYY-MM-DD-parity-audit-CTO-report.md`. Per the handoff's
"resume contract," it must contain: final matrix rollup + confirmation the matrix is 100% populated;
defects found & fixed (with SHAs) + any open defects; **carve-outs incl. the R12 infinite-loops
verdict**; a **RECONCILE list** (every place engine ≠ authoritative reference that needs your
adjudication — this is your single most important input for writing correct docs); AC-1..6 met/not-met;
CI-green SHA; and the **`docs-manifest.json` schema** the docs content must satisfy.

**Until that report exists, you are blocked on Track C.** Check for it first thing. Also glance at the
**parity matrix** (`docs/working/2026-07-17-parity-matrix.md`) — the CTO fills Actual/Evidence + flips
Status (VERIFIED-PASS / DEFECT / CARVE-OUT) as work lands, so it shows live progress even before the report.

## What's NEXT (your resume playbook, in order)

1. **If the CTO completion report exists:**
   a. Review the populated matrix + the **RECONCILE list**.
   b. Adjudicate each reconcile item: engine bug → back to CTO to fix; authoritative-source nuance →
      doc wording; genuine source conflict → **escalate to CEO** (edisonformat.com is the authority).
   c. Record the **parity sign-off** (a decision record in `/decisions/` + update `docs/STATUS.md`
      accuracy rollup).
   d. Mobilize **Track C**: Researcher/Product Owner draft the two doc sections against the verified
      matrix + the rules reference (every claim traceable to source + test evidence); UX finalizes
      presentation against the `docs-manifest.json` schema; the CTO's `/learn` shell renders it.
2. **If it does NOT exist yet:** you're waiting. Don't start Track C content (it would be built on
   unverified rulings). You can prep by drafting the app how-to guides (they don't depend on the engine
   audit) and refining the doc outline against the IA.
3. **Bring the CEO the R12 verdict** once the spike result is in (recommendation: document as
   human-adjudicated carve-out).

## Open threads with the CEO (none blocking)

- **R12 (infinite loops):** likely a human-judge call the engine won't enforce. Recommendation given =
  spike-confirm then document as carve-out. Verdict pending CTO's `B-SPIKE-1`; then to CEO.
- **Two reversible UX defaults adopted (CEO may override):** route **`/learn`** (vs `/rules`); docs
  **behind auth as static in-repo content** (vs public). CEO was informed; no objection so far.
- **Good news to confirm:** **R10 LP-cost** (our previously-worst accuracy gap) may already be closed —
  a patch + Brain Control 800/801 tests exist; if the patched WASM is live in CI those rows flip to
  VERIFIED-PASS (rollup → 9 pass / 76 to-test / 0 known-gaps). CTO confirms CI.
- **Resolved, no action:** Substitoad (our March-2010 authority allows it; "now-Forbidden" is a later
  era); Ultimate Offering passcode; REDMD script fix — all folded into the handoff as eng items.

## Artifact map (where everything is)

Repo (origin/master @ 92ae483):
- `docs/STATUS.md` — product-wide rollup (canonical entry point; keep it current).
- `docs/working/2026-07-17-HANDOFF-parity-audit-and-docs.md` — the CTO handoff.
- `docs/working/2026-07-17-parity-matrix.md` — the audit instrument + acceptance gate.
- `docs/working/2026-07-17-edison-rules-reference.md` — 78 behaviors + 36 errata + 17 decklists.
- `docs/working/2026-07-17-parity-scope.md` — scope rationale / community bar.
- `docs/working/2026-07-17-docs-information-architecture.md` — doc IA + wireframes.
- `docs/working/2026-07-17-RESEARCH-edison-parity.md` — research brief.
- `tasks/BOARD.md` — engineering work board (SHAs). `AGENTS.md` — engineering rulebook.

Team memory (`/mnt/memory/yugioh-app-team-memory/`):
- `docs-and-parity-phase.md` — this phase's full working log (running notes; richer than this handoff).
- `decisions/2026-07-17-parity-audit-scope.md` — the scope decision record.
- `research/edison-engine-rules-flags.md` — flag→behavior mapping + empirical spike results.
- `research/edison-functional-errata.md`, `domain/edison-format.md` — errata + pool/banlist detail.
- `project-context.md`, `yugioh-edison-app-project.md` — full project history (append-only narrative).

## Watch-outs / lessons (save yourself pain)

- **Don't let the CTO silently reconcile engine-to-docs.** If engine ≠ authority, that's a DEFECT or a
  flagged RECONCILE item for you — never a quiet edit to the "expected" column. This protects the
  three-way-agreement principle.
- **Scope is locked.** If tempted (or asked) to go exhaustive per-card, re-read the parity-scope brief:
  it's combinatorially impossible and not the community bar.
- **Memory-edit gotcha:** subagents also write to `docs-and-parity-phase.md`. **Re-read before you
  edit** it (a stale `old_string` will fail; a careless match can delete a heading — happened once).
- **Git:** on this repo `git push origin master` works (no claude/-branch 403). Always
  `pull --rebase --autostash` first, then verify `local HEAD == remote`, then report the SHA.
- **WASM caveat for any accuracy claims:** the custom WASM isn't committed; accuracy tests auto-skip
  without it, so "local green" ≠ verified. Trust CI, not a local run. You cannot build/run the WASM in
  a plain PL shell.
