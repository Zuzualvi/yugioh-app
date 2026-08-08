/**
 * autoResolve — pure function implementing the §15 auto-resolve register.
 *
 * Returns a DuelDecisionResponse when exactly one legal answer exists and the
 * player preference (chooseZones) allows auto-answering. Returns null otherwise.
 *
 * NEVER auto-answers: IdleCommand, BattleCommand, SelectYesNo, SelectEffectYN,
 * AnnounceCard, AnnounceNumber, or any decision with min !== max.
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §15 and §16.
 */

import type { Attribute, DuelDecision, DuelDecisionResponse, Race } from "@yugioh-app/contracts";

export interface AutoResolvePrefs {
  /** When false (default), SelectZone is auto-answered by choosing the leftmost zone. */
  chooseZones: boolean;
}

/**
 * Computes a DuelDecisionResponse if the decision should be auto-answered,
 * or null if the player must be asked.
 *
 * This function is pure: it reads only its arguments and returns a value.
 * It never has side effects.
 */
export function autoAnswer(d: DuelDecision, prefs: AutoResolvePrefs): DuelDecisionResponse | null {
  switch (d.kind) {
    // ── Never auto-answered ─────────────────────────────────────────────────
    case "IdleCommand":
    case "BattleCommand":
    case "SelectYesNo":
    case "SelectEffectYN":
    case "AnnounceCard":
    case "AnnounceNumber":
      return null;

    // ── SelectZone §15 ──────────────────────────────────────────────────────
    case "SelectZone": {
      if (d.zones.length === 0) return null;
      if (d.zones.length === 1) {
        // Exactly one legal zone — no real choice exists.
        return { kind: "SelectZone", indices: [0] };
      }
      if (!prefs.chooseZones) {
        // CEO product call: default to leftmost zone when player has not
        // opted in to zone selection. See §16.B for the recorded contradiction.
        // When zones.length > d.count the engine is not restricting placement
        // (more options than needed = free placement). Auto-answer then.
        // When zones.length === d.count the engine may be restricting to exactly
        // those zones — we still auto-answer (leftmost).
        // The only time we must NOT auto-answer is when zones.length < what would
        // naturally be available — but we cannot compute "natural" here without
        // the board snapshot. Conservative: always auto-answer when chooseZones is off.
        return { kind: "SelectZone", indices: [0] };
      }
      return null;
    }

    // ── SelectPosition §15 ──────────────────────────────────────────────────
    case "SelectPosition": {
      if (d.positions.length === 1) {
        return { kind: "SelectPosition", position: d.positions[0]! };
      }
      return null;
    }

    // ── SelectTribute §15 ───────────────────────────────────────────────────
    case "SelectTribute": {
      // Auto-answer when min === max === cards.length (no real choice of WHICH to tribute).
      // Even when cancelable, cancel stays reachable via the intent ribbon (§16.A).
      if (d.min === d.max && d.min === d.cards.length && d.cards.length > 0) {
        return {
          kind: "SelectTribute",
          indices: d.cards.map((_, i) => i),
        };
      }
      return null;
    }

    // ── ChainPrompt §15 ────────────────────────────────────────────────────
    case "ChainPrompt": {
      // Auto-answer when forced AND exactly one select.
      if (d.forced && d.selects.length === 1) {
        return { kind: "ChainPrompt", index: 0 };
      }
      return null;
    }

    // ── SelectOption §15 ───────────────────────────────────────────────────
    case "SelectOption": {
      if (d.options.length === 1) {
        return { kind: "SelectOption", index: 0 };
      }
      return null;
    }

    // ── AnnounceRace / AnnounceAttrib §15 ──────────────────────────────────
    case "AnnounceRace": {
      if (d.count === 1 && d.available.length === 1) {
        return { kind: "AnnounceRace", races: [d.available[0] as Race] };
      }
      return null;
    }

    case "AnnounceAttrib": {
      if (d.count === 1 && d.available.length === 1) {
        return { kind: "AnnounceAttrib", attributes: [d.available[0] as Attribute] };
      }
      return null;
    }

    // ── SelectCard §15 ─────────────────────────────────────────────────────
    case "SelectCard": {
      // Auto-answer when min === max === cards.length AND not cancelable.
      // If cancelable: §16.A says auto-answer the selection; the ribbon's cancel
      // button still maps to the cancel response — no legal answer is lost.
      if (d.min === d.max && d.min === d.cards.length && d.cards.length > 0 && !d.cancelable) {
        return { kind: "SelectCard", indices: d.cards.map((_, i) => i) };
      }
      return null;
    }

    // ── SelectUnselectCard — NEVER auto-answered ────────────────────────────
    case "SelectUnselectCard":
      return null;

    // ── Rare variants — never auto-answered ────────────────────────────────
    case "SelectSum":
    case "SelectCounter":
    case "SelectDisfield":
    case "SortCard":
    case "SortChain":
      return null;

    default:
      return null;
  }
}

/**
 * Returns a human-readable summary of what was auto-answered, past tense.
 * Used for AutoAnswerReceipt.summary.
 */
export function autoAnswerSummary(d: DuelDecision, r: DuelDecisionResponse): string {
  if (r.kind === "SelectZone") {
    return "Zone — placed automatically";
  }
  if (r.kind === "SelectPosition" && d.kind === "SelectPosition") {
    const pos = r.position;
    const labels: Record<string, string> = {
      faceup_attack: "Face-up Attack Position",
      facedown_attack: "Face-down Attack Position",
      faceup_defense: "Face-up Defense Position",
      facedown_defense: "Face-down Defense Position",
    };
    return labels[pos] ?? pos;
  }
  if (r.kind === "SelectTribute" && d.kind === "SelectTribute") {
    const names = d.cards.map((c) => c.name || `Card #${c.code}`);
    return names.length === 1
      ? `Tributed ${names[0]}`
      : `Tributed ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  if (r.kind === "ChainPrompt" && d.kind === "ChainPrompt" && d.selects.length === 1) {
    return `Chained ${d.selects[0]!.name || "card"} (forced)`;
  }
  if (r.kind === "SelectOption" && d.kind === "SelectOption") {
    return `Selected: ${d.options[0] ?? "option"}`;
  }
  if (r.kind === "SelectCard" && d.kind === "SelectCard") {
    const names = d.cards.map((c) => c.name || `Card #${c.code}`);
    return `Selected ${names.join(", ")}`;
  }
  if (r.kind === "AnnounceRace") {
    return `Declared Type: ${r.races.join(", ")}`;
  }
  if (r.kind === "AnnounceAttrib") {
    return `Declared Attribute: ${r.attributes.join(", ")}`;
  }
  return "Auto-answered";
}

/**
 * Returns the reason code for the AutoAnswerReceipt.
 */
export function autoAnswerReason(
  d: DuelDecision,
  prefs: AutoResolvePrefs,
): "only-one-legal-answer" | "engine-unrestricted-placement" {
  if (d.kind === "SelectZone" && d.zones.length > 1 && !prefs.chooseZones) {
    return "engine-unrestricted-placement";
  }
  return "only-one-legal-answer";
}
