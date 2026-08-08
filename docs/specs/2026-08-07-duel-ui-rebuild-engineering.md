---
linear_project: Duel UI Rebuild
---

# Duel UI Rebuild — engineering spec

**Reader:** the engineer building one of the five slices below.
**Authority:** the PRD (Linear Project *Duel UI Rebuild*) is the requirements authority — requirement
IDs like `A1`, `C13`, `F14` refer to it. This document is the *how*: the exact contract shapes, the
slice boundaries, and the file ownership that keeps five engineers out of each other's way.

## Documents you must read before writing code

| Document | What it gives you |
|---|---|
| `docs/specs/2026-08-06-duel-ui-design.md` | The component contract. Normative §0a (answer-fidelity invariant) and §2 (keyboard contract). Per-component props, variants, states, acceptance criteria. **This is the design authority.** |
| `docs/specs/2026-08-05-duel-ui-intent-model-and-backend-delta.md` | Why each backend delta exists, with `file:line` evidence |
| `docs/reference/2026-08-07-duel-engine-runtime-facts.md` | The four engine facts, verified against a live core. Read this before assuming anything about zone arrays or SELECT_PLACE |
| `docs/reference/2026-08-05-duel-ui-competitor-teardown.md` | What Master Duel / EDOPro / DuelingBook actually do. Reference, not requirement |
| `docs/specs/2026-08-06-duel-ui-fixtures/` | Five fixture modules + `answer-matrix.py`, the F14 reference implementation |

`spikes/duel-ui-proto/` on branch `proto/duel-ui` **is not a source.** It is disposable and
structurally unmergeable. Use it only to disambiguate the component contract where the prose is
genuinely ambiguous. Never copy from it, never cite it as justification.

---

## The problem, in one paragraph

The duel screen is generated from the engine's decision protocol: ADR-0001's 20-variant
`DuelDecision` union has roughly one panel per variant in `packages/web/src/components/duel/decisions/`,
so the player waits to be asked a question instead of forming an intent and acting on the board.
It was also designed phone-first. Coverage is complete and the product is unusable — the two are
unrelated. The rebuild replaces the panel-per-variant render path with **one Question Bar and one
renderer**, and makes the board itself the thing the player acts on.

## Approach, and the alternative rejected

**Approach.** Land the wire changes first as purely additive, independently-shippable backend
slices; then rebuild the web screen on an integration branch and merge it once.

**Rejected: rebuild the web incrementally straight to `master`.** Cheaper to review, but every
intermediate state is a duel screen that is half old and half new — worse than the one we have, on
the branch that serves production. The backend slices are genuinely additive and do ship alone, so
they are exempt from this and go to `master` directly.

**Rejected: one engineer for the whole screen.** The component tree is ~25 components across four
concerns that partition cleanly on file boundaries. Three engineers with disjoint ownership and a
pre-specified seam is the better trade. The seam is `DuelStage`'s props, frozen in §Seam below.

---

## Contract — the part that must not drift

Everything here is **additive and optional**. No existing consumer breaks, no migration is required,
and the response-log replay path (`duelStore.appendResponseLog` → `replayEdisonDuel`) is untouched
because these change the *snapshot*, not the response log.

**ADR-0001 is not reopened.** The 20-variant `DuelDecision` union is unchanged by every item below.
`DuelEvent` is a *new* union alongside it, not a modification of it.

### C1 · `ZoneCard` — `packages/contracts/src/duel.ts` (MH-1)

```ts
export const ZoneCardSchema = z
  .object({
    code: z.number(),
    position: z.number(),
    /** Zone index within its location. Equals the array index in mzone/szone. */
    sequence: z.number().int().nonnegative().optional(),
    attack: z.number().int().nullable().optional(),
    defense: z.number().int().nullable().optional(),
    level: z.number().int().nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .passthrough();
```

### C2 · `DuelZones` — dense arrays, deck counts, field zone

**The engine returns dense arrays; we currently destroy that.**
`buildStateForSeat.ts` does `.filter((c): c is Record<string, unknown> => c != null)`, which collapses
the holes and makes array index ≠ zone sequence. That single line is the whole of MH-1's board-
targeting problem. Verified against a live core (`docs/reference/2026-08-07-duel-engine-runtime-facts.md`):

- `MZONE` is length **7** — indices 0–4 are the regular monster zones, 5–6 are Link zones and are
  **always null in Edison**.
- `SZONE` is length **8** — indices 0–4 are the regular spell/trap zones, **index 5 is the field
  zone**, 6–7 are pendulum zones and are **always null in Edison**.
- `duelQueryLocation(FZONE)` always returns length 0. There is no separate field-zone query. A field
  spell is `szone[5]` and nowhere else.

