/**
 * DuelScreen — composition root for the duel UI rebuild (W1).
 *
 * Credential and socket layer is unchanged from the previous implementation.
 * The rendering layer now uses DuelStage, which owns the interaction modes
 * and the board/chrome layout.
 *
 * Design authority: docs/specs/2026-08-06-duel-ui-design.md
 * Engineering spec: docs/specs/2026-08-07-duel-ui-rebuild-engineering.md
 *
 * CSS custom properties declared here (W1 owns them; W2 and W3 consume, never redefine):
 *   --own   blue  (yours)
 *   --opp   red   (theirs)
 *   --dim-opacity  0.45 (Law 2)
 *
 * Preserved behaviours (G3 — no regressions):
 *   - useMock explicit-only (AC7, R32, R43)
 *   - Seat credential recovery from server (E45)
 *   - role=alert on credential failure
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  DuelClientMessage,
  DuelDecision,
  DuelDecisionResponse,
  DuelEvent,
  DuelServerMessage,
  DuelStateSnapshot,
  Seat,
} from "@yugioh-app/contracts";
import { DuelStage } from "../components/duel/board/DuelStage";
import { DuelTopBar } from "../components/duel/chrome/DuelTopBar";
import { openDuelSocket } from "../api/duelSocket";
import { getSeatCredential } from "../api/room";
import type { DuelSettings } from "../components/duel/chrome/SettingsPopover";
import type { MockDuelSession } from "../mock/duelSession";

// ── CSS custom properties (W1 declares once) ─────────────────────────────────
const DUEL_CSS = `
:root {
  --own: #3b82f6;
  --opp: #ef4444;
  --dim-opacity: 0.45;
}
`;

interface LocationState {
  seatToken?: string;
  seat?: Seat;
  /** dev-only: use mock session instead of real WS */
  useMock?: boolean;
}

