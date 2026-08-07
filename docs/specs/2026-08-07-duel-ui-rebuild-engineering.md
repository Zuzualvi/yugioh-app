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
