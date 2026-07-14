// @vitest-environment jsdom
/**
 * JoinDuelScreen tests — join via link lifecycle.
 */
import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const MOCK_DECKS = {
  decks: [
    { id: "deck-a", name: "Blackwings", counts: { main: 40, extra: 5, side: 0 }, isValid: true, updatedAt: "" },
  ],
};

const MOCK_JOIN_RESULT = {
  duelId: "duel-999",
  seat: 1 as const,
  seatToken: "seat-token-999",
};

function setupMocks(joinFn = vi.fn().mockResolvedValue(MOCK_JOIN_RESULT)) {
  vi.doMock("../api/decks", () => ({
    listDecks: vi.fn().mockResolvedValue(MOCK_DECKS),
  }));
  vi.doMock("../api/duel", () => ({
    joinDuel: joinFn,
  }));
  vi.doMock("../context/ToastContext", () => ({
    useToast: () => ({ addToast: vi.fn() }),
  }));
  vi.doMock("react-router-dom", async (orig) => {
    const actual = await orig<typeof import("react-router-dom")>();
    return {
      ...actual,
      useNavigate: () => vi.fn(),
    };
  });
}

describe("JoinDuelScreen — join via link", () => {
  it("shows the challenge prompt and deck list", async () => {
    setupMocks();
    const { JoinDuelScreen } = await import("./JoinDuelScreen");

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/duel/join/join-tok"] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { path: "/duel/join/:joinToken", element: React.createElement(JoinDuelScreen) },
          ),
        ),
      ),
    );

    await waitFor(() => screen.getByText(/challenged/i));
    expect(screen.getByText("Blackwings")).toBeTruthy();
  });

  it("calls joinDuel with joinToken and deckId on accept", async () => {
    const joinFn = vi.fn().mockResolvedValue(MOCK_JOIN_RESULT);
    setupMocks(joinFn);
    const { JoinDuelScreen } = await import("./JoinDuelScreen");

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/duel/join/join-tok-123"] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { path: "/duel/join/:joinToken", element: React.createElement(JoinDuelScreen) },
          ),
        ),
      ),
    );

    await waitFor(() => screen.getByText("Blackwings"));
    fireEvent.click(screen.getByText("Blackwings"));
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(joinFn).toHaveBeenCalledOnce());
    expect(joinFn).toHaveBeenCalledWith({
      joinToken: "join-tok-123",
      deckId: "deck-a",
    });
  });

  it("disables accept button when no deck selected", async () => {
    setupMocks();
    const { JoinDuelScreen } = await import("./JoinDuelScreen");

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/duel/join/tok"] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { path: "/duel/join/:joinToken", element: React.createElement(JoinDuelScreen) },
          ),
        ),
      ),
    );

    await waitFor(() => screen.getByRole("button", { name: /accept/i }));
    const btn = screen.getByRole("button", { name: /accept/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
