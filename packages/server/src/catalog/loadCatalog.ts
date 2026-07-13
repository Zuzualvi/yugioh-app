import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { CardCatalog, CardDTO } from "@yugioh-app/contracts";
import { CardCatalogSchema } from "@yugioh-app/contracts";
import { FIXTURE_CATALOG } from "./fixture.js";

// ---------------------------------------------------------------------------
// Alias index — maps aliasPasscode → basePasscode
// Built from the catalog's aliasOf fields at load time.
// ---------------------------------------------------------------------------
export type AliasIndex = ReadonlyMap<number, number>;

export interface LoadedCatalog {
  catalog: CardCatalog;
  /** Map from passcode → CardDTO for O(1) lookup */
  byPasscode: ReadonlyMap<number, CardDTO>;
  /**
   * Map from aliasPasscode → basePasscode.
   * If a card has no alias, it is not in this map.
   * Use resolveBase() to always get the canonical base passcode.
   */
  aliasIndex: AliasIndex;
  /** Set of all legal passcodes (including aliases) */
  legalPasscodes: ReadonlySet<number>;
}

/** Returns the canonical base passcode for any passcode (alias or base). */
export function resolveBase(passcode: number, aliasIndex: AliasIndex): number {
  return aliasIndex.get(passcode) ?? passcode;
}

let _loaded: LoadedCatalog | null = null;

export function loadCatalog(): LoadedCatalog {
  if (_loaded) return _loaded;

  let catalog: CardCatalog;

  // Resolve path to the card-data artifact relative to this file's location,
  // walking up to the monorepo root.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const artifactPath = join(__dirname, "../../../../card-data/out/edison-card-catalog.json");

  if (existsSync(artifactPath)) {
    const raw = readFileSync(artifactPath, "utf-8");
    const parsed = CardCatalogSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(`Invalid card catalog at ${artifactPath}: ${parsed.error.message}`);
    }
    catalog = parsed.data;
  } else {
    // Fall back to the fixture when the real artifact is not yet present.
    catalog = FIXTURE_CATALOG;
  }

  const byPasscode = new Map<number, CardDTO>();
  const aliasIndex = new Map<number, number>();

  for (const card of catalog.cards) {
    byPasscode.set(card.passcode, card);
    if (card.aliasOf !== null) {
      aliasIndex.set(card.passcode, card.aliasOf);
    }
  }

  const legalPasscodes = new Set<number>(byPasscode.keys());

  _loaded = { catalog, byPasscode, aliasIndex, legalPasscodes };
  return _loaded;
}

/** Reset the catalog cache (for tests that need a fresh state). */
export function resetCatalogCache(): void {
  _loaded = null;
}
