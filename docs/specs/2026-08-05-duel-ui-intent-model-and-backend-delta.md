---
linear_project: Duel UI Rebuild
---

# Duel UI Rebuild — intent/protocol disagreements and the backend delta

**Date:** 2026-08-05 · **Discovery issue:** ZUH-79 · **Companion teardown:** `docs/reference/2026-08-05-duel-ui-competitor-teardown.md`

Two parts, both derived by reading this repo, not by reading its documentation. Every claim about
what the code does cites `file:line`. Claims that could not be verified without executing the
engine are tagged `[INFERRED]` or `[UNVERIFIED]` — they need one live duel run to settle, and they
are marked so that none of them can quietly become a design decision.

**Part 1** enumerates where one player intent decomposes into several engine decisions — the
structural reason the screen feels like a form rather than a game. **Part 2** is the backend delta:
what the server must send that it does not send today, split must-have vs nice-to-have, each sized
and marked contracts-touching or server-local.

ADR 0001 (typed duel decision protocol) is an input to this document, not a subject of it. Nothing
here proposes changing the 19-variant decision union; the additive proposals that touch a locked
variant are called out as needing a CTO ruling.

---

## Part 1 — Where the decision protocol and player intent disagree

# Intent ⟷ Decision disagreements — ranked (ZUH-79, Part 1)

**Scope:** where one *player intent* decomposes into several *engine decisions*, and where an
engine decision has no player-facing meaning. Ranked by how often a player hits it in a normal
Edison game (human-vs-human, desktop).

**Inputs:** `docs/adr/0001-typed-duel-decision-protocol.md` (LOCKED — input, not subject),
`packages/contracts/src/duelDecision.ts`, `packages/contracts/src/duel.ts`,
`packages/engine/src/EdisonDuel.ts`, `packages/engine/src/decision/messageToDecision.ts`,
`packages/engine/src/redactMessage.ts`, `packages/server/src/duel/duelSocket.ts`,
`packages/web/src/screens/DuelScreen.tsx`, `packages/web/src/components/DuelBoard.tsx`,
`packages/web/src/components/duel/**`, and the empirical capture
`docs/reference/decision-capture-raw.json`.

Every claim is cited `file:line`. Anything I could not verify from code is tagged
**[INFERRED]** and says what would verify it (all such items need one live-WASM run;
`node_modules` is absent in this container, so no test could be executed).

---

## 0. Three facts that frame everything below

These are not "disagreements" but they change what any of the fixes below are worth. They are
verified, current, and each is a live bug rather than a design gap.

