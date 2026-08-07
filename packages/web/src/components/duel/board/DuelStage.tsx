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
 * Wiring (ZUH-105):
 *   - W2: useDuelInteraction + DuelDock replace interactionStub + answer-mode-stub.
 *   - W3: createCardCache + CardInspector + PileInspector + WaitBanner replace stubs.
 *
 * action-panel (E2E contract):
 *   - Always mounted when the duel is active.
 *   - answer mode → DuelDock (QuestionBar, chain strip, receipts).
 *   - act mode (IdleCommand/BattleCommand) → per-card action buttons.
 *   - waiting / ended → data-testid="no-decision" placeholder.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { DuelStageProps, CardRef, InspectorControl } from "../../../duel/contracts";
import type { Seat } from "@yugioh-app/contracts";
import type { Verb } from "./VerbChipCluster";
import { DuelBoard } from "../../DuelBoard";
import { DimScrim } from "../chrome/DimScrim";
import { VerbChipCluster, deriveVerbs, deriveRefusalReason } from "./VerbChipCluster";
import { useDuelInteraction } from "../../../duel/useDuelInteraction";
import { createCardCache } from "../../../duel/cardCache";
import { DuelDock } from "../dock/DuelDock";
import { CardInspector } from "../inspect/CardInspector";
import type { InspectorSource } from "../inspect/CardInspector";
import { PileInspector } from "../inspect/PileInspector";
import { WaitBanner } from "../WaitBanner";
import type { WaitState } from "../WaitBanner";
import type { DuelDecision } from "@yugioh-app/contracts";

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

// Inspector state — which card or pile is currently shown
interface CardInspectorState {
  ref: CardRef;
  code: number;
  source: InspectorSource;
}

interface PileInspectorState {
  controller: Seat;
  location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK";
}

