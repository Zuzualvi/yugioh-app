# AGENTS.md — Durable rulebook for the Yu-Gi-Oh Edison Duel App

Every human and agent touching this repo must follow these rules.
They are enforced by `npm run verify` (local gate) and GitHub Actions (when
enabled); violating them breaks the build.

---

## Dependency direction (load-bearing)

The dependency graph is a strict directed acyclic graph:

```
contracts  ←  engine     ←  server
    ↑         card-data  ↗
   web
```

- **contracts** imports nothing internal. It is the innermost ring.
- **engine** imports contracts only.
- **card-data** imports contracts only.
- **server** imports contracts, engine, and card-data only.
- **web** imports contracts only — **never server, engine, or card-data**.

This is enforced by `npm run arch:check` (dependency-cruiser). Any forbidden
import fails the build immediately. If you think you need to cross a boundary,
stop and raise it with the CTO — the answer is almost always a new type in
contracts, not a new import edge.

---

## One operation per file — no god files

Each file has one clear responsibility. A file that does "auth + validation +
DB write + email send" is a bug waiting to happen and will be rejected in review.
Name files after what they do: `validateDeckList.ts`, not `utils.ts`.

---

## Tests merge with every feature; green `verify` is sign-off

- Every feature PR includes its tests in the same commit/PR — not a follow-up.
- **Run `npm run verify` before every push.** Green `verify` is the sign-off.
- AI may draft tests; the human reviewer owns correctness.

---

## External output contracts are pinned in specs — never invented

Types and schemas in `packages/contracts/` must reflect what the specs say,
not what feels convenient. If you need a new message shape, update the spec
first and have it reviewed, then update contracts. Do not invent wire formats.

---

## How to add a new package

1. Create `packages/<name>/` with:
   - `package.json` (name `@yugioh-app/<name>`, `"type": "module"`, `typecheck` script)
   - `tsconfig.json` extending `../../tsconfig.base.json`
   - `src/index.ts` (public surface)
   - `src/index.test.ts` (at least one passing test using relative imports)
2. Add it to the dependency graph above and update this file.
3. Update `.dependency-cruiser.cjs` with any new forbidden edges.
4. Do **not** add `spikes/` to workspaces — spikes are standalone/throwaway.
5. Run `npm run verify`; it must be green before opening a PR.

---

## Git / push protocol (shared repo, parallel writers)

1. Commit locally with a clear, imperative message. Only `git add` the paths you
   own — **never `git add -A`, `git clean`, manual `git stash`, or `git checkout --`
   on paths you don't own** (a sibling's live, uncommitted work lives in the same
   working tree).
2. Before every push: `git pull --rebase --autostash origin master`.
   `--autostash` is required on this shared tree: a sibling's uncommitted changes to
   tracked files would otherwise abort a plain rebase. Since writers own DISJOINT
   paths, the autostash pop can't conflict.
3. Push: `git push origin master`.
4. On network error, retry with exponential back-off: 2 s → 4 s → 8 s → 16 s.
5. Verify remote == local:
   ```sh
   local=$(git rev-parse HEAD)
   remote=$(git ls-remote origin master | awk '{print $1}')
   [ "$local" = "$remote" ] && echo VERIFIED || echo MISMATCH
   ```
6. Report the pushed SHA as proof of delivery in your task report.

### Verify gate while working in parallel
A repo-wide `npm run verify` fails on siblings' half-finished code sitting in the
shared working tree. While other workstreams are mid-flight, **gate on YOUR OWN
package(s)** (scoped `tsc --noEmit`, `eslint`, and `vitest` for your package). The
CTO runs the full repo-wide `verify` on a clean checkout once a slice's workstreams
all land, and resolves any integration issue then.

---

## Local verify command (authoritative gate)

```sh
npm run verify
```

Runs: `typecheck → lint → arch:check → test` — the same steps as the GitHub
Actions pipeline. All must be green before any push or PR.

**GitHub Actions** (`.github/workflows/ci.yml`) is the remote gate. See
`ci/README.md` for the one-time step to enable it — requires a token with
`workflow` scope.
