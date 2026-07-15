// ---------------------------------------------------------------------------
// Fix #2 — EdisonDuel.getPendingMessages(): the decision the on-clock seat is
// awaiting must be retrievable so the WS relay can (re)deliver it on connect.
// Requires the custom-built WASM; auto-skips if absent (run build-wasm.sh).
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";
import { isCustomWasmAvailable } from "./coreFactory.js";
import { createEdisonDuel } from "./createEdisonDuel.js";
import type { EdisonDuel } from "./EdisonDuel.js";

const WASM_AVAILABLE = isCustomWasmAvailable();

const FILLER_IDS = [
  32864, 1184620, 1761063, 1784619, 2118022, 2311603, 2468169, 2483611, 2863439, 2906250,
];
function fillerDeck(size = 40): number[] {
  const deck: number[] = [];
  for (let i = 0; deck.length < size; i++) deck.push(FILLER_IDS[i % FILLER_IDS.length]!);
  return deck;
}

describe.skipIf(!WASM_AVAILABLE)(
  "EdisonDuel.getPendingMessages (Fix #2) [requires custom WASM]",
  () => {
    let duel: EdisonDuel | null = null;
    afterEach(() => {
      duel?.destroy();
      duel = null;
    });

    it("returns the decision message(s) from the most recent WAITING step", async () => {
      duel = await createEdisonDuel({
        seed: 12345n,
        deck0: { main: fillerDeck(40), extra: [] },
        deck1: { main: fillerDeck(40), extra: [] },
      });
      const result = duel.step();
      expect(result.status).toBe("waiting");

      const pending = duel.getPendingMessages();
      // Non-empty: the on-clock seat has a real decision to answer.
      expect(pending.length).toBeGreaterThan(0);
      // Identical to what the step reported as its terminal decision messages.
      expect(pending).toEqual(result.messages);
      // Every pending message carries a decodable engine message name.
      for (const m of pending) expect(typeof m.name).toBe("string");
    });
  },
);
