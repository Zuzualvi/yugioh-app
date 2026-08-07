// @vitest-environment jsdom
/**
 * EventLogRail tests (§10 / §8 acceptance criteria).
 *
 * - Deduplication on seq.
 * - LP_CHANGE row names the seat whose LP moved ("Sakura −1200 LP").
 * - No sentence with a verb conjugated against a player name.
 * - "The duel has not started." when empty turn 1.
 * - "Earlier turns are not available." when empty turn > 1.
 * - "No {filter} events" after filter excludes all.
 * - Collapsed spine renders (not full rail).
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventLogRail } from "./EventLogRail";
import type { DuelEvent } from "@yugioh-app/contracts";
import type { CardLookup } from "../../../duel/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MOCK_LOOKUP: CardLookup = {
  get: () => null,
  isLoading: () => false,
};

function lpChangeEvent(seq: number, seat: 0 | 1, delta: number): DuelEvent {
  return {
    kind: "LP_CHANGE",
    seq,
    turnNumber: 1,
    phase: 4,
    seat,
    delta,
    reason: "damage",
  };
}

function turnEvent(seq: number, turnNumber: number, turnPlayer: 0 | 1): DuelEvent {
  return {
    kind: "TURN",
    seq,
    turnNumber,
    phase: 1,
    turnPlayer,
    lpSnapshot: [8000, 8000],
  };
}

function baseProps(override: Partial<Parameters<typeof EventLogRail>[0]> = {}) {
  return {
    events: [] as DuelEvent[],
    open: true,
    onOpenChange: vi.fn(),
    mySeat: 0 as const,
    playerNames: ["You", "Sakura"] as [string, string],
    lookup: MOCK_LOOKUP,
    ...override,
  };
}

describe("EventLogRail", () => {
  it("shows 'The duel has not started.' when empty on turn 1", () => {
    render(React.createElement(EventLogRail, baseProps({ events: [] })));
    expect(screen.getByText("The duel has not started.")).toBeTruthy();
  });

  it("does not show 'Earlier turns are not available.' when truly empty (no events)", () => {
    render(React.createElement(EventLogRail, baseProps({ events: [] })));
    expect(screen.queryByText("Earlier turns are not available.")).toBeNull();
  });

  it("deduplicates events on seq", () => {
    const e1 = lpChangeEvent(5, 1, -1200);
    const e2 = lpChangeEvent(5, 1, -1200); // duplicate seq
    render(React.createElement(EventLogRail, baseProps({ events: [e1, e2] })));
    // Only one LP row should be rendered.
    const minusTexts = screen.getAllByText(/−1200/);
    expect(minusTexts).toHaveLength(1);
  });

  it("LP_CHANGE row names the seat whose LP moved", () => {
    const events: DuelEvent[] = [lpChangeEvent(1, 1, -1200)];
    render(React.createElement(EventLogRail, baseProps({ events })));
    // "Sakura" (seat 1) should appear, and "−1200 LP"
    expect(screen.getByText("Sakura")).toBeTruthy();
    expect(screen.getByText(/−1200 LP/)).toBeTruthy();
  });

  it("collapsed spine renders a toggle button", () => {
    render(React.createElement(EventLogRail, baseProps({ open: false })));
    const btn = screen.getByRole("button", { name: /open event log/i });
    expect(btn).toBeTruthy();
  });

  it("toggles open on button click", () => {
    const onOpenChange = vi.fn();
    render(React.createElement(EventLogRail, baseProps({ open: false, onOpenChange })));
    const btn = screen.getByRole("button", { name: /open event log/i });
    fireEvent.click(btn);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("close button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(React.createElement(EventLogRail, baseProps({ open: true, onOpenChange })));
    const closeBtn = screen.getByRole("button", { name: /close event log/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows filter buttons", () => {
    render(React.createElement(EventLogRail, baseProps()));
    expect(screen.getByText("Summons")).toBeTruthy();
    expect(screen.getByText("Battle")).toBeTruthy();
    expect(screen.getByText("Movement")).toBeTruthy();
  });

  it("shows empty-after-filter message when filter excludes all", () => {
    const events: DuelEvent[] = [turnEvent(0, 1, 0)];
    render(React.createElement(EventLogRail, baseProps({ events })));
    // Click "Activations" filter — TURN events don't match activations.
    fireEvent.click(screen.getByText("Activations"));
    expect(screen.getByText(/No.*events this duel/)).toBeTruthy();
  });

  it("LP_CHANGE row does not contain a sentence with verb conjugated to player name", () => {
    const events: DuelEvent[] = [lpChangeEvent(1, 1, -1200)];
    render(React.createElement(EventLogRail, baseProps({ events })));
    const container = document.body;
    const text = container.textContent ?? "";
    // Must not contain "Sakura took" or "Sakura lost" (conjugated verb sentences).
    expect(text).not.toMatch(/Sakura took/i);
    expect(text).not.toMatch(/Sakura lost/i);
    expect(text).not.toMatch(/Sakura received/i);
  });
});
