import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("API client — VITE_API_BASE_URL", () => {
  it("prepends VITE_API_BASE_URL to the fetch path when set", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { get } = await import("./client.js");
    await get("/api/cards");
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/api/cards", expect.any(Object));
  });

  it("uses a relative path when VITE_API_BASE_URL is not set", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { get } = await import("./client.js");
    await get("/api/cards");
    expect(fetchSpy).toHaveBeenCalledWith("/api/cards", expect.any(Object));
  });
});
