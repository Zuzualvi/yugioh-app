// ---------------------------------------------------------------------------
// Edison-rules accuracy tests (empirical — requires custom WASM).
//
// Each test drives a real ocgcore duel and asserts the message stream matches
// the verified Edison (March 2010 / Master Rule 1 TCG) behavior.
//
// Skipped automatically when the custom WASM artifact is absent (CI without
// the build artifact), matching the pattern in createEdisonDuel.test.ts.
//
// Source references:
//   - Spike E: spikes/spike-e-wasm-build/src/e2-gy-ignition.js
//   - Spike E: spikes/spike-e-wasm-build/src/e3-regression.js
//   - Spike A2: spikes/spike-a2-ruleset-validation/src/a22-goat-flags.js
//   - Memory: /mnt/memory/yugioh-app-team-memory/research/edison-engine-rules-flags.md
//   - EDISON_FLAGS = 0x7f80d072cn (OcgDuelMode.MODE_GOAT | 0x400000000n)
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";
import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import { isCustomWasmAvailable } from "./coreFactory.js";
import {
  createDuelWithState,
  defaultRespond,
  driveDuel,
  FILLER,
  type DuelHandle,
} from "./testSupport/createDuelWithState.js";

const WASM_AVAILABLE = isCustomWasmAvailable();

// ── Card passcodes (empirically verified in spike sessions) ──────────────────
const MALICIOUS = 9411399; // D-HERO Malicious — GY ignition (banish self, SS from deck)
const KOUMORI = 67724379; // Koumori Dragon — 1500 ATK normal, summonable without tribute
const BTH = 29401950; // Bottomless Trap Hole — triggers vs. ≥1500 ATK summon
const LONEFIRE = 48686504; // Lonefire Blossom — MZone ignition (tribute + SS plant from deck)
const UMI = 22702055; // Umi — Field Spell (Water)
const MOUNTAIN = 50913601; // Mountain — Field Spell (Wind/EARTH)
const OJAMA_GREEN = 12482652; // Ojama Green — 0/1000 normal monster

// ── Message-type numeric constants (OcgMessageType enum values) ──────────────
const MSG_SUMMONED = OcgMessageType.SUMMONED; // 61
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN; // 16
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD; // 10
const MSG_DRAW = OcgMessageType.DRAW; // 90
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_BATTLE = OcgMessageType.BATTLE; // 111
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40

// ── Shared state for afterEach cleanup ──────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message helpers ────────────────────────────────────────────────────

interface SelectChainMsg {
  type: number;
  player: number;
  selects?: Array<{ code: number }>;
}

interface DrawMsg {
  type: number;
  player: number;
  drawn?: unknown[];
}

interface MoveMsg {
  type: number;
  card: number;
  to?: { location: number };
}

interface BattleMsg {
  type: number;
  card?: { destroyed: boolean };
  target?: { destroyed: boolean };
}

interface IdleCmdMsg {
  type: number;
  player: number;
  summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
  to_bp?: boolean;
}

interface BattleCmdMsg {
  type: number;
  player: number;
  attacks?: Array<{ code: number }>;
}

