// ---------------------------------------------------------------------------
// responseToOcgResponse — translate DuelDecisionResponse → OcgResponse.
//
// Pure function. Exhaustive over all 20 DuelDecisionResponse variants.
// Uses the pendingDecision to look up zone indices for SelectZone/SelectDisfield.
// ---------------------------------------------------------------------------

import type { OcgResponse } from "ocgcore-wasm";
import { OcgResponseType, SelectIdleCMDAction, SelectBattleCMDAction } from "ocgcore-wasm";
import type { DuelDecisionResponse, DuelDecision } from "@yugioh-app/contracts";

// ── OcgLocation numeric values (avoids importing the full enum) ──────────────
const MZONE = 4;
const SZONE = 8;
const FZONE = 256;

function locationToOcg(loc: "MZONE" | "SZONE" | "FZONE"): number {
  switch (loc) {
    case "MZONE":
      return MZONE;
    case "SZONE":
      return SZONE;
    case "FZONE":
      return FZONE;
  }
}

// ── Race name → OcgRace bigint ───────────────────────────────────────────────
const RACE_TO_OCG: Record<string, bigint> = {
  WARRIOR: 1n,
  SPELLCASTER: 2n,
  FAIRY: 4n,
  FIEND: 8n,
  ZOMBIE: 16n,
  MACHINE: 32n,
  AQUA: 64n,
  PYRO: 128n,
  ROCK: 256n,
  WINGEDBEAST: 512n,
  PLANT: 1024n,
  INSECT: 2048n,
  THUNDER: 4096n,
  DRAGON: 8192n,
  BEAST: 16384n,
  BEASTWARRIOR: 32768n,
  DINOSAUR: 65536n,
  FISH: 131072n,
  SEASERPENT: 262144n,
  REPTILE: 524288n,
  PSYCHIC: 1048576n,
  DIVINE_BEAST: 2097152n,
  CREATORGOD: 4194304n,
  WYRM: 8388608n,
  CYBERSE: 16777216n,
  ILLUSION: 33554432n,
};

// ── Attribute name → OcgAttribute number ────────────────────────────────────
const ATTRIB_TO_OCG: Record<string, number> = {
  EARTH: 1,
  WATER: 2,
  FIRE: 4,
  WIND: 8,
  LIGHT: 16,
  DARK: 32,
  DIVINE: 64,
};

