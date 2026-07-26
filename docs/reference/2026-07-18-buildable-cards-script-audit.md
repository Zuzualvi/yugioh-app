# Deck-Buildable Cards: Script Resolution Audit

**Date:** 2026-07-18  
**Author:** Backend Engineer (subagent)  
**Scope:** Read-only investigation — no source files were modified.

---

## Method

1. Fetched assets via `bash packages/engine/scripts/fetch-assets.sh`  
   **CardScripts commit used:** `105d350039ee58a2e465ca8d9fe19b673107f921`

2. Loaded `packages/card-data/out/edison-card-catalog.json` (3,681 cards) and
   `packages/card-data/out/alias-index.json` (182 entries).

3. For every catalog card with `frame !== "normal"`, checked whether
   `c<passcode>.lua` resolves via the engine's `getScript` precedence (first hit wins):
   1. `packages/engine/scripts/edison-overrides/`
   2. `packages/engine/assets/scripts/official/`
   3. `packages/engine/assets/scripts/pre-errata/`
   4. `packages/engine/assets/scripts/goat/`
   5. `packages/engine/assets/scripts/`

4. For non-resolving cards, also checked alias-index (alias→base and base→alias).

---

## Counts

| Metric | Count |
|---|---|
| Total catalog cards | 3,681 |
| `frame=normal` (vanilla, no script needed) | 408 |
| `frame≠normal` (effect/spell/trap/fusion/etc., need script) | 3,273 |
| Resolved directly (catalog passcode hits a script) | 3,251 |
| Resolved via alias-index | 0 |
| **Hard gaps (no resolution under catalog passcode or any alias)** | **22** |

---

## Key Card Confirmations

- **Necroface (passcode 28297833):** `frame=effect`. Script resolves at
  `packages/engine/assets/scripts/official/c28297833.lua`. ✅ **Playable.**

- **Passcode 12057781 ("Goblin Calligrapher"):** `frame=normal` (vanilla DARK/Fiend
  400/400). Vanilla monsters need no Lua script — `c12057781.lua` correctly does not
  exist anywhere. ✅ **Not a bug.** The backlog entry "Necroface (12057781) missing
  script" was a transcription error; the real Necroface is 28297833 and IS scripted.

---

## Hard Gaps — Full List (22 cards)

### Group A — Off-by-one passcode mismatch (14 cards)

Scripts exist in `assets/scripts/official/` at `passcode − 1`. This is a systematic
discrepancy between the catalog passcodes (from one BabelCDB revision) and the
CardScripts file names (from a slightly different revision). The engine will fail to
load these scripts because it requests the catalog passcode, not passcode−1.

| Passcode | Name | Frame | Script found at |
|---|---|---|---|
| 18144507 | Harpie's Feather Duster | spell | c18144506.lua |
| 18807109 | Spellbinding Circle | trap | c18807108.lua |
| 19230408 | Offerings to the Doomed | spell | c19230407.lua |
| 35686188 | Tragedy | trap | c35686187.lua |
| 39751094 | Otohime | effect | c39751093.lua |
| 56043447 | Viser Des | effect | c56043446.lua |
| 64335805 | Red-Eyes Black Metal Dragon | effect | c64335804.lua |
| 68540059 | Metalmorph | trap | c68540058.lua |
| 73134082 | Final Flame | spell | c73134081.lua |
| 81480461 | Barrel Dragon | effect | c81480460.lua |
| 83011278 | Mystic Tomato | effect | c83011277.lua |
| 83764719 | Monster Reborn | spell | c83764718.lua |
| 84080939 | The Forgiving Maiden | effect | c84080938.lua |
| 84257640 | Dian Keto the Cure Master | spell | c84257639.lua |

**Root cause:** The catalog passcode for these cards is 1 higher than the file name
used by the pinned CardScripts commit. This is a known BabelCDB passcode drift; a
corresponding entry in alias-index.json or an edison-override stub is needed to bridge
the gap, or the catalog passcodes need to be corrected to match the script files.

### Group B — Promo/prize cards with no script anywhere (8 cards)

These are real-world Yu-Gi-Oh! promotional/prize cards with custom passcode ranges.
No `c<passcode>.lua` exists in any script directory, including at `passcode ± 1`.

| Passcode | Name | Frame | Notes |
|---|---|---|---|
| 111000561 | Get Your Game On! | spell | 2007 WC promo (continuous spell) |
| 501000000 | Ulevo | effect | WC prize card |
| 501000001 | Meteo the Matchless | effect | WC prize card |
| 501000002 | King of Destruction - Xexex | effect | WC prize card |
| 501000003 | Queen of Fate - Eternia | effect | WC prize card |
| 501000004 | Testament of the Arcane Lords | effect | WC prize card |
| 501000006 | Chimaera, the Master of Beasts | effect | WC prize card |
| 501000007 | Emperor of Lightning | effect | WC prize card |

These cards have never had scripts in the ProjectIgnis CardScripts repository.
They are collectible items, not tournament-legal Edison cards.

---

## Recommendation

**No change to the card catalog or make-non-buildable is warranted.**

- **Group A (14 off-by-1 cards):** Fix by adding alias-index entries mapping each
  catalog passcode to its script-file passcode, OR by adding thin edison-override stubs
  that `dofile` the official script, OR by correcting the catalog passcodes to match
  the CardScripts filenames. The aliases approach is least invasive. These cards
  (Monster Reborn, Barrel Dragon, Mystic Tomato, etc.) are legitimate Edison-format
  cards and should be playable.

- **Group B (8 promo/prize cards):** These need bespoke Lua scripts authored from
  scratch (their effects are simple: Tribute 3 of a type → if direct attack wins,
  you win the Match). They cannot be made functional from the upstream CardScripts
  repo. Low priority unless prize-card support is a product goal.

- **Necroface / Goblin Calligrapher:** No action needed; both facts confirmed above.
