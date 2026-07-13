# Spike A — Engine Integration + Edison Ruleset Validation (Backend)

**Owner role:** Backend Engineer. **Status:** ready. **Priority:** CRITICAL PATH — gates the whole project's "accuracy is sacred" promise. **Repo:** `/workspace/yugioh-app` (branch `master`).

## Why this spike exists
The founder's #1 requirement is rules accuracy for the **Edison format (March 2010 / Master Rule 1)**. We are reusing the **edo9300 fork of ocgcore** (ygopro-core) + ProjectIgnis Lua CardScripts + `cards.cdb`. Prior product research produced a *candidate* `duelFlags` bitmask and claims the engine can reproduce Edison rules. **That research is a hypothesis, not a decision.** This spike proves engine integration works in our environment AND empirically validates (or corrects) the flag set. Do NOT treat the research's bitmask as settled — verify it.

Read first (they're on this machine):
- `/workspace/yugioh-app/docs/working/2026-07-13-research-engine-edison-rules.md` (the candidate flag set + engine source citations)
- `/workspace/yugioh-app/docs/working/2026-07-13-research-engine-landscape.md` (§2 engine API, §2c bindings incl. `n1xx1/ocgcore-wasm`)
- `/mnt/memory/yugioh-app-team-memory/research/edison-engine-rules-flags.md` (if present, prior notes)

## Environment constraints (verified)
- Node **22.22.0**, npm 10.9, git, docker present. **`emcc` (emscripten) is NOT installed.** Therefore: **prefer a prebuilt WASM artifact / published npm package for the core over building from source.** Investigate `n1xx1/ocgcore-wasm` (npm) first. Only if no prebuilt path exists, report back before sinking time into an emscripten toolchain build.
- The engine + scripts are AGPL — fine for our private repo, but **do NOT commit vendored third-party source, node_modules, `cards.cdb`, or image blobs.** Vendor them under `spikes/spike-a-ruleset/vendor/` and gitignore that dir (create a local `.gitignore` inside your spike dir). Commit only YOUR harness code, test fixtures you author, and the report.

## Exclusive file ownership (do NOT touch anything else)
You may create/edit ONLY under `spikes/spike-a-ruleset/`. Do not touch repo root, `packages/`, `docs/`, other spikes, or `/workspace/specs/`.

## What to build
A minimal Node/TypeScript harness that embeds the core and drives duels headlessly. The processing loop is: `duelProcess → drain messages → (render/inspect) → if AWAITING, feed a scripted response → repeat`.

## Definition of done (each item needs REAL output pasted in the report)
- **A1 — Integration proof.** Create a duel with our candidate Edison `duelFlags`, start it with two minimal legal decks, and drive it via scripted responses through at least several full turns (draw→main→battle→end) to a clean state or natural end. Show real message-loop output.
- **A2 — First-turn draw (flag `DUEL_1ST_TURN_DRAW`).** Assert automatically: WITH the flag, the player who goes first has **6** cards after their turn-1 Draw Phase; WITHOUT it, **5**. This is the cleanest proof the era-flag machinery actually gates behavior.
- **A3 — Ignition-effect priority (flag `DUEL_TCG_FAST_EFFECT_IGNITION`, optionally `+ DUEL_OCG_OBSOLETE_IGNITION`).** Set up: turn player Normal Summons a monster that has an Ignition Effect, while the opponent holds an available Spell-Speed-2 response (e.g., a Bottomless-Trap-Hole-type trap). Assert the engine offers the **turn player** the chance to activate the ignition effect as Chain Link 1 **before** the opponent's response window. Use whatever in-pool cards make this scenario easiest; document exactly which cards/passcodes you used. If GY-ignition-priority (the TCG-flag-only behavior, e.g. Plaguespreader/Malicious) is feasible to test, do it; otherwise note it as follow-on.
- **A4 — Single Field Spell (flag `DUEL_1_FACEUP_FIELD`).** With one Field Spell active, activate a second; assert the first is **destroyed** (pre-MR3 behavior), not that each player keeps their own zone.
- **A5 — Flag set verdict.** Report the FINAL recommended `duelFlags` bitmask (names + hex + composed integer). State clearly, per behavior: **empirically confirmed** / **not yet validated** / **could not reproduce**. Explicitly confirm or CORRECT the research's candidate set. Flag the known-uncertain items (pre-2014 damage-step micro-rulings — `DUEL_6_STEP_BATLLE_STEP` + friends — which the research only inferred from the GOAT preset; `DUEL_USE_TRAPS_IN_NEW_CHAIN`, `DUEL_EQUIP_NOT_SENT_IF_MISSING_TARGET` applicability). You do NOT need to validate every damage-step micro-ruling — produce a GAP LIST of what remains to verify and its risk.
- **A6 — Embedding verdict (feeds the architecture decision).** Report: did you use a prebuilt `ocgcore-wasm` npm artifact or build from source? Any Node flags required (JSPI / `--experimental-wasm-stack-switching`)? WASM payload size? Any blocker that would push us toward the native-shared-lib-via-N-API fallback instead of WASM-in-Node? Give a clear recommendation: **WASM-in-Node viable, or fall back to native.**

## Non-goals (do NOT do here)
- No pre-errata card curation (that's Spike B). Use stock scripts; if a stock script's modern errata affects a test (e.g., Brionac's once-per-turn), note it but don't fix it here.
- No UI, no WebSocket server, no persistence.

## Git / push protocol
Same as Spec 00: commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify `git ls-remote origin master` == local HEAD → report the pushed SHA. Your paths (`spikes/spike-a-ruleset/`) are disjoint from other writers, so rebase is clean.

## Report back
The DoD results (A1–A6) with pasted real output, the final flag-set verdict + gap list, the embedding recommendation, the pushed SHA, and any blocker you hit. If you get blocked on the prebuilt-vs-source question, STOP and report before building emscripten from scratch.
