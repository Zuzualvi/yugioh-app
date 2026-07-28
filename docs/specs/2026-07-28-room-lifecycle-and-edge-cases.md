---
linear_project: Duel Invite Improvements
---

# Pre-duel room — lifecycle, state machine and edge cases

**Issue:** ZUH-23 (discovery, type: edge_cases) · **Project:** Duel Invite Improvements · **Product:** Yu-Gi-Oh App
**Author:** Product Owner · **Code read at:** `/workspace/yugioh-app` @ current master

Every claim about *current* behaviour carries a `file:line` citation. Statements about *proposed*
behaviour are written as testable MUST/SHOULD. Section 9 lists what I could not decide — those are
CEO calls, not gaps in this document.

**Out of scope (do not read requirements into this doc for):** anything after the engine starts;
mid-duel disconnect / reconnect-grace / clock-pause (ZUH-21); the lost-seat-token→mock-duel bug
(ZUH-21) — but see §10.1, where I flag the one place this state machine would re-create that bug
class; pending-invites list and creator-cancel (ZUH-22); async duels; Bo3 / side decking / rematch.

---

## 0. The two-sentence version

The room is a **durable database row with two occupant slots keyed by `user_id`**, no seats, no seat
tokens and no engine; occupants are authenticated by the **existing `sid` session cookie**, and see
each other through a **read-only room WebSocket** that broadcasts a full room snapshot on every
change. Seats, seat tokens and the engine all come into existence at exactly **one** transition —
the flip winner submitting first-or-second — and nothing before that moment is seat-shaped.

---

## 1. Answered first: what identifies and authenticates a room occupant before seats exist

### 1.1 The problem, stated against the current code

Every realtime path today is seat-token-based. The socket URL is
`GET /api/duels/:id/ws?token=<seatToken>` (`packages/server/src/duel/duelSocket.ts:5`), the handler
resolves the token to a seat by string comparison against the row
(`duelSocket.ts:270-278`), and the relay keys its two connection slots by `Seat` 0/1
(`duelSocket.ts:26-53`). Both seat tokens are minted inside `POST /api/duels`
(`duelRoutes.ts:77-78`, persisted at `duelStore.ts:53-69`) — precisely what this feature defers to
after the coin flip. The socket also *refuses* any duel that has not started
(`duelSocket.ts:263-268`), so the existing socket cannot serve a room even in principle.

There is therefore no credential in the system that identifies a pre-seat occupant. One must be
chosen, and every refresh/reconnect behaviour hangs off the choice.

### 1.2 Recommendation: the session cookie is the room credential. Do not mint a room token.

**REQ-ID-01 (MUST).** A room occupant MUST be identified by the `user_id` resolved from the existing
`sid` session cookie, and by nothing else. The room row MUST store occupancy as two nullable user-id
columns (`creator_user_id`, `opponent_user_id`). No room-scoped bearer token is minted at any point
before seat assignment.

**REQ-ID-02 (MUST).** Every room HTTP endpoint MUST sit behind the existing `requireSession`
middleware, and MUST additionally authorize that `req.user.id` is one of the room's two occupants
before returning or mutating anything.

**REQ-ID-03 (MUST).** The room WebSocket MUST authenticate from the `sid` cookie on the handshake —
**no token in the URL** — and MUST close the connection if the resolved user is not an occupant of
that room.

Why the cookie and not a new token:

1. **It is already the identity this feature's logic uses.** `self_join` compares `seat0_user_id`
   to `req.user.id` (`duelRoutes.ts:124`), deck ownership compares `row.owner_id` to `userId`
   (`duelRoutes.ts:35`), and the duel router is already mounted behind `requireSession`
   (`app.ts:50`). Introducing a second identity for the same two people, for the same ten minutes,
   is a second thing to get wrong.
2. **It survives refresh and tab close; a token in router state does not.** The join link's seat
   token reaches the board today only through `navigate(..., { state: { seatToken } })`
   (`CreateDuelScreen.tsx:100-103`, `JoinDuelScreen.tsx:67-70`) and is read back from
   `location.state` (`DuelScreen.tsx:48-49`). A refresh destroys it. A room whose credential lived
   there would be unrecoverable by refresh — which is the single most common thing a user will do.
3. **The deployment already supports it, including on the socket.** The cookie is
   `httpOnly, sameSite: "lax", secure: isProd, path: "/"` (`routes/auth.ts:26-35`) with a 30-day TTL
   (`auth.ts:17`). Production is `app.<domain>` + `api.<domain>` — same-site, cross-origin — so a
   `SameSite=Lax` cookie *is* attached to `app.`→`api.` requests, including the WebSocket handshake
   (`docs/specs/2026-07-13-spec-21-deploy-split-rework.md:9-10, 70-73`). No cookie-attribute change
   is required.
4. **It is not a new secret to leak.** The current design puts a long-lived credential in a URL
   query string (`duelSocket.ts:5`), which lands in proxy logs and history. Cookie auth removes that
   for the room; the seat token remains in the URL only for the post-start board socket, which is
   ZUH-21's territory, not mine.

**REQ-ID-04 (MUST) — new obligation created by the cookie choice.** The room WebSocket handshake
MUST reject any connection whose `Origin` header is not in `CORS_ALLOWED_ORIGINS`. The `ws` server
is attached to the raw HTTP server and never passes through the CORS middleware
(`duelSocket.ts:363-378`; `app.ts:27`), and browsers do not apply CORS to WebSocket handshakes.
Today that is harmless because the socket is bearer-authenticated. The moment the socket is
*ambient*-authenticated by a cookie, any web page can open it on a logged-in victim's behalf
(cross-site WebSocket hijacking). This is cheap to add and MUST land in the same change as REQ-ID-03.

### 1.3 How presence, deck-picked and ready reach the other player

**REQ-ID-05 (MUST).** Room *mutations* MUST be HTTP `POST`s (pick deck, ready, un-ready, choose
first/second, leave). Room *state* MUST reach clients over the room WebSocket as a **single
`ROOM_STATE` frame carrying the complete room snapshot**, re-sent in full on every change and on
every (re)connect. The socket MUST be read-only server→client.

Rationale: the snapshot is under a kilobyte, so deltas buy nothing and cost ordering bugs; first
connect and reconnect become the same code path (this is what makes every refresh row in §7
trivial); and mutations over HTTP get status codes, validation error bodies and natural idempotency
that a fire-and-forget socket frame does not. Contrast the current board socket, where the client
must reconstruct meaning from a `SEAT_ASSIGNED`/`STATE`/`CLOCK`/`DECISION` sequence
(`duelSocket.ts:311-349`).

**REQ-ID-06 (MUST).** Connections MUST NOT be treated as occupants. A room MUST accept **any number
of concurrent sockets per occupant** (two tabs, phone + laptop) and broadcast the same snapshot to
all of them. The "seat already occupied" guard (`duelSocket.ts:292-300`) MUST NOT be copied into the
room: a refresh can open the new socket before the old one's close event fires, and a
one-socket-per-identity rule would lock a user out of their own room.

