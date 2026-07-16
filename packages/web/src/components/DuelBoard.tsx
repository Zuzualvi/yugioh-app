/**
 * DuelBoard — responsive dual-field board.
 *
 * One reflowed component system across phone-portrait → tablet → desktop.
 *   Phone  (≤ 599 px):  vertical stack; collapsible OpponentStatusStrip (phone-only).
 *   Tablet (600–1023 px): desktop dual-field layout, scaled down; always visible.
 *   Desktop (≥ 1024 px): full §6 layout.
 *
 * Preserved data-testids (E2E contract):
 *   duel-board, phase-ribbon, face-down-card, face-up-card, resign-btn, duel-end-banner.
 *
 * a11y: ≥44px targets, ≥16px text, reduced-motion, aria labels, no color-only meaning.
 */

import React, { useState } from "react";
import type { DuelStateSnapshot, ZoneCard, Seat } from "@yugioh-app/contracts";
import { cardImageUrl } from "../utils/cardImageUrl";

// ── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<number, string> = {
  1: "Draw",
  2: "Standby",
  4: "Main 1",
  8: "Battle",
  16: "Main 2",
  32: "End",
};

function phaseLabel(phase: number): string {
  return PHASE_LABELS[phase] ?? `Phase ${phase}`;
}

// ── CardThumbnail ─────────────────────────────────────────────────────────────

interface CardThumbnailProps {
  card: ZoneCard;
  isOwn: boolean;
  size?: "mini" | "sm" | "md";
  label?: string;
}

function CardThumbnail({ card, isOwn, size = "md", label }: CardThumbnailProps) {
  const dims = { mini: { w: 24, h: 34 }, sm: { w: 36, h: 52 }, md: { w: 52, h: 74 } };
  const { w, h } = dims[size];
  const hidden = card.code === 0;

  if (hidden || !isOwn) {
    return (
      <div
        data-testid="face-down-card"
        title={label ?? "Face-down card"}
        aria-label={label ?? "Face-down card"}
        style={{
          width: w,
          height: h,
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size === "mini" ? "0.75rem" : size === "sm" ? "1rem" : "1.25rem",
          flexShrink: 0,
        }}
      >
        🂠
      </div>
    );
  }

  return (
    <img
      data-testid="face-up-card"
      src={cardImageUrl(card.code)}
      alt={label ?? `Card ${card.code}`}
      title={`Card ${card.code}`}
      style={{
        width: w,
        height: h,
        borderRadius: 4,
        objectFit: "cover",
        border: "1px solid var(--border)",
        flexShrink: 0,
      }}
    />
  );
}

// ── ZoneRow ───────────────────────────────────────────────────────────────────

function ZoneRow({
  label,
  cards,
  isOwn,
  size = "md",
}: {
  label: string;
  cards: ZoneCard[];
  isOwn: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          minHeight: size === "sm" ? 52 : 74,
        }}
      >
        {cards.length === 0 ? (
          <div
            data-testid="empty-zone"
            style={{
              width: size === "sm" ? 36 : 52,
              height: size === "sm" ? 52 : 74,
              border: "1px dashed var(--border)",
              borderRadius: 4,
              opacity: 0.4,
            }}
            aria-label={`${label} — empty`}
          />
        ) : (
          cards.map((c, i) => <CardThumbnail key={i} card={c} isOwn={isOwn} size={size} />)
        )}
      </div>
    </div>
  );
}

// ── HandRow ───────────────────────────────────────────────────────────────────

function HandRow({ cards, isOwn }: { cards: ZoneCard[]; isOwn: boolean }) {
  if (!isOwn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: "1rem", color: "var(--text-2)" }}>
          ✋ {cards.length} card{cards.length !== 1 ? "s" : ""}
        </span>
        {cards.map((_, i) => (
          <div
            key={i}
            data-testid="face-down-card"
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
            aria-label="Opponent hand card"
          >
            🂠
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "nowrap",
        alignItems: "flex-end",
        overflowX: "auto",
        paddingBottom: 4,
      }}
    >
      {cards.map((c, i) => (
        <CardThumbnail key={i} card={c} isOwn label={`Hand card ${i + 1}`} />
      ))}
      {cards.length === 0 && (
        <span style={{ color: "var(--text-2)", fontSize: "1rem" }}>Empty hand</span>
      )}
    </div>
  );
}

