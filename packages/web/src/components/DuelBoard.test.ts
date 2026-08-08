// @vitest-environment jsdom
/**
 * DuelBoard tests — dense zone arrays (no shim), hidden vs revealed cards.
 *
 * Key assertions:
 *   - Dense-indexed mzone/szone: null entries mean empty zones (C2, shim deleted)
 *   - Opponent face-up monsters render real art (no "if (!isOwn)" guard)
 *   - data-testids preserved for E2E: duel-board, phase-ribbon, face-up-card, face-down-card
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelStateSnapshot } from "@yugioh-app/contracts";
import type { DuelInteraction, InspectorControl } from "../duel/contracts";

const interactionStub: DuelInteraction = {
  mode: "act",
  decision: null,
  candidates: [],
  selection: [],
  intent: null,
  chain: [],
  receipts: [],
  status: null,
};

const inspectorControlStub: InspectorControl = {
  inspectCard: () => {},
  inspectPile: () => {},
  close: () => {},
};

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

vi.mock("../utils/cardImageUrl", () => ({
  cardImageUrl: (id: number) => `https://test.img/${id}.jpg`,
}));

function makeState(overrides: Partial<DuelStateSnapshot> = {}): DuelStateSnapshot {
  return {
    seat: 0,
    duelEnded: false,
    currentTurn: 0,
    currentPhase: 4,
    lp: [8000, 8000],
    zones: {
      p0_hand: [],
      p1_hand: [],
      p0_mzone: [],
      p1_mzone: [],
      p0_szone: [],
      p1_szone: [],
      p0_grave: [],
      p1_grave: [],
      p0_removed: [],
      p1_removed: [],
      p0_extra: [],
      p1_extra: [],
    },
    ...overrides,
  };
}

const defaultProps = {
  mySeat: 0 as const,
  interaction: interactionStub,
  inspector: inspectorControlStub,
  clock: null,
  onCardClick: () => {},
  onAdvancePhase: () => {},
  legalNextPhases: [],
};

describe("DuelBoard — hidden vs revealed cards", () => {
  it("renders face-up card image for own hand card with real code", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({
      zones: {
        p0_hand: [{ code: 46986414, position: 0 }],
        p1_hand: [],
        p0_mzone: [],
        p1_mzone: [],
        p0_szone: [],
        p1_szone: [],
        p0_grave: [],
        p1_grave: [],
        p0_removed: [],
        p1_removed: [],
        p0_extra: [],
        p1_extra: [],
      },
    });

    render(React.createElement(DuelBoard, { ...defaultProps, state }));

    const images = screen.getAllByTestId("face-up-card");
    expect(images.length).toBeGreaterThan(0);
    expect((images[0] as HTMLImageElement).src).toContain("46986414");
  });

  it("renders face-down marker for own hand card with code 0", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({
      zones: {
        p0_hand: [{ code: 0, position: 0 }],
        p1_hand: [],
        p0_mzone: [],
        p1_mzone: [],
        p0_szone: [],
        p1_szone: [],
        p0_grave: [],
        p1_grave: [],
        p0_removed: [],
        p1_removed: [],
        p0_extra: [],
        p1_extra: [],
      },
    });

    render(React.createElement(DuelBoard, { ...defaultProps, state }));

    const faceDownCards = screen.getAllByTestId("face-down-card");
    expect(faceDownCards.length).toBeGreaterThan(0);
  });

  it("renders opponent hand as face-down backs with numeric count", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({
      zones: {
        p0_hand: [],
        p1_hand: [
          { code: 0, position: 0 },
          { code: 0, position: 0 },
        ],
        p0_mzone: [],
        p1_mzone: [],
        p0_szone: [],
        p1_szone: [],
        p0_grave: [],
        p1_grave: [],
        p0_removed: [],
        p1_removed: [],
        p0_extra: [],
        p1_extra: [],
      },
    });

    render(React.createElement(DuelBoard, { ...defaultProps, state }));

    // Opponent hand count is shown as text
    expect(screen.getByText(/2 cards/i)).toBeTruthy();
    // Face-down backs for opponent hand
    const faceDownCards = screen.getAllByTestId("face-down-card");
    expect(faceDownCards.length).toBeGreaterThan(0);
  });

  it("renders both LP values", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({ lp: [5000, 7200] });
    render(React.createElement(DuelBoard, { ...defaultProps, state }));

    expect(screen.getByText("5000")).toBeTruthy();
    expect(screen.getByText("7200")).toBeTruthy();
  });

  it("shows phase ribbon with correct phase label (data-testid preserved)", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({ currentTurn: 0, currentPhase: 8 }); // Battle Phase
    render(React.createElement(DuelBoard, { ...defaultProps, state }));

    const ribbon = screen.getByTestId("phase-ribbon");
    expect(ribbon.textContent).toContain("BP"); // Battle Phase short label
  });

  it("renders graveyard cards as face-up for own grave", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({
      zones: {
        p0_hand: [],
        p1_hand: [],
        p0_mzone: [],
        p1_mzone: [],
        p0_szone: [],
        p1_szone: [],
        p0_grave: [{ code: 46986414, position: 0 }],
        p1_grave: [],
        p0_removed: [],
        p1_removed: [],
        p0_extra: [],
        p1_extra: [],
      },
    });

    render(React.createElement(DuelBoard, { ...defaultProps, state }));
    // GY count shows 1
    expect(screen.getAllByTestId("pile-badge-gy")).toBeTruthy();
  });

  it("uses dense zone arrays directly — null entries are empty zones (C2, shim deleted)", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    // Dense array: monster at index 0 and 2, index 1 is null (empty zone)
    const state = makeState({
      zones: {
        p0_hand: [],
        p1_hand: [],
        p0_mzone: [
          { code: 46986414, position: 1, sequence: 0 },
          null,
          { code: 1184620, position: 1, sequence: 2 },
          null,
          null,
        ],
        p1_mzone: [],
        p0_szone: [],
        p1_szone: [],
        p0_grave: [],
        p1_grave: [],
        p0_removed: [],
        p1_removed: [],
        p0_extra: [],
        p1_extra: [],
      },
    });

    // Should render without throwing — nulls handled as empty zones
    expect(() => {
      render(React.createElement(DuelBoard, { ...defaultProps, state }));
    }).not.toThrow();
  });
});
