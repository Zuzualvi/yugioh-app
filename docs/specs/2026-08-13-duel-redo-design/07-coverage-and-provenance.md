---
linear_project: Duel Experience Redo
---

# 07 · Coverage, fixture provenance, and what I did not verify

This document exists because a prototype is never "done" — it is **done to a stated coverage** —
and because on the previous round a specialist reported two things as driven that were not, and
its own words afterwards were *"my delivery report was WRONG."* Everything below is either
something I drove and can point at, or something I am telling you I did not.

---

## 1 · Coverage — what the prototype reaches, and what it does not

**Inventory: 16 surfaces · 91 state rows · 10 flows.**
**Prototype: 14 scenarios · 60 of 91 state rows reachable · 31 not reachable.**

*(Round 2: `end-overlay/dismissed`, `top-bar/duel-ended` review path and the verb-cluster dismissal
states became reachable with the blocker fixes.)*

### 1.1 Reachable, by surface

| Surface | Reachable / total | Not reachable, and why |
|---|---|---|
| Board / Field | 14 / 15 | `disconnected` — the prototype has no socket to drop |
| Verb chips | 3 / 3 | — |
| Dock · Question | 5 / 8 | `partial` (no multi-select decision exists in the captured duel — no `SelectUnselectCard`, no `min !== max`) · `empty candidates` (never emitted) · `error` (nothing rejects a response) |
| Dock · Intent line | 5 / 5 | — |
| Dock · Receipt | 1 / 3 | `stacked` and `superseded` need two auto-answers in sequence; the capture has none |
| Dock · Waiting | 3 / 4 | `reconnecting` — modelled in `DuelModel` but no scenario drives it |
| Dock · Delta | 3 / 4 | `empty` — the handover scenario always has events |
| Dock · Away | 2 / 3 | `returned` — no presence-restore path in the prototype |
| Phase rail + turn resource | 4 / 4 | — |
| Feed rail | 4 / 7 | `empty turn > 1` · `partial (feed resumes here)` · `duel-ended row` |
| Card inspector | 4 / 9 | `auto-push` (needs a resolving chain) · `pinned` (click and hover are the same gesture in the prototype) · `provenance badge` (none of the 14 captured cards is in the pre-errata corpus) · `hidden card` · `error` |
| **Pile inspector** | **0 / 5** | **Not implemented at all.** Pile badges render their counts and are not clickable. |
| **Chain strip** | **0 / 6** | **Not implemented at all.** The captured chains are single-link and resolve inside one frame burst. |
| Top bar | 3 / 4 | `socket errored` amber strip |
| Duel-end overlay | 4 / 5 | `unknown reason`. `dismissed / Review board` is now reachable. |
| Cross-surface rules | 3 / 6 | `error` · `partial` · `disconnected` |

### 1.2 The two surfaces with zero coverage, stated plainly

**Pile inspector** and **chain strip** are specified in the inventory and **built nowhere in the
prototype.** Both carry forward largely unchanged from the approved design (`2026-08-06-duel-ui-design.md`
§6 and §9), which is why I spent the budget elsewhere — but "carried forward" is not "shown", and
neither has been seen rendered in this design's layout. If the CEO's approval is meant to cover
them, it does not: he has not seen them here.

### 1.3 Flows

| Flow | Driven in the prototype? |
|---|---|
| F1 Seating | ✅ |
| F2 Summon, with the zone step asked | ✅ end to end, 3 actions |
| F3 Tribute summon + the commit point | ✅ end to end, 4 actions, both tributes |
| F4a Attack, one target, auto-answered | ✅ receipt reads `ANSWERED FOR YOU · Attack Mobius the Frost Monarch` |
| F4b Attack, several targets, presented | ✅ both targets + player cancel |
| F5 Chain window | ✅ both answers, and both with and without MH-3b/ND-9 applied |
| F6 End-phase discard | ✅ all seven answers |
| F7 Pass / wait / regain control + delta | ✅ |
| F8 Opponent leaves → claim | ⚠️ **partial** — the presence transition and the grace period are driven by a prototype button, not by a frame. No `PRESENCE` frame exists (ND-10). |
| F9 Duel end | ⚠️ **partial** — three reasons render, but the `DUEL_END` frame is hand-authored (see §2), and `Review board` is not wired |
| F10 Probing | ✅ verb chips, shake-with-no-text, hover inspector |

