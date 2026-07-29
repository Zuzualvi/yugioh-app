import { describe, expect, it } from "vitest";
import {
  SeatSchema,
  PerMoveTimerSchema,
  CreateDuelBodySchema,
  JoinDuelBodySchema,
  EngineResponseSchema,
  RedactedEngineMessageSchema,
  ZoneCardSchema,
  DuelZonesSchema,
  DuelStateSnapshotSchema,
  DuelEndReasonSchema,
  DuelServerMessageSchema,
  DuelClientMessageSchema,
  DuelStatusSchema,
} from "./duel.js";

// ── SeatSchema ───────────────────────────────────────────────────────────────

describe("SeatSchema", () => {
  it("parses 0 and 1", () => {
    expect(SeatSchema.parse(0)).toBe(0);
    expect(SeatSchema.parse(1)).toBe(1);
  });
  it("rejects any other value", () => {
    expect(() => SeatSchema.parse(2)).toThrow();
  });
});

// ── PerMoveTimerSchema ───────────────────────────────────────────────────────

describe("PerMoveTimerSchema", () => {
  it("parses min bound (60)", () => {
    expect(PerMoveTimerSchema.parse({ perMoveSeconds: 60 })).toEqual({ perMoveSeconds: 60 });
  });
  it("parses max bound (900)", () => {
    expect(PerMoveTimerSchema.parse({ perMoveSeconds: 900 })).toEqual({ perMoveSeconds: 900 });
  });
  it("rejects below 60", () => {
    expect(() => PerMoveTimerSchema.parse({ perMoveSeconds: 59 })).toThrow();
  });
  it("rejects above 900", () => {
    expect(() => PerMoveTimerSchema.parse({ perMoveSeconds: 901 })).toThrow();
  });
  it("rejects zero", () => {
    expect(() => PerMoveTimerSchema.parse({ perMoveSeconds: 0 })).toThrow();
  });
});

// ── CreateDuelBodySchema ─────────────────────────────────────────────────────

describe("CreateDuelBodySchema", () => {
  it("parses a valid body (timer only, no deckId)", () => {
    const result = CreateDuelBodySchema.parse({ timer: { perMoveSeconds: 120 } });
    expect(result.timer.perMoveSeconds).toBe(120);
  });
  it("rejects missing timer", () => {
    expect(() => CreateDuelBodySchema.parse({})).toThrow();
  });
});

// ── JoinDuelBodySchema ───────────────────────────────────────────────────────

describe("JoinDuelBodySchema", () => {
  it("parses a valid join body (joinToken only, no deckId)", () => {
    const result = JoinDuelBodySchema.parse({ joinToken: "abc" });
    expect(result.joinToken).toBe("abc");
  });
  it("rejects missing joinToken", () => {
    expect(() => JoinDuelBodySchema.parse({})).toThrow();
  });
});

// ── DuelStatusSchema ─────────────────────────────────────────────────────────

describe("DuelStatusSchema", () => {
  it("parses all valid statuses including starting", () => {
    expect(DuelStatusSchema.parse("waiting_for_opponent")).toBe("waiting_for_opponent");
    expect(DuelStatusSchema.parse("active")).toBe("active");
    expect(DuelStatusSchema.parse("ended")).toBe("ended");
    expect(DuelStatusSchema.parse("starting")).toBe("starting");
  });
  it("rejects unknown status", () => {
    expect(() => DuelStatusSchema.parse("pending")).toThrow();
  });
});

// ── EngineResponseSchema ─────────────────────────────────────────────────────

describe("EngineResponseSchema", () => {
  it("parses a response with and without value", () => {
    expect(EngineResponseSchema.parse({ type: 3 })).toEqual({ type: 3 });
    expect(EngineResponseSchema.parse({ type: 7, value: { card: 12345 } })).toMatchObject({
      type: 7,
    });
  });
  it("rejects non-integer type", () => {
    expect(() => EngineResponseSchema.parse({ type: 1.5 })).toThrow();
  });
});

// ── RedactedEngineMessageSchema ──────────────────────────────────────────────

describe("RedactedEngineMessageSchema", () => {
  it("parses a valid redacted message with extra passthrough fields", () => {
    const result = RedactedEngineMessageSchema.parse({
      name: "DRAW",
      engineType: 90,
      player: 0,
      drawn: [{ code: 0, position: 4 }],
    });
    expect(result.name).toBe("DRAW");
    expect((result as Record<string, unknown>).drawn).toBeDefined();
  });
  it("rejects missing name", () => {
    expect(() => RedactedEngineMessageSchema.parse({ engineType: 90 })).toThrow();
  });
});

