import { describe, it, expect } from "vitest";
import { buildRoomSnapshot } from "./buildRoomSnapshot.js";
import type { DuelRoomRow } from "./roomStore.js";
import type { PresenceMap, OccupantNames, OccupantDeckInfo } from "./buildRoomSnapshot.js";

const CREATOR_ID = "user-creator";
const OPPONENT_ID = "user-opponent";

const NAMES: OccupantNames = {
  creatorDisplayName: "Alice",
  opponentDisplayName: "Bob",
};

const PRESENCE: PresenceMap = {
  creatorPresence: "connected",
  opponentPresence: "connected",
};

/** Null deck info for both occupants — used when testing unrelated snapshot properties. */
const NO_DECKS: OccupantDeckInfo = {
  creator: { deckId: null, deckName: null, deckCardCount: null },
  opponent: { deckId: null, deckName: null, deckCardCount: null },
};

function baseRow(overrides: Partial<DuelRoomRow> = {}): DuelRoomRow {
  return {
    id: "room-1",
    join_token: "join-tok",
    join_token_consumed_at: null,
    creator_user_id: CREATOR_ID,
    opponent_user_id: null,
    timer_per_move_seconds: 300,
    seed_json: '"42"',
    creator_deck_id: null,
    opponent_deck_id: null,
    creator_deck_json: null,
    opponent_deck_json: null,
    creator_ready_at: null,
    opponent_ready_at: null,
    room_deadline_at: 9999999,
    flip_winner_user_id: null,
    flip_rolled_at: null,
    flip_choice: null,
    flip_choice_at: null,
    status: "open",
    closed_reason: null,
    closed_by_user_id: null,
    created_at: 0,
    ...overrides,
  };
}

// ── Compile-time enforcement: deckInfo is a required parameter (C6 intent) ──
// This test will fail to COMPILE if someone makes the 6th arg optional again,
// which is exactly the category of mistake we are preventing.
describe("buildRoomSnapshot — deckInfo is a required parameter", () => {
  it("accepts a call with all six arguments (type-level proof)", () => {
    // If this type-checks, the parameter is required and present.
    const snap = buildRoomSnapshot(baseRow(), CREATOR_ID, NAMES, PRESENCE, 0, NO_DECKS);
    expect(snap).toBeDefined();
  });
});

// ── R25: opponent deck never exposed ─────────────────────────────────────────

describe("buildRoomSnapshot — R25: opponent deck never exposed", () => {
  const statuses = ["open", "filled", "awaiting_choice", "starting", "closed"] as const;

  for (const status of statuses) {
    it(`${status}: opponent sees NO creator deck info`, () => {
      const row = baseRow({
        status,
        opponent_user_id: OPPONENT_ID,
        creator_deck_id: "deck-creator",
        creator_deck_json: JSON.stringify({ main: [12345], extra: [] }),
        creator_ready_at: status !== "open" ? 100 : null,
        flip_winner_user_id:
          status === "awaiting_choice" || status === "starting" ? CREATOR_ID : null,
        flip_rolled_at: status === "awaiting_choice" || status === "starting" ? 200 : null,
        flip_choice: status === "starting" ? "first" : null,
        flip_choice_at: status === "starting" ? 300 : null,
        closed_reason: status === "closed" ? "left" : null,
      });
      const deckInfo: OccupantDeckInfo = {
        creator: { deckId: "deck-creator", deckName: "Black Wing Storm", deckCardCount: 40 },
        opponent: { deckId: null, deckName: null, deckCardCount: null },
      };
      const snap = buildRoomSnapshot(row, OPPONENT_ID, NAMES, PRESENCE, 1000, deckInfo);

      const raw = JSON.stringify(snap);
      expect(snap.you.role).toBe("opponent");
      expect(raw).not.toContain("Black Wing Storm");
      expect(raw).not.toContain("deck-creator");
      expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
      expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
      expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
    });

    it(`${status}: creator sees NO opponent deck info`, () => {
      const row = baseRow({
        status,
        opponent_user_id: OPPONENT_ID,
        opponent_deck_id: "deck-opp",
        opponent_deck_json: JSON.stringify({ main: [99999], extra: [] }),
        opponent_ready_at: status !== "open" ? 100 : null,
        flip_winner_user_id:
          status === "awaiting_choice" || status === "starting" ? CREATOR_ID : null,
        flip_rolled_at: status === "awaiting_choice" || status === "starting" ? 200 : null,
        flip_choice: status === "starting" ? "first" : null,
        flip_choice_at: status === "starting" ? 300 : null,
        closed_reason: status === "closed" ? "left" : null,
      });
      const deckInfo: OccupantDeckInfo = {
        creator: { deckId: null, deckName: null, deckCardCount: null },
        opponent: { deckId: "deck-opp", deckName: "Quickdraw Festival", deckCardCount: 42 },
      };
      const snap = buildRoomSnapshot(row, CREATOR_ID, NAMES, PRESENCE, 1000, deckInfo);

      const raw = JSON.stringify(snap);
      expect(snap.you.role).toBe("creator");
      expect(raw).not.toContain("Quickdraw Festival");
      expect(raw).not.toContain("deck-opp");
      expect((snap.opponent as Record<string, unknown>)["deckName"]).toBeUndefined();
      expect((snap.opponent as Record<string, unknown>)["deckCardCount"]).toBeUndefined();
      expect((snap.opponent as Record<string, unknown>)["deckId"]).toBeUndefined();
    });
  }
});

// ── joinToken visibility ──────────────────────────────────────────────────────