```ts
const ZoneSlotSchema = ZoneCardSchema.nullable();

export const DuelZonesSchema = z.object({
  p0_hand: z.array(ZoneCardSchema),        // unchanged: dense-by-nature, no holes
  p1_hand: z.array(ZoneCardSchema),
  p0_mzone: z.array(ZoneSlotSchema),       // CHANGED: length 5, nulls preserved
  p1_mzone: z.array(ZoneSlotSchema),
  p0_szone: z.array(ZoneSlotSchema),       // CHANGED: length 5, nulls preserved
  p1_szone: z.array(ZoneSlotSchema),
  p0_fzone: ZoneSlotSchema,                // NEW: the single field zone (core szone[5])
  p1_fzone: ZoneSlotSchema,
  p0_grave: z.array(ZoneCardSchema),       // unchanged: piles, order-only
  p1_grave: z.array(ZoneCardSchema),
  p0_removed: z.array(ZoneCardSchema),
  p1_removed: z.array(ZoneCardSchema),
  p0_extra: z.array(ZoneCardSchema),
  p1_extra: z.array(ZoneCardSchema),
  p0_deckCount: z.number().int().nonnegative(),   // NEW: count only, never contents
  p1_deckCount: z.number().int().nonnegative(),   // NEW
});
```

**Truncate the Edison-dead slots.** `mzone` and `szone` are emitted at length **5**, not 7 and 8.
Edison has no Link or Pendulum zones — the design deletes those slots from the board deliberately
(design spec §1, "Deleted deliberately"). Core index 5 of SZONE is lifted out to `p*_fzone`; core
indices 6–7 of SZONE and 5–6 of MZONE are dropped. Assert in a test that they are always null before
dropping them; if one is ever non-null, that is a genuine finding — **stop and raise it, do not
silently widen the array.**

**`p*_deckCount` is a count, never contents.** There is no `p*_deck` array and there must not be one.

### C3 · `DuelStateSnapshot` — turn number

```ts
  turnNumber: z.number().int().positive().optional(),   // NEW: top-bar "TURN 4 · THEIRS"
```

### C4 · `CardDTO.preErrataText` — `packages/contracts/src/card.ts` (ND-6)

```ts
  /** True when packages/card-data substituted this card's text from
   *  preErrataDescOverrides.json. The C13 provenance badge keys off this. */
  preErrataText: z.boolean().optional(),
```

`packages/card-data` already applies `preErrataDescOverrides.json` when it builds the catalog, so it
already knows which cards it overrode — it just discards the knowledge. Set the flag where the
override is applied. **Derive it from the override set; never hand-maintain a passcode list**
(requirement C13 says so explicitly).

### C5 · `CLOCK` carries both deadlines — `packages/contracts/src/duel.ts` (ND-5)

```ts
  z.object({
    type: z.literal("CLOCK"),
    onClockSeat: SeatSchema,
    deadlineAt: z.number(),                          // kept: the on-clock seat's deadline
    deadlines: z.tuple([z.number(), z.number()]).optional(),  // NEW: [seat0, seat1]
  }),
```

The same two fields are added to `DuelStateSnapshot.clock`. `deadlineAt` stays so nothing breaks;
`deadlines` is what requirement D2 renders. The off-clock seat's entry is its **banked** remaining
time — the deadline it would resume against, not a live countdown.

### C6 · `DuelEvent` — a new typed union, `packages/contracts/src/duelEvent.ts` (MH-2a + MH-2b)

MH-2b is **in scope** — CTO's call at implementation per the PRD, approved by the CEO 2026-08-07.
Reasoning is in `docs/adr/0004-typed-duel-event-feed.md`.

The exact variant list is the implementing engineer's to derive from what ocgcore actually emits, but
the shape is fixed here and must not drift:

```ts
const EventCardRefSchema = z.object({
  code: z.number(),                  // 0 when the viewer is not entitled to the identity
  controller: SeatSchema,
  location: z.enum(["HAND","MZONE","SZONE","FZONE","GRAVE","REMOVED","EXTRA","DECK","OVERLAY"]),
  sequence: z.number().int().nonnegative().optional(),
});

// Every variant carries these:
//   seq        monotonic per duel, gap-free per seat — the log's dedupe key (C3: "exactly once")
//   turnNumber the turn it happened in
//   phase      the phase it happened in       } together these give the log its phase-nesting
//   actor      the seat that caused it, where the engine identifies one
```

Required variants, minimum, because a numbered requirement needs each one:

