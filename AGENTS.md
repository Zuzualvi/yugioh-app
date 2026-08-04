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
- **No user-facing capability regresses.** Every slice's acceptance criteria include
  it, whether or not anyone wrote it down: if your change removes, stubs or breaks
  something a user can do today, that is a finding you must report **before** it is
  reviewed, not a detail for the reviewer to notice. Say what breaks, for whom, and
  for how long.

  This exists because it has been missed. A slice was verified 13 criteria out of 13
  and recommended for merge while reducing two live screens to placeholders — the
  criteria were all met, and not one of them asked whether the product still worked.
  A green pipeline measures what you thought to ask it.

---

## External output contracts are pinned in specs — never invented

Types and schemas in `packages/contracts/` must reflect what the specs say,
not what feels convenient. If you need a new message shape, update the spec
first and have it reviewed, then update contracts. Do not invent wire formats.

**Deleting a shared contract is not a slice-local change.** `packages/contracts/` is
imported by every other package, so removing an export breaks files no single slice
owns. A spec that deletes one must either **list the collateral-damage files by path**
or **define a deprecation shim** that keeps the old export working until the last
consumer is gone. If you are implementing and you find a deletion the spec did not
enumerate, that is a **stop-and-ask**, not something to work around.

This exists because it happened: deleting `CreateDuelResultSchema`,
`JoinDuelResultSchema` and `PreJoinDuelInfoSchema` broke four files the slice did not
own, and the engineer stubbed them to get green — which destroyed working UI. The
build passed. The product did not.

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

## Git / push protocol (one checkout per writer)

**Clone from GitHub. There is exactly one source:**

```sh
git clone https://github.com/Zuzualvi/yugioh-app.git
```

**Never clone a local path.** Not `/workspace/yugioh-app`, not a sibling agent's
directory, not a path someone mentioned in a brief. A clone of a local checkout gets a
local `origin`, and every push then lands in a directory on the machine while
reporting success — including the verification in step 5 below, which compared SHAs
against whatever `origin` happened to be. An engineer on this repo reported
`SHA pushed, VERIFIED (remote == local)` for 984 green tests that existed only inside
its own container. The branch was never on GitHub. Nothing in the check was wrong; the
check was pointed at a mirror.

**Work in your OWN clone.** Do not build in a checkout that another agent is also
working in. Clone to your own directory, `npm install` there, and stay there for the
whole task.

This rule replaces an earlier "shared working tree" protocol, and it was written
after that protocol failed in a way nothing caught. Two specialists ran concurrently
in one checkout; one was running a throwaway spike. The other committed five of the
spike's files onto its feature branch — including a debug WebSocket endpoint that
would have shipped to production — and its `index.ts` ended up wired to the spike's
handler instead of the router its own slice was supposed to deliver. An acceptance
criterion silently went unmet **behind a green build**. Isolation is cheaper than
the review round that catches this, and far cheaper than the one that doesn't.

1. Clone, then commit locally with a clear, imperative message. `git add` the
   **explicit paths you own** — never `git add -A`, and never `git add` a directory
   whose contents you have not enumerated.
2. **Assert your branch contains only your files before you push:**
   ```sh
   git diff --name-only origin/<base>...HEAD
   ```
   Every path in that output must be one you were told you own. If anything else is
   there, it is not yours — remove it from the branch and find out how it arrived.
   Paste this output in your task report; it is the only cheap proof that a branch is
   clean, and it takes one command.
3. Rebase on your base branch: `git pull --rebase origin <base>`. In your own clone
   there is no sibling's uncommitted work, so `--autostash` is not needed and its
   absence is a feature — a rebase that wants to stash something means you have
   uncommitted changes you did not account for.
4. Push your branch and open a PR. On network error, retry with exponential back-off:
   2 s → 4 s → 8 s → 16 s.
5. **Proof of delivery — verify the remote is GitHub, then that it has your commit.**
   Both halves, in this order. The first is the one that was missing:
   ```sh
   branch=$(git rev-parse --abbrev-ref HEAD)
   url=$(git remote get-url origin)
   case "$url" in
     https://github.com/*|git@github.com:*) ;;
     *) echo "NOT DELIVERED: origin is $url, not a github.com remote"; exit 1 ;;
   esac
   local=$(git rev-parse HEAD)
   remote=$(git ls-remote "$url" "$branch" | awk '{print $1}')
   [ "$local" = "$remote" ] && echo "VERIFIED $local on $url" || echo MISMATCH
   ```
   Copy it as-is — it reads your current branch itself. It deliberately contains no
   `<placeholder>`: bash parses `<` as a redirection, so a snippet with one in it dies
   on a syntax error, and a verification step that errors out is a verification step
   nobody runs twice.
   Note that `ls-remote` is given the URL, not the name `origin` — a check that can
   pass against a local mirror is not a check, and this one silently did.
