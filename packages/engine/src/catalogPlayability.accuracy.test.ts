// ---------------------------------------------------------------------------
// Catalog-playability regression guard.
//
// Asserts that every card in the committed edison-card-catalog.json is
// actually instantiable by the engine:
//   #1 (CEO-requested): every catalog passcode exists in cards.cdb.
//   #2: every frame!=="normal" card resolves an effect script under the
//       ocgcore alias rule (alias within ±10 → c<alias>.lua, else c<code>.lua).
//
// Named *.accuracy.test.ts so the deploy pipeline's accuracy CI job picks it
// up via its glob. Self-skips when cards.cdb is absent (base `npm run verify`
// has no fetched assets).
//
// NOTE: reads the catalog by file path — does NOT import @yugioh-app/card-data
// (engine must not import card-data; see AGENTS.md dependency graph).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { getScript } from "./scriptLoader.js";

const __dir = dirname(fileURLToPath(import.meta.url));

// Resolve the CDB path using the same logic as cardLoader.ts
const CDB_PATH = process.env["EDISON_CDB_PATH"] ?? resolve(__dir, "../assets/cards.cdb");

// Catalog path — read by file path, not via @yugioh-app/card-data import
const CATALOG_PATH = resolve(__dir, "../../card-data/out/edison-card-catalog.json");

describe.skipIf(!existsSync(CDB_PATH))(
  "catalog playability (accuracy — requires fetched assets)",
  () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as {
      cards: Array<{ passcode: number; name: string; frame: string }>;
    };

    const db = new Database(CDB_PATH, { readonly: true });
    const stmtById = db.prepare<[number], { id: number; alias: number }>(
      "SELECT id, alias FROM datas WHERE id = ?",
    );

    it("#1: every catalog passcode exists in cards.cdb", () => {
      const violators: Array<{ passcode: number; name: string }> = [];
      for (const card of catalog.cards) {
        const row = stmtById.get(card.passcode);
        if (!row) {
          violators.push({ passcode: card.passcode, name: card.name });
        }
      }
      if (violators.length > 0) {
        console.error(
          "Catalog passcodes NOT in cards.cdb:\n" +
            violators.map((v) => `  ${v.passcode}  ${v.name}`).join("\n"),
        );
      }
      expect(violators).toHaveLength(0);
    });

    it("#2: every frame!==normal card resolves an effect script (ocgcore alias rule)", () => {
      const violators: Array<{ passcode: number; name: string; checkedScript: string }> = [];
      for (const card of catalog.cards) {
        if (card.frame === "normal") continue;

        const row = stmtById.get(card.passcode);
        // Cards absent from cds are caught by test #1; skip here to avoid double-counting
        if (!row) continue;

        // ocgcore alias rule (interpreter.cpp register_card):
        // if alias != 0 && abs(alias - code) <= 10  →  load c<alias>.lua
        // else                                       →  load c<code>.lua
        const alias = row.alias ?? 0;
        const scriptName =
          alias !== 0 && Math.abs(alias - card.passcode) <= 10
            ? `c${alias}.lua`
            : `c${card.passcode}.lua`;

        if (getScript(scriptName) === null) {
          violators.push({ passcode: card.passcode, name: card.name, checkedScript: scriptName });
        }
      }
      if (violators.length > 0) {
        console.error(
          "frame!==normal cards with no resolvable script:\n" +
            violators
              .map((v) => `  ${v.passcode}  ${v.name}  (checked: ${v.checkedScript})`)
              .join("\n"),
        );
      }
      expect(violators).toHaveLength(0);
    });
  },
);
