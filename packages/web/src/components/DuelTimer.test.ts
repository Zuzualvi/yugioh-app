// @vitest-environment jsdom
/**
 * DuelTimer tests — countdown rendering and timeout end state.
 */
import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});

describe("DuelTimer", () => {
  it("shows countdown when deadlineAt is in the future", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    const deadline = Date.now() + 90_000; // 90 seconds

    render(
      React.createElement(DuelTimer, {
        onClockSeat: 0,
        deadlineAt: deadline,
        mySeat: 0,
      }),
    );

    const timer = screen.getByTestId("duel-timer");
    expect(timer.textContent).toContain("Your clock");
    // Should show seconds remaining
    expect(timer.textContent).toMatch(/\d+s|\d+m/);
  });

  it("shows opponent clock label when it is the opponent's turn", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    const deadline = Date.now() + 3600_000;

    render(
      React.createElement(DuelTimer, {
        onClockSeat: 1,
        deadlineAt: deadline,
        mySeat: 0,
      }),
    );

    const timer = screen.getByTestId("duel-timer");
    expect(timer.textContent).toContain("Opponent's clock");
  });

  it("shows 'Time up!' when deadline has passed", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    const deadline = Date.now() - 5000; // 5 seconds ago

    render(
      React.createElement(DuelTimer, {
        onClockSeat: 0,
        deadlineAt: deadline,
        mySeat: 0,
      }),
    );

    const timer = screen.getByTestId("duel-timer");
    expect(timer.textContent).toContain("Time up!");
  });

  it("counts down over time", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    const deadline = Date.now() + 5000;

    render(
      React.createElement(DuelTimer, {
        onClockSeat: 0,
        deadlineAt: deadline,
        mySeat: 0,
      }),
    );

    // Initial: ~5s left
    expect(screen.getByTestId("duel-timer").textContent).toContain("5s");

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should now show ~2s
    expect(screen.getByTestId("duel-timer").textContent).toContain("2s");
  });

  it("shows urgent styling when under 1 minute", async () => {
    const { DuelTimer } = await import("./DuelTimer");
    const deadline = Date.now() + 30_000; // 30 seconds — urgent

    const { container } = render(
      React.createElement(DuelTimer, {
        onClockSeat: 0,
        deadlineAt: deadline,
        mySeat: 0,
      }),
    );

    // Check the inline style attribute contains urgent border color
    const timer = container.querySelector("[data-testid='duel-timer']") as HTMLElement;
    const styleAttr = timer.getAttribute("style") ?? "";
    expect(styleAttr).toContain("var(--invalid)");
  });
});
