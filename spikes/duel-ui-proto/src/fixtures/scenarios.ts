/**
 * Recorded-shape fixtures, played back as scripted scenarios.
 *
 * A Scenario is an ordered list of Steps. The proto engine presents step N, waits for
 * the player's answer (or auto-answers it, per the auto-resolve register in
 * surface-inventory.md §15), then applies step N's consequences and presents step N+1
 * after `latencyMs` — which is what a real WebSocket round trip costs.
 *
 * Decision payloads are shaped exactly like packages/contracts/src/duelDecision.ts.
 * Board payloads use the MH-1 extended snapshot (see types.ts header).
 */

import type {
  ChainLink,
  DuelDecision,
  DuelEvent,
  DuelStateSnapshot,
  LocationCode,
  PendingIntent,
  Seat,
} from "./types";
import { backs, clone, emptyZones, handCard, mon, row, setCard, state } from "./board";

const CAIUS = 9748752;
const TORRENTIAL = 53582587;
const SOLEMN = 41420027;
const BOTTOMLESS = 29401950;
const TREEBORN = 12538374;
const GORZ = 44330098;
const JUNK = 63977008;
const CYBER = 70095154;
const TROOPER = 85087012;
const MST = 5318639;
const BOOK = 14087893;
const SANGAN = 26202165;
const KREBONS = 59575539;
const DPRISON = 70342110;
const BRIONAC = 50321796;
const STARDUST = 44508094;

export interface CardRef {
  controller: Seat;
  location: LocationCode;
  sequence: number;
}

export interface Step {
  /** The engine's question. null = a pure state/wait beat with nothing to answer. */
  decision: DuelDecision | null;
  state: DuelStateSnapshot;
  intent?: PendingIntent | null;
  chain?: ChainLink[];
  events?: Omit<DuelEvent, "id">[];
  /** card text pushed into the inspector with no click */
  autoPush?: number;
  /**
   * The caption the engine produced for this selection (ocgcore MSG_HINT /
   * HINT_SELECTMSG — backend MH-3.1). Without it a SelectCard cannot say what it
   * is for; with it, every selection prompt reads as a sentence.
   */
  caption?: string;
  /** engine round-trip cost before this step appears */
  latencyMs?: number;
  /** what the off-clock/waiting player is told while this step is being computed */
  waitLabel?: string;
  clockSeconds?: number;
  onClockSeat?: Seat;
  /** board cards highlighted as candidates/targets alongside the Question Bar */
  highlight?: CardRef[];
  /** legal zones highlighted (SelectZone with Choose Zones ON) */
  zoneHighlight?: CardRef[];
  /**
   * Set when the CLIENT answers this decision without showing it (§15 register).
   * The prototype flashes it so a reviewer can SEE what a player would not.
   */
  autoResolved?: string;
  /** narration chip on the chain strip, for a forced trigger auto-answered */
  narrate?: string;
  end?: { winner: Seat | null; reason: "normal" | "timeout" | "resign" };
  /** a one-line note shown in the prototype's review margin (never in the real product) */
  note?: string;
  /**
   * Prototype-only: which ACT-mode action this scripted step is waiting for.
   * The real product has no such notion — every legal verb would work.
   */
  expect?: { ref: CardRef; verb: string } | { phase: "DP" | "SP" | "M1" | "BP" | "M2" | "EP" };
}

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  steps: Step[];
}

// ─────────────────────────────────────────────────────────────────────────────
// A · Tribute Summon Caius — the flagship 2–6 decision intent
// ─────────────────────────────────────────────────────────────────────────────

