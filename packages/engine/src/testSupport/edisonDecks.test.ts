// ---------------------------------------------------------------------------
// Deliverable B — fixture engine-load test (Phase 0)
//
// Confirms that BLACKWING_DECK and JUNK_FROG_DECK can be fed to createEdisonDuel
// (which calls ocgcore lib.createDuel + lib.startDuel internally) without errors.
// The legality / validateDeck assertion lives in:
//   packages/server/src/domain/edisonDeckLegality.test.ts
// (server can import both engine testSupport exports AND validateDeck).
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";
import { isCustomWasmAvailable } from "../coreFactory.js";
import { createEdisonDuel } from "../createEdisonDuel.js";
import type { EdisonDuel } from "../EdisonDuel.js";
import { BLACKWING_DECK, JUNK_FROG_DECK } from "./edisonDecks.js";

const WASM_AVAILABLE = isCustomWasmAvailable();

describe.skipIf(!WASM_AVAILABLE)(
  "Edison deck fixtures — engine load (Phase 0 Deliverable B) [requires custom WASM]",
  () => {
    let duel: EdisonDuel | null = null;

    afterEach(() => {
      duel?.destroy();
      duel = null;
    });

    it("BLACKWING_DECK — correct size", () => {
      expect(BLACKWING_DECK.main.length).toBe(40);
      expect(BLACKWING_DECK.extra.length).toBeLessThanOrEqual(15);
      expect(BLACKWING_DECK.side.length).toBeLessThanOrEqual(15);
    });

    it("JUNK_FROG_DECK — correct size", () => {
      expect(JUNK_FROG_DECK.main.length).toBe(40);
      expect(JUNK_FROG_DECK.extra.length).toBeLessThanOrEqual(15);
      expect(JUNK_FROG_DECK.side.length).toBeLessThanOrEqual(15);
    });

    it("BLACKWING_DECK loads and starts a duel in ocgcore without error", async () => {
      duel = await createEdisonDuel({
        seed: 1001n,
        deck0: { main: BLACKWING_DECK.main, extra: BLACKWING_DECK.extra },
        deck1: { main: BLACKWING_DECK.main, extra: BLACKWING_DECK.extra },
      });
      // step() should reach WAITING (rock-paper-scissors or idle) without throwing
      const result = await duel.step();
      expect(["waiting", "continue", "ended"]).toContain(result.status);
    });

    it("JUNK_FROG_DECK loads and starts a duel in ocgcore without error", async () => {
      duel = await createEdisonDuel({
        seed: 1002n,
        deck0: { main: JUNK_FROG_DECK.main, extra: JUNK_FROG_DECK.extra },
        deck1: { main: JUNK_FROG_DECK.main, extra: JUNK_FROG_DECK.extra },
      });
      const result = await duel.step();
      expect(["waiting", "continue", "ended"]).toContain(result.status);
    });
  },
);

// These run even without WASM — just checking the export shapes.
describe("Edison deck fixtures — export contract", () => {
  it("BLACKWING_DECK has main/extra/side arrays", () => {
    expect(Array.isArray(BLACKWING_DECK.main)).toBe(true);
    expect(Array.isArray(BLACKWING_DECK.extra)).toBe(true);
    expect(Array.isArray(BLACKWING_DECK.side)).toBe(true);
  });

  it("JUNK_FROG_DECK has main/extra/side arrays", () => {
    expect(Array.isArray(JUNK_FROG_DECK.main)).toBe(true);
    expect(Array.isArray(JUNK_FROG_DECK.extra)).toBe(true);
    expect(Array.isArray(JUNK_FROG_DECK.side)).toBe(true);
  });
});
