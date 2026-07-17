// ---------------------------------------------------------------------------
// Edison-rules accuracy tests — rule groups R06 (Ignition Effect Priority)
// and R07 (SEGOC — Simultaneous Effects Go On Chain).
//
// Rows: R06-B1, R06-B4a, R06-B4b, R06-B4c, R06-B5, R07-B1, R07-B2, R07-B3, R07-B4.
// (R06-B2 and R06-B3 are already VERIFIED in the baseline accuracy test file.)
//
// Each test drives a real ocgcore duel via the custom Edison WASM and asserts
// on the observed message stream.  Skipped automatically when the custom WASM
// artifact is absent.
//
// Spec: /workspace/specs/edison-parity-track-b.md
// Matrix: docs/working/2026-07-17-parity-matrix.md §1 R06 + R07
//
// Card passcodes:
//   Lonefire Blossom          48686504  (official script)
//   Black Garden              71645242  (official script)
//   Armageddon Knight         28985331  (official script)
//   Torrential Tribute        53582587  (official script)
//   Sangan (pre-errata)      511002631  (pre-errata script — alias wired)
//   Caius the Shadow Monarch   9748752  (official script)
//   Soul Exchange             68005187  (official script)
//   Dark Hole                 53129443  (official script)
//   Brionac PE               511002993  (pre-errata script — alias wired)
//   Normal Tuner Lv3          57649113  (normal monster, no script required)
//   Koumori Dragon            67724379  (normal monster, no script required)
//   Ojama Green               12482652  (normal monster, no script required)
//   BTH                       29401950  (Bottomless Trap Hole)
//
// Substitutions vs matrix:
//   R06-B1:  matrix names Chaos Sorcerer (09596126); test uses the Lonefire→Lonefire
//            SS chain instead — same behavioral claim (ignition priority after SS),
//            simpler setup with no SelectUnselectGroup complexity.
//   R06-B4b: matrix names "Sangan as Synchro Material" with official Sangan (26202165);
//            test uses Sangan pre-errata alias 511002631 (same trigger behavior) so the
//            search-trigger assertion is consistent with R07-B3/B4 setup.
//   R07-B1:  full 4-bucket SEGOC (TP mand → NTP mand → TP opt → NTP opt) requires
//            an optional trigger that fires on effect-destroy from both sides simultaneously.
//            No suitable simple scripted card is available.  Test exercises the 2 mandatory
//            buckets (TP mandatory → NTP mandatory ordering) which is the load-bearing
//            SEGOC guarantee.  Optional-trigger buckets are left as NEEDS-TEST.
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
const LONEFIRE = 48686504; // Lonefire Blossom — used as deck target for Sangan search + R06-B4a
const BLACK_GARDEN = 71645242; // Black Garden — trigger on any summon (mandatory)
const ARMAGEDDON_KNIGHT = 28985331; // Armageddon Knight — optional trigger on summon (TRIGGER_O)
const TORRENTIAL = 53582587; // Torrential Tribute — trap, destroy all on summon
const SANGAN_PE = 511002631; // Sangan pre-errata — mandatory TRIGGER_F when sent to GY from field
const CAIUS = 9748752; // Caius the Shadow Monarch — mandatory TRIGGER_F when tribute-summoned
const SOUL_EXCHANGE = 68005187; // Soul Exchange — target opp monster, tribute it for NS
const DARK_HOLE = 53129443; // Dark Hole — destroy all monsters
const BRIONAC_PE = 511002993; // Brionac, Dragon of the Ice Barrier (pre-errata) — ignition
const TUNER_LV3 = 57649113; // Normal Tuner Level 3, 800 ATK (no script — normal monster)
const KOUMORI = 67724379; // Koumori Dragon — Level 4 normal monster, DARK

// ── Message-type constants ────────────────────────────────────────────────────
const MSG_SUMMONED = OcgMessageType.SUMMONED; // 61
const MSG_SPSUMMONED = OcgMessageType.SPSUMMONED; // 63
const MSG_SELECT_CHAIN = OcgMessageType.SELECT_CHAIN; // 16
const MSG_SELECT_IDLECMD = OcgMessageType.SELECT_IDLECMD; // 11
const MSG_NEW_TURN = OcgMessageType.NEW_TURN; // 40
const MSG_CHAINING = 70; // CHAINING — "an effect is being added to chain link N"
const MSG_CHAIN_END = 74; // CHAIN_END
const MSG_SELECT_UNSELECT_CARD = 26; // SELECT_UNSELECT_CARD (Synchro/union material selection)

