// @vitest-environment jsdom
/**
 * RoomChoice tests — S7 → S8 / S9 transition.
 *
 * Verifies:
 *   - Shows flip reveal first (delegates to RoomFlip)
 *   - Transitions to choice phase (S8) for winner after 1.1s
 *   - Shows waiting screen (S9) for loser after 1.1s
 *   - Winner choice buttons trigger API call
 *   - Room cannot get stuck (timer-driven, not animationend)
 */
import React from "react";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
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
      rolledAt: Date.now(),
      choice: null,
    },
    seats: null,
    ...overrides,
  };
}

describe("RoomChoice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock the API call
    vi.doMock("../../api/room", () => ({
      submitChoice: vi.fn().mockResolvedValue({}),
      getSeatCredential: vi.fn(),
    }));
  });

  it("shows flip reveal phase initially (delegates to RoomFlip)", async () => {
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: makeSnap() }));
    // During flip phase, shows "Flipping a coin" from RoomFlip
    expect(screen.getByRole("status").textContent).toMatch(/Flipping a coin/);
  });

  it("shows S8 choice buttons for winner after flip reveal (AC10)", async () => {
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: makeSnap() }));

    // Advance past flip phase
    act(() => vi.advanceTimersByTime(1100));

    expect(screen.getByText(/Go first/i)).toBeTruthy();
    expect(screen.getByText(/Go second/i)).toBeTruthy();
  });

  it("shows S9 waiting screen for loser after flip reveal (AC10)", async () => {
    const snap = makeSnap({
      flip: {
        winnerUserId: "u2",
        winnerDisplayName: "Bob",
        rolledAt: Date.now(),
        choice: null,
      },
    });
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: snap }));

    act(() => vi.advanceTimersByTime(1100));

    expect(screen.getByRole("status").textContent).toMatch(/Bob is choosing/);
  });

  it("skips flip reveal and goes straight to S8 if rolledAt is old", async () => {
    const snap = makeSnap({
      flip: {
        winnerUserId: "u1",
        winnerDisplayName: "Alice",
        rolledAt: Date.now() - 5000, // well past 1.1s
        choice: null,
      },
    });
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: snap }));

    // Should be in choice phase immediately
    expect(screen.getByText(/Go first/i)).toBeTruthy();
  });

  it("room cannot get stuck — phase transitions are timer-driven, not animationend (AC10)", async () => {
    // This test verifies that even with animation zeroed by prefers-reduced-motion,
    // the phase timer still fires and the choice phase is reachable.
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: makeSnap() }));

    // No animationend fired — just advance the timer
    act(() => vi.advanceTimersByTime(1100));

    // Choice screen is reachable
    expect(screen.getByText(/Go first/i)).toBeTruthy();
  });

  it("submits choice when winner taps Go first", async () => {
    vi.useRealTimers(); // Use real timers for this test
    const { submitChoice } = await import("../../api/room");
    const mockSubmit = vi.mocked(submitChoice);

    const snap = makeSnap({
      flip: {
        winnerUserId: "u1",
        winnerDisplayName: "Alice",
        rolledAt: Date.now() - 5000, // skip flip phase
        choice: null,
      },
    });
    const { RoomChoice } = await import("./RoomChoice");
    render(React.createElement(RoomChoice, { snapshot: snap }));

    const firstBtn = screen.getByText(/Go first/i).closest("button")!;
    fireEvent.click(firstBtn);

    expect(mockSubmit).toHaveBeenCalledWith("r1", { choice: "first" });
  });
});
