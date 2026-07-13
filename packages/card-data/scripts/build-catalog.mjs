/**
 * build-catalog.mjs
 *
 * One-time pipeline: fetches the full YGOPRODeck dump, filters to the
 * Spike-B Edison allow-list, decodes each entry to a CardDTO, and writes
 * out/edison-card-catalog.json + out/alias-index.json.
 *
 * Run: node scripts/build-catalog.mjs
 * Requires network access (YGOPRODeck cardinfo.php).
 *
 * Known YGOPRODeck passcode discrepancies (allow-list id → YGOPRODeck id):
 *   80604091 (Ultimate Offering) → 80604092  (off-by-one in YGOP database)
 *   0        (Orichalcos Shunoros) → 7634581  (anime card, virtual passcode in community list)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPIKE_B = path.resolve(ROOT, "../../spikes/spike-b-dataset/out");
const OUT = path.join(ROOT, "out");

// Passcode corrections: allowlist passcode → YGOPRODeck id to look up
const PASSCODE_CORRECTIONS = {
  80604091: 80604092, // Ultimate Offering: off-by-one in YGOPRODeck full dump
  0: 7634581,         // Orichalcos Shunoros: anime card, virtual passcode in community list
};

// ---------------------------------------------------------------------------
// Load Spike-B artifacts (ground truth — do NOT re-derive)
// ---------------------------------------------------------------------------
const allowlist = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "edison-allowlist.json"), "utf8"),
);
const aliasMap = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "edison-alias-map.json"), "utf8"),
);
const dt01Excluded = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "dt01-excluded.json"), "utf8"),
);
const lflConf = fs.readFileSync(
  path.join(SPIKE_B, "edison.lflist.conf"),
  "utf8",
);

// ---------------------------------------------------------------------------
// Parse lflist.conf → { passcode: 0|1|2 }
// ---------------------------------------------------------------------------
function parseLflist(conf) {
  const result = {};
  for (const line of conf.split("\n")) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("!") ||
      trimmed.startsWith("$") ||
      trimmed.startsWith("#")
    ) {
      continue;
    }
    // Format: "<passcode> <count> --<name>"
    const m = trimmed.match(/^(\d+)\s+([012])\s/);
    if (m) {
      result[Number(m[1])] = Number(m[2]);
    }
  }
  return result;
}

const lflist = parseLflist(lflConf);

// Build REVERSE alias map: base_passcode → alias_passcode
// Pre-errata aliases appear in the lflist under the alias passcode, not the
// base passcode. This reverse map lets base cards inherit their banlist status.
const baseToAlias = {};
for (const [aliasPc, { base }] of Object.entries(aliasMap)) {
  baseToAlias[base] = Number(aliasPc);
}

// ---------------------------------------------------------------------------
// Build alias-index.json { aliasPasscode(string): basePasscode(number) }
// ---------------------------------------------------------------------------
const aliasIndex = {};
for (const [aliasPc, { base }] of Object.entries(aliasMap)) {
  aliasIndex[aliasPc] = base;
}

// ---------------------------------------------------------------------------
// Banlist resolver: own passcode first, then reverse-alias lookup
// ---------------------------------------------------------------------------
function resolveBanlist(passcode) {
  if (lflist[passcode] !== undefined) {
    return countToBanlist(lflist[passcode]);
  }
  const aliasPc = baseToAlias[passcode];
  if (aliasPc !== undefined && lflist[aliasPc] !== undefined) {
    return countToBanlist(lflist[aliasPc]);
  }
  return "unlimited";
}

function countToBanlist(count) {
  if (count === 0) return "forbidden";
  if (count === 1) return "limited";
  if (count === 2) return "semi";
  return "unlimited";
}

// ---------------------------------------------------------------------------
// Frame derivation from YGOPRODeck frameType
// ---------------------------------------------------------------------------
const FRAME_MAP = {
  normal: "normal",
  effect: "effect",
  ritual: "ritual",
  fusion: "fusion",
  synchro: "synchro",
  spell: "spell",
  trap: "trap",
  token: "effect",
  link: "effect",
  xyz: "effect",
};

function deriveFrame(card) {
  const ft = (card.frameType ?? "").toLowerCase();
  // Handle pendulum variants (e.g. "effect_pendulum")
  for (const key of Object.keys(FRAME_MAP)) {
    if (ft.startsWith(key)) return FRAME_MAP[key];
  }
  return "effect";
}

function deriveIsExtraDeck(card) {
  const t = (card.type ?? "").toLowerCase();
  return t.includes("fusion") || t.includes("synchro");
}

// ---------------------------------------------------------------------------
// Fetch full YGOPRODeck dump (all cards)
// ---------------------------------------------------------------------------
async function fetchFullDump() {
  console.log("Fetching full YGOPRODeck dump (this may take a moment)…");
  const url = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
  const resp = await fetch(url, {
    headers: { "User-Agent": "yugioh-app-catalog-builder/1.0" },
  });
  if (!resp.ok) {
    throw new Error(`YGOPRODeck returned ${resp.status}: ${await resp.text()}`);
  }
  const json = await resp.json();
  if (json.error) throw new Error(`YGOPRODeck error: ${json.error}`);
  console.log(`  → received ${json.data.length} total cards from YGOPRODeck`);
  return json.data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const allowedPasscodes = new Set(allowlist.cards.map((c) => c.passcode));
  const dt01Set = new Set(dt01Excluded.passcodes);

  // Sanity: no DT01 in allow-list
  const overlap = [...allowedPasscodes].filter((p) => dt01Set.has(p));
  if (overlap.length > 0) {
    console.warn("WARNING: DT01 passcodes found in allow-list:", overlap);
  }

  // Fetch all cards from YGOPRODeck
  const allCards = await fetchFullDump();

  // Build id → YGOPRODeck record
  const ygopMap = new Map();
  for (const card of allCards) {
    ygopMap.set(card.id, card);
  }

  // Build catalog cards
  const catalogCards = [];
  const corrections = [];

  for (const { passcode, name } of allowlist.cards) {
    let raw = ygopMap.get(passcode);

    // Apply known passcode corrections (off-by-one or virtual IDs)
    if (!raw && PASSCODE_CORRECTIONS[passcode] !== undefined) {
      const correctedId = PASSCODE_CORRECTIONS[passcode];
      raw = ygopMap.get(correctedId);
      if (raw) {
        corrections.push({
          allowlistPc: passcode,
          name,
          usedYgopId: correctedId,
        });
      }
    }

    if (!raw) {
      console.warn(
        `  SKIP: passcode=${passcode} "${name}" not found in YGOPRODeck`,
      );
      continue;
    }

    // imageId: use the YGOPRODeck ID when a passcode correction was applied,
    // because the image is fetched from YGOPRODeck using its own ID.
    // For all other cards, imageId == passcode.
    const imageId = PASSCODE_CORRECTIONS[passcode] ?? passcode;

    const dto = {
      passcode,                // allow-list passcode (canonical game ID)
      name: raw.name,
      frame: deriveFrame(raw),
      isExtraDeck: deriveIsExtraDeck(raw),
      race: raw.race ?? "",
      attribute: raw.attribute ?? null,
      level: raw.level ?? null,
      atk: raw.atk ?? null,
      def: raw.def ?? null,
      desc: raw.desc ?? "",
      banlist: resolveBanlist(passcode),
      aliasOf: null,           // catalog cards are bases; aliases in alias-index
      imageId,                 // YGOPRODeck-compatible ID for image/<imageId>.jpg
    };
    catalogCards.push(dto);
  }

  // Sort ascending by passcode
  catalogCards.sort((a, b) => a.passcode - b.passcode);

  // Build catalog artifact
  const catalog = {
    format: "edison-2010-03",
    generatedAt: new Date().toISOString(),
    count: catalogCards.length,
    cards: catalogCards,
  };

  // Write outputs
  fs.mkdirSync(OUT, { recursive: true });

  fs.writeFileSync(
    path.join(OUT, "edison-card-catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf8",
  );
  console.log(
    `\n✓ Written out/edison-card-catalog.json  (count=${catalog.count})`,
  );

  fs.writeFileSync(
    path.join(OUT, "alias-index.json"),
    JSON.stringify(aliasIndex, null, 2),
    "utf8",
  );
  console.log(
    `✓ Written out/alias-index.json  (${Object.keys(aliasIndex).length} alias entries)`,
  );

  // Tolerance report
  console.log(`\n=== Tolerance Report ===`);
  console.log(`Allow-list count:  ${allowlist.count}`);
  console.log(`Catalog count:     ${catalog.count}`);
  console.log(`Delta:             ${allowlist.count - catalog.count}`);
  if (corrections.length > 0) {
    console.log(`\nPasscode corrections applied (${corrections.length}):`);
    for (const c of corrections) {
      console.log(
        `  allow-list pc=${c.allowlistPc} "${c.name}" → used YGOPRODeck id=${c.usedYgopId}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
