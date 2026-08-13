---
linear_project: Duel Experience Redo
---

# 01 · Object model, and where the system's objects disagree with the player's intents

**Issue:** ZUH-121 · **Project:** Duel Experience Redo · **Owner:** UX/UI specialist
**Direction:** reconciliatory. The backend exists, the rules engine is not being rebuilt, and
ADR-0001's 20-variant decision protocol is a locked input. Everything below is derived from what
the server actually sends — read from `packages/contracts/src/duelDecision.ts`,
`packages/contracts/src/duel.ts`, `packages/contracts/src/duelEvent.ts`,
`packages/server/src/duel/duelSocket.ts`, `packages/engine/src/buildStateForSeat.ts` on `master`
(`f86683c`), and cross-checked against **1,457 real WebSocket frames** recorded from live duels
(`docs/specs/2026-08-12-duel-break-enumeration/logs/`).

---

## 0 · The one-line summary

The engine's unit is a **decision**. The player's unit is an **intent**. The shipped screen has no
object for an intent, and it has no object for *not being asked*. Almost every break in ZUH-118
lives in one of those two holes.

This document defines three client-side objects that fill them — **Intent**, **Control**, and
**Delta** — and one classification law over the 20 decision variants that replaces the mechanism
that made the game unwinnable.

---

## 1 · What the server actually sends

Frame counts are from the 15 recorded scenarios; "observed" means I read it out of a real frame.

| Frame | Shape | Observed | Notes |
|---|---|---|---|
| `SEAT_ASSIGNED` | `{seat, seatToken}` | 30 | The only statement of which seat you are. |
| `STATE` | `DuelStateSnapshot` | ~359 | Per-seat redacted board. Carries `currentTurn`, `currentPhase`, `lp`, `turnNumber?`. |
| `CLOCK` | `{onClockSeat, deadlineAt, deadlines?}` | 284 | **`deadlineAt`/`deadlines` die with the clock. `onClockSeat` must not.** See ND-8. |
| `EVENTS` | `DuelEvent[]` | 173 | MH-2a. Typed, routed, per-seat redacted. |
| `MSG` | raw engine message | 539 | Legacy raw relay, still sent alongside `EVENTS`. |
| `DECISION` | `DuelDecision` | 131 | One at a time, to one seat. |
| `DECISION_CONTEXT` | `{caption?, activatingCard?, chain?}` | **2** | Sent only when there is chain context. Never consumed by the client. |
| `DECISION_RESPONSE` (→) | `DuelDecisionResponse` | 129 | Client → server. |
| `DUEL_END` | `{winner, reason}` | 2 | `reason: "normal" \| "timeout" \| "resign"`. |
| `ERROR` | `{message}` | 2 | Raw server strings, e.g. `"not your turn"`. |
| `ROOM_STATE` | room snapshot | 165 | **Carries `displayName` for both players, and `flip.choice` + `seats.seat0UserId`.** Pre-duel only. |

### 1.1 Three facts from the recorded frames that change the design

**(a) The player's own face-down cards are anonymous *to the player* inside decisions.**
Observed, `s10-full-duel-2.log`:

```
{"kind":"ChainPrompt","player":0,"forced":false,
 "selects":[{"code":0,"name":"","controller":0,"location":"SZONE","sequence":0,"description":""}]}
```

`controller: 0` is the seat being asked. The engine redacted a card from its own owner.
`SelectCard` shows the same defect *mixed within one decision* — `Raiza the Storm Monarch` named,
own set card blank. `IdleCommand`, by contrast, carries real names (`"name":"Uraby"`). So the
board reads fine and the answer surface is blind. This is not a rendering bug and cannot be fixed
in the client. **Delta ND-9, must-have.**

**(b) `DECISION_CONTEXT` fires twice in fifteen scenarios**, and both times only because a chain
existed. `buildDecisionContext` returns `null` unless `caption || chain || activatingCard`
(`duelSocket.ts:552-554`), and no observed frame carried a `caption`. The commonest Edison window —
*respond to a summon* — therefore has no context on the wire even for a client that reads the frame.
**Delta MH-3b, must-have.**

**(c) `SelectZone` has no `cancelable` field and `RSelectZone.indices` is not nullable.**
There is no cancel response for a zone step. `docs/reference` runtime-facts Q4 records that sending
one hangs the engine. **This, not the clock, is why the commit point exists.** See §4.

---

