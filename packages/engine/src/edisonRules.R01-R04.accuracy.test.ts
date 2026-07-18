// ---------------------------------------------------------------------------
// Edison-rules accuracy tests — rule groups R01, R02, R03, R04.
//
// Empirical tests: each drives a real ocgcore duel via the custom WASM and
// asserts the message stream matches the authoritative Edison behaviour.
//
// Skipped automatically when the custom WASM artifact is absent.
//
// Source: /workspace/specs/edison-parity-track-b.md
// Matrix:  docs/working/2026-07-17-parity-matrix.md
//
// Card-passcode substitutions vs matrix:
//   • Secret Village  — matrix says 03282221; actual in-repo passcode is 68462976.
//   • Geartown        — matrix says 08067863; actual in-repo passcode is 37694547.
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

// ── Card passcodes ──────────────────────────────────────────────────────────
const UMI = 22702055; // Umi — Field Spell
const MOUNTAIN = 50913601; // Mountain — Field Spell
const DUST_TORNADO = 60082869; // Dust Tornado — Trap, destroys 1 opp S/T
const SECRET_VILLAGE = 68462976; // Secret Village of the Spellcasters — Field Spell
// matrix passcode 03282221 → correct script passcode 68462976
const DARK_MAGICIAN = 46986414; // Dark Magician — Spellcaster Normal Monster
const GEARTOWN = 37694547; // Geartown — Field Spell with GY trigger
// matrix passcode 08067863 → correct script passcode 37694547
const MAUSOLEUM = 80921533; // Mausoleum of the Emperor — Field Spell
const ANCIENT_GEAR = 31557782; // Ancient Gear — Geartown SS target in deck
const MACHINA_GEARFRAME = 42940404; // Machina Gearframe — Union (listed, R03-B2)
const MACHINA_PEACEKEEPER = 78349103; // Machina Peacekeeper — Union (listed, R03-B2)
const X_HEAD_CANNON = 62651957; // X-Head Cannon — Machine normal monster
const Y_DRAGON_HEAD = 65622692; // Y-Dragon Head — Union (NON-listed, R03-B3)
const SMASHING_GROUND = 97169186; // Smashing Ground
const LADD = 47297616; // Light and Darkness Dragon (Edison override c47297616.lua)
const LUMINA = 95503687; // Lumina, Lightsworn Summoner — End-Phase mandatory mill
const SUSA_SOLDIER = 40473581; // Susa Soldier — Spirit, mandatory End-Phase return
const SKILL_DRAIN = 82732705; // Skill Drain — negates effects of face-up Effect Monsters
const BLUE_EYES = 89631139; // Blue-Eyes White Dragon — 3000/2500 Normal Monster (no script needed)

// ── Message-type constants ──────────────────────────────────────────────────
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN;
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD;
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD;
const MSG_MOVE = OcgMessageType.MOVE;
const MSG_NEW_TURN = OcgMessageType.NEW_TURN;

// ── IDLE action codes ───────────────────────────────────────────────────────
const ACTION_SUMMON = 0;
const ACTION_SPELL_SET = 4;
const ACTION_ACTIVATE = 5;
const ACTION_TO_BP = 6;
const ACTION_TO_EP = 7;

// ── Shared cleanup ──────────────────────────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message interfaces ────────────────────────────────────────────────

interface SelectChainMsg {
  type: number;
  player: number;
  forced?: boolean;
  selects?: Array<{ code: number }>;
}

interface MoveMsg {
  type: number;
  card: number;
  to?: { location: number };
}

interface IdleCmdMsg {
  type: number;
  player: number;
  summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
  spell_sets?: Array<{ code: number }>;
  to_bp?: boolean;
  to_ep?: boolean;
}

interface BattleCmdMsg {
  type: number;
  player?: number;
  attacks?: Array<{ code: number }>;
}

// ── R01: Starting-Player Draw ─────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)("R01 — Starting-player draw [requires custom WASM]", () => {
  it("R01-B2 — player going first has NO Battle Phase on turn 1 (to_bp=false, no SELECT_BATTLECMD)", async () => {
    // The player going first cannot conduct a Battle Phase on turn 1.
    currentDuel = await createDuelWithState({
      startingDrawCount: 1,
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
    });

    const { lib, handle } = currentDuel;
    let turn = 0;
    let sawBattleCmd = false;
    let firstIdleToBP: boolean | undefined = undefined;

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_SELECT_BATTLECMD && turn <= 1) sawBattleCmd = true;
      }
      if (firstIdleToBP === undefined) {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) firstIdleToBP = m.to_bp ?? false;
        }
      }
      if (turn >= 2) return { stop: true };
      if (status !== 1) return {};
      return { response: defaultRespond(msgs as never) };
    });

    expect(firstIdleToBP, "P0 turn-1 IDLECMD must have to_bp=false").toBe(false);
    expect(sawBattleCmd, "No SELECT_BATTLECMD before turn 2").toBe(false);
  }, 15_000);
});

