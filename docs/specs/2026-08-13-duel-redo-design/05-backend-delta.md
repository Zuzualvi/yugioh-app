---
linear_project: Duel Experience Redo
---

# 05 · Backend delta

Two parts: **the status of every previously-approved delta, verified end to end**, and the new
ones this design needs.

**"Verified end to end" means all three of:** the type exists in `packages/contracts`, the server
emits it, and `packages/web` **consumes** it. A delta that exists on the wire and is consumed by
nobody is not shipped. Status read from `master` (`f86683c`) and cross-checked against 1,457
recorded frames from a live duel plus 3,008 from my own capture.

---

## 1 · Status of the previously-approved deltas

| # | Item | Status | Evidence |
|---|---|---|---|
| **MH-1** | `ZoneCard` gains zone `sequence` + `attack`/`defense`/`level`/`isPublic`; dense length-5 rows; `p*_fzone`; deck counts | ✅ **wired end to end** | `packages/contracts/src/duel.ts:68-103` has all fields; `packages/engine/src/buildStateForSeat.ts` populates them; `packages/web` reads `card.attack` (`ZoneSlot.tsx:223,236`) and `.sequence` in 12 places. Present in every recorded `STATE`. |
| **MH-2a** | Complete, routed, per-seat-redacted event feed | ✅ **wired end to end** | `duelSocket.ts:510` emits `EVENTS`; `DuelScreen.tsx:172` has `case "EVENTS"`; `EventLogRail` renders it. **255 `EVENTS` frames** in my capture carrying `HINT, MOVE, SUMMON, SET, PHASE, TURN, CHAINING, CHAIN_SOLVING, CHAIN_SOLVED, CHAIN_END, ATTACK, BATTLE, LP_CHANGE`. |
| **MH-3** | Decision caption + activating card + chain stack, as a sidecar | 🔴 **SERVER-ONLY, and thinner than it looks** | Contract at `packages/contracts/src/duel.ts:177` and `duelEvent.ts:165-185`; server sends it at `duelSocket.ts:646` and `:897`. **`grep DECISION_CONTEXT packages/web/src` returns nothing** — the frame switch at `DuelScreen.tsx:150-184` has no case, so it is received and discarded. **And it fires almost never:** `buildDecisionContext` returns `null` unless `caption \|\| chain \|\| activatingCard` (`:552-554`), so across 15 recorded scenarios it appeared **twice**, both times only because a chain already existed, and **no observed frame carried a `caption`.** See MH-3b. |
| **ND-1** | `release_param` (tribute cost) on `IdleCommand.summons[]` | ⛔ **WITHDRAWN, correctly** | CTO/CEO 2026-08-07. `SELECT_IDLECMD summons[]` carries only `{code, controller, location, sequence}` at level 5 and level 7; `release_param` is on `SELECT_TRIBUTE` only, after commitment. Confirmed in every recorded `IdleCommand`. **This design does not ask for it back** — the verb chip reads `Normal Summon — tribute` with no count, and the count appears at the tribute step. |
| **ND-4** | Damage/LP events name the seat whose LP moved | ✅ **wired end to end** | `duelEvent.ts:110-121` — `LP_CHANGE { seat, delta, reason }`; server normalises `DAMAGE`/`RECOVER`/`PAY_LPCOST` at `duelSocket.ts:343-379`; `EventLogRail.tsx:136-137` renders `{name} −1200 LP`. 20 `LP_CHANGE` events in my capture. |
| **ND-5** | Both clock deadlines on the wire | ⛔ **DEAD** — the clock is deleted entirely (PRD change 1). Its **replacement** is ND-8 below. |
| **ND-6** | `CardDTO.preErrataText` | ✅ **wired end to end** | `packages/card-data/src/index.ts:37` derives it; `packages/contracts/src/card.ts:61` carries it; `packages/web/.../CardInspector.tsx:190` gates the badge on `info?.preErrataText && artState === "ok"`. |
| MH-4a | Explicit `SelectZone` commit point (web-only) | ✅ **satisfied without a change** | The protocol already proves it: `RSelectZone.indices` is not nullable (`duelDecision.ts:392-396`) and no recorded `SelectZone` frame carries a `cancelable` field. The client derives the commit point from the protocol, not from a server flag. |
| NH-2 | Event persistence across reconnect | ❌ **not sent** | `duelSocket.ts:860-900` re-sends `SEAT_ASSIGNED`+`STATE`+`CLOCK`+`DECISION` and no event backfill. The honest empty state (`Earlier turns are not available.`) is designed for; see ND-12. |
| NH-3 | Per-intent clock | ⛔ **DEAD** with the clock. |

---

## 2 · New deltas

Sizes are S (a field or a frame), M (a behaviour), L (a subsystem).

### Must-have

