import { describe, expect, it } from "vitest";
import { WsMessageSchema } from "./index";

describe("WsMessageSchema", () => {
  it("accepts a valid duel.start message", () => {
    const result = WsMessageSchema.safeParse({
      kind: "duel.start",
      payload: { roomId: "abc" },
      timestamp: 1_700_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = WsMessageSchema.safeParse({
      kind: "duel.invalid",
      payload: null,
      timestamp: 1_700_000_000,
    });
    expect(result.success).toBe(false);
  });
});
