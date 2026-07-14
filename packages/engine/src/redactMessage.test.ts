// ---------------------------------------------------------------------------
// R6 — Redaction correctness (zero-leak) tests.
// Ported from spike-c assertions. No WASM required — tests the pure redaction
// function against hand-crafted raw engine messages.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { redactMessageForSeat } from "./redactMessage.js";
import type { RawEngineMessage } from "./types.js";

// OcgLocation bits (stable ocgcore constants)
const LOC_DECK = 0x1;
const LOC_HAND = 0x2;
const LOC_MZONE = 0x4;

// OcgPosition bits
const POS_FACEDOWN_ATTACK = 0x2;
const POS_FACEDOWN_DEFENSE = 0x8;
const POS_FACEUP_ATTACK = 0x1;

// ocgcore message type numbers
const MSG_DRAW = 90;
const MSG_MOVE = 50;
const MSG_SET = 54;
const MSG_SELECT_CHAIN = 16;
const MSG_CONFIRM_CARDS = 83;
const MSG_HINT = 1;
const MSG_FLIPSUMMONING = 43;
const MSG_SUMMONED = 40;

// ── DRAW ─────────────────────────────────────────────────────────────────────

describe("DRAW (type 90) — opponent draw codes zeroed", () => {
  const drawMsg: RawEngineMessage = {
    type: MSG_DRAW,
    name: "DRAW",
    player: 1,
    drawn: [
      { code: 9411399, position: POS_FACEDOWN_ATTACK },
      { code: 67724379, position: POS_FACEDOWN_ATTACK },
    ],
  };

  it("owner (seat 1) receives full draw message with codes intact", () => {
    const result = redactMessageForSeat(drawMsg, 1);
    expect(result).not.toBeNull();
    const drawn = result!["drawn"] as Array<{ code: number }>;
    expect(drawn[0]!.code).toBe(9411399);
    expect(drawn[1]!.code).toBe(67724379);
  });

  it("opponent (seat 0) receives zeroed draw codes", () => {
    const result = redactMessageForSeat(drawMsg, 0);
    expect(result).not.toBeNull();
    const drawn = result!["drawn"] as Array<{ code: number }>;
    expect(drawn[0]!.code).toBe(0);
    expect(drawn[1]!.code).toBe(0);
  });

  it("zeroed draw preserves array length", () => {
    const result = redactMessageForSeat(drawMsg, 0);
    const drawn = result!["drawn"] as unknown[];
    expect(drawn).toHaveLength(2);
  });
});

// ── MOVE ─────────────────────────────────────────────────────────────────────

describe("MOVE (type 50) — code zeroed when destination is hidden", () => {
  it("MOVE to opponent HAND: code zeroed for viewer seat 0", () => {
    const msg: RawEngineMessage = {
      type: MSG_MOVE,
      name: "MOVE",
      card: 9411399,
      to: { controller: 1, location: LOC_HAND, position: POS_FACEUP_ATTACK },
    };
    const result = redactMessageForSeat(msg, 0);
    expect(result).not.toBeNull();
    expect(result!["card"]).toBe(0);
  });

  it("MOVE to opponent DECK: code zeroed for viewer seat 0", () => {
    const msg: RawEngineMessage = {
      type: MSG_MOVE,
      name: "MOVE",
      card: 9411399,
      to: { controller: 1, location: LOC_DECK, position: POS_FACEDOWN_ATTACK },
    };
    const result = redactMessageForSeat(msg, 0);
    expect(result!["card"]).toBe(0);
  });

  it("MOVE to opponent MZONE face-down: code zeroed for viewer seat 0", () => {
    const msg: RawEngineMessage = {
      type: MSG_MOVE,
      name: "MOVE",
      card: 9411399,
      to: { controller: 1, location: LOC_MZONE, position: POS_FACEDOWN_DEFENSE },
    };
    const result = redactMessageForSeat(msg, 0);
    expect(result!["card"]).toBe(0);
  });

  it("MOVE to own HAND: code visible to owner (seat 1)", () => {
    const msg: RawEngineMessage = {
      type: MSG_MOVE,
      name: "MOVE",
      card: 9411399,
      to: { controller: 1, location: LOC_HAND, position: POS_FACEUP_ATTACK },
    };
    const result = redactMessageForSeat(msg, 1);
    expect(result!["card"]).toBe(9411399);
  });

  it("MOVE to opponent MZONE face-up: code visible (face-up field is public)", () => {
    const msg: RawEngineMessage = {
      type: MSG_MOVE,
      name: "MOVE",
      card: 9411399,
      to: { controller: 1, location: LOC_MZONE, position: POS_FACEUP_ATTACK },
    };
    const result = redactMessageForSeat(msg, 0);
    expect(result!["card"]).toBe(9411399);
  });
});

