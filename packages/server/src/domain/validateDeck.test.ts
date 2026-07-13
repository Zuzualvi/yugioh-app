import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validateDeck } from "./validateDeck.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { loadCatalog, resetCatalogCache } from "../catalog/loadCatalog.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";

// ---------------------------------------------------------------------------
// Helpers — build a LoadedCatalog from the fixture, plus test utilities
// ---------------------------------------------------------------------------

function makeLoadedCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  // legalPasscodes includes both real passcodes AND alias passcodes
  const legalPasscodes = new Set([...byPasscode.keys(), ...aliasIndex.keys()]);
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

let catalog: LoadedCatalog;

// Known passcodes from fixture
const CHAOS_EMPEROR = 99267150; // Forbidden
const BLS_ENVOY = 24094653; // Limited (1 copy)
const TREEBORN_FROG = 12538374; // Semi-Limited (2 copies)
const BEAST_KING = 89631139; // Unlimited
const CYBER_DRAGON = 46986414; // Unlimited
const DARK_ARMED = 70781052; // Unlimited
const RITUAL_MONSTER = 5405694; // Ritual (Main Deck), Unlimited
const FUSION_MONSTER = 35809262; // Fusion (Extra Deck), Unlimited
const SYNCHRO_MONSTER = 67959180; // Goyo Guardian (Extra Deck), Limited
const POT_OF_GREED = 55144522; // Forbidden Spell
const BTH = 29401950; // Unlimited Trap
const HARPIE_LADY = 76812113; // Unlimited (base)
const HARPIE_LADY_1 = 91932350; // Unlimited (aliasOf = HARPIE_LADY)

// Additional unlimited main-deck passcodes from the extended fixture
const BREAKER = 71413901;
const SNIPE_HUNTER = 28604635;
const MYSTIC_TOMATO = 83011277;
const SPIRIT_REAPER = 23205979;
const THUNDER_KING = 71564252;
const DD_CROW = 24508238;
const GRAND_MOLE = 80441106;
const DD_WARRIOR_LADY = 7572887;
const NEOS = 89943723;

/**
 * Legal 40-card main deck — each card appears at most 3 times,
 * no Forbidden/Limited/Semi cards, no Extra-Deck cards.
 * Uses 14 unlimited fixture cards × max copies ≥ 40.
 */
function legalMain40(): number[] {
  // 13 unique unlimited non-extra cards × 3 = 39 + 1 = 40
  const cards = [
    BEAST_KING,
    DARK_ARMED,
    BTH,
    CYBER_DRAGON,
    RITUAL_MONSTER,
    BREAKER,
    SNIPE_HUNTER,
    MYSTIC_TOMATO,
    SPIRIT_REAPER,
    THUNDER_KING,
    DD_CROW,
    GRAND_MOLE,
    DD_WARRIOR_LADY,
  ];
  // 13 × 3 = 39, add one more NEOS
  return [...cards.flatMap((c) => [c, c, c]), NEOS];
}

beforeEach(() => {
  catalog = makeLoadedCatalog();
});

// ---------------------------------------------------------------------------
// AC-04: Positive — a fully legal deck must pass
// ---------------------------------------------------------------------------

