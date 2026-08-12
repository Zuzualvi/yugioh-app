---
linear_project: Duel Experience Redo
---

# Player needs model — the Edison duel screen, moment by moment

**Issue:** ZUH-119 · **Project:** Duel Experience Redo
**Author:** UX/UI specialist · **Date:** 2026-08-12
**Status of this document:** an **input** to the redesign. It contains no layouts, no screens, no
component names, no proposals. It says what a player needs at each moment of a real Edison turn,
and where the two things we have — the screen that shipped and the design that was approved —
fail that need.

Supporting files: `needs-119/evidence-index.md` (every claim → its source) ·
`needs-119/frequency-model.md` (the arithmetic behind the ranking).

---

## 0 · How to read this, and how much to trust it

### 0.1 The method, and why it is inverted from last time

The previous round derived its interaction grammar from the engine's decision protocol outward:
twenty decision variants → one renderer → the surfaces around it. That is a legitimate way to build
a *complete* client and it is why the previous design is complete. It is also why it is possible to
have every decision answerable and still not be able to play: **completeness over the protocol is
not coverage over the player's moments.** The protocol has no message for "I have just regained
control and I do not know what changed", because that is not a decision — and so nothing in the
previous design serves it.

This document starts at the other end. The unit is a **moment**: a point in a real turn where a
player has an aim, a question, and a next action. Some moments map cleanly onto an engine decision.
Several of the most important ones map onto no engine message at all, and those are exactly the
ones the previous round could not see.

### 0.2 What I did and did not do

- I read the competitor teardown, the previous PRD's design spec, the intent/protocol delta doc,
  the recorded usability pass (B1–B5, M1–M13, m1–m18, c1–c2), the Edison rules reference, and the
  engine runtime-facts doc.
- I read the **shipped source** on `master` and cite it by `file:line`. Code is not behaviour: a
  claim tagged `[C]` means I read the code path, not that I watched it happen.
- I **did not run the app myself**. Where a claim is tagged `[O-118]` I am reading a PNG captured by
  the parallel ZUH-118 evidence run at `/workspace/product/redo/evidence-118/shots/…` (inspected
  2026-08-12 ~22:00 UTC, while that run was still in progress). Those frames are somebody else's
  work; I looked at the images and describe what is visibly in them. They corroborate seven claims I
  had already derived from code, and they produced two I would not have found.
- **No player was observed for this document.** There is no user research behind any of it. The
  only player-shaped evidence this project has ever had is (a) the recorded independent usability
  pass, which was a simulated persona in a scripted browser against a prototype, and (b) the CEO's
  report that he could not complete a game. Everything else — including every "the player wants X"
  in §3 — is **inference from the domain**, and it is tagged as such. §8 says what would upgrade it.

### 0.3 Evidence tags

| Tag | Means |
|---|---|
| `[C]` | Read in the shipped source on `master`, cited `file:line`. **Code, not behaviour.** |
| `[O-118]` | Visible in a screenshot captured by the parallel ZUH-118 run. I inspected the image; I did not capture it. |
| `[T]` | The competitor teardown, carrying its own tag: `[T·V]` it verified from a frame, `[T·R]` reported by a source, `[T·I]` its inference. |
| `[U]` | The recorded usability pass, by finding id. Simulated persona, scripted browser, against the **prototype** — not against what shipped. |
| `[D]` | The previous approved design or the intent-model doc, by section. |
| `[G]` | An Edison game-rules fact, cited to the repo's rules reference. |
| `[I]` | **My inference** about what a player needs. Not evidence. Argued, not proven. |

If a sentence in §3 has no tag, it is `[I]`.

---

## 1 · The player I derived from

Composite, from the teardown's audience findings, not from anyone I met.

- **Fluent.** Knows the Edison card pool, knows what Solemn Judgment costs, knows Sangan's trigger
  matters and Card Trooper's draw matters, and does not want to be told any of it. `[T·V]`
- **DuelingBook-native.** Their incumbent is *manual*: they assert plays, the client never asks them
  questions, information is dense and always on, and **there is no clock at all** — DuelingBook's own
  rules say there is no time limit. `[T·V]` Two consequences that run through everything below:
  they are not used to being asked, and they are not used to being timed.
