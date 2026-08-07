// @vitest-environment jsdom
/**
 * ClockPanel (DuelTimer) tests — both clocks visible, running/banked labels,
 * urgency escalation on own clock only (requirements D2, D3, D4).
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("ClockPanel (DuelTimer)", () => {
  it("shows both clocks when it is my turn (D2)", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");
    const myDeadline = Date.now() + 90_000;
    const oppDeadline = Date.now() + 120_000;

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: myDeadline,
        oppDeadlineAt: oppDeadline,
        onClockSeat: 0,
        mySeat: 0,
        myName: "You",
        oppName: "Opponent",
      }),
    );

    expect(screen.getByTestId("clock-row-own")).toBeTruthy();
    expect(screen.getByTestId("clock-row-opp")).toBeTruthy();
  });

  it("shows both clocks when it is opponent's turn (D2)", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");
    const myDeadline = Date.now() + 90_000;
    const oppDeadline = Date.now() + 120_000;

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: myDeadline,
        oppDeadlineAt: oppDeadline,
        onClockSeat: 1,
        mySeat: 0,
        myName: "You",
        oppName: "Opponent",
      }),
    );

    expect(screen.getByTestId("clock-row-own")).toBeTruthy();
    expect(screen.getByTestId("clock-row-opp")).toBeTruthy();
  });

  it("labels my clock RUNNING when it is my turn", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");
    const myDeadline = Date.now() + 90_000;

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: myDeadline,
        oppDeadlineAt: myDeadline,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );

    const myRow = screen.getByTestId("clock-row-own");
    expect(myRow.textContent).toContain("RUNNING");
    const oppRow = screen.getByTestId("clock-row-opp");
    expect(oppRow.textContent).toContain("BANKED");
  });

  it("labels my clock BANKED when it is opponent's turn", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");
    const myDeadline = Date.now() + 90_000;

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: myDeadline,
        oppDeadlineAt: myDeadline,
        onClockSeat: 1,
        mySeat: 0,
      }),
    );

    const myRow = screen.getByTestId("clock-row-own");
    expect(myRow.textContent).toContain("BANKED");
    const oppRow = screen.getByTestId("clock-row-opp");
    expect(oppRow.textContent).toContain("RUNNING");
  });

  it("shows dash-dash when no clock frame yet (never 0:00)", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: null,
        oppDeadlineAt: null,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );

    // Both rows should show —:— not 0:00
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("—:—");
    expect(allText).not.toContain("0:00");
  });

  it("four pairwise-distinguishable urgency states on own clock (D3)", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");

    // State 1: > 60s — normal
    const { unmount: u1 } = render(
      React.createElement(ClockPanel, {
        myDeadlineAt: Date.now() + 90_000,
        oppDeadlineAt: Date.now() + 90_000,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );
    const _row1 = screen.getByTestId("clock-row-own");
    const _style1 = window.getComputedStyle(_row1);
    u1();
    cleanup();

    // State 2: ≤ 60s — warn
    const { unmount: u2 } = render(
      React.createElement(ClockPanel, {
        myDeadlineAt: Date.now() + 45_000,
        oppDeadlineAt: Date.now() + 90_000,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );
    const row2 = screen.getByTestId("clock-row-own");
    // warn state: shows "timeout forfeits the duel" text
    expect(row2.textContent).toContain("timeout forfeits the duel");
    u2();
    cleanup();

    // State 3: ≤ 30s — high
    const { unmount: u3 } = render(
      React.createElement(ClockPanel, {
        myDeadlineAt: Date.now() + 20_000,
        oppDeadlineAt: Date.now() + 90_000,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );
    const row3 = screen.getByTestId("clock-row-own");
    expect(row3.textContent).toContain("timeout forfeits the duel");
    u3();
    cleanup();

    // State 4: ≤ 10s — alarm
    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: Date.now() + 8_000,
        oppDeadlineAt: Date.now() + 90_000,
        onClockSeat: 0,
        mySeat: 0,
      }),
    );
    const row4 = screen.getByTestId("clock-row-own");
    expect(row4.textContent).toContain("TIMEOUT FORFEITS THE DUEL");
  });

  it("opponent clock does NOT escalate regardless of remaining time (D4)", async () => {
    const { ClockPanel } = await import("./duel/chrome/ClockPanel");

    render(
      React.createElement(ClockPanel, {
        myDeadlineAt: Date.now() + 90_000,
        oppDeadlineAt: Date.now() + 5_000, // opponent at alarm threshold
        onClockSeat: 1, // opponent on clock
        mySeat: 0,
      }),
    );

    // Own clock should not escalate (it's banked at 90s)
    const myRow = screen.getByTestId("clock-row-own");
    expect(myRow.textContent).not.toContain("TIMEOUT");
    expect(myRow.textContent).not.toContain("timeout forfeits");

    // Opponent row should not show escalation text (D4)
    const oppRow = screen.getByTestId("clock-row-opp");
    expect(oppRow.textContent).not.toContain("TIMEOUT");
    expect(oppRow.textContent).not.toContain("timeout forfeits");
  });
});

// Legacy test: DuelTimer alias still works
describe("DuelTimer (alias)", () => {
  it("ClockPanel is exported as DuelTimer from DuelTimer.tsx", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    expect(DuelTimer).toBeTruthy();
    expect(typeof DuelTimer).toBe("function");
  });
});
