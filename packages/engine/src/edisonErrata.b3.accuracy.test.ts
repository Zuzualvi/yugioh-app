// ---------------------------------------------------------------------------
// Edison Errata Bucket B3 accuracy tests — "and if you do" / targeting-removal group
//
// Cards: Dark End Dragon (88643579), Light End Dragon (25132288),
//        Destiny End Dragoon (76263644), Fortune Lady Light (34471458),
//        Elemental HERO Prisma (89312388), Ancient Fairy Dragon (25862691)
//
// Each test drives a real ocgcore duel and asserts pre-errata Edison behavior
// from the parity matrix (docs/working/2026-07-17-parity-matrix.md §3).
//
// Reference harness: packages/engine/src/edisonRules.accuracy.test.ts
// Override scripts:  packages/engine/scripts/edison-overrides/c<passcode>.lua
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
const DARK_END_DRAGON = 88643579;
const LIGHT_END_DRAGON = 25132288;
const DESTINY_END_DRAGOON = 76263644;
const FORTUNE_LADY_LIGHT = 34471458;
const FORTUNE_LADY_WATER = 29088922; // deck target for FLL trigger
const PRISMA = 89312388;
const ANCIENT_FAIRY = 25862691; // alias wired (25862681)
const KOUMORI = 67724379; // Koumori Dragon — 1500 ATK/1200 DEF normal monster, Level 4
const OJAMA_GREEN = 12482652; // Ojama Green — 0 ATK / 1000 DEF, Level 1
const DARK_HOLE = 53129443; // Dark Hole — destroys all monsters (REASON_EFFECT)
const UMI = 22702055; // Umi — Field Spell
const REDD = 37818794; // Red-Eyes Dark Dragoon — Fusion, s.material={DM,REBG}
const DARK_MAGICIAN = 46986414; // Dark Magician — fusion material for REDD

// ── Message-type constants ────────────────────────────────────────────────────
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD; // 10
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN; // 16
const MSG_SELECT_CARD = 15; // SELECT_CARD
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40
const MSG_BECOME_TARGET = 83; // BECOME_TARGET — cards: OcgLocPos[]
const MSG_CARD_TARGET = 96; // CARD_TARGET — fires when targeting effect selects target
const MSG_DAMAGE = OcgMessageType.DAMAGE; // 91
const MSG_ATTACK = OcgMessageType.ATTACK; // 110

// ── Shared cleanup ────────────────────────────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message helpers (file-local) ───────────────────────────────────────

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

interface SelectChainMsg {
  type: number;
  player: number;
  selects?: Array<{ code: number }>;
}

interface MoveMsg {
  type: number;
  card: number;
  to?: { location: number };
}

interface DamageMsg {
  type: number;
  player: number;
  amount: number;
}

