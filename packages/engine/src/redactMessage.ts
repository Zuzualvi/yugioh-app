// ---------------------------------------------------------------------------
// Per-seat hidden-information redactor — ported from spikes/spike-c-relay.
//
// Two-layer approach:
//   Layer 1 — Routing: decision/reveal/hint messages sent to entitled player only.
//   Layer 2 — Stripping: broadcast messages have hidden card codes zeroed.
//
// Hidden info rules (Edison):
//   - Opponent hand: identity hidden (count visible)
//   - Opponent deck: contents/order never visible
//   - Opponent face-down field card: identity hidden, presence visible
//   - Own cards: fully visible
//
// ⚠ The three dangerous leak points:
//   1. DRAW (type 90): drawn[].code → zeroed for opponent
//   2. MOVE (type 50): card.code → zeroed when destination is hidden
//   3. SET  (type 54): code → zeroed for non-owner
// ---------------------------------------------------------------------------

import type { Seat, RedactedEngineMessage } from "@yugioh-app/contracts";
import type { RawEngineMessage } from "./types.js";

// ocgcore message type constants (from OcgMessageType enum in ocgcore-wasm).
// Inlined here to avoid importing from ocgcore-wasm at the redaction layer;
// these values are stable in the edo9300 codebase and verified in spike-c.
const MSG = {
  DRAW: 90,
  MOVE: 50,
  SET: 54,
  SHUFFLE_HAND: 60,
  SHUFFLE_SET_CARD: 67,
  SELECT_BATTLECMD: 10,
  SELECT_IDLECMD: 11,
  SELECT_EFFECTYN: 12,
  SELECT_YESNO: 13,
  SELECT_OPTION: 14,
  SELECT_CARD: 15,
  SELECT_CHAIN: 16,
  SELECT_PLACE: 18,
  SELECT_POSITION: 19,
  SELECT_TRIBUTE: 20,
  SORT_CHAIN: 21,
  SELECT_COUNTER: 22,
  SELECT_SUM: 23,
  SELECT_DISFIELD: 24,
  SORT_CARD: 25,
  SELECT_UNSELECT_CARD: 26,
  ROCK_PAPER_SCISSORS: 30,
  ANNOUNCE_RACE: 31,
  ANNOUNCE_ATTRIB: 32,
  ANNOUNCE_CARD: 33,
  ANNOUNCE_NUMBER: 34,
  CONFIRM_DECKTOP: 81,
  CONFIRM_CARDS: 83,
  DECK_TOP: 85,
  CONFIRM_EXTRATOP: 86,
  HINT: 1,
  PLAYER_HINT: 2,
  CARD_HINT: 3,
  SHOW_HINT: 80,
  FLIPSUMMONING: 43,
} as const;

// OcgLocation bit flags (stable ocgcore constants).
const LOC_HAND = 0x2;
const LOC_DECK = 0x1;

// OcgPosition face-down mask.
const FD_MASK = 0x2 | 0x8; // FACEDOWN_ATTACK | FACEDOWN_DEFENSE

// ── Routing sets (Layer 1) ────────────────────────────────────────────────────

const DECISION_TYPES: Set<number> = new Set([
  MSG.SELECT_BATTLECMD,
  MSG.SELECT_IDLECMD,
  MSG.SELECT_EFFECTYN,
  MSG.SELECT_YESNO,
  MSG.SELECT_OPTION,
  MSG.SELECT_CARD,
  MSG.SELECT_CHAIN,
  MSG.SELECT_PLACE,
  MSG.SELECT_POSITION,
  MSG.SELECT_TRIBUTE,
  MSG.SORT_CHAIN,
  MSG.SELECT_COUNTER,
  MSG.SELECT_SUM,
  MSG.SELECT_DISFIELD,
  MSG.SORT_CARD,
  MSG.SELECT_UNSELECT_CARD,
  MSG.ROCK_PAPER_SCISSORS,
  MSG.ANNOUNCE_RACE,
  MSG.ANNOUNCE_ATTRIB,
  MSG.ANNOUNCE_CARD,
  MSG.ANNOUNCE_NUMBER,
]);

const REVEAL_TYPES: Set<number> = new Set([
  MSG.CONFIRM_DECKTOP,
  MSG.CONFIRM_CARDS,
  MSG.DECK_TOP,
  MSG.CONFIRM_EXTRATOP,
]);

const HINT_TYPES: Set<number> = new Set([
  MSG.HINT,
  MSG.PLAYER_HINT,
  MSG.CARD_HINT,
  MSG.SHOW_HINT,
]);

const HAND_SHUFFLE_TYPES: Set<number> = new Set([MSG.SHUFFLE_HAND, MSG.SHUFFLE_SET_CARD]);

// ── Internal helpers ──────────────────────────────────────────────────────────

function isFaceDown(position: unknown): boolean {
  if (typeof position !== "number") return false;
  return (position & FD_MASK) !== 0;
}

function toRedacted(raw: RawEngineMessage): RedactedEngineMessage {
  // Map numeric type to a human-readable name for the envelope.
  return {
    name: raw["name"] as string ?? "UNKNOWN",
    engineType: raw.type,
    player: raw.player,
    ...raw,
  } as RedactedEngineMessage;
}

// ── Main redaction function ───────────────────────────────────────────────────

/**
 * Return the raw message as the given viewer should see it,
 * or `null` if the viewer is not entitled to receive it at all.
 *
 * @param msg    - Raw engine message (un-redacted).
 * @param viewer - Seat (0 or 1) receiving the message.
 */
export function redactMessageForSeat(
  msg: RawEngineMessage,
  viewer: Seat,
): RedactedEngineMessage | null {
  const t = msg.type;

  // ── Layer 1: routing ───────────────────────────────────────────────────────

  if (DECISION_TYPES.has(t) || REVEAL_TYPES.has(t) || HINT_TYPES.has(t) || HAND_SHUFFLE_TYPES.has(t)) {
    if (msg.player !== viewer) return null;
    return toRedacted(msg);
  }

  // ── Layer 2: stripping — dangerous broadcast leak points ──────────────────

  // ⚠ DRAW: drawn[].code contains passcodes → zeroed for opponent.
  if (t === MSG.DRAW) {
    if (msg.player === viewer) return toRedacted(msg);
    const drawn = Array.isArray(msg["drawn"]) ? msg["drawn"] : [];
    return toRedacted({
      ...msg,
      drawn: drawn.map((c: unknown) => {
        const card = c as Record<string, unknown>;
        return { ...card, code: 0 };
      }),
    });
  }

  // ⚠ MOVE: msg.card is the moving card's passcode → zeroed when dest is hidden.
  if (t === MSG.MOVE) {
    const to = msg["to"] as Record<string, unknown> | undefined;
    if (!to) return toRedacted(msg);
    const isOpponentCard = (to["controller"] as number) !== viewer;
    const destLoc = (to["location"] as number) ?? 0;
    const destPos = to["position"] as number | undefined;
    const destinationHidden =
      (destLoc & LOC_HAND) !== 0 ||
      (destLoc & LOC_DECK) !== 0 ||
      isFaceDown(destPos);
    if (isOpponentCard && destinationHidden) {
      return toRedacted({ ...msg, card: 0 });
    }
    return toRedacted(msg);
  }

  // ⚠ SET: msg.code is the set card's passcode → zeroed for non-owner.
  if (t === MSG.SET) {
    if ((msg["controller"] as number) !== viewer) {
      return toRedacted({ ...msg, code: 0 });
    }
    return toRedacted(msg);
  }

  // All other messages: broadcast as-is (carry only publicly-visible info).
  return toRedacted(msg);
}