| Variant | Fields beyond the common ones | Required by |
|---|---|---|
| `SUMMON` / `SPSUMMON` / `SET` | `card`, `position` | C3 |
| `MOVE` | `card`, `from`, `to` | C3 (the from→to arrow) |
| `CHAINING` / `CHAIN_SOLVING` / `CHAIN_SOLVED` / `CHAIN_END` | `card`, `link` ordinal, `owner` | C6 chain strip |
| `LP_CHANGE` | **`seat`** (whose LP moved), `delta`, `reason: "damage" \| "cost" \| "recover" \| "effect"` | C3, C5, **ND-4** |
| `ATTACK` / `BATTLE` | `attacker`, `target` (nullable = direct attack) | F5, F11 |
| `PHASE` | `phase` | C3 phase nesting |
| `TURN` | `turnNumber`, `turnPlayer`, `lpSnapshot: [number, number]` | C5 per-turn LP snapshot |
| `HINT` | `hintType`, `value`, `card?` | MH-3 captions |

**ND-4 is the point of `LP_CHANGE.seat`.** Without it a log row reads `Caius — Damage −1200`, which a
player reads as damage taken *by* Caius. The row must read `Sakura −1200 LP`. `MSG_DAMAGE`(91) carries
`player`; `MSG_PAY_LPCOST`(100) and the battle-damage path do not consistently identify the losing
seat. Normalising that is the work.

New server→client frame:

```ts
  z.object({ type: z.literal("EVENTS"), events: z.array(DuelEventSchema) }),
```

The existing `MSG` frame **stays** for now — deleting it is a separate decision and not this project's.

### C7 · Decision sidecar — `packages/contracts/src/duelEvent.ts` (MH-3)

A **sidecar frame**, not fields on the locked union. This shape was ratified by the CEO precisely so
ADR-0001 stays shut.

```ts
export const DecisionContextSchema = z.object({
  /** MSG_HINT caption for the pending decision, when the engine gave one. */
  caption: z.string().optional(),
  /** The card whose effect prompted this decision. */
  activatingCard: EventCardRefSchema.optional(),
  /** Current chain stack, link 1 first. */
  chain: z.array(z.object({
    link: z.number().int().positive(),
    card: EventCardRefSchema,
    owner: SeatSchema,
  })).optional(),
  // releaseCounts (ND-1) removed — CTO 2026-08-07:
  // Live investigation confirmed SELECT_IDLECMD summons[] carries only
  // {code, controller, location, sequence} — no tribute count — under all conditions.
  // release_param appears only in SELECT_TRIBUTE (type 20), after the player commits.
  // ND-1 is withdrawn (CEO ruling, 2026-08-07). The tribute count is readable from
  // SelectTribute.min/max at the tribute step; no backend change required.
});
```

  z.object({ type: z.literal("DECISION_CONTEXT"), context: DecisionContextSchema }),

Send `DECISION_CONTEXT` **immediately before** the `DECISION` frame it describes, to the same seat
only. A `DECISION` with no preceding context is legal and must render — every caption is optional.

### C8 · Non-negotiable hard rules

1. **An empty `SELECT_PLACE` must never reach the core.** Verified live: `places: []` does not crash,
   it puts the core in a permanent `WAITING` loop and the duel never advances again — unrecoverable.
   `responseToOcgResponse.ts:179` maps `resp.indices` straight through, so an empty `indices` produces
   exactly this. Reject it at the boundary: throw in `responseToOcgResponse` for `SelectZone` /
   `SelectDisfield` with zero indices, and reject the client frame in the server socket handler with
   an `ERROR` rather than passing it on. Test both.
2. **`SelectZone` stays uncancellable.** Q4 is the evidence that the design's decision was right.
   Do not add `cancelable` to the variant.
3. **Nothing may key an outcome to a step.** §0a of the design spec, and PRD F13/F14. See §Testing.
4. **1440 × 900 is the floor**, not 1280. The design spec's old `1280 × 800` line is struck
   (commit `7f2648a`). Sub-1440 is out of scope and must never be recorded as passing.

---

## Slice boundaries and file ownership

Two phases. Phase 1 ships to `master`; Phase 2 ships to `integration/duel-ui-rebuild` and reaches
`master` as one merge.

**No slice may edit a file another slice owns.** If you need a change in someone else's file, STOP
and ask the CTO. Do not introduce a singleton, a global, or a duplicate helper to route around a
boundary — that is the failure mode this table exists to prevent.

### Phase 1 — the wire (ships alone, straight to `master`)

**S1 · Board snapshot contract** — branch `feat/duel-board-snapshot-contract`
Owns: `packages/contracts/src/duel.ts`, `packages/contracts/src/card.ts`, their tests ·
`packages/engine/src/buildStateForSeat.ts` + tests · `packages/card-data/src/**` ·
fixtures under `packages/server/src/duel/fakeEdisonDuel.ts` only where the snapshot shape forces it.
Delivers: C1, C2, C3, C4, and the **NH-5 audit** (below).

