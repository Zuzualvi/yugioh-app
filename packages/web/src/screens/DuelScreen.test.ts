// @vitest-environment jsdom
/**
 * DuelScreen tests — seat credential recovery and useMock fix.
 *
 * Verifies:
 *   - useMock is explicit-only (AC7): missing seatToken does NOT trigger mock
 *   - Fetches seat credential from server when not in router state (AC7, E45)
 *   - Shows error when credential fetch fails — never a mock board (AC7)
 *   - Passes credential to socket when successfully fetched
 */
import React from "react";
import { cleanup, render, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOpenDuelSocket = vi.fn((_duelId?: any, _seatToken?: any, _handlers?: any) => ({
  send: vi.fn(),
  close: vi.fn(),
}));

vi.mock("../api/duelSocket", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openDuelSocket: (duelId: any, seatToken: any, handlers: any) =>
    mockOpenDuelSocket(duelId, seatToken, handlers),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
  mockOpenDuelSocket.mockClear();
});

function renderDuelScreen(duelId: string, state: Record<string, unknown> | null = null) {
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: `/duel/${duelId}`, state }] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: "/duel/:duelId",
          element: React.createElement(
            React.lazy(() => import("./DuelScreen").then((m) => ({ default: m.DuelScreen }))),
          ),
        }),
      ),
    ),
  );
}

describe("DuelScreen — useMock explicit-only (AC7)", () => {
  beforeEach(() => {
    vi.doMock("../api/room", () => ({
      getSeatCredential: vi.fn().mockResolvedValue({ seat: 0, seatToken: "fetched-token" }),
    }));
  });

  it("does NOT start mock session when seatToken is missing (AC7)", async () => {
    const mockSession = { start: vi.fn(), stop: vi.fn(), respond: vi.fn() };
    vi.doMock("../mock/duelSession", () => ({
      createMockDuelSession: vi.fn().mockReturnValue(mockSession),
    }));

    // No state (seatToken missing, useMock not set)
    await act(async () => {
      renderDuelScreen("duel-1", null);
    });

    // Allow credential fetch to resolve
    await waitFor(() => {
      expect(mockOpenDuelSocket).toHaveBeenCalled();
    });

    // Mock session should NOT have been started
    expect(mockSession.start).not.toHaveBeenCalled();
  });

  it("fetches credential from server when not in router state (E45)", async () => {
    const { getSeatCredential } = await import("../api/room");
    const mockFetch = vi.mocked(getSeatCredential);

    await act(async () => {
      renderDuelScreen("duel-1", null);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("duel-1");
    });
  });

  it("uses fetched seatToken for the real WebSocket", async () => {
    await act(async () => {
      renderDuelScreen("duel-1", null);
    });

    await waitFor(() => {
      expect(mockOpenDuelSocket).toHaveBeenCalledWith(
        "duel-1",
        "fetched-token",
        expect.any(Object),
      );
    });
  });

  it("shows credential error when fetch fails — no mock fallback (AC7)", async () => {
    vi.doMock("../api/room", () => ({
      getSeatCredential: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
    }));

    await act(async () => {
      renderDuelScreen("duel-1", null);
    });

    await waitFor(() => {
      const alert = document.querySelector("[role=alert]");
      expect(alert).toBeTruthy();
    });

    // Mock socket should NOT have been opened
    expect(mockOpenDuelSocket).not.toHaveBeenCalled();
  });

  it("starts mock session when useMock=true in state (explicit-only)", async () => {
    const mockSession = { start: vi.fn(), stop: vi.fn(), respond: vi.fn() };
    vi.doMock("../mock/duelSession", () => ({
      createMockDuelSession: vi.fn().mockReturnValue(mockSession),
    }));

    await act(async () => {
      renderDuelScreen("duel-1", { useMock: true, seat: 0 });
    });

    await waitFor(() => {
      expect(mockSession.start).toHaveBeenCalled();
    });
  });

  it("uses seatToken from router state when provided (fast path)", async () => {
    await act(async () => {
      renderDuelScreen("duel-1", { seatToken: "state-token", seat: 1 });
    });

    await waitFor(() => {
      expect(mockOpenDuelSocket).toHaveBeenCalledWith("duel-1", "state-token", expect.any(Object));
    });
  });
});
