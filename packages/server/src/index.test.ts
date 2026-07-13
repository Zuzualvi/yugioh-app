import { describe, expect, it } from "vitest";
import type { ServerConfig } from "./index";

describe("ServerConfig (shape test)", () => {
  it("port must be a number", () => {
    const cfg: ServerConfig = {
      port: 3000,
      adapter: {
        processMessage: async () => ({ success: true, newState: null }),
        dispose: async () => {},
      },
    };
    expect(cfg.port).toBe(3000);
  });
});
