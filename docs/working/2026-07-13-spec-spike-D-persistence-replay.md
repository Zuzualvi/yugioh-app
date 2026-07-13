# Spike D — Durable Async Duel Persistence & Resume via Response-Log Replay (Backend)

**Owner role:** Backend Engineer. **Status:** ready (Spike A engine harness proven). **Priority:** HIGH — de-risks R11 + the whole timer/async feature (REQ-TIMER-07, REQ-DATA-06, AC-21). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Why
The CEO's per-duel timer makes **async multi-day play first-class**: an in-progress duel must survive **both players offline for days** and a **server restart/redeploy**, then resume to the exact correct state with the correct remaining deadline. Our chosen mechanism (CTO decision) is an **append-only response log** (seed + ordered committed responses) replayed to rehydrate engine state — the same mechanism also powers the replay feature and serves as an audit trail. This spike proves the mechanism is sound: it hinges on ocgcore being **deterministic** given seed + response sequence.

## Read first (on this machine)
- `spikes/spike-a-ruleset/` — proven ocgcore-wasm@0.1.2 harness + report (reuse the integration pattern; do NOT edit spike-a's files, copy/import what you need).
- `/workspace/yugioh-app/docs/working/2026-07-13-v1-requirements.md` §14 (REQ-DATA-06) + §15 (REQ-TIMER-05/06/07) + R11/R12.

## Exclusive file ownership
Create/edit ONLY under `spikes/spike-d-persistence/`. Vendor third-party under `spikes/spike-d-persistence/vendor/` + local `.gitignore`; don't commit node_modules/vendor/blobs. Don't touch repo root, packages/, docs/, other spikes, /workspace/specs/.

## Persistence tech
Use **SQLite** to match our stack (Node 22 has built-in `node:sqlite`, or use `better-sqlite3`). Model a duel as: `duel(id, seed, duelFlags, created_at, deadline_at, on_clock_seat, status)` + append-only `response_log(duel_id, seq, seat, response_blob, received_at)`. The response log is the durable source of truth.

## Definition of done (real output required)
- **D1 — Log-driven duel.** Drive a duel where every committed response is appended to the SQLite response log (with seq, seat, timestamp). Duel state in memory + durable log in sync.
- **D2 — Determinism proof (the crux).** Replay the same `seed + duelFlags + ordered response log` through a FRESH core twice; assert the resulting states are IDENTICAL (compare a stable hash of the full field query for both seats, and/or the emitted message stream). If ocgcore-wasm shows ANY nondeterminism (RNG, iteration order, uninitialized memory across `createCore()`), find and report the cause — this is make-or-break for the approach.
- **D3 — Restart/resume.** Build a duel to a mid-game state; DISCARD the in-memory core entirely (simulate a server restart/redeploy); rehydrate a brand-new core purely by replaying the persisted seed+log; assert the resumed state == the pre-restart state (same field hash for both seats).
- **D4 — Deadline math on resume.** Store `deadline_at` as an absolute server timestamp for the on-clock seat. On resume compute `remaining = deadline_at - now`. Prove: (a) a duel resumed before its deadline shows correct positive remaining; (b) a duel whose `deadline_at` elapsed while both were "away" resolves as a **timeout loss for the on-clock seat** on resume (state + reason=timeout). Just the persistence+clock math — not the full timer UX.
- **D5 — Design verdict.** `README.md`: is ocgcore-wasm deterministic enough for replay to be sound (yes/no + evidence)? Replay cost for a long duel (measure replay time for e.g. a 50-response log — is periodic snapshotting needed, or is pure replay fine at our scale)? Recommendation for the real build (schema, when to snapshot, how the response log doubles as the replay artifact + audit trail).

## Acceptance
Automated test: (D2) two replays produce an identical state hash; (D3) post-restart replay reproduces the exact pre-restart state hash; (D4) elapsed-deadline resume yields a timeout result. Paste the output.

## Git / push protocol
Shared repo, parallel writers: commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify remote == local HEAD → report pushed SHA. Only add files under `spikes/spike-d-persistence/`; NEVER `git add -A`/`git clean`/`git stash`/`git checkout --` outside your path (other engineers' untracked work is live here).

## Report back
D1–D5 results with pasted output, the determinism verdict (with evidence), replay-cost measurement, the recommended persistence design, the pushed SHA, and any nondeterminism you found (critical if so).
