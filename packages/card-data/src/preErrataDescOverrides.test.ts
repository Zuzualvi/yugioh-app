import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, buildCardMap } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface OverrideEntry {
  name: string;
  needsOverride: boolean;
  preErrataDescClean: string;
}

type OverridesJson = Record<string, OverrideEntry>;

const overridesJson: OverridesJson = JSON.parse(
  readFileSync(resolve(__dirname, "preErrataDescOverrides.json"), "utf8"),
) as OverridesJson;

const catalog = loadCatalog();
const cardMap = buildCardMap(catalog);

describe("pre-errata desc overrides — catalog spot-checks", () => {
  it("Goyo Guardian (7391448) desc contains '1 Tuner' and does NOT contain 'EARTH Tuner'", () => {
    const card = cardMap.get(7391448);
    expect(card).toBeDefined();
    expect(card!.desc).toContain("1 Tuner");
    expect(card!.desc).not.toContain("EARTH Tuner");
  });

  it("Sangan (26202165) desc does NOT contain 'once per turn'", () => {
    const card = cardMap.get(26202165);
    expect(card).toBeDefined();
    expect(card!.desc.toLowerCase()).not.toContain("once per turn");
  });

  it("Brain Control (87910978) desc does NOT contain 'Normal Summoned/Set'", () => {
    const card = cardMap.get(87910978);
    expect(card).toBeDefined();
    expect(card!.desc).not.toContain("Normal Summoned/Set");
  });
});

describe("pre-errata desc overrides — all 35 needsOverride:true entries match catalog", () => {
  const needsOverrideEntries = Object.entries(overridesJson).filter(
    ([, v]) => v.needsOverride === true,
  );

  it("there are exactly 35 needsOverride:true entries in the JSON", () => {
    expect(needsOverrideEntries.length).toBe(35);
  });

  for (const [passcodeStr, entry] of needsOverrideEntries) {
    const passcode = Number(passcodeStr);
    it(`${entry.name} (${passcode}) catalog desc equals preErrataDescClean`, () => {
      const card = cardMap.get(passcode);
      expect(card).toBeDefined();
      expect(card!.desc).toBe(entry.preErrataDescClean);
    });
  }
});

interface OverrideEntryFull extends OverrideEntry {
  ourCurrentDesc: string | null;
}

describe("Susa Soldier (40473581) — no-override card is present and unchanged", () => {
  const susaEntry = overridesJson["40473581"] as OverrideEntryFull | undefined;

  it("Susa Soldier is present in the catalog", () => {
    const card = cardMap.get(40473581);
    expect(card).toBeDefined();
  });

  it("Susa Soldier needsOverride is false in the JSON", () => {
    expect(susaEntry).toBeDefined();
    expect(susaEntry!.needsOverride).toBe(false);
  });

  it("Susa Soldier catalog desc matches ourCurrentDesc (override mechanism left it untouched)", () => {
    const card = cardMap.get(40473581);
    expect(card).toBeDefined();
    expect(susaEntry).toBeDefined();
    // ourCurrentDesc is the known pre-override text for this card; since needsOverride=false
    // the build pipeline must leave the desc unchanged (= whatever YGOPRODeck returns).
    expect(card!.desc).toBe(susaEntry!.ourCurrentDesc);
  });
});

describe("C4 preErrataText — catalog flag derived from override set", () => {
  it("Sangan (26202165) has preErrataText: true in catalog", () => {
    const card = cardMap.get(26202165);
    expect(card).toBeDefined();
    expect(card!.preErrataText).toBe(true);
  });

  it("Caius the Shadow Monarch (9748752) does NOT have preErrataText set", () => {
    const card = cardMap.get(9748752);
    expect(card).toBeDefined();
    expect(card!.preErrataText).toBeFalsy();
  });

  it("all 35 needsOverride:true cards have preErrataText: true in catalog", () => {
    const needsOverrideEntries = Object.entries(overridesJson).filter(
      ([, v]) => v.needsOverride === true,
    );
    for (const [passcodeStr] of needsOverrideEntries) {
      const passcode = Number(passcodeStr);
      const card = cardMap.get(passcode);
      expect(card, `card ${passcode} missing from catalog`).toBeDefined();
      expect(card!.preErrataText, `card ${passcode} missing preErrataText`).toBe(true);
    }
  });

  it("Susa Soldier (40473581) does NOT have preErrataText set (needsOverride: false)", () => {
    const card = cardMap.get(40473581);
    expect(card).toBeDefined();
    expect(card!.preErrataText).toBeFalsy();
  });
});
