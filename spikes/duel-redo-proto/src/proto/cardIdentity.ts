/**
 * cardIdentity.ts — ONE place where "which card is this?" is answered.
 *
 * D5 exists because a parallel source for one fact produced `Activate "Dimensional
 * Prison"` over a Book of Moon: the label came from hand-authored fixture data and
 * the response came from the index. So there is exactly one lookup in this client —
 * `board.ts: resolveCode`, the join against the `STATE` snapshot — and every surface
 * that names a card goes through it. The confirm labels (`candidateLabel`) call it
 * directly; the rail calls it through the `resolve` closure passed in here. TWO
 * FORMATTERS OVER ONE LOOKUP: the dock appends a slot when two candidates share a
 * name, the rail never shows a slot at all. D5 is about the lookup, not the wording.
 *
 * This module deliberately does NOT import the scenarios module for anything but the
 * card corpus, and nothing imports it back, so there is no cycle.
 *
 * The enabling fact, recorded in `05-backend-delta.md` §2a: the `STATE` snapshot is
 * NOT redacted from its owner, so a `code: 0` on the wire is not the end of the
 * story for a card the player is entitled to see.
 */
import { cardInfo } from "./scenarios";
import type { Seat } from "./types";

/** A ref as events and decisions both carry it. */
export interface IdentityRef {
  code?: number;
  controller?: Seat;
  location?: string;
  sequence?: number;
}

/** The join. `resolve` is the client's own board lookup — never a second source. */
export function identify(ref: IdentityRef | null | undefined, resolve: (r: unknown) => number): number {
  if (!ref) return 0;
  return ref.code || resolve(ref) || 0;
}

/**
 * ⚠️ PROVISIONAL VOCABULARY, OWNED BY ZUH-123, AND DELIBERATELY IN ONE PLACE.
 *
 * What a player should call each zone is microcopy and has a named owner. What is
 * NOT microcopy is that the row must not show an engine enum — `GRAVE`, `MZONE`,
 * `SZONE` are identifiers, not words. These are plain placeholders so the structure
 * can ship; the copy owner changes them here, once, rather than hunting per-site
 * strings.
 */
const LOCATION_WORD: Record<string, string> = {
  HAND: "hand",
  DECK: "deck",
  MZONE: "monster zone",
  SZONE: "spell & trap zone",
  FZONE: "field zone",
  GRAVE: "graveyard",
  REMOVED: "banished",
  EXTRA: "extra deck",
  OVERLAY: "overlay",
  PZONE: "pendulum zone",
};

export function locationWord(location: string | undefined): string {
  if (!location) return "";
  return LOCATION_WORD[location] ?? location.toLowerCase();
}

/**
 * What the rail calls a card.
 *
 * Named wherever the player is entitled to know it — which, after the join, is
 * everywhere the `STATE` snapshot carries it. Where identity genuinely cannot be
 * resolved, the row says what the player can see and NOTHING ELSE: no engine enum,
 * and no slot index, because a sequence number is an array position wearing a noun
 * ("their card 2" was the complaint). Getting this wrong in the other direction
 * would leak hidden information, which is ND-7's territory, so the descriptor is
 * built only from `controller` and `location` — both of which the opponent may
 * legitimately see.
 */
export function eventCardLabel(
  ref: IdentityRef | null | undefined,
  mySeat: Seat,
  resolve: (r: unknown) => number,
): string {
  if (!ref) return "";
  const code = identify(ref, resolve);
  const name = code ? cardInfo(code)?.name : null;
  if (name) return name;
  const whose = ref.controller === undefined ? "a" : ref.controller === mySeat ? "your" : "their";
  switch (ref.location) {
    case "MZONE":
      return `${whose} face-down monster`;
    case "SZONE":
      return `${whose} face-down card`;
    case "HAND":
      return `${whose} card in hand`;
    case "DECK":
      return `${whose} card in the deck`;
    case "EXTRA":
      return `${whose} card in the extra deck`;
    case "GRAVE":
      return `${whose} card in the graveyard`;
    case "REMOVED":
      return `${whose} banished card`;
    default:
      return whose === "a" ? "a card" : `${whose} card`;
  }
}

/**
 * The machine-readable ref for a row, so the transcript keeps its disambiguation
 * WITHOUT showing the player an index.
 *
 * Two copies of one card leave an identical board, and the answer-outcome
 * enumeration reported exactly that as an outcome collision — which is why the slot
 * used to be printed. It does not have to be VISIBLE to do that job: the row carries
 * it as `data-ref`, the gate's fingerprint reads it, and the player reads a sentence.
 */
export function refKey(ref: IdentityRef | null | undefined): string {
  if (!ref) return "";
  return `${ref.controller ?? "?"}-${ref.location ?? "?"}-${ref.sequence ?? "?"}`;
}
