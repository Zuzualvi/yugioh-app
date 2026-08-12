---
linear_project: Duel Experience Redo
---

# ZUH-118 — What breaks when you actually play the shipped duel screen

**Scope.** Play the duel screen on `master` (`f86683c`), as a real player, from duel start
to duel end, and enumerate every point where it breaks, misleads or dead-ends. Not a
single-fault report: the complete enumeration.

**How this was run.** Locally against `master` head — the same code that is in production —
using the repo's own same-origin E2E harness (`e2e/harness/server.ts`, real WASM ocgcore,
real `/api`, real duel WebSocket) on `http://localhost:8123`, driven by two independent
Chromium contexts (one per seat) through Playwright's Node API at **1440×900** (the design's
declared floor, G1). No WebSocket mocking of any kind; `page.routeWebSocket()` is inert in
this container and was not used. Every seat's console, page errors and **every WebSocket
frame in both directions** were captured.

Because the seeded E2E deck is 40 vanilla Normal monsters — no spells, no traps, no
effects — it cannot reach tribute summons, activations or chain windows at all. A
40-card Edison-legal deck (Monarchs, Bottomless Trap Hole, Dimensional Prison, Mirror
Force, Torrential Tribute, Solemn Judgment, Book of Moon, MST, Heavy Storm) was inserted
into the harness database for both users. **No repo source file was modified.** The
inserting script and every driver script are in `driver/` beside this report.

**Evidence layout.**

| Path | Contents |
| --- | --- |
| `evidence-118/logs/*.log` | Full per-scenario transcript: console, page errors, every WS frame, DOM probes |
| `evidence-118/shots/<scenario>/*.png` | Screenshots, numbered in the order they were taken |
| `evidence-118/driver/*.mjs` | The scripts that produced all of the above (re-runnable) |

**Environment caveats, stated up front so nothing below leans on them.** (a) Card art is
served from an external CDN through this container's TLS-intercepting proxy; some images
502/503 or fail cert validation. Blank card rectangles in screenshots taken in `s7` are
that, not a product fault. (b) `npm run build:web` with no `VITE_IMAGE_BASE_URL` emits
`src="undefined/<code>.jpg"` for every card — that is what the repo's own `test:e2e` script
builds, so the entire browser suite runs against a board with no card art; production sets
the variable on Vercel, so this is called out as a *harness* defect, not a production one
(finding 24). Screenshots for every other scenario were taken against a build with the
CDN base set, and art loads. (c) Chromium here has no emoji font; no finding rests on a
glyph.

---

## BLOCKS the game

### 1. Declaring an attack against a monster silently cancels itself — the duel becomes unwinnable

- **Trying to do:** attack the opponent's monster during my Battle Phase.
- **Interaction:** Battle Phase → click my monster → verb chip cluster shows
  `["Attack","Inspect"]` → click **Attack**.
- **What happened:** nothing. No `EVENTS` frame, no damage, no animation, no error. LP
  unchanged on both boards. The engine re-issues the *identical* `BattleCommand` and the
  same monster still offers **Attack**. Clicking it again does the same thing, forever.
  Driven twice in two separate duels: 8 consecutive declarations with one monster
  (`logs/s9-full-duel.log`, "ATTACK #1..#8"), then 4 more across two monsters with LP
  explicitly sampled before and after each
  (`logs/s11-full-duel-3.log`: `after attack: oppLp=Opponent LP: 8000 changed=false`).
- **The mechanism, from the wire.** `logs/s11-full-duel-3.log:319-327`:

  ```
  [seat0][ws→] {"type":"DECISION_RESPONSE","response":{"kind":"BattleCommand","action":"attack","index":0}}
  [seat0][ws←] {"type":"DECISION","decision":{"kind":"SelectCard","player":0,
                 "cards":[{"code":0,"name":"","controller":1,"location":"MZONE","sequence":0}],
                 "min":1,"max":1,"cancelable":true}}
  [seat0][ws→] {"type":"DECISION_RESPONSE","response":{"kind":"SelectCard","indices":null}}
  ```

  The engine asks the attacker to **choose the attack target**. The client answers
  `indices: null` — *cancel* — in the same tick, without ever rendering it (the three frames
  above are consecutive lines in the transcript, with no DOM change in between). Cancelling
  the target cancels the attack, so the engine returns to `BattleCommand`. The player sees
  an inert button.

  That `indices: null` is the prompt-level suppression path in
  `useDuelInteraction.ts:233-250`: `shouldOfferWindow()` returns false, so
  `getDeclineResponse()` is sent instead of asking. `responsePrompts.ts:86` decides
  "mandatory" as *"has no decline path"* — and an attack-target `SelectCard` arrives with
  `cancelable: true`, so it is classified as an optional response window and suppressed.
  At level **Standard**, the default, `lastTriggerEvent()` finds `BATTLE`/`PHASE` (both in
  `EVERY_WINDOW_ONLY_KINDS`) and suppresses (`responsePrompts.ts:48,95`).
