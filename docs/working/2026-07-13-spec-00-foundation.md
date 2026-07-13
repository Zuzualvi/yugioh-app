# Spec 00 — Repo Foundation & Guardrail Funnel (Infra)

**Owner role:** Infra Engineer. **Status:** ready to build. **Repo:** `/workspace/yugioh-app` (branch `master`, remote github.com/Zuzualvi/yugioh-app).

## Goal
Stand up the monorepo skeleton + CI + architecture guardrails that every later package builds into. This is the "constrain the output space" funnel from our codebase standard: there must be ONE obvious shape for adding a package, an endpoint, a type. No app features in this task — skeleton + guardrails only.

## Exclusive file ownership (do NOT touch anything else)
You may create/edit ONLY:
- Repo-root config: `package.json`, `package-lock.json`, `tsconfig.base.json`, `.eslintrc.cjs` (or `eslint.config.mjs`), `.dependency-cruiser.cjs`, `vitest.config.ts` (root), `.gitignore`, `.editorconfig`, `AGENTS.md`, `README.md`.
- `.github/workflows/ci.yml`
- Package skeletons under `packages/`: `packages/contracts/`, `packages/server/`, `packages/web/`, `packages/engine/` — each with `package.json`, `tsconfig.json`, `src/index.ts`, and one trivial passing `*.test.ts`.
- `packages/README.md`

You MUST NOT create or modify anything under `/spikes/`, `docs/`, or `/workspace/specs/`. Other engineers own those in parallel.

## Requirements
1. **npm workspaces**, Node 22 (`"engines": {"node": ">=22"}`). Root `package.json` declares `workspaces: ["packages/*"]`. Do NOT add `spikes/*` to workspaces (spikes are standalone/throwaway).
2. **TypeScript strict** everywhere. `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "bundler"` or `"nodenext"` (pick one, be consistent), each package `tsconfig.json` extends it.
3. **Packages (skeleton only, minimal):**
   - `contracts` — shared types (WebSocket message contract will live here). Depends on NOTHING internal. Export a placeholder type + a Zod schema example.
   - `engine` — the ocgcore adapter boundary (empty adapter interface stub). Depends on `contracts` only.
   - `server` — backend. May depend on `contracts` and `engine`.
   - `web` — frontend (Vite + React + TS, but keep it a stub — a single component + one test; no real UI yet). May depend on `contracts` only.
4. **Dependency-direction architecture test (load-bearing):** configure `dependency-cruiser` with rules that FAIL the build on any forbidden import: `contracts` may import nothing internal; `engine`→`contracts` only; `web`→`contracts` only (web must NOT import `server` or `engine`); no cycles. Wire it as an npm script `arch:check` and run it in CI.
5. **ESLint** (typescript-eslint) + **Prettier** (or eslint formatting) with a sane shared config. `lint` npm script.
6. **Vitest**: each package has one trivial passing test located relative to its own file (NO hardcoded `/workspace` paths — tests must be portable). Root `test` script runs all workspaces.
7. **CI** (`.github/workflows/ci.yml`) on push + PR to `master`: `npm ci` → `typecheck` (tsc --noEmit across workspaces) → `lint` → `arch:check` → `test`. Must complete well under 10 minutes. Use Node 22.
8. **AGENTS.md** at repo root — the durable rulebook for anyone (human or agent) touching this repo. Include: the dependency-direction rule; "one operation per file, no god files"; "tests merge WITH every feature; green CI is sign-off"; "external output contracts are pinned in the spec, never invented"; how to add a new package; and the **git/push protocol** (below). Keep it tight and practical.
9. **.gitignore**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.log`. (Do NOT put spike-vendor rules here; spikes manage their own.)

## Acceptance criteria (must show real output)
- `npm ci && npm run typecheck && npm run lint && npm run arch:check && npm test` all pass locally — paste the actual output in your report.
- Add a deliberate forbidden import (e.g., `web` importing from `server`), show `arch:check` FAILS, then remove it and show it passes. Prove the guardrail bites.
- CI workflow file is valid YAML and mirrors those steps.

## Git / push protocol (MANDATORY — shared repo, parallel writers)
1. Commit locally with a clear message.
2. Before every push: `git pull --rebase origin master` (your paths are disjoint from other writers, so rebase is clean).
3. `git push origin master`. On network error retry 2s/4s/8s/16s.
4. Verify remote == local: `local=$(git rev-parse HEAD); remote=$(git ls-remote origin master | awk '{print $1}'); [ "$local" = "$remote" ] && echo VERIFIED || echo MISMATCH`.
5. Report the pushed SHA as proof.

## Report back
Pushed SHA; the exact commands to run the full check locally; confirmation the arch guardrail fails-then-passes; anything you had to deviate on and why.
