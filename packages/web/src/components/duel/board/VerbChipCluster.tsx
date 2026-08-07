/**
 * VerbChipCluster — ACT mode verb chips anchored at the clicked card.
 *
 * Design spec §3:
 * - Only legal verbs (from IdleCommand/BattleCommand) are rendered. Never greyed.
 * - Fixed global order: Summon · Set · Normal Summon — tribute · Special Summon ·
 *   Activate · Change Position · Attack · Inspect
 * - "Normal Summon — tribute" has NO count (ND-1 withdrawn, CTO 2026-08-07).
 * - Refusal chip appears within 40px of the card if nothing is afforded.
 * - Requirement H: no fabricated reason in the general case. One permitted
 *   exception: "This monster has already attacked." (state we hold, not inference).
 *
 * Replaces ActionContextMenu.tsx.
 */
import React, { useEffect, useRef } from "react";
import type { DuelDecision, ZoneCard } from "@yugioh-app/contracts";
import type { CardRef } from "../../../duel/contracts";

export type VerbLabel =
  | "Normal Summon"
  | "Normal Summon — tribute"
  | "Set"
  | "Special Summon"
  | "Activate"
  | "Change Position"
  | "Attack"
  | "Attack directly"
  | "Inspect";

export interface Verb {
  label: VerbLabel | string; // string allows description overrides for multi-activate
  action: string;
  /** For multi-effect cards, the decision index to use */
  index?: number;
}

// Global fixed order
const VERB_ORDER: string[] = [
  "Normal Summon",
  "Normal Summon — tribute",
  "Set",
  "Special Summon",
  "Activate",
  "Change Position",
  "Attack",
  "Attack directly",
  "Inspect",
];

function verbSortKey(label: string): number {
  const idx = VERB_ORDER.findIndex((v) => label.startsWith(v));
  return idx === -1 ? VERB_ORDER.length : idx;
}

interface Props {
  /** DOMRect of the clicked card, for anchoring */
  anchor: DOMRect;
  verbs: Verb[];
  onPick: (v: Verb) => void;
  onDismiss: () => void;
  /** Reason to show if verbs is empty. Null = show nothing (no cluster). */
  refusalReason?: string | null;
}

/**
 * Derives legal verbs from an IdleCommand or BattleCommand decision.
 * Returns null if the decision is not an IdleCommand or BattleCommand.
 *
 * `handCards` — the current player's hand from the board snapshot (MH-1).
 * Used to read `ZoneCard.level` to distinguish tribute vs non-tribute summons.
 * Level ≥ 5 → "Normal Summon — tribute" (no count — ND-1 withdrawn).
 * Level unknown → "Normal Summon" (safe fallback, requirement H: don't fabricate).
 */
export function deriveVerbs(
  decision: DuelDecision | null,
  clickedRef: CardRef | null,
  handCards?: (ZoneCard | null)[],
): Verb[] | null {
  if (!decision || !clickedRef) return null;

  if (decision.kind === "IdleCommand") {
    const verbs: Verb[] = [];

    // Level lookup from the snapshot (MH-1: ZoneCard.level is on the wire).
    // CardEntry.location is the card's current location; sequence is its index.
    function levelForEntry(location: string, sequence: number): number | null {
      if (location === "HAND" && handCards) {
        const card = handCards[sequence];
        return card?.level ?? null;
      }
      return null;
    }

    // Summons: "Normal Summon — tribute" for level ≥ 5 (no count per ND-1).
    if (decision.summons) {
      for (const s of decision.summons) {
        if (
          s.controller === clickedRef.controller &&
          s.location === clickedRef.location &&
          s.sequence === clickedRef.sequence
        ) {
          const level = levelForEntry(s.location, s.sequence);
          const needsTribute = level != null && level >= 5;
          verbs.push({
            label: needsTribute ? "Normal Summon — tribute" : "Normal Summon",
            action: "summon",
            index: decision.summons.indexOf(s),
          });
        }
      }
    }

    // Monster sets
    if (decision.monsterSets) {
      for (const s of decision.monsterSets) {
        if (
          s.controller === clickedRef.controller &&
          s.location === clickedRef.location &&
          s.sequence === clickedRef.sequence
        ) {
          verbs.push({
            label: "Set",
            action: "monsterSet",
            index: decision.monsterSets.indexOf(s),
          });
          break;
        }
      }
    }

    // Spell/Trap sets
    if (decision.spellSets) {
      for (const s of decision.spellSets) {
        if (
          s.controller === clickedRef.controller &&
          s.location === clickedRef.location &&
          s.sequence === clickedRef.sequence
        ) {
          verbs.push({ label: "Set", action: "spellSet", index: decision.spellSets.indexOf(s) });
          break;
        }
      }
    }

    // Special summons
    if (decision.specialSummons) {
      for (const s of decision.specialSummons) {
        if (
          s.controller === clickedRef.controller &&
          s.location === clickedRef.location &&
          s.sequence === clickedRef.sequence
        ) {
          verbs.push({
            label: "Special Summon",
            action: "specialSummon",
            index: decision.specialSummons.indexOf(s),
          });
        }
      }
    }

    // Activations
    if (decision.activates) {
      const cardActivates = decision.activates.filter(
        (a) =>
          a.controller === clickedRef.controller &&
          a.location === clickedRef.location &&
          a.sequence === clickedRef.sequence,
      );
      if (cardActivates.length === 1 && cardActivates[0]) {
        verbs.push({
          label: "Activate",
          action: "activate",
          index: decision.activates.indexOf(cardActivates[0]),
        });
      } else {
        for (const a of cardActivates) {
          verbs.push({
            label: a.description ? `Activate — ${a.description}` : "Activate",
            action: "activate",
            index: decision.activates.indexOf(a),
          });
        }
      }
    }

    // Position changes
    if (decision.posChanges) {
      for (const p of decision.posChanges) {
        if (
          p.controller === clickedRef.controller &&
          p.location === clickedRef.location &&
          p.sequence === clickedRef.sequence
        ) {
          verbs.push({
            label: "Change Position",
            action: "posChange",
            index: decision.posChanges.indexOf(p),
          });
          break;
        }
      }
    }

    // Inspect is always available for own cards
    verbs.push({ label: "Inspect", action: "inspect" });

    // Sort by fixed global order
    verbs.sort((a, b) => verbSortKey(a.label) - verbSortKey(b.label));
    return verbs;
  }

  if (decision.kind === "BattleCommand") {
    const verbs: Verb[] = [];

    if (decision.attacks) {
      for (const a of decision.attacks) {
        if (
          a.controller === clickedRef.controller &&
          a.location === clickedRef.location &&
          a.sequence === clickedRef.sequence
        ) {
          verbs.push({
            label: a.canDirectAttack ? "Attack directly" : "Attack",
            action: "attack",
            index: decision.attacks.indexOf(a),
          });
          break;
        }
      }
    }

    verbs.push({ label: "Inspect", action: "inspect" });
    verbs.sort((a, b) => verbSortKey(a.label) - verbSortKey(b.label));
    return verbs;
  }

  return null;
}

