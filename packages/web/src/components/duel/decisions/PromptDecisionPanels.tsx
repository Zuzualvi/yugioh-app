/**
 * PromptDecisionPanels — sub-dispatcher for Slice 2D panel kinds.
 *
 * Handles: SelectEffectYN, SelectYesNo, SelectOption,
 *          AnnounceRace, AnnounceAttrib, AnnounceCard, AnnounceNumber.
 *
 * Switch is exhaustive over the seven kinds; returns null for anything else
 * (DecisionDispatcher handles remaining kinds via GenericDecisionPanel).
 *
 * NO casts — each branch narrows via the switch discriminant.
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";

import SelectEffectYNPanel from "./SelectEffectYNPanel";
import SelectYesNoPanel from "./SelectYesNoPanel";
import SelectOptionPanel from "./SelectOptionPanel";
import AnnounceRacePanel from "./AnnounceRacePanel";
import AnnounceAttribPanel from "./AnnounceAttribPanel";
import AnnounceCardPanel from "./AnnounceCardPanel";
import AnnounceNumberPanel from "./AnnounceNumberPanel";

// ── Union of kinds this sub-dispatcher handles ────────────────────────────────

type Slice2DKind =
  | "SelectEffectYN"
  | "SelectYesNo"
  | "SelectOption"
  | "AnnounceRace"
  | "AnnounceAttrib"
  | "AnnounceCard"
  | "AnnounceNumber";

type Slice2DDecision = Extract<DuelDecision, { kind: Slice2DKind }>;
type Slice2DResponse = Extract<DuelDecisionResponse, { kind: Slice2DKind }>;

export interface PromptDecisionPanelsProps {
  decision: Slice2DDecision;
  respond: (response: Slice2DResponse) => void;
  layoutTier: "phone" | "tablet" | "desktop";
  disabled?: boolean;
}

// ── Sub-dispatcher ────────────────────────────────────────────────────────────

export function PromptDecisionPanels({
  decision,
  respond,
  layoutTier,
  disabled,
}: PromptDecisionPanelsProps): JSX.Element | null {
  switch (decision.kind) {
    case "SelectEffectYN":
      return (
        <SelectEffectYNPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectYesNo":
      return (
        <SelectYesNoPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectOption":
      return (
        <SelectOptionPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "AnnounceRace":
      return (
        <AnnounceRacePanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "AnnounceAttrib":
      return (
        <AnnounceAttribPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "AnnounceCard":
      return (
        <AnnounceCardPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "AnnounceNumber":
      return (
        <AnnounceNumberPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    default: {
      // Exhaustive check — TypeScript will error here if a case is missing
      const _exhaustive: never = decision;
      void _exhaustive;
      return null;
    }
  }
}
