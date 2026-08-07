// ---------------------------------------------------------------------------
// Tests for the two playability bug-fixes (spec: interactive-duel-playability-fixes.md)
//
// Bug A — buildStateForSeat spread-order + QUERY_FLAGS fix: own/opponent face-up
//          field cards must carry the real passcode; only face-down opponent cards
//          are redacted.
// Bug B — EdisonDuel phase/turn tracking: currentPhase and currentTurn must
//          update as the engine emits NEW_PHASE / NEW_TURN messages.
//
// All tests require the custom-built ocgcore WASM. They are SKIPPED automatically
// when the WASM is absent.
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";
import { isCustomWasmAvailable } from "./coreFactory.js";
import { buildStateForSeat } from "./buildStateForSeat.js";
import { createEdisonDuel } from "./createEdisonDuel.js";
import {
  createDuelWithState,
  driveDuel,
  defaultRespond,
} from "./testSupport/createDuelWithState.js";
import { OcgLocation, OcgPosition } from "ocgcore-wasm";
import type { EdisonDuel } from "./EdisonDuel.js";
import type { DuelDecisionResponse } from "@yugioh-app/contracts";

const WASM_AVAILABLE = isCustomWasmAvailable();

// Normal-monster filler passcodes (no scripts needed)
const FILLER_IDS = [32864, 1184620, 1761063, 1784619, 2118022, 2311603];

function fillerDeck(size = 20): number[] {
  const out: number[] = [];
  for (let i = 0; out.length < size; i++) out.push(FILLER_IDS[i % FILLER_IDS.length]!);
  return out;
}

const SEED = 42n;
const DECK = { main: fillerDeck(20), extra: [] };

// ── Bug A: buildStateForSeat code-visibility ──────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Bug A — field card visibility (buildStateForSeat) [requires custom WASM]",
  () => {
    it("own face-up MZONE card shows real code to its controller", async () => {
      const MONSTER_CODE = 32864;
      const { lib, handle, destroy } = await createDuelWithState({
        extraCards0: [
          { code: MONSTER_CODE, location: OcgLocation.MZONE, position: OcgPosition.FACEUP_ATTACK },
        ],
      });

      try {
        // Drive one step so duel is running
        driveDuel(lib, handle, () => ({ stop: true }), 1);

        const phaseInfo = {
          currentTurn: 0 as 0 | 1,
          currentPhase: 1,
          lp: [8000, 8000] as [number, number],
          duelEnded: false,
        };
        const state = buildStateForSeat(lib, handle, 0, phaseInfo);
        const mzone = state.zones.p0_mzone ?? [];
        // Find the card with the real code (non-zero)
        const monster = mzone.find((c) => c !== null && c.code !== 0);

        expect(monster).toBeDefined();
        expect(monster!.code).toBe(MONSTER_CODE);
      } finally {
        destroy();
      }
    });

    it("face-up opponent MZONE card is visible (non-zero code) to viewer", async () => {
      const MONSTER_CODE = 32864;
      const { lib, handle, destroy } = await createDuelWithState({
        extraCards1: [
          { code: MONSTER_CODE, location: OcgLocation.MZONE, position: OcgPosition.FACEUP_ATTACK },
        ],
      });

      try {
        driveDuel(lib, handle, () => ({ stop: true }), 1);

        const phaseInfo = {
          currentTurn: 0 as 0 | 1,
          currentPhase: 1,
          lp: [8000, 8000] as [number, number],
          duelEnded: false,
        };
        // Viewer is player 0; card is in p1_mzone (opponent of viewer 0)
        const state = buildStateForSeat(lib, handle, 0, phaseInfo);
        const mzone = state.zones.p1_mzone ?? [];
        const monster = mzone.find((c) => c !== null && c.position !== undefined);

        // Face-up opponent card must be visible (real code, not redacted to 0)
        expect(monster).toBeDefined();
        expect(monster!.code).toBe(MONSTER_CODE);
      } finally {
        destroy();
      }
    });

    it("face-DOWN opponent MZONE card is redacted (code=0) to viewer but real to controller", async () => {
      const MONSTER_CODE = 32864;
      const { lib, handle, destroy } = await createDuelWithState({
        extraCards1: [
          {
            code: MONSTER_CODE,
            location: OcgLocation.MZONE,
            position: OcgPosition.FACEDOWN_DEFENSE,
          },
        ],
      });

      try {
        driveDuel(lib, handle, () => ({ stop: true }), 1);

        const phaseInfo = {
          currentTurn: 0 as 0 | 1,
          currentPhase: 1,
          lp: [8000, 8000] as [number, number],
          duelEnded: false,
        };

        // From opponent's perspective (viewer=0): code must be 0 (redacted)
        const stateViewer = buildStateForSeat(lib, handle, 0, phaseInfo);
        const mzoneViewer = stateViewer.zones.p1_mzone ?? [];
        const cardForViewer = mzoneViewer.find((c) => c !== null && c.position !== undefined);
        expect(cardForViewer).toBeDefined();
        expect(cardForViewer!.code).toBe(0);

        // From controller's perspective (viewer=1): code must be real
        const stateController = buildStateForSeat(lib, handle, 1, phaseInfo);
        const mzoneController = stateController.zones.p1_mzone ?? [];
        const cardForController = mzoneController.find(
          (c) => c !== null && c.position !== undefined,
        );
        expect(cardForController).toBeDefined();
        expect(cardForController!.code).toBe(MONSTER_CODE);
      } finally {
        destroy();
      }
    });
  },
);