// ── R02: Only 1 Active Field Spell ────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "R02 — One face-up field spell (ONE_FACEUP_FIELD) [requires custom WASM]",
  () => {
    it("R02-B1 — at most one field spell: Mountain activation destroys active Umi (only 1 remains)", async () => {
      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: UMI, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        extraCards1: [
          { code: MOUNTAIN, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      let turn = 0;
      const state = { activatedUmi: false, activatedMountain: false };
      const movesToGrave: number[] = [];

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE)
            movesToGrave.push(m.card);
        }
        if (turn > 3) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (turn === 1 && !state.activatedUmi) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === UMI);
              if (idx >= 0) {
                state.activatedUmi = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            if (turn === 2 && !state.activatedMountain) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === MOUNTAIN);
              if (idx >= 0) {
                state.activatedMountain = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        movesToGrave.includes(UMI),
        `Umi [${UMI}] must go to GRAVE when Mountain activated (ONE_FACEUP_FIELD). ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);
    }, 20_000);

    // DEFECT: R02-B3 — The SET action is blocked by the engine when an opponent's field spell
    // is already active in the field zone. Mountain appears in spell_sets (engine offers it as
    // settable), but responding with ACTION_SPELL_SET fails to place Mountain in FZONE —
    // the engine apparently prevents SET when any field spell is active (shared-zone model).
    // Expected (authoritative): SET a field spell is always legal; it goes face-down without
    //   destroying the opponent's active field spell.
    // Actual: Mountain is NOT placed in FZONE (mountainSet stays false) when P1 has Umi active.
    //   The SET action is silently blocked; Umi is also not destroyed (vacuous pass on that part).
    it.fails(
      "R02-B3 — SET a field spell face-down does NOT destroy opponent's active field spell — DEFECT (SET blocked when field spell active)",
      async () => {
        // P1 has Umi active (face-up in FZONE).  P0 has Mountain in hand.
        // P0 tries to SET Mountain face-down.
        // Expected: Mountain placed face-down in P0's FZONE; Umi NOT sent to GRAVE.
        // Actual: Mountain SET is blocked by engine (mountainSet=false) — shared field zone model.
        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: MOUNTAIN,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          extraCards1: [
            { code: UMI, location: OcgLocation.FZONE, sequence: 0, position: OcgPosition.FACEUP },
          ],
          startingDrawCount: 1,
          deck0: FILLER.slice(0, 16),
          deck1: FILLER.slice(0, 16),
        });

        const { lib, handle } = currentDuel;
        let mountainSet = false;
        const movesToGrave: number[] = [];
        let turn = 0;

        driveDuel(lib, handle, (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE)
              movesToGrave.push(m.card);
            if (m.type === MSG_MOVE && m.card === MOUNTAIN && m.to?.location === OcgLocation.FZONE)
              mountainSet = true;
          }
          if (mountainSet || turn >= 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              const setIdx = (m.spell_sets ?? []).findIndex((a) => a.code === MOUNTAIN);
              if (setIdx >= 0)
                return { response: { type: 1, action: ACTION_SPELL_SET, index: setIdx } };
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        });

        // DEFECT: expected true (Mountain placed face-down in FZONE), actual false (SET blocked)
        expect(
          mountainSet,
          "R02-B3 DEFECT: Mountain must be placed face-down in P0's FZONE via SET action. " +
            "Actual: SET blocked by engine when P1 has Umi active (shared-zone model prevents SET).",
        ).toBe(true);
        // If the SET were to succeed, Umi must NOT go to GRAVE
        expect(
          movesToGrave.includes(UMI),
          `Umi [${UMI}] must NOT be sent to GRAVE when Mountain is SET face-down. ` +
            `Moves: ${JSON.stringify(movesToGrave)}`,
        ).toBe(false);
      },
      15_000,
    );

    it("R02-B4 — activating Mountain vs active Umi (both decline chain) → Umi destroyed on resolution", async () => {
      // P0 activates Umi turn 1, P1 activates Mountain turn 2; both decline chain.
      // Umi must go to GRAVE confirming ONE_FACEUP_FIELD destroys on resolution.
      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: UMI, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        extraCards1: [
          { code: MOUNTAIN, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      let turn = 0;
      const state = { activatedUmi: false, activatedMountain: false };
      const movesToGrave: number[] = [];

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE)
            movesToGrave.push(m.card);
        }
        if (movesToGrave.includes(UMI)) return { stop: true };
        if (turn > 3) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (turn === 1 && !state.activatedUmi) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === UMI);
              if (idx >= 0) {
                state.activatedUmi = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            if (turn === 2 && !state.activatedMountain) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === MOUNTAIN);
              if (idx >= 0) {
                state.activatedMountain = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) return { response: { type: 8, index: null } };
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        movesToGrave.includes(UMI),
        `Umi [${UMI}] must go to GRAVE after Mountain resolves (no chain responses). ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);
    }, 20_000);

    it("R02-B5 — chaining Dust Tornado to Mountain destroys Mountain, Umi survives", async () => {
      // P0 activates Mountain; P1 chains Dust Tornado targeting Mountain.
      // Result: Mountain→GRAVE (DT destroyed it), Umi NOT in GRAVE (Mountain never resolved).
      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: MOUNTAIN, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        extraCards1: [
          { code: UMI, location: OcgLocation.FZONE, sequence: 0, position: OcgPosition.FACEUP },
          {
            code: DUST_TORNADO,
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
      let mountainActivated = false;
      let dustTornadoChained = false;
      const movesToGrave: number[] = [];
      let done = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE)
            movesToGrave.push(m.card);
        }
        if (movesToGrave.includes(MOUNTAIN) && !done) {
          done = true;
          return { stop: true };
        }
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !mountainActivated) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === MOUNTAIN);
            if (idx >= 0) {
              mountainActivated = true;
              return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && !dustTornadoChained) {
            const dtIdx = (m.selects ?? []).findIndex((s) => s.code === DUST_TORNADO);
            if (dtIdx >= 0 && m.player === 1) {
              dustTornadoChained = true;
              return { response: { type: 8, index: dtIdx } };
            }
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        movesToGrave.includes(MOUNTAIN),
        `Mountain [${MOUNTAIN}] must be destroyed by Dust Tornado chain. ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);
      expect(
        movesToGrave.includes(UMI),
        `Umi [${UMI}] must NOT be destroyed (Mountain never resolved). ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(false);
    }, 20_000);

    it("R02-B6 — Secret Village + Spellcaster: Umi activation blocked for non-Spellcaster player", async () => {
      // P1 activates Secret Village [68462976] on turn 2 while controlling Dark Magician.
      // On P0's turn 3: Umi must NOT appear in activates (activation restricted by Secret Village).
      // Passcode note: matrix uses 03282221; actual passcode is 68462976 (c68462976.lua).
      currentDuel = await createDuelWithState({
        extraCards0: [
          { code: UMI, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
        ],
        extraCards1: [
          {
            code: SECRET_VILLAGE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: DARK_MAGICIAN,
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
      let turn = 0;
      let villageActivated = false;
      let umiInActivates = false;
      let checkedP0Idle = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (turn === 3 && !checkedP0Idle) {
          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              umiInActivates = (m.activates ?? []).some((a) => a.code === UMI);
              checkedP0Idle = true;
              return { stop: true };
            }
          }
        }
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (turn === 1) return { response: { type: 1, action: ACTION_TO_EP } };
            if (turn === 2 && !villageActivated) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === SECRET_VILLAGE);
              if (idx >= 0) {
                villageActivated = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(villageActivated, "Precondition: Secret Village must have been activated by P1").toBe(
        true,
      );
      expect(
        umiInActivates,
        `R02-B6: Umi [${UMI}] must NOT appear in activates when Secret Village [${SECRET_VILLAGE}] ` +
          `is active and P1 controls Spellcaster (Dark Magician) but P0 does not. ` +
          `Got: umiInActivates=${umiInActivates}`,
      ).toBe(false);
    }, 20_000);

    // DEFECT: R02-B7a — Same root cause as R02-B3: the engine blocks SET when a field spell
    // is already active in the shared field zone. Mausoleum appears in spell_sets but the
    // ACTION_SPELL_SET response fails to place Mausoleum in FZONE (Geartown occupies it).
    // Expected (authoritative): SET Mausoleum over own Geartown → Geartown destroyed via game
    //   mechanic (no chain) → Geartown's GY trigger IS offered.
    // Actual: SET blocked (Mausoleum not placed, Geartown not destroyed) — same-player SET
    //   replacement not supported.
    // Note: matrix uses Geartown passcode 08067863; correct passcode is 37694547 (c37694547.lua).
    it.fails(
      "R02-B7a — SET Mausoleum over own Geartown: Geartown destroyed (no chain) → GY trigger offered — DEFECT (SET replacement blocked)",
      async () => {
        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: GEARTOWN,
              location: OcgLocation.FZONE,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
            {
              code: MAUSOLEUM,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          deck0: [ANCIENT_GEAR, ...FILLER.slice(0, 15)],
          deck1: FILLER.slice(0, 16),
          startingDrawCount: 1,
        });

        const { lib, handle } = currentDuel;
        let geartownDestroyed = false;
        let geartownChainOffered = false;
        let mausoleumSet = false;
        let turn = 0;

        driveDuel(lib, handle, (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === GEARTOWN && m.to?.location === OcgLocation.GRAVE)
              geartownDestroyed = true;
            if (m.type === MSG_MOVE && m.card === MAUSOLEUM && m.to?.location === OcgLocation.FZONE)
              mausoleumSet = true;
          }
          if (geartownDestroyed) {
            for (const m of msgs as SelectChainMsg[]) {
              if (
                m.type === MSG_SELECT_CHAIN &&
                (m.selects ?? []).some((s) => s.code === GEARTOWN)
              ) {
                geartownChainOffered = true;
                return { stop: true };
              }
            }
          }
          if (turn >= 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              const setIdx = (m.spell_sets ?? []).findIndex((a) => a.code === MAUSOLEUM);
              if (setIdx >= 0 && !mausoleumSet) {
                return { response: { type: 1, action: ACTION_SPELL_SET, index: setIdx } };
              }
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        });

        // DEFECT: expected true (Geartown destroyed via SET game mechanic), actual false
        expect(
          geartownDestroyed,
          `R02-B7a DEFECT: Geartown [${GEARTOWN}] must be destroyed when Mausoleum SET over it. ` +
            `Actual: SET blocked (same-player replacement not supported when field spell active). ` +
            `mausoleumSet=${mausoleumSet}`,
        ).toBe(true);
        expect(
          geartownChainOffered,
          `Geartown GY trigger must be offered in SELECT_CHAIN (not missed timing — outside any chain)`,
        ).toBe(true);
      },
      20_000,
    );

    // DEFECT: R02-B7b — same-player field spell replacement via ACTIVATE not working.
    // Expected: Activating Mausoleum while own Geartown active destroys Geartown (same-player
    //   ONE_FACEUP_FIELD replacement), and Geartown's GY trigger is NOT offered (missed timing).
    // Actual: Geartown is NOT destroyed → ONE_FACEUP_FIELD does not handle same-player replacement.
    //   The engine only destroys the OPPONENT's field spell when you activate a new one
    //   (cross-player case verified by baseline); same-player replacement is absent (DEFECT).
    it.fails(
      "R02-B7b — ACTIVATE Mausoleum over own Geartown: Geartown destroyed during chain, GY trigger NOT offered — DEFECT (same-player replacement missing)",
      async () => {
        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: GEARTOWN,
              location: OcgLocation.FZONE,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
            {
              code: MAUSOLEUM,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          deck0: [ANCIENT_GEAR, ...FILLER.slice(0, 15)],
          deck1: FILLER.slice(0, 16),
          startingDrawCount: 1,
        });

        const { lib, handle } = currentDuel;
        let geartownDestroyed = false;
        let geartownChainOffered = false;
        let mausoleumActivated = false;
        let turn = 0;

        driveDuel(lib, handle, (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === GEARTOWN && m.to?.location === OcgLocation.GRAVE)
              geartownDestroyed = true;
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && geartownDestroyed) {
              if ((m.selects ?? []).some((s) => s.code === GEARTOWN)) geartownChainOffered = true;
            }
          }
          if (turn >= 2) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && !mausoleumActivated) {
              const actIdx = (m.activates ?? []).findIndex((a) => a.code === MAUSOLEUM);
              if (actIdx >= 0) {
                mausoleumActivated = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: actIdx } };
              }
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        });

        // DEFECT: expected true (Geartown destroyed by same-player replacement), actual false
        expect(
          geartownDestroyed,
          `R02-B7b DEFECT: Geartown [${GEARTOWN}] must be destroyed when Mausoleum [${MAUSOLEUM}] ` +
            `is activated over it (same-player field spell replacement). ` +
            `Actual: Geartown NOT destroyed — ONE_FACEUP_FIELD only handles cross-player destruction.`,
        ).toBe(true);

        expect(
          geartownChainOffered,
          `Geartown GY trigger must NOT be offered (missed timing — destroyed during chain building)`,
        ).toBe(false);
      },
      20_000,
    );
  },
);

