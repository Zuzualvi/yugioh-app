/**
 * Decision-option extraction — INTEGRATION SEAM
 *
 * This is the single file that reconciles mock decision-message field shapes
 * with the real engine output.  When the real server (slice 20) lands, only
 * this module needs updating if field names or option structures differ.
 *
 * Spec: keep option-extraction logic isolated here so wave-2 integration is a
 * single-file change.
 *
 * Message bodies are `passthrough` in contracts (not strictly typed), so we
 * use unknown and narrow at runtime.
 *
 * README NOTE:
 *   The mock duel session (src/mock/duelSession.ts) emits decision messages
 *   with the shapes defined here.  If the real ocgcore engine uses different
 *   field names or value encodings, update extractOptions() and the related
 *   helpers below — the ActionPanel component will work without changes.
 */

import type { RedactedEngineMessage } from "@yugioh-app/contracts";

export interface DecisionOption {
  /** Human-readable label for the option */
  label: string;
  /** The EngineResponse value to send when this option is chosen */
  value: number | string | null;
  /** Whether this is the "no response / pass" option (priority windows) */
  isPass?: boolean;
}

/** All recognised decision message names */
export const DECISION_NAMES = [
  "SELECT_IDLECMD",
  "SELECT_BATTLECMD",
  "SELECT_CHAIN",
  "SELECT_CARD",
  "SELECT_EFFECTYN",
  "SELECT_YESNO",
  "SELECT_OPTION",
  "SELECT_PLACE",
  "SELECT_POSITION",
  "SELECT_TRIBUTE",
  "ANNOUNCE_ATTRIB",
  "ANNOUNCE_NUMBER",
  "ANNOUNCE_CARD",
  "ANNOUNCE_RACE",
] as const;

export type DecisionName = (typeof DECISION_NAMES)[number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toOptions(
  arr: unknown,
  labelKey: string,
  valueKey: string,
  extra?: { passLabel?: string },
): DecisionOption[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item, i) => {
    if (!isRecord(item))
      return { label: `Option ${i + 1}`, value: i, isPass: false };
    const label = typeof item[labelKey] === "string" ? item[labelKey] : `Option ${i + 1}`;
    const value = item[valueKey] !== undefined ? (item[valueKey] as number | string) : i;
    const isPass = extra?.passLabel ? label === extra.passLabel : false;
    return { label, value, isPass };
  });
}

/**
 * Extracts the list of available choices from a redacted engine decision message.
 * Returns an empty array if the message is not a recognised decision type.
 */
export function extractOptions(msg: RedactedEngineMessage): DecisionOption[] {
  const body = msg as Record<string, unknown>;

  switch (msg.name) {
    case "SELECT_IDLECMD":
    case "SELECT_BATTLECMD": {
      // Shape: { options: Array<{ label: string; index: number }> }
      return toOptions(body["options"], "label", "index");
    }

    case "SELECT_CHAIN": {
      // Shape: { options: Array<{ label: string; index: number }>; canPass: boolean }
      const opts = toOptions(body["options"], "label", "index");
      if (body["canPass"] === true) {
        opts.push({ label: "No response (pass)", value: -1, isPass: true });
      }
      return opts;
    }

    case "SELECT_CARD": {
      // Shape: { cards: Array<{ name: string; code: number; index: number }> }
      const cards = body["cards"];
      if (!Array.isArray(cards)) return [];
      return cards.map((c: unknown, i: number) => {
        if (!isRecord(c)) return { label: `Card ${i + 1}`, value: i };
        return {
          label: typeof c["name"] === "string" ? c["name"] : `Card ${i + 1}`,
          value: typeof c["index"] === "number" ? c["index"] : i,
        };
      });
    }

    case "SELECT_EFFECTYN":
    case "SELECT_YESNO": {
      // Shape: { question?: string }
      return [
        { label: "Yes", value: 1 },
        { label: "No", value: 0 },
      ];
    }

    case "SELECT_OPTION": {
      // Shape: { options: Array<{ label: string; index: number }> }
      return toOptions(body["options"], "label", "index");
    }

    case "SELECT_PLACE": {
      // Shape: { places: Array<{ label: string; index: number }> }
      return toOptions(body["places"], "label", "index");
    }

    case "SELECT_POSITION": {
      // Shape: { positions: Array<{ label: string; value: number }> }
      return toOptions(body["positions"], "label", "value");
    }

    case "SELECT_TRIBUTE": {
      // Shape: { cards: Array<{ name: string; index: number }> }
      const cards = body["cards"];
      if (!Array.isArray(cards)) return [];
      return cards.map((c: unknown, i: number) => {
        if (!isRecord(c)) return { label: `Tribute ${i + 1}`, value: i };
        return {
          label: typeof c["name"] === "string" ? c["name"] : `Tribute ${i + 1}`,
          value: typeof c["index"] === "number" ? c["index"] : i,
        };
      });
    }

    case "ANNOUNCE_ATTRIB": {
      const attrs: DecisionOption[] = [
        { label: "DARK", value: "DARK" },
        { label: "LIGHT", value: "LIGHT" },
        { label: "EARTH", value: "EARTH" },
        { label: "WATER", value: "WATER" },
        { label: "FIRE", value: "FIRE" },
        { label: "WIND", value: "WIND" },
        { label: "DIVINE", value: "DIVINE" },
      ];
      return attrs;
    }

    case "ANNOUNCE_NUMBER": {
      // Shape: { numbers: number[] }
      const nums = body["numbers"];
      if (!Array.isArray(nums)) return [];
      return nums.map((n: unknown) => ({ label: String(n), value: n as number }));
    }

    case "ANNOUNCE_CARD":
    case "ANNOUNCE_RACE": {
      const opts = body["options"];
      if (!Array.isArray(opts)) return [];
      return opts.map((o: unknown, i: number): DecisionOption => {
        if (typeof o === "string") return { label: o, value: o };
        if (isRecord(o)) {
          const v = o["value"];
          const val: number | string | null =
            typeof v === "number" || typeof v === "string" ? v : i;
          return { label: String(o["label"] ?? i), value: val };
        }
        return { label: String(o), value: i };
      });
    }

    default:
      return [];
  }
}

/** Returns a human-readable description of what the decision is asking for. */
export function decisionPrompt(msg: RedactedEngineMessage): string {
  const body = msg as Record<string, unknown>;
  switch (msg.name) {
    case "SELECT_IDLECMD":
      return "Choose an action:";
    case "SELECT_BATTLECMD":
      return "Choose a battle action:";
    case "SELECT_CHAIN":
      return typeof body["question"] === "string"
        ? body["question"]
        : "Do you wish to respond?";
    case "SELECT_CARD":
      return typeof body["hint"] === "string" ? body["hint"] : "Select a card:";
    case "SELECT_EFFECTYN":
    case "SELECT_YESNO":
      return typeof body["question"] === "string"
        ? body["question"]
        : "Yes or No?";
    case "SELECT_OPTION":
      return typeof body["hint"] === "string" ? body["hint"] : "Select an option:";
    case "SELECT_PLACE":
      return "Select a zone:";
    case "SELECT_POSITION":
      return "Select a position:";
    case "SELECT_TRIBUTE":
      return "Select a tribute:";
    case "ANNOUNCE_ATTRIB":
      return "Announce an attribute:";
    case "ANNOUNCE_NUMBER":
      return "Announce a number:";
    case "ANNOUNCE_CARD":
      return "Announce a card:";
    case "ANNOUNCE_RACE":
      return "Announce a type/race:";
    default:
      return "Make a decision:";
  }
}
