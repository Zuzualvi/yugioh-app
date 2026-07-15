// @vitest-environment jsdom
/**
 * LoginScreen tests — INVITE-01: after a successful sign-in, resume to the
 * path the user was heading to before the auth redirect (location.state.from),
 * falling back to Home.
 */
import React from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const navigateSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  navigateSpy.mockReset();
});

function setupMocks(
  loginFn = vi.fn().mockResolvedValue({ user: { id: "u1", displayName: "Ann" } }),
) {
  vi.doMock("../api/auth", () => ({
    login: loginFn,
    redeemInvite: vi.fn(),
  }));
  vi.doMock("../context/AuthContext", () => ({
    useAuth: () => ({ setUser: vi.fn() }),
  }));
  vi.doMock("../context/ToastContext", () => ({
    useToast: () => ({ addToast: vi.fn() }),
  }));
  vi.doMock("react-router-dom", async (orig) => {
    const actual = await orig<typeof import("react-router-dom")>();
    return { ...actual, useNavigate: () => navigateSpy };
  });
}

async function renderAt(state: unknown) {
  const { LoginScreen } = await import("./LoginScreen");
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/login", state }] },
      React.createElement(LoginScreen),
    ),
  );
}

async function signIn() {
  fireEvent.change(screen.getByTestId("display-name-input"), { target: { value: "Ann" } });
  fireEvent.change(screen.getByTestId("password-input"), { target: { value: "pw12345" } });
  fireEvent.click(screen.getByTestId("login-submit"));
}

describe("LoginScreen — resume after auth (INVITE-01)", () => {
  it("navigates to the intended path (from) after login", async () => {
    setupMocks();
    await renderAt({ from: "/duel/join/abc123" });
    await signIn();
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/duel/join/abc123", { replace: true }),
    );
  });

  it("falls back to Home when there is no intended path", async () => {
    setupMocks();
    await renderAt(undefined);
    await signIn();
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true }));
  });
});
