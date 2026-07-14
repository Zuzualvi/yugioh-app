// @vitest-environment jsdom
/**
 * CreateDuelScreen tests — create → link lifecycle.
 */
import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const MOCK_DECKS = {
  decks: [
    { id: "deck-1", name: "Blackwings", counts: { main: 40, extra: 5, side: 0 }, isValid: true, updatedAt: "" },
    { id: "deck-2", name: "Quickdraw", counts: { main: 42, extra: 8, side: 0 }, isValid: true, updatedAt: "" },
  ],
};

const MOCK_DUEL_RESULT = {
  duelId: "duel-abc",
  joinToken: "join-xyz",
  creatorSeatToken: "creator-token",
  seat: 0,
};

function setupMocks(createFn = vi.fn().mockResolvedValue(MOCK_DUEL_RESULT)) {
  vi.doMock("../api/decks", () => ({
    listDecks: vi.fn().mockResolvedValue(MOCK_DECKS),
  }));
  vi.doMock("../api/duel", () => ({
    createDuel: createFn,
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

describe("CreateDuelScreen — create → shareable link", () => {
  it("shows deck list on load", async () => {
    setupMocks();
    const { CreateDuelScreen } = await import("./CreateDuelScreen");

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(CreateDuelScreen),
      ),
    );

    await waitFor(() => screen.getByText("Blackwings"));
    expect(screen.getByText("Blackwings")).toBeTruthy();
    expect(screen.getByText("Quickdraw")).toBeTruthy();
  });

  it("shows timer presets", async () => {
    setupMocks();
    const { CreateDuelScreen } = await import("./CreateDuelScreen");

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(CreateDuelScreen),
      ),
    );

    await waitFor(() => screen.getByText("5 min"));
    expect(screen.getByText("15 min")).toBeTruthy();
    expect(screen.getByText("24 hr")).toBeTruthy();
    expect(screen.getByText("48 hr")).toBeTruthy();
  });

  it("calls createDuel with selected deck and timer on submit", async () => {
    const createFn = vi.fn().mockResolvedValue(MOCK_DUEL_RESULT);
    setupMocks(createFn);
    const { CreateDuelScreen } = await import("./CreateDuelScreen");

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(CreateDuelScreen),
      ),
    );

    await waitFor(() => screen.getByText("Blackwings"));

    // Select deck
    fireEvent.click(screen.getByText("Blackwings"));

    // Click create
    fireEvent.click(screen.getByText(/create duel/i));

    await waitFor(() => expect(createFn).toHaveBeenCalledOnce());
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: "deck-1",
        timer: expect.objectContaining({ perMoveSeconds: expect.any(Number) }),
      }),
    );
  });

  it("shows shareable join link after creation", async () => {
    setupMocks();
    const { CreateDuelScreen } = await import("./CreateDuelScreen");

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(CreateDuelScreen),
      ),
    );

    await waitFor(() => screen.getByText("Blackwings"));
    fireEvent.click(screen.getByText("Blackwings"));
    fireEvent.click(screen.getByText(/create duel/i));

    await waitFor(() => screen.getByTestId("join-link"));
    const link = screen.getByTestId("join-link");
    expect(link.textContent).toContain("join-xyz");
    expect(link.textContent).toContain("/duel/join/");
  });

  it("disables create button when no deck selected", async () => {
    setupMocks();
    const { CreateDuelScreen } = await import("./CreateDuelScreen");

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(CreateDuelScreen),
      ),
    );

    await waitFor(() => screen.getByText("Blackwings"));

    const createBtn = screen.getByText(/create duel/i) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });
});
