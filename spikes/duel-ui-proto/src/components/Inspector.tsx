import { useEffect, useState } from "react";
import { card } from "../fixtures/cards";
import { hasPreErrataText } from "../fixtures/preErrata";
import { CardArt } from "./CardArt";
import type { ArtState } from "./CardArt";
import { frameClass } from "./CardTile";

interface Props {
  code: number | null;
  pushed: boolean;
  pinned: boolean;
  onClose: () => void;
}

/**
 * Provenance badge.
 *
 * The card image is the MODERN printing; our rendered text is the 2010 text the engine
 * actually enforces. On the 36 cards in the pre-errata override corpus those two things
 * disagree, and the player is looking at both at once.
 *
 * COPY DISCIPLINE — this states a fact about our data and stops. It does not say what
 * differs, why Edison differs, what the card does, or what to do about it. The correct
 * text is the next thing on the page, so the badge does not have to carry any of it.
 * One clause. A second clause would be an explanation, and explanations are out.
 */
function ProvenanceBadge() {
  return (
    <div className="provenance" data-testid="provenance-badge">
      Edison text differs from this printing
    </div>
  );
}

export function Inspector({ code, pushed, pinned, onClose }: Props) {
  // Whether a printing is actually on screen. The badge contrasts our text with "this
  // printing"; with no printing rendered there is nothing to contrast, so no badge.
  const [artState, setArtState] = useState<ArtState>("loading");
  useEffect(() => setArtState("loading"), [code]);

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

  const showBadge = artState === "ok" && hasPreErrataText(code);

  return (
    <div className={`inspector${pinned ? " pinned" : ""}`} data-testid="inspector">
      {pushed && <span className="pushtag">AUTO-PUSHED</span>}
      {/* Recognition first. If the image never arrives CardArt renders nothing, and the
          panel is exactly what it was before art existed. */}
      <CardArt code={code} width={228} className="inspector-art" eager onState={setArtState} />
      {showBadge && <ProvenanceBadge />}
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
