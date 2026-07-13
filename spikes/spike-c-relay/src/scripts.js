/**
 * Script reader — loads Lua scripts from vendor/scripts (ProjectIgnis/CardScripts).
 * Used as the scriptReader callback in OCG_CreateDuel.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dir, '../vendor/scripts');

export function getScript(name) {
  const isCardScript = /^c\d+\.lua$/.test(name);
  const paths = isCardScript
    ? [
        resolve(SCRIPT_PATH, 'official', name),
        resolve(SCRIPT_PATH, 'pre-errata', name),
        resolve(SCRIPT_PATH, 'goat', name),
      ]
    : [resolve(SCRIPT_PATH, name)];

  for (const p of paths) {
    if (existsSync(p)) {
      try { return readFileSync(p, 'utf-8'); } catch { /* fall through */ }
    }
  }
  return null;
}
