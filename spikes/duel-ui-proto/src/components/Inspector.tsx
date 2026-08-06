import { card } from "../fixtures/cards";
import { CardArt } from "./CardArt";
import { frameClass } from "./CardTile";

interface Props {
  code: number | null;
  pushed: boolean;
  pinned: boolean;
  onClose: () => void;
}

export function Inspector({ code, pushed, pinned, onClose }: Props) {
  // Empty state = the panel is ABSENT, not an empty frame.
  if (code === null) return null;

  if (code === 0) {
    return (
      <div className={`inspector${pinned ? " pinned" : ""}`}>
        <h3>Face-down card</h3>
        <div className="meta">Identity unknown — no fabricated text.</div>
        <button className="chip" onClick={onClose}>
          Esc
        </button>
      </div>
    );
  }

  const c = card(code);
  if (!c) {
    return (
      <div className={`inspector${pinned ? " pinned" : ""}`}>
        <h3>Unknown card ({code})</h3>
        <div className="meta">Not in the card database.</div>
        <button className="chip" onClick={onClose}>
          Esc
        </button>
      </div>
    );
  }

  return (
    <div className={`inspector${pinned ? " pinned" : ""}`} data-testid="inspector">
      {pushed && <span className="pushtag">AUTO-PUSHED</span>}
      {/* Recognition first. If the image never arrives CardArt renders nothing, and the
          panel is exactly what it was before art existed. */}
      <CardArt code={code} width={228} className="inspector-art" eager />
      <div
        className={`frame ${frameClass(code)}`}
        style={{ height: 4, marginBottom: 8, borderRadius: 2 }}
      />
      <h3>{c.name}</h3>
      <div className="meta">
        {[c.attribute, c.race, c.level ? `★${c.level}` : null, c.frame.toUpperCase()]
          .filter(Boolean)
          .join(" · ")}
        {c.atk != null && ` · ATK ${c.atk} / DEF ${c.def}`}
      </div>
      <div className="desc">{c.desc}</div>
      <button className="chip" style={{ marginTop: 10 }} onClick={onClose}>
        Esc
      </button>
    </div>
  );
}
