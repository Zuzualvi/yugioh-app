// ---------------------------------------------------------------------------
// createEdisonDuel — factory for the public EdisonDuel API.
//
// Loads the custom ocgcore WASM, creates the duel with EDISON_FLAGS, and
// adds all cards from both decks to the engine's initial state.
// ---------------------------------------------------------------------------

import { OcgLocation, OcgPosition } from "ocgcore-wasm";
import { EDISON_FLAGS } from "./edisonFlags.js";
import { createEdisonCore } from "./coreFactory.js";
import { getCard } from "./cardLoader.js";
import { getScript } from "./scriptLoader.js";
import { EdisonDuel, type CreateEdisonDuelOpts } from "./EdisonDuel.js";

/**
 * splitmix64 — deterministic 64-bit PRNG used to shuffle the opening decks.
 *
 * Deliberately seeded from the duel's own seed so the shuffle is a PURE
 * FUNCTION of that seed. duelManager rehydrates a duel after a process
 * restart by calling replayEdisonDuel(seed, deck0, deck1, log); if the deck
 * order were not reproducible from the seed alone, a restart would re-deal
 * different cards underneath a live duel and desync every stored response.
 */
function makeRng(seed: bigint): () => number {
  const MASK = (1n << 64n) - 1n;
  let state = BigInt.asUintN(64, seed);
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    z = (z ^ (z >> 31n)) & MASK;
    return Number(z >> 11n) / 9007199254740992; // 2^53
  };
}

/** Fisher-Yates over a copy — never mutates the caller's decklist. */
function shuffleDeck(cards: readonly number[], rng: () => number): number[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Create a new EdisonDuel, ready to step().
 *
 * Each duel gets its own isolated ocgcore instance so concurrent duels never
 * share Lua state and a destroyed duel's deferred GC cannot corrupt another.
 *
 * @throws If the custom WASM is not present (run build-wasm.sh first).
 * @throws If card DB is not populated (run card-data pipeline first).
 */
export async function createEdisonDuel(opts: CreateEdisonDuelOpts): Promise<EdisonDuel> {
  const { seed, deck0, deck1 } = opts;
  const lib = await createEdisonCore();

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

  // Shuffle each main deck before loading it.
  //
  // ocgcore does NOT shuffle at duel start — Processors::Startup draws straight
  // off the deck in load order (see processor.cpp, `case 1: … draw(…)`), and the
  // engine's own `seed` governs only in-duel randomness. Shuffling is the host
  // application's job. Without this, every duel from a given decklist deals the
  // identical opening hand.
  //
  // Each deck is drawn from the SAME generator in sequence, so seat 0 and seat 1
  // get different orders while the pair stays reproducible from the seed.
  const rng = makeRng(seedBig);
  const shuffledMain = [shuffleDeck(deck0.main, rng), shuffleDeck(deck1.main, rng)];

  // Add main deck cards (seat 0 → team 0, seat 1 → team 1)
  for (const [teamIdx, deck] of [deck0, deck1].entries()) {
    const team = teamIdx as 0 | 1;
    for (const code of shuffledMain[teamIdx]!) {
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
