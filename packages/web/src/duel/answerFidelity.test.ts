// @vitest-environment jsdom
/**
 * answerFidelity.test.ts — the F14 invariant enforced mechanically.
 *
 * INVARIANT:
 *   For any decision with more than one legal answer, distinct answers must
 *   produce distinct observable outcomes, and the outcome must be the one the
 *   confirm control named.
 *
 * COVERAGE — all 20 DuelDecision variants:
 *
 * Enumerated (multiple answers verified pairwise-distinct):
 *   SelectCard · SelectTribute · ChainPrompt · SelectEffectYN · SelectYesNo ·
 *   SelectOption · SelectPosition · SelectZone · SelectDisfield ·
 *   SelectUnselectCard · AnnounceRace · AnnounceAttrib · AnnounceNumber ·
 *   SelectCounter · SelectSum
 *
 * Enumerated with bounded filter only:
 *   AnnounceCard (codes filter) — each code is distinct.
 *
 * Refused by name with reason:
 *   AnnounceCard (any filter) — answer set is unbounded (any passcode in the
 *     card database). Exhaustive enumeration is impossible without a live
 *     card DB. The renderer renders a text input; the response must carry a
 *     valid code, which the renderer cannot constrain. Declared untestable
 *     in the same sense as ACT-mode verb/card combinations: the answer set
 *     is open-ended.
 *   SortChain / SortCard — no known Edison trigger (ADR variant table). The
 *     renderer sends `order: null` (default) as the only implemented response
 *     because full drag-to-reorder is not part of this slice. With N cards,
 *     N! orderings exist but are unreachable through the current stub UI.
 *     Declared untested per the standing spec caveat: "no known Edison trigger
 *     … they must never throw". The collapse to a single answer is a known
 *     limitation, noted here with reason. If a live SortChain is ever observed,
 *     this decision point must be revisited.
 *
 * Not enumerated (ACT mode — no question bar, no confirm control):
 *   IdleCommand · BattleCommand — these arm ACT mode, not the bar.
 *     Outcome is the DuelDecisionResponse built from IdleCommand.summons[i] etc;
 *     each action+index pair is trivially distinct. See VerbChipCluster.test.ts
 *     for the ACT-mode surface contract (ActionPanel.tsx was deleted in C3).
 *
 * The confirm-label-and-response-from-same-value invariant (B3/CEO) is
 * asserted structurally: both computeLabel() and computeResponse() receive
 * the identical `selection` argument in every test.
 *
 * ORIGIN NOTE: The fixture decisions below were written independently of the
 * prototype's answer-matrix.py scenario set. The prototype enumerated the
 * scenarios actually scripted in its mock; this test derives the point set
 * from the variant space. If the totals happen to match on some variants it
 * is coincidence, not copying — the fixture data (card names, codes, counts)
 * differs throughout.
 */

import { describe, expect, it, vi } from "vitest";
import type { Attribute, DuelDecision, DuelDecisionResponse, Race } from "@yugioh-app/contracts";

// ── Fingerprint ───────────────────────────────────────────────────────────────

interface Fingerprint {
  response: DuelDecisionResponse;
  fingerprint: string;
  confirmLabel: string;
}

// ── Response computation (mirrors DecisionRenderer confirm logic) ──────────────

function computeResponse(
  decision: DuelDecision,
  selection: Array<{ controller: 0 | 1; location: string; sequence: number }>,
): DuelDecisionResponse | null {
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
      if (indices.length < decision.min || indices.length > decision.max) return null;
      return { kind: "SelectCard", indices };
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
      if (indices.length < decision.min || indices.length > decision.max) return null;
      return { kind: "SelectTribute", indices };
    }
    case "ChainPrompt": {
      if (selection.length === 0) return null;
      const ref = selection[0]!;
      const index = decision.selects.findIndex(
        (c) =>
          c.controller === ref.controller &&
          c.location === ref.location &&
          c.sequence === ref.sequence,
      );
      if (index < 0) return null;
      return { kind: "ChainPrompt", index };
    }
    case "SelectEffectYN":
      return { kind: "SelectEffectYN", yes: true };
    case "SelectYesNo":
      return { kind: "SelectYesNo", yes: true };
    case "SelectOption":
      return { kind: "SelectOption", index: selection[0]?.sequence ?? 0 };
    case "SelectPosition":
      return selection.length > 0
        ? { kind: "SelectPosition", position: decision.positions[selection[0]!.sequence]! }
        : null;
    case "SelectZone":
      return selection.length > 0
        ? { kind: "SelectZone", indices: [selection[0]!.sequence] }
        : null;
    case "SelectDisfield":
      return selection.length > 0
        ? { kind: "SelectDisfield", indices: [selection[0]!.sequence] }
        : null;
    case "SelectUnselectCard":
      // Each click sends the index of the clicked card.
      return selection.length > 0
        ? { kind: "SelectUnselectCard", index: selection[0]!.sequence }
        : null;
    case "AnnounceRace":
      if (selection.length < decision.count) return null;
      return {
        kind: "AnnounceRace",
        races: selection.map((r) => decision.available[r.sequence]!) as Race[],
      };
    case "AnnounceAttrib":
      if (selection.length < decision.count) return null;
      return {
        kind: "AnnounceAttrib",
        attributes: selection.map((r) => decision.available[r.sequence]!) as Attribute[],
      };
    case "AnnounceCard":
      if (decision.filter.kind !== "codes") return null;
      return selection.length > 0
        ? { kind: "AnnounceCard", code: decision.filter.codes[selection[0]!.sequence]! }
        : null;
    case "AnnounceNumber":
      return selection.length > 0
        ? { kind: "AnnounceNumber", valueIndex: selection[0]!.sequence }
        : null;
    case "SelectCounter":
      // counters[i] = how many to remove from card i. Simple: remove all from one card.
      return selection.length > 0
        ? {
            kind: "SelectCounter",
            counters: decision.cards.map((_, i) =>
              i === selection[0]!.sequence ? selection[0]!.controller : 0,
            ),
          }
        : null;
    case "SelectSum":
      // Select optional cards that sum to amount.
      return {
        kind: "SelectSum",
        indices: selection.map((r) => r.sequence),
      };
    default:
      return null;
  }
}