**F1 — The opponent's board is rendered as a wall of card backs, unconditionally.**
`DuelBoard.tsx:48` — `if (hidden || !isOwn) return <face-down-card>`. Every opponent zone row is
rendered with `isOwn={false}` (`DuelBoard.tsx:438-442`), so the opponent's **face-up monsters,
their graveyard, their banished pile and their Extra Deck** all render as `🂠`. The engine sends
the real passcodes for face-up opponent field cards — that was explicitly fixed engine-side
(`packages/engine/src/playabilityFixes.test.ts:75-140`, "face-up opponent MZONE card is visible
(non-zero code) to viewer") — and the web throws the fix away. No test asserts the current
behaviour (`DuelBoard.test.ts` covers hands and own GY only), so fixing it breaks nothing.
*You currently cannot see what you are attacking into.* Filed as a product defect.

**F2 — The client receives the engine event stream and discards 100% of it.**
`DuelScreen.tsx:145-146` is `case "MSG": break;`. Nothing else in `packages/web` reads `MSG` or
`engineType` (grep: one hit, that line). See "Can the client tell the player what just
happened?" in `backend-delta.md` §0.

**F3 — Board cards carry no identity, no stats, no position and no zone index.**
`ZoneCardSchema` is `{code, position}` (`contracts/src/duel.ts:67-73`). `DuelBoard` never reads
`position` at all, so face-up-attack and face-up-defense look identical; there is no name, no
ATK/DEF, no counters, no equip lines. `DuelZones` has no field-spell zone
(`contracts/src/duel.ts:77-91`) — Necrovalley (a real Edison deck) has nowhere to live.
**[INFERRED]** — a field spell most likely arrives inside `p0_szone`/`p1_szone` at ocgcore SZONE
sequence 5, indistinguishable from a set trap; verify with one live query.

---

## 1. "Summon this monster" (normal summon, with or without tribute)

**Frequency: several times per turn, every turn. Highest by a wide margin.**

**Intent, in the player's words:** *"Tribute summon Caius and pop his monster."* — one gesture:
drag Caius from hand onto the field.

**Decision sequence the engine emits:**

| # | kind | Emitted because | Evidence |
|---|---|---|---|
| 1 | `IdleCommand` → response `{action:"summon", index}` | main phase action list | `duelDecision.ts:142-153`; capture `SELECT_IDLECMD` |
| 2 | `SelectTribute` (only if tributes are required) | ocgcore asks for releases | `liveDecision.test.ts:469-484` drives exactly `summon → SelectTribute → SelectZone`; capture `SELECT_TRIBUTE` |
| 3 | `SelectZone` | ocgcore `SELECT_PLACE`, field_mask decoded | `messageToDecision.ts:473-483` |
| 4 | `SelectPosition` — **only for some monsters** | not emitted for Simple Normal Monsters | `e2e/playwright/duel.spec.ts:23-25` |
| 5 | `ChainPrompt` to the **opponent** (Bottomless, Solemn, etc.) | summon-response window | `EdisonDuel.ts:222-235` auto-passes it only when empty *and* not forced |
| 6 | `ChainPrompt`/`SelectCard` back to **you** — Caius's own on-summon trigger and its target | trigger + target | capture `CHAINING`/`BECOME_TARGET`/`SELECT_CARD` |

So one intent = **2 to 6 typed decisions**, each a full WebSocket round trip
(`duelSocket.ts:208-239` → `stepAndBroadcast` → `STATE`+`CLOCK`+`DECISION`).

**What the screen must remember, pre-empt or batch to make this feel like one action**

- R1.1 The screen **must** carry one client-side "pending intent" object across the whole
  sequence (chosen card, its identity, what step we are on) and keep a single persistent
  affordance on screen — *"Summoning Caius the Shadow Monarch…"* — from step 1 to step 6.
  Today the panel is remounted from scratch at every step: `STATE` arrives before `DECISION` and
  sets `pendingDecision = null` (`DuelScreen.tsx:128-131`, server order `duelSocket.ts:118-128`),
  so the player sees *"Waiting for engine…"* (`ActionPanel.tsx:47-57`) flash between every
  sub-step of their own single action.
- R1.2 The screen **must** auto-answer any sub-decision that has exactly one legal answer, with
  no round trip visible to the player: `SelectTribute` where `min === max === cards.length`;
  `SelectPosition` where `positions.length === 1`; `SelectZone` where `zones.length === 1`.
  (Note the auto-answer still costs a round trip — the client answers immediately; it is a
  *perceptual* batch, not a protocol change.)
- R1.3 The screen **should** offer a "zone preference" so `SelectZone` for a routine summon is
  answered from a stored default (left-most free MZONE) without prompting, and only prompts when
  the zone is contested. Master Duel never asks for a monster zone.
  ⚠ **Product decision, CEO's call:** auto-answering `SelectZone` removes a legal choice
  (zone matters for Ojama Trio / lateral-position plays and for some Edison lines). Open question,
  see §9 OQ-1.
- R1.4 The screen **must** treat the whole sequence as **one clock move**. Today the deadline is
  recomputed on every engine decision (`duelSocket.ts:113` → `timer.ts:8`), so a tribute summon
  hands the player 3–6× the per-move allowance while the opponent watches the clock jump back to
  full repeatedly. Two seats disagree about what a "move" is.
- R1.5 The screen **must** show the cost before the commit. `IdleCommandPanel.tsx:118` labels
  every `summons[]` entry `"Normal Summon"`; nothing in `CardEntry`
  (`duelDecision.ts:92-99`) says the summon will cost one or two tributes, and the adapter throws
  away the one field that hints at it (`release_param`, read as a type then never used —
  `messageToDecision.ts:505-515`, `types` alias at `:228`). The player clicks "Normal Summon" and
  *then* learns Caius eats a monster.

**What goes wrong today**

- Panel unmount/remount flash between every sub-step (R1.1 evidence).
- `SelectZone` **cannot be cancelled** — `SelectZoneSchema` has no `cancelable`
  (`duelDecision.ts:211-216`) and `RSelectZoneSchema.indices` is not nullable (`:393-396`),
  whereas `SelectCard`/`SelectTribute` both support cancel (`:198`, `:207`, and the UI wires it —
  `SelectCardPanel.tsx:149,185`, `SelectTributePanel.tsx:145,180`). A player who picks tributes and
  then wants out is trapped: the only exits are answer-or-time-out.
- The zone picker is a detached grid of text labels; it cannot be the board, because `ZoneCard`
  has no `sequence` and the array may be compacted (see `backend-delta.md` MH-1).
- The opponent is told nothing. `MSG_SUMMONING` (type **60**, capture `SUMMONING`) is silently
  dropped for **both** seats by the redaction table — `redactMessage.ts:41` declares
  `SHUFFLE_HAND: 60`, so a summon message is routed as a hand shuffle
  (`redactMessage.ts:106,142-149`) and, having no `player` field, fails `msg.player !== viewer`
  and returns `null` to everybody. See `backend-delta.md` MH-2.

---

## 2. "Chain Solemn Judgment to that" (responding to anything)

**Frequency: multiple times per game, every game. The interaction the format is built on.**

**Intent:** *"No — Solemn that."* The player is responding to a specific thing.

**Decision sequence:** opponent's action → engine emits `MSG_CHAINING` (type 70; carries `code`,
`description`, `chain_size`), `MSG_BECOME_TARGET` (83) → **you** get `ChainPrompt{forced, selects}`
→ your `{index}` → possibly `SelectCard` for your own target → opponent gets another
`ChainPrompt` → `CHAINED`(71) → `CHAIN_SOLVING`(72) → `CHAIN_SOLVED`(73) → `CHAIN_END`(74)
(all captured: `docs/reference/decision-capture-raw.json` keys `CHAINING`, `BECOME_TARGET`,
`CHAINED`, `CHAIN_SOLVING`, `CHAIN_SOLVED`, `CHAIN_END`).

**What the screen must do**

- R2.1 The prompt **must** name what is being responded to: the activating card, its controller,
  and the effect text. The `ChainPrompt` variant carries **only** `forced` and `selects`
  (`duelDecision.ts:166-171`); the adapter reads `forced` and `selects` and drops `spe_count`,
  `hint_timing` and `hint_timing_other` (`messageToDecision.ts:390-410` vs. the raw shape in the
  capture, which has all three). The identity of the card you are responding to is **not in the
  decision at all** — it is only in the `MSG_CHAINING` event.
- R2.2 The screen **must** show a chain stack (CL1 at the bottom) that survives across the
  multiple `ChainPrompt`s a single chain produces. `ChainPanel` was specified
  (`docs/specs/2026-07-16-mobile-duel-engineering-spec.md` §2.8) and **never built** — no such
  file exists under `packages/web/src`.
- R2.3 A `ChainPrompt` with `forced === true` and exactly one `select` is **not a question**. It
  **must** be auto-answered and narrated ("Treeborn Frog's mandatory trigger resolves"), not
  presented as a choice.
- R2.4 Passing **must** be one keystroke with no confirm, and the screen **should** support
  "no response this chain" so the player is not re-prompted at every link of a chain they have
  already declined. (Engine-side auto-pass already covers *empty* windows —
  `EdisonDuel.ts:222-235`, ADR rule "Empty optional chains".)

**What goes wrong today**

