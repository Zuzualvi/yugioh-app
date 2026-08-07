// ---------------------------------------------------------------------------
// decision unit tests — messageToDecision, responseToOcgResponse,
// validateDecisionResponse — using catalog-shaped fixtures.
//
// Covers: all variants, with extra focus on the [unverified-live] kinds:
//   SelectSum (23), SelectCounter (22), SelectDisfield (24),
//   SortCard (25), SortChain (21).
//
// No WASM required — pure function tests only.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { messageToDecision } from "./messageToDecision.js";
import { responseToOcgResponse } from "./responseToOcgResponse.js";
import { validateDecisionResponse } from "./validateDecisionResponse.js";
import type { RawEngineMessage } from "../types.js";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import { OcgResponseType, SelectIdleCMDAction, SelectBattleCMDAction } from "ocgcore-wasm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function msg(type: number, player: 0 | 1, extra: Record<string, unknown> = {}): RawEngineMessage {
  return { type, name: "TEST", player, ...extra };
}

// ── SELECT_IDLECMD (11) ───────────────────────────────────────────────────────

describe("messageToDecision — IdleCommand (11)", () => {
  it("decodes basic IdleCommand with summons and activates", () => {
    const raw = msg(11, 0, {
      summons: [{ code: 2118022, controller: 0, location: 2, sequence: 0 }],
      special_summons: [],
      pos_changes: [],
      monster_sets: [{ code: 2118022, controller: 0, location: 2, sequence: 0 }],
      spell_sets: [],
      activates: [],
      to_bp: false,
      to_ep: true,
      shuffle: false,
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "IdleCommand" }>;
    expect(d.kind).toBe("IdleCommand");
    expect(d.player).toBe(0);
    expect(d.summons).toHaveLength(1);
    expect(d.summons[0]!.code).toBe(2118022);
    expect(typeof d.summons[0]!.name).toBe("string");
    expect(d.summons[0]!.controller).toBe(0);
    expect(d.summons[0]!.location).toBe("HAND");
    expect(d.toBattlePhase).toBe(false);
    expect(d.toEndPhase).toBe(true);
  });

  it("includes card name from DB for own hand card", () => {
    // Treeborn Frog (12538374) — should get name from texts table if DB available
    const raw = msg(11, 0, {
      summons: [{ code: 12538374, controller: 0, location: 2, sequence: 0 }],
      special_summons: [],
      pos_changes: [],
      monster_sets: [],
      spell_sets: [],
      activates: [],
      to_bp: false,
      to_ep: true,
      shuffle: false,
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "IdleCommand" }>;
    // Own hand card — code is NOT redacted
    expect(d.summons[0]!.code).toBe(12538374);
    // Name is a string (may be empty if DB not available in test env)
    expect(typeof d.summons[0]!.name).toBe("string");
  });
});

// ── SELECT_BATTLECMD (10) ─────────────────────────────────────────────────────

describe("messageToDecision — BattleCommand (10)", () => {
  it("decodes BattleCommand with attack and phase transitions", () => {
    const raw = msg(10, 1, {
      chains: [],
      attacks: [{ code: 1184620, controller: 1, location: 4, sequence: 0, can_direct: false }],
      to_m2: true,
      to_ep: true,
    });
    const d = messageToDecision([raw], 1) as Extract<DuelDecision, { kind: "BattleCommand" }>;
    expect(d.kind).toBe("BattleCommand");
    expect(d.player).toBe(1);
    expect(d.attacks).toHaveLength(1);
    expect(d.attacks[0]!.code).toBe(1184620);
    expect(d.attacks[0]!.canDirectAttack).toBe(false);
    expect(d.toMainPhase2).toBe(true);
    expect(d.toEndPhase).toBe(true);
  });
});

// ── SELECT_CHAIN (16) ─────────────────────────────────────────────────────────

describe("messageToDecision — ChainPrompt (16)", () => {
  it("decodes empty non-forced chain window", () => {
    const raw = msg(16, 0, {
      spe_count: 0,
      forced: false,
      hint_timing: 0,
      hint_timing_other: 0,
      selects: [],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "ChainPrompt" }>;
    expect(d.kind).toBe("ChainPrompt");
    expect(d.forced).toBe(false);
    expect(d.selects).toHaveLength(0);
  });

  it("decodes forced chain with a selectable card", () => {
    const raw = msg(16, 0, {
      forced: true,
      selects: [
        {
          code: 12345,
          controller: 0,
          location: 8,
          sequence: 0,
          position: 5,
          description: 0n,
          client_mode: 0,
        },
      ],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "ChainPrompt" }>;
    expect(d.kind).toBe("ChainPrompt");
    expect(d.forced).toBe(true);
    expect(d.selects).toHaveLength(1);
    expect(d.selects[0]!.code).toBe(12345);
  });
});

// ── SELECT_EFFECTYN (12) ──────────────────────────────────────────────────────

describe("messageToDecision — SelectEffectYN (12)", () => {
  it("decodes SelectEffectYN for Treeborn Frog", () => {
    const raw = msg(12, 0, {
      code: 12538374,
      controller: 0,
      location: 16,
      sequence: 0,
      position: 5,
      description: 0n,
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectEffectYN" }>;
    expect(d.kind).toBe("SelectEffectYN");
    expect(d.card.code).toBe(12538374);
    expect(d.card.location).toBe("GRAVE");
    expect(typeof d.description).toBe("string");
  });

  it("redacts face-down cards (facedown position)", () => {
    const raw = msg(12, 0, {
      code: 99999,
      controller: 1,
      location: 4,
      sequence: 0,
      position: 2, // FACEDOWN_ATTACK
      description: 0n,
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectEffectYN" }>;
    expect(d.card.code).toBe(0);
    expect(d.card.name).toBe("");
  });
});

// ── SELECT_YESNO (13) ────────────────────────────────────────────────────────

describe("messageToDecision — SelectYesNo (13)", () => {
  it("decodes SelectYesNo with a description", () => {
    const raw = msg(13, 0, { description: 22547315818497n });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectYesNo" }>;
    expect(d.kind).toBe("SelectYesNo");
    expect(typeof d.description).toBe("string");
  });
});

// ── SELECT_OPTION (14) ───────────────────────────────────────────────────────

describe("messageToDecision — SelectOption (14)", () => {
  it("decodes Enemy Controller options", () => {
    const raw = msg(14, 0, {
      options: [102807698931713n, 102807698931714n],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectOption" }>;
    expect(d.kind).toBe("SelectOption");
    expect(d.options).toHaveLength(2);
    expect(typeof d.options[0]).toBe("string");
    expect(typeof d.options[1]).toBe("string");
  });
});

// ── SELECT_CARD (15) ─────────────────────────────────────────────────────────

describe("messageToDecision — SelectCard (15)", () => {
  it("decodes face-up card selection", () => {
    const raw = msg(15, 1, {
      can_cancel: true,
      min: 1,
      max: 1,
      selects: [{ code: 32864, controller: 0, location: 4, sequence: 0, position: 5 }],
    });
    const d = messageToDecision([raw], 1) as Extract<DuelDecision, { kind: "SelectCard" }>;
    expect(d.kind).toBe("SelectCard");
    expect(d.cards).toHaveLength(1);
    expect(d.cards[0]!.code).toBe(32864);
    expect(d.cancelable).toBe(true);
    expect(d.min).toBe(1);
    expect(d.max).toBe(1);
  });

  it("redacts face-down cards in selection", () => {
    const raw = msg(15, 0, {
      can_cancel: false,
      min: 1,
      max: 1,
      selects: [{ code: 99999, controller: 1, location: 4, sequence: 0, position: 8 }], // FACEDOWN_DEFENSE
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectCard" }>;
    expect(d.cards[0]!.code).toBe(0);
    expect(d.cards[0]!.name).toBe("");
  });
});

// ── SELECT_PLACE (18) → SelectZone ───────────────────────────────────────────

describe("messageToDecision — SelectZone (18)", () => {
  it("decodes field_mask to available zones", () => {
    // field_mask = 4294967264 = 0xFFFFFFE0
    // player 0: mask >> 0 = 0xFFE0 = bits 0 clear → MZONE[0] available
    const raw = msg(18, 0, { count: 1, field_mask: 4294967264 });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectZone" }>;
    expect(d.kind).toBe("SelectZone");
    expect(d.count).toBe(1);
    expect(Array.isArray(d.zones)).toBe(true);
    // MZONE[0] for player 0 should be available
    const mzone0 = d.zones.find(
      (z) => z.controller === 0 && z.location === "MZONE" && z.sequence === 0,
    );
    expect(mzone0).toBeDefined();
  });
});

// ── SELECT_POSITION (19) ─────────────────────────────────────────────────────

describe("messageToDecision — SelectPosition (19)", () => {
  it("decodes positions bitmask 5 to faceup_attack and faceup_defense", () => {
    const raw = msg(19, 0, { code: 60800381, positions: 5 });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectPosition" }>;
    expect(d.kind).toBe("SelectPosition");
    expect(d.card.code).toBe(60800381);
    expect(d.positions).toContain("faceup_attack");
    expect(d.positions).toContain("faceup_defense");
    expect(d.positions).not.toContain("facedown_attack");
    expect(d.positions).not.toContain("facedown_defense");
  });
});

// ── SELECT_TRIBUTE (20) ──────────────────────────────────────────────────────

describe("messageToDecision — SelectTribute (20)", () => {
  it("decodes tribute selection", () => {
    const raw = msg(20, 0, {
      can_cancel: true,
      min: 1,
      max: 1,
      selects: [{ code: 32864, controller: 0, location: 4, sequence: 0, release_param: 1 }],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectTribute" }>;
    expect(d.kind).toBe("SelectTribute");
    expect(d.cards).toHaveLength(1);
    expect(d.cards[0]!.code).toBe(32864);
    expect(d.cancelable).toBe(true);
  });
});

// ── SELECT_UNSELECT_CARD (26) ────────────────────────────────────────────────

describe("messageToDecision — SelectUnselectCard (26)", () => {
  it("decodes synchro material selection", () => {
    const raw = msg(26, 0, {
      can_finish: false,
      can_cancel: true,
      min: 1,
      max: 1,
      select_cards: [{ code: 63977008, controller: 0, location: 4, sequence: 0, position: 5 }],
      unselect_cards: [],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectUnselectCard" }>;
    expect(d.kind).toBe("SelectUnselectCard");
    expect(d.selectCards).toHaveLength(1);
    expect(d.selectCards[0]!.code).toBe(63977008);
    expect(d.unselectCards).toHaveLength(0);
    expect(d.canFinish).toBe(false);
    expect(d.cancelable).toBe(true);
  });
});

// ── ANNOUNCE_RACE (140) ───────────────────────────────────────────────────────

describe("messageToDecision — AnnounceRace (140)", () => {
  it("decodes race bitmask 67108863n (all Edison-era races)", () => {
    const raw = msg(140, 0, { count: 1, available: 67108863n });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "AnnounceRace" }>;
    expect(d.kind).toBe("AnnounceRace");
    expect(d.count).toBe(1);
    expect(d.available).toContain("WARRIOR");
    expect(d.available).toContain("DRAGON");
    expect(d.available).toContain("SPELLCASTER");
  });
});

// ── ANNOUNCE_ATTRIB (141) ─────────────────────────────────────────────────────

describe("messageToDecision — AnnounceAttrib (141)", () => {
  it("decodes attribute bitmask 127 (all attributes)", () => {
    const raw = msg(141, 0, { count: 1, available: 127 });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "AnnounceAttrib" }>;
    expect(d.kind).toBe("AnnounceAttrib");
    expect(d.available).toContain("EARTH");
    expect(d.available).toContain("DARK");
    expect(d.available).toContain("DIVINE");
    expect(d.available).toHaveLength(7);
  });
});

// ── ANNOUNCE_CARD (142) ───────────────────────────────────────────────────────

describe("messageToDecision — AnnounceCard (142)", () => {
  it("defaults to filter kind:any", () => {
    const raw = msg(142, 0, {
      opcodes: [75505728n, 4611687126528950272n, 4611686048492158976n],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "AnnounceCard" }>;
    expect(d.kind).toBe("AnnounceCard");
    expect(d.filter.kind).toBe("any");
  });
});

// ── ANNOUNCE_NUMBER (143) ────────────────────────────────────────────────────

describe("messageToDecision — AnnounceNumber (143)", () => {
  it("decodes LP multiples for Wall of Revealing Light", () => {
    const raw = msg(143, 0, {
      options: [1000n, 2000n, 3000n, 4000n, 5000n, 6000n, 7000n, 8000n],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "AnnounceNumber" }>;
    expect(d.kind).toBe("AnnounceNumber");
    expect(d.options).toHaveLength(8);
    expect(d.options[0]).toBe(1000);
    expect(d.options[7]).toBe(8000);
  });
});

// ── [unverified-live] SORT_CHAIN (21) ────────────────────────────────────────

describe("messageToDecision — SortChain (21) [unverified-live]", () => {
  it("decodes SortChain with card list", () => {
    const raw = msg(21, 0, {
      cards: [
        { code: 11111, controller: 0, location: 8, sequence: 0 },
        { code: 22222, controller: 1, location: 8, sequence: 1 },
      ],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SortChain" }>;
    expect(d.kind).toBe("SortChain");
    expect(d.cards).toHaveLength(2);
    expect(d.cards[0]!.code).toBe(11111);
    expect(d.cards[1]!.code).toBe(22222);
  });
});

// ── [unverified-live] SELECT_COUNTER (22) ────────────────────────────────────

describe("messageToDecision — SelectCounter (22) [unverified-live]", () => {
  it("decodes SelectCounter with counter cards", () => {
    const raw = msg(22, 0, {
      counter_type: 5,
      count: 2,
      cards: [
        { code: 33333, controller: 0, location: 4, sequence: 0, count: 3 },
        { code: 44444, controller: 0, location: 4, sequence: 1, count: 1 },
      ],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectCounter" }>;
    expect(d.kind).toBe("SelectCounter");
    expect(d.counterType).toBe(5);
    expect(d.count).toBe(2);
    expect(d.cards).toHaveLength(2);
    expect(d.cards[0]!.currentCount).toBe(3);
    expect(d.cards[1]!.currentCount).toBe(1);
  });
});

// ── [unverified-live] SELECT_SUM (23) ────────────────────────────────────────

describe("messageToDecision — SelectSum (23) [unverified-live]", () => {
  it("decodes SelectSum with must and optional arrays", () => {
    const raw = msg(23, 0, {
      select_max: 3,
      amount: 6,
      min: 1,
      max: 3,
      selects_must: [{ code: 55555, controller: 0, location: 2, sequence: 0, amount: 4 }],
      selects: [
        { code: 66666, controller: 0, location: 2, sequence: 1, amount: 2 },
        { code: 77777, controller: 0, location: 2, sequence: 2, amount: 2 },
      ],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectSum" }>;
    expect(d.kind).toBe("SelectSum");
    expect(d.amount).toBe(6);
    expect(d.must).toHaveLength(1);
    expect(d.must[0]!.amount).toBe(4);
    expect(d.optional).toHaveLength(2);
    expect(d.min).toBe(1);
    expect(d.max).toBe(3);
  });
});

// ── [unverified-live] SELECT_DISFIELD (24) ───────────────────────────────────

describe("messageToDecision — SelectDisfield (24) [unverified-live]", () => {
  it("decodes SelectDisfield from field_mask", () => {
    const raw = msg(24, 0, { count: 1, field_mask: 4294967264 });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SelectDisfield" }>;
    expect(d.kind).toBe("SelectDisfield");
    expect(d.count).toBe(1);
    expect(Array.isArray(d.zones)).toBe(true);
    expect(d.zones.length).toBeGreaterThan(0);
  });
});

// ── [unverified-live] SORT_CARD (25) ─────────────────────────────────────────

describe("messageToDecision — SortCard (25) [unverified-live]", () => {
  it("decodes SortCard with card list", () => {
    const raw = msg(25, 0, {
      cards: [
        { code: 88888, controller: 0, location: 2, sequence: 0 },
        { code: 99999, controller: 0, location: 2, sequence: 1 },
      ],
    });
    const d = messageToDecision([raw], 0) as Extract<DuelDecision, { kind: "SortCard" }>;
    expect(d.kind).toBe("SortCard");
    expect(d.cards).toHaveLength(2);
  });
});

// ── responseToOcgResponse tests ───────────────────────────────────────────────

describe("responseToOcgResponse", () => {
  it("IdleCommand toEP → SELECT_IDLECMD action=TO_EP", () => {
    const resp: DuelDecisionResponse = { kind: "IdleCommand", action: "toEP", index: null };
    const decision: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_IDLECMD);
    expect((r as { action: number }).action).toBe(SelectIdleCMDAction.TO_EP);
  });

  it("BattleCommand attack → SELECT_BATTLECMD action=SELECT_BATTLE", () => {
    const resp: DuelDecisionResponse = { kind: "BattleCommand", action: "attack", index: 0 };
    const decision: DuelDecision = {
      kind: "BattleCommand",
      player: 1,
      chains: [],
      attacks: [
        {
          code: 1184620,
          name: "Luster Dragon",
          controller: 1,
          location: "MZONE",
          sequence: 0,
          canDirectAttack: false,
        },
      ],
      toMainPhase2: true,
      toEndPhase: true,
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_BATTLECMD);
    expect((r as { action: number }).action).toBe(SelectBattleCMDAction.SELECT_BATTLE);
    expect((r as { index: number }).index).toBe(0);
  });

  it("ChainPrompt null index → SELECT_CHAIN pass", () => {
    const resp: DuelDecisionResponse = { kind: "ChainPrompt", index: null };
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_CHAIN);
    expect((r as { index: null }).index).toBeNull();
  });

  it("SelectCard indices → SELECT_CARD with indicies (sic misspelling)", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCard", indices: [0] };
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [{ code: 32864, name: "Blue-Eyes", controller: 0, location: "MZONE", sequence: 0 }],
      min: 1,
      max: 1,
      cancelable: false,
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_CARD);
    expect((r as { indicies: number[] }).indicies).toEqual([0]);
  });

  it("SelectZone converts indices to places via decision zones array", () => {
    const decision: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      count: 1,
      zones: [
        { controller: 0, location: "MZONE", sequence: 0 },
        { controller: 0, location: "SZONE", sequence: 1 },
      ],
    };
    const resp: DuelDecisionResponse = { kind: "SelectZone", indices: [0] };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_PLACE);
    const places = (r as { places: { player: number; location: number; sequence: number }[] })
      .places;
    expect(places).toHaveLength(1);
    expect(places[0]!.player).toBe(0);
    expect(places[0]!.location).toBe(4); // MZONE = 4
    expect(places[0]!.sequence).toBe(0);
  });

  it("SelectPosition faceup_attack → OcgPosition 1", () => {
    const resp: DuelDecisionResponse = { kind: "SelectPosition", position: "faceup_attack" };
    const decision: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: { code: 1, name: "", controller: 0, location: "MZONE", sequence: 0 },
      positions: ["faceup_attack", "faceup_defense"],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_POSITION);
    expect((r as { position: number }).position).toBe(1);
  });

  it("AnnounceRace WARRIOR → OcgRace 1n", () => {
    const resp: DuelDecisionResponse = { kind: "AnnounceRace", races: ["WARRIOR"] };
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["WARRIOR", "DRAGON"],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.ANNOUNCE_RACE);
    expect((r as { races: bigint[] }).races).toEqual([1n]);
  });

  it("AnnounceAttrib EARTH → OcgAttribute 1", () => {
    const resp: DuelDecisionResponse = { kind: "AnnounceAttrib", attributes: ["EARTH"] };
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["EARTH", "DARK"],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.ANNOUNCE_ATTRIB);
    expect((r as { attributes: number[] }).attributes).toEqual([1]);
  });

  it("AnnounceNumber valueIndex → SELECT_NUMBER value=valueIndex", () => {
    const resp: DuelDecisionResponse = { kind: "AnnounceNumber", valueIndex: 2 };
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [1000, 2000, 3000],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.ANNOUNCE_NUMBER);
    expect((r as { value: number }).value).toBe(2);
  });

  it("SortChain null order → SORT_CARD order=null", () => {
    const resp: DuelDecisionResponse = { kind: "SortChain", order: null };
    const decision: DuelDecision = {
      kind: "SortChain",
      player: 0,
      cards: [
        { code: 1, name: "", controller: 0, location: "SZONE", sequence: 0 },
        { code: 2, name: "", controller: 1, location: "SZONE", sequence: 0 },
      ],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SORT_CARD);
    expect((r as { order: null }).order).toBeNull();
  });

  it("SelectCounter counters array → SELECT_COUNTER", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCounter", counters: [2, 0] };
    const decision: DuelDecision = {
      kind: "SelectCounter",
      player: 0,
      counterType: 5,
      count: 2,
      cards: [
        {
          code: 1,
          name: "",
          controller: 0,
          location: "MZONE",
          sequence: 0,
          currentCount: 3,
        },
        {
          code: 2,
          name: "",
          controller: 0,
          location: "MZONE",
          sequence: 1,
          currentCount: 1,
        },
      ],
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_COUNTER);
    expect((r as { counters: number[] }).counters).toEqual([2, 0]);
  });

  it("SelectSum indices → SELECT_SUM indicies (sic)", () => {
    const resp: DuelDecisionResponse = { kind: "SelectSum", indices: [0, 2] };
    const decision: DuelDecision = {
      kind: "SelectSum",
      player: 0,
      amount: 4,
      must: [{ code: 1, name: "", controller: 0, location: "HAND", sequence: 0, amount: 2 }],
      optional: [
        { code: 2, name: "", controller: 0, location: "HAND", sequence: 1, amount: 2 },
        { code: 3, name: "", controller: 0, location: "HAND", sequence: 2, amount: 2 },
      ],
      min: 1,
      max: 3,
    };
    const r = responseToOcgResponse(resp, decision);
    expect(r.type).toBe(OcgResponseType.SELECT_SUM);
    expect((r as { indicies: number[] }).indicies).toEqual([0, 2]);
  });
});

// ── validateDecisionResponse tests ────────────────────────────────────────────

describe("validateDecisionResponse", () => {
  it("kind mismatch returns ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectYesNo", yes: true };
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: { code: 1, name: "", controller: 0, location: "GRAVE", sequence: 0 },
      description: "",
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/kind mismatch/i);
  });

  it("IdleCommand summon with valid index → ok:true", () => {
    const resp: DuelDecisionResponse = { kind: "IdleCommand", action: "summon", index: 0 };
    const decision: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [{ code: 1, name: "", controller: 0, location: "HAND", sequence: 0 }],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    expect(validateDecisionResponse(resp, decision).ok).toBe(true);
  });

  it("IdleCommand summon with out-of-range index → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "IdleCommand", action: "summon", index: 5 };
    const decision: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [{ code: 1, name: "", controller: 0, location: "HAND", sequence: 0 }],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("ChainPrompt pass when forced → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "ChainPrompt", index: null };
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: true,
      selects: [
        { code: 1, name: "", controller: 0, location: "HAND", sequence: 0, description: "" },
      ],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pass.*forced/i);
  });

  it("SelectCard cancel when cancelable=false → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCard", indices: null };
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [{ code: 1, name: "", controller: 0, location: "MZONE", sequence: 0 }],
      min: 1,
      max: 1,
      cancelable: false,
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("SelectCard with wrong count (too few) → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCard", indices: [] };
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [
        { code: 1, name: "", controller: 0, location: "MZONE", sequence: 0 },
        { code: 2, name: "", controller: 0, location: "MZONE", sequence: 1 },
      ],
      min: 1,
      max: 2,
      cancelable: false,
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/min/i);
  });

  it("SelectOption out-of-range index → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectOption", index: 5 };
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["opt1", "opt2"],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("SelectPosition invalid position → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectPosition", position: "facedown_attack" };
    const decision: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: { code: 1, name: "", controller: 0, location: "MZONE", sequence: 0 },
      positions: ["faceup_attack", "faceup_defense"],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("AnnounceRace wrong count → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "AnnounceRace", races: ["WARRIOR", "DRAGON"] };
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["WARRIOR", "DRAGON"],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("AnnounceRace unavailable race → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "AnnounceRace", races: ["PSYCHIC"] };
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["WARRIOR", "DRAGON"],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("SelectCounter wrong total → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectCounter", counters: [1, 0] };
    const decision: DuelDecision = {
      kind: "SelectCounter",
      player: 0,
      counterType: 1,
      count: 3,
      cards: [
        { code: 1, name: "", controller: 0, location: "MZONE", sequence: 0, currentCount: 5 },
        { code: 2, name: "", controller: 0, location: "MZONE", sequence: 1, currentCount: 5 },
      ],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/total/i);
  });

  it("SelectZone wrong count → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SelectZone", indices: [0, 1] };
    const decision: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      count: 1,
      zones: [
        { controller: 0, location: "MZONE", sequence: 0 },
        { controller: 0, location: "MZONE", sequence: 1 },
      ],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("SortCard invalid permutation → ok:false", () => {
    const resp: DuelDecisionResponse = { kind: "SortCard", order: [0, 0] }; // duplicate
    const decision: DuelDecision = {
      kind: "SortCard",
      player: 0,
      cards: [
        { code: 1, name: "", controller: 0, location: "DECK", sequence: 0 },
        { code: 2, name: "", controller: 0, location: "DECK", sequence: 1 },
      ],
    };
    const r = validateDecisionResponse(resp, decision);
    expect(r.ok).toBe(false);
  });

  it("SortCard null order → ok:true (default order)", () => {
    const resp: DuelDecisionResponse = { kind: "SortCard", order: null };
    const decision: DuelDecision = {
      kind: "SortCard",
      player: 0,
      cards: [
        { code: 1, name: "", controller: 0, location: "DECK", sequence: 0 },
        { code: 2, name: "", controller: 0, location: "DECK", sequence: 1 },
      ],
    };
    expect(validateDecisionResponse(resp, decision).ok).toBe(true);
  });
});

// ── C8.1: SELECT_PLACE empty-indices guard ────────────────────────────────────

describe("responseToOcgResponse — C8.1 SELECT_PLACE empty-indices guard", () => {
  const selectZoneDecision: DuelDecision = {
    kind: "SelectZone",
    player: 0,
    count: 1,
    zones: [
      { controller: 0, location: "MZONE", sequence: 0 },
      { controller: 0, location: "MZONE", sequence: 1 },
    ],
  };

  it("SelectZone with empty indices throws (C8.1 — engine hang prevention)", () => {
    const resp: DuelDecisionResponse = { kind: "SelectZone", indices: [] };
    expect(() => responseToOcgResponse(resp, selectZoneDecision)).toThrow(/empty/i);
  });

  it("SelectZone with non-empty indices succeeds", () => {
    const resp: DuelDecisionResponse = { kind: "SelectZone", indices: [0] };
    expect(() => responseToOcgResponse(resp, selectZoneDecision)).not.toThrow();
  });

  const selectDisfieldDecision: DuelDecision = {
    kind: "SelectDisfield",
    player: 0,
    count: 1,
    zones: [{ controller: 0, location: "SZONE", sequence: 0 }],
  };

  it("SelectDisfield with empty indices throws (C8.1)", () => {
    const resp: DuelDecisionResponse = { kind: "SelectDisfield", indices: [] };
    expect(() => responseToOcgResponse(resp, selectDisfieldDecision)).toThrow(/empty/i);
  });

  it("SelectDisfield with non-empty indices succeeds", () => {
    const resp: DuelDecisionResponse = { kind: "SelectDisfield", indices: [0] };
    expect(() => responseToOcgResponse(resp, selectDisfieldDecision)).not.toThrow();
  });
});
