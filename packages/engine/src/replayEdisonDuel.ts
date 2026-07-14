// ---------------------------------------------------------------------------
// replayEdisonDuel — rehydrate an EdisonDuel from a response log.
//
// Extracted from a former EdisonDuel.replay() static method to keep the
// dependency direction one-way (createEdisonDuel → EdisonDuel), avoiding a
// createEdisonDuel ↔ EdisonDuel import cycle (arch:check no-circular).
// spike-d: same seed+decks+log replays to an identical logical state.
// ---------------------------------------------------------------------------

import type { EngineResponse } from "@yugioh-app/contracts";
import { createEdisonDuel } from "./createEdisonDuel.js";
import type { EdisonDuel, DeckLists } from "./EdisonDuel.js";

/**
 * Rehydrate from a response log (server-restart resume). Creates a fresh duel
 * with the same seed+decks, replays all responses, and returns the duel at the
 * same logical state.
 */
export async function replayEdisonDuel(
  seed: bigint | number,
  deck0: DeckLists,
  deck1: DeckLists,
  log: EngineResponse[],
): Promise<EdisonDuel> {
  const duel = await createEdisonDuel({ seed, deck0, deck1 });
  await duel.applyLog(log);
  return duel;
}
