// Board model + the mechanical, ANSWER-KEYED mutations.
//
// ⚠ This file deliberately implements NO RULES. The previous prototype hand-wrote
// a simulation of rules the engine already implements and then spent design budget
// debugging three defects in the simulation. Everything here is a card MOVE that is
// directly named by the answer the player gave: you named a zone, the card goes in
// that zone; you named a tribute, that card goes to the graveyard. Nothing decides
// legality, nothing adjudicates an effect, nothing computes damage. Where a real
// continuation is needed it is REPLAYED from the recorded capture.
import type { CardEntry, DuelStateSnapshot, DuelZones, Loc, Seat, ZoneCard } from "./types";

export type Board = DuelStateSnapshot;

export function clone(b: Board): Board {
  return JSON.parse(JSON.stringify(b)) as Board;
}

type PileKey = keyof DuelZones;

export function pileKey(seat: Seat, loc: Loc): PileKey {
  const m: Record<string, string> = {
    HAND: "hand",
    MZONE: "mzone",
    SZONE: "szone",
    GRAVE: "grave",
    REMOVED: "removed",
    EXTRA: "extra",
    FZONE: "fzone",
  };
  return `p${seat}_${m[loc] ?? "hand"}` as PileKey;
}

const ROW_LOCS: Loc[] = ["MZONE", "SZONE"];

/** Remove and return the card a CardEntry points at. */
export function take(b: Board, ref: { controller: Seat; location: Loc; sequence: number }): ZoneCard | null {
  const key = pileKey(ref.controller, ref.location);
  const arr = b.zones[key] as unknown;
  if (Array.isArray(arr)) {
    if (ROW_LOCS.includes(ref.location)) {
      const row = arr as (ZoneCard | null)[];
      const c = row[ref.sequence] ?? null;
      if (c) row[ref.sequence] = null;
      return c;
    }
    const pile = arr as ZoneCard[];
    const idx = pile.findIndex((c) => c.sequence === ref.sequence);
    if (idx < 0) return pile.splice(ref.sequence, 1)[0] ?? null;
    const [c] = pile.splice(idx, 1);
    resequence(pile);
    return c ?? null;
  }
  return null;
}

function resequence(pile: ZoneCard[]) {
  pile.forEach((c, i) => (c.sequence = i));
}

/** Put a card into a row slot (MZONE/SZONE) or onto a pile. */
export function put(b: Board, seat: Seat, loc: Loc, sequence: number, card: ZoneCard, position?: number) {
  const key = pileKey(seat, loc);
  const c = { ...card, sequence, ...(position !== undefined ? { position } : {}) };
  if (ROW_LOCS.includes(loc)) {
    (b.zones[key] as (ZoneCard | null)[])[sequence] = c;
    return;
  }
  const pile = b.zones[key] as ZoneCard[];
  pile.unshift(c);
  resequence(pile);
}

export const POS_FACEUP_ATK = 1;
export const POS_FACEUP_DEF = 4;
export const POS_FACEDOWN_DEF = 8;
export const FD_MASK = 2 | 8;

export function isFaceDown(position: number): boolean {
  return (position & FD_MASK) !== 0;
}

export function isDefence(position: number): boolean {
  return (position & (4 | 8)) !== 0;
}

/** Every card the player is entitled to identify, as a flat list. Used by the
 *  board, the candidate thumbs and the inspector so there is exactly one rule. */
export function entitled(mySeat: Seat, seat: Seat, loc: Loc, card: ZoneCard): boolean {
  if (seat === mySeat) return true;
  if (loc === "HAND" || loc === "DECK" || loc === "EXTRA") return false;
  return !isFaceDown(card.position);
}

/**
 * ND-7 — allowlist redaction, applied at the point of DISPLAY as well as on the
 * wire. The real server sends the opponent's hidden hand with level/attack/defense
 * intact and only `code` zeroed; a denylist fails open every time the type grows a
 * field. The prototype names the fields an opponent may see and drops the rest, so
 * the screen cannot render a leak even while the wire still carries one.
 */
const OPPONENT_MAY_SEE: (keyof ZoneCard)[] = ["code", "position", "sequence"];

export function redactedForDisplay(card: ZoneCard, isEntitled: boolean): ZoneCard {
  if (isEntitled) return card;
  const out = { code: 0, position: card.position, sequence: card.sequence } as ZoneCard;
  void OPPONENT_MAY_SEE;
  return out;
}

export function refOf(e: CardEntry) {
  return { controller: e.controller, location: e.location, sequence: e.sequence };
}

export function sameRef(a: { controller: Seat; location: Loc; sequence: number } | null, b: { controller: Seat; location: Loc; sequence: number } | null) {
  if (!a || !b) return false;
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
}

export function row(b: Board, seat: Seat, loc: "MZONE" | "SZONE"): (ZoneCard | null)[] {
  return b.zones[pileKey(seat, loc)] as (ZoneCard | null)[];
}

export function hand(b: Board, seat: Seat): ZoneCard[] {
  return b.zones[pileKey(seat, "HAND")] as ZoneCard[];
}

export function pile(b: Board, seat: Seat, loc: "GRAVE" | "REMOVED" | "EXTRA"): ZoneCard[] {
  return b.zones[pileKey(seat, loc)] as ZoneCard[];
}
