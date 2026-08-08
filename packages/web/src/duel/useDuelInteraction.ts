/**
 * useDuelInteraction — the W2-owned interaction state machine.
 *
 * Publishes DuelInteraction to every slice. Called by DuelStage (via DuelDock).
 *
 * Key invariants:
 *   - intent MUST NOT be cleared by a STATE frame (B2).
 *   - selection is cleared on every new DECISION frame.
 *   - chain is built from event MSG types, not from the decision variant.
 *   - mode === "answer" only for decision kinds that are not IdleCommand/BattleCommand.
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §1, contracts.ts DuelInteraction.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { DuelDecision, DuelDecisionResponse, DuelEvent, Seat } from "@yugioh-app/contracts";
import type {
  AutoAnswerReceipt,
  CardRef,
  DuelInteraction,
  DuelMode,
  IntentStep,
  PendingIntent,
} from "./contracts";
import { autoAnswer, autoAnswerReason, autoAnswerSummary } from "./autoResolve";
import { chainFromEvents } from "./chainFromEvents";
import { shouldOfferWindow, getDeclineResponse } from "./responsePrompts";
import type { PromptLevel } from "./responsePrompts";

export interface DuelInteractionInput {
  decision: DuelDecision | null;
  mySeat: Seat;
  duelEnded: boolean;
  respond: (r: DuelDecisionResponse) => void;
  /** Preferences from ResponsePromptControl */
  prefs: { chooseZones: boolean };
  /** Full event feed — chain is derived from this. Required. */
  events: DuelEvent[];
  /** Response prompt level from ResponsePromptControl. Required. */
  promptLevel: PromptLevel;
}

export interface DuelInteractionOutput extends DuelInteraction {
  /** Current prefs, for passing down to ResponsePromptControl */
  prefs: { chooseZones: boolean };
  /** Toggle a candidate in selection */
  toggleSelection: (ref: CardRef) => void;
  /** Submit the current selection as a confirm response */
  confirm: () => void;
  /** Submit a decline/pass response */
  decline: () => void;
  /** Cancel the whole intent (maps to the current step's cancel) */
  cancelIntent: () => void;
}

// ── Step templates (client-owned; the engine does not announce step counts) ──

interface IntentTemplate {
  label: string;
  steps: string[];
  /**
   * Index of the first non-cancelable step (the commit point).
   * -1 means the whole intent is cancelable.
   */
  commitStep: number;
  /** True when a trailing trigger step may or may not fire */
  trailingUnknown: boolean;
}

function intentTemplate(d: DuelDecision): IntentTemplate | null {
  switch (d.kind) {
    case "IdleCommand":
    case "BattleCommand":
      return null; // ACT mode; no ribbon needed
    case "SelectTribute":
      // Tributes → Zone → Position (commit at Zone = index 1)
      return {
        label: `Tribute Summoning`,
        steps: ["Tributes", "Zone", "Position"],
        commitStep: 1,
        trailingUnknown: true, // opponent may respond
      };
    case "SelectZone":
      return {
        label: `Placing card`,
        steps: ["Zone"],
        commitStep: 0, // SelectZone is uncancelable
        trailingUnknown: false,
      };
    case "SelectPosition":
      return {
        label: `Choosing position`,
        steps: ["Position"],
        commitStep: -1,
        trailingUnknown: false,
      };
    case "SelectCard":
      return {
        label: `Selecting`,
        steps: ["Card"],
        commitStep: -1,
        trailingUnknown: false,
      };
    case "SelectUnselectCard":
      return {
        label: `Selecting materials`,
        steps: ["Materials"],
        commitStep: -1,
        trailingUnknown: false,
      };
    case "ChainPrompt":
      return {
        label: `Chain response`,
        steps: ["Respond"],
        commitStep: -1,
        trailingUnknown: false,
      };
    default:
      return null;
  }
}

// ── Derive candidates from a decision ───────────────────────────────────────

