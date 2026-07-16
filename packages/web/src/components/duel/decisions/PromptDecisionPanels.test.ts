// @vitest-environment jsdom
/**
 * PromptDecisionPanels (Slice 2D) tests.
 *
 * Drives each panel from fixture DuelDecision objects at both phone and desktop
 * layoutTier. Asserts:
 *   - Correct render
 *   - Correct DuelDecisionResponse emitted on interaction
 *   - ≥44px tap targets (inline minHeight)
 *   - Keyboard reachability (buttons are focusable)
 *   - disabled state
 */

import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function card(n = 1) {
  return {
    code: 46986414 + n,
    name: `Card ${n}`,
    controller: 0 as const,
    location: "HAND" as const,
    sequence: n,
  };
}

async function renderPanel(
  decision: DuelDecision,
  respond = vi.fn(),
  layoutTier: "phone" | "desktop" = "desktop",
) {
  const { PromptDecisionPanels } = await import("./PromptDecisionPanels");
  // Cast to any to allow routing all decision kinds through the sub-dispatcher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render(React.createElement(PromptDecisionPanels as any, { decision, respond, layoutTier }));
  return respond;
}

// ── Shared a11y assertion ─────────────────────────────────────────────────────

function assertAllButtonsHaveMinHeight44(buttons: HTMLElement[]) {
  buttons.forEach((btn) => {
    const mh = (btn as HTMLButtonElement).style.minHeight;
    expect(mh).toBe("44px");
  });
}

// ── SelectEffectYNPanel ────────────────────────────────────────────────────────

describe("SelectEffectYNPanel", () => {
  it("renders card name and description — desktop", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate Solemn Judgment?",
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getByText(/Activate Solemn Judgment\?/)).toBeTruthy();
    expect(screen.getByText(/Card 1/)).toBeTruthy();
  });

  it("renders card name and description — phone", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(2),
      description: "Negate?",
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getByText(/Negate\?/)).toBeTruthy();
    expect(screen.getByText(/Card 2/)).toBeTruthy();
  });

  it("emits {yes: true} when Yes clicked", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate?",
    };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    fireEvent.click(btns[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectEffectYN",
      yes: true,
    } satisfies DuelDecisionResponse);
  });

  it("emits {yes: false} when No clicked", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Activate?",
    };
    const respond = await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    fireEvent.click(btns[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectEffectYN",
      yes: false,
    } satisfies DuelDecisionResponse);
  });

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "?",
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "?",
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    btns.forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });

  it("buttons disabled when disabled=true", async () => {
    const { default: SelectEffectYNPanel } = await import("./SelectEffectYNPanel");
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "?",
    };
    render(
      React.createElement(SelectEffectYNPanel, {
        decision,
        respond: vi.fn(),
        layoutTier: "phone",
        disabled: true,
      }),
    );
    screen.getAllByRole("button").forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

// ── SelectYesNoPanel ───────────────────────────────────────────────────────────

describe("SelectYesNoPanel", () => {
  it("renders description — desktop", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Synchro Summon now?",
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getByText(/Synchro Summon now\?/)).toBeTruthy();
  });

  it("renders description — phone", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Use this effect?",
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getByText(/Use this effect\?/)).toBeTruthy();
  });

  it("emits {yes: true} on Yes", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectYesNo",
      yes: true,
    } satisfies DuelDecisionResponse);
  });

  it("emits {yes: false} on No", async () => {
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

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

// ── SelectOptionPanel ──────────────────────────────────────────────────────────

describe("SelectOptionPanel", () => {
  it("renders all option labels — desktop", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Add to hand", "Special Summon from GY"],
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getByText(/Add to hand/)).toBeTruthy();
    expect(screen.getByText(/Special Summon from GY/)).toBeTruthy();
  });

  it("renders all option labels — phone", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A", "Option B", "Option C"],
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option")).toHaveLength(3);
  });

  it("emits {index: 0} on first option", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A", "Option B"],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectOption",
      index: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits {index: 1} on second option", async () => {
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

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A"],
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Option A"],
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

// ── AnnounceRacePanel ──────────────────────────────────────────────────────────

describe("AnnounceRacePanel", () => {
  it("renders available races — desktop", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON", "WARRIOR", "SPELLCASTER"],
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getAllByTestId("action-option")).toHaveLength(3);
    expect(screen.getByText(/Dragon/)).toBeTruthy();
    expect(screen.getByText(/Warrior/)).toBeTruthy();
  });

  it("renders available races — phone", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["ZOMBIE", "FAIRY"],
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("shows running count and confirm only after count reached", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 2,
      available: ["DRAGON", "WARRIOR", "ZOMBIE"],
    };
    const respond = await renderPanel(decision);
    const confirmBtn = screen.getByRole("button", { name: /Confirm/ });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    // Select first
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    // Select second
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(confirmBtn);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceRace",
      races: ["DRAGON", "WARRIOR"],
    } satisfies DuelDecisionResponse);
  });

  it("emits correct races when count=1", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON", "WARRIOR"],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceRace",
      races: ["WARRIOR"],
    } satisfies DuelDecisionResponse);
  });

  it("cannot select more than count", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON", "WARRIOR", "ZOMBIE"],
    };
    await renderPanel(decision);
    const btns = screen.getAllByTestId("action-option");
    fireEvent.click(btns[0]!);
    fireEvent.click(btns[1]!); // should be ignored since count=1
    // Only first should be selected — confirm enabled
    const confirmBtn = screen.getByRole("button", { name: /Confirm/ });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON"],
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON"],
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

