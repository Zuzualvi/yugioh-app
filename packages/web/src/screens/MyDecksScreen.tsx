import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteDeck, duplicateDeck, listDecks } from "../api/decks";
import { useToast } from "../context/ToastContext";
import type { DeckSummary } from "../types/contracts";

export function MyDecksScreen() {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addToast } = useToast();
  const navigate = useNavigate();

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDecks();
      setDecks(res.decks);
    } catch {
      setError("Failed to load decks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDecks();
  }, [fetchDecks]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDeck(id);
      addToast(`"${name}" deleted`, "info");
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch {
      addToast("Failed to delete deck", "error");
    }
  }

  async function handleDuplicate(id: string, name: string) {
    try {
      await duplicateDeck(id);
      addToast(`"${name}" duplicated`, "success");
      void fetchDecks();
    } catch {
      addToast("Failed to duplicate deck", "error");
    }
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
        }}
      >
        <Link
          to="/"
          className="btn btn-ghost btn-icon"
          style={{ textDecoration: "none" }}
          aria-label="Back to Home"
        >
          ←
        </Link>
        <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "0.04em" }}>
          ⟡ EDISON DUEL
        </span>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>My Decks</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => navigate("/builder")}>
              + New deck
            </button>
            <ImportYdkButton onImport={() => navigate("/builder?import=1")} />
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <span className="loading-spinner" aria-label="Loading decks" />
          </div>
        )}

        {!loading && error && <p style={{ color: "var(--invalid)" }}>{error}</p>}

        {!loading && !error && decks.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-2)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 12 }} aria-hidden="true">
              🂡
            </div>
            <p style={{ fontSize: "1.125rem", marginBottom: 16 }}>No decks yet</p>
            <button className="btn btn-primary" onClick={() => navigate("/builder")}>
              Build your first deck
            </button>
          </div>
        )}

        {/* Deck grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onOpen={() => navigate(`/builder/${deck.id}`)}
              onDuplicate={() => handleDuplicate(deck.id, deck.name)}
              onDelete={() => handleDelete(deck.id, deck.name)}
              onExport={() => navigate(`/builder/${deck.id}?export=1`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

interface DeckCardProps {
  deck: DeckSummary;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}

function DeckCard({ deck, onOpen, onDuplicate, onDelete, onExport }: DeckCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        position: "relative",
      }}
    >
      {/* Name + validity */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <button
          onClick={onOpen}
          style={{
            textAlign: "left",
            fontWeight: 600,
            fontSize: "1rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-0)",
            padding: 0,
            flex: 1,
            minHeight: 44,
          }}
        >
          {deck.name}
        </button>
        <span
          className={`validity-chip ${deck.isValid ? "valid" : "invalid"}`}
          aria-label={deck.isValid ? "Edison-legal" : "Invalid deck"}
        >
          {deck.isValid ? "✓" : "⚠"}{" "}
          {deck.isValid
            ? "Legal"
            : `${deck.counts.main + deck.counts.extra + deck.counts.side} cards`}
        </span>
      </div>

      {/* Counts */}
      <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
        Main {deck.counts.main} · Extra {deck.counts.extra} · Side {deck.counts.side}
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={onOpen}
          style={{ flex: 1, fontSize: "0.9375rem" }}
        >
          Open
        </button>
        {/* ⋯ menu */}
        <div style={{ position: "relative" }}>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 10,
                }}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "calc(100% + 4px)",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 11,
                  minWidth: 160,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              >
                {[
                  { label: "Open", action: onOpen },
                  { label: "Duplicate", action: onDuplicate },
                  { label: "Export .ydk", action: onExport },
                  { label: "Delete", action: onDelete, danger: true },
                ].map(({ label, action, danger }) => (
                  <button
                    key={label}
                    role="menuitem"
                    className="btn btn-ghost"
                    onClick={() => {
                      setMenuOpen(false);
                      action();
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      color: danger ? "var(--invalid)" : undefined,
                      minHeight: 44,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportYdkButton({ onImport }: { onImport: () => void }) {
  return (
    <button className="btn btn-secondary" onClick={onImport}>
      Import .ydk
    </button>
  );
}
