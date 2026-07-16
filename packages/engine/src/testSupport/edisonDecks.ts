// ---------------------------------------------------------------------------
// Canonical Edison test-deck fixtures (Phase 0 — Deliverable B)
//
// Both decks are representative Edison-era lists (circa April–September 2010).
// Byte-exact reproduction of edisonformat.net structure lists is NOT required;
// legal + representative + deterministic is the bar.
//
// Both MUST pass validateDeck(deck, catalog) with zero violations.
// See packages/engine/src/testSupport/edisonDecks.test.ts for the legality
// and engine-load assertions.
//
// Sources / substitutions:
//   - BLACKWING_DECK: Blackwing structure list from edisonformat.net, cross-
//     referenced with formatlibrary.com top-8 lists (2010).
//   - JUNK_FROG_DECK: Junk Frog / Frog Synchro structure list from
//     edisonformat.net.  Glow-Up Bulb (38614541), Ronintoadin (610461),
//     Formula Synchron, T.G. Hyper Librarian are NOT in the Edison catalog
//     (released post-September 2010); substituted with in-pool equivalents
//     (Beelze Frog, Krebons, Turbo Warrior, Junk Archer respectively).
//     Raiza the Storm Monarch omitted in favour of leaner count.
// ---------------------------------------------------------------------------

export interface DeckList {
  main: number[];
  extra: number[];
  side: number[];
}

// ---------------------------------------------------------------------------
// BLACKWING_DECK
// Main: 40 | Extra: 10 | Side: 0
// ---------------------------------------------------------------------------

export const BLACKWING_DECK: DeckList = {
  main: [
    // ── Monsters (17) ────────────────────────────────────────────────────────
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    75498415,
    75498415,
    75498415, // Blackwing - Sirocco the Dawn          x3
    49003716,
    49003716,
    49003716, // Blackwing - Bora the Spear            x3
    58820853,
    58820853,
    58820853, // Blackwing - Shura the Blue Flame      x3
    85215458,
    85215458,
    85215458, // Blackwing - Kalut the Moon Shadow     x3
    22835145, // Blackwing - Blizzard the Far North   x1
    72714392,
    72714392, // Blackwing - Vayu the Emblem of Honor  x2
    24508238, // D.D. Crow                             x1

    // ── Spells (9) ────────────────────────────────────────────────────────────
    1475311, // Allure of Darkness                    [Limited x1]
    91351370,
    91351370, // Black Whirlwind                       [Semi-Limited x2]
    87910978, // Brain Control                         [Limited x1]
    42703248, // Giant Trunade                         [Limited x1]
    14087893, // Book of Moon                          x1
    5318639, // Mystical Space Typhoon                [Limited x1]
    97169186,
    97169186, // Smashing Ground                       x2
    674561, // Dark Eruption                          x1

    // ── Traps (14) ────────────────────────────────────────────────────────────
    53567095,
    53567095, // Icarus Attack                         x2
    59839761, // Delta Crow - Anti Reverse             x1
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
    29401950,
    29401950, // Bottomless Trap Hole                  [Semi-Limited x2]
    70342110,
    70342110, // Dimensional Prison                    x2
    94192409,
    94192409, // Compulsory Evacuation Device          x2
  ],

  extra: [
    // ── Synchros (10) ─────────────────────────────────────────────────────────
    69031175,
    69031175,
    69031175, // Blackwing Armor Master                x3
    76913983,
    76913983, // Blackwing Armed Wing                  x2
    33236860, // Blackwing - Silverwind the Ascendant x1
    44508094, // Stardust Dragon                       x1
    73580471, // Black Rose Dragon                     [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier   [Limited x1]
  ],

  side: [],
};

// ---------------------------------------------------------------------------
// JUNK_FROG_DECK
// Main: 40 | Extra: 11 | Side: 0
//
// Substitutions vs. canonical edisonformat.net list:
//   • Glow-Up Bulb (38614541) → NOT in Edison catalog → swapped for Beelze Frog (49522489)
//   • Ronintoadin (610461)    → NOT in Edison catalog → removed (Substitoad fills similar role)
//   • Formula Synchron        → NOT in Edison catalog → swapped for Turbo Warrior (46195773)
//   • T.G. Hyper Librarian    → NOT in Edison catalog → swapped for Junk Archer (42810973)
//   • Raiza the Storm Monarch → omitted for card count; deck retains Caius as tribute pivot
// ---------------------------------------------------------------------------

export const JUNK_FROG_DECK: DeckList = {
  main: [
    // ── Frog Engine (14) ──────────────────────────────────────────────────────
    9126351,
    9126351,
    9126351, // Swap Frog                             x3
    46239604,
    46239604,
    46239604, // Dupe Frog                             x3
    12538374,
    12538374, // Treeborn Frog                         [Semi-Limited x2]
    20663556,
    20663556, // Substitoad                            x2
    84451804, // Des Frog                              x1
    49522489, // Beelze Frog                           x1 [substitution note above]

    // ── Synchro Engine (8) ────────────────────────────────────────────────────
    63977008,
    63977008,
    63977008, // Junk Synchron                         x3
    20932152, // Quickdraw Synchron                   x1
    23571046,
    23571046, // Quillbolt Hedgehog                   x2
    57421866, // Level Eater                           x1
    59575539, // Krebons                               x1

    // ── Monarch / Finisher (1) ────────────────────────────────────────────────
    9748752, // Caius the Shadow Monarch             x1

    // ── Spells (10) ───────────────────────────────────────────────────────────
    60682203, // Cold Wave                            [Limited x1]
    2295440, // One for One                          [Limited x1]
    98045062,
    98045062,
    98045062, // Enemy Controller                      x3
    67169062,
    67169062, // Pot of Avarice                        x2
    81439173, // Foolish Burial                       [Limited x1]
    19613556, // Heavy Storm                          [Limited x1]
    5318639, // Mystical Space Typhoon               [Limited x1]

    // ── Traps (9) ─────────────────────────────────────────────────────────────
    97077563, // Call of the Haunted                  [Limited x1]
    27551,
    27551, // Limit Reverse                        x2
    51452091,
    51452091, // Royal Decree                         [Semi-Limited x2]
    29401950,
    29401950, // Bottomless Trap Hole                 [Semi-Limited x2]
    94192409,
    94192409, // Compulsory Evacuation Device         x2
  ],

  extra: [
    // ── Synchros (11) ─────────────────────────────────────────────────────────
    44508094,
    44508094, // Stardust Dragon                       x2
    60800381,
    60800381, // Junk Warrior                          x2
    18013090, // Nitro Warrior                         x1
    3429238, // Drill Warrior                         x1
    23693634, // Colossal Fighter                      x1
    70780151, // Thought Ruler Archfiend               x1
    2322421, // Road Warrior                          x1
    46195773, // Turbo Warrior                         x1 [substitution note above]
    42810973, // Junk Archer                           x1 [substitution note above]
  ],

  side: [],
};