// ── AnnounceAttribPanel ────────────────────────────────────────────────────────

describe("AnnounceAttribPanel", () => {
  it("renders available attributes — desktop", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK", "LIGHT", "FIRE"],
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getAllByTestId("action-option")).toHaveLength(3);
    expect(screen.getByText(/DARK/)).toBeTruthy();
    expect(screen.getByText(/LIGHT/)).toBeTruthy();
  });

  it("renders available attributes — phone", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["EARTH", "WATER"],
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("emits correct attributes when count=1", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK", "LIGHT", "FIRE"],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceAttrib",
      attributes: ["DARK"],
    } satisfies DuelDecisionResponse);
  });

  it("confirm disabled until count reached", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 2,
      available: ["DARK", "LIGHT", "FIRE"],
    };
    const respond = await renderPanel(decision);
    const confirmBtn = screen.getByRole("button", { name: /Confirm/ });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(confirmBtn);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceAttrib",
      attributes: ["DARK", "LIGHT"],
    } satisfies DuelDecisionResponse);
  });

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK"],
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK"],
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

// ── AnnounceCardPanel — filter.kind === "codes" ────────────────────────────────

describe("AnnounceCardPanel (codes)", () => {
  it("renders all codes as buttons — desktop", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414, 89631139] },
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("renders all codes as buttons — phone", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414] },
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option")).toHaveLength(1);
  });

  it("emits {code} when a card is clicked", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414, 89631139] },
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[1]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceCard",
      code: 89631139,
    } satisfies DuelDecisionResponse);
  });

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414] },
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414] },
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

// ── AnnounceCardPanel — filter.kind === "any" (card-name search) ───────────────

