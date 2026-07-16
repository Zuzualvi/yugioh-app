/**
 * CardInspector (duel) — full-detail card view for the duel field (§9, mobile spec §2.11).
 *
 * Distinct from the deck-builder CardInspector (src/components/CardInspector.tsx) which
 * takes a CardDTO. This version takes a card code (or 0 for hidden) and renders the
 * card art + basic info. Action buttons (legal actions) are supplied by the caller.
 *
 * Never reveals face-down opponent cards — code=0 shows "Set card" only.
 *
 * Shared component for panel engineers (2B/2C/2D).
 */

import React, { useEffect } from "react";
import { cardImageUrl } from "../../utils/cardImageUrl";

interface CardInspectorAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface Props {
  /** Card passcode. 0 = face-down / hidden. */
  code: number;
  /** Card name — empty string for hidden cards. */
  name?: string;
  /** Owner label, e.g. "Your card" or "Opponent's card" */
  ownerLabel?: string;
  /** Legal actions for this card in the current decision. Empty = read-only. */
  actions?: CardInspectorAction[];
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export function CardInspector({
  code,
  name,
  ownerLabel,
  actions = [],
  onClose,
  onNext,
  onPrev,
}: Props) {
  const isHidden = code === 0;

  // Keyboard handlers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <div
      className="overlay-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ci-title"
    >
      <div className="overlay-panel" style={{ maxWidth: 480 }}>
        {/* Header */}
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
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close inspector">
            ✕
          </button>
        </div>

        {/* Content */}
        {isHidden ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: 12 }}>🂠</div>
            <h2
              id="ci-title"
              style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-1)" }}
            >
              Set Card
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: "1rem", marginTop: 8 }}>
              {ownerLabel ?? "Opponent's face-down card"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* Art */}
            <div style={{ flexShrink: 0 }}>
              <img
                src={cardImageUrl(code)}
                alt={name || `Card ${code}`}
                width={120}
                height={174}
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  objectFit: "cover",
                  display: "block",
                  background: "var(--bg-2)",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='174' style='background:%2317171f'><text x='60' y='90' text-anchor='middle' font-size='40' fill='%234a4a6a'>⟡</text></svg>";
                }}
              />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="ci-title"
                style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}
              >
                {name || `Card #${code}`}
              </h2>
              {ownerLabel && (
                <p style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: 8 }}>
                  {ownerLabel}
                </p>
              )}
              <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>#{code}</p>
            </div>
          </div>
        )}

        {/* Legal actions — shown only when a decision is pending */}
        {actions.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                style={{
                  minHeight: 44,
                  padding: "10px 16px",
                  background: action.primary ? "var(--accent)" : "var(--accent-dim)",
                  border: `1px solid ${action.primary ? "transparent" : "var(--accent)"}`,
                  borderRadius: 8,
                  color: action.primary ? "#fff" : "var(--text-0)",
                  fontSize: "1rem",
                  fontWeight: action.primary ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ▶ {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
