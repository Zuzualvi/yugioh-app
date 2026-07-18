---
id: rules.diff.04
section: rules
group: difference
ruleNumber: 4
title: "Phase-Dependent Mandatory Trigger Effects"
slug: difference-04-phase-dependent-mandatory-triggers
summary: "If the ACTIVATION of a phase-dependent mandatory Trigger Effect is negated, it keeps activating until it finally resolves — but if its EFFECT is negated, it does not activate again."
keywords:
  [
    mandatory trigger,
    phase-dependent,
    Light and Darkness Dragon,
    Skill Drain,
    Lightsworn,
    Judgment Dragon,
    Lumina,
    Spirit monster,
    Susa Soldier,
    end phase mill,
    activation negated,
  ]
prevId: rules.diff.03
nextId: rules.diff.05
---

**TL;DR:** If the ACTIVATION of a phase-dependent mandatory Trigger Effect is negated, it keeps activating until it finally resolves — but if its EFFECT is negated, it does not activate again.

Some Trigger Effects are **mandatory** and tied to a specific **phase** — for example, "During your End Phase" mill and return effects. In Edison, negating such an effect behaves differently depending on **what** you negate: the activation, or the effect.

## Negate the ACTIVATION → it re-fires {#activation-negated-refires}

If the **activation** of a phase-dependent mandatory Trigger Effect is negated, the effect must **activate again** — repeatedly — until it **finally resolves.** The card is required to try, and negating the _activation_ does not satisfy that requirement.

The classic negator is **Light and Darkness Dragon**, which negates the activation of an effect and then loses ATK/DEF. Against a phase-bound mandatory trigger, Light and Darkness Dragon negates the first activation, the trigger tries again, and this continues until the trigger resolves (Light and Darkness Dragon can only negate so many times before it is used up or destroyed).

**Example —** During your End Phase, **Lumina, Lightsworn Summoner** (a Lightsworn with a mandatory End-Phase mill) must activate its mill. **Light and Darkness Dragon** negates that **activation.** The mill **activates again** — and keeps activating until it resolves, because it is mandatory and tied to the End Phase.

## Negate the EFFECT → it does not re-fire {#effect-negated-no-refire}

If instead the **effect** itself is negated (rather than its activation), the trigger does **not** activate again. The requirement to activate was met; the result was simply negated.

The classic effect-negator is **Skill Drain**, which negates effects on the field.

**Example —** The same End-Phase mandatory trigger activates, but its **effect** is negated by **Skill Drain.** The trigger has activated and resolved into a negated result — it does **not** try again. (Contrast this with Light and Darkness Dragon negating the _activation_, above.)

## Which effects this covers {#which-effects}

This rule governs **phase-dependent mandatory Trigger Effects**, most importantly:

- **Spirit monsters** — their mandatory "return to the hand during the End Phase" trigger (e.g. **Susa Soldier** and other Spirits).
- **Lightsworn monsters and Judgment Dragon** — their mandatory "mill during the End Phase" triggers (e.g. **Lumina, Lightsworn Summoner**).

Each of these must keep activating if its activation is negated, and each stops trying only once it resolves.

## Related cards {#related-cards}

The two negators that define this rule are **Light and Darkness Dragon** (negates an activation → the mandatory trigger re-fires) and **Skill Drain** (negates the effect → it does not re-fire). The phase-bound mandatory triggers it protects belong to the **Lightsworn** engine (**Lumina, Lightsworn Summoner**, **Judgment Dragon**) and the **Spirit** monsters (**Susa Soldier** and friends).