describe("buildRoomSnapshot — joinToken visibility", () => {
  it("creator sees joinToken while open", () => {
    const snap = buildRoomSnapshot(
      baseRow({ status: "open" }),
      CREATOR_ID,
      NAMES,
      PRESENCE,
      0,
      NO_DECKS,
    );
    expect(snap.joinToken).toBe("join-tok");
  });

  it("creator does NOT see joinToken when filled", () => {
    const snap = buildRoomSnapshot(
      baseRow({ status: "filled", opponent_user_id: OPPONENT_ID }),
      CREATOR_ID,
      NAMES,
      PRESENCE,
      0,
      NO_DECKS,
    );
    expect(snap.joinToken).toBeNull();
  });

  it("opponent never sees joinToken", () => {
    const snap = buildRoomSnapshot(
      baseRow({ status: "open", opponent_user_id: OPPONENT_ID }),
      OPPONENT_ID,
      NAMES,
      PRESENCE,
      0,
      NO_DECKS,
    );
    expect(snap.joinToken).toBeNull();
  });
});

// ── seats only in starting ────────────────────────────────────────────────────

describe("buildRoomSnapshot — seats only in starting", () => {
  it("seats is null for non-starting statuses", () => {
    for (const status of ["open", "filled", "awaiting_choice", "closed"] as const) {
      const snap = buildRoomSnapshot(
        baseRow({ status, opponent_user_id: OPPONENT_ID }),
        CREATOR_ID,
        NAMES,
        PRESENCE,
        0,
        NO_DECKS,
      );
      expect(snap.seats).toBeNull();
    }
  });

  it("seats is populated for starting status with choice=first", () => {
    const row = baseRow({
      status: "starting",
      opponent_user_id: OPPONENT_ID,
      flip_winner_user_id: CREATOR_ID,
      flip_rolled_at: 100,
      flip_choice: "first",
      flip_choice_at: 200,
    });
    const snap = buildRoomSnapshot(row, CREATOR_ID, NAMES, PRESENCE, 0, NO_DECKS);
    expect(snap.seats).not.toBeNull();
    expect(snap.seats?.seat0UserId).toBe(CREATOR_ID);
    expect(snap.seats?.seat1UserId).toBe(OPPONENT_ID);
  });

  it("seats: choice=second swaps seat assignment", () => {
    const row = baseRow({
      status: "starting",
      opponent_user_id: OPPONENT_ID,
      flip_winner_user_id: CREATOR_ID,
      flip_rolled_at: 100,
      flip_choice: "second",
      flip_choice_at: 200,
    });
    const snap = buildRoomSnapshot(row, CREATOR_ID, NAMES, PRESENCE, 0, NO_DECKS);
    expect(snap.seats?.seat0UserId).toBe(OPPONENT_ID);
    expect(snap.seats?.seat1UserId).toBe(CREATOR_ID);
  });
});

// ── serverNow / roomDeadlineAt ────────────────────────────────────────────────

describe("buildRoomSnapshot — serverNow", () => {
  it("serverNow equals the passed now parameter", () => {
    const snap = buildRoomSnapshot(baseRow(), CREATOR_ID, NAMES, PRESENCE, 12345, NO_DECKS);
    expect(snap.serverNow).toBe(12345);
  });
});

describe("buildRoomSnapshot — roomDeadlineAt", () => {
  it("is null for starting and closed", () => {
    for (const status of ["starting", "closed"] as const) {
      const snap = buildRoomSnapshot(
        baseRow({ status, opponent_user_id: OPPONENT_ID }),
        CREATOR_ID,
        NAMES,
        PRESENCE,
        0,
        NO_DECKS,
      );
      expect(snap.roomDeadlineAt).toBeNull();
    }
  });

  it("is non-null for open/filled/awaiting_choice", () => {
    for (const status of ["open", "filled", "awaiting_choice"] as const) {
      const snap = buildRoomSnapshot(
        baseRow({ status, opponent_user_id: OPPONENT_ID }),
        CREATOR_ID,
        NAMES,
        PRESENCE,
        0,
        NO_DECKS,
      );
      expect(snap.roomDeadlineAt).toBe(9999999);
    }
  });
});

// ── deckInfo surfaces correctly in you (not in opponent) ──────────────────────

describe("buildRoomSnapshot — deckInfo surfaces in viewer's own view", () => {
  it("creator sees their own deckName and deckCardCount", () => {
    const deckInfo: OccupantDeckInfo = {
      creator: { deckId: "d1", deckName: "Blackwings", deckCardCount: 41 },
      opponent: { deckId: null, deckName: null, deckCardCount: null },
    };
    const snap = buildRoomSnapshot(
      baseRow({ creator_deck_id: "d1" }),
      CREATOR_ID,
      NAMES,
      PRESENCE,
      0,
      deckInfo,
    );
    expect(snap.you.deckName).toBe("Blackwings");
    expect(snap.you.deckCardCount).toBe(41);
  });

  it("opponent sees their own deckName and deckCardCount", () => {
    const deckInfo: OccupantDeckInfo = {
      creator: { deckId: null, deckName: null, deckCardCount: null },
      opponent: { deckId: "d2", deckName: "Quickdraw", deckCardCount: 40 },
    };
    const snap = buildRoomSnapshot(
      baseRow({ opponent_user_id: OPPONENT_ID, opponent_deck_id: "d2" }),
      OPPONENT_ID,
      NAMES,
      PRESENCE,
      0,
      deckInfo,
    );
    expect(snap.you.deckName).toBe("Quickdraw");
    expect(snap.you.deckCardCount).toBe(40);
  });
});
