---
linear_project: Duel Experience Redo
---

# Evidence index — ZUH-119 player needs model

Every non-obvious claim in `../player-needs-model.md` and where it came from. Ordered by source
type so a reader can audit one channel at a time.

**Method note.** I did not run the application. Source claims are reads of `master` in
`/workspace/yugioh-app` at the state of commit `f86683c` (`master` head, docs-only tip; last
product-bearing commit judged by CI was `82e2683`). Screenshot claims are reads of PNGs produced by
the parallel ZUH-118 evidence run, inspected 2026-08-12 ~22:00–22:05 UTC while that run was still
writing files.

---

## A · Shipped source `[C]`

| Claim | Location |
|---|---|
| Client discards the `DECISION_CONTEXT` frame — no case in the message switch; `MSG` frames also dropped | `packages/web/src/screens/DuelScreen.tsx:150-184` |
| Pending decision is cleared only by a new `DECISION` or `DUEL_END`, never on handover | `DuelScreen.tsx:156-178` |
| Clock fallback duplicates one deadline into both seats when the tuple is absent | `DuelScreen.tsx:293` |
| Opponent name is the literal `"Opponent"` (top bar, log, result card) | `DuelScreen.tsx:347,387,413` |
| Pre-duel state is `Waiting for duel to start…` / `Connecting…` | `DuelScreen.tsx:402` |
| Mode derived solely from presence of a decision; `waiting` only when the client holds none | `packages/web/src/duel/useDuelInteraction.ts:507-517` |
| `status` string `Waiting for engine…` | `useDuelInteraction.ts:526-531` |
| `Inspect` verb and answer-mode card clicks pass literal passcode `0` to the inspector | `packages/web/src/components/duel/board/DuelStage.tsx:169,194` |
| Waiting banner and dock placeholder both require `mode === "waiting"`; `no-decision` text is `Waiting for engine…`, shared with the ended mode | `DuelStage.tsx:256-261,292,376-383` |
| `DuelDock` is rendered without a `caption` prop | `DuelStage.tsx:385-400` |
| Resolving chain link auto-pushes its text to the inspector (the one path that passes a real passcode) | `DuelStage.tsx:136-147` |
| `action-panel` must be mounted at all times — an E2E contract, documented in the component header | `DuelStage.tsx:17-22,351-357` |
| Inspector renders `🂠 Face-down card` for passcode `0` | `packages/web/src/components/duel/inspect/CardInspector.tsx:172-183` |
| No hover-to-inspect anywhere: three call sites of `inspectCard(`, two pass `0` | repo-wide grep, `packages/web/src` |
| `deriveRefusalReason` returns "This monster has already attacked." for any MZONE card absent from `attacks[]`, including the opponent's | `packages/web/src/components/duel/board/VerbChipCluster.tsx:245-265` |
| Chain-prompt sentence is the bare `Chain a card or effect?` when no caption is supplied | `packages/web/src/components/duel/dock/DecisionRenderer.tsx:212-218` |
| Confirm label names the card | `DecisionRenderer.tsx:86-99` |
| Intent ribbon: lock glyph, `Past this point you cannot cancel`, `Next step commits — cannot be undone`, step budget | `packages/web/src/components/duel/dock/IntentRibbon.tsx:100-184` |
| Both clock rows; banked row has no ticking interval and is recomputed against `Date.now()` on every frame; urgency gated on `isOwn && running`; `<= 0` renders `0:00` | `packages/web/src/components/duel/chrome/ClockPanel.tsx:47-70,61` |
| Clock rows are fed from `clock.deadlines[mySeat]` / `[oppSeat]` | `packages/web/src/components/DuelBoard.tsx:153-154` |
| Board tile is 58×82px; card image is `alt=""` + `aria-hidden`; no name text; own set cards at 0.65 opacity; opponent face-down as a back | `packages/web/src/components/duel/board/ZoneSlot.tsx:60-190` |
| Log empty states: `The duel has not started.` / `Earlier turns are not available.` / `— log resumes here —` | `packages/web/src/components/duel/log/EventLogRail.tsx:591,602,653` |
| Per-handover clock: deadline recomputed only when the on-clock seat changes; `seatDeadlines` starts `[null,null]`; `deadlines` tuple emitted only when the off-clock seat has a recorded deadline | `packages/server/src/duel/duelSocket.ts:49,85,604-628` |
| `DECISION_CONTEXT` carries caption + chain stack + activating card only — nothing about a summon trigger | `duelSocket.ts:521-556` |
| Reconnect sends `SEAT_ASSIGNED`, `STATE`, `CLOCK`, `DECISION` — no event backfill | `duelSocket.ts:860-900` |
| `DECISION_CONTEXT` exists on the wire | `packages/contracts/src/duel.ts:177` |
| Timer setting is named `perMoveSeconds`, 60–900 | `packages/contracts/src/duel.ts:17-20` |
| `ZoneCard` now carries `sequence`, `attack`, `defense`, `level`; field zone and deck counts exist | `packages/contracts/src/duel.ts:68-104` |
| Rock-paper-scissors auto-answered with constant `value: 1`; no first-player decision type in the decision set | `packages/engine/src/EdisonDuel.ts:111-113,227-236` |
| A cancel sent to `SELECT_PLACE` freezes the duel in a WAITING loop | `docs/reference/2026-08-07-duel-engine-runtime-facts.md` Q4 |

---

## B · Frames from the parallel ZUH-118 run `[O-118]`

Path: `/workspace/product/redo/evidence-118/shots/`. Captured by another specialist; I inspected the
images only.

