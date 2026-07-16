# Spec — Interactive Duel, Phase 0: lock the typed decision protocol (THE GATE)

**Author:** CTO • **Date:** 2026-07-16 • **Status:** ACTIVE (delegated)
**Parent brief:** `docs/working/2026-07-15-interactive-duel-ui-plan.md`
**Decision record:** `/mnt/memory/yugioh-app-team-memory/decisions/2026-07-16-interactive-duel-v1-scope.md`

Phase 0 is the gate before ANY UI or engine-adapter work. Nothing in Phases 1–3 may start until the
`DuelDecision` / `DuelDecisionResponse` contract is locked by the CTO. Its whole job: replace the loose,
mock-shaped `EngineResponse {type,value}` + `RedactedEngineMessage` passthrough with a **typed decision
protocol measured against the REAL ocgcore engine** — never invented (AGENTS.md: "do not invent wire formats").

Scope reminder (CEO call): **full decision coverage** — every ocgcore decision type the engine can emit must
appear in the protocol. No legal Edison play may dead-end. Rare kinds (SORT_CARD, ROCK_PAPER_SCISSORS,
hand-toss) are IN — they may render minimally but must be representable and answerable.

---

## Deliverable A — Empirical ocgcore decision catalog (DO THIS FIRST; report to CTO before contract lock)

**Why first:** the contract field names/shapes are locked against what the engine ACTUALLY emits, not guesses.

1. **Build the environment** (fresh clone): `npm install` → `bash packages/engine/scripts/build-wasm.sh`
   → `bash packages/engine/scripts/fetch-assets.sh`. Confirm `isCustomWasmAvailable()` is true.
2. **Extract the authoritative types** from the installed `ocgcore-wasm@^0.1.2` package: locate its `.d.ts`,
   and copy the exact `OcgMessage` union (all decision message members: MSG_SELECT_*, MSG_ANNOUNCE_*,
   MSG_SORT_CARD, MSG_ROCK_PAPER_SCISSORS, etc.) and the exact `OcgResponse` union (every response variant and
   its fields) into the catalog doc. This is ground truth.
3. **Drive the real engine** through Edison lines that force each decision kind, using the two fixture decks
   (Deliverable B). At minimum exercise: draw/idle command; normal summon; tribute summon (SELECT_TRIBUTE);
   set monster/spell/trap; flip summon; activate ignition/trigger effect (SELECT_CHAIN both forced &
   optional); targeting (SELECT_CARD, SELECT_UNSELECT_CARD); SELECT_SUM (e.g. exact-level tribute / Synchro
   material choice); SELECT_PLACE / SELECT_DISFIELD (zone placement); SELECT_POSITION; SELECT_EFFECTYN /
   SELECT_YESNO; SELECT_OPTION (multi-effect card); ANNOUNCE_ATTRIB / _RACE / _CARD / _NUMBER; battle
   (SELECT_BATTLECMD, attack declaration, replay); Synchro Summon from Extra; and the opening
   ROCK_PAPER_SCISSORS / first-turn choice. Note any decision kind you could NOT trigger with these two decks.
4. **Output:** `docs/working/2026-07-16-ocgcore-decision-catalog.md` — for EACH decision message type:
   its numeric type + name, the exact fields ocgcore emits (with a real captured example object), which fields
   are hidden-information (must be redacted per seat), and the exact `OcgResponse` shape it expects back (with a
   real example). Include the raw `OcgMessage`/`OcgResponse` type extract verbatim.
5. **Report to the CTO** with the catalog + a PROPOSED `DuelDecision`/`DuelDecisionResponse` variant list
   (names + fields) for lock. **Do not finalize the contract until the CTO signs off the variant list.**

## Deliverable B — Canonical Edison test-deck fixtures (needed to drive Deliverable A)

- File: `packages/engine/src/testSupport/edisonDecks.ts` — export `BLACKWING_DECK` and `JUNK_FROG_DECK`, each
  `{ main: number[]; extra: number[]; side: number[] }` of **passcodes our catalog knows** (Edison-legal).
- Source lists: edisonformat.net structure decks (Blackwing, Junk Frog). The deckbuilder is a client-rendered
  SPA — reconstruct the lists from the archetype + known Edison structure lists (formatlibrary.com / edisonformat
  decks pages are readable). Byte-exact reproduction is NOT required; **legal + representative + deterministic** is.
- **Both fixtures MUST pass `validateDeck(deck, catalog)`** (`packages/server/src/domain/validateDeck.ts`) with
  zero violations against the loaded Edison catalog, AND load + start a duel in ocgcore without error. Add a test
  asserting both (legality + loads). If a card is out-of-pool/unknown, substitute the nearest legal equivalent
  and note it in the catalog doc.

## Deliverable C — The typed contract (AFTER CTO locks the variant list)

