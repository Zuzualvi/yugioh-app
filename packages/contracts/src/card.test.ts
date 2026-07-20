import { describe, expect, it } from "vitest";
import { CardSearchSchema } from "./card.js";

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