**S2 · The wire — events, sidecars, clock** — branch `feat/duel-wire-events-and-clock`
Owns: `packages/contracts/src/duelEvent.ts` (new) + tests · `packages/server/src/duel/duelSocket.ts`,
`timer.ts`, `duelManager.ts`, `duelStore.ts` + tests · `packages/engine/src/redactMessage.ts`,
`EdisonDuel.ts`, `decision/responseToOcgResponse.ts`, `decision/messageToDecision.ts` + tests.
Delivers: C5, C6, C7, C8.1, C8.2, the redaction-table fix, and the per-handover clock.

**The one shared file.** Both slices add a line to `packages/contracts/src/index.ts`. S1 lands first;
S2 rebases. If that produces a conflict it is a one-line conflict — resolve it, do not redesign.

### Phase 2 — the screen (does NOT ship alone → `integration/duel-ui-rebuild`)

**W1 · Board, chrome and ACT mode** — branch `feat/duel-ui-board-act`
Owns: `DuelStage`, `DuelBoard`, `FieldGroup`, `ZoneSlot`, `CardTile`, `PileBadge`, `HandRow`,
`PhaseRail`, `DimScrim`, `LifePointPlate`, `ClockPanel` (from `DuelTimer.tsx`), `DuelTopBar` and its
children, `VerbChipCluster` (from `ActionContextMenu.tsx`).
Delivers: A1–A3, A9–A11, C1, C2, C5, D1–D4, F11, G1, G3.

**W2 · The answer dock** — branch `feat/duel-ui-answer-dock`
Owns: `DuelDock`, `QuestionBar` (replaces `ActionPanel.tsx`), `DecisionRenderer` (rewrites
`DecisionDispatcher.tsx`), `IntentRibbon`, `ChainStrip`, `AutoAnswerReceipt`, `ResponsePromptControl`,
the auto-resolve rules, and the deletion of `decisions/*Panel.tsx`, `DecisionBottomSheet.tsx`,
`TargetingOverlay.tsx`.
Delivers: A4–A8, A12, B1–B5, C6, E1–E5, F1–F10, F12–F14.

**W3 · Inspectors, art and the log** — branch `feat/duel-ui-inspectors-log`
Owns: `CardInspector`, `PileInspector`, `CardArt`, `ProvenanceBadge`, `EventLogRail`, `WaitBanner`,
`DuelEndOverlay`, and the duel-scoped card cache (NH-1).
Delivers: C3, C4, C10–C13, D5, D6, F8.

### The seam — `packages/web/src/duel/contracts.ts`, and it is FROZEN

Every type that crosses a slice boundary is declared once, in
**`packages/web/src/duel/contracts.ts`**. That file is **owned by the CTO and may not be edited by
any slice.** It is types only — no implementation, so it cannot be a source of merge conflicts. If a
slice needs a change to it, that is a change to somebody else's slice: **stop and ask.**

This is the internal application of the same rule the backend slices got. Three engineers building
one screen in parallel is exactly the situation where a shape drifts, and a shared file that nobody
may edit is cheaper than a convention everybody is asked to remember.

What crosses the boundary, and who implements which side:

| Type | Implemented by | Consumed by |
|---|---|---|
| `CardRef`, `sameCardRef` | — (shared value type) | all three |
| `DuelStageProps`, `DuelMode` | **W1** | W2, W3 |
| `DuelInteraction` — `mode`, `candidates`, `selection`, `intent`, `chain`, `receipts`, `status` | **W2** | W1 (dim law, mode switching), W3 (log, inspectors) |
| `PendingIntent`, `IntentStep`, `ChainLink`, `AutoAnswerReceipt` | **W2** | W1, W3 |
| `CardLookup`, `CardInfo` | **W3** | W1 (tiles, chip labels), W2 (confirm labels) |
| `InspectorControl` | **W3** | W1, W2 |
| `OWNERSHIP_CSS_VARS` | **W1** declares the properties | W2, W3 consume, never redefine |

**Nobody blocks on anybody.** Each slice ships a stub satisfying the interfaces it consumes, in its
first push, and deletes the stub when the real implementation lands. W1 in particular must not wait
for W2's state machine — a stub `DuelInteraction` returning `mode: "act"` with empty arrays is enough
to build the whole board against.

**`DuelScreen.tsx` is the composition root and is owned by W1 alone.** W2 and W3 mount through the
slots `DuelStage` exposes and may not edit it.

### ⚠️ The wiring step is its own slice, and leaving it implicit cost a round