- **Proof it is the prompt level and nothing else:** same flow, same decks, only change is
  setting **Response prompts → Every window** on the attacking seat before the attack
  (`driver/s15.mjs`, `logs/s15-attack-promptlevel.log`). The target question is now
  presented — `"Choose: 0 of 1 selected (need 1) / Overdrive [MZONE] / Cancel Esc / Select"`
  (`shots/s15-attack-promptlevel/02-attack-target-question.png`) — and the attack resolves:
  `oppLp Opponent LP: 8000 -> Opponent LP: 7700`.
- **Should have happened:** the attack-target selection is a mandatory step of an action
  the player just initiated; it must be presented at every prompt level.
- **Severity: BLOCKS.** Once both players hold the field, no damage can be dealt at the
  default setting. A duel cannot be won. Direct attacks (empty opposing field) are
  unaffected and do resolve — 8000 → 6100 in `logs/s14-direct-attack-2.log` — which is
  exactly the only attack path the repo's E2E suite exercises (`e2e/playwright/duel.spec.ts`
  test 4, "direct attack"), which is why a green pipeline never saw this.
- **Trace: PRODUCT DECISION, and it is one of the carried-forward ones.** The
  response-prompt levels with **Standard** as default. The implementation compounds it, but
  the decision creates a mechanism that can answer a question on the player's behalf using a
  rule ("has a decline path ⇒ optional") that does not survive contact with ocgcore. See
  **Escalation A**.

### 2. After you act, your own screen freezes on a question you already answered

- **Trying to do:** keep playing after a Normal Summon on turn 2 (one monster already on
  the field).
- **Interaction:** click hand card → **Normal Summon** → wait.
- **What happened:** the client auto-answered the `SelectZone` (`indices:[0]`, sent 5 ms
  after the summon — `logs/s8-attack-chain-both.log:177-178`), and then **rendered a
  QuestionBar for that already-answered decision and left it up**: `"Choose a zone: Player 0
  · MZONE 1 / MZONE 2 / MZONE 3 / MZONE 4 — Choose a zone — this cannot be undone"`, board
  dimmed (`dimScrim: true`), **End Turn disabled, every phase button disabled, zero legal
  phases**, own hand covered by the panel. The clock next to it reads
  `You 4:57 BANKED / Opponent 4:59 RUNNING` — the UI is simultaneously telling the player
  "answer this" and "it's not your turn". `SelectZone` has no decline, so `Esc` does
  nothing. The only exit is the opponent finishing their response, whereupon a new
  `DECISION` frame replaces the stale one.
  Evidence: `logs/s8-attack-chain-both.log` (`snap:seat0-t2-main`, `snap:seat0-bp`),
  `shots/s10-full-duel-2/01-5-seat1-stale-question.png`, and the pump loop in
  `driver/s10.mjs` which flags the condition explicitly:
  `STALE QUESTION while off clock: "Choose a zone:" dim=true endTurn=false phases=[]`.
- **Mechanism:** `DuelScreen.tsx:162` sets `pendingDecision` on `DECISION` and **nothing
  ever clears it**. The server sends no "your decision is gone" frame; when control moves to
  the other seat the next `DECISION` goes to *them*. The client therefore keeps the last
  decision object forever, `mode` stays `"answer"`, and once the 240 ms auto-answer receipt
  expires `DuelDock` falls through to `showQuestionBar` (`DuelDock.tsx:69-73`).
- **Should have happened:** answering a decision (auto or manual) clears it; the player
  returns to a live board or an explicit waiting state.
- **Severity: BLOCKS** while it lasts (no legal control on screen), **MISLEADS** throughout.
- **Trace: BUILD.** No PRD requirement asks for a decision to persist after it is answered;
  requirement B2 ("intent must survive a STATE frame") was implemented as "never clear the
  decision", which is a different thing.

### 3. The answer panel covers the whole hand — every hand card becomes unclickable

- **Trying to do:** set a trap after summoning, while a chain window was on screen.
- **Interaction:** Normal Summon → a "Chain a card or effect?" window appears → click any
  card in my own hand.
