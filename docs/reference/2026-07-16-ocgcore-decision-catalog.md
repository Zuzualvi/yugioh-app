# ocgcore Decision Catalog — Phase 0 Deliverable A

**Date:** 2026-07-16  
**Author:** Phase 0 agent  
**Status:** Empirical — captured from real ocgcore-wasm@custom (emcc 6.0.3) duel runs  
**Fixtures:** BLACKWING_DECK and JUNK_FROG_DECK from `packages/engine/src/testSupport/edisonDecks.ts`

---

## Purpose

This document is the ground truth for the `DuelDecision` / `DuelDecisionResponse` typed
contract (Phase 0). Every decision variant listed below was captured from a real ocgcore duel
driven with Edison-legal card combinations. No shapes are invented. Decisions not reproducible
with the two fixture decks are explicitly listed at the end.

---

## 1. Raw OcgMessage / OcgResponse Type Extract

Verbatim from `node_modules/ocgcore-wasm/dist/index.d.ts` (version pinned in engine
`package.json` as `ocgcore-wasm@^0.1.2`, built with custom emcc 6.0.3):

### Decision message types (require OcgResponse after WAITING)

```typescript
// OcgMessageType enum (decision-relevant members only):
enum OcgMessageType {
  SELECT_BATTLECMD      = 10,
  SELECT_IDLECMD        = 11,
  SELECT_EFFECTYN       = 12,
  SELECT_YESNO          = 13,
  SELECT_OPTION         = 14,
  SELECT_CARD           = 15,
  SELECT_CHAIN          = 16,
  SELECT_PLACE          = 18,
  SELECT_POSITION       = 19,
  SELECT_TRIBUTE        = 20,
  SORT_CHAIN            = 21,
  SELECT_COUNTER        = 22,
  SELECT_SUM            = 23,
  SELECT_DISFIELD       = 24,
  SORT_CARD             = 25,
  SELECT_UNSELECT_CARD  = 26,
  ROCK_PAPER_SCISSORS   = 132,
  ANNOUNCE_RACE         = 140,
  ANNOUNCE_ATTRIB       = 141,
  ANNOUNCE_CARD         = 142,
  ANNOUNCE_NUMBER       = 143,
}
```

### OcgResponse union (all response variants)

```typescript
type OcgResponse =
  | OcgResponseSelectBattleCMD
  | OcgResponseSelectIdleCMD
  | OcgResponseSelectEffectYN
  | OcgResponseSelectYesNo
  | OcgResponseSelectOption
  | OcgResponseSelectCard
  | OcgResponseSelectCardCodes
  | OcgResponseSelectUnselectCard
  | OcgResponseSelectChain
  | OcgResponseSelectDisfield
  | OcgResponseSelectPlace
  | OcgResponseSelectPosition
  | OcgResponseSelectCounter
  | OcgResponseSelectSum
  | OcgResponseSelectTribute
  | OcgResponseSortCard
  | OcgResponseAnnounceRace
  | OcgResponseAnnounceAttrib
  | OcgResponseAnnounceCard
  | OcgResponseAnnounceNumber
  | OcgResponseRockPaperScissors;

enum OcgResponseType {
  SELECT_BATTLECMD     = 0,
  SELECT_IDLECMD       = 1,
  SELECT_EFFECTYN      = 2,
  SELECT_YESNO         = 3,
  SELECT_OPTION        = 4,
  SELECT_CARD          = 5,
  SELECT_CARD_CODES    = 6,
  SELECT_UNSELECT_CARD = 7,
  SELECT_CHAIN         = 8,
  SELECT_DISFIELD      = 9,
  SELECT_PLACE         = 10,
  SELECT_POSITION      = 11,
  SELECT_TRIBUTE       = 12,
  SELECT_COUNTER       = 13,
  SELECT_SUM           = 14,
  SORT_CARD            = 15,
  ANNOUNCE_RACE        = 16,
  ANNOUNCE_ATTRIB      = 17,
  ANNOUNCE_CARD        = 18,
  ANNOUNCE_NUMBER      = 19,
  ROCK_PAPER_SCISSORS  = 20,
}
```

---

## 2. Decision Catalog (captured from real engine runs)

For each type: numeric type, message interface, real captured example, hidden-info fields,
required OcgResponse, and a real response example.