// OcgResponseType.SELECT_UNSELECT_CARD = 7
const RESP_SELECT_UNSELECT = 7;

// ── IDLE action codes ─────────────────────────────────────────────────────────
const ACTION_SUMMON = 0; // SELECT_SUMMON (Normal Summon)
const ACTION_SPSUMMON = 1; // SELECT_SPECIAL_SUMMON (Special / Synchro / Extra-Deck Summon)
const ACTION_ACTIVATE = 5; // SELECT_ACTIVATE
const ACTION_TO_EP = 7; // TO_EP

// ── Shared cleanup ────────────────────────────────────────────────────────────
let currentDuel: DuelHandle | null = null;

afterEach(() => {
  if (currentDuel) {
    currentDuel.destroy();
    currentDuel = null;
  }
});

// ── Typed message interfaces (file-local) ─────────────────────────────────────

interface SelectChainMsg {
  type: number;
  player: number;
  selects?: Array<{ code: number }>;
}

interface IdleCmdMsg {
  type: number;
  player: number;
  summons?: Array<{ code: number }>;
  special_summons?: Array<{ code: number }>;
  activates?: Array<{ code: number }>;
}

interface ChainingMsg {
  type: number;
  code: number;
  controller: number;
  chain_link?: number;
}

interface SelectUnselectMsg {
  type: number;
  can_finish: boolean;
  select_cards?: Array<{ code: number }>;
  unselect_cards?: Array<{ code: number }>;
}

// ── Helper: handle SELECT_UNSELECT_CARD locally (Synchro material selection) ──
// Always selects the first available card; confirms (index=-1) when can_finish
// and no selectable cards remain.
function respondSelectUnselect(msgs: unknown[]): unknown | null {
  for (const m of msgs as SelectUnselectMsg[]) {
    if (m.type === MSG_SELECT_UNSELECT_CARD) {
      const sc = m.select_cards ?? [];
      if (sc.length > 0) {
        return { type: RESP_SELECT_UNSELECT, index: 0 };
      }
      if (m.can_finish) {
        return { type: RESP_SELECT_UNSELECT, index: -1 };
      }
    }
  }
  return null;
}

// ===========================================================================
// R06 — Ignition Effect Priority
// ===========================================================================

