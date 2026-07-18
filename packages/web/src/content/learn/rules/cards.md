---
id: rules.card.reference
section: rules
group: card
title: "Cards That Play Differently"
slug: cards
summary: "The 36 Edison-format cards whose pre-errata text or era rulings make them behave differently from what a modern player expects — each with its Edison behavior, the modern expectation, and the rule it ties to."
keywords:
  [
    armory arm,
    ancient fairy dragon,
    black garden,
    brain control,
    brionac,
    brionac dragon of the ice barrier,
    catapult turtle,
    cyber phoenix,
    dd survivor,
    d.d. survivor,
    dark end dragon,
    darkness approaches,
    destiny end dragoon,
    elemental hero prisma,
    prisma,
    fortune lady light,
    future fusion,
    goyo guardian,
    jade knight,
    light and darkness dragon,
    ladd,
    light end dragon,
    lumina,
    lumina lightsworn summoner,
    lightsworn,
    lightsworns,
    lightsworn mill,
    judgment dragon,
    machina gearframe,
    union,
    union monster,
    union monsters,
    mark of the rose,
    mausoleum of the emperor,
    mausoleum,
    my body as a shield,
    necrovalley,
    quickdraw synchron,
    quickdraw,
    red-eyes darkness metal dragon,
    redmd,
    rescue cat,
    ryko,
    ryko lightsworn hunter,
    sangan,
    soul exchange,
    strike ninja,
    susa soldier,
    spirit,
    spirit monster,
    spirit monsters,
    swap frog,
    treeborn frog,
    treeborn,
    ultimate offering,
    urgent tuning,
    functional errata,
    pre-errata,
    plays differently,
  ]
---

<!-- Track C content — authored from docs/working/2026-07-17-edison-rules-reference.md §3 (functional-errata list, source: edisonformat.com/functional-errata.html) and the QA-verified parity matrix. Passcodes verified against packages/card-data/out/edison-card-catalog.json. -->

Edison format uses each card's **March 2010 text and rulings**. Since then, many of these cards were given official _errata_ — Konami rewrote them — or received new rulings. In Edison you play the **old (pre-errata) version**, so about three dozen cards behave differently from what a modern player expects. This page is the lookup for those cards.

Each entry gives you three things: the card's **Edison behavior**, **what modern players expect**, and **the rule it ties to** (with a link to the relevant rule-difference page where one applies). A few entries carry a **⚠ Known table-difference** callout: those are rulings our app cannot fully reproduce, so you should apply them yourself at the table.

## On this page {#index}

