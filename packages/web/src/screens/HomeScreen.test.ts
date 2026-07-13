// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "../types/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function setupMocks(user: User) {
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
}

describe("HomeScreen — admin invite section", () => {
  it("shows 'Invite a friend' button when user is admin", async () => {
    const adminUser: User = { id: "a1", displayName: "Admin", role: "admin" };
    setupMocks(adminUser);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.getByText("Invite a friend")).toBeTruthy();
  });

  it("does NOT show invite section when user is member", async () => {
    const memberUser: User = { id: "m1", displayName: "Member", role: "member" };
    setupMocks(memberUser);

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    expect(screen.queryByText("Invite a friend")).toBeNull();
  });
});
