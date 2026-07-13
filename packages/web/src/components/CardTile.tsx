import type { CSSProperties } from "react";
import type { CardDTO } from "../types/contracts";
import { cardImageUrl } from "../utils/cardImageUrl";
import { LegalityBadge } from "./LegalityBadge";
import { maxCopies } from "./LegalityBadge";

interface Props {
  card: CardDTO;
  copyCount: number;
  onInspect: () => void;
  onAdd: () => void;
  style?: CSSProperties;
  showAddButton?: boolean;
}

/** A card tile used in the search results grid of the Deck Builder. */
export function CardTile({
  card,
  copyCount,
  onInspect,
  onAdd,
  style,
  showAddButton = true,
}: Props) {
  const max = maxCopies(card.banlist);
  const atMax = copyCount >= max;
  const isForbidden = card.banlist === "forbidden";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--bg-2)",
        opacity: isForbidden ? 0.6 : 1,
        ...style,
      }}
    >
      {/* Card art — tap to inspect */}
      <button
        onClick={onInspect}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
        }}
        aria-label={`Inspect ${card.name}`}
        title={`${card.name} — tap to inspect`}
      >
        <img
          src={cardImageUrl(card.imageId)}
          alt={card.name}
          style={{
            width: "100%",
            aspectRatio: "421/614",
            objectFit: "cover",
            display: "block",
          }}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='131' style='background:%2322222e'><text x='45' y='68' text-anchor='middle' font-size='30' fill='%234a4a6a'>⟡</text></svg>";
          }}
        />
        {/* Legality badge overlay */}
        <span
          style={{
            position: "absolute",
            top: 3,
            right: 3,
          }}
        >
          <LegalityBadge banlist={card.banlist} />
        </span>
        {/* Copy count badge */}
        {copyCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              background: "var(--accent)",
              color: "#fff",
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 4,
            }}
            aria-label={`${copyCount} in deck`}
          >
            ×{copyCount}
          </span>
        )}
      </button>

      {/* Add button — always visible, disabled when at limit */}
      {showAddButton && (
        <button
          className="btn btn-primary"
          onClick={onAdd}
          disabled={atMax || isForbidden}
          aria-label={
            isForbidden
              ? `${card.name} is Forbidden`
              : atMax
                ? `${card.name}: max copies (${max}) in deck`
                : `Add ${card.name} to deck`
          }
          style={{
            width: "100%",
            borderRadius: "0 0 7px 7px",
            padding: "6px 4px",
            fontSize: "0.75rem",
            minHeight: 36,
          }}
        >
          {isForbidden ? "🚫" : atMax ? `Max (${max})` : "+ Add"}
        </button>
      )}
    </div>
  );
}