// ── PositionCode → OcgPosition number ───────────────────────────────────────
const POS_TO_OCG: Record<string, number> = {
  faceup_attack: 1,
  facedown_attack: 2,
  faceup_defense: 4,
  facedown_defense: 8,
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Translate a DuelDecisionResponse into an OcgResponse for ocgcore.
 *
 * @param resp - The response from the player.
 * @param pendingDecision - The current DuelDecision (needed to look up zones by index).
 */
export function responseToOcgResponse(
  resp: DuelDecisionResponse,
  pendingDecision: DuelDecision,
): OcgResponse {
  switch (resp.kind) {
    // ── IdleCommand ───────────────────────────────────────────────────────
    case "IdleCommand": {
      const actionMap: Record<string, SelectIdleCMDAction> = {
        summon: SelectIdleCMDAction.SELECT_SUMMON,
        specialSummon: SelectIdleCMDAction.SELECT_SPECIAL_SUMMON,
        posChange: SelectIdleCMDAction.SELECT_POS_CHANGE,
        monsterSet: SelectIdleCMDAction.SELECT_MONSTER_SET,
        spellSet: SelectIdleCMDAction.SELECT_SPELL_SET,
        activate: SelectIdleCMDAction.SELECT_ACTIVATE,
        toBP: SelectIdleCMDAction.TO_BP,
        toEP: SelectIdleCMDAction.TO_EP,
        shuffle: SelectIdleCMDAction.SHUFFLE,
      };
      return {
        type: OcgResponseType.SELECT_IDLECMD,
        action: actionMap[resp.action] ?? SelectIdleCMDAction.TO_EP,
        index: resp.index,
      };
    }

    // ── BattleCommand ─────────────────────────────────────────────────────
    case "BattleCommand": {
      const actionMap: Record<string, SelectBattleCMDAction> = {
        chain: SelectBattleCMDAction.SELECT_CHAIN,
        attack: SelectBattleCMDAction.SELECT_BATTLE,
        toM2: SelectBattleCMDAction.TO_M2,
        toEP: SelectBattleCMDAction.TO_EP,
      };
      return {
        type: OcgResponseType.SELECT_BATTLECMD,
        action: actionMap[resp.action] ?? SelectBattleCMDAction.TO_EP,
        index: resp.index,
      };
    }

    // ── ChainPrompt ───────────────────────────────────────────────────────
    case "ChainPrompt": {
      return {
        type: OcgResponseType.SELECT_CHAIN,
        index: resp.index,
      };
    }

    // ── SelectEffectYN ────────────────────────────────────────────────────
    case "SelectEffectYN": {
      return {
        type: OcgResponseType.SELECT_EFFECTYN,
        yes: resp.yes,
      };
    }

    // ── SelectYesNo ───────────────────────────────────────────────────────
    case "SelectYesNo": {
      return {
        type: OcgResponseType.SELECT_YESNO,
        yes: resp.yes,
      };
    }

    // ── SelectOption ──────────────────────────────────────────────────────
    case "SelectOption": {
      return {
        type: OcgResponseType.SELECT_OPTION,
        index: resp.index,
      };
    }

    // ── SelectCard ────────────────────────────────────────────────────────
    case "SelectCard": {
      // Note: ocgcore-wasm uses the misspelling "indicies".
      return {
        type: OcgResponseType.SELECT_CARD,
        indicies: resp.indices,
      };
    }

    // ── SelectTribute ─────────────────────────────────────────────────────
    case "SelectTribute": {
      return {
        type: OcgResponseType.SELECT_TRIBUTE,
        indicies: resp.indices,
      };
    }

    // ── SelectZone ────────────────────────────────────────────────────────
    case "SelectZone": {
      if (pendingDecision.kind !== "SelectZone") {
        throw new Error("responseToOcgResponse: pending decision is not SelectZone");
      }
      const places = resp.indices.map((idx) => {
        const zone = pendingDecision.zones[idx];
        if (!zone) throw new Error(`SelectZone: index ${idx} out of range`);
        return {
          player: zone.controller,
          location: locationToOcg(zone.location) as import("ocgcore-wasm").OcgLocation,
          sequence: zone.sequence,
        };
      });
      return {
        type: OcgResponseType.SELECT_PLACE,
        places,
      };
    }

    // ── SelectPosition ────────────────────────────────────────────────────
    case "SelectPosition": {
      const posValue = POS_TO_OCG[resp.position] ?? 1;
      return {
        type: OcgResponseType.SELECT_POSITION,
        position: posValue as import("ocgcore-wasm").OcgPosition,
      };
    }

    // ── SelectUnselectCard ────────────────────────────────────────────────
    case "SelectUnselectCard": {
      return {
        type: OcgResponseType.SELECT_UNSELECT_CARD,
        index: resp.index,
      };
    }

    // ── AnnounceRace ──────────────────────────────────────────────────────
    case "AnnounceRace": {
      const races = resp.races.map((r) => (RACE_TO_OCG[r] ?? 1n) as import("ocgcore-wasm").OcgRace);
      return {
        type: OcgResponseType.ANNOUNCE_RACE,
        races,
      };
    }

    // ── AnnounceAttrib ────────────────────────────────────────────────────
    case "AnnounceAttrib": {
      const attributes = resp.attributes.map(
        (a) => (ATTRIB_TO_OCG[a] ?? 1) as import("ocgcore-wasm").OcgAttribute,
      );
      return {
        type: OcgResponseType.ANNOUNCE_ATTRIB,
        attributes,
      };
    }

    // ── AnnounceCard ──────────────────────────────────────────────────────
    case "AnnounceCard": {
      return {
        type: OcgResponseType.ANNOUNCE_CARD,
        card: resp.code,
      };
    }

    // ── AnnounceNumber ────────────────────────────────────────────────────
    case "AnnounceNumber": {
      return {
        type: OcgResponseType.ANNOUNCE_NUMBER,
        value: resp.valueIndex,
      };
    }

    // ── SortChain ─────────────────────────────────────────────────────────
    case "SortChain": {
      return {
        type: OcgResponseType.SORT_CARD,
        order: resp.order,
      };
    }

    // ── SelectCounter ─────────────────────────────────────────────────────
    case "SelectCounter": {
      return {
        type: OcgResponseType.SELECT_COUNTER,
        counters: resp.counters,
      };
    }

    // ── SelectSum ─────────────────────────────────────────────────────────
    case "SelectSum": {
      return {
        type: OcgResponseType.SELECT_SUM,
        indicies: resp.indices,
      };
    }

    // ── SelectDisfield ────────────────────────────────────────────────────
    case "SelectDisfield": {
      if (pendingDecision.kind !== "SelectDisfield") {
        throw new Error("responseToOcgResponse: pending decision is not SelectDisfield");
      }
      const places = resp.indices.map((idx) => {
        const zone = pendingDecision.zones[idx];
        if (!zone) throw new Error(`SelectDisfield: index ${idx} out of range`);
        return {
          player: zone.controller,
          location: locationToOcg(zone.location) as import("ocgcore-wasm").OcgLocation,
          sequence: zone.sequence,
        };
      });
      return {
        type: OcgResponseType.SELECT_DISFIELD,
        places,
      };
    }

    // ── SortCard ──────────────────────────────────────────────────────────
    case "SortCard": {
      return {
        type: OcgResponseType.SORT_CARD,
        order: resp.order,
      };
    }

    // ── Compile-time exhaustiveness guard ─────────────────────────────────
    default: {
      const _exhaustive: never = resp;
      void _exhaustive;
      throw new Error(
        `responseToOcgResponse: unhandled kind ${String((resp as DuelDecisionResponse).kind)}`,
      );
    }
  }
}
