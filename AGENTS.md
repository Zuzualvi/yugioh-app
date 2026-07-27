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

### Pre-commit format hook (husky + lint-staged)

A husky pre-commit hook runs `prettier --write` on STAGED files only via lint-staged.
This fires automatically on `git commit` after `npm install` (which runs `npm run
prepare` → `husky`). It is staged-files-only — safe on the shared working tree because
it never touches your siblings' unstaged work.

- **After cloning or `npm install`:** husky installs itself automatically via the
  `prepare` script. No manual step needed.
- **Before committing:** the hook runs `prettier --write` on your staged
  `*.{ts,tsx,js,jsx,json,css,md}` files. Prettier errors block the commit.
- **Manual format check (before push, belt-and-suspenders):** run
  `npx prettier --check packages/<your-package>` or `npx prettier --check .` from the
  root. This mirrors what `npm run lint` checks in CI.
- **CI always re-checks format** (`npm run lint` includes `prettier --check .`); the
  hook is a local safety net that prevents the unformatted-commit CI failure from
  ever reaching master.

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

---

## Where documents go (`docs/` has exactly four homes)

Every markdown file you write lands in one of these. There is no fifth option and
no root-level status document.

| Folder            | Holds                                                                                            | Lifecycle                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/`       | Architecture decisions                                                                           | **Immutable** once accepted. A reversal writes a NEW ADR referencing the old one — you never edit the conclusion of an existing one. Write one only when the decision is **hard to reverse** _or_ **would look wrong to someone who doesn't know the constraint**. Most features produce zero. |
| `docs/specs/`     | Technical + product specs — what a feature is and how it is built                                | Edited in the same PR that changes the design, so spec and code stay diffable against each other. One spec per feature.                                                                                                                                                                        |
| `docs/reference/` | Durable domain knowledge — Edison rules, engine research, card-data audits, raw capture evidence | No expiry. Edited in place.                                                                                                                                                                                                                                                                    |
| `docs/working/`   | **Session handoffs only**                                                                        | Ephemeral. A session that reads a handoff **deletes every superseded handoff** in its re-grounding commit. Nothing else belongs here.                                                                                                                                                          |

**Status is never written into a file.** A spec does not record whether it is
current — the Linear issue or Project it names does. If you find yourself typing
"Status: DONE" into markdown, that state belongs in Linear.

**No status boards in the repo.** `docs/STATUS.md` and `tasks/BOARD.md` were
deleted in 2026-07; work state lives in **Linear** and is driven automatically by
PR events. Do not recreate them under any name.

**Every PR must reference its Linear issue** — `ZUH-123` in the title, the branch name, or
the body (`fixes ZUH-123` also closes it on merge). This is what drives the automatic
In Progress → In Review → Done transitions, so a PR without it silently breaks work
tracking no matter how green the build is. **CI enforces it** (`linear-reference` job). For
work that genuinely has no ticket, add the **`no-linear`** label — deliberately a label
rather than a magic word in the text, so skipping the rule is visible on the PR.

**`npm run verify` includes `docs:check`**, so placement is enforced locally _and_ in CI.
It runs four rules: nothing loose at the root of `docs/`, no fifth folder, `docs/working/`
contains only handoffs, and **any spec you add must carry `linear_project:` in its
frontmatter**. That last one applies only to files your branch ADDS — the pre-2026-07
corpus predates the convention and is deliberately not retrofitted.

> Why this section exists: this repo previously accumulated **85 files in
> `docs/working/`** — handoffs, session logs, readiness reports, and specs all in
> one undifferentiated pile, with several specs written to container-local paths
> that evaporated with their sandboxes. The discipline did not fail from the start;
> it _decayed_, because nothing enforced where a document went.