| # | Item | Why the design needs it | Size |
|---|---|---|---|
| **ND-8** | **`CONTROL` frame — the `CLOCK` frame with the clock removed.** `{ type: "CONTROL", seat: Seat \| null }`, sent whenever the decision-holding seat changes and in the reconnect burst. `CLOCK` is deleted. | The client must be able to say *whose problem this is* without inferring it from a decision it may not have. It is the positive half of PRD **B1**; without it the client can render "waiting" but cannot distinguish *they are deciding* from *the engine is resolving* (ZUH-118 break 26, needs model M10 — half the duel). `CLOCK.onClockSeat` already carries the value; this is that field with the deadlines dropped. | **S** |
| **ND-9** | **Stop redacting a player's own cards from that player's own decisions.** `packages/engine/src/decision/messageToDecision.ts:78-84` — `isHidden()` hides any face-down-positioned card **regardless of controller**, and ocgcore reports hand cards as `position: 10`. **Redaction must be by controller, not by position.** | 🔻 **DOWNGRADED from must-have to should-have, and I was wrong in the first revision when I wrote "cannot be fixed in the client."** It can, for most cases: the `STATE` snapshot is **not** redacted from its owner, so the client already holds the real code at `(controller, location, sequence)` and can join the two. That join is now implemented (`resolveCode`) and the chain window names your own set card with no backend change at all. ND-9 remains the right fix **at source** — the join is the client compensating for a payload that should not have been redacted — and it is **still must-have for any candidate whose location is not in the snapshot**, i.e. a `DECK`-located candidate, where the client has only a count. See §4a. | **S–M** |
| **ND-10** | **A duel with an absent opponent reaches a definite end.** Three parts: (a) a `PRESENCE { seat, presence }` frame inside the duel, so the screen can say the opponent has gone — today presence exists only in `ROOM_STATE`; (b) a server-side grace period after which the present player may claim, exposed as a boolean on `PRESENCE`, **never as a duration** (nothing about it is displayed); (c) a `CLAIM` response and `DuelEndReason` gains `"abandoned"`. | PRD **C1/C2**. Timeout-forfeit was the only ending ZUH-118 ever observed and it is deleted. Without this, an opponent who closes the tab leaves the duel running forever. | **M** |
| **ND-11** | **Both players' display names in the duel.** `SEAT_ASSIGNED` (or a `SEATS` frame) gains `names: [string, string]`. | `ROOM_STATE` carries `you.displayName` and `opponent.displayName` and stops at the room boundary; the duel screen hard-codes the string `"Opponent"` in four places. Needs-model gap 8, ambient, acute at the end. **Turn order needs no delta** — `STATE.currentTurn` on the first snapshot already answers it. | **S** |
| **MH-3b** | **Make the decision-context sidecar actually carry a subject, and send it for every decision.** Two changes: (1) populate `caption` reliably — today `relay.pendingCaption` is cleared at `duelSocket.ts:643` and no observed frame carried one; (2) carry the **triggering event** for non-activation windows, above all a **summon**, which is the commonest Edison response window and currently produces a sidecar with nothing in it. Shape: `trigger?: { kind: "SUMMON" \| "SET" \| "ATTACK" \| "PHASE" \| "ACTIVATE"; card?: EventCardRef; actor: Seat }`. And remove the `hasContent` gate so a decision always gets a sidecar, even an empty one. | Needs-model **gap 1**, the top-ranked gap: *the response window has no subject*. 5–20 hits per duel, each decisive. Also fixes the duplicated link-1 entry visible in the recorded `chain` array. **The client half is in scope for engineering regardless** — the frame is already sent and already dropped. | **M** |
| **ND-7** | **Stop leaking the opponent's hidden hand.** `buildStateForSeat.ts:47-59` — `toZoneCard` spreads `...card` and zeroes only `code`, so `level`, `attack`, `defense` and `isPublic` go out for every hidden card. Recorded verbatim: `{"code":0,"position":10,"level":6,"attack":2400,"defense":1000,...}`. **Omit the fields rather than zero them, and make redaction allowlist-shaped** — name the fields an opponent may see (`code`, `position`, `sequence`) — because a denylist fails open every time the type grows a field. | Integrity. Readable from any browser network tab. Touches the same `ZoneCard` type as MH-1, so they land together — MH-1 is already shipped, which means ND-7 is now a change to a live type and its optional fields must stay optional. | **S** |

### Nice-to-have

| # | Item | Why | Size |
|---|---|---|---|
| **ND-12** | Event backfill on connect and reconnect (the old NH-2). | The player who most needs the transcript is the one who just came back, and today they get nothing. The design ships the honest empty state (`Earlier turns are not available.`) and a `— feed resumes here —` rule, which is correct but is a mitigation. Also the only thing that could make the **delta** survive a reload. | M |
| **ND-13** | Orphan sweep: a duel with neither seat connected for a long period is ended server-side. | ND-10 covers the case where one player is present to claim. This covers the rest. No screen surface. | S |
| **ND-2** | Intent correlation across reconnect (`sessionStorage`, or an id on the sidecar). | The intent line is client-only, so a reconnect mid-intent loses it. Tolerable and **stated** as a degradation rather than left to be reported as a bug. | S |
| **ND-3** | Decide `IdleCommand.shuffle`: advertise it or drop the response value. | `responseToOcgResponse.ts:101` maps `"shuffle"`, the raw message carries it, `messageToDecision.ts` never reads it. Dead surface either way; this design has no shuffle verb. | S |
| **W4** | A reason a card affords nothing, **from the engine**. | Until it exists the honest surface says nothing, and this design says nothing (D1/D2). Recorded here so whoever adds it knows what it unblocks: the shake could become a sentence. **Not requested.** | — |
| **M5** | Activation cost as structured data on the wire. | The confirm control could then read `Activate Solemn Judgment — pay 4000 LP`. Producing "4000" from card text is a cause we generate and would be confidently wrong on any card we mis-parse. Deferred on its own merits; the ND-1 precedent it used to argue from has evaporated. | — |