---

### 2.1 SELECT_IDLECMD — type 11

**When emitted:** Every main phase action opportunity (turn player only).

**OcgMessage interface:**
```typescript
interface OcgMessageSelectIdlecmd {
  type: 11;
  player: number;                       // turn player
  summons: OcgCardLoc[];               // normal-summonable monsters in hand
  special_summons: OcgCardLoc[];       // special-summonable monsters
  pos_changes: OcgCardLoc[];           // monsters that can change position
  monster_sets: OcgCardLoc[];          // monsters that can be set
  spell_sets: OcgCardLoc[];            // spell/traps that can be set
  activates: OcgCardLocActive[];       // activatable cards (includes description/client_mode)
  to_bp: boolean;                       // can go to battle phase
  to_ep: boolean;                       // can go to end phase
  shuffle: boolean;                     // can manually shuffle (rare)
}
```

**Real captured example:**
```json
{
  "type": 11,
  "player": 0,
  "summons": [
    { "code": 2118022, "controller": 0, "location": 2, "sequence": 0 },
    { "code": 1784619, "controller": 0, "location": 2, "sequence": 1 }
  ],
  "special_summons": [],
  "pos_changes": [],
  "monster_sets": [
    { "code": 2118022, "controller": 0, "location": 2, "sequence": 0 }
  ],
  "spell_sets": [],
  "activates": [],
  "to_bp": false,
  "to_ep": true,
  "shuffle": true
}
```

**Hidden info:** All `code` fields in `summons`, `special_summons`, `monster_sets`, `pos_changes`,
`spell_sets`, `activates` are visible to the turn player only (all cards in player's hand are
visible to themselves). No redaction needed for the turn player; this message is per-seat anyway.

**OcgResponse:** `OcgResponseSelectIdleCMD`
```typescript
type OcgResponseSelectIdleCMD = {
  type: OcgResponseType.SELECT_IDLECMD; // = 1
  action: SelectIdleCMDAction;
  index: number | null;
};
enum SelectIdleCMDAction {
  SELECT_SUMMON         = 0,
  SELECT_SPECIAL_SUMMON = 1,
  SELECT_POS_CHANGE     = 2,
  SELECT_MONSTER_SET    = 3,
  SELECT_SPELL_SET      = 4,
  SELECT_ACTIVATE       = 5,
  TO_BP                 = 6,
  TO_EP                 = 7,
  SHUFFLE               = 8,
}
```

**Real response example (end phase):**
```json
{ "type": 1, "action": 7, "index": null }
```

---

### 2.2 SELECT_BATTLECMD — type 10

**When emitted:** Battle phase action opportunity (turn player only).

**OcgMessage interface:**
```typescript
interface OcgMessageSelectBattleCMD {
  type: 10;
  player: number;
  chains: OcgCardLocActive[];   // cards activatable in BP (spell speed ≥ 2)
  attacks: OcgCardLocAttack[];  // monsters that can attack (includes can_direct)
  to_m2: boolean;               // can go to main phase 2
  to_ep: boolean;               // can go to end phase
}
```

**Real captured example:**
```json
{
  "type": 10,
  "player": 1,
  "chains": [],
  "attacks": [
    {
      "code": 1184620,
      "controller": 1,
      "location": 4,
      "sequence": 0,
      "can_direct": false
    }
  ],
  "to_m2": true,
  "to_ep": true
}
```

**Hidden info:** `attacks[*].code` is visible to both players (monsters on field are public).
`chains[*].code` is public (activatable cards are face-up on field). No redaction needed.

**OcgResponse:** `OcgResponseSelectBattleCMD`
```typescript
type OcgResponseSelectBattleCMD = {
  type: OcgResponseType.SELECT_BATTLECMD; // = 0
  action: SelectBattleCMDAction;
  index: number | null;
};
enum SelectBattleCMDAction {
  SELECT_CHAIN  = 0,  // index into chains[]
  SELECT_BATTLE = 1,  // index into attacks[]
  TO_M2         = 2,
  TO_EP         = 3,
}
```

**Real response example (attack with attacks[0]):**
```json
{ "type": 0, "action": 1, "index": 0 }
```

---

### 2.3 SELECT_EFFECTYN — type 12

