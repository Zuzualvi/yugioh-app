---
id: rules.diff.07
section: rules
group: difference
ruleNumber: 7
title: "SEGOC — Simultaneous Effects Go on the Chain"
slug: difference-07-segoc
summary: "When multiple effects trigger at the same time, they go on the chain in a fixed order: turn player's mandatory first, then turn player's optional, then opponent's mandatory, then opponent's optional."
keywords:
  [
    SEGOC,
    simultaneous effects,
    chain order,
    mandatory,
    optional,
    trigger effect,
    synchronize,
    simultaneous,
  ]
prevId: rules.diff.06
nextId: rules.diff.08
---

<!-- ⚠ PLACEHOLDER CONTENT — Track C will replace this with authoritative content sourced from edisonformat.com. Do not cite as authoritative. -->

# Rule #7 — SEGOC {#top}

> **PLACEHOLDER:** This page will be authored by Track C with verified content sourced from edisonformat.com once the in-app docs surface (Track B4) ships.

**TL;DR:** When multiple effects trigger simultaneously, they stack on the chain in a fixed order: turn player's mandatory effects → turn player's optional effects → opponent's mandatory effects → opponent's optional effects.

## The Four-Step SEGOC Order {#four-step-order}

When two or more Trigger Effects activate at the same time (e.g. two monsters die in the same chain resolution), they go on the chain in this exact sequence:

1. **Turn Player's Mandatory Triggers** (Chain Link 1)
2. **Turn Player's Optional Triggers** (Chain Link 2, if any)
3. **Non-Turn Player's Mandatory Triggers** (Chain Link 3, if any)
4. **Non-Turn Player's Optional Triggers** (Chain Link 4, if any)

The chain then resolves in Last In, First Out (LIFO) order — the last effect added resolves first.

## Why This Matters {#why-it-matters}

SEGOC determines **who benefits from timing.** An optional effect that ends up as the last Chain Link resolves first and cannot be negated by effects added earlier in the chain.

**Example:** Your Sangan and your opponent's Sangan are both destroyed simultaneously. Your opponent is the turn player. The chain is: CL1 = opponent's Sangan (mandatory, turn player goes first even though it's optional — wait, Sangan is optional). See the full rule for how mandatory vs optional interacts.

> **Note:** The full SEGOC rule is nuanced. Track C will provide worked examples for each case.
