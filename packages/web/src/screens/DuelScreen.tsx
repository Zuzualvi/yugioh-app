/**
 * DuelScreen — the main duel board.
 *
 * Reads duelId from route params. Seat credential (seatToken + seat) comes from:
 *   1. location.state (set by RoomHandoff navigation) — fast path
 *   2. GET /api/duels/:id/seat — fallback for refresh during 'starting' (E45)
 *
 * useMock is now EXPLICIT-ONLY: only active when location.state.useMock === true.
 * A missing or refused credential renders a real error, never a silent mock board
 * (R32, R43 — fixes the ZUH-21 symptom where a missing seatToken silently started
 * a fake duel while the player's real clock ran).
 *
 * Renders:
 *   - DuelBoard (zone/LP/phase snapshot)
 *   - DuelTimer (server-authoritative countdown)
 *   - ActionPanel (typed DECISION response + RESIGN)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  DuelClientMessage,
  DuelDecision,
  DuelDecisionResponse,
  DuelServerMessage,
  DuelStateSnapshot,
  Seat,
} from "@yugioh-app/contracts";
import { ActionPanel } from "../components/ActionPanel";
import { DuelBoard } from "../components/DuelBoard";
import { DuelTimer } from "../components/DuelTimer";
import { DocsSlideIn } from "../components/DocsSlideIn";
import { openDuelSocket } from "../api/duelSocket";
import { getSeatCredential } from "../api/room";
import type { MockDuelSession } from "../mock/duelSession";

interface LocationState {
  seatToken?: string;
  seat?: Seat;
  /** dev-only: use mock session instead of real WS */
  useMock?: boolean;
}

