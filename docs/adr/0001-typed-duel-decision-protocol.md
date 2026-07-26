# ADR 0001 — Typed Duel Decision Protocol

**Status:** Accepted  
**Date:** 2026-07-16  
**Authors:** Phase 0 agent; locked by CTO  
**Spec:** `/workspace/specs/interactive-duel-phase0.md`  
**Catalog:** `docs/reference/2026-07-16-ocgcore-decision-catalog.md`

---

## Context

The existing `EngineResponse { type: number; value?: unknown }` passthrough and
`RedactedEngineMessage` (`.passthrough()` Zod object) are loose at both boundaries:

1. **Engine side:** `EdisonDuel.respond(EngineResponse)` casts the value directly into
   `lib.duelSetResponse(handle, response as OcgResponse)`. No TypeScript enforcement —
   the caller can supply any shape.

2. **Web side:** `decisionOptions.ts` decodes mock-shaped objects
   `{ options: string[], canPass: boolean }` that bear no relationship to what the real
   ocgcore engine emits. This is a **mock-vs-reality mismatch bug class**: the UI was
   built against invented wire formats, not measured ones.

3. **Architecture rule violation:** `packages/web` importing engine-specific knowledge
   (even indirectly via the mock shapes) violates the `web → contracts only` dependency
   rule.

The full interactive duel UI requires that every legal Edison play can be expressed,
answered, and logged. A loose passthrough cannot support exhaustive UI rendering or
provably correct response serialisation.

---

## Decision

Introduce a **typed decision protocol** in `packages/contracts/src/duelDecision.ts`:

- **`DuelDecisionSchema`** — a `z.discriminatedUnion("kind", [...])` with 20 variants
  covering every ocgcore decision message type the engine can emit.
- **`DuelDecisionResponseSchema`** — a matching `z.discriminatedUnion("kind", [...])`.
  Response `kind` MUST equal its decision `kind`.

**The ocgcore↔contract translation lives entirely inside the engine package.**
The web speaks contract only (`packages/web → packages/contracts`, never engine).
Schema drift (engine emits a new field, web sends a wrong field) becomes a TypeScript
compile error in the engine adapter (Phase 1).

**Ground truth is MEASURED, not invented.** Every variant shape was verified against
a real ocgcore duel run before being committed (catalog in
`docs/reference/2026-07-16-ocgcore-decision-catalog.md`). Variants with no known
live Edison trigger are implemented from the ocgcore-wasm `.d.ts` type definitions and
marked [unverified-live] — they are real, answerable shapes, never throwing stubs.

### Locked output-contract rules (implementer variance forbidden)

| Rule | Value |
|------|-------|
| Discriminant field | `kind` (string literal), on BOTH unions |
| Response matching | `response.kind === decision.kind` always |
| Card selections | 0-based indices into the decision's `cards[]` / `selects[]` (never raw ocgcore internal pointers) |
| Hidden cards | `code: 0, name: ""` — redaction baked into the engine→contract mapping |
| Raw bitmasks | Never reach the web. Decoded server-side to named arrays before serialisation |
| RockPaperScissors | Engine auto-resolves; no WAITING is emitted; variant REMOVED from union |
| Empty optional chains | Engine adapter AUTO-PASSES; `ChainPrompt` only reaches web when `forced=true` OR `selects.length > 0` |
| `indicies` misspelling | The `OcgResponseSelectCard.indicies` field name in ocgcore-wasm is intentionally misspelled. Contract uses correct spelling `indices`. Adapter translates. |

---

## Variant table

