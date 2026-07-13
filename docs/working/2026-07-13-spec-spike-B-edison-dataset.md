# Spike B — Frozen Edison Dataset Build (Backend)

**Owner role:** Backend Engineer. **Status:** ready. **Priority:** high, INDEPENDENT of Spike A (data pipeline, no engine needed). **Repo:** `/workspace/yugioh-app` (branch `master`).

## Goal
Produce the **frozen, versioned Edison data artifacts** the deck builder and the duel server will both validate against: the legal-card allow-list, the banlist, the pre-errata alias map, and a documented functional-errata gap list. Data + mapping + enumeration only — **no Lua script authoring in this spike** (that's a later task).

Read first (on this machine):
- `/mnt/memory/yugioh-app-team-memory/domain/edison-format.md` — RESOLVED counts, the 27-card DT01 exclusion, set list, conventions, and **data-access recipes** (fetch `banlist.js` / `EdisonCards.json` directly to bypass JS rendering).
- `/workspace/yugioh-app/docs/working/2026-07-13-research-edison-pool-exclusions.md` — the 27 DT01 excluded passcodes, legal count (~3,681), side-deck/first-turn conventions.
- `/workspace/yugioh-app/docs/working/2026-07-13-research-edison-functional-errata.md` — the 36 functional-errata entries + substitute passcodes + script availability.

## Ground truth (from resolved research — do not re-litigate)
- Legal pool ≈ **3,681** unique cards (edisonformat.net `EdisonCards.json`) — follow edisonformat.net exactly.
- Banlist = **March 2010 TCG**: **43 Forbidden / 70 Limited / 19 Semi**.
- Exclude the **27 Duel Terminal 1 (DT01)** cards (all 30 Hidden Arsenal 1 cards ARE legal).
- The allow-list MUST accept **pre-errata alias passcodes** (e.g., Brionac `511002993`, Sangan `511002631`, Rescue Cat `511002992`, Goyo `511002994`, Brain Control `511002995`, Future Fusion `511002997`, Imperial Order `511002996`) or those staples will be false-flagged.
- Source repos: pool whitelist `ThaSMorato/alt-formarts-lflists` (`!2010.3 Edison`); errata-substitution banlist `diamonddudetcg/edopro-custom-banlists` under its **`Edison` git tag** (not `main`).

## Environment constraints
- Do NOT commit `node_modules`, giant vendored repos, or `cards.cdb`. If you clone source repos to cross-check, put them under `spikes/spike-b-dataset/vendor/` with a local `.gitignore`. The generated artifacts (below) ARE committed — they're small text/JSON.

## Exclusive file ownership
You may create/edit ONLY under `spikes/spike-b-dataset/`. Nothing else.

## Deliverables — OUTPUT CONTRACTS ARE PINNED (do not vary field names/shapes)
Produce these files under `spikes/spike-b-dataset/out/`:

1. **`edison-allowlist.json`** — the frozen legal pool. Exact shape:
   ```json
   {
     "format": "edison-2010-03",
     "source": "edisonformat.net EdisonCards.json",
     "generatedAt": "<ISO-8601 date>",
     "count": <int>,
     "cards": [ { "passcode": <int>, "name": "<string>" } ]
   }
   ```
   `cards` sorted ascending by `passcode`. `count` MUST equal `cards.length`.

2. **`edison-alias-map.json`** — pre-errata / alt-art alias passcodes the allow-list must accept, mapped to the base card they count as. Exact shape:
   ```json
   { "<aliasPasscode>": { "base": <int>, "name": "<string>", "reason": "pre-errata" | "alt-art" } }
   ```
   (keys are stringified passcodes.)

3. **`edison.lflist.conf`** — standard EDOPro `lflist.conf` format (header line `!2010.3 Edison`, then `<passcode> <count>` lines for Forbidden(0)/Limited(1)/Semi(2)). This is the engine-consumable banlist.

4. **`dt01-excluded.json`** — the 27 excluded DT01 passcodes: `{ "count": 27, "passcodes": [ <int>, ... ] }`.

5. **`functional-errata-gaplist.md`** — the 36 entries in a table: `card name | real passcode | Edison-correct behavior (1-line) | modern (shipped) behavior | status`. Status ∈ {`substitute-ready`, `script-exists-unused`, `needs-authoring`, `rules-not-script`}. This is the curation backlog; be precise about which of the 36 fall in each bucket.

6. **`README.md`** — how each artifact was generated (commands/sources), and the verification results (below).

## Acceptance criteria (show real output)
- `edison-allowlist.json` `count` is within a stated, explained tolerance of **3,681** (note any delta and its cause — tokens/anime promos).
- `edison.lflist.conf` contains exactly **43** count-0 (Forbidden), **70** count-1 (Limited), **19** count-2 (Semi) entries — print the three counts computed directly from the file.
- `dt01-excluded.json` has exactly 27 passcodes; assert none of them appear in `edison-allowlist.json`.
- Assert every alias key in `edison-alias-map.json` resolves to a `base` that IS in the allow-list.
- Provide a small script (`verify.ts` or similar) that recomputes all the above assertions from the artifacts and prints PASS/FAIL per check. Paste its output.

## Git / push protocol
Same as Spec 00: commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD → report pushed SHA. Your paths (`spikes/spike-b-dataset/`) are disjoint from other writers.

## Report back
The counts (allow-list, 43/70/19 banlist, 27 DT01), the verify-script PASS/FAIL output, the four-bucket breakdown of the 36 errata cards, the pushed SHA, and any data-access problem (e.g., if `EdisonCards.json` isn't directly fetchable — fall back to the documented recipe in the domain memory file and report what you did).
