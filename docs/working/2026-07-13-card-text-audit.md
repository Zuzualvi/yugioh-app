# Card-Text Catalog Audit — Edison Deck Builder

**Date:** 2026-07-13  •  **Author:** Product Lead  •  **Trigger:** CEO spot-check found Goyo Guardian showing post-Edison errata text.

## What was compared
- **OURS** = `packages/card-data/out/edison-card-catalog.json` (`desc` field). Built by filtering the modern YGOPRODeck full dump to the Edison pool and copying YGOPRODeck text verbatim (`build-catalog.mjs:257`).
- **GROUND TRUTH (community reference)** = `https://edisonformat.net/data/json/EdisonCards.json` (`Text` field), the founder-run Edison site's deckbuilder DB. 3,681 cards each side, joined on passcode.
- Texts normalized for terminology (Graveyard=GY, Life Points=LP, cannot=can't, select=target, Machine-Type=Machine, "1 or more"="1+") before comparison, so cosmetic modernizations do not count as differences.

## Headline result
- **3449** cards: text equivalent (identical after terminology normalization).
- **227** cards: terminology-only differences (cosmetic — GY vs Graveyard, etc.).
- **4** cards: material/functional-looking text difference vs edisonformat.net. Passcodes: [9995766, 25862681, 29155212, 61257789].

## The decisive finding
**edisonformat.net's own data file is itself modern text, not pre-errata.** For Goyo Guardian it shows `"1 EARTH Tuner + 1 or more non-Tuner monsters..."` — the SAME post-errata restriction our catalog shows (only diff: "Graveyard" vs "GY"). Same for Sangan, Rescue Cat, Brain Control, Red-Eyes Darkness Metal Dragon, Future Fusion. So:
- Re-importing card text from edisonformat.net's JSON would **NOT** fix Goyo. It fixes only Ancient Fairy Dragon (the one functional-errata card that JSON happens to carry pre-errata).
- The truly period-correct 2010 text for these cards lives in the **curated pre-errata card set** (EDOPro pre-errata scripts, e.g. Goyo 511002994 = "1 Tuner + 1 or more non-Tuners" with no EARTH restriction) — which is the same source our (not-yet-built) rules engine is already slated to use.

## Scope of the real problem
The gameplay-relevant display errors are confined to the **36 known "functional-errata" cards** already enumerated by prior research (`docs/working/2026-07-13-research-edison-functional-errata.md`). Our catalog currently shows the MODERN text for all of them. Outside those 36, there are **no** gameplay-relevant text errors — every other difference is terminology/PSCT modernization.

The 3 non-36 cards flagged "material" are false positives on inspection (verbose 2010 wording of an identical effect):
- **Pumpking the King of Ghosts** — old long-form wording of the same +100 ATK/DEF-per-Standby effect.
- **Imperial Custom** — "can't be destroyed" vs "can't be destroyed by battle or card effect"; same intent. (Forbidden in Edison anyway.)
- **Stardust Dragon/Assault Mode** — modern adds a redundant "Once per turn" clarifier.

## Rules engine
The rules engine **does not exist yet** — `packages/engine` is an interface stub and the dueling slice is the next build (per the go-live report). So there is nothing there to have "gotten wrong." The pre-errata handling that DOES exist today (`packages/server/src/catalog/loadCatalog.ts`) only resolves pre-errata passcode ALIASES for deck legality/banlist counting; it does not touch displayed card text.

## Files
- Machine-readable per-card diff: `card-text-diff.json` (this dir).
