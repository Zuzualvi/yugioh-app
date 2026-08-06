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
          {l.state === "resolving" && " — resolving"}
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
 *
 * Usability-pass changes:
 *   M1  the lock is captioned in words, not left as an undefined glyph
 *   M13 "step count may grow" is inline text, not a hover title on an ellipsis
 *   m1  the ribbon control says WHAT it cancels, so it cannot be confused with the
 *       bar's step-level Cancel
 */
export function IntentRibbon({
  intent,
  onCancel,
  cancelWhat,
}: {
  intent: PendingIntent;
  onCancel: () => void;
  cancelWhat: string;
}) {
  const committed = intent.stepIndex >= intent.commitAt;
  const remaining = Math.max(0, intent.steps.length - intent.stepIndex - 1);
  const hasLock = intent.commitAt < intent.steps.length;
  return (
    <div className="ribbon" data-testid="intent-ribbon">
      <div className="rb-main">
        <span className="lbl">{intent.label}</span>
        <span className="steps">
          {intent.steps.map((s, i) => (
            <span key={s} className="stepwrap">
              {i > 0 && <span className="bar" />}
              {i === intent.commitAt && (
                <span className="lock" title="past here you cannot cancel" />
              )}
              <span
                className={`dot${i < intent.stepIndex ? " done" : ""}${i === intent.stepIndex ? " cur" : ""}`}
              />
              <span style={{ color: i === intent.stepIndex ? "var(--text-0)" : undefined }}>
                {s}
              </span>
            </span>
          ))}
        </span>
        <span style={{ marginLeft: "auto" }} />
        {committed || !intent.cancelable ? (
          <span className="committed" data-testid="committed">
            COMMITTED — no going back
          </span>
        ) : (
          <button className="btn decline sm" onClick={onCancel} data-testid="cancel-intent">
            Cancel {cancelWhat}
          </button>
        )}
      </div>
      <div className="rb-key">
        {hasLock && (
          <span>
            <span className="lock inline" /> past this point you cannot cancel
          </span>
        )}
        <span>
          {intent.steps.length} step{intent.steps.length === 1 ? "" : "s"}
          {remaining > 0 ? ` · ${remaining} left` : ""}
          {intent.trailingUnknown ? " · possibly more, if a trigger fires" : ""}
        </span>
      </div>
    </div>
  );
}
