/**
 * build-catalog.mjs
 *
 * One-time pipeline: fetches the full YGOPRODeck dump, filters to the
 * Spike-B Edison allow-list, decodes each entry to a CardDTO, and writes
 * out/edison-card-catalog.json + out/alias-index.json.
 *
 * Run: node scripts/build-catalog.mjs
 * Requires network access (YGOPRODeck cardinfo.php) and sqlite3 (for cdb alias lookup).
 *
 * Passcode handling:
 *   • Allow-list passcode 0 (Orichalcos Shunoros, anime card) → remapped to its
 *     real YGOPRODeck id 7634581 as the catalog passcode, ensuring every entry > 0.
 *   • Allow-list passcode 80604091 (Ultimate Offering) → metadata fetched from
 *     YGOPRODeck id 80604092 (off-by-one in full dump); catalog passcode stays
 *     80604091 (positive, canonical in lflist and allow-list).
 *
 * Alias-index:
 *   Built from two sources (union, deduplicated):
 *   1. Spike-B pre-errata aliases (7 entries, 511002xxx → base).
 *   2. cards.cdb `alias` field — all rows where alias(base) is in the Edison pool
 *      (alt-art / "treated as" aliases; 170 entries from BabelCDB).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPIKE_B = path.resolve(ROOT, "../../spikes/spike-b-dataset/out");
const CDB_PATH = path.resolve(ROOT, "../../spikes/spike-a-ruleset/vendor/cdb/cards.cdb");
const OUT = path.join(ROOT, "out");

// ---------------------------------------------------------------------------
// Passcode corrections
// allowlistPc → { ygopId: number, catalogPc: number }
// ygopId:    which YGOPRODeck id to fetch metadata from
// catalogPc: the passcode to use in the catalog (must be > 0 and unique)
// ---------------------------------------------------------------------------
const PASSCODE_CORRECTIONS = {
  // Orichalcos Shunoros: allow-list uses virtual pc=0 (anime).
  // Remap to its real YGOPRODeck ID so the catalog never has pc=0.
  0: { ygopId: 7634581, catalogPc: 7634581 },
  // Ultimate Offering: YGOPRODeck full dump stores id=80604092 but the lflist
  // and allow-list use 80604091 (off-by-one). Keep allow-list pc as canonical.
  80604091: { ygopId: 80604092, catalogPc: 80604091 },
};

// ---------------------------------------------------------------------------
// Load pre-errata desc overrides (keyed by passcode string)
// Only entries with needsOverride===true are applied; Susa Soldier (40473581) is skipped.
// ---------------------------------------------------------------------------
const _rawOverrides = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/preErrataDescOverrides.json"), "utf8"),
);
/** @type {Record<string, string>} passcode → preErrataDescClean (needsOverride:true only) */
const OVERRIDES = Object.fromEntries(
  Object.entries(_rawOverrides)
    .filter(([, v]) => v.needsOverride === true)
    .map(([k, v]) => [k, v.preErrataDescClean]),
);

// ---------------------------------------------------------------------------
// Load Spike-B artifacts (ground truth — do NOT re-derive)
// ---------------------------------------------------------------------------
const allowlist = JSON.parse(fs.readFileSync(path.join(SPIKE_B, "edison-allowlist.json"), "utf8"));
const aliasMap = JSON.parse(fs.readFileSync(path.join(SPIKE_B, "edison-alias-map.json"), "utf8"));
const dt01Excluded = JSON.parse(fs.readFileSync(path.join(SPIKE_B, "dt01-excluded.json"), "utf8"));
const lflConf = fs.readFileSync(path.join(SPIKE_B, "edison.lflist.conf"), "utf8");

// ---------------------------------------------------------------------------
// Parse lflist.conf → { passcode: 0|1|2 }
// ---------------------------------------------------------------------------
function parseLflist(conf) {
  const result = {};
  for (const line of conf.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("$") || trimmed.startsWith("#")) {
      continue;
    }
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
// base passcode. This lets base cards inherit their banlist status.
const baseToAlias = {};
for (const [aliasPc, { base }] of Object.entries(aliasMap)) {
  baseToAlias[base] = Number(aliasPc);
}

// ---------------------------------------------------------------------------
// Build alias-index from two sources
// ---------------------------------------------------------------------------
function buildAliasIndex(catalogPcSet) {
  const index = {}; // { aliasPasscode(string): basePasscode(number) }

  // Source 1: Spike-B pre-errata aliases (7 entries)
  for (const [aliasPc, { base }] of Object.entries(aliasMap)) {
    index[aliasPc] = base;
  }

  // Source 2: cards.cdb `alias` field (alt-art / "treated as" mapping)
  // rows: (id, alias) where alias is the base passcode.
  // Include when the base (alias column) is in the Edison catalog passcode set.
  if (!fs.existsSync(CDB_PATH)) {
    console.warn(`WARNING: cards.cdb not found at ${CDB_PATH} — skipping cdb alias reconciliation`);
    return index;
  }

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    console.warn("WARNING: better-sqlite3 not available — skipping cdb alias reconciliation");
    return index;
  }

  const db = new Database(CDB_PATH, { readonly: true });
  const rows = db.prepare("SELECT id, alias FROM datas WHERE alias != 0").all();
  db.close();

  let cdbAdded = 0;
  for (const { id, alias } of rows) {
    // Only include when the base (alias column) is in the Edison catalog
    if (!catalogPcSet.has(alias)) continue;
    const key = String(id);
    if (!index[key]) {
      index[key] = alias;
      cdbAdded++;
    }
  }
  console.log(`  → added ${cdbAdded} alt-art alias entries from cards.cdb`);

  return index;
}

