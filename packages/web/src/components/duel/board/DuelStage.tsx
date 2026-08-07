/**
 * DuelStage — the interaction-mode state machine and positioning context.
 *
 * Law 1 (design spec §0): ACT and ANSWER are different objects in different places,
 * NEVER both live. DuelStage is the single place that enforces this.
 *
 * Acceptance criteria:
 *   - At most one of VerbChipCluster and QuestionBar mounted at any instant.
 *     A test that mounts both fails.
 *   - intent is NOT cleared by a STATE frame (cleared only on new intent/decision kind).
 *   - selection is cleared on every new DECISION frame.
 *
 * W2 slots: DuelDock (QuestionBar, IntentRibbon, ChainStrip) — currently null stubs.
 * W3 slots: CardInspector, PileInspector, WaitBanner, DuelEndOverlay — currently null stubs.
 */
import React, { useCallback, useState } from "react";
import type { DuelStageProps } from "../../../duel/contracts";
import type { CardRef } from "../../../duel/contracts";
import type { Verb } from "./VerbChipCluster";
import { DuelBoard } from "../../DuelBoard";
import { DimScrim } from "../chrome/DimScrim";
import { VerbChipCluster, deriveVerbs, deriveRefusalReason } from "./VerbChipCluster";
import { interactionStub } from "../../../duel/stubs/interactionStub";
import { inspectorControlStub } from "../../../duel/stubs/inspectorControlStub";
import type { DuelDecision } from "@yugioh-app/contracts";

// Derive mode from the current decision and connection state
function deriveMode(
  decision: DuelDecision | null,
  mySeat: number,
  duelEnded: boolean,
  connection: "open" | "reconnecting" | "closed",
): "act" | "answer" | "waiting" | "ended" {
  if (duelEnded) return "ended";
  if (connection !== "open") return "waiting";
  if (!decision) return "waiting";
  if (decision.player !== mySeat) return "waiting";
  if (decision.kind === "IdleCommand" || decision.kind === "BattleCommand") return "act";
  return "answer";
}

// Derive legal next phases from the current decision
function deriveLegalPhases(decision: DuelDecision | null): number[] {
  if (!decision) return [];
  const phases: number[] = [];
  if (decision.kind === "IdleCommand") {
    if (decision.toBattlePhase) phases.push(8); // BP
    if (decision.toEndPhase) phases.push(32); // EP
  } else if (decision.kind === "BattleCommand") {
    if (decision.toMainPhase2) phases.push(16); // M2
    if (decision.toEndPhase) phases.push(32); // EP
  }
  return phases;
}