const DEFAULT_SETTINGS: DuelSettings = {
  chooseZones: false,
  selfChain: false,
  activationOrder: false,
  reduceMotion: false,
};

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
  const [clock, setClock] = useState<{
    onClockSeat: Seat;
    deadlineAt: number;
    deadlines?: [number, number];
  } | null>(null);
  const [pendingDecision, setPendingDecision] = useState<DuelDecision | null>(null);
  const [events, setEvents] = useState<DuelEvent[]>([]);
  const [duelEnded, setDuelEnded] = useState<{
    winner: Seat | null;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"open" | "reconnecting" | "closed">("closed");
  const [settings, setSettings] = useState<DuelSettings>(DEFAULT_SETTINGS);
  const [logOpen, setLogOpen] = useState(false);

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

  const handleServerMessage = useCallback((msg: DuelServerMessage) => {
    switch (msg.type) {
      case "SEAT_ASSIGNED":
        setMySeat(msg.seat);
        setConnection("open");
        break;
      case "STATE":
        setState(msg.state);
        // NOTE: pendingDecision is NOT cleared here (requirement B2 / intent survival).
        // W2's state machine owns intent; W1 only tracks the decision for mode derivation.
        // The decision is cleared when a new DECISION frame arrives (or DUEL_END).
        break;
      case "DECISION":
        setPendingDecision(msg.decision);
        break;
      case "CLOCK":
        setClock({
          onClockSeat: msg.onClockSeat,
          deadlineAt: msg.deadlineAt,
          deadlines: (msg as { deadlines?: [number, number] }).deadlines,
        });
        break;
      case "EVENTS":
        setEvents((prev) => [...prev, ...((msg as { events: DuelEvent[] }).events ?? [])]);
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
    if (credentialLoading) return;

    if (useMock) {
      if (import.meta.env.DEV) {
        const seat: Seat = locationState.seat ?? 0;
        import("../mock/duelSession")
          .then(({ createMockDuelSession }) => {
            const session = createMockDuelSession(seat, handleServerMessage);
            mockSessionRef.current = session;
            setConnection("open");
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
      setCredentialError(
        "Mock duel is not available. Please join a real duel from the home screen.",
      );
      return;
    }

    if (!seatToken) return;

    const socket = openDuelSocket(duelId, seatToken, {
      onMessage: handleServerMessage,
      onOpen: () => setConnection("open"),
      onClose: () => setConnection("closed"),
      onError: () => {
        setConnection("reconnecting");
        setError("Connection error — reconnecting…");
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [duelId, seatToken, credentialLoading, useMock]);

  const effectiveSeat: Seat = mySeat ?? 0;

  function handleResign() {
    const msg: DuelClientMessage = { type: "RESIGN" };
    if (mockSessionRef.current) {
      mockSessionRef.current.stop();
      setDuelEnded({ winner: effectiveSeat === 0 ? 1 : 0, reason: "resign" });
    } else if (socketRef.current) {
      socketRef.current.send(msg);
    }
  }

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

  // Clock for DuelStage
  const clockForStage = clock
    ? {
        onClockSeat: clock.onClockSeat,
        deadlines: clock.deadlines ?? ([clock.deadlineAt, clock.deadlineAt] as [number, number]),
      }
    : null;

  return (
    <>
      {/* W1 CSS custom properties — declared once here */}
      <style>{DUEL_CSS}</style>

      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-0)",
          // 1440px is the floor (G1)
          minWidth: 1440,
        }}
      >
        {/* Error strip (amber, under top bar) */}
        {error && (
          <div
            role="alert"
            style={{
              background: "rgba(212,135,42,0.15)",
              border: "1px solid var(--warning)",
              color: "var(--warning)",
              padding: "6px 16px",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚠ {error}
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "var(--warning)",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Top bar */}
        <DuelTopBar
          opponentName="Opponent"
          connection={connection}
          turnNumber={state?.turnNumber ?? null}
          currentTurn={state?.currentTurn ?? 0}
          mySeat={effectiveSeat}
          logOpen={logOpen}
          onLogToggle={() => setLogOpen((v) => !v)}
          settings={settings}
          onSettingsChange={setSettings}
          onResign={handleResign}
          onExit={() => navigate("/")}
          duelEnded={!!duelEnded}
        />

        {/* Main content */}
        {state ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* DuelStage */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <DuelStage
                state={state}
                decision={pendingDecision}
                mySeat={effectiveSeat}
                clock={clockForStage}
                events={events}
                respond={respond}
                connection={connection}
              />
            </div>

            {/* W3 SLOT: EventLogRail — mounted when logOpen */}
            {logOpen && (
              <div
                data-testid="log-rail-stub"
                style={{
                  width: 320,
                  borderLeft: "1px solid var(--border)",
                  background: "var(--bg-1)",
                  padding: 12,
                  flexShrink: 0,
                  fontSize: "0.875rem",
                  color: "var(--text-2)",
                }}
              >
                Event log (W3 coming)
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-2)",
              fontSize: "1rem",
            }}
          >
            {connection === "open" ? "Waiting for duel to start…" : "Connecting…"}
          </div>
        )}

        {/* Duel-end overlay (W3 slot — basic version) */}
        {duelEnded && (
          <DuelEndOverlay
            winner={duelEnded.winner}
            reason={duelEnded.reason}
            mySeat={effectiveSeat}
            onHome={() => navigate("/")}
          />
        )}
      </div>
    </>
  );
}

// ── DuelEndOverlay (inline for now — W3 will extend) ─────────────────────────

interface DuelEndOverlayProps {
  winner: Seat | null;
  reason: string;
  mySeat: Seat;
  onHome: () => void;
}

function DuelEndOverlay({ winner, reason, mySeat, onHome }: DuelEndOverlayProps) {
  const iWon = winner === mySeat;
  const isDraw = winner === null;

  let resultText: string;
  if (isDraw) resultText = "Draw!";
  else if (iWon) resultText = "You win!";
  else resultText = "You lose.";

  let reasonText: string;
  if (reason === "timeout") {
    reasonText = iWon
      ? "Opponent's move timer ran out."
      : "Your move timer ran out — the duel is forfeit.";
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
          maxWidth: 400,
          width: "90%",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
          {isDraw ? "🤝" : iWon ? "🏆" : "💀"}
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>{resultText}</h2>
        <p
          data-testid="duel-end-reason"
          style={{ color: "var(--text-1)", fontSize: "1rem", marginBottom: 28 }}
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
