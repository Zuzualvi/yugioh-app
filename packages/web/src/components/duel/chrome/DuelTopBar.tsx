/**
 * DuelTopBar — the 40px chrome bar at the top of the duel screen.
 * Carries: Exit · PresenceIndicator · TurnPill · ResponsePromptControl · SettingsPopover · LogToggle.
 */
import React from "react";
import type { Seat } from "@yugioh-app/contracts";
import { PresenceIndicator } from "./PresenceIndicator";
import { TurnPill } from "./TurnPill";
import { ResponsePromptControl } from "./ResponsePromptControl";
import type { PromptLevel } from "../../../duel/responsePrompts";
import { SettingsPopover } from "./SettingsPopover";
import type { DuelSettings } from "./SettingsPopover";
import { LogToggle } from "./LogToggle";

interface Props {
  opponentName: string;
  connection: "open" | "reconnecting" | "closed";
  turnNumber: number | null;
  currentTurn: Seat;
  mySeat: Seat;
  logOpen: boolean;
  onLogToggle: () => void;
  settings: DuelSettings;
  onSettingsChange: (s: DuelSettings) => void;
  promptLevel: PromptLevel;
  onPromptLevelChange: (v: PromptLevel) => void;
  onResign: () => void;
  onExit: () => void;
  duelEnded: boolean;
}

export function DuelTopBar({
  opponentName,
  connection,
  turnNumber,
  currentTurn,
  mySeat,
  logOpen,
  onLogToggle,
  settings,
  onSettingsChange,
  promptLevel,
  onPromptLevelChange,
  onResign,
  onExit,
  duelEnded,
}: Props) {
  return (
    <header
      data-testid="duel-top-bar"
      style={{
        height: 40,
        minHeight: 40,
        background: "var(--bg-1)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <button
        onClick={onExit}
        aria-label="Exit duel"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-1)",
          fontSize: "0.875rem",
          cursor: "pointer",
          padding: "4px 8px",
          minHeight: 32,
        }}
      >
        ⟵ Exit
      </button>

      <PresenceIndicator name={opponentName} connection={connection} />

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <TurnPill turnNumber={turnNumber} currentTurn={currentTurn} mySeat={mySeat} />
      </div>

      <ResponsePromptControl
        value={promptLevel}
        onChange={onPromptLevelChange}
        disabled={duelEnded}
      />

      <SettingsPopover
        settings={settings}
        onSettingsChange={onSettingsChange}
        onResign={onResign}
        disabled={duelEnded}
      />

      <LogToggle open={logOpen} onToggle={onLogToggle} />
    </header>
  );
}
