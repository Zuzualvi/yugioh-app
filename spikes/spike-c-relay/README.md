# Spike C — Two-Client Relay + Per-Seat Hidden-Info Redaction + Reconnect

**Status:** DONE  
**Covers:** REQ-NET-01/02, AC-12 (hidden info never leaks), AC-13 (reconnect)

---

## Why this exists

The ocgcore-wasm rules engine runs server-authoritative. Browser clients are thin
renderers that must receive a **per-seat redacted** view: hidden information
(opponent hand identities, deck contents, face-down cards) must **never** reach
an unentitled client. This spike proves the redaction layer on the engine's real
message stream and proves reconnect with seat integrity.

---

## Redaction model

### Two-layer approach

**Layer 1 — Routing**: Some engine messages are targeted at exactly one player.
These are dropped entirely for the non-entitled client.

| Category | Messages | Rule |
|---|---|---|
| Decision messages | SELECT_IDLECMD, SELECT_BATTLECMD, SELECT_CHAIN, SELECT_CARD, SELECT_EFFECTYN, SELECT_YESNO, SELECT_OPTION, SELECT_PLACE, SELECT_POSITION, SELECT_TRIBUTE, SORT_CHAIN, SORT_CARD, SELECT_COUNTER, SELECT_SUM, SELECT_DISFIELD, SELECT_UNSELECT_CARD, ROCK_PAPER_SCISSORS, ANNOUNCE_* | Send to `msg.player` only |
| Reveal messages | CONFIRM_DECKTOP, CONFIRM_CARDS, DECK_TOP, CONFIRM_EXTRATOP | Send to `msg.player` only |
| Hint messages | HINT, PLAYER_HINT, CARD_HINT, SHOW_HINT | Send to `msg.player` only (conservative) |
| Hand shuffle | SHUFFLE_HAND, SHUFFLE_SET_CARD | Send to `msg.player` only |

**Layer 2 — Stripping**: Broadcast messages that embed card identities (passcodes)
in fields that an unentitled viewer should not see. These are the **risky** cases.

---

### ⚠ Risky messages — manual code stripping required

These three messages carry hidden passcodes in their fields and **must** be
stripped before broadcasting to the non-owning player. A bug here is a direct
hidden-info leak:

| Message | Field stripped | Rule |
|---|---|---|
| **DRAW** (type 90) | `drawn[].code → 0` | Opponent sees count (array length) only, no identity |
| **MOVE** (type 50) | `card → 0` | Strip when moving opponent's card to: HAND, DECK, or face-down position |
| **SET** (type 54) | `code → 0` | Strip for non-owner (card set face-down on field) |

All other broadcast messages (SUMMONING, POS_CHANGE, CHAINING, DAMAGE, etc.)
carry only publicly-visible information (face-up cards, LP changes) and are safe
to send to both seats without modification.

---

### Hidden information definitions

| Hidden info | Mechanism |
|---|---|
| Opponent hand identity | DRAW: `drawn.code → 0` for non-drawer |
| Opponent deck order/contents | MOVE to DECK: `card → 0`; deck zone never sent in STATE |
| Opponent face-down monster | MOVE to MZONE with FD position: `card → 0`; SET: `code → 0` |
| Opponent face-down Spell/Trap | MOVE to SZONE with FD position: `card → 0`; SET: `code → 0` |

---

### Reveal lifecycle (C3)

1. Player-0 sets a monster face-down → **SET** event broadcast with `code=0` to player-1 (concealed)
2. Player-0 flip-summons the monster → **FLIPSUMMONING** event broadcast with real `code` to **both** seats (reveal)
3. Engine "confirm" reveals (CONFIRM_CARDS, CONFIRM_DECKTOP) route only to the entitled player

---

## Per-seat JSON message shapes

### Server → Client

```jsonc
// Seat assignment (on connect)
{ "type": "SEAT_ASSIGNED", "seat": 0, "token": "<uuid>" }

// Engine message (redacted per seat)
{
  "type": "MSG",
  "name": "DRAW",          // human-readable engine message name
  "engineType": 90,        // OcgMessageType numeric value
  "player": 0,
  "drawn": [
    { "code": 5464695, "position": 10 },   // own draw: real code
    { "code": 0,       "position": 10 }    // opponent draw: code zeroed
  ]
}

// Board state snapshot (on reconnect)
{
  "type": "STATE",
  "seat": 0,
  "duelEnded": false,
  "currentTurn": 0,
  "currentPhase": 4,
  "lp": [8000, 8000],
  "zones": {
    "p0_hand":    [{ "code": 5464695, "position": 10, ... }, ...],  // own hand: real codes
    "p1_hand":    [{ "code": 0, "position": 10, ... }, ...],        // opp hand: all code=0
    "p0_mzone":   [...],
    "p1_mzone":   [...],   // face-down cards: code=0
    "p0_szone":   [...],
    "p1_szone":   [...],   // face-down S/T: code=0
    "p0_grave":   [...],
    "p1_grave":   [...],   // grave is public: real codes
    "p0_removed": [...],
    "p1_removed": [...],
    "p0_extra":   [...],
    "p1_extra":   [...]    // extra deck: hidden (code=0) — opponent's XYZ/Fusion are not known
  }
}

// Duel ended
{ "type": "DUEL_END" }

// Error
{ "type": "ERROR", "message": "invalid token" }
```

### Client → Server

```jsonc
// (Reserved for future interactive play — not consumed in this spike)
{ "type": "RESPONSE", "data": { "type": 8, "index": null } }
```

---

## Reconnect / seat integrity

- Each seat has a **per-seat UUID token** assigned at server start
- Token is sent to the client in `SEAT_ASSIGNED`
- On reconnect: client presents `?token=<uuid>` → server matches to seat
- A **different token** (or no token) is rejected with `{ "type": "ERROR", "message": "invalid token" }`
- A **correct token** on a seat that is already occupied (live connection) is rejected with `"seat already occupied"`
- Reconnect sends a `STATE` snapshot of the current board, per-seat redacted

---

## Running the tests

```sh
cd spikes/spike-c-relay
node scripts/setup-vendor.js   # create vendor symlinks (once)
npm install
node src/test.js               # C1–C5 automated test
```

## Running the server standalone

```sh
PORT=7777 node src/server.js
# Prints seat tokens — connect two WS clients
```

---

## Future contracts note

This spike's message shapes feed `packages/contracts/` (WebSocket wire format).
Key decisions for the contracts package:
- `engineType` (numeric) + `name` (string) should both be in the wire envelope for type-safety
- `STATE.zones` naming convention: `p{controller}_{zoneName}` (e.g., `p0_hand`, `p1_mzone`)
- Hidden codes are `0` (not `null`) to preserve array structure (count is preserved)
- `drawn` array length = exact hand count drawn even when codes are zeroed

---

## Files

```
src/db.js         Card database reader (cards.cdb via better-sqlite3)
src/scripts.js    Lua script reader (ProjectIgnis/CardScripts)
src/harness.js    Duel engine lifecycle helpers + auto-responders
src/redactor.js   Per-seat redaction logic (the core of this spike)
src/server.js     WebSocket relay server
src/test.js       C1–C5 automated test suite
```
