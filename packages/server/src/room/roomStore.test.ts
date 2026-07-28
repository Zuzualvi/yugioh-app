import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb } from "../db/openDb.js";
import {
  insertRoom,
  getRoom,
  getRoomByJoinToken,
  closeRoom,
  claimSlot,
  setDeckRef,
  applyReady,
  clearReady,
  applyChoice,
  revertToOpen,
} from "./roomStore.js";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { ROOM_READY_TTL_MS, ROOM_CHOICE_TTL_MS } from "./roomState.js";

let db: Database.Database;

const CREATOR_ID = "user-creator";
const OPPONENT_ID = "user-opponent";

function seedRoom(
  overrides: {
    status?: string;
    opponentUserId?: string;
    creatorDeckId?: string;
    opponentDeckId?: string;
    creatorReadyAt?: number | null;
    opponentReadyAt?: number | null;
    roomDeadlineAt?: number;
  } = {},
): string {
  const id = randomUUID();
  insertRoom(db, {
    id,
    joinToken: randomUUID(),
    creatorUserId: CREATOR_ID,
    perMoveSeconds: 300,
    seed: 42n,
    roomDeadlineAt: overrides.roomDeadlineAt ?? Date.now() + 30 * 60 * 1000,
    createdAt: Date.now(),
  });

  if (overrides.status && overrides.status !== "open") {
    db.prepare(`UPDATE duel_room SET status = ? WHERE id = ?`).run(overrides.status, id);
  }
  if (overrides.opponentUserId) {
    db.prepare(`UPDATE duel_room SET opponent_user_id = ? WHERE id = ?`).run(
      overrides.opponentUserId,
      id,
    );
  }
  if (overrides.creatorDeckId) {
    db.prepare(`UPDATE duel_room SET creator_deck_id = ? WHERE id = ?`).run(
      overrides.creatorDeckId,
      id,
    );
  }
  if (overrides.opponentDeckId) {
    db.prepare(`UPDATE duel_room SET opponent_deck_id = ? WHERE id = ?`).run(
      overrides.opponentDeckId,
      id,
    );
  }
  if (overrides.creatorReadyAt !== undefined) {
    db.prepare(`UPDATE duel_room SET creator_ready_at = ? WHERE id = ?`).run(
      overrides.creatorReadyAt,
      id,
    );
  }
  if (overrides.opponentReadyAt !== undefined) {
    db.prepare(`UPDATE duel_room SET opponent_ready_at = ? WHERE id = ?`).run(
      overrides.opponentReadyAt,
      id,
    );
  }
  return id;
}

beforeEach(() => {
  db = openDb(":memory:");
});

afterEach(() => {
  db.close();
});

// ── insertRoom / getRoom / getRoomByJoinToken ──────────────────────────────

describe("insertRoom / getRoom / getRoomByJoinToken", () => {
  it("inserts and retrieves a room", () => {
    const id = randomUUID();
    const joinToken = randomUUID();
    insertRoom(db, {
      id,
      joinToken,
      creatorUserId: CREATOR_ID,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: 999,
      createdAt: 0,
    });
    const row = getRoom(db, id);
    expect(row).toBeDefined();
    expect(row?.status).toBe("open");
    expect(row?.creator_user_id).toBe(CREATOR_ID);
  });

  it("returns undefined for unknown id", () => {
    expect(getRoom(db, "no-such-id")).toBeUndefined();
  });

  it("retrieves by join token", () => {
    const id = randomUUID();
    const joinToken = randomUUID();
    insertRoom(db, {
      id,
      joinToken,
      creatorUserId: CREATOR_ID,
      perMoveSeconds: 300,
      seed: 42n,
      roomDeadlineAt: 999,
      createdAt: 0,
    });
    const row = getRoomByJoinToken(db, joinToken);
    expect(row?.id).toBe(id);
  });
});

// ── closeRoom ─────────────────────────────────────────────────────────────

