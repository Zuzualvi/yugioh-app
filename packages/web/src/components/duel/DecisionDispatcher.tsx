/**
 * DecisionDispatcher — switches on DuelDecision.kind and renders the correct panel.
 *
 * ## Kind → file naming convention
 *
 *   packages/web/src/components/duel/decisions/<Kind>Panel.tsx
 *
 * Where <Kind> is the exact DuelDecision.kind literal, PascalCase, e.g.:
 *   IdleCommand       → decisions/IdleCommandPanel.tsx       (Slice 2B)
 *   BattleCommand     → decisions/BattleCommandPanel.tsx     (Slice 2B)
 *   ChainPrompt       → decisions/ChainPromptPanel.tsx       (Slice 2B)
 *   SelectCard        → decisions/SelectCardPanel.tsx        (Slice 2C)
 *   SelectUnselectCard → decisions/SelectUnselectCardPanel.tsx (Slice 2C)
 *   SelectTribute     → decisions/SelectTributePanel.tsx     (Slice 2C)
 *   SelectZone        → decisions/SelectZonePanel.tsx        (Slice 2C)
 *   SelectPosition    → decisions/SelectPositionPanel.tsx    (Slice 2C)
 *   SelectEffectYN    → decisions/SelectEffectYNPanel.tsx    (Slice 2D)
 *   SelectYesNo       → decisions/SelectYesNoPanel.tsx       (Slice 2D)
 *   SelectOption      → decisions/SelectOptionPanel.tsx      (Slice 2D)
 *   AnnounceRace      → decisions/AnnounceRacePanel.tsx      (Slice 2D)
 *   AnnounceAttrib    → decisions/AnnounceAttribPanel.tsx    (Slice 2D)
 *   AnnounceCard      → decisions/AnnounceCardPanel.tsx      (Slice 2D)
 *   AnnounceNumber    → decisions/AnnounceNumberPanel.tsx    (Slice 2D)
 *
 * ## Rare kinds (permanent home — GenericDecisionPanel, no bespoke panel needed)
 *   SelectSum / SelectCounter / SelectDisfield / SortCard / SortChain
 *
 * ## Adding a per-kind panel (2B/2C/2D pattern)
 *   1. Create `decisions/<Kind>Panel.tsx` — default-exports component typed as
 *      `DecisionPanelProps<"Kind">` (import from `./DecisionPanelProps`).
 *   2. Import it here and add a `case "<Kind>":` route below.
 *   3. Remove the `<Kind>` case from the GenericDecisionPanel fallback section only
 *      when the new panel has matching test coverage.
 *
 * ## Layout containers
 *   - Phone/tablet (≤ 1023 px): panel content is rendered inside DecisionBottomSheet.
 *   - Desktop (≥ 1024 px): panel content is rendered inside ActionContextMenu or inline.
 *   The dispatcher renders ONLY the inner panel content; the shell (sheet/menu) is owned
 *   by the parent (ActionPanel / DuelBoard).
 */

import React from "react";
import type { DuelDecision, DuelDecisionResponse } from "@yugioh-app/contracts";
import { CommandDecisionPanels } from "./decisions/CommandDecisionPanels";
import { SelectionDecisionPanels } from "./decisions/SelectionDecisionPanels";
import { PromptDecisionPanels } from "./decisions/PromptDecisionPanels";
import { GenericDecisionPanel } from "./decisions/GenericDecisionPanel";

interface Props {
  decision: DuelDecision;
  respond: (r: DuelDecisionResponse) => void;
  layoutTier: "phone" | "tablet" | "desktop";
  disabled?: boolean;
}

export function DecisionDispatcher({ decision, respond, layoutTier, disabled }: Props) {
  switch (decision.kind) {
    // Command group — three separate cases so TypeScript narrows decision to
    // exactly one kind per branch, matching CommandDecisionPanelsProps union.
    // respond is passed directly: (r: DuelDecisionResponse)=>void is contravariantly
    // assignable to (r: IdleCommandResponse|BattleCommandResponse|ChainPromptResponse)=>void.
    case "IdleCommand":
      return (
        <CommandDecisionPanels
          decision={decision}
          respond={respond}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );
    case "BattleCommand":
      return (
        <CommandDecisionPanels
          decision={decision}
          respond={respond}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );
    case "ChainPrompt":
      return (
        <CommandDecisionPanels
          decision={decision}
          respond={respond}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectCard":
    case "SelectUnselectCard":
    case "SelectTribute":
    case "SelectZone":
    case "SelectPosition":
      return (
        <SelectionDecisionPanels
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    case "SelectEffectYN":
    case "SelectYesNo":
    case "SelectOption":
    case "AnnounceRace":
    case "AnnounceAttrib":
    case "AnnounceCard":
    case "AnnounceNumber":
      return (
        <PromptDecisionPanels
          decision={decision}
          respond={(r) => respond(r)}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );

    default:
      // SelectSum, SelectCounter, SelectDisfield, SortCard, SortChain
      return (
        <GenericDecisionPanel
          decision={decision}
          respond={respond}
          layoutTier={layoutTier}
          disabled={disabled}
        />
      );
  }
}