## 2 · The three client-side objects the protocol has no message for

### 2.1 `Intent` — one thing the player started

```
Intent = {
  verb:        "Normal Summon" | "Set" | "Tribute Summon" | "Special Summon"
             | "Activate" | "Change Position" | "Attack" | "Enter Battle Phase" | "End Turn",
  subject:     CardRef | null,        // the card the player clicked; null for phase verbs
  subjectName: string,                // resolved at creation from IdleCommand/BattleCommand
  startedAt:   number,
  cancelable:  boolean,               // is the CURRENT step cancelable
  committed:   boolean,               // has an uncancelable step been reached
}
```

**Created:** the player picks a verb chip, or presses a phase control. Never by a server frame.
**Destroyed — and this is the half the last build omitted:** an intent ends when *any* of
1. the client sends a response to a decision and the engine does not immediately ask another
   decision of this seat (i.e. control leaves — see `Control`);
2. the player cancels a still-cancelable step;
3. `DUEL_END`;
4. the socket drops (on reconnect the intent is **not** restored; the screen resumes at whatever
   decision the server re-sends, with no intent line — a stated degradation, ND-2).

> 🔑 **The persistence/cessation pair.** The previous PRD required the intent presentation to
> survive the `STATE`-then-`DECISION` gap and never blank. It was implemented as "never clear the
> pending decision", and the player sat on a stale question with the board dimmed and `End Turn`
> disabled (ZUH-118 break 2). Every persistence rule in this design carries its cessation
> condition in the same sentence. §7 audits them.

### 2.2 `Control` — whether the game is waiting for me

```
Control = "mine" | "theirs" | "resolving" | "disconnected" | "ended"
```

Derived, in this precedence order:

| Control | Condition |
|---|---|
| `ended` | `DUEL_END` received |
| `disconnected` | socket not open |
| `mine` | an unanswered `DECISION` is held for my seat |
| `theirs` | last `CONTROL` frame named the other seat |
| `resolving` | last `CONTROL` frame named my seat but no `DECISION` is held |

**`mine` is the only state in which the board affords anything.** That is requirement B2 expressed
as one line of derivation rather than as a rule the components each have to remember.

The `CONTROL` frame is the clock frame's `onClockSeat` with the deadlines removed
(delta **ND-8**). Without it the client can say *"waiting"* but cannot distinguish *"they are
thinking"* from *"the engine is resolving"* — which is ZUH-118 break 26, and which the needs model
ranks as half the duel (M10).

### 2.3 `Delta` — what changed while it was theirs

```
Delta = {
  sinceEventSeq: number,      // seq of the last event before I last lost control
  events:        DuelEvent[], // everything since, in engine order
  unread:        boolean,
}
```

**Created:** control returns to me (`Control` goes `theirs`/`resolving` → `mine`) and at least one
event arrived while it was away.
**Destroyed:** I take my first action of this turn · I dismiss it · control leaves me again ·
`DUEL_END`. **It never auto-fades**, because the recovery for "I did not read it in time" is
"read it again" (needs model M3).

This is gap 3 in the needs model, ranked 3rd by frequency (~12–20 hits per duel), and the teardown
says no client in the reference set ships it. It is the one place this design proposes something
none of the competitors do, and it is proposed because the engine already puts every fact on the
wire (`EVENTS`) and the player is currently asked to diff two board states in their head.

---

## 3 · THE DECISION CLASSIFICATION LAW

This replaces `responsePrompts.ts` and the deleted verbosity levels. It is the fix for the defect
that made the shipped game unwinnable.

### 3.1 What went wrong, precisely

`responsePrompts.ts:86` decided "mandatory" as *"has no decline path"*. ocgcore marks
attack-target `SelectCard` as `cancelable: true`. So the client classified a **step inside an
attack the player had already declared** as an **optional response window**, and declined it —
sending `{"kind":"SelectCard","indices":null}` in the same tick, with no DOM change in between
(`s11-full-duel-3.log:319-327`). Cancelling the target cancels the attack. The player saw an inert
button, eight times in a row.

PRD **A2** makes cancelability an illegal input to that decision. So the classifier needs a
different axis, and the PRD names it: *"A chain window is an offer you may decline; an attack-target
pick is a step inside an intent you already started."*

### 3.2 The law

**Every decision variant is permanently classified as an OFFER or a STEP. The classification is
static, per variant, and does not consult `cancelable`, `forced`, `min`, `max`, or any setting.**

