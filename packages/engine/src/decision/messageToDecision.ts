// ---------------------------------------------------------------------------
// messageToDecision — translate raw ocgcore pending messages → DuelDecision.
//
// Pure function. Exhaustive switch with compile-time never check.
// Decodes all bitmasks (position, race, attribute, field_mask) to named enums.
// Redacts hidden info: face-down cards and opponent's hand → code:0, name:"".
// ---------------------------------------------------------------------------

import type { Seat } from "@yugioh-app/contracts";
import type {
  DuelDecision,
  CardEntry,
  ActiveCardEntry,
  AttackEntry,
  ZoneEntry,
  LocationCode,
  PositionCode,
  Race,
  Attribute,
} from "@yugioh-app/contracts";
import type { RawEngineMessage } from "../types.js";
import { getCardName, resolveDescription } from "./cardName.js";

// ── Constants from ocgcore (avoid importing enum at runtime) ────────────────
const LOC = {
  DECK: 1,
  HAND: 2,
  MZONE: 4,
  SZONE: 8,
  GRAVE: 16,
  REMOVED: 32,
  EXTRA: 64,
  OVERLAY: 128,
  FZONE: 256,
  PZONE: 512,
} as const;

const POS = {
  FACEUP_ATTACK: 1,
  FACEDOWN_ATTACK: 2,
  FACEUP_DEFENSE: 4,
  FACEDOWN_DEFENSE: 8,
} as const;