// ── ZoneCardSchema ───────────────────────────────────────────────────────────

describe("ZoneCardSchema", () => {
  it("parses a zone card with extra fields (passthrough)", () => {
    const result = ZoneCardSchema.parse({ code: 9411399, position: 2, atk: 800 });
    expect(result.code).toBe(9411399);
    expect((result as Record<string, unknown>).atk).toBe(800);
  });
  it("rejects missing code", () => {
    expect(() => ZoneCardSchema.parse({ position: 2 })).toThrow();
  });
});

// ── DuelZonesSchema ──────────────────────────────────────────────────────────

const EMPTY_ZONES = {
  p0_hand: [],
  p1_hand: [],
  p0_mzone: [],
  p1_mzone: [],
  p0_szone: [],
  p1_szone: [],
  p0_grave: [],
  p1_grave: [],
  p0_removed: [],
  p1_removed: [],
  p0_extra: [],
  p1_extra: [],
};

describe("DuelZonesSchema", () => {
  it("parses empty zones", () => {
    expect(DuelZonesSchema.parse(EMPTY_ZONES)).toMatchObject({ p0_hand: [] });
  });
  it("rejects missing zone key", () => {
    const { p0_hand: _omit, ...partial } = EMPTY_ZONES;
    expect(() => DuelZonesSchema.parse(partial)).toThrow();
  });
});

// ── DuelStateSnapshotSchema ──────────────────────────────────────────────────

const VALID_SNAPSHOT = {
  seat: 0 as const,
  duelEnded: false,
  currentTurn: 0 as const,
  currentPhase: 1,
  lp: [8000, 8000] as [number, number],
  zones: EMPTY_ZONES,
};

describe("DuelStateSnapshotSchema", () => {
  it("parses a valid snapshot without clock", () => {
    expect(DuelStateSnapshotSchema.parse(VALID_SNAPSHOT).seat).toBe(0);
  });
  it("parses a valid snapshot with clock", () => {
    const result = DuelStateSnapshotSchema.parse({
      ...VALID_SNAPSHOT,
      clock: { onClockSeat: 1, deadlineAt: 1700000000000 },
    });
    expect(result.clock?.onClockSeat).toBe(1);
  });
  it("rejects missing lp field", () => {
    const { lp: _omit, ...rest } = VALID_SNAPSHOT;
    expect(() => DuelStateSnapshotSchema.parse(rest)).toThrow();
  });
});

// ── DuelEndReasonSchema ──────────────────────────────────────────────────────

describe("DuelEndReasonSchema", () => {
  it("parses all valid reasons", () => {
    expect(DuelEndReasonSchema.parse("normal")).toBe("normal");
    expect(DuelEndReasonSchema.parse("timeout")).toBe("timeout");
    expect(DuelEndReasonSchema.parse("resign")).toBe("resign");
  });
  it("rejects unknown reason", () => {
    expect(() => DuelEndReasonSchema.parse("surrender")).toThrow();
  });
});

// ── DuelServerMessageSchema ──────────────────────────────────────────────────

describe("DuelServerMessageSchema", () => {
  it("parses SEAT_ASSIGNED", () => {
    const result = DuelServerMessageSchema.parse({
      type: "SEAT_ASSIGNED",
      seat: 0,
      seatToken: "tok",
    });
    expect(result.type).toBe("SEAT_ASSIGNED");
  });
  it("parses DUEL_END with null winner", () => {
    const result = DuelServerMessageSchema.parse({
      type: "DUEL_END",
      winner: null,
      reason: "timeout",
    });
    expect(result.type).toBe("DUEL_END");
  });
  it("rejects unknown type", () => {
    expect(() => DuelServerMessageSchema.parse({ type: "UNKNOWN", msg: {} })).toThrow();
  });
});

// ── DuelClientMessageSchema ──────────────────────────────────────────────────

describe("DuelClientMessageSchema", () => {
  it("parses RESPONSE", () => {
    const result = DuelClientMessageSchema.parse({ type: "RESPONSE", response: { type: 1 } });
    expect(result.type).toBe("RESPONSE");
  });
  it("parses RESIGN", () => {
    expect(DuelClientMessageSchema.parse({ type: "RESIGN" })).toEqual({ type: "RESIGN" });
  });
  it("rejects unknown client type", () => {
    expect(() => DuelClientMessageSchema.parse({ type: "PING" })).toThrow();
  });
});
