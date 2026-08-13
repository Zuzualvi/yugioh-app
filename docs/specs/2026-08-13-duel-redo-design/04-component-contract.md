---
linear_project: Duel Experience Redo
---

# 04 · Component contract

What engineering builds. Real component names are used wherever one exists on `master` so this is
an **extension of the shipped tree, not a replacement of it** — the paths below are real.

**Prototype reference:** branch `proto/duel-redo`, `spikes/duel-redo-proto/`. The prototype is
disposable. What survives is this contract, the fixtures, and the presentation layer.

**⚠ You do not own the presentation layer.** ZUH-120 owns the stylesheet, the vocabulary, the
markup contract, the motion specification and the enforcement mechanism. This contract names
classes and structure; ZUH-120 revises them. **Zero inline style objects** is the hard rule at
both ends.

---

## 0 · The four normative rules

### CC-A1 · The classification law is enforced at source level

`substantiveAnswerCount` / `mayAnswerWithoutAsking` / `theOnlyAnswer` live in **one module**, and a
test asserts that the identifier `cancelable` **does not appear in it**. That is PRD **A2** made
mechanical: cancelability cannot be an input to the auto-answer decision if the word is not in the
file. Reference implementation: `spikes/duel-redo-proto/src/proto/classify.ts`.

A second test asserts that **no code path anywhere constructs a decline/cancel response
(`indices: null`, `index: null`, `order: null` used as an abort) except from a handler bound to a
control the player pressed.** That is PRD **A3**.

### CC-A2 · The answer-fidelity invariant — TWO checks, tested by ENUMERATION

**A · distinct outcomes.** For any decision with more than one legal answer, distinct answers must
produce distinct observable outcomes.

**B · label fidelity.** The confirm control and the selection line must **name the answer being
submitted**.

🔑 **These are two invariants and A does not imply B.** A passed 19 of 19 on this prototype while
the chain window's confirm named a card the player had not selected, because A compares end states
and never reads the label. The previous project carried them as separate requirements F13 and F14
for exactly this reason, and F14 passing is what made everyone comfortable. **A gate that checks
outcomes and not labels is how this defect family reached the CEO twice.**

**How B is enforced.** The label and the response must derive from the same value —
`selection: number[]` — and `confirmLabelFor(d, selection)` and `responseFor(d, selection)` both
read it and nothing else. That is necessary and *not sufficient*: the failure that shipped had both
reading `selection` while the **label's card identity** came from fixture data. So the submit path
publishes `window.__lastSubmit`, whose identities are resolved **from the response's own indices**,
and the gate compares them against the DOM's label text. Two independent paths.

⚠️ **A card identity may never come from anywhere except the decision payload or the board
snapshot.** No literal, no fixture string, no ordinal dressed as a name.

**Test by enumeration, never by sample.** `spikes/duel-redo-proto/answer-matrix.py` walks every
answer at every multi-answer point and exits non-zero on a collision; it descends from
`docs/specs/2026-08-06-duel-ui-fixtures/answer-matrix.py` on `master`, which remains the reference
implementation. Port it into the repo's test runner and **keep the non-zero exit** — it is a gate,
not a report.

Result at the time of writing: **5 decision points, 19 answers, 0 outcome collisions, 16
card-naming answers label-checked, 0 label-fidelity failures**, 3 legitimately converging pairs
reported separately. See `06-answer-outcome-matrix.md`. The gate was verified able to **fail**: the
original defect was reintroduced deliberately and it reported 6 label-fidelity failures.

### CC-A3 · Every persistence rule carries its cessation condition

No component may hold state "until something replaces it". The audit table is 01 §7 and it is part
of this contract. A PR that adds a persisting object without naming what ends it does not pass
review. *This exists because the previous PRD required the intent presentation to survive a
message gap and never blank, and it was implemented as "never clear the pending decision".*

### CC-A4 · Dismissing an affordance is not submitting a game answer

**Normative. This is a rule, not a preference, and it is the distinction the whole
classification law rests on.**

- **Escape closes a verb cluster.** It closes the inspector. It takes the player's own cancel on a
  STEP where the engine offers one. All of those dismiss an affordance or withdraw an intent the
  player started, and none of them is an answer.
- **Escape never declines a chain window**, or any other OFFER. Declining an OFFER is a
  *substantive answer with game consequences* — a real, potentially losing decision — and
  **no keyboard event may submit one.**

