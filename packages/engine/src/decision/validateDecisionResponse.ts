// ---------------------------------------------------------------------------
// validateDecisionResponse — pure validator for DuelDecisionResponse.
//
// Checks:
//   1. kind parity (response.kind === decision.kind)
//   2. indices in range (0-based into the decision's candidate arrays)
//   3. counts within [min, max]
//   4. cancel/pass only when allowed (cancelable / canFinish flags)
// Returns {ok:true} | {ok:false, error:string}. Never throws.
// ---------------------------------------------------------------------------

import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

type ValidationResult = { ok: true } | { ok: false; error: string };

function err(msg: string): ValidationResult {
  return { ok: false, error: msg };
}
const OK: ValidationResult = { ok: true };

export function validateDecisionResponse(
  resp: DuelDecisionResponse,
  decision: DuelDecision,
): ValidationResult {
  // 1. Kind parity
  if (resp.kind !== decision.kind) {
    return err(`kind mismatch: response is "${resp.kind}", decision is "${decision.kind}"`);
  }

  switch (resp.kind) {
    // ── IdleCommand ───────────────────────────────────────────────────────
    case "IdleCommand": {
      const d = decision as Extract<DuelDecision, { kind: "IdleCommand" }>;
      const { action, index } = resp;
      if (action === "summon") {
        if (index === null || index < 0 || index >= d.summons.length) {
          return err(
            `IdleCommand summon: index ${String(index)} out of range (0..${d.summons.length - 1})`,
          );
        }
      } else if (action === "specialSummon") {
        if (index === null || index < 0 || index >= d.specialSummons.length) {
          return err(`IdleCommand specialSummon: index ${String(index)} out of range`);
        }
      } else if (action === "posChange") {
        if (index === null || index < 0 || index >= d.posChanges.length) {
          return err(`IdleCommand posChange: index ${String(index)} out of range`);
        }
      } else if (action === "monsterSet") {
        if (index === null || index < 0 || index >= d.monsterSets.length) {
          return err(`IdleCommand monsterSet: index ${String(index)} out of range`);
        }
      } else if (action === "spellSet") {
        if (index === null || index < 0 || index >= d.spellSets.length) {
          return err(`IdleCommand spellSet: index ${String(index)} out of range`);
        }
      } else if (action === "activate") {
        if (index === null || index < 0 || index >= d.activates.length) {
          return err(`IdleCommand activate: index ${String(index)} out of range`);
        }
      } else if (action === "toBP") {
        if (!d.toBattlePhase) return err("IdleCommand toBP: not available");
      } else if (action === "toEP") {
        if (!d.toEndPhase) return err("IdleCommand toEP: not available");
      }
      // shuffle is always available if in the list
      return OK;
    }

    // ── BattleCommand ─────────────────────────────────────────────────────
    case "BattleCommand": {
      const d = decision as Extract<DuelDecision, { kind: "BattleCommand" }>;
      const { action, index } = resp;
      if (action === "chain") {
        if (index === null || index < 0 || index >= d.chains.length) {
          return err(`BattleCommand chain: index ${String(index)} out of range`);
        }
      } else if (action === "attack") {
        if (index === null || index < 0 || index >= d.attacks.length) {
          return err(`BattleCommand attack: index ${String(index)} out of range`);
        }
      } else if (action === "toM2") {
        if (!d.toMainPhase2) return err("BattleCommand toM2: not available");
      } else if (action === "toEP") {
        if (!d.toEndPhase) return err("BattleCommand toEP: not available");
      }
      return OK;
    }

    // ── ChainPrompt ───────────────────────────────────────────────────────
    case "ChainPrompt": {
      const d = decision as Extract<DuelDecision, { kind: "ChainPrompt" }>;
      if (resp.index === null) {
        // Passing: only allowed if not forced
        if (d.forced) return err("ChainPrompt: cannot pass when forced=true");
        return OK;
      }
      if (resp.index < 0 || resp.index >= d.selects.length) {
        return err(`ChainPrompt: index ${resp.index} out of range (0..${d.selects.length - 1})`);
      }
      return OK;
    }

    // ── SelectEffectYN ────────────────────────────────────────────────────
    case "SelectEffectYN": {
      // yes or no — both always valid
      return OK;
    }

    // ── SelectYesNo ───────────────────────────────────────────────────────
    case "SelectYesNo": {
      return OK;
    }

    // ── SelectOption ──────────────────────────────────────────────────────
    case "SelectOption": {
      const d = decision as Extract<DuelDecision, { kind: "SelectOption" }>;
      if (resp.index < 0 || resp.index >= d.options.length) {
        return err(`SelectOption: index ${resp.index} out of range (0..${d.options.length - 1})`);
      }
      return OK;
    }

    // ── SelectCard ────────────────────────────────────────────────────────
    case "SelectCard": {
      const d = decision as Extract<DuelDecision, { kind: "SelectCard" }>;
      if (resp.indices === null) {
        if (!d.cancelable) return err("SelectCard: cancel not allowed (cancelable=false)");
        return OK;
      }
      for (const idx of resp.indices) {
        if (idx < 0 || idx >= d.cards.length) {
          return err(`SelectCard: index ${idx} out of range (0..${d.cards.length - 1})`);
        }
      }
      const count = resp.indices.length;
      if (count < d.min) return err(`SelectCard: selected ${count} but min is ${d.min}`);
      if (count > d.max) return err(`SelectCard: selected ${count} but max is ${d.max}`);
      return OK;
    }

    // ── SelectTribute ─────────────────────────────────────────────────────
    case "SelectTribute": {
      const d = decision as Extract<DuelDecision, { kind: "SelectTribute" }>;
      if (resp.indices === null) {
        if (!d.cancelable) return err("SelectTribute: cancel not allowed");
        return OK;
      }
      for (const idx of resp.indices) {
        if (idx < 0 || idx >= d.cards.length) {
          return err(`SelectTribute: index ${idx} out of range`);
        }
      }
      const count = resp.indices.length;
      if (count < d.min) return err(`SelectTribute: selected ${count} but min is ${d.min}`);
      if (count > d.max) return err(`SelectTribute: selected ${count} but max is ${d.max}`);
      return OK;
    }

    // ── SelectZone ────────────────────────────────────────────────────────
    case "SelectZone": {
      const d = decision as Extract<DuelDecision, { kind: "SelectZone" }>;
      for (const idx of resp.indices) {
        if (idx < 0 || idx >= d.zones.length) {
          return err(`SelectZone: index ${idx} out of range (0..${d.zones.length - 1})`);
        }
      }
      if (resp.indices.length !== d.count) {
        return err(`SelectZone: must select exactly ${d.count} zones, got ${resp.indices.length}`);
      }
      return OK;
    }

    // ── SelectPosition ────────────────────────────────────────────────────
    case "SelectPosition": {
      const d = decision as Extract<DuelDecision, { kind: "SelectPosition" }>;
      if (!d.positions.includes(resp.position)) {
        return err(
          `SelectPosition: "${resp.position}" not in available positions [${d.positions.join(", ")}]`,
        );
      }
      return OK;
    }

    // ── SelectUnselectCard ────────────────────────────────────────────────
    case "SelectUnselectCard": {
      const d = decision as Extract<DuelDecision, { kind: "SelectUnselectCard" }>;
      if (resp.index === null) {
        // null = finish or cancel
        if (!d.canFinish && !d.cancelable) {
          return err(
            "SelectUnselectCard: cannot finish/cancel (canFinish=false, cancelable=false)",
          );
        }
        return OK;
      }
      const totalCards = d.selectCards.length + d.unselectCards.length;
      if (resp.index < 0 || resp.index >= totalCards) {
        return err(`SelectUnselectCard: index ${resp.index} out of range (0..${totalCards - 1})`);
      }
      return OK;
    }

    // ── AnnounceRace ──────────────────────────────────────────────────────
    case "AnnounceRace": {
      const d = decision as Extract<DuelDecision, { kind: "AnnounceRace" }>;
      if (resp.races.length !== d.count) {
        return err(
          `AnnounceRace: must declare exactly ${d.count} race(s), got ${resp.races.length}`,
        );
      }
      for (const race of resp.races) {
        if (!d.available.includes(race)) {
          return err(`AnnounceRace: "${race}" is not in the available races`);
        }
      }
      return OK;
    }

    // ── AnnounceAttrib ────────────────────────────────────────────────────
    case "AnnounceAttrib": {
      const d = decision as Extract<DuelDecision, { kind: "AnnounceAttrib" }>;
      if (resp.attributes.length !== d.count) {
        return err(
          `AnnounceAttrib: must declare exactly ${d.count} attribute(s), got ${resp.attributes.length}`,
        );
      }
      for (const attr of resp.attributes) {
        if (!d.available.includes(attr)) {
          return err(`AnnounceAttrib: "${attr}" is not in the available attributes`);
        }
      }
      return OK;
    }

    // ── AnnounceCard ──────────────────────────────────────────────────────
    case "AnnounceCard": {
      const d = decision as Extract<DuelDecision, { kind: "AnnounceCard" }>;
      if (resp.code <= 0) return err("AnnounceCard: code must be a positive integer");
      if (d.filter.kind === "codes") {
        if (!d.filter.codes.includes(resp.code)) {
          return err(`AnnounceCard: code ${resp.code} not in allowed filter`);
        }
      }
      // kind:"any" → any positive code is valid; engine re-validates
      return OK;
    }

    // ── AnnounceNumber ────────────────────────────────────────────────────
    case "AnnounceNumber": {
      const d = decision as Extract<DuelDecision, { kind: "AnnounceNumber" }>;
      if (resp.valueIndex < 0 || resp.valueIndex >= d.options.length) {
        return err(
          `AnnounceNumber: valueIndex ${resp.valueIndex} out of range (0..${d.options.length - 1})`,
        );
      }
      return OK;
    }

    // ── SortChain ─────────────────────────────────────────────────────────
    case "SortChain": {
      const d = decision as Extract<DuelDecision, { kind: "SortChain" }>;
      if (resp.order === null) return OK; // null = default order
      if (resp.order.length !== d.cards.length) {
        return err(
          `SortChain: order length ${resp.order.length} !== cards length ${d.cards.length}`,
        );
      }
      const sorted = [...resp.order].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i) return err(`SortChain: order is not a valid permutation`);
      }
      return OK;
    }

    // ── SelectCounter ─────────────────────────────────────────────────────
    case "SelectCounter": {
      const d = decision as Extract<DuelDecision, { kind: "SelectCounter" }>;
      if (resp.counters.length !== d.cards.length) {
        return err(
          `SelectCounter: counters array length ${resp.counters.length} !== cards length ${d.cards.length}`,
        );
      }
      const total = resp.counters.reduce((s, c) => s + c, 0);
      if (total !== d.count) {
        return err(`SelectCounter: total counters ${total} !== required ${d.count}`);
      }
      for (let i = 0; i < resp.counters.length; i++) {
        const max = d.cards[i]!.currentCount;
        if (resp.counters[i]! > max) {
          return err(
            `SelectCounter: card[${i}] has ${max} counters, cannot take ${resp.counters[i]}`,
          );
        }
      }
      return OK;
    }

    // ── SelectSum ─────────────────────────────────────────────────────────
    case "SelectSum": {
      const d = decision as Extract<DuelDecision, { kind: "SelectSum" }>;
      const allCards = [...d.must, ...d.optional];
      for (const idx of resp.indices) {
        if (idx < 0 || idx >= allCards.length) {
          return err(`SelectSum: index ${idx} out of range`);
        }
      }
      const count = resp.indices.length;
      if (count < d.min) return err(`SelectSum: selected ${count} but min is ${d.min}`);
      if (count > d.max) return err(`SelectSum: selected ${count} but max is ${d.max}`);
      return OK;
    }

    // ── SelectDisfield ────────────────────────────────────────────────────
    case "SelectDisfield": {
      const d = decision as Extract<DuelDecision, { kind: "SelectDisfield" }>;
      for (const idx of resp.indices) {
        if (idx < 0 || idx >= d.zones.length) {
          return err(`SelectDisfield: index ${idx} out of range`);
        }
      }
      if (resp.indices.length !== d.count) {
        return err(
          `SelectDisfield: must select exactly ${d.count} zones, got ${resp.indices.length}`,
        );
      }
      return OK;
    }

    // ── SortCard ──────────────────────────────────────────────────────────
    case "SortCard": {
      const d = decision as Extract<DuelDecision, { kind: "SortCard" }>;
      if (resp.order === null) return OK;
      if (resp.order.length !== d.cards.length) {
        return err(
          `SortCard: order length ${resp.order.length} !== cards length ${d.cards.length}`,
        );
      }
      const sorted = [...resp.order].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i) return err(`SortCard: order is not a valid permutation`);
      }
      return OK;
    }

    // ── Compile-time exhaustiveness guard ─────────────────────────────────
    default: {
      const _exhaustive: never = resp;
      void _exhaustive;
      return err(
        `validateDecisionResponse: unknown kind "${String((resp as DuelDecisionResponse).kind)}"`,
      );
    }
  }
}
