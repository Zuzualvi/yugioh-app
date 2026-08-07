/**
 * HandRow — renders one player's hand.
 * Opponent hand: card backs with numeric count (never "count by eye").
 * Own hand: face-up cards, each clickable for verb chips (in ACT mode).
 */
import React from "react";
import type { ZoneCard, Seat } from "@yugioh-app/contracts";
import type { CardRef } from "../../../duel/contracts";
import { cardImageUrl } from "../../../utils/cardImageUrl";

interface Props {
  cards: ZoneCard[];
  controller: Seat;
  mySeat: Seat;
  /** Cards that are candidates of the pending decision (dim law) */
  candidates: CardRef[];
  /** Called when a card in own hand is clicked (for verb chips) */
  onCardClick?: (ref: CardRef, rect: DOMRect) => void;
}

function isCandidate(ref: CardRef, candidates: CardRef[]): boolean {
  return candidates.some(
    (c) =>
      c.controller === ref.controller && c.location === ref.location && c.sequence === ref.sequence,
  );
}

export function HandRow({ cards, controller, mySeat, candidates, onCardClick }: Props) {
  const isOwn = controller === mySeat;

  if (!isOwn) {
    // Opponent hand: backs + count
    return (
      <div
        data-testid="opp-hand-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 0",
          justifyContent: "center",
        }}
      >
        {/* Numeric count — never just count the backs */}
        <span
          style={{
            fontSize: "0.875rem",
            color: "var(--text-2)",
            fontWeight: 600,
            marginRight: 4,
          }}
        >
          {cards.length} card{cards.length !== 1 ? "s" : ""}
        </span>
        {cards.map((_, i) => (
          <div
            key={i}
            data-testid="face-down-card"
            aria-label="Opponent hand card"
            style={{
              width: 28,
              height: 40,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
            }}
          >
            🂠
          </div>
        ))}
      </div>
    );
  }

  // Own hand: face-up cards
  return (
    <div
      data-testid="own-hand-row"
      style={{
        display: "flex",
        gap: 6,
        padding: "4px 0",
        overflowX: "auto",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {cards.length === 0 && (
        <span style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>Empty hand</span>
      )}
      {cards.map((card, i) => {
        const ref: CardRef = { controller, location: "HAND", sequence: i };
        const cand = isCandidate(ref, candidates);
        const hidden = card.code === 0;

        return (
          <button
            key={i}
            onClick={(e) => {
              if (onCardClick) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onCardClick(ref, rect);
              }
            }}
            aria-label={`Hand card ${i + 1}${hidden ? " (face-down)" : ""}`}
            style={{
              padding: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "relative",
              zIndex: cand ? 3 : undefined,
            }}
          >
            {hidden ? (
              <div
                data-testid="face-down-card"
                style={{
                  width: 46,
                  height: 66,
                  background: "var(--bg-3)",
                  border: `1px solid ${cand ? "var(--own)" : "var(--border)"}`,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                  opacity: 0.6,
                }}
              >
                🂠
              </div>
            ) : (
              <img
                data-testid="face-up-card"
                src={cardImageUrl(card.code)}
                alt={`Hand card ${i + 1}`}
                style={{
                  width: 46,
                  height: 66,
                  borderRadius: 4,
                  objectFit: "cover",
                  border: `1px solid ${cand ? "var(--own)" : "var(--border)"}`,
                  display: "block",
                }}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
