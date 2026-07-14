# Pre-Errata TEXT Source — Findings & Override Set

**Date:** 2026-07-13  •  **Author:** Product Lead  •  For: CTO handoff on the functional-errata display fix.

## Where edisonformat.net's Edison-accurate text actually comes from
The CEO observed edisonformat.net shows a modern card image but an Edison-accurate text panel beside it. Traced it:

- The **deckbuilder** (`/deckbuilder`, `js/deckbuilder.js`) and **quick search** read `/data/json/EdisonCards.json`, whose `Text` field is **modern** (Goyo = "1 EARTH Tuner…"). Image = `img/thumb/<Name>.webp` (modern face). So the deckbuilder is NOT the accurate-text surface.
- The **card-detail page** (`/card?name=…`, `js/card.js`) is. It shows the modern Konami text only in a collapsed box labeled *"This text is from the most recent printing… may not apply to Edison Format!"*, and populates the visible panels from a community rulings repo:
  - `card-psct`  ← `PSCT.Edison`
  - `card-rulings` ← `Rulings.Edison`
  - Source: `https://raw.githubusercontent.com/MikaMikaDE/mikaRulings/main/cards/<passcode>.json`

## The source of truth: MikaMikaDE/mikaRulings
Per-card JSON keyed by **passcode** (our exact key). Each file has a `PSCT` object with `Base` (modern printing) and `Edison` (Edison-accurate), plus per-format variants (Tengu/Goat/HAT/…), and a `Rulings` object with format-specific rulings.

- For Goyo, `PSCT.Edison` = *"1 Tuner + 1 or more non-Tuners / ① If this card destroys a monster by battle and sends it to the GY: You can Special Summon that monster to your field in Defense Position."* — exactly the text the CEO saw.
- **Verified genuinely pre-errata for the hard cases** (not just reformatted-modern): Sangan & Rescue Cat & Red-Eyes Darkness Metal Dragon lose their modern hard "once per turn"; Brain Control loses the "that can be Normal Summoned/Set" restriction; Ancient Fairy Dragon is the pre-errata version. This matches prior functional-errata research.
- Style: modern PSCT with ①②③/Ⓢ effect-number glyphs and mika's own phrasing/abbreviations. It is behavior-accurate, **not** verbatim 2010 printed wording (which used old templating: "Graveyard", "select", "side of the field").

## Override set (the greenlit fix)
- All **36** functional-errata cards have a clean, non-placeholder `PSCT.Edison`. Machine-readable set written to **`preerrata-desc-overrides.json`** (this dir): per card = `ourCurrentDesc`, `mikaEdisonRaw`, `preErrataDescClean` (glyphs stripped for catalog-style consistency), `edisonRuling`, `source`, `needsOverride`. Zero cards required manual authoring.
- The other ~3,645 cards need no functional override (see the catalog-text audit — differences are cosmetic terminology only).

## Style decision the CTO needs from us (flagged to CEO)
Our other ~3,645 cards use plain modern text with **no** ①/Ⓢ glyphs. Two clean options for the 36:
1. Use mika Edison content with glyphs **stripped** (`preErrataDescClean`) → consistent with the rest of the catalog. *Recommended.*
2. Keep mika's ①/Ⓢ effect-numbering → matches edisonformat.net exactly but is stylistically inconsistent with our other cards.
(Alternative content source, higher effort: verbatim original-2010 printed English text per card — more authentic, but manual and arguably less clear than PSCT.)

## Licensing flag (raise before shipping)
`MikaMikaDE/mikaRulings` has **no LICENSE file** (all-rights-reserved by default). The repo publicly powers edisonformat.net, so the author likely welcomes reuse, but recommend: attribution + a courtesy permission ask. Note this sits inside the app's broader fan-project posture (all Yu-Gi-Oh card text/images are Konami IP; we already display Konami text sourced from YGOPRODeck).
