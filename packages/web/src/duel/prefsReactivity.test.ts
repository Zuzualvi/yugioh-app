// @vitest-environment jsdom
/**
 * prefsReactivity — C3 acceptance criteria for useDuelInteraction prefs.
 *
 * Criterion 3: rerenders the hook with chooseZones flipped false→true after
 *   mount and asserts the next SelectZone decision with zones.length>1 is NOT
 *   auto-answered. Confirmed to FAIL against buggy code, pass after fix.
 * Criterion 4: SelectZone with zones.length===1 is still auto-answered with
 *   the toggle ON (E1 must not regress).
 */
import React, { useState } from "react";
import { render, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDuelInteraction } from "./useDuelInteraction";
import type { DuelDecision, ZoneEntry } from "@yugioh-app/contracts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function zone(seq: number): ZoneEntry {
  return { controller: 0, location: "MZONE", sequence: seq };
}

function sz(n: number): DuelDecision {
  return {
    kind: "SelectZone",
    player: 0,
    zones: Array.from({ length: n }, (_, i) => zone(i)),
    count: 1,
  };
}

// A test harness component that uses the hook and reports its call count
function Harness({
  decision,
  chooseZones,
  respond,
}: {
  decision: DuelDecision;
  chooseZones: boolean;
  respond: ReturnType<typeof vi.fn>;
}) {
  useDuelInteraction({
    decision,
    mySeat: 0,
    duelEnded: false,
    respond,
    prefs: { chooseZones },
    events: [],
    promptLevel: "Standard",
  });
  return React.createElement("div", { "data-testid": "harness" });
}

describe("chooseZones reactivity (C3)", () => {
  it("CRITERION 3 — flipping chooseZones true after mount stops auto-answering new SelectZone", () => {
    vi.useFakeTimers();
    const respond = vi.fn();
    const d1 = sz(3);
    const d2 = sz(3);

    function Root() {
      const [state, setState] = useState({ decision: d1, chooseZones: false });
      // Expose setState on the component element for test control
      (Root as { setState?: typeof setState }).setState = setState;
      return React.createElement(Harness, {
        decision: state.decision,
        chooseZones: state.chooseZones,
        respond,
      });
    }

    act(() => {
      render(React.createElement(Root));
    });
    vi.runAllTimers();

    // Initial render: chooseZones=false + zones>1 → auto-answered
    expect(respond).toHaveBeenCalledTimes(1);
    respond.mockClear();

    // Flip chooseZones to true (decision unchanged)
    act(() => {
      (
        Root as { setState?: (s: { decision: DuelDecision; chooseZones: boolean }) => void }
      ).setState?.({
        decision: d1,
        chooseZones: true,
      });
    });
    vi.runAllTimers();
    expect(respond).not.toHaveBeenCalled();

    // New decision with chooseZones=true
    act(() => {
      (
        Root as { setState?: (s: { decision: DuelDecision; chooseZones: boolean }) => void }
      ).setState?.({
        decision: d2,
        chooseZones: true,
      });
    });
    vi.runAllTimers();

    // Bug: respond called (prefs.chooseZones is still false from mount)
    // Fix: respond not called (prefs.chooseZones is true from prop)
    expect(respond).not.toHaveBeenCalled();
  });

  it("CRITERION 4 — SelectZone zones.length===1 auto-answered even with chooseZones=true (E1)", () => {
    vi.useFakeTimers();
    const respond = vi.fn();

    act(() => {
      render(
        React.createElement(Harness, {
          decision: sz(1),
          chooseZones: true,
          respond,
        }),
      );
    });
    vi.runAllTimers();

    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith({ kind: "SelectZone", indices: [0] });
  });
});
