/**
 * responsePrompts unit tests — C4 acceptance criteria 7.
 *
 * Tests shouldOfferWindow per level, including:
 * - an unclassifiable decision returns true (fail-safe rule)
 * - non-forced ChainPrompt is suppressed at Minimal
 * - forced ChainPrompt is always offered
 * - Every window always returns true
 * - Standard always returns true
 */
import { describe, expect, it } from "vitest";
import { shouldOfferWindow } from "./responsePrompts";
import type { DuelDecision } from "@yugioh-app/contracts";

const chainPromptForced: DuelDecision = {
  kind: "ChainPrompt",
  player: 0,
  selects: [],
  forced: true,
};

const chainPromptOptional: DuelDecision = {
  kind: "ChainPrompt",
  player: 0,
  selects: [],
  forced: false,
};

const selectYesNo: DuelDecision = {
  kind: "SelectYesNo",
  player: 0,
  description: "Do you want to activate?",
};

const selectEffectYN: DuelDecision = {
  kind: "SelectEffectYN",
  player: 0,
  card: { controller: 0, location: "SZONE", sequence: 0, code: 12345, name: "Test Card" },
  description: "Activate effect?",
};

const selectCard: DuelDecision = {
  kind: "SelectCard",
  player: 0,
  cards: [],
  min: 1,
  max: 1,
  cancelable: false,
};

describe("shouldOfferWindow — Every window", () => {
  it("returns true for every decision type", () => {
    for (const d of [
      chainPromptForced,
      chainPromptOptional,
      selectYesNo,
      selectEffectYN,
      selectCard,
    ]) {
      expect(shouldOfferWindow(d, "Every window")).toBe(true);
    }
  });
});

describe("shouldOfferWindow — Standard", () => {
  it("returns true for all tested decisions", () => {
    for (const d of [
      chainPromptForced,
      chainPromptOptional,
      selectYesNo,
      selectEffectYN,
      selectCard,
    ]) {
      expect(shouldOfferWindow(d, "Standard")).toBe(true);
    }
  });
});

describe("shouldOfferWindow — Minimal", () => {
  it("returns false for non-forced ChainPrompt (optional chain response)", () => {
    expect(shouldOfferWindow(chainPromptOptional, "Minimal")).toBe(false);
  });

  it("returns true for forced ChainPrompt (mandatory)", () => {
    expect(shouldOfferWindow(chainPromptForced, "Minimal")).toBe(true);
  });

  it("returns true for SelectYesNo (fail-safe: cannot classify as mandatory or optional)", () => {
    expect(shouldOfferWindow(selectYesNo, "Minimal")).toBe(true);
  });

  it("returns true for SelectEffectYN (fail-safe: cannot classify as mandatory or optional)", () => {
    expect(shouldOfferWindow(selectEffectYN, "Minimal")).toBe(true);
  });

  it("returns true for SelectCard (fail-safe)", () => {
    expect(shouldOfferWindow(selectCard, "Minimal")).toBe(true);
  });
});

describe("shouldOfferWindow — unclassifiable decision (fail-safe rule)", () => {
  it("returns true for a SelectZone decision at any level (no decline path = must offer)", () => {
    const selectZone: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      zones: [{ controller: 0, location: "MZONE", sequence: 0 }],
      count: 1,
    };
    expect(shouldOfferWindow(selectZone, "Minimal")).toBe(true);
    expect(shouldOfferWindow(selectZone, "Standard")).toBe(true);
    expect(shouldOfferWindow(selectZone, "Every window")).toBe(true);
  });

  it("returns true for any decision kind not explicitly handled (IdleCommand falls to fail-safe)", () => {
    // IdleCommand is ACT mode and would never normally reach shouldOfferWindow,
    // but if it did, fail-safe must apply.
    const idle: DuelDecision = {
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
    };
    expect(shouldOfferWindow(idle, "Minimal")).toBe(true);
  });
});