**Correction, CTO 2026-08-07.** The stub rule above said each slice "deletes the stub when the real
implementation lands." That sentence assigned the work to **nobody**. W1 owns the composition root and
finished before W2 and W3 landed; W2 and W3 are forbidden from editing it. So when all three slices
merged clean onto the integration branch, the result was a screen where `DuelStage` still rendered
`answer-mode-stub`, `DuelScreen` still rendered `log-rail-stub` and an inline `DuelEndOverlay`, and
**neither `DuelDock` nor `EventLogRail` nor W3's overlay was mounted at all.** Every component existed,
every unit test passed, and none of it was reachable from the running app.

This is the failure mode AGENTS.md names: *"A green pipeline measures what you thought to ask it."*
Three slices met 100% of their own criteria and the product did not work, because no criterion asked
whether the parts were connected.

**The rule, so it does not recur:** when parallel slices hand off through stubs, the stub replacement
is a **named deliverable with an owner** — a wiring slice that lands after the others and whose
acceptance criteria are *runtime reachability*, not unit tests. A stub is a debt with a due date, and
a due date needs a name against it.

**Consequence for verification:** `packages/web/src/duel/e2eTestidContract.test.ts` is a source scan.
It proves an id exists in the codebase, **not that it is mounted in the render tree** — `action-panel`
was present in a file and absent from the running app, and the guard was green. Runtime reachability
is what E2E and QA are for; do not read a green guard as evidence a surface is reachable.

**Where the state machine lives, and why it is W2's.** `mode`, `selection`, `intent` and `chain` are
the answer side of the screen: `intent` exists to survive the `STATE`-then-`DECISION` gap across
sub-decisions, `chain` feeds the chain strip, `selection` feeds the confirm control. Only `mode` and
`candidates` serve the board, and both are consumed there rather than derived there. Putting the
machine in W1 would mean W2 asking W1 for a change every time an answer behaviour changed — which is
most of W2's work.

⚠️ **`intent` must NOT be cleared by a `STATE` frame.** `DuelScreen.tsx:128-131` nulls the pending
decision on `STATE` today; the intent object must not follow it. That is requirement B2 and it is the
single most-repeated failure in this screen's history.

---

## NH-5 — the extra-deck visibility audit (S1, and it is gated)

`buildStateForSeat.ts` computes `alwaysHidden = (loc & (OcgLocation.HAND | OcgLocation.DECK)) !== 0`
and queries `p0_extra` **and** `p1_extra` for every viewer. `EXTRA` is not in that mask, extra-deck
cards are not face-down, so redaction rests entirely on `isPublic === false` being reported by the
core for extra-deck cards. If it is not, **every viewer receives the opponent's full extra deck with
real passcodes** — a hidden-information leak in a competitive game.

This was carried in the design spec as `NH-5 — must, if confirmed` and never became a numbered
requirement, so it was one document away from being lost.

**Audit first, and report before changing anything.** Drive a live duel, dump `p1_extra` as seen by
seat 0, and answer: is it confirmed · how wide is it (extra deck only, or does `GRAVE`/`REMOVED`
face-down leak too) · what does the fix cost. **Do not write the fix until the CTO says go.** The CEO
asked to see the answer before code moves.

---

## Testing — what "done" means

Ordinary unit and integration coverage is assumed. These are the parts that are specifically ordered.

### The answer-fidelity invariant (F13, F14, design spec §0a) — W2 owns it

Three separate bugs in the prototype were **one** defect: the outcome was keyed to the *step* rather
than to the *answer*, so it could not vary with what the player chose. Each was reported fixed after a
spot check on a single answer — and a spot check cannot detect it, because the one path you check is
the one path that works.

- **Test by enumeration, never by sample.** For every decision with `min !== max`, or more than one
  candidate, or a legal decline: loop over *every* legal answer including the decline, drive to a
  settled state, fingerprint the observable result, assert pairwise distinctness.
  `docs/specs/2026-08-06-duel-ui-fixtures/answer-matrix.py` is the reference implementation; port its
  *approach* into the TypeScript test tree. Sampling one answer is not evidence and will be rejected.
- **The confirm label and the submitted response derive from the same value**, in the same expression
  where practical. Both the B3 and the CEO-found bug had a *correct* label next to an *incorrect*
  action — the interface lied and looked confident.
- **A legitimate convergence is named and justified**, not hidden behind a green tick, and the two
  answers must stay distinguishable through at least one observable channel.
- `min === max === 1` uses **radio semantics, never toggle.** Deselecting the only option disables the
  only button and dead-ends the step.
- Report the answer × outcome matrix **as evidence**. The word "verified" is not a result.

### Porting the fixtures

`docs/specs/2026-08-06-duel-ui-fixtures/` is typed against **copied shapes with MH-1 already applied**,
which is why it lives under `docs/` — it would not typecheck against today's contracts and `docs/` is
excluded from `prettier` and `arch:check`. Once S1 lands, port them into the test tree.

