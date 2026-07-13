import { readFileSync, existsSync } from 'fs';

const SCRIPT_PATH = '/workspace/yugioh-app/spikes/spike-a-ruleset/vendor/scripts';

export function getScript(name) {
  const isCardScript = /^c\d+\.lua$/.test(name);
  const paths = isCardScript
    ? [
        `${SCRIPT_PATH}/official/${name}`,
        `${SCRIPT_PATH}/pre-errata/${name}`,
        `${SCRIPT_PATH}/goat/${name}`,
      ]
    : [`${SCRIPT_PATH}/${name}`];

  for (const p of paths) {
    if (existsSync(p)) {
      try { return readFileSync(p, 'utf-8'); } catch {}
    }
  }
  return null;
}
