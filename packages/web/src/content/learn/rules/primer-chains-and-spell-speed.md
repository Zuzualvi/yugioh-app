---
id: rules.primer.chains
section: rules
group: primer
title: "Chains and Spell Speed"
slug: primer-chains-and-spell-speed
summary: "When one effect is activated, players may respond with equal-or-faster effects to build a chain, which then resolves last-in-first-out — the effect added last resolves first."
keywords:
  [
    chain,
    chain link,
    spell speed,
    spell speed 1,
    spell speed 2,
    spell speed 3,
    counter trap,
    quick effect,
    quick-play spell,
    resolution order,
    last in first out,
    targeting,
    cost,
    respond,
    priority,
    segoc,
  ]
prevId: rules.primer.summoning
nextId: rules.primer.battle
---

**TL;DR:** When someone activates a card or effect, the other player may **respond** with a faster (or equal-speed) effect, stacking a **chain**. Once both players are done adding to it, the chain resolves **backwards** — the **last** effect added resolves **first**, all the way down to Chain Link 1.

## What a chain is {#what-is-a-chain}

Whenever a card or effect is activated, the opponent is **always** given the chance to respond with an effect of their own. Each response is a new **Chain Link** placed on top of the stack. Both players keep getting the option to add another link until they both decline; then the chain resolves.

Not everything can be responded to. **Summoning a monster, Tributing, changing a battle position, and paying a cost are not activations** — you cannot start a chain in response to them. You can only chain to the **activation** of a card or effect.

## Spell Speed 1, 2, and 3 {#spell-speeds}

Every effect has a **Spell Speed** from 1 to 3. To respond to a link, your effect must be **Spell Speed 2 or higher** and **at least as fast** as the link you are answering.

- **Spell Speed 1 (slowest)** — Normal, Equip, Continuous, Field, and Ritual Spells; and monster **Ignition, Trigger, and Flip** effects. These **cannot** be activated in response to anything, so they are normally Chain Link 1 (unless several trigger at once).
- **Spell Speed 2** — Normal and Continuous **Trap Cards**, **Quick-Play Spells**, and monster **Quick Effects**. These can respond to Spell Speed 1 or 2, and can usually be activated in any phase — including your opponent's turn.
- **Spell Speed 3 (fastest)** — **Counter Trap Cards**. These can respond to any Spell Speed, and **only another Spell Speed 3** can respond to them.

## How a chain resolves: last in, first out {#resolution-order}

A chain resolves in **reverse order** — this is often called **last-in-first-out (LIFO)**. The **last** Chain Link added resolves **first**, then the one below it, and so on, with **Chain Link 1 resolving last**.

> **Example.** You activate Heavy Storm (Spell Speed 1) as Chain Link 1. Your opponent responds with Threatening Roar (Spell Speed 2) as Chain Link 2. You respond with Seven Tools of the Bandit (Spell Speed 3) as Chain Link 3. It resolves 3 → 2 → 1: Seven Tools negates Threatening Roar, so Threatening Roar does nothing, and then Heavy Storm resolves and destroys the Spell/Trap Cards.

## Targeting and costs {#targeting}

Some effects **target** — you choose the specific card(s) affected **when you activate** the effect, so both players know the target and can decide whether to respond. Effects that hit "all" cards, or that pick a card only as they resolve, do **not** target.

A **cost** (discarding, paying Life Points, Tributing, banishing) is paid **when you activate** the effect, before it goes on the chain. You do **not** get the cost back even if the effect is later negated. Edison has a specific rule about Life Point costs that would drop you to 0 — see [Rule #10 — Life Point Costs](/learn/rules/difference-10-life-point-costs).

## When you get to respond {#when-you-can-respond}

The **turn player acts first** in each phase and step. The opponent can respond once the turn player passes priority. You respond to an **activation**, not to a Summon, a position change, or a cost. On top of this base rule, Edison gives the turn player an extra window right after a Summon — see [Rule #6 — Ignition Effect Priority](/learn/rules/difference-06-ignition-effect-priority).

## Simultaneous effects {#simultaneous-effects}

Sometimes several effects trigger at the **same moment**. They do not each get their own chain — they are ordered into **one** chain by a set procedure (broadly: the turn player's effects go on first, then the opponent's, so the opponent's resolve first). Edison uses a specific step-by-step ordering with an era quirk — see [Rule #7 — Simultaneous Effects Go On Chain (SEGOC)](/learn/rules/difference-07-segoc).
