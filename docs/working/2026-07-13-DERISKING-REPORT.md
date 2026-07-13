# Yu-Gi-Oh! Edison Duel App — De-Risking Phase Report & Go-Forward Plan

**From:** CTO · **Date:** 2026-07-13 · **Audience:** CEO
**Status:** De-risking phase COMPLETE — every load-bearing technical risk retired with empirical proof. Ready to build the app.

---

## TL;DR

We took the Product Lead's handoff, turned it into specs, and ran a set of proof-of-concept spikes to answer "will this actually work?" **before** investing in the app. All of them passed. We now know — with running code, not hopes — that:

- the reused engine **genuinely reproduces Edison rules** (including the subtle ones the format is defined by),
- we can run it in a **simple, low-maintenance architecture**,
- **hidden information cannot leak** between players,
- **multi-day async play survives restarts** and resumes perfectly,
- and the **card data is exact** to the community source of truth.

Nothing needs your input to keep going except, eventually, a small hosting cost (~$5–10/mo) when we deploy. Below is what we proved and the plan to build the actual app.

---

## What we proved (all committed & verified on GitHub)

| Spike | Question it answered | Result | Proof (SHA) |
|---|---|---|---|
| **Foundation** | Is the codebase set up so work stays consistent & reviewable? | Monorepo, strict typing, CI checks, and an auto-enforced architecture guardrail (bad imports fail the build). | `36c1023` |
| **B — Data** | Can we build the exact Edison card pool? | Yes — 3,681-card allow-list, banlist (43/70/19) exact, pre-errata card handling, 35/35 checks. | `70abd73` |
| **A — Engine** | Does the reused engine do Edison, and how do we run it? | Yes — first-turn draw, single Field Spell, and ignition-effect priority all confirmed **live**. Runs as a ~1MB WebAssembly module in our server: no fragile native toolchain. | `c4c5a4c` |
| **A2 — Rules validation** | Are the remaining era rules correct? | Yes — damage-step restriction and 0-ATK battle rule confirmed; no rule found to be wrong for 2010. Surfaced one gap (below). | `bdf9bc0` |
| **E — Engine rebuild** | Can we close that gap? | Yes — we built our own engine artifact; **Graveyard ignition priority now works too**. Accuracy fully closed at the engine level. | `cc8fba4` |
| **D — Async durability** | Can a duel survive both players offline for days + a server restart? | Yes — the engine is fully deterministic, so a duel rehydrates from its move-log to the exact same state in ~60ms. This same log powers replays and the audit trail. | `883354e` |
| **C — Hidden info** | Can an opponent's hand/deck/face-downs ever leak? | No — 24/24 tests, zero leaks, across a full duel including reveals and reconnect. Seat hijacking blocked. | `d558efa` |

### The one honest caveat, now resolved
The prebuilt engine package couldn't reproduce *Graveyard*-based ignition priority (a real Edison rule — D-HERO Malicious, Plaguespreader). Rather than ship with a known accuracy gap in the flagship feature, we built our own engine artifact with a modern compiler; the behavior now works. Native-binding remains a fallback we didn't need.

### The confirmed technical shape
- **Server-authoritative**: the rules engine runs on the server; browsers are thin renderers that only ever receive their own entitled view. This is what makes "no hidden-info leak" structural, not bolted-on.
- **Engine**: our own build of the community `ocgcore` (edo9300), run as WebAssembly inside a Node/TypeScript server. Edison rules via a locked flag set.
- **Persistence**: each duel is an append-only log of moves in SQLite; replay rehydrates state. One mechanism serves durability, replays, and audit.
- **Stack**: TypeScript end-to-end, React frontend, single deployable (modular monolith), SQLite for V1.

---

## Residual work carried forward (known, not blocking)
- **Pre-errata card scripts**: ~18 cards need Edison-correct behavior authored (6 have ready substitutes, 6 more already exist). This is curation, not invention — the list is enumerated.
- **Engine build in CI**: wire the reproducible build into the pipeline.
- A few low-risk rules (SEGOC, damage-substep chaining) are source-verified and will get live QA tests during the build.

---

## Go-forward plan — building the app

Built as a modular monolith, in slices that are each independently testable. Recommended order (simplest, most self-contained first):

1. **Spine** — graduate the proven spike code into real packages: the engine adapter, the typed client↔server contract, the self-hosted card data + images pipeline, and invite-only accounts/login.
2. **Deck builder** — full builder with live legality (against the frozen pool + banlist), `.ydk` import/export, and "My Decks." Independently usable by the group before dueling exists, and it exercises the whole data layer.
3. **Dueling** (the big one) — lobby/challenge/pre-duel room, the authoritative duel engine with per-seat redaction and reconnect, the per-move timer + async "Your move" queue, and the duel-field UI including the make-or-break chain/priority screen.
4. **Supporting** — rules & rulings reference page, duel log/summary/replay, pre-errata script authoring, and accessibility/responsive polish.

QA rides along every slice against the 22 acceptance criteria; docs are written as code ships. Hosting/deploy is the one item that will need a small spend approval from you when we get there.

**Recommendation:** proceed, starting with the Spine + Deck builder (they don't depend on the hardest dueling work and get something usable in the group's hands soonest). Say the word and I'll mobilize the build team.
