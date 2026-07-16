// ---------------------------------------------------------------------------
// replayEdisonDuel — rehydrate an EdisonDuel from a typed response log.
//
// Creates a fresh duel with the same seed+decks, replays all responses via
// applyLog(), and returns the duel at the same logical state.
// ---------------------------------------------------------------------------

import type { DuelDecisionResponse } from "@yugioh-app/contracts";
import { createEdisonDuel } from "./createEdisonDuel.js";
import type { EdisonDuel, DeckLists } from "./EdisonDuel.js";

/**
 * Rehydrate from a typed response log (server-restart resume). Creates a fresh
 * duel with the same seed+decks, replays all responses, and returns the duel
 * at the same logical state.
 *
 * After replaying the log, advances the engine one step to reach the current
 * WAITING boundary — mirroring what createAndStart does — so that
 * getDecisionForSeat() returns the pending decision on the rehydrated engine.
 */
export async function replayEdisonDuel(
  seed: bigint | number,
  deck0: DeckLists,
  deck1: DeckLists,
  log: DuelDecisionResponse[],
): Promise<EdisonDuel> {
  const duel = await createEdisonDuel({ seed, deck0, deck1 });
  duel.applyLog(log);
  // Advance to the next WAITING boundary (or END) so pendingDecision is set.
  if (!duel.isEnded()) duel.step();
  return duel;
}
