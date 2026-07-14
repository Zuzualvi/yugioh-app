# Proofread Report — Pre-Errata Card Text (35 overrides)

**Date:** 2026-07-13  •  **Author:** Product Lead  •  **Outcome:** CEO chose VERBATIM March-2010 text.

## What was done
Every one of the 35 override strings was checked against **Yugipedia `Card Errata:<name>` history** (MediaWiki API, `action=parse&prop=wikitext`), reconstructing each printing's exact text from the `<del>`/`<ins>` markup. The original printing (`lore0`) is the March-2010 text for all 35 — every card's functional errata came in a later, 2011+ reprint.

## Decision
The initial source (`MikaMikaDE/mikaRulings` `PSCT.Edison`, modern-PSCT style) was found to contain **substantive errors on 8 of 35 cards** — not just typos. Rather than re-author (which reintroduces paraphrase risk), we ship the **verbatim March-2010 printed English text** (period/classic templating: "Graveyard", "Life Points", "remove from play"). This reverses the earlier modern-PSCT style choice in favor of accuracy. Each string is citable to a specific printing (see JSON `source`).

## Substantive mika errors caught (why verbatim)
- **Armory Arm** (29071332): mika typo "Special it" (missing "Summon") + glyph residue.
- **Cyber Phoenix** (3370104): mika truncated mid-sentence ("…Draw 1 card,") + modern damage-step wording.
- **Elemental HERO Prisma** (89312388): mika awkward duplicated clause ("You can activate this effect; You can reveal…").
- **Future Fusion** (77565204): mika odd effect renumbering/paraphrase.
- **Machina Gearframe** (42940404): mika glyph residue "©".
- **Mausoleum of the Emperor** (80921533): mika garbled ("pay choose 1 or 2, then pay that much LP x1000").
- **Necrovalley** (47355498): mika mis-stated the card ("Negate any card effect that *targets* a card in the GY"); verbatim negates **all** effects involving the GY and blocks banishing from it.
- **Quickdraw Synchron** (20932152): mika began mid-sentence, lowercase ("can't be used…").

The remaining 27 overrides: mika was a modern-PSCT paraphrase (behavior-OK), but verbatim is used uniformly for authenticity + citable provenance.

## No-override (1)
- **Susa Soldier** (40473581): its only English errata (removing "Flip Summoned") was Tournament Pack 6, ~2004 — before Edison — so its March-2010 text already equals modern. Its functional-errata status is a Spirit ruling for the future engine, not printed text. Display unchanged.

## Residual engineering check (REQ-5, now light)
Text is verbatim-sourced and proofed against the authoritative errata history — no authoring remains. The CTO should only spot-check that the strings are transcribed/applied without corruption and render correctly (special characters: curly quotes, ×/x, parentheses, hyphens).

## Style note (accepted tradeoff)
These 35 cards now read in period templating (e.g., "Graveyard", "Life Points", "side of the field", "remove from play"), which differs from the ~3,645 modern-text catalog cards. This was a deliberate CEO decision: accuracy/authenticity over cross-catalog style consistency.

## Data
`2026-07-13-preerrata-desc-overrides.json` — per card: `preErrataDescClean` (verbatim), `source` (printing), `ourCurrentDesc`, `edisonRulingNote` (optional REQ-6 badge text from mika `Rulings.Edison`), `mikaTextRejected`, `whyVerbatim`.
