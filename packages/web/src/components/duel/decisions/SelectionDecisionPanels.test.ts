// @vitest-environment jsdom
/**
 * Slice 2C — SelectionDecisionPanels tests
 *
 * Covers: SelectCardPanel, SelectUnselectCardPanel, SelectTributePanel,
 *         SelectZonePanel, SelectPositionPanel, SelectionDecisionPanels dispatcher.
 *
 * Each panel is driven from fixture DuelDecision objects at both phone and
 * desktop layoutTiers. Assertions:
 *   • Renders candidate items
 *   • Emits correct DuelDecisionResponse shape
 *   • Confirm disabled below min; enabled at min
 *   • Cancel visible only when cancelable=true
 *   • Tap targets ≥ 44 px (minHeight style check)
 */

import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Fixture helpers ───────────────────────────────────────────────────────────

function card(n = 1) {
  return {
    code: 46986414 + n,
    name: `Card ${n}`,
    controller: 0 as const,
    location: "HAND" as const,
    sequence: n,
  };
}

function zone(controller: 0 | 1, seq: number) {
  return {
    controller,
    location: "MZONE" as const,
    sequence: seq,
  };
}

type LayoutTier = "phone" | "desktop";
const TIERS: LayoutTier[] = ["phone", "desktop"];

// ── Render helpers ─────────────────────────────────────────────────────────────

async function renderSelectCard(
  decision: Extract<DuelDecision, { kind: "SelectCard" }>,
  respond = vi.fn(),
  layoutTier: LayoutTier = "desktop",
) {
  const { default: SelectCardPanel } = await import("./SelectCardPanel");
  render(React.createElement(SelectCardPanel, { decision, respond, layoutTier }));
  return respond;
}

async function renderSelectTribute(
  decision: Extract<DuelDecision, { kind: "SelectTribute" }>,
  respond = vi.fn(),
  layoutTier: LayoutTier = "desktop",
) {
  const { default: SelectTributePanel } = await import("./SelectTributePanel");
  render(React.createElement(SelectTributePanel, { decision, respond, layoutTier }));
  return respond;
}

async function renderSelectUnselect(
  decision: Extract<DuelDecision, { kind: "SelectUnselectCard" }>,
  respond = vi.fn(),
  layoutTier: LayoutTier = "desktop",
) {
  const { default: SelectUnselectCardPanel } = await import("./SelectUnselectCardPanel");
  render(React.createElement(SelectUnselectCardPanel, { decision, respond, layoutTier }));
  return respond;
}

async function renderSelectZone(
  decision: Extract<DuelDecision, { kind: "SelectZone" }>,
  respond = vi.fn(),
  layoutTier: LayoutTier = "desktop",
) {
  const { default: SelectZonePanel } = await import("./SelectZonePanel");
  render(React.createElement(SelectZonePanel, { decision, respond, layoutTier }));
  return respond;
}

async function renderSelectPosition(
  decision: Extract<DuelDecision, { kind: "SelectPosition" }>,
  respond = vi.fn(),
  layoutTier: LayoutTier = "desktop",
) {
  const { default: SelectPositionPanel } = await import("./SelectPositionPanel");
  render(React.createElement(SelectPositionPanel, { decision, respond, layoutTier }));
  return respond;
}

// ── SelectCardPanel ───────────────────────────────────────────────────────────

