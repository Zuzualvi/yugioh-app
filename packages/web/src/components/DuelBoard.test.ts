// @vitest-environment jsdom
/**
 * DuelBoard tests — hidden vs revealed cards (code:0 → face-down).
 * Uses React.createElement (not JSX) per vitest .test.ts convention.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelStateSnapshot } from "@yugioh-app/contracts";

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

    render(React.createElement(DuelBoard, { state, mySeat: 0 }));

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

    render(React.createElement(DuelBoard, { state, mySeat: 0 }));

    const faceDownCards = screen.getAllByTestId("face-down-card");
    expect(faceDownCards.length).toBeGreaterThan(0);
  });

  it("renders opponent hand as face-down backs regardless of code", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    // Opponent's hand has code 0 (hidden from us)
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

    render(React.createElement(DuelBoard, { state, mySeat: 0 }));

    // Opponent hand count is shown
    expect(screen.getByText(/2 cards/i)).toBeTruthy();
    // No face-up card images for the opponent hand
    const images = screen.queryAllByTestId("face-up-card");
    expect(images).toHaveLength(0);
  });

  it("renders both LP values", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({ lp: [5000, 7200] });
    render(React.createElement(DuelBoard, { state, mySeat: 0 }));

    expect(screen.getByText("5000")).toBeTruthy();
    expect(screen.getByText("7200")).toBeTruthy();
  });

  it("shows turn/phase ribbon with correct phase label", async () => {
    const { DuelBoard } = await import("./DuelBoard");

    const state = makeState({ currentTurn: 0, currentPhase: 8 }); // Battle phase
    render(React.createElement(DuelBoard, { state, mySeat: 0 }));

    const ribbon = screen.getByTestId("phase-ribbon");
    expect(ribbon.textContent).toContain("Battle");
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

    render(React.createElement(DuelBoard, { state, mySeat: 0 }));
    const images = screen.getAllByTestId("face-up-card");
    expect(images.length).toBeGreaterThan(0);
  });
});