- **What happened:** the click never lands. Measured with `document.elementFromPoint` at the
  centre of every hand card: all five return `DIV[action-panel]`, `hittable: false`
  (`logs/s6-selfchain-block.log`, `probe:after-own-summon`). Playwright's own click retried
  for 30 s and failed with `<div data-testid="action-panel"> intercepts pointer events`
  (`logs/s4-attack-and-chain.log`, end of file). Geometry: panel `x 502→938, y 604→900`;
  hand row `x 12→1428, y 568→642`. The panel is `position: fixed; bottom: 0; maxHeight: 40vh`
  (`DuelStage.tsx:358-374`) and grows upward over the hand as soon as it has content.
- **Should have happened:** requirement **F12** — every visible interactive control receives
  its own pointer clicks. The E2E helper `assertF12` exists precisely for this and is only
  ever run on a board with an *empty* action panel.
- **Severity: BLOCKS** (compounds 2: while the panel is up, End Turn and all phase buttons
  are disabled too, so the covered hand is the whole remaining surface).
- **Trace: BUILD.** A5/Law 2 put one docked bar bottom-centre; nothing reserved space for it.

### 4. Off the clock, the board still offers you moves, and taking one produces `not your turn`

- **Trying to do:** after ending my turn, look at my hand.
- **Interaction:** End Turn → click a hand card → click the **Set** chip that appears.
- **What happened:** the verb cluster opened normally (`["Set","Inspect"]`) and the click
  produced an amber alert reading the raw server string **`⚠ not your turn`**
  (`logs/s2-turn1-handover.log`, `snap:offclock-after-verb-click`;
  `shots/s2-turn1-handover/07-offclock-after-verb-click.png`). Nothing else changed.
- **Should have happened:** while the opponent is on the clock, own cards afford nothing —
  or at minimum the refusal is stated in the same voice as the rest of the UI.
- **Severity: MISLEADS**, borderline BLOCKS (a player reasonably concludes the app is
  broken). Same root cause as 2: the stale `IdleCommand` keeps `mode === "act"`.
- **Trace: BUILD.**

### 5. Your response windows are answered for you, invisibly, at the default setting

- **Trying to do:** activate a set trap / quick-play during the opponent's End Phase.
- **Interaction:** opponent clicks End Turn; I watch my screen.
- **What happened:** three `ChainPrompt` windows arrived and were auto-declined
  (`{"kind":"ChainPrompt","index":null}`) in 25 ms
  (`logs/s3-turn1-real.log:128-155`). The only trace is a receipt reading
  **"Window suppressed — response prompt level: Standard"**, which a `MutationObserver`
  timed as present in the DOM from **t=38 ms to t=63 ms** (`recorder:seat1-gets-control` in
  the same log). No human sees that.
- **Mechanism:** `responsePrompts.ts:95` — at Standard, if the most recent classifiable
  event is `PHASE` / `CHAIN_SOLVING` / `CHAIN_SOLVED` / `BATTLE`, the window is suppressed.
  Every phase boundary is a `PHASE` event, so every phase-boundary window (End Phase,
  Standby, entering Battle Phase) is declined for you.
- **Should have happened:** at minimum the receipt persists long enough to read and offers
  the documented "ask me next time" affordance (`DuelDock` accepts `onAskNextTime` and
  `DuelStage` never passes it — `DuelStage.tsx:386-399`).
- **Severity: BLOCKS** (a class of legal plays is unreachable), **MISLEADS** (the player is
  never told).
- **Trace: PRODUCT DECISION** — response-prompt levels, Standard default. See
  **Escalation A**.

---

## MISLEADS the player

### 6. Every card you are asked about in your own hand or your own set zone is anonymous

- **Trying to do:** chain my own set trap in response to the opponent's summon.
- **Interaction:** opponent Normal Summons → my chain window appears → read it.
- **What happened:** the candidate button reads **`card in SZONE 0 [SZONE]`** and, after
  selecting it, the confirm button reads **`Activate "card"`**
  (`logs/s10-full-duel-2.log`, `shots/s10-full-duel-2/02-5-seat0-question.png` and
  `03-5-seat0-chain-selected.png`). From my own hand it reads `card in HAND 3`,
  `card in HAND 4` (`logs/s6-selfchain-block.log`;
  `shots/s6-selfchain-block/01-after-own-summon.png`). The wire frame confirms the payload
  is empty, not the renderer: `"selects":[{"code":0,"name":"","controller":1,
  "location":"HAND","sequence":3}]`.
- **Mechanism:** `packages/engine/src/decision/messageToDecision.ts:78-84` — `isHidden()`
  hides any card whose position bit is face-down **regardless of controller**, and ocgcore
  reports hand cards with `position: 10` (`FACEDOWN_ATTACK|FACEDOWN_DEFENSE`). So a
  player's own hand and own set cards are redacted from that same player's decisions. The
  `IdleCommand` path is unaffected (it carries real names) — which is why the verb chips
  look fine and only the answer surface is blind.
