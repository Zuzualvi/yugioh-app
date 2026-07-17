// ---------------------------------------------------------------------------
// Canonical Edison test-deck fixtures
//
// Phase 0 (Deliverable B): BLACKWING_DECK + JUNK_FROG_DECK
// Tier-3 staples (STP-01..STP-17): 17 additional canonical tournament lists
//   sourced from edisonformat.com/historic-decklists and /decks (2026-07-17).
//
// All decks MUST pass validateDeck(deck, catalog) with zero violations.
// See packages/engine/src/testSupport/edisonDecks.test.ts (Phase 0) and
// packages/engine/src/edisonFixtures.load.test.ts (STP-01..17) for
// engine-load assertions; see packages/server/src/domain/
// edisonFixtures.legality.test.ts for validateDeck assertions.
//
// Passcode/substitution notes (STP-01..17):
//   - Mystic Tomato: reference passcode 83011277 not in catalog; using
//     83011278 (same card, catalog passcode).
//   - STP-02: Sangan [26202165] added — present in source list, omitted
//     from reference transcription; restored to reach stated 40 main.
//   - STP-15 Substitoad [20663556]: CEO-confirmed UNLIMITED on our locked
//     March-2010 banlist. 3× kept as period-accurate.
//   - Phase 0 substitutions for JUNK_FROG_DECK noted below (unchanged).
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

// ===========================================================================
// STP-01..STP-17 — Tier-3 staples spot-check fixtures
// Source: docs/working/2026-07-17-edison-rules-reference.md §4
// ===========================================================================

// ---------------------------------------------------------------------------
// STP-01 — Quickdraw Dandywarrior (1st SJC Edison, Jeff Jones) · DB 6539169
// Main: 41 | Extra: 15 | Side: 15
// ---------------------------------------------------------------------------
export const STP_01_QUICKDRAW_DANDY: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter                x3
    9748752,
    9748752, // Caius the Shadow Monarch              x2
    15341821,
    15341821, // Dandylion                             x2 [Semi-Limited]
    14943837,
    14943837, // Debris Dragon                         x2
    48686504,
    48686504, // Lonefire Blossom                      x2
    20932152,
    20932152, // Quickdraw Synchron                    x2
    5220687,
    5220687, // Super-Nimble Mega Hamster              x2
    85087012, // Card Trooper                          [Limited x1]
    47297616, // Light and Darkness Dragon             x1
    33508719, // Morphing Jar                          [Limited x1]
    16226786, // Night Assailant                       [Limited x1]
    26202165, // Sangan                                [Limited x1]
    11819616, // Tytannial, Princess of Camellias      x1
    // ── Spells ───────────────────────────────────────────────────────────────
    67169062,
    67169062,
    67169062, // Pot of Avarice                        x3
    14087893,
    14087893, // Book of Moon                          x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    60082869,
    60082869, // Dust Tornado                          x2
    87910978, // Brain Control                         [Limited x1]
    81439173, // Foolish Burial                        [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    97077563, // Call of the Haunted                   [Limited x1]
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    58120309, // Starlight Road                        x1
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    3429238,
    3429238, // Drill Warrior                         x2
    19974580,
    19974580, // Iron Chain Dragon                     x2
    44508094,
    44508094, // Stardust Dragon                       x2
    79229522, // Chimeratech Fortress Dragon           x1
    26593852, // Ally of Justice Catastor              x1
    25862681, // Ancient Fairy Dragon                  x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    42810973, // Junk Archer                           x1
    18013090, // Nitro Warrior                         x1
    70902743, // Red Dragon Archfiend                  x1
    46195773, // Turbo Warrior                         x1
  ],
  side: [
    2980764,
    2980764, // Consecrated Light                     x2
    24508238,
    24508238, // D.D. Crow                             x2
    69279219,
    69279219, // My Body as a Shield                   x2
    18895832,
    18895832, // System Down                           x2
    13504844,
    13504844, // Gottoms' Emergency Call               x2
    34717238,
    34717238, // Pulling the Rug                       x2
    10651797,
    10651797, // Swallow Flip                          x2
    4206964, // Trap Hole                             x1
  ],
};