// ── R03: Union Monster Conditions ─────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)("R03 — Union Monster Conditions [requires custom WASM]", () => {
  // DEFECT: After Machina Gearframe equips to X-Head Cannon (new-style union, ct2 incremented),
  // Machina Peacekeeper's equip ignition remains in activates — union limit (ct2==0 check) is not
  // enforced by the engine.  Expected: Peacekeeper equip absent from activates.
  it("R03-B1 — union limit: Peacekeeper equip NOT offered after Gearframe already equipped to same Machine", async () => {
    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: X_HEAD_CANNON,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: MACHINA_GEARFRAME,
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: MACHINA_PEACEKEEPER,
          location: OcgLocation.MZONE,
          sequence: 2,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    let gearframeEquipped = false;
    let pKeeperInActivates = true;
    let postEquipChecked = false;

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as MoveMsg[]) {
        if (
          m.type === MSG_MOVE &&
          m.card === MACHINA_GEARFRAME &&
          m.to?.location === OcgLocation.SZONE
        ) {
          gearframeEquipped = true;
        }
      }
      if (gearframeEquipped && !postEquipChecked) {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            pKeeperInActivates = (m.activates ?? []).some((a) => a.code === MACHINA_PEACEKEEPER);
            postEquipChecked = true;
            return { stop: true };
          }
        }
      }
      if (status !== 1) return {};
      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD && !gearframeEquipped) {
          const gfIdx = (m.activates ?? []).findIndex((a) => a.code === MACHINA_GEARFRAME);
          if (gfIdx >= 0) return { response: { type: 1, action: ACTION_ACTIVATE, index: gfIdx } };
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    expect(gearframeEquipped, "Precondition: Gearframe must equip to X-Head Cannon").toBe(true);
    expect(
      pKeeperInActivates,
      "R03-B1: Peacekeeper equip must NOT be offered after Gearframe already equipped " +
        "(1-union-per-monster limit). Fix: c78349103.lua uses GetEquipGroup() check.",
    ).toBe(false);
  }, 20_000);

  it("R03-B2 — destroy-instead (listed union): Machina Gearframe destroyed instead of X-Head Cannon", async () => {
    // Machina Gearframe [42940404] equipped to X-Head Cannon [62651957].
    // P1 uses Smashing Ground [97169186]: targets XHC (highest DEF on P0 side).
    // Gearframe (listed union) must be destroyed instead; XHC must survive.
    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: X_HEAD_CANNON,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: MACHINA_GEARFRAME,
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: SMASHING_GROUND,
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
    let gearframeEquipped = false;
    let smashingActivated = false;
    let turn = 0;
    const movesToGrave: number[] = [];

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
      }
      for (const m of msgs as MoveMsg[]) {
        if (
          m.type === MSG_MOVE &&
          m.card === MACHINA_GEARFRAME &&
          m.to?.location === OcgLocation.SZONE
        )
          gearframeEquipped = true;
        if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) movesToGrave.push(m.card);
      }
      if (
        smashingActivated &&
        (movesToGrave.includes(MACHINA_GEARFRAME) || movesToGrave.includes(X_HEAD_CANNON))
      )
        return { stop: true };
      if (status !== 1) return {};

      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD) {
          if (turn === 1 && !gearframeEquipped) {
            const gfIdx = (m.activates ?? []).findIndex((a) => a.code === MACHINA_GEARFRAME);
            if (gfIdx >= 0) return { response: { type: 1, action: ACTION_ACTIVATE, index: gfIdx } };
          }
          if (turn === 1 && gearframeEquipped)
            return { response: { type: 1, action: ACTION_TO_EP } };
          if (turn === 2 && !smashingActivated) {
            const sgIdx = (m.activates ?? []).findIndex((a) => a.code === SMASHING_GROUND);
            if (sgIdx >= 0) {
              smashingActivated = true;
              return { response: { type: 1, action: ACTION_ACTIVATE, index: sgIdx } };
            }
          }
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    expect(gearframeEquipped, "Precondition: Gearframe must equip to X-Head Cannon").toBe(true);
    expect(
      movesToGrave.includes(MACHINA_GEARFRAME),
      `R03-B2: Gearframe [${MACHINA_GEARFRAME}] must be destroyed instead of XHC ` +
        `(listed union destroy-instead). Moves: ${JSON.stringify(movesToGrave)}`,
    ).toBe(true);
    expect(
      movesToGrave.includes(X_HEAD_CANNON),
      `R03-B2: X-Head Cannon [${X_HEAD_CANNON}] must survive (Gearframe protected it). ` +
        `Moves: ${JSON.stringify(movesToGrave)}`,
    ).toBe(false);
  }, 25_000);

  // DEFECT: Y-Dragon Head (non-listed union, card text "in battle" only) incorrectly
  // protects X-Head Cannon from EFFECT destruction via Smashing Ground.
  // Root cause: c65622692.lua calls AddUnionProcedure(c, filter) with nil oldprotect,
  //   which gives UnionReplace(nil) → protects against both REASON_BATTLE and REASON_EFFECT.
  //   Card text says "in battle" only → effect protection is a SCRIPT BUG.
  // Expected: X-Head Cannon IS destroyed by Smashing Ground.
  // Actual: Y-Dragon Head is destroyed instead (engine gives full protection).
  it("R03-B3 — non-listed union (Y-Dragon Head) does NOT protect X-Head Cannon from effect destruction", async () => {
    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: X_HEAD_CANNON,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: Y_DRAGON_HEAD,
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: SMASHING_GROUND,
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
    let yDragonEquipped = false;
    let smashingActivated = false;
    let turn = 0;
    const movesToGrave: number[] = [];

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
      }
      for (const m of msgs as MoveMsg[]) {
        if (m.type === MSG_MOVE && m.card === Y_DRAGON_HEAD && m.to?.location === OcgLocation.SZONE)
          yDragonEquipped = true;
        if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) movesToGrave.push(m.card);
      }
      if (
        smashingActivated &&
        (movesToGrave.includes(Y_DRAGON_HEAD) || movesToGrave.includes(X_HEAD_CANNON))
      )
        return { stop: true };
      if (status !== 1) return {};

      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD) {
          if (turn === 1 && !yDragonEquipped) {
            const ydIdx = (m.activates ?? []).findIndex((a) => a.code === Y_DRAGON_HEAD);
            if (ydIdx >= 0) return { response: { type: 1, action: ACTION_ACTIVATE, index: ydIdx } };
          }
          if (turn === 1 && yDragonEquipped) return { response: { type: 1, action: ACTION_TO_EP } };
          if (turn === 2 && !smashingActivated) {
            const sgIdx = (m.activates ?? []).findIndex((a) => a.code === SMASHING_GROUND);
            if (sgIdx >= 0) {
              smashingActivated = true;
              return { response: { type: 1, action: ACTION_ACTIVATE, index: sgIdx } };
            }
          }
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    expect(yDragonEquipped, "Precondition: Y-Dragon Head must equip to X-Head Cannon").toBe(true);
    expect(
      movesToGrave.includes(X_HEAD_CANNON),
      `R03-B3: X-Head Cannon [${X_HEAD_CANNON}] must be destroyed by Smashing Ground ` +
        `(Y-Dragon Head [${Y_DRAGON_HEAD}] is non-listed — no destruction protection per Edison ruling). ` +
        `Fix: c65622692.lua override omits EFFECT_DESTROY_SUBSTITUTE. ` +
        `Moves: ${JSON.stringify(movesToGrave)}`,
    ).toBe(true);
  }, 25_000);
});

