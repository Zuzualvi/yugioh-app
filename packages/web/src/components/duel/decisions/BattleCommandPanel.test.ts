// @vitest-environment jsdom
/**
 * BattleCommandPanel tests — verify renders, response shape, layout tiers, a11y.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function card(n = 1) {
  return {
    code: 46986400 + n,
    name: `Card ${n}`,
    controller: 0 as const,
    location: "MZONE" as const,
    sequence: n,
  };
}

function attackCard(n = 1, canDirectAttack = false) {
  return { ...card(n), canDirectAttack };
}

function activeCard(n = 1) {
  return { ...card(n), description: `Effect ${n}` };
}

function baseDecision(): Extract<DuelDecision, { kind: "BattleCommand" }> {
  return {
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: [],
    toMainPhase2: false,
    toEndPhase: false,
  };
}

async function renderPanel(
  decision: Extract<DuelDecision, { kind: "BattleCommand" }>,
  respond = vi.fn(),
  layoutTier: "phone" | "tablet" | "desktop" = "desktop",
) {
  const { default: BattleCommandPanel } = await import("./BattleCommandPanel");
  render(
    React.createElement(BattleCommandPanel, {
      decision,
      respond,
      layoutTier,
    }),
  );
  return respond;
}

// ── Rendering ──────────────────────────────────────────────────────────────────

describe("BattleCommandPanel — rendering", () => {
  it("renders attack option for a card in attacks[]", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1)] };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasAttack = btns.some((b) => /Card 1/i.test(b.textContent ?? ""));
    expect(hasAttack).toBe(true);
  });

  it("shows 'direct' label for canDirectAttack=true", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1, true)] };
    await renderPanel(decision);
    // aria-label should include "direct attack"
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /(direct attack)/i.test(b.getAttribute("aria-label") ?? ""));
    expect(btn).toBeTruthy();
  });

  it("renders chain option", async () => {
    const decision = { ...baseDecision(), chains: [activeCard(1)] };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasChain = btns.some((b) => /Card 1/i.test(b.textContent ?? ""));
    expect(hasChain).toBe(true);
  });

  it("renders Main Phase 2 when toMainPhase2=true", async () => {
    const decision = { ...baseDecision(), toMainPhase2: true };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasM2 = btns.some((b) => /Main Phase 2/i.test(b.textContent ?? ""));
    expect(hasM2).toBe(true);
  });

  it("renders End Phase when toEndPhase=true", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasEP = btns.some((b) => /End Phase/i.test(b.textContent ?? ""));
    expect(hasEP).toBe(true);
  });

  it("shows no-battle-actions when empty", async () => {
    await renderPanel(baseDecision());
    expect(screen.getByTestId("no-battle-actions")).toBeTruthy();
  });

  it("renders multiple attacks", async () => {
    const decision = {
      ...baseDecision(),
      attacks: [attackCard(1), attackCard(2), attackCard(3)],
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Response emission ──────────────────────────────────────────────────────────

describe("BattleCommandPanel — response", () => {
  it("emits attack response with correct index", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const attackBtn = btns.find((b) => /Card 1/i.test(b.textContent ?? ""));
    fireEvent.click(attackBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "attack",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits chain response with correct index", async () => {
    const decision = { ...baseDecision(), chains: [activeCard(1)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    fireEvent.click(btns[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "chain",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits toM2 with index=null", async () => {
    const decision = { ...baseDecision(), toMainPhase2: true };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /Main Phase 2/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "toM2",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("emits toEP with index=null", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /End Phase/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "toEP",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("does not emit when disabled", async () => {
    const { default: BattleCommandPanel } = await import("./BattleCommandPanel");
    const respond = vi.fn();
    const decision = { ...baseDecision(), attacks: [attackCard(1)] };
    render(
      React.createElement(BattleCommandPanel, {
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
  });

  it("emits attack index=1 for second attacker", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1), attackCard(2)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    // Second attack button (index 1)
    const secondAttack = btns.find((b) => /Card 2/i.test(b.textContent ?? ""));
    fireEvent.click(secondAttack!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "attack",
      index: 1,
    } satisfies DuelDecisionResponse);
  });
});

// ── Layout tier ────────────────────────────────────────────────────────────────

describe("BattleCommandPanel — layoutTier", () => {
  it("renders on phone tier", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1)], toEndPhase: true };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option").length).toBeGreaterThanOrEqual(2);
  });

  it("renders on tablet tier", async () => {
    const decision = { ...baseDecision(), toMainPhase2: true };
    await renderPanel(decision, vi.fn(), "tablet");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Main Phase 2/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("renders on desktop tier", async () => {
    const decision = { ...baseDecision(), chains: [activeCard(1)], attacks: [attackCard(2)] };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getAllByTestId("action-option").length).toBeGreaterThanOrEqual(2);
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────────

describe("BattleCommandPanel — a11y", () => {
  it("all action-option buttons have minHeight >= 44px", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1)], toEndPhase: true };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      const minH = parseInt((btn as HTMLElement).style.minHeight, 10);
      expect(minH).toBeGreaterThanOrEqual(44);
    });
  });

  it("buttons are keyboard-reachable (tabIndex != -1)", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1)] };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });

  it("buttons have aria-label", async () => {
    const decision = { ...baseDecision(), attacks: [attackCard(1, true)] };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLElement).getAttribute("aria-label")).toBeTruthy();
    });
  });

  it("container has role=group", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    await renderPanel(decision);
    const group = screen.getByRole("group");
    expect(group).toBeTruthy();
    expect(group.getAttribute("aria-label")).toBeTruthy();
  });
});
