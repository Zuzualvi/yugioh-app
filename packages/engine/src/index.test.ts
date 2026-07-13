import { describe, expect, it } from "vitest";
import type { EngineResult, OcgCoreAdapter } from "./index";

describe("OcgCoreAdapter interface (shape test)", () => {
  it("a stub implementation satisfies the interface", () => {
    const stub: OcgCoreAdapter = {
      processMessage: async (_msg) => ({
        success: true,
        newState: {},
      }),
      dispose: async () => {},
    };

    expect(typeof stub.processMessage).toBe("function");
    expect(typeof stub.dispose).toBe("function");
  });

  it("EngineResult success flag is boolean", () => {
    const result: EngineResult = { success: true, newState: null };
    expect(result.success).toBe(true);
  });
});