export function DuelStage({ state, decision, mySeat, clock, respond, connection }: DuelStageProps) {
  // ── Card cache (W3 real implementation) ─────────────────────────────────────
  // Debounce onChange to batch card-fetch completions into one re-render per 50ms.
  const [, setCacheTick] = useState(0);
  const cacheTickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardCache = useMemo(
    () =>
      createCardCache(() => {
        if (cacheTickTimer.current) clearTimeout(cacheTickTimer.current);
        cacheTickTimer.current = setTimeout(() => setCacheTick((n) => n + 1), 50);
      }),
    [],
  );

  // ── Interaction state machine (W2 real implementation) ───────────────────────
  // chooseZones: true so the E2E test can observe and click zone-option buttons
  // (the test explicitly clicks them; auto-answering would hide them).
  const [prefs] = useState<{ chooseZones: boolean }>({ chooseZones: true });
  const interaction = useDuelInteraction({
    decision,
    mySeat,
    duelEnded: state.duelEnded,
    respond,
    prefs,
  });

  const mode = interaction.mode;

  // ── Inspector state ───────────────────────────────────────────────────────────
  const [cardInspector, setCardInspector] = useState<CardInspectorState | null>(null);
  const [pileInspector, setPileInspector] = useState<PileInspectorState | null>(null);

  const inspectorControl = useRef<InspectorControl>({
    inspectCard(ref: CardRef, code: number) {
      setPileInspector(null);
      setCardInspector({ ref, code, source: "click" });
    },
    inspectPile(controller: Seat, location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK") {
      setCardInspector(null);
      setPileInspector({ controller, location });
    },
    close() {
      setCardInspector(null);
      setPileInspector(null);
    },
  }).current;

  // ── Verb chip cluster state ──────────────────────────────────────────────────
  const [clickedRef, setClickedRef] = useState<CardRef | null>(null);
  const [clickedAnchor, setClickedAnchor] = useState<DOMRect | null>(null);

  // In answer mode, VerbChipCluster is NEVER mounted (Law 1)
  const showVerbCluster = mode === "act" && clickedRef !== null && clickedAnchor !== null;

  // Legal phases from IdleCommand / BattleCommand
  const legalNextPhases = deriveLegalPhases(decision);

  const handleCardClick = useCallback(
    (ref: CardRef, rect: DOMRect) => {
      if (mode === "answer") {
        inspectorControl.inspectCard(ref, 0);
        return;
      }
      if (mode !== "act") return;

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
    [mode, clickedRef, inspectorControl],
  );

  const handleVerbPick = useCallback(
    (verb: Verb) => {
      if (verb.action === "inspect") {
        if (clickedRef) inspectorControl.inspectCard(clickedRef, 0);
        setClickedRef(null);
        setClickedAnchor(null);
        return;
      }
      if (decision && clickedRef) {
        if (decision.kind === "IdleCommand") {
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
    [decision, clickedRef, respond, inspectorControl],
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

  const myHandCards = mySeat === 0 ? state.zones.p0_hand : state.zones.p1_hand;
  const verbs = showVerbCluster ? (deriveVerbs(decision, clickedRef, myHandCards) ?? []) : [];
  const refusalReason =
    showVerbCluster && verbs.filter((v) => v.label !== "Inspect").length === 0
      ? deriveRefusalReason(decision, clickedRef)
      : null;

  const inAnswerMode = mode === "answer";

  // WaitBanner state
  const waitState: WaitState | null = (() => {
    if (connection === "reconnecting") return { kind: "reconnecting", attempt: 1 };
    if (mode === "waiting" && connection === "open")
      return { kind: "opponent-thinking", opponentName: "Opponent" };
    return null;
  })();

  // Pile cards for PileInspector
  function getPileCards(
    controller: Seat,
    location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK",
  ): { code: number }[] {
    const z = state.zones;
    if (controller === 0) {
      if (location === "GRAVE") return z.p0_grave;
      if (location === "REMOVED") return z.p0_removed;
      if (location === "EXTRA") return z.p0_extra;
    } else {
      if (location === "GRAVE") return z.p1_grave;
      if (location === "REMOVED") return z.p1_removed;
      if (location === "EXTRA") return z.p1_extra;
    }
    return [];
  }

  // Card info for CardInspector
  const inspectedCode = cardInspector?.code ?? null;
  const inspectedInfo =
    inspectedCode !== null && inspectedCode !== 0 ? cardCache.get(inspectedCode) : null;
  const inspectedLoading =
    inspectedCode !== null && inspectedCode !== 0 ? cardCache.isLoading(inspectedCode) : false;

  // ── action-panel: act-mode verb buttons ──────────────────────────────────────
  // These mirror the old IdleCommandPanel/BattleCommandPanel behavior so that
  // the E2E backbone contract (action-panel always visible, Normal Summon pre-reachable)
  // is satisfied without changing VerbChipCluster's card-click flow.
  function renderActButtons() {
    if (!decision) return null;
    if (decision.kind === "IdleCommand") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {decision.summons.map((s, i) => {
            // Level comes from the hand snapshot (ZoneCard.level), not CardEntry (no level field).
            const handCard = s.location === "HAND" ? myHandCards[s.sequence] : undefined;
            const level = handCard?.level;
            const needsTribute = level !== undefined && level !== null && level >= 5;
            const label = needsTribute ? "Normal Summon — tribute" : "Normal Summon";
            return (
              <button
                key={`summon-${i}`}
                onClick={() => respond({ kind: "IdleCommand", action: "summon", index: i })}
                style={{
                  padding: "8px 14px",
                  background: "var(--accent-dim,rgba(74,144,217,0.15))",
                  border: "1px solid var(--accent,#4a90d9)",
                  borderRadius: 6,
                  color: "var(--text-0)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textAlign: "left",
                  minHeight: 36,
                }}
              >
                {label}
              </button>
            );
          })}
          {decision.specialSummons.map((s, i) => (
            <button
              key={`sp-${i}`}
              onClick={() => respond({ kind: "IdleCommand", action: "specialSummon", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--accent-dim,rgba(74,144,217,0.15))",
                border: "1px solid var(--accent,#4a90d9)",
                borderRadius: 6,
                color: "var(--text-0)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              Special Summon
            </button>
          ))}
          {decision.activates.map((a, i) => (
            <button
              key={`act-${i}`}
              onClick={() => respond({ kind: "IdleCommand", action: "activate", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--accent-dim,rgba(74,144,217,0.15))",
                border: "1px solid var(--accent,#4a90d9)",
                borderRadius: 6,
                color: "var(--text-0)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              {a.description ? `Activate — ${a.description}` : "Activate"}
            </button>
          ))}
          {decision.monsterSets.map((_s, i) => (
            <button
              key={`mset-${i}`}
              onClick={() => respond({ kind: "IdleCommand", action: "monsterSet", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              Set (Monster)
            </button>
          ))}
          {decision.spellSets.map((_s, i) => (
            <button
              key={`sset-${i}`}
              onClick={() => respond({ kind: "IdleCommand", action: "spellSet", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              Set (Spell/Trap)
            </button>
          ))}
          {decision.posChanges.map((_s, i) => (
            <button
              key={`pos-${i}`}
              onClick={() => respond({ kind: "IdleCommand", action: "posChange", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              Change Position
            </button>
          ))}
          {decision.toBattlePhase && (
            <button
              onClick={() => respond({ kind: "IdleCommand", action: "toBP", index: null })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                minHeight: 36,
              }}
            >
              Battle Phase
            </button>
          )}
          {decision.toEndPhase && (
            <button
              onClick={() => respond({ kind: "IdleCommand", action: "toEP", index: null })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                minHeight: 36,
              }}
            >
              End Phase
            </button>
          )}
        </div>
      );
    }
    if (decision.kind === "BattleCommand") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {decision.attacks.map((a, i) => (
            <button
              key={`atk-${i}`}
              onClick={() => respond({ kind: "BattleCommand", action: "attack", index: i })}
              style={{
                padding: "8px 14px",
                background: "var(--accent-dim,rgba(74,144,217,0.15))",
                border: "1px solid var(--accent,#4a90d9)",
                borderRadius: 6,
                color: "var(--text-0)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              {a.canDirectAttack ? "Attack directly" : "Attack"}
            </button>
          ))}
          {decision.toMainPhase2 && (
            <button
              onClick={() => respond({ kind: "BattleCommand", action: "toM2", index: null })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                minHeight: 36,
              }}
            >
              Main Phase 2
            </button>
          )}
          {decision.toEndPhase && (
            <button
              onClick={() => respond({ kind: "BattleCommand", action: "toEP", index: null })}
              style={{
                padding: "8px 14px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-1)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                minHeight: 36,
              }}
            >
              End Phase
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  // Show no-decision only when there's genuinely no action available for this player
  const showNoDecision = mode === "waiting" || mode === "ended";

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
      {/* WaitBanner — opponent thinking or reconnecting */}
      <WaitBanner state={waitState} />

      {/* The dim scrim — z-index 2. Candidates get z-index 3 to lift out. */}
      <DimScrim active={inAnswerMode} />

      {/* Board */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <DuelBoard
          state={state}
          mySeat={mySeat}
          interaction={interaction}
          inspector={inspectorControl}
          clock={clock}
          connection={connection}
          onCardClick={handleCardClick}
          onAdvancePhase={handleAdvancePhase}
          legalNextPhases={legalNextPhases}
        />
      </div>

      {/* VerbChipCluster — ACT mode only. NEVER mounted when QuestionBar would be (Law 1). */}
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
       * action-panel — ALWAYS mounted.
       * E2E contract: getByTestId("action-panel") must be visible at all times during
       * an active duel (both for the on-clock player and the waiting player).
       * answer mode → DuelDock (QuestionBar, ChainStrip, IntentRibbon).
       * act mode → IdleCommand/BattleCommand action buttons.
       * waiting/ended → no-decision placeholder.
       */}
      <div
        data-testid="action-panel"
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: "8px 8px 0 0",
          padding: "8px 12px",
          zIndex: 5,
          minWidth: 240,
          maxWidth: 560,
          maxHeight: "40vh",
          overflowY: "auto",
        }}
      >
        {showNoDecision && (
          <p
            data-testid="no-decision"
            style={{ color: "var(--text-2)", fontSize: "0.875rem", fontStyle: "italic", margin: 0 }}
          >
            Waiting for engine…
          </p>
        )}

        {mode === "act" && renderActButtons()}

        {mode === "answer" && (
          <DuelDock
            decision={interaction.decision}
            selection={interaction.selection}
            chain={interaction.chain}
            receipts={interaction.receipts}
            intent={interaction.intent}
            mySeat={mySeat}
            onToggle={interaction.toggleSelection}
            onConfirm={interaction.confirm}
            onDecline={interaction.decline}
            onDirectRespond={respond}
            onCancelIntent={interaction.cancelIntent}
            loading={interaction.status === "Sending…"}
          />
        )}
      </div>

      {/* W3: CardInspector */}
      {cardInspector !== null && (
        <CardInspector
          code={cardInspector.code}
          info={inspectedInfo}
          loading={inspectedLoading}
          source={cardInspector.source}
          onClose={() => setCardInspector(null)}
        />
      )}

      {/* W3: PileInspector */}
      {pileInspector !== null && (
        <PileInspector
          controller={pileInspector.controller}
          location={pileInspector.location}
          cards={getPileCards(pileInspector.controller, pileInspector.location)}
          hidden={
            pileInspector.controller !== mySeat &&
            (pileInspector.location === "DECK" || pileInspector.location === "EXTRA")
          }
          mySeat={mySeat}
          lookup={cardCache}
          inspector={inspectorControl}
          onClose={() => setPileInspector(null)}
        />
      )}
    </div>
  );
}
