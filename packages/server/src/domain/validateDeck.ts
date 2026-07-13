import type { Violation, DeckValidation } from "@yugioh-app/contracts";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { resolveBase, resolveCard } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Pure deck legality validator — Spec 10 §Architecture, Spec 13 §3
//
// Enforces §2.1 of the requirements exactly:
//   - Main 40–60, Extra 0–15, Side 0–15
//   - Extra: Fusion + Synchro only
//   - Ritual → Main (never Extra)
//   - Copy cap ≤ 3 per resolved base name across all three zones combined
//   - Banlist: Forbidden = 0, Limited = 1, Semi = 2 (combined across all zones)
//   - alias counts as same card (via aliasIndex — covers both catalog aliasOf
//     AND external pre-errata passcodes from alias-index.json)
//   - out-of-pool rejected; unknown passcode reported
// ---------------------------------------------------------------------------

const MAIN_MIN = 40;
const MAIN_MAX = 60;
const EXTRA_MAX = 15;
const SIDE_MAX = 15;
const COPY_MAX = 3;

export interface DeckList {
  main: number[];
  extra: number[];
  side: number[];
}

/**
 * Validate a deck against the Edison deck-construction contract.
 * Pure function — no I/O. Returns a DeckValidation.
 */
export function validateDeck(deck: DeckList, catalog: LoadedCatalog): DeckValidation {
  const violations: Violation[] = [];
  const { main, extra, side } = deck;

  // 1. Zone size checks
  if (main.length < MAIN_MIN || main.length > MAIN_MAX) {
    violations.push({
      code: "main_size",
      message: `Main Deck must have 40–60 cards; got ${main.length}.`,
    });
  }
  if (extra.length > EXTRA_MAX) {
    violations.push({
      code: "extra_size",
      message: `Extra Deck must have 0–15 cards; got ${extra.length}.`,
    });
  }
  if (side.length > SIDE_MAX) {
    violations.push({
      code: "side_size",
      message: `Side Deck must have 0–15 cards; got ${side.length}.`,
    });
  }

  // 2. Per-card checks: zone legality + pool membership
  checkZone(main, "main", catalog, violations);
  checkZone(extra, "extra", catalog, violations);
  checkZone(side, "side", catalog, violations);

  // 3. Copy limit across all three zones (keyed on resolved base passcode)
  checkCopyLimits(main, extra, side, catalog, violations);

  const legal = violations.length === 0;
  return {
    legal,
    counts: { main: main.length, extra: extra.length, side: side.length },
    violations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkZone(
  passcodes: number[],
  zone: "main" | "extra" | "side",
  catalog: LoadedCatalog,
  violations: Violation[],
): void {
  for (const passcode of passcodes) {
    // Resolve alias passcodes (e.g. 511002993 → 50321796 for Brionac pre-errata)
    const card = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);

    if (!card) {
      violations.push({
        code: "unknown_passcode",
        message: `Passcode ${passcode} is not in the card database.`,
        passcode,
        zone,
      });
      continue;
    }

    // Pool membership check (passcode must be recognized — real or alias)
    if (!catalog.legalPasscodes.has(passcode)) {
      violations.push({
        code: "out_of_pool",
        message: `"${card.name}" (${passcode}) is not in the Edison legal pool.`,
        passcode,
        zone,
      });
      continue;
    }

    // Zone enforcement
    if (zone === "extra") {
      if (!card.isExtraDeck) {
        violations.push({
          code: "wrong_zone",
          message: `"${card.name}" (${passcode}) is not an Extra Deck monster (Fusion/Synchro) and cannot be placed in the Extra Deck.`,
          passcode,
          zone,
        });
      }
    } else {
      if (card.isExtraDeck) {
        violations.push({
          code: "wrong_zone",
          message: `"${card.name}" (${passcode}) is a ${card.frame} monster and must be placed in the Extra Deck, not the ${zone}.`,
          passcode,
          zone,
        });
      }
    }
  }
}

function checkCopyLimits(
  main: number[],
  extra: number[],
  side: number[],
  catalog: LoadedCatalog,
  violations: Violation[],
): void {
  // Count copies by resolved base passcode across all zones.
  const totalByBase = new Map<number, number>();

  const allEntries: Array<{ passcode: number; zone: "main" | "extra" | "side" }> = [
    ...main.map((p) => ({ passcode: p, zone: "main" as const })),
    ...extra.map((p) => ({ passcode: p, zone: "extra" as const })),
    ...side.map((p) => ({ passcode: p, zone: "side" as const })),
  ];

  for (const { passcode } of allEntries) {
    const card = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);
    if (!card) continue; // unknown — already reported above

    const base = resolveBase(passcode, catalog.aliasIndex);
    totalByBase.set(base, (totalByBase.get(base) ?? 0) + 1);
  }

  // Violations keyed by base passcode to avoid duplicate messages
  const reported = new Set<number>();

  for (const { passcode, zone } of allEntries) {
    const card = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);
    if (!card) continue;

    const base = resolveBase(passcode, catalog.aliasIndex);
    if (reported.has(base)) continue;

    const total = totalByBase.get(base) ?? 0;
    // Use the base card for banlist lookup
    const baseCard = catalog.byPasscode.get(base) ?? card;

    if (baseCard.banlist === "forbidden") {
      if (total > 0) {
        reported.add(base);
        violations.push({
          code: "banlist_forbidden",
          message: `"${baseCard.name}" is Forbidden and cannot be included in any deck zone.`,
          passcode: base,
          zone,
        });
      }
      continue;
    }

    if (baseCard.banlist === "limited") {
      if (total > 1) {
        reported.add(base);
        violations.push({
          code: "banlist_limit",
          message: `"${baseCard.name}" is Limited to 1 copy across all zones; found ${total}.`,
          passcode: base,
          zone,
        });
      }
      continue;
    }

    if (baseCard.banlist === "semi") {
      if (total > 2) {
        reported.add(base);
        violations.push({
          code: "banlist_limit",
          message: `"${baseCard.name}" is Semi-Limited to 2 copies across all zones; found ${total}.`,
          passcode: base,
          zone,
        });
      }
      continue;
    }

    // Unlimited: max 3 copies
    if (total > COPY_MAX) {
      reported.add(base);
      violations.push({
        code: "copy_limit",
        message: `"${baseCard.name}" exceeds the 3-copy cap (found ${total}).`,
        passcode: base,
        zone,
      });
    }
  }
}
