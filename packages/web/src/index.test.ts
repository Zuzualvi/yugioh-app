import { describe, expect, it } from "vitest";
import { formatMessage } from "./index";

describe("formatMessage", () => {
  it("includes the message kind in the output", () => {
    const result = formatMessage({
      kind: "duel.start",
      payload: {},
      timestamp: 1_700_000_000,
    });
    expect(result).toContain("duel.start");
  });

  it("includes an ISO timestamp in the output", () => {
    const result = formatMessage({
      kind: "duel.end",
      payload: null,
      timestamp: 1_700_000_000,
    });
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
