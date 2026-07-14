#!/usr/bin/env node
/**
 * run-actionlint.mjs — lint all .github/workflows/*.yml files using the
 * actionlint WASM package (no binary download required, fully cross-platform).
 *
 * Exits 0 if all workflows are clean; exits 1 on any lint error.
 *
 * Catches invalid-workflow classes that GitHub Actions itself would reject but
 * that git push can't detect (e.g. `secrets` context used in `if:` conditions).
 */
import { createLinter } from "actionlint";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const WORKFLOW_DIR = ".github/workflows";

const files = await readdir(WORKFLOW_DIR);
const yamlFiles = files.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();

if (yamlFiles.length === 0) {
  console.log("actionlint: no workflow files found — nothing to check");
  process.exit(0);
}

const linter = await createLinter();
let totalErrors = 0;

for (const file of yamlFiles) {
  const filePath = join(WORKFLOW_DIR, file);
  const content = await readFile(filePath, "utf8");
  const results = linter(content, filePath);
  for (const result of results) {
    console.error(
      `${result.file}:${result.line}:${result.column}: error: ${result.message} [${result.kind}]`,
    );
    totalErrors++;
  }
}

if (totalErrors > 0) {
  console.error(`\nactionlint: ${totalErrors} error(s) in ${WORKFLOW_DIR}/ — fix before pushing`);
  process.exit(1);
} else {
  console.log(`actionlint: ${yamlFiles.length} workflow(s) clean (${yamlFiles.join(", ")})`);
}
