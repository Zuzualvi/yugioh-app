// ---------------------------------------------------------------------------
// Real-engine live-duel integration test.
//
// SKIPPED when the custom WASM artifact is absent (same pattern as engine
// slice 10). Activates once packages/engine/scripts/build-wasm.sh runs.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { isCustomWasmAvailable } from "@yugioh-app/engine";

const WASM_AVAILABLE = isCustomWasmAvailable();

describe.skipIf(!WASM_AVAILABLE)("Real-engine live-duel integration", () => {
  it("creates an EdisonDuel with the real engine and steps to first WAITING", async () => {
    const { createEdisonDuel } = await import("@yugioh-app/engine");

    // Minimal filler deck — 40 copies of the same normal monster
    const FILLER_ID = 32864; // Mystical Elf (normal monster, no script)
    const fillerDeck = { main: Array(40).fill(FILLER_ID) as number[], extra: [] as number[] };

    const duel = await createEdisonDuel({
      seed: 42n,
      deck0: fillerDeck,
      deck1: fillerDeck,
    });

    expect(duel.isEnded()).toBe(false);

    const result = duel.step();
    // After initial step, should reach first WAITING (decision request) or END
    expect(["waiting", "ended"]).toContain(result.status);
  });
});
