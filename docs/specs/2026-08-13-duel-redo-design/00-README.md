---
linear_project: Duel Experience Redo
---

# ZUH-121 — The redone duel experience

**Design deliverable.** Surface inventory · flows · clickable prototype · component contract ·
fixtures · backend delta. Built on ZUH-118 (observed breaks) and ZUH-119 (player needs), against
this project's PRD.

| | |
|---|---|
| **Prototype branch** | `proto/duel-redo` of `https://github.com/Zuzualvi/yugioh-app.git` |
| **Commit SHA** | `19f951d10a9853040fbe0c585144ea06fc3fe63d` — verified present on `https://github.com/Zuzualvi/yugioh-app.git` |
| **Prototype path** | `spikes/duel-redo-proto/` |
| **How to open it** | Open **`duel-redo-prototype.html`** (single self-contained file, delivered alongside these documents) straight from `file://`. No server, no toolchain, no install. To rebuild it: `cd spikes/duel-redo-proto && npm install && npm run build` → `dist/index.html`. This repo has **no branch previews** for `proto/*`. |
| **Screenshots** | `shots/` — 23 PNGs: 15 scenario states plus 8 mid-flow frames |
| **The gate** | `spikes/duel-redo-proto/answer-matrix.py` — **two invariants**: distinct answers produce distinct outcomes, AND the confirm control names the answer being submitted. Exits non-zero on either failure. |
| **Independent usability pass** | Run (findings at `../usability/findings.md`). 3 blockers fixed on this branch; see `07-coverage-and-provenance.md` §8. |

---

## Read in this order

| File | What it is |
|---|---|
| **`01-object-model.md`** | The object model, **the decision classification law** (the fix for the unwinnable-game defect), the commit-point call, the disagreement list, the persistence/cessation audit, and the two decisions I am surfacing rather than taking. **Start here.** |
| `02-surface-inventory.md` | 16 surfaces, 92 state rows, each with its motion by token |
| `03-flows.md` | 10 flows: sequencing, gaps, failures, recovery, actions-to-goal |
| `04-component-contract.md` | Component tree against the real paths on `master`, props, variants, acceptance criteria |
| `05-backend-delta.md` | Every prior delta verified **end to end**, plus the new ones |
| `06-answer-outcome-matrix.md` | Generated evidence: 5 decision points, 19 answers, 0 collisions |
| `07-coverage-and-provenance.md` | What the prototype does **not** reach, where each fixture came from, and what I did not verify |
| `09-pacing-application.md` | **What ZUH-131's pacing evidence did to this design — budgets B1–B6 answered one by one**, the values that are still authored and unverified, and what was driven versus only edited |
| `fixtures/` | The recorded slices, the recorder and the slicing script |
| `shots/` | Screenshots |

---

## The five things that changed, and what each did to the design

| Change | Effect |
|---|---|
| **The clock is gone entirely** | The clock panel, four urgency bands and ND-5 are deleted. Two consequences fell out and both needed designing: an absent opponent needs a new ending (**ND-10 + the `Claim the duel` route**, flow F8), and a player stuck on a decision the client cannot answer no longer has a timeout to release them (**requirement E1**: every state offers at least one action that ends or advances the duel, and `Resign` is the floor). |
| **The commit lock is an open question** | **Kept — but re-founded and cut down.** Its load-bearing fact was never the clock: `SelectZone` has no cancel response in the protocol, so an intent that reaches a zone step cannot be backed out of, timed or not. And PRD A3 means the client will never abort for you, which makes the player's own exit the only one there is. **Deleted:** the step budget (a client-side guess printed next to an engine fact), the step dots, the `🔒` glyph nobody ever defined. **Kept:** one warning on the confirm that costs the exit, and `COMMITTED` where the button was. |
| **Verbosity levels deleted** | Replaced by the **classification law** (01 §3), a static OFFER/STEP table over all 20 variants that never reads `cancelable`. No setting controls how often you are prompted. |
| **The players are learning the format** | Being asked at most windows is a feature. Every `ChainPrompt` is presented. The zone step is asked. The feed rail is **permanent**, not collapsed by default. Seeing what is happening is not being taught: the screen still never explains a rule and never states a cause the engine did not give. |
| **`"This monster has already attacked."` deleted** | And nothing replaces it. A card that affords nothing gets a 200 ms shake and no text. |

---

## The one-paragraph summary of what is wrong and what fixes it

The engine's unit is a **decision**. The player's unit is an **intent**. The shipped screen has no
object for an intent and no object for *not being asked*, and almost every one of ZUH-118's 29
breaks lives in one of those two holes. This design adds three client-side objects — **Intent**,
**Control**, **Delta** — and one law: every decision variant is permanently an **OFFER** (declining
is a real answer; always presented) or a **STEP** (declining aborts your intent; the client may
never decline one, and may answer it silently only where exactly one substantive answer exists).
That law makes PRD A1, A2, A3 and A5 consistent, it deletes the mechanism that silently cancelled
every attack, and it is enforceable by a source scan rather than by care.

---

## What I am escalating

1. **`Choose zones: OFF` (old design §16B) does not survive PRD A1 as written.** Five legal zones
   are five substantive answers. I have built the zone step **asked**, on the board, one click, no
   panel — which is what made the auto default attractive without the contradiction. If the CEO
   wants the auto default back, it should be a named exception in the PRD, not a settings toggle.
   (01 §8.1)

2. 🔴 **ZUH-132 — the duel does not end when life points reach 0.** Recorded against `master` on
   the repo's own harness: LP hit 0, `duelEnded` stayed `false`, play continued for many more
   turns, and across 3,008 captured frames there were **764 relayed `MSG_WIN` messages and zero
   `DUEL_END` frames**. With the clock deleted, **resign is currently the only ending a duel can
   reach.** Filed; not fixed here; should be sequenced before ND-10.

3. **`Play {opponent} again` on the end card is proposed scope.** Edison is best-of-three; the
   product's unit is one duel. One control to delete — but its absence should be a decision.

4. **No independent usability pass was run.** Stated gap; it is what I would spend the next hour on.

---

## What survives this prototype

The prototype is disposable and `proto/*` is structurally unmergeable. What engineering takes:

- **the component contract** (`04-…`), written against the real paths on `master`;
- **the fixtures** (`fixtures/`), recorded from a live duel, plus the recorder that made them;
- **the presentation layer** — `spikes/duel-redo-proto/src/styles.css`: the approved stylesheet
  ported, **plus a token layer for space, radius, type, layout, motion and depth**. The approved
  sheet tokenised **colour only** — 14 custom properties, all hues — which is the mechanism by
  which 251 inline style objects came out of a build that took one stylesheet in. ZUH-120 owns
  extending and retokenising it. **Zero inline style objects at both ends.**
- **the backend deltas** (`05-…`), with the constraints inventory.
