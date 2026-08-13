/**
 * classify.ts — THE DECISION CLASSIFICATION LAW.
 *
 * This module is the whole fix for the defect that made the shipped duel
 * unwinnable. Read `docs 01-object-model.md §3` for the argument; this file is
 * the argument as code.
 *
 * ── PRD A2, THE INVARIANT ────────────────────────────────────────────────────
 * A decision's cancelability MUST NOT be used, alone or in combination, as the
 * test for whether the client may answer it on the player's behalf.
 *
 * The identifier `cancelable` does not appear anywhere in this file — the one
 * legitimate reader of it lives in `playerCancelExists.ts`, which decides what
 * the PLAYER may press and never what the CLIENT may send. A source-level test
 * asserts the separation (CC-A1). The shipped build classified
 * "mandatory" as "has no decline path"; ocgcore marks attack-target selection
 * cancelable, so declaring an attack answered itself with a decline and the
 * attack silently evaporated.
 *
 * ── The two classes ─────────────────────────────────────────────────────────
 * OFFER — the engine is asking whether you want to act. Declining is a
 *         substantive answer with consequences. Always presented, unless the
 *         variant's own fields prove exactly one answer exists.
 * STEP  — the decision parameterises something the player already started.
 *         Declining ABORTS the player's intent, so the client may never send a
 *         decline for one (PRD A3). It may answer a STEP without presenting it
 *         only where exactly one substantive answer exists.
 *
 * "Substantive answer" = an answer that is not an abort of the player's own
 * intent. That reading is what makes A1, A2, A3 and A5 consistent.
 */
import type { DecisionKind, DuelDecision } from "./types";

export type DecisionClass = "OFFER" | "STEP";

/** Static, per variant, for all 20. Never consults the decision's payload. */
export const DECISION_CLASS: Record<DecisionKind, DecisionClass> = {
  IdleCommand: "OFFER",
  BattleCommand: "OFFER",
  ChainPrompt: "OFFER",
  SelectEffectYN: "OFFER",
  SelectYesNo: "OFFER",
  SelectOption: "OFFER",
  SelectCard: "STEP",
  SelectTribute: "STEP",
  SelectZone: "STEP",
  SelectPosition: "STEP",
  SelectUnselectCard: "STEP",
  AnnounceRace: "STEP",
  AnnounceAttrib: "STEP",
  AnnounceCard: "STEP",
  AnnounceNumber: "STEP",
  SortChain: "STEP",
  SortCard: "STEP",
  SelectCounter: "STEP",
  SelectSum: "STEP",
  SelectDisfield: "STEP",
};

/**
 * How many SUBSTANTIVE answers this decision has, counted from the decision's
 * own fields. Aborts are never counted. `Infinity` means "more than one, and we
 * are not going to enumerate them" — the answer is the same either way: present it.
 */
export function substantiveAnswerCount(d: DuelDecision): number {
  switch (d.kind) {
    // OFFERS — declining is itself a substantive answer, so an offer with N
    // candidates has N+1 answers. The only single-answer offer is a forced
    // chain prompt with one candidate: there is nothing to decline.
    case "ChainPrompt":
      return d.forced ? d.selects.length : d.selects.length + 1;
    case "SelectOption":
      return d.options.length;
    case "SelectEffectYN":
    case "SelectYesNo":
      return 2;
    case "IdleCommand":
      return (
        d.summons.length +
        d.specialSummons.length +
        d.posChanges.length +
        d.monsterSets.length +
        d.spellSets.length +
        d.activates.length +
        (d.toBattlePhase ? 1 : 0) +
        (d.toEndPhase ? 1 : 0)
      );
    case "BattleCommand":
      return (
        d.chains.length + d.attacks.length + (d.toMainPhase2 ? 1 : 0) + (d.toEndPhase ? 1 : 0)
      );

    // STEPS — the abort is not an answer.
    case "SelectCard":
    case "SelectTribute":
      return d.min === d.max && d.max === d.cards.length ? 1 : Infinity;
    case "SelectZone":
      return d.zones.length;
    case "SelectDisfield":
      return d.zones.length === d.count ? 1 : Infinity;
    case "SelectPosition":
      return d.positions.length;
    case "SelectUnselectCard":
      return Infinity;
    case "AnnounceRace":
    case "AnnounceAttrib":
      return d.count === 1 && d.available.length === 1 ? 1 : Infinity;
    case "AnnounceNumber":
      return d.options.length;
    case "AnnounceCard":
      return Infinity;
    case "SortChain":
    case "SortCard":
      return d.cards.length <= 1 ? 1 : Infinity;
    case "SelectCounter":
      return Infinity;
    case "SelectSum":
      return Infinity;
  }
}

