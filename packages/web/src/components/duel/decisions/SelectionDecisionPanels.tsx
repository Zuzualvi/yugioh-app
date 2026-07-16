/**
 * SelectionDecisionPanels — sub-dispatcher for Slice 2C selection/targeting kinds.
 *
 * Switch on decision.kind → matching panel with proper TypeScript narrowing.
 * No casts. Returns null for any kind not in this group (caller guard).
 *
 * Kinds handled here:
 *   SelectCard | SelectUnselectCard | SelectTribute | SelectZone | SelectPosition
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import type { DecisionPanelProps } from "./DecisionPanelProps";
import SelectCardPanel from "./SelectCardPanel";
import SelectUnselectCardPanel from "./SelectUnselectCardPanel";
import SelectTributePanel from "./SelectTributePanel";
import SelectZonePanel from "./SelectZonePanel";
import SelectPositionPanel from "./SelectPositionPanel";

type SelectionKind =
  "SelectCard" | "SelectUnselectCard" | "SelectTribute" | "SelectZone" | "SelectPosition";

type SelectionDecision = Extract<DuelDecision, { kind: SelectionKind }>;
type SelectionResponse = Extract<DuelDecisionResponse, { kind: SelectionKind }>;

interface Props {
  decision: SelectionDecision;
  respond: (response: SelectionResponse) => void;
  layoutTier: DecisionPanelProps<"SelectCard">["layoutTier"];
  disabled?: boolean;
}

export function SelectionDecisionPanels({
  decision,
  respond,
  layoutTier,
  disabled,
}: Props): React.JSX.Element | null {
  switch (decision.kind) {
    case "SelectCard":
      return (
        <SelectCardPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectUnselectCard":
      return (
        <SelectUnselectCardPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectTribute":
      return (
        <SelectTributePanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectZone":
      return (
        <SelectZonePanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectPosition":
      return (
        <SelectPositionPanel
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );
  }
}