- **Should have happened:** you can always read your own cards. This is the difference
  between choosing Mirror Force and choosing Solemn Judgment.
- **Severity: MISLEADS**, arguably BLOCKS informed play.
- **Trace: BUILD.**

### 7. "Inspect" always shows "Face-down card" — for every card, including your own hand

- **Interaction:** click a card in my own hand → **Inspect** chip.
- **What happened:** a left-hand panel opens showing a card-back glyph and the words
  **"Face-down card"** (`shots/s12-log-settings/04-card-inspector.png`,
  `logs/s12-log-settings.log`).
- **Mechanism:** `DuelStage.tsx:194` — `inspectorControl.inspectCard(clickedRef, 0)`. The
  code is hard-coded to `0`, and `0` means "you are not entitled to this identity"
  (`cardCache.ts:64`). Same literal at `DuelStage.tsx:169` for the answer-mode click path.
- **Should have happened:** Inspect shows the card. This is the only affordance that would
  let a player recover from findings 6 and 21.
- **Severity: MISLEADS.** **Trace: BUILD.**

### 8. Questions never say what they are for

- **What happened:** the attack-target selection reads `"Choose:"`. The trigger-effect
  target reads `"Choose:"`. Both with a bare candidate list
  (`logs/s15-attack-promptlevel.log`, `logs/s11-full-duel-3.log`).
- **Mechanism:** the server *does* send the caption — `duelSocket.ts:639-649` emits a
  `DECISION_CONTEXT` frame (caption from ocgcore `HINT`/`SELECTMSG`, plus the chain stack)
  immediately before every `DECISION`. `DuelScreen.tsx:150-184` has no `case
  "DECISION_CONTEXT"` — the frame is dropped. `DuelStage.tsx:385-399` never passes
  `caption` to `DuelDock`, whose `caption` prop is the one thing `questionSentence()` would
  use (`DecisionRenderer.tsx:212-213`). The whole C7/MH-3 sidecar is built, transmitted, and
  discarded.
- **Severity: MISLEADS.** **Trace: BUILD** (requirement C7 / MH-3 built server-side, never
  wired client-side).

### 9. The player in seat 1 is called "Opponent", and their opponent is called "You"

- **Interaction:** lose on time as seat 0; read the winner's screen (seat 1).
- **What happened** (`logs/s7-timeout-forfeit.log`, `summary.json`,
  `shots/s7-timeout-forfeit/08-offclock-end.png`):

  ```
  winner (seat 1):  🏆 You win   "You's move timer ran out."   Opponent 8,000 LP   You 8,000 LP
  loser  (seat 0):  💀 You lose  "Your move timer ran out — the duel is forfeit."
  ```

  The winner is told *they* timed out, in broken English, and the LP rows label their own
  life points "Opponent".
- **Mechanism:** `DuelScreen.tsx:387,413` passes a fixed `["You","Opponent"]` array to
  `DuelEndOverlay` and `EventLogRail`, which index it **by absolute seat**
  (`DuelEndOverlay.tsx:66,180-186`; `EventLogRail.tsx:139,382`). Correct for seat 0 only.
- **Should have happened:** D5/D6 — the end card names the cause. It names the wrong person.
  The repo's E2E asserts only `/resign/i`, which passes on both seats.
- **Severity: MISLEADS.** **Trace: BUILD** (violates the ownership colour/naming law).

### 10. The event log calls your own turn the opponent's turn

- **Interaction:** summon a monster, open the log (`☰ Log`).
- **What happened:** on the *acting* player's own screen the log header reads
  **`TURN 0 — Opponent`**, followed by **`PHASE 0`**, a bare `Hint` row, and
  `Move 🖐 → ⬛` / `Overdrive Summon`
  (`logs/s12-log-settings.log`, `shots/s12-log-settings/04-card-inspector.png` shows the
  rail). Both seats see the identical header, so at least one of them is always wrong.
- **Mechanism:** the same `playerNames` indexing as 9, plus a fallback
  (`EventLogRail.tsx:382-383`) used because the client joins after ocgcore's `NEW_TURN`, so
  `turnNumber` is 0 and `turnPlayer` is null.
- **Severity: MISLEADS.** **Trace: BUILD** — this is the "neutral event log" decision
  implemented with a seat-blind name array.

### 11. Opening the log hides both clocks and the End Turn button