export function DuelScreen() {
  const { duelId } = useParams<{ duelId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = (location.state as LocationState | null) ?? {};

  // useMock is explicit-only: never triggered by a missing seatToken (R32, R43).
  const useMock = locationState.useMock === true;

  const [seatToken, setSeatToken] = useState<string | undefined>(locationState.seatToken);
  const [mySeat, setMySeat] = useState<Seat | null>(locationState.seat ?? null);

  const [credentialLoading, setCredentialLoading] = useState(!useMock && !locationState.seatToken);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const [state, setState] = useState<DuelStateSnapshot | null>(null);
  const [clock, setClock] = useState<{ onClockSeat: Seat; deadlineAt: number } | null>(null);
  const [pendingDecision, setPendingDecision] = useState<DuelDecision | null>(null);
  const [duelEnded, setDuelEnded] = useState<{
    winner: Seat | null;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const mockSessionRef = useRef<MockDuelSession | null>(null);
  const socketRef = useRef<ReturnType<typeof openDuelSocket> | null>(null);

  // Fetch seat credential if not provided via router state (E45 refresh recovery)
  useEffect(() => {
    if (useMock || locationState.seatToken || !duelId) return;

    let cancelled = false;
    getSeatCredential(duelId)
      .then((cred) => {
        if (cancelled) return;
        setSeatToken(cred.seatToken);
        setMySeat(cred.seat);
        setCredentialLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCredentialError(
          "Could not retrieve your seat credential. The duel may have ended or you may not be a participant.",
        );
        setCredentialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [duelId, useMock, locationState.seatToken]);

  const respond = useCallback((r: DuelDecisionResponse) => {
    const msg: DuelClientMessage = { type: "DECISION_RESPONSE", response: r };
    if (mockSessionRef.current) {
      mockSessionRef.current.respond(r);
    } else if (socketRef.current) {
      socketRef.current.send(msg);
    }
  }, []);

  const sendMsg = useCallback(
    (msg: DuelClientMessage) => {
      if (mockSessionRef.current) {
        if (msg.type === "RESIGN") {
          mockSessionRef.current.stop();
          setDuelEnded({ winner: mySeat === 0 ? 1 : 0, reason: "resign" });
        }
      } else if (socketRef.current) {
        socketRef.current.send(msg);
      }
    },
    [mySeat],
  );

  const handleServerMessage = useCallback((msg: DuelServerMessage) => {
    switch (msg.type) {
      case "SEAT_ASSIGNED":
        setMySeat(msg.seat);
        setConnected(true);
        break;
      case "STATE":
        setState(msg.state);
        setPendingDecision(null);
        break;
      case "DECISION":
        setPendingDecision(msg.decision);
        break;
      case "CLOCK":
        setClock({ onClockSeat: msg.onClockSeat, deadlineAt: msg.deadlineAt });
        break;
      case "DUEL_END":
        setDuelEnded({ winner: msg.winner, reason: msg.reason });
        setPendingDecision(null);
        break;
      case "ERROR":
        setError(msg.message);
        break;
      case "MSG":
        break;
    }
  }, []);

  // Connect to the duel (mock or real) once credentials are available
  useEffect(() => {
    if (!duelId) return;
    if (credentialLoading) return; // wait for credential fetch to complete

    if (useMock) {
      // C1: The import() lives inside if (import.meta.env.DEV) so Rollup replaces
      // that condition with if (false) in production builds, eliminating the chunk.
      // In production useMock=true renders the credential-error path (ZUH-21).
      if (import.meta.env.DEV) {
        const seat: Seat = locationState.seat ?? 0;
        import("../mock/duelSession")
          .then(({ createMockDuelSession }) => {
            const session = createMockDuelSession(seat, handleServerMessage);
            mockSessionRef.current = session;
            setConnected(true);
            setMySeat(seat);
            session.start();
          })
          .catch(() => {
            setError("Failed to load mock session");
          });
        return () => {
          mockSessionRef.current?.stop();
          mockSessionRef.current = null;
        };
      }
      // Production: mock unavailable — same hard error as a credential failure,
      // never a silent fake board.
      setCredentialError(
        "Mock duel is not available. Please join a real duel from the home screen.",
      );
      return;
    }

    if (!seatToken) return; // credential fetch failed — handled by credentialError state

    const socket = openDuelSocket(duelId, seatToken, {
      onMessage: handleServerMessage,
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onError: () => setError("Connection error — reconnecting…"),
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [duelId, seatToken, credentialLoading, useMock]);

  const effectiveSeat: Seat = mySeat ?? 0;

  if (!duelId) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "var(--text-1)" }}>Invalid duel link.</p>
        <button className="btn" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
          Go home
        </button>
      </div>
    );
  }

  // Credential loading state (E45 refresh during 'starting')
  if (credentialLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <span className="loading-spinner" aria-label="Loading duel…" />
        <p style={{ color: "var(--text-1)" }}>Loading duel…</p>
      </div>
    );
  }

  // Credential error — real error, never a mock fallback
  if (credentialError) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p role="alert" style={{ color: "var(--invalid)", marginBottom: 16 }}>
          {credentialError}
        </p>
        <button className="btn" onClick={() => navigate("/")} style={{ marginTop: 8 }}>
          Go home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn"
          onClick={() => navigate("/")}
          style={{ minHeight: 44, padding: "6px 14px", fontSize: "1rem" }}
        >
          ← Home
        </button>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>
          ⚔ Duel
          {!connected && (
            <span
              style={{
                color: "var(--text-2)",
                fontWeight: 400,
                fontSize: "1rem",
                marginLeft: 8,
              }}
            >
              (connecting…)
            </span>
          )}
        </span>
        {clock && mySeat !== null && (
          <DuelTimer
            onClockSeat={clock.onClockSeat}
            deadlineAt={clock.deadlineAt}
            mySeat={effectiveSeat}
          />
        )}
        <button
          className="btn btn-ghost"
          onClick={() => setDocsOpen(true)}
          aria-label="Open Rules & Guides"
          style={{ padding: "6px 12px", minHeight: 44, marginLeft: "auto", fontSize: "1rem" }}
          title="Rules & Guides"
        >
          ?
        </button>
      </header>

      {docsOpen && <DocsSlideIn onClose={() => setDocsOpen(false)} />}

      {error && (
        <div
          role="alert"
          style={{
            background: "rgba(224,82,82,0.15)",
            border: "1px solid var(--invalid)",
            color: "var(--invalid)",
            padding: "10px 20px",
            fontSize: "1rem",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {duelEnded && (
        <DuelEndBanner
          winner={duelEnded.winner}
          reason={duelEnded.reason}
          mySeat={effectiveSeat}
          onHome={() => navigate("/")}
        />
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 16,
          maxWidth: 1024,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {state ? (
          <>
            <DuelBoard state={state} mySeat={effectiveSeat} />
            <ActionPanel
              decision={pendingDecision}
              respond={respond}
              onSend={sendMsg}
              disabled={!!duelEnded}
            />
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "var(--text-2)",
              fontSize: "1rem",
            }}
          >
            {connected ? "Waiting for duel to start…" : "Connecting…"}
          </div>
        )}
      </main>
    </div>
  );
}

interface DuelEndBannerProps {
  winner: Seat | null;
  reason: string;
  mySeat: Seat;
  onHome: () => void;
}

function DuelEndBanner({ winner, reason, mySeat, onHome }: DuelEndBannerProps) {
  const iWon = winner === mySeat;
  const isDraw = winner === null;

  let resultText: string;
  if (isDraw) {
    resultText = "Draw!";
  } else if (iWon) {
    resultText = "You win!";
  } else {
    resultText = "You lose.";
  }

  let reasonText: string;
  if (reason === "timeout") {
    resultText = iWon ? "🏆 You win!" : "You lose.";
    reasonText = iWon ? "Opponent's move timer ran out." : "Your move timer ran out.";
  } else if (reason === "resign") {
    reasonText = iWon ? "Opponent resigned." : "You resigned.";
  } else {
    reasonText = iWon ? "Opponent's LP reached 0." : "Your LP reached 0.";
  }

  return (
    <div
      data-testid="duel-end-banner"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 40,
          textAlign: "center",
          maxWidth: 360,
          width: "90%",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
          {isDraw ? "🤝" : iWon ? "🏆" : "💀"}
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>{resultText}</h2>
        <p
          style={{
            color: "var(--text-1)",
            fontSize: "1rem",
            marginBottom: 28,
          }}
          data-testid="duel-end-reason"
        >
          {reasonText}
        </p>
        <button
          className="btn btn-primary"
          onClick={onHome}
          style={{ minHeight: 44, padding: "10px 32px", width: "100%" }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
