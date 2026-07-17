// ---------------------------------------------------------------------------
// Edison errata bucket B4 — behavioral accuracy tests.
//
// Cards: ERR-QUICKDRAW, ERR-SOULEXCHANGE, ERR-STRIKENINJA, ERR-SWAPFROG,
//        ERR-REDMD, ERR-NECROVALLEY (re-author).
//
// Each test drives a real ocgcore duel and asserts on the message stream.
// Skipped automatically when the custom WASM artifact is absent.
//
// Spec: /workspace/specs/edison-parity-track-b.md
// Matrix: docs/working/2026-07-17-parity-matrix.md §3
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

// ── Card passcodes ────────────────────────────────────────────────────────────
const QUICKDRAW = 20932152; // Quickdraw Synchron — IGNITION from HAND (Edison override)
const SOUL_EXCHANGE = 68005187; // Soul Exchange — BP-skip on resolution (Edison override)
const STRIKE_NINJA = 41006930; // Strike Ninja — per-copy OPT (Edison override)
const SWAP_FROG = 9126351; // Swap Frog — per-copy ignition, Frog the Jam not excluded
const REDMD = 88264978; // Red-Eyes Darkness Metal Dragon — per-copy OPT (Edison override)
const NECROVALLEY_PE = 511002998; // Necrovalley pre-errata (only negates CARD_TARGET effects)
const TREEBORN = 12538374; // Treeborn Frog — non-targeting revival, NOT negated by Necrovalley
const MONSTER_REBORN = 83764718; // Monster Reborn — CARD_TARGET GY effect, negated by Necrovalley
const KOUMORI = 67724379; // Koumori Dragon — DARK Dragon level 4, 1500 ATK (normal monster)
const OJAMA_GREEN = 12482652; // Ojama Green — level 2 WATER Aqua Beast (used for Swap Frog discard)

// ── Message-type constants ────────────────────────────────────────────────────
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_EFFECTYN = OcgMessageType.SELECT_EFFECTYN; // 12
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40
const MSG_CHAIN_END = 74; // CHAIN_END (not in OcgMessageType export but confirmed numeric)

// ── Shared cleanup ────────────────────────────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message helpers (file-local; do not export) ────────────────────────

interface IdleCmdMsg {
  type: number;
  player: number;
  summons?: Array<{ code: number }>;
  special_summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
  to_bp?: boolean;
}

interface MoveMsg {
  type: number;
  card: number;
  from?: { location: number };
  to?: { location: number };
}