- The player is asked *"Respond?"* with no statement of what to. `ChainPromptPanel.tsx` renders
  `selects` and a Pass button; the trigger is nowhere on screen.
- The information exists and is thrown away twice over: `MSG_CHAINING` is generated by the
  engine, and (a) if it lands in the batch that ends in the `WAITING`, the server never forwards
  it — `duelSocket.ts:93-95`, "The `result.messages` loop is intentionally omitted"; (b) if it
  lands in an earlier `CONTINUE` batch it *is* forwarded as `MSG` and the client drops it
  (`DuelScreen.tsx:145-146`). **[INFERRED]** which of (a)/(b) applies to `MSG_CHAINING`
  specifically — determined by ocgcore's message-buffer flush granularity, which needs one live
  run to observe. Either way the player sees nothing.
- Auto-passing an empty chain window **destroys every other event message in the same batch**:
  `EdisonDuel.ts:233` does `messages.length = 0` before `continue`, and `messages` is the bucket
  that holds every message from that `duelProcess` call (`:184`, `:195-199`). The same happens for
  the RPS auto-resolve (`:218`). So the batch in which a chain window opened and auto-closed —
  exactly the batch that contains the destruction, the LP change or the send-to-graveyard that
  *created* that window — is discarded wholesale.

---

## 3. "Attack with everything"

**Frequency: every game, most turns from turn 2 onward.**

**Intent:** *"Swing with both monsters."*

**Decision sequence, per attack:** `BattleCommand{action:"attack", index}`
(`duelDecision.ts:155-162`) → `SelectCard` to pick the attack target
(`docs/reference/2026-07-16-ocgcore-decision-catalog.md:403-421`, captured and annotated
"SELECT_CARD for battle target"; also capture key `SELECT_CARD`, `player:1` selecting a p0 MZONE
card) → opponent `ChainPrompt` → `ATTACK`(110)/`DAMAGE_STEP_START`(113)/`BATTLE`(111)/
`DAMAGE`(91)/`DAMAGE_STEP_END`(114) events → **a fresh `BattleCommand`** whose `attacks[]` array
has been re-built and re-indexed.

**What the screen must do**

- R3.1 The screen **must** hold an attack queue: the player nominates attackers once, and the
  client drives one `BattleCommand` cycle per attacker, re-resolving each queued attacker against
  the **new** `attacks[]` indices after every cycle (indices are per-decision — ADR "Card
  selections: 0-based indices into the decision's `cards[]`/`selects[]`"). Any queue that caches
  an index across cycles is a mis-attack bug.
- R3.2 The screen **must** mark monsters that have already attacked this turn. Nothing on the
  wire says so: `AttackEntry` is `CardEntry + canDirectAttack` (`duelDecision.ts:108-111`), and a
  monster that has attacked simply stops appearing in `attacks[]` — which is *absence*, not a
  visible state, and the board has no link between an `attacks[]` entry and a rendered card
  (F3/MH-1).
- R3.3 The screen **must** show the outcome of each attack: attacker/defender ATK, who was
  destroyed, LP lost. `MSG_BATTLE` (111) already carries `card.attack`, `card.defense`,
  `card.destroyed`, and the same for `target` (capture key `BATTLE`) — this is precisely the
  "destroyed by battle" information, and it is on the wire today, unread.
- R3.4 A direct attack (`canDirectAttack === true`) **must not** ask the player to select a
  target; the screen answers the follow-up itself.

**What goes wrong today**

- You attack into card backs (F1). The defender's ATK/DEF are not on the board (F3).
- LP just changes on the next `STATE` snapshot, with no damage animation, no number, no
  attribution. LP is tracked server-side from `DAMAGE`/`RECOVER` (`EdisonDuel.ts:378-389`) and
  delivered only as a new `lp` tuple.
- The clock resets for the attacker at every step of the battle (R1.4 again).
- The E2E suite's own notes describe the resulting blindness: it asserts progress by "the
  empty-zone disappearing" and by "the attack button appearing", because nothing else is
  observable (`e2e/playwright/duel.spec.ts:23-35`). Two of the three limitations listed there are
  now stale (MZONE codes and phase tracking were fixed — `playabilityFixes.test.ts`), which is
  itself worth knowing: the engine has moved and the screen has not.

---

## 4. "Set a card and pass"

**Frequency: every turn.**

**Intent:** one gesture — drop a card into a back row slot and end the turn.

**Sequence:** `IdleCommand{action:"spellSet"|"monsterSet", index}` → `SelectZone` →
`IdleCommand{action:"toEP"}` → end-phase `ChainPrompt` windows for both seats → opponent's
`NEW_TURN`. Three decisions and two round trips for one gesture.

**What the screen must do**

- R4.1 Set **must** be a drag-to-zone (or click-card-then-click-zone) gesture that emits
  `spellSet` and answers the following `SelectZone` from the drop target, with no intermediate
  panel. This is impossible today for one reason only: the client cannot address a zone
  (`backend-delta.md` MH-1).
- R4.2 "End Turn" **must** be a persistent, always-visible control (a phase rail), not a button
  that exists only while an `IdleCommand` happens to be pending. Today the End Phase button lives
  inside the decision panel (`IdleCommandPanel.tsx:211-221`) and vanishes with it.
- R4.3 The screen **should** distinguish "set spell/trap" from "set monster" visually on the
  board. Both are `code:0` in the opponent's view and both render `🂠`; own set cards render as
  card backs too, because `DuelBoard` ignores `position` entirely.

---

## 5. "Synchro summon Brionac using Junk Synchron and Frog"

**Frequency: most games in Edison (Junk Frog, Blackwing, Quickdraw, Lightsworn variants).**

**Intent:** *"Synchro into Brionac with these two."*

**Sequence:** `IdleCommand{action:"specialSummon", index}` → `SelectUnselectCard` **once per
material**, iteratively, each with `min/max` around 1 (`duelDecision.ts:226-235`; catalog §2.11
"player selects/unselects cards one at a time"; the live test answers it one index per decision,
`liveDecision.test.ts:308-310, 556-558`) → `SelectPosition` (`liveDecision.test.ts:252-341`) →
sometimes `SelectZone` → then the Synchro's own triggers and the opponent's response window.
ADR note: Edison Synchro/ritual material selection uses type 26, **not** `SelectSum`
(`docs/adr/0001…:91`).

**What the screen must do**

- R5.1 The screen **must** present material selection as **one** multi-select with a running
  level total, and drive the iterative `SelectUnselectCard` protocol underneath it (send one
  index per decision, then finish/cancel via `index: null` when `canFinish`).
- R5.2 The screen **must** show each candidate's level and whether it is a Tuner — otherwise the
  player cannot verify the total they are being asked to assemble. `CardEntry` has no `level`,
  `atk`, `def` or type flags (`duelDecision.ts:92-99`). This one is cheap: the client can resolve
  all of it from `GET /api/cards?passcodes=…` (see `backend-delta.md` NH-1) — no contract change.
- R5.3 Ritual summons (Advanced Ritual Art, Black Illusion Ritual — Edison-legal, ADR:91) take
  the same path and **must** share the implementation.

---

## 6. "Flip my Ryko / flip summon" and other position play

**Frequency: common — Ryko, Snowman Eater, Spirit Reaper, Legendary Jujitsu Master.**

**Sequence:** `IdleCommand{action:"posChange", index}` → flip-summon resolves → the flip effect
fires as `SelectYesNo` and/or `SelectCard` → chain windows.

**What goes wrong today — the prompt has no text.**

- `SelectYesNo` renders `description || "Yes or No?"` (`SelectYesNoPanel.tsx:64`). A blank or
  unresolved description means the player is asked, literally, **"Yes or No?"** with no
  indication of what they are agreeing to.
- `SelectEffectYN` renders `description || "Activate effect of {name}?"`
  (`SelectEffectYNPanel.tsx:88-95`) — the fallback is at least card-named.
- Empty and raw-number descriptions are both real, from the captures and the resolver:
  - the live-captured Treeborn Frog `SELECT_EFFECTYN` has `description: "0n"`
    (`decision-capture-raw.json` → `SELECT_EFFECTYN`), and `resolveDescription(0n)` returns `""`
    (`packages/engine/src/decision/cardName.ts:48`);
  - any ocgcore **system** description (the generic "Destroy?"-class strings, which live in
    `strings.conf`, not in `cards.cdb`) decodes to `cardCode = 0`, `strIdx > 16`, and
    `resolveDescription` returns **`desc.toString()`** — i.e. the player is shown a raw integer
    like `1150` as the question (`cardName.ts:52-62`, fallbacks at `:55`, `:58`, `:62`).
    **[INFERRED]** that Edison scripts do produce system-string descriptions; verify by logging
    every `description` bigint over one live duel and checking how many fall back.
- R6.1 Every prompt **must** carry text a player can act on. Where the engine gives none, the
  screen **must** substitute the card name and the card's own effect text (resolvable client-side
  from `/api/cards`), never a bare "Yes or No?" and never a raw description ID.

