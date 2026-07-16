// @vitest-environment jsdom
/**
 * CommandDecisionPanels tests — verify sub-dispatcher routes to correct panels
 * and type-narrowing works correctly for all 2B kinds.
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

function attackCard(n = 1) {
  return { ...card(n), canDirectAttack: false, location: "MZONE" as const };
}

function activeCard(n = 1) {
  return { ...card(n), description: `Effect ${n}` };
}

async function renderDispatcher(
  decision: Extract<DuelDecision, { kind: "IdleCommand" | "BattleCommand" | "ChainPrompt" }>,
  respond = vi.fn(),
  layoutTier: "phone" | "tablet" | "desktop" = "desktop",
) {
  const { CommandDecisionPanels } = await import("./CommandDecisionPanels");
  render(
    React.createElement(CommandDecisionPanels, {
      decision,
      respond,
      layoutTier,
    } as Parameters<typeof CommandDecisionPanels>[0]),
  );
  return respond;
}

// ── Routing ────────────────────────────────────────────────────────────────────

describe("CommandDecisionPanels — routing", () => {
  it("routes IdleCommand to IdleCommandPanel (shows action-option for summon)", async () => {
    const decision: Extract<DuelDecision, { kind: "IdleCommand" }> = {
      kind: "IdleCommand",
      player: 0,
      summons: [card(1)],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    await renderDispatcher(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Normal Summon/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("routes BattleCommand to BattleCommandPanel (shows attack action-option)", async () => {
    const decision: Extract<DuelDecision, { kind: "BattleCommand" }> = {
      kind: "BattleCommand",
      player: 0,
      chains: [],
      attacks: [attackCard(1)],
      toMainPhase2: true,
      toEndPhase: false,
    };
    await renderDispatcher(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns.some((b) => /Card 1/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("routes ChainPrompt to ChainPromptPanel (shows pass-option on desktop)", async () => {
    const decision: Extract<DuelDecision, { kind: "ChainPrompt" }> = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [activeCard(1)],
    };
    await renderDispatcher(decision, vi.fn(), "desktop");
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });
});

// ── Response forwarding ────────────────────────────────────────────────────────

describe("CommandDecisionPanels — response forwarding", () => {
  it("forwards IdleCommand response with correct shape", async () => {
    const decision: Extract<DuelDecision, { kind: "IdleCommand" }> = {
      kind: "IdleCommand",
      player: 0,
      summons: [card(1)],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: false,
    };
    const respond = await renderDispatcher(decision);
    const btns = screen.getAllByTestId("action-option");
    const summonBtn = btns.find((b) => /Normal Summon/i.test(b.textContent ?? ""));
    fireEvent.click(summonBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "summon",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("forwards BattleCommand response with correct shape", async () => {
    const decision: Extract<DuelDecision, { kind: "BattleCommand" }> = {
      kind: "BattleCommand",
      player: 0,
      chains: [],
      attacks: [attackCard(1)],
      toMainPhase2: false,
      toEndPhase: true,
    };
    const respond = await renderDispatcher(decision);
    const btns = screen.getAllByTestId("action-option");
    const attackBtn = btns.find((b) => /Card 1/i.test(b.textContent ?? ""));
    fireEvent.click(attackBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "attack",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("forwards ChainPrompt pass response (index=null)", async () => {
    const decision: Extract<DuelDecision, { kind: "ChainPrompt" }> = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [],
    };
    const respond = await renderDispatcher(decision, vi.fn(), "desktop");
    fireEvent.click(screen.getByTestId("pass-option"));
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("forwards ChainPrompt index response (selects)", async () => {
    const decision: Extract<DuelDecision, { kind: "ChainPrompt" }> = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [activeCard(1)],
    };
    const respond = await renderDispatcher(decision, vi.fn(), "desktop");
    const actionBtns = screen.getAllByTestId("action-option");
    const cardBtn = actionBtns.find((b) => /Card 1/i.test(b.textContent ?? ""));
    fireEvent.click(cardBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: 0,
    } satisfies DuelDecisionResponse);
  });
});

// ── Layout tiers ──────────────────────────────────────────────────────────────

describe("CommandDecisionPanels — layoutTier", () => {
  it("renders IdleCommand on phone tier", async () => {
    const decision: Extract<DuelDecision, { kind: "IdleCommand" }> = {
      kind: "IdleCommand",
      player: 0,
      summons: [],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: true,
      toEndPhase: true,
    };
    await renderDispatcher(decision, vi.fn(), "phone");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(2);
  });

  it("renders ChainPrompt on phone shows compact Respond/Pass", async () => {
    const decision: Extract<DuelDecision, { kind: "ChainPrompt" }> = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [activeCard(1)],
    };
    await renderDispatcher(decision, vi.fn(), "phone");
    const respondBtn = screen.getByTestId("action-option");
    expect(/Respond/i.test(respondBtn.textContent ?? "")).toBe(true);
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });

  it("renders BattleCommand on tablet tier", async () => {
    const decision: Extract<DuelDecision, { kind: "BattleCommand" }> = {
      kind: "BattleCommand",
      player: 0,
      chains: [],
      attacks: [attackCard(1)],
      toMainPhase2: true,
      toEndPhase: false,
    };
    await renderDispatcher(decision, vi.fn(), "tablet");
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(2);
  });
});