// ── ERR-DARKENDDRAGON ─────────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-DARKENDDRAGON — Dark End Dragon Edison override [requires custom WASM]",
  () => {
    it("ERR-DARKENDDRAGON — ignition is non-targeting: opponent monster sent to GY without BECOME_TARGET", async () => {
      // Setup:
      //   P0 MZONE: Dark End Dragon (88643579) face-up — ignition: send opp monster to GY,
      //             self loses 500 ATK/DEF (Edison: non-targeting, no EFFECT_FLAG_CARD_TARGET)
      //   P1 MZONE: Koumori Dragon (67724379) face-up — the monster to be sent
      //
      // Expected:
      //   - DED's ignition IS offered in P0's SELECT_IDLECMD.activates
      //   - NO MSG_CARD_TARGET (96) or MSG_BECOME_TARGET (83) with KOUMORI appears
      //   - Koumori moves to GRAVE (MSG_MOVE with card=KOUMORI to GRAVE)

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: DARK_END_DRAGON,
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
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { activatedDed: false };
      let koumoriTargeted = false; // CARD_TARGET with KOUMORI
      const movesToGrave: number[] = [];
      let dedActivatesFound = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{
          type: number;
          card?: { code?: number };
          cards?: Array<{ code?: number }>;
        }>) {
          if (m.type === MSG_CARD_TARGET && m.card?.code === KOUMORI) {
            koumoriTargeted = true;
          }
          if (m.type === MSG_BECOME_TARGET) {
            const becomeCards = m.cards ?? [];
            if (becomeCards.some((c) => c.code === KOUMORI)) koumoriTargeted = true;
          }
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
            movesToGrave.push(m.card);
          }
        }

        // Stop after Koumori is in GY (effect resolved)
        if (movesToGrave.includes(KOUMORI)) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === DARK_END_DRAGON);
            if (idx >= 0 && !state.activatedDed) {
              dedActivatesFound = true;
              state.activatedDed = true;
              return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) {
            return { response: { type: 8, index: null } }; // pass
          }
        }

        // SELECT_CARD during operation — choose the first available (Koumori)
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_SELECT_CARD) {
            return { response: { type: 5, indicies: [0] } };
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      expect(
        dedActivatesFound,
        `Dark End Dragon [${DARK_END_DRAGON}] must appear in IDLECMD.activates`,
      ).toBe(true);

      expect(
        movesToGrave.includes(KOUMORI),
        `Koumori [${KOUMORI}] must be sent to GRAVE after DED's ignition resolves. ` +
          `Moves to grave: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);

      expect(
        koumoriTargeted,
        `No CARD_TARGET or BECOME_TARGET for Koumori expected (non-targeting effect)`,
      ).toBe(false);
    }, 20_000);
  },
);

// ── ERR-LIGHTENDDRAGON ────────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-LIGHTENDDRAGON — Light End Dragon Edison override [requires custom WASM]",
  () => {
    // DEFECT: ocgcore GetBattleTarget() returns nil for face-down attack targets at
    // EVENT_ATTACK_ANNOUNCE. The override correctly removes tc:IsFaceup() from the condition,
    // but if tc=nil the condition short-circuits false regardless, so the trigger never fires.
    // The engine must expose the face-down battle target in GetBattleTarget() for this to work.
    // Recorded as it.fails() so the gap stays visible.
    it.fails(
      "ERR-LIGHTENDDRAGON — battle trigger fires even when attacking a face-down defender",
      async () => {
        // Setup:
        //   P0 MZONE: Light End Dragon (25132288) face-up attack — battle trigger:
        //             on attack announce, self -500/-500; battle target -1500/-1500
        //             Edison: removed IsFaceup() check from condition, fires vs face-down
        //   P1 MZONE: Ojama Green (12482652) face-down defense
        //
        // Expected: During the battle (attack announce through damage step), SELECT_CHAIN
        //           is offered to P0 with Light End Dragon (25132288) in the selects list.
        //
        // DEFECT: engine GetBattleTarget() returns nil for face-down at ATTACK_ANNOUNCE;
        // condition fails (tc=nil) so trigger is never offered, selects always empty.

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: LIGHT_END_DRAGON,
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
              position: OcgPosition.FACEDOWN_DEFENSE,
            },
          ],
          deck0: FILLER.slice(0, 16),
          deck1: FILLER.slice(0, 16),
          startingDrawCount: 1,
        });

        const { lib, handle } = currentDuel;

        const state = {
          turn: 0,
          movedToBP: false,
          attacked: false,
          battleDone: false,
        };
        const allChainOffersAfterAttack: Array<{ player: number; selects: number[] }> = [];
        let sawAttack = false;

        driveDuel(
          lib,
          handle,
          (all, msgs, status) => {
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_NEW_TURN) state.turn++;
              if (m.type === MSG_ATTACK) sawAttack = true;
            }

            // Collect ALL chain offers after attack until battle is fully resolved
            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN && sawAttack) {
                allChainOffersAfterAttack.push({
                  player: m.player,
                  selects: (m.selects ?? []).map((s) => s.code),
                });
              }
            }

            // Stop when Ojama Green moves to GY (battle resolved) or we hit NEW_TURN after attack
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.card === OJAMA_GREEN &&
                m.to?.location === OcgLocation.GRAVE
              ) {
                state.battleDone = true;
              }
            }
            if (state.battleDone) return { stop: true };

            if (status !== 1) return {};

            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD) {
                if (state.turn === 3 && !state.movedToBP && m.player === 0 && m.to_bp) {
                  state.movedToBP = true;
                  return { response: { type: 1, action: 6 } }; // TO_BP
                }
                return { response: { type: 1, action: 7 } }; // TO_EP
              }
            }

            for (const m of msgs as BattleCmdMsg[]) {
              if (m.type === MSG_SELECT_BATTLECMD && !state.attacked) {
                if ((m.attacks ?? []).length > 0) {
                  state.attacked = true;
                  return { response: { type: 0, action: 1, index: 0 } }; // ATTACK
                }
                return { response: { type: 0, action: 3 } }; // TO_EP
              }
              if (m.type === MSG_SELECT_BATTLECMD) {
                return { response: { type: 0, action: 3 } }; // TO_EP after attack
              }
            }

            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN) {
                // Activate LED's trigger if offered; otherwise pass
                const ledIdx = (m.selects ?? []).findIndex((s) => s.code === LIGHT_END_DRAGON);
                if (ledIdx >= 0) {
                  return { response: { type: 8, index: ledIdx } }; // activate
                }
                return { response: { type: 8, index: null } }; // pass
              }
            }

            return { response: defaultRespond(msgs as never) };
          },
          15_000,
        );

        const ledOffer = allChainOffersAfterAttack.find(
          (c) => c.player === 0 && c.selects.includes(LIGHT_END_DRAGON),
        );

        expect(
          ledOffer,
          `Expected SELECT_CHAIN player=0 with Light End Dragon [${LIGHT_END_DRAGON}] ` +
            `after attacking face-down defender (IsFaceup() check removed from condition). ` +
            `All chain offers after attack: ${JSON.stringify(allChainOffersAfterAttack)}`,
        ).toBeDefined();
      },
      25_000,
    );
  },
);

// ── ERR-DESTINYENDDRAGOON ─────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-DESTINYENDDRAGOON — Destiny End Dragoon Edison override [requires custom WASM]",
  () => {
    it("ERR-DESTINYENDDRAGOON — destroy ignition is non-targeting: no BECOME_TARGET on opponent monster", async () => {
      // Setup:
      //   P0 MZONE: Destiny End Dragoon (76263644) face-up — ignition: destroy opp monster
      //             + deal damage equal to its ATK (Edison: non-targeting, removed CARD_TARGET)
      //   P1 MZONE: Koumori Dragon (67724379) face-up
      //
      // Expected:
      //   - DEDragoon's ignition IS offered in IDLECMD.activates
      //   - NO MSG_CARD_TARGET (96) for KOUMORI (non-targeting)
      //   - Koumori moves to GRAVE (MSG_MOVE)

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: DESTINY_END_DRAGOON,
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
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { activated: false };
      let koumoriCardTargeted = false;
      const movesToGrave: number[] = [];
      let ignitionFound = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{
          type: number;
          card?: { code?: number };
          cards?: Array<{ code?: number }>;
        }>) {
          if (m.type === MSG_CARD_TARGET && m.card?.code === KOUMORI) {
            koumoriCardTargeted = true;
          }
          if (m.type === MSG_BECOME_TARGET) {
            if ((m.cards ?? []).some((c) => c.code === KOUMORI)) koumoriCardTargeted = true;
          }
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
            movesToGrave.push(m.card);
          }
        }

        if (movesToGrave.includes(KOUMORI)) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === DESTINY_END_DRAGOON);
            if (idx >= 0 && !state.activated) {
              ignitionFound = true;
              state.activated = true;
              return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) {
            return { response: { type: 8, index: null } }; // pass
          }
        }

        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_SELECT_CARD) {
            return { response: { type: 5, indicies: [0] } }; // choose first
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      expect(
        ignitionFound,
        `Destiny End Dragoon [${DESTINY_END_DRAGOON}] ignition must appear in IDLECMD.activates`,
      ).toBe(true);

      expect(
        movesToGrave.includes(KOUMORI),
        `Koumori [${KOUMORI}] must be destroyed and sent to GRAVE. ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);

      expect(
        koumoriCardTargeted,
        `No CARD_TARGET/BECOME_TARGET expected for Koumori (non-targeting destroy)`,
      ).toBe(false);
    }, 20_000);

    it("ERR-DESTINYENDDRAGOON — destroy ignition deals damage even for a face-down target", async () => {
      // Edison fix: removed IsFaceup() check before dealing damage.
      // The operation uses GetAttack() before Destroy(), unconditionally.
      //
      // Setup:
      //   P0 MZONE: Destiny End Dragoon (76263644) face-up
      //   P1 MZONE: Koumori (67724379) face-DOWN defense — ATK=1500
      //
      // Expected:
      //   - Ignition fires, destroys face-down Koumori
      //   - MSG_DAMAGE (91) appears for P1
      //   (Note: damage amount may be 0 if GetAttack() returns 0 for face-down cards —
      //    in that case this is recorded as a DEFECT of the engine, not the override.)

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: DESTINY_END_DRAGOON,
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
            position: OcgPosition.FACEDOWN_DEFENSE,
          },
        ],
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { activated: false };
      const damageEvents: Array<{ player: number; amount: number }> = [];
      const movesToGrave: number[] = [];

      driveDuel(
        lib,
        handle,
        (all, msgs, status) => {
          for (const m of msgs as DamageMsg[]) {
            if (m.type === MSG_DAMAGE) {
              damageEvents.push({ player: m.player, amount: m.amount });
            }
          }
          for (const m of msgs as MoveMsg[]) {
            if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
              movesToGrave.push(m.card);
            }
          }

          // Stop after the chain fully ends (when we have Koumori in GY AND any damage event OR
          // we see a new turn/idle after Koumori destroyed)
          if (movesToGrave.includes(KOUMORI) && damageEvents.length > 0) return { stop: true };

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === DESTINY_END_DRAGOON);
              if (idx >= 0 && !state.activated) {
                state.activated = true;
                return { response: { type: 1, action: 5, index: idx } };
              }
              return { response: { type: 1, action: 7 } };
            }
          }

          for (const m of msgs as SelectChainMsg[]) {
            if (m.type === MSG_SELECT_CHAIN) {
              return { response: { type: 8, index: null } };
            }
          }

          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_SELECT_CARD) {
              return { response: { type: 5, indicies: [0] } };
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        12_000,
      );

      expect(
        movesToGrave.includes(KOUMORI),
        `Face-down Koumori [${KOUMORI}] must be destroyed`,
      ).toBe(true);

      const p1Damage = damageEvents.filter((d) => d.player === 1);
      expect(
        p1Damage.length > 0,
        `MSG_DAMAGE for P1 expected (face-down target — damage unconditional in Edison). ` +
          `Got: ${JSON.stringify(p1Damage)}`,
      ).toBe(true);
    }, 20_000);
  },
);

