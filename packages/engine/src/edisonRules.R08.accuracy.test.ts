// ---------------------------------------------------------------------------
// R08 — The 7-timing Damage Step accuracy tests (empirical — requires custom WASM).
//
// 16 behaviors tested:
//   Activation-legality: R08-A1 through R08-A9
//   Substeps:            R08-S1 through R08-S7
//
// Conventions:
//   - it.fails() marks DEFECT (engine disagrees with expected Edison behavior)
//   - CARVE-OUT comments mark rows where a named card is unavailable in pool
//   - SUBSTITUTION comments mark where a substitute card is used
//
// Card availability (checked against assets/scripts/official/):
//   - Herald of Orange Light [26649759]: NOT AVAILABLE → R08-A2 uses Doomcaliber Knight [78700060]
//   - Giant Rat [91190709]: NOT AVAILABLE → R08-A7 tests flip-effect aspect only (Ryko)
//   - All other named cards confirmed in assets/scripts/official/
//
// Key empirical facts found during test development:
//   - FILLER[0] = 32864: ATK 1200 (NOT 1800 as assumed initially)
//   - FILLER[15] = 5053103: ATK 1700 (used when high-ATK attacker needed)
//   - Ryko's battle-flip Flip effect fires as CHAINING (msg 70), NOT FLIPSUMMONING (msg 64)
//   - POS_CHANGE (msg 53) fires immediately after DAMAGE_STEP_START for face-down targets
//   - Forbidden Chalice from HAND is NOT offered inside DS chain windows (only face-down SZONE)
//   - Gorz [44330098]: EVENT_DAMAGE in DS does not produce chain offer (DEFECT, marked it.fails)
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
const HONEST = 37742478; // Honest — LIGHT/Fairy, 1100 ATK; ATK boost in DS from HAND
const DIVINE_WRATH = 49010598; // Divine Wrath — Counter Trap, negates monster effect
const FORBIDDEN_CHALICE = 25789292; // Forbidden Chalice — QP Spell; changes ATK in DS (cutoff at S4)
const DOOMCALIBER = 78700060; // Doomcaliber Knight — 1900 ATK; mandatory negates monster effects in DS
const GORZ = 44330098; // Gorz the Emissary of Darkness — hand trigger on battle damage
const ROYAL_OPPRESSION = 93016201; // Royal Oppression — Continuous Trap, negates SS
const MY_BODY = 69279219; // My Body as a Shield — negate-activation S/T (ERR-MYBODY)
const EFFECT_VEILER = 97268402; // Effect Veiler — negate effect only, main-phase condition
const RYKO = 21502796; // Ryko, Lightsworn Hunter — 200 ATK/100 DEF face-down flip-effect
const MYSTIC_TOMATO = 83011277; // Mystic Tomato — DARK/Plant, 1400 ATK; "destroyed by battle" SS
const OJAMA_GREEN = 12482652; // Ojama Green — 0 ATK/1000 DEF normal monster

// FILLER card passcodes with verified ATK values
const LOW_ATK_FILLER = FILLER[0]!; // 32864, ATK 1200 — "low" relative to Tomato (1400)
const HIGH_ATK_FILLER = FILLER[15]!; // 5053103, ATK 1700 — can destroy Mystic Tomato (1400)

// ── Message-type numeric constants ────────────────────────────────────────────
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN; // 16
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_SELECT_BATTLECMD = OcgMessageType.SELECT_BATTLECMD; // 10
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40
const MSG_MOVE = OcgMessageType.MOVE; // 50
const MSG_POS_CHANGE = OcgMessageType.POS_CHANGE; // 53
const MSG_CHAINING = OcgMessageType.CHAINING; // 70 (Ryko flip effect fires as CHAINING, not FLIPSUMMONING)
const MSG_BATTLE = OcgMessageType.BATTLE; // 111
const MSG_DAMAGE_STEP_START = OcgMessageType.DAMAGE_STEP_START; // 113
const MSG_DAMAGE_STEP_END = OcgMessageType.DAMAGE_STEP_END; // 114
const MSG_ATTACK = 110; // OcgMessageType.ATTACK

// ── Shared duel handle for afterEach cleanup ──────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message helpers ─────────────────────────────────────────────────────

interface SelectChainMsg {
  type: number;
  player: number;
  selects?: Array<{ code: number }>;
}

interface SelectIdleCmdMsg {
  type: number;
  player: number;
  to_bp?: boolean;
}

interface SelectBattleCmdMsg {
  type: number;
  player: number;
  attacks?: Array<{ code: number }>;
}

interface MoveMsg {
  type: number;
  card: number;
  from: { location: number };
  to: { location: number };
}

interface BattleMsg {
  type: number;
  card?: { destroyed: boolean };
  target?: { destroyed: boolean };
}

