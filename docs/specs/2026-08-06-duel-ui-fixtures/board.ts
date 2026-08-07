import type { DuelStateSnapshot, DuelZones, ZoneCard, PhaseName, Seat } from "./types";

export const POS_FACEUP_ATK = 1;
export const POS_FACEDOWN_ATK = 2;
export const POS_FACEUP_DEF = 4;
export const POS_FACEDOWN_DEF = 8;

export function mon(
  code: number,
  sequence: number,
  attack: number,
  defense: number,
  level: number,
  position = POS_FACEUP_ATK,
): ZoneCard {
  return { code, sequence, position, attack, defense, level, isPublic: true };
}

/** A set spell/trap. Face-down: the opponent sees code 0; the owner sees the real code. */
export function setCard(code: number, sequence: number): ZoneCard {
  return { code, sequence, position: POS_FACEDOWN_ATK, isPublic: false };
}

export function handCard(code: number, sequence: number): ZoneCard {
  return { code, sequence, position: POS_FACEUP_ATK, isPublic: true };
}

export function backs(n: number): ZoneCard[] {
  return Array.from({ length: n }, (_, i) => ({
    code: 0,
    sequence: i,
    position: POS_FACEDOWN_ATK,
    isPublic: false,
  }));
}

export function row(cards: (ZoneCard | null)[]): (ZoneCard | null)[] {
  // MH-1.2 — dense, fixed length 5, explicit null holes.
  const out: (ZoneCard | null)[] = [null, null, null, null, null];
  cards.forEach((c, i) => {
    if (c) out[i] = { ...c, sequence: i };
  });
  return out;
}

export function emptyZones(): DuelZones {
  return {
    p0_hand: [],
    p1_hand: [],
    p0_mzone: row([]),
    p1_mzone: row([]),
    p0_szone: row([]),
    p1_szone: row([]),
    p0_fzone: null,
    p1_fzone: null,
    p0_grave: [],
    p1_grave: [],
    p0_removed: [],
    p1_removed: [],
    p0_extra: [],
    p1_extra: [],
    p0_deckCount: 34,
    p1_deckCount: 34,
  };
}

export function state(
  zones: DuelZones,
  o: {
    phase?: PhaseName;
    turnNumber?: number;
    currentTurn?: Seat;
    lp?: [number, number];
    duelEnded?: boolean;
  } = {},
): DuelStateSnapshot {
  return {
    seat: 0,
    duelEnded: o.duelEnded ?? false,
    currentTurn: o.currentTurn ?? 0,
    currentPhase: o.phase ?? "M1",
    turnNumber: o.turnNumber ?? 4,
    lp: o.lp ?? [8000, 8000],
    zones,
  };
}

/** deep-ish clone so scenario steps can mutate freely */
export function clone(z: DuelZones): DuelZones {
  return JSON.parse(JSON.stringify(z)) as DuelZones;
}