**REQ-ID-07 (SHOULD).** If the socket is unavailable, the client SHOULD poll
`GET /api/duels/:id/room` (the same snapshot) every 3 s. The room must remain fully operable with no
socket at all, because every mutation is HTTP.

**REQ-ID-08 (MUST).** Presence MUST be modelled as a per-occupant **attribute** with three values —
`connected` / `away` / `left` — never as a room state. An occupant is `away` after **10 s** with no
open socket (the web client's reconnect backoff starts at 1 s, `web/src/api/duelSocket.ts:79-89`, so
an ordinary refresh must never flicker to `away`). **Presence MUST NOT close a room, expire a room,
or affect any deadline.** Only an explicit Leave and the room deadline close a room. This one rule
is what makes "creator shares the link and puts their phone down" work at all, and it is derived
directly from the feature's purpose.

### 1.4 What happens to this identity at seat assignment

**REQ-ID-09 (MUST).** At the seat-assignment transition (§4, T6) the server MUST write
`seat0_user_id` / `seat1_user_id` from the two occupant user-ids, mint both seat tokens, and
persist all of it **before** any client is told the duel is starting. The occupant→seat mapping
becomes a durable fact, not a client-held one.

**REQ-ID-10 (MUST).** Each player's seat token MUST be retrievable by that authenticated user from
the server — e.g. `GET /api/duels/:id/seat` returning `{ seat, seatToken }` for the calling user,
authorized against `seat0_user_id`/`seat1_user_id`. The room MUST NOT hand the seat token to the
board **only** via router state. See §10.1 for why this is load-bearing and how it relates to
ZUH-21.

---

## 2. What the room holds, and where, before decks are locked

Constraint: the engine cannot be constructed until both decks are locked
(`duelManager.createAndStart(duelId, seed, deck0, deck1)`, `duelManager.ts:61-72`). So for the whole
pre-flip life of the room, there is no engine and nothing seat-shaped.

**In SQLite (durable, authoritative):**

| Held | Notes |
| --- | --- |
| `creator_user_id`, `opponent_user_id` (nullable) | occupancy; the *only* identity in the room |
| `join_token`, `join_token_consumed_at` | link; already `UNIQUE` (`migrate.ts:60`) |
| `timer_per_move_seconds` | already exists (`migrate.ts:69`) |
| `creator_deck_id`, `opponent_deck_id` (nullable) | a *reference* while unlocked — see REQ-DECK-R01 |
| `creator_deck_json`, `opponent_deck_json` (nullable) | the *snapshot*, written only at ready |
| `creator_ready_at`, `opponent_ready_at` (nullable) | ready is a timestamp, not a boolean |
| `room_deadline_at` | one field, three writes — §3.2 |
| `flip_winner_user_id`, `flip_rolled_at` | **by user id, not by seat** — seats do not exist yet |
| `flip_choice` (`first`\|`second`), `flip_choice_at` | |
| `status`, `closed_reason`, `closed_by_user_id` | §4 |
| `seed_json` | already rolled at create (`duelRoutes.ts:80-82`); shuffle seed, unrelated to the flip |

**In memory (disposable, reconstructible):** the set of open sockets per room, and at most one armed
`setTimeout` per room for `room_deadline_at` (reuse `scheduleTimeout`, `timer.ts:22-28`). Nothing
else. Both are rebuilt from the row on the next connect.

**Held nowhere, at any point before the flip choice:** `seat0_user_id`, `seat1_user_id`,
`seat0_token`, `seat1_token`, `deck0_json`, `deck1_json`, `deadline_at`, `on_clock_seat`, and the
engine instance. All NULL / absent.

**REQ-ROOM-R01 (MUST).** The complete room state MUST be reconstructible from the duel row alone. A
server restart or redeploy MUST NOT lose a room, and MUST NOT change any outcome — it drops every
socket and every armed timeout, both of which are re-established on reconnect and backstopped by the
lazy deadline check (§3.1).

**REQ-ROOM-R02 (MUST).** The room and the duel MUST share **one id** for their whole life, so the
room URL and the board URL address the same object and the room never has to hand off an id.

> **Engineering consequence (CTO, not a product decision):** the existing `duel` table declares
> `seat0_token`, `seat1_token`, `seat0_user_id` and `deck0_json` as `NOT NULL`
> (`migrate.ts:61-63, 67`). Every one of those must be nullable for a room to exist as a duel row.
> SQLite cannot drop `NOT NULL` in place — migration 3 will be a table rebuild, or the room becomes
> a separate table joined 1:1 on id. Product is indifferent to which, provided REQ-ROOM-R02 holds.

---

## 3. Expiry: lazy, not swept — and one deadline field

### 3.1 Mechanism

**REQ-EXP-01 (MUST).** Expiry MUST be evaluated **lazily at every read and every mutation**, and the
terminal transition MUST be written back to the row on first observation (lazy-with-writeback).
There MUST NOT be a scheduled sweeper.

Grounding: the server process starts an HTTP server and a WS server and nothing else — there is no
scheduler, no cron, no interval anywhere in the server package (`index.ts:28-47`; the only timers in
the codebase are the per-duel `setTimeout`s armed inside the relay, `duelSocket.ts:152`). The
codebase already solves this exact problem lazily, twice, and it works: invite codes
(`routes/auth.ts:82`) and sessions, which are lazily expired *and deleted* on read
(`requireSession.ts:53-56`). The duel clock uses belt-and-braces — an armed timeout
(`duelSocket.ts:152`) plus a lazy check on the next inbound message (`duelSocket.ts:218`) and on
reconnect (`duelSocket.ts:328-338`). The room should copy that shape exactly.

**REQ-EXP-02 (MUST).** While a room has at least one connected socket, the server MUST additionally
arm one in-memory `setTimeout` at `room_deadline_at` that performs the close and broadcasts it, so a
player watching a countdown sees the room close at zero rather than at their next click. If nobody
is connected, no timer is armed and the lazy check on the next read is sufficient — nobody needs to
be told. The lazy check is always the authority; the armed timer is only a delivery optimisation and
MUST be re-armed on every (re)connect.

**REQ-EXP-03 (MUST).** `room_deadline_at` MUST be a stored absolute epoch-ms column, not a constant
recomputed from `created_at` in each code path. There is no expiry column on the duel row today
(`migrate.ts:58-76`) and the 30 minutes must be data, not a literal duplicated across the lookup
handler, the claim handler and the ready handler.

**REQ-EXP-04 (MUST).** All countdowns MUST be rendered from the server-supplied absolute
`room_deadline_at`. A skewed client clock MUST NOT change any outcome (same principle the duel clock
already follows, `duelSocket.ts:121`).

### 3.2 One deadline, three writes