const DECISION_TYPES = new Set([
  10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 132, 140, 141, 142, 143,
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function locationName(loc: number): LocationCode {
  switch (loc) {
    case LOC.DECK:
      return "DECK";
    case LOC.HAND:
      return "HAND";
    case LOC.MZONE:
      return "MZONE";
    case LOC.SZONE:
      return "SZONE";
    case LOC.GRAVE:
      return "GRAVE";
    case LOC.REMOVED:
      return "REMOVED";
    case LOC.EXTRA:
      return "EXTRA";
    case LOC.OVERLAY:
      return "OVERLAY";
    case LOC.FZONE:
      return "FZONE";
    case LOC.PZONE:
      return "PZONE";
    default:
      return "DECK"; // unknown — safe fallback
  }
}

function isHidden(controller: 0 | 1, location: number, position: number, seat: Seat): boolean {
  // Opponent's hand is always hidden
  if (controller !== seat && location === LOC.HAND) return true;
  // Face-down cards are hidden (FACEDOWN_ATTACK=2 or FACEDOWN_DEFENSE=8)
  if (position & (POS.FACEDOWN_ATTACK | POS.FACEDOWN_DEFENSE)) return true;
  return false;
}

function makeCardEntry(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number,
  seat: Seat,
): CardEntry {
  if (isHidden(controller, location, position, seat)) {
    return {
      code: 0,
      name: "",
      controller,
      location: locationName(location),
      sequence,
    };
  }
  return {
    code,
    name: getCardName(code),
    controller,
    location: locationName(location),
    sequence,
  };
}

function makeActiveCardEntry(
  code: number,
  controller: 0 | 1,
  location: number,
  sequence: number,
  position: number,
  description: bigint,
  seat: Seat,
): ActiveCardEntry {
  const base = makeCardEntry(code, controller, location, sequence, position, seat);
  return { ...base, description: resolveDescription(description) };
}

/** Decode a positions bitmask (OcgPosition composite) to an array of PositionCode. */
function decodePositionMask(mask: number): PositionCode[] {
  const out: PositionCode[] = [];
  if (mask & POS.FACEUP_ATTACK) out.push("faceup_attack");
  if (mask & POS.FACEDOWN_ATTACK) out.push("facedown_attack");
  if (mask & POS.FACEUP_DEFENSE) out.push("faceup_defense");
  if (mask & POS.FACEDOWN_DEFENSE) out.push("facedown_defense");
  return out;
}

/** Decode an OcgRace bitmask (bigint) to an array of Race names. */
function decodeRaceMask(available: bigint): Race[] {
  const out: Race[] = [];
  const pairs: [bigint, Race][] = [
    [1n, "WARRIOR"],
    [2n, "SPELLCASTER"],
    [4n, "FAIRY"],
    [8n, "FIEND"],
    [16n, "ZOMBIE"],
    [32n, "MACHINE"],
    [64n, "AQUA"],
    [128n, "PYRO"],
    [256n, "ROCK"],
    [512n, "WINGEDBEAST"],
    [1024n, "PLANT"],
    [2048n, "INSECT"],
    [4096n, "THUNDER"],
    [8192n, "DRAGON"],
    [16384n, "BEAST"],
    [32768n, "BEASTWARRIOR"],
    [65536n, "DINOSAUR"],
    [131072n, "FISH"],
    [262144n, "SEASERPENT"],
    [524288n, "REPTILE"],
    [1048576n, "PSYCHIC"],
    [2097152n, "DIVINE_BEAST"],
    [4194304n, "CREATORGOD"],
    [8388608n, "WYRM"],
    [16777216n, "CYBERSE"],
    [33554432n, "ILLUSION"],
  ];
  for (const [bit, name] of pairs) {
    if (available & bit) out.push(name);
  }
  return out;
}

/** Decode an OcgAttribute bitmask (number) to an array of Attribute names. */
function decodeAttributeMask(available: number): Attribute[] {
  const out: Attribute[] = [];
  if (available & 1) out.push("EARTH");
  if (available & 2) out.push("WATER");
  if (available & 4) out.push("FIRE");
  if (available & 8) out.push("WIND");
  if (available & 16) out.push("LIGHT");
  if (available & 32) out.push("DARK");
  if (available & 64) out.push("DIVINE");
  return out;
}

/**
 * Decode a SELECT_PLACE / SELECT_DISFIELD field_mask to available ZoneEntry[].
 *
 * Bit layout (per player P at shift = P * 16):
 *   bits 0-4  → MZONE[0..4]: bit=0 means available
 *   bits 8-12 → SZONE[0..4]: bit=0 means available
 */
function decodeFieldMask(fieldMask: number, messagingPlayer: 0 | 1): ZoneEntry[] {
  const zones: ZoneEntry[] = [];
  for (const p of [0, 1] as const) {
    const shift = p * 16;
    const mask = (fieldMask >> shift) & 0xffff;
    for (let s = 0; s < 5; s++) {
      if (!(mask & (1 << s))) {
        zones.push({ controller: p, location: "MZONE", sequence: s });
      }
    }
    for (let s = 0; s < 5; s++) {
      if (!(mask & (1 << (s + 8)))) {
        zones.push({ controller: p, location: "SZONE", sequence: s });
      }
    }
  }
  void messagingPlayer; // unused but part of the signature for future context
  return zones;
}

/** Find the primary decision message from the pending messages array. */
function findDecisionMessage(msgs: RawEngineMessage[]): RawEngineMessage {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (DECISION_TYPES.has(msgs[i]!.type)) return msgs[i]!;
  }
  // Should not happen — step() only calls this after a WAITING result.
  throw new Error("messageToDecision: no decision message found in pending messages");
}

// ── Type aliases for raw message payloads (cast from RawEngineMessage) ──────

type CardLoc = { code: number; controller: 0 | 1; location: number; sequence: number };
type CardLocPos = CardLoc & { position: number };
type CardLocActive = CardLoc & { description: bigint; client_mode: number };
type CardLocPosActive = CardLocPos & { description: bigint };
type CardLocAttack = CardLoc & { can_direct: boolean };
type CardLocTribute = CardLoc & { release_param: number };
type CardLocCounter = CardLoc & { count: number };
type CardLocSum = CardLoc & { amount: number };

function asCardLoc(x: unknown): CardLoc {
  return x as CardLoc;
}
function asCardLocPos(x: unknown): CardLocPos {
  return x as CardLocPos;
}
function asCardLocActive(x: unknown): CardLocActive {
  return x as CardLocActive;
}
function asCardLocPosActive(x: unknown): CardLocPosActive {
  return x as CardLocPosActive;
}
function asCardLocAttack(x: unknown): CardLocAttack {
  return x as CardLocAttack;
}
function asCardLocTribute(x: unknown): CardLocTribute {
  return x as CardLocTribute;
}
function asCardLocCounter(x: unknown): CardLocCounter {
  return x as CardLocCounter;
}
function asCardLocSum(x: unknown): CardLocSum {
  return x as CardLocSum;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Translate the raw pending messages from a WAITING step into a DuelDecision.
 *
 * @param rawPendingMessages - Messages from EdisonDuel.step() when status==="waiting".
 * @param seat - The seat that is on the clock (player whose turn it is to respond).
 */
export function messageToDecision(
  rawPendingMessages: RawEngineMessage[],
  seat: Seat,
): DuelDecision {
  const msg = findDecisionMessage(rawPendingMessages);
  const player = (msg["player"] as 0 | 1 | undefined) ?? seat;
  const type = msg.type;

  switch (type) {
    // ── SELECT_IDLECMD (11) ───────────────────────────────────────────────
    case 11: {
      const summons = ((msg["summons"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        // Hand cards for the turn player — always visible (position not in IdleCmd)
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      const specialSummons = ((msg["special_summons"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      const posChanges = ((msg["pos_changes"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocPos(c);
        return makeCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          loc.position ?? 0,
          seat,
        );
      });
      const monsterSets = ((msg["monster_sets"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      const spellSets = ((msg["spell_sets"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      const activates = ((msg["activates"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocActive(c);
        return makeActiveCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          0, // IdleCmd activates: face-up cards, no position needed for redaction
          loc.description,
          seat,
        );
      });
      return {
        kind: "IdleCommand",
        player,
        summons,
        specialSummons,
        posChanges,
        monsterSets,
        spellSets,
        activates,
        toBattlePhase: (msg["to_bp"] as boolean) ?? false,
        toEndPhase: (msg["to_ep"] as boolean) ?? false,
      };
    }

    // ── SELECT_BATTLECMD (10) ─────────────────────────────────────────────
    case 10: {
      const chains = ((msg["chains"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocActive(c);
        return makeActiveCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          0,
          loc.description,
          seat,
        );
      });
      const attacks = ((msg["attacks"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocAttack(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
          canDirectAttack: loc.can_direct,
        } satisfies AttackEntry;
      });
      return {
        kind: "BattleCommand",
        player,
        chains,
        attacks,
        toMainPhase2: (msg["to_m2"] as boolean) ?? false,
        toEndPhase: (msg["to_ep"] as boolean) ?? false,
      };
    }

    // ── SELECT_CHAIN (16) ─────────────────────────────────────────────────
    case 16: {
      const forced = (msg["forced"] as boolean) ?? false;
      const selects = ((msg["selects"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocPosActive(c);
        return makeActiveCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          loc.position ?? 0,
          loc.description,
          seat,
        );
      });
      return {
        kind: "ChainPrompt",
        player,
        forced,
        selects,
      };
    }

    // ── SELECT_EFFECTYN (12) ──────────────────────────────────────────────
    case 12: {
      const code = (msg["code"] as number) ?? 0;
      const controller = (msg["controller"] as 0 | 1) ?? 0;
      const location = (msg["location"] as number) ?? 0;
      const sequence = (msg["sequence"] as number) ?? 0;
      const position = (msg["position"] as number) ?? 0;
      const description = (msg["description"] as bigint) ?? 0n;
      const card = makeCardEntry(code, controller, location, sequence, position, seat);
      return {
        kind: "SelectEffectYN",
        player,
        card,
        description: resolveDescription(description),
      };
    }

    // ── SELECT_YESNO (13) ─────────────────────────────────────────────────
    case 13: {
      const description = (msg["description"] as bigint) ?? 0n;
      return {
        kind: "SelectYesNo",
        player,
        description: resolveDescription(description),
      };
    }

    // ── SELECT_OPTION (14) ────────────────────────────────────────────────
    case 14: {
      const options = ((msg["options"] as bigint[]) ?? []).map((d) => resolveDescription(d));
      return {
        kind: "SelectOption",
        player,
        options,
      };
    }

    // ── SELECT_CARD (15) ──────────────────────────────────────────────────
    case 15: {
      const selects = ((msg["selects"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocPos(c);
        return makeCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          loc.position ?? 0,
          seat,
        );
      });
      return {
        kind: "SelectCard",
        player,
        cards: selects,
        min: (msg["min"] as number) ?? 0,
        max: (msg["max"] as number) ?? 1,
        cancelable: (msg["can_cancel"] as boolean) ?? false,
      };
    }

    // ── SELECT_PLACE (18) → SelectZone ────────────────────────────────────
    case 18: {
      const fieldMask = (msg["field_mask"] as number) ?? 0;
      const count = (msg["count"] as number) ?? 1;
      const zones = decodeFieldMask(fieldMask, player);
      return {
        kind: "SelectZone",
        player,
        count,
        zones,
      };
    }

    // ── SELECT_POSITION (19) ──────────────────────────────────────────────
    case 19: {
      const code = (msg["code"] as number) ?? 0;
      const positions = decodePositionMask((msg["positions"] as number) ?? 0);
      return {
        kind: "SelectPosition",
        player,
        card: {
          code,
          name: getCardName(code),
          controller: player,
          location: "MZONE", // position selection is always for a card being summoned
          sequence: 0,
        },
        positions,
      };
    }

    // ── SELECT_TRIBUTE (20) ───────────────────────────────────────────────
    case 20: {
      const selects = ((msg["selects"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocTribute(c);
        return makeCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          0, // tributes are face-up on field
          seat,
        );
      });
      return {
        kind: "SelectTribute",
        player,
        cards: selects,
        min: (msg["min"] as number) ?? 0,
        max: (msg["max"] as number) ?? 1,
        cancelable: (msg["can_cancel"] as boolean) ?? false,
      };
    }

    // ── SORT_CHAIN (21) ───────────────────────────────────────────────────
    case 21: {
      const cards = ((msg["cards"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      return {
        kind: "SortChain",
        player,
        cards,
      };
    }

    // ── SELECT_COUNTER (22) ───────────────────────────────────────────────
    case 22: {
      const cards = ((msg["cards"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLocCounter(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
          currentCount: loc.count,
        };
      });
      return {
        kind: "SelectCounter",
        player,
        counterType: (msg["counter_type"] as number) ?? 0,
        count: (msg["count"] as number) ?? 0,
        cards,
      };
    }

    // ── SELECT_SUM (23) ───────────────────────────────────────────────────
    case 23: {
      const toSumEntry = (c: unknown) => {
        const loc = asCardLocSum(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
          amount: loc.amount,
        };
      };
      const must = ((msg["selects_must"] as unknown[]) ?? []).map(toSumEntry);
      const optional = ((msg["selects"] as unknown[]) ?? []).map(toSumEntry);
      return {
        kind: "SelectSum",
        player,
        amount: (msg["amount"] as number) ?? 0,
        must,
        optional,
        min: (msg["min"] as number) ?? 0,
        max: (msg["max"] as number) ?? 1,
      };
    }

    // ── SELECT_DISFIELD (24) ──────────────────────────────────────────────
    case 24: {
      const fieldMask = (msg["field_mask"] as number) ?? 0;
      const count = (msg["count"] as number) ?? 1;
      const zones = decodeFieldMask(fieldMask, player);
      return {
        kind: "SelectDisfield",
        player,
        count,
        zones,
      };
    }

    // ── SORT_CARD (25) ────────────────────────────────────────────────────
    case 25: {
      const cards = ((msg["cards"] as unknown[]) ?? []).map((c) => {
        const loc = asCardLoc(c);
        return {
          code: loc.code,
          name: getCardName(loc.code),
          controller: loc.controller,
          location: locationName(loc.location),
          sequence: loc.sequence,
        } satisfies CardEntry;
      });
      return {
        kind: "SortCard",
        player,
        cards,
      };
    }

    // ── SELECT_UNSELECT_CARD (26) ─────────────────────────────────────────
    case 26: {
      const toCardEntry = (c: unknown) => {
        const loc = asCardLocPos(c);
        return makeCardEntry(
          loc.code,
          loc.controller,
          loc.location,
          loc.sequence,
          loc.position ?? 0,
          seat,
        );
      };
      const selectCards = ((msg["select_cards"] as unknown[]) ?? []).map(toCardEntry);
      const unselectCards = ((msg["unselect_cards"] as unknown[]) ?? []).map(toCardEntry);
      return {
        kind: "SelectUnselectCard",
        player,
        selectCards,
        unselectCards,
        min: (msg["min"] as number) ?? 0,
        max: (msg["max"] as number) ?? 1,
        canFinish: (msg["can_finish"] as boolean) ?? false,
        cancelable: (msg["can_cancel"] as boolean) ?? false,
      };
    }

    // ── ANNOUNCE_RACE (140) ───────────────────────────────────────────────
    case 140: {
      const available = decodeRaceMask((msg["available"] as bigint) ?? 0n);
      return {
        kind: "AnnounceRace",
        player,
        count: (msg["count"] as number) ?? 1,
        available,
      };
    }

    // ── ANNOUNCE_ATTRIB (141) ─────────────────────────────────────────────
    case 141: {
      const available = decodeAttributeMask((msg["available"] as number) ?? 0);
      return {
        kind: "AnnounceAttrib",
        player,
        count: (msg["count"] as number) ?? 1,
        available,
      };
    }

    // ── ANNOUNCE_CARD (142) ───────────────────────────────────────────────
    case 142: {
      // Opcode stack is complex; default to {kind:"any"} (re-validated server-side).
      return {
        kind: "AnnounceCard",
        player,
        filter: { kind: "any" },
      };
    }

    // ── ANNOUNCE_NUMBER (143) ─────────────────────────────────────────────
    case 143: {
      const options = ((msg["options"] as bigint[]) ?? []).map((v) => Number(v));
      return {
        kind: "AnnounceNumber",
        player,
        options,
      };
    }

    // ── RockPaperScissors (132) — should never reach here (auto-resolved) ─
    case 132: {
      // If somehow surfaced, return a ChainPrompt-like decision as a safe fallback.
      // The engine adapter auto-resolves RPS in step() before calling messageToDecision.
      const never: never = type as never;
      void never;
      throw new Error("messageToDecision: RPS (132) should be auto-resolved, not surfaced");
    }

    default: {
      // Compile-time exhaustiveness check.
      const _exhaustive: never = type as never;
      void _exhaustive;
      throw new Error(`messageToDecision: unhandled decision message type ${String(type)}`);
    }
  }
}
