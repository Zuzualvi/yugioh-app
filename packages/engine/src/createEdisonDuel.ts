// ---------------------------------------------------------------------------
// createEdisonDuel — factory for the public EdisonDuel API.
//
// Loads the custom ocgcore WASM, creates the duel with EDISON_FLAGS, and
// adds all cards from both decks to the engine's initial state.
// ---------------------------------------------------------------------------

import { OcgLocation, OcgPosition } from "ocgcore-wasm";
import { EDISON_FLAGS } from "./edisonFlags.js";
import { loadEdisonCore } from "./coreFactory.js";
import { getCard } from "./cardLoader.js";
import { getScript } from "./scriptLoader.js";
import { EdisonDuel, type CreateEdisonDuelOpts } from "./EdisonDuel.js";

/**
 * Create a new EdisonDuel, ready to step().
 *
 * @throws If the custom WASM is not present (run build-wasm.sh first).
 * @throws If card DB is not populated (run card-data pipeline first).
 */
export async function createEdisonDuel(opts: CreateEdisonDuelOpts): Promise<EdisonDuel> {
  const { seed, deck0, deck1 } = opts;
  const lib = await loadEdisonCore();

  const seedBig = typeof seed === "bigint" ? seed : BigInt(seed);
  // Seed is a Xoshiro256** 4-element state; we use [seed, 0, 0, 0] for a simple seed.
  const seedState: [bigint, bigint, bigint, bigint] = [seedBig, 0n, 0n, 0n];

  const handle = lib.createDuel({
    flags: EDISON_FLAGS,
    seed: seedState,
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader: (code: number) => getCard(code),
    scriptReader: (name: string) => getScript(name),
    errorHandler: (_type: unknown, text: string) => {
      // Log engine errors without crashing — some are informational.
      console.error("[ocgcore error]", text);
    },
  });

  if (!handle) throw new Error("createDuel returned null — check card DB + WASM.");

  // Add main deck cards (seat 0 → team 0, seat 1 → team 1)
  for (const [teamIdx, deck] of [deck0, deck1].entries()) {
    const team = teamIdx as 0 | 1;
    for (const code of deck.main) {
      lib.duelNewCard(handle, {
        code,
        team,
        duelist: 0,
        controller: team,
        location: OcgLocation.DECK,
        sequence: 0,
        position: OcgPosition.FACEDOWN,
      });
    }
    for (const code of deck.extra) {
      lib.duelNewCard(handle, {
        code,
        team,
        duelist: 0,
        controller: team,
        location: OcgLocation.EXTRA,
        sequence: 0,
        position: OcgPosition.FACEDOWN,
      });
    }
  }

  lib.startDuel(handle);

  return new EdisonDuel(lib, handle);
}
