---
id: rules.diff.08
section: rules
group: difference
ruleNumber: 8
title: "The 7-Timing Damage Step"
slug: difference-08-seven-timing-damage-step
summary: "The Damage Step is divided into seven timings, and only specific kinds of cards and effects may be activated inside it — most Spells and Traps that change ATK/DEF cannot, and none can from Damage Calculation onward."
keywords:
  [
    damage step,
    seven timings,
    seven substeps,
    Counter Trap,
    Honest,
    Forbidden Chalice,
    My Body as a Shield,
    Royal Oppression,
    Herald of Orange Light,
    Doomcaliber Knight,
    Gorz,
    damage calculation,
  ]
prevId: rules.diff.07
nextId: rules.diff.09
---

**TL;DR:** The Damage Step is divided into seven timings, and only specific kinds of cards and effects may be activated inside it — most Spells and Traps that change ATK/DEF cannot, and none can from Damage Calculation onward.

The Damage Step is the most tightly regulated part of a turn. Edison uses the old, seven-timing structure (some sources call it the "seven substeps"), and there is a strict list of what may and may not be activated while a battle resolves.

## What can be activated in the Damage Step {#what-can-activate}

These rules apply across the whole Damage Step:

- **Counter Trap Cards** may be activated at **any** point in the Damage Step.
- **Monster effects that negate ACTIVATIONS** (for example **Herald of Orange Light**) may be activated at **any** point in the Damage Step.
- **Monster effects that only negate EFFECTS** (not activations) **cannot** be activated in the Damage Step.
- **Spell Speed 2 Spells/Traps that negate ACTIVATIONS** (for example **My Body as a Shield**) **cannot** be activated in the Damage Step.
- **Spell Speed 2 Spells/Traps that negate EFFECTS** (for example **Royal Oppression**) **cannot** be activated in the Damage Step.
- **Mandatory effects** (for example **Doomcaliber Knight**) may be activated at **any** point in the Damage Step.
- An effect **can** activate if its card **moves location** (is flipped face-up, changes battle position, is sent to the Graveyard) **or performs an action** (inflicts battle damage, destroys a monster by battle) — this covers Flip Effects, a **Green Gadget** Special Summoned by **Giant Rat**, and **Geartown** destroyed by battle.
- **Fast/continuous effects that directly modify ATK/DEF** can activate or apply (for example **Honest**).
- **Spell/Trap cards that change ATK/DEF** (for example **Forbidden Chalice**) **cannot** activate in or after the Damage Calculation timing.

A useful shorthand: **monster effects** that change ATK/DEF stay usable deep into the Damage Step, but **Spells and Traps** that change ATK/DEF run out of road at Damage Calculation. And note that **Book of Moon is not offered in the Damage Step** at all, while **Honest is** — a common point of confusion.

## The seven timings {#the-seven-timings}

The Damage Step proceeds through seven timings in order:

1. **Start of the Damage Step** — "during the Damage Step" effects begin applying; "at the start of the Damage Step" triggers activate; Quick Effects and Spell/Trap ATK/DEF modifiers can activate.
2. **Flip the attack target face-up** — a face-down attack target is flipped up, but its **Flip Effect does not activate yet**; effects that care about a _set_ target begin applying; ATK/DEF modifiers may still activate.
3. **Before Damage Calculation** — "before damage calculation" effects activate/apply; ATK/DEF modifiers may still activate.
4. **Damage Calculation** — **monster** Quick Effects that change ATK/DEF **can** activate, but **Spells/Traps** that change ATK/DEF **cannot**; one manual chain may be built; then battle damage is applied and the losing monsters are **marked "destroyed by battle."**
5. **After Damage Calculation** — monsters marked destroyed-by-battle stop applying continuous effects; self-destruct/continuous effects apply (Gozen Match, Rivalry of Warlords, Berserk Gorilla); "when you take battle damage" triggers activate here (this is the **Gorz** window).
6. **Resolve effects** — "after damage calculation" effects and **Flip Effects** activate now and can form a chain (for example a battle-flipped **Ryko, Lightsworn Hunter** milling as Chain Link 1).
7. **End of the Damage Step** — monsters marked destroyed-by-battle are **now sent to the Graveyard**; "when a monster is destroyed by battle" effects activate (for example a battle-destroyed **Mystic Tomato** searching/Special Summoning as Chain Link 1).

## Gorz and battle damage {#gorz-and-battle-damage}

**Gorz the Emissary of Darkness** activates when you take battle damage — timing **5 (After Damage Calculation)**. If you are attacked directly and take the damage, Gorz is offered inside the Damage Step at that moment, not after it.

> **⚠ Known table-difference —** The app may not reliably offer **Gorz the Emissary of Darkness** (and other "when you take battle damage" effects) at the After-Damage-Calculation timing inside the Damage Step. At a live table you always get this window. If you are holding Gorz and take battle damage, make sure the play is allowed even if the app does not prompt you for it.

## Related cards {#related-cards}

Cards that stay usable in the Damage Step include **Counter Traps** (such as **Divine Wrath** and **Solemn Judgment**), **Herald of Orange Light**, **Honest**, **Doomcaliber Knight**, and **Gorz the Emissary of Darkness**. Cards that are shut out include **My Body as a Shield** and **Royal Oppression** (Spell Speed 2 negation) and **Forbidden Chalice** (an ATK/DEF Spell) once Damage Calculation begins. The "moved or acted" rule brings in Flip monsters like **Ryko, Lightsworn Hunter**, **Giant Rat** into **Green Gadget**, **Geartown**, and **Mystic Tomato**.
