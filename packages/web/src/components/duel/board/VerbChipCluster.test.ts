// @vitest-environment jsdom
/**
 * VerbChipCluster — deriveVerbs tests.
 *
 * Verifies:
 *   - Verb derivation from IdleCommand (A1, A2, A3)
 *   - "Normal Summon — tribute" label for level ≥ 5 cards (MH-1, no count per ND-1)
 *   - "Normal Summon" label for level ≤ 4
 *   - Fixed global order
 *   - Absent verbs not rendered (A3)
 *   - Refusal reason derivation (A9, requirement H)
 */
import { describe, expect, it } from "vitest";
import { deriveVerbs, deriveRefusalReason } from "./VerbChipCluster";
import type { CardRef } from "../../../duel/contracts";
import type { ZoneCard } from "@yugioh-app/contracts";

const ref: CardRef = { controller: 0, location: "HAND", sequence: 2 };

describe("deriveVerbs — IdleCommand", () => {
  it("returns null for non-IdleCommand/BattleCommand decisions", () => {
    const result = deriveVerbs({ kind: "SelectYesNo", player: 0, description: "?" }, ref);
    expect(result).toBeNull();
  });

  it("returns null when ref is null", () => {
    expect(deriveVerbs(null, null)).toBeNull();
  });

  it("Normal Summon label for level ≤ 4 (no tribute needed)", () => {
    const hand: ZoneCard[] = [
      null as unknown as ZoneCard,
      null as unknown as ZoneCard,
      { code: 123, position: 0, level: 4 },
    ];
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [{ code: 123, name: "Test", controller: 0, location: "HAND", sequence: 2 }],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
      hand,
    );
    const summonVerb = verbs?.find((v) => v.action === "summon");
    expect(summonVerb?.label).toBe("Normal Summon");
  });

  it("Normal Summon — tribute label for level ≥ 5 (no count per ND-1)", () => {
    const hand: ZoneCard[] = [
      null as unknown as ZoneCard,
      null as unknown as ZoneCard,
      { code: 999, position: 0, level: 6 }, // Caius is level 6
    ];
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [{ code: 999, name: "Caius", controller: 0, location: "HAND", sequence: 2 }],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
      hand,
    );
    const summonVerb = verbs?.find((v) => v.action === "summon");
    expect(summonVerb?.label).toBe("Normal Summon — tribute");
    // No count — ND-1 withdrawn
    expect(summonVerb?.label).not.toMatch(/\d/);
  });

  it("Normal Summon (no tribute label) when level is null/unknown — safe fallback (req H)", () => {
    const hand: ZoneCard[] = [
      null as unknown as ZoneCard,
      null as unknown as ZoneCard,
      { code: 456, position: 0 }, // level absent
    ];
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [{ code: 456, name: "Unknown", controller: 0, location: "HAND", sequence: 2 }],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
      hand,
    );
    const summonVerb = verbs?.find((v) => v.action === "summon");
    // Unknown level → safe fallback "Normal Summon" (don't fabricate tribute claim)
    expect(summonVerb?.label).toBe("Normal Summon");
  });

  it("Inspect is always included (last in order)", () => {
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
    );
    expect(verbs?.at(-1)?.label).toBe("Inspect");
  });

  it("verbs are in fixed global order (Summon before Inspect)", () => {
    const hand: ZoneCard[] = [
      null as unknown as ZoneCard,
      null as unknown as ZoneCard,
      { code: 100, position: 0, level: 3 },
    ];
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [{ code: 100, name: "A", controller: 0, location: "HAND", sequence: 2 }],
        monsterSets: [{ code: 100, name: "A", controller: 0, location: "HAND", sequence: 2 }],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
      hand,
    );
    const labels = verbs?.map((v) => v.label) ?? [];
    const summonIdx = labels.indexOf("Normal Summon");
    const inspectIdx = labels.indexOf("Inspect");
    expect(summonIdx).toBeGreaterThanOrEqual(0);
    expect(inspectIdx).toBeGreaterThanOrEqual(0);
    expect(summonIdx).toBeLessThan(inspectIdx);
  });

  it("absent verbs are not in the list (A3 — never greyed)", () => {
    const verbs = deriveVerbs(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      ref,
    );
    // No summon/set/activate in decision → those verbs absent
    const labels = verbs?.map((v) => v.label) ?? [];
    expect(labels).not.toContain("Normal Summon");
    expect(labels).not.toContain("Set");
    expect(labels).not.toContain("Activate");
    // Only Inspect should be present (always)
    expect(labels).toContain("Inspect");
  });
});

describe("deriveRefusalReason (A9, requirement H)", () => {
  it("returns 'already attacked' for mzone monster absent from BattleCommand attacks[]", () => {
    const mzoneRef: CardRef = { controller: 0, location: "MZONE", sequence: 1 };
    const reason = deriveRefusalReason(
      {
        kind: "BattleCommand",
        player: 0,
        chains: [],
        attacks: [], // monster NOT in attacks[] → has already attacked
        toMainPhase2: false,
        toEndPhase: true,
      },
      mzoneRef,
    );
    expect(reason).toBe("This monster has already attacked.");
  });

  it("returns generic reason for non-BP / non-MZONE card", () => {
    const handRef: CardRef = { controller: 0, location: "HAND", sequence: 0 };
    const reason = deriveRefusalReason(
      {
        kind: "IdleCommand",
        player: 0,
        summons: [],
        monsterSets: [],
        spellSets: [],
        activates: [],
        specialSummons: [],
        posChanges: [],
        toBattlePhase: false,
        toEndPhase: true,
      },
      handRef,
    );
    expect(reason).toBe("Nothing you can do with this card right now.");
  });
});
