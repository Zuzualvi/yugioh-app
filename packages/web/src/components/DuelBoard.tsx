/**
 * DuelBoard — the full game board for one duel.
 *
 * Dense-indexed zone arrays (MH-1): index === sequence for mzone/szone.
 * The TEMPORARY SHIM (ZUH-93) that collapsed nulls is DELETED.
 * Opponent face-up monsters render with real art (the old "if (hidden || !isOwn)" guard is gone).
 *
 * Preserved data-testids (E2E contract):
 *   duel-board, phase-ribbon, face-down-card, face-up-card
 *
 * Layout (design spec §1, §2):
 *   - Opponent hand (top, backs + count)
 *   - Opponent field (FieldGroup, red outline)
 *   - PhaseRail (centre strip with ClockPanel at left, phase cells, End Turn at right)
 *   - Own field (FieldGroup, blue outline)
 *   - Own hand (bottom, face-up)
 *
 * 1440×900 is the floor (G1). Sub-1440 behaviour is out of scope.
 */

import React from "react";
import type { DuelStateSnapshot, Seat } from "@yugioh-app/contracts";
import type { CardRef, DuelInteraction, InspectorControl } from "../duel/contracts";
import { FieldGroup } from "./duel/board/FieldGroup";
import { HandRow } from "./duel/board/HandRow";
import { PhaseRail } from "./duel/chrome/PhaseRail";
import { LifePointPlate } from "./duel/chrome/LifePointPlate";

interface Props {
  state: DuelStateSnapshot;
  mySeat: Seat;
  interaction: DuelInteraction;
  inspector: InspectorControl;
  clock: { onClockSeat: Seat; deadlines: [number, number] } | null;
  myName?: string;
  oppName?: string;
  connection?: "open" | "reconnecting" | "closed";
  onCardClick: (ref: CardRef, rect: DOMRect) => void;
  onAdvancePhase: (phase: number) => void;
  legalNextPhases: number[];
}

export function DuelBoard({
  state,
  mySeat,
  interaction,
  inspector,
  clock,
  myName = "You",
  oppName = "Opponent",
  connection = "open",
  onCardClick,
  onAdvancePhase,
  legalNextPhases,
}: Props) {
  const { lp, currentTurn, currentPhase, zones } = state;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;

  // Dense zone arrays — NO filtering, index === sequence (MH-1)
  const myMzone = mySeat === 0 ? zones.p0_mzone : zones.p1_mzone;
  const mySzone = mySeat === 0 ? zones.p0_szone : zones.p1_szone;
  const myFzone = mySeat === 0 ? zones.p0_fzone : zones.p1_fzone;
  const myHand = mySeat === 0 ? zones.p0_hand : zones.p1_hand;
  const myGrave = mySeat === 0 ? zones.p0_grave : zones.p1_grave;
  const myRemoved = mySeat === 0 ? zones.p0_removed : zones.p1_removed;
  const myExtra = mySeat === 0 ? zones.p0_extra : zones.p1_extra;
  const myDeckCount = mySeat === 0 ? zones.p0_deckCount : zones.p1_deckCount;

  const oppMzone = oppSeat === 0 ? zones.p0_mzone : zones.p1_mzone;
  const oppSzone = oppSeat === 0 ? zones.p0_szone : zones.p1_szone;
  const oppFzone = oppSeat === 0 ? zones.p0_fzone : zones.p1_fzone;
  const oppHand = oppSeat === 0 ? zones.p0_hand : zones.p1_hand;
  const oppGrave = oppSeat === 0 ? zones.p0_grave : zones.p1_grave;
  const oppRemoved = oppSeat === 0 ? zones.p0_removed : zones.p1_removed;
  const oppExtra = oppSeat === 0 ? zones.p0_extra : zones.p1_extra;
  const oppDeckCount = oppSeat === 0 ? zones.p0_deckCount : zones.p1_deckCount;

  const myLp = lp[mySeat];
  const oppLp = lp[oppSeat];

  // Derive which monsters are "spent" (absent from attacks[] during BP)
  const spentAttackers: CardRef[] = [];
  if (interaction.decision?.kind === "BattleCommand" && currentPhase === 8 /* BP */) {
    // A monster on the board that is NOT in attacks[] has already attacked
    for (let i = 0; i < (myMzone?.length ?? 0); i++) {
      const card = myMzone?.[i];
      if (!card) continue;
      const inAttacks = (interaction.decision.attacks ?? []).some(
        (a) => a.controller === mySeat && a.location === "MZONE" && a.sequence === i,
      );
      if (!inAttacks) {
        spentAttackers.push({ controller: mySeat, location: "MZONE", sequence: i });
      }
    }
  }

  // In answer mode: cards that are legal to act on right now
  // In act mode: derived from IdleCommand/BattleCommand (simplified — VerbChipCluster handles the detail)
  const actionableCards: CardRef[] = [];

  return (
    <div
      data-testid="duel-board"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        minWidth: 1100,
      }}
    >
      {/* Opponent hand (top) */}
      <HandRow
        cards={oppHand}
        controller={oppSeat}
        mySeat={mySeat}
        candidates={interaction.candidates}
        onCardClick={onCardClick}
      />

      {/* Opponent LP plate (top-right) and field (red outline) */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <FieldGroup
          controller={oppSeat}
          mySeat={mySeat}
          mzone={oppMzone}
          szone={oppSzone}
          fzone={oppFzone}
          grave={oppGrave}
          removed={oppRemoved}
          extra={oppExtra}
          deckCount={oppDeckCount}
          candidates={interaction.candidates}
          selected={interaction.selection}
          spentAttackers={[]}
          actionableCards={actionableCards}
          inspector={inspector}
          onCardClick={onCardClick}
          flipped
        />
        <div style={{ marginLeft: "auto" }}>
          <LifePointPlate name={oppName} lp={oppLp ?? 8000} isOwn={false} />
        </div>
      </div>

      {/* Phase rail — centre strip (data-testid="phase-ribbon" preserved for E2E) */}
      <PhaseRail
        currentPhase={currentPhase}
        currentTurn={currentTurn}
        mySeat={mySeat}
        legalNextPhases={legalNextPhases}
        onAdvancePhase={onAdvancePhase}
        myDeadlineAt={clock ? clock.deadlines[mySeat] : null}
        oppDeadlineAt={clock ? clock.deadlines[oppSeat] : null}
        onClockSeat={clock ? clock.onClockSeat : null}
        myName={myName}
        oppName={oppName}
        connection={connection}
      />

      {/* Own LP plate (bottom-left) and field (blue outline) */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div>
          <LifePointPlate name={myName} lp={myLp ?? 8000} isOwn />
        </div>
        <FieldGroup
          controller={mySeat}
          mySeat={mySeat}
          mzone={myMzone}
          szone={mySzone}
          fzone={myFzone}
          grave={myGrave}
          removed={myRemoved}
          extra={myExtra}
          deckCount={myDeckCount}
          candidates={interaction.candidates}
          selected={interaction.selection}
          spentAttackers={spentAttackers}
          actionableCards={actionableCards}
          inspector={inspector}
          onCardClick={onCardClick}
        />
      </div>

      {/* Own hand (bottom) */}
      <HandRow
        cards={myHand}
        controller={mySeat}
        mySeat={mySeat}
        candidates={interaction.candidates}
        onCardClick={onCardClick}
      />
    </div>
  );
}