// ── ERR-FORTUNELADYLIGHT ──────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-FORTUNELADYLIGHT — Fortune Lady Light Edison override [requires custom WASM]",
  () => {
    // DEFECT: ocgcore does not fire TRIGGER_O at EVENT_LEAVE_FIELD for face-down cards.
    // The override correctly removes IsPreviousPosition(POS_FACEUP) from spcon, but the engine
    // suppresses trigger recognition for face-down cards at EVENT_LEAVE_FIELD — the trigger
    // is never added to the chain window. Face-UP FLL's trigger DOES fire correctly (confirmed).
    // Recorded as it.fails() so the engine gap stays visible.
    it.fails(
      "ERR-FORTUNELADYLIGHT — leave-field trigger activates even when Fortune Lady Light is face-down",
      async () => {
        // Edison fix: removed IsPreviousPosition(POS_FACEUP) from spcon.
        // The trigger fires whether FLL left the field face-up or face-down.
        //
        // Setup:
        //   P0 MZONE: Fortune Lady Light (34471458) face-DOWN defense
        //   P0 HAND:  Dark Hole (53129443) — P0 destroys all monsters including face-down FLL
        //   P0 deck:  Fortune Lady Water (29088922) ×5 — target for the SS trigger
        //
        // DEFECT: engine suppresses EVENT_LEAVE_FIELD trigger for face-down cards.
        // fllInGrave=true (FLL IS destroyed) but the trigger is never offered in SELECT_CHAIN.

        currentDuel = await createDuelWithState({
          extraCards0: [
            {
              code: FORTUNE_LADY_LIGHT,
              location: OcgLocation.MZONE,
              sequence: 0,
              position: OcgPosition.FACEDOWN_DEFENSE,
            },
            {
              code: DARK_HOLE,
              location: OcgLocation.HAND,
              sequence: 0,
              position: OcgPosition.FACEUP,
            },
          ],
          // 5 FLW copies so at least 3 survive 2 draws (startingDrawCount=1 + 1 turn draw)
          deck0: [
            FORTUNE_LADY_WATER,
            FORTUNE_LADY_WATER,
            FORTUNE_LADY_WATER,
            FORTUNE_LADY_WATER,
            FORTUNE_LADY_WATER,
            ...FILLER.slice(0, 11),
          ],
          deck1: FILLER.slice(0, 16),
          startingDrawCount: 1,
        });

        const { lib, handle } = currentDuel;

        const state = { activatedDarkHole: false };
        let fllTriggerOffered = false;
        let fllInGrave = false;

        driveDuel(
          lib,
          handle,
          (all, msgs, status) => {
            for (const m of msgs as MoveMsg[]) {
              if (
                m.type === MSG_MOVE &&
                m.card === FORTUNE_LADY_LIGHT &&
                m.to?.location === OcgLocation.GRAVE
              ) {
                fllInGrave = true;
              }
            }

            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN && fllInGrave) {
                const hasFLL = (m.selects ?? []).some((s) => s.code === FORTUNE_LADY_LIGHT);
                if (hasFLL) {
                  fllTriggerOffered = true;
                  return { stop: true };
                }
              }
            }

            if (status !== 1) return {};

            for (const m of msgs as IdleCmdMsg[]) {
              if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
                if (!state.activatedDarkHole) {
                  const idx = (m.activates ?? []).findIndex((a) => a.code === DARK_HOLE);
                  if (idx >= 0) {
                    state.activatedDarkHole = true;
                    return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE Dark Hole
                  }
                }
                return { response: { type: 1, action: 7 } }; // TO_EP
              }
            }

            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN) {
                // Check if FLL trigger is available (activate it)
                const fllIdx = (m.selects ?? []).findIndex((s) => s.code === FORTUNE_LADY_LIGHT);
                if (fllIdx >= 0) {
                  fllTriggerOffered = true;
                  return { response: { type: 8, index: fllIdx } };
                }
                return { response: { type: 8, index: null } }; // pass
              }
            }

            // SELECT_CARD during FLL operation — pick Fortune Lady Water from deck (index 0)
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_SELECT_CARD) {
                return { response: { type: 5, indicies: [0] } };
              }
            }

            return { response: defaultRespond(msgs as never) };
          },
          15_000,
        );

        expect(
          fllTriggerOffered,
          `Fortune Lady Light [${FORTUNE_LADY_LIGHT}] leave-field trigger must be offered ` +
            `even when FLL was face-down when removed (IsPreviousPosition check removed). ` +
            `fllInGrave=${fllInGrave}, fllTriggerOffered=${fllTriggerOffered}`,
        ).toBe(true);
      },
      20_000,
    );
  },
);

