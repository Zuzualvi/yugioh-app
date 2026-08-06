import { cardName } from "../fixtures/cards";
import type { ChainLink, PendingIntent, Seat } from "../fixtures/types";
import { frameClass } from "./CardTile";

/** The persistent, ordered chain strip. Compresses past 4 links; never scrolls, never wraps. */
export function ChainStrip({ chain, mySeat }: { chain: ChainLink[]; mySeat: Seat }) {
  if (chain.length === 0) return null;
  const full = chain.slice(0, 4);
  const rest = chain.slice(4);
  return (
    <div className="chainstrip" data-testid="chain-strip">
      <span style={{ color: "var(--text-2)" }}>Chain</span>
      {full.map((l) => (
        <span
          key={l.ordinal}
          className={`link ${l.owner === mySeat ? "mine" : "theirs"}${l.state === "resolving" ? " resolving" : ""}`}
          title={l.state === "resolving" ? "Resolving now" : undefined}
        >
          <span className="ord">{l.ordinal}</span>
          <span
            className={`frame ${frameClass(l.code)}`}
            style={{ width: 3, height: 14, borderRadius: 1 }}
          />
          {cardName(l.code)}
          {l.state === "resolving" && " ▶"}
        </span>
      ))}
      {rest.map((l) => (
        <span
          key={l.ordinal}
          className={`link ${l.owner === mySeat ? "mine" : "theirs"}`}
          title={cardName(l.code)}
          style={{ padding: "3px 6px" }}
        >
          <span className="ord">{l.ordinal}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The Intent Ribbon — client-side memory, not a wire object.
 * It is what makes 2–6 engine decisions read as one action, and it is where the
 * point of no return is drawn.
 */
export function IntentRibbon({
  intent,
  onCancel,
}: {
  intent: PendingIntent;
  onCancel: () => void;
}) {
  const committed = intent.stepIndex >= intent.commitAt;
  return (
    <div className="ribbon" data-testid="intent-ribbon">
      <span className="lbl">» {intent.label}</span>
      <span className="steps">
        {intent.steps.map((s, i) => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <span className="bar" />}
            {i === intent.commitAt && <span className="lock">▲</span>}
            <span
              className={`dot${i < intent.stepIndex ? " done" : ""}${i === intent.stepIndex ? " cur" : ""}`}
            />
            <span style={{ color: i === intent.stepIndex ? "var(--text-0)" : undefined }}>{s}</span>
          </span>
        ))}
        {intent.trailingUnknown && (
          <>
            <span className="bar" />
            <span title="a trigger may or may not fire — the step count is not knowable in advance">
              …
            </span>
          </>
        )}
      </span>
      <span style={{ marginLeft: "auto" }} />
      {committed || !intent.cancelable ? (
        <span className="committed">▲ COMMITTED</span>
      ) : (
        <button
          className="btn decline"
          style={{ padding: "4px 12px", fontSize: 12 }}
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
