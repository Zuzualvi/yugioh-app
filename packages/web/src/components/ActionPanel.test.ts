// @vitest-environment jsdom
/**
 * ActionPanel tests — shell renders DecisionDispatcher for typed DuelDecision,
 * shows idle state when no decision pending, and exposes RESIGN control.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelClientMessage, DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});

// ── No pending decision ───────────────────────────────────────────────────────

describe("ActionPanel — no pending decision", () => {
  it("shows waiting text when decision is null", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    render(
      React.createElement(ActionPanel, {
        decision: null,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(screen.getByTestId("no-decision")).toBeTruthy();
  });

  it("always shows resign button", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    render(
      React.createElement(ActionPanel, {
        decision: null,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(screen.getByTestId("resign-btn")).toBeTruthy();
  });

  it("does NOT show no-decision when a typed decision is provided", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Discard?",
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(screen.queryByTestId("no-decision")).toBeNull();
  });
});

// ── Decision dispatching ──────────────────────────────────────────────────────

describe("ActionPanel — decision dispatching", () => {
  it("renders SelectYesNo panel with Yes/No buttons", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Synchro Summon?",
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(screen.getAllByTestId("action-option")).toHaveLength(2);
    expect(screen.getByText("Synchro Summon?")).toBeTruthy();
  });

  it("calls respond() when an action is chosen", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const respond = vi.fn();
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Discard?",
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond,
        onSend: vi.fn(),
      }),
    );
    const [yesBtn] = screen.getAllByTestId("action-option");
    fireEvent.click(yesBtn!);
    expect(respond).toHaveBeenCalledWith({
      kind: "SelectYesNo",
      yes: true,
    } satisfies DuelDecisionResponse);
  });

  it("renders IdleCommand options", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision: DuelDecision = {
      kind: "IdleCommand",
      player: 0,
      summons: [
        { code: 46986414, name: "Dark Magician", controller: 0, location: "HAND", sequence: 0 },
      ],
      specialSummons: [],
      posChanges: [],
      monsterSets: [],
      spellSets: [],
      activates: [],
      toBattlePhase: false,
      toEndPhase: true,
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    const btns = screen.getAllByTestId("action-option");
    expect(btns[0]?.textContent).toMatch(/Normal Summon/);
    expect(btns[btns.length - 1]?.textContent).toMatch(/End Phase/);
  });

  it("renders ChainPrompt with pass option", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision: DuelDecision = {
      kind: "ChainPrompt",
      player: 1,
      forced: false,
      selects: [
        {
          code: 29401950,
          name: "Bottomless Trap Hole",
          controller: 1,
          location: "SZONE",
          sequence: 0,
          description: "Activate",
        },
      ],
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(screen.getByTestId("action-option")).toBeTruthy();
    expect(screen.getByTestId("pass-option")).toBeTruthy();
  });
});

// ── RESIGN ────────────────────────────────────────────────────────────────────

describe("ActionPanel — RESIGN", () => {
  it("sends RESIGN message after confirm", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    vi.stubGlobal("confirm", () => true);
    render(
      React.createElement(ActionPanel, {
        decision: null,
        respond: vi.fn(),
        onSend,
      }),
    );
    fireEvent.click(screen.getByTestId("resign-btn"));
    expect(onSend).toHaveBeenCalledWith({ type: "RESIGN" } satisfies DuelClientMessage);
  });

  it("does not send RESIGN when confirm is cancelled", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    vi.stubGlobal("confirm", () => false);
    render(
      React.createElement(ActionPanel, {
        decision: null,
        respond: vi.fn(),
        onSend,
      }),
    );
    fireEvent.click(screen.getByTestId("resign-btn"));
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ── Disabled state ────────────────────────────────────────────────────────────

describe("ActionPanel — disabled state", () => {
  it("disables resign button when disabled=true", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    render(
      React.createElement(ActionPanel, {
        decision: null,
        respond: vi.fn(),
        onSend: vi.fn(),
        disabled: true,
      }),
    );
    const resignBtn = screen.getByTestId("resign-btn") as HTMLButtonElement;
    expect(resignBtn.disabled).toBe(true);
  });

  it("disables action buttons when disabled=true and decision is present", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "?",
    };
    render(
      React.createElement(ActionPanel, {
        decision,
        respond: vi.fn(),
        onSend: vi.fn(),
        disabled: true,
      }),
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