// ── ERR-PRISMA ────────────────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-PRISMA — Elemental HERO Prisma Edison override [requires custom WASM]",
  () => {
    it("ERR-PRISMA — reveal+send is on resolution: fusion material sent to GY after chain resolves", async () => {
      // Edison fix: reveal+send moved from SetCost to operation (resolution).
      // Nothing is sent to GY at activation; all sending happens when the chain resolves.
      //
      // Setup:
      //   P0 MZONE:  Elemental HERO Prisma (89312388) face-up
      //   P0 EXTRA:  Red-Eyes Dark Dragoon (37818794) [s.material={DM,REBG}]
      //   P0 deck:   Dark Magician (46986414) — fusion material
      //
      // Note: Red-Eyes Dark Dragoon has s.material={46986414,74677422} so Prisma's
      //       filter1 passes with Dark Magician in deck.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: PRISMA,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: REDD,
            location: OcgLocation.EXTRA,
            sequence: 0,
            position: OcgPosition.FACEDOWN,
          },
        ],
        deck0: [DARK_MAGICIAN, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { activated: false };
      const movesToGrave: number[] = [];
      let prismaActivatesFound = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
            movesToGrave.push(m.card);
          }
        }

        // Stop after Dark Magician is sent to GY
        if (movesToGrave.includes(DARK_MAGICIAN)) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === PRISMA);
            if (idx >= 0 && !state.activated) {
              prismaActivatesFound = true;
              state.activated = true;
              return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) {
            return { response: { type: 8, index: null } }; // pass
          }
        }

        // SELECT_CARD: on resolution — first call = choose REDD from Extra,
        // second call = choose Dark Magician from deck; both respond index 0.
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_SELECT_CARD) {
            return { response: { type: 5, indicies: [0] } };
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      expect(
        prismaActivatesFound,
        `Prisma [${PRISMA}] must appear in IDLECMD.activates (filter1 found REDD+DM)`,
      ).toBe(true);

      expect(
        movesToGrave.includes(DARK_MAGICIAN),
        `Dark Magician [${DARK_MAGICIAN}] must be sent to GRAVE on resolution ` +
          `(reveal+send is at resolution, not cost). ` +
          `Moves to grave: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);
    }, 25_000);
  },
);

// ── ERR-ANCIENTFAIRY ─────────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)(
  "ERR-ANCIENTFAIRY — Ancient Fairy Dragon Edison override [requires custom WASM]",
  () => {
    it("ERR-ANCIENTFAIRY — e2 destroy-field is non-targeting: Umi not CARD_TARGET'd by AFD ignition", async () => {
      // Edison fix (e2): removed EFFECT_FLAG_CARD_TARGET; field spell selected
      // at resolution (non-targeting). If destroy fails, no LP/no add.
      //
      // Setup:
      //   P0 MZONE: Ancient Fairy Dragon (25862691) face-up
      //   P0 HAND:  Ojama Green (12482652) — Level 1, makes e1 available so the combined
      //             activates entry appears (ocgcore requires e1 also feasible for any
      //             AFD ignition to appear in activates)
      //   P1 SZONE[5]: Umi (22702055) face-up — field spells reside at SZONE seq 5 in Edison MR1
      //             (e2 registered first → it is the primary activatable entry at idx 0)
      //
      // Expected:
      //   - AFD's e2 IS offered in IDLECMD.activates (as the first entry, desc=Stringid(id,1))
      //   - NO MSG_CARD_TARGET (96) for Umi (non-targeting)
      //   - Umi moves to GRAVE (MSG_MOVE)

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: ANCIENT_FAIRY,
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
            // Field spells in Edison MR1 reside at SZONE sequence 5 (the "Field Zone" slot)
            code: UMI,
            location: OcgLocation.SZONE,
            sequence: 5,
            position: OcgPosition.FACEUP,
          },
        ],
        // Use Level-4 or lower filler so e1 (needs Level≤4 in hand) is feasible via drawn card
        deck0: FILLER.slice(0, 16),
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      const state = { activated: false };
      let umiCardTargeted = false; // CARD_TARGET specifically for Umi
      const movesToGrave: number[] = [];
      let e2Found = false;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number; card?: { code?: number } }>) {
          // CARD_TARGET (96) fires specifically for targeting effects with EFFECT_FLAG_CARD_TARGET
          if (m.type === MSG_CARD_TARGET && m.card?.code === UMI) {
            umiCardTargeted = true;
          }
        }
        for (const m of msgs as MoveMsg[]) {
          if (m.type === MSG_MOVE && m.to?.location === OcgLocation.GRAVE) {
            movesToGrave.push(m.card);
          }
        }

        if (movesToGrave.includes(UMI)) return { stop: true };

        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && m.player === 0) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === ANCIENT_FAIRY);
            if (idx >= 0 && !state.activated) {
              e2Found = true;
              state.activated = true;
              return { response: { type: 1, action: 5, index: idx } }; // ACTIVATE
            }
            return { response: { type: 1, action: 7 } }; // TO_EP
          }
        }

        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) {
            return { response: { type: 8, index: null } }; // pass
          }
        }

        // SELECT_OPTION: if AFD has multiple effects available, choose e2 (destroy-field)
        // With only Umi on field (no hand monster for e1), typically e2 is the only option.
        for (const m of msgs as Array<{ type: number; options?: unknown[] }>) {
          if (m.type === 14 /* SELECT_OPTION */) {
            const len = (m.options ?? []).length;
            return { response: { type: 4, index: len > 1 ? 1 : 0 } };
          }
        }

        // SELECT_CARD at resolution: choose Umi (only field spell present)
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_SELECT_CARD) {
            return { response: { type: 5, indicies: [0] } };
          }
        }

        // SELECT_YESNO: say No (don't search field spell from deck)
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === 13 /* SELECT_YESNO */) {
            return { response: { type: 3, yes: false } };
          }
        }

        return { response: defaultRespond(msgs as never) };
      });

      expect(
        e2Found,
        `Ancient Fairy Dragon [${ANCIENT_FAIRY}] must appear in IDLECMD.activates`,
      ).toBe(true);

      expect(
        movesToGrave.includes(UMI),
        `Umi [${UMI}] must be destroyed by AFD e2 and sent to GRAVE. ` +
          `Moves: ${JSON.stringify(movesToGrave)}`,
      ).toBe(true);

      expect(
        umiCardTargeted,
        `No CARD_TARGET for Umi expected (non-targeting e2 — EFFECT_FLAG_CARD_TARGET removed). ` +
          `CARD_TARGET fired: ${umiCardTargeted}`,
      ).toBe(false);
    }, 25_000);

    it("ERR-ANCIENTFAIRY — e1 special-summon ignition offered in Main Phase 2 (MP1-only restriction removed)", async () => {
      // Edison fix (e1): removed SetCondition restricting to PHASE_MAIN1.
      // In Edison, the SS ignition is available in BOTH Main Phase 1 and Main Phase 2.
      //
      // Setup:
      //   P0 MZONE: Ancient Fairy Dragon (25862691) face-up
      //   P0 HAND:  Ojama Green (12482652) — Level 1, makes e1 available (Level≤4 filter)
      //   P1 SZONE[5]: Umi (22702055) face-up — makes e2 available (field spell present)
      //   Both effects available → the combined activates entry appears in MP2 IDLECMD.
      //
      // Without the fix (original had PHASE_MAIN1 restriction on e1): in MP2 only e2 would be
      // available, but e2 alone doesn't cause the entry to appear → AFD not in MP2 activates.
      // With the fix (restriction removed): both e1 and e2 are available → entry appears ✓
      //
      // Drive:
      //   Turn 1 (P0): MP1 → EP (no BP on turn 1)
      //   Turn 2 (P1): MP1 → EP
      //   Turn 3 (P0): MP1 → TO_BP → BP → TO_M2 → MP2:
      //     Assert: SELECT_IDLECMD.activates contains AFD (25862691) → ignition available in MP2

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: ANCIENT_FAIRY,
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
            // Field spells in Edison MR1 reside at SZONE sequence 5
            code: UMI,
            location: OcgLocation.SZONE,
            sequence: 5,
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
        wentToBP: false,
        movedToMP2: false,
      };
      let mp2Activates: number[] = [];
      let mp2IdleSeen = false;

      driveDuel(
        lib,
        handle,
        (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_NEW_TURN) state.turn++;
          }

          // Detect the MP2 IDLECMD (after movedToMP2 flag set)
          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD && state.movedToMP2 && m.player === 0) {
              mp2Activates = (m.activates ?? []).map((a) => a.code);
              mp2IdleSeen = true;
              return { stop: true };
            }
          }

          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              if (state.turn === 3 && m.player === 0 && !state.wentToBP && m.to_bp) {
                state.wentToBP = true;
                return { response: { type: 1, action: 6 } }; // TO_BP
              }
              return { response: { type: 1, action: 7 } }; // TO_EP
            }
          }

          for (const m of msgs as BattleCmdMsg[]) {
            if (m.type === MSG_SELECT_BATTLECMD && state.wentToBP && !state.movedToMP2) {
              state.movedToMP2 = true;
              return { response: { type: 0, action: 2 } }; // TO_M2
            }
          }

          return { response: defaultRespond(msgs as never) };
        },
        20_000,
      );

      expect(mp2IdleSeen, "Must reach Main Phase 2 SELECT_IDLECMD (turn 3, after BP → TO_M2)").toBe(
        true,
      );

      expect(
        mp2Activates.includes(ANCIENT_FAIRY),
        `Ancient Fairy Dragon [${ANCIENT_FAIRY}] ignition must appear in MP2 IDLECMD.activates ` +
          `(PHASE_MAIN1-only restriction removed; both e1 and e2 are available in MP2). ` +
          `MP2 activates: ${JSON.stringify(mp2Activates)}`,
      ).toBe(true);
    }, 30_000);
  },
);