---

## 2 · Fixture provenance, per set

| Set | Provenance | Detail |
|---|---|---|
| `s01`–`s08` decisions, states and events | 🟢 **RECORDED** | Captured 2026-08-13 against `master` `f86683c` on the repo's own same-origin E2E harness (`e2e/harness/server.ts`, real WASM ocgcore, real `/api`, real duel WebSocket), two independent Chromium contexts at 1440×900, response-prompt suppression turned **off on both seats** so the engine's real decision sequence was not hidden by the mechanism this redesign deletes. **3,008 frames captured in full** (the ZUH-118 logs truncate at 900 chars, which loses every `STATE` frame). Slicing script: `fixtures/extract.py`. Recorder: `fixtures/record.mjs` + `fixtures/lib.mjs`. |
| `cards.json` | 🟢 **RECORDED** | The 14 passcodes the slices reference, read from the server's own catalog (`loadCatalog()`), not hand-typed. Names, types, ATK/DEF, levels and effect text are the shipped corpus. |
| Continuation branches (`branch(answer)`) | 🟡 **AUTHORED, and deliberately rules-free** | Only one answer was actually taken in the capture, so outcomes for the others are computed. Each is a **card move directly named by the answer**: you named a zone, the card goes in that zone; you named a tribute, that card goes to the graveyard. Nothing adjudicates legality, nothing resolves an effect, nothing computes damage. *The previous round hand-wrote a simulation of rules the engine already implements and spent design budget debugging three defects in the simulation. This is the smallest thing that is not that.* |
| Second attack target (`attack-multi`) | 🟠 **HAND-AUTHORED onto a recorded board** | The card record and the `CardEntry` are taken verbatim from the `s04` capture; **placing it in the opponent's second monster zone is invented**, because no recorded duel ever reached two attackable monsters. Needed because PRD A5 is about the >1-target case. |
| Candidate identities | 🟢 **RECORDED — JOINED, not authored** | Where a decision carries `code: 0` for a card the asking player owns, the identity is resolved from the `STATE` snapshot in the same recorded slice at `(controller, location, sequence)`. **Deleted in this revision:** the previous `chain-fixed` scenario, which hand-authored one card name onto every blank candidate and consequently named the wrong card. Its replacement, `chain-nocontext`, **withholds** the recorded `DECISION_CONTEXT` frame — a removal from recorded data, not an addition to it, and what the wire really gives for a summon-triggered window. |
| `DUEL_END` frames | 🟠 **HAND-AUTHORED** | The capture contains **764 relayed `MSG_WIN` messages and zero `DUEL_END` frames** — see ZUH-132. There was no ending to record. |
| `PRESENCE` / claim | 🟠 **HAND-AUTHORED** | No presence frame exists inside a duel today (ND-10). |
| Art | 🟢 real | `https://api.zuhayr.io/images/<passcode>.jpg`, public, no auth, no delta. Confirmed live: a known passcode returns `200 image/jpeg`; an unknown one returns `404 application/json`, which is why the component trusts `onError` on the `<img>` rather than a status code, and why it has a bounded 4 s deadline. |

### 2a · Which outcomes are REAL and which are AUTHORED — read this before tapping

The fixtures are recorded. **What happens after you answer is not the engine.** The independent
pass caught the cost of leaving that implicit: it saw a 1900 ATK monster destroy a 2400 ATK monster
for no damage and could not tell whether that was a design decision.

| After you answer… | Truthful? | What it is |
|---|---|---|
| a card lands in the zone you named | 🟢 real | a move the answer names |
| the tributes you named go to the graveyard | 🟢 real | a move the answer names |
| the card you named leaves your hand on a discard | 🟢 real | a move the answer names |
| the card you named is activated and moves to your spell/trap row | 🟢 real | a move the answer names |
| **battle resolution — who wins, what is destroyed, damage** | 🔴 **NOT SHOWN** | The prototype **stops at the declaration.** An earlier revision destroyed the target when the attacker's ATK exceeded the target's DEF, which is not the rule, and produced exactly the impossible outcome the pass reported. Resolving it correctly means implementing rules the engine already implements — the trap the last round fell into. The dock now says so on screen in the prototype's own stub voice: *"(prototype) the engine resolves the battle; this prototype stops at the declaration."* |
| **life points** | 🔴 **never move** | Same reason. No scenario claims otherwise; the `handover` feed contains a recorded `LP_CHANGE` event whose board consequence the prototype does not apply — that mismatch is real and it is the pass's F-04. |
| the feed rail's contents | 🟢 real for recorded events, 🟡 authored for events the answer generates | Every generated row names only what the answer named. No row asserts a consequence. |

