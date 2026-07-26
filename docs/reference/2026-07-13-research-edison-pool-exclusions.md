# Edison Format — Exact Pool Definition, In-Window Carve-Outs & Two Tournament Conventions

**Purpose:** Pin down, for the frozen machine-readable passcode allow-list, (1) exactly which
cards printed *inside* the Edison window are **not** legal and why, (2) the precise legal **set
list**, (3) a precise legal **card count**, (4) the **Side Deck** size rule, and (5) the
**who-goes-first** convention. Accuracy is the founder's #1 requirement: every claim below is
tied to a source, and inferences are labeled.

**Anchor authority:** the group uses **edisonformat.net**. Its list pages are JavaScript-rendered,
so a plain HTTP fetch of the *page HTML* returns empty card sections. I worked around this by
pulling edisonformat.net's own **data files** directly (its `banlist.js` and its deckbuilder's
`/data/json/EdisonCards.json`), and I cross-checked against the sister site **edisonformat.com**
(static, fully documented), the **EDOPro community Edison whitelist** (`!2010.3 Edison`,
`$whitelist`), Konami's archived policy, and Yugipedia. Where JS-rendering blocked me, it is
called out explicitly.

---

## TL;DR

- **Excluded in-window cards = 27 cards, and they are Duel Terminal 1 (DT01) cards, NOT Hidden
  Arsenal cards.** **All 30 Hidden Arsenal 1 (HA01) cards are legal.** edisonformat.net's phrase
  "some Hidden Arsenal cards" is community shorthand: these 27 DT01 cards would *later* appear in
  Hidden Arsenal 2+/other sets (all post-cutoff), so players know them as "Hidden Arsenal cards,"
  but at the Edison cutoff their only printing was the Duel Terminal machine, which is not
  tournament-legal on its own.
- **Legal card count:** **3,681 unique cards** per edisonformat.net's own deckbuilder database;
  **3,671 unique cards (3,674 passcodes)** per the EDOPro community whitelist. The two agree to
  within ~10 cards (difference is almost entirely name-formatting + a few tokens/promo edge cases).
- **Side Deck:** **0–15** (any number up to 15), *not* "exactly 0 or 15." Its size must not exceed
  15 and must stay constant across a match (swaps are 1-for-1). Source: official 5D's-era rulebook.
- **Who goes first:** the **winner of the die roll / coin toss (or rock-paper-scissors) chooses to
  go first or second.** The first player draws on turn 1 (confirmed) but cannot conduct a Battle
  Phase on turn 1. Source: official 5D's-era rulebook + edisonformat.com Rule #1.

---

## 1. The in-window exclusion carve-out (the "some Hidden Arsenal cards")

### 1a. What edisonformat.net actually says (anchor)

edisonformat.net/rules/banlist (data pulled from its `banlist.js`, since the page is JS-rendered):

> "Edison Format uses the March 2010 Yugioh TCG Banlist (Forbidden and Limited List). Cards up to
> and including the release of Duelist Pack: Kaiba are legal. Note that **some cards which were
> printed during this time are nonetheless not legal for play, like some Hidden Arsenal cards.**"
> — https://edisonformat.net/rules/banlist

The banlist page itself does **not** enumerate the excluded cards (JS-rendered; `banlist.js` only
carries the Forbidden/Limited/Semi arrays). The enumerated exclusions live in edisonformat's card
database and its documented rules-update, below.

### 1b. The real mechanism (Konami's Duel Terminal policy)

The sister documentation site **edisonformat.com** explains it precisely and cites Konami:

