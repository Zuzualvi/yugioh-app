/**
 * PileInspector (§9) — GY / Banished / Deck / Extra Deck grid overlay.
 *
 * - Opens from a pile badge click; never broadcasts to opponent (no outbound msg).
 * - Empty pile: shows message, does not swallow the click.
 * - Hidden pile (opp deck / extra): shows count only.
 * - Tiles lazy-load and degrade individually.
 * - Exit: Esc, click-away.
 */

import React, { useEffect } from "react";
import type { Seat } from "@yugioh-app/contracts";
import type { CardLookup } from "../../../duel/contracts";
import type { InspectorControl } from "../../../duel/contracts";
import { CardArt } from "./CardArt";

interface PileCard {
  code: number;
  name?: string;
}

interface Props {
  controller: Seat;
  location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK";
  cards: PileCard[];
  /** True when the pile contents are not visible to this viewer. */
  hidden: boolean;
  mySeat: Seat;
  lookup: CardLookup;
  inspector: InspectorControl;
  onClose: () => void;
}

const LOCATION_LABELS: Record<string, string> = {
  GRAVE: "Graveyard",
  REMOVED: "Banished",
  EXTRA: "Extra Deck",
  DECK: "Deck",
};

export function PileInspector({
  controller,
  location,
  cards,
  hidden,
  mySeat,
  lookup,
  inspector,
  onClose,
}: Props) {
  const isOwn = controller === mySeat;
  const ownerLabel = isOwn ? "Your" : "Opponent's";
  const locationLabel = LOCATION_LABELS[location] ?? location;
  const title = `${ownerLabel} ${locationLabel}`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          maxWidth: 640,
          width: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-0)", margin: 0 }}>
            {title} — {hidden ? "?" : cards.length} card{cards.length !== 1 ? "s" : ""}
          </h2>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close pile inspector"
            style={{ minWidth: 32, minHeight: 32 }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ overflow: "auto", flex: 1 }}>
          {hidden ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-2)",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>🂠</div>
              <p style={{ fontSize: "1rem" }}>
                {cards.length} card{cards.length !== 1 ? "s" : ""}
              </p>
            </div>
          ) : cards.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-2)",
                fontSize: "1rem",
              }}
            >
              {locationLabel} is empty
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: 8,
              }}
            >
              {cards.map((card, idx) => {
                const info = card.code !== 0 ? lookup.get(card.code) : null;
                const name = info?.name ?? card.name ?? (card.code !== 0 ? `#${card.code}` : "?");
                return (
                  <button
                    key={idx}
                    title={name}
                    onClick={() => {
                      if (card.code !== 0) {
                        inspector.inspectCard(
                          {
                            controller,
                            location,
                            sequence: idx,
                          },
                          card.code,
                        );
                      }
                    }}
                    style={{
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: 4,
                      cursor: card.code !== 0 ? "pointer" : "default",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 72,
                        height: 105,
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "var(--bg-3,#1a1a2e)",
                        position: "relative",
                      }}
                    >
                      {card.code !== 0 ? (
                        <CardArt code={card.code} width={72} />
                      ) : (
                        <div
                          style={{
                            width: 72,
                            height: 105,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-2)",
                            fontSize: "2rem",
                          }}
                        >
                          🂠
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--text-1)",
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: 72,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
