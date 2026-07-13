import { describe, expect, it } from "vitest";
import { openDb } from "./db/openDb.js";
import { createApp } from "./app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "./catalog/fixture.js";
import type { LoadedCatalog } from "./catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Smoke test — verifies the app wires without crashing
// ---------------------------------------------------------------------------

function makeTestCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set(byPasscode.keys());
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

describe("createApp", () => {
  it("creates an express app without throwing", () => {
    const db = openDb(":memory:");
    const catalog = makeTestCatalog();
    const app = createApp(db, catalog);
    expect(typeof app).toBe("function");
    db.close();
  });
});
