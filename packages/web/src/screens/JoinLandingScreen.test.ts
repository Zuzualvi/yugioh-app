// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  mockNavigate.mockReset();
});

function setupNavigate() {
  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
  });
}

async function renderWithToken(token: string) {
  const { JoinLandingScreen } = await import("./JoinLandingScreen");
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/duel/join/${token}`] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: "/duel/join/:joinToken",
          element: React.createElement(JoinLandingScreen),
        }),
      ),
    ),
  );
}

describe("JoinLandingScreen — D5 public landing (logged-out visitor)", () => {
  it("renders the public landing when user is logged out and room is ok", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: true,
        reason: "ok",
      }),
      claimRoom: vi.fn(),
    }));

    await renderWithToken("testtoken");
    await vi.waitFor(() =>
      expect(screen.getByText(/Kaiba challenged you to a duel/i)).toBeTruthy(),
    );
    expect(screen.getByText(/Sign in to join/i)).toBeTruthy();
    expect(screen.getByText(/invite-only/i)).toBeTruthy();
    // No "Request access" button
    expect(screen.queryByText(/request access/i)).toBeNull();
  });

  it("does not bounce to /login for logged-out visitor", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: true,
        reason: "ok",
      }),
      claimRoom: vi.fn(),
    }));

    await renderWithToken("testtoken2");
    // Wait until the public landing has rendered (sign-in button is the key element)
    await vi.waitFor(() => screen.getByText(/Sign in to join/i));
    // navigate should not have been called with /login
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining("/login"),
      expect.anything(),
    );
  });
});

describe("JoinLandingScreen — D1 expired", () => {
  it("renders expired screen with 'This challenge has expired' heading", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: false,
        reason: "expired",
      }),
      claimRoom: vi.fn(),
    }));

    await renderWithToken("expiredtoken");
    await vi.waitFor(() => expect(screen.getByText(/This challenge has expired/i)).toBeTruthy());
    expect(screen.getByText(/Challenge someone/i)).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
  });
});

describe("JoinLandingScreen — D2 full", () => {
  it("renders 'This duel already has two players' for claimed_by_other", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: false,
        reason: "claimed_by_other",
      }),
      claimRoom: vi.fn(),
    }));

    await renderWithToken("fulltoken");
    await vi.waitFor(() =>
      expect(screen.getByText(/This duel already has two players/i)).toBeTruthy(),
    );
    expect(screen.getByText(/Someone else opened/i)).toBeTruthy();
    expect(screen.getByText(/Challenge someone/i)).toBeTruthy();
  });

  it("renders the full screen for 'started' verdict", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: null, loading: false }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: false,
        reason: "started",
      }),
      claimRoom: vi.fn(),
    }));

    await renderWithToken("startedtoken");
    await vi.waitFor(() =>
      expect(screen.getByText(/This duel already has two players/i)).toBeTruthy(),
    );
  });
});

describe("JoinLandingScreen — D3 own link (authenticated)", () => {
  it("redirects to room when creator opens their own link", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({
        user: { id: "creator-1", displayName: "Kaiba", role: "member" },
        loading: false,
      }),
    }));
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: false,
        reason: "you_are_the_creator",
      }),
      claimRoom: vi.fn().mockResolvedValue({ roomId: "room-xyz", status: "open" }),
    }));

    await renderWithToken("creatortoken");
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/duel/room-xyz/room", { replace: true }),
    );
  });
});

describe("JoinLandingScreen — authenticated user claims open room", () => {
  it("claims room and navigates on success", async () => {
    setupNavigate();
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({
        user: { id: "opp-1", displayName: "Joey", role: "member" },
        loading: false,
      }),
    }));
    const mockClaim = vi.fn().mockResolvedValue({ roomId: "room-abc", status: "filled" });
    vi.doMock("../api/room", () => ({
      lookupJoinToken: vi.fn().mockResolvedValue({
        perMoveSeconds: 600,
        creatorDisplayName: "Kaiba",
        usable: true,
        reason: "ok",
      }),
      claimRoom: mockClaim,
    }));

    await renderWithToken("validtoken");
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/duel/room-abc/room", { replace: true }),
    );
  });
});
