import { describe, expect, it } from "vitest";
import { maxCopies } from "../components/LegalityBadge";
import { MOCK_CARDS } from "./data";

// Tests for the legality-count logic that enforces §2.1.
// These run in Node environment (no DOM needed).

describe("Edison deck construction rules (§2.1)", () => {
  it("identifies extra-deck cards correctly", () => {
    const extra = MOCK_CARDS.filter((c) => c.isExtraDeck);

    // Fusion and Synchro are Extra
    for (const c of extra) {
      expect(["fusion", "synchro"]).toContain(c.frame);
    }
  });

  it("forbidden cards have maxCopies = 0", () => {
    expect(maxCopies("forbidden")).toBe(0);
    expect(maxCopies("limited")).toBe(1);
    expect(maxCopies("semi")).toBe(2);
    expect(maxCopies("unlimited")).toBe(3);
  });

  it("mock card data has correct banlist values", () => {
    const bls = MOCK_CARDS.find((c) => c.name.includes("Black Luster Soldier"));
    expect(bls?.banlist).toBe("forbidden");

    const gale = MOCK_CARDS.find((c) => c.name.includes("Gale"));
    expect(gale?.banlist).toBe("semi");

    const goyo = MOCK_CARDS.find((c) => c.name.includes("Goyo"));
    expect(goyo?.banlist).toBe("limited");
  });

  it("stardust dragon is an extra-deck synchro", () => {
    const sd = MOCK_CARDS.find((c) => c.name === "Stardust Dragon");
    expect(sd).toBeDefined();
    expect(sd!.frame).toBe("synchro");
    expect(sd!.isExtraDeck).toBe(true);
  });

  it("ritual monsters are NOT extra-deck cards", () => {
    const rituals = MOCK_CARDS.filter((c) => c.frame === "ritual");
    for (const r of rituals) {
      expect(r.isExtraDeck).toBe(false);
    }
  });

  it("maxCopies respects banlist hierarchy", () => {
    const caps: Record<string, number> = {
      forbidden: 0,
      limited: 1,
      semi: 2,
      unlimited: 3,
    };
    for (const [ban, max] of Object.entries(caps)) {
      expect(maxCopies(ban as "forbidden" | "limited" | "semi" | "unlimited")).toBe(max);
    }
  });
});

describe("Copy count edge cases", () => {
  it("aliasOf aliasing: same base passcode counted once", () => {
    // Simulate two cards that alias to the same base
    const basePasscode = 89631139;
    const cards = new Map<number, import("../types/contracts").CardDTO>([
      [
        89631139,
        {
          passcode: 89631139,
          name: "Blue-Eyes White Dragon",
          frame: "normal",
          isExtraDeck: false,
          race: "Dragon",
          attribute: "LIGHT",
          level: 8,
          atk: 3000,
          def: 2500,
          desc: "",
          banlist: "unlimited",
          aliasOf: null,
          imageId: 89631139,
        },
      ],
      [
        89631140,
        {
          passcode: 89631140,
          name: "Blue-Eyes White Dragon (alt art)",
          frame: "normal",
          isExtraDeck: false,
          race: "Dragon",
          attribute: "LIGHT",
          level: 8,
          atk: 3000,
          def: 2500,
          desc: "",
          banlist: "unlimited",
          aliasOf: basePasscode,
          imageId: basePasscode,
        },
      ],
    ]);

    // Count aliases properly
    function countCopies(
      passcode: number,
      main: number[],
      extra: number[],
      side: number[],
    ): number {
      const card = cards.get(passcode);
      const base = card?.aliasOf ?? passcode;
      let count = 0;
      for (const p of [...main, ...extra, ...side]) {
        const c = cards.get(p);
        const b = c?.aliasOf ?? p;
        if (b === base) count++;
      }
      return count;
    }

    const main = [89631139, 89631140]; // 1 regular + 1 alt-art
    expect(countCopies(89631139, main, [], [])).toBe(2); // counts both
    expect(countCopies(89631140, main, [], [])).toBe(2); // same base
  });
});