/**
 * Derives refusal reason for a card that affords nothing.
 * Only one reason is permitted (Requirement H): "already attacked" during BP.
 */
export function deriveRefusalReason(
  decision: DuelDecision | null,
  clickedRef: CardRef | null,
): string | null {
  if (!decision || !clickedRef) return null;

  if (decision.kind === "BattleCommand" && clickedRef.location === "MZONE") {
    // The card is not in attacks[]. During BP this means it has already attacked.
    const inAttacks = (decision.attacks ?? []).some(
      (a) =>
        a.controller === clickedRef.controller &&
        a.location === clickedRef.location &&
        a.sequence === clickedRef.sequence,
    );
    if (!inAttacks) {
      return "This monster has already attacked.";
    }
  }

  return "Nothing you can do with this card right now.";
}

export function VerbChipCluster({ anchor, verbs, onPick, onDismiss, refusalReason }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Dismiss on click-outside
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onDismiss]);

  // Position: anchor above the card; flip below if too close to top.
  const spaceAbove = anchor.top;
  const placeBelow = spaceAbove < 120;

  const top = placeBelow ? anchor.bottom + 4 : anchor.top - 8;
  const left = anchor.left + anchor.width / 2;

  // No verbs (excluding Inspect) → show refusal chip close to the card
  const actionVerbs = verbs.filter((v) => v.label !== "Inspect");
  if (actionVerbs.length === 0 && refusalReason) {
    return (
      <div
        data-testid="refusal-chip"
        aria-live="polite"
        style={{
          position: "fixed",
          top: placeBelow ? anchor.bottom + 4 : anchor.top - 32,
          left,
          transform: "translateX(-50%)",
          zIndex: 20,
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "4px 10px",
          fontSize: "0.8125rem",
          color: "var(--text-2)",
          maxWidth: 220,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        {refusalReason}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-testid="verb-chip-cluster"
      role="menu"
      aria-label="Card actions"
      style={{
        position: "fixed",
        top: placeBelow ? anchor.bottom + 4 : top - 44,
        left,
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        flexDirection: "row",
        gap: 4,
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 8px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        flexWrap: "wrap",
        maxWidth: 480,
      }}
    >
      {verbs.map((verb, i) => (
        <button
          key={`${verb.label}-${i}`}
          role="menuitem"
          autoFocus={i === 0}
          onClick={() => onPick(verb)}
          aria-label={verb.label}
          style={{
            padding: "6px 12px",
            background: "var(--accent-dim)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            color: "var(--text-0)",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            minHeight: 36,
            whiteSpace: "nowrap",
          }}
        >
          {verb.label}
        </button>
      ))}
      {/* Esc hint — required by spec [B2] */}
      <span
        aria-hidden="true"
        style={{
          width: "100%",
          fontSize: "0.6875rem",
          color: "var(--text-2)",
          textAlign: "center",
          marginTop: 2,
        }}
      >
        <kbd>Esc</kbd> closes — costs nothing
      </span>
    </div>
  );
}