describe("AnnounceCardPanel (any — search)", () => {
  beforeEach(() => {
    // Mock the cards API
    vi.mock("../../../api/cards", () => ({
      searchCards: vi.fn(),
    }));
  });

  it("renders search input — desktop", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    await renderPanel(decision, vi.fn(), "desktop");
    const input = screen.getByRole("combobox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).disabled).toBe(false);
  });

  it("renders search input — phone", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    await renderPanel(decision, vi.fn(), "phone");
    const input = screen.getByRole("combobox");
    expect(input).toBeTruthy();
  });

  it("confirm button disabled until card selected", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    await renderPanel(decision);
    const confirmBtn = screen.getByRole("button", { name: /Confirm/ });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("search input has minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    await renderPanel(decision);
    const input = screen.getByRole("combobox");
    const mh = (input as HTMLElement).style.minHeight;
    expect(mh).toBe("44px");
  });

  it("search input is keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    await renderPanel(decision);
    const input = screen.getByRole("combobox");
    expect((input as HTMLInputElement).tabIndex).not.toBe(-1);
  });

  it("shows search results and emits code on selection", async () => {
    const { searchCards } = await import("../../../api/cards");
    vi.mocked(searchCards).mockResolvedValueOnce({
      total: 1,
      page: 1,
      pageSize: 10,
      cards: [
        {
          passcode: 46986414,
          name: "Dark Magician",
          frame: "normal",
          isExtraDeck: false,
          race: "SPELLCASTER",
          attribute: "DARK",
          level: 7,
          atk: 2500,
          def: 2100,
          desc: "The ultimate wizard in terms of attack and defense.",
          banlist: "unlimited",
          aliasOf: null,
          imageId: 46986414,
        },
      ],
    });

    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "any" },
    };
    const respond = await renderPanel(decision);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Dark Magician" } });

    // Wait for debounced search result
    await waitFor(() => {
      expect(screen.queryByText("Dark Magician")).toBeTruthy();
    });

    // Click the result
    const resultBtns = screen.getAllByTestId("action-option");
    fireEvent.click(resultBtns[0]!);

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: /Confirm/ });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmBtn);

    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceCard",
      code: 46986414,
    } satisfies DuelDecisionResponse);
  });
});

// ── AnnounceNumberPanel ────────────────────────────────────────────────────────

describe("AnnounceNumberPanel", () => {
  it("renders all number options — desktop", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    };
    await renderPanel(decision, vi.fn(), "desktop");
    expect(screen.getAllByTestId("action-option")).toHaveLength(10);
  });

  it("renders all number options — phone", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [500, 1000, 1500],
    };
    await renderPanel(decision, vi.fn(), "phone");
    expect(screen.getAllByTestId("action-option")).toHaveLength(3);
    expect(screen.getByText("1000")).toBeTruthy();
  });

  it("emits {valueIndex: 0} on first number", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [3, 6, 9],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[0]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceNumber",
      valueIndex: 0,
    } satisfies DuelDecisionResponse);
  });

  it("emits {valueIndex: 2} on third number", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [3, 6, 9],
    };
    const respond = await renderPanel(decision);
    fireEvent.click(screen.getAllByTestId("action-option")[2]!);
    expect(respond).toHaveBeenCalledWith({
      kind: "AnnounceNumber",
      valueIndex: 2,
    } satisfies DuelDecisionResponse);
  });

  it("all action buttons have minHeight ≥ 44px", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [100, 200],
    };
    await renderPanel(decision);
    assertAllButtonsHaveMinHeight44(screen.getAllByTestId("action-option"));
  });

  it("buttons are keyboard-focusable", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [100],
    };
    await renderPanel(decision);
    screen.getAllByTestId("action-option").forEach((btn) => {
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });

  it("buttons disabled when disabled=true", async () => {
    const { default: AnnounceNumberPanel } = await import("./AnnounceNumberPanel");
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [100, 200],
    };
    render(
      React.createElement(AnnounceNumberPanel, {
        decision,
        respond: vi.fn(),
        layoutTier: "desktop",
        disabled: true,
      }),
    );
    screen.getAllByRole("button").forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

// ── PromptDecisionPanels sub-dispatcher ───────────────────────────────────────

describe("PromptDecisionPanels sub-dispatcher", () => {
  it("routes SelectEffectYN to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: card(1),
      description: "Test?",
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("routes SelectYesNo to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Test?",
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("routes SelectOption to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["A", "B"],
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });

  it("routes AnnounceRace to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["DRAGON"],
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(1);
  });

  it("routes AnnounceAttrib to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK"],
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(1);
  });

  it("routes AnnounceCard (codes) to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: { kind: "codes", codes: [46986414] },
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(1);
  });

  it("routes AnnounceNumber to the correct panel", async () => {
    const decision: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [100, 200],
    };
    await renderPanel(decision);
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
  });
});
