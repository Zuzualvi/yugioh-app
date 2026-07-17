// ---------------------------------------------------------------------------
// STP-01..STP-17 — engine load/step smoke tests
//
// For each of the 17 canonical fixture decklists: confirms that
// createEdisonDuel({ deck0, deck1 }) + step() reaches a waiting/continue/ended
// status without throwing. This is a smoke test — not a rules audit.
//
// Acceptance pattern (from docs/working/2026-07-17-parity-matrix.md §4):
//   createEdisonDuel → step() → status ∈ { "waiting", "continue", "ended" }
// ---------------------------------------------------------------------------

import { afterEach, describe, it, expect } from "vitest";
import { isCustomWasmAvailable } from "./coreFactory.js";
import { createEdisonDuel } from "./createEdisonDuel.js";
import type { EdisonDuel } from "./EdisonDuel.js";
import {
  STP_01_QUICKDRAW_DANDY,
  STP_02_PLANT_TOOLBOX,
  STP_03_DOOMCAL_GADGETS,
  STP_04_MACHINA_GADGETS,
  STP_05_SYNCHRO_CAT,
  STP_06_GLADIATOR_BEASTS,
  STP_07_LIGHTSWORN_MONARCHS,
  STP_08_TWILIGHT,
  STP_09_BLACKWINGS,
  STP_10_VAYU_TURBO,
  STP_11_SIX_SAMURAI,
  STP_12_X_SABERS,
  STP_13_DIVA_HERO,
  STP_14_ZOMBIES,
  STP_15_FROGNARCH,
  STP_16_FLAMVELL,
  STP_17_BLACK_GARDEN,
} from "./testSupport/edisonDecks.js";

const WASM_AVAILABLE = isCustomWasmAvailable();

const FIXTURES = [
  { id: "STP-01", name: "Quickdraw Dandywarrior", deck: STP_01_QUICKDRAW_DANDY },
  { id: "STP-02", name: "Plant Toolbox", deck: STP_02_PLANT_TOOLBOX },
  { id: "STP-03", name: "Doomcaliber Gadgets", deck: STP_03_DOOMCAL_GADGETS },
  { id: "STP-04", name: "Machina Gadgets", deck: STP_04_MACHINA_GADGETS },
  { id: "STP-05", name: "Synchro Cat", deck: STP_05_SYNCHRO_CAT },
  { id: "STP-06", name: "Gladiator Beasts", deck: STP_06_GLADIATOR_BEASTS },
  { id: "STP-07", name: "Lightsworn Monarchs", deck: STP_07_LIGHTSWORN_MONARCHS },
  { id: "STP-08", name: "Twilight", deck: STP_08_TWILIGHT },
  { id: "STP-09", name: "Blackwings", deck: STP_09_BLACKWINGS },
  { id: "STP-10", name: "Vayu Turbo", deck: STP_10_VAYU_TURBO },
  { id: "STP-11", name: "Six Samurai", deck: STP_11_SIX_SAMURAI },
  { id: "STP-12", name: "X-Sabers", deck: STP_12_X_SABERS },
  { id: "STP-13", name: "Diva Hero", deck: STP_13_DIVA_HERO },
  { id: "STP-14", name: "Zombies", deck: STP_14_ZOMBIES },
  { id: "STP-15", name: "Frognarch", deck: STP_15_FROGNARCH },
  { id: "STP-16", name: "Flamvell", deck: STP_16_FLAMVELL },
  { id: "STP-17", name: "Black Garden", deck: STP_17_BLACK_GARDEN },
] as const;

describe.skipIf(!WASM_AVAILABLE)(
  "STP-01..STP-17 — engine load/step smoke tests [requires custom WASM]",
  () => {
    let duel: EdisonDuel | null = null;

    afterEach(() => {
      duel?.destroy();
      duel = null;
    });

    for (const { id, name, deck } of FIXTURES) {
      it(`${id} — ${name} loads and steps without error`, async () => {
        duel = await createEdisonDuel({
          seed: BigInt(id.replace("STP-", "")) + 2000n,
          deck0: { main: deck.main, extra: deck.extra },
          deck1: { main: deck.main, extra: deck.extra },
        });
        const result = await duel.step();
        expect(["waiting", "continue", "ended"]).toContain(result.status);
      });
    }
  },
);

// Runs without WASM — export shape checks only
describe("STP-01..STP-17 — export contract", () => {
  for (const { id, name, deck } of FIXTURES) {
    it(`${id} — ${name} has main/extra/side arrays`, () => {
      expect(Array.isArray(deck.main)).toBe(true);
      expect(Array.isArray(deck.extra)).toBe(true);
      expect(Array.isArray(deck.side)).toBe(true);
    });

    it(`${id} — ${name} main deck size is 40–60`, () => {
      expect(deck.main.length).toBeGreaterThanOrEqual(40);
      expect(deck.main.length).toBeLessThanOrEqual(60);
    });

    it(`${id} — ${name} extra deck size is 0–15`, () => {
      expect(deck.extra.length).toBeLessThanOrEqual(15);
    });

    it(`${id} — ${name} side deck size is 0–15`, () => {
      expect(deck.side.length).toBeLessThanOrEqual(15);
    });
  }
});