function candidatesFromDecision(d: DuelDecision): CardRef[] {
  const refs: CardRef[] = [];

  const pushCard = (c: { controller: Seat; location: string; sequence: number }) => {
    refs.push({
      controller: c.controller as Seat,
      location: c.location as CardRef["location"],
      sequence: c.sequence,
    });
  };

  switch (d.kind) {
    case "SelectCard":
      d.cards.forEach(pushCard);
      break;
    case "SelectTribute":
      d.cards.forEach(pushCard);
      break;
    case "SelectUnselectCard":
      d.selectCards.forEach(pushCard);
      d.unselectCards.forEach(pushCard);
      break;
    case "ChainPrompt":
      d.selects.forEach(pushCard);
      break;
    case "SelectEffectYN":
      pushCard(d.card);
      break;
    case "SelectPosition":
      pushCard(d.card);
      break;
    default:
      break;
  }

  return refs;
}

// ── State machine hook ───────────────────────────────────────────────────────

export function useDuelInteraction({
  decision,
  mySeat,
  duelEnded,
  respond,
  prefs: externalPrefs,
  events,
  promptLevel,
}: DuelInteractionInput): DuelInteractionOutput {
  const prefs = useMemo(
    () => ({ chooseZones: externalPrefs.chooseZones }),
    [externalPrefs.chooseZones],
  );
  const [intent, setIntent] = useState<PendingIntent | null>(null);
  const [selection, setSelection] = useState<CardRef[]>([]);
  const [receipts, setReceipts] = useState<AutoAnswerReceipt[]>([]);
  // chain derives from the event feed — no useState (C4a)
  const chain = useMemo(() => chainFromEvents(events), [events]);
  // Track if we're waiting for the server's response (between confirm and next frame)
  const [loading, setLoading] = useState(false);

  const intentIdRef = useRef(0);
  const receiptIdRef = useRef(0);
  const uniqueBase = useId();

  // ── Auto-resolve check on new decision ─────────────────────────────────────
  useEffect(() => {
    if (!decision) {
      // STATE arrived — clear loading indicator and selection, but NOT intent (B2).
      setLoading(false);
      setSelection([]);
      return;
    }

    if (decision.kind === "IdleCommand" || decision.kind === "BattleCommand") {
      // ACT mode — clear any lingering intent/receipts from a completed sequence.
      setIntent(null);
      setReceipts([]);
      setSelection([]);
      setLoading(false);
      return;
    }

    // Non-command decision: check if it should be auto-answered.
    const autoResp = autoAnswer(decision, prefs);
    if (autoResp !== null) {
      // Auto-answer: send immediately and create a receipt.
      const summary = autoAnswerSummary(decision, autoResp);
      const reason = autoAnswerReason(decision, prefs);
      const id = `${uniqueBase}-receipt-${receiptIdRef.current++}`;
      const receipt: AutoAnswerReceipt = {
        id,
        summary,
        reason,
        at: Date.now(),
      };
      setReceipts((prev) => [...prev, receipt]);
      respond(autoResp);

      // Auto-dismiss receipt after 240ms (or 2000ms in verbose mode — not yet implemented).
      setTimeout(() => {
        setReceipts((prev) => prev.filter((r) => r.id !== id));
      }, 240);
      return;
    }

    // Check whether the prompt level suppresses this window (C4b / §11).
    // Fail-safe: shouldOfferWindow returns true for anything it cannot classify.
    if (!shouldOfferWindow(decision, promptLevel)) {
      const declineResp = getDeclineResponse(decision);
      if (declineResp !== null) {
        // Respond with decline and write an AutoAnswerReceipt (requirement C9).
        const id = `${uniqueBase}-receipt-${receiptIdRef.current++}`;
        const receipt: AutoAnswerReceipt = {
          id,
          summary: "Window suppressed — response prompt level: " + promptLevel,
          reason: "only-one-legal-answer",
          at: Date.now(),
        };
        setReceipts((prev) => [...prev, receipt]);
        respond(declineResp);
        setTimeout(() => {
          setReceipts((prev) => prev.filter((r) => r.id !== id));
        }, 240);
        return;
      }
      // No decline path for this decision — fall through and offer to the player.
    }

    // Player must answer: clear selection for the new decision.
    setSelection([]);
    setLoading(false);

    // Create or advance intent.
    const tmpl = intentTemplate(decision);
    if (tmpl) {
      setIntent((prev) => {
        if (prev && prev.currentStep < prev.steps.length - 1) {
          // Advance existing intent to the next step.
          const nextStep = prev.currentStep + 1;
          const updatedSteps: IntentStep[] = prev.steps.map((s, i) =>
            i === nextStep ? { ...s, answered: undefined } : s,
          );
          return { ...prev, steps: updatedSteps, currentStep: nextStep };
        }
        // New intent.
        const id = `${uniqueBase}-intent-${intentIdRef.current++}`;
        const steps: IntentStep[] = tmpl.steps.map((label) => ({ label }));
        // Try to get the card name from the decision.
        let subject: CardRef = { controller: mySeat, location: "HAND", sequence: 0 };
        if (decision.kind === "SelectTribute" && decision.cards.length > 0) {
          const c = decision.cards[0]!;
          subject = {
            controller: c.controller as Seat,
            location: c.location as CardRef["location"],
            sequence: c.sequence,
          };
        } else if (decision.kind === "SelectPosition") {
          const c = decision.card;
          subject = {
            controller: c.controller as Seat,
            location: c.location as CardRef["location"],
            sequence: c.sequence,
          };
        }
        return {
          id,
          label: tmpl.label,
          subject,
          steps,
          currentStep: 0,
          commitStep: tmpl.commitStep,
          stepCountUncertain: tmpl.trailingUnknown,
        };
      });
    }
  }, [decision]); // prefs intentionally read at effect time without being a dep

  // ── Selection toggle ────────────────────────────────────────────────────────

  const toggleSelection = useCallback(
    (ref: CardRef) => {
      if (!decision) return;

      // Determine max from the decision.
      let max = 1;
      if (decision.kind === "SelectCard" || decision.kind === "SelectTribute") {
        max = decision.max;
      }

      setSelection((prev) => {
        const existing = prev.findIndex(
          (r) =>
            r.controller === ref.controller &&
            r.location === ref.location &&
            r.sequence === ref.sequence,
        );
        if (existing >= 0) {
          // Radio semantics (design spec §0a): when min === max === 1, the already-selected
          // card cannot be deselected — clicking it again is a no-op. Deselecting the only
          // option would disable the confirm button and dead-end the step.
          let min = 1;
          if (decision.kind === "SelectCard" || decision.kind === "SelectTribute") {
            min = decision.min;
          }
          if (min === 1 && max === 1) return prev; // no-op: radio, never toggle
          return prev.filter((_, i) => i !== existing);
        }
        if (prev.length >= max) {
          // At capacity: replace last selection (for single-select cases).
          if (max === 1) return [ref];
          return prev; // for multi-select: just ignore (player must deselect first)
        }
        return [...prev, ref];
      });
    },
    [decision],
  );

  // ── Confirm ──────────────────────────────────────────────────────────────────

  const confirm = useCallback(() => {
    if (!decision || loading) return;

    let response: DuelDecisionResponse | null = null;

    switch (decision.kind) {
      case "SelectCard": {
        const indices = selection
          .map((ref) =>
            decision.cards.findIndex(
              (c) =>
                c.controller === ref.controller &&
                c.location === ref.location &&
                c.sequence === ref.sequence,
            ),
          )
          .filter((i) => i >= 0);
        if (indices.length < decision.min) return; // not ready
        response = { kind: "SelectCard", indices };
        break;
      }
      case "SelectTribute": {
        const indices = selection
          .map((ref) =>
            decision.cards.findIndex(
              (c) =>
                c.controller === ref.controller &&
                c.location === ref.location &&
                c.sequence === ref.sequence,
            ),
          )
          .filter((i) => i >= 0);
        if (indices.length < decision.min) return;
        response = { kind: "SelectTribute", indices };
        break;
      }
      case "ChainPrompt": {
        if (selection.length === 0) return;
        const ref = selection[0]!;
        const index = decision.selects.findIndex(
          (c) =>
            c.controller === ref.controller &&
            c.location === ref.location &&
            c.sequence === ref.sequence,
        );
        if (index < 0) return;
        response = { kind: "ChainPrompt", index };
        break;
      }
      case "SelectEffectYN":
        response = { kind: "SelectEffectYN", yes: true };
        break;
      case "SelectYesNo":
        response = { kind: "SelectYesNo", yes: true };
        break;
      case "SelectOption": {
        if (selection.length === 0 && decision.options.length > 0) return;
        // SelectOption uses index, not CardRef — selection is index 0 to options.length-1
        // We abuse the CardRef.sequence field as the option index here.
        const idx = selection.length > 0 ? selection[0]!.sequence : 0;
        response = { kind: "SelectOption", index: idx };
        break;
      }
      case "SelectPosition": {
        // SelectPosition answers on click, not via confirm.
        // This path is here for completeness but should not normally be called.
        if (selection.length === 0) return;
        break;
      }
      case "SelectUnselectCard": {
        // SelectUnselectCard sends finish (index: null) when canFinish.
        if (!decision.canFinish) return;
        response = { kind: "SelectUnselectCard", index: null };
        break;
      }
      case "AnnounceRace": {
        // selection.sequence used as index into available.
        if (selection.length < decision.count) return;
        const races = selection.map((r) => decision.available[r.sequence]!);
        response = {
          kind: "AnnounceRace",
          races: races as typeof response extends { races: infer R } ? R : never,
        };
        break;
      }
      case "AnnounceAttrib": {
        if (selection.length < decision.count) return;
        const attributes = selection.map((r) => decision.available[r.sequence]!);
        response = {
          kind: "AnnounceAttrib",
          attributes: attributes as typeof response extends { attributes: infer A } ? A : never,
        };
        break;
      }
      default:
        return;
    }

    if (!response) return;

    setLoading(true);
    // Mark current intent step as answered.
    setIntent((prev) => {
      if (!prev) return prev;
      const updated = prev.steps.map((s, i) =>
        i === prev.currentStep ? { ...s, answered: { summary: "answered", auto: false } } : s,
      );
      return { ...prev, steps: updated };
    });
    respond(response);
  }, [decision, selection, loading, respond]);

  // ── Decline ──────────────────────────────────────────────────────────────────

  const decline = useCallback(() => {
    if (!decision || loading) return;

    let response: DuelDecisionResponse | null = null;

    switch (decision.kind) {
      case "SelectCard":
        if (!decision.cancelable) return;
        response = { kind: "SelectCard", indices: null };
        break;
      case "SelectTribute":
        if (!decision.cancelable) return;
        response = { kind: "SelectTribute", indices: null };
        break;
      case "ChainPrompt":
        if (decision.forced) return;
        response = { kind: "ChainPrompt", index: null };
        break;
      case "SelectEffectYN":
        response = { kind: "SelectEffectYN", yes: false };
        break;
      case "SelectYesNo":
        response = { kind: "SelectYesNo", yes: false };
        break;
      case "SelectUnselectCard":
        if (!decision.cancelable) return;
        response = { kind: "SelectUnselectCard", index: null };
        break;
      // SelectZone, SelectPosition, SelectDisfield — no cancel response.
      default:
        return;
    }

    if (!response) return;

    setLoading(true);
    setIntent(null);
    respond(response);
  }, [decision, loading, respond]);

  // ── Cancel intent ────────────────────────────────────────────────────────────

  const cancelIntent = useCallback(() => {
    // Cancel = decline the current step. Only valid pre-commit.
    decline();
  }, [decline]);

  // ── Derive mode ──────────────────────────────────────────────────────────────

  let mode: DuelMode;
  if (duelEnded) {
    mode = "ended";
  } else if (!decision) {
    mode = "waiting";
  } else if (decision.kind === "IdleCommand" || decision.kind === "BattleCommand") {
    mode = "act";
  } else {
    mode = "answer";
  }

  // ── Candidates ───────────────────────────────────────────────────────────────

  const candidates = decision ? candidatesFromDecision(decision) : [];

  // ── Status ───────────────────────────────────────────────────────────────────

  let status: string | null = null;
  if (loading) {
    status = "Sending…";
  } else if (mode === "waiting") {
    status = "Waiting for engine…";
  }

  return {
    mode,
    decision: decision ?? null,
    candidates,
    selection,
    intent,
    chain,
    receipts,
    status,
    prefs,
    toggleSelection,
    confirm,
    decline,
    cancelIntent,
  };
}
