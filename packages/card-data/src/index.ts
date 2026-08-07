/**
 * Typed loader for the Edison card catalog.
 *
 * Exports:
 *   loadCatalog()      — reads the frozen catalog JSON; returns CardCatalog
 *   buildCardMap()     — returns passcode → CardDTO map
 *   resolveAlias()     — resolves an alias passcode to its base passcode
 *   loadAliasIndex()   — returns the full alias index { aliasPasscode → basePasscode }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types (matching Spec 13 §1-2; switch import to @yugioh-app/contracts
// once that package publishes these types)
// ---------------------------------------------------------------------------

export type Banlist = "forbidden" | "limited" | "semi" | "unlimited";

export interface CardDTO {
  passcode: number;
  name: string;
  frame: "normal" | "effect" | "ritual" | "fusion" | "synchro" | "spell" | "trap";
  isExtraDeck: boolean;
  race: string;
  attribute: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  desc: string;
  banlist: Banlist;
  aliasOf: number | null;
  imageId: number;
  /** True when the catalog substituted this card's text from preErrataDescOverrides.json. */
  preErrataText?: boolean;
}

export interface CardCatalog {
  format: "edison-2010-03";
  generatedAt: string;
  count: number;
  cards: CardDTO[];
}

/** { aliasPasscode(as string key): basePasscode } */
export type AliasIndex = Record<string, number>;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../out");

const CATALOG_PATH = path.join(OUT_DIR, "edison-card-catalog.json");
const ALIAS_INDEX_PATH = path.join(OUT_DIR, "alias-index.json");

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Loads the frozen Edison card catalog from disk.
 * Throws if the catalog file is missing (run build-catalog.mjs first).
 */
export function loadCatalog(): CardCatalog {
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  return JSON.parse(raw) as CardCatalog;
}

/**
 * Builds a passcode → CardDTO lookup map from the catalog.
 * O(n) build, O(1) lookup thereafter.
 */
export function buildCardMap(catalog: CardCatalog): Map<number, CardDTO> {
  const map = new Map<number, CardDTO>();
  for (const card of catalog.cards) {
    map.set(card.passcode, card);
  }
  return map;
}

/**
 * Loads the alias index from disk.
 * Keys are alias passcodes (as strings); values are base passcodes (numbers).
 */
export function loadAliasIndex(): AliasIndex {
  const raw = fs.readFileSync(ALIAS_INDEX_PATH, "utf8");
  return JSON.parse(raw) as AliasIndex;
}

/**
 * Resolves an alias passcode to its base passcode.
 * Returns the base passcode if the input is an alias, otherwise returns
 * the input unchanged (it is already a base passcode).
 */
export function resolveAlias(passcode: number, aliasIndex: AliasIndex): number {
  const base = aliasIndex[String(passcode)];
  return base ?? passcode;
}
