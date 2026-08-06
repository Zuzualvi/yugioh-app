import type { CSSProperties } from "react";
import { card } from "../fixtures/cards";
import type { Seat, ZoneCard } from "../fixtures/types";
import { POS_FACEDOWN_ATK, POS_FACEDOWN_DEF, POS_FACEUP_DEF } from "../fixtures/board";

export function frameClass(code: number): string {
  const c = card(code);
  if (!c) return "frame-none";
  return `frame-${c.frame === "fusion" || c.frame === "ritual" ? "effect" : c.frame}`;
}

interface Props {
  zc: ZoneCard;
  /** whose card it is — drives the ownership colour law */
  owner: Seat;
  mySeat: Seat;
  target?: boolean;
  selected?: boolean;
  actionable?: boolean;
  spent?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onHover?: (code: number | null) => void;
  style?: CSSProperties;
  className?: string;
}

export function CardTile({
  zc,
  owner,
  mySeat,
  target,
  selected,
  actionable,
  spent,
  onClick,
  onHover,
  style,
  className = "",
}: Props) {
  const mine = owner === mySeat;
  const faceDown = zc.position === POS_FACEDOWN_ATK || zc.position === POS_FACEDOWN_DEF;
  const defence = zc.position === POS_FACEUP_DEF || zc.position === POS_FACEDOWN_DEF;
  const c = card(zc.code);

  // "Show your own set cards translucent to you" — face-down and yours = readable.
  // Face-down and theirs = a back, because we genuinely do not know.
  const revealToMe = !faceDown || (mine && zc.code !== 0);
  const cls = [
    "card",
    className,
    revealToMe ? "" : "back",
    faceDown && mine && zc.code !== 0 ? "translucent" : "",
    defence ? "def" : "",
    zc.ghost ? "ghost" : "",
    target ? (mine ? "target-mine" : "target-theirs") : "",
    selected ? "selected" : "",
    actionable ? "actionable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!revealToMe) {
    return (
      <div
        className={cls}
        style={style}
        onClick={onClick}
        onMouseEnter={() => onHover?.(0)}
        onMouseLeave={() => onHover?.(null)}
        title="Face-down card"
      />
    );
  }

  return (
    <div
      className={cls}
      style={style}
      onClick={onClick}
      onMouseEnter={() => onHover?.(zc.code)}
      onMouseLeave={() => onHover?.(null)}
      title={c?.name ?? `Card ${zc.code}`}
    >
      <div className={`frame ${frameClass(zc.code)}`} />
      <div className="nm">{c?.name ?? `#${zc.code}`}</div>
      <div className="st">
        {c?.atk != null ? (
          <>
            <span>{c.atk}</span>
            <span>{c.def}</span>
          </>
        ) : (
          <span>{c?.race ?? ""}</span>
        )}
      </div>
      {spent !== undefined && <span className={`corner${spent ? " spent" : ""}`}>x</span>}
      {faceDown && mine && (
        <span className="corner" style={{ top: "auto", bottom: 2, right: 3, fontSize: 8 }}>
          SET
        </span>
      )}
    </div>
  );
}