/**
 * PRD A1: the client answers a decision without presenting it ONLY where exactly
 * one legal answer exists. Everything else is presented.
 *
 * PRD A5 falls out: attack-target selection is a `SelectCard` STEP; with more
 * than one legal target `substantiveAnswerCount` is Infinity, so it is presented.
 */
export function mayAnswerWithoutAsking(d: DuelDecision): boolean {
  return substantiveAnswerCount(d) === 1;
}

/**
 * The single answer, when there is exactly one. Never an abort — PRD A3. If this
 * would have to produce a decline/cancel to satisfy the caller, it throws
 * instead, because a silent decline is the shipped defect.
 */
export function theOnlyAnswer(d: DuelDecision): DecisionResponse {
  if (!mayAnswerWithoutAsking(d)) throw new Error(`not a single-answer decision: ${d.kind}`);
  switch (d.kind) {
    case "ChainPrompt":
      return { kind: "ChainPrompt", index: 0 };
    case "SelectOption":
      return { kind: "SelectOption", index: 0 };
    case "SelectCard":
      return { kind: "SelectCard", indices: d.cards.map((_, i) => i) };
    case "SelectTribute":
      return { kind: "SelectTribute", indices: d.cards.map((_, i) => i) };
    case "SelectZone":
      return { kind: "SelectZone", indices: [0] };
    case "SelectDisfield":
      return { kind: "SelectDisfield", indices: d.zones.map((_, i) => i) };
    case "SelectPosition":
      return { kind: "SelectPosition", position: d.positions[0]! };
    case "AnnounceRace":
      return { kind: "AnnounceRace", races: [d.available[0]!] };
    case "AnnounceAttrib":
      return { kind: "AnnounceAttrib", attributes: [d.available[0]!] };
    case "AnnounceNumber":
      return { kind: "AnnounceNumber", valueIndex: 0 };
    case "SortChain":
      return { kind: "SortChain", order: null };
    case "SortCard":
      return { kind: "SortCard", order: null };
    default:
      throw new Error(`no single answer defined for ${d.kind}`);
  }
}

export type DecisionResponse =
  | { kind: "IdleCommand"; action: string; index: number | null }
  | { kind: "BattleCommand"; action: string; index: number | null }
  | { kind: "ChainPrompt"; index: number | null }
  | { kind: "SelectEffectYN"; yes: boolean }
  | { kind: "SelectYesNo"; yes: boolean }
  | { kind: "SelectOption"; index: number }
  | { kind: "SelectCard"; indices: number[] | null }
  | { kind: "SelectTribute"; indices: number[] | null }
  | { kind: "SelectZone"; indices: number[] }
  | { kind: "SelectPosition"; position: number }
  | { kind: "SelectUnselectCard"; index: number | null }
  | { kind: "AnnounceRace"; races: string[] }
  | { kind: "AnnounceAttrib"; attributes: string[] }
  | { kind: "AnnounceCard"; code: number }
  | { kind: "AnnounceNumber"; valueIndex: number }
  | { kind: "SortChain"; order: number[] | null }
  | { kind: "SortCard"; order: number[] | null }
  | { kind: "SelectCounter"; counters: number[] }
  | { kind: "SelectSum"; indices: number[] }
  | { kind: "SelectDisfield"; indices: number[] };

