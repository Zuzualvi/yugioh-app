import { Router } from "express";
import type Database from "better-sqlite3";
import { MIGRATION_COUNT } from "../db/migrate.js";

// ---------------------------------------------------------------------------
// createOpsRouter — bounded read + hard-delete endpoints for production ops.
//
// Mounted at /api/ops BEHIND requireOpsToken — do not call without that guard.
// All responses are application/json.
// Every request logs one stdout line: method, path, status (+ row counts for deletes).
// NEVER include passwordHash, seat0_token, seat1_token, join_token, seed_json,
// creator_deck_json, or opponent_deck_json in any response.
// ---------------------------------------------------------------------------

type Db = InstanceType<typeof Database>;

// Table names explicitly allowed for the counts query — no parameters accepted.
const COUNT_TABLES = [
  "users",
  "invites",
  "sessions",
  "decks",
  "duel",
  "duel_room",
  "response_log",
] as const;

// camelCase key names matching the locked contract
const COUNT_KEYS: Record<(typeof COUNT_TABLES)[number], string> = {
  users: "users",
  invites: "invites",
  sessions: "sessions",
  decks: "decks",
  duel: "duel",
  duel_room: "duelRoom",
  response_log: "responseLog",
};

export function createOpsRouter(db: Db): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/ops/migrations
  // Returns applied migration rows, latest version, expected count, upToDate.
  // -------------------------------------------------------------------------
  router.get("/migrations", (req, res) => {
    const rows = db
      .prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version ASC")
      .all() as Array<{ version: number; applied_at: string }>;

    const applied = rows.map((r) => ({ version: r.version, appliedAt: r.applied_at }));
    const latest = applied.length > 0 ? (applied[applied.length - 1]?.version ?? null) : null;
    const expected = MIGRATION_COUNT;
    const upToDate = latest === expected;

    const body = { applied, latest, expected, upToDate };
    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json(body);
  });

  // -------------------------------------------------------------------------
  // GET /api/ops/counts
  // Returns row counts for the seven hardcoded tables.
  // -------------------------------------------------------------------------
  router.get("/counts", (req, res) => {
    const counts: Record<string, number> = {};
    for (const table of COUNT_TABLES) {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
      counts[COUNT_KEYS[table]] = row.n;
    }
    const body = { counts };
    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json(body);
  });

  // -------------------------------------------------------------------------
  // GET /api/ops/users?displayName=<exact>
  // Exact-match lookup, capped at 50 rows, never returns passwordHash.
  // -------------------------------------------------------------------------
  router.get("/users", (req, res) => {
    const { displayName } = req.query;
    if (typeof displayName !== "string" || displayName.trim() === "") {
      console.log(`${req.method} ${req.originalUrl} 400`);
      res.status(400).json({
        error: { code: "invalid_input", message: "displayName query parameter required." },
      });
      return;
    }

    const rows = db
      .prepare(
        "SELECT id, display_name, role, created_at FROM users WHERE display_name = ? LIMIT 50",
      )
      .all(displayName) as Array<{
      id: string;
      display_name: string;
      role: string;
      created_at: string;
    }>;

    const users = rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      role: r.role,
      createdAt: r.created_at,
    }));

    const body = { users };
    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json(body);
  });

  // -------------------------------------------------------------------------
  // GET /api/ops/user/:id
  // Single user detail with aggregate counts. Never returns passwordHash.
  // -------------------------------------------------------------------------
  router.get("/user/:id", (req, res) => {
    const { id } = req.params;

    const row = db
      .prepare("SELECT id, display_name, role, created_at FROM users WHERE id = ?")
      .get(id) as
      { id: string; display_name: string; role: string; created_at: string } | undefined;

    if (!row) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "User not found." } });
      return;
    }

    const deckCount = (
      db.prepare("SELECT COUNT(*) AS n FROM decks WHERE owner_id = ?").get(id) as { n: number }
    ).n;
    const sessionCount = (
      db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(id) as { n: number }
    ).n;
    const roomCount = (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM duel_room WHERE creator_user_id = ? OR opponent_user_id = ?",
        )
        .get(id, id) as { n: number }
    ).n;
    const duelCount = (
      db
        .prepare("SELECT COUNT(*) AS n FROM duel WHERE seat0_user_id = ? OR seat1_user_id = ?")
        .get(id, id) as { n: number }
    ).n;

    const user = {
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      createdAt: row.created_at,
      deckCount,
      sessionCount,
      roomCount,
      duelCount,
    };

    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json({ user });
  });

  // -------------------------------------------------------------------------
  // GET /api/ops/duel/:id
  // Single duel row — never returns seat tokens, deck json, or seed_json.
  // -------------------------------------------------------------------------
  router.get("/duel/:id", (req, res) => {
    const { id } = req.params;

    const row = db
      .prepare(
        `SELECT id, status, winner, end_reason, seat0_user_id, seat1_user_id,
                on_clock_seat, deadline_at, created_at
         FROM duel WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          status: string;
          winner: number | null;
          end_reason: string | null;
          seat0_user_id: string;
          seat1_user_id: string | null;
          on_clock_seat: number | null;
          deadline_at: number | null;
          created_at: number;
        }
      | undefined;

    if (!row) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "Duel not found." } });
      return;
    }

    const responseLogCount = (
      db.prepare("SELECT COUNT(*) AS n FROM response_log WHERE duel_id = ?").get(id) as {
        n: number;
      }
    ).n;

    const duel = {
      id: row.id,
      status: row.status,
      winner: row.winner,
      endReason: row.end_reason,
      seat0UserId: row.seat0_user_id,
      seat1UserId: row.seat1_user_id,
      onClockSeat: row.on_clock_seat,
      deadlineAt: row.deadline_at,
      createdAt: row.created_at,
      responseLogCount,
    };

    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json({ duel });
  });

  // -------------------------------------------------------------------------
  // GET /api/ops/room/:id
  // Single duel_room row — never returns join_token or deck json.
  // -------------------------------------------------------------------------
  router.get("/room/:id", (req, res) => {
    const { id } = req.params;

    const row = db
      .prepare(
        `SELECT id, status, closed_reason, creator_user_id, opponent_user_id,
                creator_deck_name, opponent_deck_name,
                creator_ready_at, opponent_ready_at,
                flip_winner_user_id, flip_choice,
                room_deadline_at, created_at
         FROM duel_room WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          status: string;
          closed_reason: string | null;
          creator_user_id: string;
          opponent_user_id: string | null;
          creator_deck_name: string | null;
          opponent_deck_name: string | null;
          creator_ready_at: number | null;
          opponent_ready_at: number | null;
          flip_winner_user_id: string | null;
          flip_choice: string | null;
          room_deadline_at: number;
          created_at: number;
        }
      | undefined;

    if (!row) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "Room not found." } });
      return;
    }

    const room = {
      id: row.id,
      status: row.status,
      closedReason: row.closed_reason,
      creatorUserId: row.creator_user_id,
      opponentUserId: row.opponent_user_id,
      creatorDeckName: row.creator_deck_name,
      opponentDeckName: row.opponent_deck_name,
      creatorReadyAt: row.creator_ready_at,
      opponentReadyAt: row.opponent_ready_at,
      flipWinnerUserId: row.flip_winner_user_id,
      flipChoice: row.flip_choice,
      roomDeadlineAt: row.room_deadline_at,
      createdAt: row.created_at,
    };

    console.log(`${req.method} ${req.originalUrl} 200`);
    res.json({ room });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/ops/duel/:id
  // Hard-deletes response_log rows then the duel row, in a transaction.
  // Returns the actual row counts removed.
  // -------------------------------------------------------------------------
  router.delete("/duel/:id", (req, res) => {
    const { id } = req.params;

    const exists = db.prepare("SELECT 1 FROM duel WHERE id = ?").get(id);
    if (!exists) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "Duel not found." } });
      return;
    }

    const result = db.transaction(() => {
      const logDel = db.prepare("DELETE FROM response_log WHERE duel_id = ?").run(id);
      const duelDel = db.prepare("DELETE FROM duel WHERE id = ?").run(id);
      return { responseLog: logDel.changes, duel: duelDel.changes };
    })();

    const body = { deleted: { duel: result.duel, responseLog: result.responseLog } };
    console.log(
      `${req.method} ${req.originalUrl} 200 duel=${result.duel} responseLog=${result.responseLog}`,
    );
    res.json(body);
  });

  // -------------------------------------------------------------------------
  // DELETE /api/ops/room/:id
  // Hard-deletes the duel_room row. Does NOT touch any associated duel.
  // -------------------------------------------------------------------------
  router.delete("/room/:id", (req, res) => {
    const { id } = req.params;

    const exists = db.prepare("SELECT 1 FROM duel_room WHERE id = ?").get(id);
    if (!exists) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "Room not found." } });
      return;
    }

    const result = db.transaction(() => {
      const roomDel = db.prepare("DELETE FROM duel_room WHERE id = ?").run(id);
      return { duelRoom: roomDel.changes };
    })();

    const body = { deleted: { duelRoom: result.duelRoom } };
    console.log(`${req.method} ${req.originalUrl} 200 duelRoom=${result.duelRoom}`);
    res.json(body);
  });

  // -------------------------------------------------------------------------
  // DELETE /api/ops/user/:id
  // Hard-deletes a user and all dependent rows, in a single transaction.
  // Cascade order per spec: response_log → duel → duel_room → decks →
  //   sessions → invites → users
  // Guard: refuse with 409 if this is the last admin.
  // -------------------------------------------------------------------------
  router.delete("/user/:id", (req, res) => {
    const { id } = req.params;

    const userRow = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) as
      { id: string; role: string } | undefined;

    if (!userRow) {
      console.log(`${req.method} ${req.originalUrl} 404`);
      res.status(404).json({ error: { code: "not_found", message: "User not found." } });
      return;
    }

    if (userRow.role === "admin") {
      const adminCount = (
        db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }
      ).n;
      if (adminCount === 1) {
        console.log(`${req.method} ${req.originalUrl} 409`);
        res.status(409).json({
          error: { code: "last_admin", message: "Refusing to delete the only admin." },
        });
        return;
      }
    }

    const result = db.transaction(() => {
      // 1. Find all duel ids where the user holds a seat
      const duelIds = (
        db
          .prepare("SELECT id FROM duel WHERE seat0_user_id = ? OR seat1_user_id = ?")
          .all(id, id) as Array<{ id: string }>
      ).map((r) => r.id);

      // 2. Delete response_log rows for those duels
      let responseLogCount = 0;
      for (const duelId of duelIds) {
        const del = db.prepare("DELETE FROM response_log WHERE duel_id = ?").run(duelId);
        responseLogCount += del.changes;
      }

      // 3. Delete those duel rows
      const duelDel = db
        .prepare("DELETE FROM duel WHERE seat0_user_id = ? OR seat1_user_id = ?")
        .run(id, id);

      // 4. Delete duel_room rows where user is creator or opponent
      const roomDel = db
        .prepare("DELETE FROM duel_room WHERE creator_user_id = ? OR opponent_user_id = ?")
        .run(id, id);

      // 5. Delete decks owned by user
      const decksDel = db.prepare("DELETE FROM decks WHERE owner_id = ?").run(id);

      // 6. Delete sessions held by user
      const sessionsDel = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);

      // 7. Delete invites where user is created_by OR consumed_by
      const invitesDel = db
        .prepare("DELETE FROM invites WHERE created_by = ? OR consumed_by = ?")
        .run(id, id);

      // 8. Delete the user row itself
      const userDel = db.prepare("DELETE FROM users WHERE id = ?").run(id);

      return {
        user: userDel.changes,
        sessions: sessionsDel.changes,
        decks: decksDel.changes,
        invites: invitesDel.changes,
        duelRoom: roomDel.changes,
        duel: duelDel.changes,
        responseLog: responseLogCount,
      };
    })();

    const body = { deleted: result };
    console.log(
      `${req.method} ${req.originalUrl} 200 ` +
        `user=${result.user} sessions=${result.sessions} decks=${result.decks} ` +
        `invites=${result.invites} duelRoom=${result.duelRoom} duel=${result.duel} responseLog=${result.responseLog}`,
    );
    res.json(body);
  });

  return router;
}
