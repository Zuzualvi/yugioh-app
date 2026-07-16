// ---------------------------------------------------------------------------
// duelDecision.ts schema unit tests (Phase 0 Deliverable C)
//
// Verifies:
//   1. Every DuelDecision variant round-trips through Zod parse.
//   2. Every DuelDecisionResponse variant round-trips through Zod parse.
//   3. Response kinds match decision kinds (contract invariant).
//   4. Hidden-card fixture asserts no leaked name/code.
//   5. Invalid inputs are rejected.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  DuelDecisionSchema,
  DuelDecisionResponseSchema,
  type DuelDecision,
  type DuelDecisionResponse,
} from "./duelDecision.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VISIBLE_CARD = {
  code: 49003716,
  name: "Blackwing - Bora the Spear",
  controller: 0 as const,
  location: "HAND" as const,
  sequence: 0,
};
const HIDDEN_CARD = {
  code: 0,
  name: "",
  controller: 1 as const,
  location: "DECK" as const,
  sequence: 0,
};
const ACTIVE_CARD = {
  ...VISIBLE_CARD,
  location: "MZONE" as const,
  description: "Special Summon from GY",
};
const ATTACK_ENTRY = { ...VISIBLE_CARD, location: "MZONE" as const, canDirectAttack: false };
const ZONE = { controller: 0 as const, location: "MZONE" as const, sequence: 0 };

// Fixture decision for each kind
const DECISIONS: DuelDecision[] = [
  {
    kind: "IdleCommand",
    player: 0,
    summons: [VISIBLE_CARD],
    specialSummons: [],
    posChanges: [],
    monsterSets: [],
    spellSets: [],
    activates: [],
    toBattlePhase: false,
    toEndPhase: true,
  },
  {
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: [ATTACK_ENTRY],
    toMainPhase2: true,
    toEndPhase: true,
  },
  {
    kind: "ChainPrompt",
    player: 0,
    forced: false,
    selects: [ACTIVE_CARD],
  },
  { kind: "SelectEffectYN", player: 0, card: VISIBLE_CARD, description: "Special Summon?" },
  { kind: "SelectYesNo", player: 0, description: "Do you want to destroy?" },
  { kind: "SelectOption", player: 0, options: ["Change battle position", "Take control"] },
  {
    kind: "SelectCard",
    player: 0,
    cards: [VISIBLE_CARD, HIDDEN_CARD],
    min: 1,
    max: 2,
    cancelable: true,
  },
  { kind: "SelectTribute", player: 0, cards: [VISIBLE_CARD], min: 1, max: 1, cancelable: true },
  { kind: "SelectZone", player: 0, count: 1, zones: [ZONE] },
  {
    kind: "SelectPosition",
    player: 0,
    card: VISIBLE_CARD,
    positions: ["faceup_attack", "faceup_defense"],
  },
  {
    kind: "SelectUnselectCard",
    player: 0,
    selectCards: [VISIBLE_CARD],
    unselectCards: [],
    min: 1,
    max: 1,
    canFinish: false,
    cancelable: true,
  },
  { kind: "AnnounceRace", player: 0, count: 1, available: ["WARRIOR", "DRAGON"] },
  { kind: "AnnounceAttrib", player: 0, count: 1, available: ["DARK", "LIGHT"] },
  { kind: "AnnounceCard", player: 0, filter: { kind: "any" } },
  { kind: "AnnounceNumber", player: 0, options: [1000, 2000, 3000] },
  { kind: "SortChain", player: 0, cards: [VISIBLE_CARD] },
  {
    kind: "SelectCounter",
    player: 0,
    counterType: 1,
    count: 2,
    cards: [{ ...VISIBLE_CARD, location: "MZONE" as const, currentCount: 3 }],
  },
  {
    kind: "SelectSum",
    player: 0,
    amount: 8,
    must: [{ ...VISIBLE_CARD, location: "MZONE" as const, amount: 4 }],
    optional: [{ ...VISIBLE_CARD, location: "MZONE" as const, sequence: 1, amount: 4 }],
    min: 1,
    max: 3,
  },
  { kind: "SelectDisfield", player: 0, count: 1, zones: [ZONE] },
  { kind: "SortCard", player: 0, cards: [VISIBLE_CARD] },
];

// Matching response for each decision (same order, same kind)
const RESPONSES: DuelDecisionResponse[] = [
  { kind: "IdleCommand", action: "summon", index: 0 },
  { kind: "BattleCommand", action: "attack", index: 0 },
  { kind: "ChainPrompt", index: 0 },
  { kind: "SelectEffectYN", yes: false },
  { kind: "SelectYesNo", yes: true },
  { kind: "SelectOption", index: 1 },
  { kind: "SelectCard", indices: [0] },
  { kind: "SelectTribute", indices: [0] },
  { kind: "SelectZone", indices: [0] },
  { kind: "SelectPosition", position: "faceup_attack" },
  { kind: "SelectUnselectCard", index: 0 },
  { kind: "AnnounceRace", races: ["WARRIOR"] },
  { kind: "AnnounceAttrib", attributes: ["DARK"] },
  { kind: "AnnounceCard", code: 49003716 },
  { kind: "AnnounceNumber", valueIndex: 0 },
  { kind: "SortChain", order: [0] },
  { kind: "SelectCounter", counters: [2, 0] },
  { kind: "SelectSum", indices: [0, 1] },
  { kind: "SelectDisfield", indices: [0] },
  { kind: "SortCard", order: [0] },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DuelDecisionSchema — every variant round-trips through Zod parse", () => {
  for (const dec of DECISIONS) {
    it(`kind="${dec.kind}" round-trips`, () => {
      const result = DuelDecisionSchema.safeParse(dec);
      expect(result.success, `Zod parse failed: ${JSON.stringify(result)}`).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe(dec.kind);
      }
    });
  }
});

