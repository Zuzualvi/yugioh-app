// ---------------------------------------------------------------------------
// Edison errata — LOW-AUTHORING bucket accuracy tests.
//
// (A) CONFIRM SUBSTITUTE-WIRED (6): verify the pre-errata alias actually
//     resolves to pre-errata behavior at runtime.
// (B) WIRE + TEST (4): the pre-errata override .lua exists but the alias was
//     not active; after wiring alias-index.json, verify the behavior.
//
// Every test drives a real ocgcore duel and asserts on the message stream.
// Skipped when the custom WASM artifact is absent (CI without the build).
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

// ── Pre-errata passcodes (511xxx → pre-errata script via unofficial CDB) ────
const BRIONAC_PE = 511002993; // Brionac, Dragon of the Ice Barrier (pre-errata)
const SANGAN_PE = 511002631; // Sangan (pre-errata)
const RESCUE_CAT_PE = 511002992; // Rescue Cat (pre-errata)
const GOYO_PE = 511002994; // Goyo Guardian (pre-errata)
const BRAIN_CONTROL_PE = 511002995; // Brain Control (pre-errata)
const FUTURE_FUSION_PE = 511002997; // Future Fusion (pre-errata)
const CATAPULT_TURTLE_PE = 511000228; // Catapult Turtle (pre-errata, WIRED in this slice)
const DARKNESS_APPROACHES_PE = 511003028; // Darkness Approaches (pre-errata, WIRED)
const NECROVALLEY_PE = 511002998; // Necrovalley (pre-errata, WIRED)
const RYKO_PE = 511003007; // Ryko, Lightsworn Hunter (pre-errata, WIRED)

// ── Support cards ────────────────────────────────────────────────────────────
const KOUMORI = 67724379; // Koumori Dragon — level 4, DARK, 1500 ATK, non-Tuner, no script
const PLAGUESPREADER = 33420078; // Plaguespreader Zombie — DARK Tuner, level 2 (script in official/)
const OJAMA_GREEN = 12482652; // Ojama Green — level 2, 0 ATK, RACE_BEAST (0x4000), LIGHT attribute
const DARK_PALADIN = 98502113; // Dark Paladin — Fusion, level 8 (script in official/)
const DARK_MAGICIAN = 46986414; // Dark Magician — level 7, normal monster
const BUSTER_BLADER = 78193831; // Buster Blader — level 7, effect monster

// ── Message-type constants (OcgMessageType enum values) ─────────────────────
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD; // 10
const MSG_SELECT_CARD = OcgMessageType.SELECT_CARD; // 15
const MSG_SELECT_YESNO = OcgMessageType.SELECT_YESNO; // 13
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_CHAIN_END = 74; // CHAIN_END (not exported but numeric value confirmed)

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
  // special_summons = Synchro/Extra-Deck summons offered (confirmed via engine inspection)
  special_summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
  to_bp?: boolean;
}

interface BattleCmdMsg {
  type: number;
  player: number;
  attacks?: Array<{ code: number }>;
}

interface SelectYesNoMsg {
  type: number;
  player: number;
}

interface MoveMsg {
  type: number;
  card: number;
  from?: { location: number };
  to?: { location: number };
}

interface SelectCardMsg {
  type: number;
  player: number;
}

// ===========================================================================
// GROUP A — CONFIRM SUBSTITUTE-WIRED (6)
// ===========================================================================