export function DuelStage({ state, decision, mySeat, clock, respond, connection }: DuelStageProps) {
  // ── Verb chip cluster state ──────────────────────────────────────────────
  const [clickedRef, setClickedRef] = useState<CardRef | null>(null);
  const [clickedAnchor, setClickedAnchor] = useState<DOMRect | null>(null);

  // Derive mode from current decision
  const mode = deriveMode(decision, mySeat, state.duelEnded, connection);

  // In answer mode, VerbChipCluster is NEVER mounted (Law 1)
  const showVerbCluster = mode === "act" && clickedRef !== null && clickedAnchor !== null;

  // Verb cluster is open → QuestionBar (W2 slot) is not mounted
  // This is the Law 1 guarantee: both cannot be live simultaneously.

  // Interaction state: use stub for now (W2 will provide real implementation)
  // When W2 lands: replace interactionStub with real DuelInteraction from W2.
  const interaction = {
    ...interactionStub,
    // In answer mode, the decision is what drives the question bar
    mode: mode as "act" | "answer" | "waiting" | "ended",
    decision: mode === "answer" ? decision : null,
  };

  // Legal phases from IdleCommand
  const legalNextPhases = deriveLegalPhases(decision);

  // Clock: already in DuelStageProps format (deadlines tuple)
  const clockProps = clock;

  const handleCardClick = useCallback(
    (ref: CardRef, rect: DOMRect) => {
      if (mode === "answer") {
        // In answer mode, clicking opens inspector (W3 slot)
        inspectorControlStub.inspectCard(ref, 0);
        return;
      }
      if (mode !== "act") return;

      // Toggle verb cluster
      if (
        clickedRef &&
        clickedRef.controller === ref.controller &&
        clickedRef.location === ref.location &&
        clickedRef.sequence === ref.sequence
      ) {
        setClickedRef(null);
        setClickedAnchor(null);
        return;
      }

      setClickedRef(ref);
      setClickedAnchor(rect);
    },
    [mode, clickedRef],
  );

  const handleVerbPick = useCallback(
    (verb: Verb) => {
      if (verb.action === "inspect") {
        // Open inspector (W3 slot)
        if (clickedRef) inspectorControlStub.inspectCard(clickedRef, 0);
        setClickedRef(null);
        setClickedAnchor(null);
        return;
      }
      // Send decision response
      if (decision && clickedRef) {
        if (decision.kind === "IdleCommand") {
          // action comes from deriveVerbs: "summon", "specialSummon", "posChange",
          // "monsterSet", "spellSet", "activate" — all valid IdleCommandAction values
          respond({
            kind: "IdleCommand",
            action: verb.action as
              "summon" | "spellSet" | "monsterSet" | "specialSummon" | "activate" | "posChange",
            index: verb.index ?? 0,
          });
        } else if (decision.kind === "BattleCommand") {
          respond({
            kind: "BattleCommand",
            action: verb.action as "attack" | "toM2" | "toEP" | "chain",
            index: verb.index ?? 0,
          });
        }
      }
      setClickedRef(null);
      setClickedAnchor(null);
    },
    [decision, clickedRef, respond],
  );

  const handleVerbDismiss = useCallback(() => {
    setClickedRef(null);
    setClickedAnchor(null);
  }, []);

  const handleAdvancePhase = useCallback(
    (phase: number) => {
      if (!decision) return;
      if (decision.kind === "IdleCommand") {
        if (phase === 8 && decision.toBattlePhase) {
          respond({ kind: "IdleCommand", action: "toBP", index: null });
        } else if (phase === 32 && decision.toEndPhase) {
          respond({ kind: "IdleCommand", action: "toEP", index: null });
        }
      } else if (decision.kind === "BattleCommand") {
        if (phase === 16 && decision.toMainPhase2) {
          respond({ kind: "BattleCommand", action: "toM2", index: null });
        } else if (phase === 32 && decision.toEndPhase) {
          respond({ kind: "BattleCommand", action: "toEP", index: null });
        }
      }
    },
    [decision, respond],
  );

  // Derive verbs for the clicked card
  const verbs = showVerbCluster ? (deriveVerbs(decision, clickedRef) ?? []) : [];
  const refusalReason =
    showVerbCluster && verbs.filter((v) => v.label !== "Inspect").length === 0
      ? deriveRefusalReason(decision, clickedRef)
      : null;

  const inAnswerMode = mode === "answer";

  return (
    <div
      data-testid="duel-stage"
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* The dim scrim — z-index 2. Candidates get z-index 3 to lift out. */}
      <DimScrim active={inAnswerMode} />

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <DuelBoard
          state={state}
          mySeat={mySeat}
          interaction={interaction}
          inspector={inspectorControlStub}
          clock={clockProps}
          connection={connection}
          onCardClick={handleCardClick}
          onAdvancePhase={handleAdvancePhase}
          legalNextPhases={legalNextPhases}
        />
      </div>

      {/* VerbChipCluster — ACT mode only. NEVER mounted when QuestionBar would be. */}
      {showVerbCluster && mode === "act" && (
        <VerbChipCluster
          anchor={clickedAnchor!}
          verbs={verbs}
          onPick={handleVerbPick}
          onDismiss={handleVerbDismiss}
          refusalReason={refusalReason}
        />
      )}

      {/*
       * W2 SLOT: DuelDock (QuestionBar + IntentRibbon + ChainStrip)
       * Mounted ONLY when mode === "answer".
       * Law 1: showVerbCluster is false when mode === "answer", so only ONE
       * of these two surfaces is ever live.
       *
       * Delete this comment and replace with:
       *   {mode === "answer" && <DuelDock decision={decision!} ... />}
       * when W2 lands on the integration branch.
       */}
      {mode === "answer" && (
        <div
          data-testid="answer-mode-stub"
          aria-label="Decision pending — dock coming in W2"
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: "8px 8px 0 0",
            padding: "8px 16px",
            fontSize: "0.875rem",
            color: "var(--text-2)",
            zIndex: 5,
          }}
        >
          Awaiting decision input (W2)
        </div>
      )}

      {/*
       * W3 SLOT: CardInspector, WaitBanner, DuelEndOverlay
       * Replace with real components when W3 lands.
       */}
    </div>
  );
}