> "Duel Terminal 1 released on January 29, 2010… **not all the new cards within the set were deemed
> tournament legal**… Konami's official policy was: *'New DUEL TERMINAL cards are not tournament
> legal until they are available through some other method, such as inclusion in a Hidden Arsenal
> set or some other form of Booster Pack or Deck.'*"
> — https://www.edisonformat.com/home/why-arent-they-legal-duel-terminal-1
>   (quoting Konami: https://yugiohblog.konami.com/articles/?p=1622)

So the carve-out is: **cards first introduced in Duel Terminal 1 (DT01, released Jan 29 2010 — inside
the window) whose only in-window printing was the Duel Terminal machine.** Their retail reprints all
landed in **The Shining Darkness (May 11 2010, excluded)** or later sets (out of window) — verified
below — so they are not legal. edisonformat.com links the authoritative complete list as a
DuelingBook deck named **"[E]-DT01 illegal"** (id 8082483):
https://www.duelingbook.com/deck?id=8082483 (retrieved via DuelingBook's `load-deck.php` API).

### 1c. Hidden Arsenal 1 status (direct check)

**Hidden Arsenal (HA01, TCG release Nov 10 2009) = 30 cards (HA01-EN001…EN030).** Checking all 30
by name against **both** authoritative pools:
- edisonformat.net's `EdisonCards.json`: **0 of 30 missing** → all 30 legal.
- EDOPro `!2010.3 Edison` whitelist: **0 of 30 missing** → all 30 legal.

**Conclusion: zero Hidden Arsenal cards are excluded.** HA01 is a fully legal set (also listed as
legal on edisonformat.com's Legal Sets page). The exclusions are DT01 cards.

### 1d. THE EXCLUDED-CARD TABLE (27 cards)

All are monsters first printed in **Duel Terminal 1 (DT01)**. **Reason (identical for all):**
*First/only in-window printing was Duel Terminal 1 (Jan 29 2010); no non-Duel-Terminal release before
the Duelist Pack: Kaiba cutoff, so not tournament-legal per Konami's Duel Terminal policy.* Passcodes
are the standard 8-digit KDB passcodes (from DuelingBook's card data). **Sources (all three agree):**
edisonformat.com "[E]-DT01 illegal" reference deck (https://www.duelingbook.com/deck?id=8082483) =
[DB]; absent from edisonformat.net `EdisonCards.json` (https://edisonformat.net/data/json/EdisonCards.json)
= [EF]; absent from the EDOPro `!2010.3 Edison` whitelist
(https://raw.githubusercontent.com/ThaSMorato/alt-formarts-lflists/main/lflists/Edison.lflist.conf)
= [WL].

| # | Card name | Passcode | Card type | Reason excluded | Source |
|---|-----------|----------|-----------|-----------------|--------|
| 1 | Ally Salvo | 59482302 | Effect (Machine) | DT01-only in-window (retail reprint STBL, Nov 2010, post-cutoff) | DB/EF/WL |
| 2 | Ally of Justice Light Gazer | 19204398 | Effect (Machine) | DT01-only in-window | DB/EF/WL |
| 3 | Ally of Justice Thousand Arms | 85876417 | Effect (Machine) | DT01-only in-window | DB/EF/WL |
| 4 | Ally of Justice Unknown Crusher | 22371016 | Effect (Machine) | DT01-only in-window | DB/EF/WL |
| 5 | Flamvell Archer | 54326448 | Effect (Pyro) | DT01-only in-window (retail reprint DREV, Aug 2010, post-cutoff) | DB/EF/WL |
| 6 | Flamvell Fiend | 91711547 | Effect (Fiend) | DT01-only in-window | DB/EF/WL |
| 7 | Flamvell Poun | 28332833 | Tuner (Pyro) | DT01-only in-window | DB/EF/WL |
| 8 | Genex Controller | 68505803 | Normal Tuner (Machine) | DT01-only in-window (first retail reprint TSHD, May 2010 — itself excluded) | DB/EF/WL |
| 9 | Genex Power Planner | 30399511 | Effect (Spellcaster) | DT01-only in-window | DB/EF/WL |
| 10 | Genex Searcher | 67483216 | Effect (Machine) | DT01-only in-window | DB/EF/WL |
| 11 | Genex Undine | 04904812 | Effect (Aqua) | DT01-only in-window | DB/EF/WL |
| 12 | Genex Worker | 93882364 | Effect (Machine) | DT01-only in-window | DB/EF/WL |
| 13 | Hydro Genex | 47421985 | Synchro (Machine) | DT01-only in-window (first retail reprint TSHD, May 2010 — itself excluded) | DB/EF/WL |
| 14 | Mist Condor | 65549080 | Effect (Winged Beast) | DT01-only in-window | DB/EF/WL |
| 15 | Mist Valley Watcher | 29054481 | Effect (Spellcaster) | DT01-only in-window | DB/EF/WL |
| 16 | Mist Valley Windmaster | 92933195 | Tuner (Winged Beast) | DT01-only in-window | DB/EF/WL |
| 17 | Numbing Grub in the Ice Barrier | 92065772 | Effect (Insect) | DT01-only in-window | DB/EF/WL |
| 18 | Reese the Ice Mistress | 30276969 | Tuner (Sea Serpent) | DT01-only in-window (retail reprint SDRE/GLD3, post-cutoff) | DB/EF/WL |
| 19 | Worm Falco | 58760121 | Effect (Reptile) | DT01-only in-window | DB/EF/WL |
| 20 | Worm Gulse | 85754829 | Effect (Reptile) | DT01-only in-window | DB/EF/WL |
| 21 | Worm Hope | 11159464 | Effect (Reptile) | DT01-only in-window | DB/EF/WL |
| 22 | Worm Illidan | 57543573 | Effect (Reptile) | DT01-only in-window | DB/EF/WL |
| 23 | Worm Jetelikpse | 84932271 | Effect (Reptile) | DT01-only in-window | DB/EF/WL |
| 24 | Worm King | 10026986 | Effect (Reptile) | DT01-only in-window (retail reprint STOR, Feb 2011, post-cutoff) | DB/EF/WL |
| 25 | X-Saber Palomuro | 96099959 | Tuner (Reptile) | DT01-only in-window | DB/EF/WL |
| 26 | X-Saber Pashuul | 23093604 | Effect (Warrior) | DT01-only in-window | DB/EF/WL |
| 27 | X-Saber Wayne | 83810690 | Synchro (Warrior) | DT01-only in-window (retail reprint 5DS3, post-cutoff) | DB/EF/WL |

Reprint-set verifications (sampled) via YGOPRODeck card database
(https://db.ygoprodeck.com/api/v7/cardinfo.php): Ally Salvo → DT01, STBL; Flamvell Archer → DT01,
DREV; Genex Controller → DT01, TSHD, SDFC, BLTR; Hydro Genex → DT01, TSHD; Reese → DT01, GLD3, SDRE;
Worm King → DT01, STOR; X-Saber Wayne → DT01, 5DS3. In every case the only in-window print is DT01;
the earliest retail reprint is TSHD (excluded) or later (out of window).

### 1e. Any *other* (non-DT01) in-window exclusions?

**No.** Beyond these 27 DT01 cards, no other card printed on/before the Duelist Pack: Kaiba cutoff is
excluded from the pool. Everything else in-window is legal (subject to the March 2010 banlist copy
caps). Sets released after the cutoff — The Shining Darkness (TSHD, May 11 2010) and everything later,
plus Hidden Arsenal 2 (May 2010) — are *out of window*, i.e. simply not in the pool rather than
"in-window exclusions."

> **JS-rendering note:** edisonformat.net's `/rules/banlist` and list pages are client-side rendered,
> so the excluded-card list is **not** in the page HTML. I obtained the exclusions from (a)
> edisonformat.com's documented DT01 policy + its "[E]-DT01 illegal" DuelingBook deck, and confirmed
> them by their **absence** from edisonformat.net's own machine-readable deckbuilder DB
> (`/data/json/EdisonCards.json`) and from the EDOPro `!2010.3 Edison` whitelist.

---

## 2. The precise legal SET list

Enumerated from **edisonformat.com/legal-sets.html** (the fully-documented Legal Sets page; static
HTML). Release dates are North American TCG.

### Core (main Booster) sets — 33, LOB → Absolute Powerforce
Legend of Blue-Eyes White Dragon (LOB, Mar 8 2002); Metal Raiders (MRD); Magic/Spell Ruler (SRL);
Pharaoh's Servant (PSV); Labyrinth of Nightmare (LON); Legacy of Darkness (LOD); Pharaonic Guardian
(PGD); Magician's Force (MFC); Dark Crisis (DCR); Invasion of Chaos (IOC); Ancient Sanctuary (AST);
Soul of the Duelist (SOD); Rise of Destiny (RDS); Flaming Eternity (FET); The Lost Millennium (TLM);
Cybernetic Revolution (CRV); Elemental Energy (EEN); Shadow of Infinity (SOI); Enemy of Justice (EOJ);
Power of the Duelist (POTD); Cyberdark Impact (CDIP); Strike of Neos (STON); Force of the Breaker
(FOTB); Tactical Evolution (TAEV); Gladiator's Assault (GLAS); Phantom Darkness (PTDN); Light of
Destruction (LODT); The Duelist Genesis (TDGS); Crossroads of Chaos (CSOC); Crimson Crisis (CRMS);
Raging Battle (RGBT); Ancient Prophecy (ANPR); Stardust Overdrive (SOVR); **Absolute Powerforce
(ABPF, Feb 16 2010) — last legal Core Booster.**

### Side sets (compilations / Duelist Packs / Retro / Gold / Hidden Arsenal)
Dark Beginning 1–2; Dark Revelation 1–4; Duelist Pack: Jaden Yuki, Chazz Princeton, Jaden Yuki 2,
Aster Phoenix, Zane Truesdale, Jaden Yuki 3, Jesse Anderson, Yusei; Premium Pack 1–2; Retro Pack 1–2;
Gold Series, Gold Series 2009; Dark Legends; Duelist Pack: Yugi; **Hidden Arsenal (HA01, Nov 10
2009)**; Duelist Pack: Yusei 2 (DP09, Jan 26 2010); **Duelist Pack: Kaiba (DPKB, Apr 20 2010) —
edisonformat cutoff product.**

### Tournament & promotional packs
Tournament Pack 1st–8th Season / TP4–TP8; Champion Pack: Game One–Eight; **Turbo Pack: Booster One
(TU01) & Booster Two (TU02, Jan 9 2010)**; Hobby League Series 1–7; Duelist League Series 1–10 +
Series 2010 (DL09, Aug 15 2009) + Demo; McDonald's Promos 1–2; Kids' WB!; Exclusive Pack; Movie Pack;
Anniversary Pack (YAP1).

### Decks (Starter + Structure)
Starter Decks: Yugi, Kaiba, Joey, Pegasus, Yugi Evolution, Kaiba Evolution, 2006, Jaden Yuki, Syrus
Truesdale, 5D's (2008), 5D's 2009. Structure Decks: Dragon's Roar; Zombie Madness; Blaze of
Destruction; Fury from the Deep; Warrior's Triumph; Spellcaster's Judgment; Invincible Fortress; Lord
of the Storm; Dinosaur's Rage; Machine Re-Volt; Rise of the Dragon Lords; The Dark Emperor; Zombie
World; Spellcaster's Command; Warriors' Strike (SDWS, Oct 27 2009); **Machina Mayhem (SDMM, Feb 23
2010) — last legal Structure Deck (introduces Machina Fortress).**

### Video-game promos
Through **Yu-Gi-Oh! 5D's World Championship 2010: Reverse of Arcadia (WC10, Feb 23 2010).**

### JUMP / Manga / Prize card caps (edisonformat.com)
Latest SJC prize card = "Dark End Dragon" (SJCS-EN007); latest JUMP subscription promo = "Cyber
Eltanin" (JUMP-EN038); latest GX manga promo = "Elemental Hero Absolute Zero" (YG04-EN001).

### EXCLUDED sets
- **Duel Terminal 1 (DT01, Jan 29 2010)** — *not* a legal set; only its cards that were also released
  elsewhere in-window are legal (its 27 DT-exclusive cards are the §1 carve-out).
- **The Shining Darkness (TSHD, May 11 2010)** — first excluded Core Booster; and **all later Core
  Boosters**.
- **Hidden Arsenal 2 (May 2010) and later**, and every other product released after the DPKB cutoff.

**Cutoff spot-checks against edisonformat.net's own DB (`EdisonCards.json`)** — all pass:
Malefic Blue-Eyes White Dragon (DPKB's one new card) = PRESENT (confirms DPKB inclusion); Machina
Fortress (SDMM) = PRESENT; Ally of Justice Catastor (HA01) = PRESENT; the 43 Forbidden cards (e.g.
Dark Hole, Raigeki, Pot of Greed) = PRESENT (in-pool at 0 copies); Infernity Barrier & Infernity
Launcher (TSHD) = ABSENT (confirms TSHD exclusion); Pot of Duality (later) = ABSENT; Genex Controller
(DT01-only) = ABSENT.

Source: https://www.edisonformat.com/legal-sets.html ; release dates corroborated on Yugipedia set
pages (linked from that page).

---

## 3. Precise legal card COUNT

Two independent machine-readable authorities, both retrieved and counted directly:

| Source | Unique cards | Notes |
|--------|-------------|-------|
| **edisonformat.net deckbuilder DB** (`/data/json/EdisonCards.json`) | **3,681** | The founder's anchor site. Unique by both `id` and `Name`. Includes the 43 Forbidden cards (present in-pool, 0 copies). This is the pool the .net deckbuilder enforces. |
| **EDOPro `!2010.3 Edison` whitelist** (ThaSMorato `Edison.lflist.conf`) | **3,671** (3,674 passcodes) | `$whitelist` mode: only listed passcodes are legal. 3,674 passcodes = 3,671 unique cards (3 alt-art forbidden dupes: Harpie's Feather Duster, Monster Reborn, Ring of Destruction). Engine-enforceable directly. |

**Basis / reconciliation:** The two counts differ by ~10. After normalizing punctuation
(`#1`↔`1`, `"A"`↔`A`, `/Assault Mode`↔` Assault Mode`, parenthetical disambiguators), only ~12
genuine differences remain — a handful of tokens (e.g. "Sheep Token") and anime/manga-promo edge
cases (e.g. the three "Wicked God" cards, "Orichalcos Shunoros") that the two databases classify
differently. This does not affect the exclusion analysis.

**Banlist composition (identical across edisonformat.net `banlist.js`, the whitelist, and the
March 2010 TCG list):** **43 Forbidden, 70 Limited, 19 Semi-Limited**; everything else in-pool is
Unlimited (max 3). Copy caps apply to Main+Extra+Side combined.

**Recommendation for the frozen allow-list:** adopt **edisonformat.net's `EdisonCards.json` (3,681)**
as the source of truth for *membership* (it's the founder's site), and use the EDOPro whitelist's
per-card limits (0/1/2/3) for banlist status. The ~12-card delta should be resolved with the founder
during sign-off (most are tokens/anime-promos and won't appear in real decks). The community's own
"~4,500 unique cards" figure (goatworld guide) is a loose estimate and is **not** supported by either
machine-readable pool — the real number is ~3,68x.

---

## 4. Side Deck rule

**Canonical rule = 0–15 (any size up to 15), NOT "exactly 0 or 15."** Authority: the official
Yu-Gi-Oh! 5D's rulebook (Master Rule 1 era = the exact Edison ruleset), which edisonformat.com hosts
and links as its Rulebook (https://www.edisonformat.com/rulebook.html →
`…/yugioh5dsofficialrulebook.pdf`):

- Deck-list section: "**Side Deck … (0 to 15 cards)**."
- "The number of cards in your Side Decks must **not exceed 15**. The number of cards in your Side
  Deck **before and after you swap any cards must be exactly the same**."
- Match procedure: "Both players show each other their Side Decks… confirming that they have **15 or
  fewer cards**… count the cards of your Side Deck for your opponent again to show that the number of
  your cards remain the same."

So: any size 0–15 is legal; the only constraints are (a) ≤ 15 and (b) its size is fixed for the whole
match and swaps are 1-for-1. There is **no** "must be exactly 15 if used" requirement in the 2010
rulebook. (The "exactly 15" idea is a common misconception / a different era's convention; it does not
apply to Edison.)

---

## 5. Who-goes-first convention

**The winner of the die roll / coin toss (or rock-paper-scissors) chooses to go first or second**
("choose play or draw" — confirmed). Authority: official 5D's-era rulebook (as above):

- "**Play rock-paper-scissors or flip a coin. The winner decides to go first or second in the Duel.**
  For your next Duels, the **loser of the previous Duel decides who goes first.** If the previous Duel
  ended in a tie, determine who starts first… with another coin toss."
- First-turn draw: **the player going first DOES draw on turn 1.** edisonformat.com Rule Difference #1:
  "In Edison Format, a card is drawn during the first draw phase of the duel. Thus, the player who
  goes first starts the duel with 6 cards." (https://www.edisonformat.com/edison-rule-differences.html)
- Era caveat to encode: "The **player who goes first cannot conduct a Battle Phase in their very first
  turn**" (5D's rulebook). (This is separate from the who-chooses question but relevant to turn-1
  logic.)

So the app should: let the roll winner pick first/second; whoever takes turn 1 draws for turn; and
disable the Battle Phase on the opening player's first turn.

---

## 6. Confidence & open items

**High confidence (multiple independent sources agree):**
- The 27 excluded in-window cards are DT01 cards (edisonformat.com reference deck), and they are
  absent from **both** edisonformat.net's own DB **and** the EDOPro whitelist. Passcodes are the
  standard KDB passcodes from DuelingBook card data.
- Zero Hidden Arsenal 1 cards are excluded (all 30 legal in both pools).
- Banlist = 43 Forbidden / 70 Limited / 19 Semi-Limited (edisonformat.net `banlist.js` == whitelist
  == March 2010 TCG list).
- Set list per edisonformat.com Legal Sets; cutoff spot-checks pass against edisonformat.net's DB.
- Side Deck 0–15 and who-goes-first (winner chooses), from the official 5D's rulebook.

**Medium confidence / to confirm at sign-off:**
- **Which count to freeze (3,681 vs 3,671).** Recommend edisonformat.net's `EdisonCards.json` for
  membership; reconcile the ~12-card delta (tokens + a few anime/manga-promo cards) with the founder.
- **Two "edisonformat" sites.** edisonformat.**net** (the group's app/anchor) and edisonformat.**com**
  (older, heavily-documented) share the same convention and their data agrees, but they are separate
  sites. I treated .net's machine-readable DB as authoritative for membership and used .com for the
  documented *reasoning*. Worth a one-line confirmation from the founder that both are "their" source.
- **Passcode exactness.** The 27 passcodes are standard KDB passcodes from DuelingBook. Recommend a
  final diff of these 27 against whatever card DB the engine ships (EDOPro uses standard passcodes for
  these — they are not among the pre-errata `511xxxxxx` alias cases).

**Notable engine nuance surfaced (not asked, but important for the allow-list):** the EDOPro whitelist
represents several **functional-errata** Edison staples by **pre-errata passcodes** in the `511xxxxxx`
range (e.g., Brionac 511002993, Goyo Guardian 511002994, Rescue Cat 511002992, Sangan 511002631,
Brain Control 511002995, Future Fusion 511002997, Imperial Order 511002996), not their standard KDB
passcodes. A passcode-based allow-list must account for this or it will wrongly flag those cards as
illegal. (This aligns with the prior decision to curate a pre-errata card set.)

**Biggest remaining uncertainty:** the exact frozen count (3,681 vs 3,671) — the ~12-card delta
between edisonformat.net's DB and the EDOPro whitelist (tokens + a few anime/manga promos) needs a
human decision at sign-off. It does not affect the 27-card exclusion carve-out, which is rock-solid.

---

## Sources (URLs)
- edisonformat.net banlist statement + data: https://edisonformat.net/rules/banlist ; data file
  https://edisonformat.net/rules/banlist.js
- edisonformat.net legal card DB (deckbuilder): https://edisonformat.net/data/json/EdisonCards.json
- edisonformat.com Legal Sets: https://www.edisonformat.com/legal-sets.html
- edisonformat.com "Why aren't they legal? Duel Terminal 1" (+ Konami policy quote):
  https://www.edisonformat.com/home/why-arent-they-legal-duel-terminal-1 ;
  Konami source: https://yugiohblog.konami.com/articles/?p=1622
- edisonformat.com "[E]-DT01 illegal" complete exclusion list (DuelingBook):
  https://www.duelingbook.com/deck?id=8082483
- edisonformat.com Rule Differences (first-turn draw = Rule #1):
  https://www.edisonformat.com/edison-rule-differences.html
- Official 5D's rulebook (Side Deck 0–15; who-goes-first): https://www.edisonformat.com/rulebook.html
  → https://www.edisonformat.com/uploads/1/3/4/1/134149181/yugioh5dsofficialrulebook.pdf
- EDOPro `!2010.3 Edison` whitelist (`$whitelist`):
  https://raw.githubusercontent.com/ThaSMorato/alt-formarts-lflists/main/lflists/Edison.lflist.conf
  (NOTE: the repo named in the brief, `diamonddudetcg/edopro-custom-banlists`, does **not** contain an
  Edison list — it only ships the Common Charity banlist. The working `!2010.3 Edison` `$whitelist`
  file is in `ThaSMorato/alt-formarts-lflists`.)
- Card printing / passcode verification: https://db.ygoprodeck.com/api/v7/cardinfo.php (YGOPRODeck)
- March 2010 TCG F&L list (banlist cross-check): https://yugipedia.com/wiki/March_2010_Lists_(TCG)