The blurring of those two is how the previous prototype shipped an `Escape` that *committed* an
irreversible tribute step and destroyed a card the player never chose. "Escape declines or
dismisses" is not precise enough to build from: declining and dismissing are the two sides of
exactly the line OFFER/STEP draws.

| Gesture | On a verb cluster | On the inspector | On a STEP with a player cancel | On an OFFER |
|---|---|---|---|---|
| `Escape` | closes | closes | takes the cancel | **nothing** |
| background click | closes | closes | nothing | nothing |
| re-click the same card | closes | — | deselects | deselects |
| `Enter` / any other key | **nothing, anywhere** | | | |

### CC-A5 · Nothing is indexed by absolute seat

No component receives a seat-indexed array of names or colours. Every name, tint, pronoun and
ownership badge resolves through `mySeat`. ZUH-118 breaks 9, 10, 20 and 25 are one defect —
`["You","Opponent"]` indexed by absolute seat — appearing in four places.

---

## 1 · Component tree

```
DuelScreen                          packages/web/src/screens/DuelScreen.tsx      REWORKED
├── useDuelConnection               NEW — frames in, model out
│   ├── useControl                  NEW — derives Control (01 §2.2)
│   ├── useIntent                   NEW — the Intent object + its cessation
│   ├── useDelta                    NEW — the Delta object
│   └── autoAnswer/                 REPLACES duel/responsePrompts.ts (deleted)
│       ├── classifyDecision.ts     NEW  — the static 20-variant table
│       ├── substantiveAnswerCount.ts NEW
│       └── theOnlyAnswer.ts        NEW
├── DuelTopBar                                                                    REWORKED
├── DuelStage                       packages/web/src/components/duel/board/DuelStage.tsx
│   ├── DuelBoard                   .../board/DuelBoard.tsx                        REWORKED
│   │   ├── FieldGroup              .../board/FieldGroup.tsx                       kept
│   │   ├── ZoneSlot                .../board/ZoneSlot.tsx                         REWORKED
│   │   ├── HandRow                 .../board/HandRow.tsx                          REWORKED
│   │   └── PileBadge                                                              kept
│   ├── VerbChipCluster             .../board/VerbChipCluster.tsx                  REWORKED
│   ├── PhaseRail                   .../board/PhaseRail.tsx                        REWORKED
│   │   └── TurnResourceLine        NEW
│   ├── ChainStrip                                                                 kept
│   ├── DuelDock                    .../dock/DuelDock.tsx                          REWORKED
│   │   ├── IntentLine              REPLACES .../dock/IntentRibbon.tsx
│   │   ├── QuestionPanel           REPLACES .../dock/QuestionBar.tsx
│   │   │   └── DecisionRenderer    .../dock/DecisionRenderer.tsx                  REWORKED
│   │   ├── AutoAnswerReceipt       .../dock/AutoAnswerReceipt.tsx                 REWORKED
│   │   ├── WaitingPanel            NEW
│   │   ├── DeltaStrip              NEW
│   │   └── OpponentAwayBanner      NEW
│   ├── CardInspector               .../inspect/CardInspector.tsx                  REWORKED
│   │   ├── CardArt                 .../inspect/CardArt.tsx                        kept
│   │   └── ProvenanceBadge         .../inspect/ProvenanceBadge.tsx                kept
│   └── PileInspector                                                              kept
├── EventFeedRail                   REPLACES .../log/EventLogRail.tsx (rail is permanent)
└── DuelEndOverlay                  .../DuelEndOverlay.tsx                         REWORKED

DELETED OUTRIGHT
  packages/web/src/duel/responsePrompts.ts        the verbosity mechanism (PRD change 3)
  ClockPanel + every clock surface, prop and band  (PRD change 1)
  VerbChipCluster.deriveRefusalReason              (PRD change 5, D1/D2)
  SettingsPopover: Response prompts / Choose zones / Self chain / Activation order
```

---

## 2 · `useDuelConnection` — the model

