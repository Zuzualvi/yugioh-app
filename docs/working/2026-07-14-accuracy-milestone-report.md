# Edison Deck-Builder — Accuracy Milestone Report (2026-07-14)

**From:** CTO • **Push:** master @ `f3a96bf` (remote == local verified)

---

## Bottom line

- **Your original master reds are FIXED.** The prettier-formatting failure and the engine
  circular-dependency arch check are gone; the **code gate (`typecheck · lint · arch · test`)
  passes green** — confirmed by rebuilding the CI pipeline on a clean clone (exit 0).
- **The product's core promise is now empirically PROVEN.** The custom WASM engine builds
  reproducibly from a clean checkout, and an independent QA engineer verified **5 of 6 core
  Edison rules on a fresh clone**, each with an observed engine message stream — including
  **GY-ignition priority**, the exact behavior the custom build exists to deliver.
- **One thing is still red and it is NOT the code:** the GitHub Actions `deploy.yml` **deploy
  job** (Fly) — a **pre-existing** infra failure I've narrowed but can't pinpoint without Fly
  dashboard access (details + the one thing I need from you below).

---

## What is verified green (I watched each pass)

| Item | Status | Evidence |
|---|---|---|
| `typecheck · lint · arch · test` (the code gate) | ✅ GREEN | clean-clone `npm run verify` exit 0; 391 pass, 1 todo |
| Custom WASM builds from scratch | ✅ | `build-wasm.sh` on a fresh clone → 872 KB artifact, emcc 6.0.3 |
| Assets reproducible from scratch | ✅ | `fetch-assets.sh` → cards.cdb + CardScripts, pinned commits |
| **Edison Rule 1 — GY-ignition priority** | ✅ PROVEN | seat 0 offered Malicious [9411399] as CL1 *before* opponent |
| **Edison Rule 2 — MZone ignition** | ✅ PROVEN | seat 0 offered Lonefire [48686504] as CL1 |
| **Edison Rule 3 — first-turn draw** | ✅ PROVEN | seat 0 has 6 cards before first decision |
| **Edison Rule 4 — one face-up field spell** | ✅ PROVEN | Umi destroyed when Mountain activated |
| **Edison Rule 5 — 0-ATK battle rule** | ✅ PROVEN | both 0-ATK monsters destroyed |
| Accuracy suite stability | ✅ | 20/20 clean isolation runs (was ~10% flaky before the fix) |
| 13 gap cards authored + 25 overrides wired | ✅ | all load & run clean against the engine |

**GitHub Actions verify job:** GREEN. **Fly backend:** live (running a prior good image).

---

## What is NOT done / open risks (honest list)

1. **`deploy.yml` deploy-backend job is RED (pre-existing, not the code).** The verify job is
   green; the failure is the `flyctl deploy` step. It is **not** caused by this work
   (prod-server doesn't import the engine; the bundle builds; all image files present). Leading
   suspect: a **Fly volume-name mismatch** — `fly.toml` mounts `source = "data"` but the volume
   may have been provisioned under a different name (`yugioh_data`), which the file itself flags
   as "reconcile post-provision." **I cannot confirm from the sandbox** (no Fly log/CLI access,
   no docker daemon, GitHub API firewalled). → *See "What I need from you."*
2. **Edison Rule 6 (LP-cost-to-zero is illegal) — documented test gap.** The engine patch is
   applied and source-verified, but QA couldn't build a clean deterministic scenario, so it's an
   explicit `todo`. Behavior is in the engine; the empirical test is deferred (closable with a
   Brain-Control-at-800-LP scenario).
3. **Dueling is not wired into the production server yet.** `prod-server.ts` serves the
   deck-builder API only; the duel WebSocket relay + engine aren't mounted, and the Docker image
   doesn't yet bake the WASM/assets. So even a green deploy wouldn't include live dueling — that
   is a separate go-live slice.
4. **CI does not yet run the accuracy suite.** CI doesn't build the WASM, so the accuracy tests
   *skip* in CI. "CI green" currently attests structure, not accuracy. Accuracy is attested by the
   independent clean-checkout gate + the reproducible build scripts. Wiring a cached CI accuracy
   job is a go-live item.
5. **Vercel frontend deploy is BLOCKED** (separate from the backend) — bot-authored commits don't
   map to a GitHub account for Vercel's git integration.

---

## The engineering story (why this took the care it did)

The independent clean-checkout gate caught **three** real bugs that "works-on-the-shared-tree"
state was hiding — each of which **would have failed CI after a push**:
- A cross-package contract drift (engine `step()` split not propagated to the server relay/fake).
- `fetch-assets.sh` didn't reproduce a working engine (a Lua concatenation bug → parse error).
- A WASM lifecycle flaw (deferred-GC race) causing accuracy-test flakiness **and** memory
  corruption under concurrent duels. Fixed at the root by giving **each duel its own WASM core**
  — which also removed a genuine go-live reliability blocker (the server runs many duels at once;
  6 concurrent duels now run clean).

Every one of these was found *before* it reached master, by running the real pipeline on a fresh
clone rather than trusting an implementer's "tests pass."

---

## Path to go-live (concrete, in order)

1. **Unblock the backend deploy** (needs your Fly input — below). Likely a one-line `fly.toml`
   `source` correction, then re-deploy.
2. **Wire dueling into production:** mount the duel WS relay + engine in `prod-server.ts`, and bake
   the WASM + card assets into the Docker image (or build/fetch them in the image build).
3. **Wire the CI accuracy job:** build the WASM (cached by pinned commit) + fetch assets (cached),
   run the Edison-rules suite — so "green CI" attests accuracy, not just structure.
4. **Unblock the Vercel frontend deploy** (fix the commit-identity mapping, or switch to a
   token-based CI deploy).
5. **Close the Rule 6 LP-cost test gap** (nice-to-have; behavior already patched).

---

## What I need from you (the one blocker I can't see past)

To pinpoint the deploy failure, either:
- the **deploy-backend step log** from the failed Actions run
  (`.../actions/runs/29311330187`), or
- the output of **`fly volumes list -a yugioh-app`** and **`fly status -a yugioh-app`**.

With that I can fix the exact failing step (most likely a one-line `fly.toml` change) and get the
deploy job green. Everything else above I can drive without you.

*Pushed SHA `f3a96bf`; verified remote == local. Nothing here is reported as "done" that I did not
watch pass on a clean checkout.*
