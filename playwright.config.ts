import { defineConfig } from "@playwright/test";

// Same-origin localhost stack (see e2e/harness/server.ts). The SPA must be built
// first (npm run build:web) — the `test:e2e` script does that. The harness serves
// packages/web/dist + the real /api + duel WS + real WASM engine on one origin.
const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/playwright",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 393, height: 851 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npx tsx e2e/harness/server.ts",
    url: `${BASE_URL}/`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), DB_PATH: "/tmp/e2e-duel.db" },
    stdout: "pipe",
    stderr: "pipe",
  },
});
