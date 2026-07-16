/**
 * IdleCommandPanel — bespoke panel for IdleCommand decisions.
 *
 * Groups legal actions by acting card so the user sees a card-centric view:
 *   Card A (HAND·0) → [Normal Summon] [Set]
 *   Card B (SZONE·2) → [Activate — Draw 2]
 *   [Proceed to Battle Phase]  [End Phase]
 *
 * Sourced PURELY from the decision payload — no legality computation.
 * Emits DuelDecisionResponse kind "IdleCommand" {action, index}.
 *
 * a11y: ≥44px targets, ≥16px text, keyboard nav (buttons), aria-label per action.
 */

import React from "react";
import type { CardEntry } from "@yugioh-app/contracts";
import type { DecisionPanelProps } from "./DecisionPanelProps";

// ── Style constants (follow GenericDecisionPanel pattern) ─────────────────────

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

const BTN_PHASE: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-2)",
  border: "1px solid var(--border)",
  color: "var(--text-1)",
  fontWeight: 600,
  justifyContent: "center",
};

const CARD_HEADER: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "var(--text-2)",
  padding: "4px 0 2px",
  marginTop: 8,
  letterSpacing: "0.02em",
};

const PROMPT: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "1rem",
  color: "var(--text-0)",
  marginBottom: 12,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type IdleAction = "summon" | "specialSummon" | "posChange" | "monsterSet" | "spellSet" | "activate";

type ActionEntry = {
  label: string;
  action: IdleAction;
  index: number;
};

type CardGroup = {
  card: CardEntry;
  cardKey: string;
  displayName: string;
  actions: ActionEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardKey(c: CardEntry): string {
  return `${c.controller}:${c.location}:${c.sequence}`;
}

function cardDisplayName(c: CardEntry): string {
  return c.name || `Card [${c.location}·${c.sequence}]`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IdleCommandPanel({
  decision,
  respond,
  layoutTier,
  disabled = false,
}: DecisionPanelProps<"IdleCommand">) {
  const d = decision;

  // Build card groups: each unique card (by controller:location:sequence) gets one entry
  // with all its legal actions collected across the action arrays.
  const groupMap = new Map<string, CardGroup>();

  function ensureGroup(c: CardEntry): CardGroup {
    const key = cardKey(c);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        card: c,
        cardKey: key,
        displayName: cardDisplayName(c),
        actions: [],
      });
    }
    return groupMap.get(key)!;
  }

  d.summons.forEach((c, i) =>
    ensureGroup(c).actions.push({ label: "Normal Summon", action: "summon", index: i }),
  );
  d.specialSummons.forEach((c, i) =>
    ensureGroup(c).actions.push({ label: "Special Summon", action: "specialSummon", index: i }),
  );
  d.posChanges.forEach((c, i) =>
    ensureGroup(c).actions.push({ label: "Change Position", action: "posChange", index: i }),
  );
  d.monsterSets.forEach((c, i) =>
    ensureGroup(c).actions.push({ label: "Set (face-down)", action: "monsterSet", index: i }),
  );
  d.spellSets.forEach((c, i) =>
    ensureGroup(c).actions.push({ label: "Set", action: "spellSet", index: i }),
  );
  d.activates.forEach((c, i) => {
    const activeC = d.activates[i]!;
    const label = activeC.description ? `Activate — ${activeC.description}` : "Activate";
    ensureGroup(c).actions.push({ label, action: "activate", index: i });
  });

  const groups = Array.from(groupMap.values());
  const hasActions = groups.length > 0;
  const hasPhaseActions = d.toBattlePhase || d.toEndPhase;

  const dis = (style: React.CSSProperties): React.CSSProperties => ({
    ...style,
    opacity: disabled ? 0.5 : style.opacity,
    cursor: disabled ? "not-allowed" : (style.cursor ?? "pointer"),
  });

  // Phone/tablet: full-width stack (already in bottom sheet shell)
  // Desktop: same structure; outer shell is ActionContextMenu
  const isCompact = layoutTier === "phone";

  return (
    <div role="group" aria-label="Choose an action">
      <p style={PROMPT}>{isCompact ? "Select an action:" : "Choose an action:"}</p>

      {/* Card-grouped actions */}
      {hasActions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {groups.map((group) => (
            <div key={group.cardKey} role="group" aria-label={group.displayName}>
              <p style={CARD_HEADER} aria-hidden="true">
                {group.displayName}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.actions.map((entry, ai) => (
                  <button
                    key={`${group.cardKey}:${entry.action}:${entry.index}`}
                    data-testid="action-option"
                    style={dis(BTN_BASE)}
                    disabled={disabled}
                    aria-label={`${entry.label}: ${group.displayName}`}
                    onClick={() =>
                      respond({
                        kind: "IdleCommand",
                        action: entry.action,
                        index: entry.index,
                      })
                    }
                  >
                    ▶ {ai === 0 ? group.displayName + " — " : ""}
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phase-advance actions */}
      {hasPhaseActions && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: hasActions ? 12 : 0,
            flexDirection: isCompact ? "column" : "row",
          }}
        >
          {d.toBattlePhase && (
            <button
              data-testid="action-option"
              style={dis({ ...BTN_PHASE, flex: 1 })}
              disabled={disabled}
              aria-label="Proceed to Battle Phase"
              onClick={() => respond({ kind: "IdleCommand", action: "toBP", index: null })}
            >
              ⚔ Battle Phase
            </button>
          )}
          {d.toEndPhase && (
            <button
              data-testid="action-option"
              style={dis({ ...BTN_PHASE, flex: 1 })}
              disabled={disabled}
              aria-label="End Phase"
              onClick={() => respond({ kind: "IdleCommand", action: "toEP", index: null })}
            >
              ⏹ End Phase
            </button>
          )}
        </div>
      )}

      {!hasActions && !hasPhaseActions && (
        <p
          style={{ fontSize: "1rem", color: "var(--text-2)" }}
          data-testid="no-idle-actions"
          role="status"
        >
          No actions available.
        </p>
      )}
    </div>
  );
}