```ts
interface DuelModel {
  mySeat: Seat;
  control: "mine" | "theirs" | "resolving" | "connecting" | "disconnected" | "ended";
  board: DuelStateSnapshot;
  decision: DuelDecision | null;      // cleared the instant a response is sent
  context: DecisionContext | null;    // MH-3 / MH-3b
  intent: Intent | null;
  delta: Delta | null;
  receipts: Receipt[];
  feed: DuelEvent[];
  chain: ChainLink[];
  presence: Record<Seat, "connected" | "away">;
  names: Record<Seat, string>;        // ND-11
  ended: { winner: Seat | null; reason: DuelEndReason } | null;
  error: string | null;
  normalSummonSpent: boolean;
}
```

**Frame handling — every frame the server sends must have a case.**

| Frame | Effect | Note |
|---|---|---|
| `SEAT_ASSIGNED` | sets `mySeat` | |
| `STATE` | replaces `board` | **must not clear `decision`** — the server sends `STATE` before `DECISION` |
| `EVENTS` | appends to `feed`, folds `chain`, sets `normalSummonSpent` on own `SUMMON` | |
| `DECISION` | sets `decision`; runs the classification law | |
| `DECISION_CONTEXT` | sets `context` | **the missing case — `grep DECISION_CONTEXT packages/web/src` returns nothing today** |
| `CONTROL` (ND-8) | sets `control` | replaces `CLOCK` |
| `PRESENCE` (ND-10) | sets `presence` | |
| `DUEL_END` | sets `ended`, clears `decision` and `intent` | |
| `ERROR` | sets `error` for the amber strip | **never rendered verbatim if it is a `not your turn` class message — off-clock nothing is clickable, so one arriving is a bug** |
| `MSG` | ignored | the typed `EVENTS` feed is the source |

**Acceptance criteria**

| # | Criterion |
|---|---|
| M1 | Sending a response sets `decision = null` **synchronously, in the same tick**, before any acknowledgement. |
| M2 | A `STATE` frame never clears `decision` or `intent`. |
| M3 | `control === "mine"` ⟺ an unanswered `decision` is held for `mySeat`. No component computes this independently. |
| M4 | A `DECISION` frame with no preceding `DECISION_CONTEXT` renders — every context field is optional. |
| M5 | An unknown frame `type` is ignored without throwing and without clearing anything. |

---

## 3 · `autoAnswer/` — the classification law

```ts
type DecisionClass = "OFFER" | "STEP";
const DECISION_CLASS: Record<DecisionKind, DecisionClass>;   // static, all 20
function substantiveAnswerCount(d: DuelDecision): number;    // never reads `cancelable`
function mayAnswerWithoutAsking(d: DuelDecision): boolean;   // === count === 1
function theOnlyAnswer(d: DuelDecision): DuelDecisionResponse; // throws if not exactly 1
function playerCancelExists(d: DuelDecision): boolean;       // ONLY decides what the PLAYER may press
```

The table is 01 §3.3. `playerCancelExists` may read `cancelable`, because it decides what control
to render for the player — not whether the client may answer. That distinction is the entire
content of PRD A2 and it must be preserved in the file layout: the two functions live in separate
files so the import graph makes the separation visible.

**Acceptance criteria**

| # | Criterion |
|---|---|
| AA1 | The identifier `cancelable` does not appear in `substantiveAnswerCount.ts`, `classifyDecision.ts` or `theOnlyAnswer.ts`. Enforced by a source scan. |
| AA2 | `theOnlyAnswer` never returns a decline/cancel. Unit test over every variant. |
| AA3 | Attack-target `SelectCard` with `cards.length > 1` is **presented**, whatever `cancelable` is. (PRD A5) |
| AA4 | Attack-target `SelectCard` with `cards.length === 1` is answered with `indices: [0]` and a receipt naming the target. **Never `indices: null`.** |
| AA5 | Every `ChainPrompt` with `forced === false` is presented, whatever its candidate count. |
| AA6 | `SelectZone` with `zones.length > 1` is presented. (See 01 §8.1 — this reverses the old `Choose zones: OFF` default and is surfaced for the CEO.) |
| AA7 | Each of the 20 variants has a unit test asserting its class and its auto-answer condition. |

---

## 4 · `DuelDock`

**Props**

```ts
interface DuelDockProps {
  model: DuelModel;
  onAnswer(response: DuelDecisionResponse): void;   // the ONLY submit path
  onCancelIntent(): void;
  onClaimDuel(): void;
  onDismissDelta(): void;
}
```

**Variants** — mutually exclusive, in this precedence: `ended` › `seating` › `away` ›
`disconnected` › `question` › `waiting` › `armed`.

