/**
 * DimScrim — implements Law 2: when the Question Bar is up, everything dims
 * to 45% EXCEPT candidates, the bar, the chain strip and the clock.
 *
 * Implementation: a fixed overlay at z-index 2. Candidate cards get
 * `position: relative; z-index: 3` to lift out of the scrim.
 * Do NOT use container opacity — a candidate inside a dimmed container
 * cannot be lifted back out. (Design spec §6 implementation note.)
 */
import React from "react";

interface Props {
  active: boolean;
}

export function DimScrim({ active }: Props) {
  if (!active) return null;

  return (
    <div
      data-testid="dim-scrim"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
}
