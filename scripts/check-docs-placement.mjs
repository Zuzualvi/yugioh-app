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

// ── A2a: ADR back-reference check (structural, whole-tree) ───────────────────
// If docs/adr/NNNN-*.md declares it Amends/Supersedes/Corrects another ADR,
// the amended ADR must reference the amending one back.
// Declaration syntax derived from ADR 0005: **Amends:** ADR 0004 ...
// The corpus satisfies this today; any new violation fails loudly.
{
  const adrFiles = ls("docs/adr").filter((f) => /^\d{4}-.+\.md$/.test(f));
  // Build a map: adr number → file path
  const adrByNum = new Map();
  for (const f of adrFiles) {
    const num = f.slice(0, 4);
    adrByNum.set(num, join("docs/adr", f));
  }

  for (const f of adrFiles) {
    const amending = join("docs/adr", f);
    let content;
    try {
      content = readFileSync(amending, "utf8");
    } catch {
      continue;
    }
    // Match **Amends:** ADR NNNN  /  **Supersedes:** ADR NNNN  / **Corrects:** ADR NNNN
    const declPattern = /^\*\*(?:Amends|Supersedes|Corrects):\*\*\s+ADR\s+(\d{4})/gim;
    let match;
    while ((match = declPattern.exec(content)) !== null) {
      const targetNum = match[1];
      const targetPath = adrByNum.get(targetNum);
      if (!targetPath) {
        errors.push(
          `${amending} declares it amends/supersedes/corrects ADR ${targetNum}, ` +
            `but docs/adr/${targetNum}-*.md does not exist.`,
        );
        continue;
      }
      let targetContent;
      try {
        targetContent = readFileSync(targetPath, "utf8");
      } catch {
        continue;
      }
      // The amended ADR must mention the amending file's number somewhere
      const amendingNum = f.slice(0, 4);
      if (!targetContent.includes(amendingNum)) {
        errors.push(
          `${amending} declares it amends/supersedes/corrects ${targetPath}, ` +
            `but ${targetPath} does not reference ADR ${amendingNum} back. ` +
            `Add a back-pointer (e.g. **Superseded by:** [ADR ${amendingNum}](...)) to ${targetPath}.`,
        );
      }
    }
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
} catch (err) {
  // A shallow clone (fetch-depth:1) cannot resolve origin/master for the diff.
  // Fail loudly so this is caught in CI rather than silently passing every check.
  // Fix: set fetch-depth: 0 on the checkout step that runs npm run verify.
  console.error(
    `\n✖ docs:check: could not compute added files — git diff failed.\n` +
      `  Base attempted: ${base}\n` +
      `  Underlying error: ${err.message ?? err}\n` +
      `  Likely cause: shallow clone (fetch-depth: 0 required on the checkout step).\n` +
      `  Override base with: DOCS_CHECK_BASE=<ref> npm run docs:check\n`,
  );
  process.exit(1);
}

// ── A2b: handoff SHA ancestry check (diff-scoped, uses full history) ─────────
// For each file in docs/working/, extract hex tokens that look like commit SHAs.
// Each must resolve as a commit and be an ancestor of the base ref.
// This catches an engineer reporting a pushed SHA that only existed inside their
// container — the work it describes may never have landed.
//
// Note: a prose hex string of 7+ chars is a known false-positive class.
// The fix is to not write one — wrap short hashes in backticks with context,
// or use a full description instead of a raw hex token.
{
  let baseCommit;
  try {
    baseCommit = execFileSync("git", ["rev-parse", base], { encoding: "utf8" }).trim();
  } catch (err) {
    console.error(
      `\n✖ docs:check (A2b): could not resolve base ref for SHA ancestry check.\n` +
        `  Base attempted: ${base}\n` +
        `  Underlying error: ${err.message ?? err}\n` +
        `  Likely cause: shallow clone (fetch-depth: 0 required on the checkout step).\n`,
    );
    process.exit(1);
  }

  const workingFiles = ls("docs/working").filter((f) => f !== ".gitkeep");
  for (const f of workingFiles) {
    const filePath = join("docs/working", f);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const tokenPattern = /\b([0-9a-f]{7,40})\b/g;
    let m;
    while ((m = tokenPattern.exec(content)) !== null) {
      const token = m[1];
      // Check if it resolves as a commit
      let resolves = false;
      try {
        execFileSync("git", ["cat-file", "-e", `${token}^{commit}`], { encoding: "utf8" });
        resolves = true;
      } catch {
        resolves = false;
      }
      if (!resolves) {
        errors.push(
          `${filePath}: hex token "${token}" does not resolve as a commit. ` +
            `If this is not a SHA, note that 7+ char prose hex strings are a known ` +
            `false-positive class — avoid writing them bare in handoffs.`,
        );
        continue;
      }
      // Check it is an ancestor of base
      let isAncestor = false;
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", token, baseCommit], {
          encoding: "utf8",
        });
        isAncestor = true;
      } catch {
        isAncestor = false;
      }
      if (!isAncestor) {
        errors.push(
          `${filePath}: commit "${token}" is not an ancestor of ${base} — ` +
            `it names a commit that is not on master, so the work it describes ` +
            `may never have landed.`,
        );
      }
    }
  }
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
  console.error('The rules live in AGENTS.md → "Where documents go".\n');
  process.exit(1);
}
console.log("✓ docs/ placement OK");