**If a fixture fails to typecheck against the real contract, that is a genuine disagreement between
what the design was built against and what shipped. Raise it. Do not reshape the fixture to fit.**
Pre-errata strings stay **verbatim** from the corpus — the C13 badge asserts our text is authoritative
over the printed card face, and invented text under that badge is worse than no badge.

### Untested, not passing — QA may not mark these green

Carried from the PRD's standing caveat. These are the CEO's own review items:

- all timing and motion, notably the board reflow when the log opens and the beat between attack-
  confirm and the LP change;
- damage-number animation and audio;
- **anything below 1440 × 900** — out of scope, and it must not quietly become a supported claim;
- the chain **decline** path and the **forfeit** experience: fixed after the independent usability
  pass, so their mechanics are verified but neither has been through a fresh evaluator in working form.

Record them as **untested**. Not as passing, and not as failing.

### The gate

A slice is done when the **whole-repo** pipeline is green on a **clean clone** — `npm run verify`
(typecheck · lint · arch:check · actionlint · docs:check · build:check · test) — plus the acceptance
criteria of its own Linear issue, verified by the QA Engineer and not by the implementer. "My package's
tests pass" is not done.

---

## Closing slices — C1 and C2 (added 2026-08-08, before the PR #42 cutover)

Two defects found after the W1–W4 slices merged into `integration/duel-ui-rebuild`. Both must land on
that branch before it merges to `master`. They are sequential: **C2 depends on C1 being merged**,
because C2's E2E cases exercise surfaces C1 makes reachable.

### C1 — Phase rail is operable, and the `Choose zones` setting is actually wired

**Owner:** one Full-Stack Engineer. **Branch:** `fix/duel-ui-phaserail-a11y-zone-prefs`, off
`integration/duel-ui-rebuild`. **Base for its PR:** `integration/duel-ui-rebuild`, never `master`.

**Files owned — exclusively, nothing else may be touched:**

- `packages/web/src/components/duel/chrome/PhaseRail.tsx`
- `packages/web/src/components/duel/chrome/PhaseRail.test.tsx` (new)
- `packages/web/src/components/duel/board/DuelStage.tsx`
- `packages/web/src/screens/DuelScreen.tsx`
- `packages/web/src/components/duel/board/DuelStagePrefs.test.tsx` (new)
- `e2e/playwright/duel.spec.ts` (one-line selector revert only — see C1(a) below)
- this spec file

**Explicitly NOT owned:** `packages/web/src/duel/*`,
`packages/contracts/**`, anything under `packages/server` or `packages/engine`.

#### C1(a) — the phase rail's phase cells must be real buttons

`PhaseRail.tsx` renders each phase cell as a `<button>` carrying `role="listitem"`, inside a wrapper
with `role="list"`. An explicit ARIA role **overrides** the native role, so the phase-advance control
— which the design spec §7 names as *the* phase-advance control — is announced to assistive tech as a
list item and cannot be found by `getByRole("button")`. A keyboard or screen-reader user cannot
operate it. QA previously adapted its E2E selector to `getByRole("listitem")` to match; that was the
wrong direction and C2 reverts it.

**Required change:**

- Delete `role="listitem"` from the phase cell `<button>` elements. They keep their native button role.
- Change the wrapper from `role="list"` to `role="group"`, keeping `aria-label="Duel phases"`. A
  `role="list"` whose children are no longer list items is invalid ARIA; `group` is the correct
  container for a set of related controls.
- Everything else about the cells — `aria-current="step"` on the active phase, the `aria-label`
  strings including the `" — advance here"` suffix when legal, the `disabled` state when not legal,
  all styling — is **unchanged**. Do not restyle, do not rename, do not add keyboard handlers: native
  buttons already give Enter/Space and tab order.

**Locked output contract (an E2E suite asserts on these exact strings — do not alter them):**

- active cell: `aria-label` = `"<Full Phase Name> (current)"`, e.g. `"Main Phase 1 (current)"`
- legal, non-active cell: `aria-label` = `"<Full Phase Name> — advance here"` (em dash, spaces both
  sides), e.g. `"Battle Phase — advance here"`
- illegal, non-active cell: `aria-label` = `"<Full Phase Name>"`, and the element is `disabled`
- the `data-testid="phase-ribbon"` wrapper and `data-testid="end-turn-btn"` are unchanged

#### C1(b) — `Choose zones` in the settings popover must reach the interaction state machine

