// ---------------------------------------------------------------------------
// The E2E data-testid contract guard.
//
// WHY THIS EXISTS: `npm run verify` does NOT run Playwright — `test:e2e` is a
// separate script and a separate CI workflow. So a change can be "verify
// green" and still break the E2E suite, and the only place that shows up is a
// CI failure after the push. That happened on 2026-08-07: the W2 answer-dock
// slice deleted the 20 decision panels and with them the `zone-option` and
// `pass-option` test ids, and E2E went red on a branch whose `npm run verify`
// was clean.
//
// The design spec lists the E2E data-testid contract under "Cannot break".
// This test makes that a LOCAL static failure instead of a remote one, so the
// pre-push gate actually covers it. It is deliberately cheap: no browser, no
// build, just a source scan.
//
// If you are deleting a component that owns one of these ids, the id has to
// land on whatever replaces it. If an id is genuinely obsolete, delete it from
// the E2E spec in the SAME change and say why in the commit message — do not
// weaken this test.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const e2eSpec = join(repoRoot, "e2e", "playwright", "duel.spec.ts");
const webSrc = join(here, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      if (full.endsWith(".test.ts") || full.endsWith(".test.tsx")) continue;
      out.push(full);
    }
  }
  return out;
}

/** Test ids the Playwright suite asserts on but which are not rendered by the
 *  web app — they belong to surfaces outside packages/web (none today). */
const NOT_RENDERED_BY_WEB = new Set<string>();

describe("E2E data-testid contract", () => {
  const spec = readFileSync(e2eSpec, "utf8");

  // Playwright reaches test ids two ways and BOTH must be scanned. The first
  // version of this guard matched only getByTestId(), and so missed
  //   locator('[data-testid="my-mzone"]')
  // at duel.spec.ts:344 — the very next slice dropped `my-mzone` and this guard
  // stayed green while E2E went red. If a third way of selecting a test id
  // appears in the spec, add it here too.
  const required = [
    ...[...spec.matchAll(/getByTestId\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!),
    ...[...spec.matchAll(/data-testid\s*=\s*["'`]([^"'`\]]+)["'`]/g)].map((m) => m[1]!),
  ].filter((id) => !NOT_RENDERED_BY_WEB.has(id));

  const sources = walk(webSrc).map((f) => readFileSync(f, "utf8"));
  const haystack = sources.join("\n");

  it("finds at least one required id (guards against the regex silently matching nothing)", () => {
    expect(required.length).toBeGreaterThan(5);
  });

  it.each([...new Set(required)])(
    "`%s` is rendered somewhere in packages/web/src",
    (id: string) => {
      const rendered =
        haystack.includes(`"${id}"`) ||
        haystack.includes(`'${id}'`) ||
        haystack.includes(`\`${id}\``);
      expect(
        rendered,
        `The E2E suite asserts on data-testid="${id}" but nothing in packages/web/src renders it. ` +
          `If you deleted the component that owned it, the id must land on its replacement. ` +
          `If it is genuinely obsolete, remove it from e2e/playwright/duel.spec.ts in the same change.`,
      ).toBe(true);
    },
  );
});
