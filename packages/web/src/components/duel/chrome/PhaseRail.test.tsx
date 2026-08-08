// @vitest-environment jsdom
/**
 * PhaseRail unit tests — C1(a) acceptance criteria.
 *
 * 1. Phase cells found by getByRole("button") — native button role, no listitem override.
 * 2. Wrapper has role="group" and aria-label="Duel phases"; no role="list".
 * 3. Exact aria-label forms: active "(current)", legal "— advance here", illegal plain.
 * 4. Clicking a legal cell calls onAdvancePhase; clicking illegal/disabled cell does not.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhaseRail, PHASE_M1, PHASE_BP, PHASE_EP } from "./PhaseRail";

afterEach(cleanup);

function makeProps(overrides: Partial<Parameters<typeof PhaseRail>[0]> = {}) {
  return {
    currentPhase: PHASE_M1,
    currentTurn: 0 as const,
    mySeat: 0 as const,
    legalNextPhases: [PHASE_BP, PHASE_EP],
    onAdvancePhase: vi.fn(),
    myDeadlineAt: null,
    oppDeadlineAt: null,
    onClockSeat: null,
    ...overrides,
  };
}

describe("PhaseRail — ARIA roles", () => {
  it("wrapper has role=group and aria-label='Duel phases'", () => {
    render(React.createElement(PhaseRail, makeProps()));
    const group = screen.getByRole("group", { name: "Duel phases" });
    expect(group).toBeTruthy();
  });

  it("finds zero elements with role=listitem in the rail", () => {
    render(React.createElement(PhaseRail, makeProps()));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("Battle Phase cell found by getByRole('button') when Battle Phase is legal", () => {
    render(React.createElement(PhaseRail, makeProps()));
    const btn = screen.getByRole("button", { name: /Battle Phase.*advance/i });
    expect(btn).toBeTruthy();
  });
});

describe("PhaseRail — aria-label contracts (verbatim)", () => {
  it("active cell: 'Main Phase 1 (current)'", () => {
    render(React.createElement(PhaseRail, makeProps()));
    // Main Phase 1 is active (currentPhase = PHASE_M1)
    const btn = screen.getByRole("button", { name: "Main Phase 1 (current)" });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-current")).toBe("step");
  });

  it("legal non-active cell: 'Battle Phase — advance here' (em dash)", () => {
    render(React.createElement(PhaseRail, makeProps()));
    // Battle Phase is legal and non-active
    const btn = screen.getByRole("button", { name: "Battle Phase — advance here" });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("illegal non-active cell: plain 'Draw Phase' and element is disabled", () => {
    render(React.createElement(PhaseRail, makeProps()));
    // Draw Phase is not in legalNextPhases and is not current
    const btn = screen.getByRole("button", { name: "Draw Phase" });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("PhaseRail — click behaviour", () => {
  it("clicking a legal phase cell calls onAdvancePhase with the phase's numeric value", () => {
    const onAdvancePhase = vi.fn();
    render(React.createElement(PhaseRail, makeProps({ onAdvancePhase })));
    const btn = screen.getByRole("button", { name: "Battle Phase — advance here" });
    fireEvent.click(btn);
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
    expect(onAdvancePhase).toHaveBeenCalledWith(PHASE_BP);
  });

  it("clicking an illegal (disabled) phase cell does not call onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    render(React.createElement(PhaseRail, makeProps({ onAdvancePhase })));
    const btn = screen.getByRole("button", { name: "Draw Phase" });
    // disabled buttons do not fire click events
    fireEvent.click(btn);
    expect(onAdvancePhase).not.toHaveBeenCalled();
  });
});
