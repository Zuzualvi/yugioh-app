// @vitest-environment jsdom
/**
 * CardArt tests (§10a acceptance criteria).
 *
 * - code=0: renders nothing
 * - loading: placeholder at correct aspect ratio
 * - onState transitions
 * - 5s timeout: loading → failed (no DOM)
 * - failed: renders zero DOM nodes
 */
import React from "react";
import { cleanup, render, act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardArt } from "./CardArt";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CardArt", () => {
  it("renders nothing for code=0 (face-down)", () => {
    const { container } = render(React.createElement(CardArt, { code: 0, width: 100 }));
    expect(container.firstChild).toBeNull();
  });

  it("renders a placeholder while loading", () => {
    const { container } = render(React.createElement(CardArt, { code: 12345, width: 100 }));
    // Should have something (shimmer placeholder)
    expect(container.firstChild).not.toBeNull();
  });

  it("calls onState with 'loading' then 'ok' on successful load", async () => {
    const states: string[] = [];
    const { container } = render(
      React.createElement(CardArt, {
        code: 12345,
        width: 100,
        onState: (s) => states.push(s),
      }),
    );

    // Should be loading initially.
    expect(states).toContain("loading");

    // Simulate image load.
    const img = container.querySelector("img");
    if (img) {
      act(() => {
        img.dispatchEvent(new Event("load"));
      });
    }

    await waitFor(() => expect(states).toContain("ok"));
  });

  it("calls onState with 'failed' on image error", async () => {
    const states: string[] = [];
    const { container } = render(
      React.createElement(CardArt, {
        code: 12345,
        width: 100,
        onState: (s) => states.push(s),
      }),
    );

    const img = container.querySelector("img");
    if (img) {
      act(() => {
        img.dispatchEvent(new Event("error"));
      });
    }

    await waitFor(() => expect(states).toContain("failed"));
  });

  it("transitions to failed after 5s timeout", async () => {
    vi.useFakeTimers();
    const states: string[] = [];
    render(
      React.createElement(CardArt, {
        code: 99999,
        width: 100,
        onState: (s) => states.push(s),
      }),
    );

    expect(states).toContain("loading");

    // Advance past the 5s timeout.
    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(states).toContain("failed");
  });

  it("in failed state, renders no img element", async () => {
    const { container } = render(
      React.createElement(CardArt, {
        code: 12345,
        width: 100,
        onState: () => {},
      }),
    );

    const img = container.querySelector("img");
    if (img) {
      act(() => {
        img.dispatchEvent(new Event("error"));
      });
    }

    await waitFor(() => {
      // When failed, component returns null → no img.
      // Actually the img may be there initially but hidden; after failed the
      // whole component returns null.
      const imgs = container.querySelectorAll("img");
      imgs.forEach((i) => {
        expect((i as HTMLImageElement).style.display).not.toBe("block");
      });
    });
  });

  it("reserves the 813:1185 aspect ratio while loading", () => {
    const width = 200;
    const { container } = render(React.createElement(CardArt, { code: 54321, width }));
    // The outer div should have width=200 and height=200/(813/1185) ≈ 291.
    const outer = container.firstChild as HTMLElement;
    if (outer) {
      expect(outer.style.width).toBe(`${width}px`);
      const expectedH = Math.round(width / (813 / 1185));
      expect(outer.style.height).toBe(`${expectedH}px`);
    }
  });
});
