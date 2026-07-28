---
linear_project: Duel Invite Improvements
---

# Pre-duel room — UX flows, screen by screen

**Issue:** ZUH-24 (discovery, ux) · **Project:** Duel Invite Improvements · **Product:** Yu-Gi-Oh App (Edison Duel)

This document specifies what the pre-duel room looks and feels like for both players, from
"create a link" to "the board appears". It covers the states named in the ZUH-24 brief only.
The room's state machine and full edge-case enumeration belong to **ZUH-23** and are not
duplicated here; where a screen depends on a state-machine answer I say so inline and list it
in **§12 Open questions for ZUH-23**.

Everything below reuses the existing visual language: `--bg-0/1/2/3`, `--border`, `--text-0/1/2`,
`--accent`, `--accent-light`, `--accent-dim`, `--valid`, `--warning`, `--invalid`, the `.btn`
/ `.btn-primary` / `.btn-ghost` / `.panel` / `.validity-chip` / `.toast` classes, `--min-touch: 44px`,
and the `← Home` + title header bar used on every duel screen. No new design system, no new
colours, no new components that aren't compositions of the above.

Sketches are drawn at ~46 characters wide, i.e. a 360–390px phone. Desktop is the same layout
in a `max-width: 480px` centred column — identical to `CreateDuelScreen`'s existing `maxWidth: 480`
panel. Mobile is the design target because the invitee is arriving from a chat app.

---

## 0. The user's actual goal, and the two failures we are designing against

The creator's goal is *"get my friend into a duel with me"*. The invitee's goal is
*"work out what this link is and decide in a couple of seconds"*.

Two things currently make the user think about the system instead of their goal, and both are
what this room exists to remove:

1. **A clock starts while nobody is looking.** The creator's per-move clock begins the instant
   the invitee accepts, possibly with the creator's phone in their pocket. Every screen below is
   built so that **no clock ever starts without the player who owns it looking at a screen that
   says so.** That is the single hard requirement this design serves; §8's handoff beat is where
   it is paid off.
2. **A dead-end after create.** "Duel Created!" is a page with nothing to do and nothing to watch.
   The waiting state (§3) replaces it with a room that is visibly alive, re-shareable, and
   productive.

A third, quieter failure: **the link will reach people who cannot use it.** Registration is
closed-beta through admin-issued redeem links only (`LoginScreen.tsx:19–53,201`;
`HomeScreen.tsx:149–160` shows invite generation is admin-only). A duel link pasted into a group
chat will hit non-members. Today they land on `/login` and stop. §9.5 is that screen.

---

## 1. Screen inventory

| # | Screen / state | Who sees it | Route |
|---|---|---|---|
| S1 | Create challenge (timer only, no deck) | creator | `/duel/new` |
| S2 | Room — waiting alone | creator | `/duel/room/:id` |
| S3 | Room — invitee arrival frame | invitee | `/duel/join/:token` → room |
| S4 | Room — both present, neither ready | both | room |
| S5 | Room — you ready, they are not | either | room |
| S6 | Room — they ready, you are not | either | room |
| S7 | Coin flip | both | room |
| S8 | Seat choice — winner | flip winner | room |
| S9 | Seat choice — waiting | flip loser | room |
| S10 | Handoff into the board | both | room → `/duel/:id` |
| D1 | Link expired | invitee | join route |
| D2 | Room already full / duel already started | invitee | join route |
| D3 | Your own link | creator | join route → S2 |
| D4 | The other player left | either | room |
| D5 | You don't have an account (public landing) | logged-out visitor | join route, unauthenticated |
| D5b | Logged-out member — sign in and resume | member | `/login` → room |

Shared conventions used by every room screen are in **§10**; accessibility in **§11**.

---

## 2. S1 — Create challenge

Changes to today's `CreateDuelScreen`: **the deck picker is removed** (deck choice moves into the
room, so both players choose under the same conditions and the creator isn't locked into a deck
30 minutes before the duel starts), and the timer presets change to the live-only set with a
10 min default and 15 min ceiling. Creating no longer mints a live duel — it mints a room.

```
┌──────────────────────────────────────────────┐
│ [← Home]   ⚔ Challenge a friend              │
├──────────────────────────────────────────────┤
│                                              │
│  Time per move                               │
│  Both players get this long for every move.  │
│                                              │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌────────┐      │
│  │ 3 min│ │ 5 min│ │10 min │ │ 15 min │      │
│  └──────┘ └──────┘ └━━━━━━━┘ └────────┘      │
│                     ^ selected: --accent      │
│                       border, --accent-dim bg │
│                                               │
│  ⏱ Each player gets 10 min to make each move. │
│     --accent-light, 0.875rem                  │
│                                               │
│  You'll pick your deck in the room, once      │
│  your opponent is there.   --text-2, 0.875rem │
│                                               │
│  ┌──────────────────────────────────────────┐ │
│  │        Create challenge link ▸           │ │  .btn-primary, 44px, full width
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

Notes:

- The presets are the same chip pattern as today (`--accent` border + `--accent-dim` background
  when selected, 44px min height). Custom is dropped: with a 3–15 min range and four presets there
  is nothing a custom field buys, and it was the only field on the screen that could produce an
  invalid value.
- The "you'll pick your deck in the room" line pre-empts the one question this screen now raises
  ("where did the deck picker go?"). Without it, a returning creator hunts for it.
- On tap the button goes to `Creating…` and disables — unchanged from today's pattern.

---

## 3. S2 — The creator, waiting alone  *(the state the feature exists for)*

### 3.1 Recommendation

**The post-create screen is the room itself, not a confirmation page.** The creator lands in
`/duel/room/:id` and stays there. It has four jobs, in priority order:

1. **Get the link out.** Sharing is the only thing that advances the goal, so it is the primary
   action and it stays visible for the whole wait — not consumed after one tap.
2. **Prove the room is alive.** No spinner-only states. Waiting must never be confusable with
   "stuck".
3. **Make the 30-minute expiry legible without making it stressful.**
4. **Let the wait be productive: pick the deck now.**

### 3.2 Screen

```
┌──────────────────────────────────────────────┐
│ [← Leave]   ⚔ Duel room                      │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ⏱ 10 min per move                      │  │  rules strip — --bg-2, --accent-light
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │  players panel — .panel
│  │  ● You                     picking deck│  │
│  │  ────────────────────────────────────  │  │
│  │  ○ Waiting for an opponent…  ▮         │  │  ▮ = 3-dot pulse, --text-2
│  │     Waiting 2:14                       │  │  elapsed, --text-2, 0.8125rem
│  └────────────────────────────────────────┘  │
│                                              │
│  Send this link to your opponent             │
│  ┌────────────────────────────────────────┐  │
│  │ edisonduel.app/duel/join/7f3a…         │  │  mono, --bg-2, selectable
│  └────────────────────────────────────────┘  │
│  ┌──────────────────┐ ┌───────────────────┐  │
│  │  ↗ Share link    │ │   🔗 Copy         │  │  Share = .btn-primary
│  └──────────────────┘ └───────────────────┘  │
│  Link expires in 27 min          --text-1    │
│                                              │
│  ── Your deck ──────────────────────────────  │
│  ( ) Blackwings              40 cards        │
│  (•) Lightsworn              41 cards        │  selected row = --accent border
│  ( ) Gladiator Beasts        40 cards        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │      Ready — waiting for opponent      │  │  disabled until opponent arrives
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 3.3 Why each part, and the reasoning behind the recommendation

