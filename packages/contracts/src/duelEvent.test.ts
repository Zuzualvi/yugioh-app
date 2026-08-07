// ---------------------------------------------------------------------------
// duelEvent.test.ts — contract schema tests for DuelEvent and DecisionContext.
//
// Verifies that the Zod schemas accept valid variants and reject invalid shapes.
// ZUH-94, §C6 + §C7.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { DuelEventSchema, DecisionContextSchema, EventCardRefSchema } from "./duelEvent.js";

// ── EventCardRef ──────────────────────────────────────────────────────────────

describe("EventCardRefSchema", () => {
  it("accepts a valid card ref with sequence", () => {
    const result = EventCardRefSchema.safeParse({
      code: 9411399,
      controller: 0,
      location: "MZONE",
      sequence: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a card ref without sequence (optional)", () => {
    const result = EventCardRefSchema.safeParse({ code: 0, controller: 1, location: "HAND" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid location", () => {
    const result = EventCardRefSchema.safeParse({
      code: 9411399,
      controller: 0,
      location: "PZONE", // not in the enum
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid controller (must be 0 or 1)", () => {
    const result = EventCardRefSchema.safeParse({
      code: 9411399,
      controller: 2,
      location: "MZONE",
    });
    expect(result.success).toBe(false);
  });
});

// ── SUMMON / SPSUMMON / SET ───────────────────────────────────────────────────

const cardRef = { code: 9411399, controller: 0 as const, location: "MZONE" as const, sequence: 0 };
const commonFields = { seq: 0, turnNumber: 1, phase: 4 };

describe("DuelEventSchema — SUMMON", () => {
  it("accepts a valid SUMMON event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "SUMMON",
      ...commonFields,
      card: cardRef,
      position: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a SUMMON event without card", () => {
    const result = DuelEventSchema.safeParse({ kind: "SUMMON", ...commonFields, position: 1 });
    expect(result.success).toBe(false);
  });
});

describe("DuelEventSchema — SPSUMMON", () => {
  it("accepts a valid SPSUMMON event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "SPSUMMON",
      ...commonFields,
      card: cardRef,
      position: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("DuelEventSchema — SET", () => {
  it("accepts a valid SET event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "SET",
      ...commonFields,
      card: { code: 0, controller: 1, location: "SZONE", sequence: 2 },
      position: 2,
    });
    expect(result.success).toBe(true);
  });
});

// ── MOVE ──────────────────────────────────────────────────────────────────────

describe("DuelEventSchema — MOVE", () => {
  it("accepts a valid MOVE event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "MOVE",
      ...commonFields,
      card: { code: 9411399, controller: 0, location: "GRAVE" },
      from: { code: 9411399, controller: 0, location: "MZONE", sequence: 0 },
      to: { code: 9411399, controller: 0, location: "GRAVE" },
    });
    expect(result.success).toBe(true);
  });
});

// ── Chain events ──────────────────────────────────────────────────────────────

describe("DuelEventSchema — CHAINING", () => {
  it("accepts a valid CHAINING event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "CHAINING",
      ...commonFields,
      card: cardRef,
      link: 1,
      owner: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects link = 0 (must be positive)", () => {
    const result = DuelEventSchema.safeParse({
      kind: "CHAINING",
      ...commonFields,
      card: cardRef,
      link: 0,
      owner: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("DuelEventSchema — CHAIN_SOLVING / CHAIN_SOLVED", () => {
  it("accepts CHAIN_SOLVING with link", () => {
    expect(
      DuelEventSchema.safeParse({ kind: "CHAIN_SOLVING", ...commonFields, link: 2 }).success,
    ).toBe(true);
  });

  it("accepts CHAIN_SOLVED with link", () => {
    expect(
      DuelEventSchema.safeParse({ kind: "CHAIN_SOLVED", ...commonFields, link: 1 }).success,
    ).toBe(true);
  });
});

describe("DuelEventSchema — CHAIN_END", () => {
  it("accepts a valid CHAIN_END event", () => {
    expect(DuelEventSchema.safeParse({ kind: "CHAIN_END", ...commonFields }).success).toBe(true);
  });
});

// ── LP_CHANGE — ND-4: seat field required ────────────────────────────────────

describe("DuelEventSchema — LP_CHANGE (ND-4)", () => {
  it("accepts a damage event with seat", () => {
    const result = DuelEventSchema.safeParse({
      kind: "LP_CHANGE",
      ...commonFields,
      seat: 1,
      delta: -1200,
      reason: "damage",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "LP_CHANGE") {
      expect(result.data.seat).toBe(1);
      expect(result.data.delta).toBe(-1200);
    }
  });

  it("accepts a cost event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "LP_CHANGE",
      ...commonFields,
      seat: 0,
      delta: -800,
      reason: "cost",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a recover event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "LP_CHANGE",
      ...commonFields,
      seat: 0,
      delta: 500,
      reason: "recover",
    });
    expect(result.success).toBe(true);
  });

  it("rejects LP_CHANGE without seat (ND-4 key)", () => {
    const result = DuelEventSchema.safeParse({
      kind: "LP_CHANGE",
      ...commonFields,
      delta: -1200,
      reason: "damage",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown reason", () => {
    const result = DuelEventSchema.safeParse({
      kind: "LP_CHANGE",
      ...commonFields,
      seat: 0,
      delta: -100,
      reason: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── ATTACK / BATTLE ───────────────────────────────────────────────────────────

describe("DuelEventSchema — ATTACK", () => {
  it("accepts a direct attack (target null)", () => {
    const result = DuelEventSchema.safeParse({
      kind: "ATTACK",
      ...commonFields,
      attacker: cardRef,
      target: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an attack with a target", () => {
    const result = DuelEventSchema.safeParse({
      kind: "ATTACK",
      ...commonFields,
      attacker: cardRef,
      target: { code: 12345, controller: 1, location: "MZONE", sequence: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("DuelEventSchema — BATTLE", () => {
  it("accepts a valid BATTLE event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "BATTLE",
      ...commonFields,
      attacker: cardRef,
      target: { code: 12345, controller: 1, location: "MZONE", sequence: 1 },
    });
    expect(result.success).toBe(true);
  });
});

// ── PHASE / TURN ──────────────────────────────────────────────────────────────

describe("DuelEventSchema — PHASE", () => {
  it("accepts a valid PHASE event", () => {
    expect(DuelEventSchema.safeParse({ kind: "PHASE", ...commonFields }).success).toBe(true);
  });
});

describe("DuelEventSchema — TURN", () => {
  it("accepts a valid TURN event", () => {
    const result = DuelEventSchema.safeParse({
      kind: "TURN",
      ...commonFields,
      turnPlayer: 0,
      lpSnapshot: [8000, 7600],
    });
    expect(result.success).toBe(true);
  });

  it("rejects TURN with wrong lpSnapshot shape", () => {
    const result = DuelEventSchema.safeParse({
      kind: "TURN",
      ...commonFields,
      turnPlayer: 0,
      lpSnapshot: [8000], // not a tuple [number, number]
    });
    expect(result.success).toBe(false);
  });
});

// ── HINT ──────────────────────────────────────────────────────────────────────

describe("DuelEventSchema — HINT", () => {
  it("accepts a valid HINT event without card", () => {
    const result = DuelEventSchema.safeParse({
      kind: "HINT",
      ...commonFields,
      hintType: 3,
      value: "Tribute Summon",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a HINT event with optional card", () => {
    const result = DuelEventSchema.safeParse({
      kind: "HINT",
      ...commonFields,
      hintType: 1,
      value: "123",
      card: cardRef,
    });
    expect(result.success).toBe(true);
  });
});

// ── DecisionContext ──────────────────────────────────────────────────────────

describe("DecisionContextSchema", () => {
  it("accepts an empty context (all fields optional)", () => {
    expect(DecisionContextSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a context with caption only", () => {
    expect(DecisionContextSchema.safeParse({ caption: "Tribute Summon" }).success).toBe(true);
  });

  it("accepts a context with chain", () => {
    const result = DecisionContextSchema.safeParse({
      chain: [{ link: 1, card: cardRef, owner: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields beyond the schema (releaseCounts removed — ND-1 withdrawn)", () => {
    // releaseCounts was removed from the schema when ND-1 was withdrawn.
    // DecisionContext uses passthrough: false (zod default), so unknown keys are stripped.
    const result = DecisionContextSchema.safeParse({
      releaseCounts: { "0": 2 },
    });
    // Zod strips unknown keys by default — parse succeeds but field is absent.
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)["releaseCounts"]).toBeUndefined();
    }
  });
});
