# Spike A2 — Edison Ruleset Gap Closure + Flag Validation (Backend, continues Spike A)

**Owner role:** Backend Engineer (SAME instance that did Spike A — reuses the harness/context). **Status:** ready. **Priority:** HIGH — closes the accuracy gaps Spike A surfaced; the "accuracy is sacred" promise. **Repo:** `/workspace/yugioh-app`, branch `master`.

## Context
Spike A confirmed WASM-in-Node works and empirically validated 3 Edison behaviors (first-turn draw, single field spell, monster-zone ignition priority via `OBSOLETE_IGNITION`). It defaulted duelFlags to `MODE_GOAT (0x3f80d072c)` and left two gaps:
1. `TCG_FAST_EFFECT_IGNITION (0x400000000)` (GY-ignition priority) is not in the ocgcore-wasm 0.1.2 enum → GY ignition priority (Plaguespreader/Malicious) unproven.
2. GOAT is the 2005 format; several GOAT flags (damage step, 0-ATK, SEGOC) are present but NOT behaviorally validated for 2010 Edison — and GOAT-verbatim may include something 2010-incorrect.

## Exclusive file ownership
Create/edit ONLY under `spikes/spike-a2-ruleset-validation/` (NEW dir — do not modify the committed `spikes/spike-a-ruleset/`; copy/import from it as needed). Vendor under your dir + local `.gitignore`.

## Definition of done (real output required)
- **A2-1 — GY ignition verdict (resolve the HIGH-risk gap).**
  - Determine which edo9300 core commit `ocgcore-wasm@0.1.2` was built from (check package metadata / its repo), and whether the `TCG_FAST_EFFECT_IGNITION` logic is compiled into that core at all.
  - Empirically test: OR the raw integer `0x400000000` into `MODE_GOAT` and run a GY-ignition-priority scenario — after a relevant summon, is the turn player offered priority to activate a **Graveyard** ignition effect (e.g. Plaguespreader Zombie 33488264, or D-HERO Malicious 9411399) before the opponent's response window? Compare vs. without the bit.
  - Report DEFINITIVELY: GY ignition priority is (a) achievable with the raw bit on 0.1.2, or (b) requires a newer WASM build / native N-API, or (c) not achievable without upgrading the engine. Give a clear recommendation and, if (b), a rough sense of effort.
- **A2-2 — Validate/adjust the remaining flags for 2010 Edison.** Write behavioral scenario tests for: damage-step activation restriction (`SIX_STEP_BATLLE_STEP 0x8` + `SINGLE_CHAIN_IN_DAMAGE_SUBSTEP 0x40000000`) — confirm a non-damage-step-legal card is NOT offered mid-damage-step while Honest-type/Counter-Traps ARE; the 0-ATK battle rule (`ZERO_ATK_DESTROYED 0x10000000`) — two 0-ATK attackers destroy each other, a 0-ATK attacker can't destroy a 0-DEF defender by battle; SEGOC first-trigger (`SEGOC_FIRSTTRIGGER 0x200000000`). Note any GOAT flag whose behavior is WRONG for 2010 Edison.
- **A2-3 — Final Edison duelFlags recommendation.** State the exact integer to use: `MODE_GOAT` as-is, or `MODE_GOAT` ± specific named bits (list them with hex + why). Include the GY-ignition decision and an updated gap list of anything still unvalidated with its residual risk.

## Non-goals
No pre-errata script authoring (Spike B backlog). No UI/server/persistence.

## Git / push protocol
Commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD → report pushed SHA. Only add files under `spikes/spike-a2-ruleset-validation/`; never `git add -A`/`clean`/`stash`/`checkout --` outside it (other engineers' untracked work is live in this working copy).

## Report back
A2-1 GY-ignition verdict (definitive + recommendation), A2-2 per-flag validation results with pasted output, A2-3 the final exact duelFlags recommendation + residual gap list, the pushed SHA.