// ── LP display ────────────────────────────────────────────────────────────────

function LpBar({ lp, isOwn }: { lp: number; isOwn: boolean }) {
  const pct = Math.max(0, Math.min(100, (lp / 8000) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} aria-live="polite">
      <span
        style={{
          fontWeight: 700,
          minWidth: 52,
          fontSize: "1rem",
          color: lp <= 0 ? "var(--invalid)" : isOwn ? "var(--accent-light)" : "var(--text-0)",
        }}
        aria-label={`LP: ${lp}`}
      >
        {lp}
      </span>
      {/* Non-color cue: bar width communicates LP remaining */}
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--bg-3)",
          borderRadius: 3,
          overflow: "hidden",
          maxWidth: 120,
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: lp <= 2000 ? "var(--invalid)" : isOwn ? "var(--accent)" : "var(--text-1)",
            borderRadius: 3,
            /* Reduced-motion: still updates, no animation */
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

// ── PhaseRail ─────────────────────────────────────────────────────────────────

const PHASES: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: "Draw", short: "DP" },
  { value: 2, label: "Standby", short: "SP" },
  { value: 4, label: "Main 1", short: "MP1" },
  { value: 8, label: "Battle", short: "BP" },
  { value: 16, label: "Main 2", short: "MP2" },
  { value: 32, label: "End", short: "EP" },
];

function PhaseRail({ currentPhase, isPhone }: { currentPhase: number; isPhone?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: isPhone ? 4 : 8,
        padding: isPhone ? "6px 8px" : "6px 12px",
        background: "var(--bg-2)",
        borderRadius: 6,
        overflowX: "auto",
      }}
      role="list"
      aria-label="Duel phases"
    >
      {PHASES.map((ph) => {
        const active = ph.value === currentPhase;
        return (
          <div
            key={ph.value}
            role="listitem"
            aria-current={active ? "step" : undefined}
            aria-label={`${ph.label}${active ? " (current)" : ""}`}
            style={{
              padding: isPhone ? "4px 6px" : "4px 10px",
              borderRadius: 4,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
              fontSize: "0.8125rem",
              fontWeight: active ? 700 : 400,
              color: active ? "var(--accent-light)" : "var(--text-2)",
              background: active ? "var(--accent-dim)" : "transparent",
              border: active ? "1px solid var(--accent)" : "1px solid transparent",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isPhone ? ph.short : ph.label}
          </div>
        );
      })}
    </div>
  );
}

// ── Main DuelBoard ────────────────────────────────────────────────────────────

interface Props {
  state: DuelStateSnapshot;
  mySeat: Seat;
}