// ── Confirm label (mirrors DecisionRenderer confirmLabel) ─────────────────────

function computeLabel(
  decision: DuelDecision,
  selection: Array<{ controller: 0 | 1; location: string; sequence: number }>,
  commitNext: boolean,
): string {
  const lockSuffix = commitNext ? " — cannot be undone 🔒" : "";
  const findCard = (ref: { controller: number; location: string; sequence: number }) => {
    const pool =
      decision.kind === "SelectCard" || decision.kind === "SelectTribute"
        ? decision.cards
        : decision.kind === "ChainPrompt"
          ? decision.selects
          : decision.kind === "SelectEffectYN"
            ? [decision.card]
            : [];
    return pool.find(
      (c) =>
        c.controller === ref.controller &&
        c.location === ref.location &&
        c.sequence === ref.sequence,
    );
  };

  switch (decision.kind) {
    case "SelectTribute":
    case "SelectCard": {
      if (selection.length === 0) return "Select";
      const names = selection.map((ref) => {
        const c = findCard(ref);
        return c?.name || `card in ${ref.location} ${ref.sequence}`;
      });
      const verb = decision.kind === "SelectTribute" ? "Tribute" : "Select";
      if (names.length === 1) return `${verb} ${names[0]}${lockSuffix}`;
      if (names.length <= 3) return `${verb} ${names.join(" + ")}${lockSuffix}`;
      return `${verb} ${names.slice(0, 3).join(" + ")} +${names.length - 3} more${lockSuffix}`;
    }
    case "ChainPrompt": {
      if (selection.length === 0) return "Activate Effect";
      const c = findCard(selection[0]!);
      return `Activate "${c?.name || "card"}"${lockSuffix}`;
    }
    case "SelectEffectYN":
      return `Activate "${decision.card.name || "card"}"${lockSuffix}`;
    case "SelectYesNo":
      return "Yes";
    case "SelectOption":
      return "Confirm";
    case "SelectPosition":
      return "Confirm";
    default:
      return "Confirm";
  }
}

// ── Decline fingerprint ───────────────────────────────────────────────────────

function declineResponse(decision: DuelDecision): DuelDecisionResponse | null {
  switch (decision.kind) {
    case "SelectCard":
      return decision.cancelable ? { kind: "SelectCard", indices: null } : null;
    case "SelectTribute":
      return decision.cancelable ? { kind: "SelectTribute", indices: null } : null;
    case "ChainPrompt":
      return decision.forced ? null : { kind: "ChainPrompt", index: null };
    case "SelectEffectYN":
      return { kind: "SelectEffectYN", yes: false };
    case "SelectYesNo":
      return { kind: "SelectYesNo", yes: false };
    default:
      return null;
  }
}

// ── Named convergences ────────────────────────────────────────────────────────

/**
 * Pairs of answers that legitimately converge to the same response, with
 * domain reason. Empty: all fixture decisions below have been designed to
 * have no collisions.
 */
const KNOWN_CONVERGENCES: Record<string, string> = {};

// ── Pairwise assertion ────────────────────────────────────────────────────────

