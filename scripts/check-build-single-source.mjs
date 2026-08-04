#!/usr/bin/env node
/**
 * check-build-single-source.mjs — Assert that the server build has exactly one
 * source of truth: `npm run build:server` in package.json.
 *
 * Checks:
 *   1. Dockerfile invokes `npm run build:server` (not an inline esbuild command).
 *   2. Dockerfile contains no `esbuild` invocation outside a comment line.
 *   3. scripts/smoke-artifact.mjs invokes `npm run build:server`.
 *
 * Why this exists: PR #19 claimed "the smoke uses the same invocation as the
 * Dockerfile" — it did not. The Dockerfile ran its own inline esbuild RUN with
 * hand-maintained flags; the smoke ran `npm run build:server`. They agreed at
 * merge time; nothing checked they kept agreeing. That is the same shape as the
 * 2026-07-28 outage. This script is the gate that makes divergence a CI failure.
 *
 * Acceptance: reverting A3's Dockerfile change (restoring the inline esbuild RUN)
 * makes `npm run verify` fail.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

// ── 1. Dockerfile must invoke `npm run build:server` ────────────────────────
const dockerfilePath = join(ROOT, "Dockerfile");
let dockerfile;
try {
  dockerfile = readFileSync(dockerfilePath, "utf8");
} catch (err) {
  console.error(`✖ check-build-single-source: could not read Dockerfile: ${err.message}`);
  process.exit(1);
}

if (!dockerfile.includes("npm run build:server")) {
  errors.push(
    `Dockerfile does not invoke \`npm run build:server\`. ` +
      `The build flags must live in package.json's build:server script, ` +
      `not duplicated inline in the Dockerfile.`,
  );
}

// ── 2. Dockerfile must not have an esbuild invocation outside a comment ──────
// Split by line and reject any non-comment line that invokes esbuild as an
// executable (i.e. contains "esbuild" followed by space or flags, not just
// the word "esbuild" in a prose context).
const dockerLines = dockerfile.split("\n");
for (let i = 0; i < dockerLines.length; i++) {
  const line = dockerLines[i];
  const trimmed = line.trimStart();
  // Skip comment lines (Dockerfile comments start with #)
  if (trimmed.startsWith("#")) continue;
  // Detect esbuild invocations: the pattern node_modules/.bin/esbuild or
  // npx esbuild appearing on a non-comment line
  if (/\besbuild\b/.test(line)) {
    errors.push(
      `Dockerfile line ${i + 1} contains an esbuild invocation outside a comment: ${line.trim()}\n` +
        `  The build flags live in package.json (build:server) and are guarded by ` +
        `check-build-single-source. Use \`RUN npm run build:server\` instead.`,
    );
  }
}

// ── 3. smoke-artifact.mjs must invoke `npm run build:server` ────────────────
const smokePath = join(ROOT, "scripts", "smoke-artifact.mjs");
let smoke;
try {
  smoke = readFileSync(smokePath, "utf8");
} catch (err) {
  console.error(
    `✖ check-build-single-source: could not read scripts/smoke-artifact.mjs: ${err.message}`,
  );
  process.exit(1);
}

if (!smoke.includes("npm run build:server")) {
  errors.push(
    `scripts/smoke-artifact.mjs does not invoke \`npm run build:server\`. ` +
      `The smoke and the Dockerfile must use the same build invocation so they ` +
      `test what actually ships.`,
  );
}

if (errors.length) {
  console.error(`\n✖ check-build-single-source failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  • ${e}\n`);
  process.exit(1);
}
console.log("✓ build single-source OK");
