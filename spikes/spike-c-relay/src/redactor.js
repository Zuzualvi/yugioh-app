/**
 * Per-seat hidden-information redactor (REQ-NET-01/02, AC-12).
 *
 * Two-layer approach:
 *   Layer 1 — Routing: decision/reveal messages are only sent to the entitled player.
 *   Layer 2 — Stripping: broadcast messages that embed card identities have those
 *             identities zeroed (code → 0) when the viewer is not entitled to them.
 *
 * Hidden information per the spec:
 *   - Opponent hand: identity hidden (count visible)
 *   - Opponent deck: contents/order never sent
 *   - Opponent face-down zone card: identity hidden, position/existence visible
 *   - Own cards: fully visible to the seat owner
 *
 * ⚠ RISKY — engine stream messages that must be stripped manually:
 *   1. DRAW (type 90)    : drawn[].code contains passcodes → zeroed for opponent
 *   2. MOVE (type 50)    : card field contains moving card's code → zeroed when dest is hidden
 *   3. SET  (type 54)    : code field contains set card's code → zeroed for non-owner
 *
 * These three are the dangerous leak points. All other broadcast messages carry
 * only face-up / publicly-known card info and are safe to send to both seats.
 */

import {
  OcgMessageType, OcgLocation, OcgPosition, OcgQueryFlags,
} from 'ocgcore-wasm';

// Face-down position mask: FACEDOWN_ATTACK(2) | FACEDOWN_DEFENSE(8)
const FD_MASK = OcgPosition.FACEDOWN_ATTACK | OcgPosition.FACEDOWN_DEFENSE;

function isFaceDown(position) {
  return position !== undefined && (position & FD_MASK) !== 0;
}

// ── Layer 1: player-routed message sets ───────────────────────────────────────

/** Decision messages — only the asked player should receive them. */
const DECISION_TYPES = new Set([
  OcgMessageType.SELECT_BATTLECMD,
  OcgMessageType.SELECT_IDLECMD,
  OcgMessageType.SELECT_EFFECTYN,
  OcgMessageType.SELECT_YESNO,
  OcgMessageType.SELECT_OPTION,
  OcgMessageType.SELECT_CARD,
  OcgMessageType.SELECT_CHAIN,
  OcgMessageType.SELECT_PLACE,
  OcgMessageType.SELECT_POSITION,
  OcgMessageType.SELECT_TRIBUTE,
  OcgMessageType.SORT_CHAIN,
  OcgMessageType.SELECT_COUNTER,
  OcgMessageType.SELECT_SUM,
  OcgMessageType.SELECT_DISFIELD,
  OcgMessageType.SORT_CARD,
  OcgMessageType.SELECT_UNSELECT_CARD,
  OcgMessageType.ROCK_PAPER_SCISSORS,
  OcgMessageType.ANNOUNCE_RACE,
  OcgMessageType.ANNOUNCE_ATTRIB,
  OcgMessageType.ANNOUNCE_CARD,
  OcgMessageType.ANNOUNCE_NUMBER,
]);

/** Reveal messages — entitled player only (engine already targets one player). */
const REVEAL_TYPES = new Set([
  OcgMessageType.CONFIRM_DECKTOP,
  OcgMessageType.CONFIRM_CARDS,
  OcgMessageType.DECK_TOP,
  OcgMessageType.CONFIRM_EXTRATOP,
]);

/** Hint messages — routed only to their player field (conservative). */
const HINT_TYPES = new Set([
  OcgMessageType.HINT,
  OcgMessageType.PLAYER_HINT,
  OcgMessageType.CARD_HINT,
  OcgMessageType.SHOW_HINT,
]);

/**
 * Hand/set-card shuffle messages contain card ordering (identity-revealing).
 * Only the hand owner receives them.
 */
const HAND_SHUFFLE_TYPES = new Set([
  OcgMessageType.SHUFFLE_HAND,
  OcgMessageType.SHUFFLE_SET_CARD,
]);

// ── Main redaction function ───────────────────────────────────────────────────

/**
 * Return the message as the given viewer should see it, or null if the viewer
 * should not receive this message at all.
 *
 * @param {object} msg     - Raw engine message object
 * @param {0|1}    viewer  - Seat (0 or 1) receiving the message
 * @returns {object|null}
 */