---

## 7. Engine decisions with no natural player-facing meaning

These are protocol, not intent. Ranked by frequency.

| Decision | Why it is not a player question | What the screen should do |
|---|---|---|
| `SelectZone` on a routine summon/set | Master Duel never asks; the zone is usually irrelevant | Answer from a drop target or a stored preference (§9 OQ-1) |
| `SelectPosition` with `positions.length === 1` | one legal answer | Auto-answer, no prompt |
| `SelectUnselectCard`, per material | iteration mechanism, not a decision | Hide behind one multi-select (R5.1) |
| `ChainPrompt` with `forced=true` and one select | mandatory — no choice exists | Auto-answer + narrate (R2.3) |
| `SelectTribute` with `min === max === cards.length` | forced set | Auto-answer, but *show* what is being tributed |
| `SelectEffectYN` with empty description | question with no text | Substitute name + effect text (R6.1) |
| `IdleCommand{action:"shuffle"}` | the response enum accepts `"shuffle"` (`duelDecision.ts:344`) and the adapter maps it (`responseToOcgResponse.ts:101`) — but the **decision never advertises it**: the raw message has `shuffle: true` (capture `SELECT_IDLECMD`) and `messageToDecision.ts:275-352` does not read it, so `IdleCommandSchema` has no such field | Decide: either surface it (additive field) or drop the response value. Currently answerable-but-unadvertised |
| `AnnounceCard` | filter is hard-coded `{kind:"any"}` (`messageToDecision.ts:676-681`), so D.D. Designator offers a search over all ~3,681 Edison cards instead of the legal set. Engine re-validates and retries (ADR "Consequences") | Acceptable; `AnnounceCardPanel.tsx` already does a real name search via `/api/cards`. Low frequency |
| `SortChain`, `SortCard`, `SelectCounter`, `SelectSum`, `SelectDisfield` | **no Edison script triggers them** (ADR variant table, rows marked `✗ unverified-live`; catalog §3) | Leave on `GenericDecisionPanel`. **Do not design for these.** |

---

## 8. Cross-cutting requirement: the off-clock seat

The player who is *not* on the clock is the one the current screen serves worst, and they are
in that state for half the duel.

- R8.1 The off-clock screen **must** narrate what the opponent is doing, event by event. Today it
  receives `STATE` + `CLOCK` per opponent sub-decision (`duelSocket.ts:118-121`) and nothing else:
  the board mutates silently and the action panel reads *"Waiting for engine…"*
  (`ActionPanel.tsx:47-57`).
- R8.2 The off-clock screen **must** distinguish "the opponent is thinking" from "the engine is
  busy" from "my connection dropped". All three currently render the same string.
- R8.3 A duel log rail **must** exist. It was specified on 2026-07-16
  (`docs/specs/2026-07-16-mobile-duel-engineering-spec.md` §2.7 `DuelLogRail`, with the neutral
  event-language constraint from `docs/specs/2026-07-13-v1-ux-flows.md:79`) and never built.
  It is the single highest-leverage element for "I know what is happening", and it is blocked on
  the wire question in `backend-delta.md` §0 — **not** on the decision union.

