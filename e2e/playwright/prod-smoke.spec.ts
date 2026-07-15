import { test, expect, request } from "@playwright/test";

// ---------------------------------------------------------------------------
// Thin, UNAUTHENTICATED production smoke. Confirms the live split-origin deploy
// is up: the SPA shell (app.zuhayr.io) and the backend health endpoint
// (api.zuhayr.io). It does NOT log in or duel (SameSite=Lax cookies won't
// attach cross-origin here — the authed duel loop is proven on the localhost
// harness in duel.spec.ts). Opt-in only: set PROD_SMOKE=1.
// ---------------------------------------------------------------------------

const RUN = process.env.PROD_SMOKE === "1";
const APP_URL = process.env.PROD_APP_URL ?? "https://app.zuhayr.io";
const API_URL = process.env.PROD_API_URL ?? "https://api.zuhayr.io";

test.skip(!RUN, "prod smoke is opt-in (set PROD_SMOKE=1)");

test("prod SPA shell loads", async () => {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.get(APP_URL);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('id="root"');
  } finally {
    await ctx.dispose();
  }
});

test("prod backend /healthz is green with a loaded catalog", async () => {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.get(`${API_URL}/healthz`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status?: string; cards?: number };
    expect(body.status).toBe("ok");
    expect(body.cards ?? 0).toBeGreaterThan(0);
  } finally {
    await ctx.dispose();
  }
});
