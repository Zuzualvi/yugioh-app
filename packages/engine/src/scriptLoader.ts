// ---------------------------------------------------------------------------
// Script loader — loads Lua card scripts with override-dir precedence.
//
// Precedence (highest wins):
//   1. packages/engine/scripts/edison-overrides/<passcode>.lua  ← owned by slice 40
//   2. assets/scripts/official/<name>
//   3. assets/scripts/pre-errata/<name>
//   4. assets/scripts/goat/<name>
//   5. assets/scripts/<name>   (system scripts: constant.lua, system.lua, …)
//
// The edison-overrides/ directory is populated by the card-script curation
// slice (stream2-slice40). This loader only provides the MECHANISM.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const OVERRIDES_DIR = resolve(__dir, "../scripts/edison-overrides");
const SCRIPTS_DIR = resolve(__dir, "../assets/scripts");

/**
 * Return the Lua source for the given script name, or null if not found.
 * Used as the `scriptReader` callback in ocgcore-wasm createDuel().
 *
 * @param name - Script filename (e.g. "c9411399.lua", "constant.lua").
 */
export function getScript(name: string): string | null {
  const isCardScript = /^c\d+\.lua$/.test(name);

  // Build precedence list
  const candidates: string[] = [];

  // 1. Edison overrides always win for card scripts
  if (isCardScript) {
    candidates.push(resolve(OVERRIDES_DIR, name));
  }

  if (isCardScript) {
    candidates.push(
      resolve(SCRIPTS_DIR, "official", name),
      resolve(SCRIPTS_DIR, "pre-errata", name),
      resolve(SCRIPTS_DIR, "goat", name),
      // Final fallback: root scripts dir (resolves c0.lua and any root-level card scripts)
      resolve(SCRIPTS_DIR, name),
    );
  } else {
    // System scripts (constant.lua, system.lua, etc.)
    candidates.push(resolve(SCRIPTS_DIR, name));
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}