---

## 9. Open questions — CEO's call, not mine

- **OQ-1 — May the client answer a decision the player never sees?** R1.2/R1.3/R2.3/§7 all
  propose auto-answering forced or single-option decisions. This is how Master Duel feels fast.
  It also means the client makes a legal game choice on the player's behalf, and for `SelectZone`
  that choice is occasionally strategic. Options: (a) never auto-answer; (b) auto-answer only
  where exactly one legal answer exists (safe, no strategy lost — this is my recommendation);
  (c) auto-answer with a stored preference including `SelectZone` and offer a modifier key to
  override.
- **OQ-2 — Is the per-move timer per *intent* or per *engine decision*?** (R1.4.) Per-intent is
  what a player expects and what the create-duel screen implies ("per move"); per-decision is
  what is implemented. Changing it changes the timeout contract and `duel_store` deadline
  semantics.
- **OQ-3 — Does "no teaching layer" forbid neutral event narration?** I have read the drop of the
  explanation layer as: no *why*, no legality coaching, no tutorials. A log that states
  "Bob activated Bottomless Trap Hole. Caius was destroyed." is *what happened*, not teaching,
  and matches the pre-existing neutral-language constraint in
  `docs/specs/2026-07-13-v1-ux-flows.md:79`. If the CEO reads the drop more broadly, R8.1/R8.3
  and most of `backend-delta.md` MH-2 fall away — so this needs an explicit answer before any
  design work starts.
- **OQ-4 — Cancel mid-intent.** Should the screen offer "back out of this summon" wherever the
  engine allows it (`cancelable`), knowing `SelectZone` is a hard commit point with no cancel in
  the protocol (§1)? A partial undo may be worse than none.

---

## Part 2 — Backend delta

# Backend delta — what the server must send that it does not send today (ZUH-79, Part 2)

**Constraint respected:** `docs/adr/0001-typed-duel-decision-protocol.md` is LOCKED. Nothing below
adds, removes, renames or re-shapes a `DuelDecision` variant or a `DuelDecisionResponse` variant.
Where enrichment of a decision would help, I propose it as a **sidecar frame** instead, so the
locked union is untouched. The two places where I do suggest an *additive optional field* on an
existing variant are called out explicitly and marked **needs CTO ruling against the ADR**.

**Sizing convention** (no schedules — scope only): *S* = one or two files, no other package
affected. *M* = one package plus its fixtures. *L* = `packages/contracts` + every consumer +
fixtures. Blast radius counted by grep, listed per item.

---

## §0 The question: can the client tell the player what just happened?

**No. Not today, and not by adding a listener — three separate cuts have to be repaired, and two
of them are server-side.**

The engine *generates* everything needed. Evidence: the empirical capture
`docs/reference/decision-capture-raw.json` contains, from real duel runs,
`SUMMONING`(60)/`SUMMONED`(61), `SPSUMMONING`(62)/`SPSUMMONED`(63),
`FLIPSUMMONING`(64)/`FLIPSUMMONED`(65), `CHAINING`(70)/`CHAINED`(71)/`CHAIN_SOLVING`(72)/
`CHAIN_SOLVED`(73)/`CHAIN_END`(74), `MOVE`(50), `SET`(54), `POS_CHANGE`(53), `ATTACK`(110),
`BATTLE`(111) — which carries `card.attack/defense/destroyed` **and** the same for `target`, i.e.
"destroyed by battle" — `DAMAGE`(91), `PAY_LPCOST`(100), `BECOME_TARGET`(83), `CARD_SELECTED`(80),
`CONFIRM_CARDS`(31), `DRAW`(90), `NEW_TURN`(40), `NEW_PHASE`(41), `HINT`(2).

Where each cut is:

**Cut 1 — the client throws the stream away.** `packages/web/src/screens/DuelScreen.tsx:145-146`
is `case "MSG": break;`. A repo-wide grep for `MSG` / `engineType` in `packages/web/src` returns
that one line. Web-only, size **S**.

**Cut 2 — the server forwards only half the stream.** `stepAndBroadcast` forwards
`result.events` (`packages/server/src/duel/duelSocket.ts:83-91`) and deliberately does not forward
`result.messages`: `duelSocket.ts:93-95`, *"The `result.messages` loop is intentionally omitted —
decisions no longer go via MSG."* But `messages` is not "the decisions" — it is **every message
from the `duelProcess` call that ended in `WAITING` or `END`**
(`packages/engine/src/EdisonDuel.ts:184`, `:195-199`). Any event generated in that final batch —
the summon that opened the response window, the destruction that preceded the trigger — is dropped
along with the decision. Server-local, size **S** (filter by type instead of dropping the bucket).

**Cut 3 — the engine destroys batches on its two auto-resolve paths.** On an auto-passed empty
chain window, `EdisonDuel.ts:233` runs `messages.length = 0` before `continue`; same for the RPS
auto-resolve at `:218`. That clears the whole accumulated batch, not just the decision message. So
the events that *caused* the chain window are destroyed inside the engine, before the server can
choose to forward them. Engine-local, size **S** (move the surviving events into `events` instead
of truncating).

**Cut 4 (the one that will surprise people) — the redaction table's message numbers are wrong,
and its tests encode the same wrong numbers.** `packages/engine/src/redactMessage.ts:26-62` inlines
a hand-written `MSG` map. Compared against the empirical capture (ground truth, real runs):

