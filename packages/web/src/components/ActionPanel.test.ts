// @vitest-environment jsdom
/**
 * ActionPanel tests — renders choices from each decision type, emits correct RESPONSE,
 * renders priority window for SELECT_CHAIN, and exposes RESIGN control.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelClientMessage, RedactedEngineMessage } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});

function msg(name: string, extra: Record<string, unknown> = {}): RedactedEngineMessage {
  return { name, engineType: 0, ...extra };
}

// Button text has a `▶ ` or `⬜ ` prefix — use data-testid + accessible name
function getActionButtons() {
  return screen.getAllByTestId("action-option");
}

describe("ActionPanel — no pending decision", () => {
  it("shows waiting text when decision is null", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    render(
      React.createElement(ActionPanel, {
        decision: null,
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
        onSend: vi.fn(),
      }),
    );
    expect(screen.getByTestId("resign-btn")).toBeTruthy();
  });
});

describe("ActionPanel — SELECT_IDLECMD", () => {
  it("renders all options", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_IDLECMD", {
      options: [
        { label: "Normal Summon", index: 0 },
        { label: "End Phase", index: 1 },
      ],
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns).toHaveLength(2);
    expect(btns[0]?.textContent).toMatch(/Normal Summon/);
    expect(btns[1]?.textContent).toMatch(/End Phase/);
  });

  it("calls onSend with RESPONSE when option clicked", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    const decision = msg("SELECT_IDLECMD", {
      options: [{ label: "Normal Summon", index: 0 }],
    });

    render(
      React.createElement(ActionPanel, { decision, onSend }),
    );

    const btns = getActionButtons();
    if (!btns[0]) throw new Error("No button found");
    fireEvent.click(btns[0]);

    expect(onSend).toHaveBeenCalledWith({
      type: "RESPONSE",
      response: { type: 1, value: 0 },
    } satisfies DuelClientMessage);
  });
});

describe("ActionPanel — SELECT_CHAIN (priority window)", () => {
  it("shows priority window banner", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_CHAIN", {
      options: [{ label: "Activate Trap", index: 0 }],
      canPass: true,
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    expect(screen.getByTestId("priority-window")).toBeTruthy();
  });

  it("shows pass option with isPass styling", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_CHAIN", {
      options: [{ label: "Activate Trap", index: 0 }],
      canPass: true,
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const passBtn = screen.getByTestId("pass-option");
    expect(passBtn.textContent).toMatch(/no response/i);
  });

  it("sends RESPONSE with -1 when pass is clicked", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    const decision = msg("SELECT_CHAIN", {
      options: [{ label: "Activate Trap", index: 0 }],
      canPass: true,
    });

    render(
      React.createElement(ActionPanel, { decision, onSend }),
    );

    fireEvent.click(screen.getByTestId("pass-option"));

    expect(onSend).toHaveBeenCalledWith({
      type: "RESPONSE",
      response: { type: 1, value: -1 },
    } satisfies DuelClientMessage);
  });
});

describe("ActionPanel — SELECT_EFFECTYN / SELECT_YESNO", () => {
  it("renders Yes and No buttons for SELECT_EFFECTYN", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_EFFECTYN", { question: "Activate Mirror Force?" });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns).toHaveLength(2);
    expect(btns[0]?.textContent).toMatch(/Yes/);
    expect(btns[1]?.textContent).toMatch(/No/);
    expect(screen.getByText("Activate Mirror Force?")).toBeTruthy();
  });

  it("sends RESPONSE with value 1 for Yes", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    const decision = msg("SELECT_YESNO", { question: "Discard?" });

    render(
      React.createElement(ActionPanel, { decision, onSend }),
    );

    const btns = getActionButtons();
    const yesBtn = btns.find((b) => b.textContent?.includes("Yes"));
    if (!yesBtn) throw new Error("Yes button not found");
    fireEvent.click(yesBtn);

    expect(onSend).toHaveBeenCalledWith({
      type: "RESPONSE",
      response: { type: 1, value: 1 },
    } satisfies DuelClientMessage);
  });

  it("sends RESPONSE with value 0 for No", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();
    const decision = msg("SELECT_EFFECTYN", { question: "Discard?" });

    render(
      React.createElement(ActionPanel, { decision, onSend }),
    );

    const btns = getActionButtons();
    const noBtn = btns.find((b) => b.textContent?.includes("No"));
    if (!noBtn) throw new Error("No button not found");
    fireEvent.click(noBtn);

    expect(onSend).toHaveBeenCalledWith({
      type: "RESPONSE",
      response: { type: 1, value: 0 },
    } satisfies DuelClientMessage);
  });
});

describe("ActionPanel — SELECT_CARD", () => {
  it("renders card names as options", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_CARD", {
      hint: "Select a card to discard:",
      cards: [
        { name: "Dark Magician", code: 46986414, index: 0 },
        { name: "Blue-Eyes White Dragon", code: 89631139, index: 1 },
      ],
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns[0]?.textContent).toMatch(/Dark Magician/);
    expect(btns[1]?.textContent).toMatch(/Blue-Eyes White Dragon/);
  });
});

describe("ActionPanel — SELECT_OPTION", () => {
  it("renders all option labels", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_OPTION", {
      hint: "Choose effect:",
      options: [
        { label: "Add to hand", index: 0 },
        { label: "Special Summon", index: 1 },
      ],
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns[0]?.textContent).toMatch(/Add to hand/);
    expect(btns[1]?.textContent).toMatch(/Special Summon/);
  });
});

describe("ActionPanel — SELECT_POSITION", () => {
  it("renders position options", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_POSITION", {
      positions: [
        { label: "Attack Position", value: 2 },
        { label: "Defense Position", value: 4 },
      ],
    });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns[0]?.textContent).toMatch(/Attack Position/);
    expect(btns[1]?.textContent).toMatch(/Defense Position/);
  });
});

describe("ActionPanel — ANNOUNCE_ATTRIB", () => {
  it("renders all 7 attribute options", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("ANNOUNCE_ATTRIB");

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn() }),
    );

    const btns = getActionButtons();
    expect(btns).toHaveLength(7);
    const labels = btns.map((b) => b.textContent ?? "");
    expect(labels.some((l) => l.includes("DARK"))).toBe(true);
    expect(labels.some((l) => l.includes("LIGHT"))).toBe(true);
    expect(labels.some((l) => l.includes("FIRE"))).toBe(true);
  });
});

describe("ActionPanel — RESIGN", () => {
  it("sends RESIGN message after confirm", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();

    vi.stubGlobal("confirm", () => true);

    render(
      React.createElement(ActionPanel, { decision: null, onSend }),
    );

    fireEvent.click(screen.getByTestId("resign-btn"));

    expect(onSend).toHaveBeenCalledWith({ type: "RESIGN" } satisfies DuelClientMessage);
  });

  it("does not send RESIGN when confirm is cancelled", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const onSend = vi.fn();

    vi.stubGlobal("confirm", () => false);

    render(
      React.createElement(ActionPanel, { decision: null, onSend }),
    );

    fireEvent.click(screen.getByTestId("resign-btn"));

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("ActionPanel — disabled state", () => {
  it("disables all buttons when disabled=true", async () => {
    const { ActionPanel } = await import("./ActionPanel");
    const decision = msg("SELECT_YESNO", { question: "Discard?" });

    render(
      React.createElement(ActionPanel, { decision, onSend: vi.fn(), disabled: true }),
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