- **Interaction:** click `☰ Log` during your turn.
- **What happened:** the rail overlays the right ~320 px of the board rather than making
  room; the ClockPanel (left of the phase rail) and the End Turn button are both covered,
  and the phase rail reads only `SP M1 BP M2 EP` (`shots/s12-log-settings/04-*.png`; the
  card inspector similarly overlays the opponent's field on the left).
- **Should have happened:** §7 — "End Turn is reachable at all times during my turn."
- **Severity: MISLEADS** (the player must close the log to end their turn, with no hint
  that is why). **Trace: BUILD.**

### 12. The refusal chip states, falsely, that a monster has already attacked

- **Interaction:** enter Battle Phase, click a monster that is not in `attacks[]`.
- **What happened:** **"This monster has already attacked."** for a monster that had never
  declared an attack that turn (`logs/s11-full-duel-3.log`, step 8/9 — seat 1 summoned that
  turn, entered BP, and got the message on its first click).
- **Mechanism:** `VerbChipCluster.tsx:251-262` infers the reason purely from absence in
  `attacks[]`.
- **Should have happened:** requirement **H** forbids fabricated reasons; the one carve-out
  claims this string is "state we hold, not inference". It is inference, and it produces
  false statements.
- **Severity: MISLEADS.** **Trace: PRODUCT DECISION (requirement H carve-out) — see
  Escalation C.**

### 13. Both clocks are wrong, in two different ways

- **What happened:**
  - *Every duel, first two handovers:* both clock rows show the same number, one labelled
    RUNNING and one BANKED — `You 5:00 BANKED / Opponent 5:00 RUNNING` at the instant of
    handover (`logs/s3-turn1-real.log`, `snap:seat0-after-handover`). The server only emits
    the `deadlines` tuple once *both* seats have a recorded deadline
    (`duelSocket.ts:625-628`), and until then `DuelScreen.tsx:293` falls back to
    `[deadlineAt, deadlineAt]` — i.e. it renders the opponent's clock as yours.
  - *Always:* "BANKED" is not banked. The off-clock row freezes at its last value
    (`ClockPanel.tsx:56-62` starts no interval when not running) while the underlying rule is
    a **fresh full allowance every handover** (`duelSocket.ts:608-617`: on handover,
    `computeDeadline(timer_per_move_seconds)` = now + the full allowance). Confirmed on the
    wire: successive `CLOCK` frames give the same seat a strictly later absolute deadline
    each time it comes back on clock (`logs/s8-attack-chain-both.log`, `deadlineAt`
    `…943569` → `deadlines:[…965598, …955228]`). Nothing is carried, so a row reading
    `You 5:00 BANKED` while you are off the clock (`logs/s3-turn1-real.log`,
    `snap:seat0-after-handover`) describes a quantity that does not exist.
- **Should have happened:** D2/D3 — both clocks always on screen, correctly labelled.
- **Severity: MISLEADS.** **Trace: PRODUCT DECISION (per-handover clock) implemented with
  a "banked" vocabulary that contradicts it — see Escalation B.**

### 14. After the duel ends the clock keeps running, into negative numbers

- **What happened:** post-`DUEL_END`, the loser's board shows `You 0:00 RUNNING` with a
  `role="alert"` reading **`-1s — TIMEOUT FORFEITS THE DUEL`**, then `-21s`
  (`logs/s7-timeout-forfeit.log`, `snap:onclock-final`).
- **Severity: MISLEADS.** **Trace: BUILD.**

### 15. The action panel says "Waiting for engine…" after the duel is over

- **What happened:** `mode === "ended"` renders the same `no-decision` placeholder as
  "waiting" (`DuelStage.tsx:292,376-383`) — text: "Waiting for engine…". Observed on both
  seats after the timeout end (`logs/s7-timeout-forfeit.log`, both final snapshots).
- **Severity: MISLEADS.** **Trace: BUILD.**

### 16. Three of the four duel settings do nothing

- **What happened:** the settings popover offers **Choose zones · Self chain · Activation
  order · Reduce motion** (`logs/s12-log-settings.log`,
  `shots/s12-log-settings/01-settings-popover.png`). Only `chooseZones` is read anywhere;
  `selfChain`, `activationOrder` and `reduceMotion` appear in `SettingsPopover.tsx:86-88`
  and `DuelScreen.tsx:62-64` and in **no other file**.
- **Why it bites:** "Self chain" is exactly the switch a player reaches for after finding 17
  — being asked to chain their own card after their own summon — and it does nothing.
- **Severity: MISLEADS.** **Trace: BUILD.**

### 17. Your own Normal Summon interrupts you with a chain window about your own hand

- **Interaction:** Normal Summon a monster while holding a quick-play spell.
- **What happened:** immediately after the summon, a full answer-mode question appears —
  `"Chain a card or effect?"`, candidates `card in HAND 3` / `card in HAND 4`, board dimmed,
  End Turn and all phases disabled, hand covered (this is the state measured in finding 3).
  `Esc` dismisses it (declines); nothing on screen says so except a small `Esc` chip inside
  the No-response button. Evidence: `logs/s6-selfchain-block.log`,
  `shots/s6-selfchain-block/01-after-own-summon.png`.
- **Severity: MISLEADS** (and it is the mechanism that triggers 3).
- **Trace:** the engine legitimately offers this window; the product decision that should
  govern it — the "Self chain" setting — is not wired (16).

### 18. Zone options are engine jargon

- **What happened:** with zone choice presented, the buttons read
  **`Player 0 · MZONE 1`**, `Player 0 · MZONE 2`… (`DecisionRenderer.tsx:596`;
  `logs/s8-attack-chain-both.log`, `snap:seat0-t2-main`). Nothing maps those to the slots
  on the board, and the board itself offers no zone targets.
- **Severity: MISLEADS.** **Trace: BUILD** (the "zone placement auto by default" decision
  left the presented path unfinished).

### 19. The auto-resolve receipt is unobservable

- **What happened:** a `MutationObserver` recorded the receipt `AUTO Zone — placed
  automatically` entering the DOM at **t=599 ms** and leaving at **t=609 ms** — **10 ms**
  (`logs/s3-turn1-real.log`, `recorder:normal-summon`). It is not the 240 ms timer
  (`useDuelInteraction.ts:227`) that removes it: the next `IdleCommand` clears `receipts`
  and tears the whole dock down (`useDuelInteraction.ts:199-206`, `DuelStage.tsx:385`).
- **Should have happened:** requirement C9 — auto-answers leave a receipt the player can
  read and reverse ("ask next time").
- **Severity: MISLEADS** (the game silently made a choice for you). **Trace: BUILD.**

### 20. The opponent has no name anywhere in the duel

- **What happened:** the top bar reads `● Opponent`, the wait banner reads
  `Opponent is deciding…`, the LP plate reads `OPPONENT 8000`, the end card says
  `Opponent resigned.` — in a duel between `e2e_alice` and `e2e_bob`, whose real names the
  room screen displayed thirty seconds earlier (`ROOM_STATE` frames carry
  `displayName`). Hard-coded at `DuelScreen.tsx:347` and `DuelStage.tsx:259`.
- **Severity: DEGRADES/MISLEADS.** **Trace: BUILD.**

### 21. Nothing on the board is named, and nothing shows what you can act on

- **What happened:** a hand card's entire accessible identity is `aria-label="Hand card 1"`
  (`logs/s3-turn1-real.log`, "hand as the player sees it" — all six cards, no `title`, no
  text). Identity is carried **only** by the artwork image; `HandRow.tsx:168-170` hides the
  `<img>` on error, leaving a blank rectangle with no fallback text. Separately,
  `DuelBoard.tsx:99` declares `actionableCards: CardRef[] = []` and never fills it, so the
  select-then-verb grammar gives the player no indication of which cards afford anything —
  the only way to find out is to click each one. Driven: clicking all six hand cards in turn
  produced `["Set","Inspect"]`, `["Normal Summon","Set","Inspect"]`, …, `[]` + refusal chip
  (`logs/s3-turn1-real.log`).
- **Severity: DEGRADES**, promoted to MISLEADS in combination with 6 and 7 (there is then
  no surface anywhere that will tell you what a card is).
- **Trace: BUILD.**

---

## DEGRADES

### 22. The first seconds of a duel are a blank screen with no explanation

Between the room handoff and the first `STATE` frame the screen is a centred sentence —
`Waiting for duel to start…` / `Connecting…` (`DuelScreen.tsx:391-404`) — with no board,
no opponent, no clock. In `driver/s2.mjs` the very first probe after `waitForURL` found no
`duel-board`, no `phase-ribbon`, no hand (`snap:t1-start`, all null), which is why that
script's first two sections silently did nothing. Duration is real but was not measured;
**observed, not measured**.

### 23. The opponent's hidden hand is on the wire with full statistics

Every `STATE` frame sends the opponent's hand as `code: 0` (correct) but keeps
`level`, `attack`, `defense` per card:
`{"code":0,"position":10,"level":6,"attack":2400,"defense":1000,...}`
(`logs/s1-first-ten-seconds.log`, first `STATE` to seat 1). The UI does not render it, so
this is not a visible break — it is an integrity one: anyone with the network tab can read
the shape of the opponent's hand. **Severity: DEGRADES** (cheat vector).
**Trace: BUILD.**

### 24. The repo's own browser suite runs against a board with no card art

`npm run test:e2e` runs `npm run build:web` with no `VITE_IMAGE_BASE_URL`, and
`cardImageUrl.ts:15-17` takes the `import.meta.env.PROD` branch, producing
`src="undefined/1784619.jpg"` for every card — captured in
`logs/s1-first-ten-seconds.log` ("hand:" line, `imgShown: "none"` on all six). Every
Playwright screenshot and every visual judgement made from that suite has been of a board
with no cards on it. Fix lands in the repo (harness/build), not in production.
**Severity: DEGRADES.** **Trace: BUILD.**

### 25. Candidate ownership colour is hard-coded to seat 0

`DecisionRenderer.tsx:489,521` pass `mySeat={0}` literally to `CandidateThumb`, so the
own/opponent colour of a candidate's location badge is computed against seat 0 for both
players — inverted for whoever is in seat 1. The badge itself is rendered and visible
(`shots/s10-full-duel-2/02-5-seat0-question.png`, the blue `SZONE` chip on the candidate).
I did not capture a seat-1 candidate badge to photograph the inversion, so the inversion
itself is **code-path, not observed**; the hard-coded literal is the evidence.
**Severity: DEGRADES.** **Trace: BUILD** (ownership colour law).

### 26. The "engine is resolving" state never renders

`PhaseRail` accepts `engineBusy` and draws the §12/F8 hairline for it
(`PhaseRail.tsx:60,100-114`); `DuelBoard.tsx:147-159` never passes the prop, so it is
permanently `false`. Combined with 2 (the client never enters `mode === "waiting"` after
the first decision), **none of the three documented waiting states — opponent-thinking,
engine-busy, reconnecting — appears after turn 1**. `WaitBanner` was observed exactly once
per duel, on the very first decision, and never again
(`logs/s1-first-ten-seconds.log` has it; every later snapshot has `waitBanner: []` —
`logs/s3-turn1-real.log`, `snap:seat0-after-handover`). The dead time while the opponent
thinks is therefore completely unmarked. **Severity: DEGRADES.** **Trace: BUILD.**

---

## Found in the running render path, but not triggered in play

These are reachable code paths in the mounted `DecisionRenderer`, not source-scan hits. I
could not make ocgcore emit them with an Edison deck in the time available, so they are
listed separately and are **not** claimed as observed.

### 27. Five decision variants render with no way to answer them

`SortCard`, `SortChain`, `SelectCounter`, `SelectSum` and `AnnounceCard` render a read-only
list (`DecisionRenderer.tsx:687-772`; `SortChain`/`SortCard` literally print "Drag to
reorder (or confirm default order)" with no drag handler). `canConfirm()` has no case for
any of them and falls to `default: return false` (`:206`), so the confirm button is
permanently disabled; `hasLegalDecline()` also falls to `default: return false` (`:127`),
so there is no decline and `Esc` is a no-op. A player who reaches one of these is locked
until the clock forfeits the duel. `useDuelInteraction.confirm()` likewise has no case for
them (`:440`). Severity if reached: **BLOCKS**.

### 28. `SelectUnselectCard` sends the same index either way

`DecisionRenderer.tsx:636` — `onDirectRespond({kind:"SelectUnselectCard", index: canSelect ? idx : idx})`.
Both branches of the conditional are identical, so unselecting sends a select index.
Severity if reached: **BLOCKS/MISLEADS**.

### 29. An auto-answered cancelable step has no cancel

`autoResolve.ts:76-80` auto-answers `SelectTribute` when `min === max === cards.length`
"even when cancelable, [because] cancel stays reachable via the intent ribbon (§16.A)".
It is not: the auto-answer branch in `useDuelInteraction.ts:209-229` `return`s **before**
the intent is created (`:259-300`), so no ribbon and no cancel exists. The same holds for
the prompt-level decline path. Severity if reached: **MISLEADS** (an uncancellable commit
the spec promises is cancellable).

---

## Escalations — carried-forward product decisions that are part of why this shipped badly

The CEO's standing condition was to bring these back rather than quietly keep them. Named
with evidence, not resolved.

**A. The response-prompt levels, with "Standard" as the default, are load-bearing on a
rule that does not hold.** The mechanism answers engine questions on the player's behalf
whenever it classifies them as "optional", and it classifies by *"does this decision have a
decline path"*. ocgcore marks the **attack-target selection** `cancelable: true`, so the
mechanism cancels attacks — finding 1, proven by flipping the level to "Every window" and
watching the identical attack resolve. It also silently discards every phase-boundary
response window — finding 5. Two of the three levels are therefore not preference settings,
they are difficulty modifiers on whether the game works. The decision that "auto-resolve
happens only where exactly one legal answer exists" is *separately* stated in the same
decision log and is not what this mechanism does.

**B. The per-handover clock is presented in banked-clock vocabulary.** The rule is a fresh
full allowance each handover; the UI says "BANKED m:ss" next to a frozen number, and for
the first handovers it shows the opponent's deadline as yours (finding 13). Either the
clock model or its vocabulary has to give; that is a product call.

**C. Requirement H's single carve-out ("This monster has already attacked") is inference
dressed as fact** and it is emitted whenever a monster is absent from `attacks[]`, for any
reason. It produced a false statement in normal play (finding 12). The carve-out was
justified as "state we hold, not inference"; the build does not hold that state.

**D. `IdleCommand`/`BattleCommand` are never a question panel — kept, and it is not the
problem.** Stated because it is the decision most likely to be blamed: the ACT-mode verb
chip grammar worked in every scenario driven here. Cards opened clusters, verbs matched the
engine's legal moves, chips were hittable. What fails around it is everything that happens
*after* a verb is picked. No change requested.

---

## COVERAGE

**Driven to completion (evidence in `logs/` and `shots/`):**

| Flow | Result |
| --- | --- |
| First ten seconds / pre-board | ✅ `s1`, `s2` — findings 22, 13 |
| Normal summon (verb chip → auto zone) | ✅ `s3`, `s5`, `s6` — findings 2, 3, 17, 19 |
| Set (spell/trap from hand) | ✅ `s3`, `s8`, `s10` |
| Activate from hand | ⚠️ **partial** — activation *via the chain window* was driven both ways (`s10`, `s11`: candidate selected, `Activate "card"` confirmed, chain link appeared). The ACT-mode `Activate` verb chip was **offered** from the hand (`logs/s10-full-duel-2.log`: `hand[3] chips=["Set","Activate","Inspect"]`) but I never clicked it, so the Main-Phase activate-from-hand path is **not** verified end to end |
| Attack declaration | ✅ both branches: **direct attack resolves** (`s14`, 8000→6100); **attack into a monster is a no-op** (`s9`, `s11`) and resolves only at "Every window" (`s15`, 8000→7700) |
| Responding to a chain — decline | ✅ `s6`, `s8`, `s10`, `s11` |
| Responding to a chain — respond | ✅ `s10`, `s11` — trap chained, chain strip `⛓1`, target `Choose:` step reached and confirmed |
| End phase / pass turn | ✅ every scenario |
| Waiting on the opponent | ✅ `s1`–`s3` — finding 26 |
| Control returning to you | ✅ `s3`, `s14` |
| Duel end | ✅ **timeout forfeit**, both seats, real 3-minute clock (`s7`) — findings 9, 14, 15 |
| Both seats driven | ✅ every scenario ran two independent browser contexts |

**Reached but not completed, and why:**

- **A second attack in the same turn.** Attempted in `s4`, `s8`, `s9`, `s11`. Unreachable at
  the default prompt level because the *first* attack into a monster never resolves
  (finding 1); the pump loop instead recorded 8 no-op declarations. In `s15` (Every window)
  the first attack resolved, but the run stopped at the LP assertion. **Gap: the second
  attack in one turn was never driven end to end.**
- **Tribute summon and the trigger effect that follows.** The `Normal Summon — tribute`
  chip never appeared in ~10 duels: the engine offers a tribute summon only when a suitable
  monster survives to the next Main Phase, and the attack blocker (1) plus the stale-panel
  blocker (2) ended every board state before that. What *was* driven is the closest
  equivalent — a trigger-effect chain with its target step: `s11` shows
  `ChainPrompt → "Choose:" → candidates Kojikocy / Thunder King → confirm "Select Kojikocy"`
  with the chain strip live. **Gap: the tribute path itself (`SelectTribute` auto-answer,
  the tribute intent ribbon, the trigger that follows a Monarch summon) is untested here.**
  Finding 29 about the missing cancel on an auto-answered tribute is therefore code-path
  only.
- **Duel end by LP reaching zero.** Not reached, for the same reason. Duel end was covered
  via the timeout path instead; resign was not re-driven because the repo's E2E already
  covers the round trip and finding 9 (the naming defect it hides) is proven by the timeout
  overlay on both seats.

**Not attempted:**

- Reconnection / refresh mid-duel, and the `reconnecting` wait state.
- Anything below 1440×900 (out of scope per G1).
- Timing, motion and animation quality — not verifiable from screenshots. Where a finding
  touches duration it is labelled **observed, not measured**, except the two cases measured
  with a `MutationObserver` (findings 5 and 19), which are real numbers.
- Audio.
- The deployed backend. Everything above reproduces locally against `master` head; nothing
  here is claimed to be production-only, and nothing here is claimed to be local-only except
  finding 24, which is explicitly about the local build.
- Visual fidelity against `proto/duel-ui` — deliberately not re-derived; it is owned
  elsewhere. Layout is mentioned only where it changed what a player could do
  (findings 3 and 11).
