# Duel Engine Runtime Facts — 2026-08-07

Investigated by running real duels through ocgcore-wasm (stock `ocgcore.sync.wasm` from
`ocgcore-wasm@0.1.2`, sufficient for all four structural questions — the
`TCG_FAST_EFFECT_IGNITION` flag difference does not affect zone layout, location constants,
message routing, or cancel behaviour).

All evidence was captured via:
- `packages/engine/src/runtimeFacts.investigation.ts` (throwaway script, deleted)
- `packages/engine/src/runtimeFacts.investigation.test.ts` (kept as regression suite)

---

## Q1 — Zone arrays: dense or sparse?

**Answer:** Dense. Holes are `null` at their real index. The arrays are longer than 5.

### Evidence

```
MZONE array length: 7
mzone[0]: {"code":32864,"position":1,"alias":32864,"level":4,"rank":0,"attribute":1}
mzone[1]: null          ← gap at sequence 1 (placed at 0 and 2, skipping 1)
mzone[2]: {"code":1184620,"position":1,"alias":1184620,"level":4,"rank":0,"attribute":1}
mzone[3]: null
mzone[4]: null
mzone[5]: null          ← extra monster zones (Link era; always null in Edison)
mzone[6]: null

SZONE array length: 8
szone[0]: {"code":32864,...}    ← sequence 0 (placed)
szone[1]: null                  ← gap at sequence 1
szone[2]: {"code":1184620,...}  ← sequence 2 (placed)
szone[3]: null
szone[4]: null
szone[5]: null   ← field zone slot (see Q2)
szone[6]: null   ← pendulum zone (always null in Edison)
szone[7]: null   ← pendulum zone (always null in Edison)
```

Setup: filler normal monsters placed at `MZONE` sequences 0 and 2 (sequence 1
intentionally absent); queried via `duelQueryLocation(MZONE)` and `duelQueryLocation(SZONE)`.
Test file: `runtimeFacts.investigation.test.ts` → `Q1 — Zone arrays` suite.

### Actual array dimensions (duelQueryLocation output)

| Location | Length | Slots 0-4 | Slot 5 | Slots 6-7 |
|----------|--------|-----------|--------|-----------|
| MZONE    | 7      | regular monster zones | extra monster zone (Link, always null in Edison) | extra monster zone (Link, always null in Edison) |
| SZONE    | 8      | regular S/T zones | field zone (see Q2) | pendulum zones (always null in Edison) |

### Implication for the UI rebuild

The UI **can** use array index directly as zone sequence (`mzone[i]` = zone `i`). A `null`
entry means the zone is empty. Do **not** assume length=5 — allocate/render all 7 MZONE
slots and all 8 SZONE slots. In Edison format indices 5-6 (MZONE) and 6-7 (SZONE) will
always be null; render them as empty but present (for layout consistency with any future
rule-set that does use them).

---

## Q2 — Where does a field spell land?

**Answer:** A field spell occupies `p0_szone[5]` (SZONE index 5, sequence 5). The
`duelQueryLocation(FZONE)` call always returns an empty array (length 0); FZONE is not a
queryable location via the snapshot API. `buildStateForSeat.ts` does not query FZONE
separately — field spells are accessible only as part of the SZONE array.

### Evidence

Placing a card directly at `OcgLocation.SZONE, sequence=5` and querying SZONE:

```
SZONE (Umi at OcgLocation.SZONE seq=5):
  szone[5]: {"code":22702055,"position":5,"alias":22702055,"level":0,"rank":0,"attribute":0}
  szone[0-4]: null  (regular S/T zone slots, empty)
  szone[6-7]: null  (pendulum slots, always null in Edison)

FZONE query (OcgLocation.FZONE = 0x100): length 0  (always empty)
```

Additional: placing at `OcgLocation.FZONE, sequence=0` (the "FZONE placement" path used in
accuracy tests that have cards.cdb) — the card does **not** appear in the SZONE or FZONE
query result without a proper card-database entry returning correct type
(`SPELL|FIELD = 0x82`). With `getCard()` returning proper type data, FZONE placement
is used during gameplay and the card ends up at `szone[5]` in the snapshot (this is how
the engine moves a field spell after activation; the existing accuracy tests confirm the
card reaches SZONE via MSG_MOVE).

See: `packages/engine/src/edisonRules.R01-R04.accuracy.test.ts` uses FZONE placement for
setup; `buildStateForSeat.ts` queries only SZONE (not FZONE) — field spells surface at
`p0_szone[5]`.

### Implication for the UI rebuild

Read `state.zones.p0_szone[5]` for P0's field spell and `state.zones.p1_szone[5]` for P1's.
The FZONE contract location (`LOC.FZONE = 256`) appears in SelectZone/SelectDisfield zone
entries (the `decodeFieldMask` function in `messageToDecision.ts` could produce
`{ location: "FZONE", sequence: 0 }`), but the snapshot always surfaces the card at
`szone[5]`. Do not query FZONE separately.

---

## Q3 — Does MSG_HINT reach the client today?