| Real message (capture) | Type | `redactMessage.ts` believes type is | Consequence |
|---|---|---|---|
| `SUMMONING` | 60 | `SHUFFLE_HAND` (`:41`) | Routed as hand-shuffle (`:106,142-149`); has no `player` field, so `msg.player !== viewer` → **`null` for both seats. "A monster was summoned" reaches nobody.** |
| `BECOME_TARGET` | 83 | `CONFIRM_CARDS` (`:54`) | In `REVEAL_TYPES`; no `player` field → **dropped for both seats.** "This card was targeted" reaches nobody. |
| `CARD_SELECTED` | 80 | `SHOW_HINT` (`:60`) | In `HINT_TYPES`; no `player` field → **dropped for both seats.** |
| `SHUFFLE_DECK` | 32 | `ANNOUNCE_ATTRIB` (`:51`) | Routed to `player` only; the opponent never learns a deck was shuffled. Cosmetic. |
| `SHUFFLE_HAND` | 33 | `ANNOUNCE_CARD` (`:52`) | Routed to `player` only — *correct behaviour, by accident.* |
| `CONFIRM_CARDS` | 31 | `ANNOUNCE_RACE` (`:50`) | Routed to `player` only — *correct behaviour, by accident.* |
| `PAY_LPCOST` | 100 | — (`EdisonDuel.ts:84` names 100 `"WIN"`) | Broadcast, but mislabelled in the envelope `name`. |

Three independent, mutually inconsistent tables exist in the repo for the same enum:
`redactMessage.ts:26-62`, `EdisonDuel.ts:49-91` (`MSG_NAMES`, self-described "best-effort"), and
the capture. `packages/engine/src/redactMessage.test.ts:22-29` declares
`MSG_CONFIRM_CARDS = 83`, `MSG_HINT = 1`, `MSG_FLIPSUMMONING = 43`, `MSG_SUMMONED = 40` — the
suite is green because it tests the same invented numbers the implementation uses. Meanwhile
`EdisonDuel.ts:379-405` reads phases and LP from the **real** `OcgMessageType` enum, so the correct
values are already importable in-package. Engine-local, size **S–M**, and it deletes a class of
silent hidden-information routing bugs rather than one symptom.

**Verdict for the CEO:** the information is on the wire in the sense that *the engine produces it*,
but it is **not deliverable to a client today**. The client half is trivial. The server/engine half
is three small, well-localised fixes (Cuts 2, 3, 4) plus one design decision (MH-2 below: raw
passthrough vs. typed events). **None of it requires touching the locked decision union, and none
of it requires a `packages/contracts` change if we accept the existing `MSG` passthrough frame.**

So: **this is a web-heavy rebuild with a small, contained backend slice — not a backend project.**
My estimate of the split, by scope of change: web ≈ 80%, engine+server ≈ 20%, contracts ≈ one
additive field group (MH-1) that is genuinely load-bearing and cannot be avoided.

---

## Must-have — the desktop screen is not buildable without these

### MH-1 · `ZoneCard` must be addressable and self-describing — **CONTRACTS-TOUCHING**

**What is missing.** `ZoneCardSchema` is `{code: number, position: number}` + `.passthrough()`
(`packages/contracts/src/duel.ts:67-73`). There is **no `sequence`**, so the client cannot map a
rendered card to a zone, and therefore cannot:

- click a monster on the board to attack with it (an `AttackEntry` carries
  `{controller, location, sequence}` — `duelDecision.ts:108-111` — and nothing on the board can be
  matched to it);
- drag a card into a zone to answer `SelectZone` (`ZoneEntry` is
  `{controller, location, sequence}` — `duelDecision.ts:114-119`);
- highlight the legal targets of a `SelectCard`/`SelectTribute` on the board rather than in a list.

Worse, whether the arrays are dense is **undefined and the repo disagrees with itself**:
`buildStateForSeat.ts:89-90` filters `c != null` (implying empty slots arrive as `null` and the
array is compacted, destroying index→sequence), while `playabilityFixes.test.ts:65-67` searches
`mzone.find(c => c.code !== 0)` (implying code-0 placeholders are present and the array is dense).
**[INFERRED / UNVERIFIED]** — resolving which needs one live `duelQueryLocation` run. The
requirement is the same either way: *make it explicit in the contract*.

**Also missing on the same object,** all of which the engine already queries and discards:
`buildStateForSeat.ts:27-32` requests `CODE | POSITION | IS_PUBLIC | ATTACK | DEFENSE | LEVEL`.
`attack`, `defense`, `level` and `isPublic` survive into the object only via the `...card` spread
(`:96-101`) and the `.passthrough()`, i.e. they are on the wire but **untyped** — the web cannot
read them without a cast, and nothing guarantees they stay.

**Requirements.**

- MH-1.1 `ZoneCard` **must** carry an explicit zone `sequence`.
- MH-1.2 `DuelZones` **must** define, in the schema, whether a zone array is dense (fixed length
  with explicit `null` for empty) or sparse; a board UI cannot be written against "undefined".
  Recommendation: fixed-length arrays with `null` holes for `mzone`/`szone`, lists for
  `hand`/`grave`/`removed`/`extra`.
- MH-1.3 `ZoneCard` **must** promote the already-queried `attack`, `defense`, `level`, `isPublic`
  to typed optional fields (present when the engine knows them, absent for hidden cards).
- MH-1.4 `DuelZones` **must** expose the field-spell zone. There is no `p0_fzone`/`p1_fzone`
  (`duel.ts:77-91`) and `ZoneEntry` already admits `"FZONE"` (`duelDecision.ts:116`), so the two
  contracts already disagree. Necrovalley/Gravekeeper's is a real Edison deck.
  **[INFERRED]** a field spell currently arrives inside `p0_szone` at ocgcore SZONE sequence 5,
  indistinguishable from a set trap — verify with one live query.
- MH-1.5 The snapshot **should** carry a turn number and an explicit named phase.
  `currentPhase: z.number()` (`duel.ts:99`) is a web-specific encoding invented in the engine
  (`EdisonDuel.ts:99-112` `mapOcgPhaseToWeb`) and re-decoded from a duplicated literal map in the
  web (`DuelBoard.tsx:21-32`) — two hardcoded tables, no shared type. There is no turn counter at
  all, so a log cannot be ordered or grouped by turn.