function baseZonesA() {
  const z = emptyZones();
  z.p0_hand = [
    handCard(CAIUS, 0),
    handCard(BOOK, 1),
    handCard(TORRENTIAL, 2),
    handCard(CYBER, 3),
    handCard(GORZ, 4),
  ];
  z.p0_mzone = row([
    mon(TROOPER, 0, 400, 400, 3),
    mon(SANGAN, 1, 1000, 600, 3),
    mon(JUNK, 2, 1300, 500, 3),
  ]);
  z.p0_szone = row([setCard(MST, 0)]);
  z.p0_grave = [{ code: TREEBORN, sequence: 0, position: 1 }];
  z.p1_hand = backs(4);
  z.p1_mzone = row([mon(KREBONS, 0, 1200, 400, 2)]);
  z.p1_szone = row([setCard(0, 0), setCard(0, 1)]);
  z.p1_grave = [{ code: BOTTOMLESS, sequence: 0, position: 1 }];
  z.p0_deckCount = 30;
  z.p1_deckCount = 32;
  return z;
}

const idleA: DuelDecision = {
  kind: "IdleCommand",
  player: 0,
  summons: [
    { code: CAIUS, name: "Caius the Shadow Monarch", controller: 0, location: "HAND", sequence: 0 },
    { code: CYBER, name: "Cyber Dragon", controller: 0, location: "HAND", sequence: 3 },
  ],
  specialSummons: [
    { code: CYBER, name: "Cyber Dragon", controller: 0, location: "HAND", sequence: 3 },
  ],
  posChanges: [
    { code: TROOPER, name: "Card Trooper", controller: 0, location: "MZONE", sequence: 0 },
    { code: SANGAN, name: "Sangan", controller: 0, location: "MZONE", sequence: 1 },
    { code: JUNK, name: "Junk Synchron", controller: 0, location: "MZONE", sequence: 2 },
  ],
  monsterSets: [
    { code: CAIUS, name: "Caius the Shadow Monarch", controller: 0, location: "HAND", sequence: 0 },
  ],
  spellSets: [
    { code: BOOK, name: "Book of Moon", controller: 0, location: "HAND", sequence: 1 },
    { code: TORRENTIAL, name: "Torrential Tribute", controller: 0, location: "HAND", sequence: 2 },
  ],
  activates: [
    {
      code: MST,
      name: "Mystical Space Typhoon",
      controller: 0,
      location: "SZONE",
      sequence: 0,
      description: "Destroy 1 Spell/Trap on the field",
    },
  ],
  toBattlePhase: true,
  toEndPhase: true,
};

const intentA = (stepIndex: number, cancelable: boolean): PendingIntent => ({
  label: 'Tribute Summoning "Caius the Shadow Monarch"',
  cardCode: CAIUS,
  steps: ["Tributes", "Zone", "Position"],
  stepIndex,
  commitAt: 1,
  cancelable,
  trailingUnknown: true,
});