describe("DuelDecisionResponseSchema — every variant round-trips through Zod parse", () => {
  for (const resp of RESPONSES) {
    it(`kind="${resp.kind}" round-trips`, () => {
      const result = DuelDecisionResponseSchema.safeParse(resp);
      expect(result.success, `Zod parse failed: ${JSON.stringify(result)}`).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe(resp.kind);
      }
    });
  }
});

describe("DuelDecision / DuelDecisionResponse — contract invariants", () => {
  it("every decision kind has a matching response kind", () => {
    const decKinds = DECISIONS.map((d) => d.kind).sort();
    const respKinds = RESPONSES.map((r) => r.kind).sort();
    expect(decKinds).toEqual(respKinds);
  });

  it("total variants: 20 decisions, 20 responses", () => {
    expect(DECISIONS).toHaveLength(20);
    expect(RESPONSES).toHaveLength(20);
  });

  it("decisions and responses are parallel (same index → same kind)", () => {
    for (let i = 0; i < DECISIONS.length; i++) {
      expect(DECISIONS[i]!.kind).toBe(RESPONSES[i]!.kind);
    }
  });
});

describe("DuelDecisionSchema — hidden-card redaction (no leaked info)", () => {
  it("SelectCard with hidden card: code=0 and name='' pass schema", () => {
    const dec: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [HIDDEN_CARD],
      min: 1,
      max: 1,
      cancelable: false,
    };
    const result = DuelDecisionSchema.safeParse(dec);
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "SelectCard") {
      expect(result.data.cards[0]!.code).toBe(0);
      expect(result.data.cards[0]!.name).toBe("");
    }
  });

  it("SelectCard rejects negative code (must be >= 0)", () => {
    const bad = {
      kind: "SelectCard",
      player: 0,
      cards: [{ ...HIDDEN_CARD, code: -1 }],
      min: 1,
      max: 1,
      cancelable: false,
    };
    expect(DuelDecisionSchema.safeParse(bad).success).toBe(false);
  });

  it("IdleCommand hidden card in summons (code=0) is accepted by schema", () => {
    const dec: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [HIDDEN_CARD],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    expect(DuelDecisionSchema.safeParse(dec).success).toBe(true);
  });

  it("SelectCounter hidden card: code=0 accepted", () => {
    const dec: DuelDecision = {
      kind: "SelectCounter",
      player: 0,
      counterType: 1,
      count: 1,
      cards: [
        { code: 0, name: "", controller: 0, location: "MZONE", sequence: 0, currentCount: 2 },
      ],
    };
    expect(DuelDecisionSchema.safeParse(dec).success).toBe(true);
  });
});

describe("DuelDecisionSchema — invalid inputs rejected", () => {
  it("unknown kind is rejected", () => {
    expect(DuelDecisionSchema.safeParse({ kind: "Unknown" }).success).toBe(false);
  });

  it("missing required field is rejected", () => {
    expect(DuelDecisionSchema.safeParse({ kind: "SelectCard", player: 0 }).success).toBe(false);
  });

  it("invalid Attribute value rejected", () => {
    const bad = { kind: "AnnounceAttrib", player: 0, count: 1, available: ["NOT_REAL"] };
    expect(DuelDecisionSchema.safeParse(bad).success).toBe(false);
  });

  it("invalid Race value rejected", () => {
    const bad = { kind: "AnnounceRace", player: 0, count: 1, available: ["UNICORN"] };
    expect(DuelDecisionSchema.safeParse(bad).success).toBe(false);
  });

  it("invalid PositionCode rejected", () => {
    const bad = {
      kind: "SelectPosition",
      player: 0,
      card: VISIBLE_CARD,
      positions: ["faceup_sideways"],
    };
    expect(DuelDecisionSchema.safeParse(bad).success).toBe(false);
  });

  it("invalid IdleCommand action rejected", () => {
    const bad = { kind: "IdleCommand", action: "flip" };
    expect(DuelDecisionResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("SelectCard null indices (cancel) is accepted", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCard", indices: null };
    expect(DuelDecisionResponseSchema.safeParse(resp).success).toBe(true);
  });

  it("AnnounceCard code must be positive", () => {
    expect(DuelDecisionResponseSchema.safeParse({ kind: "AnnounceCard", code: 0 }).success).toBe(
      false,
    );
  });

  it("ChainPrompt null index (pass) is accepted", () => {
    const resp: DuelDecisionResponse = { kind: "ChainPrompt", index: null };
    expect(DuelDecisionResponseSchema.safeParse(resp).success).toBe(true);
  });
});

describe("DuelDecisionSchema — optional chain filter variants", () => {
  it("AnnounceCard with filter.kind=any is accepted", () => {
    const dec: DuelDecision = { kind: "AnnounceCard", player: 0, filter: { kind: "any" } };
    expect(DuelDecisionSchema.safeParse(dec).success).toBe(true);
  });

  it("AnnounceCard with filter.kind=codes is accepted", () => {
    const dec: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [49003716, 85215458] },
    };
    expect(DuelDecisionSchema.safeParse(dec).success).toBe(true);
  });

  it("AnnounceCard with unknown filter kind is rejected", () => {
    const bad = { kind: "AnnounceCard", player: 0, filter: { kind: "regex", pattern: ".*" } };
    expect(DuelDecisionSchema.safeParse(bad).success).toBe(false);
  });
});
