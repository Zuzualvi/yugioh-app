---
linear_project: Duel Invite Improvements
---

# Pre-duel room — implementation spec

**Project:** Duel Invite Improvements · **Author:** CTO · **Date:** 2026-07-28
**Requirements source of truth:** the Linear PRD "Duel Invite Improvements", requirements R1–R48.
**Inputs (read these; this spec does not restate them):**

- `docs/specs/2026-07-28-room-lifecycle-and-edge-cases.md` — 5 states, 10 transitions, 6 invariants,
  48 edge cases (E1–E48), all with `file:line` evidence.
- `docs/specs/2026-07-28-room-ux-flows.md` — 16 screens (S1–S10, D1–D5b) with wireframes, copy
  strings, accessibility rules.

**Precedence when documents disagree:** PRD R1–R48 wins, then this spec, then the two discovery
docs. The discovery docs were written before the CEO's eight consolidated calls of 2026-07-28, so
the following recommendations in `room-lifecycle-and-edge-cases.md` are **overruled** and must not
be implemented as written there: `filled → open` "must not exist" (§4.3) — it exists, see T11 below;
§9.1–§9.6 are all now decided (see PRD decision log).

---

## 1. Architecture

### 1.1 The room is its own table; the `duel` row is created at seat assignment

The `duel` table declares `seat0_token`, `seat1_token`, `seat0_user_id`, `deck0_json` and
`seed_json` as `NOT NULL` (`packages/server/src/db/migrate.ts:58-76`). R2 requires all of those to
be absent for the whole pre-flip life of the room.

