/**
 * RoomWaiting — S2/S4/S5/S6 phases:
 *   S2 creator waiting alone; S4 both present neither ready;
 *   S5 you ready opponent not; S6 they ready you not.
 *
 * Also renders the D4 revert banner when the room reverts from filled→open
 * due to the opponent leaving (T11).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RoomSnapshot } from "@yugioh-app/contracts";
import type { DeckSummary } from "../../types/contracts";
import { listDecks } from "../../api/decks";
import { pickDeck, ready, unready, leaveRoom } from "../../api/room";
import { ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface Props {
  snapshot: RoomSnapshot;
}

// ── Small helpers ─────────────────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  if (ms <= 60_000) return `${Math.ceil(ms / 1000)}s`;
  if (ms <= 5 * 60_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.ceil((ms % 60_000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${Math.ceil(ms / 60_000)} min`;
}

function deadlineColor(msLeft: number): string {
  if (msLeft <= 60_000) return "var(--invalid)";
  if (msLeft <= 5 * 60_000) return "var(--warning)";
  return "var(--text-1)";
}

// ── Component ─────────────────────────────────────────────────────────────

export function RoomWaiting({ snapshot }: Props) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(snapshot.you.deckId ?? null);
  const [picking, setPicking] = useState(false);
  const [readying, setReadying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // D4 revert banner: shown when the room reverted to open after opponent left
  const [revertBanner, setRevertBanner] = useState<string | null>(null);

  // Track previous snapshot to detect T11 revert
  const prevSnapshotRef = useRef<RoomSnapshot | null>(null);

  // Elapsed time for waiting display (client-side, approximate)
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedStartRef = useRef(Date.now());

  // Deadline countdown
  const [msUntilDeadline, setMsUntilDeadline] = useState<number | null>(null);

  // ── Side effects ──────────────────────────────────────────────────────

  // Load deck list on mount
  useEffect(() => {
    listDecks()
      .then((res) => {
        setDecks(res.decks);
      })
      .catch(() => {
        // Silently fail — deck list degrades gracefully
      })
      .finally(() => {
        setDecksLoading(false);
      });
  }, []);

  // Sync selected deck from snapshot (so it survives refreshes per E16)
  useEffect(() => {
    if (snapshot.you.deckId !== null) {
      setSelectedDeckId(snapshot.you.deckId);
    }
  }, [snapshot.you.deckId]);

  // Detect transitions: opponent arrival (open→filled) and T11 revert (filled→open)
  useEffect(() => {
    const prev = prevSnapshotRef.current;
    if (prev !== null) {
      // Opponent just arrived
      if (prev.status === "open" && snapshot.status === "filled" && snapshot.opponent) {
        const name = snapshot.opponent.displayName || "Your opponent";
        addToast(`${name} joined the room`, "success");
        document.title = `(1) ${name} joined — Edison Duel`;
      }
      // T11 revert: opponent left while filled
      if (prev.status === "filled" && snapshot.status === "open" && prev.opponent !== null) {
        const opponentName = prev.opponent.displayName || "Your opponent";
        const wasReady = prev.you.ready;
        let msg = `⚠ ${opponentName} left the room.`;
        if (wasReady) msg += " You've been un-readied.";
        setRevertBanner(msg);
        document.title = "Edison Duel";
      }
    }
    prevSnapshotRef.current = snapshot;
  }, [snapshot, addToast]);

  // Reset elapsed on opponent arrival
  useEffect(() => {
    if (snapshot.status === "filled") {
      elapsedStartRef.current = Date.now();
    }
  }, [snapshot.status]);

  // Update elapsed ticker every second
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - elapsedStartRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Deadline countdown every second
  useEffect(() => {
    if (snapshot.roomDeadlineAt === null) {
      setMsUntilDeadline(null);
      return;
    }
    function update() {
      if (snapshot.roomDeadlineAt === null) return;
      setMsUntilDeadline(snapshot.roomDeadlineAt - Date.now());
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [snapshot.roomDeadlineAt]);

  // Reset title on unmount
  useEffect(() => {
    return () => {
      document.title = "Edison Duel";
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handlePickDeck = useCallback(
    async (deckId: string) => {
      if (snapshot.you.deckLocked) return;
      setSelectedDeckId(deckId);
      setPicking(true);
      try {
        await pickDeck(snapshot.roomId, { deckId });
      } catch (err) {
        if (err instanceof ApiError) {
          setInlineError(err.message);
        }
        // Revert local selection on error
        setSelectedDeckId(snapshot.you.deckId ?? null);
      } finally {
        setPicking(false);
      }
    },
    [snapshot.roomId, snapshot.you.deckId, snapshot.you.deckLocked],
  );

  const handleReady = useCallback(async () => {
    setReadying(true);
    setInlineError(null);
    try {
      await ready(snapshot.roomId);
    } catch (err) {
      if (err instanceof ApiError) {
        setInlineError(err.message);
      }
    } finally {
      setReadying(false);
    }
  }, [snapshot.roomId]);

  const handleUnready = useCallback(async () => {
    setReadying(true);
    setInlineError(null);
    try {
      await unready(snapshot.roomId);
    } catch (err) {
      if (err instanceof ApiError) {
        setInlineError(err.message);
      }
    } finally {
      setReadying(false);
    }
  }, [snapshot.roomId]);

  const handleLeave = useCallback(async () => {
    setLeaving(true);
    setShowLeaveConfirm(false);
    try {
      await leaveRoom(snapshot.roomId);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "leave_not_allowed") {
        setInlineError("Cannot leave once the duel is starting.");
      } else if (err instanceof ApiError) {
        setInlineError(err.message);
      }
    } finally {
      setLeaving(false);
    }
  }, [snapshot.roomId, navigate]);

  const handleLeaveClick = useCallback(() => {
    if (snapshot.you.role === "creator") {
      setShowLeaveConfirm(true);
    } else {
      // Invitee: no confirm (§4.3)
      void handleLeave();
    }
  }, [snapshot.you.role, handleLeave]);

  const handleShare = useCallback(() => {
    if (!snapshot.joinToken) return;
    const url = `${window.location.origin}/duel/join/${snapshot.joinToken}`;
    if (navigator.share) {
      void navigator.share({ title: "Edison Duel challenge", url });
    }
  }, [snapshot.joinToken]);

  const handleCopy = useCallback(() => {
    if (!snapshot.joinToken) return;
    const url = `${window.location.origin}/duel/join/${snapshot.joinToken}`;
    navigator.clipboard.writeText(url).then(
      () => addToast("Link copied!", "success"),
      () => setInlineError("Copy failed — select the link text and copy manually."),
    );
  }, [snapshot.joinToken, addToast]);

  // ── Derived state ─────────────────────────────────────────────────────

  const { you, opponent, status } = snapshot;
  const isCreator = you.role === "creator";
  const hasOpponent = opponent !== null;
  const deckLocked = you.deckLocked;

  const readyButtonDisabled =
    !hasOpponent || (!selectedDeckId && !deckLocked) || readying || picking;

  const readyButtonLabel = !hasOpponent
    ? "Ready — waiting for opponent"
    : !selectedDeckId && !deckLocked
      ? "Pick a deck first"
      : readying
        ? "…"
        : "Ready ✓";

  const joinUrl = snapshot.joinToken
    ? `${window.location.origin}/duel/join/${snapshot.joinToken}`
    : null;

  const deadlineText =
    msUntilDeadline !== null && msUntilDeadline > 0
      ? `Link expires in ${fmtRemaining(msUntilDeadline)}`
      : null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <section aria-label="Duel room">
      {/* Inline error */}
      {inlineError && (
        <div
          role="alert"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--invalid)",
            color: "var(--invalid)",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
            fontSize: "0.875rem",
          }}
        >
          {inlineError}
        </div>
      )}

      {/* D4 revert banner */}
      {revertBanner && (
        <div
          role="status"
          aria-live="assertive"
          style={{
            background: "var(--warning)",
            color: "#000",
            padding: "8px 16px",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {revertBanner}
          <button
            onClick={() => setRevertBanner(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Rules strip */}
      <div
        data-testid="room-timer-strip"
        style={{
          background: "var(--bg-2)",
          color: "var(--accent-light)",
          padding: "8px 12px",
          borderRadius: 6,
          marginBottom: 16,
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span aria-hidden>⏱</span>
        <span>{snapshot.perMoveSeconds / 60} min per move · live</span>
      </div>

      {/* Players panel */}
      <div className="panel" style={{ marginBottom: 20 }} aria-label="Players">
        {/* You (always top) */}
        <PlayerRow
          name={`You (${you.displayName})`}
          label={you.ready ? "READY" : you.deckSelected ? "Deck chosen" : "Picking a deck"}
          isReady={you.ready}
        />

        <hr style={{ margin: "8px 0", border: "none", borderTop: "1px solid var(--border)" }} />

        {/* Opponent (always bottom) */}
        {hasOpponent && opponent ? (
          <div data-testid="opponent-presence">
            <PlayerRow
              name={opponent.displayName || "Your opponent"}
              label={
                opponent.ready ? "READY" : opponent.deckSelected ? "Deck chosen" : "Picking a deck"
              }
              isReady={opponent.ready}
              presence={opponent.presence}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              color: "var(--text-2)",
            }}
          >
            <span aria-hidden style={{ fontSize: "1.1rem" }}>
              ○
            </span>
            <span style={{ flex: 1 }}>Waiting for an opponent…</span>
            <WaitingPulse />
          </div>
        )}

        {/* Elapsed counter */}
        {!hasOpponent && (
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-2)",
              paddingLeft: 24,
              paddingTop: 2,
            }}
          >
            Waiting {fmtElapsed(elapsedMs)}
          </div>
        )}
      </div>

      {/* Share block — only for creator while status='open' */}
      {isCreator && status === "open" && joinUrl && (
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              marginBottom: 8,
              color: "var(--text-0)",
            }}
          >
            Send this link to your opponent
          </p>
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              marginBottom: 8,
              userSelect: "text",
              wordBreak: "break-all",
            }}
            aria-label="Invite link"
            data-testid="join-link"
          >
            {joinUrl}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            {typeof navigator.share === "function" && (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleShare}
                aria-label="Share invite link"
              >
                ↗ Share link
              </button>
            )}
            <button
              className={typeof navigator.share === "function" ? "btn" : "btn btn-primary"}
              style={{ flex: 1 }}
              onClick={handleCopy}
              aria-label="Copy invite link"
            >
              🔗 Copy
            </button>
          </div>
          {deadlineText && msUntilDeadline !== null && (
            <p
              style={{
                fontSize: "0.875rem",
                color: deadlineColor(msUntilDeadline),
                marginTop: 4,
              }}
              aria-live="polite"
            >
              {deadlineText}
              {msUntilDeadline <= 5 * 60_000 && " — you can create a fresh one after that."}
            </p>
          )}
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-2)",
              marginTop: 8,
            }}
          >
            You can close this page; the link keeps working. Come back here to see when they join.
          </p>
        </div>
      )}

      {/* Deck picker section */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.9375rem",
            marginBottom: 10,
            color: "var(--text-0)",
          }}
        >
          — Your deck ——————————————————————
        </p>

        {deckLocked ? (
          /* Locked summary row after ready */
          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg-2)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9375rem",
              color: "var(--text-0)",
            }}
            aria-label={`Locked deck: ${you.deckName ?? "deck"}`}
          >
            <span aria-hidden>🔒</span>
            <span>
              {you.deckName ?? "Deck"}{" "}
              <span style={{ color: "var(--text-2)" }}>· {you.deckCardCount ?? 0} cards</span>
            </span>
          </div>
        ) : decksLoading ? (
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>Loading decks…</p>
        ) : decks.length === 0 ? (
          <div>
            <p
              style={{
                color: "var(--text-2)",
                fontSize: "0.875rem",
                marginBottom: 10,
              }}
            >
              No decks yet — build one while you wait.
            </p>
            <a href="/decks/new" className="btn" style={{ fontSize: "0.875rem" }}>
              Build a deck
            </a>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Select your deck">
            {decks.map((deck) => {
              const isSelected = deck.id === selectedDeckId;
              return (
                <label
                  key={deck.id}
                  data-testid="deck-option"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 6,
                    border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    background: isSelected ? "var(--accent-dim)" : "var(--bg-1)",
                    cursor: "pointer",
                    marginBottom: 6,
                    transition: "border-color 0.22s, background 0.22s",
                    opacity: picking ? 0.7 : 1,
                  }}
                >
                  <input
                    type="radio"
                    name="deck"
                    value={deck.id}
                    checked={isSelected}
                    onChange={() => {
                      void handlePickDeck(deck.id);
                    }}
                    disabled={picking || deckLocked}
                    style={{ accentColor: "var(--accent)" }}
                    aria-label={`${deck.name}, ${deck.counts.main + deck.counts.extra} cards${deck.isValid ? "" : " (not legal)"}`}
                  />
                  <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>{deck.name}</span>
                  <span style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                    {deck.counts.main + deck.counts.extra} cards
                  </span>
                  {!deck.isValid && (
                    <span className="validity-chip invalid" style={{ fontSize: "0.75rem" }}>
                      Not legal
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {!deckLocked && decks.length > 0 && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-2)",
              marginTop: 6,
            }}
          >
            You can change this until you hit Ready.
          </p>
        )}
      </div>

      {/* Ready / Unready button */}
      {deckLocked ? (
        <button
          className="btn btn-ghost"
          data-testid="room-unready-btn"
          style={{ width: "100%", marginBottom: 12 }}
          onClick={() => {
            void handleUnready();
          }}
          disabled={readying}
          aria-label="Unready"
        >
          Unready
        </button>
      ) : (
        <button
          className="btn btn-primary"
          data-testid="room-ready-btn"
          style={{ width: "100%", marginBottom: 12 }}
          onClick={() => {
            void handleReady();
          }}
          disabled={readyButtonDisabled}
          aria-label={readyButtonLabel}
        >
          {readyButtonLabel}
        </button>
      )}

      {/* Status line (aria-live, §10.4) */}
      <div
        role="status"
        aria-live="polite"
        style={{
          textAlign: "center",
          color: opponent?.ready && !you.ready ? "var(--accent-light)" : "var(--text-2)",
          fontSize: "0.875rem",
          minHeight: "1.5em",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        {statusLine(you, opponent)}
      </div>

      {/* Leave button (accessible from the body since we can't put it in the header) */}
      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-start" }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: "0.875rem" }}
          onClick={handleLeaveClick}
          disabled={leaving}
          aria-label="← Leave"
        >
          ← Leave
        </button>
      </div>

      {/* Creator leave confirm dialog */}
      {showLeaveConfirm && (
        <div
          className="overlay-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-dialog-title"
        >
          <div className="overlay-panel">
            <h2 id="leave-dialog-title" style={{ marginBottom: 12 }}>
              Leave this room?
            </h2>
            <p style={{ color: "var(--text-1)", marginBottom: 20, fontSize: "0.9375rem" }}>
              Your challenge link stops working and nothing is recorded.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  void handleLeave();
                }}
                disabled={leaving}
                autoFocus
              >
                Leave
              </button>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => setShowLeaveConfirm(false)}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

interface PlayerRowProps {
  name: string;
  label: string;
  isReady: boolean;
  presence?: "connected" | "away" | "left";
}

function PlayerRow({ name, label, isReady, presence }: PlayerRowProps) {
  const dotSymbol = isReady ? "✓" : "●";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        background: isReady ? "var(--accent-dim)" : undefined,
        borderRadius: 4,
        border: isReady ? "1px solid var(--accent)" : "1px solid transparent",
        paddingLeft: isReady ? 8 : 0,
        paddingRight: isReady ? 8 : 0,
        transition: "background 0.22s, border-color 0.22s",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: "1.1rem",
          color: isReady ? "var(--accent)" : "var(--text-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isReady ? "var(--accent)" : "transparent",
          fontWeight: 700,
        }}
      >
        {dotSymbol}
      </span>
      <span style={{ flex: 1, fontWeight: isReady ? 600 : 400 }}>
        {name}
        {presence === "away" && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-2)",
              marginLeft: 6,
            }}
          >
            (away)
          </span>
        )}
      </span>
      <span
        style={{
          color: isReady ? "var(--accent-light)" : "var(--text-2)",
          fontWeight: isReady ? 700 : 400,
          fontSize: "0.875rem",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function WaitingPulse() {
  return (
    <span
      aria-hidden
      style={{ color: "var(--text-2)", letterSpacing: "0.15em" }}
      className="waiting-pulse"
    >
      ▮▮▮
    </span>
  );
}

function statusLine(you: RoomSnapshot["you"], opponent: RoomSnapshot["opponent"]): React.ReactNode {
  if (!opponent) return null;

  const opponentName = opponent.displayName || "Your opponent";

  if (you.ready && !opponent.ready) {
    return (
      <>
        <span>
          <WaitingPulse /> Waiting for {opponentName} to ready up
        </span>
      </>
    );
  }
  if (!you.ready && opponent.ready) {
    return <span>{opponentName} is ready and waiting for you</span>;
  }
  if (you.ready && opponent.ready) {
    return <span>Both players ready — starting…</span>;
  }
  return <span>Both players must be ready to start.</span>;
}