- **OFFER** — the engine is asking whether you want to do something. Declining is a *substantive
  answer with consequences*. The client presents it **always**, with exactly one exception:
  when the variant's own fields prove that exactly one answer exists.
- **STEP** — the decision parameterises something the player already started. Declining *aborts
  the player's intent*. **The client may never send a decline or cancel for a STEP** (PRD A3). It
  may answer a STEP without presenting it only where exactly one substantive answer exists.

**"Substantive answer" is defined as: an answer that is not an abort of the player's own intent.**
This is the reading of A1 that makes A1, A2, A3 and A5 mutually consistent, and I could not find
another that does. Stated explicitly because the previous build's failure was an unstated reading.

### 3.3 The table — all 20 variants

| # | Variant | Class | Auto-answered only when | Player sees when auto-answered | Decline the client may send |
|---|---|---|---|---|---|
| 1 | `IdleCommand` | **OFFER** | never | — | never |
| 2 | `BattleCommand` | **OFFER** | never | — | never |
| 3 | `ChainPrompt` | **OFFER** | `forced === true && selects.length === 1` | receipt | **never** |
| 4 | `SelectEffectYN` | **OFFER** | never | — | never |
| 5 | `SelectYesNo` | **OFFER** | never | — | never |
| 6 | `SelectOption` | **OFFER** | `options.length === 1` | receipt | never |
| 7 | `SelectCard` | **STEP** | `min === max === cards.length` | receipt + board flash | never |
| 8 | `SelectTribute` | **STEP** | `min === max === cards.length` | receipt + board flash | never |
| 9 | `SelectZone` | **STEP** | `zones.length === 1` | receipt | n/a — no cancel exists |
| 10 | `SelectPosition` | **STEP** | `positions.length === 1` | receipt | n/a |
| 11 | `SelectUnselectCard` | **STEP** | never | — | never |
| 12 | `AnnounceRace` | **STEP** | `count === 1 && available.length === 1` | receipt | n/a |
| 13 | `AnnounceAttrib` | **STEP** | `count === 1 && available.length === 1` | receipt | n/a |
| 14 | `AnnounceCard` | **STEP** | never | — | n/a |
| 15 | `AnnounceNumber` | **STEP** | `options.length === 1` | receipt | n/a |
| 16 | `SortChain` | **STEP** | `cards.length <= 1` | receipt | n/a (`order:null` = default order, a real answer) |
| 17 | `SortCard` | **STEP** | `cards.length <= 1` | receipt | n/a |
| 18 | `SelectCounter` | **STEP** | total available === `count` | receipt | n/a |
| 19 | `SelectSum` | **STEP** | exactly one subset sums to `amount` | receipt | n/a |
| 20 | `SelectDisfield` | **STEP** | `zones.length === count` | receipt | n/a |

**Consequences that fall straight out of the table, each of which is a shipped break:**

- **Break 1 dies.** Attack target is row 7, a STEP. With more than one legal target it is presented
  (PRD **A5**). With exactly one it is auto-answered and the attack resolves. In neither case does
  the client send `indices: null`. *There is no code path left that can decline a step.*
- **Break 5 dies.** Every `ChainPrompt` is an OFFER and is presented. There is no setting.
- **Break 29 dies.** A `SelectTribute` auto-answered at `min === max === cards.length` no longer
  needs "cancel stays reachable via the ribbon", because the ribbon's cancel is a *player* action
  on a *live* step, and the receipt names what was tributed.
- **Old §16A resolves.** `SelectCard`/`SelectTribute` with `min===max===cards.length && cancelable`
  has exactly one substantive answer. Auto-answer it. Cancel remains a player affordance while the
  step is live, and the client never sends it. No legal answer is lost.
- **Old §16B is reopened and reversed.** `SelectZone` with `zones.length > 1` was auto-answered
  because of the `Choose zones: OFF` default — an explicit CEO call, flagged at the time as
  contradicting the auto-resolve rule. **Under this law it may not be**, because two zones are two
  substantive answers. See §5; this is a decision I am surfacing, not taking alone.

### 3.4 Why this is testable rather than trusted

The classification is a pure function of the variant tag plus the variant's own numeric fields. It
has no reference to `cancelable` anywhere. That means it can be enforced by a source-level check
(no `cancelable` identifier may appear in the auto-answer module) as well as by the answer-outcome
enumeration. Both are in the component contract as acceptance criteria **CC-A1** and **CC-A2**.

