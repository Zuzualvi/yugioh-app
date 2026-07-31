import { describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "./db/openDb.js";
import { createApp } from "./app.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "./catalog/fixture.js";
import type { LoadedCatalog } from "./catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// GET / and GET /healthz
// ---------------------------------------------------------------------------

describe("createApp — service routes", () => {
  it("GET / returns service identity", async () => {
    const db = openDb(":memory:");
    const catalog = makeTestCatalog();
    const app = createApp(db, catalog);

    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ service: "yugioh-edison-api" });

    db.close();
  });

  it("GET /healthz returns 200 with status ok and cards > 0", async () => {
    const db = openDb(":memory:");
    const catalog = makeTestCatalog();
    const app = createApp(db, catalog);

    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.cards).toBe("number");
    expect(res.body.cards).toBeGreaterThan(0);

    db.close();
  });
});

// ---------------------------------------------------------------------------
// imagesPath option
// ---------------------------------------------------------------------------

describe("createApp — imagesPath option", () => {
  it("mounts /images when imagesPath is supplied", async () => {
    const db = openDb(":memory:");
    const catalog = makeTestCatalog();

    // Create a temp dir with a test file so express.static can serve it
    const dir = mkdtempSync(join(tmpdir(), "yugioh-images-"));
    writeFileSync(join(dir, "test.txt"), "card-image");

    const app = createApp(db, catalog, undefined, { imagesPath: dir });

    const res = await request(app).get("/images/test.txt");
    expect(res.status).toBe(200);
    expect(res.text).toBe("card-image");

    db.close();
  });

  it("does not mount /images when imagesPath is omitted", async () => {
    const db = openDb(":memory:");
    const catalog = makeTestCatalog();

    // Create a real file — if /images were mounted it would return 200.
    // Passing no imagesPath means express.static is never registered, so the
    // request falls through to the terminal JSON 404 handler instead.
    const dir = mkdtempSync(join(tmpdir(), "yugioh-images-"));
    writeFileSync(join(dir, "present.txt"), "card-image");

    // Deliberately do NOT pass imagesPath
    const app = createApp(db, catalog);

    const res = await request(app).get("/images/present.txt");
    // The file exists on disk but /images is not mounted — must be 404
    expect(res.status).toBe(404);
    // Body comes from our terminal JSON handler, not express.static
    expect(res.body).toMatchObject({ error: { code: "not_found" } });

    db.close();
  });
});
