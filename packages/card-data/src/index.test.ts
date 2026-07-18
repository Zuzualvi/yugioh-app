import { describe, expect, it } from "vitest";
import { loadCatalog, buildCardMap, loadAliasIndex, resolveAlias } from "./index.js";

describe("loadCatalog", () => {
  it("returns a catalog with the correct format and count", () => {
    const catalog = loadCatalog();
    expect(catalog.format).toBe("edison-2010-03");
    expect(catalog.count).toBe(catalog.cards.length);
    // 3673 = 3681 original − 8 script-less promo cards removed (non-buildable, CEO decision 2026-07-18)
    expect(Math.abs(catalog.count - 3673)).toBeLessThanOrEqual(5);
  });

  it("has cards sorted ascending by passcode", () => {
    const { cards } = loadCatalog();
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i]!.passcode).toBeGreaterThanOrEqual(cards[i - 1]!.passcode);
    }
  });

  it("every card has passcode > 0", () => {
    const { cards } = loadCatalog();
    for (const card of cards) {
      expect(card.passcode).toBeGreaterThan(0);
    }
  });

  it("all passcodes are unique", () => {
    const { cards } = loadCatalog();
    const seen = new Set<number>();
    for (const card of cards) {
      expect(seen.has(card.passcode)).toBe(false);
      seen.add(card.passcode);
    }
  });
});

describe("buildCardMap", () => {
  it("maps passcode to CardDTO", () => {
    const catalog = loadCatalog();
    const map = buildCardMap(catalog);
    expect(map.size).toBe(catalog.count);

    const bewd = map.get(89631139);
    expect(bewd).toBeDefined();
    expect(bewd?.name).toContain("Blue-Eyes White Dragon");
    expect(bewd?.frame).toBe("normal");
    expect(bewd?.isExtraDeck).toBe(false);
    expect(bewd?.banlist).toBe("unlimited");
  });

  it("Brionac is Synchro, isExtraDeck=true, banlist=limited (pre-errata alias)", () => {
    const catalog = loadCatalog();
    const map = buildCardMap(catalog);
    const brionac = map.get(50321796);
    expect(brionac).toBeDefined();
    expect(brionac?.frame).toBe("synchro");
    expect(brionac?.isExtraDeck).toBe(true);
    expect(brionac?.banlist).toBe("limited");
  });

  it("Imperial Order is forbidden via pre-errata alias", () => {
    const catalog = loadCatalog();
    const map = buildCardMap(catalog);
    const io = map.get(61740673);
    expect(io?.banlist).toBe("forbidden");
  });

  it("Orichalcos Shunoros remapped from pc=0 to pc=7634581", () => {
    const catalog = loadCatalog();
    const map = buildCardMap(catalog);
    expect(map.has(0)).toBe(false);
    const orichalcos = map.get(7634581);
    expect(orichalcos).toBeDefined();
    expect(orichalcos!.passcode).toBe(7634581);
    expect(orichalcos!.passcode).toBeGreaterThan(0);
  });
});

describe("loadAliasIndex", () => {
  it("contains all 13 pre-errata aliases + cdb alt-arts (182 total)", () => {
    const aliasIndex = loadAliasIndex();
    expect(Object.keys(aliasIndex).length).toBe(182);
  });

  it("maps Brionac alias 511002993 to base 50321796", () => {
    const aliasIndex = loadAliasIndex();
    expect(aliasIndex["511002993"]).toBe(50321796);
  });
});

describe("resolveAlias", () => {
  it("resolves a pre-errata alias to its base", () => {
    const aliasIndex = loadAliasIndex();
    expect(resolveAlias(511002993, aliasIndex)).toBe(50321796);
  });

  it("returns the input unchanged for a non-alias passcode", () => {
    const aliasIndex = loadAliasIndex();
    expect(resolveAlias(89631139, aliasIndex)).toBe(89631139);
  });
});
