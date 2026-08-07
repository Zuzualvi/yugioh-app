/**
 * ZoneSlot — one zone on the board. Renders a card or an empty slot.
 *
 * Dense-indexed: sequence === array index, guaranteed by MH-1 contract.
 * No filtering of nulls — null means the zone is empty.
 *
 * Opponent face-up cards render with real identity, art and stats.
 * The old "if (hidden || !isOwn)" guard is gone (design spec §2 §6).
 *
 * Own set cards render translucent.
 * Defence-position cards rotate 90°.
 */
import React from "react";
import type { ZoneCard, Seat } from "@yugioh-app/contracts";
import type { CardRef } from "../../../duel/contracts";
import { cardImageUrl } from "../../../utils/cardImageUrl";

// Yu-Gi-Oh position bitmask constants
const POS_FACE_DOWN_ATK = 0x2;
const POS_FACE_UP_DEF = 0x4;
const POS_FACE_DOWN_DEF = 0x8;

function isFaceDown(position: number): boolean {
  return (position & (POS_FACE_DOWN_ATK | POS_FACE_DOWN_DEF)) !== 0;
}

function isDefencePosition(position: number): boolean {
  return (position & (POS_FACE_UP_DEF | POS_FACE_DOWN_DEF)) !== 0;
}

function positionGlyph(position: number): string {
  if (position & POS_FACE_DOWN_DEF) return "⌄"; // face-down def
  if (position & POS_FACE_DOWN_ATK) return "⌄"; // face-down atk (set monster)
  if (position & POS_FACE_UP_DEF) return "→"; // face-up def
  return "↑"; // face-up atk (default)
}

interface Props {
  card: ZoneCard | null;
  sequence: number;
  controller: Seat;
  location: "MZONE" | "SZONE" | "FZONE";
  mySeat: Seat;
  /** Whether this card is a legal action target (armed in ACT mode) */
  actionable?: boolean;
  /** Whether this card is a candidate of the pending decision */
  isCandidate?: boolean;
  /** Whether this card is selected */
  isSelected?: boolean;
  /** Monster absent from attacks[] during Battle Phase → greyed badge */
  spent?: boolean;
  onClick?: (ref: CardRef, rect: DOMRect) => void;
}

export function ZoneSlot({
  card,
  sequence,
  controller,
  location,
  mySeat,
  actionable,
  isCandidate,
  isSelected,
  spent,
  onClick,
}: Props) {
  const isOwn = controller === mySeat;
  const ownerColor = isOwn ? "var(--own)" : "var(--opp)";

  const ref: CardRef = { controller, location, sequence };

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    if (onClick) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onClick(ref, rect);
    }
  }

  const slotStyle: React.CSSProperties = {
    width: 58,
    height: 82,
    borderRadius: 4,
    border: isCandidate
      ? `3px solid ${ownerColor}`
      : isSelected
        ? `3px solid var(--accent-light)`
        : actionable
          ? `2px solid ${ownerColor}`
          : `1px dashed ${ownerColor}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
    zIndex: isCandidate ? 3 : undefined,
    cursor: card ? "pointer" : undefined,
    opacity: isCandidate ? 1 : undefined,
  };

  if (!card) {
    // Empty zone
    return (
      <div
        data-testid="empty-zone"
        aria-label={`Empty ${location} zone ${sequence}`}
        style={{ ...slotStyle, opacity: 0.4 }}
      />
    );
  }

  const faceDown = isFaceDown(card.position);
  const defence = isDefencePosition(card.position);
  // Own set S/T cards render translucent so the owner can still read them
  const isOwnSetCard = isOwn && faceDown && location === "SZONE";

  const rotationDeg = defence ? 90 : 0;
  const opacity = isOwnSetCard ? 0.65 : 1;

  return (
    <button
      aria-label={
        faceDown && !isOwn
          ? `${isOwn ? "Your" : "Opponent"} face-down card in ${location} zone ${sequence}`
          : `Card in ${location} zone ${sequence}`
      }
      onClick={handleClick}
      style={{
        ...slotStyle,
        padding: 0,
        background: "none",
        overflow: "visible",
      }}
    >
      <div
        style={{
          transform: `rotate(${rotationDeg}deg)`,
          width: defence ? 82 : 58,
          height: defence ? 58 : 82,
          position: "relative",
          opacity,
        }}
      >
        {faceDown && !isOwn ? (
          // Opponent face-down: card back
          <div
            data-testid="face-down-card"
            style={{
              width: "100%",
              height: "100%",
              background: "var(--bg-3)",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            🂠
          </div>
        ) : (
          // Face-up (own or opponent) — render real art
          <>
            <img
              data-testid="face-up-card"
              src={cardImageUrl(card.code)}
              alt=""
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 3,
                display: "block",
              }}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Overlays: position glyph, ATK/DEF, attack badge */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: 2,
                background: "linear-gradient(transparent 50%, rgba(0,0,0,0.7) 100%)",
                borderRadius: 3,
                pointerEvents: "none",
              }}
            >
              {/* ATK/DEF */}
              {location === "MZONE" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  {/* Attack-availability badge (F11) */}
                  {spent != null && (
                    <span
                      data-testid={spent ? "attack-badge-used" : "attack-badge-atk"}
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 700,
                        color: spent ? "var(--text-2)" : "var(--text-0)",
                        background: spent ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.6)",
                        padding: "1px 3px",
                        borderRadius: 2,
                        lineHeight: 1,
                      }}
                    >
                      {spent ? "USED" : "ATK"}
                    </span>
                  )}
                  {/* Stat */}
                  {card.attack != null && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        color: "var(--text-0)",
                        background: "rgba(0,0,0,0.6)",
                        padding: "1px 3px",
                        borderRadius: 2,
                        lineHeight: 1,
                        marginLeft: "auto",
                      }}
                    >
                      {defence && card.defense != null ? card.defense : card.attack}
                    </span>
                  )}
                </div>
              )}
              {/* Position glyph */}
              <span
                style={{
                  fontSize: "0.625rem",
                  color: "var(--text-1)",
                  alignSelf: "flex-end",
                }}
              >
                {positionGlyph(card.position)}
              </span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}