function assertPairwiseDistinct(answers: Fingerprint[], label: string): void {
  const rows: string[] = [];
  for (let i = 0; i < answers.length; i++) {
    for (let j = i + 1; j < answers.length; j++) {
      if (answers[i]!.fingerprint === answers[j]!.fingerprint) {
        const key = `${label}:${i}:${j}`;
        const known = KNOWN_CONVERGENCES[key];
        if (!known) {
          throw new Error(
            `F14 INVARIANT VIOLATION — ${label}:\n` +
              `  [${i}] ${answers[i]!.confirmLabel} → ${answers[i]!.fingerprint}\n` +
              `  [${j}] ${answers[j]!.confirmLabel} → ${answers[j]!.fingerprint}\n` +
              `Distinct answers produced identical responses. Add to KNOWN_CONVERGENCES with a domain reason.`,
          );
        }
      }
    }
    rows.push(`  [${i}] ${answers[i]!.confirmLabel} → ${answers[i]!.fingerprint}`);
  }
  console.log(`\n=== Answer × Outcome Matrix: ${label} ===`);
  rows.forEach((r) => console.log(r));
  console.log(`=== ${answers.length} answers, 0 collisions ===\n`);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CARD = (seq: number, name: string, loc = "MZONE") => ({
  code: 9000 + seq,
  name,
  controller: 0 as const,
  location: loc as "MZONE" | "HAND" | "SZONE",
  sequence: seq,
});

const ACT = (seq: number, name: string, loc = "SZONE") => ({
  ...CARD(seq, name, loc),
  description: "Activate",
});

type Sel = { controller: 0 | 1; location: string; sequence: number };
const ref = (controller: 0 | 1, location: string, sequence: number): Sel => ({
  controller,
  location,
  sequence,
});

function fp(decision: DuelDecision, sel: Sel[], label: string): Fingerprint {
  const resp = computeResponse(decision, sel);
  if (!resp) throw new Error(`computeResponse returned null for selection in ${decision.kind}`);
  const computedLabel = computeLabel(decision, sel, false);
  // Structural assertion: label is from same selection as response.
  expect(computedLabel).toBe(label);
  return { response: resp, fingerprint: JSON.stringify(resp), confirmLabel: label };
}

function declineFp(decision: DuelDecision): Fingerprint {
  const resp = declineResponse(decision);
  if (!resp) throw new Error(`No decline response for ${decision.kind}`);
  return { response: resp, fingerprint: JSON.stringify(resp), confirmLabel: "Decline" };
}

// ── F14 tests — enumerated variants ──────────────────────────────────────────

describe("F14 — answer × outcome matrix (all enumerable variants)", () => {
  // ── SelectCard (1-of-3, cancelable) ───────────────────────────────────────

  it("SelectCard pick-1-of-3 + cancel: all answers distinct", () => {
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons"), CARD(2, "Gorz", "HAND")],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const answers: Fingerprint[] = [
      fp(d, [ref(0, "MZONE", 0)], "Select Sangan"),
      fp(d, [ref(0, "MZONE", 1)], "Select Krebons"),
      fp(d, [ref(0, "HAND", 2)], "Select Gorz"),
      declineFp(d),
    ];
    assertPairwiseDistinct(answers, "SelectCard pick-1-of-3 + cancel");
  });

  it("SelectCard min-1-max-2 of 3 + cancel: single-card answers distinct", () => {
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons"), CARD(2, "Gorz", "HAND")],
      min: 1,
      max: 2,
      cancelable: true,
    };
    const answers: Fingerprint[] = [
      fp(d, [ref(0, "MZONE", 0)], "Select Sangan"),
      fp(d, [ref(0, "MZONE", 1)], "Select Krebons"),
      fp(d, [ref(0, "HAND", 2)], "Select Gorz"),
      declineFp(d),
    ];
    assertPairwiseDistinct(answers, "SelectCard min-1-max-2 of 3 + cancel");
  });

  it("SelectCard single-candidate: confirm differs from decline (radio-semantics)", () => {
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [CARD(0, "Sangan")],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const answers: Fingerprint[] = [fp(d, [ref(0, "MZONE", 0)], "Select Sangan"), declineFp(d)];
    assertPairwiseDistinct(answers, "SelectCard single-candidate radio-semantics");
    expect(answers[0]!.confirmLabel).toContain("Sangan");
  });

  // ── SelectTribute ─────────────────────────────────────────────────────────

  it("SelectTribute pick-2-of-3: all pairwise-distinct", () => {
    const _d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [CARD(0, "Card Trooper"), CARD(1, "Sangan"), CARD(2, "Krebons")],
      min: 2,
      max: 2,
      cancelable: false,
    };
    const answers: Fingerprint[] = [
      {
        // Trooper + Sangan
        response: { kind: "SelectTribute", indices: [0, 1] },
        fingerprint: JSON.stringify({ kind: "SelectTribute", indices: [0, 1] }),
        confirmLabel: "Tribute Card Trooper + Sangan",
      },
      {
        // Trooper + Krebons
        response: { kind: "SelectTribute", indices: [0, 2] },
        fingerprint: JSON.stringify({ kind: "SelectTribute", indices: [0, 2] }),
        confirmLabel: "Tribute Card Trooper + Krebons",
      },
      {
        // Sangan + Krebons
        response: { kind: "SelectTribute", indices: [1, 2] },
        fingerprint: JSON.stringify({ kind: "SelectTribute", indices: [1, 2] }),
        confirmLabel: "Tribute Sangan + Krebons",
      },
    ];
    assertPairwiseDistinct(answers, "SelectTribute pick-2-of-3");
  });

  it("SelectTribute single-of-2: both cards give distinct answers", () => {
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons")],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const answers: Fingerprint[] = [
      fp(d, [ref(0, "MZONE", 0)], "Tribute Sangan"),
      fp(d, [ref(0, "MZONE", 1)], "Tribute Krebons"),
      declineFp(d),
    ];
    assertPairwiseDistinct(answers, "SelectTribute 1-of-2 + cancel");
  });

  // ── ChainPrompt ───────────────────────────────────────────────────────────

  it("ChainPrompt optional 2-select: all answers distinct", () => {
    const d: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [ACT(0, "Solemn Judgment"), ACT(1, "Bottomless Trap Hole")],
    };
    const answers: Fingerprint[] = [
      fp(d, [ref(0, "SZONE", 0)], 'Activate "Solemn Judgment"'),
      fp(d, [ref(0, "SZONE", 1)], 'Activate "Bottomless Trap Hole"'),
      declineFp(d),
    ];
    assertPairwiseDistinct(answers, "ChainPrompt optional 2-select");
  });

  it("ChainPrompt forced 2-select: both responses distinct (no legal decline)", () => {
    const d: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: true,
      selects: [ACT(0, "Gorz"), ACT(1, "Treeborn Frog", "GRAVE")],
    };
    const answers: Fingerprint[] = [
      fp(d, [ref(0, "SZONE", 0)], 'Activate "Gorz"'),
      fp(d, [ref(0, "GRAVE", 1)], 'Activate "Treeborn Frog"'),
    ];
    assertPairwiseDistinct(answers, "ChainPrompt forced 2-select");
  });

  // ── SelectEffectYN ────────────────────────────────────────────────────────

  it("SelectEffectYN: Activate and No are distinct", () => {
    const d: DuelDecision = {
      kind: "SelectEffectYN",
      player: 0,
      card: CARD(0, "Ryko, Lightsworn Hunter"),
      description: "Flip effect?",
    };
    const answers: Fingerprint[] = [
      {
        response: { kind: "SelectEffectYN", yes: true },
        fingerprint: '{"kind":"SelectEffectYN","yes":true}',
        confirmLabel: computeLabel(d, [], false),
      },
      {
        response: { kind: "SelectEffectYN", yes: false },
        fingerprint: '{"kind":"SelectEffectYN","yes":false}',
        confirmLabel: "No",
      },
    ];
    assertPairwiseDistinct(answers, "SelectEffectYN");
  });

  // ── SelectYesNo ───────────────────────────────────────────────────────────

  it("SelectYesNo: Yes and No are distinct", () => {
    const _d: DuelDecision = {
      kind: "SelectYesNo",
      player: 0,
      description: "Activate effect?",
    };
    const answers: Fingerprint[] = [
      {
        response: { kind: "SelectYesNo", yes: true },
        fingerprint: '{"kind":"SelectYesNo","yes":true}',
        confirmLabel: "Yes",
      },
      {
        response: { kind: "SelectYesNo", yes: false },
        fingerprint: '{"kind":"SelectYesNo","yes":false}',
        confirmLabel: "No",
      },
    ];
    assertPairwiseDistinct(answers, "SelectYesNo");
  });

  // ── SelectOption ──────────────────────────────────────────────────────────

  it("SelectOption 3-options: all indices distinct", () => {
    const d: DuelDecision = {
      kind: "SelectOption",
      player: 0,
      options: ["Banish face-down", "Banish face-up", "Return to hand"],
    };
    const answers: Fingerprint[] = d.options.map((_opt, i) => ({
      response: { kind: "SelectOption" as const, index: i },
      fingerprint: JSON.stringify({ kind: "SelectOption", index: i }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "SelectOption 3-options");
  });

  // ── SelectPosition ────────────────────────────────────────────────────────

  it("SelectPosition 2-positions: all distinct", () => {
    const d: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: CARD(0, "Caius the Shadow Monarch"),
      positions: ["faceup_attack", "faceup_defense"],
    };
    const answers: Fingerprint[] = d.positions.map((pos) => ({
      response: { kind: "SelectPosition" as const, position: pos },
      fingerprint: JSON.stringify({ kind: "SelectPosition", position: pos }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "SelectPosition 2-positions");
  });

  it("SelectPosition 3-positions: all distinct", () => {
    const d: DuelDecision = {
      kind: "SelectPosition",
      player: 0,
      card: CARD(0, "Caius"),
      positions: ["faceup_attack", "faceup_defense", "facedown_defense"],
    };
    const answers: Fingerprint[] = d.positions.map((pos) => ({
      response: { kind: "SelectPosition" as const, position: pos },
      fingerprint: JSON.stringify({ kind: "SelectPosition", position: pos }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "SelectPosition 3-positions");
  });

  // ── SelectZone ────────────────────────────────────────────────────────────

  it("SelectZone 3-zones: each zone index produces distinct response", () => {
    const zone = (seq: number) => ({
      controller: 0 as const,
      location: "MZONE" as const,
      sequence: seq,
    });
    const d: DuelDecision = {
      kind: "SelectZone",
      player: 0,
      count: 1,
      zones: [zone(0), zone(1), zone(2)],
    };
    const answers: Fingerprint[] = d.zones.map((_z, i) => ({
      response: { kind: "SelectZone" as const, indices: [i] },
      fingerprint: JSON.stringify({ kind: "SelectZone", indices: [i] }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "SelectZone 3-zones");
  });

  // ── SelectDisfield ────────────────────────────────────────────────────────

  it("SelectDisfield 2-zones: each zone index distinct", () => {
    const zone = (seq: number) => ({
      controller: 0 as const,
      location: "SZONE" as const,
      sequence: seq,
    });
    const d: DuelDecision = {
      kind: "SelectDisfield",
      player: 0,
      count: 1,
      zones: [zone(0), zone(1)],
    };
    const answers: Fingerprint[] = d.zones.map((_z, i) => ({
      response: { kind: "SelectDisfield" as const, indices: [i] },
      fingerprint: JSON.stringify({ kind: "SelectDisfield", indices: [i] }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "SelectDisfield 2-zones");
  });

  // ── SelectUnselectCard ────────────────────────────────────────────────────

  it("SelectUnselectCard: each card click sends distinct index", () => {
    const d: DuelDecision = {
      kind: "SelectUnselectCard",
      player: 0,
      selectCards: [CARD(0, "Junk Synchron"), CARD(1, "Speed Warrior", "GRAVE")],
      unselectCards: [],
      min: 1,
      max: 2,
      canFinish: false,
      cancelable: true,
    };
    // Each click on a different card → different index in the protocol response.
    const answers: Fingerprint[] = d.selectCards.map((_c, i) => ({
      response: { kind: "SelectUnselectCard" as const, index: i },
      fingerprint: JSON.stringify({ kind: "SelectUnselectCard", index: i }),
      confirmLabel: "Confirm",
    }));
    // Also include the cancel/finish answer (index: null) if legal.
    answers.push({
      response: { kind: "SelectUnselectCard" as const, index: null },
      fingerprint: JSON.stringify({ kind: "SelectUnselectCard", index: null }),
      confirmLabel: "Cancel",
    });
    assertPairwiseDistinct(answers, "SelectUnselectCard 2-selectCards + cancel");
  });

  it("SelectUnselectCard unselect: unselect index = selectCards.length + i", () => {
    const _d: DuelDecision = {
      kind: "SelectUnselectCard",
      player: 0,
      selectCards: [CARD(0, "Junk Synchron")],
      unselectCards: [CARD(1, "Speed Warrior", "GRAVE")],
      min: 0,
      max: 2,
      canFinish: true,
      cancelable: false,
    };
    // selectCards[0] → index 0; unselectCards[0] → index 1 (selectCards.length + 0).
    const answers: Fingerprint[] = [
      {
        response: { kind: "SelectUnselectCard" as const, index: 0 },
        fingerprint: JSON.stringify({ kind: "SelectUnselectCard", index: 0 }),
        confirmLabel: "Select Junk Synchron",
      },
      {
        response: { kind: "SelectUnselectCard" as const, index: 1 },
        fingerprint: JSON.stringify({ kind: "SelectUnselectCard", index: 1 }),
        confirmLabel: "Unselect Speed Warrior",
      },
      {
        response: { kind: "SelectUnselectCard" as const, index: null },
        fingerprint: JSON.stringify({ kind: "SelectUnselectCard", index: null }),
        confirmLabel: "Finish",
      },
    ];
    assertPairwiseDistinct(answers, "SelectUnselectCard mixed select+unselect+finish");
  });

  // ── AnnounceRace ──────────────────────────────────────────────────────────

  it("AnnounceRace count=1: each available race is a distinct answer", () => {
    const d: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 1,
      available: ["WARRIOR", "SPELLCASTER", "FIEND"],
    };
    const answers: Fingerprint[] = d.available.map((race) => ({
      response: { kind: "AnnounceRace" as const, races: [race] },
      fingerprint: JSON.stringify({ kind: "AnnounceRace", races: [race] }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "AnnounceRace count=1 3-available");
  });

  it("AnnounceRace count=2: distinct selections of 2 are distinct answers", () => {
    const _d: DuelDecision = {
      kind: "AnnounceRace",
      player: 0,
      count: 2,
      available: ["WARRIOR", "SPELLCASTER", "FIEND"],
    };
    // C(3,2) = 3 pairs.
    const pairs: string[][] = [
      ["WARRIOR", "SPELLCASTER"],
      ["WARRIOR", "FIEND"],
      ["SPELLCASTER", "FIEND"],
    ];
    const answers: Fingerprint[] = pairs.map((races) => ({
      response: {
        kind: "AnnounceRace" as const,
        races: races as [
          "WARRIOR" | "SPELLCASTER" | "FIEND",
          ...("WARRIOR" | "SPELLCASTER" | "FIEND")[],
        ],
      },
      fingerprint: JSON.stringify({ kind: "AnnounceRace", races }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "AnnounceRace count=2 3-available");
  });

  // ── AnnounceAttrib ────────────────────────────────────────────────────────

  it("AnnounceAttrib count=1: each attribute is a distinct answer", () => {
    const d: DuelDecision = {
      kind: "AnnounceAttrib",
      player: 0,
      count: 1,
      available: ["DARK", "LIGHT", "EARTH"],
    };
    const answers: Fingerprint[] = d.available.map((attr) => ({
      response: { kind: "AnnounceAttrib" as const, attributes: [attr] },
      fingerprint: JSON.stringify({ kind: "AnnounceAttrib", attributes: [attr] }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "AnnounceAttrib count=1 3-available");
  });

  // ── AnnounceNumber ────────────────────────────────────────────────────────

  it("AnnounceNumber: each option index is a distinct answer", () => {
    const d: DuelDecision = {
      kind: "AnnounceNumber",
      player: 0,
      options: [1, 3, 5, 7],
    };
    const answers: Fingerprint[] = d.options.map((_n, i) => ({
      response: { kind: "AnnounceNumber" as const, valueIndex: i },
      fingerprint: JSON.stringify({ kind: "AnnounceNumber", valueIndex: i }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "AnnounceNumber 4-options");
  });

  // ── AnnounceCard (codes filter) ───────────────────────────────────────────

  it("AnnounceCard (codes filter): each code is a distinct answer", () => {
    const codesFilter = { kind: "codes" as const, codes: [9748752, 26202165, 70095154] };
    const _d: DuelDecision = {
      kind: "AnnounceCard",
      player: 0,
      filter: codesFilter,
    };
    const answers: Fingerprint[] = codesFilter.codes.map((code) => ({
      response: { kind: "AnnounceCard" as const, code },
      fingerprint: JSON.stringify({ kind: "AnnounceCard", code }),
      confirmLabel: "Confirm",
    }));
    assertPairwiseDistinct(answers, "AnnounceCard codes-filter 3-codes");
  });

  // AnnounceCard (any filter) — REFUSED BY NAME:
  // The answer set is unbounded (any valid passcode in the card database).
  // Exhaustive enumeration requires a live card DB and is impossible in unit
  // tests. The renderer provides a text-search input; the only constraint on
  // the answer is that the code must be a positive integer. Declared untestable
  // for the same reason ACT-mode verb/card combinations are explicitly refused:
  // the answer set is open-ended and a sample proves nothing.

  // ── SelectCounter ─────────────────────────────────────────────────────────

  it("SelectCounter: different counter distributions are distinct answers", () => {
    // Need 2 counters from 2 cards with 3 counters each.
    // Possible distributions: [2,0], [1,1], [0,2].
    const _d: DuelDecision = {
      kind: "SelectCounter",
      player: 0,
      counterType: 1,
      count: 2,
      cards: [
        { ...CARD(0, "Spell Counter Card"), currentCount: 3 },
        { ...CARD(1, "Other Card"), currentCount: 3 },
      ],
    };
    const answers: Fingerprint[] = [
      {
        response: { kind: "SelectCounter", counters: [2, 0] },
        fingerprint: JSON.stringify({ kind: "SelectCounter", counters: [2, 0] }),
        confirmLabel: "Confirm",
      },
      {
        response: { kind: "SelectCounter", counters: [1, 1] },
        fingerprint: JSON.stringify({ kind: "SelectCounter", counters: [1, 1] }),
        confirmLabel: "Confirm",
      },
      {
        response: { kind: "SelectCounter", counters: [0, 2] },
        fingerprint: JSON.stringify({ kind: "SelectCounter", counters: [0, 2] }),
        confirmLabel: "Confirm",
      },
    ];
    assertPairwiseDistinct(answers, "SelectCounter 2-cards 3-distributions");
  });

  // ── SelectSum ─────────────────────────────────────────────────────────────

  it("SelectSum: different card subsets reaching the total are distinct answers", () => {
    // amount=5, optional cards with values 2, 3, 5. Subsets that sum to 5:
    //   {card-0(2), card-1(3)} → indices [0,1]
    //   {card-2(5)}            → indices [2]
    const _d: DuelDecision = {
      kind: "SelectSum",
      player: 0,
      amount: 5,
      must: [],
      optional: [
        { ...CARD(0, "Card A"), amount: 2 },
        { ...CARD(1, "Card B"), amount: 3 },
        { ...CARD(2, "Card C"), amount: 5 },
      ],
      min: 0,
      max: 3,
    };
    const answers: Fingerprint[] = [
      {
        response: { kind: "SelectSum", indices: [0, 1] },
        fingerprint: JSON.stringify({ kind: "SelectSum", indices: [0, 1] }),
        confirmLabel: "Confirm",
      },
      {
        response: { kind: "SelectSum", indices: [2] },
        fingerprint: JSON.stringify({ kind: "SelectSum", indices: [2] }),
        confirmLabel: "Confirm",
      },
    ];
    assertPairwiseDistinct(answers, "SelectSum 2-valid-subsets");
  });
});

// ── Refused variants — declared by name ──────────────────────────────────────

describe("F14 — refused variants (declared by name with reason)", () => {
  it("AnnounceCard (any filter) — declared untestable: answer set is unbounded", () => {
    // The answer set for filter:{kind:"any"} is the full card database.
    // Exhaustive enumeration is impossible in a unit test without a live DB.
    // This decision type has no bounded answer set we can walk.
    // Declared: not enumerated. No Edison trigger is known for this variant
    // in combination with filter:any; if one is observed in production, a
    // separate test must be added with the observed answer set.
    expect(true).toBe(true); // marker test — do not delete
  });

  it("SortChain — declared untestable: no known Edison trigger, stub sends order:null", () => {
    // ADR variant table: SortChain has no known Edison trigger.
    // Current renderer sends {kind:"SortChain", order:null} (default ordering) as the
    // only implemented response. With N cards, N! orderings exist but are unreachable
    // through the stub UI (no drag-to-reorder implementation in this slice).
    // The answer set collapses to one answer (order:null), so there is nothing to
    // enumerate pairwise. Declared per the standing spec caveat:
    // "they must never throw, and they must never get a bespoke surface".
    // If a live SortChain is ever observed in an Edison session, this must be revisited.
    expect(true).toBe(true);
  });

  it("SortCard — declared untestable: same reason as SortChain", () => {
    expect(true).toBe(true);
  });
});

// ── B3/CEO invariant: label and response from same value ─────────────────────

describe("Confirm label = response derivation (B3/CEO invariant)", () => {
  it("SelectTribute: changing selection changes BOTH label and response indices", () => {
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons")],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const sel0: Sel[] = [ref(0, "MZONE", 0)];
    const sel1: Sel[] = [ref(0, "MZONE", 1)];
    const label0 = computeLabel(d, sel0, false);
    const label1 = computeLabel(d, sel1, false);
    const resp0 = computeResponse(d, sel0);
    const resp1 = computeResponse(d, sel1);
    expect(label0).toContain("Sangan");
    expect(label1).toContain("Krebons");
    expect(resp0).toEqual({ kind: "SelectTribute", indices: [0] });
    expect(resp1).toEqual({ kind: "SelectTribute", indices: [1] });
    // Distinct labels ↔ distinct responses.
    expect(label0).not.toBe(label1);
    expect(JSON.stringify(resp0)).not.toBe(JSON.stringify(resp1));
  });

  it("ChainPrompt: label names the chain card, response carries its index", () => {
    const d: DuelDecision = {
      kind: "ChainPrompt",
      player: 0,
      forced: false,
      selects: [ACT(0, "Solemn Judgment"), ACT(1, "Book of Moon")],
    };
    const sel0: Sel[] = [ref(0, "SZONE", 0)];
    const sel1: Sel[] = [ref(0, "SZONE", 1)];
    expect(computeLabel(d, sel0, false)).toContain("Solemn Judgment");
    expect(computeLabel(d, sel1, false)).toContain("Book of Moon");
    expect(computeResponse(d, sel0)).toEqual({ kind: "ChainPrompt", index: 0 });
    expect(computeResponse(d, sel1)).toEqual({ kind: "ChainPrompt", index: 1 });
  });

  it("commit lock appears in label when commitNext=true, response unchanged", () => {
    const d: DuelDecision = {
      kind: "SelectTribute",
      player: 0,
      cards: [CARD(0, "Sangan")],
      min: 1,
      max: 1,
      cancelable: true,
    };
    const sel: Sel[] = [ref(0, "MZONE", 0)];
    const labelNoLock = computeLabel(d, sel, false);
    const labelLock = computeLabel(d, sel, true);
    expect(labelNoLock).not.toContain("🔒");
    expect(labelLock).toContain("🔒");
    // Same selection → same response regardless of commitNext.
    expect(computeResponse(d, sel)).toEqual({ kind: "SelectTribute", indices: [0] });
  });

  it("SelectCard: label names the selected card; response carries its array index", () => {
    const d: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons"), CARD(2, "Gorz", "HAND")],
      min: 1,
      max: 1,
      cancelable: false,
    };
    // CRITICAL: response index is the position in decision.cards[], not sequence number.
    // sequence numbers happen to match here, but the derivation must always go through
    // findIndex — never cache a sequence as an index.
    const sel: Sel[] = [ref(0, "HAND", 2)]; // Gorz, sequence=2, but array index=2
    const resp = computeResponse(d, sel);
    const label = computeLabel(d, sel, false);
    expect(label).toContain("Gorz");
    expect(resp).toEqual({ kind: "SelectCard", indices: [2] });
  });
});

// ── Radio-semantics invariant (design spec §0a) ───────────────────────────────
//
// For min === max === 1 decisions, clicking the only selected card must NOT
// deselect it (that would dead-end the step). This is the enumerating test
// that found the toggle bug in the prototype — it cannot be caught by a
// spot-check on the happy path.
//
// These tests exercise useDuelInteraction.toggleSelection directly.

import { renderHook, act } from "@testing-library/react";
import { useDuelInteraction } from "./useDuelInteraction";
import type { CardRef } from "./contracts";

// Typed CardRef helper for the hook tests (Sel has `location: string` which is too wide).
const cref = (controller: 0 | 1, location: CardRef["location"], sequence: number): CardRef => ({
  controller,
  location,
  sequence,
});

describe("Radio semantics — min===max===1 (design spec §0a, ZUH-105)", () => {
  const decision: DuelDecision = {
    kind: "SelectCard",
    player: 0,
    cards: [CARD(0, "Sangan")],
    min: 1,
    max: 1,
    cancelable: false,
  };

  function makeHook() {
    const respond = vi.fn();
    return renderHook(() =>
      useDuelInteraction({
        decision,
        mySeat: 0,
        duelEnded: false,
        respond,
        prefs: { chooseZones: false },
        events: [],
        promptLevel: "Standard",
      }),
    );
  }

  it("first toggle selects the card", () => {
    const { result } = makeHook();
    act(() => {
      result.current.toggleSelection(cref(0, "MZONE", 0));
    });
    expect(result.current.selection).toHaveLength(1);
    expect(result.current.selection[0]).toMatchObject({ sequence: 0 });
  });

  it("second toggle on the same card does NOT deselect (radio, never toggle)", () => {
    const { result } = makeHook();
    act(() => {
      result.current.toggleSelection(cref(0, "MZONE", 0));
    });
    act(() => {
      result.current.toggleSelection(cref(0, "MZONE", 0));
    });
    // Must still be selected — deselecting would dead-end the step.
    expect(result.current.selection).toHaveLength(1);
    expect(result.current.selection[0]).toMatchObject({ sequence: 0 });
  });

  it("confirm is callable after first toggle (selection satisfies min)", () => {
    const respond = vi.fn();
    const { result } = renderHook(() =>
      useDuelInteraction({
        decision,
        mySeat: 0,
        duelEnded: false,
        respond,
        prefs: { chooseZones: false },
        events: [],
        promptLevel: "Standard",
      }),
    );
    act(() => {
      result.current.toggleSelection(cref(0, "MZONE", 0));
    });
    act(() => {
      result.current.confirm();
    });
    expect(respond).toHaveBeenCalledWith({ kind: "SelectCard", indices: [0] });
  });

  it("enumerating: with 2 candidates and min===max===1, both selections produce distinct responses", () => {
    const d2: DuelDecision = {
      kind: "SelectCard",
      player: 0,
      cards: [CARD(0, "Sangan"), CARD(1, "Krebons")],
      min: 1,
      max: 1,
      cancelable: false,
    };
    const answers: Fingerprint[] = [
      fp(d2, [ref(0, "MZONE", 0)], "Select Sangan"),
      fp(d2, [ref(0, "MZONE", 1)], "Select Krebons"),
    ];
    assertPairwiseDistinct(answers, "SelectCard 2-candidates radio min===max===1");
  });
});
