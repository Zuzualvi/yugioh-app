import { describe, expect, it } from "vitest";
import { EDISON_FLAGS } from "./edisonFlags.js";

describe("EDISON_FLAGS (R1)", () => {
  it("equals 0x7f80d072cn exactly", () => {
    expect(EDISON_FLAGS).toBe(0x7f80d072cn);
  });

  it("includes OBSOLETE_IGNITION (0x100)", () => {
    expect(EDISON_FLAGS & 0x100n).toBe(0x100n);
  });

  it("includes FIRST_TURN_DRAW (0x200)", () => {
    expect(EDISON_FLAGS & 0x200n).toBe(0x200n);
  });

  it("includes ONE_FACEUP_FIELD (0x400)", () => {
    expect(EDISON_FLAGS & 0x400n).toBe(0x400n);
  });

  it("includes SIX_STEP_BATTLE_STEP (0x8)", () => {
    expect(EDISON_FLAGS & 0x8n).toBe(0x8n);
  });

  it("includes ZERO_ATK_DESTROYED (0x10000000)", () => {
    expect(EDISON_FLAGS & 0x10000000n).toBe(0x10000000n);
  });

  it("includes SINGLE_CHAIN_IN_DAMAGE_SUBSTEP (0x40000000)", () => {
    expect(EDISON_FLAGS & 0x40000000n).toBe(0x40000000n);
  });

  it("includes TCG_SEGOC_FIRSTTRIGGER (0x200000000)", () => {
    expect(EDISON_FLAGS & 0x200000000n).toBe(0x200000000n);
  });

  it("includes TCG_FAST_EFFECT_IGNITION (0x400000000)", () => {
    expect(EDISON_FLAGS & 0x400000000n).toBe(0x400000000n);
  });
});
