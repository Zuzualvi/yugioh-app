// @vitest-environment jsdom
/**
 * JoinDuelScreen tests — superseded screen stub.
 * Full join-link behaviour is tested in JoinLandingScreen (S1).
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { JoinDuelScreen } from "./JoinDuelScreen";

afterEach(() => {
  cleanup();
});

describe("JoinDuelScreen (stub)", () => {
  it("renders without crashing", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(JoinDuelScreen)));
    expect(screen.getByText(/Home/i)).toBeTruthy();
  });
});
