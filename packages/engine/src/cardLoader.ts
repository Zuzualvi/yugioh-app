// ---------------------------------------------------------------------------
// Card database loader — wraps cards.cdb (Edison pool) via better-sqlite3.
// Returns OcgCardData objects for the cardReader callback in createDuel().
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CDB_PATH = process.env["EDISON_CDB_PATH"] ?? resolve(__dir, "../assets/cards.cdb");

// Lazy-opened singleton — one DB handle per process lifetime.
let _db: InstanceType<typeof Database> | null = null;
let _stmt: ReturnType<InstanceType<typeof Database>["prepare"]> | null = null;

export function openCardDb(cdbPath = CDB_PATH): void {
  if (_db) return;
  if (!existsSync(cdbPath)) {
    throw new Error(
      `cards.cdb not found at ${cdbPath}. ` +
        "Run the card-data pipeline to populate assets/cards.cdb.",
    );
  }
  _db = new Database(cdbPath, { readonly: true });
  _stmt = _db.prepare(
    `SELECT datas.id, datas.alias, datas.setcode, datas.type,
            datas.atk, datas.def, datas.level, datas.race,
            datas.attribute, datas.ot, datas.category
     FROM datas WHERE datas.id = ?`,
  );
}

/** OcgCardData shape expected by ocgcore-wasm's cardReader callback. */
export interface OcgCardData {
  code: number;
  alias: number;
  setcodes: number[];
  type: number;
  attack: number;
  defense: number;
  level: number;
  lscale: number;
  rscale: number;
  race: bigint;
  attribute: number;
  link_marker: number;
  ot: number;
  category: number;
}

/**
 * Return card data for the given passcode, or null if not found.
 * Opens the DB lazily on first call.
 */
export function getCard(code: number): OcgCardData | null {
  if (!_db) openCardDb();
  const row = _stmt!.get(code) as
    | {
        id: number;
        alias: number;
        setcode: number;
        type: number;
        atk: number;
        def: number;
        level: number;
        race: number | bigint;
        attribute: number;
        ot: number;
        category: number | null;
      }
    | undefined;
  if (!row) return null;
  return {
    code: row.id,
    alias: row.alias || 0,
    setcodes: row.setcode ? [row.setcode] : [],
    type: row.type,
    attack: row.atk,
    defense: row.def,
    level: row.level & 0xff,
    lscale: (row.level >> 24) & 0xff,
    rscale: (row.level >> 16) & 0xff,
    race: BigInt(row.race),
    attribute: row.attribute,
    link_marker: 0,
    ot: row.ot,
    category: row.category ?? 0,
  };
}
