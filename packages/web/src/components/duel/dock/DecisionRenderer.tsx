/**
 * DecisionRenderer — one renderer for all 20 DuelDecision variants.
 *
 * THIS IS NOT A ROUTER. It is a single component with a variant switch for
 * the answer space (line 2). Line 1 (sentence) and line 3 (verbs) are always
 * the same structure; only the interior of line 2 changes.
 *
 * The confirm button and the submitted DuelDecisionResponse are derived from
 * the SAME selection value. The invariant: distinct answers → distinct outcomes.
 *
 * Keyboard contract (normative, B2):
 *   - Esc  → decline (if legal), else nothing.
 *   - Enter → confirm (if enabled and focused on button), else nothing.
 *   - NO keyboard event may submit or commit a non-cancelable decision.
 *
 * IdleCommand and BattleCommand are NOT rendered here. They arm ACT mode.
 */

import React, { useEffect, useRef } from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import type { CardRef } from "../../../duel/contracts";

export interface DecisionRendererProps {
  decision: DuelDecision;
  /** Cards currently selected by the player (lifted state). */
  selection: CardRef[];
  /** Toggle a card in/out of selection. */
  onToggle: (ref: CardRef) => void;
  /** Confirm the current selection. */
  onConfirm: () => void;
  /** Decline / pass / cancel the decision. */
  onDecline: () => void;
  /**
   * Direct respond — used for decisions that answer on a single click
   * (SelectPosition, SelectOption, SelectZone board click).
   * The confirm button derives from selection; this bypasses it for
   * one-click decisions that don't need a selection step.
   */
  onDirectRespond: (r: DuelDecisionResponse) => void;
  /** True when the next step is non-cancelable (confirm button should say so). */
  commitNext: boolean;
  /** True while waiting for server response (bar collapses to hairline). */
  loading: boolean;
  /** Whether the whole bar is disabled (duel ended mid-question). */
  disabled?: boolean;
  /** Optional engine caption (MH-3). */
  caption?: string;
}

// ── Confirm-button label rule [M1][M5][B3] ────────────────────────────────────

function confirmLabel(decision: DuelDecision, selection: CardRef[], commitNext: boolean): string {
  const lockSuffix = commitNext ? " — cannot be undone 🔒" : "";
  const cardName = (ref: CardRef): string => {
    // In a full implementation we'd look up the name from CardLookup (W3).
    // We use the decision's own card list as the source of truth here.
    const pool = cardPoolFromDecision(decision);
    const found = pool.find(
      (c) =>
        c.controller === ref.controller &&
        c.location === ref.location &&
        c.sequence === ref.sequence,
    );
    if (!found) {
      // Fall back to location-based identity (face-down card requirement).
      return `card in ${ref.location} ${ref.sequence}`;
    }
    return found.name || `card in ${ref.location} ${ref.sequence}`;
  };

  switch (decision.kind) {
    case "SelectTribute":
    case "SelectCard": {
      if (selection.length === 0) return "Select";
      if (selection.length === 1) {
        const label = decision.kind === "SelectTribute" ? "Tribute" : "Select";
        return `${label} ${cardName(selection[0]!)}${lockSuffix}`;
      }
      if (selection.length <= 3) {
        const label = decision.kind === "SelectTribute" ? "Tribute" : "Select";
        return `${label} ${selection.map(cardName).join(" + ")}${lockSuffix}`;
      }
      const label = decision.kind === "SelectTribute" ? "Tribute" : "Select";
      return `${label} ${selection.slice(0, 3).map(cardName).join(" + ")} +${selection.length - 3} more${lockSuffix}`;
    }
    case "ChainPrompt": {
      if (selection.length === 0) return "Activate Effect";
      const pool = decision.selects;
      const found = pool.find(
        (c) =>
          c.controller === selection[0]!.controller &&
          c.location === selection[0]!.location &&
          c.sequence === selection[0]!.sequence,
      );
      return `Activate "${found?.name || "card"}"${lockSuffix}`;
    }
    case "SelectEffectYN": {
      return `Activate "${decision.card.name || "card"}"${lockSuffix}`;
    }
    case "SelectYesNo":
      return "Yes";
    case "SelectUnselectCard":
      return "Finish";
    case "AnnounceRace":
    case "AnnounceAttrib":
      return selection.length >= decision.count ? `Confirm` : `Select ${decision.count}`;
    default:
      return `Confirm${lockSuffix}`;
  }
}

// ── Decline label ─────────────────────────────────────────────────────────────