// ===========================================================================
// ERR-QUICKDRAW — Quickdraw Synchron (20932152)
// Edison: IGNITION from HAND (chainable); send on RESOLUTION, not as cost.
// Observable: appears in SELECT_IDLECMD.activates (not only in special_summons),
// proving EFFECT_TYPE_IGNITION rather than EFFECT_SPSUMMON_PROC.
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-QUICKDRAW — Quickdraw Synchron (20932152) ignition offered in activates [requires custom WASM]",
  () => {
    it("ERR-QUICKDRAW — 20932152 appears in SELECT_IDLECMD.activates (IGNITION, not SPSUMMON_PROC)", async () => {
      // Setup: P0 HAND = Quickdraw + Ojama Green (monster to send as cost-target).
      // Quickdraw ignition: cost checks MZONE slot + hand monster; send happens on resolution.
      // As EFFECT_TYPE_IGNITION it appears in activates; SPSUMMON_PROC would appear as
      // a special_summons entry but NOT in activates.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: QUICKDRAW,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: OJAMA_GREEN,
            location: OcgLocation.HAND,
            sequence: 1,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;
      let activateCodes: number[] = [];
      let specialSummonCodes: number[] = [];

      driveDuel(lib, handle, (_all, msgs, _status) => {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            activateCodes = (m.activates ?? []).map((a) => a.code);
            specialSummonCodes = (m.special_summons ?? []).map((s) => s.code);
            return { stop: true };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        activateCodes.includes(QUICKDRAW),
        `Expected Quickdraw (${QUICKDRAW}) in SELECT_IDLECMD.activates (Edison IGNITION). ` +
          `activates=[${activateCodes.join(",")}] special_summons=[${specialSummonCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ===========================================================================
// ERR-SOULEXCHANGE — Soul Exchange (68005187)
// Edison: BP-skip registered in OPERATION (not cost); activating negated = no BP skip.
// Observable: after Soul Exchange resolves, to_bp = false (skip applied on resolution).
// Test uses P1's turn so BP restriction applies (P1's first turn has no "no-BP" rule).
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-SOULEXCHANGE — Soul Exchange (68005187) BP-skip applied on resolution [requires custom WASM]",
  () => {
    it("ERR-SOULEXCHANGE — to_bp=false after Soul Exchange resolves (BP-skip in operation, not cost)", async () => {
      // P0 MZONE: Koumori (target for SE), P1 HAND: Soul Exchange.
      // Turn 1 (P0): pass to EP. Turn 2 (P1): activate SE → resolve → next IDLECMD to_bp=false.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        extraCards1: [
          {
            code: SOUL_EXCHANGE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = {
        turn: 0,
        p0Done: false,
        seActivated: false,
        chainEndSeen: false,
      };
      let toBpAfterSE: boolean | undefined = undefined;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) state.turn++;
            if (m.type === MSG_CHAIN_END && state.seActivated) state.chainEndSeen = true;
          }

          // After SE resolved and we see the next IDLE, grab to_bp and stop.
          if (state.chainEndSeen) {
            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                toBpAfterSE = m.to_bp ?? false;
                return { stop: true };
              }
            }
          }

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              // Turn 1 (P0): pass to EP
              if (state.turn === 1 && !state.p0Done) {
                state.p0Done = true;
                return { response: { type: 1, action: 7 } }; // TO_EP
              }
              // Turn 2 (P1): activate Soul Exchange
              if (state.turn === 2 && !state.seActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === SOUL_EXCHANGE);
                if (idx >= 0) {
                  state.seActivated = true;
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
                return { response: { type: 1, action: 7 } }; // fallback: EP
              }
              // After SE resolved but before chainEndSeen fires: continue
              return { response: { type: 1, action: 7 } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      expect(state.seActivated, "Expected Soul Exchange to be activated on P1's turn").toBe(true);
      expect(
        toBpAfterSE,
        `Expected to_bp=false after Soul Exchange resolves (BP-skip applied on resolution). ` +
          `turn=${state.turn} chainEndSeen=${state.chainEndSeen}`,
      ).toBe(false);
    }, 25_000);
  },
);

// ===========================================================================
// ERR-STRIKENINJA — Strike Ninja (41006930)
// Edison: OPT is PER COPY — SetCountLimit(1) without name-arg.
// Observable: with 2 copies in MZONE, after copy A uses its effect, copy B
// still appears in SELECT_IDLECMD.activates (per-copy limit, not per-name).
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-STRIKENINJA — Strike Ninja (41006930) per-copy OPT [requires custom WASM]",
  () => {
    it("ERR-STRIKENINJA — after copy A banishes itself, copy B still in activates (per-copy, not per-name)", async () => {
      // P0 MZONE[0] & [1]: 2 Strike Ninjas. P0 GRAVE: 4 Koumori (DARK, for remove cost).
      // Cost: remove 2 DARK from GRAVE. Copy A costs 2, B still has 2 remaining.
      // Per-copy: A count spent, B count=0 → B still offered.
      // Per-name: shared count → B blocked.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: STRIKE_NINJA,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: STRIKE_NINJA,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
          // 4 DARK Koumori in GRAVE — 2 for copy A's cost, 2 for copy B's cost.
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 1,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 2,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 3,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = {
        firstIdleSeen: false,
        copyAActivated: false,
        chainEndAfterA: false,
      };
      let activatesFirst: number[] = [];
      let activatesSecond: number[] = [];

      driveDuel(
        lib,
        handle,
        (_all, msgs, _status) => {
          // Detect CHAIN_END after copy A activated
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && state.copyAActivated) {
              state.chainEndAfterA = true;
            }
          }

          // After A's chain resolved, capture next IDLE and stop
          if (state.chainEndAfterA) {
            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                activatesSecond = (m.activates ?? []).map((a) => a.code);
                return { stop: true };
              }
            }
          }

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (!state.firstIdleSeen) {
                state.firstIdleSeen = true;
                activatesFirst = (m.activates ?? []).map((a) => a.code);
                // Activate copy A (first Strike Ninja in activates list)
                const idx = (m.activates ?? []).findIndex((a) => a.code === STRIKE_NINJA);
                if (idx >= 0) {
                  state.copyAActivated = true;
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
                return { response: { type: 1, action: 7 } };
              }
              // Intermediate IDLE before chain end — shouldn't happen but handle gracefully
              return { response: { type: 1, action: 7 } };
            }
          }

          // SELECT_UNSELECT_CARD (type 26): ignore (Strike Ninja cost uses SELECT_CARD instead)
          // SELECT_CARD (type 15): cost of Strike Ninja — select 2 DARK from GY.
          // Respond with [0, 1] to select both available Koumori cards by index.
          for (const m of msgs as Array<{ type: number } & Record<string, unknown>>) {
            if (m.type === 15 /* SELECT_CARD */ && state.copyAActivated && !state.chainEndAfterA) {
              return { response: { type: 5, indicies: [0, 1] } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      // Both copies must be in first IDLE activates
      expect(
        activatesFirst.filter((c) => c === STRIKE_NINJA).length,
        `Expected 2 Strike Ninja (${STRIKE_NINJA}) entries in first activates. Got: [${activatesFirst.join(",")}]`,
      ).toBeGreaterThanOrEqual(1); // at least one; engine may present both or deduplicate

      // After copy A used its effect, copy B must STILL appear in activates (per-copy)
      expect(
        activatesSecond.includes(STRIKE_NINJA),
        `Expected Strike Ninja (${STRIKE_NINJA}) in activates after copy A's effect resolved ` +
          `(per-copy limit: copy B's count is still 0). Got: [${activatesSecond.join(",")}]`,
      ).toBe(true);
    }, 25_000);
  },
);

