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

/**
 * resolveCode — the client-side identity join.
 *
 * A decision payload may carry `code: 0` for a card the asking player owns: the
 * engine's `isHidden()` redacts by POSITION regardless of controller, and ocgcore
 * reports every hand card as position 10. But the `STATE` snapshot is NOT redacted
 * from its owner, so the client already holds the real code at
 * (controller, location, sequence) and can join the two.
 *
 * This is why the chain window can name your own set card WITHOUT ND-9. ND-9 is
 * still the right fix at source — and it is still required for any candidate whose
 * location is not in the snapshot at all (DECK) — but the client does not have to
 * wait for it, and it must never invent a name in the meantime.
 */
export function resolveCode(
  b: Board | null,
  ref: { controller: Seat; location: Loc; sequence: number },
): number {
  if (!b) return 0;
  const key = pileKey(ref.controller, ref.location);
  const arr = b.zones[key] as unknown;
  if (!Array.isArray(arr)) return 0;
  if (ROW_LOCS.includes(ref.location)) {
    return (arr as (ZoneCard | null)[])[ref.sequence]?.code ?? 0;
  }
  const pile = arr as ZoneCard[];
  const hit = pile.find((c) => c.sequence === ref.sequence) ?? pile[ref.sequence];
  return hit?.code ?? 0;
}

/**
 * applyEvents — move the board the way the ENGINE'S OWN EVENTS say it moved.
 *
 * This is the fix for the defect where the history rail read `LIFE POINTS You
 * −1900` while the life-point plate still said 8,000: the events were rendered
 * and never applied, so the two most important readings on the screen
 * contradicted each other and nothing told the player which was authoritative.
 *
 * It adjudicates nothing. `LP_CHANGE` carries the seat and the delta; `MOVE`
 * carries `from` and `to`. Both are what ocgcore emitted, normalised by the
 * server. Anything else is ignored rather than guessed at.
 */
export function applyEvents(b: Board, events: { kind: string; [k: string]: unknown }[]): Board {
  for (const e of events) {
    if (e.kind === "LP_CHANGE") {
      const seat = e["seat"] as Seat | undefined;
      const delta = e["delta"] as number | undefined;
      if (seat === undefined || delta === undefined) continue;
      const lp = [...b.lp] as [number, number];
      lp[seat] = Math.max(0, lp[seat] + delta);
      b.lp = lp;
      continue;
    }
    if (e.kind === "MOVE") {
      const from = e["from"] as { controller?: Seat; location?: Loc; sequence?: number } | undefined;
      const to = e["to"] as { controller?: Seat; location?: Loc; sequence?: number } | undefined;
      if (!from || !to || from.controller === undefined || !from.location) continue;
      // Only row → pile moves are applied. A pile → pile or pile → row move needs
      // a source index the event does not always carry, and a wrong move is worse
      // than an unmoved card.
      if (!ROW_LOCS.includes(from.location)) continue;
      if (to.location !== "GRAVE" && to.location !== "REMOVED") continue;
      const card = take(b, {
        controller: from.controller,
        location: from.location,
        sequence: from.sequence ?? 0,
      });
      if (card) put(b, to.controller ?? from.controller, to.location, 0, { ...card, position: 1 });
    }
  }
  return b;
}

/**
 * FIXTURE CONSISTENCY — a scenario whose log implies a state its board does not
 * show must FAIL TO LOAD.
 *
 * Same shape as the answer-outcome gate: it makes the class impossible instead of
 * fixing the instance. A scenario's opening feed asserts things that have already
 * happened, and the opening board is a real recorded snapshot — so an opening feed
 * carrying an `LP_CHANGE` or a `MOVE` is claiming a change nobody can show the
 * board reflects. Those events belong in the arriving stream, where they are
 * applied, not in the opening one, where they are only narrated.
 */
export function assertFeedConsistency(name: string, openingFeed: { kind: string }[]): void {
  const offenders = openingFeed.filter((e) => e.kind === "LP_CHANGE" || e.kind === "MOVE");
  if (offenders.length > 0) {
    throw new Error(
      `fixture ${name}: opening feed asserts ${offenders.length} state change(s) ` +
        `(${offenders.map((o) => o.kind).join(", ")}) that the opening board cannot be shown to ` +
        `reflect. Move them into the arriving event stream, where they are applied.`,
    );
  }
}
