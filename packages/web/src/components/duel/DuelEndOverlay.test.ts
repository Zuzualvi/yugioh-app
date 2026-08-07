// @vitest-environment jsdom
/**
 * DuelEndOverlay tests (§13 / D5 D6).
 *
 * - Shows correct result for win/lose/draw.
 * - Shows correct reason text for normal/timeout/resign.
 * - Unknown reason renders verbatim.
 * - Review board dismisses to persistent pill.
 * - Open log calls onOpenLog.
 * - Back to Home calls onHome.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuelEndOverlay } from "./DuelEndOverlay";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function baseProps(override: Partial<Parameters<typeof DuelEndOverlay>[0]> = {}) {
  return {
    winner: 0 as const,
    reason: "normal" as const,
    mySeat: 0 as const,
    finalLp: [0, 8000] as [number, number],
    playerNames: ["You", "Sakura"] as [string, string],
    onHome: vi.fn(),
    onOpenLog: vi.fn(),
    ...override,
  };
}

describe("DuelEndOverlay", () => {
  it("shows 'You win' when I am the winner", () => {
    render(React.createElement(DuelEndOverlay, baseProps({ winner: 0, mySeat: 0 })));
    expect(screen.getByText("You win")).toBeTruthy();
  });

  it("shows 'You lose' when opponent wins", () => {
    render(React.createElement(DuelEndOverlay, baseProps({ winner: 1, mySeat: 0 })));
    expect(screen.getByText("You lose")).toBeTruthy();
  });

  it("shows 'Draw' on draw", () => {
    render(React.createElement(DuelEndOverlay, baseProps({ winner: null, mySeat: 0 })));
    expect(screen.getByText("Draw")).toBeTruthy();
  });

  it("shows timeout reason text", () => {
    render(
      React.createElement(DuelEndOverlay, baseProps({ winner: 1, mySeat: 0, reason: "timeout" })),
    );
    expect(screen.getByText(/move timer ran out/i)).toBeTruthy();
  });

  it("shows resign reason text", () => {
    render(
      React.createElement(DuelEndOverlay, baseProps({ winner: 1, mySeat: 0, reason: "resign" })),
    );
    expect(screen.getByText(/resigned/i)).toBeTruthy();
  });

  it("shows verbatim unknown reason", () => {
    render(
      React.createElement(
        DuelEndOverlay,
        baseProps({ winner: 0, mySeat: 0, reason: "someunknownreason" }),
      ),
    );
    expect(screen.getByText(/someunknownreason/)).toBeTruthy();
  });

  it("Review board dismisses to persistent pill", () => {
    render(React.createElement(DuelEndOverlay, baseProps()));
    fireEvent.click(screen.getByText("Review board"));
    expect(screen.getByText("Duel ended")).toBeTruthy();
    expect(screen.queryByTestId("duel-end-overlay")).toBeNull();
  });

  it("clicking Result on pill reopens the overlay", () => {
    render(React.createElement(DuelEndOverlay, baseProps()));
    fireEvent.click(screen.getByText("Review board"));
    expect(screen.getByText("Result")).toBeTruthy();
    fireEvent.click(screen.getByText("Result"));
    expect(screen.getByTestId("duel-end-overlay")).toBeTruthy();
  });

  it("Open log calls onOpenLog", () => {
    const onOpenLog = vi.fn();
    render(React.createElement(DuelEndOverlay, baseProps({ onOpenLog })));
    fireEvent.click(screen.getByText("Open log"));
    expect(onOpenLog).toHaveBeenCalled();
  });

  it("Back to Home calls onHome", () => {
    const onHome = vi.fn();
    render(React.createElement(DuelEndOverlay, baseProps({ onHome })));
    fireEvent.click(screen.getByText("Back to Home"));
    expect(onHome).toHaveBeenCalled();
  });
});