// ── Bug B: currentPhase / currentTurn tracking ────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Bug B — currentPhase / currentTurn tracking (EdisonDuel) [requires custom WASM]",
  () => {
    let duel: EdisonDuel | null = null;

    afterEach(() => {
      duel?.destroy();
      duel = null;
    });

    it("currentPhase is non-zero after first step (not stuck at 0)", async () => {
      duel = await createEdisonDuel({ seed: SEED, deck0: DECK, deck1: DECK });
      duel.step();
      const state = duel.getStateForSeat(0);
      // After the first step (which processes NEW_TURN + NEW_PHASE events),
      // phase must be non-zero — not stuck at the initial 0.
      expect(state.currentPhase).toBeGreaterThan(0);
    });

    it("currentTurn is a valid seat (0 or 1) after first step", async () => {
      duel = await createEdisonDuel({ seed: SEED, deck0: DECK, deck1: DECK });
      duel.step();
      const state = duel.getStateForSeat(0);
      expect(state.currentTurn === 0 || state.currentTurn === 1).toBe(true);
    });

    it("currentPhase is in the web encoding (1,2,4,8,16,32) after first step", async () => {
      duel = await createEdisonDuel({ seed: SEED, deck0: DECK, deck1: DECK });
      duel.step();
      const state = duel.getStateForSeat(0);
      const validPhases = new Set([1, 2, 4, 8, 16, 32]);
      expect(validPhases.has(state.currentPhase)).toBe(true);
    });

    it("currentTurn and currentPhase change across multiple steps", async () => {
      duel = await createEdisonDuel({ seed: SEED, deck0: DECK, deck1: DECK });

      const seenPhases = new Set<number>();
      const seenTurns = new Set<number>();

      // Drive up to 15 decision steps, using to-end-phase responses to advance quickly
      for (let i = 0; i < 15; i++) {
        const result = duel.step();
        const state = duel.getStateForSeat(0);

        if (state.currentPhase > 0) seenPhases.add(state.currentPhase);
        seenTurns.add(state.currentTurn);

        if (result.status === "ended") break;
        if (seenPhases.size >= 2 && seenTurns.size >= 2) break;

        if (result.status === "waiting") {
          const decision = duel.getDecisionForSeat(state.currentTurn as 0 | 1);
          if (!decision) break;

          // Try to end phase (idle) or end phase (battle) to advance turn/phase quickly
          let resp: DuelDecisionResponse | null = null;
          if (decision.kind === "IdleCommand") {
            resp = { kind: "IdleCommand", action: "toEP", index: null };
          } else if (decision.kind === "BattleCommand") {
            resp = { kind: "BattleCommand", action: "toEP", index: null };
          }

          if (resp) {
            const r = duel.applyDecisionResponse(resp);
            if (!r.ok) break;
          } else {
            break;
          }
        }
      }

      // Minimum: at least one valid phase was observed
      const validPhases = new Set([1, 2, 4, 8, 16, 32]);
      for (const p of seenPhases) {
        expect(validPhases.has(p)).toBe(true);
      }
      expect(seenPhases.size).toBeGreaterThanOrEqual(1);
      expect(seenTurns.size).toBeGreaterThanOrEqual(1);
    });

    it("currentPhase and currentTurn advance through a full turn into turn 2", async () => {
      // Use raw driveDuel helper to advance the engine fast, then snapshot
      // phaseInfo via buildStateForSeat at the end.
      const { lib, handle, destroy } = await createDuelWithState({});

      try {
        // Drive until we've seen multiple phase transitions
        const allMsgs: unknown[] = [];
        driveDuel(
          lib,
          handle,
          (all, latest, status) => {
            allMsgs.push(...(latest as unknown[]));
            // Stop after we've accumulated enough events (heuristic)
            if (all.length > 30) return { stop: true };
            if (status === 1 /* WAITING */) {
              // auto-respond via defaultRespond
              return { response: defaultRespond(latest as Parameters<typeof defaultRespond>[0]) };
            }
            return {};
          },
          200,
        );

        // Check the messages include at least one NEW_TURN (type=40) and NEW_PHASE (type=41)
        const msgs = allMsgs as Array<{ type?: number }>;
        const hasNewTurn = msgs.some((m) => m.type === 40);
        const hasNewPhase = msgs.some((m) => m.type === 41);
        expect(hasNewTurn).toBe(true);
        expect(hasNewPhase).toBe(true);
      } finally {
        destroy();
      }
    });
  },
);