`DuelScreen.tsx` owns `settings: DuelSettings` (which includes `chooseZones`) and passes it to
`DuelTopBar` → `SettingsPopover`, so the toggle renders and flips. But `DuelStage.tsx` line ~81 holds
its **own** hard-coded, setter-less `const [prefs] = useState({ chooseZones: false })` and feeds that
to `useDuelInteraction`. The two are unconnected: flipping "Choose zones" in the UI changes nothing.

The design spec is explicit that this must work — §"SelectZone" requires that with `Choose zones: ON`
the board becomes the answer space (legal zones glow, the player clicks one), and
`chooseZones: true` must disable `SelectZone` auto-answering except when `zones.length === 1`. The
logic already exists and is unit-tested (`packages/web/src/duel/autoResolve.test.ts`); only the wire
is missing. This is the same class as the seam-stub gap recorded above: the slice that built the
control and the slice that built the consumer each assumed the other joined them.

**Required change:**

- Add a required prop `chooseZones: boolean` to `DuelStageProps` in `DuelStage.tsx`. It must be required (not optional-with-default), because an optional default of `false` reintroduces the silent-disconnect defect this slice exists to fix: a caller that forgets the prop would get a settings toggle that silently does nothing, with no compile-time signal.
- Delete the local `useState` for `prefs`. Build the object passed to `useDuelInteraction` from the
  prop: `useMemo(() => ({ chooseZones }), [chooseZones])`.
- In `DuelScreen.tsx`, pass `chooseZones={settings.chooseZones}` to `<DuelStage …>`. Nothing else in
  `DuelScreen.tsx` changes — do not restructure the settings state, do not add persistence, do not
  add a new setting.
- `useDuelInteraction` and `autoResolve` are **not** modified. If you believe they must be, that is a
  stop-and-ask.

#### C1 acceptance criteria

1. `PhaseRail` phase cells are found by `getByRole("button", { name: /Battle Phase.*advance/i })` in a
   jsdom render where Battle Phase is legal; `getByRole("listitem")` finds **zero** elements in the rail.
2. The rail container has `role="group"` and `aria-label="Duel phases"`; no `role="list"` remains in
   `PhaseRail.tsx`.
3. The three `aria-label` forms above are asserted verbatim by unit test (active / legal / illegal).
4. Clicking a legal phase cell calls `onAdvancePhase` with that phase's numeric value; clicking an
   illegal (disabled) cell calls it zero times.
5. `DuelStage` accepts `chooseZones` as a prop and passes `{ chooseZones }` through to
   `useDuelInteraction`; a unit test renders `DuelStage` with `chooseZones={true}` and with
   `chooseZones={false}` and asserts the value reaching the hook differs.
6. `DuelScreen` passes `settings.chooseZones` into `DuelStage` — asserted by test, not by inspection.
7. `npm run verify` is green **whole-repo** on a clean clone, with the engine WASM binary built first
   (`bash packages/engine/scripts/build-wasm.sh` then `bash packages/engine/scripts/fetch-assets.sh`).
   A run whose output reports skipped `*.accuracy.test.ts` files has not run the suite that matters.
8. `npm run test:e2e` is **fully green** — all 4 cases pass. The Battle Phase selector revert (originally C2 item 1) moved into C1 so the integration branch is never merged red; C1 owns that one-line change in `e2e/playwright/duel.spec.ts`.

### C2 — E2E: phase-rail selector revert, and the presented zone-selection path

**Owner:** the QA Engineer. **Branch:** off `integration/duel-ui-rebuild` **after C1 has merged into
it**. **Files owned exclusively:** `e2e/playwright/duel.spec.ts`.

Requirement E3 (CEO-ratified) has two halves. The auto-answered half — `chooseZones: false` is the
default, `SelectZone` auto-answers the leftmost free zone — is covered. The **presented** half — the
board becomes the answer space and the player picks a zone — has unit coverage in
`packages/web/src/duel/autoResolve.test.ts` and **no browser coverage at all**, so nothing proves the
path is reachable in the running app. A source-scan guard cannot prove reachability; only E2E can.

**Required changes:**

