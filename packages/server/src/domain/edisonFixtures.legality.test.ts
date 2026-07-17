// ---------------------------------------------------------------------------
// STP-01..STP-17 — validateDeck legality smoke tests
//
// For each of the 17 canonical fixture decklists: confirms that
// validateDeck({main, extra, side}, catalog) returns legal:true with zero
// violations against the real Edison catalog (March-2010 banlist).
//
// Deck lists are inlined (same passcodes as engine/src/testSupport/edisonDecks.ts)
// because cross-package relative imports violate TypeScript's rootDir check.
//
// Substitution notes (documented in edisonDecks.ts):
//   STP-02: Sangan [26202165] added (ref transcription was missing it).
//   STP-02, STP-14: Mystic Tomato 83011277 (ref) → 83011278 (catalog passcode).
//   STP-15: Substitoad [20663556] ×3 — CEO-confirmed UNLIMITED on our banlist;
//           3× is period-accurate and must pass validateDeck.
// ---------------------------------------------------------------------------

import { beforeAll, describe, expect, it } from "vitest";
import { validateDeck } from "./validateDeck.js";
import { loadCatalog } from "../catalog/loadCatalog.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// STP-01 — Quickdraw Dandywarrior (1st SJC Edison, Jeff Jones) · DB 6539169
// Main: 41 | Extra: 15 | Side: 15
// ---------------------------------------------------------------------------
const STP_01 = {
  main: [
    21502796,
    21502796,
    21502796, // Ryko x3
    9748752,
    9748752, // Caius x2
    15341821,
    15341821, // Dandylion x2 [Semi]
    14943837,
    14943837, // Debris Dragon x2
    48686504,
    48686504, // Lonefire Blossom x2
    20932152,
    20932152, // Quickdraw Synchron x2
    5220687,
    5220687, // Super-Nimble Mega Hamster x2
    85087012, // Card Trooper [Ltd x1]
    47297616, // Light and Darkness Dragon x1
    33508719, // Morphing Jar [Ltd x1]
    16226786, // Night Assailant [Ltd x1]
    26202165, // Sangan [Ltd x1]
    11819616, // Tytannial x1
    67169062,
    67169062,
    67169062, // Pot of Avarice x3
    14087893,
    14087893, // Book of Moon x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    60082869,
    60082869, // Dust Tornado x2
    87910978, // Brain Control [Ltd x1]
    81439173, // Foolish Burial [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    5318639, // MST [Ltd x1]
    97077563, // Call of the Haunted [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    58120309, // Starlight Road x1
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    3429238,
    3429238, // Drill Warrior x2
    19974580,
    19974580, // Iron Chain Dragon x2
    44508094,
    44508094, // Stardust Dragon x2
    79229522, // Chimeratech Fortress Dragon x1
    26593852, // Ally of Justice Catastor x1
    25862681, // Ancient Fairy Dragon x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    42810973, // Junk Archer x1
    18013090, // Nitro Warrior x1
    70902743, // Red Dragon Archfiend x1
    46195773, // Turbo Warrior x1
  ],
  side: [
    2980764,
    2980764, // Consecrated Light x2
    24508238,
    24508238, // D.D. Crow x2
    69279219,
    69279219, // My Body as a Shield x2
    18895832,
    18895832, // System Down x2
    13504844,
    13504844, // Gottoms' Emergency Call x2
    34717238,
    34717238, // Pulling the Rug x2
    10651797,
    10651797, // Swallow Flip x2
    4206964, // Trap Hole x1
  ],
};

