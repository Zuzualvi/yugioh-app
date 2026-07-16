// @vitest-environment jsdom
/**
 * ChainPromptPanel tests — verify renders, response shape, layout tiers, a11y.
 *
 * §7 priority/chain window:
 *   - Desktop: shows selects list directly + [Pass] when !forced
 *   - Mobile: compact [Respond ▸] / [Pass]; [Respond ▸] expands selects list
 *   - forced=true: no Pass button
 *   - null index = pass
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function activeCard(n = 1) {
  return {
    code: 46986400 + n,
    name: `Card ${n}`,
    controller: 0 as const,
    location: "HAND" as const,
    sequence: n,
    description: `Effect ${n}`,
  };
}

function baseDecision(
  overrides: Partial<Extract<DuelDecision, { kind: "ChainPrompt" }>> = {},
): Extract<DuelDecision, { kind: "ChainPrompt" }> {
  return {
    kind: "ChainPrompt",
    player: 0,
    forced: false,
    selects: [],
    ...overrides,
  };
}

async function renderPanel(
  decision: Extract<DuelDecision, { kind: "ChainPrompt" }>,
  respond = vi.fn(),
  layoutTier: "phone" | "tablet" | "desktop" = "desktop",
) {
  const { default: ChainPromptPanel } = await import("./ChainPromptPanel");
  render(
    React.createElement(ChainPromptPanel, {
      decision,
      respond,
      layoutTier,
    }),
  );
  return respond;
}

// ── Desktop rendering ──────────────────────────────────────────────────────────

describe("ChainPromptPanel desktop — rendering", () => {
  it("renders selects list directly on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1), activeCard(2)] });
    await renderPanel(decision, vi.fn(), "desktop");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(2);
    expect(btns.some((b) => /Card 1/i.test(b.textContent ?? ""))).toBe(true);
    expect(btns.some((b) => /Card 2/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("renders Pass button on desktop when !forced", async () => {
    const decision = baseDecision({ forced: false, selects: [activeCard(1)] });
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });

  it("does NOT render Pass when forced=true on desktop", async () => {
    const decision = baseDecision({ forced: true, selects: [activeCard(1)] });
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.queryByTestId("pass-option")).toBeNull();
  });

  it("renders option count text on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1)] });
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getByText(/1 option available/i)).toBeTruthy();
  });
});

// ── Mobile rendering ──────────────────────────────────────────────────────────

describe("ChainPromptPanel phone — rendering", () => {
  it("shows [Respond] and [Pass] buttons initially on phone", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    await renderPanel(decision, vi.fn(), "phone");
    // [Respond ▸] button
    const respondBtn = screen.getByTestId("action-option");
    expect(respondBtn).toBeTruthy();
    expect(/Respond/i.test(respondBtn.textContent ?? "")).toBe(true);
    // [Pass] button
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });

  it("expands selects list on phone when Respond clicked", async () => {
    const decision = baseDecision({ selects: [activeCard(1), activeCard(2)], forced: false });
    await renderPanel(decision, vi.fn(), "phone");
    const respondBtn = screen.getByTestId("action-option");
    fireEvent.click(respondBtn);
    // Now the selects list should appear
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Card 1/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("does NOT show Pass when forced on phone", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: true });
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.queryByTestId("pass-option")).toBeNull();
  });

  it("renders tablet tier same as mobile (compact)", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    await renderPanel(decision, vi.fn(), "tablet");
    // tablet is compact too
    const respondBtn = screen.getByTestId("action-option");
    expect(/Respond/i.test(respondBtn.textContent ?? "")).toBe(true);
  });
});

// ── Response emission ──────────────────────────────────────────────────────────

describe("ChainPromptPanel — response", () => {
  it("emits index=0 when first select activated on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1), activeCard(2)] });
    const respond = await renderPanel(decision, vi.fn(), "desktop");
    const btns = screen.getAllByTestId("action-option");
    const firstOption = btns.find((b) => /Card 1/i.test(b.textContent ?? ""));
    fireEvent.click(firstOption!);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits index=1 for second select on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1), activeCard(2)] });
    const respond = await renderPanel(decision, vi.fn(), "desktop");
    const btns = screen.getAllByTestId("action-option");
    const secondOption = btns.find((b) => /Card 2/i.test(b.textContent ?? ""));
    fireEvent.click(secondOption!);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: 1,
    } satisfies DuelDecisionResponse);
  });

  it("emits index=null (pass) when Pass clicked on desktop", async () => {
    const decision = baseDecision({ selects: [], forced: false });
    const respond = await renderPanel(decision, vi.fn(), "desktop");
    const passBtn = screen.getByTestId("pass-option");
    fireEvent.click(passBtn);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("emits pass=null from phone pass button (no expand)", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    const respond = await renderPanel(decision, vi.fn(), "phone");
    const passBtn = screen.getByTestId("pass-option");
    fireEvent.click(passBtn);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("emits index after expand on phone", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    const respond = await renderPanel(decision, vi.fn(), "phone");
    // click Respond to expand
    const respondBtn = screen.getByTestId("action-option");
    fireEvent.click(respondBtn);
    // Now Card 1 should be in the list
    const btns = screen.getAllByTestId("action-option");
    const cardBtn = btns.find((b) => /Card 1/i.test(b.textContent ?? ""));
    fireEvent.click(cardBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("does not emit when disabled", async () => {
    const { default: ChainPromptPanel } = await import("./ChainPromptPanel");
    const respond = vi.fn();
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    render(
      React.createElement(ChainPromptPanel, {
        decision,
        respond,
        layoutTier: "desktop",
        disabled: true,
      }),
    );
    const btns = screen.getAllByTestId("action-option");
    btns.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
    const passBtn = screen.getByTestId("pass-option");
    expect((passBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────────

describe("ChainPromptPanel — a11y", () => {
  it("all interactive buttons have minHeight >= 44px on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    await renderPanel(decision, vi.fn(), "desktop");
    const actionBtns = screen.getAllByTestId("action-option");
    const passBtns = screen.getAllByTestId("pass-option");
    [...actionBtns, ...passBtns].forEach((btn) => {
      const minH = parseInt((btn as HTMLElement).style.minHeight, 10);
      expect(minH).toBeGreaterThanOrEqual(44);
    });
  });

  it("buttons are keyboard-reachable on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1)], forced: false });
    await renderPanel(decision, vi.fn(), "desktop");
    const allBtns = [
      ...screen.getAllByTestId("action-option"),
      ...screen.getAllByTestId("pass-option"),
    ];
    allBtns.forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });

  it("pass button has aria-label", async () => {
    const decision = baseDecision({ forced: false, selects: [] });
    await renderPanel(decision, vi.fn(), "desktop");
    const passBtn = screen.getByTestId("pass-option");
    expect((passBtn as HTMLElement).getAttribute("aria-label")).toBeTruthy();
  });

  it("container has role=group with aria-label", async () => {
    const decision = baseDecision({ selects: [activeCard(1)] });
    await renderPanel(decision, vi.fn(), "desktop");
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBeTruthy();
  });

  it("option count has aria-live=polite on desktop", async () => {
    const decision = baseDecision({ selects: [activeCard(1)] });
    await renderPanel(decision, vi.fn(), "desktop");
    const liveEl = document.querySelector("[aria-live='polite']");
    expect(liveEl).toBeTruthy();
  });
});