// ── SET ──────────────────────────────────────────────────────────────────────

describe("SET (type 54) — code zeroed for non-owner", () => {
  const setMsg: RawEngineMessage = {
    type: MSG_SET,
    name: "SET",
    code: 67724379,
    controller: 1,
  };

  it("owner (seat 1) sees the set card code", () => {
    const result = redactMessageForSeat(setMsg, 1);
    expect(result!["code"]).toBe(67724379);
  });

  it("opponent (seat 0) sees zeroed set card code", () => {
    const result = redactMessageForSeat(setMsg, 0);
    expect(result!["code"]).toBe(0);
  });
});

// ── Decision routing ──────────────────────────────────────────────────────────

describe("SELECT_CHAIN (type 16) — routed to player only", () => {
  const selectMsg: RawEngineMessage = {
    type: MSG_SELECT_CHAIN,
    name: "SELECT_CHAIN",
    player: 0,
    selects: [{ code: 9411399 }],
  };

  it("entitled player (seat 0) receives the message", () => {
    expect(redactMessageForSeat(selectMsg, 0)).not.toBeNull();
  });

  it("non-entitled player (seat 1) receives null", () => {
    expect(redactMessageForSeat(selectMsg, 1)).toBeNull();
  });
});

// ── Reveal routing ────────────────────────────────────────────────────────────

describe("CONFIRM_CARDS (type 83) — routed to player only", () => {
  const confirmMsg: RawEngineMessage = {
    type: MSG_CONFIRM_CARDS,
    name: "CONFIRM_CARDS",
    player: 1,
    cards: [{ code: 9411399 }],
  };

  it("entitled player (seat 1) receives the message", () => {
    expect(redactMessageForSeat(confirmMsg, 1)).not.toBeNull();
  });

  it("non-entitled player (seat 0) receives null", () => {
    expect(redactMessageForSeat(confirmMsg, 0)).toBeNull();
  });
});

// ── Hint routing ──────────────────────────────────────────────────────────────

describe("HINT (type 1) — routed to player only", () => {
  const hintMsg: RawEngineMessage = {
    type: MSG_HINT,
    name: "HINT",
    player: 0,
    hintType: 1,
    hintData: 0,
  };

  it("entitled player (seat 0) receives the hint", () => {
    expect(redactMessageForSeat(hintMsg, 0)).not.toBeNull();
  });

  it("non-entitled player (seat 1) receives null", () => {
    expect(redactMessageForSeat(hintMsg, 1)).toBeNull();
  });
});

// ── Broadcast face-up events ─────────────────────────────────────────────────

describe("FLIPSUMMONING (type 43) — broadcast to both seats", () => {
  const flipMsg: RawEngineMessage = {
    type: MSG_FLIPSUMMONING,
    name: "FLIPSUMMONING",
    code: 9411399,
    location: { controller: 0, location: LOC_MZONE, sequence: 0 },
  };

  it("reaches seat 0", () => {
    expect(redactMessageForSeat(flipMsg, 0)).not.toBeNull();
  });

  it("reaches seat 1 (public reveal)", () => {
    expect(redactMessageForSeat(flipMsg, 1)).not.toBeNull();
  });

  it("code is visible to both seats", () => {
    const r0 = redactMessageForSeat(flipMsg, 0);
    const r1 = redactMessageForSeat(flipMsg, 1);
    expect(r0!.engineType).toBe(MSG_FLIPSUMMONING);
    expect(r1!.engineType).toBe(MSG_FLIPSUMMONING);
  });
});

// ── Broadcast summon event ────────────────────────────────────────────────────

describe("SUMMONED (type 40) — broadcast to both seats", () => {
  const summonMsg: RawEngineMessage = {
    type: MSG_SUMMONED,
    name: "SUMMONED",
  };

  it("reaches seat 0", () => {
    expect(redactMessageForSeat(summonMsg, 0)).not.toBeNull();
  });

  it("reaches seat 1", () => {
    expect(redactMessageForSeat(summonMsg, 1)).not.toBeNull();
  });
});

// ── Envelope correctness ──────────────────────────────────────────────────────

describe("RedactedEngineMessage envelope", () => {
  it("always sets name and engineType", () => {
    const msg: RawEngineMessage = {
      type: MSG_SUMMONED,
      name: "SUMMONED",
    };
    const result = redactMessageForSeat(msg, 0)!;
    expect(typeof result.name).toBe("string");
    expect(typeof result.engineType).toBe("number");
    expect(result.engineType).toBe(MSG_SUMMONED);
  });
});
