---
id: rules.primer.battle
section: rules
group: primer
title: "The Battle Phase"
slug: primer-battle-phase
summary: "The Battle Phase runs through four steps — Start, Battle, Damage, End — where you declare attacks (repeating the Battle and Damage steps for each attack), calculate battle damage in the Damage Step, and re-pick your attack when a replay occurs."
keywords:
  [
    battle phase,
    attack,
    start step,
    battle step,
    damage step,
    end step,
    replay,
    attack declaration,
    direct attack,
    battle damage,
    damage calculation,
  ]
prevId: rules.primer.chains
nextId: rules.primer.deck
---

**TL;DR:** The Battle Phase has four steps — **Start ▸ Battle ▸ Damage ▸ End**. You declare one attack at a time (repeating the Battle and Damage steps), and battle damage is worked out in the **Damage Step**, where card activation is very restricted. If the opponent's monsters change after you declare an attack, a **replay** lets you re-pick.

The Battle Phase is optional — you can skip straight to the End Phase. Remember that the player who goes **first cannot have a Battle Phase on turn 1** (see the [turn primer](/learn/rules/primer-how-a-turn-works#no-turn-1-battle-phase)).

## The four steps {#the-four-steps}

The Battle Phase always runs in this order:

- **Start Step** — you announce that you are entering the Battle Phase.
- **Battle Step** — you declare an attack.
- **Damage Step** — battle damage is calculated.
- **End Step** — the Battle Phase ends.

The **Battle Step and Damage Step repeat** — one pair for each attack you make.

## Start Step {#start-step}

You announce that you are entering the Battle Phase. The turn player has priority to activate a fast effect here (for example, Threatening Roar). Entering the Battle Phase does **not** force you to attack — if you choose not to, you go straight to the End Step.

## Battle Step {#battle-step}

Pick one of your **face-up Attack Position** monsters to attack with, and choose a target — one of the opponent's monsters, or, if they control none, a **direct attack** on the player. Each face-up Attack Position monster is allowed **one attack per turn**. After the Damage Step resolves, you return to the Battle Step to declare another attack, until you are done.

In Edison, only **one chain** may be built in direct response to an attack declaration.

> **Example.** Your 2400-ATK monster attacks your opponent's 1900-ATK monster. Their monster is destroyed and they take 500 battle damage (2400 − 1900).

## Replay {#replay}

If the set of the opponent's monsters **changes** after you declared an attack but before the Damage Step — the target leaves the field, or a new monster appears — a **replay** happens. You then choose again: attack with the **same** monster, attack with a **different** monster, or **do not attack** at all. A monster that already declared an attack still counts as having attacked and cannot attack again this turn, even if you switch.

> **Example.** You declare an attack on the opponent's only monster. They flip Compulsory Evacuation Device to bounce it back to their hand. With no monsters left on their side, a replay occurs — you may now attack directly, attack a different monster, or not attack.

## Damage Step {#damage-step}

The Damage Step is where battle damage is calculated. Compare the attacker's **ATK** to the target's **ATK** (if the target is in Attack Position) or **DEF** (if in Defense Position):

- Higher value **destroys** the other monster; the attacker deals the **difference** as battle damage (Attack Position only).
- **Equal ATK vs ATK destroys both** monsters, and neither player takes damage.
- A **direct attack** deals the attacker's full ATK as battle damage.

Card activation is heavily restricted during the Damage Step: generally only **Counter Traps** and effects that **directly change ATK/DEF** may be used, and most of them only up to the start of damage calculation. A **face-down** attack target is flipped face-up here, and its Flip Effect resolves **after** damage calculation.

Edison structures the Damage Step into **seven precise timings** that decide exactly what can be activated and when — this is one of the format's defining differences. See [Rule #8 — The 7-Timing Damage Step](/learn/rules/difference-08-seven-timing-damage-step). Edison also has a specific rule for battles involving 0-ATK monsters — see [Rule #13 — 0-ATK Monsters](/learn/rules/difference-13-zero-atk-monsters).

## End Step {#end-step}

Once you have no more monsters you want to attack with, announce the end of the Battle Phase. Effects that apply "at the end of the Battle Phase" happen now. Your turn then moves to Main Phase 2.