// ---------------------------------------------------------------------------
// STP-02 — Plant Toolbox (Quickdraw Plant variant) · DB 6571840
// Main: 40 | Extra: 15 | Side: 0
// Substitution: Mystic Tomato 83011277 (ref) → 83011278 (catalog passcode)
// ---------------------------------------------------------------------------
export const STP_02_PLANT_TOOLBOX: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    45247637,
    45247637,
    45247637, // Mark of the Rose                      x3
    3657444,
    3657444, // Cyber Valley                          x2
    15341821,
    15341821, // Dandylion                             x2 [Semi-Limited]
    48686504,
    48686504, // Lonefire Blossom                      x2
    83011278,
    83011278, // Mystic Tomato                         x2 [passcode 83011278]
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    71413901, // Breaker the Magical Warrior           x1
    31615285, // Cactus Bouncer                        x1
    9748752, // Caius the Shadow Monarch              x1
    85087012, // Card Trooper                          [Limited x1]
    65192027, // Dark Armed Dragon                     [Limited x1]
    14943837, // Debris Dragon                         x1
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    41201555, // Koa'ki Meiru Gravirose                x1
    33420078, // Plaguespreader Zombie                 [Limited x1]
    26202165, // Sangan                                [Limited x1]
    98777036, // Tragoedia                             [Limited x1]
    11819616, // Tytannial, Princess of Camellias      x1
    // ── Spells ───────────────────────────────────────────────────────────────
    67169062,
    67169062,
    67169062, // Pot of Avarice                        x3
    87910978, // Brain Control                         [Limited x1]
    81439173, // Foolish Burial                        [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    37520316, // Mind Control                          [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    97077563, // Call of the Haunted                   [Limited x1]
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    23693634,
    23693634, // Colossal Fighter                      x2
    19974580,
    19974580, // Iron Chain Dragon                     x2
    44508094,
    44508094, // Stardust Dragon                       x2
    26593852, // Ally of Justice Catastor              x1
    25862681, // Ancient Fairy Dragon                  x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    88643579, // Dark End Dragon                       x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-03 — Doomcaliber Gadgets (2nd SJC Edison, Renaldo Lainez) · DB 6539011
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_03_DOOMCAL_GADGETS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    78700060,
    78700060,
    78700060, // Doomcaliber Knight                    x3
    41172955,
    41172955,
    41172955, // Green Gadget                          x3
    86445415,
    86445415,
    86445415, // Red Gadget                            x3
    13839120,
    13839120,
    13839120, // Yellow Gadget                         x3
    70095154,
    70095154, // Cyber Dragon                          x2 [Semi-Limited]
    26412047,
    26412047, // Hammer Shot                           x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    93016201,
    93016201, // Royal Oppression                      x2 [Semi-Limited]
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    33420078, // Plaguespreader Zombie                 [Limited x1]
    98777036, // Tragoedia                             [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    66788016,
    66788016,
    66788016, // Fissure                               x3
    97169186,
    97169186,
    97169186, // Smashing Ground                       x3
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    19613556, // Heavy Storm                           [Limited x1]
    69162969, // Lightning Vortex                      x1
    23171610, // Limiter Removal                       [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    44095762, // Mirror Force                          [Limited x1]
    63356631, // Phoenix Wing Wind Blast               x1
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    79229522,
    79229522, // Chimeratech Fortress Dragon           x2
    44508094,
    44508094, // Stardust Dragon                       x2
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    53714009, // Flamvell Uruquizas                    x1
    97204936, // Gaia Knight, the Force of Earth       x1
    7391448, // Goyo Guardian                         [Limited x1]
    25862681, // Ancient Fairy Dragon                  x1
    73580471, // Black Rose Dragon                     [Limited x1]
    69031175, // Blackwing Armor Master                x1
    69514125, // Avenging Knight Parshath              x1
    23693634, // Colossal Fighter                      x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-04 — Machina (Gadget) (16th SJC Edison) · DB 6539132
// Main: 44 | Extra: 15 | Side: 0
// Notes: Ultimate Offering [80604091] x2 — Semi-Limited (max 2) ✓
// ---------------------------------------------------------------------------
export const STP_04_MACHINA_GADGETS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    41172955,
    41172955,
    41172955, // Green Gadget                          x3
    86445415,
    86445415,
    86445415, // Red Gadget                            x3
    13839120,
    13839120,
    13839120, // Yellow Gadget                         x3
    42940404,
    42940404,
    42940404, // Machina Gearframe                     x3
    5556499,
    5556499, // Machina Fortress                      x2
    78349103,
    78349103, // Machina Peacekeeper                   x2
    // ── Spells ───────────────────────────────────────────────────────────────
    86780027,
    86780027,
    86780027, // Solidarity                            x3
    97169186,
    97169186,
    97169186, // Smashing Ground                       x3
    71044499,
    71044499,
    71044499, // Nobleman of Crossout                  x3
    31036355,
    31036355,
    31036355, // Creature Swap                         x3
    23171610, // Limiter Removal                       [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    93016201,
    93016201, // Royal Oppression                      x2 [Semi-Limited]
    80604091,
    80604091, // Ultimate Offering                     x2 [Semi-Limited]
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    58120309, // Starlight Road                        x1
    53582587, // Torrential Tribute                    [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon           x3
    44508094,
    44508094, // Stardust Dragon                       x2
    29071332, // Armory Arm                            x1
    26593852, // Ally of Justice Catastor              x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    73580471, // Black Rose Dragon                     [Limited x1]
    69031175, // Blackwing Armor Master                x1
    2403771, // Power Tool Dragon                     x1
    23693634, // Colossal Fighter                      x1
    70780151, // Thought Ruler Archfiend               x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-05 — Synchro Cat / Rescue Cat (3rd SJC Edison) · DB 6538938
