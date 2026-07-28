# ADR 0002 — The pre-duel room is its own table; the `duel` row is created at seat assignment

**Status:** Accepted
**Date:** 2026-07-28
**Decided by:** CTO. The requirement it amends (R2's letter) was approved by the CEO.
**Spec:** `docs/specs/2026-07-28-pre-duel-room-implementation.md` §1.1, §3
**Project:** Duel Invite Improvements

---

## Context

The Duel Invite Improvements feature puts a pre-duel room in front of every duel. Two of its
requirements pull against each other at the schema level:

- **R2 (MUST):** while the room is `open`, `filled` or `awaiting_choice`, all of `seat0/1_user_id`,
  `seat0/1_token`, `deck0/1_json`, `deadline_at` and `on_clock_seat` are NULL and no engine exists
  for that id.
- **R47 (MUST):** the room and the duel share one id for their whole life, so the room URL and the
  board URL address the same object.

R47 reads as "the room *is* a duel row". But the `duel` table declares `seat0_token`, `seat1_token`,
`seat0_user_id`, `seed_json` and `deck0_json` as `NOT NULL` (`packages/server/src/db/migrate.ts:58-76`)
— every one of which R2 requires to be absent for the room's entire pre-flip life. SQLite cannot drop
a `NOT NULL` constraint in place, so satisfying R2 literally means a table rebuild that relaxes five
columns.

This matters more than a migration's cost. Those five constraints are the only thing that currently
makes "a duel row implies a playable duel" true in the database rather than in a convention. Every
existing read path — `duelStore`, `duelManager`, `duelSocket` — is written against that guarantee.

## Decision

Add a new table, `duel_room`, holding the entire room. Its primary key **is** the duel id. The
`duel` row is `INSERT`ed at exactly one moment: T6, the flip winner submitting first-or-second, when
seats, seat tokens and both locked deck snapshots all exist at once. `duel_room` rows are never
deleted; the room's `starting` status is its terminal non-closed state.

R2's *letter* is therefore amended: the fields are **absent**, not NULL. Its *intent* — nothing
engine-shaped exists before the flip resolves — is strengthened, because it becomes a schema
guarantee instead of a nullable column plus a comment. R47 holds unchanged: `duel_room.id = duel.id`,
so `/duel/:id/room` and `/duel/:id` address the same object and no id is ever handed off. R6 holds:
the complete room state is reconstructible from the single `duel_room` row.

## Alternatives considered

1. **Relax the five `NOT NULL` constraints on `duel` (rebuild the table) and let a room be a duel row
   in an incomplete state.** This is the reading the requirement's wording suggests. Rejected: it
   deletes the invariant that a `duel` row is playable, in a codebase where three modules already
   depend on it, and it replaces a compile-time-ish guarantee with a runtime discipline that every
   future change must remember. It also means a rebuild migration on the one table holding live data.
2. **A `duel_room` table with its own id, plus a foreign key to a `duel` created later.** Rejected: it
   breaks R47 directly. The room URL and the board URL would address different objects and the room
   would have to hand off an id at its most fragile moment — exactly the class of handoff that
   produced ZUH-21.
3. **Keep the room entirely in memory until the flip resolves.** Rejected outright: R6 requires a
   restart to lose no room and change no outcome, and the server has no scheduler or shared cache.

## Consequences

- Migration 3 is purely additive: one `CREATE TABLE`, one index, no existing table altered, no data
  migration, no downtime.
- `DuelStatusSchema` gains `"starting"` so the `duel` row can exist for the moments between seat
  assignment and the engine being up (recoverable per E47).
- Two tables now share a primary key with no foreign key between them, which will look wrong to
  someone reading the schema cold — hence this ADR. The join is always `duel_room.id = duel.id`, and
  the direction is one-way: a `duel_room` may exist without a `duel`, never the reverse.
- The room's own reads never touch the `duel` table, so nothing in the room path can accidentally
  observe or mutate engine state.
