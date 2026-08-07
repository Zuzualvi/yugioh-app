import { describe, expect, it } from "vitest";
import { CardSearchSchema, CardDTOSchema } from "./card.js";

describe("CardSearchSchema — passcodes field", () => {
  it('parses "1,2,3" → [1, 2, 3]', () => {
    const result = CardSearchSchema.safeParse({ passcodes: "1,2,3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passcodes).toEqual([1, 2, 3]);
      // Assert inferred type is number[]
      const p: number[] = result.data.passcodes!;
      expect(Array.isArray(p)).toBe(true);
    }
  });

  it("yields undefined when passcodes is absent", () => {
    const result = CardSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passcodes).toBeUndefined();
    }
  });

  it('rejects a non-numeric entry like "1,x"', () => {
    const result = CardSearchSchema.safeParse({ passcodes: "1,x" });
    expect(result.success).toBe(false);
  });

  it("parses a single passcode string", () => {
    const result = CardSearchSchema.safeParse({ passcodes: "22835145" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passcodes).toEqual([22835145]);
    }
  });

  it("yields undefined when passcodes is empty string", () => {
    const result = CardSearchSchema.safeParse({ passcodes: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passcodes).toBeUndefined();
    }
  });
});

// ── CardDTOSchema.preErrataText ──────────────────────────────────────────────

const BASE_CARD = {
  passcode: 26202165,
  name: "Sangan",
  frame: "effect" as const,
  isExtraDeck: false,
  race: "Fiend",
  attribute: "DARK",
  level: 3,
  atk: 1000,
  def: 600,
  desc: "...",
  banlist: "forbidden" as const,
  aliasOf: null,
  imageId: 26202165,
};

describe("CardDTOSchema — C4 preErrataText", () => {
  it("parses a card without preErrataText (optional field absent)", () => {
    const result = CardDTOSchema.parse(BASE_CARD);
    expect(result.preErrataText).toBeUndefined();
  });

  it("parses preErrataText: true", () => {
    const result = CardDTOSchema.parse({ ...BASE_CARD, preErrataText: true });
    expect(result.preErrataText).toBe(true);
  });

  it("parses preErrataText: false", () => {
    const result = CardDTOSchema.parse({ ...BASE_CARD, preErrataText: false });
    expect(result.preErrataText).toBe(false);
  });

  it("rejects non-boolean preErrataText", () => {
    expect(() => CardDTOSchema.parse({ ...BASE_CARD, preErrataText: "yes" })).toThrow();
  });
});