**Size: L — contracts + every consumer.** Blast radius (grep): `DuelStateSnapshot` appears in 12
files; `p0_mzone` fixtures in 6 (`fakeEdisonDuel.ts:36`, `DuelBoard.test.ts` ×5,
`mock/duelSession.ts:59,162`, `duelSocket.test.ts:95`, `contracts/duel.test.ts:138`).
Work: extend the schema (`contracts/src/duel.ts`), emit the new fields in
`engine/src/buildStateForSeat.ts` (the query already asks for them — mostly deleting the
information loss at `:89-102`), update the ~6 fixtures, then consume in the web. If the fields are
added as **optional**, no consumer breaks and the change can land ahead of the UI work.
This is the one expensive item, and it is unavoidable: *every* board-first interaction depends on
being able to name a zone.

### MH-2 · A duel event feed the client can actually consume — **SERVER-LOCAL (recommended shape)**

Everything in §0. Two ways to land it:

- **MH-2a (recommended, server-local, size S–M):** keep the existing `MSG` frame and
  `RedactedEngineMessage` passthrough (`duel.ts:56-63`) exactly as they are; fix Cuts 2, 3 and 4 so
  the frame is *complete and correctly routed*; and make the envelope's `name` authoritative by
  deriving it from the real `OcgMessageType` enum instead of the hand-written maps. The web then
  owns interpretation. **No contracts change.** Cost: the web must interpret raw ocgcore shapes,
  which is exactly the "mock-vs-reality mismatch" the ADR was written to prevent — mitigated by
  the fact that the shapes are now empirically captured
  (`docs/reference/decision-capture-raw.json`) rather than invented.
- **MH-2b (contracts-touching, size M–L):** add a *new* discriminated union
  `DuelEvent` (`Summoned`, `Chained`, `Destroyed`, `Damaged`, `Moved`, `PhaseChanged`, …) and a new
  `DuelServerMessage` variant `{type:"EVENT", event}`. `DuelServerMessage` has 9 consumers (grep),
  and adding a variant is additive, so nothing breaks. This keeps web free of ocgcore encodings
  and matches the ADR's philosophy without touching the decision union. Cost: a second translation
  layer in `packages/engine` alongside `messageToDecision.ts`, plus a per-event redaction review
  (the redaction currently lives on raw shapes).

**Recommendation:** MH-2a first — it makes the feed *correct*, which is prerequisite work for
either path, and it is the cheapest way to answer "what just happened". Promote to MH-2b only if
the web-side interpretation layer starts to sprawl. **CEO/CTO decision, not mine.**

Requirements either way:

- MH-2.1 The client **must** receive, for both seats, in order, with hidden information redacted:
  summon/special-summon/flip-summon, set, position change, activation and chain build-up
  (`CHAINING`/`CHAINED`/`CHAIN_SOLVING`/`CHAIN_SOLVED`/`CHAIN_END`), targeting, attack declaration,
  battle result including destruction, LP change with its cause, card movement between zones
  (with reason), draw, phase change, turn change.
- MH-2.2 Redaction **must** be re-derived from the real `OcgMessageType` enum (already available
  in-package — `EdisonDuel.ts:20,379-405`) and the tests **must** be rewritten against the
  empirical capture, not against hand-typed numbers.
- MH-2.3 No event may reveal information the seat is not entitled to. The existing three
  leak-points (`DRAW.drawn[].code`, `MOVE.card` to a hidden destination, `SET.code` —
  `redactMessage.ts:154-188`) are handled correctly *by number* today and must stay that way; the
  newly-delivered types (`SUMMONING`, `BECOME_TARGET`, `CARD_SELECTED`, `CONFIRM_CARDS`) need an
  explicit entitlement decision each.

### MH-3 · Decision context: what is this question about? — **SERVER-LOCAL if sidecar, CONTRACTS-TOUCHING if inline**

A `SelectCard` says "pick 1 of these 3" and never says *which effect is asking*
(`duelDecision.ts:192-199`). A `ChainPrompt` says "you may respond" and never says *to what*
(`:166-171` — the adapter drops `hint_timing`, `hint_timing_other` and `spe_count` that the raw
message carries; `messageToDecision.ts:390-410`). ocgcore's answer to this is `MSG_HINT`
(type **2**, capture key `HINT`, `hint_type` selector) — the `HINT_SELECTMSG` variety is precisely
"what this selection is for", and YGOPro-family clients use it to caption every selection prompt.

- MH-3.1 Every selection/prompt decision **must** be accompanied by the caption the engine
  produced for it, and by the identity of the effect that asked.
- MH-3.2 The current chain stack **must** be available whenever a `ChainPrompt` is pending (links
  in order, each with card identity, controller and effect text). `chain_size` is already on
  `CHAINING`/`CHAINED` (capture).

**Size: S–M, server-local, if delivered as a sidecar frame** — `HINT` and `CHAINING` are already in
the stream; MH-2 makes them deliverable, and the client correlates the most recent hint with the
pending decision. **Size M and contracts-touching** if instead we add optional context fields to
the affected `DuelDecision` variants — that is an additive change to the locked union and
**needs a CTO ruling against ADR-0001** before anyone designs on it. My recommendation is the
sidecar: it gets the same product outcome with the ADR untouched.

⚠ **[INFERRED]** — whether `HINT` reaches the client at all today depends on whether it lands in
the same `duelProcess` batch as the decision it captions (dropped, Cut 2) or an earlier one
(forwarded, then discarded by the client, Cut 1). Almost certainly the former, since a hint
immediately precedes its select. One live run settles it. It does not change the requirement.

### MH-4 · A `SelectZone` the player can escape — **CONTRACTS-TOUCHING (small) or a product ruling**

`SelectZone` has no `cancelable` (`duelDecision.ts:211-216`) and `RSelectZone.indices` is not
nullable (`:393-396`), while `SelectCard`/`SelectTribute` both support cancel and the UI wires it.
A player who commits to a summon and picks tributes cannot back out at the zone step — the only
exits are answer or time out (§1 of `intent-disagreements.md`).

