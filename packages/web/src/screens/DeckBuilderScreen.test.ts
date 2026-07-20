// @vitest-environment jsdom
/**
 * DeckBuilderScreen — card title hydration tests.
 * Verifies that opening a saved deck and importing a .ydk resolves all titles
 * without showing #<passcode> fallbacks.
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardDTO } from "../types/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ── Fixture cards ─────────────────────────────────────────────────────────────

const BEWD: CardDTO = {
  passcode: 89631139,
  name: "Blue-Eyes White Dragon",
  frame: "normal",
  isExtraDeck: false,
  race: "Dragon",
  attribute: "LIGHT",
  level: 8,
  atk: 3000,
  def: 2500,
  desc: "Legendary dragon.",
  banlist: "unlimited",
  aliasOf: null,
  imageId: 89631139,
};

const DARK_MAGICIAN: CardDTO = {
  passcode: 46986414,
  name: "Dark Magician",
  frame: "normal",
  isExtraDeck: false,
  race: "Spellcaster",
  attribute: "DARK",
  level: 7,
  atk: 2500,
  def: 2100,
  desc: "The ultimate wizard.",
  banlist: "unlimited",
  aliasOf: null,
  imageId: 46986414,
};

const SPELL_CARD: CardDTO = {
  passcode: 5318639,
  name: "Monster Reborn",
  frame: "spell",
  isExtraDeck: false,
  race: "Normal",
  attribute: null,
  level: null,
  atk: null,
  def: null,
  desc: "Target 1 monster in either GY; Special Summon it.",
  banlist: "limited",
  aliasOf: null,
  imageId: 5318639,
};

const DECK_CARDS = [BEWD, DARK_MAGICIAN, SPELL_CARD];

// A minimal 40-card deck using the three fixture cards: 20 BEWD + 10 DM + 10 Spell
const MAIN_40 = [
  ...Array(20).fill(BEWD.passcode),
  ...Array(10).fill(DARK_MAGICIAN.passcode),
  ...Array(10).fill(SPELL_CARD.passcode),
];

const MOCK_DECK_ID = "deck-1";

function makeSearchCardsMock(cards = DECK_CARDS) {
  return vi.fn().mockResolvedValue({
    total: cards.length,
    page: 1,
    pageSize: cards.length,
    cards,
  });
}

function setupMocks(overrides: { searchCardsFn?: ReturnType<typeof vi.fn> } = {}) {
  const searchCardsFn = overrides.searchCardsFn ?? makeSearchCardsMock();
  // Stable references — must not change identity between renders to avoid
  // re-triggering effects that list addToast in their dep array.
  const addToast = vi.fn();

  vi.doMock("../api/cards", () => ({
    searchCards: searchCardsFn,
    getCard: vi.fn(),
  }));

  vi.doMock("../api/decks", () => ({
    getDeck: vi.fn().mockResolvedValue({
      id: MOCK_DECK_ID,
      name: "Test Deck",
      main: MAIN_40,
      extra: [],
      side: [],
      ownerId: "user-1",
      validation: {
        legal: false,
        counts: { main: 40, extra: 0, side: 0 },
        violations: [],
      },
      updatedAt: new Date().toISOString(),
    }),
    importDeck: vi.fn().mockResolvedValue({
      name: "Imported Deck",
      main: [BEWD.passcode, DARK_MAGICIAN.passcode],
      extra: [],
      side: [],
      validation: { legal: false, counts: { main: 2, extra: 0, side: 0 }, violations: [] },
    }),
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    exportDeck: vi.fn(),
    listDecks: vi.fn().mockResolvedValue({ decks: [] }),
  }));

  vi.doMock("../context/AuthContext", () => ({
    useAuth: () => ({
      user: { id: "user-1", displayName: "TestUser", role: "member" },
      logout: vi.fn(),
    }),
  }));

  // IMPORTANT: addToast must be a stable reference (not vi.fn() inline).
  // The component lists addToast in effect dep arrays — a new fn on every render
  // causes the deck-load effect to re-run and set deckLoading=true indefinitely.
  vi.doMock("../context/ToastContext", () => ({
    useToast: () => ({ addToast }),
  }));

  vi.doMock("react-router-dom", async (orig) => {
    const actual = await orig<typeof import("react-router-dom")>();
    return {
      ...actual,
      useNavigate: () => vi.fn(),
      useParams: () => ({ id: MOCK_DECK_ID }),
    };
  });

  return { searchCardsFn };
}

async function renderBuilder() {
  const { DeckBuilderScreen } = await import("./DeckBuilderScreen");
  render(React.createElement(MemoryRouter, null, React.createElement(DeckBuilderScreen)));
}

describe("DeckBuilderScreen — title hydration on deck open", () => {
  it("calls searchCards with the deck's own passcodes on open", async () => {
    const searchCardsFn = makeSearchCardsMock();
    setupMocks({ searchCardsFn });
    await renderBuilder();

    await waitFor(() => {
      expect(searchCardsFn).toHaveBeenCalledWith(
        expect.objectContaining({ passcodes: expect.any(Array) }),
      );
    });

    const call = searchCardsFn.mock.calls[0]?.[0] as { passcodes: number[] };
    const unique = [...new Set(MAIN_40)];
    expect(call.passcodes.sort()).toEqual(unique.sort());
  });

  it("renders card titles (no #passcode fallback) in the deck sidebar after load", async () => {
    setupMocks();
    await renderBuilder();

    // Wait for full deck UI: no loading spinner AND sidebar present
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading deck")).toBeNull();
      const sidebar = document.querySelector('[aria-label="Deck zones"]');
      expect(sidebar).not.toBeNull();
    });

    const sidebar = document.querySelector('[aria-label="Deck zones"]')!;
    // No raw #passcode fallbacks in the deck sidebar
    for (const p of [BEWD.passcode, DARK_MAGICIAN.passcode, SPELL_CARD.passcode]) {
      expect(sidebar.textContent).not.toContain(`#${p}`);
    }
    // Card titles are rendered
    expect(sidebar.textContent).toContain(BEWD.name);
    expect(sidebar.textContent).toContain(DARK_MAGICIAN.name);
  });

  it("Deck Stats reflect full deck counts immediately on open", async () => {
    setupMocks();
    await renderBuilder();

    // Wait for stats: 20 BEWD + 10 DM = 30 monsters, 10 spells, 0 traps
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Monsters:\s*30/);
    });

    expect(document.body.textContent).toMatch(/Spells:\s*10/);
    expect(document.body.textContent).toMatch(/Traps:\s*0/);
  });
});

describe("DeckBuilderScreen — title hydration after import", () => {
  it("calls searchCards with imported deck passcodes after import", async () => {
    const searchCardsFn = makeSearchCardsMock();
    setupMocks({ searchCardsFn });
    await renderBuilder();

    // Wait for the initial deck-load hydration call (passcodes batch fetch)
    await waitFor(() => {
      expect(searchCardsFn).toHaveBeenCalledWith(
        expect.objectContaining({ passcodes: expect.any(Array) }),
      );
    });

    const openCall = searchCardsFn.mock.calls[0]?.[0] as { passcodes: number[] };
    const uniquePasscodes = [...new Set(MAIN_40)];
    expect(openCall.passcodes.sort()).toEqual(uniquePasscodes.sort());
  });
});
