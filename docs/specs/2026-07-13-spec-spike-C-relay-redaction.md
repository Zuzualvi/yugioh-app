# Spike C — Two-Client Relay + Per-Seat Hidden-Info Redaction + Reconnect (Backend)

**Owner role:** Backend Engineer. **Status:** ready (Spike A engine harness proven). **Priority:** HIGH — load-bearing for REQ-NET-01/02, AC-12 (no hidden-info leak), AC-13 (reconnect). **Repo:** `/workspace/yugioh-app`, branch `master`.

## Why
The core runs **server-authoritative**; browser clients are thin renderers that must receive a **per-seat redacted** view. Hidden info (opponent hand identities, deck order, set Spell/Trap identities, face-down defense monster identities) must NEVER reach an unentitled client. This spike proves that redaction on the engine's real message/query stream, plus reconnect with seat integrity.

## Read first (on this machine)
- `spikes/spike-a-ruleset/` — the proven ocgcore-wasm@0.1.2 harness + its report. Reuse the integration pattern (sync mode; `c0.lua` synthesis; per-duel `createCore()`; OcgProcessResult END=0/WAITING=1/CONTINUE=2). Do NOT edit spike-a's files — copy/import what you need into your own dir.
- `/workspace/yugioh-app/docs/working/2026-07-13-research-engine-landscape.md` §2 (engine API, OCG_DuelQuery/QueryLocation/QueryField), §3 (redaction is real work).
- `/workspace/yugioh-app/docs/working/2026-07-13-v1-requirements.md` §10 (REQ-NET) + AC-12/13.

## Exclusive file ownership
Create/edit ONLY under `spikes/spike-c-relay/`. Vendor third-party (CardScripts/cdb) under `spikes/spike-c-relay/vendor/` with a local `.gitignore`; do NOT commit node_modules/vendor/blobs. Do NOT touch repo root, packages/, docs/, other spikes, /workspace/specs/.

## Build
A minimal WebSocket server holding ONE authoritative duel (ocgcore-wasm) with two connected clients (seats 0 and 1). The server owns state; each client receives only its entitled view over a per-seat JSON message stream.

## Definition of done (real output required)
- **C1 — Relay up.** One authoritative core, two WS clients bound to seats 0/1, a scripted duel runs and both clients receive their per-seat message streams.
- **C2 — Redaction proven (the crux).** Assert automatically, across a full duel: client-0's received stream NEVER contains the identity (passcode/name) of: (a) opponent's hand cards (only a count), (b) opponent's set/face-down Spell/Trap, (c) opponent's face-down defense monster, (d) opponent's deck contents/order. Client-0 DOES see its own hand fully. Use the engine's per-player query flags (OCG_DuelQuery / query location + the `QUERY_*` position/facedown flags) AND message-level stripping — some duel messages embed hidden info that must be filtered per recipient. Document exactly how you redact (query-flag level vs message-post-processing).
- **C3 — Legitimate reveal.** Demonstrate a reveal that is entitled to exactly one seat is forwarded to only that seat and re-concealed afterward (either via a real reveal-effect card, or by proving your redaction layer routes an engine "reveal to player X" event to only X). The layer must never over-reveal beyond what the engine reveals.
- **C4 — Reconnect + seat integrity.** A client drops and reconnects via a per-seat token and is restored to the correct redacted CURRENT state (no double-resolution). A different identity/token MUST NOT be able to claim that seat and see its hidden info.
- **C5 — Redaction design writeup.** A `README.md` documenting the redaction model + the minimal per-seat JSON message shapes you used (this feeds the future `packages/contracts` WebSocket contract — keep it clean but don't over-engineer; it's a spike).

## Acceptance
Automated test that fails if client-0's message log ever contains client-1's hidden identities (incl. sets + face-downs) across a full scripted duel, and that reconnect restores the correct redacted state with seat-token enforcement. Paste the test output.

## Git / push protocol
Shared repo, parallel writers: commit locally → `git pull --rebase origin master` → `git push origin master` (retry 2/4/8/16s) → verify `git ls-remote origin master` == `git rev-parse HEAD` → report pushed SHA. Only add files under your owned path; NEVER `git add -A`, `git clean`, `git stash`, or `git checkout --` anything outside `spikes/spike-c-relay/` (other engineers' untracked work is live in this working copy).

## Report back
C1–C5 results with pasted output, the redaction approach (query-flag vs message-strip), the pushed SHA, and any case where the engine's stream leaks info you had to strip manually (call these out — they're the risky ones).
