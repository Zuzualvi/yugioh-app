// @vitest-environment jsdom
/**
 * RoomWaiting — unit tests for S2/S4/S5/S6 and D4 revert banner.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ── Snapshot factory ──────────────────────────────────────────────────────

function makeYou(overrides: Partial<RoomSnapshot["you"]> = {}): RoomSnapshot["you"] {
  return {
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
    ...overrides,
  };
}

function makeOpponent(overrides: Partial<RoomSnapshot["opponent"]> = {}): RoomSnapshot["opponent"] {
  return {
    role: "opponent",
    userId: "u2",
    displayName: "Kaiba",
    presence: "connected",
    deckSelected: false,
    ready: false,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomId: "r1",
    status: "open",
    closedReason: null,
    closedByUserId: null,
    perMoveSeconds: 600,
    createdAt: Date.now() - 60_000,
    roomDeadlineAt: Date.now() + 29 * 60_000,
    serverNow: Date.now(),
    joinToken: "tok123",
    you: makeYou(),
    opponent: null,
    flip: null,
    seats: null,
    ...overrides,
  };
}

// ── Mock setup ────────────────────────────────────────────────────────────

function setupMocks({
  decks = [] as Array<{
    id: string;
    name: string;
    counts: { main: number; extra: number; side: number };
    isValid: boolean;
    updatedAt: string;
  }>,
  pickDeckResult = undefined as RoomSnapshot | undefined,
  readyResult = undefined as RoomSnapshot | undefined,
  unreadyResult = undefined as RoomSnapshot | undefined,
  leaveResult = undefined as RoomSnapshot | undefined,
} = {}) {
  vi.doMock("../../api/decks", () => ({
    listDecks: vi.fn().mockResolvedValue({ decks }),
  }));
  vi.doMock("../../api/room", () => ({
    pickDeck: vi.fn().mockResolvedValue(pickDeckResult),
    ready: vi.fn().mockResolvedValue(readyResult),
    unready: vi.fn().mockResolvedValue(unreadyResult),
    leaveRoom: vi.fn().mockResolvedValue(leaveResult),
  }));
}

async function renderWaiting(snapshot: RoomSnapshot) {
  const { RoomWaiting } = await import("./RoomWaiting");
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(RoomWaiting, { snapshot }),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("RoomWaiting — S2 (creator alone, status=open)", () => {
  beforeEach(() => {
    setupMocks();
  });

  it("renders the rules strip", async () => {
    await renderWaiting(makeSnapshot({ perMoveSeconds: 600 }));
    expect(screen.getByText(/10 min per move/i)).toBeTruthy();
  });

  it("shows 'Waiting for an opponent' in the players panel", async () => {
    await renderWaiting(makeSnapshot({ status: "open", opponent: null }));
    expect(screen.getByText(/Waiting for an opponent/i)).toBeTruthy();
  });

  it("shows the share block with invite link (creator, status=open)", async () => {
    await renderWaiting(makeSnapshot({ status: "open", joinToken: "abc123" }));
    expect(screen.getByText(/Send this link/i)).toBeTruthy();
    expect(screen.getByText(/abc123/)).toBeTruthy();
  });

  it("hides the share block when status=filled", async () => {
    await renderWaiting(
      makeSnapshot({ status: "filled", joinToken: null, opponent: makeOpponent() }),
    );
    expect(screen.queryByText(/Send this link/i)).toBeNull();
  });

  it("hides the share block for the invitee (role=opponent)", async () => {
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        joinToken: null,
        you: makeYou({ role: "opponent" }),
        opponent: makeOpponent({ role: "creator" }),
      }),
    );
    expect(screen.queryByText(/Send this link/i)).toBeNull();
  });

  it("renders the expiry countdown", async () => {
    await renderWaiting(makeSnapshot({ status: "open", roomDeadlineAt: Date.now() + 29 * 60_000 }));
    expect(screen.getByText(/Link expires in/i)).toBeTruthy();
  });

  it("shows 'No decks yet' empty state when deck list is empty", async () => {
    await renderWaiting(makeSnapshot({ status: "open" }));
    await waitFor(() => expect(screen.getByText(/No decks yet/i)).toBeTruthy());
  });

  it("shows deck list when decks exist", async () => {
    setupMocks({
      decks: [
        {
          id: "d1",
          name: "Blackwings",
          counts: { main: 40, extra: 0, side: 0 },
          isValid: true,
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    await renderWaiting(makeSnapshot({ status: "open" }));
    await waitFor(() => expect(screen.getByText("Blackwings")).toBeTruthy());
  });

  it("Ready button is disabled while alone", async () => {
    await renderWaiting(makeSnapshot({ status: "open", opponent: null }));
    const btn = screen.getByRole("button", { name: /Ready/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows Leave button", async () => {
    await renderWaiting(makeSnapshot());
    expect(screen.getByRole("button", { name: /Leave/i })).toBeTruthy();
  });
});

describe("RoomWaiting — S4 (both present, neither ready)", () => {
  it("shows opponent name in the players panel", async () => {
    setupMocks();
    await renderWaiting(
      makeSnapshot({ status: "filled", opponent: makeOpponent({ displayName: "Kaiba" }) }),
    );
    expect(screen.getByText(/Kaiba/)).toBeTruthy();
  });

  it("Ready button is enabled when deck is selected", async () => {
    setupMocks({
      decks: [
        {
          id: "d1",
          name: "Lightsworn",
          counts: { main: 41, extra: 0, side: 0 },
          isValid: true,
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        opponent: makeOpponent(),
        you: makeYou({ deckId: "d1", deckSelected: true }),
      }),
    );
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Ready/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

describe("RoomWaiting — S5 (you ready, opponent not)", () => {
  it("shows Unready button when deck is locked", async () => {
    setupMocks();
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        opponent: makeOpponent(),
        you: makeYou({
          deckId: "d1",
          deckSelected: true,
          ready: true,
          deckLocked: true,
          deckName: "Lightsworn",
          deckCardCount: 41,
        }),
      }),
    );
    expect(screen.getByRole("button", { name: /Unready/i })).toBeTruthy();
  });

  it("shows locked deck summary row", async () => {
    setupMocks();
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        opponent: makeOpponent(),
        you: makeYou({
          deckId: "d1",
          deckSelected: true,
          ready: true,
          deckLocked: true,
          deckName: "Lightsworn",
          deckCardCount: 41,
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText(/Lightsworn/)).toBeTruthy());
    expect(screen.getByText(/41 cards/i)).toBeTruthy();
  });

  it("shows waiting-for-opponent status line", async () => {
    setupMocks();
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        opponent: makeOpponent({ displayName: "Kaiba", ready: false }),
        you: makeYou({ ready: true, deckLocked: true, deckName: "LS", deckCardCount: 40 }),
      }),
    );
    await waitFor(() => expect(screen.getByText(/Waiting for Kaiba to ready up/i)).toBeTruthy());
  });
});

describe("RoomWaiting — S6 (opponent ready, you not)", () => {
  it("shows 'opponent is ready and waiting' status line", async () => {
    setupMocks();
    await renderWaiting(
      makeSnapshot({
        status: "filled",
        opponent: makeOpponent({ displayName: "Kaiba", ready: true }),
        you: makeYou({ ready: false }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Kaiba is ready and waiting for you/i)).toBeTruthy(),
    );
  });
});

describe("RoomWaiting — Leave confirm dialog (creator)", () => {
  it("shows confirm dialog when creator clicks Leave", async () => {
    setupMocks();
    await renderWaiting(makeSnapshot({ status: "open", you: makeYou({ role: "creator" }) }));
    const leaveBtn = screen.getByRole("button", { name: /← Leave/i });
    fireEvent.click(leaveBtn);
    await waitFor(() => expect(screen.getByText(/Leave this room\?/i)).toBeTruthy());
  });

  it("closes dialog when Stay is clicked", async () => {
    setupMocks();
    await renderWaiting(makeSnapshot({ status: "open", you: makeYou({ role: "creator" }) }));
    fireEvent.click(screen.getByRole("button", { name: /← Leave/i }));
    await waitFor(() => expect(screen.getByText(/Leave this room\?/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Stay/i }));
    await waitFor(() => expect(screen.queryByText(/Leave this room\?/i)).toBeNull());
  });
});

describe("RoomWaiting — pickDeck interaction", () => {
  it("calls pickDeck API when a deck is selected", async () => {
    const mockPickDeck = vi.fn().mockResolvedValue(makeSnapshot());
    vi.doMock("../../api/decks", () => ({
      listDecks: vi.fn().mockResolvedValue({
        decks: [
          {
            id: "d1",
            name: "Blackwings",
            counts: { main: 40, extra: 0, side: 0 },
            isValid: true,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    }));
    vi.doMock("../../api/room", () => ({
      pickDeck: mockPickDeck,
      ready: vi.fn(),
      unready: vi.fn(),
      leaveRoom: vi.fn(),
    }));

    await renderWaiting(makeSnapshot({ status: "filled", opponent: makeOpponent() }));
    await waitFor(() => screen.getByText("Blackwings"));

    const radio = screen.getByRole("radio");
    fireEvent.click(radio);
    await waitFor(() => expect(mockPickDeck).toHaveBeenCalledWith("r1", { deckId: "d1" }));
  });
});

describe("RoomClosed — D4 creator-left (invitee sees)", () => {
  it("renders the closed room with left reason", async () => {
    const { RoomClosed } = await import("./RoomClosed");
    const snapshot: RoomSnapshot = makeSnapshot({
      status: "closed",
      closedReason: "left",
      closedByUserId: "u_creator",
      you: makeYou({ role: "opponent", userId: "u2" }),
      opponent: makeOpponent({ role: "creator", userId: "u_creator", displayName: "Kaiba" }),
    });
    render(React.createElement(MemoryRouter, null, React.createElement(RoomClosed, { snapshot })));
    expect(screen.getByText(/Kaiba left the room/i)).toBeTruthy();
    expect(screen.getByText(/Nothing was recorded/i)).toBeTruthy();
  });
});

describe("RoomClosed — expired variants (E48)", () => {
  it("renders expired_unclaimed for invitee", async () => {
    const { RoomClosed } = await import("./RoomClosed");
    const snapshot: RoomSnapshot = makeSnapshot({
      status: "closed",
      closedReason: "expired_unclaimed",
      you: makeYou({ role: "opponent" }),
    });
    render(React.createElement(MemoryRouter, null, React.createElement(RoomClosed, { snapshot })));
    expect(screen.getByText(/expired/i)).toBeTruthy();
  });

  it("renders expired_unclaimed creator variant with custom copy", async () => {
    const { RoomClosed } = await import("./RoomClosed");
    const snapshot: RoomSnapshot = makeSnapshot({
      status: "closed",
      closedReason: "expired_unclaimed",
      you: makeYou({ role: "creator" }),
    });
    render(React.createElement(MemoryRouter, null, React.createElement(RoomClosed, { snapshot })));
    expect(screen.getByText(/Your challenge expired/i)).toBeTruthy();
  });

  it("renders engine_failed with try-again path", async () => {
    const { RoomClosed } = await import("./RoomClosed");
    const snapshot: RoomSnapshot = makeSnapshot({
      status: "closed",
      closedReason: "engine_failed",
    });
    render(React.createElement(MemoryRouter, null, React.createElement(RoomClosed, { snapshot })));
    // Multiple elements may contain "Something went wrong" (title + body)
    const elements = screen.getAllByText(/Something went wrong/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText(/No result was recorded/i)).toBeTruthy();
  });
});