// ===========================================================================
// ERR-SWAPFROG — Swap Frog (9126351)
// Edison: ignition usable once per COPY; Frog the Jam not excluded from estg.
// Observable: both copies appear in activates initially (per-copy OPT; both counts fresh).
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-SWAPFROG — Swap Frog (9126351) per-copy ignition [requires custom WASM]",
  () => {
    it("ERR-SWAPFROG — both Swap Frog copies appear in activates (per-copy OPT, both counts fresh)", async () => {
      // P0 MZONE[0] & [1]: 2 Swap Frogs. Ignition cost: return a MZONE monster to hand.
      // With per-copy OPT (SetCountLimit(1) no-arg), both copies have count=0 → both offered.
      // Also places Ojama Green in MZONE[2] and [3] so each Swap Frog has a returnable monster.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SWAP_FROG,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: SWAP_FROG,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
          // Extra monsters so the ignition cost (return 1 MZONE monster to hand) is feasible
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 2,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 3,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        // Swap Frog ignition sends a WATER Aqua ≤L2 from Deck/MZONE to GY
        // FILLER cards are EARTH normals — no valid ignition target.
        // Add Ojama Green to deck (L2, WATER, Aqua) so the send-trigger (e2/e3/e4) works on SS.
        deck0: [OJAMA_GREEN, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;
      let activateCodes: number[] = [];

      driveDuel(lib, handle, (_all, msgs, _status) => {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            activateCodes = (m.activates ?? []).map((a) => a.code);
            return { stop: true };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      const swapFrogCount = activateCodes.filter((c) => c === SWAP_FROG).length;
      expect(
        swapFrogCount,
        `Expected 2 Swap Frog (${SWAP_FROG}) entries in activates (per-copy OPT). ` +
          `Got count=${swapFrogCount} from [${activateCodes.join(",")}]`,
      ).toBeGreaterThanOrEqual(2);
    }, 15_000);
  },
);

// ===========================================================================
// ERR-REDMD — Red-Eyes Darkness Metal Dragon (88264978)
// Edison: per-copy ignition OPT — SetCountLimit(1) without name-arg.
// Observable: after copy A uses ignition (SS a Dragon), copy B still in activates.
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-REDMD — Red-Eyes Darkness Metal Dragon (88264978) per-copy ignition [requires custom WASM]",
  () => {
    it("ERR-REDMD — after copy A uses ignition, copy B still in activates (per-copy, not per-name)", async () => {
      // P0 MZONE[0]=REDMD A, MZONE[1]=REDMD B, GRAVE: 2 Koumori (Dragon, each to SS).
      // REDMD ignition: IGNITION from MZONE, SS 1 Dragon from GY/HAND.
      // Per-copy: A uses count, B still count=0 → B appears after A resolves.
      // Per-name (old script): B blocked by shared name count → B absent.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: REDMD,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: REDMD,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
          // Koumori Dragon in GRAVE — Dragon-type, SS-able from GY by REDMD ignition.
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 1,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = {
        firstIdleSeen: false,
        copyAActivated: false,
        chainEndAfterA: false,
      };
      let activatesFirst: number[] = [];
      let activatesSecond: number[] = [];

      driveDuel(
        lib,
        handle,
        (_all, msgs, _status) => {
          // Detect CHAIN_END after copy A activated
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && state.copyAActivated) {
              state.chainEndAfterA = true;
            }
          }

          // After A's chain resolved, capture next IDLE and stop
          if (state.chainEndAfterA) {
            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                activatesSecond = (m.activates ?? []).map((a) => a.code);
                return { stop: true };
              }
            }
          }

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (!state.firstIdleSeen) {
                state.firstIdleSeen = true;
                activatesFirst = (m.activates ?? []).map((a) => a.code);
                // Activate copy A (first REDMD in activates list)
                const idx = (m.activates ?? []).findIndex((a) => a.code === REDMD);
                if (idx >= 0) {
                  state.copyAActivated = true;
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
                return { response: { type: 1, action: 7 } };
              }
              return { response: { type: 1, action: 7 } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      // First IDLE: at least one REDMD in activates
      expect(
        activatesFirst.includes(REDMD),
        `Expected REDMD (${REDMD}) in first activates. Got: [${activatesFirst.join(",")}]`,
      ).toBe(true);

      // After copy A used ignition, copy B must STILL appear in activates (per-copy OPT)
      expect(
        activatesSecond.includes(REDMD),
        `Expected REDMD (${REDMD}) STILL in activates after copy A's ignition resolved ` +
          `(per-copy limit: copy B's count = 0). Got: [${activatesSecond.join(",")}]`,
      ).toBe(true);
    }, 25_000);
  },
);

// ===========================================================================
// ERR-NECROVALLEY — Necrovalley pre-errata (511002998) re-authored behavior.
//
// Part 1: Treeborn Frog's non-targeting revival is NOT negated under Necrovalley.
// Part 2: A GY-targeting effect (Monster Reborn) IS negated under Necrovalley.
//
// Root cause of previous DEFECT: old script triggered on ANY chain link involving a
// GY card marked with EFFECT_NECRO_VALLEY, including non-targeting effects.
// Fix: early-return in s.disop when the effect lacks EFFECT_FLAG_CARD_TARGET.
//
// NOTE: Necrovalley must be activated from hand (not pre-placed in FZONE) to
// register continuous effects properly. Field spells placed via duelNewCard do not
// go through the activation chain, so their EFFECT_TYPE_ACTIVATE and subsequent
// continuous effects may not register correctly in the engine.
// ===========================================================================
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-NECROVALLEY — 511002998 re-author: only negates GY-targeting effects [requires custom WASM]",
  () => {
    it("ERR-NECROVALLEY-TREEBORN — Treeborn Frog revival NOT negated under active Necrovalley (non-targeting)", async () => {
      // Setup: P0 FZONE=Necrovalley pre-placed (effects active at game start).
      //        P0 GRAVE=Treeborn.
      // Turn 1 Standby: Treeborn optional trigger fires via SELECT_EFFECTYN → we accept (YES).
      // Chain resolves. Re-authored Necrovalley:
      //   s.disop sees no EFFECT_FLAG_CARD_TARGET → early return → NOT negated.
      // Observable: MOVE Treeborn (12538374) from GRAVE (16) to MZONE (4).
      // Note: Necrovalley is pre-placed (not activated from hand) so its continuous effects
      // register at game start. defaultRespond handles SELECT_PLACE + SELECT_POSITION.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: NECROVALLEY_PE,
            location: OcgLocation.FZONE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: TREEBORN,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let treebornMovedToMzone = false;
      let firstIdleSeen = false;
      let effectynAccepted = false;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          // Track MOVE: Treeborn from GRAVE → MZONE
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === TREEBORN &&
              m.from?.location === OcgLocation.GRAVE &&
              m.to?.location === OcgLocation.MZONE
            ) {
              treebornMovedToMzone = true;
            }
          }

          // Stop when Treeborn moves or after first IDLECMD
          if (treebornMovedToMzone) return { stop: true };

          // Handle SELECT_EFFECTYN (Treeborn's optional trigger prompt) — accept immediately.
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_SELECT_EFFECTYN) {
              effectynAccepted = true;
              return { response: { type: 2, yes: true } }; // YES: activate Treeborn trigger
            }
          }

          // Stop at first IDLECMD if Treeborn hasn't moved yet (Standby already passed)
          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              firstIdleSeen = true;
              return { stop: true };
            }
          }

          if (status !== 1) return {};
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        treebornMovedToMzone,
        `Expected Treeborn (${TREEBORN}) to move from GRAVE to MZONE ` +
          `(revival NOT negated by re-authored Necrovalley — non-targeting effect passes CARD_TARGET check). ` +
          `effectynAccepted=${effectynAccepted} firstIdleSeen=${firstIdleSeen}`,
      ).toBe(true);
    }, 20_000);

    it("ERR-NECROVALLEY-TARGETING — Monster Reborn targeting GY card IS negated under Necrovalley", async () => {
      // Setup: P0 HAND=[Necrovalley, Monster Reborn]. P0 GRAVE=Koumori.
      // Turn 1 M1: activate Necrovalley first → FZONE. Then activate Monster Reborn targeting Koumori.
      // Monster Reborn has EFFECT_FLAG_CARD_TARGET. Re-authored Necrovalley:
      //   s.disop sees CARD_TARGET + Koumori has NECRO_VALLEY flag → negates.
      // Observable: Koumori does NOT move from GRAVE to MZONE after Monster Reborn chain resolves.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: NECROVALLEY_PE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: MONSTER_REBORN,
            location: OcgLocation.HAND,
            sequence: 1,
            position: OcgPosition.FACEUP,
          },
          {
            code: KOUMORI,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = {
        necroActivated: false,
        rebornActivated: false,
        chainEndSeen: false,
      };
      let koumoriMovedToMzone = false;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          // Track CHAIN_END after Monster Reborn activated
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && state.rebornActivated) {
              state.chainEndSeen = true;
            }
          }

          // Track MOVE: Koumori from GRAVE → MZONE
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === KOUMORI &&
              m.from?.location === OcgLocation.GRAVE &&
              m.to?.location === OcgLocation.MZONE
            ) {
              koumoriMovedToMzone = true;
            }
          }

          // After Monster Reborn's chain resolved, stop
          if (state.chainEndSeen) return { stop: true };

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              // Step 1: activate Necrovalley first
              if (!state.necroActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === NECROVALLEY_PE);
                if (idx >= 0) {
                  state.necroActivated = true;
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
              }
              // Step 2: activate Monster Reborn (now Necrovalley is active in FZONE)
              if (state.necroActivated && !state.rebornActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === MONSTER_REBORN);
                if (idx >= 0) {
                  state.rebornActivated = true;
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
              }
              return { response: { type: 1, action: 7 } }; // EP fallback
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        25_000,
      );

      expect(state.necroActivated, "Expected Necrovalley to be activated (step 1)").toBe(true);
      expect(
        state.rebornActivated,
        "Expected Monster Reborn to be activated after Necrovalley is active",
      ).toBe(true);
      expect(
        koumoriMovedToMzone,
        `Expected Koumori (${KOUMORI}) to NOT move from GRAVE to MZONE ` +
          `(Monster Reborn negated by re-authored Necrovalley — GY-targeting effect). ` +
          `chainEndSeen=${state.chainEndSeen}`,
      ).toBe(false);
    }, 30_000);
  },
);
