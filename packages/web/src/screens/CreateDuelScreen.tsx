/**
 * Create Duel screen — pick deck + set per-move timer, POST CreateDuelBody,
 * then show the shareable join link.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDuel } from "../api/duel";
import { listDecks } from "../api/decks";
import { useToast } from "../context/ToastContext";
import type { DeckSummary } from "../types/contracts";

const TIMER_PRESETS: { label: string; seconds: number }[] = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "1 hr", seconds: 60 * 60 },
  { label: "12 hr", seconds: 12 * 60 * 60 },
  { label: "24 hr", seconds: 24 * 60 * 60 },
  { label: "48 hr", seconds: 48 * 60 * 60 },
];

const DEFAULT_TIMER_SECONDS = 24 * 60 * 60;

export function CreateDuelScreen() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);
  const [customSeconds, setCustomSeconds] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [seatToken, setSeatToken] = useState<string | null>(null);
  const [duelId, setDuelId] = useState<string | null>(null);

  useEffect(() => {
    void listDecks()
      .then(({ decks: d }) => {
        setDecks(d);
        setDecksLoading(false);
      })
      .catch(() => {
        addToast("Failed to load decks", "error");
        setDecksLoading(false);
      });
  }, [addToast]);

  function handlePreset(seconds: number) {
    setTimerSeconds(seconds);
    setShowCustom(false);
  }

  function handleCustomToggle() {
    setShowCustom((v) => !v);
  }

  function effectiveTimer(): number {
    if (showCustom && customSeconds !== "") {
      const val = parseInt(customSeconds, 10);
      if (!isNaN(val)) return Math.min(Math.max(val * 60, 60), 48 * 60 * 60);
    }
    return timerSeconds;
  }

  async function handleCreate() {
    if (!selectedDeckId) {
      addToast("Please select a deck", "error");
      return;
    }
    setCreating(true);
    try {
      const result = await createDuel({
        deckId: selectedDeckId,
        timer: { perMoveSeconds: effectiveTimer() },
      });
      const link = `${window.location.origin}/duel/join/${result.joinToken}`;
      setJoinLink(link);
      setSeatToken(result.creatorSeatToken);
      setDuelId(result.duelId);
    } catch {
      addToast("Failed to create duel", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyLink() {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      addToast("Link copied!", "success");
    } catch {
      addToast("Copy failed — select and copy the link manually", "error");
    }
  }

  function handleEnterDuel() {
    if (!duelId || !seatToken) return;
    navigate(`/duel/${duelId}`, { state: { seatToken, seat: 0 } });
  }

  const timerLabel = (s: number) => {
    if (s < 3600) return `${s / 60} min`;
    if (s < 86400) return `${s / 3600} hr`;
    return `${s / 86400} day${s / 86400 > 1 ? "s" : ""}`;
  };

  if (joinLink) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            background: "var(--bg-1)",
            borderBottom: "1px solid var(--border)",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <button
            className="btn"
            onClick={() => navigate("/")}
            style={{ minHeight: 44, padding: "8px 16px" }}
          >
            ← Home
          </button>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Duel Created!</h1>
        </header>
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 24,
          }}
        >
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h2 style={{ marginBottom: 8, fontSize: "1.125rem", fontWeight: 600 }}>
              Share this link with your opponent
            </h2>
            <p style={{ color: "var(--text-1)", marginBottom: 20, fontSize: "0.9375rem" }}>
              When they open the link and join, the duel will begin.
            </p>
            <div
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.875rem",
                wordBreak: "break-all",
                marginBottom: 16,
                color: "var(--text-0)",
              }}
              data-testid="join-link"
            >
              {joinLink}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn"
                onClick={handleCopyLink}
                style={{ minHeight: 44, padding: "10px 20px", flex: 1 }}
              >
                🔗 Copy link
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEnterDuel}
                style={{ minHeight: 44, padding: "10px 20px", flex: 1 }}
              >
                Enter duel ⚔
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          className="btn"
          onClick={() => navigate("/")}
          style={{ minHeight: 44, padding: "8px 16px" }}
        >
          ← Home
        </button>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>⚔ Duel a Friend</h1>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 24,
          gap: 0,
        }}
      >
        <div style={{ maxWidth: 520, width: "100%" }}>
          {/* Step 1: Pick deck */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
              Step 1 · Your deck
            </h2>
            {decksLoading ? (
              <p style={{ color: "var(--text-1)" }}>Loading decks…</p>
            ) : decks.length === 0 ? (
              <p style={{ color: "var(--text-1)" }}>
                No decks found.{" "}
                <button
                  className="btn"
                  onClick={() => navigate("/builder")}
                  style={{ minHeight: 36, padding: "6px 12px" }}
                >
                  Build a deck
                </button>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {decks.map((d) => (
                  <label
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: selectedDeckId === d.id ? "var(--accent-dim)" : "var(--bg-1)",
                      border: `1px solid ${selectedDeckId === d.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    <input
                      type="radio"
                      name="deck"
                      value={d.id}
                      checked={selectedDeckId === d.id}
                      onChange={() => setSelectedDeckId(d.id)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontWeight: 500 }}>{d.name}</span>
                    <span
                      style={{ color: "var(--text-2)", fontSize: "0.875rem", marginLeft: "auto" }}
                    >
                      {d.counts.main} cards
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Step 2: Per-move timer */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
              Step 2 · Time per move
            </h2>
            <p style={{ color: "var(--text-1)", fontSize: "0.875rem", marginBottom: 12 }}>
              Short = play live now · Long = play over days
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => handlePreset(p.seconds)}
                  style={{
                    padding: "8px 16px",
                    minHeight: 44,
                    border: `1px solid ${!showCustom && timerSeconds === p.seconds ? "var(--accent)" : "var(--border)"}`,
                    background:
                      !showCustom && timerSeconds === p.seconds
                        ? "var(--accent-dim)"
                        : "var(--bg-2)",
                    borderRadius: 6,
                    color: "var(--text-0)",
                    cursor: "pointer",
                    fontWeight: !showCustom && timerSeconds === p.seconds ? 700 : 400,
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={handleCustomToggle}
                style={{
                  padding: "8px 16px",
                  minHeight: 44,
                  border: `1px solid ${showCustom ? "var(--accent)" : "var(--border)"}`,
                  background: showCustom ? "var(--accent-dim)" : "var(--bg-2)",
                  borderRadius: 6,
                  color: "var(--text-0)",
                  cursor: "pointer",
                }}
              >
                Custom
              </button>
            </div>
            {showCustom && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={2880}
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  placeholder="minutes"
                  style={{
                    padding: "8px 12px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text-0)",
                    width: 100,
                    minHeight: 44,
                  }}
                />
                <span style={{ color: "var(--text-1)" }}>minutes (1–2880)</span>
              </div>
            )}
            <p style={{ color: "var(--accent-light)", fontSize: "0.875rem" }}>
              ⏱ Each player gets {timerLabel(effectiveTimer())} to make each move.
            </p>
          </section>

          {/* Create */}
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || !selectedDeckId}
            style={{ minHeight: 44, padding: "12px 32px", width: "100%" }}
          >
            {creating ? "Creating…" : "Create duel & get link ▸"}
          </button>
        </div>
      </main>
    </div>
  );
}