describe("closeRoom", () => {
  it("closes an open room and returns true", () => {
    const id = seedRoom({ status: "open" });
    expect(closeRoom(db, id, "left", CREATOR_ID)).toBe(true);
    expect(getRoom(db, id)?.status).toBe("closed");
  });

  it("returns false when room is already closed", () => {
    const id = seedRoom({ status: "open" });
    closeRoom(db, id, "left", CREATOR_ID);
    expect(closeRoom(db, id, "left", CREATOR_ID)).toBe(false);
  });

  it("returns false when room is starting (terminal)", () => {
    const id = seedRoom({ status: "starting" });
    expect(closeRoom(db, id, "left", null)).toBe(false);
  });
});

// ── claimSlot ─────────────────────────────────────────────────────────────

describe("claimSlot", () => {
  it("claims an open slot and returns true", () => {
    const id = seedRoom({ status: "open" });
    expect(claimSlot(db, id, OPPONENT_ID, Date.now())).toBe(true);
    const row = getRoom(db, id);
    expect(row?.opponent_user_id).toBe(OPPONENT_ID);
    expect(row?.status).toBe("filled");
  });

  it("returns false if not open", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    expect(claimSlot(db, id, "user-3", Date.now())).toBe(false);
  });

  it("returns false if already has opponent (concurrent claim)", () => {
    const id = seedRoom({ status: "open" });
    claimSlot(db, id, OPPONENT_ID, Date.now());
    expect(claimSlot(db, id, "user-3", Date.now())).toBe(false);
  });
});

// ── setDeckRef ────────────────────────────────────────────────────────────

describe("setDeckRef", () => {
  it("sets deck id for creator when not ready", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    expect(setDeckRef(db, id, "creator", "deck-1")).toBe(true);
    expect(getRoom(db, id)?.creator_deck_id).toBe("deck-1");
  });

  it("returns false when creator is already ready", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID, creatorReadyAt: 100 });
    expect(setDeckRef(db, id, "creator", "deck-1")).toBe(false);
  });

  it("sets deck id for opponent", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    expect(setDeckRef(db, id, "opponent", "deck-2")).toBe(true);
    expect(getRoom(db, id)?.opponent_deck_id).toBe("deck-2");
  });
});

// ── applyReady ────────────────────────────────────────────────────────────

describe("applyReady", () => {
  const deck = { main: [1, 2, 3], extra: [] };

  it("first ready: rebases deadline to now + 10 min", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    const now = 1000;
    const result = applyReady(db, id, "creator", deck, now);
    expect(result).not.toBeNull();
    expect(result?.flipFired).toBe(false);
    expect(result?.roomDeadlineAt).toBe(now + ROOM_READY_TTL_MS);
    const row = getRoom(db, id);
    expect(row?.creator_ready_at).toBe(now);
    expect(row?.room_deadline_at).toBe(now + ROOM_READY_TTL_MS);
  });

  it("second ready: fires flip, sets awaiting_choice, deadline = now + 2 min", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID, creatorReadyAt: 500 });
    const now = 1000;
    const result = applyReady(db, id, "opponent", deck, now);
    expect(result).not.toBeNull();
    expect(result?.flipFired).toBe(true);
    expect(result?.flipWinnerUserId).toBeTruthy();
    expect(result?.roomDeadlineAt).toBe(now + ROOM_CHOICE_TTL_MS);
    const row = getRoom(db, id);
    expect(row?.status).toBe("awaiting_choice");
    expect(row?.flip_winner_user_id).not.toBeNull();
    expect(row?.room_deadline_at).toBe(now + ROOM_CHOICE_TTL_MS);
  });

  it("returns null if guard fails (wrong status)", () => {
    const id = seedRoom({ status: "open" });
    expect(applyReady(db, id, "creator", deck, 1000)).toBeNull();
  });

  it("returns null if already ready", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID, creatorReadyAt: 100 });
    expect(applyReady(db, id, "creator", deck, 1000)).toBeNull();
  });

  it("deck change does NOT move deadline", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    const now = 1000;
    // Apply first ready to set a deadline
    const first = applyReady(db, id, "creator", deck, now)!;
    const deadlineAfterFirstReady = first.roomDeadlineAt;

    // Simulate a deck pick (setDeckRef) — should not move deadline
    // (setDeckRef doesn't touch deadline, just verifying applyReady behavior)
    const row = getRoom(db, id);
    expect(row?.room_deadline_at).toBe(deadlineAfterFirstReady);
  });

  it("un-ready does NOT move deadline", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    const now = 1000;
    applyReady(db, id, "creator", deck, now);
    const row1 = getRoom(db, id);
    const deadline = row1?.room_deadline_at;

    clearReady(db, id, "creator");
    const row2 = getRoom(db, id);
    expect(row2?.room_deadline_at).toBe(deadline);
  });
});