function hasLegalDecline(decision: DuelDecision): boolean {
  switch (decision.kind) {
    case "SelectCard":
    case "SelectTribute":
      return decision.cancelable;
    case "ChainPrompt":
      return !decision.forced;
    case "SelectEffectYN":
    case "SelectYesNo":
    case "SelectUnselectCard":
      return true;
    // SelectZone, SelectPosition, SelectDisfield — no cancel.
    default:
      return false;
  }
}

function declineLabel(decision: DuelDecision): string {
  switch (decision.kind) {
    case "ChainPrompt":
      return "No response";
    case "SelectEffectYN":
    case "SelectYesNo":
      return "No";
    case "SelectCard":
    case "SelectTribute":
      return "Cancel";
    case "SelectUnselectCard":
      return "Cancel";
    default:
      return "Decline";
  }
}

// ── Commit statement (for non-cancelable steps) ───────────────────────────────

function commitStatement(decision: DuelDecision): string {
  switch (decision.kind) {
    case "SelectZone":
      return "Choose a zone — this cannot be undone";
    case "SelectPosition":
      return "Choose a position";
    case "ChainPrompt":
      if (decision.forced) return "You must chain one of these";
      return "";
    default:
      return "";
  }
}

// ── Card pool helper ──────────────────────────────────────────────────────────

function cardPoolFromDecision(
  decision: DuelDecision,
): Array<{ code: number; name: string; controller: number; location: string; sequence: number }> {
  switch (decision.kind) {
    case "SelectCard":
    case "SelectTribute":
      return decision.cards;
    case "SelectUnselectCard":
      return [...decision.selectCards, ...decision.unselectCards];
    case "ChainPrompt":
      return decision.selects;
    case "SelectEffectYN":
      return [decision.card];
    case "SelectPosition":
      return [decision.card];
    default:
      return [];
  }
}

// ── Can confirm? ──────────────────────────────────────────────────────────────

function canConfirm(decision: DuelDecision, selection: CardRef[]): boolean {
  switch (decision.kind) {
    case "SelectCard":
    case "SelectTribute":
      return selection.length >= decision.min && selection.length <= decision.max;
    case "ChainPrompt":
      return selection.length === 1;
    case "SelectEffectYN":
    case "SelectYesNo":
      return true;
    case "SelectUnselectCard":
      return decision.canFinish && selection.length >= decision.min;
    case "AnnounceRace":
    case "AnnounceAttrib":
      return selection.length === decision.count;
    case "SelectOption":
      return selection.length === 1;
    default:
      return false;
  }
}

// ── Sentence (line 1) ─────────────────────────────────────────────────────────

function questionSentence(decision: DuelDecision, caption: string | undefined): string {
  if (caption) return caption;
  switch (decision.kind) {
    case "ChainPrompt": {
      // Without chain context (MH-2), we degrade honestly.
      return "Chain a card or effect?";
    }
    case "SelectEffectYN":
      return `Activate "${decision.card.name || "card"}"?`;
    case "SelectYesNo":
      return decision.description && !isSystemInt(decision.description)
        ? decision.description
        : "Yes or No?";
    case "SelectOption":
      return "Choose an effect:";
    case "SelectCard":
      return caption ?? "Choose:";
    case "SelectTribute":
      return `Tribute ${decision.min}${decision.min !== decision.max ? `–${decision.max}` : ""} monster${decision.min !== 1 ? "s" : ""}:`;
    case "SelectZone":
      return "Choose a zone:";
    case "SelectPosition":
      return `Choose a position for "${decision.card.name || "card"}":`;
    case "SelectUnselectCard":
      return "Select materials:";
    case "AnnounceRace":
      return `Declare ${decision.count} Type${decision.count !== 1 ? "s" : ""}:`;
    case "AnnounceAttrib":
      return `Declare ${decision.count} Attribute${decision.count !== 1 ? "s" : ""}:`;
    case "AnnounceCard":
      return "Declare a card name:";
    case "AnnounceNumber":
      return "Declare a number:";
    case "SortChain":
      return "Order these chain links:";
    case "SortCard":
      return "Order these cards:";
    case "SelectCounter":
      return `Remove ${decision.count} counter${decision.count !== 1 ? "s" : ""}:`;
    case "SelectSum":
      return `Select cards totalling ${decision.amount}:`;
    case "SelectDisfield":
      return "Choose a zone to disable:";
    default:
      return "Respond:";
  }
}

function isSystemInt(s: string): boolean {
  return /^\d+[a-z]?$/.test(s.trim());
}

// ── Position labels ───────────────────────────────────────────────────────────

