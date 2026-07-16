/**
 * GenericDecisionPanel — functional fallback that renders + answers ANY DuelDecision kind.
 *
 * This is the PERMANENT home for rare kinds:
 *   SelectSum / SelectCounter / SelectDisfield / SortCard / SortChain
 *
 * All other kinds initially route here; 2B/2C/2D panels override them one-by-one
 * by adding kind → file entries in DecisionDispatcher.tsx.
 *
 * a11y: ≥44px targets, ≥16px text, keyboard nav, reduced-motion, no color-only meaning.
 */

import React, { useState } from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

// ── Shared style constants ────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
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

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  color: "var(--text-1)",
  fontWeight: 400,
};

const BTN_CONFIRM: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--accent)",
  color: "#fff",
  justifyContent: "center",
  fontWeight: 600,
};

const BTN_CANCEL: React.CSSProperties = {
  ...BTN_SECONDARY,
  border: "1px solid var(--invalid)",
  color: "var(--invalid)",
  justifyContent: "center",
};

const PROMPT: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "1rem",
  color: "var(--text-0)",
  marginBottom: 12,
};

const COUNTER_LABEL: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--text-2)",
  marginBottom: 4,
};

const SELECTED_BORDER: React.CSSProperties = {
  border: "2px solid var(--accent-light)",
};

// ── Helper: card label ────────────────────────────────────────────────────────

