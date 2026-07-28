// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  mockNavigate.mockReset();
});

beforeEach(() => {
  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
  });
});

async function renderScreen() {
  const { CreateDuelScreen } = await import("./CreateDuelScreen");
  render(React.createElement(MemoryRouter, null, React.createElement(CreateDuelScreen)));
}

describe("CreateDuelScreen", () => {
  it("renders the four timer presets", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();
    expect(screen.getByText("3 min")).toBeTruthy();
    expect(screen.getByText("5 min")).toBeTruthy();
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText("15 min")).toBeTruthy();
  });

  it("has 10 min selected by default", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();
    const tenMin = screen.getByText("10 min");
    expect(tenMin.getAttribute("aria-checked")).toBe("true");
  });

  it("shows the 'you'll pick your deck in the room' line", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();
    expect(screen.getByText(/pick your deck in the room/i)).toBeTruthy();
  });

  it("does not render a deck picker", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();
    expect(screen.queryByLabelText(/deck/i)).toBeNull();
    expect(screen.queryByText(/choose a deck/i)).toBeNull();
  });

  it("shows the Create challenge link button", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();
    expect(screen.getByText("Create challenge link ▸")).toBeTruthy();
  });

  it("switches selection when a different preset is clicked", async () => {
    vi.doMock("../api/room", () => ({ createRoom: vi.fn() }));
    await renderScreen();

    const fiveMin = screen.getByText("5 min");
    fireEvent.click(fiveMin);
    expect(fiveMin.getAttribute("aria-checked")).toBe("true");

    const tenMin = screen.getByText("10 min");
    expect(tenMin.getAttribute("aria-checked")).toBe("false");
  });

  it("calls createRoom with selected seconds and navigates to room on success", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ roomId: "room-abc", joinToken: "tok123" });
    vi.doMock("../api/room", () => ({ createRoom: mockCreate }));
    await renderScreen();

    // Select 5 min
    fireEvent.click(screen.getByText("5 min"));
    fireEvent.click(screen.getByText("Create challenge link ▸"));

    // Wait for async
    await vi.waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ timer: { perMoveSeconds: 300 } }),
    );
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/duel/room-abc/room"));
  });
});
