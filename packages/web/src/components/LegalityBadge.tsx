import type { Banlist } from "../types/contracts";

interface Props {
  banlist: Banlist;
  size?: "sm" | "md";
}

const BADGE_CONFIG: Record<
  Banlist,
  { className: string; icon: string; label: string; ariaLabel: string }
> = {
  forbidden: {
    className: "badge badge-forbidden",
    icon: "🚫",
    label: "Forbidden",
    ariaLabel: "Forbidden — 0 copies allowed",
  },
  limited: {
    className: "badge badge-limited",
    icon: "①",
    label: "Limited",
    ariaLabel: "Limited — max 1 copy",
  },
  semi: {
    className: "badge badge-semi",
    icon: "②",
    label: "Semi-Limited",
    ariaLabel: "Semi-Limited — max 2 copies",
  },
  unlimited: {
    className: "badge badge-unlimited",
    icon: "✓",
    label: "3",
    ariaLabel: "Unrestricted — max 3 copies",
  },
};

/** Legality badge pairing colour + icon + label (never colour alone — REQ-UX-06). */
export function LegalityBadge({ banlist, size = "sm" }: Props) {
  const cfg = BADGE_CONFIG[banlist];
  return (
    <span
      className={cfg.className}
      aria-label={cfg.ariaLabel}
      title={cfg.ariaLabel}
      style={size === "md" ? { fontSize: "0.875rem", padding: "3px 8px" } : undefined}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function maxCopies(banlist: Banlist): number {
  if (banlist === "forbidden") return 0;
  if (banlist === "limited") return 1;
  if (banlist === "semi") return 2;
  return 3;
}
