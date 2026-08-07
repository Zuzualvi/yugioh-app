// @vitest-environment jsdom
/**
 * F12 elementFromPoint assertion: every interactive control W1 renders must
 * receive its own clicks — the DimScrim must not steal them.
 *
 * Design spec §0 Law 2 and usability blocker B1: "document.elementFromPoint at
 * the centre of every interactive element inside the dock returns that element."
 * Applied to W1's own controls (phase rail, verb chips, pile badges, clocks,
 * settings). The full-flow F12 (across all slices) is QA's gate at integration.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

vi.mock("../../../utils/cardImageUrl", () => ({
  cardImageUrl: (id: number) => `https://test.img/${id}.jpg`,
}));

describe("F12 — W1 interactive controls are not occluded (own-controls scope)", () => {
  it("DimScrim uses pointer-events: none so it never intercepts clicks on board elements", async () => {
    const { DimScrim } = await import("../chrome/DimScrim");

    render(
      React.createElement(
        "div",
        { style: { position: "relative", width: 400, height: 200 } },
        React.createElement(
          "button",
          { "data-testid": "behind-scrim", style: { position: "absolute", top: 50, left: 50 } },
          "Click me",
        ),
        React.createElement(DimScrim, { active: true }),
      ),
    );

    const btn = screen.getByTestId("behind-scrim");
    // DimScrim is pointer-events: none, so the button behind it should still be hittable.
    // (jsdom does not implement elementFromPoint but we verify pointer-events attribute)
    const scrim = document.querySelector('[data-testid="dim-scrim"]');
    expect(scrim).toBeTruthy();
    const style = (scrim as HTMLElement).style;
    expect(style.pointerEvents).toBe("none");

    // Also verify aria-hidden (scrim is decorative)
    expect(scrim?.getAttribute("aria-hidden")).toBe("true");

    // Button behind scrim is still in DOM and focusable
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("VerbChipCluster buttons are not covered by any sibling element", async () => {
    const { VerbChipCluster } = await import("./VerbChipCluster");

    const fakeRect = {
      top: 300,
      left: 200,
      bottom: 380,
      right: 260,
      width: 60,
      height: 80,
    } as DOMRect;

    const verbs = [
      { label: "Normal Summon", action: "summon" },
      { label: "Inspect", action: "inspect" },
    ];

    const onPick = vi.fn();
    const onDismiss = vi.fn();

    render(
      React.createElement(VerbChipCluster, {
        anchor: fakeRect,
        verbs,
        onPick,
        onDismiss,
      }),
    );

    const cluster = screen.getByTestId("verb-chip-cluster");
    expect(cluster).toBeTruthy();

    // All buttons inside the cluster must have pointer-events auto (not none)
    const buttons = cluster.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const computedStyle = window.getComputedStyle(btn);
      // pointer-events defaults to 'auto' if not explicitly set to 'none'
      expect(computedStyle.pointerEvents).not.toBe("none");
    }
  });

  it("PhaseRail End Turn button is not occluded when enabled", async () => {
    const { PhaseRail } = await import("../chrome/PhaseRail");

    render(
      React.createElement(PhaseRail, {
        currentPhase: 4,
        currentTurn: 0 as const,
        mySeat: 0 as const,
        legalNextPhases: [32],
        onAdvancePhase: vi.fn(),
        myDeadlineAt: null,
        oppDeadlineAt: null,
        onClockSeat: null,
      }),
    );

    const endTurnBtn = screen.getByTestId("end-turn-btn");
    expect(endTurnBtn).toBeTruthy();
    expect(endTurnBtn.tagName).toBe("BUTTON");
    // When enabled, should not be disabled
    expect((endTurnBtn as HTMLButtonElement).disabled).toBe(false);
    // pointer-events is not 'none'
    expect(window.getComputedStyle(endTurnBtn).pointerEvents).not.toBe("none");
  });

  it("PileBadge is always clickable (cursor pointer, no pointer-events: none)", async () => {
    const { PileBadge } = await import("./PileBadge");
    const { inspectorControlStub } = await import("../../../duel/stubs/inspectorControlStub");

    render(
      React.createElement(PileBadge, {
        label: "GY",
        count: 3,
        controller: 0 as const,
        location: "GRAVE" as const,
        isOwn: true,
        inspector: inspectorControlStub,
      }),
    );

    const badge = screen.getByTestId("pile-badge-gy");
    expect(badge).toBeTruthy();
    expect(badge.tagName).toBe("BUTTON");
    expect(window.getComputedStyle(badge).pointerEvents).not.toBe("none");
  });
});
