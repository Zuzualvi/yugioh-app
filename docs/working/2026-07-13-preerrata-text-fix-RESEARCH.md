# Research Brief — Edison Card-Text Accuracy (Pre-Errata Display)

**Date:** 2026-07-13 • **Author:** Product Lead • Audience: technical, not present for the investigation.

## Question
Our Edison (March 2010) deck builder showed Goyo Guardian with post-Edison errata text. How widespread is the problem, what's the correct text source, and does it affect the rules engine?

## Method
Diffed all 3,681 shipped catalog cards (`packages/card-data/out/edison-card-catalog.json`, `desc`) against edisonformat.net's own card DB (`https://edisonformat.net/data/json/EdisonCards.json`, `Text`), normalizing cosmetic terminology (GY↔Graveyard, LP↔Life Points, cannot↔can't, select↔target, Machine-Type↔Machine, "1 or more"↔"1+"). Cross-referenced the community's 36-card functional-errata list and the `MikaMikaDE/mikaRulings` repo (per-passcode `PSCT.{Base,Edison}` + `Rulings`).

## Findings

1. **Root cause.** `build-catalog.mjs` copies YGOPRODeck's modern `desc` verbatim. Displayed text is current, not 2010.

2. **Scope is bounded.** After terminology normalization: 3,449 equivalent, 227 cosmetic-only, and just 4 "material" — of which only Ancient Fairy Dragon is a genuine functional difference vs edisonformat.net (the other 3 — Pumpking, Imperial Custom, Stardust/Assault Mode — are verbose old wording of identical effects). **Gameplay-relevant text errors are confined to the ~36 known functional-errata cards. Nothing lurks beyond them.**

3. **edisonformat.net's deckbuilder JSON is itself modern.** It shows Goyo as "1 EARTH Tuner" too. So "re-import from edisonformat.net's data file" would fix only AFD. The site's *accurate* text lives elsewhere (next point).

4. **The accurate-text source found.** edisonformat.net's card page (`/card?name=…`, `js/card.js`) shows the modern text only in a collapsed "may not apply to Edison" box, and populates its visible panels from `raw.githubusercontent.com/MikaMikaDE/mikaRulings/main/cards/<passcode>.json` (`PSCT.Edison`, `Rulings.Edison`). Goyo's `PSCT.Edison` is exactly "1 Tuner + 1 or more non-Tuners…". Verified genuinely pre-errata across the hard cases. This is the fix's source of truth (keyed by passcode; distinguishes `Base` modern vs `Edison`).
   - Caveat: mika maintains an Edison PSCT for *nearly every* card (full reformat), so "Edison ≠ Base" flags ~3,672/3,673 — it is **not** a functional-errata detector; the ~36 remain the functional set.
   - Quality caveat: mika text is behavior-accurate but sometimes a simplified paraphrase with typos → requires a human proofread pass against a second reference before shipping.

5. **Rules engine.** Does not exist yet (`packages/engine` is a stub; dueling is the next slice). Today's pre-errata handling in `packages/server/src/catalog/loadCatalog.ts` only resolves pre-errata passcode **aliases** for deck legality/banlist counting — it does not touch display text or gameplay. So nothing there was "gotten wrong." When the engine is built, gameplay accuracy for these cards should be driven off the same pre-errata dataset (curated pre-errata Lua scripts, per the prior engine decision) — one source of truth for text and behavior.

6. **Images.** No clean turnkey pre-errata image source. edisonformat.net uses modern images + accurate text panel; ProjectIgnis pre-errata passcodes have no images (404); Yugipedia has per-card original-print scans but only via manual curation. Recommendation: modern image + corrected text (+ optional errata note) now.

## Sources
- Our catalog: `packages/card-data/out/edison-card-catalog.json`; pipeline `packages/card-data/scripts/build-catalog.mjs`.
- edisonformat.net data + card page JS (`/data/json/EdisonCards.json`, `js/deckbuilder.js`, `js/card.js`).
- `github.com/MikaMikaDE/mikaRulings` (`cards/<passcode>.json`).
- Prior team research: `docs/working/2026-07-13-research-edison-functional-errata.md`.
- Full audits: `docs/working/2026-07-13-card-text-audit.md`, `-preerrata-text-source.md`, `-preerrata-image-source.md`; data `-preerrata-desc-overrides.json`.
