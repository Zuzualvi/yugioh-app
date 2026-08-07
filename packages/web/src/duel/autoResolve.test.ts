/**
 * autoResolve tests — exhaustive coverage of the §15 register.
 *
 * Every decision type is tested for every auto-answer case AND for the cases
 * that must NOT be auto-answered. This is requirement F13/F14 applied to the
 * pure function itself.
 */

import { describe, expect, it } from "vitest";
import type { DuelDecision } from "@yugioh-app/contracts";
import { autoAnswer } from "./autoResolve";

const prefs = { chooseZones: false };
const prefsChooseZones = { chooseZones: true };

// ── Helper card entries ─────────────────────────────────────────────────────

const card = (seq: number) => ({
  code: 100 + seq,
  name: `Card ${seq}`,
  controller: 0 as const,
  location: "HAND" as const,
  sequence: seq,
});

const zone = (seq: number) => ({
  controller: 0 as const,
  location: "MZONE" as const,
  sequence: seq,
});

// ── Never auto-answered variants ────────────────────────────────────────────

describe("autoAnswer — never auto-answered variants", () => {
  it.each([
    [
      "IdleCommand",
      {
        kind: "IdleCommand",
        player: 0,
        summons: [],
        specialSummons: [],
        posChanges: [],
        monsterSets: [],
        spellSets: [],
        activates: [],
        toBattlePhase: false,
        toEndPhase: false,
      },
    ],
    [
      "BattleCommand",
      {
        kind: "BattleCommand",
        player: 0,
        chains: [],
        attacks: [],
        toMainPhase2: false,
        toEndPhase: false,
      },
    ],
    ["SelectYesNo", { kind: "SelectYesNo", player: 0, description: "?" }],
    ["SelectEffectYN", { kind: "SelectEffectYN", player: 0, card: card(0), description: "?" }],
    ["AnnounceCard-any", { kind: "AnnounceCard", player: 0, filter: { kind: "any" } }],
    ["AnnounceNumber-multi", { kind: "AnnounceNumber", player: 0, options: [1, 2, 3] }],
    ["AnnounceNumber-one", { kind: "AnnounceNumber", player: 0, options: [7] }],
    [
      "SelectUnselectCard",
      {
        kind: "SelectUnselectCard",
        player: 0,
        selectCards: [card(0)],
        unselectCards: [],
        min: 1,
        max: 1,
        canFinish: false,
        cancelable: true,
      },
    ],
    [
      "SelectSum",
      {
        kind: "SelectSum",
        player: 0,
        amount: 5,
        must: [],
        optional: [{ ...card(0), amount: 3 }],
        min: 0,
        max: 1,
      },
    ],
    [
      "SelectCounter",
      {
        kind: "SelectCounter",
        player: 0,
        counterType: 1,
        count: 2,
        cards: [{ ...card(0), currentCount: 3 }],
      },
    ],
    ["SelectDisfield", { kind: "SelectDisfield", player: 0, count: 1, zones: [zone(0), zone(1)] }],
    ["SortCard", { kind: "SortCard", player: 0, cards: [card(0), card(1)] }],
    ["SortChain", { kind: "SortChain", player: 0, cards: [card(0)] }],
  ] as [string, DuelDecision][])("returns null for %s", (_, decision) => {
    expect(autoAnswer(decision, prefs)).toBeNull();
  });
});

// ── SelectZone ──────────────────────────────────────────────────────────────

