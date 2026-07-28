// @vitest-environment jsdom
/**
 * CreateDuelScreen tests — superseded screen stub.
 * Full create-room behaviour is tested in S1.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CreateDuelScreen } from "./CreateDuelScreen";

afterEach(() => {
  cleanup();
});

describe("CreateDuelScreen (stub)", () => {
  it("renders without crashing", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(CreateDuelScreen)));
    expect(screen.getByText(/Home/i)).toBeTruthy();
  });
});