const posLabel: Record<string, string> = {
  faceup_attack: "↑ Attack Position (face-up)",
  facedown_attack: "↕ Attack Position (face-down)",
  faceup_defense: "→ Defense Position (face-up)",
  facedown_defense: "⌄ Defense Position (face-down)",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  sentence: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text-0)",
    margin: 0,
  },
  candidateGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  candidateBtn: (selected: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: "6px 12px",
    border: selected ? "2px solid var(--accent-light)" : "1px solid var(--border)",
    borderRadius: 6,
    background: selected ? "var(--accent-dim)" : "var(--bg-2)",
    color: "var(--text-0)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: selected ? 600 : 400,
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  verbRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  declineBtn: {
    minHeight: 44,
    padding: "8px 20px",
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--text-1)",
    cursor: "pointer",
    fontSize: "1rem",
    flex: 1,
  },
  confirmBtn: (enabled: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    background: enabled ? "var(--accent)" : "var(--accent-dim)",
    color: enabled ? "#fff" : "var(--text-2)",
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "1rem",
    fontWeight: 600,
    flex: 2,
    opacity: enabled ? 1 : 0.6,
  }),
  commitStatement: {
    fontSize: "0.875rem",
    color: "var(--text-2)",
    fontStyle: "italic",
    flex: 1,
    display: "flex",
    alignItems: "center",
  },
  counter: {
    fontSize: "0.875rem",
    color: "var(--text-2)",
  },
  hairline: {
    height: 3,
    background: "var(--accent)",
    borderRadius: 2,
    animation: "pulse 1s ease-in-out infinite",
  },
  locationBadge: (isOwn: boolean): React.CSSProperties => ({
    fontSize: "0.7rem",
    padding: "1px 4px",
    borderRadius: 3,
    background: isOwn
      ? "color-mix(in srgb, var(--own) 20%, transparent)"
      : "color-mix(in srgb, var(--opp) 20%, transparent)",
    color: isOwn ? "var(--own)" : "var(--opp)",
    border: `1px solid ${isOwn ? "var(--own)" : "var(--opp)"}`,
  }),
};

// ── Candidate thumbnail ───────────────────────────────────────────────────────

