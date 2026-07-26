# Edison Format — Definitive Research Brief

**Purpose:** Ground-truth reference for a rules-enforcing Edison-format duel simulator + deck
builder for a private group. Accuracy is treated as sacred: every factual claim is cited, and
inferences are labeled as such.

**Scope note on sources:** The group's anchor source is **edisonformat.net** (what they actually
use). Its banlist/rules pages are largely rendered client-side (JavaScript), so the raw card lists
did not come through a plain fetch; where that happens, this brief uses the *same* underlying data
from authoritative mirrors (Konami's archived March 2010 list via Yugipedia) and says so explicitly.

---

## 1. Precise definition of Edison format & the card-pool cutoff

**Edison** is a fan-maintained *retro* format that freezes Yu-Gi-Oh! at the **March 2010** TCG
competitive environment. It is named after the Shonen Jump Championship held in **Edison, New Jersey
(March 27–28, 2010)**, won by Jeff Jones' Quickdraw Plant deck. (formatlibrary.com/formats/edison;
goatworld.community guide.)

> The Format Library summary: "Edison is a 5D's era format and one of the most popular retro
> Yu-Gi-Oh! TCG formats… The format's name comes from the 75th Shonen Jump Championship held in
> Edison, New Jersey, which was won by Jeff Jones's iconic Quickdraw Plant deck."
> — https://www.formatlibrary.com/formats/edison

### The card-pool cutoff — and a correction to the brief's assumption

**The commonly-cited "up through The Shining Darkness (~April 2010)" is INCORRECT on both counts.**
The Shining Darkness (TSHD) is the *first EXCLUDED* Core Booster, and its TCG release was **not**
April.

- **Anchor source (edisonformat.net):** "Edison Format uses the March 2010 Yugioh TCG Banlist
  (Forbidden and Limited List). **Cards up to and including the release of Duelist Pack: Kaiba are
  legal.** Note that some cards which were printed during this time are nonetheless not legal for
  play, like some Hidden Arsenal cards."
  — https://edisonformat.net/rules/banlist
- **Last legal *Core Booster* (main set):** **Absolute Powerforce (ABPF)** — TCG NA release
  **February 16, 2010** (EU/OC Feb 12; other-language Feb 11). It is the *seventh* Series 6 Core
  Booster and was "followed by The Shining Darkness."
  — https://yugipedia.com/wiki/Absolute_Powerforce
- **edisonformat.net's stated cutoff product:** **Duelist Pack: Kaiba (DPKB)** — TCG NA release
  **April 20, 2010** (EU/OC Apr 16; other-language Apr 15). DPKB is a **reprint-heavy** Duelist Pack
  (Blue-Eyes line, Crush Card Virus, Ring of Destruction, Pot of Greed reprints, etc.); its only
  notable new card is *Malefic Blue-Eyes White Dragon*.
  — https://yugipedia.com/wiki/Duelist_Pack:_Kaiba
- **First EXCLUDED Core Booster:** **The Shining Darkness (TSHD)** — TCG NA release
  **May 11, 2010** (EU/OC May 7; other-language May 6; OCG Japanese Feb 20, 2010). It introduced
  meta-warping cards such as *Infernity Barrier*, which is exactly why the format cuts before it.
  — https://yugipedia.com/wiki/The_Shining_Darkness

**Why this is internally consistent (important for engineers):** In the TCG, DPKB (Apr 20) released
*before* TSHD (May 11), so "include everything up to Duelist Pack: Kaiba, exclude The Shining
Darkness" is a coherent chronological cutoff — not a contradiction. Note, however, that the SJC
Edison tournament itself (Mar 27–28) *predates* DPKB; including DPKB is a deliberate community choice
(it adds essentially only reprints). The **March 2010 banlist took effect March 1, 2010**
(Yugipedia), so the format window is roughly **March 1 – ~May 11, 2010** (~2.5 months of real
competitive history), which is why community write-ups say the format "lasted about two and a half
months." (ygoprodeck.com/article/an-introduction-to-sjc-edison-format-93251.)

**Also legal / in-pool (verify these are the products your card data must include):**
- **Machina Mayhem Structure Deck (SDMM)** — TCG NA release **February 23, 2010**; introduces
  *Machina Fortress*, a defining Edison card. In-pool. — https://yugipedia.com/wiki/Machina_Mayhem_Structure_Deck