- **Fast and impatient at the keyboard, slow and careful in the head.** The clicks they want to be
  free are the ones that gather information (what is that, what's in the GY, what did they set) and
  the clicks they want to be deliberate are the ones that spend resources.
- **Playing a person, in a match.** Edison is played best-of-three with siding. The unit of the
  experience is a match, not a duel. The unit of *this* product is a duel.
- **Suspicious of the engine, correctly.** The Edison community's own compatibility table scores
  every automatic client ❌ on Edison correctness. `[T·V]` So when our screen refuses a play, the
  player's first hypothesis is not "I misread the rules" — it is "this client is wrong". That shapes
  what a refusal has to say.

---

## 2 · The five questions, which recur at every moment

Every moment below is an instance of the same five. They are the spine; §3 is the detail.

1. **Am I on?** — Is the game waiting for me, or for them, or for itself?
2. **What is true now?** — And specifically: *what changed since I last looked?*
3. **What can I do, and what will it cost?** — Legal options, and their price, **before** the click.
4. **Did it take?** — Did the thing I named happen, and is it the thing I named?
5. **Can I get out?** — And if not, was I told that *before* I committed, not after?

A moment is well served when all five are answerable without the player forming a theory about the
software. A moment is badly served when any one of them requires the player to remember, to count,
to diff two board states in their head, or to reason about what the client is doing on their behalf.

---

## 3 · The moments

Fifteen. Ordered as a duel runs, not by importance. Each has: what the player is trying to achieve ·
what they must KNOW and **where their eyes are** · what they must be able to DO · how they know the
system heard them · how they recover. Then the two failures.

---

### M1 · Seating — the first ten seconds, before anything has happened

*Once per duel. 100% of duels.*

**Achieving:** getting oriented well enough to make a first move without asking anyone a question.

**Must KNOW.** Who is across the table — a name, and that they are actually there. **Whether I am
going first or second**, which in Edison is not a formality: the first player draws (hand of six)
and has **no Battle Phase on turn 1** `[G R01-B1/R01-B2]`, so first means a set-and-pass shape and
second means an aggressive one. What the clock rules are, *before* I spend any of it. That my deck
loaded as I built it. And whether it is my move right now. **Eyes:** the centre of the screen while
the board arrives, then straight down to their own hand, then up-right for the opponent.

**Must DO:** nothing but read — and leave, if this is the wrong duel.

**Heard me:** a populated board, a hand of the right size, and one side named as the active one.

**Recovery:** exit.

**Shipped fails it.** The pre-duel state is a centred `Waiting for duel to start…` `[C
DuelScreen.tsx:402]`. The opponent is the literal string `"Opponent"` in all three places a name
appears `[C DuelScreen.tsx:347,387; DuelStage.tsx:259]` `[O-118 s1/05]`. Turn order is decided by
the engine auto-answering rock-paper-scissors with a constant `value: 1`, and it is never surfaced
`[C EdisonDuel.ts:227-236]`; there is no decision variant for the first-player choice at all
`[C EdisonDuel.ts:111-113]`, and no roll, result or "you are going first" statement reaches the
client. The player infers their seat by counting their own hand. The clock rules are never stated;
the clock simply appears, already running `[O-118 s1/05: `YOU 4:47 RUNNING`]`. At t=10s the player's
own opening hand rendered as **six featureless grey rectangles** — card art had not yet loaded and a
board tile carries no name, so an unloaded card is nothing at all `[O-118 s1/05, s3/03]`.

**The previous design fails it.** The surface inventory has thirteen surfaces and **none of them is
"the duel is starting"** `[D §1–13]`. The whole treatment is one row of the board's state table —
*"field skeleton at 30% opacity, 'Dealing…'"* `[D §2]` — and the flows document opens at *"Summon
this monster"* `[D flows]`. Turn order, seat identity and opponent identity appear nowhere in the
design. This moment was not designed; it was assumed away.

---

### M2 · The opening hand — reading five cards and choosing a shape

*Once per duel, and re-read a dozen times after.*

**Must KNOW:** what each card in hand is and does, without losing sight of the others. **Eyes:**
bottom centre, sweeping left to right.

**Must DO:** read a card cheaply and repeatedly; probing must cost nothing.

**Shipped fails it.** A hand card's identity is **its art and nothing else** — the tile is 58×82px
with `alt=""` and `aria-hidden` on the image and no name text `[C ZoneSlot.tsx:114-190]`, and when
art has not loaded the tile is blank `[O-118 s3/03: five of six hand cards blank, one loaded]`. The
route to card text is worse: the only verb guaranteed to appear on every card is `Inspect`, and
`Inspect` calls `inspectCard(ref, 0)` — a literal zero passcode — so the inspector renders
**"🂠 Face-down card"** for the face-up card you just clicked `[C DuelStage.tsx:194 →
CardInspector.tsx:172-183]`. The same literal `0` is passed for every card click while a question is
up `[C DuelStage.tsx:169]`. **Hover-to-inspect is not wired anywhere in the application** — of three
call sites that open the inspector on a card, two pass `0` and only the resolving-chain auto-push
passes a real passcode `[C: all call sites of `inspectCard(`]`. So the shipped answer to "what does
this card do" is: nothing, unless the card is resolving on a chain or you open a pile.

**The previous design fails it.** §8 specifies this correctly and generously — auto-push first,
hover second, click third, image for recognition and rendered text for reading `[D §8]`. What it
does not contain is any acceptance criterion binding *the identity of the card the player touched*
to the panel, and that is precisely the seam the implementation fell through. It also never says
what a card tile is when its art is missing; the design treats art failure as an inspector problem
`[D §8 art-failed row]` and the board is left with no textual identity at all.

---

### M3 · Control returns — reconstructing what changed while I was away

*Every handover: ~12–20 times per duel, plus every reconnect. Also the single moment most likely to
lose a duel to a misread board.*

**Achieving:** rebuilding an accurate picture of the game before spending anything.

**Must KNOW:** what changed, **in what order**, and what did *not* change. In Edison terms: how many
cards are in their back row now versus when I last looked (that count is the entire risk model for
my turn), what left the field and where it went (Sangan to the GY is a different game from Sangan
banished), what my LP did and why, and whether anything of mine is now missing. **Eyes:** their
back row first, then their monster row, then their GY count, then my own hand. This is a *scan*,
not a read, and it happens in about two seconds.

**Must DO:** absorb the delta without clicking, and drill into any part of it that surprises them.

**Heard me:** n/a — this is a reading moment, and that is exactly why it gets skipped by designers.

**Recovery:** re-read it. Which means the delta must **persist**, not be a toast that already faded.

**Shipped fails it.** The board is current and the event log is complete and well structured
`[C EventLogRail.tsx]`, but it is a *transcript* grouped by turn and phase, collapsed by default,
and it answers "what happened in turn 7", which is not the question. There is no delta anywhere —
no mark for "since your last decision". Worse, on connect and on reconnect the server sends
`SEAT_ASSIGNED`, `STATE`, `CLOCK` and `DECISION` and **no event backfill at all**
`[C duelSocket.ts:860-900]`; events exist only in the client's memory, so a browser refresh at any
point destroys the entire history and the rail then reads *"Earlier turns are not available."*
`[C EventLogRail.tsx:602]`. The player who most needs the transcript — the one who just came back —
is the one guaranteed not to have it.

**The previous design fails it.** It makes the log the answer, and it is a good log — Master Duel's
structure over DuelingBook's completeness `[D §10; T §5]`. But a transcript and a delta are
different objects answering different questions, and the teardown says plainly that **no client in
the set ships a delta** `[T §5 — it identifies the structure/completeness gap and stops there]`.
Collapsing it by default `[D §10]` then makes the most frequently needed answer in the duel a
keypress that a fast player will not spend. This is a design-level gap, not an implementation one.

**System-thinking flag:** the player is required to hold the previous board state in their own head
and diff it. The engine knows exactly what changed and says so on the wire.

---

### M4 · Scanning for a play — what can I do, and what does it cost

*Several times per turn; the most repeated interaction in the game.*

**Must KNOW:** for each card, what it can do *right now*, and **the price before the click** —
how many tributes this summon takes, how much LP this activation costs. **Eyes:** their back row
(the risk), then my hand (the options), then the card under the cursor.

**Must DO:** probe cheaply. Fluent players probe constantly: click, read, escape, click the next.
Probing must cost nothing, must never commit anything, and must never be visible to the opponent.

**Recovery:** `Esc` and click-away, always, with no state left behind.

**Shipped fails it.** The probing loop itself is good: only legal verbs are rendered, illegal ones
are absent rather than greyed, and the cluster carries `Esc closes — costs nothing`
`[C VerbChipCluster.tsx]` `[O-118 s3/03]`. Two failures sit on top of it. (1) No cost appears on any
chip — the engine does not put the tribute count on the wire at idle time, verified live and
recorded `[D §3 CTO correction]` — so the price of a tribute summon is learned *after* committing to
it. (2) The refusal message fabricates a rules claim: `deriveRefusalReason` returns **"This monster
has already attacked."** for *any* monster in a monster zone that is absent from `attacks[]` during
Battle Phase — which includes your own defence-position monsters, monsters summoned this turn, and
**every one of the opponent's monsters** `[C VerbChipCluster.tsx:245-265]`. The one carve-out the
design permitted became the catch-all, and it now states something false about the opponent's board
in a rules-enforcing client.

**The previous design fails it.** §3 is right, and the refusal-copy rule is right in principle
(state causes, never generate them) `[D "two rules" §2]`. But the design permitted exactly one
derived reason and did not specify how the client decides the derivation applies — so the derivation
became unconditional. And on cost, the design's answer is to defer to a wire capability `[D §13a
M5]`, which means the moment of choosing a play is missing its price tag by design as well as in
fact.

---

### M5 · Committing — the point of no return

*Every play: 3–6 times per turn.*

**Must KNOW:** exactly what is about to happen (which card, which cost, which target) and whether
**this** click is the one that cannot be taken back. **Eyes:** on the confirm control alone.
Everything else is peripheral at this instant, which is why the price must be *on* the control.

**Heard me:** the intent advances without unmounting, and the card that moves is the card that was
named.

**Recovery:** before the lock, cancel at zero cost. After it, nothing — so the lock has to be
legible *before* the click.

**Shipped serves it, mostly.** The intent ribbon persists across sub-decisions, draws the lock,
renders `Past this point you cannot cancel`, warns `Next step commits — cannot be undone` one step
early, and the confirm button names the card `[C IntentRibbon.tsx; DecisionRenderer.tsx:86-99]`.
This is the best-served moment on the screen and it should survive the redesign intact.

**The previous design leaves two residues.** (1) The step budget — `3 steps · 2 left, possibly more
if a trigger fires` — is a **client-side guess** from a template the design owns `[D §5]`, printed
in the same typographic register as the commit lock, which is an engine fact. Mixing a guess and a
fact in one widget teaches the player to trust neither. (2) The design's answer to "what will this
cost" is a deferred wire delta, so the single most important moment in the flow is specified with
the price missing.

---

### M6 · Being asked, inside my own play

*2–5 sub-questions per play. This is where the previous round started, and it is the one moment it
genuinely solved.*

**Achieving:** continuing to do the one thing I meant to do.

**Must KNOW:** that this question belongs to *my* action, which action, and how much further it
goes. **Eyes:** bottom-centre, arriving from the card they just clicked — a long saccade, made once
per play.

**Recovery:** cancel where the engine permits it, and be told plainly where it does not. Note the
hard edge: a cancel sent to a zone-placement question **freezes the duel** — the engine loops
forever emitting hints and no decision ever arrives `[C runtime-facts Q4]`. So at that step there is
no recovery to design; there is only a promise not to offer one.

**Shipped serves it.** The ribbon survives the `STATE`-then-`DECISION` gap, selection clears per
decision, auto-answers produce a read-only receipt `[C useDuelInteraction.ts; AutoAnswerReceipt]`.

**The previous design's residue.** The auto-resolve register removes the zone question by default
`[D §15]`, and the design flags on its own initiative that this contradicts the "only where exactly
one legal answer exists" rule `[D §16B]`. I am recording that contradiction, not re-deciding it.

---

### M7 · Backing out

*Every mis-click. Frequent, and its frequency is invisible because a player who cannot back out
stops probing altogether.*

**Must KNOW — in advance, not on demand:** whether backing out is possible here. A player who
cannot see the exit invents one, and the invented one on a keyboard is `Esc`.

**Heard me:** the board returns to what it was, and nothing was sent.

**Shipped/design.** The design's keyboard contract — *no keyboard event may submit a decision;
`Esc` never commits anything, anywhere* — was written in response to a blocker where `Esc` committed
an irreversible tribute step and destroyed a card the player never chose `[U B2]` `[D §0]`, and the
verb cluster advertises `Esc closes — costs nothing` `[O-118 s3/03]`. I did not verify the shipped
dock's key bindings and I am not claiming they are right or wrong. What I can say from the need
side: the design's own answer-fidelity invariant exists because **decline once did the same thing as
confirm** `[U B4]` — the deepest possible violation of question 4 — and that class of defect is
invisible to every kind of testing except enumeration.

---

### M8 · Battle — choosing attacks and reading the trade

*Every turn from turn 2 (turn 3 for the player who went first `[G R01-B2]`).*

**Must KNOW:** my ATK against their ATK/DEF — as a **comparison**, not as two numbers 200px apart;
which of my monsters have already attacked; how many face-downs they hold and therefore what the
swing is worth (in Edison the relevant blowouts are Dimensional Prison, Mirror Force, Book of Moon,
Threatening Roar — the risk model is entirely "how many cards are in that row"); and whether a
face-down defender is worth attacking into. **Eyes:** ping-ponging between the two monster rows,
then their back row.

**Must DO:** declare attacks quickly and repeatedly, and stop the Battle Phase at any point.

**Recovery:** target selection is cancelable because the engine says so; declaration is not, and the
design resolved this correctly from `can_cancel` rather than from taste `[D M11 disposition]`.

**Shipped fails it partly.** ATK/DEF now render on the tile and an attack badge marks spent monsters
`[C ZoneSlot.tsx]`. But the fabricated refusal from M4 bites hardest here — clicking the opponent's
monster during Battle Phase says *"This monster has already attacked."* about **their** card
`[C VerbChipCluster.tsx:251-262]`.

**Neither serves the comparison.** The player's actual question is a subtraction, and nothing on
either the shipped screen or in the design ever states a comparison. I am not proposing one; I am
recording that the need exists and is unmet in both.

---

### M9 · Passing the turn

*Once per turn.*

**Must KNOW:** whether I still have a play I have forgotten — and specifically, in Edison, **have I
used my Normal Summon this turn?** That is the most common self-check in the game. **Eyes:** the
phase rail.

**Shipped serves the mechanics:** the phase rail is the control, `End Turn` is permanent and never
hides inside a panel `[C PhaseRail.tsx]` `[O-118 s1/05]`.

**Both fail the self-check.** The engine knows whether the normal summon is spent — the option is
simply absent from `summons[]` — but *absence of an option is not a statement*, and no surface in
either the shipped screen or the design turns it into one. The player is asked to remember.

---

### M10 · Dead time — the opponent is thinking

*Half the duel. The state the intent-model doc named as the worst-served, before the rebuild
`[D §8 R8.1-R8.2]`.*

**Achieving:** staying in the game — reading, planning, and being able to react within a second when
a window opens.

**Must KNOW:** that the game is alive and it is not my problem yet; whose clock is running and **how
much of mine is left**; and what they are doing, as they do it. **Eyes:** free to wander — this is
the only moment the player can look away, which is exactly why the screen must be able to pull them
back.

**Must DO:** inspect anything, free, instant, silent and never broadcast. This is a stated day-one
win over the incumbent, which broadcasts `Viewing Deck` and whose community pays for extensions to
stop it `[T·V §6]`.

**Shipped fails it, and worse than the pre-rebuild screen did in one specific way.** The client
derives its mode purely from whether it is holding a decision `[C useDuelInteraction.ts:507-517]`,
and `DuelScreen` never clears the pending decision when control passes — it is replaced only by the
next `DECISION` or by `DUEL_END` `[C DuelScreen.tsx:156-178]`. So after you hand over control **your
client still believes it is your turn for the whole of the opponent's turn**: your field stays live
and clicking your own hand opens a live verb cluster offering `Set` and `Inspect`
`[O-118 s2/06]` — and choosing one produces a server rejection rendered as an error banner reading
**"⚠ not your turn"** pinned to the top of the screen, the far end from where the click happened
`[O-118 s2/07]`. Meanwhile no waiting indicator appears at all, because the waiting banner and the
dock's waiting text both require the mode the client never enters `[C DuelStage.tsx:256-261,292]`.
The screen simultaneously says *THEIRS* at the top, offers you plays in the middle, and errors at
you when you take one.

And the string `Waiting for engine…` — the exact copy the intent-model doc named as the symptom —
did survive the rebuild `[C DuelStage.tsx:381; useDuelInteraction.ts:526-531]`. It is what the
second player sees for the entire first turn of the duel, and what everyone sees after the duel
ends.

**The previous design fails it.** §12 correctly frames waiting as *a mode of the whole screen*
rather than a panel `[D §12]`, and that framing is right. But the inventory never gives the dock a
defined content for the waiting mode, so what shipped there is an **E2E-contract artefact** — a
placeholder that exists because a test requires the panel to be present at all times
`[C DuelStage.tsx:17-22,351-357]`. A test requirement filled a design vacuum, and the vacuum is in
the design.

---

### M11 · The interrupt — a response window opens

*Several times per opponent turn once back rows exist; the moment Edison games are decided in.*

**Achieving:** deciding in a few seconds whether to spend a trap now or hold it.

**Must KNOW, in one glance, with no clicks:**
1. **What just happened** — who did what, from where, to what. A window with no subject is not a
   question.
2. **What I can answer with**, and where those cards are.
3. **What it costs** — Solemn Judgment is half your life points; this is the single most expensive
   button in the game.
4. **What happens if I decline.** A chain decision is a comparison of two futures, and only one of
   them is ever on screen.
5. **How long I have.**
6. **Whose window this is.** In Edison the turn player gets an ignition window on their own summon
   *before* the opponent may respond `[G R06-B1]` — so "you are being asked because you summoned"
   and "you are being asked because they summoned" are the same UI object and completely different
   decisions.

**Eyes:** bottom-centre, arriving cold from wherever they were looking. Line 1 has to carry the
whole story because there is no time for a second fixation.

**Heard me:** distinct answers produce distinct outcomes — the answer-fidelity invariant, which
exists in the design because it was violated three separate times, once by `decline` performing the
same action as `confirm` `[U B4]` `[D §0a]`.

**Shipped fails it, and this is the worst failure on the screen.** The question sentence is the
bare string **`"Chain a card or effect?"`** `[C DecisionRenderer.tsx:212-218]`. The `caption` prop
that would carry the engine's context is never passed by the stage `[C DuelStage.tsx:385-400]`, and
the `DECISION_CONTEXT` sidecar the server builds and sends before every decision **has no case in
the client's message switch** — it is received and discarded `[C DuelScreen.tsx:150-184;
duelSocket.ts:521-556; contracts/duel.ts:177]`. Partial mitigation: when the trigger was a card
*activation*, the chain strip built from the event feed shows the link with its name
`[C chainFromEvents.ts; DuelStage.tsx:157-164]`. But the most common Edison window of all — respond
to a **summon**, with Bottomless, Solemn or Torrential — has no chain link yet, so the strip is
empty and the player is asked to respond to nothing at all. The cost is not on the confirm button
either `[D §13a M5 deferred]`. This is "Respond?" with no context, which is the exact thing the
rebuild existed to remove.

**The previous design fails it in two narrower ways.** The anatomy is right and the usability pass
called it the strongest screen in the build `[U "what passed"]`. But (a) it never specifies what
line 1 **degrades to** when context is unavailable, so a client missing context degrades to a bare
verb — which is what happened; and (b) it never distinguishes your own priority window from their
response window, an Edison-specific distinction the format's own rules reference calls out `[G
R06-B1]`. And neither design nor build ever answers need 4 — *what happens if I decline* — which for
a player deciding whether to pay 4000 life points is the entire decision.

---

### M12 · Watching it resolve

*Every chain.*

**Must KNOW:** which link is resolving now, what it did, and what the totals are afterwards.
**Eyes:** the chain strip, then the life-point plates.

**Shipped serves it** — this is the one place the shipped screen does exactly what the design
intended. The strip is folded from the event feed with ordinals taken from the event's own `link`
field rather than array position, and the resolving link's text is auto-pushed to the inspector with
no click `[C chainFromEvents.ts; DuelStage.tsx:136-147]`.

**Both leave one gap:** nothing states an **outcome**. "Solemn Judgment negated Torrential Tribute"
exists only as a sequence of log rows the player must assemble. The engine emits the negation; the
screen never says it.

---

### M13 · Clock pressure

*Ambient, all duel; acute a few times.*

**Must KNOW:** how much time I have **right now**, and — before starting a multi-step play — how
much that play will cost me. **Eyes:** peripheral, until suddenly foveal.

**Shipped fails it, in a way that inverts the fix it was built from.** Both clock rows exist, each
labelled with an owner and `RUNNING`/`BANKED`, with escalation bands on your own clock only
`[C ClockPanel.tsx]` — the answer to `[U M8]`. But the `deadlines` tuple is only built once **both**
seats have held control at least once (`seatDeadlines` starts `[null, null]`)
`[C duelSocket.ts:49,85,604-628]`, and the client falls back to `[deadlineAt, deadlineAt]`
`[C DuelScreen.tsx:293]`. So for the first handover both rows are the same countdown, and the
opponent's row reads a number they have never owned — observed as `OPPONENT 4:57 BANKED` on turn 1
before the opponent has ever been on clock `[O-118 s3/03, s1/05]`. Afterwards the off-clock row
shows a **stale absolute deadline** from the last time that seat held control, recomputed against
the current time on every clock frame `[C ClockPanel.tsx:47-58]`, so it decays through the
opponent's turn and, on any turn of normal length, reaches `0:00` — with no alarm styling, because
escalation is gated on the row also being the running one `[C ClockPanel.tsx:61]`. The surface built
to answer *"how much have I got banked?"* answers it with a number that is not the player's, and
eventually with zero.

**The deeper problem is the model, not the widget.** The server recomputes `now + N seconds` every
time control transfers `[C duelSocket.ts:604-613]`. **There is no banked time.** Nothing accumulates,
nothing carries over. The design nonetheless labels the off-clock row `BANKED` and describes banked
time as *"a resource carried across the opponent's whole turn"* `[D §7]`, and the wire contract calls
the setting `perMoveSeconds` `[C contracts/duel.ts:17-20]`. Three names for one mechanism, describing
at least two different games. See §7 — this is the escalation.

---

### M14 · The duel ends

*Once per duel.*

**Achieving:** knowing the result, understanding what beat me, and getting to the next game.

**Must KNOW:** won/lost/drawn; the reason **in game terms**; the final board, still inspectable; and
the last few things that happened, because that is where the answer to "what beat me" lives.

**Must DO:** review, and then — for a competitive player in a best-of-three — **play the next game
against the same person**.

**Shipped fails it in three ways.** The overlay states result, reason and both totals and offers
`Open log` and `Back to Home` `[C DuelEndOverlay.tsx]`. But (1) the log it invites you to open is
empty if you reloaded at any point, because there is no backfill `[C duelSocket.ts:860-900]`; (2)
behind the overlay the dock reads `Waiting for engine…`, because the ended mode shares the waiting
placeholder `[C DuelStage.tsx:292,376-383]`; (3) the person who just beat you is called `"Opponent"`
`[C DuelScreen.tsx:413]`, and the only route onward is Home. There is no rematch.

**The previous design fails it at the edges.** §13 handles result, reason and review well `[D §13]`.
"What next" is absent, which is a scope fact rather than an oversight — the product's unit is one
duel and the format's unit is a match. I am recording it because the player will have the moment
whether or not we designed it.

---

### M15 · Disruption — a reload, a drop, an opponent who walks away

*Rare per duel, certain across a session.*

**Must KNOW:** am I still in this game; is my clock running while I am out (it is — an absent
opponent's clock keeps running, which is how the state resolves itself `[D §12]`); and what I missed.

**Shipped fails the last of those completely.** Reconnect restores state, clock and the pending
decision, and delivers **no history** `[C duelSocket.ts:860-900]`. The honest empty state exists
`[C EventLogRail.tsx:602,653]`, which is better than lying, but the answer to "what did I miss" is
structurally "nothing is available".

---

## 4 · The ranked gap list

Ranked by **how often a player hits the unmet need**, not by how bad it looks. Frequencies are
estimates for one Edison duel of ~12 turns; the arithmetic is in `needs-119/frequency-model.md` and
it is `[I]` throughout.

| # | Gap | Moment | Hits / duel | Whose failure | Evidence |
|---|---|---|---|---|---|
| **1** | **The response window has no subject.** The question is the bare string `Chain a card or effect?`; the server's context sidecar is received and discarded; on a summon-triggered window even the chain strip is empty, so the player is asked to respond to nothing. | M11 | 5–20, each decisive | **Both.** Shipped drops the context; the design never said what the sentence degrades to. | `[C DecisionRenderer.tsx:212-218; DuelScreen.tsx:150-184; DuelStage.tsx:385-400]` |
| **2** | **Your screen still thinks it is your turn after you pass.** Stale decision ⇒ live verbs off-clock ⇒ a `not your turn` error banner at the opposite end of the screen; and no waiting indicator ever appears. | M10 | every handover (~12–20) | **Shipped.** The design framed waiting correctly but left the dock's waiting content undefined, so a test artefact filled it. | `[O-118 s2/06, s2/07]` `[C useDuelInteraction.ts:507-517; DuelScreen.tsx:156-178]` |
| **3** | **No delta on regaining control.** A transcript, collapsed by default, answers a different question; and after any reconnect or refresh there is no history at all. | M3 | every handover (~12–20) | **Both**, and design-first: nobody in the reference set ships a delta. | `[C EventLogRail.tsx; duelSocket.ts:860-900]` `[T §5]` |
| **4** | **Card identity is not obtainable on demand.** `Inspect` and every answer-mode click pass passcode `0`, so the inspector says "Face-down card" about a face-up card; hover is unwired; a tile with unloaded art carries no name. | M2, M4, M8 | 10–40 | **Shipped**, with a design gap that permitted it (no criterion binding the touched card to the panel; no textual fallback for a tile). | `[C DuelStage.tsx:169,194; CardInspector.tsx:172-183; ZoneSlot.tsx]` `[O-118 s3/03]` |
| **5** | **A fabricated rules claim on the most-clicked gesture in Battle Phase.** "This monster has already attacked." is returned for any monster not in `attacks[]` — including the opponent's. | M4, M8 | every Battle Phase | **Shipped**, and it violates the design's own rule 2. | `[C VerbChipCluster.tsx:245-265]` `[D "two rules" §2]` |
| **6** | **The clock reports a number that is not the player's time**, and the model behind it ("banked") does not exist in the server. | M13 | ambient | **Both**, plus a product-decision ambiguity — see §7. | `[C duelSocket.ts:604-628; ClockPanel.tsx:47-61; DuelScreen.tsx:293]` `[O-118 s1/05, s3/03]` |
| **7** | **Price after commitment.** Tribute count is not on the wire at idle time; activation cost never reaches the confirm control. | M4, M5 | 5–15 | **Both** — design deferred it to a named wire capability; shipped matches the design. | `[D §3 correction, §13a M5]` |
| **8** | **The opponent is a string literal.** `"Opponent"` in the top bar, the waiting state, the log and the result card. | M1, M10, M14 | ambient; acute at the end | **Shipped** (the name exists in the room and is not passed through). | `[C DuelScreen.tsx:347,387,413; DuelStage.tsx:259]` `[O-118 all frames]` |
| **9** | **The first ten seconds are undesigned.** No duel-start moment; turn order auto-answered with a constant and never announced; clock rules never stated; opening hand blank until art loads. | M1 | 1 (100% of duels) | **Both** — the design has no such surface at all. | `[C EdisonDuel.ts:227-236; DuelScreen.tsx:402]` `[O-118 s1/05]` `[D §1–13]` |
| **10** | **The layout overflows its own declared floor.** At 1440×900 the opponent's life-point plate, `End Turn` and the log control are clipped at the right edge, while the lower third of the viewport is empty. | all | ambient | **Shipped.** | `[O-118 s3/03 — 1440px-wide frame]` |
| **11** | **Your own priority window is indistinguishable from their response window** — a real Edison distinction (ignition priority on your own summon). | M11 | a few | **Both.** | `[G R06-B1]` `[D §4 variant table]` |
| **12** | **"Have I used my Normal Summon?"** is answerable only from memory; absence of an option is not a statement. | M9 | every turn | **Both.** | `[I]`, engine state is available |
| **13** | **No outcome statements.** Nothing says "X negated Y" or "Z was destroyed by battle"; the player assembles it from rows. | M12, M3 | every chain | **Both.** | `[C EventLogRail.tsx]` |
| **14** | **The duel ends into a dead end** — no route back to the same opponent, in a format played as a match. | M14 | 1 | **Design/scope.** | `[C DuelEndOverlay.tsx]` |
| **15** | **A guess and a fact wear the same clothes** — the client-derived step budget sits beside the engine-derived commit lock in one widget. | M5 | every multi-step play | **Design.** | `[D §5]` `[C IntentRibbon.tsx]` |

**Gaps 1–5 account for most of "I could not complete a game."** They are also all in the same
family: *the screen knows something and does not say it, or says something it does not know.*

---

## 5 · Flows that make the player think about the system rather than the game

The brief asked for these explicitly. Six, ordered by how unavoidable they are.

1. **`Waiting for engine…`** — names a component the player has no model of, at the moment they most
   need a game-language statement. `[C DuelStage.tsx:381]`
2. **`not your turn` as an error banner** — the player is told they broke a rule of the *client*
   after the client offered them the action. `[O-118 s2/07]`
3. **Response-prompt verbosity (`Minimal / Standard / Every window`)** — requires the player to
   reason about *when the client will ask them things* in order not to miss responses. Every
   automatic client ships one `[T·V §7]` so it is table stakes, and it doubles as the only available
   mitigation for the timing tell `[T·R §7]` — but it is unambiguously system-thinking and should be
   understood as a tax we are choosing to pay, not as a feature.
4. **`Choose zones`** — a preference about whether the client answers an engine question on your
   behalf. "Which zone" is a game concept; "whether you are asked" is not.
5. **Auto-answer receipts** — *"Answered for you: leftmost free zone"* is a statement about client
   behaviour. Necessary given (4), and honest, but it is the seam showing.
6. **The step budget and the commit lock** — both express the fact that one player intent is 2–6
   engine decisions.

Items 4–6 exist **because** of the seam between one intent and many decisions. The previous design
chose to be honest about the seam and to explain it to the player. That is a defensible choice and I
am not reversing it. But it is worth stating plainly as an input to the redesign: **every one of
those five surfaces is the player paying attention to our architecture**, and a redesign that starts
from the player should at minimum be asked whether the seam needs to be visible at all.

---

## 6 · What the client would have to be told that it is not told today

In scope per the brief: things the client needs to be **told**, not changes to what the engine
decides. Ordered by which gap they unblock.

| # | The client needs | Unblocks | Status today |
|---|---|---|---|
| **W1** | **The trigger of a response window as data** — who did what, from where, to what, including the **summon** case. | Gap 1 | Half-built and unused. The server builds a `DECISION_CONTEXT` sidecar and sends it before every decision, but it carries only a hint caption, the chain stack and the activating card `[C duelSocket.ts:521-556]` — so summon-triggered windows would still have no subject even if it were read. The client has no case for the frame at all `[C DuelScreen.tsx:150-184]`. |
| **W2** | **A signal that control has left this seat** — or, equivalently, the client must stop inferring its mode from a decision it is still holding. | Gap 2 | `CLOCK.onClockSeat` already carries it and the client does not use it for mode `[C useDuelInteraction.ts:507-517]`. **No wire change needed** — recorded here because it is the same class of "told and ignored". |
| **W3** | **Event backfill on connect and reconnect.** | Gaps 3, 14 | Not sent; the design anticipated this and specified the honest empty state instead `[D §10 partial]`. |
| **W4** | **A reason a card affords nothing**, from the engine rather than from us. | Gap 5 | Not on the wire; deferred by the design with the capability named `[D §13a M7]`. Until it exists, the honest surface says nothing — and today's catch-all must go, because it is worse than silence. |
| **W5** | **Activation cost as structured data.** | Gap 7 | Not on the wire `[D §13a M5]`. Note the tribute-count variant is *not* available at idle time — verified live, `release_param` appears only after commitment `[D §3 correction]` — so this one cannot be promised at the moment the player needs it without an engine-side change we are not asking for. |
| **W6** | **Both seats' deadlines from the first clock frame**, and one stated clock model. | Gap 6 | Tuple omitted until both seats have held control `[C duelSocket.ts:604-628]`. |
| **W7** | **Turn order and player display names at duel start.** | Gaps 8, 9 | Names exist in the room and are not passed through; turn order is auto-resolved inside the engine and never surfaced `[C EdisonDuel.ts:227-236]`. |
| **W8** | **A positive statement that a once-per-turn resource is spent** (normal summon). | Gap 12 | Derivable from the decision the client already holds. |

---

## 7 · Escalation — one carried-forward decision that is part of why this shipped badly

Per the CEO's own condition, I am naming it, giving the evidence, and stopping.

### The clock: *"the clock runs per handover of control and running out forfeits the duel."*

I am not asking for the clock to be removed. I am reporting that **this decision was never expressed
in player terms, and in the absence of that, the design, the wire contract and the server each
invented a different clock.**

**The evidence.**

1. **Three names, at least two models.** The server implements a *fresh* allowance recomputed at
   each handover — nothing accumulates `[C duelSocket.ts:604-613]`. The design describes and labels
   the off-clock row `BANKED` and calls banked time *"a resource carried across the opponent's whole
   turn"* `[D §7]` — a model in which something does accumulate. The wire contract calls the setting
   `perMoveSeconds` `[C contracts/duel.ts:17-20]` — a third model, per *move*. The intent-model doc
   raised exactly this as an open question for the CEO (OQ-2, "is the timer per intent or per engine
   decision?") `[D §9]`.
2. **The ambiguity shipped as a wrong number.** The off-clock row displays a stale absolute deadline
   that decays toward `0:00` during the opponent's turn, and before the first handover it displays a
   duplicate of the opponent's `[C ClockPanel.tsx:47-61; DuelScreen.tsx:293]` `[O-118 s3/03]`. A
   player cannot budget against a number nobody can define.
3. **The clock is load-bearing for a large part of the previous design.** It generated its own
   surface with four escalation bands and a second in-question rendering, a backend delta, one
   usability blocker `[U B5]` and two majors `[U M8, M9]`; and it is the stated reason the intent
   ribbon must draw a point of no return at all — the design quotes the CEO: *"if one clock now
   covers a six-decision summon, the UI has to be honest about where the point of no return is"*
   `[D §5]`. A meaningful fraction of the screen's complexity exists to serve it.
4. **It is the single most alien element to the audience.** DuelingBook — where these players live —
   has **no clock at all** and says so officially; pace is regulated socially `[T·V §7]`. The
   teardown's own recommendation was *presence yes, shot clock no; make any timer room-configurable
   and off by default*, flagged there as a judgement call rather than evidence `[T·I §7]`.

**What I am asking for, and not asking for.** One sentence from the CEO stating the clock in the
player's words — *"each time control passes to you, you get N minutes for everything you do until
you pass it back"*, or whatever the true model is — plus a decision on whether it is on by default
for this audience. I am not re-deciding either. Everything downstream (what the row is called,
whether "banked" is a concept, whether the commit lock needs to exist at all) follows from that
sentence and cannot be settled without it.

### Recorded, not escalated

- **`Choose zones` defaulted off** contradicts *"auto-answer only where exactly one legal answer
  exists"*. The previous design flagged this itself and built the CEO's call `[D §16B]`. I am
  leaving it flagged, not re-opening it.
- **"No teaching layer"** is *not* the cause of gap 5. That decision permits stating engine-sourced
  causes; what shipped fabricates one. The fix is W4 plus deleting the catch-all, not a reversal.
- **The locked decision protocol** is not the problem either. Locking it is fine; deriving the
  screen from it was the problem, and that is the method this document exists to change.

---

## 8 · Confidence, and what would change my mind

**Confidence by claim class:**

| Class | Confidence | Why |
|---|---|---|
| Shipped-behaviour claims tagged `[C]` | **High** for what the code does; **medium** for what a player experiences. I read every call site for the ones I ranked 1–6. I did not run the app. |
| Claims tagged `[O-118]` | **High** for what is in the frame; **medium** for generality — one run, one deck, one viewport, and the run was still in progress when I looked. |
| Previous-design claims `[D]` | **High.** The design is unusually explicit and mostly self-flagging. |
| The needs themselves (§3) | **Inference.** Argued from the domain, the teardown's captured frames and the recorded usability pass. Not research. |
| The frequency ranking (§4) | **Low-to-medium.** A model, not a measurement. The order of 1–5 is robust to plausible changes in the estimates; the order within 6–15 is not. |

**What would change my mind, cheaply:**

1. **Two Edison players, one match, on the shipped build, watched.** Not a heuristic pass — two
   people who know the format, playing for real, screen-recorded. That single session would convert
   most of §3 from inference to evidence and would almost certainly reorder §4. It is also the only
   way to test the one thing I could not: whether the *pace* of the screen is right.
2. **One question to the CEO** — the clock sentence in §7.
3. **Twenty minutes of a live duel with two browser tabs**, to confirm the off-clock stale-decision
   behaviour (gap 2) persists across a full opponent turn rather than only across the first handover,
   and to watch the "banked" row decay.

**The one thing I would not spend more on:** re-running the competitor teardown. It is good, it is
cited throughout, and its own §8 is an honest list of what it could not establish — which is more
useful than another pass would be.
