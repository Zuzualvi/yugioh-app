# ADR 0003 — The Vercel deploy job deletes `.git` before deploying

**Status:** Accepted
**Date:** 2026-07-29
**Decided by:** CEO, who made the call and pushed the fix (`a1e00f6`). Diagnosis by the CTO and the
Infra Engineer. Two prior CTO sessions reached wrong conclusions here; see "How we got it wrong".
**Workflow:** `.github/workflows/deploy.yml`, job `deploy-frontend`
**Project:** Duel Invite Improvements (surfaced during the pre-duel room cutover, but not part of it)

---

## Context

`deploy-frontend` runs `rm -rf .git` after `actions/checkout` and before any Vercel command. Deleting
the repository from a deploy job looks like a mistake or a hack. It is neither, and this ADR exists so
that nobody deletes the line — doing so silently breaks production deploys, which is exactly the
failure it was written to end.

The constraint is a Vercel **plan-tier** rule, not a project setting. On a Hobby team, a deployment is
rejected outright unless the **git commit author's email is the team owner's registered address**.
There is no allowlist and no collaborator mechanism to widen it. Vercel's CLI reads git metadata out of
the checkout and attaches it to the deployment, so this applies to token-authenticated `vercel deploy`
runs and not only to Git-integration deploys. The rejection happens **before the build is queued**: the
deployment goes to state `BLOCKED`, no build ever starts, there is no build log to read, and the CLI
sits waiting for a build that will never begin until the job hits its timeout.

Two things made this hard to see:

1. **The observable symptom is a timeout, and the cause is an authorization refusal.** The job log ends
   in `The operation was canceled` at just over the job's `timeout-minutes`, which reads as a slow
   build, a queue problem, or a hung network call. Nothing in the Actions log mentions authorship.
2. **Most commits here pass the gate, so the failure is intermittent by author.** Commits pushed with
   `git` carry the configured identity `zuhayralvi@gmail.com` and deploy normally. The ones that fail
   are the commits this team cannot author any other way:
   - `.github/workflows/**` changes, which **cannot** be made by `git push` — the push token
     deliberately lacks the Workflows permission, so they go through the GitHub API write, which stamps
     the credential's own `94854229+Zuzualvi@users.noreply.github.com`.
   - anything authored `Claude <noreply@anthropic.com>`.

   So the deploy pipeline broke precisely when someone changed the deploy pipeline, and looked healthy
   the rest of the time.

The evidence that settled it, from Vercel's deployment records rather than from CI logs — 20
consecutive production deployments, with no exceptions in either direction:

| Commit author email | Deployments | State |
| --- | --- | --- |
| `zuhayralvi@gmail.com` | 15 | all `READY` |
| `94854229+Zuzualvi@users.noreply.github.com` | 4 | all `BLOCKED` |
| `noreply@anthropic.com` | 1 | `BLOCKED` |

`app.zuhayr.io` had therefore been serving a stale frontend since roughly 18 July.

## Decision

**Delete `.git` in the `deploy-frontend` job after checkout and before `vercel pull`, `vercel build`
and `vercel deploy`.** With no repository present the CLI has no commit author to attach, the
deployment carries no git metadata at all, and the author gate has nothing to evaluate.

Verified rather than assumed: the deployment for `a1e00f6` came back `state: READY`, `target:
production`, aliased to `app.zuhayr.io`, with `meta: {}` — empty, where every previous deployment
carried a full `githubCommit*` block. The absent metadata *is* the mechanism working.

## Alternatives considered

**Amend the commit author inside the CI checkout** (`git commit --amend --reset-author` to the owner's
address). Works, and was specced in full. Rejected because it fixes only the authorship *value* while
leaving the dependency on authorship in place, and because rewriting the commit changes its SHA — so
the SHA Vercel records against the deployment would exist nowhere on GitHub, and "which commit is live
in production?" becomes unanswerable from the Vercel side. That is a bad trade for a question you ask
precisely when something is broken. It also needed `--meta` plumbing to carry the true SHA back, which
is complexity in service of a worse design.

**Upgrade to the Pro plan (~$20/month).** Rejected on the merits before cost: it would not have fixed
it. Pro permits any *team member* to author a deployment, but `94854229+Zuzualvi@users.noreply.github.com`
and `noreply@anthropic.com` have no Vercel accounts and cannot be added as members, so the workflow-file
commits — the exact commits that fail — would still be blocked. This is worth recording because
"upgrade the plan" was the intuitive answer and it was wrong.

**Raise `timeout-minutes`.** This was tried and it is the wrong fix, because it treats the symptom. The
deploy never starts, so no timeout is long enough; a bigger number only lengthens the wait before the
same failure. It also leaves the outcome *unobservable*, which was the worse half of the problem.

**Suppress the metadata with `VERCEL_GIT_COMMIT_AUTHOR_*` environment variables.** Not viable: those
are values Vercel *injects into* a build, not inputs the CLI accepts.

## Consequences

- Production deploys no longer depend on which credential authored a commit. Workflow-file changes,
  API-written commits and merge commits all deploy identically. This is the property that matters: the
  fix is indifferent to how the commit was produced, rather than correct for one more case than before.
- **Vercel deployments no longer carry a commit SHA, branch or author.** This is the real cost. To find
  out what is live you must go through the GitHub Actions run that produced the deployment, not the
  Vercel dashboard. If that traceability turns out to be needed, the way to restore it is `vercel deploy
  --meta gitSha=$GITHUB_SHA`, which attaches our own metadata without reintroducing an author for the
  gate to reject — and that is a new ADR, not an edit to this one.
- `deploy-frontend` must keep doing its own checkout and must not gain a step that needs git history
  (for example a changelog generator, or a `git describe` version stamp) after the deletion point. Such
  a step has to run before `.git` is removed.
- The paired change in the same job — `vercel build` on the runner then `vercel deploy --prebuilt` —
  stays for an independent reason: the build log becomes visible line by line, and the job is green if
  and only if the deploy actually landed, with no asynchronous remote build that can outlive the runner.
  It is not part of this fix and does not address the author gate. Worth knowing that `--prebuilt` does
  **not** fail fast on a blocked deployment; it hangs like the non-prebuilt path.

## How we got it wrong, twice

Recorded deliberately, because the wrong answers were more plausible than the right one and the next
person deserves to not re-derive them.

The first session observed `BLOCKED` on every check, found the `CANCELLED` Vercel step, and reported
the cause as undiagnosed with no theory. It also recorded that the author gate **"CANNOT be the
cause"**, reasoning that the project has no Git integration connected and `vercel deploy --prod` with a
token is authorship-independent. The first half of that was true and the second did not follow: the CLI
attaches git metadata regardless, so "no Git integration" was accurate and irrelevant. That single
sentence, written as settled fact in a handoff, removed the correct answer from consideration for the
whole of the next session.

The second session (mine) inherited that exclusion, took the timeout at face value, and shipped a
`timeout-minutes` increase plus the prebuilt change as *the fix* — with a commit message that stated the
timeout theory as established. Then, checking something unrelated in Vercel's API, found the 20-row
author correlation above.

Two lessons, both cheap:

- **A handoff must not state a suspicion as a fact.** "Ruled out" is a claim that needs evidence
  attached, and the ruling-out here was inference presented as a conclusion.
- **Read the provider's own records, not just CI's view of them.** Every fact needed to solve this was
  sitting in the Vercel deployments API the entire time — the `BLOCKED` state, the author email, the
  absent build. The Actions log could not express the cause, because the refusal happened before
  anything the runner could see.
