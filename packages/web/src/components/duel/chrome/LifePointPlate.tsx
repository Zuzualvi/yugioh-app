/**
 * LifePointPlate — named LP plate for one player.
 * Yours blue (bottom-left), theirs red (top-right).
 */
import React from "react";

interface Props {
  name: string;
  lp: number;
  isOwn: boolean;
}

export function LifePointPlate({ name, lp, isOwn }: Props) {
  const color = isOwn ? "var(--own)" : "var(--opp)";
  const pct = Math.max(0, Math.min(100, (lp / 8000) * 100));

  return (
    <div
      data-testid={isOwn ? "own-lp-plate" : "opp-lp-plate"}
      aria-label={`${name} LP: ${lp}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "6px 10px",
        background: "var(--bg-1)",
        border: `1px solid ${color}`,
        borderRadius: 6,
        minWidth: 140,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: "0.75rem", color, fontWeight: 700, textTransform: "uppercase" }}>
          {name}
        </span>
        <span
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: lp <= 0 ? "var(--invalid)" : "var(--text-0)",
          }}
          aria-live="polite"
        >
          {lp}
        </span>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-2)" }}>LP</span>
      </div>
      {/* LP bar — non-colour cue */}
      <div
        aria-hidden="true"
        style={{ height: 3, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: lp <= 2000 ? "var(--invalid)" : color,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}