// ── Rule 1: GY Ignition Priority ─────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 1 — GY ignition priority [requires custom WASM]",
  () => {
    it("seat 0 is offered SELECT_CHAIN with Malicious [9411399] BEFORE opponent after Normal Summon", async () => {
      // Setup:
      //   P0 GY:   D-HERO Malicious (GY ignition: banish self → SS another from deck)
      //   P0 deck: D-HERO Malicious (target for the effect)
      //   P0 hand: Koumori Dragon (to Normal Summon on turn 1)
      //   P1 S/T:  Bottomless Trap Hole (face-down — creates opponent response window)
      //
      // Expected post-SUMMONED:
      //   SELECT_CHAIN player=0 selects=[9411399]  ← Edison GY ignition priority
      //   SELECT_CHAIN player=1 ...                ← only AFTER player 0 declines
      //
      // This requires EDISON_FLAGS bit 0x400000000n (TCG_FAST_EFFECT_IGNITION).
      // Verified empirically in spike-e (e2-gy-ignition.js).

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: MALICIOUS,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: BTH,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        // Malicious in deck = target for GY effect
        deck0: [MALICIOUS, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1, // small hand so we don't over-draw
      });

      const { lib, handle } = currentDuel;

      const state = {
        summoned: false,
        respondedSummon: false,
      };
      const chainOffers: Array<{ player: number; selects: number[] }> = [];

      driveDuel(lib, handle, (all, msgs, status) => {
        // Collect chain offers after SUMMONED
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SUMMONED) state.summoned = true;
          if (m.type === MSG_SELECT_CHAIN && state.summoned) {
            chainOffers.push({
              player: m.player,
              selects: (m.selects ?? []).map((s) => s.code),
            });
          }
        }

        // Stop after we have both the turn-player CL1 offer AND at least one more
        if (state.summoned && chainOffers.length >= 2) return { stop: true };

        if (status !== 1 /* WAITING */) return {};

        // Find what to respond
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (!state.respondedSummon) {
              const idx = (m.summons ?? []).findIndex((s) => s.code === KOUMORI);
              if (idx >= 0) {
                state.respondedSummon = true;
                return { response: { type: 1, action: 0, index: idx } }; // SUMMON
              }
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      // Assert: the FIRST chain offer after SUMMONED goes to player 0 with Malicious
      const p0GYOffer = chainOffers.find((c) => c.player === 0 && c.selects.includes(MALICIOUS));
      const p0IsFirst =
        chainOffers.length > 0 &&
        chainOffers[0]!.player === 0 &&
        chainOffers[0]!.selects.includes(MALICIOUS);

      expect(
        p0GYOffer,
        `Expected SELECT_CHAIN player=0 selects=[${MALICIOUS}] (GY ignition priority). Got: ${JSON.stringify(chainOffers)}`,
      ).toBeDefined();

      expect(
        p0IsFirst,
        `GY ignition chain offer must be FIRST (CL1 window). Got chain offers: ${JSON.stringify(chainOffers)}`,
      ).toBe(true);
    }, 15_000);
  },
);

// ── Rule 2: MZone Ignition Priority ──────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 2 — MZone ignition priority (OBSOLETE_IGNITION) [requires custom WASM]",
  () => {
    it("seat 0 offered SELECT_CHAIN with Lonefire [48686504] as CL1 after Normal Summon", async () => {
      // Lonefire Blossom summoned → its ignition effect offered to seat 0 BEFORE opponent.
      // Verified in spike-e (e3-regression.js testMZoneIgnition).

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: LONEFIRE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        // Lonefire in deck = target for its own effect (tribute + SS plant from deck)
        deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { summoned: false, respondedSummon: false };
      const chainOffers: Array<{ player: number; selects: number[] }> = [];

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SUMMONED) state.summoned = true;
          if (m.type === MSG_SELECT_CHAIN && state.summoned) {
            chainOffers.push({
              player: m.player,
              selects: (m.selects ?? []).map((s) => s.code),
            });
          }
        }

        if (state.summoned && chainOffers.length >= 2) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (!state.respondedSummon) {
              const idx = (m.summons ?? []).findIndex((s) => s.code === LONEFIRE);
              if (idx >= 0) {
                state.respondedSummon = true;
                return { response: { type: 1, action: 0, index: idx } };
              }
            }
            return { response: { type: 1, action: 7 } };
          }
          if (m.type === MSG_SELECT_CHAIN) {
            return { response: { type: 8, index: null } }; // decline
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      const lonefireOffer = chainOffers.find((c) => c.player === 0 && c.selects.includes(LONEFIRE));
      const isFirst =
        chainOffers.length > 0 &&
        chainOffers[0]!.player === 0 &&
        chainOffers[0]!.selects.includes(LONEFIRE);

      expect(
        lonefireOffer,
        `Expected SELECT_CHAIN player=0 selects=[${LONEFIRE}]. Got: ${JSON.stringify(chainOffers)}`,
      ).toBeDefined();
      expect(
        isFirst,
        `MZone ignition must be the FIRST chain offer (CL1). Got: ${JSON.stringify(chainOffers)}`,
      ).toBe(true);
    }, 15_000);
  },
);