Two honest options: (a) accept it and make the *commit point* explicit in the UI ("choosing a zone
completes the summon") — **web-only, size S**; (b) find out whether ocgcore's `SELECT_PLACE`
actually accepts a cancel in this build and, if so, add `cancelable` — **contracts-touching,
size M**, and an additive change to a locked variant, so again a CTO ruling.
**[UNVERIFIED]** — I could not determine from the code whether the underlying message supports
cancellation; `messageToDecision.ts:473-483` reads only `field_mask` and `count`.
Recommendation: (a) now, (b) only if players complain.

---

## Nice-to-have

### NH-1 · Card identity on the board — **NO BACKEND CHANGE AT ALL. Web-only, size S.**

Worth stating plainly because it looks like a backend gap and is not: `GET /api/cards?passcodes=a,b,c`
already exists and returns full `CardDTO`s — `name`, `frame`, `level`, `atk`, `def`, `attribute`,
`race`, `desc`, `imageId` (`packages/contracts/src/card.ts:42-56`, `passcodes` query param at
`:80-84`, server filter at `packages/server/src/routes/cards.ts:42-45`, `pageSize` max 120 at
`card.ts:78`), and the web client already calls it (`packages/web/src/api/cards.ts:6-15`;
`AnnounceCardPanel.tsx:13,152` uses it live). A duel-scoped code→`CardDTO` cache, filled lazily as
codes appear, gives the board and every panel names, ATK/DEF, levels, Tuner status and full card
text — including the `CardEntry`-has-no-stats problem in `SelectTribute`/`SelectUnselectCard`
(R5.2). **Do not add card data to the duel wire.**

### NH-2 · Duel-scoped event persistence — **SERVER-LOCAL, size M**

The response log is persisted (`duelStore.appendResponseLog`, replay via
`duelManager.getOrRehydrate` → `replayEdisonDuel`), but **events are not**. On reconnect the client
gets `SEAT_ASSIGNED` + `STATE` + `CLOCK` + the pending `DECISION`
(`duelSocket.ts:311-349`) and an **empty log** — the whole narrative of the duel so far is gone.
For a log rail that survives a refresh, either persist the redacted event feed per duel or
re-derive it by replaying the response log with event capture enabled. Purely server-side; no
contract change if MH-2a is chosen (the client replays `MSG` frames).

### NH-3 · Clock semantics per intent — **SERVER-LOCAL, size S**

`computeDeadline` is called on every engine decision (`duelSocket.ts:113`, `timer.ts:8`), so a
tribute summon grants 3–6 per-move allowances. If OQ-2 resolves to "per intent", the server needs a
notion of an intent boundary (cheapest available proxy: reset the deadline only when the on-clock
seat *changes*, and let the same seat's consecutive sub-decisions share one deadline). No contract
change; `CLOCK` already carries `{onClockSeat, deadlineAt}`.

### NH-4 · Named phase enum in contracts — **CONTRACTS-TOUCHING, size S**

Fold MH-1.5 in: replace the invented integer encoding with a shared enum so
`EdisonDuel.mapOcgPhaseToWeb` (`:99-112`) and `DuelBoard.PHASE_LABELS` (`:21-32`) stop being two
hand-maintained copies of the same table. Additive if the integer is kept alongside.

### NH-5 · Extra-deck visibility audit — **SERVER-LOCAL, size S. Possible hidden-info leak.**

`buildStateForSeat.ts:93-94` redacts an opponent's card only when the zone is HAND/DECK, the card
is face-down, or `isPublic === false`. `EXTRA` is none of HAND/DECK. If ocgcore reports extra-deck
cards with `position = 0` and `isPublic` unset, **the opponent's entire Extra Deck ships to the
client** — visible in devtools even though `DuelBoard` happens to render it as card backs (F1).
**[UNVERIFIED]** — needs one live query of `p1_extra` from seat 0. If it leaks, this is a
correctness bug, not a nice-to-have; I am ranking it here only because I could not confirm it.

---

## Deliberately NOT proposed

- Any change to the 19-variant `DuelDecision` union's shape, discriminant, response mapping, or
  variant list. ADR-0001 is an input.
- Typed events **and** typed decision context **and** a contracts-level card DTO on the duel wire
  all at once. MH-2a + NH-1 gets the product outcome with one contracts change (MH-1) instead of
  three.
- Anything for `SortChain`, `SortCard`, `SelectCounter`, `SelectSum`, `SelectDisfield`. No Edison
  script triggers them (ADR variant table; catalog §3). They have a generic panel; leave them.
- A teaching or explanation layer. Explicitly dropped by the CEO. Note the distinction raised in
  `intent-disagreements.md` OQ-3: a neutral event log states *what happened*; it does not explain
  *why* or coach legality. If the CEO reads the drop as covering narration too, MH-2 collapses to
  "fix the redaction bugs" and this becomes a web-only rebuild outright.

---

## Summary table

| # | Item | Contracts or server-local | Size |
|---|---|---|---|
| MH-1 | `ZoneCard`: `sequence`, dense/sparse defined, atk/def/level typed, field zone, turn number | **contracts** | **L** (12-file blast radius, ~6 fixtures) |
| MH-2 | Complete, correctly-routed event feed (Cuts 1–4) | server-local (MH-2a) / contracts (MH-2b) | S–M / M–L |
| MH-3 | Decision context: caption + activating effect + chain stack | server-local as sidecar; contracts if inline (**needs CTO ADR ruling**) | S–M / M |
| MH-4 | `SelectZone` escape, or an explicit commit point | web-only (a) / contracts (b, **CTO ruling**) | S / M |
| NH-1 | Card names, ATK/DEF, levels, text on board | **none — already served by `/api/cards?passcodes=`** | S (web) |
| NH-2 | Event persistence across reconnect | server-local | M |
| NH-3 | Per-intent clock | server-local | S |
| NH-4 | Named phase enum | contracts (additive) | S |
| NH-5 | Extra-deck visibility audit (**possible leak**) | server-local | S |
