// ---------------------------------------------------------------------------
// SELECT_PLACE seat mapping — the two ocgcore conventions, pinned against the
// live engine.
//
// These two conventions DISAGREE with each other, which is what made the
// original defect possible:
//
//   field_mask (engine → us)   RELATIVE — low 16 bits are the MESSAGING
//                              PLAYER'S own field, high 16 bits the opponent's.
//   response.player (us → engine)  ABSOLUTE — the real seat number.
//
// Neither is documented in ocgcore-wasm's types, so both are asserted here
// against a real duel rather than restated as a comment somewhere.
//
// The bug this guards: decodeFieldMask used to map the low bit-group to
// controller 0 unconditionally. For a seat-1 player that named the OPPONENT'S
// zones; the response was rejected with RETRY, the pending decision was torn
// down, and the player got "No pending decision to respond to" and could not
// act for the rest of the duel. Going first masked it entirely, because at
// seat 0 relative and absolute coincide.
//
// Skipped automatically when the custom WASM artifact is absent.
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { OcgLocation, OcgPosition, OcgResponseType } from "ocgcore-wasm";
import { isCustomWasmAvailable } from "./coreFactory.js";
import { createDuelWithState, driveDuel, FILLER } from "./testSupport/createDuelWithState.js";
import { messageToDecision } from "./decision/messageToDecision.js";

const WASM_AVAILABLE = isCustomWasmAvailable();

const VANILLA = FILLER[0]!; // level-4 normal monster — no tribute required
const BLOCKER = FILLER[1]!;

// ocgcore message / response type numbers used below.
const MSG_RETRY = 1;
const MSG_SELECT_IDLECMD = 11;
const MSG_SELECT_PLACE = 18;
const MSG_SELECT_POSITION = 19;
const MSG_SUMMONING = 60;
const MSG_SUMMONED = 61;

const IDLE_SUMMON = 0;
const IDLE_TO_EP = 7;

interface Msg {
  type: number;
  player?: number;
  field_mask?: number;
  code?: number;
  controller?: number;
  location?: number;
  sequence?: number;
  [k: string]: unknown;
}

/**
 * Drive a duel to a SELECT_PLACE addressed to seat 1, with seat 1 holding two
 * occupied monster zones (0 and 1) and seat 0's field empty. Optionally answer
 * that SELECT_PLACE with `respondWithPlayer` and run the summon to completion.
 */
async function driveToSeat1Place(respondWithPlayer: number | null) {
  const duel = await createDuelWithState({
    extraCards0: [],
    extraCards1: [
      {
        code: BLOCKER,
        location: OcgLocation.MZONE,
        sequence: 0,
        position: OcgPosition.FACEUP_ATTACK,
      },
      {
        code: BLOCKER,
        location: OcgLocation.MZONE,
        sequence: 1,
        position: OcgPosition.FACEUP_ATTACK,
      },
      { code: VANILLA, location: OcgLocation.HAND, sequence: 0, position: OcgPosition.FACEUP },
    ],
  });

  let placeMsg: Msg | null = null;
  let answered = false;
  const seen: Msg[] = [];

  driveDuel(duel.lib, duel.handle, (_all, latest, status) => {
    const msgs = latest as Msg[];
    seen.push(...msgs);

    for (const m of msgs) {
      if (m.type === MSG_SELECT_PLACE && m.player === 1 && placeMsg === null) {
        placeMsg = m;
        if (respondWithPlayer === null) return { stop: true };
      }
    }

    if (answered && msgs.some((m) => m.type === MSG_SUMMONED)) return { stop: true };
    if (status !== 1) return {};

    for (const m of msgs) {
      if (
        m.type === MSG_SELECT_PLACE &&
        m.player === 1 &&
        respondWithPlayer !== null &&
        !answered
      ) {
        answered = true;
        return {
          response: {
            type: OcgResponseType.SELECT_PLACE,
            places: [{ player: respondWithPlayer, location: OcgLocation.MZONE, sequence: 2 }],
          },
        };
      }
      if (m.type === MSG_SELECT_IDLECMD) {
        if (m.player === 0) return { response: { type: 1, action: IDLE_TO_EP } };
        if (m.player === 1) return { response: { type: 1, action: IDLE_SUMMON, index: 0 } };
      }
      if (m.type === MSG_SELECT_POSITION) {
        return {
          response: { type: OcgResponseType.SELECT_POSITION, position: OcgPosition.FACEUP_ATTACK },
        };
      }
    }
    return {};
  });

  duel.destroy();
  return { placeMsg: placeMsg as Msg | null, seen };
}

describe.skipIf(!WASM_AVAILABLE)(
  "SELECT_PLACE — field_mask is relative to the messaging player",
  () => {
    it("low 16 bits describe the MESSAGING PLAYER's field, not player 0's", async () => {
      const { placeMsg } = await driveToSeat1Place(null);
      expect(placeMsg, "never reached a SELECT_PLACE addressed to seat 1").not.toBeNull();

      const mask = placeMsg!.field_mask ?? 0;
      const low = mask & 0xffff;
      const high = (mask >> 16) & 0xffff;

      const blocked = (m: number) => [0, 1, 2, 3, 4].filter((s) => m & (1 << s));

      // Seat 1 (the messaging player) owns the two occupied zones; seat 0 is empty.
      expect(blocked(low)).toEqual([0, 1]);
      // The opponent's half is entirely unavailable for a normal summon.
      expect(blocked(high)).toEqual([0, 1, 2, 3, 4]);
    }, 60_000);

    it("messageToDecision resolves those zones to the ABSOLUTE controller (seat 1)", async () => {
      const { placeMsg } = await driveToSeat1Place(null);
      expect(placeMsg).not.toBeNull();

      const decision = messageToDecision([placeMsg as never], 1);
      expect(decision.kind).toBe("SelectZone");
      if (decision.kind !== "SelectZone") throw new Error("unreachable");

      // Every offered zone must belong to seat 1 — never the opponent.
      expect(decision.zones.length).toBeGreaterThan(0);
      for (const z of decision.zones) {
        expect(z.controller).toBe(1);
      }
      // Specifically: MZONE 2, 3, 4 are free; 0 and 1 are occupied.
      const mzones = decision.zones
        .filter((z) => z.location === "MZONE")
        .map((z) => z.sequence)
        .sort();
      expect(mzones).toEqual([2, 3, 4]);
    }, 60_000);
  },
);

describe.skipIf(!WASM_AVAILABLE)("SELECT_PLACE — response.player is the absolute seat", () => {
  it("player=1 (absolute) is accepted and the monster lands on seat 1's field", async () => {
    const { seen } = await driveToSeat1Place(1);
    const summoning = seen.find((m) => m.type === MSG_SUMMONING);
    expect(summoning, "summon did not resolve — response was rejected").toBeDefined();
    expect(summoning!.controller).toBe(1);
    expect(summoning!.sequence).toBe(2);
    expect(seen.some((m) => m.type === MSG_RETRY)).toBe(false);
  }, 60_000);

  it("player=0 (the pre-fix value for a seat-1 player) is REJECTED with RETRY", async () => {
    const { seen } = await driveToSeat1Place(0);
    // This is the production failure: the engine refuses the placement, so no
    // summon ever happens and the pending decision is destroyed.
    expect(seen.some((m) => m.type === MSG_RETRY)).toBe(true);
    expect(seen.some((m) => m.type === MSG_SUMMONING)).toBe(false);
  }, 60_000);
});