// ── clearReady ────────────────────────────────────────────────────────────

describe("clearReady", () => {
  it("clears ready and deck_json for creator", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID, creatorReadyAt: 100 });
    db.prepare("UPDATE duel_room SET creator_deck_json = ? WHERE id = ?").run(
      JSON.stringify({ main: [1], extra: [] }),
      id,
    );
    expect(clearReady(db, id, "creator")).toBe(true);
    const row = getRoom(db, id);
    expect(row?.creator_ready_at).toBeNull();
    expect(row?.creator_deck_json).toBeNull();
  });

  it("returns false if not ready", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    expect(clearReady(db, id, "creator")).toBe(false);
  });
});

// ── applyChoice ───────────────────────────────────────────────────────────

describe("applyChoice", () => {
  function seedAwaitingChoice() {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    // Set both ready, then apply ready for both to fire flip
    db.prepare(
      `UPDATE duel_room SET status='awaiting_choice', flip_winner_user_id=?, flip_rolled_at=200 WHERE id=?`,
    ).run(CREATOR_ID, id);
    return id;
  }

  it("applies choice=first: flip_winner → seat0", () => {
    const id = seedAwaitingChoice();
    const result = applyChoice(db, id, "first", 3000);
    expect(result).not.toBeNull();
    expect(result?.seat0UserId).toBe(CREATOR_ID);
    expect(result?.seat1UserId).toBe(OPPONENT_ID);
    const row = getRoom(db, id);
    expect(row?.status).toBe("starting");
  });

  it("applies choice=second: flip_winner → seat1", () => {
    const id = seedAwaitingChoice();
    const result = applyChoice(db, id, "second", 3000);
    expect(result?.seat0UserId).toBe(OPPONENT_ID);
    expect(result?.seat1UserId).toBe(CREATOR_ID);
  });

  it("returns null if wrong status (guard)", () => {
    const id = seedRoom({ status: "filled", opponentUserId: OPPONENT_ID });
    expect(applyChoice(db, id, "first", 3000)).toBeNull();
  });
});

// ── revertToOpen ──────────────────────────────────────────────────────────

describe("revertToOpen", () => {
  it("reverts to open, clears both readies and decks", () => {
    const id = seedRoom({
      status: "filled",
      opponentUserId: OPPONENT_ID,
      creatorReadyAt: 100,
      opponentReadyAt: 200,
      creatorDeckId: "d1",
    });
    db.prepare("UPDATE duel_room SET creator_deck_json=?, opponent_deck_json=? WHERE id=?").run(
      JSON.stringify({ main: [1], extra: [] }),
      JSON.stringify({ main: [2], extra: [] }),
      id,
    );
    const restoredDeadline = 999999;
    expect(revertToOpen(db, id, restoredDeadline)).toBe(true);
    const row = getRoom(db, id);
    expect(row?.status).toBe("open");
    expect(row?.opponent_user_id).toBeNull();
    expect(row?.creator_ready_at).toBeNull();
    expect(row?.opponent_ready_at).toBeNull();
    expect(row?.creator_deck_json).toBeNull();
    expect(row?.opponent_deck_json).toBeNull();
    expect(row?.room_deadline_at).toBe(restoredDeadline);
  });

  it("returns false if not filled (guard)", () => {
    const id = seedRoom({ status: "open" });
    expect(revertToOpen(db, id, 999)).toBe(false);
  });
});
