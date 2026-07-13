import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("createInvite", () => {
  it("POSTs to /api/admin/invites and returns inviteCode + expiresAt", async () => {
    const payload = { inviteCode: "INV-ABC123", expiresAt: "2099-01-01T00:00:00.000Z" };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { createInvite } = await import("./admin.js");
    const result = await createInvite();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/invites",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(payload);
  });

  it("propagates ApiError on non-2xx response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "forbidden", message: "Admin only" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { createInvite } = await import("./admin.js");
    await expect(createInvite()).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});
