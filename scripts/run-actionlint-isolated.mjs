#!/usr/bin/env node
/**
 * run-actionlint-isolated.mjs — lint each workflow file with a fresh WASM
 * instance to avoid the actionlint WASM memory-accumulation crash.
 *
 * The actionlint WASM allocates a fixed-size arena and does not reclaim memory
 * between linter() calls. When a large ci.yml is processed first, the remaining
 * WASM heap is insufficient for a subsequent large deploy.yml, producing a
 * RuntimeError: unreachable (WASM trap). Creating a fresh linter per file
 * resets the arena. Same semantics as run-actionlint.mjs; different lifecycle.
 *
 * This replaces run-actionlint.mjs in the `actionlint` npm script. The original
 * script is preserved (it is correct for small file sets).
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

let totalErrors = 0;

for (const file of yamlFiles) {
  const filePath = join(WORKFLOW_DIR, file);
  const content = await readFile(filePath, "utf8");
  // Fresh linter per file: resets the WASM arena so file size does not accumulate.
  const linter = await createLinter();
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
