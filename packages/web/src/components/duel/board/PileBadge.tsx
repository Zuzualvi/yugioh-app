/**
 * PileBadge — fixed labelled slot for Deck / Extra / GY / Banished.
 * Always shows a large numeral count. Always clickable (including off-clock and after the duel ends).
 */
import React from "react";
import type { Seat } from "@yugioh-app/contracts";
import type { InspectorControl } from "../../../duel/contracts";

type PileLocation = "GRAVE" | "REMOVED" | "EXTRA" | "DECK";

interface Props {
  label: string;
  count: number;
  controller: Seat;
  location: PileLocation;
  isOwn: boolean;
  inspector: InspectorControl;
  /** Whether this pile badge is a candidate under the dim law */
  isCandidate?: boolean;
}

export function PileBadge({
  label,
  count,
  controller,
  location,
  isOwn,
  inspector,
  isCandidate,
}: Props) {
  const color = isOwn ? "var(--own)" : "var(--opp)";

  return (
    <button
      data-testid={`pile-badge-${label.toLowerCase()}`}
      aria-label={`${label}: ${count} card${count !== 1 ? "s" : ""}. Click to inspect.`}
      onClick={() => inspector.inspectPile(controller, location)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "4px 6px",
        background: "var(--bg-2)",
        border: `1px solid ${isCandidate ? color : "var(--border)"}`,
        borderRadius: 4,
        cursor: "pointer",
        minWidth: 42,
        // Candidates lift above the dim scrim
        position: "relative",
        zIndex: isCandidate ? 3 : undefined,
      }}
    >
      <span
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "var(--text-0)",
          lineHeight: 1,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: "0.625rem",
          color: color,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </button>
  );
}