**When emitted:** A card's optional trigger effect has the opportunity to activate. The player
decides yes or no. Fires at effect timing (e.g., Treeborn Frog at standby phase).

**OcgMessage interface:**
```typescript
interface OcgMessageSelectEffectYN {
  type: 12;
  player: number;
  code: number;           // passcode of the card with the optional effect
  controller: 0 | 1;
  location: OcgLocation;
  sequence: number;
  position: OcgPosition;
  overlay_sequence?: number;
  description: bigint;    // effect description ID
}
```

**Real captured example (Treeborn Frog standby revival):**
```json
{
  "type": 12,
  "player": 0,
  "code": 12538374,
  "controller": 0,
  "location": 16,
  "sequence": 0,
  "position": 5,
  "description": "0n"
}
```

**Hidden info:** `code` is visible because this is the player's own card in GY (public zone).
Cards in GY are always public. No hidden info here.

**OcgResponse:** `OcgResponseSelectEffectYN`
```typescript
type OcgResponseSelectEffectYN = {
  type: OcgResponseType.SELECT_EFFECTYN; // = 2
  yes: boolean;
};
```

**Real response example (decline):**
```json
{ "type": 2, "yes": false }
```

---

### 2.4 SELECT_YESNO — type 13

**When emitted:** A general yes/no decision during effect resolution. Fires inside effect
execution (e.g., Ryko, Lightsworn Hunter asking "do you want to destroy a card?").

**OcgMessage interface:**
```typescript
interface OcgMessageSelectYesno {
  type: 13;
  player: number;
  description: bigint;   // string ID describing what the yes/no is for
}
```

