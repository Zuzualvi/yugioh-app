import { Router } from "express";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { DeckBodySchema, DeckExportBodySchema } from "@yugioh-app/contracts";
import type { DeckValidation, DeckSummary, Deck } from "@yugioh-app/contracts";
import { validateDeck } from "../domain/validateDeck.js";
import { parseYdk, emitYdk } from "../domain/ydkCodec.js";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Deck routes — Spec 13 §3
//
//   GET    /api/decks
//   POST   /api/decks
//   GET    /api/decks/:id
//   PUT    /api/decks/:id
//   DELETE /api/decks/:id
//   POST   /api/decks/:id/duplicate
//   POST   /api/decks/import
//   POST   /api/decks/export
// ---------------------------------------------------------------------------

interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  main_json: string;
  extra_json: string;
  side_json: string;
  is_valid: number;
  created_at: string;
  updated_at: string;
}

function rowToDeckSummary(row: DeckRow): DeckSummary {
  const main = JSON.parse(row.main_json) as number[];
  const extra = JSON.parse(row.extra_json) as number[];
  const side = JSON.parse(row.side_json) as number[];
  return {
    id: row.id,
    name: row.name,
    isValid: row.is_valid === 1,
    counts: { main: main.length, extra: extra.length, side: side.length },
    updatedAt: row.updated_at,
  };
}

function rowToDeck(row: DeckRow, validation: DeckValidation): Deck {
  const main = JSON.parse(row.main_json) as number[];
  const extra = JSON.parse(row.extra_json) as number[];
  const side = JSON.parse(row.side_json) as number[];
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    main,
    extra,
    side,
    validation,
    updatedAt: row.updated_at,
  };
}

function validateAndBuild(
  name: string,
  main: number[],
  extra: number[],
  side: number[],
  catalog: LoadedCatalog,
): { validation: DeckValidation; isValid: boolean } {
  const validation = validateDeck({ main, extra, side }, catalog);
  return { validation, isValid: validation.legal };
}

