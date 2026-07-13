# Edison Format — Functional Errata Gap List (36 entries)

Source: edisonformat.com/functional-errata.html (canonical) + ProjectIgnis/CardScripts audit.

Status codes:
- **substitute-ready** — community pre-errata script exists AND is wired by the community banlist.
- **script-exists-unused** — Edison-correct pre-errata script exists in CardScripts but NOT used by community banlist.
- **needs-authoring** — no usable Edison-correct script; must be authored or heavily edited.
- **rules-not-script** — difference is an engine/rules flag, not a per-card script fix.

| # | Card name | Real passcode | Edison-correct behavior | Modern shipped behavior | Status |
|---|-----------|--------------|------------------------|------------------------|--------|
| 1 | Brionac, Dragon of the Ice Barrier | 50321796 | Discard any # of cards → return that many cards from field to hand. **No once-per-turn.** | Modern script has hard OPT `SetCountLimit(1,id)` | substitute-ready |
| 2 | Sangan | 26202165 | When sent field→GY: add ≤1500-ATK monster from Deck. **No OPT;** searched monster effects usable freely. | Modern adds hard OPT `SetCountLimit(1,id)` ("once per turn") | substitute-ready |
| 3 | Rescue Cat | 14878871 | Send face-up → SS 2 Lv≤3 Beasts from Deck (destroyed End Phase). **No once-per-name.** Summoned monsters' effects not negated. | Modern has hard OPT `SetCountLimit(1,id)`; also negates summoned monsters' effects | substitute-ready |
| 4 | Goyo Guardian | 7391448 | 1 Tuner + 1+ non-Tuners. **Any Tuner** (non-EARTH allowed). Steals monster destroyed by battle. | Modern requires EARTH Tuner: `AddProcedure(...ATTRIBUTE_EARTH...)` | substitute-ready |
| 5 | Brain Control | 87910978 | Pay 800 LP; take control of 1 face-up opp monster until End Phase. **No restrictions.** | Modern errata adds targeting/use restrictions; OPT in shipped script | substitute-ready |
| 6 | Future Fusion | 77565204 | Send Fusion Materials from Deck to GY; SS Fusion on 2nd Standby. Send **on resolution**; can't activate if can't SS. | Modern errata reworked timing/OPT/send-as-activation | substitute-ready |
| 7 | Red-Eyes Darkness Metal Dragon | 88264978 | Banish 1 face-up Dragon → SS this (**no once-per-name**). [Ign] once/turn SS 1 Dragon from hand/GY (**no once-per-name;** each copy acts). | ProjectIgnis pre-errata script `c88264978.lua` still has once-per-**name** on both effects — NOT Edison-accurate | needs-authoring |
| 8 | Necrovalley | 47355498 | Negate effects targeting a card in either GY; GY cards can't be banished; GK +500/+500. Effects that **don't target** (Rekindling, Treeborn) are NOT negated. | Modern PSCT reworked wording/targeting scope | script-exists-unused |
| 9 | Ryko, Lightsworn Hunter | 21502796 | FLIP: **optionally** target 1 card; destroy if chosen; then mill top 3 (mandatory). | Modern PSCT targeting/optionality wording differs | script-exists-unused |
| 10 | Catapult Turtle | 95727991 | Tribute 1 monster → 1/2 its ATK as damage. **No once-per-turn.** | Modern script adds OPT/PSCT | script-exists-unused |
| 11 | Ancient Fairy Dragon | 25862681 | [Ign] SS 1 Lv≤4 from hand (no BP). [Ign] **destroy** a Field Spell (does NOT target); if destroyed, gain 1000 LP + may add Field Spell from Deck. | Modern errata changed field-spell effect to "send"/target and reworked | script-exists-unused |
| 12 | Darkness Approaches | 80168720 | Discard 2 → flip 1 face-up monster face-down **without changing battle position** (can make face-down Attack Position). | Modern errata removed the position quirk | script-exists-unused |
| 13 | Ultimate Offering | 80604091 | [Quick] pay 500 LP → Normal Summon/Set 1 extra monster (Main Phase or opp's Battle Phase). Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | script-exists-unused |
| 14 | Armory Arm | 29071332 | [Trigger] damage = destroyed monster's ATK **it had on field** (incl. modifiers), even if it leaves GY. (Colossal Fighter + Armory Arm OTK works.) | Modern errata changed damage source/timing | needs-authoring |
| 15 | Black Garden | 71645242 | [Trigger] on Normal/Special Summon: halve ATK + give opponent Rose Token. **Activates even if monster is SSed FACE-DOWN.** | Modern errata: does not trigger on face-down SS | needs-authoring |
| 16 | Destiny End Dragoon | 76263644 | [Ign] once/turn destroy opp monster + burn = ATK. [Trigger] Standby: banish "Destiny Hero" from GY → SS this. Trigger has **NO once-per-turn.** | Modern adds OPT to revival trigger | needs-authoring |
| 17 | Elemental HERO Prisma | 89312388 | [Ign] once/turn reveal Fusion, send listed material from Deck to GY; become that monster until End Phase. Send **on resolution, NOT a cost.** | Modern PSCT/wording; send-as-cost vs on-resolution nuance | needs-authoring |
| 18 | Fortune Lady Light | 34471458 | [Trigger] when removed from field by card effect → SS 1 "Fortune Lady" from Deck. **Can trigger when leaving face-down** (reveal it). | Modern errata restricts to face-up / PSCT | needs-authoring |
| 19 | Light and Darkness Dragon | 47297616 | [Trigger] on destruction: pick 1 monster in GY, **then** destroy all cards you control, **then** SS that monster — sequential. | Modern PSCT reordered/"then" grouping differs | needs-authoring |
| 20 | Dark End Dragon | 88643579 | [Ign] once/turn: lose 500 ATK/DEF **and** send 1 opp monster to GY. If target leaves field first, this card **still loses 500 ATK/DEF.** | Modern PSCT "and if you do" grouping differs | needs-authoring |
| 21 | Light End Dragon | 25132288 | [Trigger] at attack declaration: this loses 500 ATK/DEF (permanent), battled monster loses 1500 until End Phase. If opp leaves first, this **still loses 500.** | Modern PSCT grouping differs | needs-authoring |
| 22 | Mark of the Rose | 45247637 | Two **separate** [Trigger] effects (End Phase give back; Standby regain) — both start Chain independently. | Modern PSCT merges/changes them | needs-authoring |
| 23 | Mausoleum of the Emperor | 80921533 | [Ign] both players may Normal Summon without Tributing by paying 1000×tributes. Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | needs-authoring |
| 24 | My Body as a Shield | 69279219 | Pay 1500 LP when opp activates card **with effect that would destroy monsters** → negate + destroy it. Can chain to face-up Royal Oppression. | Modern PSCT narrowed activation trigger wording | needs-authoring |
| 25 | Quickdraw Synchron | 20932152 | [Ign] send 1 monster from hand to GY → SS this. **Send (not discard), on resolution (not a cost).** | Modern PSCT / send-as-cost wording differs | needs-authoring |
| 26 | Soul Exchange | 68005187 | Select 1 opp monster; may Tribute it as if you controlled it this turn (no BP). **Tributing is OPTIONAL** — not forced at earliest opportunity. | Modern PSCT wording | needs-authoring |
| 27 | Strike Ninja | 41006930 | [Quick] banish 2 DARK from GY → banish this until End Phase. Once per turn **per copy** → multiple Strike Ninjas can each use it in same turn. | Modern PSCT hard-OPT blocks multiple copies | needs-authoring |
| 28 | Swap Frog | 9126351 | [Ign] once/turn return 1 monster to hand → NS 1 "Frog" in addition to NS. **Each Swap Frog** can use it once; only **1** extra NS total. | Modern PSCT wording of extra-Normal-Summon interaction | needs-authoring |
| 29 | Treeborn Frog | 12538374 | [Trigger] Standby, if in GY + no S/T → SS it. **No once-per-turn.** | Modern errata added hard OPT ("once per turn") | needs-authoring |
| 30 | Urgent Tuning | 94634433 | Battle-Phase-only: Synchro Summon. Summon **on resolution** (Solemn can't negate). | Modern PSCT wording; timing basis differs | needs-authoring |
| 31 | Cyber Phoenix | 3370104 | Must be **face-up before being selected as attack target** for Trigger to meet activation condition. | Post-2010 damage-step ruling change; card text unchanged | rules-not-script |
| 32 | D.D. Survivor | 48092532 | Same damage-step "face-up before attack-target" ruling for End-Phase self-SS trigger. | Post-2010 damage-step ruling change | rules-not-script |
| 33 | Jade Knight | 44364207 | Same damage-step "face-up before attack-target" ruling for its search Trigger. | Post-2010 damage-step ruling change | rules-not-script |
| 34 | Lumina, Lightsworn Summoner *(all Lightsworns/Judgment Dragon)* | 95503687 | **Phase-dependent mandatory Trigger** (End-Phase mill): re-activates if its **activation** is negated (LADD); does NOT if only **effect** is negated (Skill Drain). | Post–Duelist Saga errata changed this behavior | rules-not-script |
| 35 | Machina Gearframe *(all Union monsters)* | 42940404 | Union monsters carry "A monster can only be equipped with 1 Union at a time." Destroy-redirect clause only on specific list. | 2016 SDKS removed the 1-Union-per-monster condition and standardized redirect clause | rules-not-script |
| 36 | Susa Soldier *(all Spirit monsters)* | 40473581 | Spirit monsters use same phase-dependent mandatory Trigger (return-to-hand End Phase): re-activates if activation negated; not if only effect negated. | Post-2010 Spirit errata (Duelist Saga era) changed this | rules-not-script |

## Bucket summary

| Status | Count | Cards |
|--------|-------|-------|
| substitute-ready | 6 | Brionac, Sangan, Rescue Cat, Goyo Guardian, Brain Control, Future Fusion |
| script-exists-unused | 6 | Necrovalley, Ryko, Catapult Turtle, Ancient Fairy Dragon, Darkness Approaches, Ultimate Offering |
| needs-authoring | 18 | REDMD, Armory Arm, Black Garden, Destiny End Dragoon, Prisma, Fortune Lady Light, LADD, Dark End Dragon, Light End Dragon, Mark of the Rose, Mausoleum, My Body as a Shield, Quickdraw Synchron, Soul Exchange, Strike Ninja, Swap Frog, Treeborn Frog, Urgent Tuning |
| rules-not-script | 6 | Cyber Phoenix, D.D. Survivor, Jade Knight, Lumina (Lightsworns/Spirits Rule #4), Machina Gearframe (Union Rule #3), Susa Soldier (Spirit Rule #4) |
| **Total** | **36** | |

## Notes

- **substitute-ready**: Pre-errata scripts in `CardScripts/pre-errata/` with `511002xxx` passcodes, verified OPT-free. Wired via alias passcodes in `edison-alias-map.json`.
- **script-exists-unused**: Scripts exist in `CardScripts/pre-errata/` but community banlist leaves modern scripts in place. Recommend line-audit then wire to real passcodes.
- **needs-authoring**: REDMD has a pre-errata script but it still enforces once-per-name → must drop `id` from `SetCountLimit` calls. All others need new scripts authored from scratch, prioritised by meta impact (Treeborn Frog OPT, Destiny End Dragoon, REDMD, Strike Ninja, Black Garden, Armory Arm).
- **rules-not-script**: Engine-flag fixes (Spike A). Cyber Phoenix / D.D. Survivor / Jade Knight = damage-step face-up timing. Lightsworn/Spirit = phase-dependent mandatory trigger re-activation (Rule #4). Union = 1-per-monster condition (Rule #3).