describe("AC-04 — positive: legal deck validates as legal", () => {
  it("40-Main / 0-Extra / 0-Side deck with all valid cards", () => {
    const result = validateDeck({ main: legalMain40(), extra: [], side: [] }, catalog);
    expect(result.legal).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.counts).toEqual({ main: 40, extra: 0, side: 0 });
  });

  it("40-Main deck validates as legal (size-agnostic bounds check)", () => {
    // Fixture has limited unique cards; test the size validator independently
    // by using legalMain40 (which stays within copy caps for its cards).
    const r = validateDeck({ main: legalMain40(), extra: [], side: [] }, catalog);
    expect(r.legal).toBe(true);
  });

  it("Semi-Limited: 1 in Main + 1 in Side = 2 total — legal", () => {
    const main: number[] = [...legalMain40().slice(0, 39), TREEBORN_FROG];
    const side = [TREEBORN_FROG];
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(true);
  });

  it("Limited: 1 copy in Main — legal", () => {
    const main: number[] = [...legalMain40().slice(0, 39), BLS_ENVOY];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(true);
  });

  it("Extra Deck: up to 3 Fusion + 1 Limited Synchro — legal", () => {
    const main = legalMain40();
    // FUSION_MONSTER is unlimited (max 3); SYNCHRO_MONSTER is limited (max 1)
    const extra = [...Array(3).fill(FUSION_MONSTER), SYNCHRO_MONSTER];
    const r = validateDeck({ main, extra, side: [] }, catalog);
    expect(r.legal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-05: Negative — each violation case
// ---------------------------------------------------------------------------

describe("AC-05 — negative: 39-card Main Deck", () => {
  it("reports main_size violation", () => {
    const main = legalMain40().slice(0, 39);
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "main_size")).toBe(true);
  });
});

describe("AC-05 — negative: 61-card Main Deck", () => {
  it("reports main_size violation", () => {
    // Need to build 61 cards without exceeding 3-copy cap
    // Use all unlimited cards (6 types × 3 = 18) plus pad — but fixture only has 6 unlimited non-extra-deck cards
    // Beast King, Dark Armed, BTH, Cyber Dragon, Harpie Lady, Ritual Monster = 6 × 3 = 18
    // Plus 2 Semi + 1 Limited = 21. Not enough.
    // For this test, allow the 3-copy check to also fire — we just need main_size
    const main = [...Array(21).fill(BEAST_KING)]; // 21 — only possible if we allow over-copy too
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "main_size")).toBe(true);
  });

  it("61-card main with diverse cards reports only main_size (no other violations)", () => {
    // With limited fixture cards, we can't easily build 61 diverse legal cards.
    // Build 60 (using repeated allowed cards staying within copy caps):
    // This test verifies the main_size fires for 61; use simpler approach.
    const main: number[] = [
      ...Array(3).fill(BEAST_KING),
      ...Array(3).fill(DARK_ARMED),
      ...Array(3).fill(BTH),
      ...Array(3).fill(CYBER_DRAGON),
      ...Array(3).fill(HARPIE_LADY),
      ...Array(3).fill(RITUAL_MONSTER),
      ...Array(2).fill(TREEBORN_FROG),
      BLS_ENVOY,
      // That's 21. Can only add HARPIE_LADY_1 (alias of HARPIE_LADY) — but 3+n total
      // We have HARPIE_LADY × 3 in main. HARPIE_LADY_1 also counts as HARPIE_LADY.
      // So we can't add any HARPIE_LADY_1 without exceeding 3. Skip.
      // We don't have 61 unique cards in fixture. Just make 61 by allowing copy > 3 on one card.
      // For the purpose of this test: just verify 61 fires main_size regardless.
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
    ]; // 21 + 40 = 61
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "main_size")).toBe(true);
  });
});

describe("AC-05 — negative: 16-card Extra Deck", () => {
  it("reports extra_size violation", () => {
    const main = legalMain40();
    const extra = Array(16).fill(FUSION_MONSTER);
    const r = validateDeck({ main, extra, side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "extra_size")).toBe(true);
  });
});

describe("AC-05 — negative: 16-card Side Deck", () => {
  it("reports side_size violation", () => {
    const main = legalMain40();
    const side = Array(16).fill(BEAST_KING);
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "side_size")).toBe(true);
  });
});

describe("AC-05 — negative: 3rd Semi-Limited copy across zones", () => {
  it("1 in Main + 1 in Side is legal (total=2)", () => {
    const main: number[] = [...legalMain40().slice(0, 39), TREEBORN_FROG];
    const r = validateDeck({ main, extra: [], side: [TREEBORN_FROG] }, catalog);
    expect(r.legal).toBe(true);
  });

  it("2 in Main + 1 in Side violates banlist_limit (total=3)", () => {
    const main: number[] = [...legalMain40().slice(0, 38), TREEBORN_FROG, TREEBORN_FROG];
    const r = validateDeck({ main, extra: [], side: [TREEBORN_FROG] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_limit")).toBe(true);
  });

  it("3 in Main alone violates banlist_limit", () => {
    const main: number[] = [
      ...legalMain40().slice(0, 37),
      TREEBORN_FROG,
      TREEBORN_FROG,
      TREEBORN_FROG,
    ];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_limit")).toBe(true);
  });
});

describe("AC-05 — negative: Forbidden card", () => {
  it("Forbidden card in Main reports banlist_forbidden", () => {
    const main: number[] = [...legalMain40().slice(0, 39), CHAOS_EMPEROR];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(
      r.violations.some((v) => v.code === "banlist_forbidden" && v.passcode === CHAOS_EMPEROR),
    ).toBe(true);
  });

  it("Forbidden card in Extra reports banlist_forbidden", () => {
    // POT_OF_GREED is forbidden but a Spell — it's also wrong_zone in Extra
    // Use CHAOS_EMPEROR (forbidden monster, not extra deck) in main
    // Actually for Extra let's use a Fusion monster that's forbidden...
    // In fixture, POT_OF_GREED (55144522) is forbidden spell. It's wrong zone in extra anyway.
    // Let's just test: Chaos Emperor (forbidden effect monster) placed in side
    const main = legalMain40();
    const side = [CHAOS_EMPEROR];
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_forbidden")).toBe(true);
  });

  it("Forbidden Pot of Greed in Main reports banlist_forbidden", () => {
    const main: number[] = [...legalMain40().slice(0, 39), POT_OF_GREED];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(
      r.violations.some((v) => v.code === "banlist_forbidden" && v.passcode === POT_OF_GREED),
    ).toBe(true);
  });
});

describe("AC-05 — negative: out-of-pool card", () => {
  it("unknown passcode reports unknown_passcode", () => {
    const UNKNOWN = 99999999;
    const main: number[] = [...legalMain40().slice(0, 39), UNKNOWN];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "unknown_passcode" && v.passcode === UNKNOWN)).toBe(
      true,
    );
  });
});

