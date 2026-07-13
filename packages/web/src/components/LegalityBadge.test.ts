// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LegalityBadge, maxCopies } from "./LegalityBadge";

afterEach(() => cleanup());

describe("LegalityBadge — renders colour + icon + label (REQ-UX-06)", () => {
  it("forbidden badge has icon and text label", () => {
    render(React.createElement(LegalityBadge, { banlist: "forbidden" }));
    const badge = screen.getByLabelText(/Forbidden/i);
    expect(badge.textContent).toContain("🚫");
    expect(badge.textContent).toContain("Forbidden");
  });

  it("limited badge has icon ① and text", () => {
    render(React.createElement(LegalityBadge, { banlist: "limited" }));
    const badge = screen.getByLabelText(/Limited/i);
    expect(badge.textContent).toContain("①");
    expect(badge.textContent).toContain("Limited");
  });

  it("semi-limited badge has icon ② and text", () => {
    render(React.createElement(LegalityBadge, { banlist: "semi" }));
    const badge = screen.getByLabelText(/Semi-Limited/i);
    expect(badge.textContent).toContain("②");
  });

  it("unlimited badge has icon ✓ and text", () => {
    render(React.createElement(LegalityBadge, { banlist: "unlimited" }));
    const badge = screen.getByLabelText(/Unrestricted/i);
    expect(badge.textContent).toContain("✓");
  });

  it("every badge carries an aria-label (not colour alone)", () => {
    const banlists = ["forbidden", "limited", "semi", "unlimited"] as const;
    for (const b of banlists) {
      render(React.createElement(LegalityBadge, { banlist: b }));
      const badge = document.querySelector(`[aria-label]`);
      expect(badge).not.toBeNull();
      cleanup();
    }
  });
});

describe("maxCopies — copy cap per banlist", () => {
  it("forbidden = 0", () => expect(maxCopies("forbidden")).toBe(0));
  it("limited = 1", () => expect(maxCopies("limited")).toBe(1));
  it("semi = 2", () => expect(maxCopies("semi")).toBe(2));
  it("unlimited = 3", () => expect(maxCopies("unlimited")).toBe(3));
});
