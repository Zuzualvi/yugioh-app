import { describe, expect, it } from "vitest";
import { EDISON_FLAGS, isCustomWasmAvailable, redactMessageForSeat } from "./index.js";

describe("@yugioh-app/engine public surface", () => {
  it("exports EDISON_FLAGS as a bigint equal to 0x7f80d072cn", () => {
    expect(EDISON_FLAGS).toBe(0x7f80d072cn);
  });

  it("exports isCustomWasmAvailable as a function", () => {
    expect(typeof isCustomWasmAvailable).toBe("function");
    expect(typeof isCustomWasmAvailable()).toBe("boolean");
  });

  it("exports redactMessageForSeat as a function", () => {
    expect(typeof redactMessageForSeat).toBe("function");
  });

  it("createEdisonDuel is exported", async () => {
    const { createEdisonDuel } = await import("./index.js");
    expect(typeof createEdisonDuel).toBe("function");
  });
});
