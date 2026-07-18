// ---------------------------------------------------------------------------
// Edison-rules accuracy tests — R05: Trap Monster Zone Blocking (16 behaviors)
//
// Each test drives a real ocgcore duel and asserts the message stream matches
// the verified Edison (March 2010 / Master Rule 1 TCG) behavior.
//
// Skipped automatically when the custom WASM artifact is absent.
//
// Passcode corrections vs. parity-matrix:
//   Embodiment of Apophis : matrix says 46461247 → actual 28649820
//   Metal Reflect Slime   : matrix says 26593934 → actual 26905245
//   Fake Trap             : matrix says 69826768 → actual 3027001
//
// Key note on turn order:
//   P0 is the first player — NO Battle Phase on turn 1 (R01-B2).
//   P0's first BP is turn 3; P1's first BP is turn 2.
//   Tests that require P0 to attack drive through turns 1 (P0 MP), 2 (P1 EP), 3 (P0 BP).
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

// ── Card passcodes ───────────────────────────────────────────────────────────
const APOPHIS = 28649820; // Embodiment of Apophis — Trap Monster (EARTH/Reptile 1600/1800 Lv4)
const ZOMA = 79852326; // Zoma the Spirit — Trap Monster (DARK/Zombie 1800/500 Lv4)
const METAL_REFLECT_SLIME = 26905245; // Metal Reflect Slime — Trap Monster (WATER/Aqua 0/3000 Lv10)
const JINZO = 77585513; // Jinzo — Effect Monster, negates trap effects (2400/1500 Lv6)
const BOOK_OF_MOON = 14087893; // Book of Moon — flip a face-up monster face-down
const SNATCH_STEAL = 45986603; // Snatch Steal — take control of opp. face-up monster
const CREATURE_SWAP = 31036355; // Creature Swap — exchange control of one monster each
const HEAVY_STORM = 19613556; // Heavy Storm — destroy all S/T on field
const FAKE_TRAP = 3027001; // Fake Trap — protect trap card from destruction by card effect
const MY_BODY = 69279219; // My Body as a Shield — negate card that destroys monsters
const LIGHTNING_VORTEX = 69162969; // Lightning Vortex — destroy all opp face-up monsters
const RAIGEKI_BREAK = 4178474; // Raigeki Break — destroy 1 card on field (discard cost)
const TIME_MACHINE = 80987696; // Time Machine — revive monster destroyed by battle
const CAIUS = 9748752; // Caius the Shadow Monarch — banish on tribute summon + 1000 DARK burn
const PENGUIN_SOLDIER = 93920745; // Penguin Soldier — flip: return up to 2 MZONE monsters to hand
const IMT = 36261276; // Interdimensional Matter Transporter — temp remove own monster (end phase return)
const DIMENSIONHOLE = 22959079; // Dimensionhole — temp remove own monster (next standby return)
const OJAMA_GREEN = 12482652; // Ojama Green — 0/1000 normal, safe MZONE filler
const KOUMORI = 67724379; // Koumori Dragon — 1500 ATK normal (safe summonable)
// Shiny Black "C" Squadder — 2000 ATK normal monster (no script needed, type=normal|effect)
// used to destroy Apophis (1600 ATK) in battle
const STRONG_NORMAL = 4148264;
const MICHIZURE = 37580756; // Michizure — fires when own monster goes to GY by sending

// ── Message-type constants ───────────────────────────────────────────────────
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD; // 10
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN; // 16
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_DAMAGE = OcgMessageType.DAMAGE; // 91
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40
const MSG_SPSUMMONED = OcgMessageType.SPSUMMONED; // 63
const MSG_SUMMONED = OcgMessageType.SUMMONED; // 61

// ── Shared state for afterEach cleanup ──────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message helpers ────────────────────────────────────────────────────

interface IdleCmdMsg {
  type: number;
  player: number;
  summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
  to_bp?: boolean;
  sets?: Array<{ code: number }>;
  spell_sets?: Array<{ code: number }>;
}

interface MoveMsg {
  type: number;
  card: number;
  from?: { location: number; sequence: number };
  to?: { location: number; sequence: number };
}

interface DamageMsg {
  type: number;
  player: number;
  amount: number;
}

interface SelectChainMsg {
  type: number;
  player: number;
  selects?: Array<{ code: number }>;
}

interface BattleCmdMsg {
  type: number;
  player: number;
  attacks?: Array<{ code: number }>;
}