**Decision (CEO-approved amendment to R2's letter): a new `duel_room` table holds the room; the
`duel` row is `INSERT`ed at T6 (seat assignment), sharing the same primary key.** R2's intent —
nothing engine-shaped exists before the flip resolves — becomes enforced by the schema instead of by
a nullable column and a comment. R47 (one id for room and duel) holds: `duel_room.id = duel.id`, so
`/duel/:id/room` and `/duel/:id` address the same object. R6 holds: the complete room state is
reconstructible from the single `duel_room` row.

Recorded as `docs/adr/0002-room-as-its-own-table.md`.

### 1.2 Three shapes, and nothing else

Every change to room state uses one of exactly three shapes. This is deliberate: it constrains the
output space so each kind of change has one correct form.

1. **Every state transition is a single guarded write** —
   `UPDATE duel_room SET … WHERE id = ? AND <expected state>` — and `changes === 1` is the decision.
   Never read-then-write. This is R40 / REQ-CONC-01, and it applies to the claim (T2), each ready
   (T4), the flip firing (T5), the choice (T6), leave (T8/T11) and every close (T9/T10).
2. **Every read and every mutation begins with the same expiry evaluation** —
   `evaluateExpiry(row, now)` — and writes back the close before doing anything else. There is no
   sweeper. The lazy check is always the authority (R17, R20).
3. **Every outbound room payload is produced by one function** — `buildRoomSnapshot(...)`. It is the
   only place in the codebase where one occupant's data is assembled for the other's eyes, which is
   what makes R25 (never leak the deck name or list) structurally true rather than carefully
   maintained.

### 1.3 Package boundaries

Unchanged and load-bearing (`AGENTS.md`): `contracts` imports nothing internal; `web` imports
`contracts` only. All room wire types live in `packages/contracts/src/room.ts`. No new package.

---

## 2. Locked output contracts

**These field names, enum literals and orderings are LOCKED.** Implementers do not vary them. All
timestamps are epoch **milliseconds**, integers, absolute, server-generated (R18).

`packages/contracts/src/room.ts` (new file):

```ts
export const RoomStatusSchema = z.enum(["open", "filled", "awaiting_choice", "starting", "closed"]);

export const RoomClosedReasonSchema = z.enum([
  "left",
  "expired_unclaimed",
  "expired_idle",
  "expired_ready",
  "expired_choice",
  "engine_failed",
]);

export const RoomPresenceSchema = z.enum(["connected", "away", "left"]);
export const OccupantRoleSchema = z.enum(["creator", "opponent"]);
export const SeatChoiceSchema = z.enum(["first", "second"]);

/** What an occupant may know about the OTHER occupant. No deck name, no card counts, ever (R25). */
export const RoomOpponentViewSchema = z.object({
  role: OccupantRoleSchema,
  userId: z.string(),
  displayName: z.string(),
  presence: RoomPresenceSchema,
  deckSelected: z.boolean(),
  ready: z.boolean(),
});

/** What an occupant may know about THEMSELVES. */
export const RoomSelfViewSchema = RoomOpponentViewSchema.extend({
  deckId: z.string().nullable(),
  deckName: z.string().nullable(),
  deckCardCount: z.number().int().nullable(),
  deckLocked: z.boolean(),
});

export const RoomFlipSchema = z.object({
  winnerUserId: z.string(),
  winnerDisplayName: z.string(),
  rolledAt: z.number().int(),
  choice: SeatChoiceSchema.nullable(),
});

export const RoomSnapshotSchema = z.object({
  roomId: z.string(),
  status: RoomStatusSchema,
  closedReason: RoomClosedReasonSchema.nullable(),
  closedByUserId: z.string().nullable(),
  perMoveSeconds: z.number().int(),
  createdAt: z.number().int(),
  roomDeadlineAt: z.number().int().nullable(),
  serverNow: z.number().int(),
  /** The shareable token. Non-null ONLY for the creator, and ONLY while status is `open`. */
  joinToken: z.string().nullable(),
  you: RoomSelfViewSchema,
  opponent: RoomOpponentViewSchema.nullable(),
  flip: RoomFlipSchema.nullable(),
  /** Non-null only in `starting`. Lets the UI name who goes first without a second request. */
  seats: z.object({ seat0UserId: z.string(), seat1UserId: z.string() }).nullable(),
});

/** The ONLY server→client room frame. The room socket is read-only (R12). */
export const RoomServerMessageSchema = z.object({
  type: z.literal("ROOM_STATE"),
  snapshot: RoomSnapshotSchema,
});

export const PreJoinVerdictSchema = z.enum([
  "ok",
  "expired",
  "claimed_by_other",
  "closed",
  "started",
  "you_are_the_creator",
  "you_are_an_occupant",
]);

/** R37: timer + creator name + a purpose-built verdict. NEVER the raw room status. */
export const PreJoinRoomInfoSchema = z.object({
  perMoveSeconds: z.number().int(),
  creatorDisplayName: z.string(),
  usable: z.boolean(),
  reason: PreJoinVerdictSchema,
});

export const CreateRoomBodySchema = z.object({ timer: PerMoveTimerSchema });
export const CreateRoomResultSchema = z.object({ roomId: z.string(), joinToken: z.string() });
export const ClaimRoomBodySchema = z.object({ joinToken: z.string() });
export const PickDeckBodySchema = z.object({ deckId: z.string() });
export const SubmitChoiceBodySchema = z.object({ choice: SeatChoiceSchema });
export const SeatCredentialSchema = z.object({ seat: SeatSchema, seatToken: z.string() });
```

Changes to `packages/contracts/src/duel.ts`:

- `PerMoveTimerSchema.perMoveSeconds` becomes `z.number().int().min(60).max(900)` — **R44**, the
  server-side bound (E36). Client clamps are no longer the only gate.
- `DuelStatusSchema` gains `"starting"` → `["waiting_for_opponent", "active", "ended", "starting"]`.
- `CreateDuelBodySchema` drops `deckId`; `JoinDuelBodySchema` drops `deckId` (R21).
- `PreJoinDuelInfoSchema` is **deleted** and replaced by `PreJoinRoomInfoSchema` (R37/REQ-LINK-03 —
  the raw status must stop being on the wire).
- `CreateDuelResultSchema` / `JoinDuelResultSchema` are **deleted**: neither seats nor seat tokens
  exist at create or claim any more. `CreateRoomResultSchema` replaces the first; claim returns a
  `RoomSnapshot`.

### 2.1 Error codes (locked)

HTTP status → `{ error: { code, message } }`, matching the existing convention.

| Code | Status | When |
| --- | --- | --- |
| `invalid_timer` | 400 | `perMoveSeconds` outside `[60, 900]` (R44) |
| `invalid_token` | 404 | join token unknown |
| `expired` | 410 | room deadline passed (evaluated first, R20) |
| `already_claimed` | 409 | slot held by a third party (E4, E9) |
| `already_started` | 409 | room is `starting`, duel is `active` (E5) |
| `room_closed` | 409 | room is `closed`, message carries the reason (E6) |
| `not_occupant` | 403 | caller is not one of the two occupants (R10) |
| `deck_required` | 400 | ready with no deck picked (E26) |
| `deck_invalid` | 400 | body carries `validation` violations (E27, E28) |
| `already_ready` | 409 | deck change or re-ready with a different deck while locked (E30) |
| `not_flip_winner` | 403 | choice submitted by the flip loser (R30, E41) |
| `wrong_state` | 409 | the guarded `UPDATE` matched 0 rows |
| `leave_not_allowed` | 409 | leave attempted in `starting` (R36, E44) |

---

## 3. Data model — migration 3

Appended to `MIGRATIONS` in `packages/server/src/db/migrate.ts`. Additive only; no existing table is
altered, so no rebuild and no data migration.

```sql
CREATE TABLE IF NOT EXISTS duel_room (
  id                     TEXT NOT NULL PRIMARY KEY,
  join_token             TEXT NOT NULL UNIQUE,
  join_token_consumed_at INTEGER,
  creator_user_id        TEXT NOT NULL,
  opponent_user_id       TEXT,
  timer_per_move_seconds INTEGER NOT NULL,
  seed_json              TEXT NOT NULL,
  creator_deck_id        TEXT,
  opponent_deck_id       TEXT,
  creator_deck_json      TEXT,
  opponent_deck_json     TEXT,
  creator_ready_at       INTEGER,
  opponent_ready_at      INTEGER,
  room_deadline_at       INTEGER NOT NULL,
  flip_winner_user_id    TEXT,
  flip_rolled_at         INTEGER,
  flip_choice            TEXT,
  flip_choice_at         INTEGER,
  status                 TEXT NOT NULL DEFAULT 'open',
  closed_reason          TEXT,
  closed_by_user_id      TEXT,
  created_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_duel_room_join_token ON duel_room(join_token);
```

Notes:

- `seed_json` is rolled at mint and is the *shuffle* seed, unrelated to the flip. It is never sent to
  a client.
- `room_deadline_at` is `NOT NULL` and written exactly three times (R16): mint `+30 min`, first ready
  `+10 min`, flip resolution `+120 s`. Nothing else moves it — not deck picks, not deck changes, not
  un-ready, not reconnects, not the opponent's arrival, not the revert of T11 except as specified
  there.
- Presence is **not** a column. It is derived from live socket state (§5.3) and never persisted, so
  it cannot survive a restart and cannot influence any outcome (R14).
- `flip_winner_user_id` is a **user id**, never a seat (R5, I2).

---

## 4. Server file layout

New directory `packages/server/src/room/`. One operation per file (`AGENTS.md`).

| File | Responsibility |
| --- | --- |
| `roomState.ts` | **Pure.** Transition guards + `closedReasonFor(status)`. No DB, no clock — `now` is a parameter. |
| `evaluateExpiry.ts` | **Pure.** `(row, now) → { expired: boolean, reason }`. |
| `roomStore.ts` | Every SQL statement touching `duel_room`. All writes are guarded single-row `UPDATE`s returning `changes`. |
| `buildRoomSnapshot.ts` | **Pure.** `(row, viewerUserId, names, presence, now) → RoomSnapshot`. |
| `loadRoomView.ts` | Row + both display names in one read; feeds the builder. |
| `roomAccess.ts` | `requireOccupant(row, userId)` → `"creator" \| "opponent" \| null`. |
| `roomBroadcast.ts` | Socket registry: rooms → sockets → userId. Per-viewer broadcast, presence tracking, one armed deadline timer per room. |
| `roomSocket.ts` | WS upgrade: cookie auth, `Origin` allowlist, occupant check, initial snapshot. |
| `roomRouter.ts` | Express router; mounts the handlers below. Owned by S0 and not edited afterwards. |
| `routes/createRoom.ts` | T1 |
| `routes/lookupJoinToken.ts` | Pre-join verdict, **unauthenticated-capable** (R41) |
| `routes/claimRoom.ts` | T2 |
| `routes/getRoomSnapshot.ts` | R12/R13 snapshot read |
| `routes/pickDeck.ts` | T3 |
| `routes/ready.ts` | T4 (+ T5 via the store) |
| `routes/unready.ts` | T4′ |
| `routes/leave.ts` | T8 / T11 |
| `routes/submitChoice.ts` | T6 → T7 |
| `routes/getSeatCredential.ts` | R32 |

Also: `packages/server/src/middleware/resolveSessionUser.ts` — `resolveSessionUser(db, sid):
SessionUser | null`, extracted verbatim from the body of `requireSession`
(`middleware/requireSession.ts:37-72`), which is refactored to call it. The WS handshake needs
session resolution outside Express middleware and must not duplicate the logic.

### 4.1 Signatures that other slices depend on

```ts
// roomStore.ts
export interface DuelRoomRow { /* one field per column above, snake_case preserved */ }

export function insertRoom(db, p: { id, joinToken, creatorUserId, perMoveSeconds, seed: bigint,
  roomDeadlineAt: number, createdAt: number }): void;

export function getRoom(db, id: string): DuelRoomRow | undefined;
export function getRoomByJoinToken(db, token: string): DuelRoomRow | undefined;

/** T9/T10. Guarded: only closes a room in a non-terminal state. */
export function closeRoom(db, id, reason: RoomClosedReason, byUserId: string | null): boolean;

/** T2. `UPDATE … WHERE id=? AND status='open' AND opponent_user_id IS NULL`. */
export function claimSlot(db, id, userId, now): boolean;

/** T3. Guarded on that occupant not being ready. */
export function setDeckRef(db, id, role, deckId): boolean;

/**
 * T4 + T5 in ONE transaction (R24, R29). The caller has ALREADY re-resolved and
 * re-validated the deck; this function only writes.
 *  - writes `<role>_deck_json` = snapshot, `<role>_ready_at` = now
 *  - if this is the FIRST ready, rebases room_deadline_at to now + 600_000
 *  - if this makes BOTH ready, rolls the flip with crypto.randomInt(2), persists
 *    flip_winner_user_id + flip_rolled_at, sets status='awaiting_choice' and
 *    room_deadline_at = now + 120_000
 * Guarded on status='filled' AND that occupant's ready_at IS NULL.
 * Returns null if the guard failed (caller responds `wrong_state`).
 */
export function applyReady(db, id, role, deckSnapshot: DeckLists, now):
  { flipFired: boolean; flipWinnerUserId: string | null; roomDeadlineAt: number } | null;

/** T4′. Clears that occupant's ready_at AND deck_json. Never moves the deadline (R28). */
export function clearReady(db, id, role): boolean;

/**
 * T6. Guarded on status='awaiting_choice'. Writes flip_choice, flip_choice_at,
 * status='starting'. Returns the seat mapping it derived, or null if the guard failed.
 */
export function applyChoice(db, id, choice: SeatChoice, now):
  { seat0UserId: string; seat1UserId: string } | null;

/** T11. Guarded on status='filled'. Clears BOTH ready flags and BOTH snapshots. */
export function revertToOpen(db, id, restoredDeadlineAt: number): boolean;
```

`buildRoomSnapshot` and `evaluateExpiry` are pure and exhaustively unit-tested — they are where the
invariants live.

---

## 5. Behaviour

### 5.1 Transitions

T1–T10 are exactly as tabulated in `room-lifecycle-and-edge-cases.md` §4.3, with these deltas:

- **T1** writes into `duel_room`, not `duel`. No `duel` row is created. `perMoveSeconds` is bounded
  `[60, 900]` server-side (R44).
- **T6** additionally `INSERT`s the `duel` row: same `id`, same `join_token`, same `seed_json`,
  `duel_flags = EDISON_FLAGS`, `seat0_user_id`/`seat1_user_id` from the choice, both freshly minted
  seat tokens, `deck0_json`/`deck1_json` = the two locked snapshots **reordered by seat**, `status =
  'starting'`, `deadline_at` and `on_clock_seat` **NULL**. Room and duel rows are written in one
  transaction.
  Seat derivation (R3): `seat0 = flip_winner` if `choice === "first"`, else `seat0 = the other
  occupant`; `seat1` is the remaining occupant.
- **T7** is `duel.status = 'active'` plus the **first** `deadline_at` / `on_clock_seat = 0` write,
  and only after `manager.createAndStart(...)` resolves (R4). `duel_room.status` stays `starting`
  forever — the room's job is over. This replaces the write at `duel/duelRoutes.ts:151-154`.
- **T10** on engine-construction rejection: close the room `engine_failed`, broadcast, record no
  duel result (R46). The current code swallows the failure (`duelRoutes.ts:157-161`).
- **T11 (NEW — R34, overrides the discovery doc's "`filled → open` must not exist"):** the
  **invitee** leaving while `status = 'filled'` reverts the room to `open`. Clears
  `opponent_user_id`, `join_token_consumed_at`, **both** occupants' `ready_at` and `deck_json`
  (a creator left readied into a room with a new stranger is a trap), and restores
  `room_deadline_at = created_at + 30 min`. **If that restored deadline is already in the past, the
  room closes `expired_unclaimed` instead of reverting.** The creator's share block returns and they
  are told in place. Revert applies **only** to the invitee and **only** from `filled`; the creator
  leaving closes the room (T8), and any leave from `awaiting_choice` closes the room including by the
  flip loser (R35).

Transitions that must not exist: `awaiting_choice → filled` (the flip is never re-rolled, R5/I4),
anything out of `closed` (R8), and **anything driven by a socket disconnect** (R7).

### 5.2 Expiry

`evaluateExpiry(row, now)` maps `status` → reason: `open` → `expired_unclaimed`, `filled` →
`expired_idle` or `expired_ready` (whichever deadline is in force — `expired_ready` iff at least one
`ready_at` is non-NULL), `awaiting_choice` → `expired_choice`. `starting` and `closed` never expire.

Every handler and the snapshot read call it **first**, before any state check, and write the close
back before responding (R17, R20, E35). One `setTimeout` per room is armed while at least one socket
is connected and re-armed on every connect; it performs the same close and broadcasts (R17). The
lazy check is the authority; the timer is delivery only.

### 5.3 Presence

Derived, never stored. `roomBroadcast` keeps `Map<roomId, Set<{ ws, userId }>>`. An occupant is
`connected` while they hold ≥1 socket, `away` after **10 s** with none (the web client's reconnect
backoff starts at 1 s, so an ordinary refresh must never flicker to `away`), and `left` only when
`opponent_user_id`/`creator_user_id` no longer names them. Presence changes broadcast a fresh
snapshot and **never** close a room, expire a room, or move a deadline (R14). Navigating away,
closing the tab, the back button, connection loss and logout are none of them Leave (R15).

### 5.4 Ready is validate-then-write, in that order

`routes/ready.ts`: evaluate expiry → assert occupant → assert `status='filled'` → re-resolve the
deck (exists, `owner_id = caller`) → `validateDeck(...)` against the live catalog → **only then**
`applyReady`. A failure at any point rejects the ready and changes **nothing** the other player can
observe (R24, E27, E28). Write-then-validate could transiently satisfy T5's precondition and fire
the coin flip for a ready that was about to be rejected; that ordering is forbidden.

Snapshot-at-ready means editing or deleting the source deck afterwards has zero effect on the room
(R23). There is no re-validation at start — see §8.

### 5.5 The WebSocket

Path `GET /api/duels/:id/room/ws`. Handshake, in order:

1. **`Origin` must be in `CORS_ALLOWED_ORIGINS`** (`middleware/cors.ts:allowedOriginsFromEnv`), else
   destroy the socket with `403`. The `ws` server never passes through CORS middleware, so a
   cookie-authenticated socket without this check is hijackable cross-site (R11, E23). If
   `CORS_ALLOWED_ORIGINS` is empty (same-origin dev / E2E), accept a **same-host** `Origin` only.
2. Parse the `sid` cookie from the handshake `Cookie` header; `resolveSessionUser`. No token in the
   URL (R9, R11).
3. `requireOccupant`. A non-occupant is closed with `4403` (E22).
4. Send the initial `ROOM_STATE` immediately; then on every change (R12).

Any number of concurrent sockets per occupant is accepted — no one-socket-per-identity guard (R12,
E21).

**Attachment.** `attachDuelWsServer` currently does `new WebSocketServer({ server: httpServer })`
(`duel/duelSocket.ts:368`) and would race a second `WebSocketServer` for every upgrade. S0 converts
both to `{ noServer: true }` and adds one `httpServer.on("upgrade")` dispatcher in
`packages/server/src/wsUpgradeRouter.ts` that routes by pathname: `/room/ws` → room, everything else
under `/api/duels/` → board, anything else → destroy.

**R11 contingency (CEO-approved).** If the pre-flight spike shows the `sid` cookie does **not**
attach on the `app.` → `api.` upgrade in a real browser, the fallback is a **30-second, single-use
ws ticket** minted by an authenticated `POST /api/duels/:id/room/ws-ticket` and passed as
`?ticket=`. Occupant identity does **not** change: the ticket resolves to the same `user_id` and
nothing else. R11's "no token in the URL" is then amended, with the reason recorded. The `Origin`
check stays either way. Nothing outside `roomSocket.ts` and one contract addition changes, and R13's
polling path means the room still works even if the socket never connects at all.

### 5.6 Endpoints

| Method + path | Auth | Body → Response |
| --- | --- | --- |
| `POST /api/duels` | session | `CreateRoomBody` → 201 `CreateRoomResult` |
| `GET /api/duels/join/:joinToken` | **none** | → 200 `PreJoinRoomInfo` \| 404 `invalid_token` |
| `POST /api/duels/join` | session | `ClaimRoomBody` → 200 `RoomSnapshot` |
| `GET /api/duels/:id/room` | session + occupant | → 200 `RoomSnapshot` |
| `POST /api/duels/:id/room/deck` | session + occupant | `PickDeckBody` → 200 `RoomSnapshot` |
| `POST /api/duels/:id/room/ready` | session + occupant | → 200 `RoomSnapshot` |
| `POST /api/duels/:id/room/unready` | session + occupant | → 200 `RoomSnapshot` |
| `POST /api/duels/:id/room/choice` | session + flip winner | `SubmitChoiceBody` → 200 `RoomSnapshot` |
| `POST /api/duels/:id/room/leave` | session + occupant | → 200 `RoomSnapshot` |
| `GET /api/duels/:id/seat` | session + seat holder | → 200 `SeatCredential` |
| `GET /api/duels/:id/room/ws` | cookie + Origin + occupant | read-only `ROOM_STATE` stream |

Every mutation returns the caller's fresh snapshot **and** broadcasts to all other sockets, so an
HTTP-only client is never behind (R13).

`GET /api/duels/join/:joinToken` is mounted **before** `requireSession` (R41). When a session is
present it may return `you_are_the_creator` / `you_are_an_occupant`; unauthenticated callers only
ever see `ok` / `expired` / `claimed_by_other` / `closed` / `started`. It evaluates expiry with
writeback (REQ-LINK-01) and always returns the timer and the creator's display name so the public
landing (D5) can render (R41, accepted disclosure per the PRD decision log).

`POST /api/duels/join` by a user who is **already an occupant** is not an error: it returns the room
(R39, E7, E8, E10).

`GET /api/duels/:id` (`duelRoutes.ts:186-199`) is **not** extended with room fields. Its
pre-existing over-disclosure is noted in the PRD as out of scope.

---

## 6. Web file layout

| File | Owner | Contents |
| --- | --- | --- |
| `src/api/room.ts` | S0 | One typed fn per endpoint, via the existing `client.ts` (`credentials: "include"`) |
| `src/api/roomSocket.ts` | S0 | Cookie-authed room socket, reconnect with backoff, Zod-validated `ROOM_STATE` |
| `src/hooks/useRoom.ts` | S0 | Single source of room state: socket subscription + **3 s polling fallback** (R13) + `serverNow` skew correction |
| `src/screens/RoomScreen.tsx` | S0 | Shell: header, permanent rules strip, single `aria-live` status line, phase switch |
| `src/screens/room/RoomWaiting.tsx` | S2 | S2/S4/S5/S6: players panel, share block, deck picker, Ready/Unready, Leave confirm, D4 revert banner |
| `src/screens/room/RoomFlip.tsx` | S3 | S7 — the ~1.6 s reveal |
| `src/screens/room/RoomChoice.tsx` | S3 | S8/S9 |
| `src/screens/room/RoomHandoff.tsx` | S3 | S10 — 3-2-1 |
| `src/screens/room/RoomClosed.tsx` | S2 | D1 creator variant, D4 creator-left, E48 |
| `src/screens/JoinLandingScreen.tsx` | S1 | D1/D2/D3/D5 + the public logged-out landing; replaces `JoinDuelScreen.tsx` (deleted) |
| `src/screens/CreateDuelScreen.tsx` | S1 | S1: deck picker removed, presets 3/5/10/15 min, default 10 |
| `src/screens/LoginScreen.tsx` | S1 | D5b context line |
| `src/screens/DuelScreen.tsx` | S3 | Seat-token recovery — see §7 |
| `src/content/learn/how-to/start-or-join-a-duel.md` | S1 | R48 rewrite |

**Scaffolding rule.** S0 creates every file in this table that it does not own, as a minimal honest
render (heading + the status line, no styling, real data from `useRoom`). This exists so S1–S3 never
edit the same file, and so `RoomScreen`'s phase switch compiles from the first commit. Each slice
then replaces the body of the files it owns. No slice edits a file it does not own; if one needs a
change in someone else's file, it stops and reports.

The room screen's visual and copy spec is `room-ux-flows.md` — wireframes, exact copy strings, the
expiry-escalation table (§3.3), the waiting vocabulary (§10), and the accessibility rules (§11) are
requirements, not suggestions. Two of them are the most likely way to ship a broken room and are
restated here: **`prefers-reduced-motion` zeroes CSS animation durations globally
(`global.css:46-54`), so no phase transition may wait on an `animationend` event — drive every
sequence from timers**; and **`document.title` flips to `(1) Opponent joined — Edison Duel` on
arrival** (the only channel that reaches a backgrounded tab). The arrival **sound is dropped** (CEO).

---

## 7. Seat handoff, and the mock-duel fallback

`DuelScreen.tsx:133` computes `const useMock = !seatToken || locationState.useMock` — a missing seat
token silently renders a **fake duel** while the player's real clock runs (R32, R43; this is the
ZUH-21 symptom). R32 requires the seat token to be retrievable from the server, which removes the
condition that triggers it.

In scope for S3, and no more than this: `DuelScreen` takes its seat credential from
`GET /api/duels/:id/seat` whenever `location.state` has none, and `useMock` becomes **explicit-only**
(`locationState.useMock === true`). A missing or refused credential renders a real error with a way
onward, never a mock board (R43). Refreshing during `starting` therefore works (E45).

ZUH-21 stays parked for everything else it covers — whether the clock ever pauses for a dropped
player, and mid-duel reconnect grace. Do not widen S3 into those.

---

## 8. Amendments to the inherited v1 spec

Applied in the same commit as this spec, in `docs/specs/2026-07-13-v1-requirements.md`, each as an
inline superseded note (CEO-approved 2026-07-28):

- **REQ-ROOM-02** — "re-validate at Start" becomes **"re-validate at ready, snapshot on success"**.
  Under snapshot-at-ready there is nothing left to re-validate at start, and doing it there would
  kill the room after both players readied and after the flip, for a problem fixable ten minutes
  earlier. REQ-DECK-16 follows.
- **REQ-LOBBY-06** (creator revoke) and the **7-day unconsumed-link expiry** — superseded by the
  30-minute expiry and by cancel being parked (ZUH-22).
- **REQ-LOBBY-05** (one room at a time) — **not enforced** for MVP. If it is ever enforced, ZUH-22's
  cancel must ship with it, not after it.
- **REQ-ROOM-01** ("show the deck each has selected") vs **REQ-DECK-17** (a decklist is hidden
  pre-duel information) — resolved in favour of hiding: `deck selected ✓`, never the name (R25).
- **REQ-ROOM-05**'s open question ("does the toss winner choose, or does the app assign?") — closed:
  the winner chooses.
- **REQ-ROOM-07** ("either player leaving voids the pending duel") — superseded by T11 for the
  invitee-leaves-from-`filled` case only.
- **REQ-TIMER-02** — now actually implemented (R44).

---

## 9. Slices

S0 lands first and alone; S1, S2 and S3 then run in parallel on disjoint files. Every slice includes
its own tests in the same commit (`AGENTS.md`) and gates on its own package before pushing; the
repo-wide `verify` on a clean checkout is QA's gate, not the implementer's.

| Slice | Deliverable | Requirements |
| --- | --- | --- |
| **S0** | **Spine.** Contracts + migration 3 + the pure core (`roomState`, `evaluateExpiry`, `buildRoomSnapshot`) + `roomStore` (all guarded writes incl. `applyReady`/`applyChoice`/`revertToOpen`) + `roomBroadcast` + `roomSocket` (cookie + Origin) + `wsUpgradeRouter` + `resolveSessionUser` + `roomRouter` with `GET .../room` implemented + `app.ts`/`index.ts` wiring + web `api/room.ts`, `api/roomSocket.ts`, `hooks/useRoom.ts`, `RoomScreen` shell, `App.tsx` routes, and the scaffold files of §6. | R1, R2, R5–R14, R16–R20, R40, R44, R47 |
| **S1** | **Entry, links and dead ends.** `createRoom`, `lookupJoinToken` (unauth), `claimRoom`; `CreateDuelScreen` rework; `JoinLandingScreen` with all six verdicts + the public landing; `LoginScreen` resume context; learn-doc rewrite. | R21, R33 (invitee half), R37–R44, R48 |
| **S2** | **Inside the room.** `pickDeck`, `ready` (validate-then-write), `unready`, `leave` (incl. T11 revert); `RoomWaiting`, `RoomClosed`. | R15, R22–R28, R33–R35 |
| **S3** | **Flip, choice, start, handoff.** `submitChoice` (T6: seats, seat tokens, `duel` row, reordered decks), engine start + first deadline (T7), `engine_failed` close (T10), `getSeatCredential`; `RoomFlip`, `RoomChoice`, `RoomHandoff`, `DuelScreen` seat recovery. | R3, R4, R29–R32, R36, R45, R46 |
| **QA** | Acceptance suite mapping **E1–E48**, plus the whole-repo clean-checkout gate. | all |

### 9.1 Acceptance criteria (what QA verifies)

Per-slice criteria are on the Linear issues. Feature-level, all of these are pass/fail:

1. **R2/I1 as a test:** in `open`, `filled` and `awaiting_choice` there is **no `duel` row** for that
   id and no engine instance. First `duel` row insert is at T6.
2. **R5/I4:** the flip survives reconnect, refresh, and a server restart, unchanged. Rolled once.
3. **R16:** `room_deadline_at` changes exactly three times across a full happy path, and is unmoved
   by a deck pick, a deck change, an un-ready, a reconnect and the opponent's arrival.
4. **R20/E35:** a ready arriving one millisecond after the deadline is rejected and the room is
   closed with an expiry reason — never "you readied, then it expired".
5. **R24/E27/E28:** a ready rejected for an illegal or deleted deck produces **zero** change in the
   other occupant's snapshot stream.
6. **R25:** no response and no frame anywhere carries the opponent's deck name, card count or list.
   Asserted against the raw JSON of every room payload, not against the UI.
7. **R40/E9/E31:** two simultaneous claims admit exactly one; two simultaneous readies fire exactly
   one flip.
8. **R11/E22/E23:** a socket with a bad `Origin` is refused; a socket from a non-occupant with a
   valid session is refused; two sockets for the same occupant are both served.
9. **R34/E24:** invitee leave from `filled` reverts to `open` with both readies and both snapshots
   cleared and the original link live again; the same leave after the restored deadline has passed
   closes the room instead.
10. **R45:** both screens show the handoff naming who goes first, with the same countdown duration,
    before the board mounts and before any `deadline_at` exists.
11. **R46:** a forced engine-construction failure closes the room `engine_failed` with no duel
    result and no loss.
12. **R43:** no route in the feature can render the mock duel implicitly.
13. **R6:** kill and restart the server mid-room at each of `open`, `filled`, `awaiting_choice`,
    `starting`; every room resumes with the same outcome.

---

## 10. Open, and deliberately not resolved here

- **The R11 spike** (§5.5) runs in parallel with S0 and must report before S3 merges. Its only
  possible effect is the contingency in §5.5.
- The ready-up 10 min and the choice 120 s are single constants in `roomState.ts`, retunable once
  real duels have happened (PRD).
- `GET /api/duels/:id` over-disclosure: noted, not fixed, not parked (CEO).