`room_deadline_at` means exactly one thing: *when this room closes if nothing else happens.* It is
written three times and never otherwise:

| Written at | Value | `closed_reason` if it fires |
| --- | --- | --- |
| Link mint | `created_at + 30 min` (decided) | `expired_unclaimed` if status `open`; `expired_idle` if `filled` |
| **First** ready (either occupant) | `now + 10 min` | `expired_ready` |
| Flip resolution | `now + 120 s` | `expired_choice` |

It is **not** extended by deck picks, deck changes, un-ready, chat, reconnects, or the second
player's arrival. Rationale for the first-ready rebase and for the two values is derived in §5.

### 3.3 What status an expired room lands in, and what the two current gatekeepers return

**REQ-EXP-05 (MUST).** An expired room MUST land in the single terminal status `closed`, carrying a
`closed_reason`. There MUST NOT be a distinct `expired` status. Reason: every consumer needs the
*reason* to render a specific message (REQ-LOBBY-04's edge already demands a specific failure, not a
generic one — `docs/specs/2026-07-13-v1-requirements.md:118`), and a status enum that also encodes
reason grows without bound. One terminal status keeps "is this link usable?" a single comparison.

**`GET /api/duels/join/:joinToken` — the pre-join lookup (`duelRoutes.ts:170-184`).** Today it
returns `404` for an unknown token (`:176-179`) and otherwise `200 { timerPerMoveSeconds, status }`
for *any* row, including ended ones (`:180-183`); the client derives one boolean from it
(`JoinDuelScreen.tsx:54`) and renders one message for started-or-ended alike (`:135-143`).

- **REQ-LINK-01 (MUST).** It MUST evaluate expiry and write back before responding.
- **REQ-LINK-02 (MUST).** It MUST return `200 { timerPerMoveSeconds, usable: boolean, reason }` with
  `reason ∈ { ok, expired, claimed_by_other, closed, started, you_are_the_creator,
  you_are_an_occupant }`, and MUST keep `200` for all known tokens so the client can still show the
  timer alongside a specific message. `404` remains only for an unknown token.
- **REQ-LINK-03 (MUST).** It MUST NOT return the raw room status. `PreJoinDuelInfoSchema`
  (`packages/contracts/src/duel.ts:56-60`) currently exposes `status` verbatim; adding room statuses
  to `DuelStatusSchema` (`duel.ts:50`) would leak room internals to any link holder and would be a
  contracts change requiring a spec update per `AGENTS.md`. Return a purpose-built shape instead.

**`POST /api/duels/join` — the claim (`duelRoutes.ts:105-168`).** Today `already_joined`
(`:120-123`) conflates *someone else claimed it*, *the duel already started* and *the duel ended*
into one message, and the handler both consumes the link and starts the engine (`:145-161`).

- **REQ-LINK-04 (MUST).** Claim MUST no longer accept a `deckId` and MUST NOT start the engine. It
  claims the open occupant slot and returns the room.
- **REQ-LINK-05 (MUST).** It MUST evaluate expiry **before** the status check, and MUST return
  distinct codes: `invalid_token` (unknown), `expired`, `already_claimed`, `room_closed`,
  `already_started`.
- **REQ-LINK-06 (MUST).** A claim by a user who is **already an occupant** (the creator, or the
  opponent re-opening the link from chat history) MUST NOT be an error. It MUST return the room and
  route them into it. The current `self_join` rejection (`duelRoutes.ts:124-127`) is correct for
  today's model — the creator would otherwise occupy both seats — but under the room model the right
  answer is *land them in their own room*, which is what REQ-LOBBY-04's edge already asks for
  (`v1-requirements.md:118`).
- **REQ-LINK-07 (MUST).** The claim MUST be a single guarded write —
  `UPDATE ... SET opponent_user_id=?, status='filled' WHERE id=? AND status='open' AND opponent_user_id IS NULL`
  — with `changes === 1` deciding the winner. See §10.2: the current read-then-write is safe only by
  accident.

---

## 4. The state machine

### 4.1 States

Five states. Presence, deck-picked and ready are **attributes**, not states — modelling them as
states multiplies the machine by 12 and buys nothing.

| # | Status | Meaning | Occupants | Deadline in force |
| --- | --- | --- | --- | --- |
| S1 | `open` | Link minted and unclaimed. Creator is the only occupant (connected or not). | creator | mint + 30 min |
| S2 | `filled` | Link consumed; both occupants known. Each may or may not have picked a deck; each may or may not be ready. | creator + opponent | mint + 30 min, **rebased to first-ready + 10 min** on the first ready |
| S3 | `awaiting_choice` | Coin flip rolled **and persisted**; waiting for the flip winner to choose first or second. Both decks are locked. | creator + opponent | flip + 120 s |
| S4 | `starting` | Choice made; seats assigned, seat tokens minted, decks written to `deck0_json`/`deck1_json`; engine construction in flight. **Point of no return.** | seat 0 + seat 1 | none |
| S5 | `closed` | Terminal. No duel recorded, no result, no loss for anyone. Carries `closed_reason` + `closed_by_user_id`. | — | — |

`active` is the existing duel status (`duelStore.ts:9`) and is the exit, not a room state. Everything
at or after `active` is out of scope.

`closed_reason ∈ { left, expired_unclaimed, expired_idle, expired_ready, expired_choice,
engine_failed }` (leave `revoked` reserved for ZUH-22).

> **Wire-value note.** `open` is the concept; the existing literal is `waiting_for_opponent`
> (`duelStore.ts:9`, `migrate.ts:72`, `contracts/src/duel.ts:50`). Keeping the literal avoids
> migrating existing rows. Whichever is chosen, `filled`, `awaiting_choice`, `starting` and `closed`
> are new literals in a locked contract enum and therefore need a spec update (`AGENTS.md`,
> "External output contracts are pinned in specs").

### 4.2 Invariants (each is a test)

- **I1.** `status ∈ {open, filled, awaiting_choice}` ⟹ `seat0_user_id`, `seat1_user_id`,
  `seat0_token`, `seat1_token`, `deck0_json`, `deck1_json`, `deadline_at`, `on_clock_seat` are all
  NULL, and no engine exists for this id.
- **I2.** `flip_winner_user_id` is only ever a **user id**, never a seat. Seats do not exist when it
  is written.