// ── Rule R05 — Trap Monster Zone Blocking ────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "Edison Rule R05 — Trap Monster Zone Blocking [requires custom WASM]",
  () => {
    // ── Sanity: Zoma / Apophis CAN be activated ───────────────────────────────
    it("R05 sanity — Zoma activates from SZONE and emits SPSUMMONED (trap monster goes to MZONE)", async () => {
      // Verify the basic trap-monster machinery: Zoma (EVENT_FREE_CHAIN) activates
      // from SZONE[0] and is special summoned to MZONE.

      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: ZOMA, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      const state = { activated: false };
      let spsummonedSeen = false;

      driveDuel(lib, handle, (_all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_SPSUMMONED) spsummonedSeen = true;
        }
        if (spsummonedSeen) return { stop: true };
        if (status !== 1) return {};
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !state.activated) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === ZOMA);
            if (idx >= 0) {
              state.activated = true;
              return { response: { type: 1, action: 5, index: idx } };
            }
            return { response: { type: 1, action: 7 } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        spsummonedSeen,
        `Sanity: Zoma [${ZOMA}] must emit SPSUMMONED when activated from SZONE.`,
      ).toBe(true);
    }, 15_000);

    // ── R05-B2 ────────────────────────────────────────────────────────────────
    it("R05-B2 — cannot activate Set Trap Monster when all 5 MZones are filled (Apophis)", async () => {
      // Apophis's activate target checks Duel.GetLocationCount(tp,LOCATION_MZONE)>0.
      // With 5 monsters in MZONE[0-4], that returns 0 → activation NOT offered.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
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
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 4,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      let activateCodes: number[] = [];

      driveDuel(lib, handle, (_all, msgs, status) => {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            activateCodes = (m.activates ?? []).map((a) => a.code);
            return { stop: true };
          }
        }
        if (status !== 1) return {};
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        activateCodes.includes(APOPHIS),
        `R05-B2: Apophis [${APOPHIS}] must NOT appear in activates when all 5 MZones are filled. ` +
          `Got activates: ${JSON.stringify(activateCodes)}`,
      ).toBe(false);
    }, 15_000);

    // ── R05-B2 (Metal Reflect Slime) ─────────────────────────────────────────
    it("R05-B2 (Metal Reflect Slime) — Trap Monster activation blocked when all MZones filled", async () => {
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 2,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 3,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 4,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: METAL_REFLECT_SLIME,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      let activateCodes: number[] = [];

      driveDuel(lib, handle, (_all, msgs, status) => {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            activateCodes = (m.activates ?? []).map((a) => a.code);
            return { stop: true };
          }
        }
        if (status !== 1) return {};
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        activateCodes.includes(METAL_REFLECT_SLIME),
        `R05-B2: Metal Reflect Slime [${METAL_REFLECT_SLIME}] must NOT appear in activates when all 5 MZones filled. ` +
          `Got activates: ${JSON.stringify(activateCodes)}`,
      ).toBe(false);
    }, 15_000);

    // ── R05-B1 ────────────────────────────────────────────────────────────────
    it("R05-B1 — Trap Monster occupies dual zone: S/T zone of origin blocked after activation", async () => {
      // Activate Apophis from SZONE[1]. After activation it occupies MZONE[X] AND
      // SZONE[1] remains blocked for other cards (dual-zone occupation).
      // When P0 tries to SET another trap, SELECT_PLACE field_mask must show SZONE[1] unavailable.
      // Bit layout: player0 SZONE bits at positions 8-12 (shift 8); SZONE[1] = bit 9.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: RAIGEKI_BREAK,
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

      const state = { activated: false };
      let szone1BlockedAfterActivation = false;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (!state.activated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.activated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
                return { response: { type: 1, action: 7 } };
              } else {
                // After activation: try to SET Raigeki Break so engine asks for zone selection
                const spellSets = m.spell_sets ?? [];
                const setCards = m.sets ?? [];
                const idx = [...spellSets, ...setCards].findIndex((a) => a.code === RAIGEKI_BREAK);
                if (idx >= 0) {
                  return { response: { type: 1, action: 4, index: idx } };
                }
                return { stop: true };
              }
            }
          }

          // Handle SELECT_PLACE: check if SZONE[1] (bit 9 of player-0 mask) is blocked
          for (const m of msgs as Array<{
            type: number;
            field_mask?: number;
            player?: number;
          }>) {
            if (m.type === 18 /* SELECT_PLACE */) {
              const fieldMask = m.field_mask ?? 0;
              const player0Mask = fieldMask & 0xffff;
              // SZONE slot 1 for player 0 = bit (8 + 1) = bit 9
              const szone1Bit = 1 << 9;
              szone1BlockedAfterActivation = (player0Mask & szone1Bit) !== 0;
              return { stop: true };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        5_000,
      );

      expect(
        szone1BlockedAfterActivation,
        `R05-B1: SZONE[1] must be blocked in SELECT_PLACE field_mask after Apophis [${APOPHIS}] ` +
          `activates from that slot (dual-zone occupation).`,
      ).toBe(true);
    }, 15_000);

    // ── R05-B3 ────────────────────────────────────────────────────────────────
    it.fails(
      "R05-B3 — control-gain (Creature Swap) of Trap Monster requires open MZone AND S/T Zone",
      async () => {
        // P0 has all 5 MZONE slots filled + Creature Swap in HAND.
        // P1 has Apophis in MZONE (placed directly as proxy for "activated trap monster").
        // Expected: Creature Swap NOT in P0's activates (no open MZONE to receive the swap).
        //
        // DEFECT: engine likely offers Creature Swap without checking the dual-zone requirement;
        // the swap activation check doesn't enforce "must have open S/T Zone for a Trap Monster".

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: OJAMA_GREEN,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
            {
              code: OJAMA_GREEN,
              location: OcgLocation.MZONE,
              sequence: 1,
              position: OcgPosition.FACEUP_ATTACK,
            },
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
            {
              code: OJAMA_GREEN,
              location: OcgLocation.MZONE,
              sequence: 4,
              position: OcgPosition.FACEUP_ATTACK,
            },
            {
              code: CREATURE_SWAP,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          extraCards1: [
            // Apophis placed directly in P1's MZONE as proxy for "activated trap monster"
            {
              code: APOPHIS,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
          ],
          startingDrawCount: 1,
          deck0: FILLER.slice(0, 16),
          deck1: FILLER.slice(0, 16),
        });

        const { lib, handle } = currentDuel;
        let activateCodes: number[] = [];

        driveDuel(lib, handle, (_all, msgs, status) => {
          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              activateCodes = (m.activates ?? []).map((a) => a.code);
              return { stop: true };
            }
          }
          if (status !== 1) return {};
          return { response: defaultRespond(msgs as never) };
        });

        // DEFECT: engine offers Creature Swap even with full MZONE (no dual-zone check).
        expect(
          activateCodes.includes(CREATURE_SWAP),
          `R05-B3: Creature Swap [${CREATURE_SWAP}] must NOT appear in activates when all ` +
            `MZones are filled (gaining control of a Trap Monster needs open MZone AND S/T). ` +
            `Got activates: ${JSON.stringify(activateCodes)}`,
        ).toBe(false);
      },
      15_000,
    );

    // ── R05-B4 ────────────────────────────────────────────────────────────────
    it.fails(
      "R05-B4 — Jinzo summoned with face-up Trap Monster: trap monster reverts to S/T Zone",
      async () => {
        // P0 activates Apophis on turn 1 (SZONE[0] → MZONE).
        // P1 normal-summons Jinzo on turn 2 (needs 1 tribute: Ojama Green in MZONE).
        // Jinzo's continuous effect negates all trap effects → Apophis loses its
        // monster-making effect → MOVE Apophis: MZONE → SZONE.

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: APOPHIS,
              location: OcgLocation.SZONE,
              sequence: 0,
              position: OcgPosition.FACEDOWN,
            },
          ],
          extraCards1: [
            { code: JINZO, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
            // Tribute fodder so Jinzo (level 6) can be tribute summoned
            {
              code: OJAMA_GREEN,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
          ],
          startingDrawCount: 1,
          deck0: FILLER.slice(0, 16),
          deck1: FILLER.slice(0, 16),
        });

        const { lib, handle } = currentDuel;

        const state = { apophisActivated: false, jinzoSummoned: false };
        let apophisToSzone = false;
        let turn = 0;

        driveDuel(
          lib,
          handle,
          (_all, msgs, status) => {
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_NEW_TURN) turn++;
            }
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.card === APOPHIS &&
                m.to?.location === OcgLocation.SZONE
              ) {
                apophisToSzone = true;
              }
            }
            if (apophisToSzone) return { stop: true };
            if (status !== 1) return {};

            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                // Turn 1 (P0): activate Apophis
                if (turn === 1 && !state.apophisActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                  if (idx >= 0) {
                    state.apophisActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                // Turn 2 (P1): tribute summon Jinzo (tribute Ojama Green via defaultRespond)
                if (turn === 2 && state.apophisActivated && !state.jinzoSummoned) {
                  const idx = (m.summons ?? []).findIndex((a) => a.code === JINZO);
                  if (idx >= 0) {
                    state.jinzoSummoned = true;
                    return { response: { type: 1, action: 0, index: idx } };
                  }
                }
                return { response: { type: 1, action: 7 } };
              }
            }
            return { response: defaultRespond(msgs as never) };
          },
          8_000,
        );

        expect(
          state.jinzoSummoned,
          `R05-B4: Jinzo [${JINZO}] must be summoned on turn 2. jinzoSummoned: ${state.jinzoSummoned}`,
        ).toBe(true);
        // DEFECT: engine does NOT revert Apophis to SZONE when Jinzo is summoned.
        // Jinzo's continuous effect negates trap card effects on the field, but
        // the ocgcore engine does not implement the trap-monster zone-reversion
        // logic when Jinzo's negate effect fires. Apophis remains in MZONE as a monster.
        // Root cause: missing RESET_EVENT handler in ocgcore that would revert
        // AddMonsterAttribute() state when the controlling effect is negated.
        expect(
          apophisToSzone,
          `R05-B4: Apophis [${APOPHIS}] must MOVE to SZONE when Jinzo negates its trap effect. ` +
            `DEFECT: engine keeps Apophis in MZONE even after Jinzo is summoned. ` +
            `Apophis activated: ${state.apophisActivated}, Jinzo summoned: ${state.jinzoSummoned}.`,
        ).toBe(true);
      },
      20_000,
    );

    // ── R05-B4a ───────────────────────────────────────────────────────────────
    it("R05-B4a — Trap Monster attacks face-down Jinzo: on Jinzo flip it reverts; no damage", async () => {
      // P0 activates Apophis on turn 1. Turn 2 P1 passes. Turn 3 (P0's first BP)
      // P0 attacks P1's face-down Jinzo with Apophis.
      // When Jinzo flips, its continuous effect fires → Apophis reverts to trap card.
      // Expected: no damage calculation (Apophis leaves MZONE before damage step).
      // Observable: P1 LP stays at 8000 (no damage from the battle).
      //
      // P0 is first player → NO Battle Phase on turn 1; first attack is turn 3.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          // Jinzo face-down in MZONE — flips when attacked
          { code: JINZO, location: OcgLocation.MZONE, sequence: 0, position: OcgPosition.FACEDOWN },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = {
        apophisActivated: false,
        movedToBP: false,
        attacked: false,
      };
      let p1DamageTaken = 0;
      let p0DamageTaken = 0;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as DamageMsg[]) {
            if (m.type === MSG_DAMAGE && m.player === 0) p0DamageTaken += m.amount ?? 0;
            if (m.type === MSG_DAMAGE && m.player === 1) p1DamageTaken += m.amount ?? 0;
          }
          // Stop after attack is declared and turn advances past turn 3
          if (state.attacked && turn > 3) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              // Turn 1 (P0): activate Apophis
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              // Turn 3 (P0): go to BP and attack
              if (turn === 3 && state.apophisActivated && !state.movedToBP && m.to_bp) {
                state.movedToBP = true;
                return { response: { type: 1, action: 6 } };
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (
              m.type === MSG_SELECT_BATTLECMD &&
              !state.attacked &&
              (m.attacks?.length ?? 0) > 0
            ) {
              state.attacked = true;
              return { response: { type: 0, action: 1, index: 0 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        12_000,
      );

      // Core assertion: when Jinzo flips and negates Apophis, the battle cancels.
      // Neither player should take battle damage (Apophis is gone before damage step).
      expect(
        state.movedToBP,
        "R05-B4a: Must reach Battle Phase on turn 3 (P0's first BP) to verify this scenario.",
      ).toBe(true);
      expect(
        p1DamageTaken,
        `R05-B4a: P1 must take 0 damage when Apophis reverts before damage step. ` +
          `P1 damage: ${p1DamageTaken}, P0 damage: ${p0DamageTaken}`,
      ).toBe(0);
      expect(
        p0DamageTaken,
        "R05-B4a: P0 must take 0 damage (Apophis reverts, battle cancelled).",
      ).toBe(0);
    }, 25_000);

    // ── R05-B4b ───────────────────────────────────────────────────────────────
    it.fails(
      "R05-B4b — Snatch Steal on Trap Monster: when Jinzo summoned it returns to OWNER's S/T Zone",
      async () => {
        // P0 activates Apophis (turn 1, SZONE[0] → MZONE). P1 activates Snatch Steal
        // from hand on turn 2, targeting Apophis. P1 now controls Apophis.
        // Turn 3 (P0): P0 tribute-summons Jinzo.
        // Jinzo negates trap effects → Apophis reverts, Snatch Steal negated.
        // Expected: Apophis returns to P0's SZONE[0] (owner's zone, not controller's).
        //
        // DEFECT: engine likely sends Apophis to the current controller's (P1's) zone
        // instead of the owner's zone (P0's). Ownership tracking for revert is complex.

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: APOPHIS,
              location: OcgLocation.SZONE,
              sequence: 0,
              position: OcgPosition.FACEDOWN,
            },
            { code: JINZO, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
            // Tribute fodder for Jinzo
            {
              code: OJAMA_GREEN,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
          ],
          extraCards1: [
            {
              code: SNATCH_STEAL,
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

        const state = {
          apophisActivated: false,
          snatchActivated: false,
          jinzoSummoned: false,
        };
        let apophisToSzone = false;
        let turn = 0;

        driveDuel(
          lib,
          handle,
          (_all, msgs, status) => {
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_NEW_TURN) turn++;
            }
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.card === APOPHIS &&
                m.to?.location === OcgLocation.SZONE
              ) {
                apophisToSzone = true;
              }
            }
            if (apophisToSzone) return { stop: true };
            if (status !== 1) return {};

            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                if (turn === 1 && !state.apophisActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                  if (idx >= 0) {
                    state.apophisActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                if (turn === 2 && !state.snatchActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === SNATCH_STEAL);
                  if (idx >= 0) {
                    state.snatchActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                if (turn === 3 && !state.jinzoSummoned) {
                  const idx = (m.summons ?? []).findIndex((a) => a.code === JINZO);
                  if (idx >= 0) {
                    state.jinzoSummoned = true;
                    return { response: { type: 1, action: 0, index: idx } };
                  }
                }
                return { response: { type: 1, action: 7 } };
              }
            }
            return { response: defaultRespond(msgs as never) };
          },
          20_000,
        );

        // DEFECT: engine sends Apophis to controller (P1) zone not owner (P0) zone.
        expect(
          apophisToSzone,
          "R05-B4b: Apophis must return to P0 (owner) SZONE when Jinzo negates its trap effect — " +
            "regardless of Snatch Steal giving control to P1.",
        ).toBe(true);
      },
      30_000,
    );

    // ── R05-B5 ────────────────────────────────────────────────────────────────
    it("R05-B5 — Book of Moon on face-up Trap Monster: card returns to S/T Zone (not MZONE face-down)", async () => {
      // P0 activates Apophis (turn 1). Turn 2 P1 activates Book of Moon targeting Apophis.
      // Expected: Apophis MOVE to SZONE (reverts to face-down trap card), NOT stays in MZONE.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: BOOK_OF_MOON,
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

      const state = { apophisActivated: false, bookActivated: false };
      let apophisToSzone = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === APOPHIS && m.to?.location === OcgLocation.SZONE) {
              apophisToSzone = true;
            }
          }
          if (state.bookActivated && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && state.apophisActivated && !state.bookActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === BOOK_OF_MOON);
                if (idx >= 0) {
                  state.bookActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        apophisToSzone,
        `R05-B5: Apophis [${APOPHIS}] must MOVE to SZONE (revert to trap) when Book of Moon targets it. ` +
          `MOVE to SZONE observed: ${apophisToSzone}`,
      ).toBe(true);
    }, 20_000);

    // ── R05-B5a ───────────────────────────────────────────────────────────────
    it.fails(
      "R05-B5a — opponent controls Apophis; flipped face-down goes to CONTROLLER's (not owner's) S/T Zone",
      async () => {
        // P1 controls P0's Apophis (via Snatch Steal). Book of Moon flips Apophis face-down.
        // Expected: Apophis goes to P1's (current controller's) SZONE.
        // Contrast with B4b where Jinzo revert goes to OWNER's zone (P0).
        //
        // DEFECT: engine either: (a) puts Apophis in owner's (P0's) zone, or
        // (b) doesn't perform zone reversion at all (stays in MZONE face-down).

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: APOPHIS,
              location: OcgLocation.SZONE,
              sequence: 0,
              position: OcgPosition.FACEDOWN,
            },
            {
              code: BOOK_OF_MOON,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          extraCards1: [
            {
              code: SNATCH_STEAL,
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

        const state = {
          apophisActivated: false,
          snatchActivated: false,
          bookActivated: false,
        };
        let apophisToSzone = false;
        let turn = 0;

        driveDuel(
          lib,
          handle,
          (_all, msgs, status) => {
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_NEW_TURN) turn++;
            }
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.card === APOPHIS &&
                m.to?.location === OcgLocation.SZONE
              ) {
                apophisToSzone = true;
              }
            }
            if (state.bookActivated && turn > 3) return { stop: true };
            if (status !== 1) return {};

            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                if (turn === 1 && !state.apophisActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                  if (idx >= 0) {
                    state.apophisActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                if (turn === 2 && !state.snatchActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === SNATCH_STEAL);
                  if (idx >= 0) {
                    state.snatchActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                if (turn === 3 && !state.bookActivated) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === BOOK_OF_MOON);
                  if (idx >= 0) {
                    state.bookActivated = true;
                    return { response: { type: 1, action: 5, index: idx } };
                  }
                }
                return { response: { type: 1, action: 7 } };
              }
            }
            return { response: defaultRespond(msgs as never) };
          },
          20_000,
        );

        // DEFECT: engine uses wrong zone (owner vs controller distinction not implemented for Book of Moon).
        expect(
          apophisToSzone,
          "R05-B5a: Apophis must go to CURRENT CONTROLLER's (P1's) SZONE when flipped face-down " +
            "— DEFECT: engine likely keeps it in MZONE or uses owner's zone.",
        ).toBe(true);
      },
      25_000,
    );

    // ── R05-B6a ───────────────────────────────────────────────────────────────
    it("R05-B6a — Heavy Storm vs Trap Monster: Fake Trap CAN prevent destruction", async () => {
      // P0 has Apophis activated (MZONE + SZONE[0]) + Fake Trap face-down in SZONE[1].
      // P1 activates Heavy Storm. P0 chains Fake Trap.
      // Fake Trap protects trap cards on the field from being destroyed.
      // Since Apophis is a trap-type card (even as a monster), Fake Trap applies.
      // Expected: Apophis NOT in movesToGrave after Heavy Storm resolves.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: FAKE_TRAP,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: HEAVY_STORM,
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

      const state = { apophisActivated: false, heavyStormActivated: false };
      const movesToGrave: number[] = [];
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
              movesToGrave.push(m.card);
            }
          }
          if (state.heavyStormActivated && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && !state.heavyStormActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === HEAVY_STORM);
                if (idx >= 0) {
                  state.heavyStormActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          // P0 chains Fake Trap when offered chain
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN) {
              const fakeTrapIdx = (m.selects ?? []).findIndex((s) => s.code === FAKE_TRAP);
              if (fakeTrapIdx >= 0) {
                return { response: { type: 8, index: fakeTrapIdx } };
              }
              return { response: { type: 8, index: null } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        movesToGrave.includes(APOPHIS),
        `R05-B6a: Apophis [${APOPHIS}] must NOT be destroyed when Fake Trap chains to Heavy Storm. ` +
          `Cards to GRAVE: ${JSON.stringify(movesToGrave)}`,
      ).toBe(false);
    }, 20_000);

    // ── R05-B6b ───────────────────────────────────────────────────────────────
    it("R05-B6b — Lightning Vortex vs Trap Monster: My Body as a Shield CAN prevent destruction", async () => {
      // P0 has Apophis activated (MZONE) + My Body as a Shield SET in SZONE[1].
      // P1 activates Lightning Vortex (destroys all face-up monsters).
      // P0 chains My Body as a Shield.
      // Expected: Apophis NOT destroyed (My Body treats Apophis as a monster here).
      //
      // Fix note: My Body must be SET (face-down SZONE) to chain during the opponent's
      // Main Phase in GOAT/Edison mode — Quick-Play Spells from HAND cannot be activated
      // during the opponent's turn in this engine.  The edison override c69279219.lua
      // keeps EFFECT_FLAG_DAMAGE_STEP (required for SZONE activation during opponent's
      // chain window) and adds a Duel.IsDamageStep() guard to enforce the Edison ruling
      // that My Body cannot activate in the Damage Step.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: MY_BODY,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: LIGHTNING_VORTEX,
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
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { apophisActivated: false, lvActivated: false };
      const movesToGrave: number[] = [];
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
              movesToGrave.push(m.card);
            }
          }
          if (state.lvActivated && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && !state.lvActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === LIGHTNING_VORTEX);
                if (idx >= 0) {
                  state.lvActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN) {
              const myBodyIdx = (m.selects ?? []).findIndex((s) => s.code === MY_BODY);
              if (myBodyIdx >= 0) {
                return { response: { type: 8, index: myBodyIdx } };
              }
              return { response: { type: 8, index: null } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        movesToGrave.includes(APOPHIS),
        `R05-B6b: Apophis [${APOPHIS}] must NOT be destroyed when My Body as a Shield chains to Lightning Vortex. ` +
          `Cards to GRAVE: ${JSON.stringify(movesToGrave)}`,
      ).toBe(false);
    }, 20_000);

    // ── R05-B6c ───────────────────────────────────────────────────────────────
    it("R05-B6c — Raigeki Break vs Trap Monster: My Body as a Shield CAN prevent destruction", async () => {
      // Raigeki Break says "destroy 1 card on field" — it can target both monsters
      // and traps. My Body as a Shield negates destruction of monsters.
      // Expected: Apophis NOT destroyed when My Body chains to Raigeki Break.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          { code: MY_BODY, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        extraCards1: [
          {
            code: RAIGEKI_BREAK,
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
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { apophisActivated: false, raigekiActivated: false };
      const movesToGrave: number[] = [];
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
              movesToGrave.push(m.card);
            }
          }
          if (state.raigekiActivated && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && !state.raigekiActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === RAIGEKI_BREAK);
                if (idx >= 0) {
                  state.raigekiActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN) {
              const myBodyIdx = (m.selects ?? []).findIndex((s) => s.code === MY_BODY);
              if (myBodyIdx >= 0) {
                return { response: { type: 8, index: myBodyIdx } };
              }
              return { response: { type: 8, index: null } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        movesToGrave.includes(APOPHIS),
        `R05-B6c: Apophis [${APOPHIS}] must NOT be destroyed when My Body as a Shield chains to Raigeki Break. ` +
          `Cards to GRAVE: ${JSON.stringify(movesToGrave)}`,
      ).toBe(false);
    }, 20_000);

    // ── R05-B7 ────────────────────────────────────────────────────────────────
    it("R05-B7 — Trap Monster leaving the field goes to GY as a Trap Card (MSG_MOVE to GRAVE)", async () => {
      // When Apophis (activated as a trap monster) is destroyed, it must go to GRAVE.
      // Observable: MSG_MOVE card=APOPHIS to.location=GRAVE after Heavy Storm resolves.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: HEAVY_STORM,
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

      const state = { apophisActivated: false, stormActivated: false };
      let apophisToGrave = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === APOPHIS && m.to?.location === OcgLocation.GRAVE) {
              apophisToGrave = true;
            }
          }
          if (apophisToGrave) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && !state.stormActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === HEAVY_STORM);
                if (idx >= 0) {
                  state.stormActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        apophisToGrave,
        `R05-B7: Apophis [${APOPHIS}] must MOVE to GRAVE when destroyed (leaves field as Trap Card).`,
      ).toBe(true);
    }, 20_000);

    // ── R05-B7a ───────────────────────────────────────────────────────────────
    it("R05-B7a — Trap Monster in GY: Time Machine cannot target it (not revivable as a monster)", async () => {
      // Apophis is destroyed in battle by P1's stronger monster (STRONG_NORMAL = 2000 ATK).
      // P1 attacks P0's Apophis (1600 ATK, ATK position) on turn 2 (P1's first turn with BP).
      // Time Machine (in P0's SZONE face-down) triggers on EVENT_BATTLE_DESTROYED.
      // Its target check: tc:IsCanBeSpecialSummoned(...) — for a TRAP type card, this fails.
      // Expected: Time Machine NOT offered after Apophis is destroyed in battle.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: TIME_MACHINE,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          // 2000 ATK monster to destroy Apophis (1600 ATK) — no script needed (normal monster)
          {
            code: STRONG_NORMAL,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { apophisActivated: false, movedToBP: false, attacked: false };
      const chainOffersAfterBattle: number[][] = [];
      let battleSeen = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
            if (m.type === 111 /* BATTLE */) battleSeen = true;
          }
          if (battleSeen) {
            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN) {
                chainOffersAfterBattle.push((m.selects ?? []).map((s) => s.code));
              }
            }
          }
          if (state.attacked && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              // Turn 1 (P0): activate Apophis
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              // Turn 2 (P1): go to BP and attack P0's Apophis
              if (turn === 2 && state.apophisActivated && !state.movedToBP && m.to_bp) {
                state.movedToBP = true;
                return { response: { type: 1, action: 6 } };
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (
              m.type === MSG_SELECT_BATTLECMD &&
              !state.attacked &&
              (m.attacks?.length ?? 0) > 0
            ) {
              state.attacked = true;
              return { response: { type: 0, action: 1, index: 0 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        12_000,
      );

      const timeMachineOffered = chainOffersAfterBattle.some((offers) =>
        offers.includes(TIME_MACHINE),
      );

      expect(
        timeMachineOffered,
        `R05-B7a: Time Machine [${TIME_MACHINE}] must NOT be offered after Apophis [${APOPHIS}] ` +
          `is destroyed in battle — it is a Trap Card in GY, not revivable as a monster. ` +
          `Chain offers after battle: ${JSON.stringify(chainOffersAfterBattle)}`,
      ).toBe(false);
    }, 20_000);

    // ── R05-B7a (Michizure) ───────────────────────────────────────────────────
    it("R05-B7a (Michizure) — Michizure does NOT activate when a Trap Monster goes to GY", async () => {
      // Michizure (EVENT_TO_GRAVE) condition: eg:IsExists(filter) where filter checks
      // c:IsMonster() and c:IsPreviousLocation(LOCATION_MZONE).
      // Apophis (trap monster) leaves MZONE → goes to GY as TRAP type → IsMonster()=false.
      // Expected: Michizure NOT offered in SELECT_CHAIN when Apophis is destroyed.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: MICHIZURE,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: HEAVY_STORM,
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

      const state = { apophisActivated: false, stormActivated: false };
      let michizureOffered = false;
      let apophisToGrave = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === APOPHIS && m.to?.location === OcgLocation.GRAVE) {
              apophisToGrave = true;
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && apophisToGrave) {
              if ((m.selects ?? []).some((s) => s.code === MICHIZURE)) {
                michizureOffered = true;
              }
            }
          }
          if (apophisToGrave && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && !state.stormActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === HEAVY_STORM);
                if (idx >= 0) {
                  state.stormActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        apophisToGrave,
        `R05-B7a (Michizure): Apophis must go to GRAVE so Michizure trigger can be tested.`,
      ).toBe(true);
      expect(
        michizureOffered,
        `R05-B7a (Michizure): Michizure [${MICHIZURE}] must NOT be offered when Apophis [${APOPHIS}] ` +
          `goes to GY — Apophis is a Trap type, not IsMonster(). ` +
          `michizureOffered: ${michizureOffered}`,
      ).toBe(false);
    }, 20_000);

    // ── R05-B7b ───────────────────────────────────────────────────────────────
    it("R05-B7b — Caius banishes Zoma the Spirit (Trap Monster): NO 1000 burn damage inflicted", async () => {
      // Turn 1 (P0): Zoma activated from SZONE[0] (1800 ATK Zombie, DARK).
      // Turn 2 (P1): Caius tribute-summoned (tribute Ojama Green in MZONE).
      // Caius's effect: banish a card; if it's a DARK monster, deal 1000 damage.
      // Zoma is DARK/Zombie/1800/500 as a monster, but leaves field as a TRAP.
      // Caius's script: tc:IsMonster() && tc:IsAttribute(DARK) — for a trap in REMOVED zone,
      // IsMonster() should return false → no burn damage.
      // Expected: P0 LP = 8000 (no 1000 burn from Caius).

      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: ZOMA, location: OcgLocation.SZONE, sequence: 0, position: OcgPosition.FACEDOWN },
        ],
        extraCards1: [
          { code: CAIUS, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
          // Tribute fodder for Caius (level 6 needs 1 tribute)
          {
            code: OJAMA_GREEN,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { zomaActivated: false, caiusSummoned: false };
      let p0DamageTaken = 0;
      let caiusSummonSeen = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
            if (m.type === MSG_SUMMONED) caiusSummonSeen = true;
          }
          for (const m of msgs as DamageMsg[]) {
            if (m.type === MSG_DAMAGE && m.player === 0) {
              p0DamageTaken += m.amount ?? 0;
            }
          }
          if (caiusSummonSeen && state.caiusSummoned && turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.zomaActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === ZOMA);
                if (idx >= 0) {
                  state.zomaActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 2 && state.zomaActivated && !state.caiusSummoned) {
                const idx = (m.summons ?? []).findIndex((a) => a.code === CAIUS);
                if (idx >= 0) {
                  state.caiusSummoned = true;
                  return { response: { type: 1, action: 0, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        state.caiusSummoned,
        `R05-B7b: Caius [${CAIUS}] must be summoned on turn 2. ` +
          `caiusSummoned: ${state.caiusSummoned}, caiusSummonSeen: ${caiusSummonSeen}`,
      ).toBe(true);
      expect(
        p0DamageTaken,
        `R05-B7b: P0 must receive NO burn damage when Caius banishes Zoma [${ZOMA}] — ` +
          `Zoma is a Trap Card when removed (not a DARK monster). ` +
          `P0 damage taken: ${p0DamageTaken}`,
      ).toBe(0);
    }, 20_000);

    // ── R05-B7c ───────────────────────────────────────────────────────────────
    it("R05-B7c — Penguin Soldier bounces Trap Monster: returns to hand as a Trap Card", async () => {
      // P0 activates Apophis (turn 1, SZONE[0] → MZONE).
      // Turn 2 (P1): end phase.
      // Turn 3 (P0): P0 goes to BP. P0 attacks P1's face-down Penguin Soldier with Apophis.
      // Apophis (1600 ATK) vs Penguin Soldier (2000 DEF): neither destroyed; Apophis takes
      // 400 LP damage. After damage step, Penguin Soldier's flip TRIGGER_O fires.
      // P1 selects Apophis (index 0) to return to HAND.
      // Expected: MOVE card=APOPHIS to.location=HAND.
      // (P0 is first player → no Battle Phase turn 1; first attack is turn 3.)

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        extraCards1: [
          {
            code: PENGUIN_SOLDIER,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = {
        apophisActivated: false,
        movedToBP: false,
        attacked: false,
      };
      let apophisToHand = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === APOPHIS && m.to?.location === OcgLocation.HAND) {
              apophisToHand = true;
            }
          }
          if (apophisToHand) return { stop: true };
          if (state.attacked && turn > 3) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              // Turn 1 (P0): activate Apophis
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              // Turn 3 (P0): go to BP
              if (turn === 3 && state.apophisActivated && !state.movedToBP && m.to_bp) {
                state.movedToBP = true;
                return { response: { type: 1, action: 6 } };
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (
              m.type === MSG_SELECT_BATTLECMD &&
              !state.attacked &&
              (m.attacks?.length ?? 0) > 0
            ) {
              state.attacked = true;
              return { response: { type: 0, action: 1, index: 0 } };
            }
          }

          // Accept SELECT_CHAIN for Penguin Soldier's flip TRIGGER_O effect.
          // defaultRespond always declines chains; we must explicitly accept here.
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && state.attacked) {
              const pSoldierIdx = (m.selects ?? []).findIndex((s) => s.code === PENGUIN_SOLDIER);
              if (pSoldierIdx >= 0) {
                return { response: { type: 8, index: pSoldierIdx } };
              }
            }
          }

          // Also accept SELECT_EFFECTYN for Penguin Soldier's optional flip trigger
          for (const m of msgs as Array<{
            type: number;
            code?: number;
            card?: { code?: number };
          }>) {
            if (m.type === 12 /* SELECT_EFFECTYN */ && state.attacked) {
              // Accept the effect (Penguin Soldier's bounce)
              return { response: { type: 2, yes: true } };
            }
          }

          // Handle SELECT_UNSELECT_CARD (type 26) for Penguin Soldier's target selection
          for (const m of msgs as Array<{
            type: number;
            select_cards?: Array<{ code: number }>;
          }>) {
            if (m.type === 26 /* SELECT_UNSELECT_CARD */ && state.attacked) {
              const selectCards = m.select_cards ?? [];
              return { response: { type: 7, index: selectCards.length > 0 ? 0 : -1 } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        state.movedToBP,
        "R05-B7c: Must reach Battle Phase on turn 3 (P0's first BP) to test Penguin Soldier bounce.",
      ).toBe(true);
      expect(
        apophisToHand,
        `R05-B7c: Apophis [${APOPHIS}] must move to HAND when bounced by Penguin Soldier [${PENGUIN_SOLDIER}]. ` +
          `MOVE to HAND observed: ${apophisToHand}. movedToBP: ${state.movedToBP}, attacked: ${state.attacked}`,
      ).toBe(true);
    }, 25_000);

    // ── R05-B7d ───────────────────────────────────────────────────────────────
    it("R05-B7d — IMT temporarily removes Trap Monster: on return it is destroyed immediately", async () => {
      // P0 activates Apophis (turn 1, SZONE[0] → MZONE) then immediately activates
      // Interdimensional Matter Transporter on Apophis.
      // IMT temporarily removes Apophis until End Phase, then returns it to MZONE.
      // On return: Apophis cannot re-establish dual-zone (MZONE + SZONE) → destroyed.
      // Expected: MOVE card=APOPHIS to.location=GRAVE after End Phase return.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          { code: IMT, location: OcgLocation.SZONE, sequence: 1, position: OcgPosition.FACEDOWN },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { apophisActivated: false, imtActivated: false };
      let apophisRemoved = false;
      let apophisToGraveAfterReturn = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === APOPHIS) {
              if (m.to?.location === OcgLocation.REMOVED) apophisRemoved = true;
              if (apophisRemoved && m.to?.location === OcgLocation.GRAVE) {
                apophisToGraveAfterReturn = true;
              }
            }
          }
          if (apophisToGraveAfterReturn) return { stop: true };
          if (turn > 3) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 1 && state.apophisActivated && !state.imtActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === IMT);
                if (idx >= 0) {
                  state.imtActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        apophisToGraveAfterReturn,
        `R05-B7d: Apophis [${APOPHIS}] must be destroyed (MOVE to GRAVE) when returned by IMT — ` +
          `it cannot re-establish as a Trap Monster on return. ` +
          `Removed: ${apophisRemoved}, Returned to GRAVE: ${apophisToGraveAfterReturn}`,
      ).toBe(true);
    }, 20_000);

    // ── R05-B7d (Dimensionhole) ────────────────────────────────────────────────
    it("R05-B7d (Dimensionhole) — Dimensionhole removes Trap Monster: MZONE blocked, S/T zone free", async () => {
      // P0 activates Apophis (turn 1), then Dimensionhole on Apophis (turn 1 MP).
      // While Apophis is removed: MZONE[0] is DISABLED (EFFECT_DISABLE_FIELD via Dimensionhole
      // script), SZONE[0] becomes free (Apophis not occupying it).
      // Observable: MSG_FIELD_DISABLED (type 56) after Dimensionhole resolves.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: APOPHIS,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
          {
            code: DIMENSIONHOLE,
            location: OcgLocation.SZONE,
            sequence: 1,
            position: OcgPosition.FACEDOWN,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;

      const state = { apophisActivated: false, dimholeActivated: false };
      let apophisRemoved = false;
      let fieldDisabledSeen = false;
      let turn = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
            if (m.type === 56 /* FIELD_DISABLED */) fieldDisabledSeen = true;
          }
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === APOPHIS &&
              m.to?.location === OcgLocation.REMOVED
            ) {
              apophisRemoved = true;
            }
          }
          if (apophisRemoved && fieldDisabledSeen) return { stop: true };
          if (turn > 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (turn === 1 && !state.apophisActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === APOPHIS);
                if (idx >= 0) {
                  state.apophisActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              if (turn === 1 && state.apophisActivated && !state.dimholeActivated) {
                const idx = (m.activates ?? []).findIndex((a) => a.code === DIMENSIONHOLE);
                if (idx >= 0) {
                  state.dimholeActivated = true;
                  return { response: { type: 1, action: 5, index: idx } };
                }
              }
              return { response: { type: 1, action: 7 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      expect(
        apophisRemoved,
        `R05-B7d (Dimensionhole): Apophis [${APOPHIS}] must be temporarily removed (MOVE to REMOVED). ` +
          `Removed: ${apophisRemoved}`,
      ).toBe(true);
      expect(
        fieldDisabledSeen,
        `R05-B7d (Dimensionhole): FIELD_DISABLED (msg 56) must be emitted when Apophis's MZONE ` +
          `is blocked by Dimensionhole's EFFECT_DISABLE_FIELD. Seen: ${fieldDisabledSeen}`,
      ).toBe(true);
    }, 20_000);
  },
);