- [Ancient Fairy Dragon](#ancient-fairy-dragon)
- [Armory Arm](#armory-arm)
- [Black Garden](#black-garden)
- [Brain Control](#brain-control)
- [Brionac, Dragon of the Ice Barrier](#brionac)
- [Catapult Turtle](#catapult-turtle)
- [Cyber Phoenix](#cyber-phoenix)
- [D.D. Survivor](#dd-survivor)
- [Dark End Dragon](#dark-end-dragon)
- [Darkness Approaches](#darkness-approaches)
- [Destiny End Dragoon](#destiny-end-dragoon)
- [Elemental HERO Prisma](#elemental-hero-prisma)
- [Fortune Lady Light](#fortune-lady-light)
- [Future Fusion](#future-fusion)
- [Goyo Guardian](#goyo-guardian)
- [Jade Knight](#jade-knight)
- [Light and Darkness Dragon](#light-and-darkness-dragon)
- [Light End Dragon](#light-end-dragon)
- [Mark of the Rose](#mark-of-the-rose)
- [Mausoleum of the Emperor](#mausoleum-of-the-emperor)
- [My Body as a Shield](#my-body-as-a-shield)
- [Necrovalley](#necrovalley)
- [Quickdraw Synchron](#quickdraw-synchron)
- [Red-Eyes Darkness Metal Dragon](#red-eyes-darkness-metal-dragon)
- [Rescue Cat](#rescue-cat)
- [Ryko, Lightsworn Hunter](#ryko-lightsworn-hunter)
- [Sangan](#sangan)
- [Soul Exchange](#soul-exchange)
- [Strike Ninja](#strike-ninja)
- [Swap Frog](#swap-frog)
- [Treeborn Frog](#treeborn-frog)
- [Ultimate Offering](#ultimate-offering)
- [Urgent Tuning](#urgent-tuning)
- [Lightsworn End-Phase mill (all Lightsworns)](#lightsworn-mill)
- [Union monsters (all Unions)](#union-monsters)
- [Spirit monsters (all Spirits)](#spirit-monsters)

---

## Ancient Fairy Dragon {#ancient-fairy-dragon}

Passcode `25862681`.

- **Edison behavior —** Its second Ignition effect (destroy your own Field Spell to gain 1000 LP and add a Field Spell from your Deck) **does not target**. If it does not destroy a Field Spell, you do not gain the LP and you do not add one; the destroy and the LP gain resolve at the same time, and adding the Field Spell happens afterward. It is usable in Main Phase 2.
- **What modern players expect —** The effect targets, and the steps are sequenced differently.
- **Ties to —** Pre-errata card text (Edison plays the old wording).

## Armory Arm {#armory-arm}

Passcode `29071332`.

- **Edison behavior —** Its Trigger inflicts damage **even if the destroyed monster has already left the Graveyard**, equal to the ATK that monster had on the field (including modifiers). This is what makes the classic Colossal Fighter + Armory Arm OTK work.
- **What modern players expect —** Narrower post-errata wording that ties the damage to the monster's current state.
- **Ties to —** Pre-errata card text.

## Black Garden {#black-garden}

Passcode `71645242`.

- **Edison behavior —** Its Trigger (halve the Summoned monster's ATK and give the other player a Rose Token) activates **even when a monster is Special Summoned face-down**.
- **What modern players expect —** It only fires for face-up Summons.
- **Ties to —** Pre-errata card text.

> **⚠ Known table-difference —** At a real table, Black Garden's Trigger fires even when the newly Summoned monster is **face-down**. Our engine only fires it for face-up Special Summons, so when a monster is Special Summoned in face-down Defense Position (for example by The Shallow Grave) the app may not halve its ATK or make the Rose Token — apply this yourself.

## Brain Control {#brain-control}

Passcode `87910978`.

- **Edison behavior —** There is **no modern restriction** on the target. If the taken monster is flipped face-down before the effect resolves, control is unchanged; and control still returns to the owner at the End Phase even if the monster is flipped later.
- **What modern players expect —** A restricted effect (e.g. it cannot target Special-Summoned monsters).
- **Ties to —** Pre-errata card text.

## Brionac, Dragon of the Ice Barrier {#brionac}

Passcode `50321796`.

- **Edison behavior —** Its Ignition effect (discard any number of cards, then return that many cards to the hand) has **NO "once per turn."** You may use it as many times as you can pay for it. The discard is a cost, and it can target cards on either player's field.
- **What modern players expect —** A hard once-per-turn was added by errata.
- **Is Brionac once-per-turn in Edison? No.** It can be used repeatedly in the same turn.
- **Ties to —** Pre-errata card text.

## Catapult Turtle {#catapult-turtle}

Passcode `95727991`.

- **Edison behavior —** Its Ignition effect (Tribute 1 monster to burn the opponent for half that monster's ATK) has **no once-per-turn**, so it can be used repeatedly in a turn.
- **What modern players expect —** The text is largely the same, but the Edison version is explicitly free of any once-per-turn limit.
- **Ties to —** Pre-errata card text.

## Cyber Phoenix {#cyber-phoenix}

Passcode `3370104`.

- **Edison behavior —** It must be **face-up before it is selected as an attack target** for its draw Trigger to meet its condition; it cannot trigger if it is attacked while face-down.
- **What modern players expect —** Modern Problem-Solving Card Text handles this timing automatically.
- **Ties to —** [Rule #8 — The 7-Timing Damage Step](/learn/rules/difference-08-seven-timing-damage-step) (a Damage Step timing ruling).

## D.D. Survivor {#dd-survivor}

Passcode `48092532`.

- **Edison behavior —** Its End-Phase revival Trigger follows the same face-up-timing ruling as the other Damage Step cards — the card must be **face-up** to meet its condition, not face-down.
- **What modern players expect —** Modern card text resolves this automatically.
- **Ties to —** [Rule #8 — The 7-Timing Damage Step](/learn/rules/difference-08-seven-timing-damage-step).

## Dark End Dragon {#dark-end-dragon}

Passcode `88643579`.

- **Edison behavior —** Pre-errata, the "and" in its Ignition works as "**and if you do**." If the target leaves the field before the effect resolves, **this card still loses 500 ATK and 500 DEF**.
- **What modern players expect —** Strict "and" sequencing, where failing the second part changes the outcome.
- **Ties to —** Pre-errata card text.

## Darkness Approaches {#darkness-approaches}

Passcode `80168720`.

- **Edison behavior —** It can flip a monster to **face-down Attack Position** (the monster cannot attack there, and it can later be Flip Summoned to face-up Attack Position).
- **What modern players expect —** The position change is handled differently.
- **Ties to —** Pre-errata card text.

## Destiny End Dragoon {#destiny-end-dragoon}

Passcode `76263644`.

- **Edison behavior —** Its Standby-Phase revival Trigger has **NO "once per turn."**
- **What modern players expect —** A once-per-turn was added by errata.
- **Ties to —** Pre-errata card text.

## Elemental HERO Prisma {#elemental-hero-prisma}

Passcode `89312388`.

- **Edison behavior —** The reveal-and-send-to-Graveyard is done **on resolution, not as a cost**. If Prisma is not face-up when the effect resolves, you do not send.
- **What modern players expect —** The reveal-and-send is treated differently (often as part of the cost).
- **Ties to —** Pre-errata card text.

## Fortune Lady Light {#fortune-lady-light}

Passcode `34471458`.

- **Edison behavior —** Its second Trigger (when it leaves the field, Special Summon a Fortune Lady from your Deck) can activate **even while it is face-down** — you reveal it.
- **What modern players expect —** The Trigger only works while the card is face-up.
- **Ties to —** Pre-errata card text.

> **⚠ Known table-difference —** At a real table, Fortune Lady Light's leave-the-field Trigger works even when it was **face-down** (you reveal it). Our engine does not fire leave-field triggers for face-down monsters, so if a face-down Fortune Lady Light is sent to the Graveyard the app may not offer the Special Summon — claim it yourself.

## Future Fusion {#future-fusion}

Passcode `77565204`.

- **Edison behavior —** It sends the Fusion Material **on resolution**; if you could not later Special Summon the Fusion Monster, you cannot activate it.
- **What modern players expect —** Reworked wording and added restrictions.
- **Ties to —** Pre-errata card text.

## Goyo Guardian {#goyo-guardian}

Passcode `7391448`.

- **Edison behavior —** **Any Tuner** may be used as Synchro Material, including non-EARTH Tuners.
- **What modern players expect —** Later errata requires an **EARTH** Tuner as material.
- **Ties to —** Pre-errata card text.

## Jade Knight {#jade-knight}

Passcode `44364207`.

- **Edison behavior —** Its search Trigger, which fires when it destroys a monster by battle, follows the same **face-up-before-target** Damage Step ruling as the other Damage Step cards.
- **What modern players expect —** Modern card text resolves this automatically.
- **Ties to —** [Rule #8 — The 7-Timing Damage Step](/learn/rules/difference-08-seven-timing-damage-step).

## Light and Darkness Dragon {#light-and-darkness-dragon}

Passcode `47297616`.

- **Edison behavior —** Its death Trigger resolves **sequentially**: first destroy all other cards you control, **then** Special Summon the target from your Graveyard. Its activation-negation ability also makes a **phase-dependent mandatory Trigger re-activate** until it resolves.
- **What modern players expect —** Different sequencing on the death effect.
- **Ties to —** [Rule #4 — Phase-Dependent Mandatory Triggers](/learn/rules/difference-04-phase-dependent-mandatory-triggers) (its negation drives that rule).

## Light End Dragon {#light-end-dragon}

Passcode `25132288`.

- **Edison behavior —** Pre-errata, the "and" works as "**and if you do**." If the opponent's monster leaves the field before the effect resolves, **this card still loses 500 ATK and 500 DEF**.
- **What modern players expect —** Strict sequencing.
- **Ties to —** Pre-errata card text.

> **⚠ Known table-difference —** At a real table, if the battle target leaves the field before resolution — **including a face-down defender** — Light End Dragon still loses 500 ATK / 500 DEF. Our engine does not fire this trigger against a face-down monster, so the app may not apply the self-reduction in that case — track the ATK/DEF yourself.

## Mark of the Rose {#mark-of-the-rose}

Passcode `45247637`.

- **Edison behavior —** It has two control effects that behave differently on the chain. The **End-Phase "give control back to the opponent" effect is a Trigger that starts a chain** (your opponent can respond to it). The **Standby-Phase "take control again" effect is a continuous condition** — it silently re-applies and **does not start a chain**, so there is nothing for an opponent to chain to.
- **What modern players expect —** Reworked wording.
- **Ties to —** Pre-errata card text.

## Mausoleum of the Emperor {#mausoleum-of-the-emperor}

Passcode `80921533`.

- **Edison behavior —** It uses your **Normal Summon/Set for the turn** (not an extra one); the LP payment is a cost; and the Summon happens **on resolution**. Because the Summon happens on resolution, **Solemn Judgment cannot negate it** (there is no summon declaration to catch), but **Torrential Tribute can respond** after it resolves.
- **What modern players expect —** Similar wording, but players often forget the Summon happens on resolution.
- **Ties to —** Pre-errata card text (summon-on-resolution timing).

## My Body as a Shield {#my-body-as-a-shield}

Passcode `69279219`.

- **Edison behavior —** It can be **chained to a card or effect** (for example, a face-up Royal Oppression), but it **cannot be activated in the Damage Step**.
- **What modern players expect —** Modern activation timing conventions differ.
- **Ties to —** [Rule #8 — The 7-Timing Damage Step](/learn/rules/difference-08-seven-timing-damage-step) (it cannot activate in the Damage Step).

## Necrovalley {#necrovalley}

Passcode `47355498`.

- **Edison behavior —** Its Continuous effect **only negates effects that target the Graveyard**. Non-targeting effects — Rekindling, Treeborn Frog, Red-Eyes Darkness Metal Dragon — are **not negated**. Types and Attributes in the Graveyard can still be changed if it is not done by targeting.
- **What modern players expect —** A broader negation that also stops non-targeting Graveyard effects.
- **Ties to —** Pre-errata card text.

## Quickdraw Synchron {#quickdraw-synchron}

Passcode `20932152`.

- **Edison behavior —** Its Ignition performs a **Special Summon**, and it **sends** (not discards) the hand monster **on resolution, not as a cost**.
- **What modern players expect —** The send is treated as a cost.
- **Ties to —** Pre-errata card text.

## Red-Eyes Darkness Metal Dragon {#red-eyes-darkness-metal-dragon}

Passcode `88264978`.

- **Edison behavior —** There is **no "once per name"** on either effect: the Summon effect (banish a Dragon to Special Summon this card) or the Ignition effect (Special Summon a Dragon from your hand or Graveyard). The Ignition **does not target** the Graveyard.
- **What modern players expect —** A once-per-name restriction was added by errata.
- **Ties to —** Pre-errata card text.

## Rescue Cat {#rescue-cat}

Passcode `14878871`.

- **Edison behavior —** There is **no "once per name,"** and it **does not negate the effects** of the two monsters it Special Summons.
- **What modern players expect —** A heavily restricted effect (once per turn and it negates the Summoned monsters); modern Rescue Cat is Forbidden.
- **Is Rescue Cat once-per-turn in Edison? No.** It has no once-per-name limit in Edison.
- **Ties to —** Pre-errata card text.

## Ryko, Lightsworn Hunter {#ryko-lightsworn-hunter}

Passcode `21502796`.

- **Edison behavior —** Its Flip effect's destroy target is **optional** (if there is no target, it just mills 3), and it resolves **sequentially**: destroy (optional) first, then mill 3 (mandatory).
- **What modern players expect —** A mandatory target and different sequencing.
- **Ties to —** Pre-errata card text.

## Sangan {#sangan}

Passcode `26202165`.

- **Edison behavior —** When it is sent from the field to the Graveyard, its mandatory Trigger searches **any monster with 1500 or less ATK**, and **you may use the searched monster's effects** — there is no "cannot use its effects" clause.
- **What modern players expect —** Restricted Problem-Solving Card Text that limits when and how the searched monster can be used.
- **Ties to —** Pre-errata card text. As a mandatory Trigger, Sangan's search orders on the chain by [Rule #7 — SEGOC](/learn/rules/difference-07-segoc) when it goes off at the same time as another trigger.

## Soul Exchange {#soul-exchange}

Passcode `68005187`.

- **Edison behavior —** Tributing the opponent's monster is **optional** — you are **not forced** to tribute it at the earliest opportunity.
- **What modern players expect —** Similar wording, but the ordering interactions catch players out.
- **Ties to —** [Rule #7 — SEGOC](/learn/rules/difference-07-segoc) (ownership decides the chain-building step when the tributed monster's own trigger goes off).

## Strike Ninja {#strike-ninja}

Passcode `41006930`.

- **Edison behavior —** Its once-per-turn is **per copy** — multiple Strike Ninja may each use the banish-self effect in the same turn.
- **What modern players expect —** A once-per-name that stops multiple copies from all using it.
- **Ties to —** Pre-errata card text.

## Swap Frog {#swap-frog}

Passcode `9126351`.

- **Edison behavior —** Its Ignition is usable **once per copy**, but you only gain **1 extra Normal Summon** even if it resolves multiple times.
- **What modern players expect —** A once-per-name and different summon interactions.
- **Ties to —** Pre-errata card text.

## Treeborn Frog {#treeborn-frog}

Passcode `12538374`.

- **Edison behavior —** Its Standby-Phase revival Trigger has **NO "once per turn."** It cannot activate if a monster is in your Spell/Trap Zone being treated as a Spell.
- **What modern players expect —** A once-per-turn was added by errata.
- **Ties to —** Pre-errata card text.

## Ultimate Offering {#ultimate-offering}

Passcode `80604091`.

- **Edison behavior —** The Summon/Set happens **on resolution**, so **Solemn Judgment cannot negate it**; **Torrential Tribute can respond** if it was Chain Link 1.
- **What modern players expect —** Similar wording, but players often forget the Summon happens on resolution.
- **Ties to —** Pre-errata card text (summon-on-resolution timing).

## Urgent Tuning {#urgent-tuning}

Passcode `94634433`.

- **Edison behavior —** The Synchro Summon happens **on resolution**, so **Solemn Judgment cannot negate** that Synchro Summon.
- **What modern players expect —** Similar wording, but the summon-on-resolution timing catches players out.
- **Ties to —** Pre-errata card text (summon-on-resolution timing).

---

## Lightsworn End-Phase mill (all Lightsworns) {#lightsworn-mill}

Representative card: **Lumina, Lightsworn Summoner** (`95503687`). Applies to **Judgment Dragon and every Lightsworn monster**.

- **Edison behavior —** A Lightsworn's phase-dependent mandatory End-Phase mill Trigger **re-activates if its activation is negated** (for example by Light and Darkness Dragon) and keeps trying until it resolves.
- **What modern players expect —** Modern rules handle a negated mandatory Trigger differently, so it does not simply re-fire.
- **Ties to —** [Rule #4 — Phase-Dependent Mandatory Triggers](/learn/rules/difference-04-phase-dependent-mandatory-triggers).

## Union monsters (all Unions) {#union-monsters}

Representative card: **Machina Gearframe** (`42940404`). Applies to **every Union monster**.

- **Edison behavior —** Every Union monster carries the **"1 Union per monster" Condition** — a monster can be equipped by only one Union at a time. Only the Union monsters that specifically list the protection have "you can destroy this equipped card instead"; Unions that do not list it give **no such protection**.
- **What modern players expect —** The "1 Union per monster" condition was removed in a 2016 rules update, and Union protection is applied to all Unions.
- **Ties to —** [Rule #3 — Union Monster Conditions](/learn/rules/difference-03-union-monster-conditions).

## Spirit monsters (all Spirits) {#spirit-monsters}

Representative card: **Susa Soldier** (`40473581`). Applies to **every Spirit monster**.

- **Edison behavior —** A Spirit monster's phase-dependent mandatory **return-to-hand Trigger** (a Spirit returns to the hand during the End Phase) **re-activates if its activation is negated** and keeps trying until it resolves.
- **What modern players expect —** Modern rules handle a negated mandatory Trigger differently.
- **Ties to —** [Rule #4 — Phase-Dependent Mandatory Triggers](/learn/rules/difference-04-phase-dependent-mandatory-triggers).
