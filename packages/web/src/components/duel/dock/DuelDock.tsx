/**
 * DuelDock — the answer surface shell.
 *
 * Owns: ChainStrip → IntentRibbon → QuestionBar / AutoAnswerReceipt.
 * The dock is a positioning shell only. Direct children have pointer-events;
 * the dock itself does not intercept clicks [B1].
 *
 * In ANSWER mode: shows QuestionBar (and never AutoAnswerReceipt simultaneously).
 * After auto-resolve: shows AutoAnswerReceipt (and question-bar is absent).
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §0 Law 1.
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse, Seat } from "@yugioh-app/contracts";
import type { AutoAnswerReceipt, CardRef, ChainLink, PendingIntent } from "../../../duel/contracts";
import { ChainStrip } from "./ChainStrip";
import { IntentRibbon } from "./IntentRibbon";
import { QuestionBar } from "./QuestionBar";
import { AutoAnswerReceiptList } from "./AutoAnswerReceipt";

interface Props {
  /** The decision currently being answered, or null. */
  decision: DuelDecision | null;
  /** Cards the player has selected for the pending decision. */
  selection: CardRef[];
  /** Chain links currently on the stack. */
  chain: ChainLink[];
  /** Auto-answer receipts to display. */
  receipts: AutoAnswerReceipt[];
  /** Active intent (may survive STATE frames). */
  intent: PendingIntent | null;
  mySeat: Seat;
  onToggle: (ref: CardRef) => void;
  onConfirm: () => void;
  onDecline: () => void;
  onDirectRespond: (r: DuelDecisionResponse) => void;
  onCancelIntent: () => void;
  onAskNextTime?: (receiptId: string) => void;
  /** True when waiting for server response. */
  loading: boolean;
  disabled?: boolean;
  caption?: string;
}

export function DuelDock({
  decision,
  selection,
  chain,
  receipts,
  intent,
  mySeat,
  onToggle,
  onConfirm,
  onDecline,
  onDirectRespond,
  onCancelIntent,
  onAskNextTime,
  loading,
  disabled = false,
  caption,
}: Props) {
  // Determine if the next step (after current) is non-cancelable.
  // Used to label the confirm button "X — cannot be undone 🔒".
  const commitNext =
    intent !== null && intent.commitStep >= 0 && intent.currentStep === intent.commitStep - 1;

  // The question bar and the receipt list are mutually exclusive [2b AC].
  const showQuestionBar =
    decision !== null &&
    decision.kind !== "IdleCommand" &&
    decision.kind !== "BattleCommand" &&
    receipts.length === 0;

  const showReceipts = receipts.length > 0;

  return (
    <div
      data-testid="duel-dock"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        // Dock is positioning shell only — it must NOT intercept clicks.
        pointerEvents: "none",
      }}
    >
      {/* Chain strip — always on top of dock */}
      {chain.length > 0 && (
        <div style={{ pointerEvents: "auto" }}>
          <ChainStrip links={chain} mySeat={mySeat} />
        </div>
      )}

      {/* Auto-answer receipts */}
      {showReceipts && (
        <div style={{ pointerEvents: "auto", padding: "4px 0" }}>
          <AutoAnswerReceiptList receipts={receipts} onAskNextTime={onAskNextTime} />
        </div>
      )}

      {/* Intent ribbon — shows when an intent is in flight */}
      {intent !== null && (
        <div style={{ pointerEvents: "auto" }}>
          <IntentRibbon intent={intent} onCancel={onCancelIntent} disabled={disabled} />
        </div>
      )}

      {/* Question bar — only one ever, only in answer mode */}
      {showQuestionBar && decision && (
        <div style={{ pointerEvents: "auto" }}>
          <QuestionBar
            decision={decision}
            selection={selection}
            onToggle={onToggle}
            onConfirm={onConfirm}
            onDecline={onDecline}
            onDirectRespond={onDirectRespond}
            commitNext={commitNext}
            loading={loading}
            disabled={disabled}
            caption={caption}
          />
        </div>
      )}
    </div>
  );
}
