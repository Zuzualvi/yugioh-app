/**
 * JoinLandingScreen — /duel/join/:token
 *
 * Handles all join-route outcomes for authenticated and unauthenticated visitors:
 *   D1 — link expired
 *   D2 — room already full / duel already started
 *   D3 — your own link (redirect to room)
 *   D5 — logged-out visitor (public landing)
 *   D5b handled via LoginScreen context line + RequireAuth resume
 *
 * This route is public (no RequireAuth wrapper) so unauthenticated visitors land here.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { PreJoinRoomInfo } from "@yugioh-app/contracts";
import { lookupJoinToken, claimRoom } from "../api/room";
import { useAuth } from "../context/AuthContext";

type Phase =
  | { tag: "loading" }
  | { tag: "public_landing"; info: PreJoinRoomInfo }
  | { tag: "expired"; info: PreJoinRoomInfo }
  | { tag: "full"; info: PreJoinRoomInfo }
  | { tag: "claiming" }
  | { tag: "error"; message: string };

export function JoinLandingScreen() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>({ tag: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!joinToken) {
      setPhase({ tag: "error", message: "No join token in URL." });
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const info = await lookupJoinToken(joinToken!);

        if (cancelled) return;

        if (info.reason === "expired") {
          setPhase({ tag: "expired", info });
          return;
        }

        if (info.reason === "closed" || info.reason === "started") {
          setPhase({ tag: "full", info });
          return;
        }

        if (info.reason === "claimed_by_other") {
          setPhase({ tag: "full", info });
          return;
        }

        if (info.reason === "you_are_the_creator" || info.reason === "you_are_an_occupant") {
          // Existing occupant — look up their room and redirect
          // We need to claim (idempotent) to get the snapshot with the roomId
          const snapshot = await claimRoom({ joinToken: joinToken! });
          if (!cancelled) navigate(`/duel/${snapshot.roomId}/room`, { replace: true });
          return;
        }

        // reason === 'ok'
        if (!user) {
          // Logged-out visitor → show public landing (D5)
          setPhase({ tag: "public_landing", info });
          return;
        }

        // Authenticated user with a valid link → claim it
        setPhase({ tag: "claiming" });
        const snapshot = await claimRoom({ joinToken: joinToken! });
        if (!cancelled) navigate(`/duel/${snapshot.roomId}/room`, { replace: true });
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setPhase({ tag: "error", message });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [joinToken, user, authLoading, navigate]);

  if (phase.tag === "loading" || phase.tag === "claiming" || authLoading) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-0)",
        }}
      >
        <span className="loading-spinner" aria-label="Loading…" />
      </main>
    );
  }

  const headerBar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px 0",
        borderBottom: "1px solid var(--border)",
        marginBottom: 24,
      }}
    >
      <button
        className="btn btn-ghost"
        style={{ padding: "8px 12px", minHeight: "var(--min-touch)" }}
        onClick={() => navigate("/")}
        aria-label="Go home"
      >
        ← Home
      </button>
      <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>⚔ Duel</h1>
    </div>
  );

  // D5 — logged-out visitor (public landing)
  if (phase.tag === "public_landing") {
    const { info } = phase;
    const creatorName = info.creatorDisplayName || null;
    const minutes = Math.round(info.perMoveSeconds / 60);

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
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
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

          <div className="panel">
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 16 }}>
              {creatorName
                ? `${creatorName} challenged you to a duel`
                : "You've been challenged to a duel"}
            </h2>

            {/* Timer strip */}
            <div
              style={{
                background: "var(--bg-2)",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 20,
                color: "var(--accent-light)",
                fontSize: "0.875rem",
              }}
            >
              ⏱ {minutes} min per move · live duel
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", minHeight: "var(--min-touch)", marginBottom: 20 }}
              onClick={() =>
                navigate("/login", {
                  state: { from: `/duel/join/${joinToken}` },
                })
              }
            >
              Sign in to join ›
            </button>

            <hr
              style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0 0 20px" }}
            />

            <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 8 }}>No account?</p>
            <p style={{ color: "var(--text-1)", fontSize: "0.875rem", lineHeight: 1.6 }}>
              Edison Duel is invite-only while it&rsquo;s in beta. A duel link isn&rsquo;t a sign-up
              link — you need a separate invite from a member.
            </p>
            <p
              style={{
                color: "var(--text-1)",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                marginTop: 12,
              }}
            >
              {creatorName
                ? `Reply to ${creatorName} and ask for one.`
                : "Reply to the person who sent you this link and ask for one."}{" "}
              This duel link expires in 30 minutes, so they&rsquo;ll probably need to send a fresh
              one after you&rsquo;re set up.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // D1 — link expired
  if (phase.tag === "expired") {
    const { info } = phase;
    const creatorName = info.creatorDisplayName || null;

    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "var(--bg-0)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
          {headerBar}
          <div className="panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }} aria-hidden="true">
              ⏳
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 16 }}>
              This challenge has expired
            </h2>
            <p
              style={{
                color: "var(--text-1)",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              {creatorName ? `${creatorName}'s challenge link` : "This challenge link"} was created
              more than 30 minutes ago. Challenge links don&rsquo;t last longer than that.
            </p>
            <p
              style={{
                color: "var(--text-1)",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {creatorName
                ? `Ask ${creatorName} for a new link — or start`
                : "Ask for a new link — or start"}{" "}
              your own duel and send them one.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", minHeight: "var(--min-touch)", marginBottom: 10 }}
              onClick={() => navigate("/duel/new")}
            >
              Challenge someone ▸
            </button>
            <button
              className="btn"
              style={{ width: "100%", minHeight: "var(--min-touch)" }}
              onClick={() => navigate("/")}
            >
              Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // D2 — full / already started
  if (phase.tag === "full") {
    const { info } = phase;
    const creatorName = info.creatorDisplayName || null;

    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "var(--bg-0)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
          {headerBar}
          <div className="panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }} aria-hidden="true">
              👥
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 16 }}>
              This duel already has two players
            </h2>
            <p
              style={{
                color: "var(--text-1)",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Someone else opened {creatorName ? `${creatorName}'s` : "this"} link first, or the
              duel has already started.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", minHeight: "var(--min-touch)", marginBottom: 10 }}
              onClick={() => navigate("/duel/new")}
            >
              Challenge someone ▸
            </button>
            <button
              className="btn"
              style={{ width: "100%", minHeight: "var(--min-touch)" }}
              onClick={() => navigate("/")}
            >
              Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Generic error fallback
  const errorMessage = phase.tag === "error" ? phase.message : "Something went wrong.";
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        {headerBar}
        <div className="panel" style={{ textAlign: "center" }}>
          <p className="form-error" role="alert" style={{ marginBottom: 20 }}>
            {errorMessage}
          </p>
          <button
            className="btn"
            style={{ width: "100%", minHeight: "var(--min-touch)" }}
            onClick={() => navigate("/")}
          >
            Home
          </button>
        </div>
      </div>
    </main>
  );
}