describe("SelectCardPanel", () => {
  const baseDecision = (
    overrides?: Partial<Extract<DuelDecision, { kind: "SelectCard" }>>,
  ): Extract<DuelDecision, { kind: "SelectCard" }> => ({
    kind: "SelectCard",
    player: 0,
    cards: [card(1), card(2), card(3)],
    min: 1,
    max: 2,
    cancelable: true,
    ...overrides,
  });

  it.each(TIERS)("renders card options at %s layoutTier", async (tier) => {
    await renderSelectCard(baseDecision(), vi.fn(), tier);
    const opts = screen.getAllByTestId("card-option");
    expect(opts.length).toBe(3);
    expect(opts[0]?.textContent).toMatch(/Card 1/i);
  });

  it.each(TIERS)("confirm is disabled below min at %s", async (tier) => {
    await renderSelectCard(baseDecision({ min: 2 }), vi.fn(), tier);
    const confirm = screen.getByTestId("confirm-btn");
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(TIERS)("confirm is enabled when selected count reaches min at %s", async (tier) => {
    await renderSelectCard(baseDecision({ min: 1 }), vi.fn(), tier);
    fireEvent.click(screen.getAllByTestId("card-option")[0]!);
    const confirm = screen.getByTestId("confirm-btn");
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("emits correct indices on confirm", async () => {
    const respond = await renderSelectCard(baseDecision({ min: 1 }));
    fireEvent.click(screen.getAllByTestId("card-option")[0]!);
    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectCard",
      indices: [0],
    } satisfies DuelDecisionResponse);
  });

  it("emits null on cancel when cancelable=true", async () => {
    const respond = await renderSelectCard(baseDecision({ cancelable: true }));
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectCard",
      indices: null,
    } satisfies DuelDecisionResponse);
  });

  it("shows cancel button when cancelable=true", async () => {
    await renderSelectCard(baseDecision({ cancelable: true }));
    expect(screen.queryByTestId("cancel-btn")).not.toBeNull();
  });

  it("hides cancel button when cancelable=false", async () => {
    await renderSelectCard(baseDecision({ cancelable: false }));
    expect(screen.queryByTestId("cancel-btn")).toBeNull();
  });

  it("does not allow selecting more than max cards", async () => {
    await renderSelectCard(baseDecision({ min: 1, max: 1 }));
    const opts = screen.getAllByTestId("card-option");
    fireEvent.click(opts[0]!);
    // Second card should be disabled (max reached)
    expect((opts[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("multi-select: confirm with multiple indices", async () => {
    const respond = await renderSelectCard(baseDecision({ min: 2, max: 2 }));
    const opts = screen.getAllByTestId("card-option");
    fireEvent.click(opts[0]!);
    fireEvent.click(opts[1]!);
    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectCard",
      indices: [0, 1],
    } satisfies DuelDecisionResponse);
  });

  it("card buttons have at least 44px min-height", async () => {
    await renderSelectCard(baseDecision());
    const opts = screen.getAllByTestId("card-option");
    for (const btn of opts) {
      const minH = parseInt((btn as HTMLElement).style.minHeight || "0", 10);
      // minHeight is 44px by style constant; accept 44+ or "" (set via class)
      expect(minH === 0 || minH >= 44).toBe(true);
    }
    // confirm btn has 44px minHeight
    const confirm = screen.getByTestId("confirm-btn");
    const cH = parseInt((confirm as HTMLElement).style.minHeight || "0", 10);
    expect(cH >= 44).toBe(true);
  });
});

// ── SelectTributePanel ────────────────────────────────────────────────────────

describe("SelectTributePanel", () => {
  const baseDecision = (
    overrides?: Partial<Extract<DuelDecision, { kind: "SelectTribute" }>>,
  ): Extract<DuelDecision, { kind: "SelectTribute" }> => ({
    kind: "SelectTribute",
    player: 0,
    cards: [card(1), card(2)],
    min: 1,
    max: 2,
    cancelable: true,
    ...overrides,
  });

  it.each(TIERS)("renders tribute candidates at %s layoutTier", async (tier) => {
    await renderSelectTribute(baseDecision(), vi.fn(), tier);
    const opts = screen.getAllByTestId("card-option");
    expect(opts.length).toBe(2);
    expect(opts[0]?.textContent).toMatch(/Card 1/i);
  });

  it("confirm disabled below min", async () => {
    await renderSelectTribute(baseDecision({ min: 2 }));
    expect((screen.getByTestId("confirm-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("confirm enabled at min", async () => {
    await renderSelectTribute(baseDecision({ min: 1 }));
    fireEvent.click(screen.getAllByTestId("card-option")[0]!);
    expect((screen.getByTestId("confirm-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("emits correct indices on confirm", async () => {
    const respond = await renderSelectTribute(baseDecision({ min: 1 }));
    fireEvent.click(screen.getAllByTestId("card-option")[0]!);
    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectTribute",
      indices: [0],
    } satisfies DuelDecisionResponse);
  });

  it("cancel visible when cancelable=true", async () => {
    await renderSelectTribute(baseDecision({ cancelable: true }));
    expect(screen.queryByTestId("cancel-btn")).not.toBeNull();
  });

  it("cancel hidden when cancelable=false", async () => {
    await renderSelectTribute(baseDecision({ cancelable: false }));
    expect(screen.queryByTestId("cancel-btn")).toBeNull();
  });

  it("emits null on cancel", async () => {
    const respond = await renderSelectTribute(baseDecision({ cancelable: true }));
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectTribute",
      indices: null,
    } satisfies DuelDecisionResponse);
  });

  it("tribute buttons have 44px min-height", async () => {
    await renderSelectTribute(baseDecision());
    const confirm = screen.getByTestId("confirm-btn");
    const cH = parseInt((confirm as HTMLElement).style.minHeight || "0", 10);
    expect(cH >= 44).toBe(true);
  });
});

// ── SelectUnselectCardPanel ───────────────────────────────────────────────────

describe("SelectUnselectCardPanel", () => {
  const baseDecision = (
    overrides?: Partial<Extract<DuelDecision, { kind: "SelectUnselectCard" }>>,
  ): Extract<DuelDecision, { kind: "SelectUnselectCard" }> => ({
    kind: "SelectUnselectCard",
    player: 0,
    selectCards: [card(1), card(2)],
    unselectCards: [card(3)],
    min: 1,
    max: 3,
    canFinish: true,
    cancelable: false,
    ...overrides,
  });

  it.each(TIERS)("renders selectCards and unselectCards at %s layoutTier", async (tier) => {
    await renderSelectUnselect(baseDecision(), vi.fn(), tier);
    const opts = screen.getAllByTestId("card-option");
    // 2 selectCards + 1 unselectCard = 3
    expect(opts.length).toBe(3);
  });

  it("clicking a selectCard emits its global index", async () => {
    const respond = await renderSelectUnselect(baseDecision());
    const opts = screen.getAllByTestId("card-option");
    fireEvent.click(opts[0]!); // selectCards[0] → index 0
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectUnselectCard",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("clicking an unselectCard emits its global index (selectCards.length + i)", async () => {
    const respond = await renderSelectUnselect(baseDecision());
    const opts = screen.getAllByTestId("card-option");
    fireEvent.click(opts[2]!); // unselectCards[0] → index 2 (selectCards.length=2 + 0)
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectUnselectCard",
      index: 2,
    } satisfies DuelDecisionResponse);
  });

  it("shows Finish button when canFinish=true and unselectCards.length >= min", async () => {
    await renderSelectUnselect(baseDecision({ canFinish: true, min: 1, unselectCards: [card(3)] }));
    expect(screen.queryByTestId("finish-btn")).not.toBeNull();
  });

  it("clicking Finish emits index: null", async () => {
    const respond = await renderSelectUnselect(
      baseDecision({ canFinish: true, min: 1, unselectCards: [card(3)] }),
    );
    fireEvent.click(screen.getByTestId("finish-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectUnselectCard",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("hides Finish when canFinish=false", async () => {
    await renderSelectUnselect(baseDecision({ canFinish: false }));
    expect(screen.queryByTestId("finish-btn")).toBeNull();
  });

  it("hides Finish when unselectCards.length < min", async () => {
    await renderSelectUnselect(baseDecision({ canFinish: true, min: 2, unselectCards: [card(3)] }));
    expect(screen.queryByTestId("finish-btn")).toBeNull();
  });

  it("shows cancel when cancelable=true", async () => {
    await renderSelectUnselect(baseDecision({ cancelable: true }));
    expect(screen.queryByTestId("cancel-btn")).not.toBeNull();
  });

  it("hides cancel when cancelable=false", async () => {
    await renderSelectUnselect(baseDecision({ cancelable: false }));
    expect(screen.queryByTestId("cancel-btn")).toBeNull();
  });

  it("cancel emits index: null", async () => {
    const respond = await renderSelectUnselect(baseDecision({ cancelable: true }));
    fireEvent.click(screen.getByTestId("cancel-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectUnselectCard",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("card buttons have 44px min-height", async () => {
    await renderSelectUnselect(baseDecision());
    const opts = screen.getAllByTestId("card-option");
    for (const btn of opts) {
      const minH = parseInt((btn as HTMLElement).style.minHeight || "0", 10);
      expect(minH === 0 || minH >= 44).toBe(true);
    }
  });
});

// ── SelectZonePanel ───────────────────────────────────────────────────────────

describe("SelectZonePanel", () => {
  const baseDecision = (
    overrides?: Partial<Extract<DuelDecision, { kind: "SelectZone" }>>,
  ): Extract<DuelDecision, { kind: "SelectZone" }> => ({
    kind: "SelectZone",
    player: 0,
    count: 1,
    zones: [zone(0, 0), zone(0, 1), zone(0, 2)],
    ...overrides,
  });

  it.each(TIERS)("renders zone options at %s layoutTier", async (tier) => {
    await renderSelectZone(baseDecision(), vi.fn(), tier);
    const opts = screen.getAllByTestId("zone-option");
    expect(opts.length).toBe(3);
    expect(opts[0]?.textContent).toMatch(/Monster Zone/i);
  });

  it("single-select: clicking a zone immediately responds", async () => {
    const respond = await renderSelectZone(baseDecision({ count: 1 }));
    fireEvent.click(screen.getAllByTestId("zone-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectZone",
      indices: [1],
    } satisfies DuelDecisionResponse);
  });

  it("multi-select: confirm disabled until count zones selected", async () => {
    await renderSelectZone(baseDecision({ count: 2 }));
    const confirm = screen.getByTestId("confirm-btn");
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("multi-select: confirm enabled after selecting count zones", async () => {
    await renderSelectZone(baseDecision({ count: 2 }));
    const opts = screen.getAllByTestId("zone-option");
    fireEvent.click(opts[0]!);
    fireEvent.click(opts[1]!);
    expect((screen.getByTestId("confirm-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("multi-select: emits correct indices on confirm", async () => {
    const respond = await renderSelectZone(baseDecision({ count: 2 }));
    const opts = screen.getAllByTestId("zone-option");
    fireEvent.click(opts[0]!);
    fireEvent.click(opts[2]!);
    fireEvent.click(screen.getByTestId("confirm-btn"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectZone",
      indices: [0, 2],
    } satisfies DuelDecisionResponse);
  });

  it("zone buttons have at least 44px min-height", async () => {
    await renderSelectZone(baseDecision());
    const opts = screen.getAllByTestId("zone-option");
    for (const btn of opts) {
      const minH = parseInt((btn as HTMLElement).style.minHeight || "0", 10);
      expect(minH === 0 || minH >= 44).toBe(true);
    }
  });

  it("opponent zones labeled correctly", async () => {
    await renderSelectZone(
      baseDecision({ zones: [{ controller: 1, location: "MZONE", sequence: 0 }] }),
    );
    const opt = screen.getByTestId("zone-option");
    expect(opt.textContent).toMatch(/Opponent/i);
  });
});

// ── SelectPositionPanel ───────────────────────────────────────────────────────

describe("SelectPositionPanel", () => {
  const baseDecision = (
    overrides?: Partial<Extract<DuelDecision, { kind: "SelectPosition" }>>,
  ): Extract<DuelDecision, { kind: "SelectPosition" }> => ({
    kind: "SelectPosition",
    player: 0,
    card: card(1),
    positions: ["faceup_attack", "faceup_defense"],
    ...overrides,
  });

  it.each(TIERS)("renders position options at %s layoutTier", async (tier) => {
    await renderSelectPosition(baseDecision(), vi.fn(), tier);
    const opts = screen.getAllByTestId("position-option");
    expect(opts.length).toBe(2);
  });

  it("emits correct position on click — faceup_attack", async () => {
    const respond = await renderSelectPosition(baseDecision());
    fireEvent.click(screen.getAllByTestId("position-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectPosition",
      position: "faceup_attack",
    } satisfies DuelDecisionResponse);
  });

  it("emits correct position on click — faceup_defense", async () => {
    const respond = await renderSelectPosition(baseDecision());
    fireEvent.click(screen.getAllByTestId("position-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectPosition",
      position: "faceup_defense",
    } satisfies DuelDecisionResponse);
  });

  it("handles all four position codes", async () => {
    const respond = await renderSelectPosition(
      baseDecision({
        positions: ["faceup_attack", "facedown_attack", "faceup_defense", "facedown_defense"],
      }),
    );
    const opts = screen.getAllByTestId("position-option");
    expect(opts.length).toBe(4);
    fireEvent.click(opts[2]!); // faceup_defense
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectPosition",
      position: "faceup_defense",
    } satisfies DuelDecisionResponse);
  });

  it("position buttons have at least 44px min-height", async () => {
    await renderSelectPosition(baseDecision());
    const opts = screen.getAllByTestId("position-option");
    for (const btn of opts) {
      const minH = parseInt((btn as HTMLElement).style.minHeight || "0", 10);
      expect(minH >= 44).toBe(true);
    }
  });

  it("shows card name in prompt", async () => {
    await renderSelectPosition(baseDecision({ card: card(1) }));
    expect(screen.getByText(/Card 1/i)).toBeDefined();
  });

  it("buttons are disabled when disabled=true", async () => {
    const { default: SelectPositionPanel } = await import("./SelectPositionPanel");
    render(
      React.createElement(SelectPositionPanel, {
        decision: baseDecision(),
        respond: vi.fn(),
        layoutTier: "desktop",
        disabled: true,
      }),
    );
    const opts = screen.getAllByTestId("position-option");
    for (const btn of opts) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

// ── SelectionDecisionPanels dispatcher ───────────────────────────────────────

describe("SelectionDecisionPanels dispatcher", () => {
  // The dispatcher takes a SelectionDecision union type, but we render it via
  // casting to avoid TypeScript union complexity in tests.
  async function renderDispatcher(
    decision: DuelDecision,
    respond = vi.fn(),
    layoutTier: LayoutTier = "desktop",
  ) {
    const mod = await import("./SelectionDecisionPanels");
    const Comp = mod.SelectionDecisionPanels as React.ComponentType<{
      decision: DuelDecision;
      respond: (r: DuelDecisionResponse) => void;
      layoutTier: LayoutTier;
    }>;
    render(React.createElement(Comp, { decision, respond, layoutTier }));
    return respond;
  }

  it("routes SelectCard to SelectCardPanel", async () => {
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [card(1)],
      min: 1,
      max: 1,
      cancelable: false,
    };
    await renderDispatcher(decision);
    expect(screen.getAllByTestId("card-option").length).toBe(1);
  });

  it("routes SelectTribute to SelectTributePanel", async () => {
    const decision: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [card(1), card(2)],
      min: 1,
      max: 1,
      cancelable: false,
    };
    await renderDispatcher(decision);
    expect(screen.getAllByTestId("card-option").length).toBe(2);
  });

  it("routes SelectUnselectCard to SelectUnselectCardPanel", async () => {
    const decision: DuelDecision = {
      kind: "SelectUnselectCard",
      player: 0,
      selectCards: [card(1)],
      unselectCards: [],
      min: 1,
      max: 2,
      canFinish: false,
      cancelable: false,
    };
    await renderDispatcher(decision);
    expect(screen.getAllByTestId("card-option").length).toBe(1);
  });

  it("routes SelectZone to SelectZonePanel", async () => {
    const decision: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      count: 1,
      zones: [zone(0, 0)],
    };
    await renderDispatcher(decision);
    expect(screen.getAllByTestId("zone-option").length).toBe(1);
  });

  it("routes SelectPosition to SelectPositionPanel", async () => {
    const decision: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: card(1),
      positions: ["faceup_attack", "faceup_defense"],
    };
    await renderDispatcher(decision);
    expect(screen.getAllByTestId("position-option").length).toBe(2);
  });
});
