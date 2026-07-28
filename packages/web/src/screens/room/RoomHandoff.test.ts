// @vitest-environment jsdom
/**
 * RoomHandoff tests — S10 countdown before board.
 *
 * Verifies:
 *   - Shows who goes first
 *   - Shows 3-2-1 countdown (timer-driven, not animationend) (AC10)
 *   - Navigates to /duel/:id after 3 ticks
 *   - Room cannot get stuck
 */
import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { RoomSnapshot } from "@yugioh-app/contracts";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mockNavigate.mockClear();
});

function makeSnap(youUserId = "u1"): RoomSnapshot {
  return {
    roomId: "r1",
    status: "starting",
    closedReason: null,
    closedByUserId: null,
    perMoveSeconds: 300,
    createdAt: 0,
    roomDeadlineAt: null,
    serverNow: Date.now(),
    joinToken: null,
    you: {
      role: "creator",
      userId: youUserId,
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
    flip: { winnerUserId: "u1", winnerDisplayName: "Alice", rolledAt: 0, choice: "first" },
    seats: { seat0UserId: "u1", seat1UserId: "u2" }, // u1 goes first
  };
}

describe("RoomHandoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows 'You go first' when you are seat 0", async () => {
    const { RoomHandoff } = await import("./RoomHandoff");
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RoomHandoff, { snapshot: makeSnap("u1") }),
      ),
    );
    expect(screen.getByRole("status").textContent).toContain("You go first");
  });

  it("shows opponent-goes-first copy when opponent is seat 0", async () => {
    const { RoomHandoff } = await import("./RoomHandoff");
    // u2 is seat0, you are u1 (seat1)
    const snap = makeSnap("u1");
    snap.seats = { seat0UserId: "u2", seat1UserId: "u1" };
    render(
      React.createElement(MemoryRouter, null, React.createElement(RoomHandoff, { snapshot: snap })),
    );
    expect(screen.getByRole("status").textContent).toContain("goes first");
  });

  it("shows countdown starting at 3 (AC8)", async () => {
    const { RoomHandoff } = await import("./RoomHandoff");
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RoomHandoff, { snapshot: makeSnap() }),
      ),
    );
    expect(screen.getByLabelText(/Starting in 3/i)).toBeTruthy();
  });

  it("ticks 3→2→1 via timers, not animationend (AC8, AC10)", async () => {
    const { RoomHandoff } = await import("./RoomHandoff");
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RoomHandoff, { snapshot: makeSnap() }),
      ),
    );

    expect(screen.getByLabelText(/Starting in 3/i)).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText(/Starting in 2/i)).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText(/Starting in 1/i)).toBeTruthy();
  });

  it("navigates to /duel/:id after countdown (AC8)", async () => {
    const { RoomHandoff } = await import("./RoomHandoff");
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RoomHandoff, { snapshot: makeSnap() }),
      ),
    );

    act(() => vi.advanceTimersByTime(3000));

    expect(mockNavigate).toHaveBeenCalledWith("/duel/r1", expect.any(Object));
  });

  it("room cannot get stuck — countdown is timer-driven (AC10)", async () => {
    // Verifies that without any animationend events, navigation still happens.
    const { RoomHandoff } = await import("./RoomHandoff");
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(RoomHandoff, { snapshot: makeSnap() }),
      ),
    );

    // Advance time — no animation events fired
    act(() => vi.advanceTimersByTime(3000));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
