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
2. **Source of accurate text:** `MikaMikaDE/mikaRulings`, `cards/<passcode>.json` → `PSCT.Edison`. This is the same source the founder's site (edisonformat.net) uses for its accurate-text panel, keyed by passcode. Verified genuinely pre-errata on the hard cases (Sangan/Rescue Cat/REDMD lose modern hard-OPT; Brain Control loses the "can be Normal Summoned/Set" clause; AFD is the old version).
3. **Text style:** strip mika's `①②③ / Ⓢ / Ⓒ` effect-number glyphs so the 33 overrides match the plain-text style of the other ~3,645 cards (`preErrataDescClean` in the data file).
4. **Images:** keep the current modern self-hosted image; do **not** attempt pre-errata images in this change (no clean turnkey source exists; the canonical site also uses modern images). Authentic 2010 print-scan curation is parked as a possible follow-on.
5. **Scope:** exactly the ≤36 functional-errata cards. Adopting mika's Edison text catalog-wide is explicitly **parked** as a separate decision.
6. **Licensing:** CEO decided no attribution or permission ask is required for this case.

---

## Requirements

### MUST
- **REQ-1** For each of the **35** cards flagged `needsOverride: true` in the data file, the catalog's `desc` MUST equal the provided Edison text (`preErrataDescClean`). Authoritative data: `docs/working/2026-07-13-preerrata-desc-overrides.json` (table also embedded below). Note: 33 come from mikaRulings `PSCT.Edison`; **2 (Urgent Tuning `94634433`, Destiny End Dragoon `76263644`) were authored from Yugipedia original-print errata history** (mika had no Edison text) — see each card's `source`/`note` in the JSON.
- **REQ-2** The **1** card flagged `needsOverride: false` (Susa Soldier `40473581`) MUST be left on its current text — its only English errata predates Edison (Tournament Pack 6, ~2004), so its March-2010 text already equals modern; its functional-errata status is a Spirit **ruling** (mandatory-return timing) for the future engine, not printed text. Do **not** invent text for it.
- **REQ-3** The override MUST be applied so it **cannot be silently reverted** by re-running the catalog build. The build pipeline copies YGOPRODeck text; the override must be a deliberate, data-driven layer the pipeline applies on top (e.g. an `overrides` map keyed by passcode, applied in `build-catalog.mjs`, with the source data checked into the repo). Re-running the build MUST reproduce the corrected text.
- **REQ-4** A test MUST assert the corrected text for a representative sample and guard against regression to modern text — minimum: Goyo `7391448` desc contains "1 Tuner" and does **not** contain "EARTH Tuner"; Sangan `26202165` desc does **not** contain "once per turn"; Brain Control `87910978` desc does **not** contain "Normal Summoned/Set". (Per the repo rule: tests merge in the same commit; green `verify` is sign-off.)
- **REQ-5** Every one of the 35 override strings MUST be **human-verified against a second reference** (Yugipedia original-print / "Previous errata" text) and **copyedited** before shipping. The 33 mika-sourced strings are behavior-accurate but have known artifacts — e.g. Armory Arm "…Special it…" (missing "Summon"), Mausoleum "…pay choose 1 or 2…", Necrovalley is an over-simplified paraphrase, and some entries have stray glyph residue (`©`, a leading lowercase "can't"). The 2 Yugipedia-authored strings (Urgent Tuning, Destiny End Dragoon) are **verbatim 2008 print text** in old templating — during this pass, terminology MAY be normalized to catalog style (Graveyard→GY, "remove from play"→banish) but the pre-errata **behavior MUST be preserved** (each card's `note` states exactly what to preserve: Urgent Tuning summons on resolution not "immediately after"; Dragoon's destroy doesn't target and its revival is not "once per turn"). This is a proofread pass, not a blind import.

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
- [ ] All 35 strings proofread against a second reference and free of typos/glyph residue; the 2 Yugipedia-authored strings preserve pre-errata behavior per their `note` (REQ-5).
- [ ] Goyo Guardian on app.zuhayr.io reads "1 Tuner + 1 or more non-Tuners…" with no "EARTH Tuner".
- [ ] (If REQ-6 shipped) Edison note renders in the inspector without layout regressions.

## Appendix — data & override table
Authoritative machine-readable data: **`docs/working/2026-07-13-preerrata-desc-overrides.json`** (per card: `needsOverride`, `preErrataDescClean`, `mikaEdisonRaw`, `edisonRuling`, `ourCurrentDesc`). Supporting audits: `2026-07-13-card-text-audit.md`, `2026-07-13-preerrata-text-source.md`, `2026-07-13-preerrata-image-source.md`.

Below, `⏎` = newline. **Use the JSON for exact strings; the table is for review.** These strings still require the REQ-5 proofread.

### OVERRIDE (35) — passcode | name | new desc (⏎ = newline; authoritative source = preErrataDescClean in JSON)
| 25862681 | Ancient Fairy Dragon | 1 Tuner + 1+ non-Tuner monsters ⏎ Once per turn: You can Special Summon 1 Level 4 or lower monster from your hand ⏎ (You can't conduct your Battle Phase the turn you activate this effect). ⏎ Once per turn: You can destroy a card in the Field Spell Card Zone, and if you do, gain 1000 LP, ⏎ then you can add 1 Field Spell from your Deck to your hand. |
| 29071332 | Armory Arm | 1 Tuner + 1 or more non-Tuners ⏎ Once per turn: You can choose 1; ● Target 1 monster on the field; equip this card to that target. ⏎ ● Unequip and Special it in Attack Position. ⏎ That equipped monster gains 1000 ATK. ⏎ If that monster destroys a monster by battle and sends it to the GY: ⏎ Your opponent takes damage equal to their destroyed monster’s ATK on the field. |
| 71645242 | Black Garden | If a monster(s) is Normal/Special Summoned (except by “Black Garden”): Halve its ATK, also, if it is still on the field (even if face-down), you Special Summon 1 “Rose Token” (Plant/DARK/Level 2/ATK 800/DEF 800) to that monster's opponent's field, in Attack Position. ⏎ You can target 1 monster in your GY with ATK equal to the total ATK of all face-up Plants; destroy this card and as many Plants on the field as possible, then, if you destroyed all of them, Special Summon that target. |
| 87910978 | Brain Control | Pay 800 LP, then target 1 face-up monster your opponent controls; take control of that target (until the End Phase). |
| 50321796 | Brionac, Dragon of the Ice Barrier | 1 Tuner + 1 or more non-Tuners ⏎ You can discard any number of cards to the GY, then target that many cards on the field; return them to the hand. |
| 95727991 | Catapult Turtle | You can Tribute 1 monster; Your opponent takes damage equal to half of its ATK on the field. |
| 3370104 | Cyber Phoenix | While this card is in Attack Position, ⏎ negate all Spell/Trap effects that target exactly 1 Machine you control (and no other cards). ⏎ If this card is destroyed by battle and sent to the GY, and was face-up at attack declaration: You can Draw 1 card, |
| 48092532 | D.D. Survivor | Once per End Phase, if this card was banished, while face-up on your field, this turn: ⏎ Special Summon this banished card. |
| 88643579 | Dark End Dragon | 1 Tuner + 1 or more non-Tuner DARKs ⏎ Once per turn: ⏎ You can target 1 monster your opponent controls; this card loses 500 ATK and DEF, and if it does, send that target to the GY. |
| 80168720 | Darkness Approaches | Discard 2 cards, then target 1 face-up monster; Set it (but don’t change its Battle Position). |
| 76263644 | Destiny End Dragoon *(authored from Yugipedia original print — see JSON source/note)* | "Destiny Hero - Plasma" + "Destiny Hero - Dogma" ⏎ A Fusion Summon of this monster can only be conducted with the above Fusion Material Monsters. Once per turn, you can destroy 1 monster your opponent controls and inflict damage to your opponent equal to its ATK. If you activate this effect, you cannot conduct your Battle Phase this turn. During your Standby Phase, if this card is in your Graveyard you can remove from play 1 "Destiny Hero" card from your Graveyard to Special Summon this card. |
| 89312388 | Elemental HERO Prisma | Once per turn: You can activate this effect; You can reveal 1 Fusion Monster from your Extra Deck, and send 1 Monster from your Deck to the GY, whose name is specifically listed on that Fusion Monster, and until the End Phase, this card's name becomes the sent monster's. |
| 34471458 | Fortune Lady Light | This card's ATK/DEF become its Level x 200. ⏎ Once per turn, during your Standby Phase: Increase this card's Level by 1 (max. 12). ⏎ When this card leaves the field by a card effect: You can Special Summon 1 "Fortune Lady" monster from your Deck. |
| 77565204 | Future Fusion | If this card is activated: ⏎ Reveal 1 Fusion Monster from your Extra Deck, and send its Materials from your Deck to GY, and, during your 2nd Standby Phase after activation, Fusion Summon 1 Monster from your Extra Deck with the same name as that revealed monster, and target it with this card. ⏎ If this leaves the field, destroy that monster. ⏎ If that monster is destroyed, destroy this card. |
| 7391448 | Goyo Guardian | 1 Tuner + 1 or more non-Tuners ⏎ If this card destroys a monster by battle and sends it to the GY: ⏎ You can Special Summon that monster to your field in Defense Position. |
| 44364207 | Jade Knight | While this card is in Attack Position, Machines you control with 1200 or less ATK can't be destroyed by Trap effects. ⏎ If this card is destroyed by battle and sent to the GY, and was face-up at attack declaration: ⏎ You can add 1 Level 4 LIGHT Machine from your Deck to your hand. |
| 25132288 | Light End Dragon | 1 Tuner + 1 or more non-Tuner LIGHTs ⏎ If an attack is declared involving this monster: You can have this card lose 500 ATK/DEF, and if you do, this turn, the monster it is battling loses 1500 ATK/DEF. |
| 47297616 | Light and Darkness Dragon | Cannot be Special Summoned. ⏎ While face-up on the field, this card is also DARK. ⏎ Once per Chain, if a Spell/Trap Card, or Monster Effect is activated (Quick): ⏎ This card loses exactly 500 ATK/DEF and that activation is negated. ⏎ If this card is destroyed and sent to the GY: Target 1 monster in your GY (if possible); destroy all cards you control, also, after that, Special Summon that monster (if any). |
| 95503687 | Lumina, Lightsworn Summoner | Once per turn: You can discard 1 card, then target 1 level 4 or lower "Lightsworn" monster in your GY; Special Summon it. ⏎ During your End Phase: Send the top 3 cards of your Deck to the GY. ⏎ (Activate & Resolve only if this card is face-up on the field). |
| 42940404 | Machina Gearframe | When Normal Summoned: You can add 1 "Machina" monster from your Deck to your hand, except "Machina Gearframe". ⏎ Once per turn: you can activate 1 of these effects; ● Target 1 Machine you control; equip this monster to that target. ⏎ ● Unequip and Special Summon this card in Attack Position. ⏎ If a monster equipped by this card's effect would be destroyed, destroy this card instead. ⏎ © A monster can never be equipped with more than 1 Union Monster. |
| 45247637 | Mark of the Rose | Activate by banishing 1 Plant from your GY, then target 1 monster your opponent controls; equip this card to that target. ⏎ Gain control of the equipped monster. ⏎ During your End Phase: Your opponent gains control of the equipped monster. ⏎ During your Standby Phase: Gain control of the equipped monster. |
| 80921533 | Mausoleum of the Emperor | During the Main Phase: The turn player can pay choose 1 or 2, then pay that much LP x1000; during this effect's resolution, they Normal Summon/Set 1 monster from their hand, which requires that many tributes, without Tributing (This is their 1 Normal Summon/Set for the turn). |
| 69279219 | My Body as a Shield | If your opponent activates a Card/Effect that would destroy a monster(s) on the field (except during the Damage Step): Pay 1500 LP; negate the activation, and if you do, destroy it. |
| 47355498 | Necrovalley | "Gravekeeper's" monsters gain 500 ATK/DEF. ⏎ Neither player can banish cards from GY(s). ⏎ Negate any card effect that targets a card(s) in the GY. |
| 20932152 | Quickdraw Synchron | During your Main Phase: You can send 1 other monster from your hand to the GY, and Special Summon this card from your hand. ⏎ For a Synchro Summon, you can substitute this card for any 1 "Synchron" Tuner. ⏎ can't be used as a Synchro Material, except for a monster that lists a "Synchron" Tuner as material. |
| 88264978 | Red-Eyes Darkness Metal Dragon | You can Special Summon this card (from your hand) by banishing 1 face-up Dragon you control. ⏎ Once per turn: ⏎ You can Special Summon 1 Dragon from your hand/GY (except "Red-Eyes Darkness Metal Dragon”). |
| 14878871 | Rescue Cat | You can send this card you control to the GY; Special Summon 2 Level 3 or lower Beasts from your Deck (destroy them during the End Phase). |
| 21502796 | Ryko, Lightsworn Hunter | FLIP: You can target 1 card on the field; destroy that target (if any), then (regardless), send the top 3 cards of your Deck to the GY. |
| 26202165 | Sangan | If this card is sent from the field to the GY: ⏎ Add 1 monster with 1500 or less ATK from your Deck to your hand. |
| 68005187 | Soul Exchange | Target 1 monster your opponent controls; this turn, if you Tribute a monster, you can Tribute that monster, as if you controlled it. ⏎ (You can't conduct your Battle Phase the turn you activate this card). |
| 41006930 | Strike Ninja | Once per turn (Quick Effect): ⏎ You can banish 2 DARKs from your GY; banish this face-up card (until the End Phase). |
| 9126351 | Swap Frog | You can Special Summon this card (from your hand) by discarding 1 other WATER. ⏎ When this card is Summoned: You can send 1 Level 2 or lower WATER Aqua from your Deck or face-up-field to the GY. ⏎ Once per turn: You can return 1 monster you control to the hand; this turn, you can Normal Summon 1 "Frog" monster (except “Swap Frog” or “Frog the Jam”), in addition to your Normal Summon/Set. |
| 12538374 | Treeborn Frog | During your Standby Phase, if this card is in your GY, and you don’t control "Treeborn Frog": ⏎ You can Special Summon this card. ⏎ (Activate & Resolve only if you control no Spells/Traps.) |
| 80604091 | Ultimate Offering | During your Main Phase or your opponent's Battle Phase: You can pay 500 LP; during this effect's resolution, Normal Summon/Set 1 monster. |
| 94634433 | Urgent Tuning *(authored from Yugipedia original print — see JSON source/note)* | Activate only during the Battle Phase. Synchro Summon 1 Synchro Monster. (Send the appropriate Synchro Material Monsters to the Graveyard.) |

### NO OVERRIDE (1) — display modern text unchanged
| 40473581 | Susa Soldier | ruling/engine-only; errata predates Edison — text already correct |
