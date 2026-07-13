import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./index";

describe("formatTimestamp", () => {
  it("formats a UNIX timestamp as an ISO string", () => {
    const result = formatTimestamp(1_700_000_000);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes the date portion", () => {
    const result = formatTimestamp(0);
    expect(result).toContain("1970-01-01");
  });
});
