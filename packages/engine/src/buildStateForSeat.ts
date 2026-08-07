// ---------------------------------------------------------------------------
// Per-seat DuelStateSnapshot builder.
//
// Queries ocgcore for the current board state and applies per-seat redaction:
// hidden card codes are zeroed. The engine API already hides opponent hand
// codes in duelQueryLocation responses, but we apply explicit zeroing too
// (spike-c gotcha: track drawn codes to fill own hand — done in EdisonDuel).
// ---------------------------------------------------------------------------

import type { Seat, DuelStateSnapshot, ZoneCard } from "@yugioh-app/contracts";
import type { OcgCoreSync, OcgDuelHandle, OcgQueryFlags } from "ocgcore-wasm";
import { OcgLocation, OcgQueryFlags as OcgQueryFlagsConst, OcgPosition } from "ocgcore-wasm";

// Face-down position mask
const FD_MASK = OcgPosition.FACEDOWN_ATTACK | OcgPosition.FACEDOWN_DEFENSE;

function isFaceDown(position: number | undefined): boolean {
  if (position === undefined) return false;
  return (position & FD_MASK) !== 0;
}

// Note: OcgQueryFlags.TYPE (flag=8) is intentionally excluded. The installed
// ocgcore-wasm JS wrapper's readQuery() does not handle TYPE entries: it reads
// the flag but does not consume the data bytes, causing byte-level misalignment
// that corrupts all subsequent fields (including CODE and POSITION) in the
// binary response. TYPE is not surfaced in ZoneCard, so excluding it is safe.
const QUERY_FLAGS = (OcgQueryFlagsConst.CODE |
  OcgQueryFlagsConst.POSITION |
  OcgQueryFlagsConst.IS_PUBLIC |
  OcgQueryFlagsConst.ATTACK |
  OcgQueryFlagsConst.DEFENSE |
  OcgQueryFlagsConst.LEVEL) as OcgQueryFlags;

export interface DuelPhaseInfo {
  currentTurn: Seat;
  currentPhase: number;
  lp: [number, number];
  duelEnded: boolean;
  /** Turn counter — incremented by EdisonDuel on each MSG_NEW_TURN. Optional for
   *  backwards compat: undefined until EdisonDuel is wired to track it. */
  turnNumber?: number;
}

// ---------------------------------------------------------------------------
// Helper: map one raw card object to a ZoneCard, applying redaction.
// ---------------------------------------------------------------------------
function toZoneCard(
  card: Record<string, unknown>,
  needsRedact: boolean,
  sequence: number,
): ZoneCard {
  const position = card["position"] as number | undefined;
  return {
    ...card,
    code: needsRedact ? 0 : ((card["code"] as number) ?? 0),
    position: position ?? 0,
    sequence,
  } as ZoneCard;
}

