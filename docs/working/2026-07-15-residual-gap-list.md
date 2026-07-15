# Residual-Gap List — Edison Duel App (2026-07-15)

**Author:** CTO. **Purpose:** the honest, consolidated list of what is knowingly incomplete or
left on non-Edison behavior, per the project's accuracy-honesty principle. Read alongside
`tasks/BOARD.md` (INVITE-\* + slice status) and
`/mnt/memory/.../decisions/2026-07-15-live-duel-wiring-bugs.md`.

Status legend: 🔴 blocks real play · 🟠 real gap, low risk for a 6-person club · 🟡 accuracy caveat · ⚪ deferred by design.

---

## A. Duel loop — what's proven vs not (after this session's fixes)

**Proven, CI-green (E2E `e2e/playwright/duel.spec.ts`, workflow `e2e.yml`):** two seats connect over the
real WS, both boards render real per-seat engine STATE, the on-clock seat's pending decision is delivered on
connect, and a RESIGN round-trips to both players. Wiring fixes (WS path, pending-decision-on-connect) + INVITE-01/02
are CI-green and deployed live.

### 🔴 A1 — Interactive decision layer is mock-only (a human cannot play a FULL duel through the UI yet)
`packages/web/src/api/decisionOptions.ts` (decode) and the ActionPanel response encoding (`{type:1,value}`) were
built against the MOCK. The real ocgcore engine emits different message shapes (e.g. the first real decision is a
`SELECT_CHAIN` with `{selects:[],forced:false}`, not `{options,canPass}`) and expects a typed `OcgResponse`
discriminated union (`{type:SELECT_CHAIN,index}`, `select_card` needs `indices`, …). So today, past connect +
view-board + resign, the UI renders no usable action buttons and can't submit a valid move. **This is the biggest
remaining build** — it is the deferred completion of Slice 30's real-engine integration (decode every decision
type + widen the `EngineResponse` contract + a real encoder + tests). Recommended as the next slice; reported to
the CEO, intentionally OUT of this close-out.

### 🟠 A2 — Refreshing the duel page drops you into mock mode
`DuelScreen` reads `seatToken`/`seat` from React-Router `location.state` (in-memory only). A hard page refresh on
`/duel/:id` loses it → `DuelScreen` falls back to the mock session. Real reconnect works at the socket level
(auto-reconnect within the same page session), but a browser refresh does not. Fix: persist seatToken (e.g.
sessionStorage keyed by duelId) or re-issue it from a `GET /api/duels/:id` authenticated lookup.

### 🟠 A3 — Creator connecting before the opponent joins
If the creator opens `/duel/:id` while status is still `waiting_for_opponent`, the server closes the socket
(4004) and the client reconnect-loops until the opponent joins. Works, but ugly. The real fix is the pre-duel
room (⚪ INVITE-03, deferred). E2E avoids this by having the creator enter after the join.

### 🟠 A4 — Logout HTTP verb mismatch
`packages/web/src/api/auth.ts` `logout()` sends **DELETE** `/api/auth/logout`, but the server route is
**POST** `/logout`. The DELETE 404s and is swallowed client-side, so the client clears local state but the
server session is NOT deleted (stays valid until its 30-day TTL). Fix: align the verbs (make the client POST, or
add a DELETE handler).

---

## B. Per-card Edison accuracy residuals

**Proven:** the 6 Edison *rules* are empirically asserted in CI (`accuracy` job, `edisonRules.accuracy.test.ts`).
**Not yet proven:** the individual functional-errata *card behaviors*. Source: `spikes/card-script-curation/REPORT.md`.

### 🟡 B1 — Errata card behaviors not individually asserted (the "errata behavioral coverage" gap)
~25 override scripts exist in `packages/engine/scripts/edison-overrides/` (11 DROP-IN pre-errata + 1 FIXED +
13 CTO-authored). We can say "the engine behaves like Edison at the rule level"; we cannot yet say "every errata
card behaves like Edison," because there is no per-card behavioral test. **This is the held item** — writing those
targeted tests needs an engine/QA pass (blocked this session only by the subagent-spawn outage; the WASM engine is
built and ready).
- **CTO-authored (13), highest test priority:** Ancient Fairy Dragon, Dark End Dragon, Destiny End Dragoon,
  Elemental HERO Prisma, Fortune Lady Light, Light and Darkness Dragon, Light End Dragon, My Body as a Shield,
  Quickdraw Synchron, Soul Exchange, Strike Ninja, Swap Frog, Treeborn Frog.
- **FIXED (1):** Red-Eyes Darkness Metal Dragon (per-copy count-limit fix — assert multiple copies act
  independently, unlike modern once-per-name).
- **DROP-IN pre-errata (11):** Brionac, Sangan, Rescue Cat, Goyo Guardian, Brain Control, Future Fusion,
  Necrovalley, Ryko, Catapult Turtle, Darkness Approaches, Ultimate Offering.

### 🟡 B2 — Cards knowingly left on MODERN behavior (verified equivalent, no override)
Per the curation report, 5 functional-errata cards use their current script because it already matches the
Edison target (modern script == Edison behavior): **Armory Arm, Black Garden, Mark of the Rose, Mausoleum of the
Emperor, Urgent Tuning.** Accepted as correct-by-equivalence; flagged here for honesty and so a future reviewer
re-checks if upstream scripts change.

### 🟡 B3 — Rules/ruling-level cards (covered by engine rules, not per-card scripts)
6 cards are handled at the ruleset level rather than by a card script: Lumina, Susa Soldier, Machina Gearframe,
Cyber Phoenix, D.D. Survivor, Jade Knight. Covered by the CI rule tests; no per-card script assertion applies.

---

## C. Deferred by design (already tracked on the board)

⚪ INVITE-03 pre-duel room · INVITE-04 randomized first turn · INVITE-05 link expiry/revoke · INVITE-06 distinct
link-error states · INVITE-07 Home async surfaces (Your-move queue / waiting / pending-invite card) · INVITE-08
copy/UX polish · INVITE-09 atomic seat-claim (single-instance-safe today) · async/multi-day duels · club-ops UX ·
match-history/replay surfacing · "Why is this illegal?" explainer (V2). See `tasks/BOARD.md` for full detail.
Automated matchmaking/ranked = permanent non-goal (link-first club by design).
