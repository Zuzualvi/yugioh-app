---
id: rules.diff.10
section: rules
group: difference
ruleNumber: 10
title: "Life Point Costs"
slug: difference-10-life-point-costs
summary: "You cannot pay a Life Point cost if doing so would reduce your LP to exactly 0, and a card with a maintenance cost you cannot pay destroys itself."
keywords:
  [
    life point cost,
    LP cost,
    pay to zero,
    Brain Control,
    maintenance cost,
    Mirror Wall,
    Degenerate Circuit,
    self-destruct,
    cannot pay cost,
  ]
prevId: rules.diff.09
nextId: rules.diff.11
---

**TL;DR:** You cannot pay a Life Point cost if doing so would reduce your LP to exactly 0, and a card with a maintenance cost you cannot pay destroys itself.

Life Points in Edison have a hard floor when they are being spent as a **cost.** You can be reduced to 0 by damage or by an effect, but you cannot _choose_ to pay yourself down to 0.

## You cannot pay a cost down to 0 {#cost-to-zero}

You **cannot pay a Life Point cost if it would reduce your LP to 0** — the action is simply **illegal.** Paying to exactly 0 is not allowed; you must have at least 1 Life Point left after paying.

**Example —** **Brain Control** costs 800 Life Points to activate.

- At **800 LP**, activating Brain Control is **illegal** — paying 800 would leave you at exactly 0.
- At **801 LP**, activating Brain Control is **legal** — paying 800 leaves you at 1.

The rule looks at the moment of payment: exact-to-zero is blocked; leaving even a single Life Point is fine.

## Maintenance costs you cannot pay {#maintenance-costs}

Some cards carry an **ongoing maintenance cost** that must be paid at a set time to keep the card on the field. If you **cannot pay** that maintenance cost (because paying it would take you to 0 or below), the card **cannot pay it and destroys itself** instead.

- **Mirror Wall** has an **optional** maintenance cost of 2000 LP. If your Life Points are **2000 or less**, you cannot pay it, so **Mirror Wall self-destructs.**
- **Degenerate Circuit** has a **mandatory** maintenance cost of 500 LP. If your Life Points are **500 or less**, you cannot pay it, so **Degenerate Circuit self-destructs.**

**Example —** You control **Mirror Wall** and drop to 2000 LP. At the maintenance timing you cannot pay the 2000 cost (that would leave you at 0), so Mirror Wall is sent to the Graveyard by its own rules.

## Related cards {#related-cards}

**Brain Control** is the standard example of an activation cost that becomes illegal at exact-cost Life Points. **Mirror Wall** (optional 2000 maintenance) and **Degenerate Circuit** (mandatory 500 maintenance) show the self-destruct behavior when a maintenance cost can no longer be paid.
