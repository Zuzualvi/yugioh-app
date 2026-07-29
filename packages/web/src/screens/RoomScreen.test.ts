// @vitest-environment jsdom
/**
 * RoomScreen tests — phase switch renders the right component.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RoomSnapshot } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function makeSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomId: "r1",
    status: "open",
    closedReason: null,
    closedByUserId: null,
    perMoveSeconds: 300,
    createdAt: 0,
    roomDeadlineAt: Date.now() + 60_000,
    serverNow: Date.now(),
    joinToken: "tok",
    you: {
      role: "creator",
      userId: "u1",
      displayName: "Alice",
      presence: "connected",
      deckSelected: false,
      ready: false,
      deckId: null,
      deckName: null,
      deckCardCount: null,
      deckLocked: false,
    },
    opponent: null,
    flip: null,
    seats: null,
    ...overrides,
  };
}

function setup(snap: RoomSnapshot | null, loading = false) {
  vi.doMock("../hooks/useRoom", () => ({
    useRoom: () => ({
      snapshot: snap,
      loading,
      error: null,
      msUntilDeadline: null,
    }),
  }));
}

async function renderRoomScreen(roomId = "r1") {
  // Dynamic imports so ToastProvider and RoomWaiting share the same module
  // instance (vi.resetModules in afterEach would otherwise give them different
  // ToastContext objects, making useToast throw "not within ToastProvider").
  const { RoomScreen } = await import("./RoomScreen");
  const { ToastProvider } = await import("../context/ToastContext");
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/duel/${roomId}/room`] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/duel/:roomId/room",
            element: React.createElement(RoomScreen),
          }),
        ),
      ),
    ),
  );
}

describe("RoomScreen phase switch", () => {
  it("shows loading spinner when loading=true", async () => {
    setup(null, true);
    await renderRoomScreen();
    expect(document.querySelector('[aria-label="Loading room…"]')).toBeTruthy();
  });

  it("shows RoomWaiting for open status", async () => {
    setup(makeSnapshot({ status: "open" }));
    await renderRoomScreen();
    expect(screen.getByText(/Waiting Room/i)).toBeTruthy();
  });

  it("shows RoomWaiting for filled status", async () => {
    setup(
      makeSnapshot({
        status: "filled",
        opponent: {
          role: "opponent",
          userId: "u2",
          displayName: "Bob",
          presence: "connected",
          deckSelected: false,
          ready: false,
        },
      }),
    );
    await renderRoomScreen();
    expect(screen.getByText(/Waiting Room/i)).toBeTruthy();
  });

  it("shows RoomChoice for awaiting_choice with flip (no choice yet)", async () => {
    setup(
      makeSnapshot({
        status: "awaiting_choice",
        opponent: {
          role: "opponent",
          userId: "u2",
          displayName: "Bob",
          presence: "connected",
          deckSelected: true,
          ready: true,
        },
        flip: { winnerUserId: "u1", winnerDisplayName: "Alice", rolledAt: 100, choice: null },
      }),
    );
    await renderRoomScreen();
    expect(screen.getByText(/Choose Your Seat/i)).toBeTruthy();
  });

  it("shows RoomHandoff for starting with seats", async () => {
    setup(
      makeSnapshot({
        status: "starting",
        opponent: {
          role: "opponent",
          userId: "u2",
          displayName: "Bob",
          presence: "connected",
          deckSelected: true,
          ready: true,
        },
        flip: { winnerUserId: "u1", winnerDisplayName: "Alice", rolledAt: 100, choice: "first" },
        seats: { seat0UserId: "u1", seat1UserId: "u2" },
        roomDeadlineAt: null,
      }),
    );
    await renderRoomScreen();
    expect(screen.getByText(/Duel Starting/i)).toBeTruthy();
  });

  it("shows RoomClosed for closed status", async () => {
    setup(makeSnapshot({ status: "closed", closedReason: "left", roomDeadlineAt: null }));
    await renderRoomScreen();
    expect(screen.getByText(/Room Closed/i)).toBeTruthy();
  });
});
