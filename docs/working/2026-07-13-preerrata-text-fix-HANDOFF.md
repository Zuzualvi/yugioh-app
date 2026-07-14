# Engineering Handoff — Edison Deck Builder: Pre-Errata Card Text Fix

**Date:** 2026-07-13
**Author:** Product Lead
**Status:** Ready to build. CEO-confirmed direction. Owner: CTO/engineering.
**Trigger:** CEO spot-check found Goyo Guardian displaying its *post-Edison* errata text ("1 EARTH Tuner…").

---

## Problem & users

The deck builder is live at app.zuhayr.io for an Edison-format (March 2010) player group. The card catalog was built by filtering the **modern YGOPRODeck dump** and copying its card text verbatim (`packages/card-data/scripts/build-catalog.mjs:257` — `desc: raw.desc`). So every card displays **today's** errata text, not its March-2010 text.

For most cards this is harmless (only cosmetic terminology like "GY" vs "Graveyard" changed). But for a bounded set of **36 "functional errata" cards**, the modern text describes *different gameplay* than Edison — e.g. Goyo Guardian shows "1 EARTH Tuner" when in Edison it accepts **any** Tuner. This misleads players building and understanding decks. Audit (full evidence): `docs/working/2026-07-13-card-text-audit.md`; scope confirmed bounded to these 36 — no gameplay-relevant text errors exist outside them.

**The rules engine is not affected** — it does not exist yet (`packages/engine` is an interface stub; dueling is a future slice). This is a **display/catalog-data fix only**.

---

## Decisions made (CEO-confirmed)

1. **Display true Edison text for the functional-errata cards.** (Option A over "leave modern".)
2. **Source of accurate text:** the **verbatim March-2010 printed English text**, taken from Yugipedia `Card Errata:<name>` history (each card's original printing, `lore0`, which is the text in effect during Edison — every card's functional errata came in a 2011+ reprint). Each string is citable to a specific printing (JSON `source`). `MikaMikaDE/mikaRulings` `PSCT.Edison` was the initial candidate but a proofread found substantive errors on 8/35 cards (e.g. Necrovalley mis-stated, Cyber Phoenix truncated) — rejected. See `docs/working/2026-07-13-proofread-report.md`.
3. **Text style:** verbatim period templating — "Graveyard", "Life Points", "remove from play", "side of the field", etc. **Accepted tradeoff (CEO):** these 35 read in older phrasing than the ~3,645 modern-text catalog cards; accuracy/authenticity was chosen over cross-catalog style consistency.
4. **Images:** keep the current modern self-hosted image; do **not** attempt pre-errata images in this change (no clean turnkey source exists; the canonical site also uses modern images). Authentic 2010 print-scan curation is parked as a possible follow-on.
5. **Scope:** exactly the ≤36 functional-errata cards. Adopting mika's Edison text catalog-wide is explicitly **parked** as a separate decision.
6. **Licensing:** CEO decided no attribution or permission ask is required for this case.

---

## Requirements

### MUST
- **REQ-1** For each of the **35** cards flagged `needsOverride: true` in the data file, the catalog's `desc` MUST equal the provided verbatim Edison text (`preErrataDescClean`). Authoritative data: `docs/working/2026-07-13-preerrata-desc-overrides.json`; every string is verbatim March-2010 printed text with its printing cited in `source`. Table also embedded below.
- **REQ-2** The **1** card flagged `needsOverride: false` (Susa Soldier `40473581`) MUST be left on its current text — its only English errata predates Edison (Tournament Pack 6, ~2004), so its March-2010 text already equals modern; its functional-errata status is a Spirit **ruling** (mandatory-return timing) for the future engine, not printed text. Do **not** invent text for it.
- **REQ-3** The override MUST be applied so it **cannot be silently reverted** by re-running the catalog build. The build pipeline copies YGOPRODeck text; the override must be a deliberate, data-driven layer the pipeline applies on top (e.g. an `overrides` map keyed by passcode, applied in `build-catalog.mjs`, with the source data checked into the repo). Re-running the build MUST reproduce the corrected text.
- **REQ-4** A test MUST assert the corrected text for a representative sample and guard against regression to modern text — minimum: Goyo `7391448` desc contains "1 Tuner" and does **not** contain "EARTH Tuner"; Sangan `26202165` desc does **not** contain "once per turn"; Brain Control `87910978` desc does **not** contain "Normal Summoned/Set". (Per the repo rule: tests merge in the same commit; green `verify` is sign-off.)
- **REQ-5** The 35 override strings are **verbatim, already proofed** by the Product Lead against Yugipedia's authoritative errata history (see `docs/working/2026-07-13-proofread-report.md`) — no authoring remains. Engineering MUST only spot-check that the strings are transcribed/applied without corruption and render correctly (special characters: curly quotes `"" ''`, `×`, parentheses, hyphens, ATK/DEF slashes).

