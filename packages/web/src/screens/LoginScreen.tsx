import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { login, redeemInvite } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { User } from "../types/contracts";

export function LoginScreen() {
  const { setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Where to go after a successful sign-in — the path the user was heading to
  // before the auth redirect (INVITE-01), falling back to Home.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  // D5b: when resuming to a duel join link, show a context line above the form.
  const isDuelJoinResume = from.startsWith("/duel/join");

  const inviteCode = searchParams.get("invite") ?? "";
  const isInviteFlow = !!inviteCode;

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isInviteFlow && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      let res: { user: User };
      if (isInviteFlow) {
        res = await redeemInvite(inviteCode, displayName, password);
      } else {
        res = await login(displayName, password);
      }
      setUser(res.user);
      addToast(`Welcome, ${res.user.displayName}!`, "success");
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong — please try again";
      setError(
        isInviteFlow
          ? msg.includes("invite")
            ? "That invite link is invalid or has already been used."
            : "Could not create account."
          : "That didn't match — please check your display name and password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-0)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              fontSize: "2.5rem",
              marginBottom: 8,
              lineHeight: 1,
              color: "var(--accent-light)",
            }}
            aria-hidden="true"
          >
            ⟡
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginBottom: 4,
            }}
          >
            EDISON DUEL
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>a private duel club</p>
        </div>

        {/* Form panel */}
        <div className="panel">
          {/* D5b context line: shown when resuming to a duel join link */}
          {isDuelJoinResume && !isInviteFlow && (
            <p
              style={{
                color: "var(--text-1)",
                fontSize: "0.875rem",
                marginBottom: 16,
              }}
              data-testid="duel-join-context"
            >
              Sign in to join a duel
            </p>
          )}
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 20 }}>
            {isInviteFlow ? "Set up your account" : "Sign in"}
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-field">
                <label htmlFor="displayName" className="form-label">
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                  data-testid="display-name-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="password" className="form-label">
                  {isInviteFlow ? "Choose a password" : "Password"}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isInviteFlow ? "new-password" : "current-password"}
                  required
                  aria-required="true"
                  data-testid="password-input"
                />
              </div>

              {isInviteFlow && (
                <div className="form-field">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    aria-required="true"
                  />
                </div>
              )}

              {error && (
                <p id="login-error" className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !displayName || !password}
                style={{ marginTop: 4 }}
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <span className="loading-spinner" aria-hidden="true" />
                    <span>Signing in…</span>
                  </>
                ) : isInviteFlow ? (
                  "Create account ›"
                ) : (
                  "Enter ›"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help text */}
        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            color: "var(--text-2)",
            fontSize: "0.875rem",
          }}
        >
          {isInviteFlow ? (
            <>
              Already have an account? <a href="/login">Sign in</a>
            </>
          ) : (
            "First time? Open your invite link to set up."
          )}
        </p>
      </div>
    </main>
  );
}
