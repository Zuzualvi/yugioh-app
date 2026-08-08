/**
 * ProvenanceBadge (§10b) — one-clause statement that our rendered text differs
 * from the post-errata image the player is looking at.
 *
 * Copy is normative and fixed: "Edison text differs from this printing"
 * One clause. No year, no explanation, no description of the difference.
 *
 * Placement: directly below the card image, above the card name.
 * Gated on art being "ok" — with no printing on screen there is nothing to
 * differ from, so the badge must not appear.
 *
 * Takes no props. The caller decides whether to render it based on:
 *   - CardInfo.preErrataText === true
 *   - artState === "ok"
 */

import React from "react";

export function ProvenanceBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 0",
        borderTop: "1px solid #c8902a",
        borderBottom: "1px solid #c8902a",
        marginBottom: 8,
      }}
      aria-label="Edison text differs from this printing"
    >
      <span
        style={{
          fontSize: "0.75rem",
          color: "#c8902a",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        Edison text differs from this printing
      </span>
    </div>
  );
}