interface ChainingMsg {
  type: number;
  code: number;
  controller: number;
}

// ── Common battle-phase driver ─────────────────────────────────────────────────
//
// `attacked` is set ONLY when an actual attack is declared.  We deliberately
// do NOT track `movedToBP` — players can enter the Battle Phase on any eligible
// turn without blocking future BP entries.
//
// Behaviour:
//   IDLECMD + to_bp=true + !attacked → enter BP
//   IDLECMD + (to_bp=false or attacked) → END PHASE
//   BATTLECMD + attacks.length>0 + !attacked → ATTACK index 0 (sets attacked=true)
//   BATTLECMD + (no attacks or attacked) → END PHASE

interface AttackState {
  attacked: boolean;
}

function makeAttackState(): AttackState {
  return { attacked: false };
}

function advanceAttack(
  msgs: unknown[],
  status: number,
  state: AttackState,
): { type: 1; action: number } | { type: 0; action: number; index?: number } | null {
  if (status !== 1 /* WAITING */) return null;
  for (const m of msgs as SelectIdleCmdMsg[]) {
    if (m.type === MSG_SELECT_IDLECMD) {
      if (!state.attacked && m.to_bp) {
        return { type: 1, action: 6 }; // TO_BP — every eligible turn until attack declared
      }
      return { type: 1, action: 7 }; // TO_EP
    }
  }
  for (const m of msgs as SelectBattleCmdMsg[]) {
    if (m.type === MSG_SELECT_BATTLECMD) {
      if (!state.attacked && (m.attacks?.length ?? 0) > 0) {
        state.attacked = true;
        return { type: 0, action: 1, index: 0 }; // ATTACK with first monster
      }
      return { type: 0, action: 3 }; // TO_EP
    }
  }
  return null;
}

// ── R08 Damage Step tests ─────────────────────────────────────────────────────