// ---------------------------------------------------------------------------
// Banlist resolver
// ---------------------------------------------------------------------------
function resolveBanlist(allowlistPc) {
  // Check the allow-list passcode first (used in lflist for most cards)
  if (lflist[allowlistPc] !== undefined) {
    return countToBanlist(lflist[allowlistPc]);
  }
  // Pre-errata bases: their alias passcode is in the lflist
  const aliasPc = baseToAlias[allowlistPc];
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
// Fetch full YGOPRODeck dump
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

  const overlap = [...allowedPasscodes].filter((p) => dt01Set.has(p));
  if (overlap.length > 0) {
    console.warn("WARNING: DT01 passcodes found in allow-list:", overlap);
  }

  const allCards = await fetchFullDump();
  const ygopMap = new Map();
  for (const card of allCards) {
    ygopMap.set(card.id, card);
  }

  const catalogCards = [];
  const corrections = [];

  for (const { passcode: allowlistPc, name } of allowlist.cards) {
    let raw = ygopMap.get(allowlistPc);
    let catalogPc = allowlistPc;
    let imageId = allowlistPc;

    const correction = PASSCODE_CORRECTIONS[allowlistPc];
    if (!raw && correction) {
      raw = ygopMap.get(correction.ygopId);
      if (raw) {
        catalogPc = correction.catalogPc;
        imageId = correction.ygopId;
        corrections.push({ allowlistPc, name, catalogPc, ygopId: correction.ygopId });
      }
    }

    if (!raw) {
      console.warn(`  SKIP: passcode=${allowlistPc} "${name}" not found in YGOPRODeck`);
      continue;
    }

    // banlist: resolved using the ALLOW-LIST passcode (so lflist lookups remain correct)
    const dto = {
      passcode: catalogPc,
      name: raw.name,
      frame: deriveFrame(raw),
      isExtraDeck: deriveIsExtraDeck(raw),
      race: raw.race ?? "",
      attribute: raw.attribute ?? null,
      level: raw.level ?? null,
      atk: raw.atk ?? null,
      def: raw.def ?? null,
      desc: OVERRIDES[String(catalogPc)] ?? raw.desc ?? "",
      banlist: resolveBanlist(allowlistPc),
      aliasOf: null,
      imageId,
    };
    catalogCards.push(dto);
  }

  // Sort ascending by passcode
  catalogCards.sort((a, b) => a.passcode - b.passcode);

  // Build the alias-index using the final catalog passcode set
  const catalogPcSet = new Set(catalogCards.map((c) => c.passcode));
  console.log("\nBuilding alias-index…");
  const aliasIndex = buildAliasIndex(catalogPcSet);

  // Write outputs
  fs.mkdirSync(OUT, { recursive: true });

  const catalog = {
    format: "edison-2010-03",
    generatedAt: new Date().toISOString(),
    count: catalogCards.length,
    cards: catalogCards,
  };

  fs.writeFileSync(
    path.join(OUT, "edison-card-catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf8",
  );
  console.log(`\n✓ Written out/edison-card-catalog.json  (count=${catalog.count})`);

  fs.writeFileSync(path.join(OUT, "alias-index.json"), JSON.stringify(aliasIndex, null, 2), "utf8");
  console.log(`✓ Written out/alias-index.json  (${Object.keys(aliasIndex).length} alias entries)`);

  // Report
  console.log(`\n=== Build Report ===`);
  console.log(`Allow-list count:  ${allowlist.count}`);
  console.log(`Catalog count:     ${catalog.count}`);
  console.log(
    `Delta:             ${allowlist.count - catalog.count}  (passcode-0 entry remapped, not excluded)`,
  );
  if (corrections.length > 0) {
    console.log(`\nPasscode corrections applied (${corrections.length}):`);
    for (const c of corrections) {
      console.log(
        `  allow-list pc=${c.allowlistPc} "${c.name}"` +
          ` → catalog pc=${c.catalogPc}, ygop id=${c.ygopId}`,
      );
    }
  }
  console.log(`\nAlias-index: ${Object.keys(aliasIndex).length} entries`);
  console.log(`  7 pre-errata (Spike-B) + cdb alt-arts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