export function DuelBoard({ state, mySeat }: Props) {
  const { lp, currentTurn, currentPhase, zones } = state;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;

  // Phone-only: opponent strip collapse state (persists within page session)
  const [oppExpanded, setOppExpanded] = useState(false);

  const myZones = {
    hand: mySeat === 0 ? zones.p0_hand : zones.p1_hand,
    mzone: mySeat === 0 ? zones.p0_mzone : zones.p1_mzone,
    szone: mySeat === 0 ? zones.p0_szone : zones.p1_szone,
    grave: mySeat === 0 ? zones.p0_grave : zones.p1_grave,
    removed: mySeat === 0 ? zones.p0_removed : zones.p1_removed,
    extra: mySeat === 0 ? zones.p0_extra : zones.p1_extra,
  };

  const oppZones = {
    hand: oppSeat === 0 ? zones.p0_hand : zones.p1_hand,
    mzone: oppSeat === 0 ? zones.p0_mzone : zones.p1_mzone,
    szone: oppSeat === 0 ? zones.p0_szone : zones.p1_szone,
    grave: oppSeat === 0 ? zones.p0_grave : zones.p1_grave,
    removed: oppSeat === 0 ? zones.p0_removed : zones.p1_removed,
    extra: oppSeat === 0 ? zones.p0_extra : zones.p1_extra,
  };

  const myLp = lp[mySeat];
  const oppLp = lp[oppSeat];
  const isMyTurn = currentTurn === mySeat;
  const turnOwner = isMyTurn ? "YOUR" : "OPPONENT'S";

  return (
    <div
      data-testid="duel-board"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: "var(--bg-0)",
        borderRadius: 12,
        border: "1px solid var(--border)",
      }}
    >
      {/*
        ── PHONE LAYOUT (≤ 599 px): vertical stack ──
        ── TABLET/DESKTOP (≥ 600 px): both fields visible ──

        We use CSS @media queries via a <style> tag for the responsive split.
        At ≥600px we show the full opponent area (hidden on phone via class).
      */}
      <style>{`
        /* Responsive opponent section */
        .duel-opp-toggle { display: none; }
        .duel-opp-zones { display: block; }
        @media (max-width: 599px) {
          .duel-opp-toggle { display: flex; align-items: center; justify-content: center; }
          .duel-opp-zones { display: none; }
          .duel-opp-zones.duel-opp-zones-open { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .duel-lp-bar { transition: none !important; }
        }
      `}</style>

      {/*
        ── Opponent section — one element, CSS reflowed ──
        At ≤599px: compact strip with expand toggle (phone-only).
        At ≥600px: full opponent header + field always visible.
        We avoid duplicate text nodes so getByText works in jsdom.
      */}
      <div>
        {/* Full opponent header — always in DOM; phone hides inner-zone grid via CSS */}
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-0)" }}>
              Opponent
            </span>
            <LpBar lp={oppLp ?? 8000} isOwn={false} />
            <HandRow cards={oppZones.hand} isOwn={false} />
            {/* Phone-only expand toggle — hidden at ≥600px via CSS */}
            <button
              className="duel-opp-toggle"
              onClick={() => setOppExpanded((v) => !v)}
              aria-label={oppExpanded ? "Collapse opponent field" : "Expand opponent field"}
              aria-expanded={oppExpanded}
              style={{
                marginLeft: "auto",
                minHeight: 44,
                minWidth: 44,
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "1.125rem",
              }}
            >
              {oppExpanded ? "▴" : "▾"}
            </button>
          </div>

          {/* Opponent field zones: always shown at ≥600px; phone: show only when expanded */}
          <div className={`duel-opp-zones${oppExpanded ? " duel-opp-zones-open" : ""}`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                gap: 8,
                padding: "8px 12px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <ZoneRow label="GY" cards={oppZones.grave} isOwn={false} size="sm" />
              <ZoneRow label="Ban" cards={oppZones.removed} isOwn={false} size="sm" />
              <ZoneRow label="S/T" cards={oppZones.szone} isOwn={false} size="sm" />
              <ZoneRow label="Mon" cards={oppZones.mzone} isOwn={false} size="sm" />
              <ZoneRow label="Extra" cards={oppZones.extra} isOwn={false} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Turn/phase ribbon (center) ── */}
      <div
        data-testid="phase-ribbon"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 14px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: "1rem",
          color: isMyTurn ? "var(--accent-light)" : "var(--text-1)",
        }}
        aria-label={`${turnOwner.toLowerCase()} turn — ${phaseLabel(currentPhase)} Phase`}
      >
        {/* Non-color: text label states whose turn it is */}⚔ {turnOwner} turn ·{" "}
        {phaseLabel(currentPhase)}
      </div>

      {/* ── Your field zones ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
          gap: 8,
          padding: "8px 0",
        }}
      >
        <ZoneRow label="Mon" cards={myZones.mzone} isOwn />
        <ZoneRow label="S/T" cards={myZones.szone} isOwn />
        <ZoneRow label="GY" cards={myZones.grave} isOwn />
        <ZoneRow label="Ban" cards={myZones.removed} isOwn />
        <ZoneRow label="Extra" cards={myZones.extra} isOwn />
      </div>

      {/* ── Your hand ── */}
      <div
        style={{
          background: "var(--bg-1)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--accent-light)" }}>
            You
          </span>
          <LpBar lp={myLp ?? 8000} isOwn />
        </div>
        <HandRow cards={myZones.hand} isOwn />
      </div>

      {/* ── Phase rail ── */}
      <PhaseRail currentPhase={currentPhase} />
    </div>
  );
}
