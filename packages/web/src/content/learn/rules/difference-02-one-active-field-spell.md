---
id: rules.diff.02
section: rules
group: difference
ruleNumber: 2
title: "Only One Active Field Spell"
slug: difference-02-one-active-field-spell
summary: "Only one Field Spell can be active (face-up) on the whole field at a time; activating a new one destroys the old one, but setting one face-down destroys nothing."
keywords:
  [
    field spell,
    field zone,
    one field spell,
    Umi,
    Mountain,
    Dust Tornado,
    Secret Village of the Spellcasters,
    Mausoleum of the Emperor,
    Geartown,
    set vs activate,
  ]
prevId: rules.diff.01
nextId: rules.diff.03
---

**TL;DR:** Only one Field Spell can be active (face-up) on the whole field at a time; activating a new one destroys the old one, but setting one face-down destroys nothing.

In Edison there is a single shared "active Field Spell" slot across the entire table. This changes how Field Spells fight each other compared with the modern game, where each player has their own Field Zone.

## One Field Spell at a time {#one-at-a-time}

At most **one** Field Spell may be face-up (active) on the field at any moment — and that limit is **shared by both players.** If your opponent has an active Field Spell and you activate your own, only one can remain.

Both players still have a Field Zone, and both can hold a **face-down (Set)** Field Spell at once. The "only one" rule is about being **active/face-up**, not about occupying the zone.

## Activating destroys the old; Setting does not {#activate-vs-set}

**Activating** a new Field Spell while another is already active **destroys the existing one** — it is sent to the Graveyard as a destroyed card (not merely swapped out). **Setting** a Field Spell face-down does **not** destroy anyone's active Field Spell; a face-down card is not "active."

**Example (activate destroys) —** Your opponent controls a face-up **Umi**. You **activate Mountain.** When Mountain resolves, Umi is destroyed and sent to the Graveyard, and Mountain is now the single active Field Spell.

**Example (set is harmless) —** Your opponent controls a face-up Umi. You **Set** a Field Spell face-down instead of activating it. Umi is **not** destroyed — a Set card did not become active.

> **⚠ Known table-difference —** The app enforces the "only one active Field Spell" limit globally, but it does not reliably distinguish _Setting_ a Field Spell face-down (which destroys nothing) from _Activating_ one. At a live table a judge applies this exactly: a face-down Set never destroys an opponent's active Field Spell. If the app behaves differently when you Set over an active Field Spell, treat the authoritative ruling above as correct and confirm with your opponent.

## Chained responses and resolution timing {#chained-responses}

Because the old Field Spell is destroyed on the **resolution** of the new one, a response that removes the new Field Spell first can save the old one.

**Example (no response) —** You activate **Mountain** while the opponent's **Umi** is active and nobody responds. Mountain resolves, and **Umi is destroyed.**

**Example (Dust Tornado chain) —** You activate Mountain; the opponent **chains Dust Tornado** targeting Mountain. The chain resolves last-in-first-out: Dust Tornado destroys **Mountain** first, so Mountain never resolves — which means it never replaced Umi, and **Umi survives.**

## Set is always legal; activation must be legal {#activation-legality}

Setting a Field Spell face-down is always allowed. **Activating** it, however, must satisfy the card's own activation requirements.

**Example —** Your opponent controls **Secret Village of the Spellcasters** plus a Spellcaster (which stops non-controllers from activating Spells while a Spellcaster is on the field for its controller only). You may still **Set** your own **Umi** face-down — Secret Village is not destroyed and the Set is legal — but you **cannot Activate** Umi unless you also control a Spellcaster. "Set" and "Activate" are two different legality questions.

## Destroyed by a game mechanic vs by an effect {#destroyed-by-game-mechanic}

When a new Field Spell replaces one you already control, the old one is destroyed by a **game mechanic.** Whether that destruction happens _inside a chain_ changes what the destroyed card can do.

**Example (Set → no chain) —** You **Set** **Mausoleum of the Emperor** over your own **Geartown.** Geartown is destroyed by a game mechanic **without starting a chain** — so Geartown's "when destroyed" Graveyard effect **CAN** activate afterward.

**Example (Activate → starts a chain) —** You **Activate** Mausoleum over your own Geartown. Now Geartown is destroyed **while a chain is starting** (Mausoleum's activation) — so Geartown's "when destroyed" effect **CANNOT** activate in that window.

> **⚠ Known table-difference —** The app may not distinguish these Set-vs-Activate replacement timings for a Field Spell destroying your own Geartown (whether the destruction started a chain). At a live table a judge tracks it precisely: destroyed by a Set = no chain = Geartown's effect works; destroyed by an Activation = chain started = Geartown's effect is missed. If it matters to your play, confirm the timing with your opponent.

## Related cards {#related-cards}

Field Spells that fight over the single active slot include **Umi**, **Mountain**, and archetype fields like **Geartown**. **Dust Tornado** is the classic tool to destroy an incoming Field Spell before it resolves. **Secret Village of the Spellcasters** shows the Set-vs-Activate legality split, and **Mausoleum of the Emperor** over your own **Geartown** shows the "destroyed by game mechanic, chain or no chain" timing.
