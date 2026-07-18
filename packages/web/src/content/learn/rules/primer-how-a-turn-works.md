---
id: rules.primer.turn
section: rules
group: primer
title: "How a Turn Works"
slug: primer-how-a-turn-works
summary: "Every turn runs through six phases in a fixed order — Draw, Standby, Main Phase 1, Battle, Main Phase 2, End — and the player who goes first draws a card but cannot attack on turn 1."
keywords:
  [
    turn,
    phases,
    draw phase,
    standby phase,
    main phase 1,
    battle phase,
    main phase 2,
    end phase,
    who goes first,
    turn order,
    first turn,
    hand size limit,
    priority,
  ]
nextId: rules.primer.summoning
---

**TL;DR:** A turn always runs through six phases in the same order — **Draw ▸ Standby ▸ Main Phase 1 ▸ Battle ▸ Main Phase 2 ▸ End**. Players start with 8000 Life Points and a 5-card hand; the goal is to drop the opponent to 0. The player who goes first **draws** on turn 1 but **cannot attack** on turn 1.

This page teaches the shape of a turn in Edison format, which runs on the 2008–2010 rules (Master Rule 1). If you already know modern Yu-Gi-Oh, most of this is familiar — the two things Edison does differently on turn 1 are called out below and in the 13 rule-differences.

## Who goes first {#who-goes-first}

Before the first duel, both players shuffle, then use a coin toss, die roll, or rock-paper-scissors to decide who chooses. The **winner picks whether to go first or second** ("play or draw"). In the later duels of a match, the **loser of the previous duel** makes that choice. A match is best two-out-of-three duels.

Both players then draw a **5-card opening hand** and start with **8000 Life Points**.

> **Example.** You win the die roll and choose to go first. You and your opponent each draw 5 cards, and you take the first turn.

## The six phases {#the-six-phases}

Each turn moves through these phases in this exact order:

- **Draw Phase (DP)** — draw 1 card.
- **Standby Phase (SP)** — resolve effects that happen "during the Standby Phase."
- **Main Phase 1 (MP1)** — Summon, Set, and activate most of your cards.
- **Battle Phase (BP)** — declare attacks (optional).
- **Main Phase 2 (MP2)** — like Main Phase 1; only happens if you conducted a Battle Phase.
- **End Phase (EP)** — clean-up and hand-size discard.

You do not have to use every phase. The Battle Phase is optional, and if you conduct **no** battles you go straight from Main Phase 1 to the End Phase (skipping Main Phase 2).

## Draw Phase {#draw-phase}

The turn player draws 1 card from the top of their Deck. A player who must draw but has **no cards left in their Deck loses the duel** (this is called decking out). After drawing, players may still activate Trap Cards or Quick-Play Spells before moving on.

## Standby Phase {#standby-phase}

A quiet phase used to resolve effects and pay costs that specifically happen "during the Standby Phase" (for example, some maintenance costs). If nothing applies, play passes straight to Main Phase 1.

## Main Phase 1 {#main-phase-1}

This is where most of the game happens. During Main Phase 1 you can:

- **Normal Summon or Set** one monster (once per turn).
- **Change the battle position** of your face-up monsters (with some restrictions).
- **Activate** Spell, Trap, and monster effects.
- **Set** Spell and Trap Cards face-down.
- **Special Summon** monsters (Synchro, Fusion, Ritual, and by card effects) as often as their conditions allow.

For all the ways to put a monster on the field, see the [summoning primer](/learn/rules/primer-summoning).

## Battle Phase {#battle-phase}

If you want to attack, you enter the Battle Phase. It has its own steps (Start, Battle, Damage, End) and is where battle damage is calculated. This page only flags **when** the Battle Phase happens in the turn — the full mechanics (attack declaration, the Damage Step, and replays) are covered in the [Battle Phase primer](/learn/rules/primer-battle-phase).

## Main Phase 2 {#main-phase-2}

After a Battle Phase, you return to a Main Phase. Main Phase 2 works exactly like Main Phase 1, **except** you cannot repeat a once-per-turn action you already used — so if you Normal Summoned in Main Phase 1, you cannot Normal Summon again here. Use it to set up your defenses for the opponent's turn.

## End Phase {#end-phase}

Announce the end of your turn. Effects that say "during the End Phase" resolve now. Then, if you are holding **more than 6 cards**, you must discard down to a **hand size of 6**.

> **Example.** You finish your turn holding 8 cards. During your End Phase you discard 2, ending with 6.

## The first player draws on turn 1 {#turn-1-draw}

In Edison, the player who goes first **does draw** during their very first Draw Phase. So going first, you begin your first Main Phase with **6 cards** (5 opening cards + 1 drawn). This is different from modern Yu-Gi-Oh, where the first player skips their turn-1 draw. See [Rule #1 — The Starting Player Draws a Card](/learn/rules/difference-01-starting-player-draws).

## The first player cannot attack on turn 1 {#no-turn-1-battle-phase}

The player who goes first **cannot conduct a Battle Phase on their very first turn** — there are no first-turn attacks. Attacks become available from that player's second turn onward. (The player going **second** may attack normally on their first turn.)

> **Example.** You go first and Summon a 1900-ATK monster. You still cannot attack this turn; your Battle Phase is skipped. Your opponent, going second, could attack on their first turn.

## Who acts first: priority {#priority}

Within each phase and step, the **turn player acts first** — this is called having priority. While the turn player holds priority, the opponent cannot activate cards, except for effects that trigger automatically. The turn player either uses priority to do something, or passes it; passing lets the opponent respond, and it passes automatically when you move to the next phase or step.

Edison adds one extra priority rule on top of this: after a Summon, the turn player can get to act before the opponent — see [Rule #6 — Ignition Effect Priority](/learn/rules/difference-06-ignition-effect-priority). For how responses stack up into a chain, see the [chains and Spell Speed primer](/learn/rules/primer-chains-and-spell-speed).
