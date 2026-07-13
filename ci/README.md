# ci/ — Pipeline source-of-truth

## Why this directory exists

The environment token used to set up this repo does not have GitHub's `workflow`
scope, which is required to push files into `.github/workflows/`. The workflow
definition lives here as the versioned source-of-truth until a human (or a token
with `workflow` scope) enables it.

## One-time setup step to enable GitHub Actions

A person with push access and the `workflow` scope (or via the GitHub web UI)
must do this **once**:

```sh
# From the repo root:
mkdir -p .github/workflows
cp ci/github-actions-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push origin master
```

After that, every push/PR to `master` triggers the pipeline automatically.

## Local equivalent (use this until Actions is enabled)

```sh
npm run verify
```

`verify` runs the exact same steps as the CI pipeline in the same order:
`typecheck → lint → arch:check → test`. Green `verify` is the sign-off for
every push.
