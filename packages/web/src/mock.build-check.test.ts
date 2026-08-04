/**
 * C1 acceptance test — mock session must be absent from the production bundle.
 *
 * Runs npm run build:web with NODE_ENV=production (matching the actual Vercel
 * deployment) and greps the resulting JS assets for references to the mock
 * duel session module. Vite replaces import.meta.env.DEV with false in
 * production builds; the dead if-block containing the dynamic import() is
 * eliminated by Rollup, so no mock chunk is generated.
 *
 * Spec §C1: a claim about tree-shaking that nothing checks is the same class
 * of defect as the rest of this project.
 *
 * Note: this test runs npm run build:web in beforeAll. It is intentionally slow
 * (one build per test run). The build is forced to NODE_ENV=production so Vite
 * uses production mode regardless of the surrounding test runner environment.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const _dirname = dirname(fileURLToPath(import.meta.url));
// _dirname is packages/web/src; three levels up is the repo root
const repoRoot = resolve(_dirname, "../../..");
// The web package builds into packages/web/dist/
const distDir = resolve(_dirname, "../dist/assets");

describe("C1: mock session module absent from production build", () => {
  beforeAll(() => {
    // NODE_ENV=production ensures Vite sets import.meta.env.DEV=false,
    // matching the deployment build. Without this, vitest's NODE_ENV=test
    // would cause Vite to include the mock chunk.
    execSync("npm run build:web", {
      cwd: repoRoot,
      stdio: "pipe",
      timeout: 120_000,
      env: { ...process.env, NODE_ENV: "production" },
    });
  }, 120_000);

  it("dist/assets/ exists after build", () => {
    expect(existsSync(distDir)).toBe(true);
  });

  it("no JS asset references createMockDuelSession", () => {
    const jsFiles = readdirSync(distDir).filter((f: string) => f.endsWith(".js"));
    expect(jsFiles.length).toBeGreaterThan(0);
    const matches: string[] = [];
    for (const file of jsFiles) {
      const text = readFileSync(join(distDir, file), "utf-8");
      if (text.includes("createMockDuelSession")) matches.push(file);
    }
    expect(matches, `mock found in prod bundle: ${matches.join(", ")}`).toHaveLength(0);
  });

  it("no JS asset references mock-seat-token (mock session marker)", () => {
    const jsFiles = readdirSync(distDir).filter((f: string) => f.endsWith(".js"));
    const matches: string[] = [];
    for (const file of jsFiles) {
      const text = readFileSync(join(distDir, file), "utf-8");
      if (text.includes("mock-seat-token")) matches.push(file);
    }
    expect(matches, `mock marker found in prod bundle: ${matches.join(", ")}`).toHaveLength(0);
  });
});