// Main: 41 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_05_SYNCHRO_CAT: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    78700060,
    78700060,
    78700060, // Doomcaliber Knight                    x3
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x3
    90508760,
    90508760,
    90508760, // X-Saber Airbellum                     x3
    70095154,
    70095154, // Cyber Dragon                          x2 [Semi-Limited]
    24317029,
    24317029, // Gravekeeper's Spy                     x2
    14087893,
    14087893, // Book of Moon                          x2
    67169062,
    67169062, // Pot of Avarice                        x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    9748752, // Caius the Shadow Monarch              x1
    9596126, // Chaos Sorcerer                        [Limited x1]
    65192027, // Dark Armed Dragon                     [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    30213599, // Gravekeeper's Descendant              x1
    14878871, // Rescue Cat                            [Limited x1]
    26202165, // Sangan                                [Limited x1]
    423585, // Summoner Monk                          [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    1475311, // Allure of Darkness                    [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    37520316, // Mind Control                          [Limited x1]
    69279219, // My Body as a Shield                   x1
    5318639, // Mystical Space Typhoon                [Limited x1]
    97169186, // Smashing Ground                       x1
    // ── Traps ────────────────────────────────────────────────────────────────
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    60082869, // Dust Tornado                          x1
    41420027, // Solemn Judgment                       [Limited x1]
    58120309, // Starlight Road                        x1
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    31924889,
    31924889, // Arcanite Magician                     x2
    44508094,
    44508094, // Stardust Dragon                       x2
    79229522, // Chimeratech Fortress Dragon           x1
    26593852, // Ally of Justice Catastor              x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    23693634, // Colossal Fighter                      x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
    27315304, // Mist Wurm                             x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
    80108118, // X-Saber Urbellum                      x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-06 — Gladiator Beasts (5th SJC Edison, Jake Mattern) · DB 7798916
// Main: 42 | Extra: 15 | Side: 0
// Notes: Elemental HERO Stratos [40044918] limited (x1) ✓;
//        Gladiator Beast Bestiari [41470137] limited (x1) ✓
// ---------------------------------------------------------------------------
export const STP_06_GLADIATOR_BEASTS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    92373006,
    92373006,
    92373006, // Test Tiger                            x3
    89312388,
    89312388, // Elemental HERO Prisma                 x2
    25924653,
    25924653, // Gladiator Beast Darius                x2
    78868776,
    78868776, // Gladiator Beast Laquari               x2
    40044918, // Elemental HERO Stratos                [Limited x1]
    41470137, // Gladiator Beast Bestiari              [Limited x1]
    57731460, // Gladiator Beast Equeste               x1
    4253484, // Gladiator Beast Hoplomus              x1
    5975022, // Gladiator Beast Murmillo              x1
    612115, // Gladiator Beast Retiari               x1
    77642288, // Gladiator Beast Secutor               x1
    33508719, // Morphing Jar                          [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    14087893,
    14087893,
    14087893, // Book of Moon                          x3
    98045062,
    98045062, // Enemy Controller                      x2
    60682203, // Cold Wave                             [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    32807846, // Reinforcement of the Army             [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    60082869,
    60082869,
    60082869, // Dust Tornado                          x3
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    94192409,
    94192409, // Compulsory Evacuation Device          x2
    96216229,
    96216229, // Gladiator Beast War Chariot           x2
    58120309,
    58120309, // Starlight Road                        x2
    97077563, // Call of the Haunted                   [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon           x3
    48156348,
    48156348,
    48156348, // Gladiator Beast Gyzarus               x3
    27346636,
    27346636,
    27346636, // Gladiator Beast Heraklinos            x3
    44508094,
    44508094, // Stardust Dragon                       x2
    73580471, // Black Rose Dragon                     [Limited x1]
    23693634, // Colossal Fighter                      x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-07 — Lightsworn Monarchs (6th SJC Edison, Jarel Winston) · DB 6539120
