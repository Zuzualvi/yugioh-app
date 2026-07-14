// ---------------------------------------------------------------------------
// Per-seat DuelStateSnapshot builder.
//
// Queries ocgcore for the current board state and applies per-seat redaction:
// hidden card codes are zeroed. The engine API already hides opponent hand
// codes in duelQueryLocation responses, but we apply explicit zeroing too
// (spike-c gotcha: track drawn codes to fill own hand — done in EdisonDuel).
// ---------------------------------------------------------------------------

import type { Seat, DuelStateSnapshot, DuelZones, ZoneCard } from "@yugioh-app/contracts";
import type { OcgCoreSync, OcgDuelHandle, OcgQueryFlags } from "ocgcore-wasm";
import { OcgLocation, OcgQueryFlags as OcgQueryFlagsConst, OcgPosition } from "ocgcore-wasm";

// Face-down position mask
const FD_MASK = OcgPosition.FACEDOWN_ATTACK | OcgPosition.FACEDOWN_DEFENSE;

function isFaceDown(position: number | undefined): boolean {
  if (position === undefined) return false;
  return (position & FD_MASK) !== 0;
}

const QUERY_FLAGS = (
  OcgQueryFlagsConst.CODE |
  OcgQueryFlagsConst.POSITION |
  OcgQueryFlagsConst.IS_PUBLIC |
  OcgQueryFlagsConst.TYPE |
  OcgQueryFlagsConst.ATTACK |
  OcgQueryFlagsConst.DEFENSE |
  OcgQueryFlagsConst.LEVEL
) as OcgQueryFlags;

const ZONE_DEFS = [
  { ctrl: 0 as 0 | 1, loc: OcgLocation.HAND, name: "p0_hand" as const },
  { ctrl: 0 as 0 | 1, loc: OcgLocation.MZONE, name: "p0_mzone" as const },
  { ctrl: 0 as 0 | 1, loc: OcgLocation.SZONE, name: "p0_szone" as const },
  { ctrl: 0 as 0 | 1, loc: OcgLocation.GRAVE, name: "p0_grave" as const },
  { ctrl: 0 as 0 | 1, loc: OcgLocation.REMOVED, name: "p0_removed" as const },
  { ctrl: 0 as 0 | 1, loc: OcgLocation.EXTRA, name: "p0_extra" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.HAND, name: "p1_hand" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.MZONE, name: "p1_mzone" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.SZONE, name: "p1_szone" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.GRAVE, name: "p1_grave" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.REMOVED, name: "p1_removed" as const },
  { ctrl: 1 as 0 | 1, loc: OcgLocation.EXTRA, name: "p1_extra" as const },
] as const;

export interface DuelPhaseInfo {
  currentTurn: Seat;
  currentPhase: number;
  lp: [number, number];
  duelEnded: boolean;
}

/**
 * Build a per-seat DuelStateSnapshot by querying the live core.
 *
 * @param lib         - The ocgcore sync instance.
 * @param handle      - Active duel handle.
 * @param viewer      - Seat requesting the state.
 * @param phaseInfo   - Turn/phase/LP info tracked by EdisonDuel.
 * @param clock       - Optional clock info.
 */
export function buildStateForSeat(
  lib: OcgCoreSync,
  handle: OcgDuelHandle,
  viewer: Seat,
  phaseInfo: DuelPhaseInfo,
  clock?: { onClockSeat: Seat; deadlineAt: number },
): DuelStateSnapshot {
  const zonesRecord: Partial<Record<string, ZoneCard[]>> = {};

  for (const { ctrl, loc, name } of ZONE_DEFS) {
    let cards: unknown[];
    try {
      cards = lib.duelQueryLocation(handle, {
        flags: QUERY_FLAGS,
        controller: ctrl,
        location: loc,
      }) as unknown[];
    } catch {
      cards = [];
    }

    const isOpponentZone = ctrl !== viewer;
    const alwaysHidden =
      (loc & (OcgLocation.HAND | OcgLocation.DECK)) !== 0;

    zonesRecord[name] = cards
      .filter((c): c is Record<string, unknown> => c != null)
      .map((card) => {
        const position = card["position"] as number | undefined;
        const needsRedact =
          isOpponentZone &&
          (alwaysHidden ||
            isFaceDown(position) ||
            card["isPublic"] === false);

        const base: ZoneCard = {
          code: needsRedact ? 0 : ((card["code"] as number) ?? 0),
          position: position ?? 0,
          ...card,
        };
        if (needsRedact) base.code = 0;
        return base;
      });
  }

  const zones = zonesRecord as DuelZones;

  return {
    seat: viewer,
    duelEnded: phaseInfo.duelEnded,
    currentTurn: phaseInfo.currentTurn,
    currentPhase: phaseInfo.currentPhase,
    lp: phaseInfo.lp,
    zones,
    ...(clock ? { clock } : {}),
  };
}
