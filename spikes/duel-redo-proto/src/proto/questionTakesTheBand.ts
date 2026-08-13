/**
 * questionTakesTheBand.ts — the auto-answer receipt's SUPERSESSION test.
 *
 * The receipt has no timer (ZUH-131 budget B1). Its cessation conditions are the
 * delta strip's: a question takes the dock band, the player acts, control leaves,
 * or the duel ends. This file answers only the first one.
 *
 * "A question takes the band" is narrower than "a decision arrived":
 *   · `IdleCommand` / `BattleCommand` ARM THE BOARD and are never a question
 *     panel — a receipt must survive the board re-arming, which is the state the
 *     player is returned to immediately after the client answers for them;
 *   · a decision the client answers for itself is a receipt, not a question.
 *
 * Getting that wrong makes the receipt vanish faster than the 2.4 s timer it
 * replaces, which is the opposite of what B1 asks for.
 */
import { mayAnswerWithoutAsking } from "./classify";
import type { DuelDecision } from "./types";

export function questionTakesTheBand(decision: DuelDecision | null | undefined): boolean {
  if (!decision) return false;
  if (decision.kind === "IdleCommand" || decision.kind === "BattleCommand") return false;
  return !mayAnswerWithoutAsking(decision);
}