- All main sets from **Legend of Blue-Eyes White Dragon (2002)** through **Absolute Powerforce
  (2010)**, plus Structure Decks, Duelist Packs, Special Editions, tins, and promos released up to
  the cutoff — **minus** cards the banlist forbids and **minus** specific excluded cards (some
  Hidden Arsenal cards). (edisonformat.net; goatworld guide.)

**Convention divergence to record:** Two shorthands circulate. edisonformat.net (canonical for this
group) says the pool runs "**through Duelist Pack: Kaiba**." Several secondary sources instead say
"**through Absolute Powerforce**" / "post-ABPF, pre-TSHD." These describe *almost* the same pool; the
practical difference is only DPKB's reprints + Malefic Blue-Eyes. **Recommendation: treat
edisonformat.net's "through Duelist Pack: Kaiba (with HA carve-outs)" as canonical for this project,
since it's the group's source of truth.**

---

## 2. The banlist (Forbidden & Limited List)

**Version:** The **March 2010 TCG Advanced Format Forbidden & Limited List**, effective
**March 1, 2010 – August 31, 2010**. edisonformat.net states plainly that Edison "uses the March 2010
Yugioh TCG Banlist." The list below is Konami's official March 2010 TCG list as archived/mirrored on
Yugipedia (https://yugipedia.com/wiki/March_2010_Lists_(TCG); Yugipedia cites the archived
yugioh-card.com "Effective March 1, 2010" list). Card *names and status* are facts, not creative
text.

**Canonical convention:** Use the **TCG** March 2010 list (there is also a separate OCG March 2010
list; Edison is a TCG-defined format, so the TCG list is the one to use). This is the single banlist
convention the community uses for Edison — there is no competing "Edison-specific" banlist date; the
only variant format is *Time Travel Edison* (see §7 note), which keeps the same banlist framework but
tweaks the card pool.

### Forbidden (0 copies — illegal in Main, Extra, and Side Deck) — 43 cards
Monsters (18): Black Luster Soldier - Envoy of the Beginning; Chaos Emperor Dragon - Envoy of the
End; Cyber Jar; Cyber-Stein; Dark Magician of Chaos; Dark Strike Fighter; Destiny HERO - Disk
Commander; Fiber Jar; Magical Scientist; Magician of Faith; Makyura the Destructor; Sinister Serpent;
Thousand-Eyes Restrict; Tribe-Infecting Virus; Tsukuyomi; Victory Dragon; Witch of the Black Forest;
Yata-Garasu.
Spells (19): Butterfly Dagger - Elma; Card of Safe Return; Change of Heart; Confiscation; Dark Hole;
Delinquent Duo; Dimension Fusion; Graceful Charity; Harpie's Feather Duster; Last Will; Monster
Reborn; Metamorphosis; Mirage of Nightmare; Painful Choice; Pot of Greed; Premature Burial; Raigeki;
Snatch Steal; The Forceful Sentry.
Traps (6): Crush Card Virus; Exchange of the Spirit; Imperial Order; Last Turn; Ring of Destruction;
Time Seal.

### Limited (max 1 copy)
Monsters: Black Rose Dragon; Blackwing - Gale the Whirlwind; Brionac, Dragon of the Ice Barrier;
Card Trooper; Chaos Sorcerer; Dark Armed Dragon; Elemental HERO Stratos; Exodia the Forbidden One;
Gladiator Beast Bestiari; Gorz the Emissary of Darkness; Goyo Guardian; Left Arm of the Forbidden
One; Left Leg of the Forbidden One; Lumina, Lightsworn Summoner; Marshmallon; Mezuki; Mind Master;
Morphing Jar; Necroface; Necro Gardna; Neo-Spacian Grand Mole; Night Assailant; Plaguespreader
Zombie; Rescue Cat; Right Arm of the Forbidden One; Right Leg of the Forbidden One; Sangan; Snipe
Hunter; Spirit Reaper; Summoner Monk; Tragoedia.
Spells: Advanced Ritual Art; Allure of Darkness; Brain Control; Burial from a Different Dimension;
Card Destruction; Charge of the Light Brigade; Cold Wave; Destiny Draw; Emergency Teleport; Foolish
Burial; Future Fusion; Giant Trunade; Heavy Storm; Level Limit - Area B; Limiter Removal; Megamorph;
Mind Control; Monster Gate; Mystical Space Typhoon; One for One; Overload Fusion; Reasoning;
Reinforcement of the Army; Scapegoat; Swords of Revealing Light.
Traps: Call of the Haunted; Ceasefire; Gravity Bind; Magic Cylinder; Magical Explosion; Mind Crush;
Mirror Force; Ojama Trio; Return from the Different Dimension; Solemn Judgment; The Transmigration
Prophecy; Torrential Tribute; Trap Dustshoot; Wall of Revealing Light.