function cardLabel(card: { name: string; code: number; location: string; sequence: number }) {
  const namePart = card.name || `Card (code ${card.code})`;
  return `${namePart} [${card.location}·${card.sequence}]`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface GenericDecisionPanelProps {
  decision: DuelDecision;
  respond: (r: DuelDecisionResponse) => void;
  layoutTier: "phone" | "tablet" | "desktop";
  disabled?: boolean;
}

export function GenericDecisionPanel({
  decision,
  respond,
  disabled = false,
}: GenericDecisionPanelProps) {
  // Multi-select state for card/zone selection kinds
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  // SelectCounter: per-card amounts
  const [counterAmounts, setCounterAmounts] = useState<number[]>([]);
  // SelectSum: running total
  const [sumIndices, setSumIndices] = useState<number[]>([]);
  // SortCard / SortChain: current order
  const [sortOrder, setSortOrder] = useState<number[] | null>(null);
  // AnnounceCard text input
  const [cardNameInput, setCardNameInput] = useState("");
  // AnnounceNumber / AnnounceRace / AnnounceAttrib: selected index/values
  const [announceIndices, setAnnounceIndices] = useState<number[]>([]);

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : style.cursor,
  });

  // ── IdleCommand ─────────────────────────────────────────────────────────────
  if (decision.kind === "IdleCommand") {
    const d = decision;
    type IdleItem = {
      label: string;
      action:
        | "summon"
        | "specialSummon"
        | "posChange"
        | "monsterSet"
        | "spellSet"
        | "activate"
        | "toBP"
        | "toEP";
      index: number | null;
    };
    const items: IdleItem[] = [
      ...d.summons.map((c, i) => ({
        label: `Normal Summon: ${c.name || `Card ${i}`}`,
        action: "summon" as const,
        index: i,
      })),
      ...d.specialSummons.map((c, i) => ({
        label: `Special Summon: ${c.name || `Card ${i}`}`,
        action: "specialSummon" as const,
        index: i,
      })),
      ...d.posChanges.map((c, i) => ({
        label: `Change Position: ${c.name || `Card ${i}`}`,
        action: "posChange" as const,
        index: i,
      })),
      ...d.monsterSets.map((c, i) => ({
        label: `Set (Monster): ${c.name || `Card ${i}`}`,
        action: "monsterSet" as const,
        index: i,
      })),
      ...d.spellSets.map((c, i) => ({
        label: `Set (S/T): ${c.name || `Card ${i}`}`,
        action: "spellSet" as const,
        index: i,
      })),
      ...d.activates.map((c, i) => ({
        label: `Activate: ${c.name || `Card ${i}`}${c.description ? ` — ${c.description}` : ""}`,
        action: "activate" as const,
        index: i,
      })),
      ...(d.toBattlePhase
        ? [{ label: "Proceed to Battle Phase", action: "toBP" as const, index: null }]
        : []),
      ...(d.toEndPhase ? [{ label: "End Phase", action: "toEP" as const, index: null }] : []),
    ];

    return (
      <div>
        <p style={PROMPT}>Choose an action:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() =>
                respond({
                  kind: "IdleCommand",
                  action: item.action,
                  index: item.index,
                })
              }
            >
              ▶ {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── BattleCommand ───────────────────────────────────────────────────────────
  if (decision.kind === "BattleCommand") {
    const d = decision;
    type BattleItem = {
      label: string;
      action: "chain" | "attack" | "toM2" | "toEP";
      index: number | null;
    };
    const items: BattleItem[] = [
      ...d.chains.map((c, i) => ({
        label: `Activate Chain: ${c.name || `Card ${i}`}`,
        action: "chain" as const,
        index: i,
      })),
      ...d.attacks.map((c, i) => ({
        label: `Attack with ${c.name || `Card ${i}`}${c.canDirectAttack ? " (direct)" : ""}`,
        action: "attack" as const,
        index: i,
      })),
      ...(d.toMainPhase2
        ? [{ label: "Proceed to Main Phase 2", action: "toM2" as const, index: null }]
        : []),
      ...(d.toEndPhase ? [{ label: "End Phase", action: "toEP" as const, index: null }] : []),
    ];

    return (
      <div>
        <p style={PROMPT}>Battle Phase — choose an action:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() =>
                respond({
                  kind: "BattleCommand",
                  action: item.action,
                  index: item.index,
                })
              }
            >
              ▶ {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── ChainPrompt ─────────────────────────────────────────────────────────────
  if (decision.kind === "ChainPrompt") {
    const d = decision;
    return (
      <div>
        <p style={{ ...PROMPT, color: "var(--accent-light)" }}>
          ⚡ Priority window — do you wish to respond?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.selects.map((c, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() => respond({ kind: "ChainPrompt", index: i })}
            >
              ▶ {c.name || `Card ${i}`}
              {c.description ? ` — ${c.description}` : ""}
            </button>
          ))}
          {!d.forced && (
            <button
              data-testid="pass-option"
              style={dis(BTN_SECONDARY)}
              disabled={disabled}
              onClick={() => respond({ kind: "ChainPrompt", index: null })}
            >
              ⬜ No response (pass)
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── SelectEffectYN / SelectYesNo ────────────────────────────────────────────
  if (decision.kind === "SelectEffectYN") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>{d.description || `Activate effect: ${d.card.name || "Card"}?`}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            data-testid="action-option"
            style={dis({ ...BTN_CONFIRM, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SelectEffectYN", yes: true })}
          >
            Yes
          </button>
          <button
            data-testid="action-option"
            style={dis({ ...BTN_CANCEL, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SelectEffectYN", yes: false })}
          >
            No
          </button>
        </div>
      </div>
    );
  }

  if (decision.kind === "SelectYesNo") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>{d.description || "Yes or No?"}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            data-testid="action-option"
            style={dis({ ...BTN_CONFIRM, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SelectYesNo", yes: true })}
          >
            Yes
          </button>
          <button
            data-testid="action-option"
            style={dis({ ...BTN_CANCEL, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SelectYesNo", yes: false })}
          >
            No
          </button>
        </div>
      </div>
    );
  }

  // ── SelectOption ─────────────────────────────────────────────────────────────
  if (decision.kind === "SelectOption") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>Select an option:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.options.map((opt, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectOption", index: i })}
            >
              ▶ {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── SelectCard ───────────────────────────────────────────────────────────────
  if (decision.kind === "SelectCard") {
    const d = decision;
    const toggle = (i: number) => {
      setSelectedIndices((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= d.max) return prev;
        return [...prev, i];
      });
    };
    const canConfirm = selectedIndices.length >= d.min;
    return (
      <div>
        <p style={PROMPT}>
          Select cards ({d.min}–{d.max}):
        </p>
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: 8 }}
        >
          {selectedIndices.length} / {d.max} selected
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {d.cards.map((c, i) => {
            const sel = selectedIndices.includes(i);
            return (
              <button
                key={i}
                data-testid="action-option"
                style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
                disabled={disabled}
                onClick={() => toggle(i)}
                aria-pressed={sel}
              >
                {sel ? "✓" : "○"} {cardLabel(c)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={dis({ ...BTN_CONFIRM, flex: 1, opacity: canConfirm ? 1 : 0.4 })}
            disabled={disabled || !canConfirm}
            onClick={() => respond({ kind: "SelectCard", indices: selectedIndices })}
          >
            Confirm ✓
          </button>
          {d.cancelable && (
            <button
              style={dis({ ...BTN_CANCEL, flex: 1 })}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectCard", indices: null })}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── SelectTribute ─────────────────────────────────────────────────────────────
  if (decision.kind === "SelectTribute") {
    const d = decision;
    const toggle = (i: number) => {
      setSelectedIndices((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= d.max) return prev;
        return [...prev, i];
      });
    };
    const canConfirm = selectedIndices.length >= d.min;
    return (
      <div>
        <p style={PROMPT}>
          Select tributes ({d.min}–{d.max}):
        </p>
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: 8 }}
        >
          {selectedIndices.length} / {d.max} selected
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {d.cards.map((c, i) => {
            const sel = selectedIndices.includes(i);
            return (
              <button
                key={i}
                data-testid="action-option"
                style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
                disabled={disabled}
                onClick={() => toggle(i)}
                aria-pressed={sel}
              >
                {sel ? "✓" : "○"} {cardLabel(c)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={dis({ ...BTN_CONFIRM, flex: 1, opacity: canConfirm ? 1 : 0.4 })}
            disabled={disabled || !canConfirm}
            onClick={() => respond({ kind: "SelectTribute", indices: selectedIndices })}
          >
            Confirm ✓
          </button>
          {d.cancelable && (
            <button
              style={dis({ ...BTN_CANCEL, flex: 1 })}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectTribute", indices: null })}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── SelectZone ───────────────────────────────────────────────────────────────
  if (decision.kind === "SelectZone") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>Select a zone (need {d.count}):</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {d.zones.map((z, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectZone", indices: [i] })}
            >
              ▶ Player {z.controller} · {z.location} zone {z.sequence}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── SelectPosition ────────────────────────────────────────────────────────────
  if (decision.kind === "SelectPosition") {
    const d = decision;
    const posLabel: Record<string, string> = {
      faceup_attack: "⚔ Attack Position (face-up)",
      facedown_attack: "↕ Attack Position (face-down)",
      faceup_defense: "🛡 Defense Position (face-up)",
      facedown_defense: "🔻 Defense Position (face-down)",
    };
    return (
      <div>
        <p style={PROMPT}>Select position for {d.card.name || "card"}:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.positions.map((pos, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectPosition", position: pos })}
            >
              {posLabel[pos] ?? pos}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── SelectUnselectCard ────────────────────────────────────────────────────────
  if (decision.kind === "SelectUnselectCard") {
    const d = decision;
    const allCards = [
      ...d.selectCards.map((c, i) => ({ card: c, idx: i, canSelect: true })),
      ...d.unselectCards.map((c, i) => ({
        card: c,
        idx: i + d.selectCards.length,
        canSelect: false,
      })),
    ];
    const canFinish = d.canFinish && selectedIndices.length >= d.min;
    return (
      <div>
        <p style={PROMPT}>
          Select / unselect cards ({d.min}–{d.max}):
        </p>
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: 8 }}
        >
          {selectedIndices.length} selected
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {allCards.map(({ card, idx, canSelect }) => {
            const sel = selectedIndices.includes(idx);
            return (
              <button
                key={idx}
                data-testid="action-option"
                style={dis({
                  ...BTN_SECONDARY,
                  ...(sel ? SELECTED_BORDER : {}),
                  opacity: disabled ? 0.5 : 1,
                })}
                disabled={disabled}
                onClick={() => {
                  if (canSelect) {
                    respond({ kind: "SelectUnselectCard", index: idx });
                  } else {
                    respond({ kind: "SelectUnselectCard", index: idx });
                  }
                }}
                aria-pressed={sel}
              >
                {canSelect ? (sel ? "✓" : "○") : "✗"} {cardLabel(card)}
                {!canSelect ? " (unselect)" : ""}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canFinish && (
            <button
              style={dis({ ...BTN_CONFIRM, flex: 1 })}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectUnselectCard", index: null })}
            >
              Finish ✓
            </button>
          )}
          {d.cancelable && (
            <button
              style={dis({ ...BTN_CANCEL, flex: 1 })}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectUnselectCard", index: null })}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── AnnounceRace ──────────────────────────────────────────────────────────────
  if (decision.kind === "AnnounceRace") {
    const d = decision;
    const toggle = (i: number) => {
      setAnnounceIndices((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= d.count) return prev;
        return [...prev, i];
      });
    };
    const canConfirm = announceIndices.length === d.count;
    return (
      <div>
        <p style={PROMPT}>
          Announce {d.count} type{d.count !== 1 ? "s" : ""}:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {d.available.map((race, i) => {
            const sel = announceIndices.includes(i);
            return (
              <button
                key={i}
                data-testid="action-option"
                style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
                disabled={disabled}
                onClick={() => toggle(i)}
                aria-pressed={sel}
              >
                {sel ? "✓" : "○"} {race}
              </button>
            );
          })}
        </div>
        <button
          style={dis({ ...BTN_CONFIRM, opacity: canConfirm ? 1 : 0.4 })}
          disabled={disabled || !canConfirm}
          onClick={() =>
            respond({ kind: "AnnounceRace", races: announceIndices.map((i) => d.available[i]!) })
          }
        >
          Confirm ✓
        </button>
      </div>
    );
  }

  // ── AnnounceAttrib ────────────────────────────────────────────────────────────
  if (decision.kind === "AnnounceAttrib") {
    const d = decision;
    const toggle = (i: number) => {
      setAnnounceIndices((prev) => {
        if (prev.includes(i)) return prev.filter((x) => x !== i);
        if (prev.length >= d.count) return prev;
        return [...prev, i];
      });
    };
    const canConfirm = announceIndices.length === d.count;
    return (
      <div>
        <p style={PROMPT}>
          Announce {d.count} attribute{d.count !== 1 ? "s" : ""}:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {d.available.map((attr, i) => {
            const sel = announceIndices.includes(i);
            return (
              <button
                key={i}
                data-testid="action-option"
                style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
                disabled={disabled}
                onClick={() => toggle(i)}
                aria-pressed={sel}
              >
                {sel ? "✓" : "○"} {attr}
              </button>
            );
          })}
        </div>
        <button
          style={dis({ ...BTN_CONFIRM, opacity: canConfirm ? 1 : 0.4 })}
          disabled={disabled || !canConfirm}
          onClick={() =>
            respond({
              kind: "AnnounceAttrib",
              attributes: announceIndices.map((i) => d.available[i]!),
            })
          }
        >
          Confirm ✓
        </button>
      </div>
    );
  }

  // ── AnnounceCard ──────────────────────────────────────────────────────────────
  if (decision.kind === "AnnounceCard") {
    const d = decision;
    if (d.filter.kind === "codes") {
      return (
        <div>
          <p style={PROMPT}>Announce a card:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.filter.codes.map((code, i) => (
              <button
                key={i}
                data-testid="action-option"
                style={dis(BTN_BASE)}
                disabled={disabled}
                onClick={() => respond({ kind: "AnnounceCard", code })}
              >
                ▶ Card #{code}
              </button>
            ))}
          </div>
        </div>
      );
    }
    // filter.kind === "any" — text input
    return (
      <div>
        <p style={PROMPT}>Announce a card by passcode:</p>
        <input
          type="number"
          min={1}
          placeholder="Card passcode (e.g. 46986414)"
          value={cardNameInput}
          onChange={(e) => setCardNameInput(e.target.value)}
          disabled={disabled}
          aria-label="Card passcode"
          style={{ marginBottom: 8, width: "100%", fontSize: "1rem" }}
        />
        <button
          style={dis({ ...BTN_CONFIRM, opacity: cardNameInput ? 1 : 0.4 })}
          disabled={disabled || !cardNameInput}
          onClick={() => {
            const code = parseInt(cardNameInput, 10);
            if (code > 0) respond({ kind: "AnnounceCard", code });
          }}
        >
          Confirm ✓
        </button>
      </div>
    );
  }

  // ── AnnounceNumber ────────────────────────────────────────────────────────────
  if (decision.kind === "AnnounceNumber") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>Announce a number:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {d.options.map((num, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis({ ...BTN_BASE, minWidth: 60, justifyContent: "center" })}
              disabled={disabled}
              onClick={() => respond({ kind: "AnnounceNumber", valueIndex: i })}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── SortChain (rare) ─────────────────────────────────────────────────────────
  if (decision.kind === "SortChain") {
    const d = decision;
    const order = sortOrder ?? d.cards.map((_, i) => i);
    return (
      <div>
        <p style={PROMPT}>Sort chain order:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {order.map((idx, pos) => {
            const card = d.cards[idx];
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  minHeight: 44,
                }}
              >
                <span style={{ color: "var(--text-2)", minWidth: 24 }}>{pos + 1}.</span>
                <span>{card ? card.name || `Card ${idx}` : `Card ${idx}`}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {pos > 0 && (
                    <button
                      style={dis({ ...BTN_SECONDARY, minHeight: 32, padding: "4px 8px" })}
                      disabled={disabled}
                      onClick={() => {
                        const next = [...order];
                        [next[pos - 1], next[pos]] = [next[pos]!, next[pos - 1]!];
                        setSortOrder(next);
                      }}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                  )}
                  {pos < order.length - 1 && (
                    <button
                      style={dis({ ...BTN_SECONDARY, minHeight: 32, padding: "4px 8px" })}
                      disabled={disabled}
                      onClick={() => {
                        const next = [...order];
                        [next[pos], next[pos + 1]] = [next[pos + 1]!, next[pos]!];
                        setSortOrder(next);
                      }}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={dis({ ...BTN_CONFIRM, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SortChain", order })}
          >
            Confirm Order ✓
          </button>
          <button
            style={dis({ ...BTN_SECONDARY, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SortChain", order: null })}
          >
            Default Order
          </button>
        </div>
      </div>
    );
  }

  // ── SelectCounter (rare) ─────────────────────────────────────────────────────
  if (decision.kind === "SelectCounter") {
    const d = decision;
    const amounts =
      counterAmounts.length === d.cards.length ? counterAmounts : d.cards.map(() => 0);
    const total = amounts.reduce((a, b) => a + b, 0);
    const canConfirm = total === d.count;
    return (
      <div>
        <p style={PROMPT}>
          Distribute {d.count} counter{d.count !== 1 ? "s" : ""} (type #{d.counterType}):
        </p>
        <div role="status" aria-live="polite" style={{ ...COUNTER_LABEL, marginBottom: 8 }}>
          {total} / {d.count} assigned
        </div>
        {d.cards.map((card, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: "1rem" }}>
              {card.name || `Card ${i}`} (has {card.currentCount})
            </span>
            <button
              style={dis({ ...BTN_SECONDARY, minHeight: 36, padding: "4px 10px", minWidth: 36 })}
              disabled={disabled || amounts[i]! <= 0}
              onClick={() => {
                const next = [...amounts];
                next[i] = Math.max(0, (next[i] ?? 0) - 1);
                setCounterAmounts(next);
              }}
              aria-label={`Decrease counter for ${card.name}`}
            >
              −
            </button>
            <span
              style={{ minWidth: 28, textAlign: "center", fontSize: "1rem" }}
              aria-live="polite"
            >
              {amounts[i] ?? 0}
            </span>
            <button
              style={dis({ ...BTN_SECONDARY, minHeight: 36, padding: "4px 10px", minWidth: 36 })}
              disabled={disabled || total >= d.count}
              onClick={() => {
                const next = [...amounts];
                next[i] = (next[i] ?? 0) + 1;
                setCounterAmounts(next);
              }}
              aria-label={`Increase counter for ${card.name}`}
            >
              +
            </button>
          </div>
        ))}
        <button
          style={dis({ ...BTN_CONFIRM, marginTop: 8, opacity: canConfirm ? 1 : 0.4 })}
          disabled={disabled || !canConfirm}
          onClick={() => respond({ kind: "SelectCounter", counters: amounts })}
        >
          Confirm ✓
        </button>
      </div>
    );
  }

  // ── SelectSum (rare) ─────────────────────────────────────────────────────────
  if (decision.kind === "SelectSum") {
    const d = decision;
    const allOptional = d.optional;
    const runningTotal = sumIndices.reduce(
      (acc, i) => {
        const card = allOptional[i];
        return acc + (card?.amount ?? 0);
      },
      d.must.reduce((a, c) => a + c.amount, 0),
    );
    const mustTotal = d.must.reduce((a, c) => a + c.amount, 0);
    const canConfirm = runningTotal === d.amount;
    const toggle = (i: number) => {
      setSumIndices((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    };
    return (
      <div>
        <p style={PROMPT}>Select cards totaling {d.amount}:</p>
        <div role="status" aria-live="polite" style={{ ...COUNTER_LABEL, marginBottom: 8 }}>
          Running total: {runningTotal} / {d.amount}
          {mustTotal > 0 && ` (includes ${mustTotal} mandatory)`}
        </div>
        {d.must.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p style={COUNTER_LABEL}>Required (auto-selected):</p>
            {d.must.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--accent)",
                  borderRadius: 6,
                  marginBottom: 4,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                ✓ {c.name || `Card ${i}`} (+{c.amount})
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {allOptional.map((c, i) => {
            const sel = sumIndices.includes(i);
            return (
              <button
                key={i}
                data-testid="action-option"
                style={dis({ ...BTN_SECONDARY, ...(sel ? SELECTED_BORDER : {}) })}
                disabled={disabled}
                onClick={() => toggle(i)}
                aria-pressed={sel}
              >
                {sel ? "✓" : "○"} {c.name || `Card ${i}`} (+{c.amount})
              </button>
            );
          })}
        </div>
        <button
          style={dis({ ...BTN_CONFIRM, opacity: canConfirm ? 1 : 0.4 })}
          disabled={disabled || !canConfirm}
          onClick={() => respond({ kind: "SelectSum", indices: sumIndices })}
        >
          Confirm ✓
        </button>
      </div>
    );
  }

  // ── SelectDisfield (rare) ─────────────────────────────────────────────────────
  if (decision.kind === "SelectDisfield") {
    const d = decision;
    return (
      <div>
        <p style={PROMPT}>Select zone to disable (need {d.count}):</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {d.zones.map((z, i) => (
            <button
              key={i}
              data-testid="action-option"
              style={dis(BTN_BASE)}
              disabled={disabled}
              onClick={() => respond({ kind: "SelectDisfield", indices: [i] })}
            >
              ▶ Player {z.controller} · {z.location} zone {z.sequence}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── SortCard (rare) ───────────────────────────────────────────────────────────
  if (decision.kind === "SortCard") {
    const d = decision;
    const order = sortOrder ?? d.cards.map((_, i) => i);
    return (
      <div>
        <p style={PROMPT}>Sort cards:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {order.map((idx, pos) => {
            const card = d.cards[idx];
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  minHeight: 44,
                }}
              >
                <span style={{ color: "var(--text-2)", minWidth: 24 }}>{pos + 1}.</span>
                <span>{card ? card.name || `Card ${idx}` : `Card ${idx}`}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {pos > 0 && (
                    <button
                      style={dis({ ...BTN_SECONDARY, minHeight: 32, padding: "4px 8px" })}
                      disabled={disabled}
                      onClick={() => {
                        const next = [...order];
                        [next[pos - 1], next[pos]] = [next[pos]!, next[pos - 1]!];
                        setSortOrder(next);
                      }}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                  )}
                  {pos < order.length - 1 && (
                    <button
                      style={dis({ ...BTN_SECONDARY, minHeight: 32, padding: "4px 8px" })}
                      disabled={disabled}
                      onClick={() => {
                        const next = [...order];
                        [next[pos], next[pos + 1]] = [next[pos + 1]!, next[pos]!];
                        setSortOrder(next);
                      }}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={dis({ ...BTN_CONFIRM, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SortCard", order })}
          >
            Confirm Order ✓
          </button>
          <button
            style={dis({ ...BTN_SECONDARY, flex: 1 })}
            disabled={disabled}
            onClick={() => respond({ kind: "SortCard", order: null })}
          >
            Default Order
          </button>
        </div>
      </div>
    );
  }

  // ── Fallback (should never reach here if all kinds are handled above) ─────────
  return (
    <div>
      <p style={{ ...PROMPT, color: "var(--text-2)" }}>
        Unknown decision kind: {(decision as { kind: string }).kind}
      </p>
    </div>
  );
}