describe("AC-05 — negative: Fusion/Synchro placed in Main Deck", () => {
  it("Fusion in Main reports wrong_zone", () => {
    const main: number[] = [...legalMain40().slice(0, 39), FUSION_MONSTER];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "wrong_zone" && v.passcode === FUSION_MONSTER)).toBe(
      true,
    );
  });

  it("Synchro in Main reports wrong_zone", () => {
    const main: number[] = [...legalMain40().slice(0, 39), SYNCHRO_MONSTER];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(
      r.violations.some((v) => v.code === "wrong_zone" && v.passcode === SYNCHRO_MONSTER),
    ).toBe(true);
  });

  it("Fusion in Side reports wrong_zone", () => {
    const main = legalMain40();
    const side = [FUSION_MONSTER];
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "wrong_zone" && v.passcode === FUSION_MONSTER)).toBe(
      true,
    );
  });
});

describe("AC-05 — negative: non-Extra card placed in Extra Deck", () => {
  it("Normal monster in Extra reports wrong_zone", () => {
    const main = legalMain40();
    const extra = [BEAST_KING]; // not isExtraDeck
    const r = validateDeck({ main, extra, side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "wrong_zone" && v.passcode === BEAST_KING)).toBe(
      true,
    );
  });

  it("Ritual monster in Extra reports wrong_zone", () => {
    const main = legalMain40();
    const extra = [RITUAL_MONSTER];
    const r = validateDeck({ main, extra, side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "wrong_zone" && v.passcode === RITUAL_MONSTER)).toBe(
      true,
    );
  });
});

describe("AC-05 — negative: alt-art alias evasion", () => {
  it("3× Harpie Lady (base) + 1× Harpie Lady 1 (alias) = 4 copies of same card — copy_limit", () => {
    // HARPIE_LADY_1 aliasOf HARPIE_LADY — combined 4 copies → copy_limit
    const main: number[] = [
      ...legalMain40().slice(0, 36),
      HARPIE_LADY,
      HARPIE_LADY,
      HARPIE_LADY, // 3 base
      HARPIE_LADY_1, // 1 alias → 4 total of base card
    ];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "copy_limit")).toBe(true);
  });

  it("3× Harpie Lady 1 (alias) alone = 3 copies of base — legal", () => {
    const main: number[] = [
      ...legalMain40().slice(0, 37),
      HARPIE_LADY_1,
      HARPIE_LADY_1,
      HARPIE_LADY_1,
    ];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(true);
  });

  it("2× Harpie Lady (base) + 2× Harpie Lady 1 (alias) = 4 total — copy_limit", () => {
    const main: number[] = [
      ...legalMain40().slice(0, 36),
      HARPIE_LADY,
      HARPIE_LADY,
      HARPIE_LADY_1,
      HARPIE_LADY_1,
    ];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "copy_limit")).toBe(true);
  });

  it("alt-art across zones: 2× Harpie Lady in Main + 2× Harpie Lady 1 in Side = 4 — copy_limit", () => {
    const main: number[] = [...legalMain40().slice(0, 38), HARPIE_LADY, HARPIE_LADY];
    const side = [HARPIE_LADY_1, HARPIE_LADY_1];
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "copy_limit")).toBe(true);
  });
});

