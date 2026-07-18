---
id: rules.diff.05
section: rules
group: difference
ruleNumber: 5
title: "Trap Monster Zones"
slug: difference-05-trap-monster-zone-blocking
summary: "A face-up Trap Monster occupies one Monster Zone AND one Spell/Trap Zone at once, and whenever it leaves the field or is negated it is treated as a Trap Card, not a monster."
keywords:
  [
    trap monster,
    Embodiment of Apophis,
    Metal Reflect Slime,
    Zoma the Spirit,
    Jinzo,
    Snatch Steal,
    Creature Swap,
    Book of Moon,
    Fake Trap,
    My Body as a Shield,
    Caius the Shadow Monarch,
    spell trap zone,
  ]
prevId: rules.diff.04
nextId: rules.diff.06
---

**TL;DR:** A face-up Trap Monster occupies one Monster Zone AND one Spell/Trap Zone at once, and whenever it leaves the field or is negated it is treated as a Trap Card, not a monster.

Trap Monsters (Continuous Traps that become monsters, like **Embodiment of Apophis** and **Metal Reflect Slime**) are strange: they live in two zones, they revert to Trap Cards in several situations, and they interact with destruction protection in a specific way. Edison follows the old, detailed rulings for all of this.

## A Trap Monster takes up two zones {#two-zones-at-once}

While face-up as a monster, a Trap Monster occupies **one Monster Zone AND one Spell/Trap Zone** at the same time. Physically it sits in the Monster Zone, but the Spell/Trap Zone it came from becomes **unusable** while it is a monster — you cannot Set or activate another card there.

You also **cannot flip a Set Trap Monster face-up (activate it as a monster) if you have no empty Monster Zone** — there must be room in the Monster Zone for it to become a monster.

**Example —** You activate **Embodiment of Apophis** as a monster. It now blocks a Monster Zone and the Spell/Trap Zone it occupied — if all five of your Spell/Trap Zones were full because of it, you have one fewer usable Spell/Trap slot until it leaves.

## Gaining control needs both zones open {#gaining-control}

To **take control** of an opponent's Trap Monster (with **Snatch Steal** or **Creature Swap**), the new controller must have **both an open Monster Zone AND an open Spell/Trap Zone** — because the Trap Monster needs to occupy one of each. If either zone is full, you cannot gain control of it.

> **⚠ Known table-difference —** The app does not fully enforce the "needs both an open Monster Zone and an open Spell/Trap Zone" requirement for taking control of a Trap Monster. At a live table a judge checks both zones before allowing the Snatch Steal / Creature Swap; in the app the action may be offered even when it should be illegal. Check both zones yourself.

## Jinzo and negation revert it to a Trap Card {#jinzo-reversion}

When a Trap Monster's effect is **negated by Jinzo**, it stops being a monster and reverts to a **Trap Card in the Spell/Trap Zone immediately.**

- If a Trap Monster **attacks a Set Jinzo**, then when Jinzo flips up and negates it, the Trap Monster reverts to a Trap Card and **damage calculation is not applied** (there is no monster to fight).
- If **your** Trap Monster was stolen by **Snatch Steal** and then **Jinzo is Summoned**, the Trap Monster reverts to a Trap Card in **your** (the owner's) Spell/Trap Zone — negation returns it to its owner as a trap card.

> **⚠ Known table-difference —** The app does not reliably model a Trap Monster reverting to a Trap Card in the Spell/Trap Zone when Jinzo negates it, nor the owner-vs-controller detail (a stolen Trap Monster returning to its OWNER's Spell/Trap Zone when Jinzo arrives). At a live table a judge tracks these reversions and ownership; in the app they may not be enforced. Confirm the resulting board with your opponent.

## Being set face-down sends it to the Spell/Trap Zone {#set-face-down}

If a Trap Monster **would be Set face-down** (for example by **Book of Moon**), it is instead **Set to its corresponding Spell/Trap Zone as a Trap Card** — it does not become a face-down monster.

There is an ownership wrinkle: if your opponent controls **your** **Embodiment of Apophis** (through Snatch Steal or Creature Swap) and it is flipped face-down, it goes to the **current controller's** Spell/Trap Zone — the opponent's — not yours. (Contrast the Jinzo case above, where negation returns it to the _owner_.)

> **⚠ Known table-difference —** The app may not enforce where a controlled-by-opponent Trap Monster goes when it is flipped face-down (to the current controller's Spell/Trap Zone). At a live table a judge places it in the controller's zone. Verify this edge case at the table.

## Destruction protection: Fake Trap vs My Body as a Shield {#destruction-protection}

Because a Trap Monster is both a monster and a Trap Card, whether a protection card can save it depends on **what the removal targets:**

- **vs Heavy Storm** (destroys Spell/Trap cards): **Fake Trap** CAN prevent its destruction; **My Body as a Shield** CANNOT.
- **vs Lightning Vortex** (destroys monsters): **My Body as a Shield** CAN prevent its destruction; **Fake Trap** CANNOT.
- **vs Raigeki Break** (destroys "a card"): **BOTH** Fake Trap AND My Body as a Shield can prevent its destruction.

**Example —** Your face-up **Metal Reflect Slime** is hit by **Heavy Storm.** Only **Fake Trap** saves it (Heavy Storm destroys Spell/Trap cards, and the Trap Monster is a Trap for that purpose). If it were hit by **Lightning Vortex** instead, only **My Body as a Shield** would save it (Lightning Vortex destroys monsters).

## Leaving the field: always as a Trap Card {#leaving-the-field}

Whenever a Trap Monster **leaves the field, it leaves as a Trap Card,** not as a monster. That single fact drives a long list of rulings:

- **In the Graveyard** it is a Trap: it **cannot** be revived by **Time Machine** or retrieved by **Return of the Doomed**, it will **not** trigger **Blackwing - Shura the Blue Flame**, and you **cannot** activate **Michizure** off it.
- **Banished by Caius the Shadow Monarch:** banishing **Zoma the Spirit** inflicts **no damage** — it was banished as a Trap Card, not as a DARK monster, so Caius's burn does not apply.
- **Bounced by Penguin Soldier:** it returns to the hand **as a Trap Card**, and you **cannot** activate **Major Riot** as if a monster had returned.
- **Temporarily removed** (by **Dimensionhole** or **Interdimensional Matter Transporter**): it returns **as a Trap Card and is destroyed immediately** by a game mechanic. With **Dimensionhole** you cannot use the Monster Zone while it is removed, but you **can** use the Spell/Trap Zone it had occupied.

## Related cards {#related-cards}

The Trap Monsters themselves are **Embodiment of Apophis**, **Metal Reflect Slime**, and **Zoma the Spirit**. **Jinzo** negates and reverts them; **Snatch Steal** and **Creature Swap** move control; **Book of Moon** tries to Set them face-down. **Fake Trap** and **My Body as a Shield** protect them against **Heavy Storm**, **Lightning Vortex**, and **Raigeki Break** respectively. On leaving the field they interact with **Caius the Shadow Monarch**, **Penguin Soldier**, **Time Machine**, **Michizure**, **Blackwing - Shura the Blue Flame**, **Dimensionhole**, and **Interdimensional Matter Transporter** — always as Trap Cards.
