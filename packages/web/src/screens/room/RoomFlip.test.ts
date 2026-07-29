// @vitest-environment jsdom
/**
 * RoomFlip tests — S7 coin flip reveal.
 *
 * Verifies:
 *   - Timer-driven phase transitions (not animationend) so room cannot get stuck
 *   - Shows "Flipping a coin…" during flip phase, result after
 *   - Winner/loser copy is correct
 *   - onRevealComplete fires after TOTAL_DURATION from rolledAt
 *   - If rolledAt is old (>1.1s ago), starts immediately in result phase
 */
import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import { RoomFlip } from "./RoomFlip";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function makeSnap(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomId: "r1",
    status: "awaiting_choice",
    closedReason: null,
    closedByUserId: null,
    perMoveSeconds: 300,
    createdAt: 0,
    roomDeadlineAt: Date.now() + 120_000,
    serverNow: Date.now(),
    joinToken: null,
    you: {
      role: "creator",
      userId: "u1",
      displayName: "Alice",
      presence: "connected",
      deckSelected: true,
      ready: true,
      deckId: "d1",
      deckName: "Lightsworn",
      deckCardCount: 40,
      deckLocked: true,
    },
    opponent: {
      role: "opponent",
      userId: "u2",
      displayName: "Bob",
      presence: "connected",
      deckSelected: true,
      ready: true,
    },
    flip: {
      winnerUserId: "u1",
      winnerDisplayName: "Alice",
      rolledAt: Date.now(), // just now
      choice: null,
    },
    seats: null,
    ...overrides,
  };
}

describe("RoomFlip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows flipping state initially when flip just happened", () => {
    render(React.createElement(RoomFlip, { snapshot: makeSnap() }));
    expect(screen.getByRole("status").textContent).toMatch(/Flipping a coin/);
  });

  it("transitions to result phase after 1.1s via timer (not animationend)", () => {
    render(
      React.createElement(RoomFlip, {
        snapshot: makeSnap(),
      }),
    );
    expect(screen.getByRole("status").textContent).toMatch(/Flipping a coin/);

    act(() => vi.advanceTimersByTime(1100));

    expect(screen.getByRole("status").textContent).toMatch(/won the flip/);
  });

  it("shows winner copy when you win", () => {
    act(() => vi.advanceTimersByTime(1100));
    render(React.createElement(RoomFlip, { snapshot: makeSnap() }));

    // rolledAt=now so still in flip phase; advance
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByRole("status").textContent).toContain("You won the flip");
  });

  it("shows loser copy when opponent wins", () => {
    const snap = makeSnap({
      flip: {
        winnerUserId: "u2",
        winnerDisplayName: "Bob",
        rolledAt: Date.now(),
        choice: null,
      },
    });
    render(React.createElement(RoomFlip, { snapshot: snap }));

    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByRole("status").textContent).toContain("Bob won the flip");
  });

  it("starts in result phase if rolledAt is more than 1.1s ago", () => {
    const snap = makeSnap({
      flip: {
        winnerUserId: "u1",
        winnerDisplayName: "Alice",
        rolledAt: Date.now() - 2000, // 2s ago
        choice: null,
      },
    });
    render(React.createElement(RoomFlip, { snapshot: snap }));
    // Should be in result phase immediately
    expect(screen.getByRole("status").textContent).toMatch(/won the flip/);
  });

  it("calls onRevealComplete after total duration from rolledAt", () => {
    const onRevealComplete = vi.fn();
    const snap = makeSnap({
      flip: {
        winnerUserId: "u1",
        winnerDisplayName: "Alice",
        rolledAt: Date.now(),
        choice: null,
      },
    });
    render(React.createElement(RoomFlip, { snapshot: snap, onRevealComplete }));

    expect(onRevealComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1600));
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onRevealComplete immediately if rolledAt is past total duration", () => {
    const onRevealComplete = vi.fn();
    const snap = makeSnap({
      flip: {
        winnerUserId: "u1",
        winnerDisplayName: "Alice",
        rolledAt: Date.now() - 5000, // 5s ago — well past 1.6s
        choice: null,
      },
    });
    render(React.createElement(RoomFlip, { snapshot: snap, onRevealComplete }));
    // Synchronously or on next tick
    act(() => vi.advanceTimersByTime(0));
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });
});
