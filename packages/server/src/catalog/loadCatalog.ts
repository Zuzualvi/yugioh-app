import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { CardCatalog, CardDTO } from "@yugioh-app/contracts";
import { CardCatalogSchema } from "@yugioh-app/contracts";
import { FIXTURE_CATALOG } from "./fixture.js";

// ---------------------------------------------------------------------------
// Alias index — maps aliasPasscode → basePasscode
// Includes both:
//   (a) aliasOf fields in the catalog (alt-art / same-name cards)
//   (b) external alias-index.json (pre-errata passcodes: 511002993 → 50321796 etc.)
// ---------------------------------------------------------------------------
export type AliasIndex = ReadonlyMap<number, number>;

export interface LoadedCatalog {
  catalog: CardCatalog;
  /** Map from passcode → CardDTO for O(1) lookup */
  byPasscode: ReadonlyMap<number, CardDTO>;
  /**
   * Map from aliasPasscode → basePasscode.
   * Covers both catalog aliasOf fields AND external pre-errata alias-index.json.
   * Use resolveBase() to get the canonical base passcode for any passcode.
   */
  aliasIndex: AliasIndex;
  /**
   * Set of all recognized passcodes — includes real card passcodes AND
   * external alias passcodes (pre-errata). A passcode in this set is either
   * a real card or a known alias for a real card.
   */
  legalPasscodes: ReadonlySet<number>;
}

/** Returns the canonical base passcode for any passcode (alias or base). */
export function resolveBase(passcode: number, aliasIndex: AliasIndex): number {
  return aliasIndex.get(passcode) ?? passcode;
}

/**
 * Resolve an alias passcode to its CardDTO. Returns:
 *   - The card itself if byPasscode has it directly
 *   - The base card if the passcode is an alias
 *   - undefined if unknown
 */
export function resolveCard(
  passcode: number,
  byPasscode: ReadonlyMap<number, CardDTO>,
  aliasIndex: AliasIndex,
): CardDTO | undefined {
  return byPasscode.get(passcode) ?? byPasscode.get(resolveBase(passcode, aliasIndex));
}

let _loaded: LoadedCatalog | null = null;

// ---------------------------------------------------------------------------
// Repo-root locator (relative to this file's actual location at runtime)
// Source: packages/server/src/catalog/loadCatalog.ts
//   → 3 levels up → packages/
//   → then card-data/out/
// ---------------------------------------------------------------------------
function getCardDataOutDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // packages/server/src/catalog → up 3 → packages/
  return join(__dirname, "../../../card-data/out");
}

export function loadCatalog(): LoadedCatalog {
  if (_loaded) return _loaded;

  const outDir = getCardDataOutDir();
  const catalogPath = join(outDir, "edison-card-catalog.json");
  const aliasIndexPath = join(outDir, "alias-index.json");

  let catalog: CardCatalog;
  const useFixture = process.env["ALLOW_FIXTURE_CATALOG"] === "1";

  if (existsSync(catalogPath)) {
    const raw = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
      cards: unknown[];
      [k: string]: unknown;
    };
    // Filter out cards with passcode 0 (data quality: "Orichalcos Shunoros" passcode=0
    // fails CardDTOSchema which requires passcode > 0).
    const before = raw.cards.length;
    raw.cards = raw.cards.filter(
      (c) => typeof c === "object" && c !== null && (c as { passcode?: number }).passcode !== 0,
    );
    if (raw.cards.length !== before) {
      console.warn(
        `[loadCatalog] Filtered ${before - raw.cards.length} card(s) with passcode=0 from catalog.`,
      );
    }
    raw["count"] = raw.cards.length;

    const parsed = CardCatalogSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid card catalog at ${catalogPath}: ${parsed.error.message}`);
    }
    catalog = parsed.data;
  } else if (useFixture) {
    console.warn(
      "[loadCatalog] Real catalog not found — using 22-card FIXTURE (ALLOW_FIXTURE_CATALOG=1). NOT for production.",
    );
    catalog = FIXTURE_CATALOG;
  } else {
    throw new Error(
      `[loadCatalog] Card catalog not found at ${catalogPath}. ` +
        `Set ALLOW_FIXTURE_CATALOG=1 to allow the test fixture (NOT for production).`,
    );
  }

  const byPasscode = new Map<number, CardDTO>();
  const aliasIndex = new Map<number, number>();

  // Build maps from catalog cards (handles aliasOf / alt-art)
  for (const card of catalog.cards) {
    byPasscode.set(card.passcode, card);
    if (card.aliasOf !== null) {
      aliasIndex.set(card.passcode, card.aliasOf);
    }
  }

  // Merge external alias-index.json (pre-errata passcodes: 511002993 → 50321796 etc.)
  if (existsSync(aliasIndexPath)) {
    const externalAliases = JSON.parse(readFileSync(aliasIndexPath, "utf-8")) as Record<
      string,
      number
    >;
    for (const [aliasStr, base] of Object.entries(externalAliases)) {
      const alias = parseInt(aliasStr, 10);
      if (!isNaN(alias) && !aliasIndex.has(alias)) {
        aliasIndex.set(alias, base);
      }
    }
  }

  // legalPasscodes includes real cards AND external alias passcodes
  const legalPasscodes = new Set<number>([...byPasscode.keys(), ...aliasIndex.keys()]);

  _loaded = { catalog, byPasscode, aliasIndex, legalPasscodes };
  return _loaded;
}

/** Reset the catalog cache (for tests that need a fresh state). */
export function resetCatalogCache(): void {
  _loaded = null;
}
