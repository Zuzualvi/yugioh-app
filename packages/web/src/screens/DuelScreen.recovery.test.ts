// @vitest-environment jsdom
/**
 * C0 evidence tests — tab-close recovery scenarios.
 *
 * Documents what ACTUALLY HAPPENS in each scenario, confirming the CTO's
 * hypothesis from the Slice C brief.
 *
 * FINDINGS:
 *
 * Scenario 1 + 2: Fresh tab to /duel/:id with an authenticated session and
 * empty location.state. DuelScreen.tsx:74-97 already calls getSeatCredential()
 * when location.state.seatToken is absent. The server endpoint (getSeatCredential.ts)
 * imposes NO status restriction — any authenticated seat holder gets their
 * token back regardless of duel status. Both scenarios recover today.
 *
 * Scenario 3: From Home/post-login with no URL in hand. HomeScreen has NO
 * affordance to return to an in-progress duel. The seam comment
 * ("Your move queue — SEAM for Slice 3") renders nothing. This is the REAL
 * gap: once the URL is lost, the app offers no path back. Mechanism decision
 * deferred to CTO (spec §C0: STOP AND REPORT before building).
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

/**
 * Scenario 3: No resume path from Home — the REAL gap.
 * This test documents the gap without implementing a fix.
 * Mechanism decision deferred to CTO per spec §C0.
 */
describe("C0 Scenario 3: no resume path from Home (documented gap)", () => {
  it("HomeScreen has no link to any in-progress duel", async () => {
    vi.doMock("../context/AuthContext", () => ({
      useAuth: () => ({ user: { displayName: "Alice", role: "member" }, logout: vi.fn() }),
    }));
    vi.doMock("../context/ToastContext", () => ({
      useToast: () => ({ addToast: vi.fn() }),
    }));
    vi.doMock("../api/admin", () => ({ createInvite: vi.fn() }));

    const { HomeScreen } = await import("./HomeScreen");
    render(React.createElement(MemoryRouter, null, React.createElement(HomeScreen)));

    const hrefs = Array.from(document.querySelectorAll("a[href]")).map(
      (a) => (a as HTMLAnchorElement).getAttribute("href") ?? "",
    );
    const inProgressLinks = hrefs.filter((h) => h.startsWith("/duel/") && h !== "/duel/new");
    // Confirms the gap: no path back to an in-progress duel from Home
    expect(inProgressLinks).toHaveLength(0);
  });
});