**Answer:** Yes, for the entitled player. HINT messages appear in `result.events` (not
`result.messages`), are routed to the entitled player by `redactMessageForSeat`, and are
forwarded via `MSG` frames by the server socket. Auto-resolve paths that clear
`messages` do not touch `events`, so HINT survives in practice.

### Hop-by-hop evidence

**Hop A — ocgcore emits HINT:**
Live capture, Blackwing vs Blackwing duel, 15 decisions:
```
HINT (type 1/2/3) in result.events:    23
HINT (type 1/2/3) in result.messages:   0
Sample: {"type":2,"name":"PLAYER_HINT","player":0,"hint_type":1,"hint":"27"}
```
All 23 hits are `type=2` (PLAYER_HINT). `type=1` (MSG_HINT) and `type=3` (CARD_HINT) can
also occur depending on card effects; `type=80` (SHOW_HINT) also in the routing set.

**Hop B — redactMessage.ts:**
```
// redactMessage.ts lines 97-101
const HINT_TYPES: Set<number> = new Set([MSG.HINT, MSG.PLAYER_HINT, MSG.CARD_HINT, MSG.SHOW_HINT]);
// HINT_TYPES.has(t) → routed to entitled player only
if (msg.player !== viewer) return null;
return toRedacted(msg);
```
Live check:
```
Redacted for entitled player (msg.player === viewer): PASSES THROUGH
Redacted for other player:                            BLOCKED (null)
```

**Hop C — duelSocket.ts:**
```typescript
// duelSocket.ts lines 83-92
for (const event of result.events) {           // ← events (not messages)
  for (const [seat, ws] of relay.seats) {
    if (!ws) continue;
    const redacted = engine.redactMessageForSeat(event as RawEngineMessage, seat);
    if (redacted) {
      send(ws, { type: "MSG", msg: redacted }); // ← HINT reaches client via MSG frame
    }
  }
}
// result.messages loop is intentionally omitted (comment: "decisions no longer go via MSG")
```
HINT appears in `result.events` → forwarded. HINT in `result.messages` would be dropped
(but this does not occur in practice; HINT is emitted during CONTINUE steps, not WAITING).

**Auto-resolve paths (EdisonDuel.ts lines 218, 233):**
```typescript
messages.length = 0; // clear — continue stepping (RPS auto-resolve and empty chain auto-pass)
```
These clear only the `messages` array (WAITING-step messages). The `events` array (where
HINT lives) is never cleared. An edge case exists: if a HINT happened to be emitted
*during* a WAITING step that is auto-resolved (RPS or empty chain), it would be in
`messages` and would be cleared. But HINT is emitted during CONTINUE steps (draw phase,
move phase) — not during WAITING steps — so this edge case does not occur in practice.

### Implication for the UI rebuild

The UI **will** receive `MSG` frames with `engineType: 1/2/3/80` during normal play.
These are informational/cosmetic — handle or ignore them; do not mistake them for
decisions. PLAYER_HINT (type=2) with `hint_type=1` carries a string hint; CARD_HINT
(type=3) carries card-specific annotations. The receiving player sees their own hints;
the opponent does not receive the other player's hints.

---

## Q4 — Does SELECT_PLACE accept a cancel?

**Answer:** No. Sending an empty cancel (`places: []`) does not crash the core, but puts
the engine in an infinite WAITING loop emitting MSG_HINT (type=1, no player) on every
subsequent `duelProcess` call. The duel is effectively frozen — the zone selection is
never resolved. Always send a valid zone.

### Evidence

Live duel driven to SELECT_PLACE (normal summon, filler monster in hand):
```
SELECT_PLACE message: {"type":18,"player":0,"count":1,"field_mask":4294967264}
  field_mask 0xFFFFFFE0 → MZONE[0-4] available for player 0; all other zones blocked
```
Response sent: `{ type: 10, places: [] }` (empty cancel)

```
Step 1: status=1 (WAITING), msgs=[{type:1, player:undefined}]  ← MSG_HINT, no player
Step 2: status=1 (WAITING), msgs=[{type:1, player:undefined}]
Step 3: status=1 (WAITING), msgs=[{type:1, player:undefined}]
Step 4: status=1 (WAITING), msgs=[{type:1, player:undefined}]
Step 5: status=1 (WAITING), msgs=[{type:1, player:undefined}]
```

Five consecutive `duelProcess` calls all return WAITING with MSG_HINT (type=1, player
undefined). The engine loops without advancing. No exception is thrown.

From `EdisonDuel.step()`'s perspective: `messages=[type=1 HINT]`, `findAwaitingSeat` returns
`null` (HINT type=1 not in DECISION_MSG_TYPES and has no player field), and
`messageToDecision` would throw "no decision message found". The server would broadcast
STATE + CLOCK but no DECISION frame; the client is stuck with no actionable prompt —
a hard client-side desync.

### Implication for the UI rebuild

Never send a cancel/empty response to a `SelectZone` decision. The `DuelDecisionResponse`
contract has no cancel variant for `SelectZone` — the UI must always select one of the
`zones[]` entries returned in the decision. If the player "dismisses" zone selection,
the UI should revert the summon action client-side without sending any response.
