/**
 * AnnounceCardPanel — announce a specific card.
 *
 * - filter.kind === "codes": list the known codes as selectable buttons.
 * - filter.kind === "any": show a card-name search/autocomplete using the cards API.
 *
 * Emits: { kind: "AnnounceCard", code: number }
 * a11y: ≥44px targets, ≥16px text, keyboard-usable search, aria-live results.
 */

import React, { useState, useCallback, useRef } from "react";
import type { CardDTO } from "@yugioh-app/contracts";
import { searchCards } from "../../../api/cards";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Shared style constants (mirrors GenericDecisionPanel) ─────────────────────

const BTN_OPTION: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--accent-dim)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
  fontWeight: 500,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-0)",
  fontSize: "1rem",
  outline: "none",
  boxSizing: "border-box",
};

const BTN_CONFIRM: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 44,
  padding: "10px 16px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
  marginTop: 8,
};

const RESULT_BTN: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  minHeight: 44,
  padding: "8px 12px",
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-0)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "1rem",
};

// ── Codes list sub-component ──────────────────────────────────────────────────

function CodesPanel({
  codes,
  respond,
  disabled,
}: {
  codes: number[];
  respond: (code: number) => void;
  disabled: boolean;
}) {
  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  return (
    <div>
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-0)",
          marginBottom: 12,
        }}
      >
        Announce a card:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {codes.map((code) => (
          <button
            key={code}
            data-testid="action-option"
            style={dis(BTN_OPTION)}
            disabled={disabled}
            onClick={() => respond(code)}
            aria-label={`Card passcode ${code}`}
          >
            ▶ Card #{code}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Card-name search sub-component ────────────────────────────────────────────

function CardSearchPanel({
  respond,
  disabled,
}: {
  respond: (code: number) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CardDTO | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchCards({ q, pageSize: 10 });
        setResults(res.cards);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(null);
    search(v);
  };

  const handleSelect = (card: CardDTO) => {
    setSelected(card);
    setQuery(card.name);
    setResults([]);
  };

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  const resultListId = "announce-card-results";

  return (
    <div>
      <p
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-0)",
          marginBottom: 8,
        }}
      >
        Announce a card by name:
      </p>

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <label htmlFor="announce-card-input" style={{ display: "none" }}>
          Card name search
        </label>
        <input
          id="announce-card-input"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={resultListId}
          aria-expanded={results.length > 0}
          aria-label="Search for a card by name"
          placeholder="Type a card name…"
          value={query}
          onChange={handleInput}
          disabled={disabled}
          style={dis(INPUT_STYLE)}
          autoComplete="off"
        />
      </div>

      {/* Search status */}
      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: "0.875rem",
          color: "var(--text-2)",
          minHeight: 20,
          marginTop: 4,
        }}
      >
        {searching
          ? "Searching…"
          : results.length > 0
            ? `${results.length} result${results.length !== 1 ? "s" : ""}`
            : selected
              ? `Selected: ${selected.name}`
              : ""}
      </div>

      {/* Results list */}
      {results.length > 0 && (
        <ul
          id={resultListId}
          role="listbox"
          aria-label="Card search results"
          style={{
            listStyle: "none",
            margin: "4px 0 0",
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-1)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map((card) => (
            <li
              key={card.passcode}
              role="option"
              aria-selected={selected?.passcode === card.passcode}
            >
              <button
                data-testid="action-option"
                style={RESULT_BTN}
                onClick={() => handleSelect(card)}
                disabled={disabled}
                aria-label={`${card.name} (passcode ${card.passcode})`}
              >
                <span style={{ flex: 1 }}>{card.name}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-2)",
                    marginLeft: 8,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  #{card.passcode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm */}
      <button
        style={dis({ ...BTN_CONFIRM, opacity: selected ? 1 : 0.4 })}
        disabled={disabled || !selected}
        onClick={() => {
          if (selected) respond(selected.passcode);
        }}
        aria-disabled={!selected}
      >
        Confirm ✓
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnnounceCardPanel({
  decision,
  respond,
  disabled = false,
}: DecisionPanelProps<"AnnounceCard">) {
  const { filter } = decision;

  const handleRespond = (code: number) => {
    respond({ kind: "AnnounceCard", code });
  };

  if (filter.kind === "codes") {
    return <CodesPanel codes={filter.codes} respond={handleRespond} disabled={disabled} />;
  }

  // filter.kind === "any"
  return <CardSearchPanel respond={handleRespond} disabled={disabled} />;
}