// Main: 42 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_07_LIGHTSWORN_MONARCHS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    9748752,
    9748752,
    9748752, // Caius the Shadow Monarch              x3
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x3
    70095154,
    70095154, // Cyber Dragon                          x2 [Semi-Limited]
    15341821,
    15341821, // Dandylion                             x2 [Semi-Limited]
    96235275,
    96235275, // Jain, Lightsworn Paladin              x2
    22624373,
    22624373, // Lyla, Lightsworn Sorceress            x2
    5220687,
    5220687, // Super-Nimble Mega Hamster              x2
    26205777,
    26205777, // Thestalos the Firestorm Monarch       x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    85087012, // Card Trooper                          [Limited x1]
    14943837, // Debris Dragon                         x1
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    26202165, // Sangan                                [Limited x1]
    12538374, // Treeborn Frog                         [Semi-Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    67169062,
    67169062,
    67169062, // Pot of Avarice                        x3
    14087893,
    14087893, // Book of Moon                          x2
    691925,
    691925, // Solar Recharge                        x2
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    63356631,
    63356631, // Phoenix Wing Wind Blast               x2
    44095762, // Mirror Force                          [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    79229522,
    79229522, // Chimeratech Fortress Dragon           x2
    44508094,
    44508094, // Stardust Dragon                       x2
    26593852, // Ally of Justice Catastor              x1
    43385557, // Magical Android                       x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    25862681, // Ancient Fairy Dragon                  x1
    73580471, // Black Rose Dragon                     [Limited x1]
    22858242, // Zeman the Ape King                    x1
    23693634, // Colossal Fighter                      x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-08 — Twilight (Lightsworn + Chaos) (13th SJC Edison) · DB 6539238
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_08_TWILIGHT: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    9748752,
    9748752,
    9748752, // Caius the Shadow Monarch              x3
    22624373,
    22624373,
    22624373, // Lyla, Lightsworn Sorceress            x3
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x3
    5220687,
    5220687, // Super-Nimble Mega Hamster              x2
    67169062,
    67169062, // Pot of Avarice                        x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    85087012, // Card Trooper                          [Limited x1]
    94381039, // Celestia, Lightsworn Angel            x1
    9596126, // Chaos Sorcerer                        [Limited x1]
    65192027, // Dark Armed Dragon                     [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    4906301, // Necro Gardna                          [Limited x1]
    33420078, // Plaguespreader Zombie                 [Limited x1]
    26202165, // Sangan                                [Limited x1]
    23205979, // Spirit Reaper                         [Limited x1]
    58996430, // Wulf, Lightsworn Beast                x1
    // ── Spells ───────────────────────────────────────────────────────────────
    14087893,
    14087893,
    14087893, // Book of Moon                          x3
    691925,
    691925,
    691925, // Solar Recharge                        x3
    1475311, // Allure of Darkness                    [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    94886282, // Charge of the Light Brigade           [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    44095762, // Mirror Force                          [Limited x1]
    93016201, // Royal Oppression                      [Semi-Limited x1]
  ],
  extra: [
    29071332, // Armory Arm                            x1
    26593852, // Ally of Justice Catastor              x1
    43385557, // Magical Android                       x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    63101919, // Tempest Magician                      x1
    31924889, // Arcanite Magician                     x1
    73580471, // Black Rose Dragon                     [Limited x1]
    69031175, // Blackwing Armor Master                x1
    23693634, // Colossal Fighter                      x1
    70902743, // Red Dragon Archfiend                  x1
    44508094, // Stardust Dragon                       x1
    70780151, // Thought Ruler Archfiend               x1
    69514125, // Avenging Knight Parshath              x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-09 — Blackwings (14th SJC Edison) · DB 6538847
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_09_BLACKWINGS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    22835145,
    22835145,
    22835145, // Blackwing - Blizzard the Far North    x3
    49003716,
    49003716,
    49003716, // Blackwing - Bora the Spear            x3
    85215458,
    85215458,
    85215458, // Blackwing - Kalut the Moon Shadow     x3
    58820853,
    58820853,
    58820853, // Blackwing - Shura the Blue Flame      x3
    75498415,
    75498415,
    75498415, // Blackwing - Sirocco the Dawn          x3
    72714392,
    72714392, // Blackwing - Vayu the Emblem of Honor  x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    65192027, // Dark Armed Dragon                     [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    14087893,
    14087893,
    14087893, // Book of Moon                          x3
    91351370,
    91351370, // Black Whirlwind                       x2 [Semi-Limited]
    1475311, // Allure of Darkness                    [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    69279219, // My Body as a Shield                   x1
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    53567095,
    53567095,
    53567095, // Icarus Attack                         x3
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    93016201,
    93016201, // Royal Oppression                      x2 [Semi-Limited]
    59839761, // Delta Crow - Anti Reverse             x1
    44095762, // Mirror Force                          [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    76913983,
    76913983,
    76913983, // Blackwing Armed Wing                  x3
    69031175,
    69031175, // Blackwing Armor Master                x2
    44508094,
    44508094, // Stardust Dragon                       x2
    26593852, // Ally of Justice Catastor              x1
    43385557, // Magical Android                       x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    73580471, // Black Rose Dragon                     [Limited x1]
    33236860, // Blackwing - Silverwind the Ascendant  x1
    23693634, // Colossal Fighter                      x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-10 — Vayu Turbo (post-2020, DD5 2nd place) · DB 13793230
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_10_VAYU_TURBO: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    75498415,
    75498415,
    75498415, // Blackwing - Sirocco the Dawn          x3
    72714392,
    72714392,
    72714392, // Blackwing - Vayu the Emblem of Honor  x3
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x3
    28985331,
    28985331, // Armageddon Knight                     x2
    9748752,
    9748752, // Caius the Shadow Monarch              x2
    14536035,
    14536035, // Dark Grepher                          x2
    5220687,
    5220687, // Super-Nimble Mega Hamster              x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    85087012, // Card Trooper                          [Limited x1]
    9596126, // Chaos Sorcerer                        [Limited x1]
    65192027, // Dark Armed Dragon                     [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    4906301, // Necro Gardna                          [Limited x1]
    33420078, // Plaguespreader Zombie                 [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    1475311, // Allure of Darkness                    [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    48976825, // Burial from a Different Dimension     [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    32807846, // Reinforcement of the Army             [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    44095762, // Mirror Force                          [Limited x1]
    27174286, // Return from the Different Dimension   [Limited x1]
    93016201, // Royal Oppression                      [Semi-Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    76913983,
    76913983, // Blackwing Armed Wing                  x2
    69031175,
    69031175, // Blackwing Armor Master                x2
    26593852, // Ally of Justice Catastor              x1
    29071332, // Armory Arm                            x1
    73580471, // Black Rose Dragon                     [Limited x1]
    33236860, // Blackwing - Silverwind the Ascendant  x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    23693634, // Colossal Fighter                      x1
    88643579, // Dark End Dragon                       x1
    53714009, // Flamvell Uruquizas                    x1
    7391448, // Goyo Guardian                         [Limited x1]
    44508094, // Stardust Dragon                       x1
    70780151, // Thought Ruler Archfiend               x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-11 — Six Samurai (notable SJC Edison) · DB 6550608
// Main: 41 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_11_SIX_SAMURAI: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    83039729,
    83039729,
    83039729, // Grandmaster of the Six Samurai        x3
    78792195,
    78792195,
    78792195, // Hand of the Six Samurai               x3
    27782503,
    27782503,
    27782503, // The Six Samurai - Irou                x3
    64398890,
    64398890,
    64398890, // The Six Samurai - Yaichi              x3
    95519486,
    95519486,
    95519486, // The Six Samurai - Zanji               x3
    90397998, // The Six Samurai - Kamon               x1
    // ── Spells ───────────────────────────────────────────────────────────────
    27970830,
    27970830,
    27970830, // Gateway of the Six                    x3
    72345736,
    72345736,
    72345736, // Six Samurai United                    x3
    86780027,
    86780027,
    86780027, // Solidarity                            x3
    55713623,
    55713623, // Shrink                                x2
    95281259,
    95281259, // The Warrior Returning Alive           x2
    19613556, // Heavy Storm                           [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    58120309,
    58120309,
    58120309, // Starlight Road                        x3
    32603633, // Backs to the Wall                     x1
    97077563, // Call of the Haunted                   [Limited x1]
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon           x3
    44508094,
    44508094,
    44508094, // Stardust Dragon                       x3
    26593852, // Ally of Justice Catastor              x1
    25862681, // Ancient Fairy Dragon                  x1
    29071332, // Armory Arm                            x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    97204936, // Gaia Knight, the Force of Earth       x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-12 — X-Sabers (post-2020 event) · DB 9222333
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_12_X_SABERS: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    90508760,
    90508760,
    90508760, // X-Saber Airbellum                     x3
    42737833,
    42737833,
    42737833, // XX-Saber Emmersblade                  x3
    51808422,
    51808422,
    51808422, // XX-Saber Faultroll                    x3
    78422252,
    78422252,
    78422252, // XX-Saber Fulhelmknight                x3
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x2
    87292536,
    87292536, // XX-Saber Ragigura                     x2
    14878871, // Rescue Cat                            [Limited x1]
    26202165, // Sangan                                [Limited x1]
    423585, // Summoner Monk                          [Limited x1]
    5220687, // Super-Nimble Mega Hamster              x1
    // ── Spells ───────────────────────────────────────────────────────────────
    14087893,
    14087893,
    14087893, // Book of Moon                          x3
    70368879,
    70368879,
    70368879, // Upstart Goblin                        x3
    13504844,
    13504844,
    13504844, // Gottoms' Emergency Call               x3
    87910978, // Brain Control                         [Limited x1]
    60682203, // Cold Wave                             [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    37520316, // Mind Control                          [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    2295440, // One for One                           [Limited x1]
    32807846, // Reinforcement of the Army             [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    97077563, // Call of the Haunted                   [Limited x1]
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    52352005,
    52352005, // XX-Saber Gottoms                      x2
    79229522, // Chimeratech Fortress Dragon           x1
    26593852, // Ally of Justice Catastor              x1
    31924889, // Arcanite Magician                     x1
    29071332, // Armory Arm                            x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    23693634, // Colossal Fighter                      x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
    27315304, // Mist Wurm                             x1
    44508094, // Stardust Dragon                       x1
    80108118, // X-Saber Urbellum                      x1
    2203790, // XX-Saber Hyunlei                      x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-13 — Diva Hero (post-2020, DD4 5th place, Moom) · DB 13365596
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_13_DIVA_HERO: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    9748752,
    9748752,
    9748752, // Caius the Shadow Monarch              x3
    78868119,
    78868119,
    78868119, // Deep Sea Diva                         x3
    50304345,
    50304345, // Evil HERO Infernal Prodigy            x2
    9411399,
    9411399, // Destiny HERO - Malicious              x2 [Semi-Limited]
    91133740,
    91133740, // Snowman Eater                         x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    33420078, // Plaguespreader Zombie                 [Limited x1]
    40044918, // Elemental HERO Stratos                [Limited x1]
    69884162, // Elemental HERO Neos Alius             x1
    42463414, // Spined Gillman                        x1
    14536035, // Dark Grepher                          x1
    23205979, // Spirit Reaper                         [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    45906428,
    45906428,
    45906428, // Miracle Fusion                        x3
    1475311, // Allure of Darkness                    [Limited x1]
    32807846, // Reinforcement of the Army             [Limited x1]
    213326, // E - Emergency Call                    x1
    77565204, // Future Fusion                         [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    75500286, // Gold Sarcophagus                      [Semi-Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    63356631, // Phoenix Wing Wind Blast               x1
    44095762, // Mirror Force                          [Limited x1]
    53582587, // Torrential Tribute                    [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    27174286, // Return from the Different Dimension   [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    40854197,
    40854197,
    40854197, // Elemental HERO Absolute Zero          x3
    79229522, // Chimeratech Fortress Dragon           x1
    29071332, // Armory Arm                            x1
    26593852, // Ally of Justice Catastor              x1
    43385557, // Magical Android                       x1
    7391448, // Goyo Guardian                         [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    73580471, // Black Rose Dragon                     [Limited x1]
    44508094, // Stardust Dragon                       x1
    88643579, // Dark End Dragon                       x1
    70780151, // Thought Ruler Archfiend               x1
    23693634, // Colossal Fighter                      x1
    16304628, // Elemental HERO Gaia                   x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-14 — Zombies / Zombiesworn-adjacent (post-2020, DD4 2nd) · DB 13365417
// Main: 41 | Extra: 15 | Side: 0
// Substitution: Mystic Tomato 83011277 (ref) → 83011278 (catalog passcode)
// ---------------------------------------------------------------------------
export const STP_14_ZOMBIES: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    9748752,
    9748752, // Caius the Shadow Monarch              x2
    70095154,
    70095154, // Cyber Dragon                          x2 [Semi-Limited]
    24508238,
    24508238, // D.D. Crow                             x2
    78868119,
    78868119, // Deep Sea Diva                         x2
    63665875,
    63665875, // Goblin Zombie                         x2 [Semi-Limited]
    83011278,
    83011278, // Mystic Tomato                         x2 [passcode 83011278]
    77044671,
    77044671, // Pyramid Turtle                        x2
    2204140,
    2204140, // Book of Life                          x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    60082869,
    60082869, // Dust Tornado                          x2
    65192027, // Dark Armed Dragon                     [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    92826944, // Mezuki                                [Limited x1]
    33420078, // Plaguespreader Zombie                 [Limited x1]
    26202165, // Sangan                                [Limited x1]
    23205979, // Spirit Reaper                         [Limited x1]
    17259470, // Zombie Master                         x1
    // ── Spells ───────────────────────────────────────────────────────────────
    1475311, // Allure of Darkness                    [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    37520316, // Mind Control                          [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    97077563, // Call of the Haunted                   [Limited x1]
    44095762, // Mirror Force                          [Limited x1]
    27174286, // Return from the Different Dimension   [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    58120309, // Starlight Road                        x1
    53582587, // Torrential Tribute                    [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    79229522, // Chimeratech Fortress Dragon           x1
    26593852, // Ally of Justice Catastor              x1
    29071332, // Armory Arm                            x1
    73580471, // Black Rose Dragon                     [Limited x1]
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    23693634, // Colossal Fighter                      x1
    88643579, // Dark End Dragon                       x1
    6021033, // Doomkaiser Dragon                     x1
    53714009, // Flamvell Uruquizas                    x1
    97204936, // Gaia Knight, the Force of Earth       x1
    7391448, // Goyo Guardian                         [Limited x1]
    27315304, // Mist Wurm                             x1
    5309481, // Revived King Ha Des                   x1
    44508094, // Stardust Dragon                       x1
    70780151, // Thought Ruler Archfiend               x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-15 — Frognarch / Frog Monarch (post-2020, DD03 3rd, Corinna) · DB 12421850
// Main: 40 | Extra: 15 | Side: 0
// ⚠️  CEO-confirmed: Substitoad [20663556] is UNLIMITED on our locked March-2010
//     banlist. 3× is period-accurate and passes validateDeck. Annotated here.
// ---------------------------------------------------------------------------
export const STP_15_FROGNARCH: DeckList = {
  main: [
    // ── Frog Engine ──────────────────────────────────────────────────────────
    20663556,
    20663556,
    20663556, // Substitoad [UNLIMITED — CEO-confirmed] x3
    9126351,
    9126351,
    9126351, // Swap Frog                             x3
    12538374,
    12538374, // Treeborn Frog                         x2 [Semi-Limited]
    46239604,
    46239604, // Dupe Frog                             x2
    56052205, // Unifrog                               x1
    // ── Synchro Engine ───────────────────────────────────────────────────────
    63977008,
    63977008,
    63977008, // Junk Synchron                         x3
    // ── Monarchs / Finishers ─────────────────────────────────────────────────
    9748752,
    9748752,
    9748752, // Caius the Shadow Monarch              x3
    73125233,
    73125233, // Raiza the Storm Monarch               x2
    4929256, // Mobius the Frost Monarch              x1
    // ── Other Monsters ───────────────────────────────────────────────────────
    19665973,
    19665973, // Battle Fader                          x2
    65192027, // Dark Armed Dragon                     [Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    98777036, // Tragoedia                             [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    75500286,
    75500286, // Gold Sarcophagus                      x2 [Semi-Limited]
    98045062,
    98045062, // Enemy Controller                      x2
    32807846, // Reinforcement of the Army             [Limited x1]
    1475311, // Allure of Darkness                    [Limited x1]
    2295440, // One for One                           [Limited x1]
    73915051, // Scapegoat                             [Limited x1]
    87910978, // Brain Control                         [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    60682203, // Cold Wave                             [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    36361633,
    36361633, // Threatening Roar                      x2
    44095762, // Mirror Force                          [Limited x1]
  ],
  extra: [
    26593852,
    26593852, // Ally of Justice Catastor              x2
    29071332, // Armory Arm                            x1
    60800381, // Junk Warrior                          x1
    43385557, // Magical Android                       x1
    53714009, // Flamvell Uruquizas                    x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    80108118, // X-Saber Urbellum                      x1
    73580471, // Black Rose Dragon                     [Limited x1]
    44508094, // Stardust Dragon                       x1
    70780151, // Thought Ruler Archfiend               x1
    23693634, // Colossal Fighter                      x1
    70902743, // Red Dragon Archfiend                  x1
    27315304, // Mist Wurm                             x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-16 — Flamvell (rogue, 7th SJC Edison) · DB 6539021
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_16_FLAMVELL: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    9748752,
    9748752,
    9748752, // Caius the Shadow Monarch              x3
    23297235,
    23297235,
    23297235, // Flamvell Firedog                      x3
    95621257,
    95621257,
    95621257, // Flamvell Magician                     x3
    24317029,
    24317029,
    24317029, // Gravekeeper's Spy                     x3
    21502796,
    21502796,
    21502796, // Ryko, Lightsworn Hunter               x3
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    70342110,
    70342110, // Dimensional Prison                    x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    9596126, // Chaos Sorcerer                        [Limited x1]
    70095154, // Cyber Dragon                          [Semi-Limited x1]
    44330098, // Gorz the Emissary of Darkness         [Limited x1]
    30213599, // Gravekeeper's Descendant              x1
    5220687, // Super-Nimble Mega Hamster              x1
    // ── Spells ───────────────────────────────────────────────────────────────
    14087893,
    14087893,
    14087893, // Book of Moon                          x3
    74845897,
    74845897,
    74845897, // Rekindling                            x3
    87910978, // Brain Control                         [Limited x1]
    19613556, // Heavy Storm                           [Limited x1]
    37520316, // Mind Control                          [Limited x1]
    5318639, // Mystical Space Typhoon                [Limited x1]
    // ── Traps ────────────────────────────────────────────────────────────────
    60082869, // Dust Tornado                          x1
    44095762, // Mirror Force                          [Limited x1]
    93016201, // Royal Oppression                      [Semi-Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    64697231, // Trap Dustshoot                        [Limited x1]
  ],
  extra: [
    23693634,
    23693634, // Colossal Fighter                      x2
    44508094,
    44508094, // Stardust Dragon                       x2
    26593852, // Ally of Justice Catastor              x1
    43385557, // Magical Android                       x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    7391448, // Goyo Guardian                         [Limited x1]
    53714009, // Flamvell Uruquizas                    x1
    31924889, // Arcanite Magician                     x1
    73580471, // Black Rose Dragon                     [Limited x1]
    80108118, // X-Saber Urbellum                      x1
    69031175, // Blackwing Armor Master                x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
  ],
  side: [],
};

// ---------------------------------------------------------------------------
// STP-17 — Black Garden (rogue control/burn, notable SJC Edison) · DB 6571645
// Main: 40 | Extra: 15 | Side: 0
// ---------------------------------------------------------------------------
export const STP_17_BLACK_GARDEN: DeckList = {
  main: [
    // ── Monsters ─────────────────────────────────────────────────────────────
    76922029,
    76922029,
    76922029, // Don Zaloog                            x3
    24317029,
    24317029,
    24317029, // Gravekeeper's Spy                     x3
    76459806,
    76459806,
    76459806, // Volcanic Rocket                       x3
    33365932,
    33365932,
    33365932, // Volcanic Shell                        x3
    87621407,
    87621407, // Dekoichi the Battlechanted Locomotive x2
    2009101, // Blackwing - Gale the Whirlwind        [Limited x1]
    85087012, // Card Trooper                          [Limited x1]
    30213599, // Gravekeeper's Descendant              x1
    33508719, // Morphing Jar                          [Limited x1]
    // ── Spells ───────────────────────────────────────────────────────────────
    71645242,
    71645242,
    71645242, // Black Garden                          x3
    70342110,
    70342110,
    70342110, // Dimensional Prison                    x3
    69537999,
    69537999, // Blaze Accelerator                     x2
    67169062,
    67169062, // Pot of Avarice                        x2
    29401950,
    29401950, // Bottomless Trap Hole                  x2 [Semi-Limited]
    73628505, // Terraforming                          x1
    60082869, // Dust Tornado                          x1
    // ── Traps ────────────────────────────────────────────────────────────────
    49010598,
    49010598, // Divine Wrath                          x2
    63356631,
    63356631, // Phoenix Wing Wind Blast               x2
    44095762, // Mirror Force                          [Limited x1]
    41420027, // Solemn Judgment                       [Limited x1]
    58120309, // Starlight Road                        x1
    53582587, // Torrential Tribute                    [Limited x1]
  ],
  extra: [
    44508094,
    44508094,
    44508094, // Stardust Dragon                       x3
    26593852, // Ally of Justice Catastor              x1
    31924889, // Arcanite Magician                     x1
    73580471, // Black Rose Dragon                     [Limited x1]
    69031175, // Blackwing Armor Master                x1
    50321796, // Brionac, Dragon of the Ice Barrier    [Limited x1]
    23693634, // Colossal Fighter                      x1
    53714009, // Flamvell Uruquizas                    x1
    7391448, // Goyo Guardian                         [Limited x1]
    43385557, // Magical Android                       x1
    70902743, // Red Dragon Archfiend                  x1
    70780151, // Thought Ruler Archfiend               x1
    80108118, // X-Saber Urbellum                      x1
  ],
  side: [],
};
