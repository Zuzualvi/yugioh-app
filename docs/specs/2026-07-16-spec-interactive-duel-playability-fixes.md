# Spec — Playability fixes surfaced by the Phase 3 real-turn E2E (2026-07-16)

**Author:** CTO • **Status:** ACTIVE (delegated) • Closes the last real gaps before the interactive duel is
genuinely playable. Surfaced by the Phase 3 E2E (`e2e/playwright/duel.spec.ts` real-turn play-through, master
`e1a5fd11`). These are pre-existing bugs in the per-seat state snapshot + phase tracking, not new regressions.

Scope: `packages/engine` only. With real-WASM tests. Do NOT touch web/contracts/server/workflows.

## Bug A — field cards render face-down (own face-up monsters show `code=0`)
`packages/engine/src/buildStateForSeat.ts`: `duelQueryLocation` is returning `code=0` for MZONE (and likely
face-up SZONE) cards, so the board shows even the VIEWER'S OWN face-up monsters as face-down. A player cannot see
their own field — the board is not usable.
- Investigate why the query yields `code=0` for visible cards. Check: the `QUERY_FLAGS` (does this ocgcore-wasm
  build return `code` under the CODE flag for mzone? is the field named `code` vs something else in the returned
  object?), and the **spread-order bug** at lines ~92–98: `const base = { code: <computed>, position, ...card }`
  — the `...card` spread OVERRIDES the computed `code`/`position` with the RAW query object's fields; if the raw
  object's `code` is 0/absent this clobbers a correct value. Restore correct precedence.
- **Correct behavior (redaction unchanged):** a card is visible (real `code`) to a viewer when it is the viewer's
  own card, OR it is public/face-up (opponent's face-up monsters/spells are public). It is redacted (`code:0`)
  only when: opponent's hand/deck, opponent's face-down card, or `isPublic===false`. Keep that rule; just ensure
  visible cards actually carry their real code.
- **Test (real WASM):** using the seed/fixture decks, normal-summon a monster, then `getStateForSeat(controller)`
  → assert the summoned monster's `code` is the real passcode (non-zero) in the controller's own mzone; and from
  the OPPONENT's view, that face-up monster is ALSO visible (public). Assert a face-DOWN set card is `code:0` to
  the opponent but real to its controller.

## Bug B — `currentPhase` / `currentTurn` never update (stuck at 0)
`packages/engine/src/EdisonDuel.ts` `updatePhaseFromMessage` only handles DAMAGE/RECOVER/WIN; it never updates
`phaseInfo.currentPhase` or `currentTurn`, so the board's phase ribbon + whose-turn indicator are frozen.
- Handle the ocgcore new-phase and new-turn messages: find the correct message type constants in the installed
  `ocgcore-wasm` `.d.ts` (OcgMessage enum — the NEW_PHASE / NEW_TURN members; do not guess the numbers, read
  them) and update `phaseInfo.currentPhase` from the phase value and `phaseInfo.currentTurn` from the turn player.
- Keep `currentPhase` in the same encoding the web `DuelBoard` PHASE_LABELS already expects (1 Draw / 2 Standby /
  4 Main1 / 8 Battle / 16 Main2 / 32 End) — if ocgcore emits a different phase encoding, map it to that.
- **Test (real WASM):** drive the engine from turn 1 through phase advances / into turn 2 → assert
  `getStateForSeat().currentPhase` and `currentTurn` change accordingly (not stuck at 0).

## Optional (nice, not required): strengthen the Phase 3 E2E assertion
Once Bug A is fixed, the real-turn E2E could assert a face-UP card appears in the monster zone (instead of the
current empty-zone-disappears workaround) and the phase ribbon shows "Battle". Only do this if it stays
non-flaky; otherwise leave the E2E as-is and note it. (The E2E lives in `e2e/`, a different owner — coordinate via
CTO rather than editing it here unless trivial.)

## Acceptance
- `npm run verify` GREEN repo-wide (new engine tests included). The existing Phase 3 E2E still passes.
- New engine tests prove: own face-up field cards carry real codes; opponent face-up cards visible, face-down
  redacted; `currentPhase`/`currentTurn` update through a turn.

## Git / delivery (per AGENTS.md)
- `git config user.email` == `zuhayralvi@gmail.com`; `Co-Authored-By: Claude <noreply@anthropic.com>` trailer;
  own `packages/engine/**`; `git pull --rebase --autostash origin master`; never `git add -A`; no `.github/workflows/*`.
  Report pushed SHA + the new tests + `npm run verify` result.