### SHOULD
- **REQ-6** SHOULD surface a small "Edison errata" note on these cards (tooltip/badge), e.g. "In Edison this card uses any Tuner, not an EARTH Tuner." Text available per card as `edisonRuling` (mika `Rulings.Edison`) in the data file. Optional; UX to keep it lightweight (see UX below).
- **REQ-7** The overrides data file SHOULD live in `packages/card-data/` (its owning package) as the input to the build, so ownership and the dependency graph stay clean.

---

## UX flows & screens

No new screens. The change is data behind existing surfaces:
- **Card tile / inspector** (`packages/web/src/components/CardInspector.tsx`, `CardTile.tsx`) already render `desc`; corrected text flows through automatically.
- **Optional errata note (REQ-6):** a small, non-intrusive affordance in the card inspector only (not on grid tiles) — e.g. an "ℹ︎ Edison note" line or badge under the card text showing `edisonRuling`. Should not shift layout or clutter the deck grid. If it adds meaningful effort, ship the text fix first and treat the note as a fast follow.

---

## Out of scope
- Pre-errata card **images** (modern images stay).
- Adopting mika Edison text **catalog-wide** (only the ≤36 functional cards here).
- Any **rules-engine** behavior (doesn't exist yet; gameplay accuracy for these cards is a future dueling-slice concern, to be driven off the same pre-errata dataset).
- Cosmetic terminology normalization across the whole catalog (GY vs Graveyard, etc.) — no gameplay impact.

## Open questions (non-blocking)
- **Q1** For the 3 no-override cards, do we later want an authored Edison text or an errata note? Not needed for this fix.
- **Q2** Effect-number formatting: we strip glyphs for consistency now. If we later adopt mika text catalog-wide, revisit whether to standardize on numbered effects across all cards.

## Acceptance criteria
- [ ] All 35 `needsOverride` cards display the corrected Edison text; the 1 no-override card (Susa Soldier) is unchanged.
- [ ] Re-running `node packages/card-data/scripts/build-catalog.mjs` reproduces the corrected catalog (override is not lost).
- [ ] Regression test present and green (REQ-4); repo-wide `npm run verify` green on a clean checkout.
- [ ] All 35 verbatim strings applied without transcription corruption and rendering correctly (REQ-5 spot-check).
- [ ] Goyo Guardian on app.zuhayr.io reads "1 Tuner + 1 or more non-Tuners…" with no "EARTH Tuner".
- [ ] (If REQ-6 shipped) Edison note renders in the inspector without layout regressions.

## Appendix — data & override table
Authoritative machine-readable data: **`docs/working/2026-07-13-preerrata-desc-overrides.json`** (per card: `needsOverride`, `preErrataDescClean`, `mikaEdisonRaw`, `edisonRuling`, `ourCurrentDesc`). Supporting audits: `2026-07-13-card-text-audit.md`, `2026-07-13-preerrata-text-source.md`, `2026-07-13-preerrata-image-source.md`.

Below, `⏎` = newline. **Use the JSON for exact strings; the table is for review.** These strings are verbatim March-2010 text (period templating), proofed against Yugipedia errata history.

### OVERRIDE (35) — verbatim March-2010 text | passcode | name | desc (⏎ = newline; authoritative = preErrataDescClean in JSON)
| 25862681 | Ancient Fairy Dragon | 1 Tuner + 1 or more non-Tuner monsters ⏎ Once per turn, you can Special Summon 1 Level 4 or lower monster from your hand. You cannot conduct your Battle Phase the turn you activate this effect. Once per turn, you can destroy a Field Spell Card. If you do, gain 1000 Life Points, and you can add 1 Field Spell Card from your Deck to your hand. |
| 29071332 | Armory Arm | 1 Tuner + 1 or more non-Tuner monsters ⏎ Once per turn, you can equip this card to a monster OR unequip it to Special Summon this card in face-up Attack Position. While equipped to a monster by this effect, that monster gains 1000 ATK. When the equipped monster destroys a monster by battle and sends it to the Graveyard, inflict damage to your opponent equal to the destroyed monster's ATK. |
| 71645242 | Black Garden | When a monster is Normal or Special Summoned, except by the effect of "Black Garden", halve its ATK and Special Summon 1 "Rose Token" (Plant-Type/DARK/Level 2/ATK 800/DEF 800) to its controller's opponent's side of the field, in Attack Position. You can destroy this card and all face-up Plant-Type monsters on the field and Special Summon 1 monster with ATK equal to the total ATK of those monsters from your Graveyard. |
| 87910978 | Brain Control | Pay 800 Life Points. Select 1 face-up monster on your opponent's side of the field. Take control of the selected card until the End Phase of the turn this card is activated. |
| 50321796 | Brionac, Dragon of the Ice Barrier | 1 Tuner + 1 or more non-Tuner monsters ⏎ You can discard any number of cards to return the same number of cards from the field to the hand. |
| 95727991 | Catapult Turtle | Offer 1 monster on your side of the field as a Tribute to inflict Direct Damage equal to half of the Tribute monster's ATK to your opponent's Life Points. Monsters used for a Tribute Summon or that are offered as Tributes due to other cards' effects are excluded. |
| 3370104 | Cyber Phoenix | While this card is in face-up Attack Position on your side of the field, negate the effects of any Spell or Trap Card that targets 1 Machine-Type monster on your side of the field. When this face-up card on the field attacks or is attacked, and it is destroyed as a result of battle and sent to the Graveyard, you can draw 1 card from your Deck. |
| 48092532 | D.D. Survivor | If this face-up card on your side of the field is removed from play, this card is Special Summoned to the owner's side of the field during the End Phase. |
| 88643579 | Dark End Dragon | 1 Tuner + 1 or more non-Tuner DARK monsters ⏎ Once per turn, you can have this card lose 500 ATK and DEF, and send 1 monster your opponent controls to the Graveyard. |
| 80168720 | Darkness Approaches | Discard 2 cards from your hand. Select 1 face-up monster and flip it face-down, but do not change its battle position. |
| 76263644 | Destiny End Dragoon | "Destiny Hero - Plasma" + "Destiny Hero - Dogma" ⏎ A Fusion Summon of this monster can only be conducted with the above Fusion Material Monsters. Once per turn, you can destroy 1 monster your opponent controls and inflict damage to your opponent equal to its ATK. If you activate this effect, you cannot conduct your Battle Phase this turn. During your Standby Phase, if this card is in your Graveyard you can remove from play 1 "Destiny Hero" card from your Graveyard to Special Summon this card. |
| 89312388 | Elemental HERO Prisma | Once per turn, you can reveal 1 Fusion Monster from your Fusion Deck and send 1 of the Fusion Material Monsters listed on that card from your Deck to the Graveyard. Until the End Phase, this card's name is treated as the sent monster's name. |
| 34471458 | Fortune Lady Light | This card's ATK and DEF are equal to its Level x 200. During each of your Standby Phases, increase the Level of this card by 1 (max 12). When this card is removed from the field by a card effect, you can Special Summon 1 "Fortune Lady" monster from your Deck. |
| 77565204 | Future Fusion | Send, from your Deck to the Graveyard, Fusion Material Monsters that are listed on a Fusion Monster Card, and select that 1 Fusion Monster from your Fusion Deck. Special Summon the selected Fusion Monster during your 2nd Standby Phase after this card's activation. (This Special Summon is treated as a Fusion Summon.) When this card is removed from the field, destroy that monster. When the monster is destroyed, destroy this card. |
| 7391448 | Goyo Guardian | 1 Tuner + 1 or more non-Tuner monsters ⏎ When this card destroys an opponent's monster by battle and sends it to the Graveyard, you can Special Summon that monster to your side of the field in face-up Defense Position. |
| 44364207 | Jade Knight | Face-up Machine-Type monsters you control with 1200 or less ATK cannot be destroyed by the effects of Trap Cards. When this face-up card is destroyed by battle and sent to the Graveyard, you can add 1 Level 4 LIGHT Machine-Type monster from your Deck to your hand. |
| 25132288 | Light End Dragon | 1 Tuner + 1 or more non-Tuner LIGHT monsters ⏎ When you declare an attack, you can activate this card's effect. If you do, this card loses 500 ATK and DEF (permanently), and the monster it is battling loses 1500 ATK and DEF until the End Phase. |
| 47297616 | Light and Darkness Dragon | This card cannot be Special Summoned. While this card is face-up on the field its Attribute is also treated as DARK. When a Spell or Trap Card is activated, or the effect of an Effect Monster is activated, that activation is negated and this card loses 500 ATK and DEF. When this card is destroyed and sent to the Graveyard, select 1 monster in your Graveyard. Then destroy all cards you control, and Special Summon that monster. |
| 95503687 | Lumina, Lightsworn Summoner | Once per turn, you can discard 1 card to Special Summon 1 Level 4 or lower "Lightsworn" monster from your Graveyard. During each of your End Phases, send the top 3 cards of your Deck to the Graveyard. |
| 42940404 | Machina Gearframe | When this card is Normal Summoned, you can add 1 "Machina" monster, except "Machina Gearframe", from your Deck to your hand. Once per turn, during your Main Phase, you can equip this card to a Machine-Type monster you control as an Equip Card, OR unequip it to Special Summon this card in face-up Attack Position. (A monster can only be equipped with 1 Union Monster at a time. If the equipped monster would be destroyed, destroy this card instead.) |
| 45247637 | Mark of the Rose | Remove from play 1 Plant-Type monster from your Graveyard and equip this card to a monster your opponent controls. Gain control of the equipped monster. During your End Phase, give control of the equipped monster to your opponent. During your Standby Phase, gain control of the equipped monster. |
| 80921533 | Mausoleum of the Emperor | Both players can Normal Summon or Set monsters without Tribute(s) by paying 1000 Life Points x the number of monsters needed to Tribute Summon them. |
| 69279219 | My Body as a Shield | When your opponent activates a card that has the effect that destroys 1 or more monsters on the field, pay 1500 Life Points to negate the activation of the card and destroy it. |
| 47355498 | Necrovalley | As long as this card remains face-up on the field, all effects of Magic, Trap and/or Effect Monster Cards that involve Graveyards are negated and neither player can remove cards in the Graveyards from play. In addition, increase the ATK and DEF of all monsters that includes "Gravekeeper's" in their card name by 500 points. |
| 20932152 | Quickdraw Synchron | You can send 1 monster from your hand to the Graveyard and Special Summon this card from your hand. You can substitute this card for any 1 "Synchron" Tuner monster for a Synchro Summon. This card cannot be used as a Synchro Material Monster, except for the Synchro Summon of a monster that lists a "Synchron" monster as a Tuner monster. |
| 88264978 | Red-Eyes Darkness Metal Dragon | You can remove from play 1 Dragon-Type monster you control to Special Summon this card. Once per turn, you can Special Summon 1 Dragon-Type monster except "Red-Eyes Darkness Metal Dragon" from your hand or Graveyard. |
| 14878871 | Rescue Cat | Send this face-up card on your side of the field to the Graveyard to Special Summon 2 Level 3 or lower Beast-Type monsters from your Deck to the field. The monsters Special Summoned in this way are destroyed during the End Phase. |
| 21502796 | Ryko, Lightsworn Hunter | FLIP: You can destroy 1 card on the field. Send the top 3 cards of your Deck to the Graveyard. |
| 26202165 | Sangan | When this card is sent from the field to the Graveyard, move 1 monster with an ATK of 1500 or less from your Deck to your hand. Your Deck is then shuffled. |
| 68005187 | Soul Exchange | Select an opponent's monster and use it as a Tribute in place of one of your own. You must skip your Battle Phase for the turn in which this card is activated. |
| 41006930 | Strike Ninja | You can remove this card from play until the End Phase of this turn by removing 2 DARK monsters in your Graveyard from play. You can use this effect during either player's turn. You can only use this effect once per turn. |
| 9126351 | Swap Frog | You can discard 1 WATER monster to Special Summon this card from your hand. When this card is Summoned, you can select and send 1 Level 2 or lower Aqua-Type WATER monster from your Deck or your side of the field to the Graveyard. Once per turn, you can return 1 monster you control to your hand to Normal Summon 1 "Frog" monster, except "Swap Frog" or "Frog the Jam", in addition to your Normal Summon or Set this turn. |
| 12538374 | Treeborn Frog | If this card is in your Graveyard during your Standby Phase and there are no Spell or Trap Cards on your side of the field, you can Special Summon this card to your side of the field. This effect cannot be activated if there is a face-up "Treeborn Frog" on your side of the field. |
| 80604091 | Ultimate Offering | At the cost of 500 Life Points per monster, a player is allowed an extra Normal Summon or Set. |
| 94634433 | Urgent Tuning | Activate only during the Battle Phase. Synchro Summon 1 Synchro Monster. (Send the appropriate Synchro Material Monsters to the Graveyard.) |

### NO OVERRIDE (1)
| 40473581 | Susa Soldier | ruling/engine-only; errata predates Edison — text already correct |
