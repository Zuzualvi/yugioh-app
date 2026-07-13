/**
 * verify.mjs
 *
 * Acceptance checks for the Edison card catalog.
 * Prints PASS/FAIL for each assertion.
 *
 * Run: node scripts/verify.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SPIKE_B = path.resolve(ROOT, "../../spikes/spike-b-dataset/out");
const OUT = path.join(ROOT, "out");

// ---------------------------------------------------------------------------
// Load artifacts
// ---------------------------------------------------------------------------
const catalog = JSON.parse(
  fs.readFileSync(path.join(OUT, "edison-card-catalog.json"), "utf8"),
);
const aliasIndex = JSON.parse(
  fs.readFileSync(path.join(OUT, "alias-index.json"), "utf8"),
);
const allowlist = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "edison-allowlist.json"), "utf8"),
);
const dt01Excluded = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "dt01-excluded.json"), "utf8"),
);
const aliasMap = JSON.parse(
  fs.readFileSync(path.join(SPIKE_B, "edison-alias-map.json"), "utf8"),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function check(label, result, detail = "") {
  if (result) {
    console.log(`  PASS  ${label}${detail ? "  (" + detail + ")" : ""}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? "  (" + detail + ")" : ""}`);
    failed++;
  }
}

const allowedSet = new Set(allowlist.cards.map((c) => c.passcode));
const dt01Set = new Set(dt01Excluded.passcodes);
const byPasscode = new Map(catalog.cards.map((c) => [c.passcode, c]));

// ---------------------------------------------------------------------------
// §1  Catalog structure
// ---------------------------------------------------------------------------
console.log("\n§1  Catalog structure");
check(
  "format field is 'edison-2010-03'",
  catalog.format === "edison-2010-03",
);
check(
  "count == cards.length",
  catalog.count === catalog.cards.length,
  `count=${catalog.count}`,
);
check(
  "count within tolerance of 3681 (≤5 delta)",
  Math.abs(catalog.count - 3681) <= 5,
  `catalog=${catalog.count} target=3681 delta=${Math.abs(catalog.count - 3681)}`,
);
check(
  "cards sorted ascending by passcode",
  catalog.cards.every(
    (c, i) => i === 0 || c.passcode >= catalog.cards[i - 1].passcode,
  ),
);

// ---------------------------------------------------------------------------
// §2  Pool membership
// ---------------------------------------------------------------------------
console.log("\n§2  Pool membership");
const notInAllowlist = catalog.cards.filter((c) => !allowedSet.has(c.passcode));
check(
  "every catalog passcode ∈ allow-list",
  notInAllowlist.length === 0,
  notInAllowlist.length > 0
    ? `offenders: ${notInAllowlist.map((c) => c.passcode).slice(0, 5).join(",")}`
    : "all clear",
);

const inDt01 = catalog.cards.filter((c) => dt01Set.has(c.passcode));
check(
  "no catalog passcode ∈ dt01-excluded",
  inDt01.length === 0,
  inDt01.length > 0
    ? `offenders: ${inDt01.map((c) => c.passcode).slice(0, 5).join(",")}`
    : "all clear",
);

// ---------------------------------------------------------------------------
// §3  Banlist spot-checks
// ---------------------------------------------------------------------------
console.log("\n§3  Banlist spot-checks");

// Forbidden: Dark Hole 53129443, Pot of Greed 55144522
for (const [pc, name] of [
  [53129443, "Dark Hole"],
  [55144522, "Pot of Greed"],
]) {
  const card = byPasscode.get(pc);
  check(
    `${name} (${pc}) → forbidden`,
    card?.banlist === "forbidden",
    card ? `got "${card.banlist}"` : "missing from catalog",
  );
}

// Forbidden: Monster Reborn 83764719
{
  const card = byPasscode.get(83764719);
  check(
    "Monster Reborn (83764719) → forbidden",
    card?.banlist === "forbidden",
    card ? `got "${card.banlist}"` : "missing from catalog",
  );
}

// Limited: Reinforcement of the Army 32807846, Summoner Monk 423585
for (const [pc, name] of [
  [32807846, "Reinforcement of the Army"],
  [423585, "Summoner Monk"],
]) {
  const card = byPasscode.get(pc);
  check(
    `${name} (${pc}) → limited`,
    card?.banlist === "limited",
    card ? `got "${card.banlist}"` : "missing from catalog",
  );
}

// Semi-limited: Cyber Dragon 70095154
for (const [pc, name] of [
  [70095154, "Cyber Dragon"],
  [15341821, "Dandylion"],
]) {
  const card = byPasscode.get(pc);
  check(
    `${name} (${pc}) → semi`,
    card?.banlist === "semi",
    card ? `got "${card.banlist}"` : "missing from catalog",
  );
}

// Unlimited: Blue-Eyes White Dragon 89631139
for (const [pc, name] of [
  [89631139, "Blue-Eyes White Dragon"],
  [46986414, "Dark Hole (not in pool — should be absent, banned)"],
]) {
  const card = byPasscode.get(pc);
  if (pc === 89631139) {
    check(
      `${name} (${pc}) → unlimited`,
      card?.banlist === "unlimited",
      card ? `got "${card.banlist}"` : "missing from catalog",
    );
  }
}

// Pre-errata alias banlist: Brionac base (50321796) inherits "limited" from alias 511002993
{
  const brionac = byPasscode.get(50321796);
  check(
    "Brionac base (50321796) inherits banlist 'limited' via pre-errata alias 511002993",
    brionac?.banlist === "limited",
    brionac ? `got "${brionac.banlist}"` : "missing from catalog",
  );
}
// Imperial Order base (61740673) inherits "forbidden" via alias 511002996
{
  const io = byPasscode.get(61740673);
  check(
    "Imperial Order base (61740673) inherits banlist 'forbidden' via alias 511002996",
    io?.banlist === "forbidden",
    io ? `got "${io.banlist}"` : "missing from catalog",
  );
}

// ---------------------------------------------------------------------------
// §4  isExtraDeck correctness
// ---------------------------------------------------------------------------
console.log("\n§4  isExtraDeck");

// All Fusion/Synchro cards must have isExtraDeck=true
const wrongFusion = catalog.cards.filter(
  (c) => (c.frame === "fusion" || c.frame === "synchro") && !c.isExtraDeck,
);
check(
  "all Fusion+Synchro cards have isExtraDeck=true",
  wrongFusion.length === 0,
  wrongFusion.length > 0
    ? `${wrongFusion.length} offenders: ${wrongFusion.map((c) => c.name).slice(0, 3).join(", ")}`
    : "all clear",
);

// All Ritual/Normal/Effect/Spell/Trap must have isExtraDeck=false
const wrongMain = catalog.cards.filter(
  (c) =>
    ["ritual", "normal", "effect", "spell", "trap"].includes(c.frame) &&
    c.isExtraDeck,
);
check(
  "all Ritual/Normal/Effect/Spell/Trap cards have isExtraDeck=false",
  wrongMain.length === 0,
  wrongMain.length > 0
    ? `${wrongMain.length} offenders: ${wrongMain.map((c) => c.name).slice(0, 3).join(", ")}`
    : "all clear",
);

// Spot-checks
const spotChecks = [
  { pc: 50321796, name: "Brionac (Synchro)", expect: true },
  { pc: 44508094, name: "Stardust Dragon (Synchro)", expect: true },
  { pc: 23995346, name: "Blue-Eyes Ultimate Dragon (Fusion)", expect: true },
  { pc: 17375316, name: "Confiscation (Spell)", expect: false },
  { pc: 36868108, name: "Elemental HERO Stratos (Effect)", expect: false },
];
for (const { pc, name, expect } of spotChecks) {
  const card = byPasscode.get(pc);
  if (!card) {
    console.log(`  SKIP  isExtraDeck check for ${name} (${pc}) — not in catalog`);
    continue;
  }
  check(
    `${name} (${pc}) isExtraDeck=${expect}`,
    card.isExtraDeck === expect,
    `got ${card.isExtraDeck} frame="${card.frame}"`,
  );
}

// ---------------------------------------------------------------------------
// §5  Alias / imageId checks
// ---------------------------------------------------------------------------
console.log("\n§5  Alias resolution");

// alias-index must contain all 7 pre-errata aliases
check(
  "alias-index has 7 pre-errata alias entries",
  Object.keys(aliasIndex).length === 7,
  `got ${Object.keys(aliasIndex).length}`,
);

// Brionac: alias-index["511002993"] == 50321796
check(
  "alias-index['511002993'] → 50321796 (Brionac base)",
  aliasIndex["511002993"] === 50321796,
  `got ${aliasIndex["511002993"]}`,
);

// Brionac base in catalog: aliasOf=null, imageId=50321796
{
  const brionac = byPasscode.get(50321796);
  check(
    "Brionac base (50321796) aliasOf=null in catalog",
    brionac?.aliasOf === null,
    brionac ? `got ${brionac.aliasOf}` : "missing",
  );
  check(
    "Brionac base (50321796) imageId=50321796 in catalog",
    brionac?.imageId === 50321796,
    brionac ? `got ${brionac.imageId}` : "missing",
  );
}

// All catalog cards: aliasOf=null (catalog only contains bases)
const hasAlias = catalog.cards.filter((c) => c.aliasOf !== null);
check(
  "all catalog cards have aliasOf=null (catalog contains only bases)",
  hasAlias.length === 0,
  hasAlias.length > 0
    ? `${hasAlias.length} with non-null aliasOf`
    : "all clear",
);

// imageId == passcode for all catalog cards except the 2 with known passcode
// corrections (passcode=0 → imageId=7634581; passcode=80604091 → imageId=80604092).
const KNOWN_IMAGE_OVERRIDES = new Set([0, 80604091]);
const wrongImageId = catalog.cards.filter(
  (c) => c.imageId !== c.passcode && !KNOWN_IMAGE_OVERRIDES.has(c.passcode),
);
check(
  "imageId == passcode for all cards except known passcode-correction cards",
  wrongImageId.length === 0,
  wrongImageId.length > 0
    ? `${wrongImageId.length} unexpected mismatches`
    : "all clear",
);
// Spot-check the overrides
{
  const orichalcos = byPasscode.get(0);
  check(
    "Orichalcos Shunoros (pc=0) imageId=7634581 (YGOPRODeck correction)",
    orichalcos?.imageId === 7634581,
    orichalcos ? `got ${orichalcos.imageId}` : "missing",
  );
  const uo = byPasscode.get(80604091);
  check(
    "Ultimate Offering (pc=80604091) imageId=80604092 (YGOPRODeck correction)",
    uo?.imageId === 80604092,
    uo ? `got ${uo.imageId}` : "missing",
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
console.log(`Result: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
  console.log("All checks PASSED ✓");
} else {
  console.log("Some checks FAILED ✗");
  process.exit(1);
}
