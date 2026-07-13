import { Router } from "express";
import { CardSearchSchema } from "@yugioh-app/contracts";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Card routes — Spec 13 §3
//
//   GET /api/cards          — search/filter/paginate
//   GET /api/cards/:passcode — single card
// ---------------------------------------------------------------------------

export function createCardsRouter(catalog: LoadedCatalog): Router {
  const router = Router();

  // GET /api/cards
  router.get("/", (req, res): void => {
    const parsed = CardSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "invalid_query", message: parsed.error.message } });
      return;
    }

    const {
      q,
      frame,
      race,
      attribute,
      level,
      atkMin,
      atkMax,
      defMin,
      defMax,
      banlist,
      text,
      page,
      pageSize,
    } = parsed.data;

    let cards = catalog.catalog.cards;

    if (q !== undefined) {
      const lq = q.toLowerCase();
      cards = cards.filter((c) => c.name.toLowerCase().includes(lq));
    }
    if (frame !== undefined) {
      cards = cards.filter((c) => c.frame === frame);
    }
    if (race !== undefined) {
      cards = cards.filter((c) => c.race.toLowerCase() === race.toLowerCase());
    }
    if (attribute !== undefined) {
      cards = cards.filter(
        (c) => c.attribute !== null && c.attribute.toUpperCase() === attribute.toUpperCase(),
      );
    }
    if (level !== undefined) {
      cards = cards.filter((c) => c.level === level);
    }
    if (atkMin !== undefined) {
      cards = cards.filter((c) => c.atk !== null && c.atk >= atkMin);
    }
    if (atkMax !== undefined) {
      cards = cards.filter((c) => c.atk !== null && c.atk <= atkMax);
    }
    if (defMin !== undefined) {
      cards = cards.filter((c) => c.def !== null && c.def >= defMin);
    }
    if (defMax !== undefined) {
      cards = cards.filter((c) => c.def !== null && c.def <= defMax);
    }
    if (banlist !== undefined) {
      cards = cards.filter((c) => c.banlist === banlist);
    }
    if (text !== undefined) {
      const lt = text.toLowerCase();
      cards = cards.filter((c) => c.desc.toLowerCase().includes(lt));
    }

    const total = cards.length;
    const offset = (page - 1) * pageSize;
    const paged = cards.slice(offset, offset + pageSize);

    res.status(200).json({ total, page, pageSize, cards: paged });
  });

  // GET /api/cards/:passcode
  router.get("/:passcode", (req, res): void => {
    const p = parseInt(req.params["passcode"] ?? "", 10);
    if (isNaN(p)) {
      res.status(400).json({ error: { code: "invalid_passcode", message: "Passcode must be an integer." } });
      return;
    }

    const card = catalog.byPasscode.get(p);
    if (!card) {
      res.status(404).json({ error: { code: "not_found", message: `Card ${p} not found.` } });
      return;
    }

    res.status(200).json(card);
  });

  return router;
}
