/**
 * PhaseRail — phase display AND phase-advance control, always present.
 *
 * Design spec §7: "End Turn is reachable at all times during my turn,
 * whether or not a decision panel exists." The rail is the permanent
 * home for End Turn and phase advancement.
 *
 * ClockPanel is docked at the left end per the design.
 */
import React from "react";
import type { Seat } from "@yugioh-app/contracts";
import { ClockPanel } from "./ClockPanel";

// Phase constants — canonical for Edison
export const PHASE_DP = 1;
export const PHASE_SP = 2;
export const PHASE_M1 = 4;
export const PHASE_BP = 8;
export const PHASE_M2 = 16;
export const PHASE_EP = 32;

const PHASES = [
  { value: PHASE_DP, label: "Draw Phase", short: "DP" },
  { value: PHASE_SP, label: "Standby Phase", short: "SP" },
  { value: PHASE_M1, label: "Main Phase 1", short: "M1" },
  { value: PHASE_BP, label: "Battle Phase", short: "BP" },
  { value: PHASE_M2, label: "Main Phase 2", short: "M2" },
  { value: PHASE_EP, label: "End Phase", short: "EP" },
] as const;

interface Props {
  currentPhase: number;
  currentTurn: Seat;
  mySeat: Seat;
  /** IdleCommand/BattleCommand-derived legal phase transitions */
  legalNextPhases: number[];
  onAdvancePhase: (phase: number) => void;
  myDeadlineAt: number | null;
  oppDeadlineAt: number | null;
  onClockSeat: Seat | null;
  myName?: string;
  oppName?: string;
  connection?: "open" | "reconnecting" | "closed";
  /** Whether we're waiting for the engine (no DECISION frame yet) */
  engineBusy?: boolean;
}

export function PhaseRail({
  currentPhase,
  currentTurn,
  mySeat,
  legalNextPhases,
  onAdvancePhase,
  myDeadlineAt,
  oppDeadlineAt,
  onClockSeat,
  myName = "You",
  oppName = "Opponent",
  connection = "open",
  engineBusy = false,
}: Props) {
  const isMyTurn = currentTurn === mySeat;

  // toBattlePhase/toEndPhase/toMainPhase2 come from IdleCommand legalNextPhases
  // plus "End Turn" from toEndPhase/toMainPhase2
  const canEndTurn = isMyTurn && legalNextPhases.includes(PHASE_EP);

  const railTint = !isMyTurn ? "var(--opp)" : "var(--own)";

  return (
    <div
      data-testid="phase-ribbon"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: "var(--bg-2)",
        borderRadius: 6,
        border: `1px solid ${railTint}`,
        position: "relative",
      }}
    >
      {/* Clock panel — left end */}
      {onClockSeat != null && (
        <div style={{ flexShrink: 0 }}>
          <ClockPanel
            myDeadlineAt={myDeadlineAt}
            oppDeadlineAt={oppDeadlineAt}
            onClockSeat={onClockSeat}
            mySeat={mySeat}
            myName={myName}
            oppName={oppName}
            connection={connection}
          />
        </div>
      )}

      {/* Engine busy hairline */}
      {engineBusy && (
        <div
          aria-label="Engine is resolving…"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "var(--accent)",
            borderRadius: "0 0 4px 4px",
            opacity: 0.7,
          }}
        />
      )}

      {/* Phase cells */}
      <div role="group" aria-label="Duel phases" style={{ display: "flex", gap: 4, flex: 1 }}>
        {PHASES.map((ph) => {
          const active = ph.value === currentPhase;
          const legal = isMyTurn && legalNextPhases.includes(ph.value) && !active;
          const isEndTurn = ph.value === PHASE_EP && canEndTurn;

          return (
            <button
              key={ph.value}
              aria-current={active ? "step" : undefined}
              aria-label={`${ph.label}${active ? " (current)" : legal ? " — advance here" : ""}`}
              disabled={!legal}
              onClick={legal ? () => onAdvancePhase(ph.value) : undefined}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                fontSize: active ? "0.875rem" : "0.8125rem",
                fontWeight: active ? 700 : 400,
                // Current phase is ALWAYS the highest-contrast element
                color: active ? "var(--text-0)" : legal ? railTint : "var(--text-2)",
                background: active
                  ? isMyTurn
                    ? "rgba(59,130,246,0.2)"
                    : "rgba(239,68,68,0.2)"
                  : isEndTurn
                    ? "var(--bg-3)"
                    : "transparent",
                border: active
                  ? `2px solid ${railTint}`
                  : legal
                    ? `1px solid ${railTint}`
                    : "1px solid transparent",
                cursor: legal ? "pointer" : "default",
                whiteSpace: "nowrap",
                flexShrink: 0,
                opacity: active ? 1 : legal ? 0.85 : 0.4,
              }}
            >
              {ph.short}
              {isEndTurn && active ? "" : ""}
            </button>
          );
        })}
      </div>

      {/* End Turn button — always at right end */}
      <button
        data-testid="end-turn-btn"
        onClick={() => onAdvancePhase(PHASE_EP)}
        disabled={!canEndTurn}
        aria-label="End Turn"
        style={{
          flexShrink: 0,
          padding: "4px 12px",
          background: canEndTurn ? "var(--bg-3)" : "transparent",
          border: `1px solid ${canEndTurn ? "var(--border)" : "transparent"}`,
          borderRadius: 4,
          color: canEndTurn ? "var(--text-0)" : "var(--text-2)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: canEndTurn ? "pointer" : "default",
          minHeight: 32,
          opacity: canEndTurn ? 1 : 0.3,
        }}
      >
        End Turn
      </button>
    </div>
  );
}