**States, motion and copy:** 02 §3. **Layout: the dock is a laid-out row with a reserved height
(`--dock-h`), never `position: fixed`.**

**Acceptance criteria**

| # | Criterion |
|---|---|
| D1 | `document.elementFromPoint` at the centre of **every hand card and every visible interactive element** returns that element or a descendant, in every dock variant. (PRD B3.) Run it with the dock at its tallest content. |
| D2 | The dock never has `position: fixed` or a `vh`-based height in any rule that applies to it. |
| D3 | Exactly one variant renders at a time. Asserted by a test that mounts each precedence pair. |
| D4 | No dock string names a component. `Waiting for engine…` must not appear in the source. |
| D5 | When `presence !== "connected"` and control is theirs, the waiting reading is **absent** — the away banner is the only statement. |

### 4.1 `QuestionPanel` + `DecisionRenderer`

**Line 1 ladder (normative):** `context.caption` → `context.activatingCard` → the stated fallback
`Something happened that you may respond to.` + `The engine did not say what.` **Never a bare
verb.**

**Candidate placement (normative):** a candidate that has a tile on the board is picked **on the
board**; the panel renders thumbs only for candidates in a pile.

**Candidate label (normative):** the card's name if the decision carries one; else what we honestly
know — `your set card 1`, `their hand card 3` — derived from `controller` and `location`, **never**
`Face-down card` for a card the asking player owns. **If two candidates share a name, both labels
gain their slot** (`Thunder King Rai-Oh (Monster 1)`).

**Confirm label (normative):** `confirmLabelFor(decision, selection, mySeat, intentVerb)`. Reads
`selection` and nothing else. Where the next step has no player cancel, the label gains
` — after this you cannot cancel`.

**Every variant has an answer path.** ZUH-118 finding 27: five variants render read-only with no
confirm and no decline. With the clock deleted, a player who reaches one is locked permanently.

| Variant | Answer space | Confirm sends |
|---|---|---|
| `SortChain` / `SortCard` | drag-reorder strip, **default order pre-accepted** | `order: null` if untouched, else the order |
| `SelectCounter` | per-card steppers + running total | `counters: number[]` |
| `SelectSum` | multi-select + running sum against `amount` | `indices` |
| `AnnounceCard` | search field over `/api/cards` + result thumbs | `code` |
| `AnnounceNumber` | number chips | `valueIndex` |
| `AnnounceRace` / `AnnounceAttrib` | type / attribute grid | `races` / `attributes` |
| `SelectDisfield` | board zone highlight | `indices` |
| `SelectUnselectCard` | one running-total multi-select driving N round trips | `index` per trip, `null` to finish |

**Acceptance criteria**

| # | Criterion |
|---|---|
| Q1 | `canConfirm()` has an explicit case for **all 20** variants. A `default: return false` is a defect. |
| Q2 | For every variant, a mounted test asserts the confirm button is enabled for at least one legal selection. |
| Q3 | `SelectUnselectCard` sends a **different** index for select and unselect. (`DecisionRenderer.tsx:636` today has identical branches.) |
| Q4 | **No keyboard event submits or commits a decision** (CC-A4). `Escape` dismisses the verb cluster, then the inspector, then takes the player's own cancel where one exists. It never answers an OFFER. |
| Q7 | The instruction line is generated from the zones the candidate set occupies, not hard-coded. |
| Q5 | The answer-outcome enumeration passes (CC-A2). |
| Q6 | A decision whose candidate list contains two entries with the same `name` produces two **different** confirm labels. |
| Q8 | **No question times out** (ZUH-131 B4). No timer, interval, countdown, auto-answer-on-expiry or fade exists in this component or its children; asserted by a source scan for timer APIs in the question path **and** by a test that holds one question for 60 s and finds the sentence, both control labels and the enabled state unchanged. A real player held one decision for 25–30 s in the observed match. |
| Q9 | **The amber error line has no timer** (B2). It is cleared only by the question being re-answered or replaced. |

### 4.2 `IntentLine`

**Props:** `{ verb, subjectName, cancelable, commitsNext, onCancel }`.
No step array, no step index, no budget, no glyph.