| kind | Num | Live-verified | Note |
|------|-----|--------------|------|
| `IdleCommand` | 11 | ✓ | Every main phase; full card identity per entry |
| `BattleCommand` | 10 | ✓ | Battle phase; `canDirectAttack` on attack entries |
| `ChainPrompt` | 16 | ✓ | Only surfaced when non-empty or forced |
| `SelectEffectYN` | 12 | ✓ | Treeborn Frog standby trigger |
| `SelectYesNo` | 13 | ✓ | Ryko Lightsworn Hunter flip |
| `SelectOption` | 14 | ✓ | Enemy Controller two-effect choice |
| `SelectCard` | 15 | ✓ | Targeting selection; hidden face-down = code:0 |
| `SelectTribute` | 20 | ✓ | Caius the Shadow Monarch 1-tribute |
| `SelectZone` | 18 | ✓ | Field zone placement; decoded from `field_mask` |
| `SelectPosition` | 19 | ✓ | Position bitmask decoded to `PositionCode[]` |
| `SelectUnselectCard` | 26 | ✓ | Synchro material + ritual tribute selection |
| `AnnounceRace` | 140 | ✓ | DNA Surgery; bitmask decoded to `Race[]` |
| `AnnounceAttrib` | 141 | ✓ | Abyssal Designator; bitmask decoded to `Attribute[]` |
| `AnnounceCard` | 142 | ✓ | D.D. Designator; opcodes resolved to `AnnounceFilter` |
| `AnnounceNumber` | 143 | ✓ | Wall of Revealing Light; `options: number[]` |
| `SortChain` | 21 | ✗ unverified-live | No Edison script calls SortChain(); shaped from `.d.ts` |
| `SelectCounter` | 22 | ✗ unverified-live | No Edison script calls SelectCounter(); shaped from `.d.ts` |
| `SelectSum` | 23 | ✗ unverified-live | No Edison script calls SelectSum(); synchro/ritual uses SelectUnselectCard (type 26). Ritual spells (Advanced Ritual Art, Black Illusion Ritual) are in the Edison catalog but their tribute selection uses `aux.SelectUnselectGroup` → type 26. Shaped from `.d.ts`. |
| `SelectDisfield` | 24 | ✗ unverified-live | No Edison script calls SelectDisField(); shaped from `.d.ts` |
| `SortCard` | 25 | ✗ unverified-live | No Edison script calls SortCard(); shaped from `.d.ts` |

**RockPaperScissors (type 132):** Removed from union. The engine never emits a WAITING
with this message type in standard Edison mode (confirmed across all tested scenarios,
seeds, and deck combinations). Engine auto-resolves opening hand selection.

---

## Consequences

### Positive
- Schema drift is a compile error: if the engine emits new fields, the adapter switch
  won't compile until it handles them.
- The web is insulated from engine encoding details (bitmasks, ocgcore internal pointers,
  raw description IDs, opcode bytecode).
- `DuelDecisionResponse` is stored in the response log — replay is type-safe.
- Every legal Edison play has a representable, answerable contract variant (CEO mandate).

### Negative / trade-offs
- The old `EngineResponse { type, value }` response log is incompatible. Any replays
  of duels that used the old passthrough must be discarded. **This is safe:** no real
  completed duels exist in production as of this ADR; all prior duel data was generated
  by a stub engine against mock shapes that were never correct anyway.
- The 5 [unverified-live] variants have no automated test coverage against the real engine.
  Their schema shapes are correct per the `.d.ts` definitions; a live test will be added
  when a trigger card is confirmed available.
- `AnnounceCard.filter` (resolved from opcodes bytecode) falls back to `{ kind: "any" }`
  for complex opcode programs. The engine re-validates any response `code` and retries on
  illegal names — no dead-end, but the web may display a full card-name search for cards
  that technically have a restricted set.

### Alternatives rejected
1. **Keep the passthrough (`EngineResponse` + `RedactedEngineMessage`):** Doesn't type-check
   responses; web continues to decode mock shapes. Bug class persists. Rejected by CEO +
   CTO mandate.
2. **Type the decision protocol in the web package:** Would require web to import engine
   knowledge, violating the `web → contracts only` rule. Rejected by arch constraint.
3. **Generate types from the ocgcore C++ source:** Too fragile; ocgcore types change with
   upstream. The `.d.ts` in the npm package is already the stable TypeScript surface.
4. **Separate enums per package:** Would require re-exporting from contracts. Consolidated
   in contracts for single-source-of-truth.

---

## References
- Spec: `specs/interactive-duel-phase0.md`
- Catalog: `docs/reference/2026-07-16-ocgcore-decision-catalog.md`
- Raw captures: `docs/reference/decision-capture-raw.json`
- Contract: `packages/contracts/src/duelDecision.ts`
- Tests: `packages/contracts/src/duelDecision.test.ts`
- Decision record: `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-16-phase0-decision-catalog.md`
