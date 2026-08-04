// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../types/contracts";
import type { ActiveDuelEntry } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function setupMocks(user: User, activeDuels: ActiveDuelEntry[] = []) {
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
    listActiveDuels: vi.fn().mockResolvedValue({ duels: activeDuels }),
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

describe("HomeScreen — active duels queue", () => {
  it("shows empty state when there are no active duels", async () => {
    setupMocks(memberUser, []);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.getByText("No duels in progress.")).toBeTruthy();
  });

  it("renders a link for each active duel", async () => {
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
