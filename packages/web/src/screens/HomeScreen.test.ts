// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../types/contracts";
import type { ActiveDuelEntry, ActiveRoomEntry } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function setupMocks(
  user: User,
  activeDuels: ActiveDuelEntry[] = [],
  activeRooms: ActiveRoomEntry[] = [],
) {
  vi.doMock("../context/AuthContext", () => ({
    useAuth: () => ({ user, logout: vi.fn() }),
  }));
  vi.doMock("../context/ToastContext", () => ({
    useToast: () => ({ addToast: vi.fn() }),
  }));
  vi.doMock("../api/admin", () => ({
    createInvite: vi.fn().mockResolvedValue({
      inviteCode: "TESTCODE",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  }));
  vi.doMock("../api/room", () => ({
    listActiveDuels: vi.fn().mockResolvedValue({ duels: activeDuels, rooms: activeRooms }),
  }));
}

const memberUser: User = { id: "m1", displayName: "Member", role: "member" };

describe("HomeScreen — admin invite section", () => {
  it("shows 'Invite a friend' button when user is admin", async () => {
    const adminUser: User = { id: "a1", displayName: "Admin", role: "admin" };
    setupMocks(adminUser);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.getByText("Invite a friend")).toBeTruthy();
  });

  it("does NOT show invite section when user is member", async () => {
    setupMocks(memberUser);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.queryByText("Invite a friend")).toBeNull();
  });
});

describe("HomeScreen — active games queue", () => {
  it("shows empty state when both duels and rooms are empty", async () => {
    setupMocks(memberUser, [], []);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.getByText("No games in progress.")).toBeTruthy();
  });

  it("renders a link for each active duel pointing at /duel/:duelId", async () => {
    const duels: ActiveDuelEntry[] = [
      {
        duelId: "duel-abc",
        status: "active",
        mySeat: 0,
        opponentDisplayName: "Bob",
        onClockSeat: 0,
        deadlineAt: null,
        createdAt: Date.now(),
      },
    ];
    setupMocks(memberUser, duels);

    const { HomeScreen } = await import("./HomeScreen");
    const { findByRole } = render(
      React.createElement(MemoryRouter, null, React.createElement(HomeScreen)),
    );

    const link = await findByRole("link", { name: /vs Bob/ });
    expect(link.getAttribute("href")).toBe("/duel/duel-abc");
  });

  it("renders a link for each active room pointing at /duel/:roomId/room", async () => {
    const rooms: ActiveRoomEntry[] = [
      {
        roomId: "room-xyz",
        status: "open",
        myRole: "creator",
        opponentDisplayName: null,
        roomDeadlineAt: Date.now() + 1800_000,
        createdAt: Date.now(),
      },
    ];
    setupMocks(memberUser, [], rooms);

    const { HomeScreen } = await import("./HomeScreen");
    const { findByRole } = render(
      React.createElement(MemoryRouter, null, React.createElement(HomeScreen)),
    );

    const link = await findByRole("link", { name: /Waiting for opponent/ });
    expect(link.getAttribute("href")).toBe("/duel/room-xyz/room");
  });

  it("does not show empty state when only rooms are present", async () => {
    const rooms: ActiveRoomEntry[] = [
      {
        roomId: "room-xyz",
        status: "filled",
        myRole: "opponent",
        opponentDisplayName: "Alice",
        roomDeadlineAt: Date.now() + 1800_000,
        createdAt: Date.now(),
      },
    ];
    setupMocks(memberUser, [], rooms);

    const { HomeScreen } = await import("./HomeScreen");
    const { findByRole } = render(
      React.createElement(MemoryRouter, null, React.createElement(HomeScreen)),
    );

    await findByRole("link", { name: /vs Alice/ });
    expect(screen.queryByText("No games in progress.")).toBeNull();
  });

  it("does not show empty state when only duels are present", async () => {
    const duels: ActiveDuelEntry[] = [
      {
        duelId: "duel-abc",
        status: "active",
        mySeat: 0,
        opponentDisplayName: "Carol",
        onClockSeat: null,
        deadlineAt: null,
        createdAt: Date.now(),
      },
    ];
    setupMocks(memberUser, duels, []);

    const { HomeScreen } = await import("./HomeScreen");
    const { findByRole } = render(
      React.createElement(MemoryRouter, null, React.createElement(HomeScreen)),
    );

    await findByRole("link", { name: /vs Carol/ });
    expect(screen.queryByText("No games in progress.")).toBeNull();
  });

  it("shows 'Waiting for opponent' when opponentDisplayName is null", async () => {
    const duels: ActiveDuelEntry[] = [
      {
        duelId: "duel-xyz",
        status: "waiting_for_opponent",
        mySeat: 0,
        opponentDisplayName: null,
        onClockSeat: null,
        deadlineAt: null,
        createdAt: Date.now(),
      },
    ];
    setupMocks(memberUser, duels);

    const { HomeScreen } = await import("./HomeScreen");
    const { findByText } = render(
      React.createElement(MemoryRouter, null, React.createElement(HomeScreen)),
    );

    await findByText("Waiting for opponent");
  });
});
