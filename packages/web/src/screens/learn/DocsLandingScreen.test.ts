// @vitest-environment jsdom
/**
 * DocsLandingScreen — component/render tests (B4-REQ-3).
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

// Mock the generated manifest and articles so tests don't need the full build output
vi.mock("../../content/learn/generated/docsManifest.json", () => ({
  default: [
    {
      id: "howto.getting-started",
      url: "/learn/how-to/getting-started",
      section: "howto",
      group: "howto",
      title: "Getting Started",
      summary: "Create your account and start playing.",
      keywords: ["invite", "login"],
      anchors: [
        {
          id: "howto.getting-started#login",
          text: "Logging In",
          url: "/learn/how-to/getting-started#login",
        },
      ],
      aliases: [],
      nextId: "howto.build-deck",
    },
    {
      id: "rules.diff.06",
      url: "/learn/rules/difference-06-ignition-effect-priority",
      section: "rules",
      group: "difference",
      ruleNumber: 6,
      title: "Ignition Effect Priority",
      summary: "After a Summon, the turn player may activate an Ignition Effect first.",
      keywords: ["priority", "ignition"],
      anchors: [
        {
          id: "rules.diff.06#summon-no-chain",
          text: "Summon not starting a chain",
          url: "/learn/rules/difference-06#summon-no-chain",
        },
      ],
      aliases: [],
      prevId: "rules.diff.05",
      nextId: "rules.diff.07",
    },
    {
      id: "rules.primer.turn",
      url: "/learn/rules/primer-how-a-turn-works",
      section: "rules",
      group: "primer",
      title: "How a Turn Works",
      summary: "A turn has six phases.",
      keywords: ["turn", "phases"],
      anchors: [
        {
          id: "rules.primer.turn#who-goes-first",
          text: "Who Goes First",
          url: "/learn/rules/primer-how-a-turn-works#who-goes-first",
        },
        {
          id: "rules.primer.turn#no-turn-1-battle-phase",
          text: "Turn-1 Restriction",
          url: "/learn/rules/primer-how-a-turn-works#no-turn-1-battle-phase",
        },
      ],
      aliases: [],
    },
  ],
}));

vi.mock("../../content/learn/quickAnswers", () => ({
  QUICK_ANSWERS: [
    { question: "Who draws on turn 1?", canonicalId: "rules.diff.01" },
    {
      question: "Can I attack on turn 1?",
      canonicalId: "rules.primer.turn#no-turn-1-battle-phase",
    },
    { question: "Priority vs Bottomless?", canonicalId: "rules.diff.06" },
  ],
}));

describe("DocsLandingScreen — rendering", () => {
  async function renderLanding() {
    const { DocsLandingScreen } = await import("./DocsLandingScreen");
    return render(React.createElement(MemoryRouter, null, React.createElement(DocsLandingScreen)));
  }

  it("renders the Learn header", async () => {
    await renderLanding();
    expect(screen.getAllByText("Learn").length).toBeGreaterThan(0);
  });

  it("renders Quick Answers section", async () => {
    await renderLanding();
    expect(screen.getByText("⚡ Quick Answers")).toBeTruthy();
  });

  it("shows first 5 quick answers (or fewer if fewer exist)", async () => {
    await renderLanding();
    expect(screen.getByText("Who draws on turn 1?")).toBeTruthy();
    expect(screen.getByText("Can I attack on turn 1?")).toBeTruthy();
    expect(screen.getByText("Priority vs Bottomless?")).toBeTruthy();
  });

  it("renders the search input", async () => {
    await renderLanding();
    const searchInput = screen.getByRole("searchbox");
    expect(searchInput).toBeTruthy();
  });

  it("shows search results when query is entered", async () => {
    await renderLanding();
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "priority" } });
    // After typing, search results should appear
    const results = await screen.findAllByText(/priority/i);
    expect(results.length).toBeGreaterThan(0);
  });

  it("shows 'no results' message for unmatched query", async () => {
    await renderLanding();
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "xyzfoo" } });
    const noResults = await screen.findByText(/No results/i);
    expect(noResults).toBeTruthy();
  });

  it("renders the 13 rule-differences grid", async () => {
    await renderLanding();
    // Rule number 6 link should exist (may appear in nav and in grid)
    const matches = screen.getAllByText(/Ignition effect priority/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("renders Home back button", async () => {
    await renderLanding();
    expect(screen.getByText("← Home")).toBeTruthy();
  });
});
