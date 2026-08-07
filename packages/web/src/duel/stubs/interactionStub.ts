/**
 * W1 stub — DuelInteraction (consumed from W2).
 *
 * Returns `mode: "act"` with empty arrays so the entire board can be built
 * and tested before W2 ships the real state machine.
 *
 * DELETE this file and its import sites when the real W2 DuelInteraction lands
 * on the integration branch.
 */
import type { DuelInteraction } from "../contracts";

export const interactionStub: DuelInteraction = {
  mode: "act",
  decision: null,
  candidates: [],
  selection: [],
  intent: null,
  chain: [],
  receipts: [],
  status: null,
};
