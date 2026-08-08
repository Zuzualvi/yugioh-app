/**
 * responsePrompts — classify whether to offer a response window at a given prompt level.
 *
 * Design spec §11/§11b. The prompt level decides WHEN you are offered a window.
 * It is a separate mechanism from autoResolve (which answers on the player's behalf
 * only for exactly-one-legal-answer cases). See evaluator open question 4.
 *
 * Fail-safe rule (binding): if a decision cannot be classified from the available data,
 * shouldOfferWindow returns true. A wrong true costs a prompt; a wrong false silently
 * costs a duel. Never suppress a window you could not classify.
 */

import type { DuelDecision } from "@yugioh-app/contracts";

export type PromptLevel = "Minimal" | "Standard" | "Every window";

/**
 * Returns true if the player should be offered a response window for this decision
 * at the given prompt level.
 *
 * Classification is conservative: only returns false when we are certain the decision
 * represents an optional window that the player has opted out of at this level.
 *
 * Level semantics (from design spec §11):
 *   Minimal      — mandatory effects and certain triggers only
 *   Standard     — also summons, attacks, activations (default)
 *   Every window — all of the above plus phase changes, battle steps, etc.
 */
export function shouldOfferWindow(d: DuelDecision, level: PromptLevel): boolean {
  // Every window: always offer
  if (level === "Every window") return true;

  // Standard: offer for all recognisable response-window decision types.
  // Without additional context about what triggered the decision (e.g. whether
  // it is after a summon vs a phase change), we cannot safely classify further.
  // Fail-safe: return true.
  if (level === "Standard") return true;

  // Minimal: only mandatory effects and certain triggers.
  // The only decision type we can unambiguously classify as an optional window
  // from the decision data alone is a non-forced ChainPrompt — the player is
  // being asked "do you want to chain?" and forced=false means they may decline.
  // Everything else: fail-safe → true.
  if (level === "Minimal") {
    if (d.kind === "ChainPrompt" && d.forced === false) {
      return false; // Optional chain response — player opted for minimal
    }
    return true;
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