| Frame | What is visibly in it |
|---|---|
| `s1-first-ten-seconds/05-first-t10s.png` | Ten seconds in: own hand is six blank grey rectangles (art not loaded, no names); opponent labelled `Opponent`; header reads `YOURS` with no turn number; `YOU 4:47 RUNNING` / `OPPONENT 4:58 BANKED` before the opponent has ever held control; opponent LP plate, `End Turn` and the log control clipped at the right edge; lower ~40% of the viewport empty. |
| `s2-turn1-handover/05-after-end-turn-3s.png` | After passing: header `THEIRS`; `YOU 5:00 BANKED` / `OPPONENT 4:58 RUNNING`; own hand art now loaded; no waiting indicator visible. |
| `s2-turn1-handover/06-offclock-verbs.png` | While `THEIRS` and the opponent's clock is running, clicking a hand card opens a live verb cluster: `Set` · `Inspect` · `Esc closes — costs nothing`. |
| `s2-turn1-handover/07-offclock-after-verb-click.png` | Choosing that verb produces `⚠ not your turn` as an error strip pinned to the top of the screen. |
| `s3-turn1-real/03-verbchips-hand0.png` | 1440px-wide frame: right-edge clipping of the opponent LP plate, `End Turn` and the log control at the declared floor; five of six hand cards blank, one with art; verb cluster overlaps the player's own spell/trap row. |

**Caveat carried into the main document:** one run, one deck, one viewport, still in progress when
read. Blank hand tiles are an art-loading condition and may be harness-specific; the *consequence* —
a tile has no textual identity to fall back to — is a source fact, not a harness fact.

---

## C · Previous design and companion specs `[D]`

| Claim | Location |
|---|---|
| Law 1 / Law 2 / ownership colour law; the auto-answer receipt as the third object | `docs/specs/2026-08-06-duel-ui-design.md` §0 |
| Thirteen surfaces, none of which is duel start | §1–13 |
| Board state table (`loading` = "Dealing…") | §2 |
| Verb chips; the withdrawn `release_param` claim (CTO correction: tribute count is not on the wire at idle time) | §3 + correction |
| Question Bar anatomy and the 20-variant table | §4 |
| Intent ribbon; client-owned step templates; the CEO quote tying the commit lock to the clock | §5 |
| Both clocks, `BANKED` labelling, escalation bands | §7 |
| Card inspector, three entry points, art-failure states | §8 |
| Log rail: complete, structured, collapsed by default; partial/backfill states | §10 |
| Waiting as a mode of the whole screen | §12 |
| Duel-end overlay | §13 |
| Auto-resolve register | §15 |
| The `Choose zones` contradiction, self-flagged | §16B |
| Deferred findings with their unblocking wire capability named (cost, omission reason) | §13a |
| Off-clock seat requirements R8.1–R8.3; open questions OQ-1..OQ-4 (incl. OQ-2, timer semantics) | `docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md` §8, §9 |

---

## D · Recorded usability pass `[U]`

Simulated persona, scripted browser, **against the prototype**, not against what shipped. Mined for:

| Finding | Used for |
|---|---|
| B2 — `Esc` committed an irreversible step | M7: players invent an exit if they cannot see one |
| B4 — decline performed the same action as confirm | M11: "did it take" is the deepest failure class |
| B5 — clock hit 0:00 and nothing happened, no escalation | M13, §7: the clock's cost to the design |
| M5 — cost invisible on the route users take | M4, M5, gap 7 |
| M6 — card text replaced the card being responded to | M11: a chain decision is a comparison |
| M7 — "no legal verbs" and no reason | M4, gap 5, W4 |
| M8/M9 — one unlabelled clock; hairline misread as a per-question timer | M13, §7 |
| M12 — "The duel has not started." on turn 8 | M3: the reconstruct-what-changed moment |
| "What passed" — chain prompt named who/what/where and auto-pushed the text | M11: the design was right and the build lost it |

---

## E · Competitor teardown `[T]`

`docs/reference/2026-08-05-duel-ui-competitor-teardown.md`, carrying its own `[V]`/`[R]`/`[I]` tags.

| Used | Section |
|---|---|
| Audience is DuelingBook-native; the incumbent is manual and asks nothing `[V]` | §0.4, DuelingBook §1 |
| DuelingBook has no clock at all; official rules say no time limit `[V]` | §7 |
| "Presence yes, shot clock no" was a flagged judgement call, not evidence `[I]` | §7 |
| Pile inspection must be free, instant, silent, unbroadcast — the incumbent broadcasts it `[V]` | §6 |
| Nobody ships completeness *and* structure in the log `[I]`; no client ships a delta | §5 |
| One question surface, never two — EDOPro's pathology `[V]` | §3b |
| Response-verbosity control is table stakes across all three automatic clients `[V]` | §7 |
| No automatic client plays Edison correctly today `[V]` | §8.11 |
| Position-select prompts were never observed in any client — an acknowledged blind spot | §8.7 |

---

## F · Edison rules `[G]`

`docs/reference/2026-07-17-edison-rules-reference.md`

| Rule | Used for |
|---|---|
| R01-B1 — the first player **draws** on turn 1; hand of 6 | M1: seat identity is inferable only by counting |
| R01-B2 — no Battle Phase for the first player on turn 1 | M1, M8: going first changes the opening shape |
| R06-B1 — after a summon that started no chain, the **turn player** may activate an ignition effect as CL1 before the opponent may respond | M11, gap 11: your window and their window are the same object |