describe.skipIf(!WASM_AVAILABLE)("R08 — The 7-timing Damage Step [requires custom WASM]", () => {
  // ── A1: Counter Trap offered in DS ──────────────────────────────────────
  it("R08-A1 — Counter Trap (Divine Wrath) IS offered in DS when a monster effect activates", async () => {
    // P0: LOW_ATK_FILLER (1200 ATK) + Divine Wrath face-down SZONE + FILLER[1] in HAND (discard cost).
    // P1: Honest (1100 ATK, LIGHT) in MZONE + Honest in HAND.
    // Turn 2: P1 (Honest 1100) attacks P0 (FILLER 1200). P1 loses, DS fires.
    // In DS P1 is offered hand Honest (LIGHT attacker). P1 activates Honest.
    // → P0 offered Divine Wrath (Counter Trap chains to monster-effect activation).
    // Assert: Divine Wrath in P0's SELECT_CHAIN selects during DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: DIVINE_WRATH,
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
        {
          code: FILLER[1]!,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let divineWrathOfferedToP0 = false;
    let p1HonestActivated = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep && m.player === 0) {
          if ((m.selects ?? []).some((s) => s.code === DIVINE_WRATH)) {
            divineWrathOfferedToP0 = true;
            return { stop: true };
          }
        }
      }

      if (divineWrathOfferedToP0 || turn > 5) return { stop: true };
      if (status !== 1) return {};

      if (inDamageStep) {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && m.player === 1 && !p1HonestActivated) {
            const idx = (m.selects ?? []).findIndex((s) => s.code === HONEST);
            if (idx >= 0) {
              p1HonestActivated = true;
              return { response: { type: 8, index: idx } };
            }
          }
        }
      }

      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      divineWrathOfferedToP0,
      `Expected Divine Wrath [${DIVINE_WRATH}] in P0's SELECT_CHAIN during DS. ` +
        `Counter Traps may activate at ANY point in DS. p1HonestActivated=${String(p1HonestActivated)}`,
    ).toBe(true);
  }, 25_000);

  // ── A2: Monster negate-activation offered in DS (CARVE-OUT / SUBSTITUTE) ─
  it("R08-A2 — [SUBSTITUTE: Doomcaliber for Herald] negate-activation monster fires in DS", async () => {
    // CARVE-OUT: Herald of Orange Light [26649759] NOT in asset pool.
    // SUBSTITUTE: Doomcaliber Knight [78700060] (QUICK_F, mandatory; negates monster-effect
    //   activations in DS on EVENT_CHAINING).  Tests rule: negate-activation monster effects
    //   CAN activate in DS (mandatory variant; optional aspect noted — A6 tests mandatory more).
    //
    // P0: Doomcaliber (1900 ATK) in MZONE.
    // P1: Honest (1100 ATK, LIGHT) in MZONE + Honest in HAND.
    // Turn 2: P1 (Honest 1100) attacks P0 (Doomcaliber 1900). P1 loses, DS fires.
    // P1 offered hand Honest → activates it → Doomcaliber auto-fires (CHAINING=70).
    // Assert: CHAINING message with code=Doomcaliber appears inside DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: DOOMCALIBER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let doomcaliberChained = false;
    let p1HonestActivated = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as ChainingMsg[]) {
        if (m.type === MSG_CHAINING && inDamageStep && m.code === DOOMCALIBER) {
          doomcaliberChained = true;
          return { stop: true };
        }
      }

      if (doomcaliberChained || turn > 5) return { stop: true };
      if (status !== 1) return {};

      if (inDamageStep) {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && m.player === 1 && !p1HonestActivated) {
            const idx = (m.selects ?? []).findIndex((s) => s.code === HONEST);
            if (idx >= 0) {
              p1HonestActivated = true;
              return { response: { type: 8, index: idx } };
            }
          }
        }
      }

      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      doomcaliberChained,
      `Expected Doomcaliber [${DOOMCALIBER}] CHAINING in DS ` +
        `(negate-activation monster effects may fire in DS). ` +
        `p1HonestActivated=${String(p1HonestActivated)}`,
    ).toBe(true);
  }, 25_000);

  // ── A3: Effect-only-negate monster NOT offered in DS ──────────────────────
  it("R08-A3 — Effect Veiler [97268402] (negate EFFECT only) NOT offered during DS", async () => {
    // Effect Veiler condition: IsTurnPlayer(1-tp) && IsMainPhase() → not in DS.
    // P0: LOW_ATK_FILLER.  P1: FILLER[0] target + Effect Veiler in HAND.
    // Turn 2: P1 attacks P0. DS fires. Veiler should NOT appear.
    // Assert: Effect Veiler never in SELECT_CHAIN.selects during DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: EFFECT_VEILER,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let effectVeilerOffered = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      if (turn > 5) return { stop: true };

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep) {
          if ((m.selects ?? []).some((s) => s.code === EFFECT_VEILER)) {
            effectVeilerOffered = true;
          }
        }
      }

      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      effectVeilerOffered,
      `Effect Veiler [${EFFECT_VEILER}] must NOT appear in SELECT_CHAIN during DS ` +
        `(condition restricts to opponent Main Phase). attackSeen=${String(attackSeen)}`,
    ).toBe(false);
  }, 20_000);

  // ── A4: My Body as a Shield NOT offered in DS — VERIFIED-PASS ─────────────
  it("R08-A4 — My Body as a Shield [69279219] NOT offered during DS", async () => {
    // Expected (Edison): CANNOT activate in DS.  Engine correctly absent.
    // Note: ERR-MYBODY curation (removing EFFECT_FLAG_DAMAGE_STEP + DAMAGE_CAL)
    // still needed for edge-cases where a destroy activation occurs in DS.
    // P0: LOW_ATK_FILLER + My Body in HAND.  P1: Ryko face-down.
    // Turn 3: P0 attacks face-down Ryko (P1 can't attack with face-down).
    // Ryko's flip fires in DS. My Body should NOT be offered.
    // Assert: My Body as a Shield never in SELECT_CHAIN.selects during DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: MY_BODY,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: RYKO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let inDamageStep = false;
    let myBodyOffered = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      if (turn > 5) return { stop: true };

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep) {
          if ((m.selects ?? []).some((s) => s.code === MY_BODY)) {
            myBodyOffered = true;
          }
        }
      }

      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      myBodyOffered,
      `My Body as a Shield [${MY_BODY}] must NOT appear in DS chain windows. ` +
        `attackSeen=${String(attackSeen)}`,
    ).toBe(false);
  }, 25_000);

  // ── A5: Royal Oppression NOT offered in DS ────────────────────────────────
  it("R08-A5 — Royal Oppression [93016201] NOT offered during DS", async () => {
    // Royal Oppression responds to EVENT_SPSUMMON only; no SS in plain battle.
    // P0: LOW_ATK_FILLER.  P1: LOW_ATK_FILLER + Royal Oppression face-up SZONE.
    // Assert: Royal Oppression absent from DS chain windows.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: ROYAL_OPPRESSION,
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let inDamageStep = false;
    let royalOppOffered = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      if (turn > 5) return { stop: true };

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep) {
          if ((m.selects ?? []).some((s) => s.code === ROYAL_OPPRESSION)) {
            royalOppOffered = true;
          }
        }
      }

      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      royalOppOffered,
      `Royal Oppression [${ROYAL_OPPRESSION}] must NOT appear in DS chain windows. ` +
        `attackSeen=${String(attackSeen)}`,
    ).toBe(false);
  }, 20_000);

  // ── A6: Doomcaliber mandatory fires + moves to GRAVE in DS ───────────────
  it("R08-A6 — Doomcaliber Knight [78700060] mandatory effect fires and tributes itself in DS", async () => {
    // Doomcaliber (QUICK_F, EVENT_CHAINING): when a monster effect activates,
    // auto-tributes itself and negates that effect.  Fires without player prompt.
    //
    // P0: LOW_ATK_FILLER (MZONE[0]) + Doomcaliber (MZONE[1]).
    // P1: Honest (1100 ATK) + Honest in HAND.
    // Turn 2: P1 attacks → DS → P1 activates Honest → Doomcaliber auto-fires.
    // Assert: CHAINING with Doomcaliber code; Doomcaliber MOVE to GRAVE.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: DOOMCALIBER,
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let doomcaliberChained = false;
    let doomcaliberToGrave = false;
    let p1HonestActivated = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (doomcaliberChained) return { stop: true };
        }
      }

      for (const m of msgs as ChainingMsg[]) {
        if (m.type === MSG_CHAINING && inDamageStep && m.code === DOOMCALIBER) {
          doomcaliberChained = true;
        }
      }
      for (const m of msgs as MoveMsg[]) {
        if (m.type === MSG_MOVE && m.card === DOOMCALIBER && m.to.location === OcgLocation.GRAVE) {
          if (doomcaliberChained) doomcaliberToGrave = true;
        }
      }

      if (doomcaliberToGrave || turn > 5) return { stop: true };
      if (status !== 1) return {};

      if (inDamageStep) {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && m.player === 1 && !p1HonestActivated) {
            const idx = (m.selects ?? []).findIndex((s) => s.code === HONEST);
            if (idx >= 0) {
              p1HonestActivated = true;
              return { response: { type: 8, index: idx } };
            }
          }
        }
      }

      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      doomcaliberChained,
      `Expected Doomcaliber [${DOOMCALIBER}] CHAINING in DS. ` +
        `p1HonestActivated=${String(p1HonestActivated)}`,
    ).toBe(true);
    expect(
      doomcaliberToGrave,
      "Doomcaliber must MOVE to GRAVE (mandatory tribute cost in DS).",
    ).toBe(true);
  }, 25_000);

  // ── A7: Flip effect fires in DS via CHAINING (Giant Rat unavailable) ──────
  it("R08-A7 — Ryko [21502796] Flip effect fires in DS (CHAINING msg; Giant Rat unavailable)", async () => {
    // CARVE-OUT: Giant Rat [91190709] NOT in asset pool — flip-effect aspect only.
    // Rule: a card's effect can activate in DS if the card performs an action (flip).
    // Ryko's Flip effect fires as CHAINING (msg 70), NOT FLIPSUMMONING (msg 64).
    // The effect fires after BATTLE (damage calc at S4).
    //
    // P0: LOW_ATK_FILLER (1200 ATK).  P1: Ryko face-down (200 ATK / 100 DEF).
    // Turn 3: P0 attacks face-down Ryko (P1 can't attack with face-down).
    //   P0 (1200 ATK) > Ryko (100 DEF) → Ryko destroyed. Flip fires at S6.
    // Assert: CHAINING with code=Ryko appears after BATTLE message.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: RYKO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let attackSeen = false;
    let battleSeen = false;
    let rykoChainingAfterBattle = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_BATTLE && attackSeen) battleSeen = true;
      }

      for (const m of msgs as ChainingMsg[]) {
        if (m.type === MSG_CHAINING && battleSeen && m.code === RYKO) {
          rykoChainingAfterBattle = true;
        }
      }

      if (rykoChainingAfterBattle || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      attackSeen,
      "Expected ATTACK message (P0 attacked face-down Ryko). " +
        "Note: Giant Rat [91190709] unavailable; flip-effect aspect only tested.",
    ).toBe(true);

    expect(
      rykoChainingAfterBattle,
      `Expected CHAINING (70) with Ryko [${RYKO}] code after BATTLE ` +
        "(Ryko's Flip effect fires at S6 via chain; battle-flip uses CHAINING not FLIPSUMMONING). " +
        `attackSeen=${String(attackSeen)} battleSeen=${String(battleSeen)}`,
    ).toBe(true);
  }, 25_000);

  // ── A8: Honest IS offered in DS ───────────────────────────────────────────
  it("R08-A8 — Honest [37742478] IS offered in DS (ATK/DEF fast effect in DS)", async () => {
    // Honest activates from HAND when a LIGHT monster is battling (before damage calc).
    // Spike A2 empirically confirmed; formalised here.
    //
    // P0: Honest (1100 ATK, LIGHT) in MZONE + Honest in HAND.
    // P1: LOW_ATK_FILLER (1200 ATK) in MZONE.
    // Turn 2: P1 (1200 ATK) attacks P0's Honest (1100 ATK, LIGHT defender).
    //   P0's Honest condition met (LIGHT defender). P0 offered hand Honest in DS.
    // Assert: Honest in P0's SELECT_CHAIN selects during DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: LOW_ATK_FILLER,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let honestOfferedToP0 = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep && m.player === 0) {
          if ((m.selects ?? []).some((s) => s.code === HONEST)) {
            honestOfferedToP0 = true;
            return { stop: true };
          }
        }
      }

      if (honestOfferedToP0 || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      honestOfferedToP0,
      `Expected Honest [${HONEST}] in P0's SELECT_CHAIN during DS ` +
        "(ATK/DEF fast effects can activate in DS before damage calc).",
    ).toBe(true);
  }, 20_000);

  // ── A9: Forbidden Chalice NOT offered at/after S4 ─────────────────────────
  it("R08-A9 — Forbidden Chalice [25789292] offered before S4; NOT offered after damage calc", async () => {
    // Chalice uses aux.StatChangeDamageStepCondition = not(PHASE_DAMAGE && IsDamageCalculated).
    // CAN activate in DS S1/S3 (before damage calc).  CANNOT activate at S4+.
    //
    // Note: Chalice from HAND is NOT offered in DS chain windows in this engine
    // (Quick-Play Spells from hand appear to require face-down SZONE for DS activation).
    // Setup uses Chalice face-down in SZONE for an accurate DS test.
    //
    // P0: LOW_ATK_FILLER + Chalice face-down SZONE.  P1: LOW_ATK_FILLER.
    // Turn 2: P1 attacks P0.  DS fires.
    //   Before BATTLE (S1/S3): Chalice offered to P0 from SZONE.
    //   After BATTLE (S4+): Chalice NOT offered.
    // Assert: chaliceBeforeBattle=true; chaliceAfterBattle=false.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: FORBIDDEN_CHALICE,
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      extraCards1: [
        {
          code: LOW_ATK_FILLER,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let battleSeen = false;
    let chaliceBeforeBattle = false;
    let chaliceAfterBattle = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      for (const m of msgs as BattleMsg[]) {
        if (m.type === MSG_BATTLE) battleSeen = true;
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep) {
          if ((m.selects ?? []).some((s) => s.code === FORBIDDEN_CHALICE)) {
            if (!battleSeen) chaliceBeforeBattle = true;
            else chaliceAfterBattle = true;
          }
        }
      }

      if (turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      chaliceBeforeBattle,
      `Expected Forbidden Chalice [${FORBIDDEN_CHALICE}] offered before damage calc in DS ` +
        "(S/T ATK/DEF can activate in DS S1/S3 when face-down in SZONE). " +
        `attackSeen=${String(attackSeen)}`,
    ).toBe(true);

    expect(
      chaliceAfterBattle,
      `Forbidden Chalice [${FORBIDDEN_CHALICE}] must NOT appear after damage calc ` +
        "(cutoff: S/T ATK/DEF cannot activate at/after Substep 4).",
    ).toBe(false);
  }, 20_000);

  // ── S1: DAMAGE_STEP_START fires and ATK/DEF modifier offered ───────────────
  it("R08-S1 — DAMAGE_STEP_START fires and ATK/DEF modifier (Honest) offered at S1", async () => {
    // S1 = Start of Damage Step.  DAMAGE_STEP_START (113) fires.
    // Quick/ATK/DEF effects (EFFECT_FLAG_DAMAGE_STEP) can activate here.
    // P0: Honest (1100 ATK, LIGHT) + Honest in HAND.  P1: LOW_ATK_FILLER (1200 ATK).
    // Turn 2: P1 attacks P0's Honest. In DS: DAMAGE_STEP_START; Honest offered to P0.
    // Assert: MSG_DAMAGE_STEP_START appears; Honest in P0's DS chain window.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: LOW_ATK_FILLER,
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
    const battleState = makeAttackState();
    let damageStepStartSeen = false;
    let honestOfferedInDS = false;
    let inDamageStep = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_DAMAGE_STEP_START) {
          damageStepStartSeen = true;
          inDamageStep = true;
        }
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep && m.player === 0) {
          if ((m.selects ?? []).some((s) => s.code === HONEST)) {
            honestOfferedInDS = true;
            return { stop: true };
          }
        }
      }

      if (honestOfferedInDS || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      damageStepStartSeen,
      "Expected DAMAGE_STEP_START (113) — Damage Step is a distinct phase.",
    ).toBe(true);

    expect(
      honestOfferedInDS,
      `Expected Honest [${HONEST}] in S1 DS chain window ` +
        "(ATK/DEF modifier can activate at S1 = Start of DS).",
    ).toBe(true);
  }, 20_000);

  // ── S2: Face-down flipped face-up before Flip effect fires ────────────────
  it("R08-S2 — face-down target flipped (POS_CHANGE) at S2 before Flip effect fires at S6", async () => {
    // S2: face-down defender flipped face-up (POS_CHANGE = 53).
    //   Flip effect NOT yet on chain at S2.
    // S6: Ryko's Flip effect fires (CHAINING = 70 with Ryko code).
    //
    // Observable from RYKO2 empirical run:
    //   113 (DS_START) → 53 (POS_CHANGE, S2) → 16,16 (S3 chain) → 16,16 (more) →
    //   111 (BATTLE, S4) → 91 (DAMAGE) → 16,16 → 70,71 (Ryko CHAINING, S6) → ...
    //
    // P0: LOW_ATK_FILLER (1200 ATK).  P1: Ryko face-down.
    // Turn 3: P0 attacks face-down Ryko → POS_CHANGE in DS → then Ryko flip fires.
    // Assert: POS_CHANGE appears in DS; CHAINING (Ryko) appears AFTER POS_CHANGE.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: RYKO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let attackSeen = false;
    let posChangeSeen = false;
    let inDamageStep = false;
    let rykoChainAfterPosChange = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START && attackSeen) inDamageStep = true;
        if (m.type === MSG_POS_CHANGE && inDamageStep) posChangeSeen = true;
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as ChainingMsg[]) {
        if (m.type === MSG_CHAINING && posChangeSeen && m.code === RYKO) {
          rykoChainAfterPosChange = true;
        }
      }

      if (rykoChainAfterPosChange || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(attackSeen, "Expected ATTACK message (P0 attacked face-down Ryko).").toBe(true);

    expect(
      posChangeSeen,
      "Expected POS_CHANGE (53) during DS (S2: face-down Ryko flipped face-up in battle).",
    ).toBe(true);

    expect(
      rykoChainAfterPosChange,
      `Expected CHAINING with Ryko [${RYKO}] code after POS_CHANGE ` +
        "(Flip effect fires at S6, AFTER S2 physical flip). " +
        `posChangeSeen=${String(posChangeSeen)}`,
    ).toBe(true);
  }, 25_000);

  // ── S3: Before damage calc, ATK/DEF modifier offered ──────────────────────
  it("R08-S3 — Honest offered at S3 (before damage calc, in DS chain window)", async () => {
    // S3 = Before Damage Calculation.  ATK/DEF modifiers still active.
    // For face-down target: DS_START → POS_CHANGE (S2) → first chain window (S3).
    // Honest is offered to P0 in the S3 window (P0's Honest is LIGHT attacker).
    //
    // P0: Honest (1100 ATK, LIGHT) in MZONE + Honest in HAND.
    // P1: Ryko face-down (200 ATK / 100 DEF).
    // Turn 3: P0 attacks face-down Ryko.  After POS_CHANGE, S3 chain window opens.
    // Assert: Honest offered to P0 AFTER POS_CHANGE fires in DS.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: HONEST,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: HONEST,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: RYKO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let inDamageStep = false;
    let posChangeSeen = false;
    let honestAfterFlip = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START && attackSeen) inDamageStep = true;
        if (m.type === MSG_POS_CHANGE && inDamageStep) posChangeSeen = true;
        if (m.type === MSG_DAMAGE_STEP_END) inDamageStep = false;
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep && posChangeSeen && m.player === 0) {
          if ((m.selects ?? []).some((s) => s.code === HONEST)) {
            honestAfterFlip = true;
            return { stop: true };
          }
        }
      }

      if (honestAfterFlip || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(attackSeen, "Expected ATTACK message (P0 attacked face-down Ryko).").toBe(true);

    expect(
      honestAfterFlip,
      `Expected Honest [${HONEST}] offered to P0 in DS AFTER POS_CHANGE ` +
        "(S3 = before damage calc; ATK/DEF modifier offered after flip at S2). " +
        `posChangeSeen=${String(posChangeSeen)} attackSeen=${String(attackSeen)}`,
    ).toBe(true);
  }, 25_000);

  // ── S4: Damage calc — Chalice cutoff; destroyed-by-battle marked ──────────
  it("R08-S4 — Chalice absent after damage calc; monster marked destroyed-by-battle", async () => {
    // S4 = Damage Calculation.  IsDamageCalculated=true → Chalice condition fails.
    // BATTLE message shows .card.destroyed / .target.destroyed flags.
    //
    // P0: LOW_ATK_FILLER (1200 ATK) + Chalice face-down SZONE.
    // P1: Honest (1100 ATK) in MZONE.
    // Turn 2: P1 (Honest 1100) attacks P0 (FILLER 1200).
    //   P1's Honest (attacker, 1100 < 1200) is DESTROYED. BATTLE.card.destroyed=true.
    //   Chalice IS offered before BATTLE (S1/S3). NOT offered after BATTLE (S4+).
    // Assert: BATTLE.card.destroyed=true; chaliceAfterBattle=false.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: FORBIDDEN_CHALICE,
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      extraCards1: [
        {
          code: HONEST,
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
    const battleState = makeAttackState();
    let inDamageStep = false;
    let battleSeen = false;
    let attackerDestroyed = false;
    let chaliceAfterBattle = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      for (const m of msgs as BattleMsg[]) {
        if (m.type === MSG_BATTLE) {
          battleSeen = true;
          // card = attacker (P1's Honest, destroyed), target = defender (P0's FILLER, survives)
          attackerDestroyed = m.card?.destroyed ?? false;
        }
      }

      for (const m of msgs as SelectChainMsg[]) {
        if (m.type === MSG_SELECT_CHAIN && inDamageStep && battleSeen) {
          if ((m.selects ?? []).some((s) => s.code === FORBIDDEN_CHALICE)) {
            chaliceAfterBattle = true;
          }
        }
      }

      if (turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      battleSeen,
      `Expected BATTLE message (damage calc at S4). attackSeen=${String(attackSeen)}`,
    ).toBe(true);

    // P1's Honest (attacker, 1100 ATK) attacks P0's FILLER (1200 ATK) → Honest destroyed.
    // BATTLE.card = attacker = P1's Honest (destroyed).
    expect(
      attackerDestroyed,
      "Expected BATTLE.card.destroyed=true (P1's Honest, attacker, destroyed by P0's higher ATK).",
    ).toBe(true);

    expect(
      chaliceAfterBattle,
      `Forbidden Chalice must NOT appear in DS chain windows after damage calc. ` +
        "attackSeen=" +
        String(attackSeen),
    ).toBe(false);
  }, 20_000);

  // ── S5: Gorz at S5 — DEFECT (EVENT_DAMAGE does not produce chain offer in DS) ──
  it.fails(
    "R08-S5 — Gorz [44330098] offered at S5 when battle damage inflicted (DEFECT: not offered in DS)",
    async () => {
      // Expected (Edison): Gorz activates at S5 "when battle damage is inflicted."
      // DEFECT: In this engine configuration, Gorz's EVENT_DAMAGE trigger does NOT
      //   produce a SELECT_CHAIN offer during the Damage Step chain windows.
      //   Root cause: likely EVENT_DAMAGE vs EVENT_BATTLE_DAMAGE timing in
      //   DUEL_6_STEP_BATLLE_STEP mode, or GOAT-mode single-chain restriction.
      //
      // Setup: P0: LOW_ATK_FILLER (1200 ATK).  P1: OJAMA_GREEN (0 ATK) + Gorz in HAND.
      // Turn 2: P1's Ojama (0 ATK) attacks P0's FILLER (1200 ATK).
      //   Ojama destroyed (0 < 1200), P1 takes 1200 battle damage → Gorz condition met.
      // Assert (expected): Gorz offered to P1 in DS S5 chain window.
      // Engine: Gorz NOT offered → assertion fails → it.fails() marks DEFECT.

      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: LOW_ATK_FILLER,
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
          {
            code: GORZ,
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
      const battleState = makeAttackState();
      let inDamageStep = false;
      let gorzOfferedToP1 = false;
      let attackSeen = false;
      let turn = 0;

      driveDuel(lib, handle, (_all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
          if (m.type === MSG_ATTACK) attackSeen = true;
          if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
          if (m.type === MSG_DAMAGE_STEP_END) {
            inDamageStep = false;
            if (attackSeen) return { stop: true };
          }
        }

        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && inDamageStep && m.player === 1) {
            if ((m.selects ?? []).some((s) => s.code === GORZ)) {
              gorzOfferedToP1 = true;
              return { stop: true };
            }
          }
        }

        if (gorzOfferedToP1 || turn > 5) return { stop: true };
        if (status !== 1) return {};
        const attackResp = advanceAttack(msgs, status, battleState);
        if (attackResp) return { response: attackResp };
        return { response: defaultRespond(msgs as never) };
      });

      // Expected: Gorz IS offered in DS chain window at S5.
      // Engine: NOT offered → assertion fails → it.fails() catches as DEFECT.
      expect(
        gorzOfferedToP1,
        `Expected Gorz [${GORZ}] in P1's DS SELECT_CHAIN at S5. ` +
          `attackSeen=${String(attackSeen)}. ` +
          "DEFECT: EVENT_DAMAGE trigger not producing chain offer in DS chain windows.",
      ).toBe(true);
    },
    25_000,
  );

  // ── S6: Ryko Flip effect fires at S6 (CHAINING after BATTLE) ─────────────
  it("R08-S6 — Ryko [21502796] Flip effect fires at S6 via CHAINING (after damage calc)", async () => {
    // S6 = Resolve Effects.  Flip effects activate here (via CHAINING msg 70).
    // Ryko's battle-flip fires as CHAINING, NOT FLIPSUMMONING (64).
    // S4 (BATTLE) marks Ryko as destroyed.  S6: Flip fires.
    //
    // P0: LOW_ATK_FILLER (1200 ATK).  P1: Ryko face-down (200 ATK / 100 DEF).
    // Turn 3: P0 attacks → Ryko destroyed at S4. Flip fires at S6 (CHAINING).
    // Assert: CHAINING with Ryko code appears AFTER BATTLE message.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: LOW_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: RYKO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let attackSeen = false;
    let battleSeen = false;
    let rykoChainAfterBattle = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_BATTLE && attackSeen) battleSeen = true;
      }

      for (const m of msgs as ChainingMsg[]) {
        if (m.type === MSG_CHAINING && battleSeen && m.code === RYKO) {
          rykoChainAfterBattle = true;
        }
      }

      if (rykoChainAfterBattle || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(battleSeen, `Expected BATTLE message in DS. attackSeen=${String(attackSeen)}`).toBe(
      true,
    );

    expect(
      rykoChainAfterBattle,
      `Expected CHAINING (70) with Ryko [${RYKO}] code AFTER BATTLE ` +
        "(Flip effect fires at S6 via CHAINING, not FLIPSUMMONING).",
    ).toBe(true);
  }, 25_000);

  // ── S7: Mystic Tomato moved to GY at S7 ───────────────────────────────────
  it("R08-S7 — Mystic Tomato [83011277] MOVE to GRAVE inside DS (S7: destroyed-by-battle to GY)", async () => {
    // S7 = End of Damage Step.  Destroyed-by-battle monsters are sent to GY.
    // Mystic Tomato (1400 ATK) is destroyed at S4 (battle) and sent to GY at S7.
    //
    // P0: HIGH_ATK_FILLER (1700 ATK, FILLER[15]) — high enough to beat Tomato.
    // P1: Mystic Tomato (1400 ATK) in ATK position.
    // Turn 2: P1 (Tomato 1400) attacks P0 (HIGH_ATK 1700). Tomato < 1700 → Tomato DESTROYED.
    //   MOVE Tomato → GRAVE appears inside DS (between DS_START and DS_END).
    //
    // Note on SS trigger: Mystic Tomato's "when destroyed by battle" optional trigger
    //   (EVENT_BATTLE_DESTROYED + condition IsLocation(GRAVE)) was NOT observed in DS
    //   chain windows in empirical testing — timing gap suspected.  The primary S7
    //   assertion (MOVE to GY within DS) is verified here; trigger is not asserted.
    //
    // Assert: MYSTIC_TOMATO MOVE to GRAVE appears while inDamageStep=true.

    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: HIGH_ATK_FILLER,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      extraCards1: [
        {
          code: MYSTIC_TOMATO,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
      ],
      deck0: FILLER.slice(0, 16),
      deck1: [MYSTIC_TOMATO, ...FILLER.slice(0, 15)],
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;
    const battleState = makeAttackState();
    let inDamageStep = false;
    let tomatoToGraveInDS = false;
    let attackSeen = false;
    let turn = 0;

    driveDuel(lib, handle, (_all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
        if (m.type === MSG_ATTACK) attackSeen = true;
        if (m.type === MSG_DAMAGE_STEP_START) inDamageStep = true;
        if (m.type === MSG_DAMAGE_STEP_END) {
          inDamageStep = false;
          if (attackSeen) return { stop: true };
        }
      }

      for (const m of msgs as MoveMsg[]) {
        if (
          m.type === MSG_MOVE &&
          m.card === MYSTIC_TOMATO &&
          m.to.location === OcgLocation.GRAVE &&
          inDamageStep
        ) {
          tomatoToGraveInDS = true;
        }
      }

      if (tomatoToGraveInDS || turn > 5) return { stop: true };
      if (status !== 1) return {};
      const attackResp = advanceAttack(msgs, status, battleState);
      if (attackResp) return { response: attackResp };
      return { response: defaultRespond(msgs as never) };
    });

    expect(attackSeen, "Expected ATTACK message (P1's Tomato attacked P0's HIGH_ATK_FILLER).").toBe(
      true,
    );

    expect(
      tomatoToGraveInDS,
      `Expected Mystic Tomato [${MYSTIC_TOMATO}] MOVE to GRAVE inside DS ` +
        "(S7: destroyed-by-battle monsters sent to GY at End of DS). " +
        `attackSeen=${String(attackSeen)}`,
    ).toBe(true);
  }, 25_000);
});
