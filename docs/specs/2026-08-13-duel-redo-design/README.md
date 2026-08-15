---
linear_project: Duel Experience Redo
---

# Duel Experience Redo — design deliverable

The design engineering builds from. Discovery issue **ZUH-121**, Linear Project **Duel Experience Redo**.
PRD: https://linear.app/zuzu-io/document/prd-22f37a25d15c

| File | What it is |
| --- | --- |
| `00-README.md` | The designer's own index and escalations |
| `01-object-model.md` | **Read first** — the decision classification law (OFFER vs STEP) that the rest depends on |
| `02-surface-inventory.md` | 16 surfaces, 94 state rows |
| `03-flows.md` | 10 flows |
| `04-component-contract.md` | What engineering builds |
| `05-backend-delta.md` | Backend deltas, with a **binding** gate on adding new ones |
| `06-answer-outcome-matrix.md` | The answer-fidelity evidence |
| `07-coverage-and-provenance.md` | **Read before trusting any scenario** — what is recorded vs authored, per outcome |
| `08-usability-findings.md` | Independent usability pass, 22 findings |
| `09-pacing-application.md` | **ZUH-131's timing budgets applied** — B1–B6 answered one by one, what changed, what is still authored and unverified |
| `fixtures/` | Recorded from real duels against the real engine |
| `shots/` | 23 PNGs — the record of what the prototype looked like at hand-over |

## The prototype

Branch `proto/duel-redo`, commit `19f951d10a9853040fbe0c585144ea06fc3fe63d`, on
`https://github.com/Zuzualvi/yugioh-app.git`. Code at `spikes/duel-redo-proto/`.

🔴 **`proto/*` is structurally unmergeable and disposable, deliberately.** Do not rename it to get
around that and do not copy it into a feature branch to save the work. What survives the prototype
is: this document set, the fixtures, the stylesheet and its markup contract, and the backend deltas.
`shots/` exists so the look has a record after the branch is gone.

**Coverage: 65 of 94 states reachable in the prototype**, re-derived row by row against the built file
on 2026-08-13. `07` §1.1 states which 29 are not and why; most are "no recorded frame exists". **The pile
inspector and the chain strip ARE built** — 4/5 and 2/6 states driven — and this document said for three
rounds that they were not: see `07` §1.2a for the correction and how it survived. A prototype is done to
a stated coverage, never just done, and the statement has to be re-derived rather than carried.

## Two gates in here that are permanent, not advisory

**`answer-matrix.py`** (on the prototype branch) enforces **two** invariants, and the second exists
because the first is not sufficient:

- **A · distinct outcomes** — distinct answers must produce distinct observable end states.
- **B · label fidelity** — the confirm control and the selection line must NAME the answer being
  submitted. The app publishes what it actually submitted, with card identities resolved from the
  **response's own indices**; the gate compares those against label text scraped from the DOM. Two
  independent paths, so a label sourced from anywhere but the answer fails.

**Why B exists:** invariant A passed 19 of 19 while the confirm control read `Activate "Dimensional
Prison"` and Book of Moon was what resolved. A compares end states and never reads the label. This
defect family has now appeared four times across two projects, twice found by someone other than the
author and once by the CEO personally. **A gate that checks outcomes and not labels is how it keeps
getting through.** The gate was falsified before it was trusted — the original defect was
reintroduced and it reported 6 failures naming the exact mismatch.

**`05-backend-delta.md` §2a** is a binding gate on the delta list: an item does not enter it until
someone has confirmed the answer is not already in what the client is sent. **Two of the eight items
that have passed through this list turned out not to be needed as specified** — ND-9 was designed
unnecessarily (the `STATE` snapshot is not redacted from its owner, so the client can already resolve
the identity by joining on `(controller, location, sequence)`), and MH-3 was built server-side and
consumed by nobody. The remaining must-haves should be re-read against the same question before
anyone builds them.

## What is NOT in here, and has its own named producer

The **presentation layer** — the stylesheet's final form, the markup naming-and-structure contract,
and the motion specification — is **ZUH-120**, not this. The prototype's stylesheet is a clean
class-based substrate (2,301 lines, 82 tokens, 31 transitions, **zero inline style objects**) built on
the vocabulary the CEO approved on the previous project. That vocabulary is a **floor, not a target**:
the CEO's approval covers colour, type, spacing and the ownership colour law at roughly four screens
of coverage, and ZUH-120 extends it to every state here and returns to the CEO for approval at the
new coverage.

**Microcopy** is ZUH-123. **Accessibility** is ZUH-124. **Audio** is out of scope (ZUH-122, parked).

## Confidence

Fixtures are **recorded** from real duels driven against the real ocgcore engine, except where `07`
§2a marks an outcome authored — read that table before treating any scenario's result as real. The
prototype deliberately **does not resolve battle**: it stops at the declaration, because a simulation
of rules the engine already enforces is how this project previously spent design budget debugging
its own simulation.

**Timing, motion and pace are authored and NOT verified.** A still frame cannot show a transition
that is too slow, too abrupt or absent, and the usability method under-detects them systematically.
They are the CEO's own review. Nothing in this document set should be read as clearing them.

**One known product defect sits underneath this design and is not fixed by it: ZUH-132** — a duel
does not end when life points reach 0. With the clock removed, **resign is currently the only ending
a duel can reach.**
