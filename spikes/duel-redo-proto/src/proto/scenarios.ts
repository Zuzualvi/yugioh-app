// Scenario definitions. Every DECISION below is a REAL frame recorded from a live
// duel (see each scenario's `provenance`); the branches are answer-derived card
// moves, never rules adjudication.
import s01 from "../fixtures/s01-duel-start.json";
import s02 from "../fixtures/s02-normal-summon.json";
import s03 from "../fixtures/s03-tribute-summon.json";
import s04 from "../fixtures/s04-attack-target.json";
import s05 from "../fixtures/s05-chain-window.json";
import s06 from "../fixtures/s06-hand-discard.json";
import s07 from "../fixtures/s07-opponent-turn.json";
import s08 from "../fixtures/s08-battle-command.json";
import s09 from "../fixtures/s09-battle-resolved.json";
import cardsJson from "../fixtures/cards.json";

import type { CardEntry, CardInfo, DuelDecision, DuelEvent, DuelStateSnapshot, Seat } from "./types";
import type { DecisionResponse } from "./classify";
import {
  contextOf,
  eventsOf,
  ev,
  firstDecision,
  firstState,
  moveTo,
  sendToGrave,
  type Continuation,
  type Fixture,
  type Step,
} from "./replay";
import { clone, faceUp } from "./replay";
import { POS_FACEDOWN_DEF, POS_FACEUP_ATK, assertFeedConsistency, refOf, resolveCode, take, put } from "./board";

export const CARDS = cardsJson as unknown as Record<string, CardInfo>;
export function cardInfo(code: number): CardInfo | null {
  return CARDS[String(code)] ?? null;
}
export function cardName(code: number): string {
  return cardInfo(code)?.name ?? "";
}

const F = {
  s01: s01 as unknown as Fixture,
  s02: s02 as unknown as Fixture,
  s03: s03 as unknown as Fixture,
  s04: s04 as unknown as Fixture,
  s05: s05 as unknown as Fixture,
  s06: s06 as unknown as Fixture,
  s07: s07 as unknown as Fixture,
  s08: s08 as unknown as Fixture,
  s09: s09 as unknown as Fixture,
};

export type PresenceState = "connected" | "away" | "claimable";
export type NetState = "ok" | "reconnecting";

export interface Scenario {
  id: string;
  title: string;
  /** One line the CEO reads before tapping. */
  brief: string;
  provenance: string;
  mySeat: Seat;
  opponentName: string;
  myName: string;
  board: DuelStateSnapshot;
  /** Events already in the feed when the scenario opens. */
  feed: DuelEvent[];
  /** The decision the scenario opens armed with, if any. */
  open: Step | null;
  /** Control state at open. */
  control: "mine" | "theirs" | "resolving" | "connecting" | "ended";
  /** Everything the opponent did while it was theirs — feeds the delta. */
  delta?: DuelEvent[];
  presence?: PresenceState;
  net?: NetState;
  ended?: { winner: Seat | null; reason: string };
  /** Deliberately-broken art passcodes, to exercise the art-failure state. */
  breakArt?: boolean;
}

const NAMES = { me: "You", opp: "Sakura" };

// ── helpers ───────────────────────────────────────────────────────────────────

function zoneLabel(seq: number) {
  return `Monster ${seq + 1}`;
}

function nameOf(e: CardEntry) {
  return e.name || cardName(e.code) || "";
}

const SLOT: Record<string, string> = { MZONE: "Monster", SZONE: "Spell/Trap", HAND: "hand card", GRAVE: "graveyard", REMOVED: "banished" };

/**
 * The one place a candidate gets its label. Never invents an identity.
 *
 * `siblings` matters: a real recorded decision offers TWO "Thunder King Rai-Oh"
 * as tribute candidates. Two answers whose CONTROLS SAY THE SAME THING is the
 * answer-fidelity defect in its purest form — the confirm label must name the
 * one that will actually be tributed. Enumeration found this; a sample would not.
 *
 * `board` matters more. Where the decision carries `code: 0` for a card the asking
 * player owns, the identity is resolved from the STATE snapshot the client already
 * holds (`resolveCode`) — a JOIN on recorded data, never a literal. An earlier
 * revision of this file assigned the string "Dimensional Prison" to every blank
 * name in a hand-authored scenario, and the confirm button then named a different
 * card than the one that resolved. That is the answer-fidelity invariant violated
 * at its root: the LABEL and the RESPONSE came from different sources.
 */
