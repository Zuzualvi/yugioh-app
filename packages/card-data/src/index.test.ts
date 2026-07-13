import { describe, expect, it } from "vitest";
import { loadCatalog, buildCardMap, loadAliasIndex, resolveAlias } from "./index.js";

describe("loadCatalog", () => {
  it("returns a catalog with the correct format and count", () => {
    const catalog = loadCatalog();
    expect(catalog.format).toBe("edison-2010-03");
    expect(catalog.count).toBe(catalog.cards.length);
    // Allow-list target is 3681; catalog must be within 5
    expect(Math.abs(catalog.count - 3681)).toBeLessThanOrEqual(5);
  });

  it("has cards sorted ascending by passcode", () => {
    const { cards } = loadCatalog();
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i]!.passcode).toBeGreaterThanOrEqual(cards[i - 1]!.passcode);
    }
  });
});

describe("buildCardMap", () => {
  it("maps passcode to CardDTO", () => {
    const catalog = loadCatalog();
    const map = buildCardMap(catalog);
    expect(map.size).toBe(catalog.count);

    // Spot-check: Blue-Eyes White Dragon
    const bewd = map.get(89631139);
    expect(bewd).toBeDefined();
    expect(bewd?.name).toContain("Blue-Eyes White Dragon");
    expect(bewd?.frame).toBe("normal");
    expect(bewd?.isExtraDeck).toBe(false);
    expect(bewd?.banlist).toBe("unlimited");
  });

  it("Brionac is Synchro, isExtraDeck=true, banlist=limited", () => {
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
});

describe("loadAliasIndex", () => {
  it("contains all 7 pre-errata aliases", () => {
    const aliasIndex = loadAliasIndex();
    expect(Object.keys(aliasIndex)).toHaveLength(7);
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
