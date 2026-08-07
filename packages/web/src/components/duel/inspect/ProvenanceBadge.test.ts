// @vitest-environment jsdom
/**
 * ProvenanceBadge tests (§10b acceptance criteria).
 *
 * - Renders the exact normative copy.
 * - Caller is responsible for gating on preErrataText && artState === "ok".
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProvenanceBadge } from "./ProvenanceBadge";

afterEach(() => {
  cleanup();
});

describe("ProvenanceBadge", () => {
  it("renders the normative copy", () => {
    render(React.createElement(ProvenanceBadge));
    expect(screen.getByText("Edison text differs from this printing")).toBeTruthy();
  });

  it("does not contain a second clause or explanation", () => {
    const { container } = render(React.createElement(ProvenanceBadge));
    const text = container.textContent ?? "";
    // Must not contain 'pre-errata', 'because', 'year', 'why', 'rule'
    expect(text).not.toMatch(/pre-errata/i);
    expect(text).not.toMatch(/\bbecause\b/i);
    expect(text).not.toMatch(/\b2010\b/);
    expect(text).not.toMatch(/\brule\b/i);
    // Only the one normative clause.
    expect(text.trim()).toBe("Edison text differs from this printing");
  });
});