- File: `packages/contracts/src/duelDecision.ts`; export all schemas + types from `packages/contracts/src/index.ts`.
- `DuelDecisionSchema`: a `z.discriminatedUnion("kind", [...])`. One variant per decision kind (names locked with
  CTO; illustrative: `IdleCommand`, `BattleCommand`, `ChainPrompt`, `SelectCard`, `SelectUnselectCard`,
  `SelectSum`, `SelectTribute`, `SelectZone`, `SelectPosition`, `YesNo`, `SelectOption`, `SelectCounter`,
  `AnnounceAttribute`, `AnnounceRace`, `AnnounceCard`, `AnnounceNumber`, `SortCard`, `RockPaperScissors`).
  Each variant carries ONLY redacted, render-ready data: a neutral `prompt` string, candidate entries with
  `{ code, name, zone/location, controller, ... }` (hidden cards carry `code:0`/no name — redaction baked in),
  `min`/`max`, `cancelable`/`canPass` booleans, etc. **No raw ocgcore fields, no hidden info.**
- `DuelDecisionResponseSchema`: a `z.discriminatedUnion("kind", [...])` mirroring the decision kinds — the
  user's typed choice (selected indices / zone / position / bool / announced value). This is what the engine
  converts to `OcgResponse` and what persists in the response log.
- **Output-contract rules (LOCKED, no implementer variance):** discriminant field is `kind` (string literal per
  variant) on BOTH unions; response `kind` MUST equal its decision `kind`; card entries use field name `code`
  (number, ocgcore passcode) and `name` (string, "" when hidden); selections are 0-based indices into the
  decision's candidate array (field `indices: number[]`), never raw ocgcore pointers. Full field list frozen in
  the catalog-review sign-off with the CTO.
- Redaction rules baked into the mapping: a decision for seat N never contains hidden info seat N isn't entitled
  to (reuse/extend `redactMessageForSeat` semantics). Add schema unit tests: every variant round-trips through
  Zod parse; a hidden-card fixture asserts no leaked name/code.

## Deliverable D — ADR (immutable decision record, in-repo)

- File: `docs/adr/0001-typed-duel-decision-protocol.md` (create `docs/adr/`). Append-only ADR format:
  Context (the mock/real mismatch bug class + arch rule web→contracts-only), Decision (typed union in contracts,
  ocgcore⇄contract translation inside engine, web speaks contract only), Consequences (schema drift = compile
  error; response log stores `DuelDecisionResponse`; old `EngineResponse` logs discarded — confirm no completed
  real duels exist first), Alternatives rejected (keep passthrough; type in web).

---

## Acceptance criteria (Phase 0 gate — verified by a separate QA agent on a clean checkout)
- `npm run verify` GREEN repo-wide (typecheck → lint → arch:check → test), including the new contract schema
  tests and the fixture legality/load test.
- `packages/web` still imports contracts only (arch:check passes) — no new cross-boundary edges.
- The catalog doc exists and covers every decision kind in `OcgMessage`, each with a real captured example and
  its response shape; any kind not reproducible with the two decks is explicitly listed.
- Both fixtures validate Edison-legal (0 violations) and start a duel in ocgcore.
- ADR committed. CTO has signed off the locked variant list (recorded in the ADR / decision record).
- **Contracts only in Phase 0.** No engine-adapter method changes, no relay changes, no web changes yet — those
  are Phases 1–2 and depend on this locked contract.

## CONTRACT IMPLICATIONS surfaced by Phase 0.5 (fold into the variant lock)
- **IdleCommand / BattleCommand must group legal options BY the acting card/entity** so the UI can map
  "tap this card → its legal actions" purely from the decision payload — the UI never issues a separate
  "what can this card do" query and never computes legality (server-authoritative; engine owns legality).
  i.e. the variant exposes per-entity action groups: `{ code, name, location, actions:[{kind,label,...}] }`.
- **Every decision variant carries `cancelable` (and `canPass` where a pass/no-response is legal)** so the
  UI knows when to suppress Cancel/Pass. Forced decisions → `cancelable:false`.
- **Neutral prompt strings are pre-rendered in the decision payload** (the UI must not reconstruct prompts
  from card IDs). Each variant carries `prompt: string`.
- **RockPaperScissors:** confirm empirically whether ocgcore emits RPS given our setup. First turn is decided
  server-side (creator/seat 0 goes first today), so RPS should be auto-resolved inside the engine adapter and
  NOT surfaced as a player decision. Represent it in the protocol (coverage) but it need not be a UI panel in
  Phase 2. Report in the catalog whether the engine emits it.

## Git / delivery
- Branch/commit per AGENTS.md (own only your paths; `git pull --rebase --autostash`; keep the
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailer). Report the pushed SHA.
- Do NOT touch `.github/workflows/*` (gated; CTO handles workflows via the GitHub MCP).