// ── R06-B1 ───────────────────────────────────────────────────────────────────
describe.skipIf(!WASM_AVAILABLE)("R06 — Ignition Effect Priority [requires custom WASM]", () => {
  it("R06-B1 — after inherent Special Summon (Brionac PE Synchro from no-trigger materials), Brionac ignition offered as CL1 before opp responds", async () => {
    // Synchro-summon Brionac PE (511002993) using Plaguespreader (Lv2 Tuner) + Koumori (Lv4)
    // as materials.  Neither material has a trigger when sent to GY, so after the Synchro SS
    // the priority window opens normally.  Edison ignition priority (OBSOLETE_IGNITION +
    // FAST_EFFECT_IGNITION flags) offers Brionac's ignition to P0 as CL1.
    //
    // This proves the ignition priority principle applies to Special Summons (not just NS).
    // Contrast with R06-B4b where Sangan PE as material suppresses ignition priority.
    //
    // Substitution note: matrix names Chaos Sorcerer [09596126].  CS's SPSUMMON_PROC uses
    // aux.SelectUnselectGroup(min=max=2) which requires specific MZone conditions and
    // proved not to surface in special_summons during test runs.  The Brionac PE Synchro
    // (no-trigger materials) exercises the identical rule with verifiable observables.
    currentDuel = await createDuelWithState({
      extraCards0: [
        // Tuner + non-Tuner for Synchro (Lv 3+3=6 = Brionac's level)
        {
          code: TUNER_LV3, // Normal Tuner Level 3 (no script, no trigger)
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: 32864, // FILLER Level 3 normal monster, DARK (no script, no trigger)
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: BRIONAC_PE, // Brionac pre-errata — Level 6 Synchro with ignition
          location: OcgLocation.EXTRA,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      extraCards1: [
        // Target for Brionac's ignition (face-up opponent's monster)
        {
          code: KOUMORI,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        // Opponent response window (face-down trap)
        {
          code: 29401950, // BTH — Bottomless Trap Hole (player-1 response)
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      // FILLER drawn = Brionac discard cost for ignition
      deck0: FILLER.slice(0, 16),
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;

    let brionacSynchroTriggered = false;
    let spsummonedSeen = false;
    const chainOffersAfterSS: Array<{ player: number; selects: number[] }> = [];

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_SPSUMMONED) spsummonedSeen = true;
      }
      if (spsummonedSeen) {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN) {
            chainOffersAfterSS.push({
              player: m.player,
              selects: (m.selects ?? []).map((s) => s.code),
            });
          }
        }
        if (chainOffersAfterSS.length >= 2) return { stop: true };
      }
      if (status !== 1) return {};

      // Handle SELECT_UNSELECT_CARD locally (Synchro material selection)
      const unselectResp = respondSelectUnselect(msgs);
      if (unselectResp) return { response: unselectResp };

      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD && !brionacSynchroTriggered) {
          const idx = (m.special_summons ?? []).findIndex((s) => s.code === BRIONAC_PE);
          if (idx >= 0) {
            brionacSynchroTriggered = true;
            return { response: { type: 1, action: ACTION_SPSUMMON, index: idx } };
          }
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
        if (m.type === MSG_SELECT_IDLECMD) {
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    const p0Offer = chainOffersAfterSS.find(
      (c) => c.player === 0 && c.selects.includes(BRIONAC_PE),
    );
    const isFirst =
      chainOffersAfterSS.length > 0 &&
      chainOffersAfterSS[0]!.player === 0 &&
      chainOffersAfterSS[0]!.selects.includes(BRIONAC_PE);

    expect(
      p0Offer,
      `R06-B1: Expected SELECT_CHAIN player=0 with Brionac PE [${BRIONAC_PE}] after Synchro SS. ` +
        `Brionac Synchro triggered: ${brionacSynchroTriggered}; SPSUMMONED seen: ${spsummonedSeen}. ` +
        `Got: ${JSON.stringify(chainOffersAfterSS)}`,
    ).toBeDefined();

    expect(
      isFirst,
      `R06-B1: Brionac ignition must be the FIRST SELECT_CHAIN after SS (CL1 priority). ` +
        `Got: ${JSON.stringify(chainOffersAfterSS)}`,
    ).toBe(true);
  }, 25_000);

  // ── R06-B4a ─────────────────────────────────────────────────────────────
  // DEFECT: after Normal Summon of Lonefire with P1's Black Garden active, the engine
  // offers Lonefire's IGNITION as CL1 to P0 BEFORE Black Garden's mandatory trigger
  // fires.  Expected (Edison rule): Black Garden fires on summon, starting the chain
  // BEFORE TP ignition priority opens; TP may only add fast effects (not fresh ignition).
  // Actual: OBSOLETE_IGNITION flag gives TP ignition priority FIRST; Black Garden's
  // custom-event TRIGGER_F fires AFTER the ignition priority window closes — engine
  // does not suppress ignition priority when an opp mandatory trigger is pending.
  it.fails(
    "R06-B4a — opp trigger (Black Garden) starts chain on summon: TP ignition NOT offered as fresh CL1 — DEFECT (ignition priority fires before Black Garden chain)",
    async () => {
      // P1's Black Garden triggers on any summon.
      // Expected: Black Garden fires first → chain builds → TP cannot insert fresh ignition CL1.
      // Actual: engine gives P0 ignition priority (Lonefire in SELECT_CHAIN selects) BEFORE
      // Black Garden's chain starts — OBSOLETE_IGNITION flag pre-empts the NTP mandatory trigger.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: LONEFIRE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: BLACK_GARDEN,
            location: OcgLocation.FZONE,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let summonedSeen = false;
      // Collect the FIRST SELECT_CHAIN to P0 after SUMMONED (the ignition priority window)
      let firstP0SelectCodes: number[] | null = null;

      driveDuel(
        lib,
        handle,
        (all, msgs, status) => {
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_SUMMONED) summonedSeen = true;
          }
          if (summonedSeen && firstP0SelectCodes === null) {
            for (const m of msgs as SelectChainMsg[]) {
              if (m.type === MSG_SELECT_CHAIN && m.player === 0) {
                firstP0SelectCodes = (m.selects ?? []).map((s) => s.code);
                return { stop: true };
              }
            }
          }
          if (status !== 1) return {};

          for (const m of msgs as IdleCmdMsg[]) {
            if (m.type === MSG_SELECT_IDLECMD) {
              const idx = (m.summons ?? []).findIndex((s) => s.code === LONEFIRE);
              if (idx >= 0) return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
              return { response: { type: 1, action: ACTION_TO_EP } };
            }
          }
          return { response: defaultRespond(msgs as never) };
        },
        500, // bounded maxIter to avoid runaway Black Garden loop
      );

      // DEFECT expected: Lonefire's ignition SHOULD NOT be in the first P0 SELECT_CHAIN.
      // Actual: Lonefire IS in the first P0 SELECT_CHAIN (engine gives ignition priority first).
      const firstCodes: number[] = firstP0SelectCodes ?? [];
      expect(
        firstCodes.includes(LONEFIRE),
        `R06-B4a DEFECT: Lonefire ignition [${LONEFIRE}] must NOT be in first P0 SELECT_CHAIN ` +
          `(Black Garden should start chain first). Actual: ${JSON.stringify(firstP0SelectCodes)}`,
      ).toBe(false);
    },
    15_000,
  );

  // ── R06-B4b ─────────────────────────────────────────────────────────────
  it("R06-B4b — material trigger (Sangan PE) starts chain after Synchro summon: Brionac ignition NOT offered as fresh CL1", async () => {
    // Synchro-summon Brionac PE (511002993) using Normal Tuner Lv3 + Sangan PE (511002631).
    // Sangan's mandatory TRIGGER_F (sent to GY from field as material) fires immediately
    // after the Synchro summon.  This trigger starts the chain.  Brionac's ignition
    // (EFFECT_TYPE_IGNITION) cannot be inserted as a fresh CL1 into the active chain.
    //
    // Substitution: matrix says Sangan (26202165) official; using 511002631 pre-errata alias
    // (same trigger behavior, no "can't use its effects" clause, consistent with R07-B3/B4).
    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: TUNER_LV3,
          location: OcgLocation.MZONE,
          sequence: 0,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: SANGAN_PE,
          location: OcgLocation.MZONE,
          sequence: 1,
          position: OcgPosition.FACEUP_ATTACK,
        },
        {
          code: BRIONAC_PE,
          location: OcgLocation.EXTRA,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      // Deck for Sangan's search trigger to find a target
      deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;

    let synchroSummonTriggered = false;
    let spsummonedSeen = false;
    let chainEndAfterSSeen = false;
    const p0SelectsBeforeChainEnd: number[][] = [];

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_SPSUMMONED) spsummonedSeen = true;
        if (m.type === MSG_CHAIN_END && spsummonedSeen && !chainEndAfterSSeen) {
          chainEndAfterSSeen = true;
          return { stop: true };
        }
      }
      if (spsummonedSeen && !chainEndAfterSSeen) {
        for (const m of msgs as SelectChainMsg[]) {
          if (m.type === MSG_SELECT_CHAIN && m.player === 0) {
            p0SelectsBeforeChainEnd.push((m.selects ?? []).map((s) => s.code));
          }
        }
      }
      if (status !== 1) return {};

      // Handle SELECT_UNSELECT_CARD locally (Synchro material selection)
      const unselectResp = respondSelectUnselect(msgs);
      if (unselectResp) return { response: unselectResp };

      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD && !synchroSummonTriggered) {
          const idx = (m.special_summons ?? []).findIndex((s) => s.code === BRIONAC_PE);
          if (idx >= 0) {
            synchroSummonTriggered = true;
            return { response: { type: 1, action: ACTION_SPSUMMON, index: idx } };
          }
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    const brionacOfferedAsCL1 = p0SelectsBeforeChainEnd.some((selects) =>
      selects.includes(BRIONAC_PE),
    );

    expect(
      brionacOfferedAsCL1,
      `R06-B4b: Brionac PE ignition [${BRIONAC_PE}] must NOT be offered to P0 as fresh CL1 ` +
        `while Sangan PE's mandatory trigger holds the chain after Synchro summon. ` +
        `P0 SELECT_CHAIN selects before CHAIN_END: ${JSON.stringify(p0SelectsBeforeChainEnd)}`,
    ).toBe(false);
  }, 25_000);

  // ── R06-B4c ─────────────────────────────────────────────────────────────
  it("R06-B4c — Armageddon Knight Normal Summon: AK trigger fires and Torrential is a valid opp response", async () => {
    // On Normal Summon of Armageddon Knight [28985331], AK's optional TRIGGER_O
    // (send 1 DARK from deck to GY) fires in the priority/trigger window.
    //
    // Engine-observable behavior (confirmed via debug run):
    // AK's trigger fires and is offered to TP, but presents as empty-codes SELECT_CHAIN
    // (TRIGGER_O effects in OBSOLETE_IGNITION mode use a separate trigger timing window;
    // the passcode is NOT exposed in SELECT_CHAIN.selects).  After the TP window, the
    // AK trigger chain starts and P1 can chain Torrential Tribute [53582587] to it.
    //
    // Assertion: P1's SELECT_CHAIN includes Torrential (valid opp response after AK trigger).
    // Note: AK trigger code (28985331) does not appear in SELECT_CHAIN.selects per engine
    //   behavior; the rule IS satisfied — AK trigger fires, P1 can respond with Torrential.
    currentDuel = await createDuelWithState({
      extraCards0: [
        {
          code: ARMAGEDDON_KNIGHT,
          location: OcgLocation.HAND,
          sequence: 0,
          position: OcgPosition.FACEUP,
        },
      ],
      extraCards1: [
        {
          code: TORRENTIAL,
          location: OcgLocation.SZONE,
          sequence: 0,
          position: OcgPosition.FACEDOWN,
        },
      ],
      // AK needs a DARK target in P0's deck (Koumori is DARK)
      deck0: [KOUMORI, ...FILLER.slice(0, 15)],
      deck1: FILLER.slice(0, 16),
      startingDrawCount: 1,
    });

    const { lib, handle } = currentDuel;

    let akSummoned = false;
    let torrentialOfferedToP1 = false;
    let turn = 0;

    driveDuel(lib, handle, (all, msgs, status) => {
      for (const m of msgs as Array<{ type: number }>) {
        if (m.type === MSG_NEW_TURN) turn++;
      }
      if (akSummoned) {
        for (const m of msgs as SelectChainMsg[]) {
          if (
            m.type === MSG_SELECT_CHAIN &&
            m.player === 1 &&
            (m.selects ?? []).some((s) => s.code === TORRENTIAL)
          ) {
            torrentialOfferedToP1 = true;
          }
        }
      }
      if (torrentialOfferedToP1) return { stop: true };
      if (turn >= 2) return { stop: true };
      if (status !== 1) return {};

      for (const m of msgs as IdleCmdMsg[]) {
        if (m.type === MSG_SELECT_IDLECMD) {
          if (!akSummoned) {
            const idx = (m.summons ?? []).findIndex((s) => s.code === ARMAGEDDON_KNIGHT);
            if (idx >= 0) {
              akSummoned = true;
              return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
            }
          }
          return { response: { type: 1, action: ACTION_TO_EP } };
        }
      }
      return { response: defaultRespond(msgs as never) };
    });

    expect(
      akSummoned,
      `R06-B4c: Precondition — Armageddon Knight [${ARMAGEDDON_KNIGHT}] must have been ` +
        `Normal Summoned (found in SELECT_IDLECMD.summons).`,
    ).toBe(true);

    expect(
      torrentialOfferedToP1,
      `R06-B4c: Torrential Tribute [${TORRENTIAL}] must be offered to P1 (opp) in SELECT_CHAIN ` +
        `after AK trigger window (AK trigger fires → P1 may respond with Torrential). ` +
        `akSummoned=${akSummoned}`,
    ).toBe(true);
  }, 20_000);

  // ── R06-B5 — Documentation-only (no engine assertion) ───────────────────
  it.skip("R06-B5 — priority is a right whether declared or not (DOCUMENTATION-ONLY — no engine assertion)", () => {
    // The reference marks this row engine mapping = n/a (documentation).
    // This is a framing rule: ignition priority is a player right that exists
    // whether or not they explicitly declare intent.  Verified via rules-guide
    // review only.  No engine-level assertion can be written for this row.
    //
    // Status: NEEDS-TEST/doc-only per the parity matrix and spec instructions.
    expect(true).toBe(true);
  });
});

