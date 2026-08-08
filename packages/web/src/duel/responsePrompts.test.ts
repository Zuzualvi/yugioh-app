/**
 * responsePrompts unit tests — C4 acceptance criteria 7.
 *
 * Tests shouldOfferWindow per level with event sequences, including:
 * - Standard suppresses phase-change/chain-resolution/battle-step contexts
 * - Standard offers summon/attack/activation/turn contexts
 * - Minimal suppresses non-forced ChainPrompt
 * - Unclassifiable decision returns true (fail-safe rule)
 * - Every window always returns true
 */
import { describe, expect, it } from "vitest";
import { shouldOfferWindow } from "./responsePrompts";
import type { DuelDecision, DuelEvent } from "@yugioh-app/contracts";

// ── Decision fixtures ─────────────────────────────────────────────────────────

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

// ── Event fixtures ────────────────────────────────────────────────────────────

const COMMON = { seq: 0, turnNumber: 1, phase: 4 } as const;

const evSummon: DuelEvent = {
  kind: "SUMMON",
  ...COMMON,
  card: { code: 100, controller: 0, location: "MZONE", sequence: 0 },
  position: 1,
};
const evSpsummon: DuelEvent = {
  kind: "SPSUMMON",
  ...COMMON,
  card: { code: 100, controller: 0, location: "MZONE", sequence: 0 },
  position: 1,
};
const evAttack: DuelEvent = {
  kind: "ATTACK",
  ...COMMON,
  attacker: { code: 100, controller: 0, location: "MZONE", sequence: 0 },
  target: null,
};
const evChaining: DuelEvent = {
  kind: "CHAINING",
  ...COMMON,
  card: { code: 100, controller: 0, location: "SZONE", sequence: 0 },
  link: 1,
  owner: 0,
};
const evChainEnd: DuelEvent = { kind: "CHAIN_END", ...COMMON };
const evTurn: DuelEvent = { kind: "TURN", ...COMMON, turnPlayer: 1, lpSnapshot: [8000, 8000] };

const evPhase: DuelEvent = { kind: "PHASE", ...COMMON };
const evChainSolving: DuelEvent = { kind: "CHAIN_SOLVING", ...COMMON, link: 1 };
const evChainSolved: DuelEvent = { kind: "CHAIN_SOLVED", ...COMMON, link: 1 };
const evBattle: DuelEvent = {
  kind: "BATTLE",
  ...COMMON,
  attacker: { code: 100, controller: 0, location: "MZONE", sequence: 0 },
  target: { code: 200, controller: 1, location: "MZONE", sequence: 0 },
};

const evLpChange: DuelEvent = {
  kind: "LP_CHANGE",
  ...COMMON,
  seat: 0,
  delta: -500,
  reason: "damage",
};

// ── Every window ──────────────────────────────────────────────────────────────

describe("shouldOfferWindow — Every window", () => {
  it("returns true regardless of events or decision type", () => {
    for (const d of [chainPromptForced, chainPromptOptional, selectYesNo]) {
      for (const evs of [[], [evPhase], [evSummon]]) {
        expect(shouldOfferWindow(d, evs, "Every window")).toBe(true);
      }
    }
  });
});

// ── Standard level ────────────────────────────────────────────────────────────

describe("shouldOfferWindow — Standard: event-based classification", () => {
  it("offers after SUMMON event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evSummon], "Standard")).toBe(true);
  });

  it("offers after SPSUMMON event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evSpsummon], "Standard")).toBe(true);
  });

  it("offers after ATTACK event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evAttack], "Standard")).toBe(true);
  });

  it("offers after CHAINING (activation) event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evChaining], "Standard")).toBe(true);
  });

  it("offers after CHAIN_END event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evChainEnd], "Standard")).toBe(true);
  });

  it("offers after TURN event (before opponent ends turn)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evTurn], "Standard")).toBe(true);
  });

  it("suppresses after PHASE event (phase change = Every window only)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evPhase], "Standard")).toBe(false);
  });

  it("suppresses after CHAIN_SOLVING event (chain resolution = Every window only)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evChainSolving], "Standard")).toBe(false);
  });

  it("suppresses after CHAIN_SOLVED event", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evChainSolved], "Standard")).toBe(false);
  });

  it("suppresses after BATTLE event (battle step = Every window only)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evBattle], "Standard")).toBe(false);
  });

  it("uses the most recent classifiable event (SUMMON then PHASE → last is PHASE → suppress)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evSummon, evPhase], "Standard")).toBe(false);
  });

  it("uses the most recent classifiable event (PHASE then SUMMON → last is SUMMON → offer)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evPhase, evSummon], "Standard")).toBe(true);
  });

  it("fail-safe: LP_CHANGE only (unclassifiable context) → true", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evLpChange], "Standard")).toBe(true);
  });

  it("fail-safe: no events → true", () => {
    expect(shouldOfferWindow(chainPromptOptional, [], "Standard")).toBe(true);
  });
});