| # | Criterion |
|---|---|
| I1 | The line does not unmount between sub-decisions of one intent, including across a `STATE`-then-`DECISION` gap. |
| I2 | It **does** unmount on: response sent and control not retained · player cancel · `DUEL_END` · socket drop. (CC-A3.) |
| I3 | When `cancelable === false` the cancel control is **replaced by flat text**, not disabled. |
| I4 | `commitsNext` is derived from the client's own verb template and is used for **one** thing: the confirm-label suffix. It is never printed as a count. |

### 4.3 `AutoAnswerReceipt`

| # | Criterion |
|---|---|
| R1 | **It has no lifetime and no timer.** Asserted by a test that mounts a receipt, advances fake timers by 60 s with no other input, and finds it still in the DOM. *The shipped receipt measured **10 ms**; its 2.4 s replacement was deleted by ZUH-131 B1.* |
| R2 | Removed **only** by: a question taking the dock band · the player's next action · control leaving me · `DUEL_END`. No timer removes it, and no unrelated re-render does. Each of the four has its own test. |
| R5 | **A re-armed board does not remove it.** After the client answers a step, control returns with `IdleCommand`/`BattleCommand`; a test drives that path and asserts the receipt survives. Getting this wrong makes the receipt shorter-lived than the timer it replaced. |
| R3 | Read-only: no primary button, no imperative copy, past tense. |
| R4 | Names what was answered, using the same label function as the confirm control. |

### 4.4 `DeltaStrip`

| # | Criterion |
|---|---|
| DL1 | Appears when control transitions to `mine` **and** ≥1 event arrived while it was away. |
| DL2 | Never auto-fades. Cleared by: first action this turn · dismiss · control leaves · `DUEL_END`. |
| DL3 | Expanding it marks the feed rail at the same boundary. |
| DL4 | With zero events it is **absent**, not an empty strip. |

---

## 5 · `DuelBoard`, `ZoneSlot`, `HandRow`

**`ZoneSlot` props:** `{ card, ref, mySeat, candidate, selected, zonePick, onClick, onHover, artBroken }`.

**Normative changes**

1. **`actionableCards` must be populated.** `DuelBoard.tsx:99` declares `const actionableCards:
   CardRef[] = []` and never fills it, so the select-then-verb grammar gives no indication of what
   affords anything and the only way to find out is to click each card.
2. **A tile's identity is text plus art, never art alone.** The name renders first; the image
   arrives on top. `HandRow.tsx:168-170` hides the `<img>` on error and leaves a blank rectangle.
3. **Position bits are meaningless in the hand.** ocgcore reports every hand card as `position: 10`.
   A hand card is never face-down and never rotated.
4. **`CardArt` has a bounded deadline (4 s).** An unknown passcode returns a **JSON 404 body, not
   an image**, so HTTP 200 is not proof a JPEG arrived — `onError` on the `<img>` is the real test.
   At the deadline the tile is exactly what it was before art existed.

| # | Criterion |
|---|---|
| B1 | With the art host unreachable, every board tile and every hand card still renders its name. |
| B2 | Off-clock, no board element is clickable and no click produces a server response. (PRD B2.) |
| B3 | A card that affords nothing produces a shake and **no text**. `deriveRefusalReason` is deleted; the string `has already attacked` does not appear in the source. |
| B4 | Candidates are lifted above the dim scrim wherever they live — hand, field, or a pile badge. |
| B5 | Ownership: `--own` for `mySeat`, `--opp` otherwise, computed per render. No literal `0`. |
| B6 | The verb cluster is dismissible by `Escape`, background click, re-click and a visible `✕`. Any hint text it renders must be true of the build that renders it. |
| B7 | **Card identity is resolved from the board snapshot when the decision payload omits it.** `resolveCode(board, ref)` — the snapshot is not redacted from its owner, so a decision carrying `code: 0` for a card the player owns is still nameable. This is why ND-9 is should-have rather than must-have. |

---

## 6 · `PhaseRail` + `TurnResourceLine`