**Real captured example (Ryko's destroy effect during flip resolution):**
```json
{
  "type": 13,
  "player": 0,
  "description": "22547315818497n"
}
```

**Hidden info:** No card-specific data exposed. `description` is a string ID (not a code).
No hidden info to redact.

**OcgResponse:** `OcgResponseSelectYesNo`
```typescript
type OcgResponseSelectYesNo = {
  type: OcgResponseType.SELECT_YESNO; // = 3
  yes: boolean;
};
```

**Real response example (yes):**
```json
{ "type": 3, "yes": true }
```

---

### 2.5 SELECT_OPTION — type 14

**When emitted:** A card has multiple distinct effects and the player must choose which
one to apply. Fires after activation. Options are effect description IDs (bigint), not
human-readable strings.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectOption {
  type: 14;
  player: number;
  options: bigint[];   // effect description IDs for each choice
}
```

**Real captured example (Enemy Controller — choose position-change vs. tribute-control):**
```json
{
  "type": 14,
  "player": 0,
  "options": [
    "102807698931713n",
    "102807698931714n"
  ]
}
```

**Hidden info:** `options` contains description IDs only (no card codes). No hidden info.
The description IDs must be translated to human-readable text via the card text database.

**OcgResponse:** `OcgResponseSelectOption`
```typescript
type OcgResponseSelectOption = {
  type: OcgResponseType.SELECT_OPTION; // = 4
  index: number;   // 0-based index into options[]
};
```

**Real response example (choose option 0):**
```json
{ "type": 4, "index": 0 }
```

---

### 2.6 SELECT_CARD — type 15

**When emitted:** Player must select between 1 and max cards from a presented list.
Used for targeting effects, hand discard, deck searches, etc.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectCard {
  type: 15;
  player: number;
  can_cancel: boolean;
  min: number;
  max: number;
  selects: OcgCardLocPos[];   // each entry has code, controller, location, sequence, position
}
```

**Real captured example (SELECT_CARD for battle target):**
```json
{
  "type": 15,
  "player": 1,
  "can_cancel": true,
  "min": 1,
  "max": 1,
  "selects": [
    {
      "code": 32864,
      "controller": 0,
      "location": 4,
      "sequence": 0,
      "position": 5
    }
  ]
}
```

**Hidden info:** `selects[*].code` is hidden for face-down cards (location=1 DECK top,
or facedown in MZONE/SZONE). Face-down cards must be redacted: `code = 0`. Face-up field
cards, hand cards visible to owner, GY cards are public.

**OcgResponse:** `OcgResponseSelectCard`
```typescript
type OcgResponseSelectCard = {
  type: OcgResponseType.SELECT_CARD; // = 5
  indicies: number[] | null;   // 0-based indices into selects[], null = cancel
};
```

**Real response example (select index 0):**
```json
{ "type": 5, "indicies": [0] }
```

---

### 2.7 SELECT_CHAIN — type 16

**When emitted:** Chain priority window — player may optionally add a card to the chain.
Emitted even when no chain candidates exist (empty `selects`, to pass priority).

**OcgMessage interface:**
```typescript
interface OcgMessageSelectChain {
  type: 16;
  player: number;
  spe_count: number;            // special count (for SEGOC)
  forced: boolean;              // true → must chain something (non-optional)
  hint_timing: OcgHintTiming;
  hint_timing_other: OcgHintTiming;
  selects: OcgCardLocPosActive[];  // chainable cards (empty if none available)
}
```

**Real captured example (empty chain window, non-forced):**
```json
{
  "type": 16,
  "player": 0,
  "spe_count": 0,
  "forced": false,
  "hint_timing": 2162688,
  "hint_timing_other": 2162688,
  "selects": []
}
```

**Hidden info:** `selects[*].code` is the activating card. If the card is face-down
(trap set mid-chain, rare), it should be redacted. For hand activations (e.g., quick-play
spells, traps from hand), the code is public at chain time. Cards in `selects` are
typically visible (they're being activated), so minimal redaction needed in practice.

**OcgResponse:** `OcgResponseSelectChain`
```typescript
type OcgResponseSelectChain = {
  type: OcgResponseType.SELECT_CHAIN; // = 8
  index: number | null;  // null = pass (decline to chain); otherwise index into selects[]
};
```

**Real response example (pass chain):**
```json
{ "type": 8, "index": null }
```

---

### 2.8 SELECT_PLACE — type 18

**When emitted:** Player must choose a zone on the field to place a card (monster zone
or spell/trap zone). `field_mask` encodes occupied/forbidden zones.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectPlace {
  type: 18;
  player: number;
  count: number;        // number of places to select (usually 1)
  field_mask: number;   // bitmask: 1 = unavailable; layout per player × 16:
                        //   bits 0-4  → MZONE positions 0-4 for player's side
                        //   bits 8-12 → SZONE positions 0-4 for player's side
                        //   upper 16 bits → opponent's zones (same layout)
}
```

**Real captured example (normal summon — MZONE only available):**
```json
{
  "type": 18,
  "player": 0,
  "count": 1,
  "field_mask": 4294967264
}
```

**Field mask decoding:** For player P, shift right by P×16, take lower 16 bits.
Bit N=0 → MZONE[N] available (N=0..4); bit N+8=0 → SZONE[N] available.

**Hidden info:** None — zone availability is public information.

**OcgResponse:** `OcgResponseSelectPlace`
```typescript
type SelectFieldPlace = { player: number; location: OcgLocation; sequence: number; };
type OcgResponseSelectPlace = {
  type: OcgResponseType.SELECT_PLACE; // = 10
  places: SelectFieldPlace[];
};
```

**Real response example (place in MZONE seq 0):**
```json
{ "type": 10, "places": [{ "player": 0, "location": 4, "sequence": 0 }] }
```

---

### 2.9 SELECT_POSITION — type 19

**When emitted:** Player must choose a battle position (attack/defense, face-up/face-down)
from a bitmask of allowed positions.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectPosition {
  type: 19;
  player: number;
  code: number;           // passcode of the card being positioned
  positions: OcgPosition; // bitmask of allowed positions (e.g., FACEUP=5 means ATK or DEF)
}
```

**Real captured example (Junk Warrior synchro — choose ATK or DEF):**
```json
{
  "type": 19,
  "player": 0,
  "code": 60800381,
  "positions": 5
}
```

**`positions` bitmask:**
- 1 = FACEUP_ATTACK
- 2 = FACEDOWN_ATTACK
- 4 = FACEUP_DEFENSE
- 8 = FACEDOWN_DEFENSE
- 5 = FACEUP (ATK or DEF)
- 10 = FACEDOWN

**Hidden info:** `code` is the synchro/special summoned monster — public information.

**OcgResponse:** `OcgResponseSelectPosition`
```typescript
type OcgResponseSelectPosition = {
  type: OcgResponseType.SELECT_POSITION; // = 11
  position: OcgPosition;  // one of the valid positions from the bitmask
};
```

**Real response example (choose FACEUP_ATTACK = 1, lowest bit of positions=5):**
```json
{ "type": 11, "position": 1 }
```

---

### 2.10 SELECT_TRIBUTE — type 20

**When emitted:** Player must choose monsters to tribute for a tribute summon (or effect
requiring tribute). `release_param` on each entry indicates tribute requirement.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectTribute {
  type: 20;
  player: number;
  can_cancel: boolean;
  min: number;
  max: number;
  selects: OcgCardLocTribute[];   // each: code, controller, location, sequence, release_param
}
```

**Real captured example (Caius the Shadow Monarch, 1 tribute needed):**
```json
{
  "type": 20,
  "player": 0,
  "can_cancel": true,
  "min": 1,
  "max": 1,
  "selects": [
    {
      "code": 32864,
      "controller": 0,
      "location": 4,
      "sequence": 0,
      "release_param": 1
    }
  ]
}
```

**Hidden info:** `selects[*].code` — monsters in MZONE are public (face-up).
Face-down monsters (set position) have `code=0` in the OcgCardLocTribute.
Generally no redaction needed for face-up tributes.

**OcgResponse:** `OcgResponseSelectTribute`
```typescript
type OcgResponseSelectTribute = {
  type: OcgResponseType.SELECT_TRIBUTE; // = 12
  indicies: number[] | null;  // indices into selects[]; null = cancel
};
```

**Real response example (tribute selects[0]):**
```json
{ "type": 12, "indicies": [0] }
```

---

### 2.11 SELECT_UNSELECT_CARD — type 26

**When emitted:** Interactive card toggling — player selects/unselects cards one at a time
until the selection condition is satisfied. Used for Synchro material selection and some
effect targets where individual confirms are needed.

**OcgMessage interface:**
```typescript
interface OcgMessageSelectUnselectCard {
  type: 26;
  player: number;
  can_finish: boolean;
  can_cancel: boolean;
  min: number;
  max: number;
  select_cards: OcgCardLocPos[];    // cards available to select
  unselect_cards: OcgCardLocPos[];  // currently selected cards that can be deselected
}
```

**Real captured example (Synchro material: pick Junk Synchron from MZONE):**
```json
{
  "type": 26,
  "player": 0,
  "can_finish": false,
  "can_cancel": true,
  "min": 1,
  "max": 1,
  "select_cards": [
    {
      "code": 63977008,
      "controller": 0,
      "location": 4,
      "sequence": 0,
      "position": 5
    }
  ],
  "unselect_cards": []
}
```

**Hidden info:** `select_cards[*].code` — field monsters are public. Same redaction rules
as SELECT_CARD (face-down = code 0).

**OcgResponse:** `OcgResponseSelectUnselectCard`
```typescript
type OcgResponseSelectUnselectCard = {
  type: OcgResponseType.SELECT_UNSELECT_CARD; // = 7
  index: number | null;
  // null = finish (if can_finish) or cancel (if can_cancel)
  // 0..(select_cards.length-1) = select that card
  // select_cards.length.. = unselect from unselect_cards at (index - select_cards.length)
};
```

**Real response example (select select_cards[0]):**
```json
{ "type": 7, "index": 0 }
```

---

### 2.12 ANNOUNCE_RACE — type 140

**When emitted:** Player must declare a monster race (type). Used by cards like
"DNA Surgery" (Continuous Trap that changes all monsters to a declared type).

**OcgMessage interface:**
```typescript
interface OcgMessageAnnounceRace {
  type: 140;
  player: number;
  count: number;           // how many races to announce (usually 1)
  available: OcgRace;      // bitmask of selectable races (bigint)
}
```

**Real captured example (DNA Surgery — choose 1 race from all):**
```json
{
  "type": 140,
  "player": 0,
  "count": 1,
  "available": "67108863n"
}
```

**`available` decoding:** Each bit corresponds to an `OcgRace` value (bigint bitmask).
`67108863 = 0x3FFFFFF` = all Edison-era races. OcgRace: WARRIOR=1n, SPELLCASTER=2n,
FAIRY=4n, FIEND=8n, ZOMBIE=16n, MACHINE=32n, AQUA=64n, PYRO=128n, ROCK=256n,
WINGEDBEAST=512n, PLANT=1024n, INSECT=2048n, THUNDER=4096n, DRAGON=8192n,
BEAST=16384n, BEASTWARRIOR=32768n, DINOSAUR=65536n, FISH=131072n, etc.

**Hidden info:** None — announce prompts expose no hidden card information.

**OcgResponse:** `OcgResponseAnnounceRace`
```typescript
type OcgResponseAnnounceRace = {
  type: OcgResponseType.ANNOUNCE_RACE; // = 16
  races: OcgRace[];  // array of `count` selected race bigints
};
```

**Real response example (declare Warrior):**
```json
{ "type": 16, "races": ["1n"] }
```

---

### 2.13 ANNOUNCE_ATTRIB — type 141

**When emitted:** Player must declare a monster attribute. Used by cards like
"Abyssal Designator" or "Gozen Match".

**OcgMessage interface:**
```typescript
interface OcgMessageAnnounceAttrib {
  type: 141;
  player: number;
  count: number;          // how many attributes to declare (usually 1)
  available: OcgAttribute; // bitmask of valid attributes (number)
}
```

**Real captured example (Abyssal Designator — declare 1 attribute):**
```json
{
  "type": 141,
  "player": 0,
  "count": 1,
  "available": 127
}
```

**`available` decoding:** OcgAttribute bitmask: EARTH=1, WATER=2, FIRE=4, WIND=8,
LIGHT=16, DARK=32, DIVINE=64. 127 = all attributes.

**Hidden info:** None.

**OcgResponse:** `OcgResponseAnnounceAttrib`
```typescript
type OcgResponseAnnounceAttrib = {
  type: OcgResponseType.ANNOUNCE_ATTRIB; // = 17
  attributes: OcgAttribute[];  // array of `count` selected attributes (numbers)
};
```

**Real response example (declare Earth):**
```json
{ "type": 17, "attributes": [1] }
```

---

### 2.14 ANNOUNCE_CARD — type 142

**When emitted:** Player must name a specific card (by passcode). Used by "D.D. Designator"
(remove a named card from opponent's hand) and "Prohibition" (restrict a named card's use).
The `opcodes` field is a stack-based bytecode that filters which cards are valid nominees.

**OcgMessage interface:**
```typescript
interface OcgMessageAnnounceCard {
  type: 142;
  player: number;
  opcodes: OcgOpCode[];  // filter bytecode; any card matching this is a valid announcement
}
```

**Real captured example (D.D. Designator — name any card):**
```json
{
  "type": 142,
  "player": 0,
  "opcodes": [
    "75505728n",
    "4611687126528950272n",
    "4611686048492158976n"
  ]
}
```

**`opcodes` stack machine:** Values that are not OcgOpCode enum members are pushed as literals
onto the stack. Enum members operate on the stack. Client must evaluate to determine which
cards are valid. For "name any card," the result is typically `true` for all cards.

**Hidden info:** None — the player is naming a card; no deck/hand information leaked.

**OcgResponse:** `OcgResponseAnnounceCard`
```typescript
type OcgResponseAnnounceCard = {
  type: OcgResponseType.ANNOUNCE_CARD; // = 18
  card: number;  // passcode of the declared card
};
```

**Real response example (declare card 32864):**
```json
{ "type": 18, "card": 32864 }
```

---

### 2.15 ANNOUNCE_NUMBER — type 143

**When emitted:** Player must declare a numeric value from a presented list. Used by
"Wall of Revealing Light" (declare ATK threshold in multiples of 1000 LP paid).

**OcgMessage interface:**
```typescript
interface OcgMessageAnnounceNumber {
  type: 143;
  player: number;
  options: bigint[];   // the valid numeric choices
}
```

**Real captured example (Wall of Revealing Light — choose LP cost multiple):**
```json
{
  "type": 143,
  "player": 0,
  "options": [
    "1000n", "2000n", "3000n", "4000n",
    "5000n", "6000n", "7000n", "8000n"
  ]
}
```

**Hidden info:** None.

**OcgResponse:** `OcgResponseAnnounceNumber`
```typescript
type OcgResponseAnnounceNumber = {
  type: OcgResponseType.ANNOUNCE_NUMBER; // = 19
  value: number;  // 0-based index into options[]
};
```

**Real response example (select options[0] = 1000):**
```json
{ "type": 19, "value": 0 }
```

---

## 3. Not Reproducible with Edison Fixtures

The following decision types appear in the `OcgMessageType` enum but could NOT be triggered
with the BLACKWING_DECK or JUNK_FROG_DECK (or any standard Edison card combinations), confirmed
by exhaustive search of all card scripts in `assets/scripts/official/`:

| Type | Num | Reason not reproducible |
|------|-----|-------------------------|
| `ROCK_PAPER_SCISSORS` | 132 | The engine **auto-resolves** opening hand selection without emitting a WAITING step in standard Edison mode. Type 132 message is defined in the enum but never observed in any duel run, regardless of deck or seed. Not a player input in this WASM build. |
| `SORT_CHAIN` | 21 | No Edison-era card script calls `Duel.SortChain()`. Appears for simultaneous triggers with same priority — cannot construct such a scenario with the Edison card pool. |
| `SELECT_COUNTER` | 22 | No Edison-era card script calls `Duel.SelectCounter()`. Counter-selection would require counter-placing cards (e.g., "Spell Reactor") that aren't in the Edison pool. |
| `SELECT_SUM` | 23 | No Edison-era card script calls `Duel.SelectSum()`. Synchro material selection uses `SELECT_UNSELECT_CARD` (type 26) in this engine version. |
| `SELECT_DISFIELD` | 24 | No Edison-era card script calls `Duel.SelectDisField()`. This appears for "disable a zone" mechanics (e.g., "Full House", released 2011 — post-Edison). |
| `SORT_CARD` | 25 | No Edison-era card script calls `Duel.SortCard()`. Card-sorting interactions don't appear in pre-2011 mechanics. |

---

## 4. Proposed DuelDecision / DuelDecisionResponse Variant List

Based on the empirical catalog above, the following variant list is proposed for CTO review.
**Do not implement until CTO signs off.**

### DuelDecision variants (kind → fields)

| kind | Fields | Notes |
|------|--------|-------|
| `IdleCommand` | `summons: CardEntry[]`, `specialSummons: CardEntry[]`, `posChanges: CardEntry[]`, `monsterSets: CardEntry[]`, `spellSets: CardEntry[]`, `activates: ActiveCardEntry[]`, `toBattlePhase: boolean`, `toEndPhase: boolean` | All card arrays are render-ready (code+name); empty arrays if inapplicable |
| `BattleCommand` | `chains: ActiveCardEntry[]`, `attacks: AttackEntry[]`, `toMainPhase2: boolean`, `toEndPhase: boolean` | `can_direct` from engine → `canDirectAttack` on AttackEntry |
| `ChainPrompt` | `forced: boolean`, `selects: ActiveCardEntry[]`, `hintTiming: number` | `forced=false, selects=[]` = pass-only window; still emitted |
| `SelectEffectYN` | `card: CardEntry`, `location: number`, `description: string` | `description` from hint text lookup; card is the triggering card |
| `SelectYesNo` | `description: string` | description from hint text lookup; no card code |
| `SelectOption` | `options: string[]` | description IDs resolved to display strings via card text DB |
| `SelectCard` | `cards: CardEntry[]`, `min: number`, `max: number`, `cancelable: boolean` | Hidden face-down cards: `code=0, name=""` |
| `SelectTribute` | `cards: CardEntry[]`, `min: number`, `max: number`, `cancelable: boolean` | Same redaction for face-down |
| `SelectZone` | `count: number`, `fieldMask: number` | fieldMask passed through; UI derives available zones |
| `SelectPosition` | `card: CardEntry`, `positions: number` | `positions` is OcgPosition bitmask |
| `SelectUnselectCard` | `selectCards: CardEntry[]`, `unselectCards: CardEntry[]`, `min: number`, `max: number`, `canFinish: boolean`, `cancelable: boolean` | |
| `AnnounceRace` | `count: number`, `available: number` | `available` is OcgRace bitmask (bigint→number safe for Edison races) |
| `AnnounceAttrib` | `count: number`, `available: number` | `available` is OcgAttribute bitmask (all fit in number) |
| `AnnounceCard` | `opcodes: string[]` | opcodes as bigint-serialized strings; client uses opcode evaluator |
| `AnnounceNumber` | `options: number[]` | options as number array (LP multiples fit in JS number) |
| `RockPaperScissors` | _(none)_ | Included for completeness per CEO mandate; engine auto-resolves in practice — emit as no-op prompt if observed |
| `SortCard` | `cards: CardEntry[]` | Not reproducible; schema stub only |
| `SelectSum` | `amount: number`, `must: SumEntry[]`, `optional: SumEntry[]`, `min: number`, `max: number` | Not reproducible; schema stub only |
| `SelectCounter` | `counterType: number`, `count: number`, `cards: CounterEntry[]` | Not reproducible; schema stub only |
| `SelectDisfield` | `count: number`, `fieldMask: number` | Not reproducible; schema stub only |

### DuelDecisionResponse variants (kind → fields)

Each response `kind` matches its decision `kind`. Selections use 0-based indices into the
decision's candidate arrays.

| kind | Response fields |
|------|-----------------|
| `IdleCommand` | `action: "summon"\|"specialSummon"\|"posChange"\|"monsterSet"\|"spellSet"\|"activate"\|"toBP"\|"toEP"\|"shuffle"`, `index: number\|null` |
| `BattleCommand` | `action: "chain"\|"attack"\|"toM2"\|"toEP"`, `index: number\|null` |
| `ChainPrompt` | `index: number\|null` (null=pass) |
| `SelectEffectYN` | `yes: boolean` |
| `SelectYesNo` | `yes: boolean` |
| `SelectOption` | `index: number` |
| `SelectCard` | `indices: number[]\|null` (null=cancel) |
| `SelectTribute` | `indices: number[]\|null` |
| `SelectZone` | `places: {location: number, sequence: number}[]` |
| `SelectPosition` | `position: number` (OcgPosition value) |
| `SelectUnselectCard` | `index: number\|null` (null=finish/cancel) |
| `AnnounceRace` | `races: number[]` |
| `AnnounceAttrib` | `attributes: number[]` |
| `AnnounceCard` | `code: number` |
| `AnnounceNumber` | `valueIndex: number` (0-based index into options[]) |
| `RockPaperScissors` | `value: 1\|2\|3` (scissors=1, rock=2, paper=3) |
| `SortCard` | `order: number[]\|null` |
| `SelectSum` | `indices: number[]` |
| `SelectCounter` | `counters: number[]` |
| `SelectDisfield` | `places: {location: number, sequence: number}[]` |

---

## 5. Deck Fixture Substitutions

The following substitutions were made in `JUNK_FROG_DECK` relative to the canonical
edisonformat.net Junk Frog structure list:

| Card | Reason | Substitution |
|------|--------|-------------|
| Glow-Up Bulb (38614541) | Not in Edison catalog (released post-Sept 2010) | Beelze Frog (49522489) |
| Ronintoadin (610461) | Not in Edison catalog | Removed; Substitoad fills similar GY-recursion role |
| Formula Synchron | Not in Edison catalog (released Jan 2011) | Turbo Warrior (46195773) |
| T.G. Hyper Librarian | Not in Edison catalog (released Aug 2011) | Junk Archer (42810973) |
| Raiza the Storm Monarch | Omitted for count | Counts work at 40 without it |

---

## 6. Additional engine observations

- **ROCK_PAPER_SCISSORS (type 132):** Defined in `OcgMessageType` enum, handled in
  `createDuelWithState.ts` defaultRespond, but **never emitted as WAITING** in any
  standard Edison duel run regardless of deck, seed, or flag combination tested.
  The engine auto-resolves opening hand / first-player determination internally.
  The `OcgResponseRockPaperScissors { type: 20; value: 1|2|3 }` exists but is
  unreachable in standard mode. Include in contract as a stub.

- **SELECT_CHAIN with `selects=[]`:** Fires constantly at every chain window even when
  there are no chainable cards. `forced=false, selects=[]` means "pass priority."
  This is the most frequent WAITING message in any duel.

- **SELECT_UNSELECT_CARD vs SELECT_SUM for Synchro:** In this ocgcore build, Synchro
  material selection uses `SELECT_UNSELECT_CARD` (type 26) iteratively (one card per
  confirmation), not `SELECT_SUM` (type 23). This may differ in other builds or formats.

- **OcgResponseSelectCard uses `indicies` (sic):** The field name is intentionally
  misspelled in the ocgcore-wasm API. Use `indicies`, not `indices`.