export function redactForViewer(msg, viewer) {
  const { type } = msg;

  // ── Layer 1: routing ───────────────────────────────────────────────────────

  if (DECISION_TYPES.has(type)) {
    return msg.player === viewer ? msg : null;
  }

  if (REVEAL_TYPES.has(type)) {
    return msg.player === viewer ? msg : null;
  }

  if (HINT_TYPES.has(type)) {
    return msg.player === viewer ? msg : null;
  }

  if (HAND_SHUFFLE_TYPES.has(type)) {
    return msg.player === viewer ? msg : null;
  }

  // ── Layer 2: stripping — messages with embedded hidden passcodes ───────────

  // ⚠ RISKY: DRAW — drawn[].code are the actual card passcodes.
  if (type === OcgMessageType.DRAW) {
    if (msg.player === viewer) return msg;
    // Opponent draw: zero codes, preserve count (array length unchanged)
    return { ...msg, drawn: msg.drawn.map(c => ({ code: 0, position: c.position })) };
  }

  // ⚠ RISKY: MOVE — msg.card is the moving card's passcode.
  if (type === OcgMessageType.MOVE) {
    const { to } = msg;
    const isOpponentCard = to.controller !== viewer;
    const destinationHidden =
      (to.location & OcgLocation.HAND) !== 0 ||  // going to opponent's hand
      (to.location & OcgLocation.DECK) !== 0 ||  // going back to deck
      isFaceDown(to.position);                    // going face-down on field

    if (isOpponentCard && destinationHidden) {
      return { ...msg, card: 0 };
    }
    return msg;
  }

  // ⚠ RISKY: SET — msg.code is the set card's passcode.
  if (type === OcgMessageType.SET) {
    return msg.controller !== viewer ? { ...msg, code: 0 } : msg;
  }

  // All other messages: broadcast as-is (carry only publicly-visible info)
  return msg;
}

// ── Board state snapshot (used on reconnect) ──────────────────────────────────

const QUERY_FLAGS =
  OcgQueryFlags.CODE |
  OcgQueryFlags.POSITION |
  OcgQueryFlags.IS_PUBLIC |
  OcgQueryFlags.TYPE |
  OcgQueryFlags.ATTACK |
  OcgQueryFlags.DEFENSE |
  OcgQueryFlags.LEVEL;

const ZONE_DEFS = [
  { ctrl: 0, loc: OcgLocation.HAND,    name: 'p0_hand'    },
  { ctrl: 0, loc: OcgLocation.MZONE,   name: 'p0_mzone'   },
  { ctrl: 0, loc: OcgLocation.SZONE,   name: 'p0_szone'   },
  { ctrl: 0, loc: OcgLocation.GRAVE,   name: 'p0_grave'   },
  { ctrl: 0, loc: OcgLocation.REMOVED, name: 'p0_removed' },
  { ctrl: 0, loc: OcgLocation.EXTRA,   name: 'p0_extra'   },
  { ctrl: 1, loc: OcgLocation.HAND,    name: 'p1_hand'    },
  { ctrl: 1, loc: OcgLocation.MZONE,   name: 'p1_mzone'   },
  { ctrl: 1, loc: OcgLocation.SZONE,   name: 'p1_szone'   },
  { ctrl: 1, loc: OcgLocation.GRAVE,   name: 'p1_grave'   },
  { ctrl: 1, loc: OcgLocation.REMOVED, name: 'p1_removed' },
  { ctrl: 1, loc: OcgLocation.EXTRA,   name: 'p1_extra'   },
];

/**
 * Build a per-seat redacted snapshot of the current board state via duelQueryLocation.
 * Used when a client reconnects to restore their view without re-playing the stream.
 *
 * @param {object} lib    - ocgcore-wasm sync instance
 * @param {object} handle - Active duel handle
 * @param {0|1}    viewer - Seat requesting the state
 * @returns {object}      - { zones: Record<string, CardInfo[]> }
 */
export function buildBoardSnapshot(lib, handle, viewer) {
  const zones = {};

  for (const { ctrl, loc, name } of ZONE_DEFS) {
    let cards;
    try {
      cards = lib.duelQueryLocation(handle, {
        flags: QUERY_FLAGS,
        controller: ctrl,
        location: loc,
      });
    } catch {
      cards = [];
    }

    const isOpponentZone = ctrl !== viewer;
    // Locations where card identity is always hidden from opponent
    const alwaysHidden = (loc & (OcgLocation.HAND | OcgLocation.DECK)) !== 0;

    zones[name] = cards.map(card => {
      if (!card) return null;
      const needsRedact = isOpponentZone && (
        alwaysHidden ||
        isFaceDown(card.position) ||
        card.isPublic === false
      );
      return needsRedact ? { ...card, code: 0 } : card;
    });
  }

  return { zones };
}
