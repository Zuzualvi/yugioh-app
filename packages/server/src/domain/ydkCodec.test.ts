import { describe, expect, it, beforeEach } from "vitest";
import { parseYdk, emitYdk } from "./ydkCodec.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { FIXTURE_CARDS, FIXTURE_CATALOG } from "../catalog/fixture.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoadedCatalog(): LoadedCatalog {
  const byPasscode = new Map(FIXTURE_CARDS.map((c) => [c.passcode, c]));
  const aliasIndex = new Map<number, number>();
  for (const card of FIXTURE_CARDS) {
    if (card.aliasOf !== null) aliasIndex.set(card.passcode, card.aliasOf);
  }
  const legalPasscodes = new Set(byPasscode.keys());
  return { catalog: FIXTURE_CATALOG, byPasscode, aliasIndex, legalPasscodes };
}

let catalog: LoadedCatalog;

// Known fixture passcodes
const BEAST_KING = 89631139;
const FUSION_MONSTER = 35809262;
const SYNCHRO_MONSTER = 67959180;
const BTH = 29401950;

beforeEach(() => {
  catalog = makeLoadedCatalog();
});

// ---------------------------------------------------------------------------
// AC-06: Round-trip guarantee
// ---------------------------------------------------------------------------

describe("AC-06 — .ydk round-trip", () => {
  it("emitYdk then parseYdk returns identical multisets for main/extra/side", () => {
    const deck = {
      name: "Test Deck",
      main: [BEAST_KING, BEAST_KING, BEAST_KING, BTH, BTH],
      extra: [FUSION_MONSTER, SYNCHRO_MONSTER],
      side: [BTH],
    };
    const ydk = emitYdk(deck);
    const parsed = parseYdk(ydk, catalog);

    expect(parsed.main).toEqual(deck.main);
    expect(parsed.extra).toEqual(deck.extra);
    expect(parsed.side).toEqual(deck.side);
    expect(parsed.violations).toHaveLength(0);
  });

  it("preserves deck name in '#created by' line", () => {
    const deck = { name: "Edison Aggro", main: [BEAST_KING], extra: [], side: [] };
    const ydk = emitYdk(deck);
    expect(ydk).toContain("#created by Edison Aggro");
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.name).toBe("Edison Aggro");
  });

  it("omits '#created by' when name is undefined/empty", () => {
    const ydk = emitYdk({ main: [BEAST_KING], extra: [], side: [] });
    expect(ydk).not.toContain("#created by");
  });

  it("emits '!side' (not '#side')", () => {
    const ydk = emitYdk({ main: [BEAST_KING], extra: [], side: [BTH] });
    expect(ydk).toContain("!side");
    expect(ydk).not.toContain("#side");
  });

  it("uses LF line endings on export", () => {
    const ydk = emitYdk({ main: [BEAST_KING], extra: [], side: [] });
    expect(ydk).not.toContain("\r\n");
    expect(ydk).toContain("\n");
  });

  it("sections with zero cards still emit the marker", () => {
    const ydk = emitYdk({ main: [BEAST_KING], extra: [], side: [] });
    expect(ydk).toContain("#main");
    expect(ydk).toContain("#extra");
    expect(ydk).toContain("!side");
  });

  it("round-trip with Fusion + Synchro in Extra preserves routing", () => {
    const deck = {
      main: [BEAST_KING, BTH],
      extra: [FUSION_MONSTER, FUSION_MONSTER, SYNCHRO_MONSTER],
      side: [],
    };
    const ydk = emitYdk(deck);
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.extra).toHaveLength(3);
    expect(parsed.main).toHaveLength(2);
    expect(parsed.violations).toHaveLength(0);
  });

  it("tolerates CRLF line endings on import", () => {
    const ydkLF = emitYdk({ main: [BEAST_KING], extra: [], side: [] });
    const ydkCRLF = ydkLF.replace(/\n/g, "\r\n");
    const parsed = parseYdk(ydkCRLF, catalog);
    expect(parsed.main).toEqual([BEAST_KING]);
    expect(parsed.violations).toHaveLength(0);
  });

  it("preserves multiset order (duplicate entries)", () => {
    const deck = {
      main: [BEAST_KING, BTH, BEAST_KING, BTH, BEAST_KING],
      extra: [],
      side: [],
    };
    const parsed = parseYdk(emitYdk(deck), catalog);
    expect(parsed.main).toEqual(deck.main);
  });
});

// ---------------------------------------------------------------------------
// AC-07: Illegal / foreign / malformed .ydk imports
// ---------------------------------------------------------------------------

describe("AC-07 — illegal .ydk: unknown passcode", () => {
  it("reports unknown_passcode violation with the line number", () => {
    const ydk = "#main\n99999999\n#extra\n!side\n";
    const parsed = parseYdk(ydk, catalog);
    const v = parsed.violations.find((x) => x.code === "unknown_passcode");
    expect(v).toBeDefined();
    expect(v?.passcode).toBe(99999999);
    expect(v?.line).toBeDefined();
  });

  it("includes the passcode in the violation", () => {
    const ydk = "#main\n11111111\n#extra\n!side\n";
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.violations.some((v) => v.passcode === 11111111)).toBe(true);
  });
});