**Share is primary, Copy is secondary, and both persist.**
The creator's next physical act is switching to WhatsApp/Discord. `navigator.share()` does that in
one tap and lands them in their own share sheet with the link already attached — it removes the
app-switch-and-paste step entirely on the device where this flow actually happens. Copy is the
fallback for desktop and for browsers without the Share API (feature-detect; when `navigator.share`
is absent, Copy becomes the full-width primary and the Share button is not rendered — never a
button that does nothing). The **raw link stays on screen as selectable text** because on iOS the
clipboard write can be refused and long-press-to-copy is then the only route; today's code already
shows a copy-failed toast, and this gives that toast somewhere to point.

Re-copyable matters more than it sounds: the realistic failure is "I pasted it in the wrong chat"
or "the message didn't send". If sharing is a one-shot action that disappears, the creator's only
recovery is to create a second challenge — which leaves an orphan room and doubles the confusion.

**Proof of life: an elapsed counter, not a spinner.**
A bare spinner is ambiguous — after 40 seconds it reads as "hung". `Waiting 2:14`, ticking every
second next to a slow 3-dot pulse, is unambiguous: the number moving *is* the evidence the page is
connected and the client is running. It is also information the creator actually wants ("have I
been waiting long enough to nudge them?"). The pulse is CSS opacity animation, suppressed under
`prefers-reduced-motion` (the ticking counter survives and remains sufficient proof).

**Expiry: a plain sentence that escalates late.**
`Link expires in 27 min` in `--text-1`, minute resolution while > 5 min. It is a fact, not an alarm.
No progress bar, no colour, no countdown-per-second — a bar draining for half an hour turns a calm
wait into a hostage situation, and the creator can't make their friend arrive faster, so urgency is
cruelty. Escalation only when it becomes actionable:

| Remaining | Treatment |
|---|---|
| > 5 min | `Link expires in 27 min` · `--text-1` |
| ≤ 5 min | `Link expires in 4 min` · `--warning`, switches to `m:ss` |
| ≤ 60 s | `Link expires in 45s` · `--invalid` |
| 0 | Room switches to the expired state (see §9.1 creator variant) |

At ≤ 5 min the copy gains one useful clause: *"Link expires in 4 min — you can create a fresh one
after that."* That converts an alarm into an instruction.

**Yes, pick the deck while waiting — and it is the second most valuable thing on this screen.**
Three reasons, all user-outcome:
1. It turns dead time into progress, which is the difference between "waiting" and "getting ready".
2. It front-loads discovery of a blocking problem. A creator with **no saved decks** finds out now,
   with 27 minutes and an idle opponent-less room, instead of at the moment both players are
   present and one of them has to go build a deck. In that empty case the deck section reads
   *"No decks yet — build one while you wait"* with a `Build a deck` button, matching today's
   empty-state pattern in `CreateDuelScreen:238–248`.
3. When the opponent does arrive, the creator's remaining work is one tap on **Ready**. The moment
   of arrival should be the fastest part of the flow, not the start of a deck decision.

The **Ready** button is present but disabled while alone, labelled `Ready — waiting for opponent`.
A disabled button with a reason is better than a hidden one: it shows the creator the shape of what
is coming, so arrival doesn't reveal new controls.

**Leaving is explicit and honest.** The header's left action is `← Leave`, not `← Home`, because
leaving the room is a meaningful act here. Tapping it opens a small confirm using the existing
`.overlay-panel`: *"Leave this room? Your challenge link stops working and nothing is recorded."*
— `Leave` / `Stay`. (Whether the link truly dies on creator-leave is ZUH-23's call; the copy must
match whatever it decides — see §12.)

**Can we pull them back in? One free channel, and it is worth taking.**
There is no push and no notifications, and this design assumes none. But if the tab is still open,
two things cost nothing and are not a notification system:
- **`document.title` changes** to `(1) Opponent joined — Edison Duel` when the invitee arrives.
  This is the only signal that reaches a backgrounded tab, and it is the difference between the
  creator noticing in 5 seconds and noticing in 5 minutes.
- **A short one-shot sound** on arrival, only if the page has had a user gesture (it always has —
  they tapped Create). Add a small persistent mute toggle next to the waiting row rather than
  playing unannounced audio forever.

I recommend both as part of this state. Neither adds infrastructure and both directly attack "the
creator isn't looking when the opponent arrives". If the sound is contentious, ship the title change
alone — it is the higher-value half.

The screen also states the truth about walking away: under the link block, `--text-2`, 0.8125rem —
*"You can close this page; the link keeps working. Come back here to see when they join."*

---

## 4. S3 — The invitee's first three seconds

### 4.1 What must be true in three seconds

They tapped a link in a group chat. In order, they need: **who**, **what**, **what it costs**, and
**how to leave**. Anything else is noise. The layout is ordered exactly that way, and the first
screenful contains all four with no scrolling on a 360×640 viewport.

**Opening the link seats you in the room.** There is no separate accept-then-enter step. The room
*is* the acceptance surface: readying is the commitment, and until then leaving is free and
recorded nowhere. A dedicated "Accept" screen in front of the room would be a screen whose only
content is a question the room already answers, and it would make "can I look without committing?"
an unanswerable question. (Whether the seat is released immediately on leave is ZUH-23 — §12.)

### 4.2 Screen

```
┌──────────────────────────────────────────────┐
│ [← Leave]   ⚔ Duel room                      │
├──────────────────────────────────────────────┤
│                                              │
│   Kaiba challenged you to a duel             │  1.25rem / 700 — WHO, first line
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ⏱ 10 min per move                      │  │  WHAT — same strip as creator sees
│  │ Live duel — you both play now.         │  │  --text-1, 0.875rem
│  └────────────────────────────────────────┘  │
│                                              │
│  Pick a deck and hit Ready. You can leave    │  WHAT IT COSTS — --text-1
│  any time before that — nothing is           │
│  recorded and it doesn't count as a loss.    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ● Kaiba                  picking deck │  │
│  │  ────────────────────────────────────  │  │
│  │  ● You                    picking deck │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── Your deck ──────────────────────────────  │
│  ( ) Blackwings              40 cards        │
│  ( ) Six Samurai             40 cards        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │            Ready ✓                     │  │  disabled until a deck is picked
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 4.3 Decisions

- **The name is the headline.** "Kaiba challenged you to a duel" answers who and what in one line.
  Today's generic *"You've been challenged!"* leaves the recipient guessing which of five people in
  the group chat sent it — and if they guess wrong they may accept a duel they'd have declined.
  **This requires a product change** (see §4.4).
- **"Live duel — you both play now"** is load-bearing. Per-move timers used to include 24h and 48h
  options, and "10 min per move" alone does not tell a newcomer they are being asked to sit down
  right now. This is the single most important expectation to set before they ready.
- **Walking away is stated in words, not implied by a back button.** "Nothing is recorded and it
  doesn't count as a loss" removes the specific fear that makes people not tap links: that opening
  it has already committed them. The `← Leave` in the header is the mechanism; the sentence is the
  permission. For the invitee, Leave has **no confirm dialog** — they haven't invested anything and
  a confirm on the way out of something you never agreed to is a dark pattern.
- **No "Decline" button.** Declining and leaving are the same act with the same result, and a
  Decline button implies the challenger gets told — which, with no notifications, is a lie. Leave
  is honest about being a silent exit.
- **The deck list is the same component the creator sees.** One deck-picker pattern in the room, not
  two. Invitee with no decks gets the same `Build a deck` empty state — and this is the moment where
  the 30-minute expiry actually bites, so that empty state adds *"Your challenge expires in 24 min."*

### 4.4 Requirement: the creator's display name

`GET /api/duels/join/:joinToken` deliberately returns only `{ timerPerMoveSeconds, status }`
(`duelRoutes.ts:170–186`). Showing "who challenged me" therefore **requires a change**: the pre-join
response must also return the creator's `display_name`, and the room's state payload must carry both
players' display names. `display_name` is the only user-visible identity in the product
(`requireSession.ts:12,28,60`) and this design asks for nothing beyond it — no avatar, no record, no
rating, no "last seen".

**Fallback while the name has not loaded** (and if the endpoint change is not made):

- Headline renders **"You've been challenged to a duel"** — a complete, true sentence, not a
  truncated one waiting for a word.
- In player rows, an unknown opponent is **"Your opponent"** in `--text-1`. Never blank, never a
  skeleton bar inside a sentence, and never a fabricated placeholder like "Player 2" that could be
  mistaken for a real display name.
- The name swaps in without layout shift: the headline is a two-line-capacity block from first
  paint, so a late-arriving long name doesn't push the deck list down under the fold.
- The name is **never** the thing that gates the Ready button. If it never loads, the room still
  works.

---

## 5. S4–S6 — The two-player room: presence and readiness

### 5.1 The players panel is the room's status display

Two rows, always in the same order — **you on top, opponent below** — so the eye learns one
position for "my state" and one for "theirs". Each row: a state dot, a name, and a state label.
Colour is never the only signal; every state has a distinct glyph and words
(the app's existing rule — see the legality badge comment in `global.css:22`).

| State | Dot | Label | Colour |
|---|---|---|---|
| Slot empty | `○` hollow | `Waiting for an opponent…` | `--text-2` |
| In room, no deck yet | `●` | `Picking a deck` | `--text-1` |
| Deck chosen, not ready | `●` | `Deck chosen` | `--text-1` |
| Ready | `✓` in a filled `--accent` circle | `READY` | `--accent-light`, 700 |

**We show that a deck is chosen, never which deck.** A deck name is the archetype, and handing that
to the opponent before the duel is a competitive leak with no upside. Flagging this explicitly
because "show the opponent's deck" is a natural thing to build by accident.

**Presence is arrival, not liveness.** We show that someone entered the room and what they have
done. We do not show "online / typing / last seen", because we have no presence infrastructure and
a stale green dot is worse than no dot — it makes the player wait on someone who left. If ZUH-23
gives the room a heartbeat, the honest surfacing is the §7 "left the room" banner, not a liveness
indicator.

### 5.2 S4 — both present, neither ready

```
┌──────────────────────────────────────────────┐
│ [← Leave]   ⚔ Duel room                      │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ ⏱ 10 min per move · live               │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  ● You                     Deck chosen │  │
│  │  ────────────────────────────────────  │  │
│  │  ● Kaiba                  Picking deck │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── Your deck ──────────────────────────────  │
│  ( ) Blackwings              40 cards        │
│  (•) Lightsworn              41 cards        │
│  ( ) Gladiator Beasts        40 cards        │
│  You can change this until you hit Ready.    │  --text-2, 0.8125rem
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │              Ready ✓                   │  │  .btn-primary, full width, 44px
│  └────────────────────────────────────────┘  │
│  Both players must be ready to start.        │  --text-1, 0.875rem, centred
└──────────────────────────────────────────────┘
```

The link block is **gone** the moment the second player arrives — its job is done, and leaving a
share affordance on a full room invites a third person to open a link that will dead-end. For the
creator this is the visible reward for waiting: the panel that was a link becomes a person.

The creator's arrival transition (from S2 to S4) should be felt, since they may have glanced away:
the empty row swaps for the opponent row with a 220ms (`--duration-med`) fade, a one-shot toast
**"Kaiba joined the room"** using the existing success toast, and the `document.title` change from
§3.3. No confetti, no full-screen interstitial — the creator may be mid-scroll in the deck list and
a modal here would steal a tap.

### 5.3 The moment you ready — S5

Tapping **Ready** does three things at once, and all three are visible in the same frame:

1. **Your row flips.** Dot → filled `--accent` check, label → `READY` in `--accent-light` 700, row
   background → `--accent-dim`. One 220ms transition. This is the same "selected" visual grammar the
   deck rows and timer chips already use, so it reads as *committed* without new vocabulary.
2. **Your deck picker collapses into a locked summary row** — `🔒 Lightsworn · 41 cards`, `--bg-2`,
   no radio buttons. The lock is the answer to "can I still change it?" before the question forms.
3. **The button becomes `Unready`** (`.btn-ghost`, still 44px). Ready must be reversible until the
   duel actually starts: on a phone, an accidental tap on a full-width primary button is a real
   event, and an irreversible commitment with a 10-minute live clock behind it is a trap. It is
   reversible only until *both* are ready, at which point the flip fires immediately — so the window
   in which Unready is meaningless never visibly exists. (The simultaneous-tap race is ZUH-23 — §12.)

```
┌──────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐  │
│  │  ✓ You                          READY  │  │  --accent-dim bg, --accent border
│  │  ────────────────────────────────────  │  │
│  │  ● Kaiba                  Picking deck │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── Your deck ──────────────────────────────  │
│  🔒 Lightsworn · 41 cards                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │             Unready                    │  │  .btn-ghost
│  └────────────────────────────────────────┘  │
│                                              │
│      ▮  Waiting for Kaiba to ready up        │  aria-live status line
│         Waiting 0:18                         │  --text-2, 0.8125rem
└──────────────────────────────────────────────┘
```

**What the waiting player sees while the other has not readied.** The bottom of the room is a single
status line that is always the truth about what the room is waiting on: `Waiting for Kaiba to ready
up`, with the same pulse + elapsed counter from §3. Same reasoning: the elapsed number is the proof
the page is live, and it answers "should I nudge them in the chat?".

Deliberately **not** here: no "nudge" or "poke" button (there is no channel to deliver it — it would
be a button that does nothing), no countdown pressuring the other player, and no fake progress bar
for their deck choice.

### 5.4 S6 — they are ready, you are not

The mirror image, and the one place a little pressure is warranted, because now the room is waiting
on *you* and you are the only person who can move it:

- Their row shows the filled `READY` state — you can see you are the holdup without reading anything.
- The status line reads **`Kaiba is ready and waiting for you`**, in `--accent-light` rather than
  `--text-2`. Not `--warning`: nothing is wrong, it's just your turn to act.
- The Ready button gets the full-width primary emphasis it already has and stays the only primary
  action on screen.
- If you have not picked a deck, the button stays disabled and reads `Pick a deck first` — the label
  names the missing precondition rather than making you deduce it from a greyed-out control.

---

## 6. S7 — The coin flip

### 6.1 Recommendation: a short animated reveal, ~1.6 s, identical timing on both screens

**Animated, not instant.** Three reasons, in the order I weight them:

1. **The loser needs a beat.** With an instant result, the losing player's screen goes from
   "waiting for Kaiba to ready" straight to "Kaiba won the flip and is choosing for you" in a single
   frame. The outcome and its consequence land simultaneously and unannounced, which reads as *the
   app decided something about me while I wasn't looking* — exactly the feeling this whole feature is
   removing elsewhere. A 1.6s reveal separates "a flip is happening" from "here is the result", so
   the loser watches the thing happen rather than being told it already did.
2. **Shared witness.** The flip is server-rolled and unverifiable by design, so the only currency we
   have is that both players saw the same event at the same moment. Driving the animation from a
   server-supplied `flipAt` timestamp so both devices reveal within a frame of each other buys the
   result more credibility than any text could — and costs nothing.
3. **It hides the network anyway.** Something has to occupy the round trip between "both ready" and
   "seat choice". A purposeful 1.6s beat is a better use of that time than a spinner.

**Hard constraints on the animation:**

- **Cap at 1.6s total** (1.1s motion + 0.5s result hold). Long enough to be an event, short enough
  that a second viewing isn't a tax. This is a moment two friends may repeat several times an hour.
- **Never tap-to-flip.** A tap implies agency in an outcome the player does not control. That is a
  lie, and the kind that gets noticed on the third loss.
- **`prefers-reduced-motion`: crossfade straight to the result** with the same total duration and
  the same copy. The global stylesheet already forces animation durations to ~0 (`global.css:46–54`),
  so the implementation must not depend on an `animationend` event to advance — drive the sequence
  from timers, not from CSS callbacks. **This is the most likely way to ship a permanently stuck
  room.**
- Built from what exists: a coin is a `--bg-2` circle with an `--accent` border flipping on `rotateY`,
  reusing the `spin`-style keyframe vocabulary already in `global.css:275`. No image assets.

### 6.2 The sequence, both screens

```
  t=0.0s  ── the room dims to the .overlay-backdrop; both player rows
            remain visible at the top so nobody loses their bearings

┌──────────────────────────────────────────────┐
│  ✓ You  READY          ✓ Kaiba  READY        │
│                                              │
│                                              │
│                  ╭─────╮                     │
│                  │  ◐  │   flipping          │
│                  ╰─────╯                     │
│                                              │
│              Flipping a coin…                │  --text-1
│         The winner chooses who goes first.   │  --text-2, 0.875rem
│                                              │
└──────────────────────────────────────────────┘
                   ↓ t=1.1s
```

**Winner's screen at t = 1.1s:**

```
│                  ╭─────╮                     │
│                  │  ✓  │   --accent border,  │
│                  ╰─────╯   --accent-dim fill │
│                                              │
│              You won the flip                │  1.25rem / 700, --accent-light
│           You choose who goes first.         │  --text-1
```

**Loser's screen at t = 1.1s:**

```
│                  ╭─────╮                     │
│                  │  ●  │   --border, --bg-2  │
│                  ╰─────╯                     │
│                                              │
│             Kaiba won the flip               │  1.25rem / 700, --text-0
│         Kaiba chooses who goes first.        │  --text-1
│      You'll take whichever seat they don't.  │  --text-2, 0.875rem
```

### 6.3 Designing for the loser specifically

- **Plain statement, immediately.** "Kaiba won the flip." Not "So close!", not "Better luck next
  time", no sad emoji. Consolation copy on a coin flip reads as the app rubbing it in, and it
  implies the player did something wrong. They did not; it was a coin.
- **`--text-0`, not `--invalid`.** Losing a flip is not an error and must not use the error colour.
  The existing `DuelEndBanner` uses 💀 for a lost duel — that vocabulary is for results, not for a
  coin toss, and importing it here would badly overstate what just happened.
- **Tell them what happens to them next.** "You'll take whichever seat they don't" converts a
  passive wait into a known outcome with two possibilities. The loser's worst experience would be
  not knowing what is being decided on their behalf.
- **The result never disappears.** It stays as a small line above the waiting state in §7.2, so a
  player who looks away and back can still see why they are waiting.
- **Leave stays available throughout**, including during the animation — the header is not covered
  by the dim. Nobody should be trapped inside an animation.

---

## 7. S8 / S9 — The seat choice

No precedent for this interaction exists in the app, so it is built entirely from existing parts:
the two-large-cards layout is the deck-row pattern scaled up, and the copy carries the meaning.

### 7.1 S8 — the winner chooses

```
┌──────────────────────────────────────────────┐
│ [← Leave]   ⚔ Duel room                      │
├──────────────────────────────────────────────┤
│                                              │
│           ✓ You won the flip                 │  --accent-light
│                                              │
│           Choose your seat                   │  1.25rem / 700
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │  min-height 88px
│  │   ▶  Go first                          │  │  1.125rem / 600
│  │      You take turn 1.                  │  │  --text-1, 0.875rem
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │   ◀  Go second                         │  │
│  │      Kaiba takes turn 1.               │  │  --text-1, 0.875rem
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Both players draw on every turn,            │  --text-2, 0.8125rem
│  including turn 1.                           │
│                                              │
│  Kaiba is waiting on you.                    │  --text-2, 0.875rem
└──────────────────────────────────────────────┘
```

**Final copy strings:**

| Element | String |
|---|---|
| First card, title | `Go first` |
| First card, helper | `You take turn 1.` |
| Second card, title | `Go second` |
| Second card, helper | `Kaiba takes turn 1.` *(fallback: `Your opponent takes turn 1.`)* |
| Shared footnote | `Both players draw on every turn, including turn 1.` |

Decisions:

- **Two cards, not a segmented toggle plus a Confirm.** One tap, no confirmation step. The choice is
  a coin-flip-scale decision, both options are legitimate, and a Confirm step would add a tap to the
  screen where the *other* player is sitting idle. Mis-taps are protected against by size (88px
  targets, double the 44px minimum) and separation, not by a dialog.
- **Order is fixed: first on top.** Consistent position beats any cleverness; the winner should be
  able to tap without reading twice.
- **The card helpers say only who takes turn 1; the draw rule is a shared footnote, not a
  differentiator.** In Edison the first player *does* draw on turn 1 — `FIRST_TURN_DRAW = 0x200n` is
  set in `EDISON_FLAGS` (`packages/engine/src/edisonFlags.ts:17-18, 84-86`) and both players start on
  5 cards drawing 1 per turn (`packages/engine/src/createEdisonDuel.ts:35-36`), so going first means
  being on 6 cards on turn 1. The footnote exists to **correct a false belief the player probably
  arrives with**: every modern Yu-Gi-Oh format skips the first player's draw, so a duellist who
  learned the game after 2014 will assume going first costs them a card and may choose against it for
  a reason that does not apply here. Stating it once, below both cards, says the true thing without
  making it look like the tradeoff between the two options — because on the draw rule there is no
  tradeoff.
- **The helper copy asserts nothing else about going first or second.** No claim about the turn-1
  Battle Phase or any other asymmetry: only the draw rule has been verified against the engine, and
  an unverified rules hint on a one-tap, duel-long, irreversible choice is the worst place in the
  product to be wrong. If further first-turn rules are ever confirmed, they belong in Rules & Guides
  (`/learn`), not on this card — the winner is making a fast choice on a phone, not reading a primer.
- **Both cards use the neutral `--bg-1` / `--border` treatment, neither is `.btn-primary`.** Making
  one visually primary would imply a recommended play, which the app has no business doing.
- **`Kaiba is waiting on you`** is the only pressure applied. No timer on the choice. (A choice
  timeout, if one exists, is ZUH-23 — §12.)
- On tap, the chosen card immediately takes the `--accent` selected treatment and the other dims,
  then §8's handoff begins. The winner must see their own choice register before the screen changes.

### 7.2 S9 — the loser waits

```
┌──────────────────────────────────────────────┐
│ [← Leave]   ⚔ Duel room                      │
├──────────────────────────────────────────────┤
│                                              │
│         Kaiba won the flip                   │  --text-1, 0.875rem — persists
│                                              │
│   ▮  Kaiba is choosing who goes first        │  1.0625rem, aria-live
│                                              │
│      You'll find out in a moment. Either     │  --text-1, 0.875rem
│      way, the duel starts right after.       │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ✓ You  READY   🔒 Lightsworn          │  │  --bg-2 — still true, still visible
│  │  ✓ Kaiba READY                         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│      Waiting 0:06                            │  --text-2
└──────────────────────────────────────────────┘
```

- Same pulse + elapsed pattern as every other wait in the room. One waiting vocabulary throughout.
- **No fake progress bar** for someone else's decision. We do not know how long they will take, and
  a bar that fills at an invented rate is the "plausible-looking fake" this brief rules out.
- Their locked deck and ready state stay on screen so the wait is spent looking at something true.
- **The next screen must be unmissable**, because this player has been passive since they readied —
  which is exactly why §8's handoff exists.

---

## 8. S10 — Handoff into the board

**This is where the original bug is actually paid off.** The failure being fixed is a per-move clock
starting while the player is not looking. So the transition from room to board is not a silent
navigation; it is a screen that states whose clock is about to run, and for the player whose clock
it is, it counts down before it starts.

Both players see the same full-screen beat, in the room, before `/duel/:id` renders.

**The player who is on the clock first:**

```
┌──────────────────────────────────────────────┐
│                                              │
│                     ⚔                        │  2.5rem
│                                              │
│              You go first                    │  1.5rem / 700
│                                              │
│         Your 10 min clock starts in          │  --text-1
│                                              │
│                     3                        │  3rem, --accent-light, ticks 3→2→1
│                                              │
│              vs Kaiba · Lightsworn           │  --text-2, 0.875rem
│                                              │
└──────────────────────────────────────────────┘
```

**The other player:**

```
│              Kaiba goes first                │  1.5rem / 700
│                                              │
│      Their clock is running. You're up next. │  --text-1
│                                              │
│                     3                        │  same 3-2-1, same duration
```

Then the board mounts, with the existing `DuelTimer` chip already populated in the header — for the
on-clock player it renders in its `isMyTurn` state (`--accent-light`, bold, `Your clock: 9m 58s`)
from the very first frame, with a single 220ms `--accent-dim` flash on the chip to plant where the
clock lives. `DuelTimer` needs no changes.

Decisions:

- **3 seconds, counted down, for both.** Same duration on both screens so neither player starts
  behind. It is short enough not to annoy on the fifth duel and long enough that a player who
  glanced away sees a changing number when they look back.
- **No "Start" tap.** The winner tapped a seat 3 seconds ago and the loser has been watching an
  active screen since the flip — presence is already proven, and a tap gate would be one more thing
  between two ready players and their duel. The countdown is what replaces it, and it is enough
  because it *tells the on-clock player their clock is starting before it starts* — which is the
  entire requirement.
- **Both players' names and the seat outcome are on this screen**, so the first thing either player
  knows on the board is who they are playing and who moves.
- Under `prefers-reduced-motion` the countdown is still shown (it is information, not decoration) —
  only the scale/fade transitions are dropped.

---

## 9. Dead ends

House rules for all of them: use the existing centred `.panel` inside the standard duel header
layout; state plainly what happened and why; **always offer at least one real way onward**; never a
blank screen; never a fake retry that cannot succeed; never blame the user. Every one of these is a
full screen the router can land on cold — a deep link into a dead room must not first flash a
half-built room.

### 9.1 D1 — Link expired

```
┌──────────────────────────────────────────────┐
│ [← Home]   ⚔ Duel                            │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │              ⏳                         │  │  2rem
│  │  This challenge has expired            │  │  1.125rem / 600
│  │                                        │  │
│  │  Kaiba's challenge link was created    │  │  --text-1
│  │  more than 30 minutes ago. Challenge   │  │
│  │  links don't last longer than that.    │  │
│  │                                        │  │
│  │  Ask Kaiba for a new link — or start   │  │
│  │  your own duel and send them one.      │  │
│  │                                        │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │     Challenge someone ▸            │ │  │  .btn-primary → /duel/new
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │            Home                    │ │  │  .btn
│  │ └────────────────────────────────────┘ │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- The 30-minute rule is stated because otherwise the user's model is "the app is broken".
- "Ask Kaiba for a new link" is copy, not a button: we have no channel to send that request, so a
  button would be a fake. The chat thread they came from is the channel, and they already have it.
- `Challenge someone` turns a dead end into the flow's own entry point — the most useful onward
  action available.
- **Creator variant** (their own room hits 30 min while they wait alone): the room converts in place
  to *"Your challenge expired — nobody joined in 30 minutes"*, with `Create a new challenge`
  (primary, returns to S1 with the same timer preselected — they already made that decision) and
  `Home`. The dead link is removed from the screen so they cannot share something inert.

### 9.2 D2 — Room already full / duel already started

```
│              👥                             │
│  This duel already has two players          │
│                                             │
│  Someone else opened Kaiba's link first,    │  --text-1
│  or the duel has already started.           │
│                                             │
│  [ Challenge someone ▸ ]   [ Home ]         │
```

Both plausible causes are named, because with a link in a group chat "someone beat me to it" is a
real and common outcome and the user deserves to know it was a race, not a fault. This replaces
today's inline `join-already-started` error (`JoinDuelScreen.tsx:135–143`), which sits above a deck
picker and a disabled button — a screenful of controls that cannot do anything.

### 9.3 D3 — Your own link

Not an error. The creator tapping their own link (to check it, or from the chat where they pasted
it) is **routed straight into their own room** at whatever state it is in — S2 if still alone, S4 if
the opponent has arrived. Nothing is said about it; the correct outcome is that the link "just
works" from either device.

Only if the room is gone do they get a dead end, and it is worded from their side:
*"Your challenge expired — nobody joined in 30 minutes"*, with `Create a new challenge` and `Home`.

### 9.4 D4 — The other player left / room abandoned

Not a screen wipe. The room is still a place, and the player who stayed did not do anything wrong,
so the room stays and a banner explains the change — the same in-flow banner treatment as
`DuelScreen`'s error strip, but in `--warning`, not `--invalid`:

**If the invitee leaves and the creator stays:**

```
│  ┌────────────────────────────────────────┐  │
│  │ ⚠ Kaiba left the room.                 │  │  --warning strip, aria-live
│  └────────────────────────────────────────┘  │
```

...and the room reverts to S2: opponent row back to `Waiting for an opponent…`, the share block
returns with the original link, the elapsed counter resets, the expiry countdown continues from
where it was. If the creator had readied, they are silently un-readied and told so in the banner
(*"You've been un-readied."*) — being left readied and unable to act would be a trap. Whether the
link is reusable after this is ZUH-23's call, and the banner copy must match it (§12).

**If the creator leaves and the invitee stays:**

```
│              🚪                             │
│  Kaiba left the room                        │
│                                             │
│  The challenge is over. Nothing was         │  --text-1
│  recorded — no duel, no loss.               │
│                                             │
│  [ Challenge Kaiba back ▸ ]   [ Home ]      │
```

`Challenge Kaiba back` goes to S1 (it cannot pre-address the challenge to anyone — there is no
friends list — so it is exactly the create flow, and the label must not over-promise; if the
implementation can't carry the name through, it reads `Challenge someone ▸`). The reassurance that
nothing was recorded is the same promise made at arrival, kept.

### 9.5 D5 — The recipient has no account  *(the likeliest dead end in real life)*

This is the case that most needs designing, and it currently doesn't exist: a logged-out visitor is
bounced by `RequireAuth` to `/login`, which shows a sign-in form and the line *"First time? Open
your invite link to set up."* — advice that is useless to someone whose only link is the one they
just opened.

**Requirement: the join route must render a public landing.** `/duel/join/:token` needs to be
reachable while logged out, and the pre-join lookup callable unauthenticated, so this screen can
exist at all. We cannot tell a logged-out member from a logged-out non-member, so one screen serves
both and forks by action.

```
┌──────────────────────────────────────────────┐
│                                              │
│                    ⟡                         │  wordmark block, exactly as LoginScreen
│              EDISON DUEL                     │
│           a private duel club                │
│                                              │
│  ┌────────────────────────────────────────┐  │  .panel
│  │  Kaiba challenged you to a duel        │  │  1.125rem / 600
│  │                                        │  │
│  │  ⏱ 10 min per move · live duel         │  │  --bg-2 strip, --accent-light
│  │                                        │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │        Sign in to join ›           │ │  │  .btn-primary → /login (resume set)
│  │ └────────────────────────────────────┘ │  │
│  │                                        │  │
│  │  ──────────────────────────────────    │  │
│  │                                        │  │
│  │  No account?                           │  │  0.9375rem / 600
│  │  Edison Duel is invite-only while      │  │  --text-1, 0.875rem
│  │  it's in beta. A duel link isn't a     │  │
│  │  sign-up link — you need a separate    │  │
│  │  invite from a member.                 │  │
│  │                                        │  │
│  │  Reply to Kaiba and ask for one.       │  │
│  │  This duel link expires in 30 minutes, │  │
│  │  so they'll probably need to send a    │  │
│  │  fresh one after you're set up.        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Decisions:

- **The bad news is not behind a tap.** No accordion, no "learn more". The non-member is the likely
  visitor; making them tap to discover they can't proceed is a small cruelty and adds a step for the
  majority case. Both paths are visible at once; the member's path is the primary button and takes
  one tap regardless.
- **It explains the mechanism, not just the refusal.** "A duel link isn't a sign-up link" is the
  sentence that stops them trying the same link again, or typing a name and password into the
  sign-in form and concluding the app is broken. Naming the beta also reframes the rejection from
  "you failed" to "this isn't open yet" — the difference between a bad taste and a shrug.
- **The onward action is a real one.** They came from a chat thread with the person who has the
  power to get them an invite. "Reply to Kaiba and ask for one" is achievable in two taps outside
  our app. We deliberately do not offer a "Request access" button: invites are admin-generated
  (`HomeScreen.tsx:149–160`) and there is no request pipeline, so that button would be a fake.
- **We warn about the expiry now**, so their second interaction isn't D1 with no explanation.
- Name falls back to "You've been challenged to a duel" / "the person who sent you this link" per
  §4.4. On this screen the fallback matters more than anywhere else, because a stranger's first
  impression of the product is this panel.
- **Wording is a product call — flagged, not decided.** Whether to say "closed beta, invite-only"
  outright or something vaguer ("you need an account on Edison Duel") is a positioning decision about
  how public the club wants to be, not a design one. I have designed the explicit version because it
  is honest and it is the one that stops repeat attempts; the vaguer version drops into the same
  layout with no structural change. Also worth a product decision: whether the *creator's display
  name* should be shown to an unauthenticated visitor at all — it is a small identity disclosure to
  anyone holding the link, and the screen works (less well) without it.

### 9.6 D5b — Logged-out member, sign in and resume

`RequireAuth` already captures the intended path and login resumes to it (`App.tsx:24–27`), so this
path works. Two small additions make it feel deliberate rather than incidental:

1. **Context on the login form.** When `from` starts with `/duel/join`, `LoginScreen` shows a line
   above the form: *"Sign in to join Kaiba's duel"* (`--text-1`, 0.875rem). Without it, a user who
   tapped a duel link is looking at a generic sign-in and has lost the thread of what they were
   doing. It also reassures them that signing in will take them back, so they don't hunt for the
   original message afterwards.
2. **A landing acknowledgement.** They arrive in the room having burned 20–40 seconds. The room
   greets them with the standard arrival frame (§4.2) plus one success toast: *"You're in the
   room."* The expiry line is already visible and already correct, so the time they spent is
   accounted for without being pointed at.

Nothing else changes. Against a 30-minute expiry, a 40-second login is not a problem worth designing
around — the only real risk would be a member who signs in near the expiry boundary, and that
resolves into D1 with an accurate explanation.

---

## 10. Shared conventions across all room screens

These exist so the room reads as one place rather than a sequence of pages.

1. **One header, never replaced.** `[← Leave] ⚔ Duel room`, matching the existing duel header
   (`--bg-1`, 1px `--border` bottom, 16px/24px padding, 44px button). It stays put through every
   state including the coin flip. The player is never trapped.
2. **The rules strip is permanent.** `⏱ 10 min per move · live` sits directly under the header from
   arrival until the board. The rules are the one thing the invitee did not choose, so they should
   never have to remember them.
3. **One waiting vocabulary.** Every wait in the room is: a 3-dot pulse, a sentence naming exactly
   who or what we are waiting on, and an elapsed `m:ss`. Used in S2, S5, S7, S9. A player learns it
   once.
4. **One status line.** The bottom of the room always says what the room is waiting on, and it is
   the `aria-live` region. Never two competing status messages.
5. **State changes animate at `--duration-med` (220ms)** and never move the layout underneath the
   player's thumb. Rows change appearance in place; they do not reorder.
6. **No screen is ever blank.** Every load state has words. The room's own initial load uses the
   existing `.loading-spinner` centred, with `Opening the room…` beneath it — a spinner alone is the
   thing this document is trying to eliminate.
7. **Nothing about the opponent beyond `display_name` and their room state.** No deck names, no
   record, no "last seen".

---

## 11. Accessibility

- **`aria-live="polite"` on the single status line.** Every meaningful change is announced through
  it: *"Kaiba joined the room"*, *"Kaiba is ready"*, *"Kaiba won the flip"*, *"Kaiba chose to go
  first. Your clock starts in 3 seconds."* These are the events that happen without the user acting,
  so without this a screen-reader user simply does not learn them.
- **Ready state is never colour-only.** Every row carries a glyph (`○` / `●` / `✓`) and a word
  (`Picking a deck` / `Deck chosen` / `READY`). This follows the rule already stated for legality
  badges (`global.css:22`).
- **`prefers-reduced-motion`:** the coin flip crossfades, the pulses become static dots, the handoff
  countdown still displays its numbers. Critically, **no state transition may depend on an animation
  completing** — the global stylesheet zeroes animation durations, so a sequence driven by
  `animationend` will hang for exactly the users who most need it not to.
- **Touch targets:** every interactive element ≥ 44px; the two seat-choice cards are ≥ 88px because
  a mis-tap there has consequences that last the whole duel.
- **Focus:** when the room changes phase (ready → flip → seat choice → handoff), focus moves to the
  new phase's heading so keyboard and screen-reader users are not left focused on a control that no
  longer exists.
- **Long display names** truncate with ellipsis at one line in player rows but wrap fully in
  headlines; the layout must not break on a 40-character name.

---

## 12. Open questions — owned by ZUH-23, named here, not answered

Each of these is a state-machine question that a screen above depends on. The design works either
way; the **copy** must match whichever answer ZUH-23 gives.

1. **Does opening the link seat you immediately?** §4 designs implicit seating (open = you're in the
   room, leaving is free). If ZUH-23 requires an explicit accept, an extra confirm step is needed.
2. **Does leaving release the seat and revive the link?** §9.4's creator-side banner says the room
   reverts to waiting with the same link. If the link dies on any leave, that banner and S2's Leave
   confirm both need different copy.
3. **Is Ready reversible, and what happens on a simultaneous double-ready?** §5.3 offers `Unready`
   until both are ready. The race between "I tap Unready" and "they tap Ready" needs an owner.
4. **Is there a timeout on the seat choice** if the flip winner goes silent? §7.1 shows no timer. If
   one exists, the loser's waiting screen (§7.2) needs to say so.
5. **What happens when a player's connection to the room drops** (as distinct from leaving)? §5.1
   deliberately shows arrival rather than liveness to avoid guessing. If ZUH-23 defines a
   disconnect-vs-left distinction, the players panel needs a third row state and I should design it.
6. **Does the 30-minute expiry keep running after both players are in the room?** §3.3's countdown
   is designed for the waiting-alone state; the full room shows no expiry, which assumes the clock
   stops or is irrelevant once both have arrived.

---

## 13. Changes this design requires outside the web UI

Listed so nothing here reads as free.

1. **`GET /api/duels/join/:joinToken` must return the creator's `display_name`**, in addition to
   today's `{ timerPerMoveSeconds, status }` (`duelRoutes.ts:170–186`). Everything in §4 and §9
   that names the challenger depends on this; §4.4 specifies the fallback if it is not done.
2. **The join route must be reachable while logged out**, and the pre-join lookup callable
   unauthenticated, so §9.5 can exist. Today `RequireAuth` bounces the visitor to `/login` before
   any of this can render.
3. **The room state must include both players' `display_name`, deck-chosen boolean, and ready
   boolean** — deck *names* must not be sent to the opponent (§5.1).
4. **The coin flip result should carry a server timestamp** so both clients reveal in sync (§6.1).

### 13.1 Resolved: the first-turn draw rule behind the seat-choice copy

This was an open copy question in an earlier draft; it is now settled against the engine and needs no
further verification before build.

- `FIRST_TURN_DRAW = 0x200n` — *"First player draws on turn 1 (abolished in MR2)"* — is included in
  `EDISON_FLAGS`: `packages/engine/src/edisonFlags.ts:17-18` and `:84-86`.
- Both players start on 5 cards and draw 1 per turn: `packages/engine/src/createEdisonDuel.ts:35-36`
  (`startingDrawCount: 5`, `drawCountPerTurn: 1`).

So **the player going first draws on turn 1** and is on 6 cards — the pre-2014 MR1 behaviour Edison
reproduces. There is no first-turn draw penalty in this format. §7.1's shared footnote
(`Both players draw on every turn, including turn 1.`) is grounded in exactly these lines and says
nothing beyond them; no other going-first tradeoff is claimed anywhere in the seat-choice copy.
