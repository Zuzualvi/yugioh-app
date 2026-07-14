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

## Override set (the greenlit fix) — 35 override + 1 no-override
- **33** cards have a clean `PSCT.Edison` from mika (glyphs stripped → `preErrataDescClean`).
- **2** cards had a mika placeholder ("No Edison-Accurate PSCT available") but a genuine pre-errata text DOES exist — **authored from Yugipedia's `Card Errata:` history** (the original TCG printing in effect March 2010):
  - **Urgent Tuning** (94634433) — CSOC-EN065 (2008): "Activate only during the Battle Phase. Synchro Summon 1 Synchro Monster. …". The modern "Immediately after this effect resolves…" is a 2014 (LC5D) erratum.
  - **Destiny End Dragoon** (76263644) — LODT-EN042 (2008): revival has **no "once per turn"**, destroy effect does not target and inflicts damage = the monster's ATK. The OPT + "target/face-up" wording were added by 2011 (LCGX) / 2016 (DESO) errata.
- **1** card needs NO override: **Susa Soldier** (40473581) — its only English errata (removing "Flip Summoned") was Tournament Pack 6 (~2004), well before Edison, so its March-2010 text already equals modern. Its functional-errata status is a Spirit ruling (engine, not text).
- Machine-readable set: **`preerrata-desc-overrides.json`** (per card: `needsOverride`, `preErrataDescClean`, `mikaEdisonRaw`, `edisonRuling`, `source`, `note`).
- LESSON: "the accurate-text repo didn't have it" ≠ "no accurate text exists." Yugipedia `Card Errata:<name>` pages give dated printing-by-printing text history — the authoritative fallback for any card mika lacks.
- The other ~3,645 cards need no functional override (see the catalog-text audit — differences are cosmetic terminology only).

## Style decision the CTO needs from us (flagged to CEO)
Our other ~3,645 cards use plain modern text with **no** ①/Ⓢ glyphs. Two clean options for the 36:
1. Use mika Edison content with glyphs **stripped** (`preErrataDescClean`) → consistent with the rest of the catalog. *Recommended.*
2. Keep mika's ①/Ⓢ effect-numbering → matches edisonformat.net exactly but is stylistically inconsistent with our other cards.
(Alternative content source, higher effort: verbatim original-2010 printed English text per card — more authentic, but manual and arguably less clear than PSCT.)

## Licensing flag (raise before shipping)
`MikaMikaDE/mikaRulings` has **no LICENSE file** (all-rights-reserved by default). The repo publicly powers edisonformat.net, so the author likely welcomes reuse, but recommend: attribution + a courtesy permission ask. Note this sits inside the app's broader fan-project posture (all Yu-Gi-Oh card text/images are Konami IP; we already display Konami text sourced from YGOPRODeck).