**The rule now applied throughout: if a scenario cannot show a truthful outcome, it stops at the
decision and says so, rather than showing a false result.**

**Nothing recorded was reshaped to fit.** Where a recorded frame disagreed with what the design
wanted, the frame won and the disagreement became a delta: `ChainPrompt.selects` carrying
`code:0, name:""` for the asked player's own card became ND-9; `DECISION_CONTEXT` firing twice in
fifteen scenarios with no caption became MH-3b.

---

## 3 · What I drove, with evidence

Run against the built prototype, real mouse events at real coordinates, 1440×900, Chromium,
`ignore_https_errors=True`.

| Claim | Evidence |
|---|---|
| Tribute summon completes and **the chosen tribute is the card that dies** | Driven both ways. Confirm read `Tribute Thunder King Rai-Oh (Monster 1) — after this you cannot cancel` / `(Monster 2)`; the board fingerprints differ in exactly the tributed slot. `06-answer-outcome-matrix.md` §SelectTribute. |
| The attack-target step is never declined by the client | With one legal target the receipt reads `ANSWERED FOR YOU · Attack Mobius the Frost Monarch` and the attack proceeds. With more than one it is presented (A5). `classify.ts` contains no `cancelable`. |
| **PRD B3 — nothing occludes anything** | `document.elementFromPoint` at the centre of every hand card, every phase button, `End Turn`, `Resign`, and both dock verbs, in the chain scenario with the dock at its tallest: **0 failures**. |
| The answer-fidelity invariant, by **enumeration** | 5 decision points, **19 answers**, **0 collisions**, 1 legitimately converging pair reported in its own section. `answer-matrix.py` exits non-zero on a collision and exited 0. |
| Enumeration found a real defect a sample would not have | Two recorded tribute candidates are both `Thunder King Rai-Oh`. The first run reported a collision on the end-phase discard, because two copies of one card leave an identical board. Fixes: the confirm label appends the slot when two candidates share a name; the feed's `MOVE` row names the source slot. |
| Zero console errors | `pageerror` captured across all 14 scenarios and the whole matrix run: none. |
| Zero inline style objects | `grep -c "style={{" spikes/duel-redo-proto/src` → 0. |
| Every state screenshotted | 23 PNGs in `shots/` — 15 scenario states plus 8 mid-flow frames from the tribute and attack walks. |

---

## 4 · What I did NOT verify, and will not claim

- **All motion.** Every duration, easing and transition in this design is **authored and
  unverified**. A still frame cannot show a transition that is too slow, too abrupt or absent. The
  CEO reviews motion. Values are six tokens in one file so revision is cheap. **This survives
  ZUH-131 intact:** the pacing study reached only the long end of the scale and **refuses** to give a
  number for `--m-instant`, `--m-quick`, `--m-base`, `--m-settle` or the 150 ms hover threshold, and
  gives none for `--m-narrate` or `--m-gap`. `09-pacing-application.md` names what would settle each.
- **Pace and feel.** Same reason. The `--m-gap` round-trip beat (260 ms) is a guess at what a real
  WebSocket round trip feels like; the recorded capture has real inter-frame timings I did not
  mine for it. ZUH-131 names two 4 fps windows that would measure it and did not have them.
- **The ZUH-131 pacing footage.** Read and applied — `09-pacing-application.md`, budget by budget.
  What it changed is the **long** durations (the receipt's and the error line's timers, both deleted);
  what it could not touch is everything sub-second.
- **Anything below 1440×900.** Out of scope per G1 and not tested. Nothing sub-1440 is recorded as
  passing.
- **Audio.** Not designed.
- **Accessibility beyond `aria-label` and role attributes.** Not audited.
- **The pile inspector and the chain strip.** Specified, not built, not seen. §1.2.
- **That any of this works against the real server.** The prototype replays recorded frames; it has
  no socket. Reconnect, error handling, concurrency and persistence are all faked.