// ── Rule 3: First-Turn Draw ───────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 3 — first-turn draw (FIRST_TURN_DRAW) [requires custom WASM]",
  () => {
    it("seat 0 draws 6 cards total before first IDLECMD (5 opening + 1 turn-1 draw)", async () => {
      // With FIRST_TURN_DRAW (0x200) set, the first player draws 1 card on their
      // first turn (in addition to 5 opening draws). Total = 6.
      // Verified in spike-e (e3-regression.js testFirstTurnDraw) and spike-a2.

      currentDuel = await createDuelWithState({
        startingDrawCount: 5,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      let player0CardCount = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as DrawMsg[]) {
          if (m.type === MSG_DRAW && m.player === 0) {
            player0CardCount += m.drawn?.length ?? 0;
          }
        }

        // Stop as soon as player 0 gets their first IDLECMD (main phase)
        if ((msgs as Array<{ type: number }>).some((m) => m.type === MSG_SELECT_IDLECMD)) {
          return { stop: true };
        }

        if (status !== 1) return {};
        return { response: defaultRespond(msgs as never) };
      });

      expect(player0CardCount).toBe(6);
    }, 15_000);
  },
);

// ── Rule 4: One face-up field spell ──────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 4 — one face-up field spell (ONE_FACEUP_FIELD) [requires custom WASM]",
  () => {
    it("Umi [22702055] sent to GRAVE when Mountain [50913601] is activated", async () => {
      // With ONE_FACEUP_FIELD (0x400): activating a new Field Spell destroys the old one.
      // Scenario:
      //   Turn 1 (P0): activates Umi from hand
      //   Turn 2 (P1): activates Mountain from hand → Umi must go to GRAVE
      // Verified in spike-e (e3-regression.js testFieldSpell).

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: UMI,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: MOUNTAIN,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { activatedUmi: false, activatedMountain: false };
      const movesToGrave: number[] = []; // card passcodes moved to GRAVE
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number; player?: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
            movesToGrave.push(m.card);
          }
        }

        // Stop after turn 3 started (Mountain resolved on turn 2)
        if (turn > 3) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (turn === 1 && !state.activatedUmi) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === UMI);
              if (idx >= 0) {
                state.activatedUmi = true;
                return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
              }
            }
            if (turn === 2 && !state.activatedMountain) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === MOUNTAIN);
              if (idx >= 0) {
                state.activatedMountain = true;
                return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
              }
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      const umiDestroyed = movesToGrave.includes(UMI);
      expect(
        umiDestroyed,
        `Expected Umi [${UMI}] to be sent to GRAVE when Mountain activated. Moves to grave: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);
    }, 20_000);
  },
);

// ── Rule 5: 0-ATK battle rule ─────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 5 — 0-ATK battle rule (ZERO_ATK_DESTROYED) [requires custom WASM]",
  () => {
    it("both Ojama Greens [12482652] (0 ATK) destroyed when one attacks the other", async () => {
      // With ZERO_ATK_DESTROYED (0x10000000): a 0-ATK attacker vs a 0-ATK defender
      // results in BOTH being destroyed (sent to GRAVE).
      //
      // Without the flag: neither is destroyed (0 ATK has no destroy power in older rules).
      //
      // Setup:
      //   P0 MZONE: Ojama Green (ATK position)
      //   P1 MZONE: Ojama Green (ATK position)
      //   P0 attacks P1's monster in Battle Phase.
      //
      // Verified empirically in spike-a2 (a22-goat-flags.js testZeroAtkBattle).

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        extraCards1: [
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 3,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { movedToBP: false, attacked: false, battleSeen: false };
      const ojamaMoves: number[] = []; // track location moves for both Ojamas
      let battleDestroyedCard = false;
      let battleDestroyedTarget = false;

      driveDuel(
        lib,
        handle,
        (all, msgs, status) => {
          for (const m of msgs as BattleMsg[]) {
            if (m.type === MSG_BATTLE) {
              state.battleSeen = true;
              battleDestroyedCard = m.card?.destroyed ?? false;
              battleDestroyedTarget = m.target?.destroyed ?? false;
            }
          }
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === OJAMA_GREEN &&
              m.to?.location === OcgLocation.GRAVE
            ) {
              ojamaMoves.push(OJAMA_GREEN);
            }
          }

          // Stop after battle resolved + new turn
          if (
            state.battleSeen &&
            (msgs as Array<{ type: number }>).some((m) => m.type === MSG_NEW_TURN)
          ) {
            return { stop: true };
          }

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && !state.movedToBP && m.to_bp) {
              state.movedToBP = true;
              return { response: { type: 1, action: 6 } }; // TO_BP
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (
              m.type === MSG_SELECT_BATTLECMD &&
              !state.attacked &&
              (m.attacks?.length ?? 0) > 0
            ) {
              state.attacked = true;
              return { response: { type: 0, action: 1, index: 0 } }; // ATTACK
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        8_000,
      );

      // Both Ojama Greens must be sent to GRAVE (two separate MOVE events)
      expect(
        ojamaMoves.length,
        `Expected 2 Ojama Greens to GRAVE (both destroyed). Got ${ojamaMoves.length}. ` +
          `BATTLE: card.destroyed=${battleDestroyedCard} target.destroyed=${battleDestroyedTarget}`,
      ).toBe(2);

      // The BATTLE message should show both sides destroyed
      expect(
        battleDestroyedCard,
        "BATTLE.card.destroyed must be true (attacker destroyed by 0-ATK rule)",
      ).toBe(true);
      expect(
        battleDestroyedTarget,
        "BATTLE.target.destroyed must be true (defender destroyed by 0-ATK rule)",
      ).toBe(true);
    }, 20_000);
  },
);

// ── Rule 6: LP-cost strict (Edison rule #10) ──────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule 6 — LP-cost strict patch (Edison rule #10) [requires custom WASM]",
  () => {
    it.todo(
      // Cannot construct a clean deterministic scenario in this slice.
      //
      // The patch (packages/engine/patches/ocgcore-lp-cost-strict.patch) changes
      // field.cpp check_lp_cost from `val <= lp` to `val < lp`, making any LP cost
      // that would reduce LP to exactly 0 ILLEGAL.
      //
      // Constructing an empirical test requires:
      //   1. A spell/trap card with a fixed LP cost (e.g. 500) that can be activated
      //      from hand in Main Phase 1 without any other conditions.
      //   2. Starting LP = that cost value.
      //   3. Verifying the card does NOT appear in SELECT_IDLECMD.activates.
      //
      // All Edison-era candidates with simple fixed LP costs either:
      //   (a) require additional conditions (face-up field, specific board state,
      //       monsters on field, etc.) that make the scenario non-deterministic or
      //       require many more turns to set up, OR
      //   (b) are Continuous/Quick effects that appear in SELECT_CHAIN not
      //       SELECT_IDLECMD, making them harder to assert reliably in isolation.
      //
      // The patch IS applied and verified by the build process (build-wasm.sh applies
      // ocgcore-lp-cost-strict.patch). The presence of the custom WASM already
      // guarantees the patch was applied at build time.
      //
      // A full empirical game-state test is deferred to slice 40 (card-script
      // curation phase) when a suitable pre-errata card with a clean LP cost mechanic
      // is available. A suggested card: "Solemn Judgment" (41420027) — pay half LP as
      // a counter trap cost — but that requires a Spell/Trap to be chained to first,
      // making setup complex.
      //
      // Coverage gap: DOCUMENTED. The patch mechanism is source-verified; empirical
      // game-state coverage is deferred.
      "LP-cost strict: card paying exact current LP must be ILLEGAL (deferred — see comment above)",
    );
  },
);
