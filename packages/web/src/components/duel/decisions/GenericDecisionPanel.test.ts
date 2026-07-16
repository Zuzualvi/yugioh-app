// @vitest-environment jsdom
/**
 * GenericDecisionPanel tests — verifies every DuelDecision kind renders
 * and calls respond() with the correct DuelDecisionResponse shape.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderPanel(decision: DuelDecision, respond = vi.fn()) {
  const { GenericDecisionPanel } = await import("./GenericDecisionPanel");
  render(
    React.createElement(GenericDecisionPanel, {
      decision,
      respond,
      layoutTier: "desktop",
    }),
  );
  return respond;
}

// ── Card entry helper ──────────────────────────────────────────────────────────

function card(n = 1) {
  return {
    code: 46986414 + n,
    name: `Card ${n}`,
    controller: 0 as const,
    location: "HAND" as const,
    sequence: n,
  };
}

function activeCard(n = 1) {
  return { ...card(n), description: `Effect ${n}` };
}

// ── IdleCommand ────────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — IdleCommand", () => {
  it("renders summon + end phase options", async () => {
    const decision: DuelDecision = {
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
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns.length).toBeGreaterThanOrEqual(2);
    expect(btns[0]?.textContent).toMatch(/Normal Summon/i);
    expect(btns[btns.length - 1]?.textContent).toMatch(/End Phase/i);
  });

  it("respond with action=summon and correct index", async () => {
    const decision: DuelDecision = {
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
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "summon",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("respond with action=toEP when End Phase clicked", async () => {
    const decision: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByTestId("action-option"));
    expect(respond).toHaveBeenCalledWith({
      kind: "IdleCommand",
      action: "toEP",
      index: null,
    } satisfies DuelDecisionResponse);
  });
});

// ── BattleCommand ──────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — BattleCommand", () => {
  it("renders attack + end phase options", async () => {
    const decision: DuelDecision = {
      kind: "BattleCommand",
      player: 0,
      chains: [],
      attacks: [{ ...card(1), canDirectAttack: false }],
      toMainPhase2: false,
      toEndPhase: true,
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns[0]?.textContent).toMatch(/Attack/i);
    expect(btns[btns.length - 1]?.textContent).toMatch(/End Phase/i);
  });

  it("responds with action=attack and index", async () => {
    const decision: DuelDecision = {
      kind: "BattleCommand",
      player: 0,
      chains: [],
      attacks: [{ ...card(1), canDirectAttack: false }],
      toMainPhase2: false,
      toEndPhase: false,
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByTestId("action-option"));
    expect(respond).toHaveBeenCalledWith({
      kind: "BattleCommand",
      action: "attack",
      index: 0,
    } satisfies DuelDecisionResponse);
  });
});

// ── ChainPrompt ────────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — ChainPrompt", () => {
  it("renders selects and pass option when not forced", async () => {
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 1,
      forced: false,
      selects: [activeCard(1)],
    };
    await renderPanel(decision);
    expect(screen.getByTestId("action-option")).toBeTruthy();
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });

  it("does not render pass when forced", async () => {
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 1,
      forced: true,
      selects: [activeCard(1)],
    };
    await renderPanel(decision);
    expect(screen.queryByTestId("pass-option")).toBeNull();
  });

  it("responds with index=null when pass clicked", async () => {
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 1,
      forced: false,
      selects: [activeCard(1)],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByTestId("pass-option"));
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: null,
    } satisfies DuelDecisionResponse);
  });

  it("responds with index when select clicked", async () => {
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 1,
      forced: false,
      selects: [activeCard(1)],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByTestId("action-option"));
    expect(respond).toHaveBeenCalledWith({
      kind: "ChainPrompt",
      index: 0,
    } satisfies DuelDecisionResponse);
  });
});

// ── SelectEffectYN ─────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SelectEffectYN", () => {
  it("renders yes and no buttons", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate effect?",
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns[0]?.textContent).toMatch(/Yes/i);
    expect(btns[1]?.textContent).toMatch(/No/i);
  });

  it("responds {yes: true} on Yes", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate?",
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectEffectYN",
      yes: true,
    } satisfies DuelDecisionResponse);
  });

  it("responds {yes: false} on No", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate?",
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectEffectYN",
      yes: false,
    } satisfies DuelDecisionResponse);
  });
});

// ── SelectYesNo ────────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SelectYesNo", () => {
  it("renders description and yes/no buttons", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Synchro Summon?",
    };
    await renderPanel(decision);
    expect(screen.getByText("Synchro Summon?")).toBeTruthy();
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("responds {yes: false} on No", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectYesNo",
      yes: false,
    } satisfies DuelDecisionResponse);
  });
});

// ── SelectOption ───────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SelectOption", () => {
  it("renders all option labels", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Add to hand", "Special Summon"],
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns[0]?.textContent).toMatch(/Add to hand/);
    expect(btns[1]?.textContent).toMatch(/Special Summon/);
  });

  it("responds with correct index", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A", "Option B"],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectOption",
      index: 1,
    } satisfies DuelDecisionResponse);
  });
});

// ── SelectCard ─────────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SelectCard", () => {
  it("renders card list and confirm/cancel buttons", async () => {
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [card(1), card(2)],
      min: 1,
      max: 1,
      cancelable: true,
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns).toHaveLength(2);
    expect(screen.getByText("✕ Cancel")).toBeTruthy();
  });

  it("respond with null on cancel", async () => {
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [card(1)],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByText("✕ Cancel"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectCard",
      indices: null,
    } satisfies DuelDecisionResponse);
  });

  it("confirm button disabled until min selection met", async () => {
    const decision: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [card(1)],
      min: 1,
      max: 1,
      cancelable: false,
    };
    await renderPanel(decision);
    const confirmBtn = screen.getByText("Confirm ✓");
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── SelectPosition ─────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SelectPosition", () => {
  it("renders position options and responds correctly", async () => {
    const decision: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: card(1),
      positions: ["faceup_attack", "faceup_defense"],
    };
    const respond = await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectPosition",
      position: "faceup_attack",
    } satisfies DuelDecisionResponse);
  });
});

// ── AnnounceAttrib ─────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — AnnounceAttrib", () => {
  it("renders available attributes and responds correctly", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK", "LIGHT", "FIRE"],
    };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns).toHaveLength(3);
    // Select DARK
    fireEvent.click(btns[0]!);
    fireEvent.click(screen.getByText("Confirm ✓"));
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceAttrib",
      attributes: ["DARK"],
    } satisfies DuelDecisionResponse);
  });
});

// ── AnnounceNumber ─────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — AnnounceNumber", () => {
  it("renders number options and responds with valueIndex", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [3, 6, 9],
    };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    expect(btns[1]?.textContent).toMatch(/6/);
    fireEvent.click(btns[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceNumber",
      valueIndex: 1,
    } satisfies DuelDecisionResponse);
  });
});

// ── SortCard (rare) ────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — SortCard (rare)", () => {
  it("renders cards in order and allows default order response", async () => {
    const decision: DuelDecision = {
      kind: "SortCard",
      player: 0,
      cards: [card(1), card(2)],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getByText("Default Order"));
    expect(respond).toHaveBeenCalledWith({
      kind: "SortCard",
      order: null,
    } satisfies DuelDecisionResponse);
  });
});

// ── a11y: min-height ≥ 44 px on all interactive buttons ───────────────────────

describe("GenericDecisionPanel — a11y tap targets", () => {
  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A"],
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    btns.forEach((btn) => {
      const style = (btn as HTMLElement).style;
      // Inline styles set minHeight
      const mh = style.minHeight;
      expect(mh).toBe("44px");
    });
  });
});

// ── disabled state ─────────────────────────────────────────────────────────────

describe("GenericDecisionPanel — disabled", () => {
  it("disables all action buttons when disabled=true", async () => {
    const { GenericDecisionPanel } = await import("./GenericDecisionPanel");
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    render(
      React.createElement(GenericDecisionPanel, {
        decision,
        respond: vi.fn(),
        layoutTier: "phone",
        disabled: true,
      }),
    );
    const btns = screen.getAllByRole("button");
    btns.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
