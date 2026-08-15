// Copy the inlined single-file build to a STABLE, COMMITTED path.
//
// This repo has no branch previews and no Pages workflow — `deploy.yml` fires on
// `master` only — so there is no hosted URL for a proto/* branch. A container path
// dies with the sandbox. GitHub is therefore the durable route: the built file is
// committed, and a reviewer downloads it and opens it locally.
//
// NOTE: the path is `review/`, not `build/` — the repo root .gitignore ignores
// `build/`, and a committed review artefact must not need a `git add -f` that
// someone will forget. Do not "fix" this by editing the root ignore file.
//
// It runs as part of `npm run build` rather than as a step someone has to remember,
// because a review artefact that is one forgotten command away from being stale is
// worse than no artefact.
import { mkdirSync, copyFileSync, statSync } from "node:fs";

// argv[2] = built file, argv[3] = the committed review path. Defaults are the
// prototype's and are unchanged; the catalogue passes its own.
const SRC = process.argv[2] ?? "dist/index.html";
const OUT = process.argv[3] ?? "review/duel-redo-prototype.html";
mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
copyFileSync(SRC, OUT);
console.log(`published ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} kB, self-contained)`);