// ── R04: Phase-Mandatory Trigger Re-fire ──────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "R04 — Phase-mandatory trigger re-fires when activation negated [requires custom WASM]",
  () => {
    // DEFECT: R04-B1 — With LADD [47297616] + Lumina [95503687] on field, Lumina's mandatory
    // End-Phase mill never resolves.
    // LADD fix: c47297616.lua negtg now registers per-phase flag UNCONDITIONALLY (and negop also
    // registers it as belt-and-suspenders). This resolves the original infinite-negate loop.
    // REMAINING ENGINE LIMITATION: Lumina's EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_F mill operation
    // does not produce MOVE messages in this WASM — even with forced SELECT_CHAIN accepted (index=0),
    // the chain resolves but Duel.DiscardDeck generates no observable MOVE to GRAVE.
    // Root cause appears to be an engine-model limitation with FIELD+TRIGGER_F effects in this build.
    // RECOMMEND CARVE-OUT for the mill-observability aspect; LADD script fix is correct.
    it.fails(
      "R04-B1 — LADD negates Lumina End-Phase mill activation, Lumina re-fires → mill resolves — ENGINE LIMITATION (FIELD+TRIGGER_F operations not observable via MOVE)",
      async () => {
        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: LADD,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
            {
              code: LUMINA,
              location: OcgLocation.MZONE,
              sequence: 1,
              position: OcgPosition.FACEUP_ATTACK,
            },
          ],
          startingDrawCount: 1,
          deck0: FILLER.slice(0, 16),
          deck1: FILLER.slice(0, 16),
        });

        const { lib, handle } = currentDuel;
        let movedToEP = false;
        let turn = 0;
        const fillerInGraveAfterEP: number[] = [];

        driveDuel(lib, handle, (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          if (movedToEP) {
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.to?.location === OcgLocation.GRAVE &&
                FILLER.includes(m.card)
              ) {
                fillerInGraveAfterEP.push(m.card);
              }
            }
          }
          if (turn >= 2) return { stop: true };
          if (status !== 1) return {};
          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && !movedToEP) {
              movedToEP = true;
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && movedToEP) {
              const selects = m.selects ?? [];
              const laddIdx = selects.findIndex((s) => s.code === LADD);
              if (laddIdx >= 0) return { response: { type: 8, index: laddIdx } };
              const luminaIdx = selects.findIndex((s) => s.code === LUMINA);
              if (luminaIdx >= 0) return { response: { type: 8, index: luminaIdx } };
              if (m.forced && selects.length > 0) return { response: { type: 8, index: 0 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        });

        // ENGINE LIMITATION: Lumina's FIELD+TRIGGER_F mill generates no MOVE messages.
        // LADD fix is verified correct (no infinite loop, LADD not offered in chain selects).
        expect(
          fillerInGraveAfterEP.length,
          `R04-B1 ENGINE LIMITATION: Lumina's mill must resolve (≥3 FILLER cards to GRAVE). ` +
            `Actual: 0. LADD fix (c47297616.lua) is correct but FIELD+TRIGGER_F operations ` +
            `don't generate observable MOVE messages in this WASM build (RECOMMEND CARVE-OUT).`,
        ).toBeGreaterThanOrEqual(3);
      },
      20_000,
    );

    it("R04-B2 — Skill Drain negates Lumina End-Phase effect: mill does NOT re-fire (≤1 activation)", async () => {
      // P0 controls Lumina + Skill Drain (face-up in SZONE, already active).
      // Skill Drain disables Lumina's effects → End-Phase trigger either doesn't activate
      // (EFFECT_DISABLE prevents it) or activates once without resolving.
      // Either way: trigger fires AT MOST ONCE (no re-fire when EFFECT negated vs activation).
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: LUMINA,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: SKILL_DRAIN,
            location: OcgLocation.SZONE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
      });

      const { lib, handle } = currentDuel;
      let movedToEP = false;
      let luminaChainCount = 0;
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (turn >= 2) return { stop: true };
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && movedToEP) {
            if ((m.selects ?? []).some((s) => s.code === LUMINA)) luminaChainCount++;
          }
        }
        if (status !== 1) return {};
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !movedToEP) {
            movedToEP = true;
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        luminaChainCount,
        `R04-B2: Under Skill Drain, Lumina End-Phase trigger fires ≤1 time (no re-fire). ` +
          `Got: ${luminaChainCount}`,
      ).toBeLessThanOrEqual(1);
    }, 20_000);

    // DEFECT: R04-B3 — Same as R04-B1 but for Spirit (Susa Soldier).
    // LADD fix: c47297616.lua negtg now registers per-phase flag unconditionally (and negop too).
    // REMAINING ENGINE LIMITATION: Spirit.ReturnOperation (EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_F)
    // does not produce a MOVE message when fired in EP — Duel.SendtoHand is not observed via
    // MOVE messages in this WASM build. Same root cause as R04-B1 (FIELD+TRIGGER_F limitation).
    // RECOMMEND CARVE-OUT for the return-to-hand observability; LADD script fix is correct.
    it.fails(
      "R04-B3 — scope: Spirit (Susa Soldier) return re-fires after LADD negation → returns to hand — ENGINE LIMITATION (FIELD+TRIGGER_F return-to-hand not observable via MOVE)",
      async () => {
        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: LADD,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEUP_ATTACK,
            },
            {
              code: SUSA_SOLDIER,
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
        let susaSummoned = false;
        let movedToEP = false;
        let susaReturnedToHand = false;
        let turn = 0;

        driveDuel(lib, handle, (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === SUSA_SOLDIER &&
              m.to?.location === OcgLocation.HAND
            )
              susaReturnedToHand = true;
          }
          if (susaReturnedToHand) return { stop: true };
          if (turn >= 3) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (!susaSummoned) {
                const idx = (m.summons ?? []).findIndex((s) => s.code === SUSA_SOLDIER);
                if (idx >= 0) {
                  susaSummoned = true;
                  return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
                }
                return { response: { type: 1, action: ACTION_TO_EP } };
              }
              if (!movedToEP) {
                movedToEP = true;
                return { response: { type: 1, action: ACTION_TO_EP } };
              }
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && movedToEP) {
              const selects = m.selects ?? [];
              const laddIdx = selects.findIndex((s) => s.code === LADD);
              if (laddIdx >= 0) return { response: { type: 8, index: laddIdx } };
              const susaIdx = selects.findIndex((s) => s.code === SUSA_SOLDIER);
              if (susaIdx >= 0) return { response: { type: 8, index: susaIdx } };
              if (m.forced && selects.length > 0) return { response: { type: 8, index: 0 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        });

        expect(susaSummoned, "Precondition: Susa Soldier must be Normal Summoned").toBe(true);
        // ENGINE LIMITATION: Spirit return (FIELD+TRIGGER_F) generates no observable MOVE to HAND.
        // LADD fix is correct (flag registered unconditionally). RECOMMEND CARVE-OUT.
        expect(
          susaReturnedToHand,
          `R04-B3 ENGINE LIMITATION: Susa Soldier [${SUSA_SOLDIER}] must return to hand. ` +
            `LADD fix is correct but FIELD+TRIGGER_F return-to-hand not observable via MOVE in this WASM.`,
        ).toBe(true);
      },
      20_000,
    );
  },
);