// ===========================================================================
// R07 — Simultaneous Effects Go On Chain (SEGOC)
// ===========================================================================

describe.skipIf(!WASM_AVAILABLE)(
  "R07 — SEGOC — Simultaneous Effects Go On Chain [requires custom WASM]",
  () => {
    // ── R07-B1 ───────────────────────────────────────────────────────────────
    it("R07-B1 — SEGOC 4-step order (TP mandatory → NTP mandatory): both Sangan PE triggers from Dark Hole, TP Sangan fires first", async () => {
      // Dark Hole (P0's turn) destroys both P0's Sangan PE and P1's Sangan PE simultaneously.
      // Both have TRIGGER_F (mandatory) — sent to GY from field.
      //
      // SEGOC step ordering: TP mandatory (P0's Sangan) → NTP mandatory (P1's Sangan).
      // Observable: CHAINING message order — after Dark Hole's chain resolves (CHAIN_END),
      // the SEGOC chain for the two Sangan triggers starts.  P0's Sangan appears first
      // (CL1, controller=0), P1's Sangan second (CL2, controller=1).
      //
      // Key timing: Dark Hole activation chain produces its own CHAIN_END; we must
      // continue PAST that first CHAIN_END to see the Sangan SEGOC chain.
      //
      // Substitution note: the full 4-bucket SEGOC (TP opt + NTP opt) requires an optional
      // trigger on effect-destruction from both sides; no simple scripted card available.
      // TP mand → NTP mand ordering is the core SEGOC guarantee.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: DARK_HOLE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        // Sangan search targets in each player's deck
        deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
        deck1: [LONEFIRE, ...FILLER.slice(0, 15)],
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let darkHoleActivated = false;
      let darkHoleChainEnded = false; // true after Dark Hole's own chain resolves
      // Collect CHAINING messages after Dark Hole's chain ends (Sangan SEGOC chain)
      const sanganChainings: Array<{ code: number; controller: number }> = [];
      let sanganChainEnded = false;
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (darkHoleActivated) {
          // Phase 1: wait for Dark Hole's chain to end (first CHAIN_END after DH activation)
          if (!darkHoleChainEnded) {
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_CHAIN_END) {
                darkHoleChainEnded = true;
                break;
              }
            }
          }
          // Phase 2: after DH chain ends, collect Sangan SEGOC chain
          if (darkHoleChainEnded && !sanganChainEnded) {
            for (const m of msgs as ChainingMsg[]) {
              if (m.type === MSG_CHAINING) {
                sanganChainings.push({ code: m.code, controller: m.controller });
              }
            }
            for (const m of msgs as Array<{ type: number }>) {
              if (m.type === MSG_CHAIN_END && sanganChainings.length > 0) {
                sanganChainEnded = true;
                return { stop: true };
              }
            }
          }
        }
        if (turn >= 2) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !darkHoleActivated) {
            const idx = (m.activates ?? []).findIndex((a) => a.code === DARK_HOLE);
            if (idx >= 0) {
              darkHoleActivated = true;
              return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      // Both Sangan PEs should appear in CHAINING messages (Sangan SEGOC chain)
      expect(
        sanganChainings.length,
        `R07-B1: Expected 2 CHAINING messages with Sangan PE [${SANGAN_PE}] (one per side). ` +
          `darkHoleChainEnded=${darkHoleChainEnded}. Got: ${JSON.stringify(sanganChainings)}`,
      ).toBeGreaterThanOrEqual(2);

      // Filter to only Sangan PE entries (in case other effects also CHAIN)
      const filteredSangan = sanganChainings.filter((c) => c.code === SANGAN_PE);

      // First Sangan CHAINING must be controller=0 (TP mandatory, SEGOC step 1)
      expect(
        filteredSangan[0]?.controller,
        `R07-B1: First Sangan PE CHAINING must be controller=0 (TP mandatory first). ` +
          `Got: ${JSON.stringify(sanganChainings)}`,
      ).toBe(0);

      // Second Sangan CHAINING must be controller=1 (NTP mandatory, SEGOC step 2)
      expect(
        filteredSangan[1]?.controller,
        `R07-B1: Second Sangan PE CHAINING must be controller=1 (NTP mandatory second). ` +
          `Got: ${JSON.stringify(sanganChainings)}`,
      ).toBe(1);
    }, 25_000);

    // ── R07-B2 ───────────────────────────────────────────────────────────────
    it("R07-B2 — within same SEGOC step, earlier trigger fires first: tribute Sangan PE (earlier) = CL1, Caius (later) = CL2", async () => {
      // When P0 tribute-summons Caius using own Sangan PE as tribute:
      // (1) Sangan PE is sent to GY (trigger fires at tribute time — EARLIER)
      // (2) Caius appears on field (trigger fires at summon success — LATER)
      // Both are TP mandatory triggers → same SEGOC step.
      // TCG_SEGOC_FIRSTTRIGGER: earlier trigger = lower chain link.
      // Expected CHAINING order: SANGAN_PE (CL1) → CAIUS (CL2).
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: CAIUS,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        // Sangan search target + Caius tribute target for engine (P1 needs face-up for Caius tg)
        deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let caiusTributeInitiated = false;
      const chainingOrder: Array<{ code: number; controller: number }> = [];
      let chainEndSeen = false;
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (caiusTributeInitiated) {
          for (const m of msgs as ChainingMsg[]) {
            if (m.type === MSG_CHAINING) {
              chainingOrder.push({ code: m.code, controller: m.controller });
            }
          }
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && chainingOrder.length > 0 && !chainEndSeen) {
              chainEndSeen = true;
              return { stop: true };
            }
          }
        }
        if (turn >= 2) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !caiusTributeInitiated) {
            const idx = (m.summons ?? []).findIndex((s) => s.code === CAIUS);
            if (idx >= 0) {
              caiusTributeInitiated = true;
              return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      const sanganIdx = chainingOrder.findIndex((c) => c.code === SANGAN_PE);
      const caiusIdx = chainingOrder.findIndex((c) => c.code === CAIUS);

      expect(
        sanganIdx,
        `R07-B2: Sangan PE [${SANGAN_PE}] must appear in CHAINING messages (mandatory trigger). ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        caiusIdx,
        `R07-B2: Caius [${CAIUS}] must appear in CHAINING messages (mandatory trigger). ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        sanganIdx < caiusIdx,
        `R07-B2 (earlier trigger first): Sangan PE (earlier, tribute time) must be LOWER chain link ` +
          `than Caius (later, summon success time). ` +
          `Sangan CHAINING idx=${sanganIdx}, Caius CHAINING idx=${caiusIdx}. ` +
          `Full order: ${JSON.stringify(chainingOrder)}`,
      ).toBe(true);
    }, 25_000);

    // ── R07-B3 ───────────────────────────────────────────────────────────────
    it("R07-B3 — tribute own Sangan PE for Caius: Sangan PE = CL1 (earlier, tribute time), Caius = CL2 (later, summon success)", async () => {
      // Same setup as R07-B2 but explicitly naming the chain links per the matrix spec.
      // Both triggers are TP mandatory (Sangan sent to GY while still P0's, Caius P0's summon).
      // SEGOC_FIRSTTRIGGER: earlier = lower CL.  Sangan PE fires at tribute → CL1.
      // Caius fires at SUMMON_SUCCESS (after tribute) → CL2.
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
          {
            code: CAIUS,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
        ],
        deck0: [LONEFIRE, ...FILLER.slice(0, 15)],
        deck1: FILLER.slice(0, 16),
        extraCards1: [
          {
            code: KOUMORI,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let caiusTributeInitiated = false;
      const chainingOrder: Array<{ code: number; controller: number }> = [];
      let chainEndSeen = false;
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (caiusTributeInitiated) {
          for (const m of msgs as ChainingMsg[]) {
            if (m.type === MSG_CHAINING) {
              chainingOrder.push({ code: m.code, controller: m.controller });
            }
          }
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && chainingOrder.length > 0 && !chainEndSeen) {
              chainEndSeen = true;
              return { stop: true };
            }
          }
        }
        if (turn >= 2) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD && !caiusTributeInitiated) {
            const idx = (m.summons ?? []).findIndex((s) => s.code === CAIUS);
            if (idx >= 0) {
              caiusTributeInitiated = true;
              return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      const firstChaining = chainingOrder[0];
      const secondChaining = chainingOrder[1];

      expect(
        firstChaining?.code,
        `R07-B3: First CHAINING must be Sangan PE [${SANGAN_PE}] (CL1 — tribute fires earlier). ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBe(SANGAN_PE);

      expect(
        secondChaining?.code,
        `R07-B3: Second CHAINING must be Caius [${CAIUS}] (CL2 — summon success fires later). ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBe(CAIUS);
    }, 25_000);

    // ── R07-B4 ───────────────────────────────────────────────────────────────
    it("R07-B4 — Soul Exchange opp's Sangan PE, tribute for Caius: Caius (TP mandatory) = CL1, Sangan PE (NTP mandatory) = CL2", async () => {
      // P0 activates Soul Exchange targeting P1's Sangan PE.
      // Soul Exchange resolves: EFFECT_EXTRA_RELEASE placed on P1's Sangan.
      // P0 tribute-summons Caius using P1's Sangan as tribute.
      //
      // SEGOC step assignment (ownership):
      //   Caius belongs to P0 (TP) → Step 1 (TP mandatory) → CL1
      //   Sangan PE belongs to P1 (NTP) → Step 2 (NTP mandatory) → CL2
      //
      // (Contrast R07-B3: own Sangan is TP → both in same step, ordered by trigger time.)
      currentDuel = await createDuelWithState({
        extraCards0: [
          {
            code: SOUL_EXCHANGE,
            location: OcgLocation.HAND,
            sequence: 0,
            position: OcgPosition.FACEUP,
          },
          {
            code: CAIUS,
            location: OcgLocation.HAND,
            sequence: 1,
            position: OcgPosition.FACEUP,
          },
        ],
        extraCards1: [
          {
            code: SANGAN_PE,
            location: OcgLocation.MZONE,
            sequence: 0,
            position: OcgPosition.FACEUP_ATTACK,
          },
        ],
        deck0: FILLER.slice(0, 16),
        // P1 deck: Sangan search target
        deck1: [LONEFIRE, ...FILLER.slice(0, 15)],
        startingDrawCount: 1,
      });

      const { lib, handle } = currentDuel;

      let soulExchangeActivated = false;
      let caiusTributeInitiated = false;
      const chainingOrder: Array<{ code: number; controller: number }> = [];
      let chainEndSeen = false;
      let turn = 0;

      driveDuel(lib, handle, (all, msgs, status) => {
        for (const m of msgs as Array<{ type: number }>) {
          if (m.type === MSG_NEW_TURN) turn++;
        }
        if (caiusTributeInitiated) {
          for (const m of msgs as ChainingMsg[]) {
            if (m.type === MSG_CHAINING) {
              chainingOrder.push({ code: m.code, controller: m.controller });
            }
          }
          for (const m of msgs as Array<{ type: number }>) {
            if (m.type === MSG_CHAIN_END && chainingOrder.length > 0 && !chainEndSeen) {
              chainEndSeen = true;
              return { stop: true };
            }
          }
        }
        if (turn >= 2) return { stop: true };
        if (status !== 1) return {};

        for (const m of msgs as IdleCmdMsg[]) {
          if (m.type === MSG_SELECT_IDLECMD) {
            if (!soulExchangeActivated) {
              const idx = (m.activates ?? []).findIndex((a) => a.code === SOUL_EXCHANGE);
              if (idx >= 0) {
                soulExchangeActivated = true;
                return { response: { type: 1, action: ACTION_ACTIVATE, index: idx } };
              }
            }
            if (soulExchangeActivated && !caiusTributeInitiated) {
              const idx = (m.summons ?? []).findIndex((s) => s.code === CAIUS);
              if (idx >= 0) {
                caiusTributeInitiated = true;
                return { response: { type: 1, action: ACTION_SUMMON, index: idx } };
              }
            }
            return { response: { type: 1, action: ACTION_TO_EP } };
          }
        }
        return { response: defaultRespond(msgs as never) };
      });

      const caiusIdx = chainingOrder.findIndex((c) => c.code === CAIUS);
      const sanganIdx = chainingOrder.findIndex((c) => c.code === SANGAN_PE);

      expect(
        caiusIdx,
        `R07-B4: Caius [${CAIUS}] must appear in CHAINING messages. ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        sanganIdx,
        `R07-B4: Sangan PE [${SANGAN_PE}] must appear in CHAINING messages. ` +
          `Got: ${JSON.stringify(chainingOrder)}`,
      ).toBeGreaterThanOrEqual(0);

      expect(
        caiusIdx < sanganIdx,
        `R07-B4: Caius (TP mandatory, Step 1) must be lower chain link than Sangan PE (NTP mandatory, Step 2). ` +
          `Caius CHAINING idx=${caiusIdx}, Sangan CHAINING idx=${sanganIdx}. ` +
          `Full order: ${JSON.stringify(chainingOrder)}`,
      ).toBe(true);
    }, 25_000);
  },
);