const scenarioA: Scenario = (() => {
  const z0 = baseZonesA();

  // after tributes chosen + zone committed
  const z1 = clone(z0);
  z1.p0_mzone = row([
    mon(CAIUS, 0, 2400, 1000, 6),
    mon(SANGAN, 1, 1000, 600, 3),
    mon(JUNK, 2, 1300, 500, 3),
  ]);
  z1.p0_grave = [
    { code: TROOPER, sequence: 0, position: 1 },
    { code: TREEBORN, sequence: 1, position: 1 },
  ];
  z1.p0_hand = [handCard(BOOK, 0), handCard(TORRENTIAL, 1), handCard(CYBER, 2), handCard(GORZ, 3)];

  // after Caius's trigger resolves — Krebons banished, 1000 damage
  const z2 = clone(z1);
  z2.p1_mzone = row([]);
  z2.p1_removed = [{ code: KREBONS, sequence: 0, position: 1 }];

  return {
    id: "tribute-summon",
    title: "Tribute Summon Caius",
    blurb:
      "The flagship. One player intent → up to 6 engine decisions, one clock, one ribbon, and an explicit point of no return.",
    steps: [
      {
        decision: idleA,
        state: state(z0),
        clockSeconds: 285,
        onClockSeat: 0,
        expect: {
          ref: { controller: 0, location: "HAND", sequence: 0 },
          verb: "Tribute Summon (1)",
        },
        note: "IdleCommand is NOT rendered as a question. It arms the board: click Caius in your hand.",
      },
      {
        decision: {
          kind: "SelectTribute",
          player: 0,
          cards: [
            { code: TROOPER, name: "Card Trooper", controller: 0, location: "MZONE", sequence: 0 },
            { code: SANGAN, name: "Sangan", controller: 0, location: "MZONE", sequence: 1 },
            { code: JUNK, name: "Junk Synchron", controller: 0, location: "MZONE", sequence: 2 },
          ],
          min: 1,
          max: 1,
          cancelable: true,
        },
        state: state(z0),
        intent: intentA(0, true),
        latencyMs: 160,
        highlight: [
          { controller: 0, location: "MZONE", sequence: 0 },
          { controller: 0, location: "MZONE", sequence: 1 },
          { controller: 0, location: "MZONE", sequence: 2 },
        ],
        note: "Cancel is live here. The confirm button carries the lock, because the NEXT step cannot be cancelled.",
      },
      {
        decision: {
          kind: "SelectZone",
          player: 0,
          count: 1,
          zones: [
            { controller: 0, location: "MZONE", sequence: 0 },
            { controller: 0, location: "MZONE", sequence: 3 },
            { controller: 0, location: "MZONE", sequence: 4 },
          ],
        },
        state: state(z1),
        intent: intentA(1, false),
        latencyMs: 220,
        autoResolved:
          "SelectZone — answered from your zone preference (leftmost free). Turn on “Choose zones” in ⚙ to be asked.",
        events: [
          {
            engineType: 60,
            owner: 0,
            code: CAIUS,
            verb: "Tribute Summon",
            from: "HAND",
            to: "MZONE",
            turnNumber: 4,
            phase: "M1",
          },
          {
            engineType: 50,
            owner: 0,
            code: TROOPER,
            verb: "Move",
            from: "MZONE",
            to: "GRAVE",
            turnNumber: 4,
            phase: "M1",
          },
        ],
      },
      {
        decision: {
          kind: "SelectPosition",
          player: 0,
          card: {
            code: CAIUS,
            name: "Caius the Shadow Monarch",
            controller: 0,
            location: "MZONE",
            sequence: 0,
          },
          positions: ["faceup_attack", "faceup_defense"],
        },
        state: state(z1),
        intent: intentA(2, false),
        latencyMs: 180,
        note: "Past the lock. The ribbon says “Committed” — it does not offer a Cancel that would fail.",
      },
      {
        decision: null,
        state: state(z1),
        intent: intentA(2, false),
        latencyMs: 1500,
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        clockSeconds: 300,
        note: "The off-clock gap. Their clock runs; you can still inspect anything, free and silent.",
      },
      {
        decision: {
          kind: "ChainPrompt",
          player: 0,
          forced: false,
          selects: [
            {
              code: CAIUS,
              name: "Caius the Shadow Monarch",
              controller: 0,
              location: "MZONE",
              sequence: 0,
              description: "Banish 1 card on the field",
            },
          ],
        },
        state: state(z1),
        intent: {
          label: "Caius the Shadow Monarch — Tribute Summon trigger",
          cardCode: CAIUS,
          steps: ["Activate?", "Target"],
          stepIndex: 0,
          commitAt: 99,
          cancelable: true,
        },
        latencyMs: 260,
        clockSeconds: 268,
        onClockSeat: 0,
        chain: [],
      },
      {
        decision: {
          kind: "SelectCard",
          player: 0,
          cards: [
            { code: KREBONS, name: "Krebons", controller: 1, location: "MZONE", sequence: 0 },
            { code: 0, name: "", controller: 1, location: "SZONE", sequence: 0 },
            { code: 0, name: "", controller: 1, location: "SZONE", sequence: 1 },
            {
              code: CAIUS,
              name: "Caius the Shadow Monarch",
              controller: 0,
              location: "MZONE",
              sequence: 0,
            },
            { code: SANGAN, name: "Sangan", controller: 0, location: "MZONE", sequence: 1 },
          ],
          min: 1,
          max: 1,
          cancelable: true,
        },
        state: state(z1),
        intent: {
          label: "Caius the Shadow Monarch — Tribute Summon trigger",
          cardCode: CAIUS,
          steps: ["Activate?", "Target"],
          stepIndex: 1,
          commitAt: 99,
          cancelable: true,
        },
        latencyMs: 200,
        caption: 'Banish 1 card on the field — "Caius the Shadow Monarch"',
        chain: [{ ordinal: 1, code: CAIUS, owner: 0, location: "MZONE", state: "declared" }],
        autoPush: CAIUS,
        highlight: [
          { controller: 1, location: "MZONE", sequence: 0 },
          { controller: 1, location: "SZONE", sequence: 0 },
          { controller: 1, location: "SZONE", sequence: 1 },
          { controller: 0, location: "MZONE", sequence: 0 },
          { controller: 0, location: "MZONE", sequence: 1 },
        ],
        note: "The target set spans BOTH fields. It is picked on the board, not in a list — that is the whole point of ZoneCard.sequence (MH-1).",
      },
      {
        decision: idleA,
        state: state(z2, { lp: [8000, 7000] }),
        intent: null,
        latencyMs: 700,
        clockSeconds: 262,
        onClockSeat: 0,
        chain: [],
        events: [
          {
            engineType: 70,
            owner: 0,
            code: CAIUS,
            verb: "Chain",
            from: "MZONE",
            to: "MZONE",
            turnNumber: 4,
            phase: "M1",
          },
          {
            engineType: 83,
            owner: 1,
            code: KREBONS,
            verb: "Target",
            from: "MZONE",
            to: "MZONE",
            turnNumber: 4,
            phase: "M1",
          },
          {
            engineType: 50,
            owner: 1,
            code: KREBONS,
            verb: "Banish",
            from: "MZONE",
            to: "REMOVED",
            turnNumber: 4,
            phase: "M1",
          },
          {
            engineType: 91,
            owner: 1,
            code: CAIUS,
            verb: "Damage",
            amount: 1000,
            turnNumber: 4,
            phase: "M1",
          },
        ],
        note: "Intent complete. Ribbon gone, board live again, and the log says exactly what happened.",
      },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// B · Respond to a chain — “Sakura activated Torrential Tribute. Chain?”
// ─────────────────────────────────────────────────────────────────────────────

const scenarioB: Scenario = (() => {
  const z0 = emptyZones();
  z0.p0_hand = [handCard(JUNK, 0), handCard(GORZ, 1), handCard(CYBER, 2)];
  z0.p0_mzone = row([mon(TROOPER, 0, 400, 400, 3)]);
  z0.p0_szone = row([setCard(SOLEMN, 0), setCard(BOOK, 1)]);
  z0.p1_hand = backs(3);
  z0.p1_mzone = row([mon(KREBONS, 0, 1200, 400, 2)]);
  z0.p1_szone = row([setCard(0, 0), setCard(0, 1)]);
  z0.p0_deckCount = 31;
  z0.p1_deckCount = 29;

  const z1 = clone(z0); // Junk Synchron summoned
  z1.p0_hand = [handCard(GORZ, 0), handCard(CYBER, 1)];
  z1.p0_mzone = row([mon(TROOPER, 0, 400, 400, 3), mon(JUNK, 1, 1300, 500, 3)]);

  const z2 = clone(z1); // Sakura flips Torrential
  z2.p1_szone = row([
    { code: TORRENTIAL, sequence: 0, position: 1, isPublic: true },
    setCard(0, 1),
  ]);

  const z3 = clone(z2); // you chain Solemn, pay half
  z3.p0_szone = row([{ code: SOLEMN, sequence: 0, position: 1, isPublic: true }, setCard(BOOK, 1)]);

  const z4 = clone(z3); // resolved: Solemn negates + destroys Torrential
  z4.p0_szone = row([null, setCard(BOOK, 1)]);
  z4.p1_szone = row([null, setCard(0, 1)]);
  z4.p0_grave = [{ code: SOLEMN, sequence: 0, position: 1 }];
  z4.p1_grave = [{ code: TORRENTIAL, sequence: 0, position: 1 }];

  const idleB: DuelDecision = {
    kind: "IdleCommand",
    player: 0,
    summons: [{ code: JUNK, name: "Junk Synchron", controller: 0, location: "HAND", sequence: 0 }],
    specialSummons: [],
    posChanges: [
      { code: TROOPER, name: "Card Trooper", controller: 0, location: "MZONE", sequence: 0 },
    ],
    monsterSets: [
      { code: JUNK, name: "Junk Synchron", controller: 0, location: "HAND", sequence: 0 },
    ],
    spellSets: [],
    activates: [],
    toBattlePhase: true,
    toEndPhase: true,
  };

  return {
    id: "chain-response",
    title: "Respond to a chain",
    blurb:
      "The interaction the format is built on. One Question Bar naming the card, candidates badged by location, decline with equal weight.",
    steps: [
      {
        decision: idleB,
        state: state(z0, { turnNumber: 6 }),
        clockSeconds: 240,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "HAND", sequence: 0 }, verb: "Summon" },
        note: "Summon Junk Synchron and see what Sakura does about it.",
      },
      {
        decision: null,
        state: state(z1, { turnNumber: 6 }),
        latencyMs: 300,
        intent: {
          label: 'Summoning "Junk Synchron"',
          cardCode: JUNK,
          steps: ["Zone"],
          stepIndex: 0,
          commitAt: 0,
          cancelable: false,
          trailingUnknown: true,
        },
        events: [
          {
            engineType: 60,
            owner: 0,
            code: JUNK,
            verb: "Summon",
            from: "HAND",
            to: "MZONE",
            turnNumber: 6,
            phase: "M1",
          },
        ],
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        clockSeconds: 300,
        autoResolved: "SelectZone — answered from your zone preference (leftmost free).",
      },
      {
        decision: {
          kind: "ChainPrompt",
          player: 0,
          forced: false,
          selects: [
            {
              code: SOLEMN,
              name: "Solemn Judgment",
              controller: 0,
              location: "SZONE",
              sequence: 0,
              description: "Pay half your LP; negate the activation and destroy it",
            },
            {
              code: BOOK,
              name: "Book of Moon",
              controller: 0,
              location: "SZONE",
              sequence: 1,
              description: "Change 1 face-up monster to face-down Defense Position",
            },
          ],
        },
        state: state(z2, { turnNumber: 6 }),
        latencyMs: 1300,
        clockSeconds: 236,
        onClockSeat: 0,
        chain: [{ ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" }],
        autoPush: TORRENTIAL,
        highlight: [
          { controller: 0, location: "SZONE", sequence: 0 },
          { controller: 0, location: "SZONE", sequence: 1 },
        ],
        note: "Line 1 names the card, the owner and the location. Today ChainPromptPanel shows neither — the trigger's identity is not in the ChainPrompt variant at all, only in MSG_CHAINING (backend MH-2).",
      },
      {
        decision: null,
        state: state(z3, { turnNumber: 6, lp: [4000, 8000] }),
        latencyMs: 1400,
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        clockSeconds: 300,
        chain: [
          { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
          { ordinal: 2, code: SOLEMN, owner: 0, location: "SZONE", state: "declared" },
        ],
        events: [
          {
            engineType: 70,
            owner: 0,
            code: SOLEMN,
            verb: "Chain",
            from: "SZONE",
            to: "SZONE",
            turnNumber: 6,
            phase: "M1",
          },
          {
            engineType: 100,
            owner: 0,
            code: SOLEMN,
            verb: "Damage",
            amount: 4000,
            turnNumber: 6,
            phase: "M1",
          },
        ],
      },
      {
        decision: null,
        state: state(z3, { turnNumber: 6, lp: [4000, 8000] }),
        latencyMs: 900,
        chain: [
          { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
          { ordinal: 2, code: SOLEMN, owner: 0, location: "SZONE", state: "resolving" },
        ],
        autoPush: SOLEMN,
        waitLabel: "Chain resolving…",
        onClockSeat: 1,
        note: "The strip unwinds right-to-left and pushes each resolving link's text into the inspector. No click.",
      },
      {
        decision: idleB,
        state: state(z4, { turnNumber: 6, lp: [4000, 8000] }),
        latencyMs: 900,
        chain: [],
        clockSeconds: 232,
        onClockSeat: 0,
        events: [
          { engineType: 72, owner: 0, code: SOLEMN, verb: "Resolve", turnNumber: 6, phase: "M1" },
          {
            engineType: 73,
            owner: 1,
            code: TORRENTIAL,
            verb: "Negated",
            from: "SZONE",
            to: "GRAVE",
            turnNumber: 6,
            phase: "M1",
          },
          {
            engineType: 50,
            owner: 0,
            code: SOLEMN,
            verb: "Move",
            from: "SZONE",
            to: "GRAVE",
            turnNumber: 6,
            phase: "M1",
          },
        ],
      },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// C · Battle phase — two attacks, re-indexed attacks[] between cycles
// ─────────────────────────────────────────────────────────────────────────────

const scenarioC: Scenario = (() => {
  const z0 = emptyZones();
  z0.p0_hand = [handCard(GORZ, 0), handCard(CYBER, 1)];
  z0.p0_mzone = row([mon(CAIUS, 0, 2400, 1000, 6), mon(TROOPER, 1, 400, 400, 3)]);
  z0.p0_szone = row([setCard(BOOK, 0)]);
  z0.p1_hand = backs(2);
  z0.p1_mzone = row([mon(KREBONS, 0, 1200, 400, 2)]);
  z0.p1_szone = row([setCard(0, 0)]);
  z0.p0_deckCount = 28;
  z0.p1_deckCount = 27;

  const z1 = clone(z0); // Krebons destroyed
  z1.p1_mzone = row([]);
  z1.p1_grave = [{ code: KREBONS, sequence: 0, position: 1 }];

  const idleC: DuelDecision = {
    kind: "IdleCommand",
    player: 0,
    summons: [],
    specialSummons: [],
    posChanges: [
      {
        code: CAIUS,
        name: "Caius the Shadow Monarch",
        controller: 0,
        location: "MZONE",
        sequence: 0,
      },
      { code: TROOPER, name: "Card Trooper", controller: 0, location: "MZONE", sequence: 1 },
    ],
    monsterSets: [],
    spellSets: [],
    activates: [],
    toBattlePhase: true,
    toEndPhase: true,
  };

  const battle1: DuelDecision = {
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: [
      {
        code: CAIUS,
        name: "Caius the Shadow Monarch",
        controller: 0,
        location: "MZONE",
        sequence: 0,
        canDirectAttack: false,
      },
      {
        code: TROOPER,
        name: "Card Trooper",
        controller: 0,
        location: "MZONE",
        sequence: 1,
        canDirectAttack: false,
      },
    ],
    toMainPhase2: true,
    toEndPhase: true,
  };

  // NOTE the re-index: Card Trooper was attacks[1], it is now attacks[0].
  const battle2: DuelDecision = {
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: [
      {
        code: TROOPER,
        name: "Card Trooper",
        controller: 0,
        location: "MZONE",
        sequence: 1,
        canDirectAttack: true,
      },
    ],
    toMainPhase2: true,
    toEndPhase: true,
  };

  const battle3: DuelDecision = {
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: [],
    toMainPhase2: true,
    toEndPhase: true,
  };

  return {
    id: "battle",
    title: "Attack with everything",
    blurb:
      "Targets picked on the board, not in a list. attacks[] is re-indexed after every cycle — the client resolves by {controller,location,sequence}, never by index.",
    steps: [
      {
        decision: idleC,
        state: state(z0, { turnNumber: 8 }),
        clockSeconds: 300,
        onClockSeat: 0,
        expect: { phase: "BP" },
        note: "Click BP on the phase rail. It is always there — it is not inside a decision panel.",
      },
      {
        decision: battle1,
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        latencyMs: 200,
        clockSeconds: 296,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "MZONE", sequence: 0 }, verb: "Attack" },
        note: "BattleCommand also arms the board — no bar. Attackers carry a » glyph.",
      },
      {
        decision: {
          kind: "SelectCard",
          player: 0,
          cards: [
            { code: KREBONS, name: "Krebons", controller: 1, location: "MZONE", sequence: 0 },
          ],
          min: 1,
          max: 1,
          cancelable: true,
        },
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        intent: {
          label: 'Attacking with "Caius the Shadow Monarch"',
          cardCode: CAIUS,
          steps: ["Target"],
          stepIndex: 0,
          commitAt: 99,
          cancelable: true,
        },
        latencyMs: 160,
        caption: 'Attack with "Caius the Shadow Monarch" — choose a target',
        highlight: [{ controller: 1, location: "MZONE", sequence: 0 }],
        events: [
          { engineType: 110, owner: 0, code: CAIUS, verb: "Attack", turnNumber: 8, phase: "BP" },
        ],
      },
      {
        decision: null,
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        latencyMs: 1200,
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        clockSeconds: 300,
      },
      {
        decision: battle2,
        state: state(z1, { turnNumber: 8, phase: "BP", lp: [8000, 6800] }),
        latencyMs: 700,
        clockSeconds: 290,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "MZONE", sequence: 1 }, verb: "Attack directly" },
        events: [
          {
            engineType: 111,
            owner: 0,
            code: CAIUS,
            verb: "Attack",
            amount: 2400,
            turnNumber: 8,
            phase: "BP",
          },
          {
            engineType: 111,
            owner: 1,
            code: KREBONS,
            verb: "Destroyed",
            from: "MZONE",
            to: "GRAVE",
            turnNumber: 8,
            phase: "BP",
          },
          {
            engineType: 91,
            owner: 1,
            code: CAIUS,
            verb: "Damage",
            amount: 1200,
            turnNumber: 8,
            phase: "BP",
          },
        ],
        note: "Caius is GONE from attacks[]. Its » glyph is greyed — absence made visible.",
      },
      {
        decision: battle3,
        state: state(z1, { turnNumber: 8, phase: "BP", lp: [8000, 6400] }),
        latencyMs: 900,
        clockSeconds: 284,
        onClockSeat: 0,
        expect: { phase: "EP" },
        events: [
          { engineType: 110, owner: 0, code: TROOPER, verb: "Attack", turnNumber: 8, phase: "BP" },
          {
            engineType: 91,
            owner: 1,
            code: TROOPER,
            verb: "Damage",
            amount: 400,
            turnNumber: 8,
            phase: "BP",
          },
        ],
        note: "canDirectAttack === true → the client answers the follow-up SelectCard itself. Two clicks, not three.",
      },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// D · Off-clock, clock escalation, forfeit
// ─────────────────────────────────────────────────────────────────────────────

const scenarioD: Scenario = (() => {
  const z0 = emptyZones();
  z0.p0_hand = [handCard(GORZ, 0), handCard(CYBER, 1), handCard(BOOK, 2)];
  z0.p0_mzone = row([mon(TROOPER, 0, 400, 400, 3)]);
  z0.p0_szone = row([setCard(DPRISON, 0)]);
  z0.p1_hand = backs(4);
  z0.p1_mzone = row([]);
  z0.p1_szone = row([setCard(0, 0)]);
  z0.p0_deckCount = 26;
  z0.p1_deckCount = 25;

  const z1 = clone(z0);
  z1.p1_hand = backs(3);
  z1.p1_mzone = row([mon(CAIUS, 0, 2400, 1000, 6)]);

  const idleD: DuelDecision = {
    kind: "IdleCommand",
    player: 0,
    summons: [],
    specialSummons: [
      { code: CYBER, name: "Cyber Dragon", controller: 0, location: "HAND", sequence: 1 },
    ],
    posChanges: [
      { code: TROOPER, name: "Card Trooper", controller: 0, location: "MZONE", sequence: 0 },
    ],
    monsterSets: [],
    spellSets: [{ code: BOOK, name: "Book of Moon", controller: 0, location: "HAND", sequence: 2 }],
    activates: [],
    toBattlePhase: true,
    toEndPhase: true,
  };

  return {
    id: "waiting-clock-end",
    title: "Waiting · clock · forfeit",
    blurb:
      "Half of every duel is spent off-clock. Three states that render identically today — opponent thinking, engine busy, you disconnected — are three different screens here. Then the clock runs out.",
    steps: [
      {
        decision: null,
        state: state(z0, { turnNumber: 11, currentTurn: 1, phase: "DP" }),
        latencyMs: 200,
        waitLabel: "Sakura is deciding",
        onClockSeat: 1,
        clockSeconds: 268,
        events: [
          {
            engineType: 90,
            owner: 1,
            code: 0,
            verb: "Draw",
            from: "DECK",
            to: "HAND",
            turnNumber: 11,
            phase: "DP",
          },
        ],
        note: "Off-clock. Their clock counts. You can inspect anything; nothing you do is broadcast.",
      },
      {
        decision: null,
        state: state(z1, { turnNumber: 11, currentTurn: 1, phase: "M1" }),
        latencyMs: 1800,
        waitLabel: "Sakura is deciding",
        onClockSeat: 1,
        clockSeconds: 244,
        autoPush: CAIUS,
        events: [
          { engineType: 41, owner: 1, code: 0, verb: "Move", turnNumber: 11, phase: "M1" },
          {
            engineType: 60,
            owner: 1,
            code: CAIUS,
            verb: "Summon",
            from: "HAND",
            to: "MZONE",
            turnNumber: 11,
            phase: "M1",
          },
        ],
        note: "Their card text is auto-pushed to the inspector the moment they play it. You are never guessing.",
      },
      {
        decision: idleD,
        state: state(z1, { turnNumber: 12, currentTurn: 0, phase: "M1" }),
        latencyMs: 1400,
        onClockSeat: 0,
        clockSeconds: 52,
        expect: { ref: { controller: 0, location: "HAND", sequence: 1 }, verb: "Special Summon" },
        events: [
          { engineType: 40, owner: 0, code: 0, verb: "Move", turnNumber: 12, phase: "DP" },
          {
            engineType: 90,
            owner: 0,
            code: 0,
            verb: "Draw",
            from: "DECK",
            to: "HAND",
            turnNumber: 12,
            phase: "DP",
          },
        ],
        note: "≤60s: the clock badge goes amber and doubles. Try to act — or wait and watch it escalate.",
      },
      {
        decision: idleD,
        state: state(z1, { turnNumber: 12, currentTurn: 0, phase: "M1" }),
        latencyMs: 400,
        onClockSeat: 0,
        clockSeconds: 8,
        note: "≤10s: the board edge pulses and the badge states the consequence. A timeout forfeits the duel.",
      },
      {
        decision: null,
        state: state(z1, { turnNumber: 12, currentTurn: 0, phase: "M1", duelEnded: true }),
        latencyMs: 900,
        onClockSeat: 0,
        clockSeconds: 0,
        end: { winner: 1, reason: "timeout" },
      },
    ],
  };
})();

export const SCENARIOS: Scenario[] = [scenarioA, scenarioB, scenarioC, scenarioD];