export function createDecksRouter(db: InstanceType<typeof Database>, catalog: LoadedCatalog): Router {
  const router = Router();

  // GET /api/decks — caller's own decks
  router.get("/", (req, res): void => {
    const userId = req.user!.id;
    const rows = db
      .prepare("SELECT * FROM decks WHERE owner_id = ? ORDER BY updated_at DESC")
      .all(userId) as DeckRow[];
    const decks: DeckSummary[] = rows.map(rowToDeckSummary);
    res.status(200).json({ decks });
  });

  // POST /api/decks/import — MUST come before /:id routes
  router.post("/import", (req, res): void => {
    const body = req.body as unknown;
    if (typeof body !== "string") {
      res.status(400).json({
        error: { code: "invalid_input", message: "Body must be raw .ydk text (Content-Type: text/plain)." },
      });
      return;
    }

    const parseResult = parseYdk(body, catalog);
    const { name, main, extra, side } = parseResult;

    // Run full deck validation on top of codec parse violations
    const deckValidation = validateDeck({ main, extra, side }, catalog);
    const allViolations = [...parseResult.violations, ...deckValidation.violations];

    res.status(200).json({
      name: name || "Imported Deck",
      main,
      extra,
      side,
      validation: {
        legal: allViolations.length === 0,
        counts: deckValidation.counts,
        violations: allViolations,
      },
    });
  });

  // POST /api/decks/export — MUST come before /:id routes
  router.post("/export", (req, res): void => {
    const parsed = DeckExportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }
    const { name, main, extra, side } = parsed.data;
    const ydk = emitYdk({ name, main, extra, side });
    res.status(200).type("text/plain").send(ydk);
  });

  // POST /api/decks — create
  router.post("/", (req, res): void => {
    const parsed = DeckBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }
    const { name, main, extra, side } = parsed.data;
    const userId = req.user!.id;
    const { validation, isValid } = validateAndBuild(name, main, extra, side, catalog);

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(id, userId, name, JSON.stringify(main), JSON.stringify(extra), JSON.stringify(side), isValid ? 1 : 0, now, now);

    const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(id) as DeckRow;
    res.status(201).json(rowToDeck(row, validation));
  });

  // GET /api/decks/:id
  router.get("/:id", (req, res): void => {
    const userId = req.user!.id;
    const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(req.params["id"]) as DeckRow | undefined;
    if (!row) {
      res.status(404).json({ error: { code: "not_found", message: "Deck not found." } });
      return;
    }
    if (row.owner_id !== userId) {
      res.status(403).json({ error: { code: "forbidden", message: "Not your deck." } });
      return;
    }

    const main = JSON.parse(row.main_json) as number[];
    const extra = JSON.parse(row.extra_json) as number[];
    const side = JSON.parse(row.side_json) as number[];
    const validation = validateDeck({ main, extra, side }, catalog);

    res.status(200).json(rowToDeck(row, validation));
  });

  // PUT /api/decks/:id
  router.put("/:id", (req, res): void => {
    const userId = req.user!.id;
    const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(req.params["id"]) as DeckRow | undefined;
    if (!row) {
      res.status(404).json({ error: { code: "not_found", message: "Deck not found." } });
      return;
    }
    if (row.owner_id !== userId) {
      res.status(403).json({ error: { code: "forbidden", message: "Not your deck." } });
      return;
    }

    const parsed = DeckBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_input", message: parsed.error.message } });
      return;
    }
    const { name, main, extra, side } = parsed.data;
    const { validation, isValid } = validateAndBuild(name, main, extra, side, catalog);
    const now = new Date().toISOString();

    db.prepare(
      "UPDATE decks SET name = ?, main_json = ?, extra_json = ?, side_json = ?, is_valid = ?, updated_at = ? WHERE id = ?",
    ).run(name, JSON.stringify(main), JSON.stringify(extra), JSON.stringify(side), isValid ? 1 : 0, now, row.id);

    const updated = db.prepare("SELECT * FROM decks WHERE id = ?").get(row.id) as DeckRow;
    res.status(200).json(rowToDeck(updated, validation));
  });

  // DELETE /api/decks/:id
  router.delete("/:id", (req, res): void => {
    const userId = req.user!.id;
    const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(req.params["id"]) as DeckRow | undefined;
    if (!row) {
      res.status(404).json({ error: { code: "not_found", message: "Deck not found." } });
      return;
    }
    if (row.owner_id !== userId) {
      res.status(403).json({ error: { code: "forbidden", message: "Not your deck." } });
      return;
    }
    db.prepare("DELETE FROM decks WHERE id = ?").run(row.id);
    res.status(204).end();
  });

  // POST /api/decks/:id/duplicate
  router.post("/:id/duplicate", (req, res): void => {
    const userId = req.user!.id;
    const row = db.prepare("SELECT * FROM decks WHERE id = ?").get(req.params["id"]) as DeckRow | undefined;
    if (!row) {
      res.status(404).json({ error: { code: "not_found", message: "Deck not found." } });
      return;
    }
    if (row.owner_id !== userId) {
      res.status(403).json({ error: { code: "forbidden", message: "Not your deck." } });
      return;
    }

    const main = JSON.parse(row.main_json) as number[];
    const extra = JSON.parse(row.extra_json) as number[];
    const side = JSON.parse(row.side_json) as number[];
    const { validation, isValid } = validateAndBuild(row.name, main, extra, side, catalog);

    const newId = randomUUID();
    const now = new Date().toISOString();
    const newName = `${row.name} (copy)`;
    db.prepare(
      "INSERT INTO decks (id, owner_id, name, main_json, extra_json, side_json, is_valid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(newId, userId, newName, row.main_json, row.extra_json, row.side_json, isValid ? 1 : 0, now, now);

    const newRow = db.prepare("SELECT * FROM decks WHERE id = ?").get(newId) as DeckRow;
    res.status(201).json(rowToDeck(newRow, validation));
  });

  return router;
}
