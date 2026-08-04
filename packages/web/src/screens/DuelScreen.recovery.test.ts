// @vitest-environment jsdom
/**
 * C0 evidence tests — tab-close recovery scenarios.
 *
 * Documents what ACTUALLY HAPPENS in each scenario, confirming the CTO's
 * hypothesis from the Slice C brief.
 *
 * FINDINGS:
 *
 * Scenarios 1 + 2: Fresh tab to /duel/:id with an authenticated session and
 * empty location.state. DuelScreen.tsx:74-97 already calls getSeatCredential()
 * when location.state.seatToken is absent. The server endpoint (getSeatCredential.ts)
 * imposes NO status restriction — any authenticated seat holder gets their
 * token back regardless of duel status. Both scenarios recover today.
 *
 * Scenario 3 (gap, now closed): HomeScreen previously offered no path back to
 * an in-progress duel. That gap was filled by Slice E (ZUH-72/74): Home now
 * fetches GET /api/duels/active and renders a link per entry. The href
 * assertions live in HomeScreen.test.ts where the coverage belongs.
 *
 * PRD claims confirmed already fixed:
 *   - useMock is explicit-only (DuelScreen header R32/R43) — CONFIRMED
 *   - Credential fetch via getSeatCredential (DuelScreen.tsx:74-97) — CONFIRMED
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

/**
 * Scenarios 1 + 2: Fresh tab — server-side recovery already works.
 * The getSeatCredential endpoint has no status restriction.
 */
describe("C0 Scenario 1+2: fresh tab recovery via getSeatCredential", () => {
  beforeEach(() => {
    vi.doMock("../api/room", () => ({
      getSeatCredential: vi.fn().mockResolvedValue({ seat: 0, seatToken: "recovered-token" }),
    }));
  });

  it("fetches credential from server when location.state is absent", async () => {
    const { getSeatCredential } = await import("../api/room");
    await act(async () => {
      renderDuelScreen("duel-abc", null);
    });
    await waitFor(() => {
      expect(vi.mocked(getSeatCredential)).toHaveBeenCalledWith("duel-abc");
    });
  });

  it("opens real WebSocket with the fetched seat token (not mock)", async () => {
    await act(async () => {
      renderDuelScreen("duel-abc", null);
    });
    await waitFor(() => {
      expect(mockOpenDuelSocket).toHaveBeenCalledWith(
        "duel-abc",
        "recovered-token",
        expect.any(Object),
      );
    });
  });

  it("shows credential error UI when server returns 403 — no mock fallback", async () => {
    vi.doMock("../api/room", () => ({
      getSeatCredential: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
    }));
    await act(async () => {
      renderDuelScreen("duel-abc", null);
    });
    await waitFor(() => {
      expect(document.querySelector("[role=alert]")).toBeTruthy();
    });
    expect(mockOpenDuelSocket).not.toHaveBeenCalled();
  });
});