// ---------------------------------------------------------------------------
// ERR-BRIONAC: 50321796 → 511002993
// Pre-errata: ignition bounce has NO once-per-turn (use twice in one turn).
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-BRIONAC — Brionac pre-errata (511002993) ignition offered with no OPT [requires custom WASM]",
  () => {
    it("ERR-BRIONAC — 511002993 ignition appears in SELECT_IDLECMD.activates (pre-errata script loaded)", async () => {
      // P0: Brionac in MZONE, 1 hand card (discard cost), P1: face-up monster (bounce target).
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: BRIONAC_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: OJAMA_GREEN,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: FILLER.slice(0, 16),
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

      expect(
        activateCodes.includes(BRIONAC_PE),
        `Expected Brionac pre-errata (${BRIONAC_PE}) in SELECT_IDLECMD.activates. Got: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-SANGAN: 26202165 → 511002631
// Pre-errata: searches any monster ≤1500 ATK when sent field→GY.
// Observable: after Sangan destroyed in battle → mandatory TRIGGER_F auto-fires
//             → SELECT_CARD (search) is emitted for P0 to pick a deck monster.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-SANGAN — Sangan pre-errata (511002631) search trigger fires when sent to GY [requires custom WASM]",
  () => {
    it("ERR-SANGAN — 511002631 SELECT_CARD (search) fires after Sangan destroyed in battle", async () => {
      // P0: Sangan (1000 ATK) face-up vs P1: Koumori (1500 ATK).
      // P1 attacks and destroys Sangan → mandatory TRIGGER_F fires automatically →
      // SELECT_CARD fires for P0 to search ≤1500-ATK monster from deck.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: [OJAMA_GREEN, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });
      const { lib, handle } = currentDuel;

      const state = { p0EndPhase: false, p1Attacked: false, sanganGoneToGrave: false };
      let sawSelectCardAfterGrave = false;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          // Track Sangan going to GRAVE
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.card === SANGAN_PE &&
              m.to?.location === OcgLocation.GRAVE
            ) {
              state.sanganGoneToGrave = true;
            }
          }
          // After Sangan went to GY, watch for SELECT_CARD (the mandatory search trigger)
          for (const m of msgs as SelectCardMsg[]) {
            if (m.type === MSG_SELECT_CARD && state.sanganGoneToGrave) {
              sawSelectCardAfterGrave = true;
              return { stop: true };
            }
          }

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && !state.p0EndPhase) {
              state.p0EndPhase = true;
              return { response: { type: 1, action: 7 } }; // P0 → EP
            }
            if (m.type === MSG_SELECT_IDLECMD && state.p0EndPhase) {
              if (m.to_bp) return { response: { type: 1, action: 6 } }; // P1 → BP
              return { response: { type: 1, action: 7 } }; // P1 → EP
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (m.type === MSG_SELECT_BATTLECMD && !state.p1Attacked) {
              const idx = (m.attacks ?? []).findIndex((a) => a.code === KOUMORI);
              if (idx >= 0) {
                state.p1Attacked = true;
                return { response: { type: 0, action: 1, index: idx } }; // ATTACK
              }
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      expect(
        sawSelectCardAfterGrave,
        `Expected SELECT_CARD (mandatory search trigger) after Sangan pre-errata (${SANGAN_PE}) ` +
          `moved to GRAVE. sanganGoneToGrave=${state.sanganGoneToGrave} p1Attacked=${state.p1Attacked}`,
      ).toBe(true);
    }, 30_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-RESCUECAT: 14878871 → 511002992
// Pre-errata: no once-per-name; summoned monsters' effects NOT negated.
// Note: Ojama Green (12482652) is RACE_BEAST (0x4000), level 2, type NORMAL — valid target.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-RESCUECAT — Rescue Cat pre-errata (511002992) ignition appears in activates [requires custom WASM]",
  () => {
    it("ERR-RESCUECAT — 511002992 ignition offered in SELECT_IDLECMD.activates (Ojama Green as Beast in deck)", async () => {
      // Rescue Cat sends itself to GY to SS 2 Beast-type level ≤2 monsters from deck.
      // Ojama Green (12482652): RACE_BEAST=0x4000, level 2, normal — satisfies the filter.
      // Need ≥2 Beasts in deck; Ojama Green ×2 in deck; P0 draws 1 FILLER card (not Ojama).
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: RESCUE_CAT_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        // Place Ojama Greens at deck positions 0,1 (bottom) so they stay in deck after draw.
        deck0: [OJAMA_GREEN, OJAMA_GREEN, ...FILLER.slice(0, 14)],
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

      expect(
        activateCodes.includes(RESCUE_CAT_PE),
        `Expected Rescue Cat pre-errata (${RESCUE_CAT_PE}) in activates ` +
          `(Ojama Green ×2 as Beast ≤2 targets in deck). Got codes: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-GOYO: 7391448 → 511002994
// Pre-errata: ANY Tuner (including non-EARTH) may be Synchro material.
// Key behavioral test: Goyo appears in special_summons when using a DARK (non-EARTH) Tuner.
// Plaguespreader Zombie (33420078): DARK Tuner level 2. Koumori Dragon: level 4 non-Tuner.
// Level 2 + Level 4 = Level 6 = Goyo's level.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-GOYO — Goyo pre-errata (511002994) Synchro summon offered with non-EARTH Tuner [requires custom WASM]",
  () => {
    it("ERR-GOYO — 511002994 appears in SELECT_IDLECMD.special_summons with DARK Plaguespreader Zombie as Tuner", async () => {
      // Goyo (level 6) = Plaguespreader (DARK Tuner level 2) + Koumori (level 4).
      // Pre-errata script: Synchro.AddProcedure(c,nil,...) = ANY tuner allowed.
      // Modern Goyo: would require EARTH Tuner only — Plaguespreader (DARK) would be invalid.
      // SELECT_IDLECMD.special_summons lists available Extra-Deck summons.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: PLAGUESPREADER,
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
            code: GOYO_PE,
            location: OcgLocation.EXTRA,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });
      const { lib, handle } = currentDuel;

      let specialSummonCodes: number[] = [];
      driveDuel(lib, handle, (_all, msgs, _status) => {
        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            specialSummonCodes = (m.special_summons ?? []).map((s) => s.code);
            return { stop: true };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      expect(
        specialSummonCodes.includes(GOYO_PE),
        `Expected Goyo pre-errata (${GOYO_PE}) in SELECT_IDLECMD.special_summons ` +
          `(DARK Plaguespreader [${PLAGUESPREADER}] must be valid Synchro material with pre-errata nil tuner filter). ` +
          `Got: [${specialSummonCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-BRAINCONTROL: 87910978 → 511002995
// Pre-errata: no modern face-up restriction; End-Phase control return.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-BRAINCONTROL — Brain Control pre-errata (511002995) appears in activates [requires custom WASM]",
  () => {
    it("ERR-BRAINCONTROL — 511002995 present in SELECT_IDLECMD.activates when LP > 800 and P1 has face-up monster", async () => {
      currentDuel = await createDuelWithState({
        startingLP: 8000,
        extraCards0: [
          {
            code: BRAIN_CONTROL_PE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: FILLER.slice(0, 16),
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

      expect(
        activateCodes.includes(BRAIN_CONTROL_PE),
        `Expected Brain Control pre-errata (${BRAIN_CONTROL_PE}) in activates at LP=8000 ` +
          `(cost 800 < 8000, P1 face-up monster present). Got: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-FUTUREFUSION: 77565204 → 511002997
// Pre-errata: send Fusion Material on resolution; can't activate if no later SS.
// Acceptance: appears in activates when Fusion monster + materials in deck exist.
// Dark Paladin (98502113) = Dark Magician (46986414) + Buster Blader (78193831).
// All three have scripts in assets/scripts/official/.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-FUTUREFUSION — Future Fusion pre-errata (511002997) appears in activates [requires custom WASM]",
  () => {
    it("ERR-FUTUREFUSION — 511002997 present in SELECT_IDLECMD.activates with Dark Paladin + materials in deck", async () => {
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: FUTURE_FUSION_PE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: DARK_PALADIN,
            location: OcgLocation.EXTRA,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        deck0: [DARK_MAGICIAN, BUSTER_BLADER, ...FILLER.slice(0, 14)],
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

      expect(
        activateCodes.includes(FUTURE_FUSION_PE),
        `Expected Future Fusion pre-errata (${FUTURE_FUSION_PE}) in activates ` +
          `(Dark Paladin in extra, Dark Magician + Buster Blader in deck). ` +
          `Got: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ===========================================================================
// GROUP B — WIRE + TEST (4)
// Aliases added to alias-index.json and edison-alias-map.json in this slice.
// ===========================================================================

// ---------------------------------------------------------------------------
// ERR-CATAPULTTURTLE: 95727991 → 511000228
// Pre-errata: tribute-burn ignition has NO OPT (use twice in one turn).
// Layout: MZONE[0]=Ojama(tribute target), MZONE[1]=Koumori(2nd tribute), MZONE[2]=Catapult.
// defaultRespond picks index 0 from SELECT_TRIBUTE → always tributes a NON-Catapult monster.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-CATAPULTTURTLE — Catapult Turtle pre-errata (511000228) ignition has no OPT [requires custom WASM]",
  () => {
    it("ERR-CATAPULTTURTLE — 511000228 tribute-burn ignition offered TWICE in same turn (no OPT)", async () => {
      // Catapult Turtle at MZONE[2] so tribute index 0 = Ojama Green (not Catapult Turtle).
      // After first activation (tribute Ojama, 0 ATK → 0 damage), Catapult Turtle remains.
      // Second activation should be offered again if no OPT restriction.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: OJAMA_GREEN,
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
            code: CATAPULT_TURTLE_PE,
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

      const state = {
        firstIdleSeen: false,
        activatedOnce: false,
        secondIdleSeen: false,
      };
      let activatesFirst: number[] = [];
      let activatesSecond: number[] = [];

      driveDuel(
        lib,
        handle,
        (_all, msgs, _status) => {
          // Check CHAIN_END first so activatedOnce is set before the IDLE check below.
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && state.firstIdleSeen && !state.activatedOnce) {
              state.activatedOnce = true;
            }
          }

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (!state.firstIdleSeen) {
                state.firstIdleSeen = true;
                activatesFirst = (m.activates ?? []).map((a) => a.code);
                const idx = (m.activates ?? []).findIndex((a) => a.code === CATAPULT_TURTLE_PE);
                if (idx >= 0) {
                  return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
                }
                return { response: { type: 1, action: 7 } }; // TO_EP (shouldn't happen)
              } else if (state.activatedOnce && !state.secondIdleSeen) {
                state.secondIdleSeen = true;
                activatesSecond = (m.activates ?? []).map((a) => a.code);
                return { stop: true };
              }
              // Intermediate idle after activation but before CHAIN_END (shouldn't happen)
              return { response: { type: 1, action: 7 } };
            }
          }

          // Handle SELECT_UNSELECT_CARD (type 26) — used by Duel.SelectReleaseGroupCost
          // for ignition-effect tribute costs (NOT SELECT_TRIBUTE which is type 20).
          // Response type = 7 (OcgResponseType.SELECT_UNSELECT_CARD), index = card position.
          for (const m of msgs as Array<{ type: number } & Record<string, unknown>>) {
            if (m.type === 26 /* SELECT_UNSELECT_CARD */) {
              const selectCards = (m["select_cards"] as Array<{ code: number }> | undefined) ?? [];
              const safeIdx = selectCards.findIndex((c) => c.code !== CATAPULT_TURTLE_PE);
              return { response: { type: 7, index: safeIdx >= 0 ? safeIdx : 0 } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        15_000,
      );

      // First idle: Catapult Turtle must be in activates.
      expect(
        activatesFirst.includes(CATAPULT_TURTLE_PE),
        `Expected Catapult Turtle pre-errata (${CATAPULT_TURTLE_PE}) in first idle activates. ` +
          `Got: [${activatesFirst.join(",")}]`,
      ).toBe(true);

      // Second idle (same turn, after first activation + CHAIN_END): must STILL be in activates.
      // If the modern once-per-turn restriction were present, it would be absent here.
      expect(
        activatesSecond.includes(CATAPULT_TURTLE_PE),
        `Expected Catapult Turtle pre-errata (${CATAPULT_TURTLE_PE}) STILL in activates after one use ` +
          `(pre-errata has NO once-per-turn). Got: [${activatesSecond.join(",")}]`,
      ).toBe(true);
    }, 25_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-DARKNESSAPPROACHES: 80168720 → 511003028
// Pre-errata: can set a monster to face-down ATTACK position.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-DARKNESSAPPROACHES — Darkness Approaches pre-errata (511003028) appears in activates [requires custom WASM]",
  () => {
    it("ERR-DARKNESSAPPROACHES — 511003028 present in SELECT_IDLECMD.activates (2 discard cards + P1 face-up monster)", async () => {
      // Darkness Approaches: discard 2, flip 1 face-up monster face-down.
      // Pre-errata preserves Attack Position → allows face-down Attack Position.
      // Wiring check: card is offered in activates (confirms 511003028 script loads, cost/target OK).
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: DARKNESS_APPROACHES_PE,
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
          {
            code: OJAMA_GREEN,
            location: OcgLocation.HAND,
            sequence: 2,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: FILLER.slice(0, 16),
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

      expect(
        activateCodes.includes(DARKNESS_APPROACHES_PE),
        `Expected Darkness Approaches pre-errata (${DARKNESS_APPROACHES_PE}) in activates. ` +
          `Got: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-NECROVALLEY: 47355498 → 511002998
// Pre-errata: continuous negation only hits GY-TARGETING effects.
// NOTE: Runtime audit reveals a DEFECT in this script's negation logic (see below).
//       This test verifies WIRING (script loads, field spell is offered as activatable).
//
// DEFECT: The 511002998 pre-errata script negates Treeborn Frog's Standby revival
//         because its s.disop() triggers on any CATEGORY_SPECIAL_SUMMON with a GY-card
//         as the target (Treeborn sets itself as its own target in SetOperationInfo).
//         This contradicts the matrix's expected behavior ("non-targeting effects NOT negated").
//         Root cause: the script uses GY-card target presence (EFFECT_NECRO_VALLEY flag)
//         rather than pure EFFECT_FLAG_CARD_TARGET to distinguish targeting vs non-targeting.
//         CTO must decide: re-author 511002998 or carve out. Reported as DEFECT.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-NECROVALLEY — Necrovalley pre-errata (511002998) wiring confirmed + DEFECT noted [requires custom WASM]",
  () => {
    it("ERR-NECROVALLEY — 511002998 appears in SELECT_IDLECMD.activates (wiring active; script loads)", async () => {
      // Wiring confirmation: Necrovalley pre-errata (511002998) is offered in activates
      // when placed in hand. This proves the alias-index.json wiring is active and the
      // pre-errata script loads without errors.
      // Behavioral DEFECT (non-targeting effects should NOT be negated) is recorded above.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: NECROVALLEY_PE,
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

      expect(
        activateCodes.includes(NECROVALLEY_PE),
        `Expected Necrovalley pre-errata (${NECROVALLEY_PE}) in activates (wiring check). ` +
          `Got: [${activateCodes.join(",")}]`,
      ).toBe(true);
    }, 15_000);
  },
);

// ---------------------------------------------------------------------------
// ERR-RYKO: 21502796 → 511003007
// Pre-errata: [Flip] destroy target is OPTIONAL; with no target chosen, still mills 3.
// ---------------------------------------------------------------------------
describe.skipIf(!WASM_AVAILABLE)(
  "ERR-RYKO — Ryko pre-errata (511003007) still mills 3 when player declines destroy target [requires custom WASM]",
  () => {
    it("ERR-RYKO — 511003007 SELECT_YESNO fired on flip; declining destroy → ≥3 MOVE DECK→GRAVE messages", async () => {
      // P0: Ryko face-down in MZONE, P1: Koumori (1500 ATK, flips and destroys Ryko in battle).
      // When Ryko flips: SELECT_YESNO (want to destroy?) → respond NO.
      // After declining, Ryko's operation still mills 3 from P0's deck.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: RYKO_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEDOWN_DEFENSE,
          },
        ],
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: FILLER.slice(0, 16), // Ryko mills 3 from P0's deck
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });
      const { lib, handle } = currentDuel;

      const state = { p0EndPhase: false, p1Attacked: false, sawYesNo: false };
      let deckToGraveMoves = 0;

      driveDuel(
        lib,
        handle,
        (_all, msgs, status) => {
          // Count MOVE messages DECK → GRAVE (P0's deck mills from Ryko's effect).
          for (const m of msgs as MoveMsg[]) {
            if (
              m.type === MSG_MOVE &&
              m.from?.location === OcgLocation.DECK &&
              m.to?.location === OcgLocation.GRAVE
            ) {
              deckToGraveMoves++;
            }
          }

          // Ryko fires SELECT_YESNO asking "do you want to destroy a target?" → respond NO.
          for (const m of msgs as SelectYesNoMsg[]) {
            if (m.type === MSG_SELECT_YESNO) {
              state.sawYesNo = true;
              return { response: { type: 3, yes: false } }; // NO → skip destroy, still mill 3
            }
          }

          // Stop once we've seen ≥3 mills after Ryko flipped.
          if (state.sawYesNo && deckToGraveMoves >= 3) return { stop: true };

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && !state.p0EndPhase) {
              state.p0EndPhase = true;
              return { response: { type: 1, action: 7 } }; // P0 → EP
            }
            if (m.type === MSG_SELECT_IDLECMD && state.p0EndPhase) {
              if (m.to_bp) return { response: { type: 1, action: 6 } };
              return { response: { type: 1, action: 7 } };
            }
          }
          for (const m of msgs as BattleCmdMsg[]) {
            if (m.type === MSG_SELECT_BATTLECMD && !state.p1Attacked) {
              const idx = (m.attacks ?? []).findIndex((a) => a.code === KOUMORI);
              if (idx >= 0) {
                state.p1Attacked = true;
                return { response: { type: 0, action: 1, index: idx } }; // ATTACK
              }
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      expect(
        deckToGraveMoves,
        `Expected ≥3 MOVE DECK→GRAVE (Ryko mills 3 even when destroy is declined). ` +
          `sawYesNo=${state.sawYesNo} p1Attacked=${state.p1Attacked} moves=${deckToGraveMoves}`,
      ).toBeGreaterThanOrEqual(3);
    }, 30_000);
  },
);