1. ~~Revert the Battle Phase selector~~ — moved into C1 (selector revert landed in PR #46 to keep the integration branch green on merge).
2. Add an E2E case for the presented zone path: open the settings popover
   (`data-testid="settings-btn"`), toggle **Choose zones** on, then perform a Normal Summon that
   offers more than one legal zone, and assert the board enters zone-pick — the legal zones are
   presented and clicking one commits the placement and advances the duel. Assert on the zone
   surface actually rendered by the current board (find it by reading `DuelStage`/board source; do
   not invent a `data-testid`, and do not add one to product code — you do not own product files).
3. If the presented path proves unreachable in the browser even after C1(b), that is a **product
   defect, not a test to weaken**. Report it with the exact selector you tried and stop. Do not
   change a `data-testid`, do not adapt an assertion to match the code, and do not skip the case.

#### C2 acceptance criteria

1. `npm run test:e2e` green (phase-rail step already asserts `getByRole("button", …)` after C1).
2. A new E2E case covers the `Choose zones: ON` presented zone-selection path end to end, and fails
   if the toggle is disconnected from the interaction state machine (verify this by reverting C1(b)
   locally and confirming the new case goes red, then restoring).
3. No file outside `e2e/playwright/duel.spec.ts` is modified — proven with
   `git diff --name-only origin/integration/duel-ui-rebuild...HEAD` pasted into the report.

### C3 — `chooseZones` has one source of truth (ZUH-110)

**Found by QA while writing C2, after C1 merged.** C1(b) wired `settings.chooseZones` from `DuelScreen`
through `DuelStage` into `useDuelInteraction`'s input. That half is correct and stays. The defect is on
the other side of the seam: **the hook ignores the input after mount.**

`packages/web/src/duel/useDuelInteraction.ts:169`:

```ts
const [prefs, setPrefsState] = useState<{ chooseZones: boolean }>({
  chooseZones: externalPrefs.chooseZones ?? false,
});
```

`useState`'s argument is an **initial** value, read once at mount and never again. The hook then keeps
its own copy and never resyncs. So a player who opens the settings popover mid-duel and flips
**Choose zones** on gets nothing: the toggle moves, `DuelScreen` state updates, the prop changes, and
the hook keeps answering from the value it captured when the board first rendered. `SelectZone`
auto-answers the leftmost zone exactly as if the toggle were off. Requirement **E3** is CEO-ratified
and is not met.

**This is a duplicate-state bug, not a missing effect.** Adding a sync effect would make the parent win
on each change while leaving two writeable copies of one setting — the same trap, re-armed. The fix is
to remove the second copy.

`setPrefs` exists for the receipt's "Ask me next time" affordance. Its only caller is
`packages/web/src/components/ActionPanel.tsx:88`, and **`ActionPanel` is not mounted anywhere** — it was
replaced by `DuelDock` in W2 and only its own tests still reference it. It is dead code, so nothing live
writes prefs except the settings toggle.

**Required change:**

- In `useDuelInteraction.ts`, delete the local `prefs` state and the `setPrefsState` setter. Derive the
  value from the input: `const prefs = useMemo(() => ({ chooseZones: externalPrefs.chooseZones }), [externalPrefs.chooseZones]);`
- Remove `setPrefs` from `DuelInteractionOutput` and from the returned object. The parent owns the
  setting; the hook reads it.
- Delete `packages/web/src/components/ActionPanel.tsx` and `packages/web/src/components/ActionPanel.test.ts`.
  Dead code, mounted nowhere, and the only reason `setPrefs` still had a caller.
- **Do NOT add `prefs` to the dependency array of the auto-resolve effect at line ~275.** The existing
  comment (`prefs intentionally read at effect time without being a dep`) is correct and must stay.
  Adding it would re-run the effect when the toggle flips and re-answer a decision that has already
  been answered. The intended behaviour is that a mid-duel toggle applies from the **next** decision
  onward, which is what a `[decision]` dep gives.

**Acceptance criteria:**

1. No `useState` for prefs remains in `useDuelInteraction.ts`; `prefs` derives from the input prop.
2. `setPrefs` is gone from `DuelInteractionOutput`; `ActionPanel.tsx` and `ActionPanel.test.ts` are deleted.
3. A unit test rerenders the hook with `chooseZones` flipped `false → true` **after mount** and asserts
   the next `SelectZone` decision with `zones.length > 1` is NOT auto-answered. This test fails against
   the current code — confirm that it does before fixing. (Implementation note: `renderHook` from
   `@testing-library/react` hangs when the hook is in non-auto-answer mode for `SelectZone`; use a
   rendered `Harness` component with `act`+`setState` instead.)
4. A unit test asserts a `SelectZone` with `zones.length === 1` is still auto-answered with the toggle ON
   (E1 — auto-answer where exactly one legal answer exists is unaffected).
5. The auto-resolve effect's dep array is unchanged, and flipping the toggle does not re-answer an
   already-answered decision.
6. `npm run verify` green whole-repo on a clean clone with the WASM binary built, no file-level
   `*.accuracy.test.ts` skips; `npm run test:e2e` green.

**Out of scope, recorded so it is not silently absorbed:** `DuelStage` mounts `DuelDock` without an
`onAskNextTime` prop, so the receipt's "Ask me next time" control renders in no state at all
(`AutoAnswerReceipt.tsx:53` gates on the prop). That is a separate missing affordance, it changes what
a user can do, and it is parked for the CEO rather than folded in here.