### Semi-Limited (max 2 copies)
Monsters: Cyber Dragon; Dandylion; Demise, King of Armageddon; Destiny HERO - Malicious; Goblin
Zombie; Honest; Judgment Dragon; Lonefire Blossom; Treeborn Frog.
Spells: Black Whirlwind; Chain Strike; Gold Sarcophagus; Magical Stone Excavation; United We Stand.
Traps: Bottomless Trap Hole; Royal Decree; Royal Oppression; Skill Drain; Ultimate Offering.

*(Everything not listed above is Unlimited — up to 3 copies — provided it is in the legal set pool.)*

**How the banlist is applied in deck construction:** Copy caps apply to the **combined** total across
Main + Extra + Side Deck: Forbidden = 0, Limited = 1, Semi-Limited = 2, everything else = 3.
(https://yugipedia.com/wiki/March_2010_Lists_(TCG); https://yugipedia.com/wiki/Main_Deck.)

---

## 3. Deck construction rules (2010 era)

These follow the **first "Master Rule"** (in effect since the 5D's / Synchro launch, OCG March 15,
2008), which is the ruleset governing 2010. (https://yugipedia.com/wiki/Master_Rule.)

- **Main Deck: 40–60 cards.** Contains Normal/Effect/Ritual monsters, Spells, Traps. Must contain
  only Legal cards.
- **Extra Deck: 0–15 cards.** In Edison this contains **only Fusion and Synchro monsters** (see §4).
  (Called the "Extra Deck" since the 2008 Master Rule renamed the old "Fusion Deck.")
- **Side Deck: 0–15 cards.** Used to swap cards between games of a match.
- **Per-card copy limit: max 3** of any single card name across Main+Extra+Side combined, further
  restricted by the banlist (Forbidden 0 / Limited 1 / Semi-Limited 2).
- **Banlist application:** as in §2 — copy caps are enforced across all three decks combined, and
  Forbidden cards may not appear in *any* of the three.

Sources: https://yugipedia.com/wiki/Master_Rule (deck-size limits introduced by Master Rule);
https://yugipedia.com/wiki/Main_Deck (construction restrictions).

> Note on Side Deck size: the *game rule* is 0–15. Some tournament policies of various eras have
> required a Side Deck, if used, to be *exactly* 15. I could not verify a 2010-specific "exactly 15"
> requirement from a primary source, so the engine should treat 0–15 as the rule and (optionally)
> offer an "exactly 0 or 15" tournament toggle. *(Flagged as an open item — see §8.)*

---

## 4. Mechanics & card types present in-era (March 2010, 5D's Synchro era)

**Confirmed IN:**
- **Synchro Monsters** and **Tuner monsters** — core to the era. Introduced by the first Master Rule
  (OCG March 15, 2008). (https://yugipedia.com/wiki/Master_Rule.) Edison's Extra Deck toolbox
  (Goyo Guardian, Brionac, Stardust Dragon, Black Rose Dragon, Ally of Justice Catastor, etc.) is a
  defining feature. (goatworld guide; duelingnexus.com/blog/edison/.)
- **Fusion Monsters** (Extra Deck) — including **Contact Fusion** (e.g., Gladiator Beast Gyzarus).
- **Ritual Monsters** + Ritual Spells.
- **Gemini**, **Union**, **Spirit**, **Toon**, and **Flip** monsters — all exist by 2010.
  (Union & Spirit monsters appear in in-era sets, e.g., DPKB Union monsters, ABPF's Spirit monster
  "Gundari" — https://yugipedia.com/wiki/Absolute_Powerforce,
  https://yugipedia.com/wiki/Duelist_Pack:_Kaiba.)

**Confirmed OUT (must NOT be present):**
- **Xyz Monsters** — introduced with Master Rule 2, OCG **March 19, 2011** (post-Edison).
- **Pendulum Monsters** — introduced with Master Rule 3, OCG **March 21, 2014**.
- **Link Monsters** — introduced with New Master Rule, OCG **March 25, 2017** / TCG **July 20, 2017**.
(https://yugipedia.com/wiki/Master_Rule.) goatworld puts it plainly: the Edison Extra Deck contains
"only Fusion Monsters and Synchro Monsters… no Xyz Monsters (introduced in 2011), no Pendulum
Monsters (2014), no Link Monsters (2017)."

**Summoning mechanics available in-era:** Normal Summon / Normal Set; Tribute (Advance) Summon;
Flip Summon; Special Summon (by card condition); **Fusion Summon** (and Contact Fusion); **Ritual
Summon**; **Synchro Summon**. (No Xyz/Pendulum/Link Summoning.)

**Extra Deck composition:** Fusion + Synchro only, 0–15 cards.

---

## 5. Approximate legal card-pool size

**~4,000–4,500+ unique cards** (community estimate). The goatworld guide states the pool "includes
approximately 4,500+ unique cards." **Basis:** every TCG card printed from Legend of Blue-Eyes White
Dragon (2002) through the ABPF/DPKB cutoff, *minus* the 43 Forbidden cards and *minus* specifically
excluded cards (some Hidden Arsenal cards). This is a rough figure, not an exact count; a precise
count would require enumerating the legal set list against a card database (e.g., the edisonformat.net
or Format Library card index, or a filtered YGOPRODeck/Yugipedia query).

*Inference/caveat:* Treat "~4,500" as an order-of-magnitude planning number. For the deck builder,
the authoritative legal set is best derived programmatically from a card database filtered to the
in-pool set list (see §1) rather than from this estimate.

---

## 6. Era-specific gameplay rules a rules engine MUST respect (differences from modern Yu-Gi-Oh!)

The 2010 game is the **first "Master Rule"** era (2008–2011). It is recognizably modern in its core
(Normal Summon, chains, Spell Speed, Battle Phase), but several rules differ from today's game and are
frequently the source of bugs when engineers assume modern behavior. Sources:
https://yugipedia.com/wiki/Master_Rule, https://yugipedia.com/wiki/Priority, and the goatworld Edison
guide for the community-facing framing.

1. **Ignition Effect Priority ("priority") — IN EFFECT.** This is the single most important and most
   misunderstood Edison rule. In 2010, when the turn player Summoned a monster, then *during the
   Summon response window* — if no Trigger Effects activated — the **turn player could activate a
   monster's Ignition Effect with priority, as Chain Link 1, before the opponent could activate a
   Spell Speed 2 effect** (e.g., Bottomless Trap Hole / Torrential Tribute). This "did not have to be
   the monster that was just Summoned." Yugipedia: "Ignition Effect priority was removed from the OCG
   on March 19, 2011, while it was removed from the TCG on April 25, 2012." → Both dates are AFTER
   Edison, so Edison uses the OLD rule. (https://yugipedia.com/wiki/Priority.)
   - *Engine consequence:* after a Summon, offer the turn player a priority window to activate an
     Ignition Effect *before* passing priority to the opponent — the opposite of the modern
     "Summon response window restricts players to Fast Effects only" behavior.

2. **First-turn draw — the player going first DRAWS on turn 1.** The rule "the first player no longer
   draws during their first Draw Phase" was a **Master Rule 3 (OCG March 21, 2014)** change — i.e.,
   post-Edison. In 2010 both players draw every turn, including the opening turn.
   (https://yugipedia.com/wiki/Master_Rule; corroborated by goatworld: "In Edison format, the player
   who goes first draws a card during their Draw Phase. Modern Yu-Gi-Oh! eliminated the first-turn
   draw.")

3. **Damage Step rules follow the pre-2014 structure.** Master Rule 3 (2014) "simplified the Damage
   Step into 5 timings"; Edison predates that, so the older Damage Step timing model applies. Per the
   community framing (goatworld), during the Damage Step in this era only a restricted set of things
   can be activated — Counter Traps, mandatory triggered effects, and effects that directly modify
   ATK/DEF (e.g., Honest, Ally of Justice Catastor interactions, Bottomless timing, etc.). This is
   stricter than modern and matters for combat-trick correctness. (Master Rule page for the 2014
   change date; goatworld for the era description. *Treat the exact per-timing activation table as
   needing implementation against a detailed 2010 rulebook / the edisonformat.net "timing" rulings —
   flagged in §8.*)

4. **Field Spell behavior is pre-2014.** Master Rule 3 (2014) established "each player can control 1
   face-up Field Spell Card on their field" and that replacing one *sends the previous to the GY
   instead of destroying it.* Edison predates this. *Inference (grounded in the MR3 change text):* in
   2010 there was effectively a single shared Field Spell in play at a time, and activating a new
   Field Spell **destroyed** the existing Field Spell (including the opponent's). The engine should
   model the pre-MR3 single-field-spell + destruction behavior, not the modern per-player field zone.
   (https://yugipedia.com/wiki/Master_Rule.)

5. **Synchro Summoning procedure.** Send 1 Tuner + one or more non-Tuner monsters you control to the
   GY; the **combined Levels must equal exactly** the Synchro Monster's Level; Summon it from the
   Extra Deck. (goatworld guide.) Note the era has Tuner-based Synchro only — no Xyz/Link alternatives
   — and includes niche in-era procedures like Vayu's GY-based Synchro (Blackwing - Vayu) that the
   engine's Synchro logic should accommodate as card-specific exceptions.

6. **SEGOC (Simultaneous Effects Go On Chain).** Follows the 2010 interpretation; broadly similar to
   modern in most practical cases but with subtle differences in ordering turn-player vs non-turn-
   player mandatory/optional effects on the chain. (goatworld guide — high-level; exact 2010 SEGOC
   ordering should be validated against detailed rulings before implementation. Flagged in §8.)

7. **Ruleset label:** In 2010 the OCG was on the **first Master Rule** (successor to "New Expert
   Rules"). The TCG "managed rules separately" but used the equivalent Synchro-era ruleset; the TCG
   only began formally treating "Master Rule" as its basis in 2020. For engineering purposes, target
   **Master Rule (1st edition, 2008–2011) behavior**. (https://yugipedia.com/wiki/Master_Rule.)

**What is the SAME as modern (safe assumptions):** turn/phase structure (Draw → Standby → Main 1 →
Battle [Start/Battle/Damage/End steps] → Main 2 → End), Spell Speed 1/2/3 and chain resolution,
Normal Summon once per turn, Tribute Summon costs, 8000 starting LP, hand size limit 6, max 3 copies
per card. (https://yugipedia.com/wiki/Master_Rule; goatworld guide.)

---

## 7. Sources & source evaluation

**Primary / anchor — edisonformat.net** (the group's source of truth):
- Banlist & pool definition: https://edisonformat.net/rules/banlist — authoritatively states the
  format uses the March 2010 TCG banlist and that the pool runs "up to and including Duelist Pack:
  Kaiba," with some Hidden Arsenal cards excluded. **Caveat:** the site renders its banlist/rulings
  card lists client-side (JavaScript), so a plain HTTP fetch returns empty Forbidden/Limited/Semi
  sections — you'll need the rendered page, their text version, or an API/scrape to pull the raw list
  programmatically. The *content*, however, is the standard March 2010 TCG list (below).
- What it authoritatively provides: the banlist (as text + visual), **rulings pages** (its metadata
  references priority, timing, Goyo, Ryko, target — i.e., it curates era-specific ruling explanations),
  **decklists**, and **tournament** info, plus a card search. It is a *living community reference*, not
  a Konami primary source — treat it as canonical for *format definition* but cross-check individual
  *rulings* against the underlying 2010 rules where correctness is critical.

**Authoritative cross-checks:**
- **Yugipedia — March 2010 TCG Forbidden & Limited List** (mirrors Konami's archived official list):
  https://yugipedia.com/wiki/March_2010_Lists_(TCG) — the definitive banlist content used in §2.
- **Yugipedia — set pages** (release dates, contents): Absolute Powerforce
  https://yugipedia.com/wiki/Absolute_Powerforce ; The Shining Darkness
  https://yugipedia.com/wiki/The_Shining_Darkness ; Duelist Pack: Kaiba
  https://yugipedia.com/wiki/Duelist_Pack:_Kaiba ; Machina Mayhem SD
  https://yugipedia.com/wiki/Machina_Mayhem_Structure_Deck
- **Yugipedia — ruleset**: Master Rule https://yugipedia.com/wiki/Master_Rule ; Priority
  https://yugipedia.com/wiki/Priority ; Main Deck (construction)
  https://yugipedia.com/wiki/Main_Deck
- **Format Library (formatlibrary.com)** — recognized retro-format resource with an Edison hub,
  decklists, and history: https://www.formatlibrary.com/formats/edison
- **ygoprodeck** — format primer and a machine-readable Edison banlist:
  https://ygoprodeck.com/article/an-introduction-to-sjc-edison-format-93251 ;
  https://ygoprodeck.com/banlist/?list=Edison&date=2010-03-01
- **goatworld.community** — detailed 2026 Edison guide (rules, decks, mechanics framing):
  https://goatworld.community/blog/what-is-edison-format-complete-guide
- **Dueling Nexus** — Edison deep-dive + a browser-based automated sim with an Edison queue:
  https://duelingnexus.com/blog/edison/
- **Where the scene plays (for reference):** DuelingBook (manual sim, Edison rated ladder — the
  "operate everything yourself" competitive standard), EDOPro / Project Ignis (automated, custom
  Edison banlist lobbies), Dueling Nexus (browser, automated). (goatworld guide.) The r/EdisonFormat
  subreddit and the edisonformat.net / edisonformat.com Discords are the community hubs.

**Variant to be aware of — "Time Travel Edison" (TTE):** same core rules and banlist framework as
standard Edison, but with a *curated* set of cards added from later sets to broaden the meta. Standard
Edison (the historically-frozen March 2010 pool) is more popular and is what this project should
target unless the group says otherwise. (goatworld guide.)

---

## 8. Confidence & open questions

**High confidence (multiple sources incl. authoritative Yugipedia/Konami mirror):**
- Format = March 2010 TCG environment; banlist = March 2010 TCG F&L list (effective Mar 1, 2010).
- Full Forbidden/Limited/Semi-Limited lists in §2 (Konami's official list via Yugipedia).
- Set dates: ABPF NA 2010-02-16; DPKB NA 2010-04-20; TSHD NA 2010-05-11; Machina Mayhem NA
  2010-02-23. TSHD and all later sets are EXCLUDED.
- Synchro/Tuner IN; Xyz/Pendulum/Link OUT (with exact introduction dates).
- Deck sizes (Main 40–60, Extra 0–15, Side 0–15), 3-copy cap, banlist applied across all decks.
- Ignition Effect Priority IN EFFECT (removed TCG 2012-04-25); first-turn draw present (removed 2014);
  Damage Step & Field Spell rules are pre-2014.

**Medium confidence / needs confirmation before it's hard-coded:**
- **The "last legal set" convention.** edisonformat.net says "through Duelist Pack: Kaiba"; other
  sources say "through Absolute Powerforce." These differ only by DPKB (reprints + Malefic BEWD).
  **Recommend confirming with the founder which convention the group plays,** then defining the legal
  set list precisely in the spec (this is an explicit output contract for the deck builder).
- **The exact list of excluded Hidden Arsenal (and any other) cards.** edisonformat.net notes "some
  Hidden Arsenal cards" are not legal but the plain fetch didn't yield the enumerated list. This must
  be pulled from the rendered edisonformat.net pool / Format Library card index before the deck
  builder can enforce legality correctly. **Open item — get the authoritative machine-readable legal
  card list from edisonformat.net or Format Library.**
- **Side Deck "exactly 15 vs 0–15."** Game rule is 0–15; a 2010 tournament-policy "exactly 15 if
  used" requirement is plausible but I could not verify it from a primary source. Suggest defaulting
  to 0–15 with an optional strict toggle.
- **Exact Damage Step activation table and 2010 SEGOC ordering.** The high-level behavior is clear
  (pre-2014, restrictive), but the precise per-timing rules should be implemented against a detailed
  2010 rulebook and/or edisonformat.net's rulings pages, not the summaries here.
- **Card-pool count (~4,500).** Community estimate only; derive the real number programmatically from
  the legal set list + banlist rather than treating 4,500 as exact.

**Could not fully verify (did not invent rulings):**
- The precise mechanical wording of every Edison-era ruling (e.g., exact timing windows for specific
  card interactions). edisonformat.net's rulings pages are the group's reference for these; because
  those pages are JS-rendered, they should be consulted directly (rendered) when implementing
  card-specific behavior. No rulings have been fabricated in this brief.
