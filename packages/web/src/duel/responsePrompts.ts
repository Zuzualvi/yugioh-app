/**
 * responsePrompts — classify whether to offer a response window at a given prompt level.
 *
 * Design spec §11/§11b. The prompt level decides WHEN you are offered a window.
 * It is a separate mechanism from autoResolve (which answers on the player's behalf
 * only for exactly-one-legal-answer cases). See evaluator open question 4.
 *
 * Fail-safe rule (binding): if a decision cannot be classified from the available data,
 * shouldOfferWindow returns true. A wrong true costs a prompt; a wrong false silently
 * costs a duel. Never suppress a window you cannot classify.
 *
 * Classification from events (most recent triggering event before the prompt):
 *
 *   Standard adds over Minimal:
 *     SUMMON / SPSUMMON / SET — summon context              → offer
 *     ATTACK                  — attack declaration context   → offer
 *     CHAINING                — activation/chain context     → offer
 *     CHAIN_END               — post-chain context           → offer
 *     TURN                    — turn change (before opponent ends turn) → offer
 *     PHASE                   — phase change (Every window only)       → suppress
 *     CHAIN_SOLVING / CHAIN_SOLVED — chain resolving (Every window)   → suppress
 *     BATTLE                  — battle step (Every window only)        → suppress
 *     MOVE / LP_CHANGE / HINT — unclassifiable context                 → fail-safe (true)
 *     no event                — unclassifiable                          → fail-safe (true)
 *
 *   Every window: always offer (no event classification needed).
 *
 *   Minimal: ChainPrompt forced=false → suppress; everything else → fail-safe (true).
 *   Even with the event context, Minimal cannot reliably distinguish mandatory triggers
 *   from optional ones beyond the forced flag on ChainPrompt.
 */

import type { DuelDecision, DuelEvent } from "@yugioh-app/contracts";

export type PromptLevel = "Minimal" | "Standard" | "Every window";

// Events that indicate a Standard-level window (summon, attack, activation contexts).
const STANDARD_TRIGGER_KINDS = new Set([
  "SUMMON",
  "SPSUMMON",
  "SET",
  "ATTACK",
  "CHAINING",
  "CHAIN_END",
  "TURN",
]);

// Events that indicate an Every-window-only context (phase change, chain resolution, battle step).
const EVERY_WINDOW_ONLY_KINDS = new Set(["PHASE", "CHAIN_SOLVING", "CHAIN_SOLVED", "BATTLE"]);

/**
 * Walk backwards through the event feed to find the most recent event that reveals
 * a trigger context. Returns null if no classifiable event is found.
 */
function lastTriggerEvent(events: DuelEvent[]): DuelEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]!;
    if (STANDARD_TRIGGER_KINDS.has(ev.kind) || EVERY_WINDOW_ONLY_KINDS.has(ev.kind)) {
      return ev;
    }
  }
  return null;
}

/**
 * Returns true if the player should be offered a response window for this decision
 * at the given prompt level.
 *
 * Classification is conservative: only returns false when we are certain the
 * decision represents an optional window that the player has opted out of at this level.
 * Everything unclassifiable returns true (fail-safe).
 */
export function shouldOfferWindow(
  d: DuelDecision,
  events: DuelEvent[],
  level: PromptLevel,
): boolean {
  // Every window: always offer
  if (level === "Every window") return true;

  if (level === "Standard") {
    const trigger = lastTriggerEvent(events);
    if (trigger === null) return true; // no classifiable context — fail-safe

    if (STANDARD_TRIGGER_KINDS.has(trigger.kind)) return true; // summon/attack/activation → offer
    if (EVERY_WINDOW_ONLY_KINDS.has(trigger.kind)) return false; // phase/resolution/battle → suppress

    // MOVE, LP_CHANGE, HINT, or any future kind — unclassifiable → fail-safe
    return true;
  }

  // Minimal: only mandatory effects and trigger effects.
  // The only decision type we can unambiguously classify as an optional window
  // from available data is a non-forced ChainPrompt.
  // Even with the event context, we cannot reliably distinguish mandatory from
  // optional triggers for SelectYesNo / SelectEffectYN etc. → fail-safe for those.
  if (level === "Minimal") {
    if (d.kind === "ChainPrompt" && d.forced === false) {
      return false; // Optional chain response — player opted for minimal interruptions
    }
    return true; // everything else: fail-safe
  }

  // Unclassifiable level — fail-safe
  return true;
}

/**
 * Returns the decline DuelDecisionResponse for a given decision, or null if the
 * decision has no decline path (and therefore cannot be suppressed).
 */
export function getDeclineResponse(
  d: DuelDecision,
): import("@yugioh-app/contracts").DuelDecisionResponse | null {
  switch (d.kind) {
    case "ChainPrompt":
      if (d.forced) return null;
      return { kind: "ChainPrompt", index: null };
    case "SelectCard":
      if (!d.cancelable) return null;
      return { kind: "SelectCard", indices: null };
    case "SelectTribute":
      if (!d.cancelable) return null;
      return { kind: "SelectTribute", indices: null };
    case "SelectEffectYN":
      return { kind: "SelectEffectYN", yes: false };
    case "SelectYesNo":
      return { kind: "SelectYesNo", yes: false };
    case "SelectUnselectCard":
      if (!d.cancelable) return null;
      return { kind: "SelectUnselectCard", index: null };
    default:
      return null;
  }
}