---

## 4 · The commit point — kept, re-founded, and cut down

**The question the brief asks:** the Intent Ribbon's commit lock was justified entirely by a CEO
quote about one clock covering a six-decision summon. There is no clock. Keep it or delete it?

**My call: keep the commit point. Delete the step budget. Delete the glyph. Re-found the
justification on the protocol.**

**Why it survives the clock's deletion.** Its actual load-bearing fact was never the clock — it is
that **`SelectZone` has no cancel response in the protocol** (`RSelectZone.indices` is
non-nullable, confirmed in the contract and in every recorded `SelectZone` frame, none of which
carried a `cancelable` field). An intent that reaches a zone step cannot be backed out of. That is
true whether or not anything is timed. Three things make it *more* important now, not less:

1. **PRD A3** forbids the client from aborting an intent on the player's behalf. The player's own
   cancel is therefore the *only* exit that exists, so knowing whether it exists is the whole of
   the player's question 5 ("Can I get out?").
2. **The players are learning the format** (change 4). A learning player probes. A player who
   cannot see where probing stops being free stops probing — and that cost is invisible, because
   it shows up as a player who does nothing.
3. There is no longer a timeout to release a player who talks themselves into a corner, which
   raises the price of an unexpected irreversible step.

**What I delete, and why.** The previous ribbon printed `3 steps · 2 left, possibly more if a
trigger fires` — a client-side guess from a client-owned template, set in the same typographic
register as the engine-derived lock (needs model gap 15: *a guess and a fact wear the same
clothes*). That is the system-thinking surface, not the lock. It goes. So does the `🔒`/`▲` glyph,
which usability finding M1 recorded as never defined anywhere.

**What remains is two words and one button:**

```
Tribute Summoning "Caius the Shadow Monarch"          [ Cancel summon ]
```
and, at the last cancelable step, the *confirm control of that step* carries the price:
```
[  Tribute Overdrive — after this you cannot cancel  ]
```
and after it:
```
Tribute Summoning "Caius the Shadow Monarch"          Committed
```

Three renderings, all plain text, no legend required. The claim it makes is an engine fact: the
next decision the engine will send has no cancel response.

**Where the claim comes from.** The client knows the step sequence for its own verbs (it always
did — that is what the template was). It uses that knowledge for *one boolean* — "does a
non-cancelable step come next" — instead of for a printed step count. Where the client is unsure,
the cancel button simply stays live and no warning is printed; being silent is allowed, being
wrong is not.

---

## 5 · Where the system's objects and the player's intents disagree

Ranked by how often a player hits it in one ~12-turn duel. Frequencies are the needs model's
estimates, which are `[I]` — a model, not a measurement.

| # | Disagreement | Hits/duel | Resolution in this design |
|---|---|---|---|
| **1** | **One intent is 2–6 decisions.** The player says "tribute summon Caius"; the engine asks four questions. | every play, 3–6/turn | The `Intent` object. One heading over every step, one cancel, one commit statement. |
| **2** | **The engine has no message for "control left you."** It simply stops asking. | every handover | `Control`, derived, with `CONTROL` (ND-8) as the positive signal. Answering clears the decision **immediately**. |
| **3** | **The engine has no message for "here is what changed."** It has 173 `EVENTS` frames and no notion of "since you last looked." | every handover | The `Delta` object and the *While you were away* surface. |
| **4** | **A decision that is a step looks identical to a decision that is an offer.** Both are `DuelDecision`; `cancelable` does not separate them. | every attack, every chain | §3's static classification. **This is the unwinnable-game defect.** |
| **5** | **The engine redacts a player's own cards from that player's own decisions.** | every chain window | ND-9. Cannot be fixed client-side. |
| **6** | **The engine states legality, never cause.** Absence of an option is not a statement. | every Battle Phase, every turn | Say nothing about causes (D1/D2). Convert two *positive* engine facts into statements instead: the turn-resource line (§6) and the delta. |
| **7** | **The engine's decisions carry no subject for a summon-triggered window.** | 5–20, each decisive | MH-3b. Until it lands, line 1 degrades to a **stated** fallback, never a bare verb (§ surface inventory 4). |
| **8** | **The engine gives a cost only after commitment.** `release_param` is on `SELECT_TRIBUTE`, never on `SELECT_IDLECMD` — verified live by the CTO 2026-08-07. | 5–15 | Not designed around. The verb chip says `Tribute Summon` with no count; the count appears at the tribute step where the engine gives it. Recorded as an unmet need, not a delta. |
| **9** | **The engine identifies seats absolutely; the player has one seat.** | ambient | Every name, colour and pronoun resolves through `mySeat`. No component receives a seat-indexed array. |
| **10** | **The room knows both players' names and who chose to go first; the duel does not.** `ROOM_STATE.you/opponent.displayName` and `flip.choice` exist and stop at the room boundary. | ambient | ND-11 (S). `currentTurn` on the first `STATE` already answers *who goes first*, so only the name is a delta. |

