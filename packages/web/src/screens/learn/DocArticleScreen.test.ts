// @vitest-environment jsdom
/**
 * DocArticleScreen — component/render tests (B4-REQ-3, B4-REQ-4).
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const MOCK_ENTRY = {
  id: "rules.diff.06",
  url: "/learn/rules/difference-06-ignition-effect-priority",
  section: "rules" as const,
  group: "difference" as const,
  ruleNumber: 6,
  title: "Ignition Effect Priority",
  summary: "After a Summon, the turn player may activate an Ignition Effect first.",
  keywords: ["priority", "ignition"],
  anchors: [
    {
      id: "rules.diff.06#summon-no-chain",
      text: "When the Summon Does NOT Start a Chain",
      url: "/learn/rules/difference-06-ignition-effect-priority#summon-no-chain",
    },
  ],
  aliases: [],
  prevId: "rules.diff.05",
  nextId: "rules.diff.07",
  slug: "difference-06-ignition-effect-priority",
};

vi.mock("../../content/learn/generated/docsManifest.json", () => ({
  default: [MOCK_ENTRY],
}));

vi.mock("../../content/learn/generated/articles", () => ({
  articles: {
    "rules.diff.06": {
      meta: {
        id: "rules.diff.06",
        section: "rules",
        group: "difference",
        ruleNumber: 6,
        title: "Ignition Effect Priority",
        slug: "difference-06-ignition-effect-priority",
        summary: "After a Summon, the turn player may activate an Ignition Effect first.",
        keywords: ["priority"],
        aliases: [],
      },
      html: "<h2 id='summon-no-chain'><a href='#summon-no-chain' class='anchor-link'>🔗</a>When the Summon Does NOT Start a Chain</h2><p>Test body content.</p>",
    },
  },
}));

describe("DocArticleScreen — rendering a known article", () => {
  async function renderArticle(slug: string) {
    const { DocArticleScreen } = await import("./DocArticleScreen");
    return render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/learn/rules/${slug}`] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/learn/rules/:slug",
            element: React.createElement(DocArticleScreen),
          }),
        ),
      ),
    );
  }

  it("renders the article title", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    expect(screen.getByText("Ignition Effect Priority")).toBeTruthy();
  });

  it("renders the Rule # badge", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    expect(screen.getByText("Rule #6")).toBeTruthy();
  });

  it("renders the TL;DR box with the summary", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    expect(screen.getByText(/After a Summon/)).toBeTruthy();
  });

  it("renders the article body HTML", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    expect(screen.getByText("Test body content.")).toBeTruthy();
  });

  it("renders breadcrumb with Learn link", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    const learnLinks = screen.getAllByText("Learn");
    expect(learnLinks.length).toBeGreaterThan(0);
  });

  it("renders 'On this page' TOC section", async () => {
    await renderArticle("difference-06-ignition-effect-priority");
    expect(screen.getByText(/On this page/i)).toBeTruthy();
  });
});

describe("DocArticleScreen — unknown slug", () => {
  async function renderUnknown() {
    const { DocArticleScreen } = await import("./DocArticleScreen");
    return render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/learn/rules/no-such-page"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: "/learn/rules/:slug",
            element: React.createElement(DocArticleScreen),
          }),
        ),
      ),
    );
  }

  it("shows 'Article not found' for an unknown slug", async () => {
    await renderUnknown();
    expect(screen.getByText(/Article not found/i)).toBeTruthy();
  });

  it("shows the slug that was not found", async () => {
    await renderUnknown();
    expect(screen.getByText(/no-such-page/)).toBeTruthy();
  });

  it("shows a Back to Learn link", async () => {
    await renderUnknown();
    expect(screen.getByText(/Back to Learn/i)).toBeTruthy();
  });
});
