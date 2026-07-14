/**
 * DuelScreen — the main duel board.
 *
 * Reads duelId from route params, seatToken + seat from location.state
 * (set by CreateDuelScreen / JoinDuelScreen).  In dev/test mode, wires up
 * the mock duel session instead of the real WebSocket.
 *
 * Renders:
 *   - DuelBoard (zone/LP/phase snapshot)
 *   - DuelTimer (server-authoritative countdown)
 *   - ActionPanel (interactive decision responses + RESIGN)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  DuelClientMessage,
  DuelServerMessage,
  DuelStateSnapshot,
  RedactedEngineMessage,
  Seat,
} from "@yugioh-app/contracts";
import { ActionPanel } from "../components/ActionPanel";
import { DuelBoard } from "../components/DuelBoard";
import { DuelTimer } from "../components/DuelTimer";
import { openDuelSocket } from "../api/duelSocket";
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
  const { seatToken, seat: seatFromState } = locationState;

  // Seat assigned from SEAT_ASSIGNED or from navigation state
  const [mySeat, setMySeat] = useState<Seat | null>(seatFromState ?? null);
  const [state, setState] = useState<DuelStateSnapshot | null>(null);
  const [clock, setClock] = useState<{ onClockSeat: Seat; deadlineAt: number } | null>(null);
  const [pendingDecision, setPendingDecision] = useState<RedactedEngineMessage | null>(null);
  const [duelEnded, setDuelEnded] = useState<{
    winner: Seat | null;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const mockSessionRef = useRef<MockDuelSession | null>(null);
  const socketRef = useRef<ReturnType<typeof openDuelSocket> | null>(null);

  const sendMsg = useCallback(
    (msg: DuelClientMessage) => {
      if (mockSessionRef.current) {
        if (msg.type === "RESPONSE") {
          mockSessionRef.current.respond(msg.response.value as number | string | null);
        } else if (msg.type === "RESIGN") {
          mockSessionRef.current.stop();
          setDuelEnded({ winner: mySeat === 0 ? 1 : 0, reason: "resign" });
        }
      } else if (socketRef.current) {
        socketRef.current.send(msg);
      }
    },
    [mySeat],
  );

  const handleServerMessage = useCallback(
    (msg: DuelServerMessage) => {
      switch (msg.type) {
        case "SEAT_ASSIGNED":
          setMySeat(msg.seat);
          setConnected(true);
          break;

        case "STATE":
          setState(msg.state);
          // A state update after a decision message clears the pending decision
          setPendingDecision(null);
          break;

        case "MSG": {
          const { msg: engineMsg } = msg;
          // Only route decision messages that target our seat (or have no player)
          const targetsSeat =
            engineMsg.player === undefined ||
            engineMsg.player === null ||
            engineMsg.player === mySeat;
          if (targetsSeat) {
            setPendingDecision(engineMsg);
          }
          break;
        }

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
      }
    },
    [mySeat],
  );

  useEffect(() => {
    if (!duelId) return;

    // Use mock session if no seatToken (dev mode) or explicitly requested
    const useMock = !seatToken || locationState.useMock;

    if (useMock) {
      const seat: Seat = seatFromState ?? 0;
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

    // Real WebSocket
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
  }, [duelId, seatToken]);

  // DUEL_END after timeout: clear pending decision
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

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
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
          style={{ minHeight: 40, padding: "6px 14px", fontSize: "0.875rem" }}
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
                fontSize: "0.8125rem",
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
      </header>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            background: "rgba(224,82,82,0.15)",
            border: "1px solid var(--invalid)",
            color: "var(--invalid)",
            padding: "10px 20px",
            fontSize: "0.875rem",
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Duel ended overlay */}
      {duelEnded && (
        <DuelEndBanner
          winner={duelEnded.winner}
          reason={duelEnded.reason}
          mySeat={effectiveSeat}
          onHome={() => navigate("/")}
        />
      )}

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 16,
          maxWidth: 900,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {state ? (
          <>
            <DuelBoard state={state} mySeat={effectiveSeat} />
            <ActionPanel decision={pendingDecision} onSend={sendMsg} disabled={!!duelEnded} />
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "var(--text-2)",
              fontSize: "0.9375rem",
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
        <div
          style={{
            fontSize: "2.5rem",
            marginBottom: 12,
          }}
        >
          {isDraw ? "🤝" : iWon ? "🏆" : "💀"}
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>{resultText}</h2>
        <p
          style={{
            color: "var(--text-1)",
            fontSize: "0.9375rem",
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