// ---------------------------------------------------------------------------
// Helper: build a dense length-5 array of ZoneCard | null from the raw
// core result, preserving nulls so that array index === zone sequence.
// Raw result is length 7 (MZONE) or 8 (SZONE); we keep only indices 0-4.
//
// Before dropping indices 5+ we ASSERT they are always null in Edison.
// If any non-null slot is found in those positions, we throw — that is a
// genuine finding that must not be silently swallowed.
// ---------------------------------------------------------------------------
function buildDenseZone(
  raw: unknown[],
  isOpponentZone: boolean,
  deadSlotStart: number,
  deadSlotEnd: number, // exclusive
  zoneName: string,
): Array<ZoneCard | null> {
  // Assert Edison-dead slots are always null.
  for (let i = deadSlotStart; i < deadSlotEnd && i < raw.length; i++) {
    if (raw[i] != null) {
      throw new Error(
        `NH-5 dead-slot assertion failed: ${zoneName}[${i}] is non-null in Edison. ` +
          `This is a genuine finding — report to the CTO before proceeding. ` +
          `Value: ${JSON.stringify(raw[i])}`,
      );
    }
  }

  const result: Array<ZoneCard | null> = [];
  for (let i = 0; i < 5; i++) {
    const card = raw[i];
    if (card == null) {
      result.push(null);
    } else {
      const c = card as Record<string, unknown>;
      const position = c["position"] as number | undefined;
      const needsRedact =
        isOpponentZone &&
        (isFaceDown(position) || (c["isPublic"] as boolean | undefined) === false);
      result.push(toZoneCard(c, needsRedact, i));
    }
  }
  return result;
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
  function query(ctrl: 0 | 1, loc: OcgLocation): unknown[] {
    try {
      return lib.duelQueryLocation(handle, {
        flags: QUERY_FLAGS,
        controller: ctrl,
        location: loc,
      }) as unknown[];
    } catch {
      return [];
    }
  }

  // ── Hand (dense by nature) ────────────────────────────────────────────────
  function buildHand(ctrl: 0 | 1): ZoneCard[] {
    const raw = query(ctrl, OcgLocation.HAND);
    const isOpponentZone = ctrl !== viewer;
    // Hand is always hidden from opponent regardless of isPublic.
    return (raw.filter((c) => c != null) as Record<string, unknown>[]).map((c, i) => {
      const needsRedact = isOpponentZone;
      return toZoneCard(c, needsRedact, i);
    });
  }

  // ── Pile zones (GRAVE, REMOVED, EXTRA) ───────────────────────────────────
  function buildPile(ctrl: 0 | 1, loc: OcgLocation): ZoneCard[] {
    const raw = query(ctrl, loc);
    const isOpponentZone = ctrl !== viewer;
    return (raw.filter((c) => c != null) as Record<string, unknown>[]).map((c, i) => {
      const position = c["position"] as number | undefined;
      // Face-down pile cards (e.g. REMOVED face-down) and non-public cards are redacted.
      const needsRedact =
        isOpponentZone &&
        (isFaceDown(position) || (c["isPublic"] as boolean | undefined) === false);
      return toZoneCard(c, needsRedact, i);
    });
  }

  // ── MZONE (length 7 from core → dense length 5, drop slots 5-6) ──────────
  function buildMzone(ctrl: 0 | 1): Array<ZoneCard | null> {
    const raw = query(ctrl, OcgLocation.MZONE);
    const isOpponentZone = ctrl !== viewer;
    return buildDenseZone(raw, isOpponentZone, 5, 7, `p${ctrl}_mzone`);
  }

  // ── SZONE (length 8 from core → dense length 5 + fzone, drop slots 6-7) ──
  function buildSzoneAndFzone(ctrl: 0 | 1): {
    szone: Array<ZoneCard | null>;
    fzone: ZoneCard | null;
  } {
    const raw = query(ctrl, OcgLocation.SZONE);
    const isOpponentZone = ctrl !== viewer;

    // Assert pendulum slots (6-7) are always null in Edison.
    buildDenseZone(raw, isOpponentZone, 6, 8, `p${ctrl}_szone`);

    // Lift szone[5] out as the field zone.
    let fzone: ZoneCard | null = null;
    if (raw[5] != null) {
      const c = raw[5] as Record<string, unknown>;
      const position = c["position"] as number | undefined;
      const needsRedact =
        isOpponentZone &&
        (isFaceDown(position) || (c["isPublic"] as boolean | undefined) === false);
      fzone = toZoneCard(c, needsRedact, 5);
    }

    // Build the regular szone (indices 0-4).
    const szone: Array<ZoneCard | null> = [];
    for (let i = 0; i < 5; i++) {
      const card = raw[i];
      if (card == null) {
        szone.push(null);
      } else {
        const c = card as Record<string, unknown>;
        const position = c["position"] as number | undefined;
        const needsRedact =
          isOpponentZone &&
          (isFaceDown(position) || (c["isPublic"] as boolean | undefined) === false);
        szone.push(toZoneCard(c, needsRedact, i));
      }
    }
    return { szone, fzone };
  }

  // ── Deck count (integer, never contents) ─────────────────────────────────
  function getDeckCount(ctrl: 0 | 1): number {
    try {
      const raw = lib.duelQueryLocation(handle, {
        flags: OcgQueryFlagsConst.CODE as OcgQueryFlags,
        controller: ctrl,
        location: OcgLocation.DECK,
      }) as unknown[];
      return raw.filter((c) => c != null).length;
    } catch {
      return 0;
    }
  }

  const { szone: p0_szone, fzone: p0_fzone } = buildSzoneAndFzone(0);
  const { szone: p1_szone, fzone: p1_fzone } = buildSzoneAndFzone(1);

  return {
    seat: viewer,
    duelEnded: phaseInfo.duelEnded,
    currentTurn: phaseInfo.currentTurn,
    currentPhase: phaseInfo.currentPhase,
    lp: phaseInfo.lp,
    zones: {
      p0_hand: buildHand(0),
      p1_hand: buildHand(1),
      p0_mzone: buildMzone(0),
      p1_mzone: buildMzone(1),
      p0_szone,
      p1_szone,
      p0_fzone,
      p1_fzone,
      p0_grave: buildPile(0, OcgLocation.GRAVE),
      p1_grave: buildPile(1, OcgLocation.GRAVE),
      p0_removed: buildPile(0, OcgLocation.REMOVED),
      p1_removed: buildPile(1, OcgLocation.REMOVED),
      p0_extra: buildPile(0, OcgLocation.EXTRA),
      p1_extra: buildPile(1, OcgLocation.EXTRA),
      p0_deckCount: getDeckCount(0),
      p1_deckCount: getDeckCount(1),
    },
    ...(clock ? { clock } : {}),
    ...(phaseInfo.turnNumber !== undefined ? { turnNumber: phaseInfo.turnNumber } : {}),
  };
}