---

## 6 · Two positive statements the client can make honestly

Both exist because "absence of an option is not a statement" (disagreement 6), and both are
carefully **not** cause claims, because D1/D2 forbid those.

**(a) The turn-resource line.** `Normal Summon · not yet used` / `Normal Summon · spent`.
Derived from the **event feed**, not from the legal-move list: the client renders `spent` once it
has seen a `SUMMON` event for its own seat in the current turn number, and `not yet used`
otherwise. That is a statement about something that happened, which the engine emitted. It is
*not* the claim "you cannot summon because you already have" — the client never says why anything
is unavailable. Resets on turn boundary. Answers the most common self-check in the game
(needs model M9, every turn).

**(b) The delta.** Same principle at larger scale: a re-presentation of events the engine emitted,
never a summary of what they mean.

**What I deliberately do NOT state:** why a card affords nothing. Clicking a card that affords
nothing produces a 200 ms non-verbal shake on the card and no text. `"This monster has already
attacked."` is deleted (PRD change 5), and nothing replaces it. Silence is correct until an
omission reason reaches the wire (W4, nice-to-have, not requested).

---

## 7 · Persistence audit — every "this survives" with its cessation condition

Written as a table because the previous build's defect was a persistence rule with a missing half,
and a table makes a missing half visible.

| Thing that persists | Survives | **Ceases when** |
|---|---|---|
| `Intent` | `STATE`-then-`DECISION` gap; every sub-decision; every re-render | response sent and control does not stay mine · player cancels · `DUEL_END` · socket drop |
| Pending `DECISION` | `STATE` frames; `EVENTS` frames; re-render | **the instant the client sends its response** (optimistically, before any ack) · a newer `DECISION` replaces it · `CONTROL` names the other seat · `DUEL_END` |
| `Delta` | turn boundaries; log open/close; inspector use | player's first action this turn · explicit dismiss · control leaves me · `DUEL_END` |
| Auto-answer receipt | **everything — it has no timer** (ZUH-131 B1) | a **question** takes the dock band (an armed board does not) · the player's next action · control leaves me · `DUEL_END` |
| Chain strip | between links; across `STATE` gaps | `CHAIN_END` event + 600 ms · `DUEL_END` |
| Card inspector (pinned) | auto-push attempts (they queue) | `Esc` · another explicit click · `DUEL_END` |
| Error strip | `STATE`/`EVENTS` frames; **no timer** (ZUH-131 B2) | dismissed · superseded · the question is re-answered or replaced |
| Board | everything; it is never replaced by a spinner | never — the board is the screen |
| Turn-resource line | every decision within the turn | turn number changes |
| Opponent-away banner | everything | presence returns · duel ends |

---

## 8 · Decisions I am surfacing rather than taking

1. **`Choose zones` (old §16B).** The CEO's call was "zone placement defaults to auto, opt-in
   toggle", and the previous design flagged that this contradicts *auto-resolve only where exactly
   one legal answer exists*. PRD **A1** now states that rule as binding with no carve-out, and the
   classification law in §3 makes it enforceable. **Under A1 as written, `SelectZone` with
   `zones.length > 1` must be presented.** I have built it presented, with placement *on the
   board* (legal zones glow, one click) so it costs one click and no panel — which is what made
   the auto default attractive in the first place. If the CEO wants the auto default back, it is a
   named exception to A1 and should be written into the PRD as one rather than living in a
   settings toggle. This is item 1 of my escalation list.

2. **The abandonment ending (C2).** Requires a server-side notion of "gone long enough", which is
   a timer even though nothing about it is displayed. I have designed it so the *player* presses
   the button (`Claim the duel`) and no duration is ever shown, which keeps "no clock" intact at
   the surface. The grace period before the button arms is a product number. See ND-10.
