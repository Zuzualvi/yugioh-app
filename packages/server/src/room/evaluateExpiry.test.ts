import { describe, it, expect } from "vitest";
import { evaluateExpiry } from "./evaluateExpiry.js";
import type { DuelRoomRow } from "./roomStore.js";

const BASE_ROW: DuelRoomRow = {
  id: "room-1",
  join_token: "tok",
  join_token_consumed_at: null,
  creator_user_id: "user-c",
  opponent_user_id: null,
  timer_per_move_seconds: 300,
  seed_json: '"42"',
  creator_deck_id: null,
  opponent_deck_id: null,
  creator_deck_json: null,
  creator_deck_name: null,
  opponent_deck_json: null,
  opponent_deck_name: null,
  creator_ready_at: null,
  opponent_ready_at: null,
  room_deadline_at: 1000,
  flip_winner_user_id: null,
  flip_rolled_at: null,
  flip_choice: null,
  flip_choice_at: null,
  status: "open",
  closed_reason: null,
  closed_by_user_id: null,
  created_at: 0,
};

describe("evaluateExpiry", () => {
  it("returns not-expired when now < deadline", () => {
    const r = evaluateExpiry({ ...BASE_ROW, status: "open", room_deadline_at: 2000 }, 1000);
    expect(r.expired).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("open → expired_unclaimed when now >= deadline", () => {
    const r = evaluateExpiry({ ...BASE_ROW, status: "open", room_deadline_at: 1000 }, 1001);
    expect(r.expired).toBe(true);
    expect(r.reason).toBe("expired_unclaimed");
  });

  it("filled no readies → expired_idle", () => {
    const r = evaluateExpiry(
      {
        ...BASE_ROW,
        status: "filled",
        room_deadline_at: 1000,
        creator_ready_at: null,
        opponent_ready_at: null,
      },
      1001,
    );
    expect(r.expired).toBe(true);
    expect(r.reason).toBe("expired_idle");
  });

  it("filled with creator ready → expired_ready", () => {
    const r = evaluateExpiry(
      {
        ...BASE_ROW,
        status: "filled",
        room_deadline_at: 1000,
        creator_ready_at: 500,
        opponent_ready_at: null,
      },
      1001,
    );
    expect(r.expired).toBe(true);
    expect(r.reason).toBe("expired_ready");
  });

  it("filled with opponent ready → expired_ready", () => {
    const r = evaluateExpiry(
      {
        ...BASE_ROW,
        status: "filled",
        room_deadline_at: 1000,
        creator_ready_at: null,
        opponent_ready_at: 500,
      },
      1001,
    );
    expect(r.expired).toBe(true);
    expect(r.reason).toBe("expired_ready");
  });

  it("awaiting_choice → expired_choice", () => {
    const r = evaluateExpiry(
      { ...BASE_ROW, status: "awaiting_choice", room_deadline_at: 1000 },
      1001,
    );
    expect(r.expired).toBe(true);
    expect(r.reason).toBe("expired_choice");
  });

  it("starting never expires", () => {
    const r = evaluateExpiry({ ...BASE_ROW, status: "starting", room_deadline_at: 0 }, 99999);
    expect(r.expired).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("closed never expires", () => {
    const r = evaluateExpiry(
      { ...BASE_ROW, status: "closed", closed_reason: "left", room_deadline_at: 0 },
      99999,
    );
    expect(r.expired).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("at exactly the deadline is expired (>=)", () => {
    const r = evaluateExpiry({ ...BASE_ROW, status: "open", room_deadline_at: 1000 }, 1000);
    expect(r.expired).toBe(true);
  });
});
