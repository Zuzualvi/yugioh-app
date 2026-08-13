/**
 * playerCancelExists — what the PLAYER may press. NOT what the client may send.
 *
 * This is the ONLY module in the prototype permitted to read `cancelable`, and it
 * is a separate file so the import graph makes the separation visible. PRD A2
 * forbids cancelability as a test for whether the client may answer on the
 * player's behalf; it says nothing about whether to draw a cancel button for a
 * person, which is exactly what this decides.
 *
 * The one that matters: `SelectZone` has no cancel response in the protocol at all
 * (`RSelectZone.indices` is not nullable) and runtime-facts Q4 records that sending
 * one hangs the engine. That, not the deleted clock, is why the commit point is drawn.
 */
import type { DuelDecision } from "./types";

export function playerCancelExists(d: DuelDecision): boolean {
  switch (d.kind) {
    case "SelectCard":
    case "SelectTribute":
      return d.cancelable;
    case "SelectUnselectCard":
      return true;
    case "SortChain":
    case "SortCard":
      return true; // order: null = accept the default order, a real answer
    default:
      return false;
  }
}
