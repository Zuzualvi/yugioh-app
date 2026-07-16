/**
 * AnnounceRacePanel — choose `count` race types from the decoded `available` list.
 *
 * Emits: { kind: "AnnounceRace", races: Race[] }
 * a11y: ≥44px targets, ≥16px text, aria-pressed toggles, aria-live count.
 */

import React, { useState } from "react";
import type { Race } from "@yugioh-app/contracts";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_SECONDARY: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-1)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
  fontWeight: 400,
};

const SELECTED_BORDER: React.CSSProperties = {
  border: "2px solid var(--accent-light)",
};

const BTN_CONFIRM: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
};

// ── Race display labels ───────────────────────────────────────────────────────

const RACE_LABELS: Record<string, string> = {
  WARRIOR: "Warrior",
  SPELLCASTER: "Spellcaster",
  FAIRY: "Fairy",
  FIEND: "Fiend",
  ZOMBIE: "Zombie",
  MACHINE: "Machine",
  AQUA: "Aqua",
  PYRO: "Pyro",
  ROCK: "Rock",
  WINGEDBEAST: "Winged Beast",
  PLANT: "Plant",
  INSECT: "Insect",
  THUNDER: "Thunder",
  DRAGON: "Dragon",
  BEAST: "Beast",
  BEASTWARRIOR: "Beast-Warrior",
  DINOSAUR: "Dinosaur",
  FISH: "Fish",
  SEASERPENT: "Sea Serpent",
  REPTILE: "Reptile",
  PSYCHIC: "Psychic",
  DIVINE_BEAST: "Divine-Beast",
  CREATORGOD: "Creator God",
  WYRM: "Wyrm",
  CYBERSE: "Cyberse",
  ILLUSION: "Illusion",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnnounceRacePanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"AnnounceRace">) {
  const { count, available } = decision;
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= count) return prev;
      return [...prev, i];
    });
  };

  const canConfirm = selectedIndices.length === count;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  return (
    <div>
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-0)",
          marginBottom: 8,
        }}
      >
        Announce {count} monster type{count !== 1 ? "s" : ""}:
      </p>

      {/* Running count */}
      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: "0.875rem",
          color: "var(--text-2)",
          marginBottom: 8,
        }}
      >
        {selectedIndices.length} / {count} selected
      </div>

      {/* Race list */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}
        role="group"
        aria-label={`Select ${count} monster type${count !== 1 ? "s" : ""}`}
      >
        {available.map((race, i) => {
          const sel = selectedIndices.includes(i);
          return (
            <button
              key={race}
              data-testid="action-option"
              style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
              disabled={disabled}
              onClick={() => toggle(i)}
              aria-pressed={sel}
              aria-label={`${RACE_LABELS[race] ?? race}${sel ? " (selected)" : ""}`}
            >
              <span aria-hidden="true">{sel ? "✓" : "○"}</span>
              {RACE_LABELS[race] ?? race}
            </button>
          );
        })}
      </div>

      {/* Confirm */}
      <button
        style={dis({ ...BTN_CONFIRM, opacity: canConfirm ? 1 : 0.4 })}
        disabled={disabled || !canConfirm}
        onClick={() =>
          respond({
            kind: "AnnounceRace",
            races: selectedIndices.map((i) => available[i] as Race),
          })
        }
        aria-disabled={!canConfirm}
      >
        Confirm ✓
      </button>
    </div>
  );
}
