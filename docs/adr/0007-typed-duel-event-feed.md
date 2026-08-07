# 0007 — The duel event feed is a typed contract, not an untyped `MSG` passthrough

**Date:** 2026-08-07
**Called by:** CTO, under the authority the PRD gives ("MH-2b … the CTO's call at implementation").
Notified to and approved by the CEO the same day.

## Context

The Duel UI Rebuild needs the client to be able to say what just happened. Today it cannot: the web
discards the `MSG` feed outright (`DuelScreen.tsx:145-146`), the server forwards `events` but not
`messages` (`duelSocket.ts:93-95`), and the engine's auto-resolve paths do `messages.length = 0`
(`EdisonDuel.ts:218,233`).

The PRD approved **MH-2a** — "a complete and correctly-routed event feed over the existing `MSG`
passthrough; server-local, no contracts change" — and explicitly **deferred MH-2b**, a typed
`DuelEvent` union replacing that passthrough, as "the CTO's call at implementation, and only if
web-side interpretation sprawls."

Two facts made that call decidable now rather than later:

1. **MH-2a already requires server-side normalisation.** ND-4 — approved — is specified as living
   "inside MH-2a's normalisation": the server must identify which seat's LP moved, because
   `MSG_DAMAGE`(91) carries `player` while `MSG_PAY_LPCOST`(100) and the battle-damage path do not.
   So the server will be constructing structured event objects either way. The only open question is
   whether that structure has a name in `packages/contracts` or arrives at the web as untyped JSON.
2. **Requirement C3 forces the web to interpret it.** The event log must render every engine event as
   a row carrying card identity, verb, and source→destination, phase-nested. Building those rows from
   a `.passthrough()` envelope means the web package must know ocgcore message numbers and body
   layouts.

That second point is not hypothetical. The same duplication already produced the defect this project
is paying to fix: the redaction message-number table is wrong (`SUMMONING`, `BECOME_TARGET`,
`CARD_SELECTED` dropped for both seats) **and its tests encode the same invented numbers**. Knowledge
of ocgcore's wire format held in two packages drifts silently, and the tests drift with it.

## Decision

**MH-2b is in scope.** The event feed is normalised server-side into a typed `DuelEvent` discriminated
union in `packages/contracts/src/duelEvent.ts`, delivered on a new additive `EVENTS` server→client
frame. Knowledge of ocgcore message numbers stops at the engine/server boundary and never enters
`packages/web`.

## Alternatives considered

**Ship MH-2a untyped now, type it later if the web sprawls.** This is what the PRD assumed. Rejected
because the sequencing is strictly worse: we would write the normaliser, ship its output untyped,
watch the web grow message-number knowledge, and then touch every consumer a second time to take it
away. The trigger condition — "if web-side interpretation sprawls" — is already met by C3 before a
line is written, so waiting to observe it buys no information.

**Additive context fields on the `DuelDecision` variants instead of a separate feed.** Rejected on
the same ground the CEO and Product Lead already ratified for MH-3: it is an additive change to a
locked union and would reopen ADR-0001 for no product gain.

**Exhaustively type all ~50 ocgcore message bodies.** Rejected. That is the thing the existing
`RedactedEngineMessage` ADR note deliberately declined, and it is still right. We type the *normalised
domain events the product needs* — summon, move, chain, LP change, attack, phase, turn, hint — not
ocgcore's wire format. The variant list is driven by numbered requirements, not by the core's message
enum.

## Consequences

- `packages/contracts` gains a union that must be kept in step with the normaliser. Schema tests are
  mandatory, and the normaliser is the single place that knows message numbers.
- The existing `MSG` frame and `RedactedEngineMessage` **stay**. Removing them is a separate decision
  and deliberately not taken here, so nothing that consumes them today breaks.
- ADR-0001 is untouched. `DuelEvent` is a new union alongside `DuelDecision`, not a modification of it.
- Scope grows against what the CEO approved — a new contract file and its tests — which is why this
  was raised rather than absorbed silently.
- What becomes harder: adding a new engine event now costs a contract change and a schema test, not
  just a passthrough. That is the intended cost. It is the property that stops the redaction-table
  class of defect recurring.