---

### 2a · Why ND-9 moved, and what it cost to find out

The first revision of this design asserted ND-9 could not be worked around client-side, and the
prototype's ND-9 demo scenario was built by **hand-authoring a card name onto every candidate whose
recorded name was blank** — one literal, `"Dimensional Prison"`, applied to all of them. The
independent usability pass found the consequence: the confirm control named *Dimensional Prison*
while *Book of Moon* was what resolved. **The label came from invented fixture data and the response
came from the index — the answer-fidelity invariant violated at its root, and the fourth instance of
this defect family across two projects.**

The fix was not to author the name better. It was to notice that the identity is already on the
client: the recorded `STATE` gives `p1_hand[4].code = 14087893 = Book of Moon`, and the recorded
`ChainPrompt.selects[0]` is `{code:0, controller:1, location:"HAND", sequence:4}`. A join, on
recorded data, with nothing invented. The scenario that hand-authored a name is deleted; the
scenario that replaces it withholds the `DECISION_CONTEXT` frame instead, which is a **removal** from
recorded data rather than an addition to it, and is what the wire really gives for a summon window.

### 🔴 BINDING, and it applies to every entry in §2

**Before proposing a backend delta, check whether the client already holds the data.**

Not "consider". This is a gate on the delta list: an item does not enter §2 until someone has read
what the client is already sent and confirmed the answer is not there. ND-9 failed that check — the
identity was in a `STATE` frame the client receives on every step — and it entered the list as a
**must-have** anyway, on my assertion that it "cannot be fixed in the client", which was wrong.

**This is the second time on this project that a delta was designed and approved and turned out not
to be needed as specified.** The first was MH-3: built server-side, sent on the wire, and consumed
by nobody — a delta that shipped and reached no player. The failure modes differ, but the cost is
the same shape: engineering time spent on a change that the product did not turn out to require.
Two of the eight items that have passed through this list have had that property.

The corollary, for the deltas that remain: each of §2's must-haves should be re-read against the
same question before anyone builds it.

## 3 · Constraints inventory

- **Live users:** near-zero. That is the premise of the project.
- **Production data:** duel state is server-derived per snapshot and the response log is persisted
  and replayed (`duelStore.appendResponseLog` → `replayEdisonDuel`). ND-7 changes the *snapshot*,
  not the response log, so **replay of existing duels is unaffected**.
- **ND-9 changes decision payloads**, which *are* replayed against — but it adds identity to cards
  the responder already chose by index, and responses are index-based. Replay is index-based and
  therefore unaffected. **Confirm this before shipping it**; it is the one delta here with a replay
  question attached.
- **ADR-0001's 20-variant union is not reopened.** ND-8, ND-10, MH-3b and ND-11 are all
  *additional frames or additional fields on non-decision frames*, never changes to a
  `DuelDecision` variant.
- **Cannot break:** the E2E `data-testid` contract, the response-log replay path, the
  `DuelServerMessage` union's additive-only property.
- **`CLOCK` is deleted, and it is consumed today.** `DuelScreen.tsx:293` reads it. ND-8 must land in
  the same change as the clock deletion or the client loses its only control signal. Per AGENTS.md,
  removing a shared contract export requires the collateral files to be enumerated: they are
  `packages/web/src/screens/DuelScreen.tsx`, `packages/web/src/components/duel/board/ClockPanel.tsx`
  (deleted), `packages/server/src/duel/duelSocket.ts`, `packages/contracts/src/duel.ts`.

---

## 4 · One thing that is not a delta, and blocks everything

🔴 **ZUH-132 — the duel does not end when life points reach 0.** Recorded 2026-08-13 against
`master` on the repo's own harness: LP reached 0, `duelEnded` stayed `false`, play continued for
many more turns, and across 3,008 frames there were **764 relayed `MSG_WIN` messages and zero
`DUEL_END` frames**. `EdisonDuel.step()` sets `winner` on MSG_WIN (`:407-410`) but only returns
`status: "ended"` on `OcgProcessResult.END` (`:219-225`), and `duelSocket.ts:587` broadcasts
`DUEL_END` only on that status.

With the clock deleted, **resign is currently the only ending a duel can reach.** This is not a
backend delta — nothing new is being asked for, an existing path is broken — but no ending in the
inventory can be exercised end to end until it is fixed, and it should be sequenced before ND-10.
