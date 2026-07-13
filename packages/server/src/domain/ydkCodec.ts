import type { Violation } from "@yugioh-app/contracts";
import type { LoadedCatalog } from "../catalog/loadCatalog.js";
import { resolveCard } from "../catalog/loadCatalog.js";

// ---------------------------------------------------------------------------
// Pure .ydk codec — Spec 10 §Architecture, §2.3 of requirements
//
// Import: reads .ydk text → { name, main[], extra[], side[], violations[] }
// Export: takes { name?, main[], extra[], side[] } → .ydk text string
//
// Key format rules (§2.3):
//   - LF or CRLF on import; LF on export
//   - Lines beginning with '#' are comment/section markers (after trimming)
//   - '#main' begins Main section; '#extra' begins Extra section
//   - '!side' begins Side section (NOTE: '!' not '#' — load-bearing quirk)
//   - Every non-marker, non-blank line is a base-10 passcode integer
//   - One line per copy
//   - Export emits: #created by <name>, #main, passcodes, #extra, passcodes, !side, passcodes
//   - Round-trip preserves multiset
// ---------------------------------------------------------------------------

export type YdkSection = "none" | "main" | "extra" | "side";

export interface YdkParseResult {
  /** Deck name extracted from '#created by <name>' line, or empty string */
  name: string;
  main: number[];
  extra: number[];
  side: number[];
  violations: Violation[];
}

/**
 * Parse a .ydk file text into main/extra/side passcode arrays.
 * Never throws. Violations describe every problem found.
 */
export function parseYdk(text: string, catalog: LoadedCatalog | null): YdkParseResult {
  const violations: Violation[] = [];
  const main: number[] = [];
  const extra: number[] = [];
  const side: number[] = [];
  let name = "";
  let section: YdkSection = "none";

  // Normalise line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Track whether we have seen section markers (to detect missing markers)
  let sawMain = false;
  let sawExtra = false;
  let sawSide = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (trimmed === "") continue; // blank line — skip

    // Detect '#side' (wrong marker — non-conformant; report and treat as Side)
    if (trimmed.toLowerCase() === "#side") {
      violations.push({
        code: "parse_error",
        message: `Line ${lineNum}: Side Deck marker must be "!side" (with "!"), not "#side". Treating as side section but this is non-conformant.`,
        line: lineNum,
      });
      section = "side";
      sawSide = true;
      continue;
    }

    // Section markers
    if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
      const lower = trimmed.toLowerCase();

      if (lower === "#main") {
        section = "main";
        sawMain = true;
        continue;
      }
      if (lower === "#extra") {
        section = "extra";
        sawExtra = true;
        continue;
      }
      if (lower === "!side") {
        section = "side";
        sawSide = true;
        continue;
      }

      // '#created by <name>' — extract deck name
      if (lower.startsWith("#created by ")) {
        name = trimmed.slice("#created by ".length).trim();
        continue;
      }

      // Other comment lines — silently ignore
      continue;
    }

    // Passcode line
    if (section === "none") {
      violations.push({
        code: "parse_error",
        message: `Line ${lineNum}: Passcode "${trimmed}" appears before any section marker (#main, #extra, !side).`,
        line: lineNum,
      });
      continue;
    }

    // Must be a valid integer
    if (!/^\d+$/.test(trimmed)) {
      violations.push({
        code: "parse_error",
        message: `Line ${lineNum}: "${trimmed}" is not a valid passcode (expected a non-negative integer).`,
        line: lineNum,
      });
      continue;
    }

    const passcode = parseInt(trimmed, 10);

    // Check against catalog if provided
    if (catalog !== null && !catalog.legalPasscodes.has(passcode)) {
      // resolveCard handles alias passcodes too (511002993 → Brionac base)
      const resolvedCard = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);
      violations.push({
        code: resolvedCard ? "out_of_pool" : "unknown_passcode",
        message: resolvedCard
          ? `Line ${lineNum}: Passcode ${passcode} ("${resolvedCard.name}") is not in the Edison legal pool.`
          : `Line ${lineNum}: Passcode ${passcode} is unknown (not in the card database).`,
        passcode,
        line: lineNum,
      });
      // Still route to the appropriate zone for structural completeness
    }

    // Route to zone — check for cross-zone placement issues (alias-aware)
    if (section === "extra" && catalog !== null) {
      const card = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);
      if (card && !card.isExtraDeck) {
        violations.push({
          code: "wrong_zone",
          message: `Line ${lineNum}: "${card.name}" (${passcode}) is not an Extra Deck monster but appears under #extra.`,
          passcode,
          zone: "extra",
          line: lineNum,
        });
        // Move to Main Deck to keep deck structure sane
        main.push(passcode);
        continue;
      }
    } else if ((section === "main" || section === "side") && catalog !== null) {
      const card = resolveCard(passcode, catalog.byPasscode, catalog.aliasIndex);
      if (card?.isExtraDeck) {
        violations.push({
          code: "wrong_zone",
          message: `Line ${lineNum}: "${card.name}" (${passcode}) is a ${card.frame} monster and must be in the Extra Deck, not #${section}.`,
          passcode,
          zone: section,
          line: lineNum,
        });
        // Move to Extra Deck to keep deck structure sane
        extra.push(passcode);
        continue;
      }
    }

    if (section === "main") main.push(passcode);
    else if (section === "extra") extra.push(passcode);
    else side.push(passcode);
  }

  // Warn if no #main marker found (likely a malformed file)
  if (
    !sawMain &&
    !sawExtra &&
    !sawSide &&
    (main.length > 0 || extra.length > 0 || side.length > 0)
  ) {
    // This shouldn't happen with above logic, but defensive:
    violations.push({
      code: "parse_error",
      message: "No section markers found (#main, #extra, !side). File may be malformed.",
    });
  }

  return { name, main, extra, side, violations };
}

/**
 * Emit a .ydk file text from the given deck.
 * Always uses LF line endings.
 * Emits: #created by <name> (if name provided), #main, #extra, !side
 */
export function emitYdk(deck: {
  name?: string;
  main: number[];
  extra: number[];
  side: number[];
}): string {
  const lines: string[] = [];

  if (deck.name) {
    lines.push(`#created by ${deck.name}`);
  }

  lines.push("#main");
  for (const p of deck.main) lines.push(String(p));

  lines.push("#extra");
  for (const p of deck.extra) lines.push(String(p));

  lines.push("!side");
  for (const p of deck.side) lines.push(String(p));

  return lines.join("\n") + "\n";
}
