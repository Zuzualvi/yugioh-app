import { useEffect } from "react";
import type { CardDTO } from "../types/contracts";
import { cardImageUrl } from "../utils/cardImageUrl";
import { LegalityBadge } from "./LegalityBadge";

interface Props {
  card: CardDTO;
  onClose: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  copyCount?: number;
  maxCopy?: number;
  onNext?: () => void;
  onPrev?: () => void;
}

function frameLabel(frame: CardDTO["frame"]): string {
  const map: Record<string, string> = {
    normal: "Normal Monster",
    effect: "Effect Monster",
    ritual: "Ritual Monster",
    fusion: "Fusion Monster",
    synchro: "Synchro Monster",
    spell: "Spell Card",
    trap: "Trap Card",
  };
  return map[frame] ?? frame;
}

/** Shared Card Inspector overlay — usable from Builder, Field, Rules. */
export function CardInspector({
  card,
  onClose,
  onAdd,
  onRemove,
  copyCount = 0,
  maxCopy = 3,
  onNext,
  onPrev,
}: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  const canAdd = onAdd && copyCount < maxCopy;
  const canRemove = onRemove && copyCount > 0;

  const statLine = [
    card.attribute && `Attribute: ${card.attribute}`,
    card.level != null && `Level: ${card.level}`,
    card.race && `Type: ${card.race}`,
    card.atk != null && `ATK: ${card.atk}`,
    card.def != null && `DEF: ${card.def}`,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div
      className="overlay-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Card Inspector: ${card.name}`}
    >
      <div className="overlay-panel" style={{ maxWidth: 520 }}>
        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {onPrev && (
              <button
                className="btn btn-ghost btn-icon"
                onClick={onPrev}
                aria-label="Previous card"
              >
                ‹
              </button>
            )}
            {onNext && (
              <button className="btn btn-ghost btn-icon" onClick={onNext} aria-label="Next card">
                ›
              </button>
            )}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Card content */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Art */}
          <div style={{ flexShrink: 0 }}>
            <img
              src={cardImageUrl(card.imageId)}
              alt={card.name}
              width={120}
              height={174}
              style={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                objectFit: "cover",
                display: "block",
                background: "var(--bg-2)",
              }}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='174' style='background:%2317171f'><text x='60' y='90' text-anchor='middle' font-size='40' fill='%234a4a6a'>⟡</text></svg>";
              }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                marginBottom: 4,
                lineHeight: 1.3,
              }}
            >
              {card.name}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-1)", marginBottom: 6 }}>
              {frameLabel(card.frame)}
            </p>
            {statLine && (
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-2)",
                  marginBottom: 8,
                }}
              >
                {statLine}
              </p>
            )}
            <div style={{ marginBottom: 8 }}>
              <LegalityBadge banlist={card.banlist} size="md" />
            </div>
            <p style={{ fontSize: "0.6875rem", color: "var(--text-2)" }}>#{card.passcode}</p>
          </div>
        </div>

        {/* Effect text */}
        <div
          style={{
            marginTop: 16,
            padding: "12px",
            background: "var(--bg-2)",
            borderRadius: 8,
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color: "var(--text-0)",
          }}
        >
          {card.desc}
        </div>

        {/* Add / Remove actions */}
        {(onAdd || onRemove) && (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {onRemove && (
              <button
                className="btn btn-secondary"
                onClick={onRemove}
                disabled={!canRemove}
                aria-label="Remove one copy from deck"
              >
                − Remove
              </button>
            )}
            {onAdd && (
              <button
                className="btn btn-primary"
                onClick={onAdd}
                disabled={!canAdd}
                aria-label={canAdd ? "Add one copy to deck" : `Max copies reached (${maxCopy})`}
              >
                + Add
              </button>
            )}
            {(onAdd || onRemove) && (
              <span style={{ color: "var(--text-1)", fontSize: "0.875rem" }} aria-live="polite">
                {copyCount} / {maxCopy} in deck
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
