// ---------------------------------------------------------------------------
// Deliverable B — fixture legality test (Phase 0)
//
// Asserts that BLACKWING_DECK and JUNK_FROG_DECK both pass validateDeck()
// with ZERO violations against the real Edison catalog.
//
// Deck lists are inlined here (same values as packages/engine/src/testSupport/edisonDecks.ts)
// because cross-package relative imports violate TypeScript's rootDir check.
// The engine-load test (createEdisonDuel + step()) lives in:
//   packages/engine/src/testSupport/edisonDecks.test.ts
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeAll } from "vitest";
import { validateDeck } from "./validateDeck.js";
import { loadCatalog } from "../catalog/loadCatalog.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Deck lists — must stay in sync with edisonDecks.ts in engine/testSupport
// ---------------------------------------------------------------------------

const BLACKWING_DECK = {
  main: [
    // Monsters (17)
    2009101, // Gale the Whirlwind [Limited x1]
    75498415,
    75498415,
    75498415, // Sirocco the Dawn x3
    49003716,
    49003716,
    49003716, // Bora the Spear x3
    58820853,
    58820853,
    58820853, // Shura the Blue Flame x3
    85215458,
    85215458,
    85215458, // Kalut the Moon Shadow x3
    22835145, // Blizzard the Far North x1
    72714392,
    72714392, // Vayu the Emblem of Honor x2
    24508238, // D.D. Crow x1
    // Spells (9)
    1475311, // Allure of Darkness [Limited x1]
    91351370,
    91351370, // Black Whirlwind [Semi x2]
    87910978, // Brain Control [Limited x1]
    42703248, // Giant Trunade [Limited x1]
    14087893, // Book of Moon x1
    5318639, // MST [Limited x1]
    97169186,
    97169186, // Smashing Ground x2
    674561, // Dark Eruption x1
    // Traps (14)
    53567095,
    53567095, // Icarus Attack x2
    59839761, // Delta Crow - Anti Reverse x1
    44095762, // Mirror Force [Limited x1]
    41420027, // Solemn Judgment [Limited x1]
    53582587, // Torrential Tribute [Limited x1]
    64697231, // Trap Dustshoot [Limited x1]
    29401950,
    29401950, // Bottomless Trap Hole [Semi x2]
    70342110,
    70342110, // Dimensional Prison x2
    94192409,
    94192409, // Compulsory Evacuation Device x2
  ],
  extra: [
    69031175,
    69031175,
    69031175, // Blackwing Armor Master x3
    76913983,
    76913983, // Blackwing Armed Wing x2
    33236860, // Blackwing - Silverwind the Ascendant x1
    44508094, // Stardust Dragon x1
    73580471, // Black Rose Dragon [Limited x1]
    7391448, // Goyo Guardian [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier [Limited x1]
  ],
  side: [] as number[],
};

const JUNK_FROG_DECK = {
  main: [
    // Frog Engine (14)
    9126351,
    9126351,
    9126351, // Swap Frog x3
    46239604,
    46239604,
    46239604, // Dupe Frog x3
    12538374,
    12538374, // Treeborn Frog [Semi x2]
    20663556,
    20663556, // Substitoad x2
    84451804, // Des Frog x1
    49522489, // Beelze Frog x1 (substitution for Glow-Up Bulb — not in Edison pool)
    // Synchro Engine (8)
    63977008,
    63977008,
    63977008, // Junk Synchron x3
    20932152, // Quickdraw Synchron x1
    23571046,
    23571046, // Quillbolt Hedgehog x2
    57421866, // Level Eater x1
    59575539, // Krebons x1
    // Monarch / Finisher (1)
    9748752, // Caius the Shadow Monarch x1
    // Spells (10)
    60682203, // Cold Wave [Limited x1]
    2295440, // One for One [Limited x1]
    98045062,
    98045062,
    98045062, // Enemy Controller x3
    67169062,
    67169062, // Pot of Avarice x2
    81439173, // Foolish Burial [Limited x1]
    19613556, // Heavy Storm [Limited x1]
    5318639, // MST [Limited x1]
    // Traps (9)
    97077563, // Call of the Haunted [Limited x1]
    27551,
    27551, // Limit Reverse x2
    51452091,
    51452091, // Royal Decree [Semi x2]
    29401950,
    29401950, // Bottomless Trap Hole [Semi x2]
    94192409,
    94192409, // Compulsory Evacuation Device x2
  ],
  extra: [
    44508094,
    44508094, // Stardust Dragon x2
    60800381,
    60800381, // Junk Warrior x2
    18013090, // Nitro Warrior x1
    3429238, // Drill Warrior x1
    23693634, // Colossal Fighter x1
    70780151, // Thought Ruler Archfiend x1
    2322421, // Road Warrior x1
    46195773, // Turbo Warrior x1 (substitution for Formula Synchron — not in Edison pool)
    42810973, // Junk Archer x1 (substitution for T.G. Hyper Librarian — not in Edison pool)
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------

let catalog: LoadedCatalog;

beforeAll(() => {
  catalog = loadCatalog();
});

describe("Edison deck fixtures — catalog legality (Phase 0 Deliverable B)", () => {
  it("BLACKWING_DECK passes validateDeck with zero violations", () => {
    const result = validateDeck(BLACKWING_DECK, catalog);
    if (!result.legal) {
      console.error("BLACKWING_DECK violations:", result.violations);
    }
    expect(result.legal).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("JUNK_FROG_DECK passes validateDeck with zero violations", () => {
    const result = validateDeck(JUNK_FROG_DECK, catalog);
    if (!result.legal) {
      console.error("JUNK_FROG_DECK violations:", result.violations);
    }
    expect(result.legal).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("BLACKWING_DECK main deck is exactly 40 cards", () => {
    expect(BLACKWING_DECK.main.length).toBe(40);
  });

  it("JUNK_FROG_DECK main deck is exactly 40 cards", () => {
    expect(JUNK_FROG_DECK.main.length).toBe(40);
  });
});
