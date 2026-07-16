// ---------------------------------------------------------------------------
// cardName — card code → display name lookup.
//
// Reads from the texts table in cards.cdb (same DB as cardLoader.ts).
// Lazily initialises the prepared statement on first call.
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CDB_PATH = process.env["EDISON_CDB_PATH"] ?? resolve(__dir, "../../assets/cards.cdb");

let _db: InstanceType<typeof Database> | null = null;
let _nameStmt: ReturnType<InstanceType<typeof Database>["prepare"]> | null = null;
let _descStmt: ReturnType<InstanceType<typeof Database>["prepare"]> | null = null;

function openDb(): void {
  if (_db) return;
  if (!existsSync(CDB_PATH)) return; // graceful: return empty string below
  _db = new Database(CDB_PATH, { readonly: true });
  _nameStmt = _db.prepare("SELECT name FROM texts WHERE id = ?");
  // We use dynamic column selection for str1..str16; prepare a general lookup.
  _descStmt = _db.prepare(
    "SELECT str1,str2,str3,str4,str5,str6,str7,str8,str9,str10,str11,str12,str13,str14,str15,str16 FROM texts WHERE id = ?",
  );
}

/** Return the display name for a card code, or "" if not found. */
export function getCardName(code: number): string {
  if (code === 0) return "";
  openDb();
  if (!_nameStmt) return "";
  const row = _nameStmt.get(code) as { name: string } | undefined;
  return row?.name ?? "";
}

/**
 * Resolve an ocgcore description ID to a human-readable string.
 *
 * Description IDs use the format: `card_code * 0x100000n + str_index`.
 * The string is stored in `texts.str{str_index}` for the card with id=card_code.
 * A description of 0n means "no specific description"; returns "".
 */
export function resolveDescription(desc: bigint): string {
  if (desc === 0n) return "";
  openDb();
  if (!_descStmt) return desc.toString();

  const cardCode = Number(desc / 0x100000n);
  const strIdx = Number(desc % 0x100000n);

  if (strIdx < 1 || strIdx > 16) return desc.toString();

  const row = _descStmt.get(cardCode) as Record<string, string | null> | undefined;
  if (!row) return desc.toString();

  const colName = `str${strIdx}`;
  const text = row[colName];
  return text && text.length > 0 ? text : desc.toString();
}
