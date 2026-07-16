// @vitest-environment jsdom
/**
 * IdleCommandPanel tests — verify renders, response shape, layout tiers, a11y.
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
    location: "HAND" as const,
    sequence: n,
  };
}

function activeCard(n = 1) {
  return { ...card(n), description: `Effect ${n}` };
}

function baseDecision(): Extract<DuelDecision, { kind: "IdleCommand" }> {
  return {
    kind: "IdleCommand",
    player: 0,
    summons: [],
    specialSummons: [],
    posChanges: [],
    monsterSets: [],
    spellSets: [],
    activates: [],
    toBattlePhase: false,
    toEndPhase: false,
  };
}

async function renderPanel(
  decision: Extract<DuelDecision, { kind: "IdleCommand" }>,
  respond = vi.fn(),
  layoutTier: "phone" | "tablet" | "desktop" = "desktop",
) {
  const { default: IdleCommandPanel } = await import("./IdleCommandPanel");
  render(
    React.createElement(IdleCommandPanel, {
      decision,
      respond,
      layoutTier,
    }),
  );
  return respond;
}

// ── Rendering ──────────────────────────────────────────────────────────────────

describe("IdleCommandPanel — rendering", () => {
  it("renders summon option for a card in summons[]", async () => {
    const decision = { ...baseDecision(), summons: [card(1)] };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option").length).toBeGreaterThanOrEqual(1);
    const btns = screen.getAllByTestId("action-option");
    const hasSummon = btns.some((b) => /Normal Summon/i.test(b.textContent ?? ""));
    expect(hasSummon).toBe(true);
  });

  it("renders End Phase button when toEndPhase=true", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasEP = btns.some((b) => /End Phase/i.test(b.textContent ?? ""));
    expect(hasEP).toBe(true);
  });

  it("renders Battle Phase button when toBattlePhase=true", async () => {
    const decision = { ...baseDecision(), toBattlePhase: true };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasBP = btns.some((b) => /Battle Phase/i.test(b.textContent ?? ""));
    expect(hasBP).toBe(true);
  });

  it("renders activate option with description", async () => {
    const decision = { ...baseDecision(), activates: [activeCard(1)] };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasActivate = btns.some((b) => /Activate/i.test(b.textContent ?? ""));
    expect(hasActivate).toBe(true);
  });

  it("shows 'no actions' message when decision is completely empty", async () => {
    await renderPanel(baseDecision());
    expect(screen.getByTestId("no-idle-actions")).toBeTruthy();
  });

  it("groups multiple actions for the same card (summon + monsterSet)", async () => {
    const c = card(1);
    const decision = {
      ...baseDecision(),
      summons: [c],
      monsterSets: [c],
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const hasSummon = btns.some((b) => /Normal Summon/i.test(b.textContent ?? ""));
    const hasSet = btns.some((b) => /Set/i.test(b.textContent ?? ""));
    expect(hasSummon).toBe(true);
    expect(hasSet).toBe(true);
  });

  it("renders all action types", async () => {
    const decision = {
      ...baseDecision(),
      summons: [card(1)],
      specialSummons: [card(2)],
      posChanges: [card(3)],
      monsterSets: [card(4)],
      spellSets: [card(5)],
      activates: [activeCard(6)],
      toBattlePhase: true,
      toEndPhase: true,
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(8);
  });
});

// ── Response emission ──────────────────────────────────────────────────────────

describe("IdleCommandPanel — response", () => {
  it("emits summon response with correct index on click", async () => {
    const decision = { ...baseDecision(), summons: [card(1), card(2)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const summonBtn = btns.find((b) => /Normal Summon/i.test(b.textContent ?? ""));
    fireEvent.click(summonBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "summon",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits specialSummon response", async () => {
    const decision = { ...baseDecision(), specialSummons: [card(1)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /Special Summon/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "specialSummon",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits posChange response", async () => {
    const decision = { ...baseDecision(), posChanges: [card(1)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /Change Position/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "posChange",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits activate response", async () => {
    const decision = { ...baseDecision(), activates: [activeCard(1)] };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /Activate/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "activate",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits toBP with index=null", async () => {
    const decision = { ...baseDecision(), toBattlePhase: true };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    const btn = btns.find((b) => /Battle Phase/i.test(b.textContent ?? ""));
    fireEvent.click(btn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "toBP",
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
      kind: "IdleCommand",
      action: "toEP",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("does not emit when disabled", async () => {
    const { default: IdleCommandPanel } = await import("./IdleCommandPanel");
    const respond = vi.fn();
    const decision = { ...baseDecision(), summons: [card(1)] };
    render(
      React.createElement(IdleCommandPanel, {
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
});

// ── Layout tier ────────────────────────────────────────────────────────────────

describe("IdleCommandPanel — layoutTier", () => {
  it("renders on phone tier", async () => {
    const decision = { ...baseDecision(), summons: [card(1)], toEndPhase: true };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option").length).toBeGreaterThanOrEqual(2);
  });

  it("renders on tablet tier", async () => {
    const decision = { ...baseDecision(), toBattlePhase: true };
    await renderPanel(decision, vi.fn(), "tablet");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Battle Phase/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("renders on desktop tier", async () => {
    const decision = { ...baseDecision(), activates: [activeCard(1)] };
    await renderPanel(decision, vi.fn(), "desktop");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Activate/i.test(b.textContent ?? ""))).toBe(true);
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────────

describe("IdleCommandPanel — a11y", () => {
  it("all action-option buttons have minHeight >= 44px via inline style", async () => {
    const decision = {
      ...baseDecision(),
      summons: [card(1)],
      toBattlePhase: true,
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      const style = (btn as HTMLElement).style;
      const minH = parseInt(style.minHeight, 10);
      expect(minH).toBeGreaterThanOrEqual(44);
    });
  });

  it("buttons are keyboard-reachable (not tabindex=-1)", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      const tabIndex = (btn as HTMLButtonElement).tabIndex;
      expect(tabIndex).not.toBe(-1);
    });
  });

  it("buttons have aria-label attributes", async () => {
    const decision = { ...baseDecision(), summons: [card(1)] };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    btns.forEach((btn) => {
      expect((btn as HTMLElement).getAttribute("aria-label")).toBeTruthy();
    });
  });

  it("container has role=group with aria-label", async () => {
    const decision = { ...baseDecision(), toEndPhase: true };
    await renderPanel(decision);
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const top = groups[0]!;
    expect(top.getAttribute("aria-label")).toBeTruthy();
  });
});