- **I3.** Once `X_ready_at` is non-NULL, `X_deck_json` is non-NULL and immutable.
- **I4.** The flip is rolled **exactly once** per room and is never re-rolled — on reconnect, on
  refresh, or on restart. (Directly satisfies REQ-ROOM-04's edge, `v1-requirements.md:133`.)
- **I5.** `status = closed` ⟹ no `response_log` row, no `winner`, no `end_reason`, and the room can
  never leave `closed`.
- **I6.** Reaching `active` requires passing through S4, which requires a persisted `flip_choice`,
  which requires two `*_ready_at`, which requires two `*_deck_json`. There is no other path to an
  engine.

### 4.3 Transitions — exact preconditions

| T | From → To | Trigger | Preconditions (ALL must hold) | Server writes, atomically |
| --- | --- | --- | --- | --- |
| **T1** | ∅ → `open` | `POST /api/duels` | Authenticated session (`app.ts:50`). `timer.perMoveSeconds ∈ [60, 900]` **server-checked** (see E36). **No deckId** — the body no longer carries one. | new id; `join_token`; `creator_user_id`; `timer_per_move_seconds`; `seed_json`; `status='open'`; `room_deadline_at = now + 30 min`. **No seat tokens, no seat user id, no deck** — this is the delta from `duelRoutes.ts:75-101`. |
| **T2** | `open` → `filled` | `POST /api/duels/join` (claim) | Authenticated. Token known. `now < room_deadline_at`. `status = 'open'`. `user_id ≠ creator_user_id`. Guarded single-row UPDATE returns `changes = 1`. | `opponent_user_id`; `join_token_consumed_at`; `status='filled'`. `room_deadline_at` **unchanged**. |
| **T3** | `filled` → `filled` | `POST .../room/deck` (pick or change) | Authenticated occupant. `status='filled'`. Caller's `*_ready_at IS NULL`. Deck exists and `owner_id = caller` (`duelRoutes.ts:33-35` pattern). Deck passes `validateDeck` (`duelRoutes.ts:67`). | `X_deck_id` only. **No snapshot yet.** |
| **T4** | `filled` → `filled` | `POST .../room/ready` | Authenticated occupant. `status='filled'`. `now < room_deadline_at` (evaluated first). `X_deck_id` set. Deck still exists, still owned, **still passes `validateDeck` right now**. | In one transaction: `X_deck_json = snapshot`; `X_ready_at = now`; **if this is the first ready**, `room_deadline_at = now + 10 min`. Validate-then-write, never write-then-validate. |
| **T5** | `filled` → `awaiting_choice` | The **second** ready, same transaction as T4 | Guarded UPDATE: `WHERE id=? AND status='filled' AND creator_ready_at IS NOT NULL AND opponent_ready_at IS NOT NULL`, `changes = 1`. | `flip_winner_user_id = crypto-random one of the two user ids`; `flip_rolled_at = now`; `status='awaiting_choice'`; `room_deadline_at = now + 120 s`. **Persist before broadcasting.** |
| **T6** | `awaiting_choice` → `starting` | `POST .../room/choice` `{ first \| second }` | Authenticated occupant **and** `user_id = flip_winner_user_id`. `status='awaiting_choice'`. `now < room_deadline_at`. | **This is where seats are born.** `seat0_user_id = (choice='first') ? flip_winner : other`; `seat1_user_id` = the other; mint `seat0_token`, `seat1_token`; `deck0_json`/`deck1_json` = the two locked snapshots reordered by seat; `flip_choice`; `status='starting'`; clear `room_deadline_at`. |
| **T7** | `starting` → `active` | Engine constructed and stepped to its first decision | Row from T6 fully persisted. `manager.createAndStart(...)` resolved (`duelManager.ts:61-72`). | `status='active'`; `deadline_at`/`on_clock_seat` set for seat 0 (`duelStore.ts:97-108`) **only now** — not at claim time as today (`duelRoutes.ts:151-154`). Both clients handed `{ seat, seatToken }`. **Exit — out of scope beyond here.** |
| **T8** | `open`\|`filled`\|`awaiting_choice` → `closed` | `POST .../room/leave` (explicit, confirmed) | Authenticated occupant. `status ≠ starting`, `≠ active`. | `status='closed'`; `closed_reason='left'`; `closed_by_user_id`. Locked deck snapshots discarded. |
| **T9** | `open`\|`filled`\|`awaiting_choice` → `closed` | `now ≥ room_deadline_at`, observed lazily or by the armed timer | — | `status='closed'`; `closed_reason` per §3.2 table. |
| **T10** | `starting` → `closed` | Engine construction threw | `status='starting'`. | `status='closed'`; `closed_reason='engine_failed'`. No duel recorded, no loss. See E39. |

**Transitions that MUST NOT exist:**

- `filled → open`. An occupant leaving does **not** re-open the room for a new claimant. REQ-ROOM-07
  already says either player leaving "returns both to the lobby and voids the pending duel"
  (`v1-requirements.md:136`), and the link is single-use (`v1-requirements.md:111`). One link → at
  most one room, permanently.
- `awaiting_choice → filled`. The flip is not re-rollable (I4).
- Any transition out of `closed`.
- Any transition driven by a socket disconnect (REQ-ID-08).

### 4.4 Un-ready

**REQ-READY-01 (SHOULD).** An occupant SHOULD be able to un-ready while `status='filled'`
(i.e. before the other player's ready fires T5). Un-ready clears that occupant's `ready_at` and
`deck_json`, unlocking their deck. It MUST NOT move `room_deadline_at` — so there is no way to farm
the clock by toggling. Rationale: without it, the only escape from a mis-tapped ready is Leave, which
destroys the room for *both* players over one wrong tap. Scope flag in §9.

---

## 5. Derivations the brief asked for

### 5.1 Ready-up timeout — recommendation: 10 minutes, armed on the FIRST READY, not on arrival

**The value: 10 minutes.**

1. It equals the default per-move timer (10 min, decided), so the rule a player can state in one
   sentence is *"you get one move's worth of time to press Ready."* One number, already in their
   head, no new concept.
2. Live-only rules mean there is no legitimate "I'll ready tomorrow" case — that is async duelling,
   which is explicitly out. A player who cannot press one button inside a window comparable to a
   single move is, by the definition this feature is built on, not present.
3. It is comfortably under the 30-min link expiry, so the two clocks never race confusingly and the
   invite's 30 minutes stays purely about *the link*.
4. It is long enough to pick a deck, read the one rules line, and answer "you in?" in the group chat;
   short enough that a committed player gets closure inside a coffee break.

I considered scaling it (`min(perMoveSeconds, 600)`) and rejected it: with the timer bounded to
15 min max and defaulting to 10, the whole scaled range is 5–10 minutes. The complexity is not worth
a five-minute spread in a six-person app.

**The trigger: the first ready, not the second player's arrival.** This is the part that matters
more than the number. If the clock started when the room becomes `filled`, then the canonical flow —
creator pastes the link in chat and puts the phone down, friend opens it four minutes later — burns
the room down ten minutes after the friend arrives, while the creator is still in the kitchen, and
there is no notification system to tell them (none exists; decided). Starting the clock on the first
ready gives the timeout a precise and defensible meaning:

> **The ready-up timeout exists to protect a player who HAS committed from waiting forever. It does
> not exist to punish two players who are both still deciding.**

An idle `filled` room with nobody ready keeps the original 30-minutes-from-mint deadline and closes
as `expired_idle`. So an abandoned room always dies within 30 minutes of mint, and a half-committed
room always dies within 10 minutes of the commitment. Both bounded, both explainable.

**What each side sees at `expired_ready`:** the room closes for both. The player who readied sees
*"{Other} didn't ready in time. Room closed — no duel was recorded."* + **Start a new duel**. The
player who did not ready — if their tab is still open — sees *"The room closed because you didn't
ready in time."* Neither is a loss; nothing is written but the closed row. A player who returns to
the room URL later gets the same closed screen with the same reason (this is the only channel by
which an absent creator ever learns what happened, given no notifications and no invites list).

### 5.2 Flip resolved, winner never chooses — recommendation: 120 s, then CLOSE the room

**There MUST be a timeout.** Both players readied within the last ten minutes, so both were
demonstrably present; leaving the committed player in an indefinite "waiting for X to choose" is the
worst state in the whole machine.

**The window: 120 seconds**, with a visible countdown from the moment the flip is announced and a
warning at 15 s. It is a two-button decision with no information to weigh, so 30–60 s would suffice
functionally; 120 s absorbs a flip animation, a mobile app-switch and a moment of hesitation without
being long enough to bore the other player.

**The default action: close the room** (`closed_reason='expired_choice'`), no duel, no loss.

I want to be explicit about why I am *not* recommending "auto-choose first", which is the obvious
answer. Auto-choosing on behalf of a player who has walked away starts the engine and puts a
possibly-absent player on the clock — **which is verbatim the defect this entire feature exists to
remove** (today: `POST /api/duels/join` sets seat 0's deadline and starts the engine while the
creator may not be in the app at all, `duelRoutes.ts:145-161`). Re-creating it two transitions later
would be a poor trade. Auto-choosing *second* is a strictly gentler variant, because going second
means the opponent is on clock first and the absent player gets one extra move-timer of grace — but
choosing the rule that hands away the strategic advantage *because we assume the winner is absent*
is designing the product around the failure case.

Closing is harsher on a merely-slow player, which is why I flag this as a CEO call (§9.2) rather
than presenting it as settled. But it is the only option consistent with the principle *the engine
does not start unless both players are demonstrably present*, and it reuses the T9 code path
verbatim.

### 5.3 Deck locking — exactly when, and what a late validation failure does

**REQ-DECK-R01 (MUST).** A deck is immutable from the instant that occupant's **ready is accepted by
the server** (T4). Locking means **snapshotting** the card lists into `X_deck_json` — copying `main`
and `extra` out of the deck row exactly as `resolveDeck` does today (`duelRoutes.ts:28-39`) — not
retaining a `deck_id` reference. Before ready, only `X_deck_id` is stored and the deck is fully
editable and swappable.

**REQ-DECK-R02 (MUST).** After ready, editing or deleting that deck in the deck builder
(`routes/decks.ts:190-243`) MUST have **zero** effect on the room or the duel. This is what makes
"a deck the player deletes while in the room" a non-event rather than an edge case.

**REQ-DECK-R03 (MUST).** Ready MUST re-resolve and re-validate at the moment of ready, not trust the
pick-time result: deck exists, `owner_id = caller`, `validateDeck(...).legal` (`duelRoutes.ts:67`
pattern). Client validation is not trusted alone (REQ-DECK-09, `v1-requirements.md:160`).

**REQ-DECK-R04 (MUST).** If validation fails at ready time, the **ready is rejected**: the occupant
stays not-ready, their `deck_id` is cleared if the deck is gone, they see the specific violations,
and **the other player's view MUST NOT change at all** — no flicker of "opponent readied" followed by
"opponent un-readied". This is why T4 must validate-then-write inside one transaction: a
write-then-validate ordering could transiently satisfy T5's precondition and fire the coin flip for
a ready that was about to be rejected.

Three distinct ways a pick-time-legal deck fails at ready time, all real:

1. The player edited it in another tab (`PUT /api/decks/:id`, `decks.ts:190-226`).
2. The player deleted it (`DELETE /api/decks/:id`, `decks.ts:229-243`) — there is no guard today
   against deleting a deck referenced by a duel.
3. **The catalog or banlist changed under them** — a redeploy reloads the catalog (`index.ts:31`)
   and `validateDeck` runs against it. This one cannot be caught at pick time by construction, and
   is the reason REQ-DECK-R03 is not redundant.

> **Contradiction found — REQ-ROOM-02 must be amended.** The existing edge says the room "MUST
> re-validate **at Start** and block if the deck is now missing/illegal"
> (`v1-requirements.md:130`); REQ-DECK-16 points at the same behaviour (`:179`). Under
> snapshot-at-ready there is nothing left to re-validate at Start, and re-validating there would be
> actively worse: it kills the room *after* both players readied and *after* the flip, at the moment
> of maximum invested attention, for a problem the player could have fixed ten minutes earlier.
> Recommend amending REQ-ROOM-02's edge to "re-validate at **ready**, snapshot on success".

---

## 6. Requirements summary (the ones not already stated inline)

- **REQ-ROOM-R03 (MUST).** The invite link `/duel/join/:joinToken` MUST resolve, for an authorized
  opener, to the durable room URL `/duel/:duelId/room`. The room URL MUST be re-enterable by either
  occupant at any time in S1–S5 and MUST render the current state from the server.
- **REQ-ROOM-R04 (MUST).** The creator MUST land in the room immediately on creating the invite, and
  the shareable link MUST be copyable **from inside the room**, on every visit. Today the link
  exists only as React component state (`CreateDuelScreen.tsx:35`, set at `:79`) on a separate
  "Duel Created!" screen (`:111-196`) — a refresh loses it, and there is no endpoint anywhere that
  returns a creator their own `join_token`. Under a resumable room this is not a nicety; it is the
  difference between "closed my tab" being recoverable and being fatal.
- **REQ-ROOM-R05 (MUST).** Navigating away inside the SPA, closing the tab, the back button, losing
  connection, and logging out MUST NOT be treated as Leave. **Leave is an explicit, confirmed action
  only**, and its confirm copy MUST say it closes the room for both players.
  - This is what lets a player with no legal deck go build one and come back: they were never out of
    the room, only disconnected (REQ-ID-08). Without it, "you need a legal deck → go to the builder"
    is an instruction to destroy the room.
- **REQ-ROOM-R06 (MUST).** Room reads MUST be occupant-only. Note `GET /api/duels/:id`
  (`duelRoutes.ts:186-199`) currently returns status/winner/end_reason to **any** authenticated user
  for **any** duel id; the room snapshot endpoint MUST NOT copy that.
- **REQ-ROOM-R07 (MUST).** Neither player's **decklist** may ever be exposed to the other, before or
  during the room (REQ-DECK-17, `v1-requirements.md:180`). See §9.3 for the deck-*name* question.
- **REQ-ROOM-R08 (MUST).** The room MUST display the per-move timer to both occupants at all times
  (REQ-ROOM-09, `v1-requirements.md:138`), and the invitee MUST see it before readying — already
  satisfied pre-entry by the pre-join lookup (`duelRoutes.ts:180-183`,
  `JoinDuelScreen.tsx:126-133`).
- **REQ-ROOM-R09 (MUST).** The flip announcement MUST be identical for both players, MUST name the
  winner, and MUST be re-derivable from `flip_winner_user_id` on any reconnect (I4).

---

## 7. Edge-case table

40 cases. **P-C** = creator, **P-I** = invitee/opponent, **P-3** = third party. "Persisted" means
what is written to the duel row; in every `closed` case, *no duel is recorded and no player takes a
loss*.

### 7.1 Link and entry

| # | Trigger | Expected behaviour | What each player sees | Persisted |
| --- | --- | --- | --- | --- |
| E1 | P-C creates invite, closes the tab before P-I arrives | Room stays `open`. Presence ≠ liveness (REQ-ID-08). Link stays valid to `room_deadline_at`. | P-C: nothing. Re-opening the room URL restores the room **and the link** (REQ-ROOM-R04). | unchanged |
| E2 | P-C re-opens the room URL 5 min later | Room re-rendered from the row; countdown recomputed; link re-shown | P-C: the same room, "waiting for opponent", 25 min left | nothing |
| E3 | P-I opens an **expired** link (>30 min) | Lazy expiry writes back, then reject | P-I: *"This invite expired. Ask {creator} for a new link."* Timer still shown. P-C, if present: room closes live | `status='closed'`, `closed_reason='expired_unclaimed'` |
| E4 | P-3 opens a link **already claimed** by P-I, room still live | Rejected; link not re-consumed | P-3: *"Someone else already joined this duel."* P-C/P-I: **nothing at all** — no notification, no presence blip | nothing |
| E5 | P-3 opens a link whose duel **already started** | Rejected, distinct reason from E4 | P-3: *"This duel has already started."* | nothing |
| E6 | P-3 opens a link for a **closed** room | Rejected with the room's reason | P-3: *"This invite is no longer valid."* | nothing |
| E7 | P-C opens **their own** link | **Not** an error. Routed into their own room (REQ-LINK-06). Contrast today's `self_join` 400 (`duelRoutes.ts:124-127`) | P-C: their room | nothing |
| E8 | P-I re-opens the link from chat history after claiming it | Recognised as an existing occupant; routed into the room | P-I: the room | nothing |
| E9 | Two members open the same unclaimed link in the same instant | Guarded single-row UPDATE; exactly one wins (REQ-LINK-07) | Winner: the room. Loser: *"Someone else already joined."* | one `opponent_user_id`; loser writes nothing |
| E10 | P-I double-taps Join | Idempotent: the second claim by the same user returns the room | P-I: the room, once | nothing on the second call |
| E11 | Unauthenticated visitor opens the link | Login wall, then resume on the same URL — **already works** (`App.tsx` `RequireAuth` captures `from`; `app.ts:50` gates the lookup) | Visitor: login → the room. Link not consumed by the denied attempt | nothing |
| E12 | P-I's account has **zero legal decks** | They may enter the room and stay; they simply cannot ready | P-I: *"You need a legal deck to ready"* + **Build a deck** (leaves the tab, not the room — REQ-ROOM-R05). P-C: P-I present, no deck picked | nothing |
| E13 | A user opens a second link while already an occupant of another live room | **Not blocked** — see §9.5 | Both rooms live | nothing |

### 7.2 In the room, before ready

| # | Trigger | Expected behaviour | What each player sees | Persisted |
| --- | --- | --- | --- | --- |
| E14 | P-I picks a deck | Server write (REQ-ID-05); validated at pick | P-I: their deck name. P-C: *"Opponent selected a deck ✓"* (§9.3) | `opponent_deck_id` |
| E15 | P-I changes deck three times before readying | Each is an overwrite; allowed until ready | P-C: still just *"deck selected ✓"* — no churn, no names | last `deck_id` only |
| E16 | Either refreshes with a deck picked, not ready | Deck pick survives, because it is a **server** write, not client state | Identical room after ~1 s reconnect; no `away` flicker (REQ-ID-08) | nothing |
| E17 | P-C's socket drops for 30 s while `filled` | P-C shown as `away`. **No deadline effect** | P-I: *"{Creator} is away"*. Countdown unchanged | nothing |
| E18 | Server restarts / redeploys mid-room | All sockets drop and auto-reconnect; room rebuilt from the row; deadline timer re-armed on reconnect; lazy check backstops (REQ-ROOM-R01/EXP-02) | Both: ~1–2 s "reconnecting", then the identical room | nothing |
| E19 | Nobody readies; 30 min from mint elapses with both present | T9 fires on the armed timer | Both: *"This room expired. No duel was recorded."* | `closed`, `expired_idle` |
| E20 | P-C's **session** expires (30-day TTL) or they log out in another tab | Socket closes, HTTP 401. **Not** a Leave. Room untouched | P-C: login prompt; logging back in returns them to the room. P-I: P-C `away` | nothing |
| E21 | P-C opens the room on phone **and** laptop | Both sockets accepted; same occupant; identical snapshots (REQ-ID-06) | P-C: consistent in both. P-I: one opponent | nothing |
| E22 | P-3 attempts to open the **room socket** directly for a room they are not in | Handshake authorizes `user_id ∈ {creator, opponent}` and closes (REQ-ID-03) | P-3: rejected. Occupants: nothing | nothing |
| E23 | A malicious page opens the room socket with a logged-in victim's cookie | Rejected on `Origin` (REQ-ID-04) | — | nothing |
| E24 | Either player Leaves before anyone readies | T8 | Leaver: home. Other: *"{Name} left. Room closed — no duel recorded."* | `closed`, `left`, `closed_by_user_id` |

### 7.3 Ready and the flip

| # | Trigger | Expected behaviour | What each player sees | Persisted |
| --- | --- | --- | --- | --- |
| E25 | P-C readies first | T4: validate → snapshot → `ready_at` → **rebase deadline to +10 min** (§5.1) | P-C: locked, deck greyed, *"Waiting for {P-I}"*, 10:00 counting. P-I: *"{P-C} is ready"* + the same countdown | `creator_deck_json`, `creator_ready_at`, new `room_deadline_at` |
| E26 | P-I readies with **no deck selected** | Rejected `deck_required` | P-I: inline error. P-C: nothing changes | nothing |
| E27 | P-I readies with a deck they **deleted** since picking | Re-resolve fails; ready rejected; pick cleared (REQ-DECK-R03/04) | P-I: *"That deck no longer exists — pick another."* P-C: **nothing changes** | `opponent_deck_id` cleared |
| E28 | P-I readies with a deck that became **illegal** since picking (edited elsewhere, or the banlist/catalog changed on redeploy) | Ready rejected with the specific violations from `validateDeck` | P-I: violation list + **Fix deck**. P-C: nothing changes | nothing |
| E29 | P-I sends **ready twice** (double-tap, or socket retry) | Idempotent: same occupant, already ready, same deck → `200`, no change | P-I: still ready. P-C: no flicker | nothing on the second |
| E30 | P-I sends ready with a **different** deck after already being ready | Rejected `already_ready` — the deck is locked (I3) | P-I: *"Your deck is locked. Un-ready to change it."* | nothing |
| E31 | **Both ready in the same instant** | Writes serialize (§10.2); T5's guarded UPDATE returns `changes=1` for exactly one; that one rolls and persists the flip, then broadcasts | Both see the identical flip announcement, once | one `flip_winner_user_id`, `flip_rolled_at`, `status='awaiting_choice'`, new deadline |
| E32 | P-I's ready arrives while P-C's **Leave** is committing | Serialized. Leave first → room `closed`, ready rejected `room_closed`, P-I lands on the "opponent left" screen (not an error toast). Ready first → Leave still closes it. Neither ordering can start a duel (T5 requires `status='filled'`) | P-I: *"{P-C} left. Room closed."* | `closed`, `left` |
| E33 | P-C readies, then Leaves while waiting for P-I | T8; locked snapshot discarded | P-I: *"{P-C} left. Room closed."* | `closed`, `left` |
| E34 | P-C readies, then the 10 min elapses with P-I never readying | T9 | P-C: *"{P-I} didn't ready in time. Room closed — no duel recorded."* P-I (if present): *"The room closed because you didn't ready in time."* | `closed`, `expired_ready` |
| E35 | Ready arrives after `room_deadline_at` passed but before anyone observed it | Ready handler evaluates expiry **first** (REQ-EXP-01, mirroring `duelSocket.ts:218`), closes the room, rejects the ready | Both: the expiry screen. Never "you readied, then it expired" | `closed`, `expired_*` |
| E36 | A crafted `POST /api/duels` with `perMoveSeconds = 1` (or 315360000) | Rejected server-side. **Gap today:** `PerMoveTimerSchema` only requires a positive int (`contracts/src/duel.ts:16-19`); the only clamp is client-side (`CreateDuelScreen.tsx:63`). REQ-TIMER-02 already requires server rejection (`v1-requirements.md:327-330`) | Caller: 400 with the bound. No room minted | nothing |
| E37 | Either refreshes with exactly one player ready | Ready state and countdown restored from the row | Identical room | nothing |

### 7.4 Post-flip, pre-engine

| # | Trigger | Expected behaviour | What each player sees | Persisted |
| --- | --- | --- | --- | --- |
| E38 | Either refreshes / reconnects in `awaiting_choice` | Flip result **re-read**, never re-rolled (I4, satisfying `v1-requirements.md:133`). Choice countdown recomputed from the row | Identical announcement and countdown | nothing |
| E39 | Flip winner is currently disconnected when the flip fires | Allowed — they readied. The 120 s runs regardless | Waiting player: *"Waiting for {winner} to choose…"* + countdown | nothing |
| E40 | Flip winner never chooses; 120 s elapses | T9 → close (recommendation, §5.2 — **CEO call §9.2**) | Both: *"{Winner} didn't choose in time. Room closed — no duel recorded."* | `closed`, `expired_choice` |
| E41 | The **loser** of the flip submits a choice | Rejected: T6 requires `user_id = flip_winner_user_id` | Loser: *"Only {winner} chooses."* | nothing |
| E42 | Winner chooses "first" | T6 — **seats are born here.** `seat0 = winner` | Both: *"{Winner} goes first"* → board | seats, both seat tokens, `deck0/1_json`, `flip_choice`, `status='starting'` |
| E43 | Winner chooses "second" | Same, `seat0 = the other player` | Both: *"{Winner} goes second — {other} goes first"* | as above |
| E44 | Either attempts Leave during `starting` | Rejected — T8 excludes `starting` (point of no return). The exit is resign, which is in-duel and out of scope | *"The duel has started."* | nothing |
| E45 | Either refreshes during `starting` | Room screen holds and polls until `active`, then fetches its seat token via REQ-ID-10 and enters the board | Both: *"Starting duel…"* then the board | nothing |
| E46 | **Engine construction fails** | T10: room `closed`, reason `engine_failed`, no loss for anyone. **Unhandled today:** the failure is logged and swallowed (`duelRoutes.ts:157-161`) while the row is already `active`, so both clients get "engine unavailable" (`duelSocket.ts:302-308`) forever with no recorded result | Both: *"Something went wrong starting the duel. No result was recorded."* + **Try again** | `closed`, `engine_failed` |
| E47 | Process dies between T6's write and T7 | Row is `starting` with seats, tokens and both decks persisted, so the engine is reconstructible — `getOrRehydrate` already rebuilds from seed + both decks + an empty response log (`duelManager.ts:36-55`). On the next occupant connect the server completes T7 | Both: a longer "Starting duel…", then the board | `status` → `active` on completion |
| E48 | Either player returns to a `closed` room URL hours later | Room snapshot returns the closed state and reason to either occupant | *"This room closed: {reason}. No duel was recorded."* This is the **only** way an absent creator ever learns what happened, given no notifications and no invites list (ZUH-22) | nothing |

---

## 8. What the current code already gets right — do not re-specify

1. **Self-join is already rejected** (`duelRoutes.ts:124-127`), so a creator cannot occupy both
   seats. Under the room model the *response* should change from a 400 to "enter your own room"
   (REQ-LINK-06), but the guard itself stays.
2. **A second join of a consumed link is already rejected** (`duelRoutes.ts:120-123`), and the join
   screen already disables the button and shows a message before the user tries
   (`JoinDuelScreen.tsx:54, 135-143, 201`). Only the message needs splitting into distinct reasons.
3. **The pre-join lookup already leaks nothing** — timer and status only, never seat tokens, decks
   or seed (`duelRoutes.ts:170-184`, `contracts/src/duel.ts:53-60`), and it already satisfies
   "invitee sees the timer before committing" (`JoinDuelScreen.tsx:126-133`).
4. **The logged-out-opens-a-link path already works** — `RequireAuth` captures the intended path and
   login resumes on it (`App.tsx`), and the lookup is session-gated (`app.ts:50`).
5. **Deck resolution and legality already do the right checks** — existence, ownership, then
   `validateDeck` against the Edison catalog (`duelRoutes.ts:28-39, 59-73`). The room's ready
   handler should reuse this exact shape, only later.
6. **Lazy expiry is an established, working pattern here** — invites (`routes/auth.ts:82`) and
   sessions (`requireSession.ts:53-56`). The room needs no new mechanism.
7. **The reconnect-and-resend-full-state model already works on the board socket**
   (`duelSocket.ts:311-349`) and the client already reconnects with backoff
   (`web/src/api/duelSocket.ts:79-89`). The room socket should copy both.
8. **Timeouts are already belt-and-braces** — armed timer plus lazy check
   (`duelSocket.ts:152, 218, 328-338`). REQ-EXP-01/02 is the same design, not a new one.

---

## 9. Cases where there is no obviously right answer — CEO must choose

### 9.1 Does the ready-up clock start on arrival or on the first ready?
My recommendation is **first ready** (§5.1), and I have derived it rather than guessed it. But it
has a visible cost: a room where the invitee arrives and waits can sit for up to 30 minutes from
mint, and there is no cancel (ZUH-22) and no notification to tell anyone. The alternative —
start on arrival — makes rooms die faster and more predictably, at the price of burning the
canonical "creator pasted the link and put the phone down" flow. **This is a product-values call:
predictable teardown vs. tolerating the group-chat rhythm.**

### 9.2 Flip winner doesn't choose: close the room, or auto-choose for them?
I recommend **close** (§5.2) because auto-choosing puts a possibly-absent player on the clock, which
is the exact defect this feature removes. But closing is harsh on a merely-slow player and throws
away two players' completed ready-up. The three live options: **close** (principled, harsh),
**auto-choose first** (forgiving, re-creates the absent-player-on-clock defect), **auto-choose
second** (forgiving, gives the absent player one extra move-timer of grace, but hands away the
strategic advantage on their behalf). Pick one; I have no basis to decide it for you.

### 9.3 Does a player see which deck their opponent picked, or only that they picked one?
REQ-ROOM-01 says the room shows "the deck each has selected" (`v1-requirements.md:128`).
REQ-DECK-17 says a decklist is hidden pre-duel information (`:180`). A deck *name* is not a
decklist, but in this format a name like "Blackwing Turbo" is the archetype — competitively, that is
most of the information. **These two requirements contradict each other for the deck-name case.**
My recommendation: show your own deck name to yourself, and only "deck selected ✓" to your opponent.
But friends may well *want* to know what they're up against, and that is a group-culture call.

### 9.4 Can a player un-ready?
Not covered by anything decided. I recommend **yes** while `status='filled'` (REQ-READY-01), because
without it the only escape from a mis-tapped ready is Leave, which destroys the room for both. The
counter-argument is scope: it is one more endpoint, one more state edge, and one more thing to test.

### 9.5 Is a member allowed to be in two rooms at once?
The pre-existing rules say no — REQ-LOBBY-05 blocks a second concurrent duel/room
(`v1-requirements.md:119`) and "one outstanding outgoing invite per member" is listed as confirmed
(`:111`). **But those rules were written when the creator could revoke an invite, and revoke/cancel
is now parked (ZUH-22).** Combine "one room at a time" with "no cancel" and "30-minute expiry" and
you get: a user who mints a link nobody opens is locked out of starting any duel for up to 30
minutes, with no way to clear it. That is a worse failure than the thing the rule prevents.
My recommendation for this MVP: **do not enforce one-room-at-a-time**, and rely on Leave (available
in every pre-start state anyway) as the escape hatch. If the CEO wants the rule enforced, ZUH-22's
cancel must ship with it, not after it.

### 9.6 Does leaving during `awaiting_choice` really void a completed flip?
"Either player can leave before the duel starts" is decided, and I have honoured it literally
(T8 covers `awaiting_choice`). The uncomfortable consequence: a player who loses the flip can leave
and void the room rather than play from second — a rage-quit with no record, no loss, and no
visibility. In a six-person friend group social pressure probably handles it. If it doesn't, the
options are to end Leave at the flip, or to record something. Flagging rather than deciding.

---

## 10. Notes for the CTO (consequences, not decisions)

### 10.1 Where this state machine would re-create the ZUH-21 mock-duel bug class
I am not designing around ZUH-21 and not proposing to fix it, as instructed. But the room's exit
transition is precisely where that bug class would reappear, so it must be called out.

`DuelScreen` reads the seat token from `location.state` (`DuelScreen.tsx:48-49`) and then does
`const useMock = !seatToken || locationState.useMock` (`:133`) — **a missing seat token is silently
reinterpreted as "render a mock duel"**, which is the ZUH-21 symptom. Today the token gets there via
`navigate(..., { state: { seatToken, seat } })` from the create and join screens
(`CreateDuelScreen.tsx:100-103`, `JoinDuelScreen.tsx:67-70`).

If the room hands off the same way, then the extremely likely "player refreshes during the
`starting`→board transition" (E45) lands on `DuelScreen` with no state, and instead of an error the
player is shown a **fake duel against a bot** while their real opponent waits on a real board.
REQ-ID-10 exists specifically to prevent this: the seat token must be **re-fetchable from the server
by the authenticated occupant**, so the board can always recover it after a refresh. The room MUST
NOT be the second place in the product where a credential lives only in router state.

### 10.2 The claim/ready races are currently safe **by accident**, and that accident is fragile
`POST /api/duels/join` reads the row (`duelRoutes.ts:115`) and writes it (`:145`) with no guard —
textbook TOCTOU. It does not misbehave today only because `better-sqlite3` is synchronous, the
process is single-instance (`index.ts:28-47`), and the handler contains no `await` between the read
and the write (the only `await`-ish work, `manager.createAndStart`, is deliberately after, `:157`).

Every new room mutation inherits that fragility. **REQ-CONC-01 (MUST):** the claim (T2), the ready
(T4) and the flip-firing (T5) MUST each be expressed as a single guarded `UPDATE ... WHERE
<expected state>` with `changes === 1` as the decision, rather than relying on handler synchrony.
Introducing a single `await` before the write in any of these handlers — or ever running a second
instance — silently re-opens all three races, and the flip race in particular could roll the coin
twice.

### 10.3 API deltas implied
- `POST /api/duels`: drop `deckId`; drop seat-token minting; add server-side `perMoveSeconds` bounds
  `[60, 900]`; write `room_deadline_at`; return the room.
- `POST /api/duels/join`: drop `deckId`; drop the engine start and the seat-0 deadline write
  (`duelRoutes.ts:145-161`); return the room; distinct error codes (REQ-LINK-05).
- `GET /api/duels/join/:joinToken`: add lazy expiry + writeback; return `{ timerPerMoveSeconds,
  usable, reason }` instead of raw `status`.
- New: `GET /api/duels/:id/room`, `POST .../room/deck`, `.../room/ready`, `.../room/unready`,
  `.../room/choice`, `.../room/leave`, `GET /api/duels/:id/seat`, and the room WebSocket.
- `GET /api/duels/:id` (`duelRoutes.ts:186-199`) is unauthorized-by-occupant today; do not extend it
  with room fields.
- Contracts: new statuses and a new `ROOM_STATE` frame are additions to locked enums
  (`contracts/src/duel.ts:50, 144-161`) and require a spec update first per `AGENTS.md`.