describe("autoAnswer — SelectZone", () => {
  it("auto-answers when zones.length === 1", () => {
    const d: DuelDecision = { kind: "SelectZone", player: 0, count: 1, zones: [zone(0)] };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectZone", indices: [0] });
    expect(autoAnswer(d, prefsChooseZones)).toEqual({ kind: "SelectZone", indices: [0] });
  });

  it("auto-answers leftmost when chooseZones is OFF and multiple zones exist", () => {
    const d: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      count: 1,
      zones: [zone(0), zone(1), zone(2)],
    };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectZone", indices: [0] });
  });

  it("returns null when chooseZones is ON and multiple zones exist", () => {
    const d: DuelDecision = { kind: "SelectZone", player: 0, count: 1, zones: [zone(0), zone(1)] };
    expect(autoAnswer(d, prefsChooseZones)).toBeNull();
  });

  it("returns null when zones is empty", () => {
    const d: DuelDecision = { kind: "SelectZone", player: 0, count: 1, zones: [] };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── SelectPosition ───────────────────────────────────────────────────────────

describe("autoAnswer — SelectPosition", () => {
  it("auto-answers when exactly one position is legal", () => {
    const d: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: card(0),
      positions: ["faceup_attack"],
    };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectPosition", position: "faceup_attack" });
  });

  it("returns null when multiple positions are legal", () => {
    const d: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: card(0),
      positions: ["faceup_attack", "faceup_defense"],
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── SelectTribute ────────────────────────────────────────────────────────────

describe("autoAnswer — SelectTribute", () => {
  it("auto-answers when min === max === cards.length (non-cancelable)", () => {
    const cards = [card(0), card(1)];
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards,
      min: 2,
      max: 2,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectTribute", indices: [0, 1] });
  });

  it("auto-answers when cancelable (§16.A — cancel stays via ribbon)", () => {
    const cards = [card(0)];
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards,
      min: 1,
      max: 1,
      cancelable: true,
    };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectTribute", indices: [0] });
  });

  it("returns null when min !== max (real choice exists)", () => {
    const cards = [card(0), card(1), card(2)];
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards,
      min: 1,
      max: 2,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when cards.length > min === max (choice of WHICH to tribute)", () => {
    const cards = [card(0), card(1), card(2)];
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards,
      min: 2,
      max: 2,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when cards is empty", () => {
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [],
      min: 0,
      max: 0,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── ChainPrompt ──────────────────────────────────────────────────────────────

describe("autoAnswer — ChainPrompt", () => {
  const activeCard = {
    code: 100,
    name: "Card A",
    controller: 0 as const,
    location: "SZONE" as const,
    sequence: 0,
    description: "Activate",
  };

  it("auto-answers when forced AND selects.length === 1", () => {
    const d: DuelDecision = { kind: "ChainPrompt", player: 0, forced: true, selects: [activeCard] };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "ChainPrompt", index: 0 });
  });

  it("returns null when forced AND selects.length > 1", () => {
    const d: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: true,
      selects: [activeCard, { ...activeCard, code: 101, sequence: 1 }],
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when not forced", () => {
    const d: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [activeCard],
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when not forced with empty selects", () => {
    const d: DuelDecision = { kind: "ChainPrompt", player: 0, forced: false, selects: [] };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── SelectOption ─────────────────────────────────────────────────────────────

describe("autoAnswer — SelectOption", () => {
  it("auto-answers when exactly one option", () => {
    const d: DuelDecision = { kind: "SelectOption", player: 0, options: ["Draw 2 cards"] };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectOption", index: 0 });
  });

  it("returns null when multiple options", () => {
    const d: DuelDecision = { kind: "SelectOption", player: 0, options: ["Effect A", "Effect B"] };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── AnnounceRace / AnnounceAttrib ────────────────────────────────────────────

describe("autoAnswer — AnnounceRace", () => {
  it("auto-answers when count === 1 AND available.length === 1", () => {
    const d: DuelDecision = { kind: "AnnounceRace", player: 0, count: 1, available: ["WARRIOR"] };
    const r = autoAnswer(d, prefs);
    expect(r).toEqual({ kind: "AnnounceRace", races: ["WARRIOR"] });
  });

  it("returns null when count === 1 but multiple available", () => {
    const d: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["WARRIOR", "SPELLCASTER"],
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

describe("autoAnswer — AnnounceAttrib", () => {
  it("auto-answers when count === 1 AND available.length === 1", () => {
    const d: DuelDecision = { kind: "AnnounceAttrib", player: 0, count: 1, available: ["DARK"] };
    const r = autoAnswer(d, prefs);
    expect(r).toEqual({ kind: "AnnounceAttrib", attributes: ["DARK"] });
  });

  it("returns null when count > 1", () => {
    const d: DuelDecision = { kind: "AnnounceAttrib", player: 0, count: 2, available: ["DARK"] };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});

// ── SelectCard ───────────────────────────────────────────────────────────────

describe("autoAnswer — SelectCard", () => {
  it("auto-answers when min === max === cards.length AND not cancelable", () => {
    const cards = [card(0), card(1)];
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards,
      min: 2,
      max: 2,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toEqual({ kind: "SelectCard", indices: [0, 1] });
  });

  it("returns null when cancelable (cancel is a second legal answer — see §16.A note)", () => {
    // The §15 entry for SelectCard explicitly requires cancelable: false.
    // Cancelable SelectCard with min===max===cards.length is NOT auto-answered
    // by this function (different from SelectTribute §16.A handling).
    const cards = [card(0)];
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards,
      min: 1,
      max: 1,
      cancelable: true,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when min !== max", () => {
    const cards = [card(0), card(1), card(2)];
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards,
      min: 1,
      max: 2,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });

  it("returns null when cards.length > min === max (choice exists)", () => {
    const cards = [card(0), card(1), card(2)];
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards,
      min: 1,
      max: 1,
      cancelable: false,
    };
    expect(autoAnswer(d, prefs)).toBeNull();
  });
});