// ---------------------------------------------------------------------------
// STP-02 — Plant Toolbox · DB 6571840
// Main: 40 | Extra: 15
// Mystic Tomato 83011277 (ref) → 83011278 (catalog); Sangan restored.
// ---------------------------------------------------------------------------
const STP_02 = {
  main: [
    45247637,
    45247637,
    45247637, // Mark of the Rose x3
    67169062,
    67169062,
    67169062, // Pot of Avarice x3
    3657444,
    3657444, // Cyber Valley x2
    15341821,
    15341821, // Dandylion x2 [Semi]
    48686504,
    48686504, // Lonefire Blossom x2
    83011278,
    83011278, // Mystic Tomato x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    2009101, // Gale [Ltd x1]
    71413901, // Breaker x1
    31615285, // Cactus Bouncer x1
    9748752, // Caius x1
    85087012, // Card Trooper [Ltd x1]
    65192027, // Dark Armed Dragon [Ltd x1]
    14943837, // Debris Dragon x1
    44330098, // Gorz [Ltd x1]
    41201555, // Koa'ki Meiru Gravirose x1
    33420078, // Plaguespreader Zombie [Ltd x1]
    26202165, // Sangan [Ltd x1]
    98777036, // Tragoedia [Ltd x1]
    11819616, // Tytannial x1
    87910978, // Brain Control [Ltd x1]
    81439173, // Foolish Burial [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    37520316, // Mind Control [Ltd x1]
    5318639, // MST [Ltd x1]
    97077563, // Call of the Haunted [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    23693634,
    23693634, // Colossal Fighter x2
    19974580,
    19974580, // Iron Chain Dragon x2
    44508094,
    44508094, // Stardust Dragon x2
    26593852, // Ally of Justice Catastor x1
    25862681, // Ancient Fairy Dragon x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    88643579, // Dark End Dragon x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-03 — Doomcaliber Gadgets (2nd SJC Edison) · DB 6539011
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_03 = {
  main: [
    78700060,
    78700060,
    78700060, // Doomcaliber Knight x3
    41172955,
    41172955,
    41172955, // Green Gadget x3
    86445415,
    86445415,
    86445415, // Red Gadget x3
    13839120,
    13839120,
    13839120, // Yellow Gadget x3
    66788016,
    66788016,
    66788016, // Fissure x3
    97169186,
    97169186,
    97169186, // Smashing Ground x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    70095154,
    70095154, // Cyber Dragon x2 [Semi]
    26412047,
    26412047, // Hammer Shot x2
    29401950,
    29401950, // BTH x2 [Semi]
    93016201,
    93016201, // Royal Oppression x2 [Semi]
    2009101, // Gale [Ltd x1]
    44330098, // Gorz [Ltd x1]
    33420078, // Plaguespreader Zombie [Ltd x1]
    98777036, // Tragoedia [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    69162969, // Lightning Vortex x1
    23171610, // Limiter Removal [Ltd x1]
    5318639, // MST [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    63356631, // Phoenix Wing Wind Blast x1
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    79229522,
    79229522, // Chimeratech Fortress Dragon x2
    44508094,
    44508094, // Stardust Dragon x2
    50321796, // Brionac [Ltd x1]
    53714009, // Flamvell Uruquizas x1
    97204936, // Gaia Knight x1
    7391448, // Goyo Guardian [Ltd x1]
    25862681, // Ancient Fairy Dragon x1
    73580471, // Black Rose Dragon [Ltd x1]
    69031175, // Blackwing Armor Master x1
    69514125, // Avenging Knight Parshath x1
    23693634, // Colossal Fighter x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-04 — Machina Gadgets (16th SJC Edison) · DB 6539132
// Main: 44 | Extra: 15
// Ultimate Offering [80604091] x2 — Semi-Limited (max 2) ✓
// ---------------------------------------------------------------------------
const STP_04 = {
  main: [
    41172955,
    41172955,
    41172955, // Green Gadget x3
    86445415,
    86445415,
    86445415, // Red Gadget x3
    13839120,
    13839120,
    13839120, // Yellow Gadget x3
    42940404,
    42940404,
    42940404, // Machina Gearframe x3
    86780027,
    86780027,
    86780027, // Solidarity x3
    97169186,
    97169186,
    97169186, // Smashing Ground x3
    71044499,
    71044499,
    71044499, // Nobleman of Crossout x3
    31036355,
    31036355,
    31036355, // Creature Swap x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    5556499,
    5556499, // Machina Fortress x2
    78349103,
    78349103, // Machina Peacekeeper x2
    29401950,
    29401950, // BTH x2 [Semi]
    93016201,
    93016201, // Royal Oppression x2 [Semi]
    80604091,
    80604091, // Ultimate Offering x2 [Semi]
    23171610, // Limiter Removal [Ltd x1]
    5318639, // MST [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    58120309, // Starlight Road x1
    53582587, // Torrential Tribute [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon x3
    44508094,
    44508094, // Stardust Dragon x2
    29071332, // Armory Arm x1
    26593852, // Ally of Justice Catastor x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    73580471, // Black Rose Dragon [Ltd x1]
    69031175, // Blackwing Armor Master x1
    2403771, // Power Tool Dragon x1
    23693634, // Colossal Fighter x1
    70780151, // Thought Ruler Archfiend x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-05 — Synchro Cat / Rescue Cat (3rd SJC Edison) · DB 6538938
// Main: 41 | Extra: 15
// ---------------------------------------------------------------------------
const STP_05 = {
  main: [
    78700060,
    78700060,
    78700060, // Doomcaliber Knight x3
    21502796,
    21502796,
    21502796, // Ryko x3
    90508760,
    90508760,
    90508760, // X-Saber Airbellum x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    70095154,
    70095154, // Cyber Dragon x2 [Semi]
    24317029,
    24317029, // Gravekeeper's Spy x2
    14087893,
    14087893, // Book of Moon x2
    67169062,
    67169062, // Pot of Avarice x2
    29401950,
    29401950, // BTH x2 [Semi]
    9748752, // Caius x1
    9596126, // Chaos Sorcerer [Ltd x1]
    65192027, // Dark Armed Dragon [Ltd x1]
    44330098, // Gorz [Ltd x1]
    30213599, // Gravekeeper's Descendant x1
    14878871, // Rescue Cat [Ltd x1]
    26202165, // Sangan [Ltd x1]
    423585, // Summoner Monk [Ltd x1]
    1475311, // Allure of Darkness [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    37520316, // Mind Control [Ltd x1]
    69279219, // My Body as a Shield x1
    5318639, // MST [Ltd x1]
    97169186, // Smashing Ground x1
    60082869, // Dust Tornado x1
    41420027, // Solemn Judgment [Ltd x1]
    58120309, // Starlight Road x1
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    31924889,
    31924889, // Arcanite Magician x2
    44508094,
    44508094, // Stardust Dragon x2
    79229522, // Chimeratech Fortress Dragon x1
    26593852, // Ally of Justice Catastor x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    23693634, // Colossal Fighter x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
    27315304, // Mist Wurm x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
    80108118, // X-Saber Urbellum x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-06 — Gladiator Beasts (5th SJC Edison, Jake Mattern) · DB 7798916
// Main: 42 | Extra: 15
// Stratos [40044918] Ltd x1 ✓; Bestiari [41470137] Ltd x1 ✓
// ---------------------------------------------------------------------------
const STP_06 = {
  main: [
    92373006,
    92373006,
    92373006, // Test Tiger x3
    14087893,
    14087893,
    14087893, // Book of Moon x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    60082869,
    60082869,
    60082869, // Dust Tornado x3
    89312388,
    89312388, // Elemental HERO Prisma x2
    25924653,
    25924653, // Gladiator Beast Darius x2
    78868776,
    78868776, // Gladiator Beast Laquari x2
    98045062,
    98045062, // Enemy Controller x2
    29401950,
    29401950, // BTH x2 [Semi]
    94192409,
    94192409, // Compulsory Evacuation Device x2
    96216229,
    96216229, // Gladiator Beast War Chariot x2
    58120309,
    58120309, // Starlight Road x2
    40044918, // Stratos [Ltd x1]
    41470137, // Gladiator Beast Bestiari [Ltd x1]
    57731460, // Gladiator Beast Equeste x1
    4253484, // Gladiator Beast Hoplomus x1
    5975022, // Gladiator Beast Murmillo x1
    612115, // Gladiator Beast Retiari x1
    77642288, // Gladiator Beast Secutor x1
    33508719, // Morphing Jar [Ltd x1]
    60682203, // Cold Wave [Ltd x1]
    5318639, // MST [Ltd x1]
    32807846, // Reinforcement of the Army [Ltd x1]
    97077563, // Call of the Haunted [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon x3
    48156348,
    48156348,
    48156348, // Gladiator Beast Gyzarus x3
    27346636,
    27346636,
    27346636, // Gladiator Beast Heraklinos x3
    44508094,
    44508094, // Stardust Dragon x2
    73580471, // Black Rose Dragon [Ltd x1]
    23693634, // Colossal Fighter x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-07 — Lightsworn Monarchs (6th SJC Edison, Jarel Winston) · DB 6539120
// Main: 42 | Extra: 15
// ---------------------------------------------------------------------------
const STP_07 = {
  main: [
    9748752,
    9748752,
    9748752, // Caius x3
    21502796,
    21502796,
    21502796, // Ryko x3
    67169062,
    67169062,
    67169062, // Pot of Avarice x3
    70095154,
    70095154, // Cyber Dragon x2 [Semi]
    15341821,
    15341821, // Dandylion x2 [Semi]
    96235275,
    96235275, // Jain, Lightsworn Paladin x2
    22624373,
    22624373, // Lyla, Lightsworn Sorceress x2
    5220687,
    5220687, // Super-Nimble Mega Hamster x2
    26205777,
    26205777, // Thestalos x2
    14087893,
    14087893, // Book of Moon x2
    691925,
    691925, // Solar Recharge x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    63356631,
    63356631, // Phoenix Wing Wind Blast x2
    2009101, // Gale [Ltd x1]
    85087012, // Card Trooper [Ltd x1]
    14943837, // Debris Dragon x1
    44330098, // Gorz [Ltd x1]
    26202165, // Sangan [Ltd x1]
    12538374, // Treeborn Frog [Semi x1]
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    5318639, // MST [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    79229522,
    79229522, // Chimeratech Fortress Dragon x2
    44508094,
    44508094, // Stardust Dragon x2
    26593852, // Ally of Justice Catastor x1
    43385557, // Magical Android x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    25862681, // Ancient Fairy Dragon x1
    73580471, // Black Rose Dragon [Ltd x1]
    22858242, // Zeman the Ape King x1
    23693634, // Colossal Fighter x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-08 — Twilight (Lightsworn + Chaos) (13th SJC Edison) · DB 6539238
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_08 = {
  main: [
    9748752,
    9748752,
    9748752, // Caius x3
    22624373,
    22624373,
    22624373, // Lyla x3
    21502796,
    21502796,
    21502796, // Ryko x3
    14087893,
    14087893,
    14087893, // Book of Moon x3
    691925,
    691925,
    691925, // Solar Recharge x3
    5220687,
    5220687, // Super-Nimble Mega Hamster x2
    67169062,
    67169062, // Pot of Avarice x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    2009101, // Gale [Ltd x1]
    85087012, // Card Trooper [Ltd x1]
    94381039, // Celestia, Lightsworn Angel x1
    9596126, // Chaos Sorcerer [Ltd x1]
    65192027, // Dark Armed Dragon [Ltd x1]
    44330098, // Gorz [Ltd x1]
    4906301, // Necro Gardna [Ltd x1]
    33420078, // Plaguespreader Zombie [Ltd x1]
    26202165, // Sangan [Ltd x1]
    23205979, // Spirit Reaper [Ltd x1]
    58996430, // Wulf, Lightsworn Beast x1
    1475311, // Allure of Darkness [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    94886282, // Charge of the Light Brigade [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    93016201, // Royal Oppression [Semi x1]
  ],
  extra: [
    29071332, // Armory Arm x1
    26593852, // Ally of Justice Catastor x1
    43385557, // Magical Android x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    63101919, // Tempest Magician x1
    31924889, // Arcanite Magician x1
    73580471, // Black Rose Dragon [Ltd x1]
    69031175, // Blackwing Armor Master x1
    23693634, // Colossal Fighter x1
    70902743, // Red Dragon Archfiend x1
    44508094, // Stardust Dragon x1
    70780151, // Thought Ruler Archfiend x1
    69514125, // Avenging Knight Parshath x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-09 — Blackwings (14th SJC Edison) · DB 6538847
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_09 = {
  main: [
    22835145,
    22835145,
    22835145, // Blizzard x3
    49003716,
    49003716,
    49003716, // Bora x3
    85215458,
    85215458,
    85215458, // Kalut x3
    58820853,
    58820853,
    58820853, // Shura x3
    75498415,
    75498415,
    75498415, // Sirocco x3
    14087893,
    14087893,
    14087893, // Book of Moon x3
    53567095,
    53567095,
    53567095, // Icarus Attack x3
    72714392,
    72714392, // Vayu x2
    91351370,
    91351370, // Black Whirlwind x2 [Semi]
    29401950,
    29401950, // BTH x2 [Semi]
    93016201,
    93016201, // Royal Oppression x2 [Semi]
    2009101, // Gale [Ltd x1]
    65192027, // Dark Armed Dragon [Ltd x1]
    1475311, // Allure of Darkness [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    69279219, // My Body as a Shield x1
    5318639, // MST [Ltd x1]
    59839761, // Delta Crow - Anti Reverse x1
    44095762, // Mirror Force [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    76913983,
    76913983,
    76913983, // Blackwing Armed Wing x3
    69031175,
    69031175, // Blackwing Armor Master x2
    44508094,
    44508094, // Stardust Dragon x2
    26593852, // Ally of Justice Catastor x1
    43385557, // Magical Android x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    73580471, // Black Rose Dragon [Ltd x1]
    33236860, // Blackwing - Silverwind the Ascendant x1
    23693634, // Colossal Fighter x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-10 — Vayu Turbo (post-2020, DD5 2nd place) · DB 13793230
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_10 = {
  main: [
    75498415,
    75498415,
    75498415, // Sirocco x3
    72714392,
    72714392,
    72714392, // Vayu x3
    21502796,
    21502796,
    21502796, // Ryko x3
    28985331,
    28985331, // Armageddon Knight x2
    9748752,
    9748752, // Caius x2
    14536035,
    14536035, // Dark Grepher x2
    5220687,
    5220687, // Super-Nimble Mega Hamster x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    2009101, // Gale [Ltd x1]
    85087012, // Card Trooper [Ltd x1]
    9596126, // Chaos Sorcerer [Ltd x1]
    65192027, // Dark Armed Dragon [Ltd x1]
    44330098, // Gorz [Ltd x1]
    4906301, // Necro Gardna [Ltd x1]
    33420078, // Plaguespreader Zombie [Ltd x1]
    1475311, // Allure of Darkness [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    48976825, // Burial from a Different Dimension [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    5318639, // MST [Ltd x1]
    32807846, // Reinforcement of the Army [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    27174286, // Return from the Different Dimension [Ltd x1]
    93016201, // Royal Oppression [Semi x1]
    41420027, // Solemn Judgment [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    76913983,
    76913983, // Blackwing Armed Wing x2
    69031175,
    69031175, // Blackwing Armor Master x2
    26593852, // Ally of Justice Catastor x1
    29071332, // Armory Arm x1
    73580471, // Black Rose Dragon [Ltd x1]
    33236860, // Blackwing - Silverwind the Ascendant x1
    50321796, // Brionac [Ltd x1]
    23693634, // Colossal Fighter x1
    88643579, // Dark End Dragon x1
    53714009, // Flamvell Uruquizas x1
    7391448, // Goyo Guardian [Ltd x1]
    44508094, // Stardust Dragon x1
    70780151, // Thought Ruler Archfiend x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-11 — Six Samurai (notable SJC Edison) · DB 6550608
// Main: 41 | Extra: 15
// ---------------------------------------------------------------------------
const STP_11 = {
  main: [
    83039729,
    83039729,
    83039729, // Grandmaster x3
    78792195,
    78792195,
    78792195, // Hand x3
    27782503,
    27782503,
    27782503, // Irou x3
    64398890,
    64398890,
    64398890, // Yaichi x3
    95519486,
    95519486,
    95519486, // Zanji x3
    27970830,
    27970830,
    27970830, // Gateway of the Six x3
    72345736,
    72345736,
    72345736, // Six Samurai United x3
    86780027,
    86780027,
    86780027, // Solidarity x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    58120309,
    58120309,
    58120309, // Starlight Road x3
    55713623,
    55713623, // Shrink x2
    95281259,
    95281259, // Warrior Returning Alive x2
    90397998, // Kamon x1
    19613556, // Heavy Storm [Ltd x1]
    32603633, // Backs to the Wall x1
    97077563, // Call of the Haunted [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    79229522,
    79229522,
    79229522, // Chimeratech Fortress Dragon x3
    44508094,
    44508094,
    44508094, // Stardust Dragon x3
    26593852, // Ally of Justice Catastor x1
    25862681, // Ancient Fairy Dragon x1
    29071332, // Armory Arm x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    97204936, // Gaia Knight x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-12 — X-Sabers (post-2020 event) · DB 9222333
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_12 = {
  main: [
    90508760,
    90508760,
    90508760, // X-Saber Airbellum x3
    42737833,
    42737833,
    42737833, // XX-Saber Emmersblade x3
    51808422,
    51808422,
    51808422, // XX-Saber Faultroll x3
    78422252,
    78422252,
    78422252, // XX-Saber Fulhelmknight x3
    14087893,
    14087893,
    14087893, // Book of Moon x3
    70368879,
    70368879,
    70368879, // Upstart Goblin x3
    13504844,
    13504844,
    13504844, // Gottoms' Emergency Call x3
    21502796,
    21502796, // Ryko x2
    87292536,
    87292536, // XX-Saber Ragigura x2
    14878871, // Rescue Cat [Ltd x1]
    26202165, // Sangan [Ltd x1]
    423585, // Summoner Monk [Ltd x1]
    5220687, // Super-Nimble Mega Hamster x1
    87910978, // Brain Control [Ltd x1]
    60682203, // Cold Wave [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    37520316, // Mind Control [Ltd x1]
    5318639, // MST [Ltd x1]
    2295440, // One for One [Ltd x1]
    32807846, // Reinforcement of the Army [Ltd x1]
    97077563, // Call of the Haunted [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    52352005,
    52352005, // XX-Saber Gottoms x2
    79229522, // Chimeratech Fortress Dragon x1
    26593852, // Ally of Justice Catastor x1
    31924889, // Arcanite Magician x1
    29071332, // Armory Arm x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    23693634, // Colossal Fighter x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
    27315304, // Mist Wurm x1
    44508094, // Stardust Dragon x1
    80108118, // X-Saber Urbellum x1
    2203790, // XX-Saber Hyunlei x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-13 — Diva Hero (post-2020, DD4 5th, Moom) · DB 13365596
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_13 = {
  main: [
    9748752,
    9748752,
    9748752, // Caius x3
    78868119,
    78868119,
    78868119, // Deep Sea Diva x3
    45906428,
    45906428,
    45906428, // Miracle Fusion x3
    50304345,
    50304345, // Evil HERO Infernal Prodigy x2
    9411399,
    9411399, // Destiny HERO - Malicious x2 [Semi]
    91133740,
    91133740, // Snowman Eater x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    44330098, // Gorz [Ltd x1]
    33420078, // Plaguespreader Zombie [Ltd x1]
    40044918, // Stratos [Ltd x1]
    69884162, // Elemental HERO Neos Alius x1
    42463414, // Spined Gillman x1
    14536035, // Dark Grepher x1
    23205979, // Spirit Reaper [Ltd x1]
    1475311, // Allure of Darkness [Ltd x1]
    32807846, // Reinforcement of the Army [Ltd x1]
    213326, // E - Emergency Call x1
    77565204, // Future Fusion [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    5318639, // MST [Ltd x1]
    75500286, // Gold Sarcophagus [Semi x1]
    63356631, // Phoenix Wing Wind Blast x1
    44095762, // Mirror Force [Ltd x1]
    53582587, // Torrential Tribute [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    27174286, // Return from the Different Dimension [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    40854197,
    40854197,
    40854197, // Elemental HERO Absolute Zero x3
    79229522, // Chimeratech Fortress Dragon x1
    29071332, // Armory Arm x1
    26593852, // Ally of Justice Catastor x1
    43385557, // Magical Android x1
    7391448, // Goyo Guardian [Ltd x1]
    50321796, // Brionac [Ltd x1]
    73580471, // Black Rose Dragon [Ltd x1]
    44508094, // Stardust Dragon x1
    88643579, // Dark End Dragon x1
    70780151, // Thought Ruler Archfiend x1
    23693634, // Colossal Fighter x1
    16304628, // Elemental HERO Gaia x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-14 — Zombies / Zombiesworn-adjacent (post-2020, DD4 2nd) · DB 13365417
// Main: 41 | Extra: 15
// Mystic Tomato 83011277 (ref) → 83011278 (catalog passcode)
// ---------------------------------------------------------------------------
const STP_14 = {
  main: [
    9748752,
    9748752, // Caius x2
    70095154,
    70095154, // Cyber Dragon x2 [Semi]
    24508238,
    24508238, // D.D. Crow x2
    78868119,
    78868119, // Deep Sea Diva x2
    63665875,
    63665875, // Goblin Zombie x2 [Semi]
    83011278,
    83011278, // Mystic Tomato x2 [passcode 83011278]
    77044671,
    77044671, // Pyramid Turtle x2
    2204140,
    2204140, // Book of Life x2
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    60082869,
    60082869, // Dust Tornado x2
    65192027, // Dark Armed Dragon [Ltd x1]
    44330098, // Gorz [Ltd x1]
    92826944, // Mezuki [Ltd x1]
    33420078, // Plaguespreader Zombie [Ltd x1]
    26202165, // Sangan [Ltd x1]
    23205979, // Spirit Reaper [Ltd x1]
    17259470, // Zombie Master x1
    1475311, // Allure of Darkness [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    37520316, // Mind Control [Ltd x1]
    5318639, // MST [Ltd x1]
    97077563, // Call of the Haunted [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
    27174286, // Return from the Different Dimension [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    58120309, // Starlight Road x1
    53582587, // Torrential Tribute [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    79229522, // Chimeratech Fortress Dragon x1
    26593852, // Ally of Justice Catastor x1
    29071332, // Armory Arm x1
    73580471, // Black Rose Dragon [Ltd x1]
    50321796, // Brionac [Ltd x1]
    23693634, // Colossal Fighter x1
    88643579, // Dark End Dragon x1
    6021033, // Doomkaiser Dragon x1
    53714009, // Flamvell Uruquizas x1
    97204936, // Gaia Knight x1
    7391448, // Goyo Guardian [Ltd x1]
    27315304, // Mist Wurm x1
    5309481, // Revived King Ha Des x1
    44508094, // Stardust Dragon x1
    70780151, // Thought Ruler Archfiend x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-15 — Frognarch / Frog Monarch (post-2020, DD03 3rd, Corinna) · DB 12421850
// Main: 40 | Extra: 15
// ⚠️ Substitoad [20663556] ×3 — CEO-confirmed UNLIMITED on our March-2010 banlist.
// ---------------------------------------------------------------------------
const STP_15 = {
  main: [
    20663556,
    20663556,
    20663556, // Substitoad ×3 [UNLIMITED — CEO-confirmed]
    9126351,
    9126351,
    9126351, // Swap Frog x3
    63977008,
    63977008,
    63977008, // Junk Synchron x3
    9748752,
    9748752,
    9748752, // Caius x3
    12538374,
    12538374, // Treeborn Frog x2 [Semi]
    46239604,
    46239604, // Dupe Frog x2
    73125233,
    73125233, // Raiza x2
    19665973,
    19665973, // Battle Fader x2
    75500286,
    75500286, // Gold Sarcophagus x2 [Semi]
    98045062,
    98045062, // Enemy Controller x2
    36361633,
    36361633, // Threatening Roar x2
    56052205, // Unifrog x1
    4929256, // Mobius the Frost Monarch x1
    65192027, // Dark Armed Dragon [Ltd x1]
    44330098, // Gorz [Ltd x1]
    98777036, // Tragoedia [Ltd x1]
    32807846, // Reinforcement of the Army [Ltd x1]
    1475311, // Allure of Darkness [Ltd x1]
    2295440, // One for One [Ltd x1]
    73915051, // Scapegoat [Ltd x1]
    87910978, // Brain Control [Ltd x1]
    5318639, // MST [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    60682203, // Cold Wave [Ltd x1]
    44095762, // Mirror Force [Ltd x1]
  ],
  extra: [
    26593852,
    26593852, // Ally of Justice Catastor x2
    29071332, // Armory Arm x1
    60800381, // Junk Warrior x1
    43385557, // Magical Android x1
    53714009, // Flamvell Uruquizas x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    80108118, // X-Saber Urbellum x1
    73580471, // Black Rose Dragon [Ltd x1]
    44508094, // Stardust Dragon x1
    70780151, // Thought Ruler Archfiend x1
    23693634, // Colossal Fighter x1
    70902743, // Red Dragon Archfiend x1
    27315304, // Mist Wurm x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-16 — Flamvell (rogue, 7th SJC Edison) · DB 6539021
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_16 = {
  main: [
    9748752,
    9748752,
    9748752, // Caius x3
    23297235,
    23297235,
    23297235, // Flamvell Firedog x3
    95621257,
    95621257,
    95621257, // Flamvell Magician x3
    24317029,
    24317029,
    24317029, // Gravekeeper's Spy x3
    21502796,
    21502796,
    21502796, // Ryko x3
    14087893,
    14087893,
    14087893, // Book of Moon x3
    74845897,
    74845897,
    74845897, // Rekindling x3
    29401950,
    29401950, // BTH x2 [Semi]
    70342110,
    70342110, // Dimensional Prison x2
    2009101, // Gale [Ltd x1]
    9596126, // Chaos Sorcerer [Ltd x1]
    70095154, // Cyber Dragon [Semi x1]
    44330098, // Gorz [Ltd x1]
    30213599, // Gravekeeper's Descendant x1
    5220687, // Super-Nimble Mega Hamster x1
    87910978, // Brain Control [Ltd x1]
    19613556, // Heavy Storm [Ltd x1]
    37520316, // Mind Control [Ltd x1]
    5318639, // MST [Ltd x1]
    60082869, // Dust Tornado x1
    44095762, // Mirror Force [Ltd x1]
    93016201, // Royal Oppression [Semi x1]
    41420027, // Solemn Judgment [Ltd x1]
    64697231, // Trap Dustshoot [Ltd x1]
  ],
  extra: [
    23693634,
    23693634, // Colossal Fighter x2
    44508094,
    44508094, // Stardust Dragon x2
    26593852, // Ally of Justice Catastor x1
    43385557, // Magical Android x1
    50321796, // Brionac [Ltd x1]
    7391448, // Goyo Guardian [Ltd x1]
    53714009, // Flamvell Uruquizas x1
    31924889, // Arcanite Magician x1
    73580471, // Black Rose Dragon [Ltd x1]
    80108118, // X-Saber Urbellum x1
    69031175, // Blackwing Armor Master x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
  ],
  side: [] as number[],
};

// ---------------------------------------------------------------------------
// STP-17 — Black Garden (rogue control/burn, notable SJC Edison) · DB 6571645
// Main: 40 | Extra: 15
// ---------------------------------------------------------------------------
const STP_17 = {
  main: [
    76922029,
    76922029,
    76922029, // Don Zaloog x3
    24317029,
    24317029,
    24317029, // Gravekeeper's Spy x3
    76459806,
    76459806,
    76459806, // Volcanic Rocket x3
    33365932,
    33365932,
    33365932, // Volcanic Shell x3
    71645242,
    71645242,
    71645242, // Black Garden x3
    70342110,
    70342110,
    70342110, // Dimensional Prison x3
    87621407,
    87621407, // Dekoichi x2
    69537999,
    69537999, // Blaze Accelerator x2
    67169062,
    67169062, // Pot of Avarice x2
    29401950,
    29401950, // BTH x2 [Semi]
    49010598,
    49010598, // Divine Wrath x2
    63356631,
    63356631, // Phoenix Wing Wind Blast x2
    2009101, // Gale [Ltd x1]
    85087012, // Card Trooper [Ltd x1]
    30213599, // Gravekeeper's Descendant x1
    33508719, // Morphing Jar [Ltd x1]
    73628505, // Terraforming x1
    60082869, // Dust Tornado x1
    44095762, // Mirror Force [Ltd x1]
    41420027, // Solemn Judgment [Ltd x1]
    58120309, // Starlight Road x1
    53582587, // Torrential Tribute [Ltd x1]
  ],
  extra: [
    44508094,
    44508094,
    44508094, // Stardust Dragon x3
    26593852, // Ally of Justice Catastor x1
    31924889, // Arcanite Magician x1
    73580471, // Black Rose Dragon [Ltd x1]
    69031175, // Blackwing Armor Master x1
    50321796, // Brionac [Ltd x1]
    23693634, // Colossal Fighter x1
    53714009, // Flamvell Uruquizas x1
    7391448, // Goyo Guardian [Ltd x1]
    43385557, // Magical Android x1
    70902743, // Red Dragon Archfiend x1
    70780151, // Thought Ruler Archfiend x1
    80108118, // X-Saber Urbellum x1
  ],
  side: [] as number[],
};

// ===========================================================================
// Test suite
// ===========================================================================

let catalog: LoadedCatalog;

beforeAll(async () => {
  catalog = await loadCatalog();
});

const FIXTURES = [
  { id: "STP-01", name: "Quickdraw Dandywarrior", deck: STP_01 },
  { id: "STP-02", name: "Plant Toolbox", deck: STP_02 },
  { id: "STP-03", name: "Doomcaliber Gadgets", deck: STP_03 },
  { id: "STP-04", name: "Machina Gadgets", deck: STP_04 },
  { id: "STP-05", name: "Synchro Cat", deck: STP_05 },
  { id: "STP-06", name: "Gladiator Beasts", deck: STP_06 },
  { id: "STP-07", name: "Lightsworn Monarchs", deck: STP_07 },
  { id: "STP-08", name: "Twilight", deck: STP_08 },
  { id: "STP-09", name: "Blackwings", deck: STP_09 },
  { id: "STP-10", name: "Vayu Turbo", deck: STP_10 },
  { id: "STP-11", name: "Six Samurai", deck: STP_11 },
  { id: "STP-12", name: "X-Sabers", deck: STP_12 },
  { id: "STP-13", name: "Diva Hero", deck: STP_13 },
  { id: "STP-14", name: "Zombies", deck: STP_14 },
  { id: "STP-15", name: "Frognarch (Substitoad ×3, UNLIMITED)", deck: STP_15 },
  { id: "STP-16", name: "Flamvell", deck: STP_16 },
  { id: "STP-17", name: "Black Garden", deck: STP_17 },
] as const;

describe("STP-01..STP-17 — validateDeck pool-legality", () => {
  for (const { id, name, deck } of FIXTURES) {
    it(`${id} — ${name} passes validateDeck with zero violations`, () => {
      const result = validateDeck(deck, catalog);
      if (!result.legal) {
        console.error(`${id} violations:`, result.violations);
      }
      expect(result.legal).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  }
});

describe("STP-01..STP-17 — deck size constraints", () => {
  for (const { id, name, deck } of FIXTURES) {
    it(`${id} — ${name} main deck is 40–60 cards`, () => {
      expect(deck.main.length).toBeGreaterThanOrEqual(40);
      expect(deck.main.length).toBeLessThanOrEqual(60);
    });

    it(`${id} — ${name} extra deck is 0–15 cards`, () => {
      expect(deck.extra.length).toBeLessThanOrEqual(15);
    });

    it(`${id} — ${name} side deck is 0–15 cards`, () => {
      expect(deck.side.length).toBeLessThanOrEqual(15);
    });
  }
});
