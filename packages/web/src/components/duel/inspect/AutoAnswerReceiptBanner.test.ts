// @vitest-environment jsdom
/**
 * AutoAnswerReceiptBanner tests (§4b / C9).
 *
 * - Empty receipts → renders nothing.
 * - Renders each receipt: "ANSWERED FOR YOU" tag, past-tense summary, reason.
 * - No primary button ever.
 * - Optional "Ask me next time" link appears when onAskNextTime provided.
 * - "Ask me next time" calls the handler with the receipt.
 */
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoAnswerReceiptBanner } from "./AutoAnswerReceiptBanner";
import type { AutoAnswerReceipt } from "../../../duel/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeReceipt(
  id: string,
  summary: string,
  reason: AutoAnswerReceipt["reason"] = "only-one-legal-answer",
): AutoAnswerReceipt {
  return { id, summary, reason, at: Date.now() };
}

describe("AutoAnswerReceiptBanner (C9)", () => {
  it("renders nothing for empty receipts", () => {
    const { container } = render(React.createElement(AutoAnswerReceiptBanner, { receipts: [] }));
    expect(container.firstChild).toBeNull();
  });

  it("renders a receipt with ANSWERED FOR YOU tag and summary", () => {
    const receipt = makeReceipt("r1", "Zone — the freed monster zone");
    render(React.createElement(AutoAnswerReceiptBanner, { receipts: [receipt] }));
    expect(screen.getByText("ANSWERED FOR YOU")).toBeTruthy();
    expect(screen.getByText("Zone — the freed monster zone")).toBeTruthy();
  });

  it("contains no element with a primary button class", () => {
    const receipt = makeReceipt("r2", "Tribute zone");
    const { container } = render(
      React.createElement(AutoAnswerReceiptBanner, { receipts: [receipt] }),
    );
    const primaryBtns = container.querySelectorAll(".btn-primary");
    expect(primaryBtns.length).toBe(0);
  });

  it("shows reason in the receipt", () => {
    const receipt = makeReceipt("r3", "Any zone", "engine-unrestricted-placement");
    render(React.createElement(AutoAnswerReceiptBanner, { receipts: [receipt] }));
    expect(screen.getByText(/Unrestricted placement/)).toBeTruthy();
  });

  it("shows 'Ask me next time' only when onAskNextTime provided", () => {
    const receipt = makeReceipt("r4", "Zone");
    // Without handler — no button.
    const { unmount } = render(
      React.createElement(AutoAnswerReceiptBanner, { receipts: [receipt] }),
    );
    expect(screen.queryByText("Ask me next time")).toBeNull();
    unmount();

    // With handler — button appears.
    render(
      React.createElement(AutoAnswerReceiptBanner, {
        receipts: [receipt],
        onAskNextTime: vi.fn(),
      }),
    );
    expect(screen.getByText("Ask me next time")).toBeTruthy();
  });

  it("calls onAskNextTime with the receipt when clicked", () => {
    const onAskNextTime = vi.fn();
    const receipt = makeReceipt("r5", "Zone — 1");
    render(
      React.createElement(AutoAnswerReceiptBanner, {
        receipts: [receipt],
        onAskNextTime,
      }),
    );
    fireEvent.click(screen.getByText("Ask me next time"));
    expect(onAskNextTime).toHaveBeenCalledWith(receipt);
  });

  it("renders multiple receipts", () => {
    const receipts = [makeReceipt("a", "First answer"), makeReceipt("b", "Second answer")];
    render(React.createElement(AutoAnswerReceiptBanner, { receipts }));
    expect(screen.getByText("First answer")).toBeTruthy();
    expect(screen.getByText("Second answer")).toBeTruthy();
  });
});