describe("AC-07 — illegal .ydk: Fusion/Synchro under #main", () => {
  it("Fusion monster under #main → wrong_zone violation and moved to Extra", () => {
    const ydk = `#main\n${FUSION_MONSTER}\n#extra\n!side\n`;
    const parsed = parseYdk(ydk, catalog);
    expect(
      parsed.violations.some((v) => v.code === "wrong_zone" && v.passcode === FUSION_MONSTER),
    ).toBe(true);
    // Codec moves it to Extra
    expect(parsed.extra).toContain(FUSION_MONSTER);
    expect(parsed.main).not.toContain(FUSION_MONSTER);
  });

  it("Synchro monster under #main → wrong_zone violation", () => {
    const ydk = `#main\n${SYNCHRO_MONSTER}\n#extra\n!side\n`;
    const parsed = parseYdk(ydk, catalog);
    expect(
      parsed.violations.some((v) => v.code === "wrong_zone" && v.passcode === SYNCHRO_MONSTER),
    ).toBe(true);
  });
});

describe("AC-07 — illegal .ydk: wrong side marker '#side' instead of '!side'", () => {
  it("reports parse_error violation for '#side' and still parses the section", () => {
    const ydk = `#main\n${BEAST_KING}\n#extra\n#side\n${BTH}\n`;
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.violations.some((v) => v.code === "parse_error")).toBe(true);
    expect(parsed.side).toContain(BTH);
  });
});

describe("AC-07 — malformed .ydk: non-numeric card line", () => {
  it("reports parse_error for non-numeric content", () => {
    const ydk = "#main\nNOT_A_NUMBER\n#extra\n!side\n";
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.violations.some((v) => v.code === "parse_error")).toBe(true);
  });
});

describe("AC-07 — malformed .ydk: passcode before any section marker", () => {
  it("reports parse_error", () => {
    const ydk = `${BEAST_KING}\n#main\n#extra\n!side\n`;
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.violations.some((v) => v.code === "parse_error")).toBe(true);
  });
});

describe("AC-07 — malformed .ydk: blank file", () => {
  it("parses without crash, empty zones", () => {
    const parsed = parseYdk("", catalog);
    expect(parsed.main).toHaveLength(0);
    expect(parsed.extra).toHaveLength(0);
    expect(parsed.side).toHaveLength(0);
  });
});

describe("AC-07 — malformed .ydk: only comments, no passcodes", () => {
  it("parses without crash", () => {
    const ydk = "#main\n#extra\n!side\n# some comment\n";
    const parsed = parseYdk(ydk, catalog);
    expect(parsed.main).toHaveLength(0);
    expect(parsed.violations).toHaveLength(0);
  });
});

describe("AC-07 — null catalog: parses without crash", () => {
  it("accepts unknown passcodes when no catalog provided", () => {
    const ydk = "#main\n99999999\n#extra\n!side\n";
    const parsed = parseYdk(ydk, null);
    expect(parsed.main).toContain(99999999);
    expect(parsed.violations).toHaveLength(0);
  });
});

describe("AC-07 — normal monster under #extra", () => {
  it("reports wrong_zone and moves card to main", () => {
    const ydk = `#main\n#extra\n${BEAST_KING}\n!side\n`;
    const parsed = parseYdk(ydk, catalog);
    expect(
      parsed.violations.some((v) => v.code === "wrong_zone" && v.passcode === BEAST_KING),
    ).toBe(true);
    // Codec moves it to Main
    expect(parsed.main).toContain(BEAST_KING);
    expect(parsed.extra).not.toContain(BEAST_KING);
  });
});

describe("emitYdk", () => {
  it("emits correct section order: main, extra, !side", () => {
    const ydk = emitYdk({ main: [BEAST_KING], extra: [FUSION_MONSTER], side: [BTH] });
    const mainIdx = ydk.indexOf("#main");
    const extraIdx = ydk.indexOf("#extra");
    const sideIdx = ydk.indexOf("!side");
    expect(mainIdx).toBeLessThan(extraIdx);
    expect(extraIdx).toBeLessThan(sideIdx);
  });

  it("each passcode is on its own line", () => {
    const deck = { main: [BEAST_KING, BTH], extra: [], side: [] };
    const ydk = emitYdk(deck);
    const lines = ydk.split("\n").filter((l) => /^\d+$/.test(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(String(BEAST_KING));
    expect(lines[1]).toBe(String(BTH));
  });
});

// ---------------------------------------------------------------------------
// Alias resolution — real catalog tests for .ydk codec
// ---------------------------------------------------------------------------

describe("alias resolution — pre-errata passcodes in .ydk", () => {
  it("pre-errata passcode (511002993) in #extra section is recognized via alias", async () => {
    const { loadCatalog, resetCatalogCache } = await import("../catalog/loadCatalog.js");
    resetCatalogCache();
    const realCatalog = loadCatalog();

    const ydk = "#main\n#extra\n511002993\n!side\n";
    const parsed = parseYdk(ydk, realCatalog);

    // Should NOT report unknown_passcode for Brionac pre-errata alias
    expect(
      parsed.violations.some((v) => v.code === "unknown_passcode" && v.passcode === 511002993),
    ).toBe(false);
    // Card is recognized as Extra Deck card (Synchro) → routes to extra
    expect(parsed.extra).toContain(511002993);

    resetCatalogCache();
  });
});
