#!/usr/bin/env node
/**
 * Enforce the `docs/` contract from AGENTS.md — the one lever that works without
 * any agent cooperation.
 *
 * Why this exists: this repo once accumulated 85 files in `docs/working/` —
 * handoffs, session logs, readiness reports and specs in one undifferentiated
 * pile — and several specs were written to container-local paths that evaporated
 * with their sandboxes. Nothing enforced where a document went, so the discipline
 * decayed rather than failing loudly.
 *
 * Two kinds of check:
 *   STRUCTURAL (always, whole tree) — invariants the repo satisfies today, so
 *     they can be enforced everywhere without tripping over migrated history.
 *   NEW-FILE ONLY (diff-scoped) — rules the legacy corpus does NOT satisfy, e.g.
 *     a spec naming its Linear Project. Enforced only on files this branch ADDS,
 *     so the 2026-07 line-draw doesn't block every future PR.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED_DIRS = new Set(["adr", "specs", "reference", "working"]);
const errors = [];

const ls = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

// ── structural ────────────────────────────────────────────────────────────────
for (const entry of ls("docs")) {
  const path = join("docs", entry);
  if (statSync(path).isDirectory()) {
    if (!ALLOWED_DIRS.has(entry)) {
      errors.push(
        `docs/${entry}/ is not one of the four homes (${[...ALLOWED_DIRS].join(", ")}). ` +
          `Pick the one that matches the document's lifecycle — see AGENTS.md.`,
      );
    }
  } else if (entry !== ".gitkeep") {
    errors.push(
      `${path} sits at the root of docs/. Every document lives in one of ` +
        `${[...ALLOWED_DIRS].join(" / ")}. If this is a status rollup, it does not belong ` +
        `in the repo at all — work state lives in Linear.`,
    );
  }
}

// docs/working/ is handoffs only, and they are pruned by the next session.
for (const entry of ls("docs/working")) {
  if (entry === ".gitkeep") continue;
  if (!/handoff/i.test(entry)) {
    errors.push(
      `docs/working/${entry} is not a handoff. That folder is session handoffs ONLY — ` +
        `a spec goes to docs/specs/, durable knowledge to docs/reference/, and a report ` +
        `that only mattered on the day it was written should not be committed.`,
    );
  }
}

// ── new files only ────────────────────────────────────────────────────────────
// A spec must name the Linear Project it belongs to, so status is DERIVED from
// that Project and never duplicated into the file (where it would go stale).
const base = process.env.DOCS_CHECK_BASE || "origin/master";
let added = [];
try {
  added = execFileSync("git", ["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
} catch {
  // No base to compare against (shallow clone, first commit) — skip silently
  // rather than fail the build on a git-plumbing detail.
}

for (const file of added) {
  if (!file.startsWith("docs/specs/") || !file.endsWith(".md")) continue;
  let head = "";
  try {
    head = readFileSync(file, "utf8").slice(0, 600);
  } catch {
    continue; // added then removed in a later commit on the same branch
  }
  if (!/^---[\s\S]*?\blinear_project:\s*\S/m.test(head)) {
    errors.push(
      `${file} is a new spec with no \`linear_project:\` in its frontmatter. Add:\n` +
        `      ---\n      linear_project: <the Linear Project name or id>\n      ---\n` +
        `    Status is read from that Project — never write "Status: DONE" into the file.`,
    );
  }
}

if (errors.length) {
  console.error(`\n✖ docs/ placement check failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  • ${e}\n`);
  console.error("The rules live in AGENTS.md → “Where documents go”.\n");
  process.exit(1);
}
console.log("✓ docs/ placement OK");