- **The claim that ND-9's replay implications are safe.** I reasoned that responses are index-based
  so adding identity to decision payloads cannot change replay. I did not test it. It is flagged in
  `05-backend-delta.md` §3 as the one delta with a replay question attached.
- **Every outcome after an answer.** See §2a. Battle and life points are not modelled at all.
- **Six of the nine major findings from the usability pass.** Three are fixed: F-06 and F-05 fell
  directly out of a blocker fix, and **F-11 was fixed on its own merits** — the phase rail reporting
  `M1` while an attack-target question is open is the screen stating something untrue, which is
  requirement D1's class, on the surface the player uses to orient. The remaining six majors, all
  minors and both cosmetics are **deliberately held** pending the CEO's own pass, so his findings
  can re-rank them and remain attributable.

---

## 8 · The independent usability pass, and what changed because of it

An independent evaluator drove all 14 scenarios with no access to the design rationale or the
source: **3 blockers, 9 major, 8 minor, 2 cosmetic.** Full findings at `../usability/findings.md`.

| Blocker | Fixed | How |
|---|---|---|
| **F-01** — the confirm control named a card the player had not selected | ✅ | Root cause was **not** the evaluator's guessed off-by-one. A hand-authored fixture assigned one literal card name to every blank candidate, so the **label and the response came from different sources**. The literal is deleted; identity is now joined from the recorded `STATE` snapshot. See §2a and `05-backend-delta.md` §2a. |
| **F-02** — all three end-card routes inert | ✅ | `Review board` lifts the scrim, re-enables inspection and leaves a `Duel over — show result` pill; `Play Sakura again` starts a fresh duel; `Back to Home` is **disabled and labelled** `(prototype: outside the duel screen)`. `Resign`, `Exit` and `Settings` were inert too — `Resign` is now a two-step confirm that ends the duel, because requirement **E1** calls it the guarantee of last resort and an inert one made E1 a claim the screen did not honour. `Exit` and `Settings` are disabled and labelled. |
| **F-11** — the phase rail reports the wrong phase while a question is open | ✅ | Not a blocker on the list, fixed anyway: the rail now reads `STATE.currentPhase`, the engine's own value carried on every snapshot, instead of inferring the phase from the kind of decision being held. Verified identical before / during / after an attack-target question, and still following the engine when the phase really advances. |
| **F-03** — `Esc closes` advertised, no key handler anywhere | ✅ | `Escape` dismisses the verb cluster, then the inspector, then takes the player's own cancel where one exists. Background click and re-clicking the same card also dismiss; the cluster has a visible `✕`. **`Escape` deliberately does NOT answer an OFFER** — declining a chain window is a substantive game answer, not an escape, and that is the distinction the classification law draws. My reading; flagged. |

### The finding that mattered more than the instance

**The answer matrix passed 19 of 19 while F-01 was live**, because it compares end *states* and
never reads the *label*. Those are two invariants, not one. The gate now checks both:

- **A · distinct outcomes** — unchanged.
- **B · label fidelity** — the app publishes `window.__lastSubmit`, whose card identities are
  resolved **from the response's own indices**, and the gate asserts the confirm label and the
  selection line contain them. Two independent paths; a label sourced from anywhere else fails.

**Verified the gate can fail:** the original defect was deliberately reintroduced and the gate
reported 6 label-fidelity failures naming the exact mismatch (`submits 'Heavy Storm' but confirm
label says 'Select Dimensional Prison'`). A gate that passes but cannot fail is not a gate.

---

## 5 · The one prototype-only affordance

`away` scenario: a button reading `(prototype) simulate the grace period elapsing`. It exists
because no `PRESENCE` frame exists to drive the transition (ND-10). It is labelled as prototype
chrome on screen so nobody mistakes it for product.

---

## 6 · How to open it

**There are no branch preview deployments for `proto/*` on this repo** (`deploy.yml` fires on
`master` only). Delivery is:

1. **A single self-contained HTML file** — `spikes/duel-redo-proto/dist/index.html` after
   `npm install && npm run build` in that folder. It opens straight from `file://` with no
   toolchain, no server and no network except card art.
2. **Screenshots of every reachable state** — `design/shots/*.png`, 23 files.
3. **The branch and SHA** — see `00-README.md`.

To re-run the gate: `npx vite preview --port 4321 --strictPort` then
`python3 answer-matrix.py http://localhost:4321/ <out.md>`. It exits non-zero on a collision.