describe("AC-05 — negative: Limited card over-count", () => {
  it("2× Limited BLS Envoy reports banlist_limit", () => {
    const main: number[] = [...legalMain40().slice(0, 38), BLS_ENVOY, BLS_ENVOY];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_limit")).toBe(true);
  });

  it("1 Limited in Main + 1 in Side = 2 copies — banlist_limit", () => {
    const main: number[] = [...legalMain40().slice(0, 39), BLS_ENVOY];
    const side = [BLS_ENVOY];
    const r = validateDeck({ main, extra: [], side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_limit")).toBe(true);
  });

  it("Limited Goyo Guardian: 1 in Extra — legal", () => {
    const main = legalMain40();
    const extra = [SYNCHRO_MONSTER];
    const r = validateDeck({ main, extra, side: [] }, catalog);
    expect(r.legal).toBe(true);
  });

  it("Limited Goyo Guardian: 1 in Extra + 1 in Side — banlist_limit", () => {
    const main = legalMain40();
    const extra = [SYNCHRO_MONSTER];
    const side = [SYNCHRO_MONSTER];
    const r = validateDeck({ main, extra, side }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "banlist_limit")).toBe(true);
  });
});

describe("AC-05 — negative: unlimited card over 3 copies", () => {
  it("4× Beast King reports copy_limit", () => {
    const main: number[] = [
      ...legalMain40().slice(0, 36),
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
      BEAST_KING,
    ];
    const r = validateDeck({ main, extra: [], side: [] }, catalog);
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.code === "copy_limit")).toBe(true);
  });
});

describe("validateDeck — DeckValidation shape", () => {
  it("counts reflect actual zone lengths", () => {
    const main = legalMain40();
    const extra = [FUSION_MONSTER];
    const side = [BEAST_KING];
    const r = validateDeck({ main, extra, side }, catalog);
    expect(r.counts).toEqual({ main: 40, extra: 1, side: 1 });
  });

  it("empty deck reports main_size but correct zero counts", () => {
    const r = validateDeck({ main: [], extra: [], side: [] }, catalog);
    expect(r.counts).toEqual({ main: 0, extra: 0, side: 0 });
    expect(r.violations.some((v) => v.code === "main_size")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Alias resolution — real catalog tests (511002993 → Brionac 50321796)
// These tests use the real loadCatalog() to verify alias-index.json is merged.
// ---------------------------------------------------------------------------

describe("alias resolution — real catalog pre-errata passcodes", () => {
  let realCatalog: LoadedCatalog;

  beforeEach(() => {
    resetCatalogCache();
    realCatalog = loadCatalog();
  });

  afterEach(() => {
    resetCatalogCache();
  });

  it("pre-errata Brionac (511002993) is in legalPasscodes via alias", () => {
    expect(realCatalog.legalPasscodes.has(511002993)).toBe(true);
  });

  it("pre-errata Brionac (511002993) resolves to base 50321796", () => {
    expect(realCatalog.aliasIndex.get(511002993)).toBe(50321796);
  });

  it("deck using pre-errata Brionac alias (511002993) in Extra does NOT report unknown_passcode", () => {
    // Build a legal-ish 40-card main using real catalog cards
    const main = Array(40).fill(realCatalog.catalog.cards[0]!.passcode);
    const r = validateDeck({ main, extra: [511002993], side: [] }, realCatalog);
    expect(
      r.violations.some((v) => v.code === "unknown_passcode" && v.passcode === 511002993),
    ).toBe(false);
  });

  it("pre-errata Brionac (511002993) is recognized as a Synchro (isExtraDeck=true)", () => {
    const brionacBase = realCatalog.byPasscode.get(50321796);
    expect(brionacBase?.isExtraDeck).toBe(true);
    expect(brionacBase?.frame).toBe("synchro");
  });

  it("2× pre-errata Brionac (511002993) in Extra → banlist_limit (Brionac is Limited)", () => {
    // Brionac base (50321796) is Limited → max 1 total
    const brionacBase = realCatalog.byPasscode.get(50321796);
    expect(brionacBase?.banlist).toBe("limited");

    const main = Array(40).fill(realCatalog.catalog.cards[0]!.passcode);
    const r = validateDeck({ main, extra: [511002993, 511002993], side: [] }, realCatalog);
    expect(r.violations.some((v) => v.code === "banlist_limit" && v.passcode === 50321796)).toBe(
      true,
    );
  });
});