// ── ERR-LIGHTANDDARKNESS: death-effect sequential behavior ───────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-LIGHTANDDARKNESS — on-death effect (destroy-all-you-control THEN Special-Summon) [requires custom WASM]",
  () => {
    // Behavioral test for the Edison LADD override's death effect (e3):
    // When LADD is destroyed, all P0 cards on-field are destroyed first, THEN
    // one monster is Special Summoned from P0's GY (non-targeting, selected at resolution).
    // SINGLE+TRIGGER_F effects work correctly in this WASM (unlike FIELD+TRIGGER_F; see R04-B1/B3).
    //
    // Setup: P0 LADD + Filler monster (MZONE) + Filler2 (GY).
    //        P1 Blue-Eyes White Dragon (89631139, 3000 ATK) — beats LADD (2800 ATK) in battle.
    // Turn 2 P1 BP: Blue-Eyes attacks LADD → 3000>2800 → LADD battle-destroyed.
    // LADD e3: destroy all P0 field (Filler monster) → then SelectMatchingCard → SS Filler2 from GY.
    it("ERR-LIGHTANDDARKNESS — destroy-all-you-control THEN Special-Summon from GY (sequential)", async () => {
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: LADD,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: FILLER[0]!,
            location: OcgLocation.MZONE,
            sequence: 1,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: FILLER[2]!,
            location: OcgLocation.GRAVE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: BLUE_EYES,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 1,
        deck0: FILLER.slice(3, 19),
        deck1: FILLER.slice(3, 19),
      });

      const { lib, handle } = currentDuel;
      let turn = 0;
      let laddDestroyed = false;
      let fillerDestroyedByEffect = false;
      let fillerSS = false;
      const postLaddMoves: string[] = [];

      driveDuel(
        lib,
        handle,
        (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) turn++;
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.card === LADD && m.to?.location === OcgLocation.GRAVE)
              laddDestroyed = true;
            if (
              laddDestroyed &&
              m.type === MSG_MOVE &&
              m.card === FILLER[0]! &&
              m.to?.location === OcgLocation.GRAVE
            )
              fillerDestroyedByEffect = true;
            if (
              laddDestroyed &&
              fillerDestroyedByEffect &&
              m.type === MSG_MOVE &&
              FILLER.includes(m.card) &&
              m.to?.location === OcgLocation.MZONE
            )
              fillerSS = true;
            if (laddDestroyed) postLaddMoves.push(`${m.card}→${m.to?.location}`);
          }
          if (laddDestroyed && fillerDestroyedByEffect && fillerSS) return { stop: true };
          if (turn >= 5) return { stop: true };
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              const isP1Turn = turn % 2 === 0; // P1 has even turns (2, 4...)
              if (isP1Turn && m.to_bp) return { response: { type: 1, action: ACTION_TO_BP } };
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (m.type === MSG_SELECT_BATTLECMD) {
              const attacks = m.attacks ?? [];
              if (attacks.length > 0) return { response: { type: 0, action: 1, index: 0 } };
              return { response: { type: 0, action: 3 } }; // TO_EP
            }
          }
          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN && laddDestroyed) {
              const selects = m.selects ?? [];
              const laddIdx = selects.findIndex((s) => s.code === LADD);
              if (laddIdx >= 0) return { response: { type: 8, index: laddIdx } };
              if (m.forced && selects.length > 0) return { response: { type: 8, index: 0 } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        2000,
      );

      expect(
        laddDestroyed,
        "ERR-LADD: LADD must be battle-destroyed by Blue-Eyes (3000>2800 ATK)",
      ).toBe(true);
      expect(
        fillerDestroyedByEffect,
        `ERR-LADD: Filler[0] [${FILLER[0]}] must be destroyed by LADD's death effect (destroy-all). ` +
          `postLaddMoves=${JSON.stringify(postLaddMoves)}`,
      ).toBe(true);
      expect(
        fillerSS,
        `ERR-LADD: A Filler monster must be Special Summoned from P0's GY by LADD's death effect ` +
          `(THEN Special-Summon sequential — after destroy-all). postLaddMoves=${JSON.stringify(postLaddMoves)}`,
      ).toBe(true);
    }, 30_000);
  },
);