export function candidateLabel(
  e: CardEntry,
  mySeat: Seat,
  siblings?: CardEntry[],
  board?: DuelStateSnapshot | null,
): string {
  const n = nameOf(e) || cardName(resolveCode(board ?? null, e));
  if (n) {
    const dup = siblings?.some(
      (o) => o !== e && (nameOf(o) || cardName(resolveCode(board ?? null, o))) === n,
    );
    return dup ? `${n} (${SLOT[e.location] ?? e.location} ${e.sequence + 1})` : n;
  }
  // No name anywhere — the card is genuinely not ours to identify (an opponent's
  // face-down). DESCRIBE WHAT THE PLAYER CAN SEE, never a bare ordinal: one
  // evaluator persona read "hand card 7" as a card *called* Hand Card 7, and it
  // was sitting next to "This step cannot be cancelled".
  const who = e.controller === mySeat ? "your" : "their";
  const what =
    e.location === "SZONE"
      ? "face-down card"
      : e.location === "MZONE"
        ? "face-down monster"
        : e.location === "HAND"
          ? "card"
          : "card";
  const where =
    e.location === "MZONE"
      ? `Monster ${e.sequence + 1}`
      : e.location === "SZONE"
        ? `Spell & Trap ${e.sequence + 1}`
        : e.location === "HAND"
          ? `${ordinal(e.sequence + 1)} in hand`
          : `${e.location} ${e.sequence + 1}`;
  return `${who} ${what}, ${where}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

// ── SC1 · Duel start ──────────────────────────────────────────────────────────

function scStart(): Scenario {
  const board = firstState(F.s01);
  return {
    id: "start",
    title: "1 · The first ten seconds",
    brief: "Seating. Who you are playing, which seat you have, who goes first — none of which the shipped screen says.",
    provenance: F.s01.source,
    mySeat: F.s01.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    open: null,
    control: "connecting",
  };
}

// ── SC2 · Normal summon, with the zone step PRESENTED ─────────────────────────

function scSummon(): Scenario {
  const board = firstState(F.s02);
  const idle = firstDecision(F.s02, "IdleCommand");
  const zone = firstDecision(F.s02, "SelectZone");
  return {
    id: "summon",
    title: "2 · Summon — and choose the zone",
    brief:
      "IdleCommand arms the board; it is never a question panel. The zone step has five legal answers, so under PRD A1 it is asked — on the board, one click, no panel.",
    provenance: F.s02.source,
    mySeat: F.s02.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: { decision: idle, branch: (a) => branchIdle(idle, zone, a) },
  };
}

function branchIdle(idle: Extract<DuelDecision, { kind: "IdleCommand" }>, zone: Extract<DuelDecision, { kind: "SelectZone" }>, a: DecisionResponse): Continuation {
  if (a.kind !== "IdleCommand") throw new Error("wrong answer kind");
  if (a.action === "toEP") return { named: "End Turn", handOver: true, events: [ev("PHASE", { phase: 32 })] };
  if (a.action === "toBP") return { named: "Battle Phase", events: [ev("PHASE", { phase: 8 })] };
  const list =
    a.action === "summon" ? idle.summons : a.action === "monsterSet" ? idle.monsterSets : idle.spellSets;
  const card = list[a.index ?? 0]!;
  const verb = a.action === "summon" ? "Normal Summon" : "Set";
  if (a.action === "spellSet") {
    // Set to the first free spell/trap slot: one legal answer, so no zone step.
    return {
      named: `Set ${nameOf(card)}`,
      mutate: (b) => {
        const free = (b.zones[`p${card.controller}_szone` as "p0_szone"] as unknown[]).findIndex((x) => x == null);
        moveTo(card, card.controller, "SZONE", Math.max(0, free), POS_FACEDOWN_DEF)(b);
      },
      events: [ev("SET", { card: refOf(card), code: card.code })],
    };
  }
  return {
    named: `${verb} ${nameOf(card)}`,
    next: [
      {
        decision: zone,
        intent: { verb, subject: card },
        branch: (za) => branchZone(zone, card, verb, za),
      },
    ],
  };
}

function branchZone(zone: Extract<DuelDecision, { kind: "SelectZone" }>, card: CardEntry, verb: string, a: DecisionResponse): Continuation {
  if (a.kind !== "SelectZone") throw new Error("wrong answer kind");
  const z = zone.zones[a.indices[0] ?? 0]!;
  return {
    named: `Place ${nameOf(card)} in ${zoneLabel(z.sequence)}`,
    mutate: moveTo(card, z.controller, z.location as "MZONE", z.sequence, verb === "Set" ? POS_FACEDOWN_DEF : POS_FACEUP_ATK),
    events: [ev("SUMMON", { card: { ...z, code: card.code }, code: card.code, zone: z.sequence })],
  };
}

// ── SC3 · Tribute summon — the multi-step intent and the commit point ─────────

function scTribute(): Scenario {
  const board = firstState(F.s03);
  const trib = firstDecision(F.s03, "SelectTribute");
  const zone = firstDecision(F.s03, "SelectZone");
  const idle = firstDecision(F.s03, "IdleCommand");
  // The tribute-summon target: the level-6 monarch the recorded IdleCommand offers.
  // The tribute-summon subject: the level-6 monarch really in this seat's hand on
  // the recorded board. Taken from the STATE frame, not invented.
  const myHand = board.zones[`p${F.s03.mySeat}_hand` as "p0_hand"];
  const mh = myHand.find((c) => (cardInfo(c.code)?.level ?? 0) >= 5) ?? myHand[0]!;
  const monarch: CardEntry = {
    code: mh.code,
    name: cardName(mh.code),
    controller: F.s03.mySeat,
    location: "HAND",
    sequence: mh.sequence ?? 0,
  };
  return {
    id: "tribute",
    title: "3 · Tribute summon — where the point of no return is",
    brief:
      "Two tributes are legal, so the tribute step is asked (recorded: min=max=1, cards=2, cancelable=true — the case the old spec flagged). The zone step that follows has NO cancel in the protocol, so the tribute confirm says so before you press it.",
    provenance: F.s03.source,
    mySeat: F.s03.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: {
      decision: {
        ...idle,
        summons: [monarch],
        monsterSets: [],
        spellSets: [],
      },
      branch: (a) => {
        if (a.kind !== "IdleCommand") throw new Error("wrong answer kind");
        if (a.action === "toEP") return { named: "End Turn", handOver: true };
        return {
          named: `Tribute Summon ${nameOf(monarch)}`,
          next: [
            {
              decision: trib,
              intent: { verb: "Tribute Summon", subject: monarch },
              // The next step is SelectZone, which has no cancel response in the
              // protocol at all (RSelectZone.indices is not nullable).
              commitsNext: true,
              branch: (ta) => branchTribute(trib, zone, monarch, ta),
            },
          ],
        };
      },
    },
  };
}

function branchTribute(
  trib: Extract<DuelDecision, { kind: "SelectTribute" }>,
  zone: Extract<DuelDecision, { kind: "SelectZone" }>,
  monarch: CardEntry,
  a: DecisionResponse,
): Continuation {
  if (a.kind !== "SelectTribute") throw new Error("wrong answer kind");
  if (a.indices === null) {
    // The PLAYER cancelled. The client never sends this on its own (PRD A3).
    return { named: "Cancel summon", events: [] };
  }
  const chosen = a.indices.map((i) => trib.cards[i]!);
  return {
    named: `Tribute ${chosen.map((c) => candidateLabel(c, c.controller, trib.cards)).join(" + ")} — after this you cannot cancel`,
    mutate: sendToGrave(chosen),
    events: chosen.map((c) => ev("MOVE", { card: refOf(c), code: c.code, to: "GRAVE" })),
    next: [
      {
        decision: zone,
        intent: { verb: "Tribute Summon", subject: monarch },
        branch: (za) => branchZone(zone, monarch, "Tribute Summon", za),
      },
    ],
  };
}

// ── SC4 · Attack — the decision that made the game unwinnable ─────────────────

function scAttack(multi: boolean): Scenario {
  const board = firstState(F.s08);
  const mySeat = F.s08.mySeat;
  const oppSeat = (1 - mySeat) as Seat;
  const battle = firstDecision(F.s08, "BattleCommand", (d) => d.attacks.length > 0);
  // s08 carries its OWN attack-target step: the opponent's face-down monster,
  // code 0, cancelable:true. That is the exact decision the shipped client
  // answered with `indices: null` in the same tick, eight times in a row.
  const target = firstDecision(F.s08, "SelectCard", (d) => d.cards.every((c) => c.location === "MZONE"));
  let cards = target.cards;
  if (multi) {
    // A second legal target. The card record and the CardEntry are both taken
    // verbatim from the s04 capture; placing it in the opponent's second monster
    // zone on THIS board is hand-authored, because no recorded duel ever reached
    // two attackable monsters (see 07-coverage).
    const extra = firstDecision(F.s04, "SelectCard", (d) => d.cards.every((c) => c.location === "MZONE")).cards[0]!;
    const e2: CardEntry = { ...extra, controller: oppSeat, location: "MZONE", sequence: 1 };
    const oppRow = board.zones[`p${oppSeat}_mzone` as "p0_mzone"];
    oppRow[1] = { code: e2.code, position: POS_FACEUP_ATK, sequence: 1 };
    cards = [...target.cards, e2];
  }
  const dec: DuelDecision = { ...target, cards };
  const attacker = battle.attacks[0]!;
  return {
    id: multi ? "attack-multi" : "attack",
    title: multi ? "4b · Attack — more than one legal target" : "4a · Attack — exactly one legal target",
    brief: multi
      ? "PRD A5: more than one legal target, so the target step is always presented. Distinct targets must produce distinct outcomes — that is the answer-fidelity gate."
      : "Exactly one legal target, so the client answers the step and shows a receipt naming what it did. It never sends a decline. That decline is the defect that silently evaporated every attack.",
    provenance:
      F.s08.source +
      (multi ? " · second target hand-authored onto the recorded board from the s04 capture" : ""),
    mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: {
      decision: battle,
      branch: (a) => {
        if (a.kind !== "BattleCommand") throw new Error("wrong answer kind");
        if (a.action === "toEP") return { named: "End Turn", handOver: true };
        if (a.action === "toM2") return { named: "Main Phase 2", events: [ev("PHASE", { phase: 16 })] };
        return {
          named: `Attack with ${nameOf(attacker)}`,
          next: [
            {
              decision: dec,
              intent: { verb: "Attack", subject: attacker },
              branch: (ta) => branchTarget(dec as Extract<DuelDecision, { kind: "SelectCard" }>, attacker, ta),
            },
          ],
        };
      },
    },
  };
}

function branchTarget(
  dec: Extract<DuelDecision, { kind: "SelectCard" }>,
  attacker: CardEntry,
  a: DecisionResponse,
): Continuation {
  if (a.kind !== "SelectCard") throw new Error("wrong answer kind");
  if (a.indices === null) return { named: "Cancel attack", events: [] };
  const t = dec.cards[a.indices[0] ?? 0]!;
  // ⚠ THE PROTOTYPE STOPS AT THE DECLARATION AND DOES NOT RESOLVE THE BATTLE.
  //
  // An earlier revision destroyed the target whenever the attacker's ATK exceeded
  // the target's DEF, which is not the rule: an attack-position defender is
  // compared on ATK, and the loser is destroyed and its controller takes damage.
  // A 1900 attacker "destroying" a 2400 Mobius for no damage is a FALSE OUTCOME,
  // and a CEO tapping this reads a false outcome as a design decision.
  //
  // Resolving battle correctly means implementing rules the engine already
  // implements, which is the exact trap the last round fell into. So: the answer
  // moves the declaration forward, the feed records WHAT WAS DECLARED, the board
  // does not change, and the dock says so in the prototype's own stub voice.
  return {
    named: `Attack ${candidateLabel(t, attacker.controller, dec.cards)}`,
    events: [
      ev("ATTACK", {
        attacker: refOf(attacker),
        target: refOf(t),
        code: attacker.code,
        targetCode: t.code,
        actor: attacker.controller,
      }),
    ],
    // The engine re-issues BattleCommand without a monster that has already
    // declared, so the verb is not offered again. Modelled, not adjudicated.
    attackerSpent: refOf(attacker),
    protoNote: "the engine resolves the battle; this prototype stops at the declaration",
  };
}

// ── SC4c · A real battle, resolved by the real engine ────────────────────────

/**
 * The one scenario that shows a battle OUTCOME, and every number in it is
 * recorded. Uraby (1500) attacks Thunder King Rai-Oh (1900); ocgcore destroyed
 * Uraby and charged its controller 400. The prototype replays the engine's own
 * ATTACK / BATTLE / LP_CHANGE / MOVE events and applies them; it computes nothing.
 */
function scBattle(): Scenario {
  const board = firstState(F.s09);
  const battle = firstDecision(F.s09, "BattleCommand", (d) => d.attacks.length > 0);
  const target = firstDecision(F.s09, "SelectCard", (d) => d.cards.every((c) => c.location === "MZONE"));
  const attacker = battle.attacks[0]!;
  const resolved = eventsOf(F.s09).filter((e) => e.kind !== "HINT" && e.kind !== "PHASE");
  return {
    id: "battle",
    title: "4c · A battle the engine actually resolved",
    brief:
      "Recorded end to end. Uraby (1500) attacks Thunder King Rai-Oh (1900): ocgcore destroyed Uraby and charged its controller 400 life points. Every number here came off the wire — attacking into something bigger costs you the monster and the damage.",
    provenance: F.s09.source,
    mySeat: F.s09.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: {
      decision: battle,
      branch: (a) => {
        if (a.kind !== "BattleCommand") throw new Error("wrong answer kind");
        if (a.action === "toEP") return { named: "End Turn", handOver: true };
        if (a.action === "toM2") return { named: "Main Phase 2", events: [ev("PHASE", { phase: 16 })] };
        return {
          named: `Attack with ${nameOf(attacker)}`,
          next: [
            {
              decision: target,
              intent: { verb: "Attack", subject: attacker },
              branch: (ta) => {
                if (ta.kind !== "SelectCard") throw new Error("wrong answer kind");
                if (ta.indices === null) return { named: "Cancel attack", events: [] };
                const t = target.cards[ta.indices[0] ?? 0]!;
                return {
                  named: `Attack ${candidateLabel(t, attacker.controller, target.cards, board)}`,
                  // The engine's own events, replayed. `applyEvents` moves the board
                  // from them; nothing here decides who won.
                  events: resolved,
                  applyRecorded: true,
                };
              },
            },
          ],
        };
      },
    },
  };
}

// ── SC5 · Chain window — the offer, with and without the deltas ───────────────

function scChain(withContext: boolean): Scenario {
  const board = firstState(F.s05);
  const chain = firstDecision(F.s05, "ChainPrompt");
  const ctx = contextOf(F.s05);
  return {
    id: withContext ? "chain" : "chain-nocontext",
    title: withContext
      ? "5a · A chain window, with the context the engine actually sent"
      : "5b · The same window when the engine sends no context at all",
    brief: withContext
      ? "Recorded verbatim. The decision carries code:0 for the player's OWN hand card; the identity is resolved from the STATE snapshot the client already holds — a join on recorded data, never a literal."
      : "Same recorded decision, DECISION_CONTEXT removed — which is what the wire really gives for a summon-triggered window (the sidecar fired twice in 15 scenarios). Line 1 degrades to a STATED fallback, never a bare verb.",
    provenance:
      F.s05.source +
      (withContext
        ? " · DECISION_CONTEXT as recorded"
        : " · DECISION_CONTEXT deliberately withheld — a REMOVAL from recorded data, not an addition to it"),
    mySeat: F.s05.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: {
      decision: chain,
      context: withContext ? ctx : undefined,
      branch: (a) => branchChain(chain, a, board),
    },
  };
}

function branchChain(
  dec: Extract<DuelDecision, { kind: "ChainPrompt" }>,
  a: DecisionResponse,
  board: DuelStateSnapshot,
): Continuation {
  if (a.kind !== "ChainPrompt") throw new Error("wrong answer kind");
  if (a.index === null) {
    return { named: "No response", events: [ev("HINT", { note: "declined" })], handOver: true };
  }
  const c = dec.selects[a.index]!;
  const code = c.code || resolveCode(board, c);
  return {
    named: `Activate ${candidateLabel(c, dec.player, dec.selects, board)}`,
    mutate: (b) => {
      const card = take(b, refOf(c));
      if (card) put(b, c.controller, c.location === "HAND" ? "SZONE" : c.location as "SZONE", c.sequence, { ...card, position: 1 }, 1);
    },
    events: [ev("CHAINING", { card: refOf(c), code, link: 1 })],
    handOver: true,
  };
}

// ── SC6 · End-phase hand discard — seven anonymous candidates ─────────────────

function scDiscard(): Scenario {
  const board = firstState(F.s06);
  const dec = firstDecision(F.s06, "SelectCard", (d) => d.cards.every((c) => c.location === "HAND"));
  return {
    id: "discard",
    title: "6 · End-phase discard — seven candidates, none of them named",
    brief:
      "Recorded verbatim: every candidate is your OWN hand card and every one arrives code:0, name:\"\". Seven distinct answers, and the screen cannot tell you which is which. This is ND-9 at its most expensive.",
    provenance: F.s06.source,
    mySeat: F.s06.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    open: {
      decision: dec,
      intent: { verb: "End Phase", subject: null },
      branch: (a) => {
        if (a.kind !== "SelectCard") throw new Error("wrong answer kind");
        if (a.indices === null) return { named: "Cancel", events: [] };
        const chosen = a.indices.map((i) => dec.cards[i]!);
        return {
          named: `Discard ${chosen.map((c) => candidateLabel(c, dec.player)).join(", ")}`,
          mutate: sendToGrave(chosen),
          events: chosen.map((c) => ev("MOVE", { card: refOf(c), code: c.code, to: "GRAVE" })),
          handOver: true,
        };
      },
    },
  };
}

// ── SC7 · Handover — waiting, then the delta ─────────────────────────────────

function scHandover(): Scenario {
  const board = firstState(F.s07);
  const delta = eventsOf(F.s07).filter((e) => e.kind !== "HINT");
  return {
    id: "handover",
    title: "7 · Pass the turn, wait, get it back",
    brief:
      "Answering clears the decision at once — off-clock the board offers nothing (B2) and nothing says 'not your turn'. When control returns, everything that happened while it was theirs is on screen and stays there until you act.",
    provenance: F.s07.source,
    mySeat: F.s07.mySeat,
    opponentName: NAMES.opp,
    myName: NAMES.me,
    board,
    feed: [],
    control: "mine",
    delta,
    open: {
      decision: {
        kind: "IdleCommand",
        player: F.s07.mySeat,
        summons: [],
        specialSummons: [],
        posChanges: [],
        monsterSets: [],
        spellSets: [],
        activates: [],
        toBattlePhase: true,
        toEndPhase: true,
      },
      branch: (a) => {
        if (a.kind !== "IdleCommand") throw new Error("wrong answer kind");
        if (a.action === "toBP") return { named: "Battle Phase", events: [ev("PHASE", { phase: 8 })] };
        return { named: "End Turn", handOver: true, events: [ev("PHASE", { phase: 32 })] };
      },
    },
  };
}

// ── SC8 · The opponent leaves ────────────────────────────────────────────────

function scAway(): Scenario {
  const s = scHandover();
  return {
    ...s,
    id: "away",
    title: "8 · The opponent leaves",
    brief:
      "With the clock deleted, timeout-forfeit is gone and this is the ending it used to provide. No countdown is displayed anywhere; the route out is a control the player presses.",
    provenance: "board RECORDED (s07). Presence transitions and the claim ending are HAND-AUTHORED — the wire has no PRESENCE frame in a duel and no 'abandoned' end reason. See ND-10.",
    control: "theirs",
    presence: "away",
    open: null,
  };
}

// ── SC9 · The duel ends ──────────────────────────────────────────────────────

function scEnd(reason: string, winner: Seat | null): Scenario {
  const s = scHandover();
  return {
    ...s,
    id: `end-${reason}`,
    title: `9 · Duel end — ${reason}`,
    brief: "Result, cause, both totals, and a route onward. The board behind stays inspectable.",
    provenance: "board RECORDED (s07). The DUEL_END frame is HAND-AUTHORED: the capture contains 764 relayed MSG_WIN and zero DUEL_END frames (see ZUH-132).",
    control: "ended",
    open: null,
    ended: { winner, reason },
  };
}

// ── SC10 · Art failure ───────────────────────────────────────────────────────

function scArtFail(): Scenario {
  return {
    ...scSummon(),
    id: "artfail",
    title: "10 · Every card image fails",
    brief:
      "Art is fetched from a public CDN with a bounded deadline. When it does not arrive the board must still be a board — a tile carries a text identity that never depended on the image.",
    breakArt: true,
    provenance: F.s02.source + " · art host deliberately unreachable",
  };
}

const ALL: Scenario[] = [
  scStart(),
  scSummon(),
  scTribute(),
  scAttack(false),
  scAttack(true),
  scBattle(),
  scChain(true),
  scChain(false),
  scDiscard(),
  scHandover(),
  scAway(),
  scEnd("life points", 0),
  scEnd("resign", 0),
  scEnd("abandoned", 0),
  scArtFail(),
];

// FAIL TO LOAD, not fail quietly. A scenario whose opening feed claims a state
// change its opening board cannot be shown to reflect is a broken fixture, and the
// app must not start with one.
for (const sc of ALL) assertFeedConsistency(sc.id, sc.feed);

export const SCENARIOS: Scenario[] = ALL;

export { clone, faceUp };
