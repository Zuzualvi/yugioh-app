---
id: rules.diff.07
section: rules
group: difference
ruleNumber: 7
title: "SEGOC — Simultaneous Effects Go on the Chain"
slug: difference-07-segoc
summary: "When several effects trigger at the same time they build the chain in a fixed order — turn player's mandatory, then opponent's mandatory, then turn player's optional, then opponent's optional — and in Edison an earlier-triggered effect is placed before a later one within the same group."
keywords:
  [
    SEGOC,
    simultaneous effects,
    chain order,
    mandatory,
    optional,
    turn player,
    Sangan,
    Caius the Shadow Monarch,
    Soul Exchange,
    LIFO,
    trigger order,
  ]
prevId: rules.diff.06
nextId: rules.diff.08
---

**TL;DR:** When several effects trigger at the same time they build the chain in a fixed order — turn player's mandatory, then opponent's mandatory, then turn player's optional, then opponent's optional — and in Edison an earlier-triggered effect is placed before a later one within the same group.

SEGOC ("Simultaneous Effects Go on the Chain") is the procedure for stacking multiple Trigger Effects that all meet their timing at the same moment. Edison uses the pre-2017 version, which adds one nuance about triggers that met their timing at _different_ moments.

## The four-step SEGOC order {#four-step-order}

When two or more Trigger(-like) Effects trigger **simultaneously**, they are placed on the chain in this fixed order:

1. **Turn player's MANDATORY effects**
2. **Opponent's (non-turn player's) MANDATORY effects**
3. **Turn player's OPTIONAL effects**
4. **Opponent's (non-turn player's) OPTIONAL effects**

All **mandatory** effects are placed on the chain before any **optional** effects; within the mandatory group and again within the optional group, the **turn player's** effect goes on before the **opponent's**. Ownership — **who controls the effect**, not who caused it — decides which player a trigger belongs to.

The chain then resolves **Last-In, First-Out (LIFO):** the effect placed on _last_ (highest Chain Link) resolves _first._ So the effect that goes on the chain latest — the opponent's optional trigger, if present — resolves before everything below it.

## Earlier trigger goes first within a group {#earlier-triggers-first}

This is the Edison-specific nuance. If two effects fall in the **same** group above (say, both are the turn player's mandatory effects) but they met their trigger timing at **different moments**, the one that triggered **earlier** goes on the chain **first** (the lower Chain Link). (The modern game reverses this ordering; Edison keeps the pre-2017 "earlier trigger first" rule.)

The group order from the four-step list always wins first; the "earlier trigger goes first" rule only breaks ties **inside** a single group.

## Worked examples {#worked-examples}

**Example (same group, earlier trigger first) —** You Tribute your own **Sangan** to Tribute Summon **Caius the Shadow Monarch.** Both are your (turn player) **mandatory** triggers, so they are in the same group. Sangan meets its timing **earlier** (the moment it is sent from the field to the Graveyard as Tribute); Caius meets its timing **later** (on a successful Summon). So **Sangan is Chain Link 1** and **Caius is Chain Link 2** — earlier trigger, lower link.

**Example (ownership decides the group) —** You activate **Soul Exchange** on your opponent's **Sangan**, then Tribute that Sangan to Tribute Summon **Caius.** Now the two triggers belong to **different players:** Caius is **yours** (turn player, mandatory) and Sangan is the **opponent's** (non-turn player, mandatory) — because ownership, not who did the tributing, decides the group. So the four-step order puts **Caius at Chain Link 1** (turn player's mandatory) and **Sangan at Chain Link 2** (opponent's mandatory), even though Sangan actually triggered earlier. Here the group order overrides the "earlier trigger first" tie-breaker, because the two triggers are in different groups.

## Related cards {#related-cards}

The teaching pair for SEGOC is **Sangan** and **Caius the Shadow Monarch**: Tributing your own Sangan for Caius shows "earlier trigger first" within one group, while using **Soul Exchange** to Tribute the opponent's Sangan for Caius shows how **ownership** decides which player's group a trigger belongs to. Any pile-up of simultaneous Trigger Effects — for example several monsters destroyed at once by **Dark Hole** — is ordered by these same four steps.
