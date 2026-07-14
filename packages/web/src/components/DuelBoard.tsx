/**
 * DuelBoard — renders the DuelStateSnapshot: both players' LP, turn/phase,
 * and all twelve zones.  Hidden cards (code: 0) render as face-down backs.
 */

import type { DuelStateSnapshot, ZoneCard, Seat } from "@yugioh-app/contracts";
import { cardImageUrl } from "../utils/cardImageUrl";

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

interface ZoneCardViewProps {
  card: ZoneCard;
  /** true if this card belongs to us and can be revealed */
  isOwn: boolean;
  label?: string;
  size?: "sm" | "md";
}

function ZoneCardView({ card, isOwn, label, size = "md" }: ZoneCardViewProps) {
  const hidden = card.code === 0;
  const w = size === "sm" ? 36 : 52;
  const h = size === "sm" ? 52 : 74;

  if (hidden || (!isOwn && card.code === 0)) {
    return (
      <div
        data-testid="face-down-card"
        title={label ?? "Face-down card"}
        style={{
          width: w,
          height: h,
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size === "sm" ? "1.25rem" : "1.5rem",
          flexShrink: 0,
        }}
        aria-label="Face-down card"
      >
        🂠
      </div>
    );
  }

  return (
    <img
      data-testid="face-up-card"
      src={cardImageUrl(card.code)}
      alt={`Card ${card.code}`}
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
          cards.map((c, i) => (
            <ZoneCardView key={i} card={c} isOwn={isOwn} size={size} />
          ))
        )}
      </div>
    </div>
  );
}

function HandRow({ cards, isOwn }: { cards: ZoneCard[]; isOwn: boolean }) {
  if (!isOwn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
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
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
      {cards.map((c, i) => (
        <ZoneCardView key={i} card={c} isOwn label={`Hand card ${i + 1}`} />
      ))}
      {cards.length === 0 && (
        <span style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>Empty hand</span>
      )}
    </div>
  );
}

function LpBar({ lp, isOwn }: { lp: number; isOwn: boolean }) {
  const pct = Math.max(0, Math.min(100, (lp / 8000) * 100));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontWeight: 700, minWidth: 48, color: lp <= 0 ? "var(--invalid)" : isOwn ? "var(--accent-light)" : "var(--text-0)" }}>
        {lp}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--bg-3)",
          borderRadius: 3,
          overflow: "hidden",
          maxWidth: 120,
        }}
        aria-label={`LP: ${lp}`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: lp <= 2000 ? "var(--invalid)" : isOwn ? "var(--accent)" : "var(--text-1)",
            borderRadius: 3,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

interface Props {
  state: DuelStateSnapshot;
  mySeat: Seat;
}

export function DuelBoard({ state, mySeat }: Props) {
  const { lp, currentTurn, currentPhase, zones } = state;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;

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
  const turnOwner = currentTurn === mySeat ? "Your" : "Opponent's";

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
      {/* Opponent info */}
      <div
        style={{
          background: "var(--bg-1)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-0)" }}>Opponent</span>
        <LpBar lp={oppLp} isOwn={false} />
        <HandRow cards={oppZones.hand} isOwn={false} />
      </div>

      {/* Opponent field */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
          gap: 8,
          padding: "8px 0",
        }}
      >
        <ZoneRow label="GY" cards={oppZones.grave} isOwn={false} size="sm" />
        <ZoneRow label="Ban" cards={oppZones.removed} isOwn={false} size="sm" />
        <ZoneRow label="S/T" cards={oppZones.szone} isOwn={false} size="sm" />
        <ZoneRow label="Mon" cards={oppZones.mzone} isOwn={false} size="sm" />
        <ZoneRow label="Extra" cards={oppZones.extra} isOwn={false} size="sm" />
      </div>

      {/* Turn/phase ribbon */}
      <div
        data-testid="phase-ribbon"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 14px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: "0.875rem",
          color: "var(--accent-light)",
        }}
      >
        ⚔ {turnOwner} turn · {phaseLabel(currentPhase)}
      </div>

      {/* My field */}
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

      {/* My hand */}
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
          <span style={{ fontWeight: 600, color: "var(--accent-light)" }}>You</span>
          <LpBar lp={myLp} isOwn />
        </div>
        <HandRow cards={myZones.hand} isOwn />
      </div>
    </div>
  );
}