| # | Criterion |
|---|---|
| P1 | `End Turn` is reachable at all times during your turn and is never inside a panel that can vanish. |
| P2 | Nothing overlays the rail. (The feed rail is permanent; there is nothing left that can.) |
| P3 | `engineBusy` is actually passed. `PhaseRail.tsx:60,100-114` draws it and `DuelBoard.tsx:147-159` never passes it, so it is permanently false. |
| P6 | **The current-phase marker is read from `STATE.currentPhase` and from nothing else.** It must never be inferred from the kind of decision being held: an attack-target `SelectCard` is not a `BattleCommand`, and inferring from the kind made the rail report Main Phase 1 while the player was mid-declaration of an attack. That is D1's class — the screen stating something untrue — on the surface the player uses to orient. A test asserts the `current` phase is identical before a question opens, while it is open, and after it is cancelled. |
| P4 | `TurnResourceLine` reads the **event feed**, not `IdleCommand.summons.length`. It resets on `turnNumber` change. |
| P5 | No clock prop, no deadline prop, no urgency band exists anywhere in this component or its tests. |

---

## 7 · `EventFeedRail`

| # | Criterion |
|---|---|
| F1 | The rail is permanent at `--rail-w`. Expanding or collapsing it is not a feature; there is nothing to reflow. |
| F2 | Rows are structural, never prose. |
| F3 | A `MOVE` row names the source slot as well as the card. (Two copies of one card otherwise leave an identical record — the enumeration caught this.) |
| F4 | `LP_CHANGE` rows read `{name} −1200 LP`, resolving `{name}` through `mySeat` (ND-4 is shipped; the row must use it). |
| F5 | An unrecognised event kind renders its own kind and the rail keeps going. |
| F6 | Reconnected with no backfill: `Earlier turns are not available.` — never "the duel has not started" while the board shows turn 8. |

---

## 8 · `CardInspector`

| # | Criterion |
|---|---|
| C1 | **The panel shows the card the player touched.** A test asserts the passcode passed at every call site equals the clicked card's code. *Three shipped call sites pass a literal `0`.* |
| C2 | `code === 0` renders `Face-down card` **only when the card is not the viewer's own.** |
| C3 | Art loading never blocks the text. |
| C4 | Art failed → no image, no placeholder, no broken glyph; the panel is exactly its pre-art layout. |
| C5 | The provenance badge is gated on `preErrataText === true` **and** art loaded. |
| C6 | The panel never occludes a control or a card the player must reach (it lives in the reserved gutter). |

---

## 9 · `DuelEndOverlay`

| # | Criterion |
|---|---|
| E1 | Result, cause and both totals are resolved through `mySeat`. A test drives **both seats** and asserts each sees itself as "You". *The shipped overlay told the winner that they timed out.* |
| E2 | `reason` maps: `normal` → `{loser}'s life points reached 0.` · `resign` → `{who} resigned.` · `abandoned` → `{who} left the duel and did not come back.` · anything else → `The duel ended.` + the string verbatim. |
| E3 | There is no `timeout` reason and no clock anywhere in this component. |
| E4 | The board behind stays inspectable after `Review board`, and a persistent control reopens the result card. Every route on this card does something; a dead route here is a defect, not prototype scope. |
| E5 | Behind the overlay the dock reads `The duel has ended.` — **not** the waiting placeholder. |

---

## 10 · Requirement E1 — the guarantee of last resort

**Every state of the screen offers at least one action that ends or advances the duel.**

New, and downstream of the clock's deletion: there is no longer a timeout to release a player from
a state the client cannot answer. `Resign` is permanently reachable from the top bar (two-step
confirm), and every decision variant has an answer path (§4.1). A test enumerates the dock's
variants and asserts that in each one at least one enabled control exists that advances or ends
the duel.

---

## 11 · Presentation layer — what is handed to ZUH-120

- `spikes/duel-redo-proto/src/styles.css` — the approved stylesheet, ported, **plus a token layer**
  for space, radius, type, layout, motion and depth. The ported sheet tokenised **colour only**
  (14 custom properties, all hues); every spacing, size, radius and duration in it was a literal at
  the point of use, which is the mechanism by which 251 inline style objects came out of a build
  that took one stylesheet in. The 1,546 ported lines are **not** retokenised here — that is
  ZUH-120's work, and the token set exists to retokenise against.
- The markup/class contract implied by the components above. A stylesheet without it carries
  nothing: the same rules against different markup produce a different screen.
- **Motion is tokenised the same way colour is.** Seven duration tokens and two easings; every
  animation and transition in the prototype uses one. Revising the surface's pace is editing seven
  lines. `prefers-reduced-motion` flips the tokens, not per-component branches.
- **Hard rule, both ends: zero inline `style={{}}` objects.** The prototype has none. If a value is
  needed and no token has it, a named token is added.