// ── Minimal level ─────────────────────────────────────────────────────────────

describe("shouldOfferWindow — Minimal", () => {
  it("suppresses non-forced ChainPrompt (optional chain response)", () => {
    expect(shouldOfferWindow(chainPromptOptional, [evSummon], "Minimal")).toBe(false);
  });

  it("offers forced ChainPrompt (mandatory, no decline path) — always true at all levels", () => {
    // Forced ChainPrompt has no decline response → mandatory → always offered
    expect(shouldOfferWindow(chainPromptForced, [evPhase], "Minimal")).toBe(true);
    expect(shouldOfferWindow(chainPromptForced, [evChainSolving], "Minimal")).toBe(true);
    expect(shouldOfferWindow(chainPromptForced, [], "Minimal")).toBe(true);
  });

  it("fail-safe: SelectYesNo → true (cannot classify as mandatory or optional)", () => {
    expect(shouldOfferWindow(selectYesNo, [evSummon], "Minimal")).toBe(true);
  });

  it("fail-safe: no events → true", () => {
    expect(shouldOfferWindow(chainPromptForced, [], "Minimal")).toBe(true);
  });
});

// ── Fail-safe: unclassifiable decisions ──────────────────────────────────────

describe("shouldOfferWindow — fail-safe for unclassifiable decisions", () => {
  it("SelectZone (no decline path = mandatory) → true at all levels and all event contexts", () => {
    const selectZone: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      zones: [{ controller: 0, location: "MZONE", sequence: 0 }],
      count: 1,
    };
    // Mandatory decisions are always offered regardless of event context or level
    expect(shouldOfferWindow(selectZone, [], "Minimal")).toBe(true);
    expect(shouldOfferWindow(selectZone, [evPhase], "Standard")).toBe(true);
    expect(shouldOfferWindow(selectZone, [], "Standard")).toBe(true);
    expect(shouldOfferWindow(selectZone, [], "Every window")).toBe(true);
  });

  it("IdleCommand (ACT mode, would never normally reach here) → true at all levels", () => {
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
    expect(shouldOfferWindow(idle, [], "Minimal")).toBe(true);
    expect(shouldOfferWindow(idle, [], "Standard")).toBe(true);
  });
});

// ── Nesting-invariant test ────────────────────────────────────────────────────
// offered(Minimal) ⊆ offered(Standard) ⊆ offered(Every window)
// If a case is offered at Minimal it must be offered at Standard;
// if offered at Standard it must be offered at Every window.

describe("shouldOfferWindow — nesting invariant: Minimal ⊆ Standard ⊆ Every window", () => {
  const decisions: DuelDecision[] = [
    chainPromptForced,
    chainPromptOptional,
    selectYesNo,
    {
      kind: "SelectZone",
      player: 0,
      zones: [{ controller: 0, location: "MZONE", sequence: 0 }],
      count: 1,
    },
    {
      kind: "SelectEffectYN",
      player: 0,
      card: { controller: 0, location: "SZONE", sequence: 0, code: 12345, name: "Test" },
      description: "Activate?",
    },
  ];

  const eventSets: [string, DuelEvent[]][] = [
    ["empty", []],
    ["SUMMON", [evSummon]],
    ["ATTACK", [evAttack]],
    ["CHAINING", [evChaining]],
    ["CHAIN_END", [evChainEnd]],
    ["PHASE", [evPhase]],
    ["CHAIN_SOLVING", [evChainSolving]],
    ["BATTLE", [evBattle]],
    ["LP_CHANGE only", [evLpChange]],
    ["SUMMON then PHASE", [evSummon, evPhase]],
    ["PHASE then SUMMON", [evPhase, evSummon]],
  ];

  for (const decision of decisions) {
    for (const [evLabel, events] of eventSets) {
      it(`${decision.kind} / events=[${evLabel}]: Minimal ⊆ Standard ⊆ Every window`, () => {
        const minimal = shouldOfferWindow(decision, events, "Minimal");
        const standard = shouldOfferWindow(decision, events, "Standard");
        const everyWindow = shouldOfferWindow(decision, events, "Every window");

        // If Minimal offers it, Standard must too
        if (minimal) {
          expect(standard).toBe(true);
        }
        // If Standard offers it, Every window must too
        if (standard) {
          expect(everyWindow).toBe(true);
        }
      });
    }
  }
});