6. Report the pushed SHA **and the remote URL you verified it against** as proof of
   delivery in your task report. A SHA on its own is not proof of anything: it is
   equally consistent with a commit that reached GitHub and one that reached a folder.

### The gate is the WHOLE repo, not your package

Run **`npm run verify`** — the full pipeline — in your own clone before every push.

An earlier version of this file told parallel writers to "gate on your own
package(s)" with scoped `tsc`, `eslint` and `vitest`, because a repo-wide run would
trip over siblings' half-finished code in the shared tree. That advice is deleted.
It was a workaround for a problem that one-checkout-per-writer removes, and it
directly caused a slice to be reported green while the feature it delivered was not
attached to the running server: the unit tests passed in isolation, and nothing ever
exercised the real wiring. **A scoped green is not a green.** If `verify` fails on
code you do not own, that is information — report it, do not narrow the command until
it passes.

Independent QA re-runs the same pipeline on a **fresh clone** before anything merges.
Your green is necessary, not sufficient.

### Integration branches — when a feature is not incrementally shippable

`master` is wired to deploy (merge = deploy). Some features cannot be merged a slice
at a time without taking working functionality away from users: a slice may replace a
live screen with a placeholder, or delete an endpoint its replacement has not shipped
yet. Half a feature on `master` is worse than none of it.

For those, the CTO cuts an integration branch (`integration/<feature>`), every slice
targets **that** branch, and it merges to `master` once the feature works end to end
and QA has verified it whole. Each slice still gets its own PR and its own QA pass on
the way in — the integration branch changes the merge target, not the standard.

**If you add an integration branch, add it to `ci.yml`'s `pull_request.branches`
trigger in the same change.** That trigger is an allowlist. A PR into a branch not
named there runs **zero checks** — which is worse than the situation the integration
branch was created to fix, and it fails silently, because a PR with no checks looks
much like a PR with passing ones. Workflow files cannot be changed by `git push`;
they go through the gated GitHub MCP write.

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

Runs: `typecheck → lint → arch:check → actionlint → docs:check → test` — the same
steps as the GitHub Actions pipeline. All must be green before any push or PR. Run it
whole; see "The gate is the WHOLE repo" above for why a scoped run is not a gate.

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

**Every PR must CLOSE its Linear issue** — put `Closes ZUH-123` in the body.

Linear scans every PR's title, branch name and body for issue keys. **You cannot turn that
off**, and the label below does not stop it — it only skips our own CI check. What you _can_
control is which words you use, and they mean three different things:

| You write                                                           | Links the issue? | Moves it to _Done_ on merge? |
| ------------------------------------------------------------------- | ---------------- | ---------------------------- |
| `Closes` / `Fixes` / `Resolves` **ZUH-123**                         | yes              | **yes**                      |
| `Refs` / `References` / `Part of` / `Related to` / `Toward` ZUH-123 | yes              | no                           |
| a bare `ZUH-123` anywhere                                           | yes              | no                           |
| `Skip ZUH-123` / `Ignore ZUH-123`                                   | **no**           | no                           |

Every linked issue moves to _In Progress_ when the PR opens, whichever wording you used. So
a PR that links its issue without a closing keyword leaves the work stuck _In Progress_
forever — green build, shipped code, and a board that has silently stopped matching reality.
Verified in both directions in this repo on 2026-07-27/28.

**CI enforces that a reference exists** (`linear-reference` job); it cannot enforce that you
used the right word. That part is on you.

Three rules about _which_ issue, all learned the same day:

- Reference the **engineering issue you are implementing**, and close it. One PR, one issue.
- **Never link a discovery issue.** Those are owned and closed by the Product Lead when it
  delivers, and Linear cannot tell the difference — linking one rewinds completed product
  work to _In Progress_. If you need to _mention_ one, write `Skip ZUH-123` so it is not
  linked at all.
- **Do not quote an issue key in prose.** A PR body explaining "PR #2 said `Closes ZUH-13`"
  is not a description of the mechanism — Linear reads it as the mechanism and acts on it.
  Use `Skip`, or write the key so it cannot match.

For work that genuinely has no ticket — a repair, a docs fix — add the **`no-linear`** label.
Deliberately a label rather than a magic word, so skipping the rule is visible on the PR.
Borrowing an unrelated issue key just to turn CI green is how the bug above was caused.

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