function CandidateThumb({
  card,
  selected,
  mySeat,
  onToggle,
  disabled,
}: {
  card: { code: number; name: string; controller: number; location: string; sequence: number };
  selected: boolean;
  mySeat: number;
  onToggle: () => void;
  disabled: boolean;
}) {
  const isOwn = card.controller === mySeat;
  const label = card.name || `card in ${card.location} ${card.sequence}`;
  return (
    <button
      data-testid="decision-candidate"
      onClick={onToggle}
      disabled={disabled}
      style={s.candidateBtn(selected)}
      aria-pressed={selected}
    >
      {selected ? "✓ " : ""}
      {label}
      <span style={s.locationBadge(isOwn)}>{card.location}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DecisionRenderer({
  decision,
  selection,
  onToggle,
  onConfirm,
  onDecline,
  onDirectRespond,
  commitNext,
  loading,
  disabled = false,
  caption,
}: DecisionRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard contract [B2]: Esc → decline (if legal), Enter → confirm (on focused button).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled || loading) return;
      if (e.key === "Escape") {
        if (hasLegalDecline(decision)) {
          e.preventDefault();
          onDecline();
        }
        // If no legal decline: do nothing. Never submit.
      }
      // Enter is handled by the native button focus, not a global accelerator.
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [decision, disabled, loading, onDecline]);

  if (loading) {
    return (
      <div
        data-testid="decision-loading"
        style={{ padding: "4px 0" }}
        aria-label="Sending response…"
      >
        <div style={s.hairline} />
      </div>
    );
  }

  const sentence = questionSentence(decision, caption);
  const selectionRefs = selection;
  const legalDecline = hasLegalDecline(decision);
  const commitMsg = !legalDecline ? commitStatement(decision) : "";
  const enabled = !disabled && canConfirm(decision, selectionRefs);
  const label = confirmLabel(decision, selectionRefs, commitNext);

  // ── Answer space (line 2) ───────────────────────────────────────────────────

  let answerSpace: React.ReactNode = null;

  switch (decision.kind) {
    // Command types never reach this renderer.
    case "IdleCommand":
    case "BattleCommand":
      return null;

    case "SelectCard":
    case "SelectTribute": {
      const cards = decision.cards;
      const min = decision.min;
      const max = decision.max;
      answerSpace = (
        <div>
          <div role="status" aria-live="polite" style={s.counter}>
            {selectionRefs.length} of {max} selected
            {selectionRefs.length < min && ` (need ${min})`}
          </div>
          <div style={s.candidateGrid}>
            {cards.map((c, i) => {
              const ref: CardRef = {
                controller: c.controller as 0 | 1,
                location: c.location as CardRef["location"],
                sequence: c.sequence,
              };
              const sel = selectionRefs.some(
                (r) =>
                  r.controller === ref.controller &&
                  r.location === ref.location &&
                  r.sequence === ref.sequence,
              );
              return (
                <CandidateThumb
                  key={i}
                  card={c}
                  selected={sel}
                  mySeat={0}
                  onToggle={() => onToggle(ref)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        </div>
      );
      break;
    }

    case "ChainPrompt": {
      answerSpace = (
        <div style={s.candidateGrid}>
          {decision.selects.map((c, i) => {
            const ref: CardRef = {
              controller: c.controller as 0 | 1,
              location: c.location as CardRef["location"],
              sequence: c.sequence,
            };
            const sel = selectionRefs.some(
              (r) =>
                r.controller === ref.controller &&
                r.location === ref.location &&
                r.sequence === ref.sequence,
            );
            return (
              <CandidateThumb
                key={i}
                card={c}
                selected={sel}
                mySeat={0}
                onToggle={() => onToggle(ref)}
                disabled={disabled}
              />
            );
          })}
        </div>
      );
      break;
    }

    case "SelectEffectYN":
      // No answer space — verbs only (Yes/No).
      answerSpace = null;
      break;

    case "SelectYesNo":
      answerSpace = null;
      break;

    case "SelectOption":
      answerSpace = (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {decision.options.map((opt, i) => {
            const sel = selectionRefs.some((r) => r.sequence === i && r.location === "HAND");
            return (
              <button
                key={i}
                data-testid="decision-candidate"
                onClick={() => {
                  // SelectOption: one click answers directly.
                  onDirectRespond({ kind: "SelectOption", index: i });
                }}
                disabled={disabled}
                style={s.candidateBtn(sel)}
                aria-pressed={sel}
              >
                {sel ? "▶ " : "○ "}
                {opt}
              </button>
            );
          })}
        </div>
      );
      break;

    case "SelectPosition":
      answerSpace = (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {decision.positions.map((pos, i) => (
            <button
              key={i}
              data-testid="decision-candidate"
              onClick={() => onDirectRespond({ kind: "SelectPosition", position: pos })}
              disabled={disabled}
              style={s.candidateBtn(false)}
            >
              {posLabel[pos] ?? pos}
            </button>
          ))}
        </div>
      );
      break;

    case "SelectZone":
      answerSpace = (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {decision.zones.map((z, i) => (
            <button
              key={i}
              data-testid="decision-candidate"
              onClick={() => onDirectRespond({ kind: "SelectZone", indices: [i] })}
              disabled={disabled}
              style={s.candidateBtn(false)}
            >
              Player {z.controller} · {z.location} {z.sequence}
            </button>
          ))}
        </div>
      );
      break;

    case "SelectUnselectCard": {
      const allCards = [
        ...decision.selectCards.map((c, i) => ({ card: c, idx: i, canSelect: true })),
        ...decision.unselectCards.map((c, i) => ({
          card: c,
          idx: i + decision.selectCards.length,
          canSelect: false,
        })),
      ];
      answerSpace = (
        <div>
          <div role="status" aria-live="polite" style={s.counter}>
            {selectionRefs.length} selected
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {allCards.map(({ card: c, idx, canSelect }) => {
              const ref: CardRef = {
                controller: c.controller as 0 | 1,
                location: c.location as CardRef["location"],
                sequence: c.sequence,
              };
              const sel = selectionRefs.some(
                (r) =>
                  r.controller === ref.controller &&
                  r.location === ref.location &&
                  r.sequence === ref.sequence,
              );
              return (
                <button
                  key={idx}
                  data-testid="decision-candidate"
                  onClick={() => {
                    // SelectUnselectCard: each click is a protocol message (index).
                    onDirectRespond({ kind: "SelectUnselectCard", index: canSelect ? idx : idx });
                  }}
                  disabled={disabled}
                  style={s.candidateBtn(sel)}
                  aria-pressed={sel}
                >
                  {canSelect ? (sel ? "✓ " : "○ ") : "✗ "}
                  {c.name || `Card ${c.sequence}`}
                  {!canSelect ? " (unselect)" : ""}
                </button>
              );
            })}
          </div>
        </div>
      );
      break;
    }

    case "AnnounceRace":
    case "AnnounceAttrib": {
      const items = decision.available;
      answerSpace = (
        <div>
          <div role="status" aria-live="polite" style={s.counter}>
            {selectionRefs.length} of {decision.count} selected
          </div>
          <div style={s.candidateGrid}>
            {items.map((item, i) => {
              // Encode index in sequence field.
              const ref: CardRef = { controller: 0, location: "HAND", sequence: i };
              const sel = selectionRefs.some((r) => r.location === "HAND" && r.sequence === i);
              return (
                <button
                  key={i}
                  data-testid="decision-candidate"
                  onClick={() => onToggle(ref)}
                  disabled={disabled}
                  style={s.candidateBtn(sel)}
                  aria-pressed={sel}
                >
                  {sel ? "✓ " : "○ "}
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      );
      break;
    }

    case "AnnounceCard":
      answerSpace = (
        <div style={{ color: "var(--text-2)", fontStyle: "italic", fontSize: "0.9rem" }}>
          Card name declaration — use the search field above.
        </div>
      );
      break;

    case "AnnounceNumber":
      answerSpace = (
        <div style={s.candidateGrid}>
          {decision.options.map((n, i) => (
            <button
              key={i}
              data-testid="decision-candidate"
              onClick={() => onDirectRespond({ kind: "AnnounceNumber", valueIndex: i })}
              disabled={disabled}
              style={s.candidateBtn(false)}
            >
              {n}
            </button>
          ))}
        </div>
      );
      break;

    case "SortChain":
    case "SortCard":
      answerSpace = (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(decision.kind === "SortCard" ? decision.cards : decision.cards).map((c, i) => (
              <div
                key={i}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6 }}
              >
                {i + 1}. {c.name || `Card ${c.sequence}`}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, color: "var(--text-2)", fontSize: "0.875rem" }}>
            Drag to reorder (or confirm default order)
          </div>
        </div>
      );
      break;

    case "SelectCounter":
      answerSpace = (
        <div>
          {decision.cards.map((c, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              {c.name || `Card ${c.sequence}`} — {c.currentCount} counters
            </div>
          ))}
        </div>
      );
      break;

    case "SelectSum":
      answerSpace = (
        <div>
          {[...decision.must, ...decision.optional].map((c, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              {c.name || `Card ${c.sequence}`} — value {c.amount}
            </div>
          ))}
        </div>
      );
      break;

    case "SelectDisfield":
      answerSpace = (
        <div style={s.candidateGrid}>
          {decision.zones.map((z, i) => (
            <button
              key={i}
              data-testid="decision-candidate"
              onClick={() => onDirectRespond({ kind: "SelectDisfield", indices: [i] })}
              disabled={disabled}
              style={s.candidateBtn(false)}
            >
              Player {z.controller} · {z.location} {z.sequence}
            </button>
          ))}
        </div>
      );
      break;

    default:
      answerSpace = (
        <div style={{ color: "var(--text-2)", fontStyle: "italic", fontSize: "0.9rem" }}>
          Awaiting response…
        </div>
      );
  }

  return (
    <div ref={containerRef} style={s.wrapper} data-testid="decision-renderer">
      {/* Line 1: sentence */}
      <p style={s.sentence} data-testid="decision-sentence">
        {sentence}
      </p>

      {/* Line 2: answer space */}
      {answerSpace && <div>{answerSpace}</div>}

      {/* Line 3: verb row */}
      <div style={s.verbRow}>
        {/* Left slot: decline button or commit statement */}
        {legalDecline ? (
          <button
            data-testid="decision-decline"
            onClick={onDecline}
            disabled={disabled}
            style={s.declineBtn}
            aria-label={`${declineLabel(decision)} (Esc)`}
          >
            {declineLabel(decision)}{" "}
            <kbd
              style={{
                fontSize: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "1px 4px",
                marginLeft: 4,
              }}
            >
              Esc
            </kbd>
          </button>
        ) : commitMsg ? (
          <div style={s.commitStatement}>{commitMsg}</div>
        ) : null}

        {/* Confirm button — only for decisions that don't answer on direct click */}
        {decision.kind !== "SelectPosition" &&
          decision.kind !== "SelectOption" &&
          decision.kind !== "SelectZone" &&
          decision.kind !== "AnnounceNumber" &&
          decision.kind !== "SelectDisfield" && (
            <button
              data-testid="decision-confirm"
              onClick={onConfirm}
              disabled={!enabled}
              style={s.confirmBtn(enabled)}
            >
              {label}
            </button>
          )}
      </div>
    </div>
  );
}
