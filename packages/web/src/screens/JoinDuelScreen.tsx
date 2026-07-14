/**
 * Join Duel screen — reads joinToken from URL, lets the user pick a deck,
 * then POSTs JoinDuelBody to receive seat + seatToken.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinDuel } from "../api/duel";
import { listDecks } from "../api/decks";
import { useToast } from "../context/ToastContext";
import type { DeckSummary } from "../types/contracts";

export function JoinDuelScreen() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

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

  async function handleJoin() {
    if (!joinToken) {
      addToast("Invalid join link — no token", "error");
      return;
    }
    if (!selectedDeckId) {
      addToast("Please select a deck", "error");
      return;
    }
    setJoining(true);
    try {
      const result = await joinDuel({ joinToken, deckId: selectedDeckId });
      navigate(`/duel/${result.duelId}`, {
        state: { seatToken: result.seatToken, seat: result.seat },
      });
    } catch {
      addToast("Failed to join duel — link may be invalid or expired", "error");
      setJoining(false);
    }
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
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>⚔ Join Duel</h1>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
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
            You've been challenged!
          </h2>
          <p style={{ color: "var(--text-1)", marginBottom: 24, fontSize: "0.9375rem" }}>
            Pick a deck to accept and enter the duel.
          </p>

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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {decks.map((d) => (
                <label
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: selectedDeckId === d.id ? "var(--accent-dim)" : "var(--bg-2)",
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
                    style={{
                      color: "var(--text-2)",
                      fontSize: "0.875rem",
                      marginLeft: "auto",
                    }}
                  >
                    {d.counts.main} cards
                  </span>
                </label>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={joining || !selectedDeckId || decksLoading}
            style={{ minHeight: 44, padding: "12px 32px", width: "100%" }}
          >
            {joining ? "Joining…" : "Accept & enter duel ▸"}
          </button>
        </div>
      </main>
    </div>
  );
}
