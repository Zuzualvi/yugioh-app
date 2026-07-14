# Pre-Errata card IMAGE source — feasibility & recommendation

**Date:** 2026-07-13  •  **Author:** Product Lead  •  In response to CEO ask: "ideally show the pre-errata 2010 text on the card IMAGE, if there's a clean place to source it."

## Bottom line
**There is no clean, turnkey source of pre-errata card images that covers the 36 cards.** Even edisonformat.net — the canonical community site — does **not** attempt this: it displays the **modern** card image (`img/thumb/<Name>.webp`) alongside an Edison-accurate *text* panel. The realistic options are a manual per-card curation, or building our own renderer.

## Options evaluated
| Source | Coverage of 36 | Fidelity (shows 2010 text?) | Effort / cleanliness | Licensing |
|---|---|---|---|---|
| **A. Original 2010-era print scans (Yugipedia)** | Sourceable per-card (Yugipedia has many prints per card, e.g. `GoyoGuardian-CT05-EN-ScR-LE.jpg`) | Yes, if you pick an in-era print (pre-errata face) | **Manual**: choose the right English, in-era, high-res, non-foil-obscured print for each of 36; inconsistent set borders/quality across cards | Fan-community scans of Konami IP; same fair-use posture as our current images |
| **B. EDOPro / ProjectIgnis pre-errata pics (511002xxx)** | **None** — probed `raw.githubusercontent.com/ProjectIgnis/pics` for 511002994 and base 7391448 → 404. No dedicated pre-errata rendered images. | n/a | n/a | n/a |
| **C. Render our own faces from mika's accurate text** | All 36 (and extensible) | Yes, fully controlled/consistent | Real build: card-template engine + art assets + layout QA | Template/art-asset licensing to clear |
| **D. Keep modern image + accurate text panel (what edisonformat.net does)** | All | Image is modern, but the *text* users read is correct; add an "Edison errata" note/badge | Trivial once text fix lands | Same as today |

## Recommendation
- **v1 (recommended):** Option **D** — keep the modern self-hosted image, fix the TEXT (the thing that actually misinforms deckbuilding), and optionally surface the `Rulings.Edison` note (e.g. "In Edison this card requires any Tuner, not an EARTH Tuner") as a small badge/tooltip. This matches the canonical site and ships with the greenlit text fix.
- **Enhancement (if the CEO wants authentic images):** Option **A** — a bounded, curated set of 36 original-print scans, self-hosted like our other images. It's manual but finite. Option C only if we later want perfect consistency across a larger set.
