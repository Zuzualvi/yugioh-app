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
  ZoneCard,
} from "./types";
import {
  POS_FACEUP_ATK,
  POS_FACEUP_DEF,
  backs,
  clone,
  emptyZones,
  handCard,
  mon,
  row,
  setCard,
  state,
} from "./board";

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
  /** what the waiting player is told while this step is being computed */
  waitLabel?: string;
  /** clocks are per SEAT and per handover of control; both are always on screen */
  myClockSeconds?: number;
  oppClockSeconds?: number;
  onClockSeat?: Seat;
  /** board cards highlighted as candidates/targets alongside the Question Bar */
  highlight?: CardRef[];
  /**
   * Set when the CLIENT answers this decision without showing it (§15 register).
   * The prototype renders it as a READ-ONLY RECEIPT so a reviewer can see what a
   * player would not — never as a live question with a primary button.
   */
  autoResolved?: string;
  /** Where "No response" / "Cancel" actually goes. Never the same as confirming. */
  declineBranch?: Step[];
  /** Fold the player's real selection into the next step's board. */
  applySelection?: (next: DuelStateSnapshot, selection: CardRef[]) => DuelStateSnapshot;
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
  /** Prior turns. A log that says "the duel has not started" on turn 8 is a lie. */
  seedLog?: Omit<DuelEvent, "id">[];
  /** LP as at each turn BOUNDARY — not live LP repeated under every banner. */
  lpByTurn?: Record<number, [number, number]>;
  steps: Step[];
}

const ev = (
  engineType: number,
  owner: Seat,
  code: number,
  verb: DuelEvent["verb"],
  turnNumber: number,
  phase: DuelEvent["phase"],
  extra: { from?: LocationCode; to?: LocationCode; amount?: number; lpOwner?: Seat } = {},
): Omit<DuelEvent, "id"> => ({ engineType, owner, code, verb, turnNumber, phase, ...extra });

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

/** B3 — honour the tribute the player actually picked. */
function applyTribute(next: DuelStateSnapshot, sel: CardRef[]): DuelStateSnapshot {
  const pick = sel.find((r) => r.location === "MZONE" && r.controller === 0);
  if (!pick) return next;
  const s: DuelStateSnapshot = JSON.parse(JSON.stringify(next));
  const base = baseZonesA();
  const tributed = base.p0_mzone[pick.sequence] as ZoneCard;
  const mz: (ZoneCard | null)[] = base.p0_mzone.map((c) => (c ? { ...c } : null));
  mz[pick.sequence] = { ...mon(CAIUS, pick.sequence, 2400, 1000, 6) };
  s.zones.p0_mzone = mz;
  s.zones.p0_grave = [
    { code: tributed.code, sequence: 0, position: 1 },
    { code: TREEBORN, sequence: 1, position: 1 },
  ];
  s.zones.p0_hand = [
    handCard(BOOK, 0),
    handCard(TORRENTIAL, 1),
    handCard(CYBER, 2),
    handCard(GORZ, 3),
  ];
  return s;
}

/** M4 — the chosen battle position must be visible on the board. */
function applyPosition(next: DuelStateSnapshot, sel: CardRef[]): DuelStateSnapshot {
  const pick = sel.find((r) => r.location === "PZONE");
  const s: DuelStateSnapshot = JSON.parse(JSON.stringify(next));
  const pos = pick?.sequence === 1 ? POS_FACEUP_DEF : POS_FACEUP_ATK;
  s.zones.p0_mzone = s.zones.p0_mzone.map((c) =>
    c && c.code === CAIUS ? { ...c, position: pos } : c,
  );
  return s;
}

const seedLogA: Omit<DuelEvent, "id">[] = [
  ev(40, 0, 0, "Move", 3, "DP"),
  ev(90, 1, 0, "Draw", 3, "DP", { from: "DECK", to: "HAND" }),
  ev(60, 1, KREBONS, "Summon", 3, "M1", { from: "HAND", to: "MZONE" }),
  ev(54, 1, 0, "Set", 3, "M1", { from: "HAND", to: "SZONE" }),
  ev(54, 1, 0, "Set", 3, "M1", { from: "HAND", to: "SZONE" }),
  ev(40, 0, 0, "Move", 4, "DP"),
  ev(90, 0, TROOPER, "Draw", 4, "DP", { from: "DECK", to: "HAND" }),
  ev(60, 0, JUNK, "Summon", 4, "M1", { from: "HAND", to: "MZONE" }),
];

const scenarioA: Scenario = (() => {
  const z0 = baseZonesA();

  // default post-commit board (overwritten by applyTribute with the real pick)
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

  const z2 = clone(z1);
  z2.p1_mzone = row([]);
  z2.p1_removed = [{ code: KREBONS, sequence: 0, position: 1 }];

  return {
    id: "tribute-summon",
    title: "Tribute Summon Caius",
    blurb:
      "The flagship. One player intent → up to 6 engine decisions, one clock, one ribbon, and an explicit point of no return.",
    seedLog: seedLogA,
    lpByTurn: { 3: [8000, 8000], 4: [8000, 8000] },
    steps: [
      {
        decision: idleA,
        state: state(z0),
        myClockSeconds: 285,
        oppClockSeconds: 300,
        onClockSeat: 0,
        expect: {
          ref: { controller: 0, location: "HAND", sequence: 0 },
          verb: "Normal Summon — 1 tribute",
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
        applySelection: applyTribute,
        caption: 'Tribute 1 monster to Summon "Caius the Shadow Monarch"',
        highlight: [
          { controller: 0, location: "MZONE", sequence: 0 },
          { controller: 0, location: "MZONE", sequence: 1 },
          { controller: 0, location: "MZONE", sequence: 2 },
        ],
        note: "Cancel is live here and Esc maps to it. The confirm button names the card it will destroy, because the NEXT step cannot be cancelled.",
      },
      {
        decision: {
          kind: "SelectZone",
          player: 0,
          count: 1,
          zones: [
            { controller: 0, location: "MZONE", sequence: 3 },
            { controller: 0, location: "MZONE", sequence: 4 },
          ],
        },
        state: state(z1),
        intent: intentA(1, false),
        latencyMs: 220,
        autoResolved: "Zone — the freed monster zone. Turn on “Choose zones” to be asked instead.",
        events: [
          ev(60, 0, CAIUS, "Tribute Summon", 4, "M1", { from: "HAND", to: "MZONE" }),
          ev(50, 0, TROOPER, "Move", 4, "M1", { from: "MZONE", to: "GRAVE" }),
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
        applySelection: applyPosition,
        note: "Past the lock. The ribbon says COMMITTED — it does not offer a Cancel that would fail. Each position tile IS the commit; there is no second Confirm click.",
      },
      {
        decision: null,
        state: state(z1),
        intent: intentA(2, false),
        latencyMs: 1500,
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        note: "The off-clock gap. Their clock runs, yours is banked and still on screen. You can inspect anything, free and silent.",
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
        note: "The target set spans BOTH fields. It is picked on the board, not in a list — that is what ZoneCard.sequence (MH-1) buys.",
      },
      {
        decision: idleA,
        state: state(z2, { lp: [8000, 7000] }),
        intent: null,
        latencyMs: 900,
        waitLabel: "Resolving Caius…",
        onClockSeat: 0,
        chain: [],
        events: [
          ev(70, 0, CAIUS, "Chain", 4, "M1", { from: "MZONE", to: "MZONE" }),
          ev(83, 1, KREBONS, "Target", 4, "M1", { from: "MZONE", to: "MZONE" }),
          ev(50, 1, KREBONS, "Banish", 4, "M1", { from: "MZONE", to: "REMOVED" }),
          ev(91, 1, CAIUS, "Damage", 4, "M1", { amount: 1000, lpOwner: 1 }),
        ],
        note: "Intent complete. Ribbon gone, board live again, and the log says exactly what happened.",
      },
    ],
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// B · Respond to a chain — with a REAL decline branch
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

  // DECLINE branch: Torrential resolves. Every monster dies. LP untouched.
  const d1 = clone(z2);
  d1.p0_mzone = row([]);
  d1.p1_mzone = row([]);
  d1.p0_grave = [
    { code: JUNK, sequence: 0, position: 1 },
    { code: TROOPER, sequence: 1, position: 1 },
  ];
  d1.p1_grave = [{ code: KREBONS, sequence: 0, position: 1 }];
  const d2 = clone(d1);
  d2.p1_szone = row([null, setCard(0, 1)]);
  d2.p1_grave = [
    { code: TORRENTIAL, sequence: 0, position: 1 },
    { code: KREBONS, sequence: 1, position: 1 },
  ];

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

  const idleAfterDecline: DuelDecision = {
    kind: "IdleCommand",
    player: 0,
    summons: [],
    specialSummons: [
      { code: CYBER, name: "Cyber Dragon", controller: 0, location: "HAND", sequence: 1 },
    ],
    posChanges: [],
    monsterSets: [],
    spellSets: [],
    activates: [],
    toBattlePhase: false,
    toEndPhase: true,
  };

  const declineBranch: Step[] = [
    {
      decision: null,
      state: state(z2, { turnNumber: 6 }),
      latencyMs: 700,
      waitLabel: "Passing — Torrential Tribute resolves…",
      onClockSeat: 1,
      chain: [{ ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "resolving" }],
      autoPush: TORRENTIAL,
      events: [ev(72, 1, TORRENTIAL, "Resolve", 6, "M1")],
      note: "You declined. Nothing of yours was spent — LP is still 8000. This is what the decline branch costs instead.",
    },
    {
      decision: idleAfterDecline,
      state: state(d2, { turnNumber: 6 }),
      latencyMs: 1100,
      onClockSeat: 0,
      chain: [],
      events: [
        ev(50, 0, JUNK, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 0, TROOPER, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 1, KREBONS, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 1, TORRENTIAL, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
      ],
      note: "Both boards wiped, LP 8000 vs 8000. Compare with the Activate branch, which costs 4000 LP and saves the board.",
    },
  ];

  return {
    id: "chain-response",
    title: "Respond to a chain",
    blurb:
      "The interaction the format is built on. One Question Bar naming the card, candidates badged by location, and a decline that really declines.",
    lpByTurn: { 5: [8000, 8000], 6: [8000, 8000] },
    seedLog: [
      ev(40, 1, 0, "Move", 5, "DP"),
      ev(90, 1, 0, "Draw", 5, "DP", { from: "DECK", to: "HAND" }),
      ev(60, 1, KREBONS, "Summon", 5, "M1", { from: "HAND", to: "MZONE" }),
      ev(54, 1, 0, "Set", 5, "M1", { from: "HAND", to: "SZONE" }),
      ev(40, 0, 0, "Move", 6, "DP"),
      ev(90, 0, JUNK, "Draw", 6, "DP", { from: "DECK", to: "HAND" }),
    ],
    steps: [
      {
        decision: idleB,
        state: state(z0, { turnNumber: 6 }),
        myClockSeconds: 240,
        oppClockSeconds: 300,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "HAND", sequence: 0 }, verb: "Normal Summon" },
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
        events: [ev(60, 0, JUNK, "Summon", 6, "M1", { from: "HAND", to: "MZONE" })],
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        autoResolved: "Zone — leftmost free monster zone.",
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
        onClockSeat: 0,
        chain: [{ ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" }],
        autoPush: TORRENTIAL,
        declineBranch,
        highlight: [
          { controller: 0, location: "SZONE", sequence: 0 },
          { controller: 0, location: "SZONE", sequence: 1 },
        ],
        note: "Line 1 names the card, the owner and the location. “No response” takes a genuinely different branch — try both.",
      },
      {
        decision: null,
        state: state(z3, { turnNumber: 6, lp: [4000, 8000] }),
        latencyMs: 1400,
        waitLabel: "Sakura may respond…",
        onClockSeat: 1,
        chain: [
          { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
          { ordinal: 2, code: SOLEMN, owner: 0, location: "SZONE", state: "declared" },
        ],
        events: [
          ev(70, 0, SOLEMN, "Chain", 6, "M1", { from: "SZONE", to: "SZONE" }),
          ev(100, 0, SOLEMN, "Damage", 6, "M1", { amount: 4000, lpOwner: 0 }),
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
        waitLabel: "Chain resolving — link 2 of 2…",
        onClockSeat: 1,
        note: "The strip unwinds right-to-left and pushes each resolving link's text into the inspector. No click.",
      },
      {
        decision: idleB,
        state: state(z4, { turnNumber: 6, lp: [4000, 8000] }),
        latencyMs: 900,
        waitLabel: "Chain resolving — link 1 of 2…",
        chain: [],
        onClockSeat: 0,
        events: [
          ev(72, 0, SOLEMN, "Resolve", 6, "M1"),
          ev(73, 1, TORRENTIAL, "Negated", 6, "M1", { from: "SZONE", to: "GRAVE" }),
          ev(50, 0, SOLEMN, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
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

  const zSpent = clone(z0);
  zSpent.p0_mzone = row([
    { ...mon(CAIUS, 0, 2400, 1000, 6), attacked: true },
    mon(TROOPER, 1, 400, 400, 3),
  ]);
  zSpent.p1_mzone = row([]);
  zSpent.p1_grave = [{ code: KREBONS, sequence: 0, position: 1 }];

  const zBoth = clone(zSpent);
  zBoth.p0_mzone = row([
    { ...mon(CAIUS, 0, 2400, 1000, 6), attacked: true },
    { ...mon(TROOPER, 1, 400, 400, 3), attacked: true },
  ]);

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

  const attackIntent = (label: string, stepIndex: number): PendingIntent => ({
    label,
    cardCode: CAIUS,
    // M11 — one commit model. Target selection is cancelable (ocgcore can_cancel:true);
    // once it is answered the attack is DECLARED and cannot be rescinded.
    steps: ["Target", "Declared"],
    stepIndex,
    commitAt: 1,
    cancelable: stepIndex === 0,
  });

  return {
    id: "battle",
    title: "Attack with everything",
    blurb:
      "Targets picked on the board, not in a list. attacks[] is re-indexed after every cycle — the client resolves by {controller,location,sequence}, never by index.",
    lpByTurn: { 7: [8000, 8000], 8: [8000, 8000] },
    seedLog: [
      ev(40, 0, 0, "Move", 7, "DP"),
      ev(90, 1, 0, "Draw", 7, "DP", { from: "DECK", to: "HAND" }),
      ev(54, 1, 0, "Set", 7, "M1", { from: "HAND", to: "SZONE" }),
      ev(40, 0, 0, "Move", 8, "DP"),
      ev(90, 0, GORZ, "Draw", 8, "DP", { from: "DECK", to: "HAND" }),
      ev(60, 0, CAIUS, "Tribute Summon", 8, "M1", { from: "HAND", to: "MZONE" }),
    ],
    steps: [
      {
        decision: idleC,
        state: state(z0, { turnNumber: 8 }),
        myClockSeconds: 300,
        oppClockSeconds: 300,
        onClockSeat: 0,
        expect: { phase: "BP" },
        note: "Click BP on the phase rail. It is always there — it is not inside a decision panel.",
      },
      {
        decision: battle1,
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        latencyMs: 200,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "MZONE", sequence: 0 }, verb: "Attack" },
        note: "BattleCommand also arms the board — no bar. Monsters that can still attack carry the ATTACK badge.",
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
        intent: attackIntent('Attacking with "Caius the Shadow Monarch"', 0),
        latencyMs: 160,
        caption: 'Attack with "Caius the Shadow Monarch" — choose a target',
        highlight: [{ controller: 1, location: "MZONE", sequence: 0 }],
        note: "Cancel is live while you are still choosing a target — the engine allows it (can_cancel: true). It goes away the moment the attack is declared.",
      },
      {
        decision: null,
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        intent: attackIntent('Attacking with "Caius the Shadow Monarch"', 1),
        latencyMs: 1200,
        waitLabel: "Attack declared — Sakura may respond…",
        onClockSeat: 1,
        events: [ev(110, 0, CAIUS, "Attack", 8, "BP")],
        note: "Declared. The ribbon now reads COMMITTED and Cancel is gone — the same commit model as a summon.",
      },
      {
        decision: null,
        state: state(z0, { turnNumber: 8, phase: "BP" }),
        intent: attackIntent('Attacking with "Caius the Shadow Monarch"', 1),
        latencyMs: 800,
        waitLabel: "Damage step — Caius 2400 vs Krebons 1200…",
        onClockSeat: 1,
        note: "The ~2s gap between Confirm and the LP change is now labelled at every beat, so it reads as resolving rather than frozen.",
      },
      {
        decision: battle2,
        state: state(zSpent, { turnNumber: 8, phase: "BP", lp: [8000, 6800] }),
        latencyMs: 500,
        onClockSeat: 0,
        expect: { ref: { controller: 0, location: "MZONE", sequence: 1 }, verb: "Attack directly" },
        events: [
          ev(111, 0, CAIUS, "Attack", 8, "BP", { amount: 2400 }),
          ev(111, 1, KREBONS, "Destroyed", 8, "BP", { from: "MZONE", to: "GRAVE" }),
          ev(91, 1, CAIUS, "Damage", 8, "BP", { amount: 1200, lpOwner: 1 }),
        ],
        note: "Caius is GONE from attacks[]. Its badge greys out — absence made visible.",
      },
      {
        decision: battle3,
        state: state(zBoth, { turnNumber: 8, phase: "BP", lp: [8000, 6400] }),
        latencyMs: 900,
        waitLabel: "Direct attack resolving…",
        onClockSeat: 0,
        expect: { phase: "EP" },
        events: [
          ev(110, 0, TROOPER, "Attack", 8, "BP"),
          ev(91, 1, TROOPER, "Damage", 8, "BP", { amount: 400, lpOwner: 1 }),
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
      "Half of every duel is spent off-clock. Then your own clock — which has been banked and visible the whole time — runs out, and a timeout forfeits the duel. Takes about 40 seconds; do nothing and watch.",
    lpByTurn: { 9: [8000, 8000], 10: [8000, 8000], 11: [8000, 8000], 12: [8000, 8000] },
    seedLog: [
      ev(40, 1, 0, "Move", 9, "DP"),
      ev(90, 1, 0, "Draw", 9, "DP", { from: "DECK", to: "HAND" }),
      ev(54, 1, 0, "Set", 9, "M1", { from: "HAND", to: "SZONE" }),
      ev(40, 0, 0, "Move", 10, "DP"),
      ev(90, 0, TROOPER, "Draw", 10, "DP", { from: "DECK", to: "HAND" }),
      ev(60, 0, TROOPER, "Summon", 10, "M1", { from: "HAND", to: "MZONE" }),
      ev(54, 0, DPRISON, "Set", 10, "M1", { from: "HAND", to: "SZONE" }),
    ],
    steps: [
      {
        decision: null,
        state: state(z0, { turnNumber: 11, currentTurn: 1, phase: "DP" }),
        latencyMs: 200,
        waitLabel: "Sakura is deciding",
        onClockSeat: 1,
        myClockSeconds: 34,
        oppClockSeconds: 268,
        events: [ev(90, 1, 0, "Draw", 11, "DP", { from: "DECK", to: "HAND" })],
        note: "Off-clock. THEIR clock is ticking; YOURS is banked at 0:34 and still on screen — that is the number you need to decide whether to think.",
      },
      {
        decision: null,
        state: state(z1, { turnNumber: 11, currentTurn: 1, phase: "M1" }),
        latencyMs: 3000,
        waitLabel: "Sakura is deciding",
        onClockSeat: 1,
        autoPush: CAIUS,
        events: [
          ev(41, 1, 0, "Move", 11, "M1"),
          ev(60, 1, CAIUS, "Summon", 11, "M1", { from: "HAND", to: "MZONE" }),
        ],
        note: "Their card text is auto-pushed the moment they play it. You are never guessing.",
      },
      {
        decision: idleD,
        state: state(z1, { turnNumber: 12, currentTurn: 0, phase: "M1" }),
        latencyMs: 1400,
        onClockSeat: 0,
        events: [
          ev(40, 0, 0, "Move", 12, "DP"),
          ev(90, 0, 0, "Draw", 12, "DP", { from: "DECK", to: "HAND" }),
        ],
        expect: { ref: { controller: 0, location: "HAND", sequence: 1 }, verb: "Special Summon" },
        note: "Your clock resumes from 0:34 — it did NOT reset. Do nothing and watch it escalate: amber at 1:00, alarm at 0:30, seconds at 0:10.",
      },
      {
        decision: null,
        state: state(z1, { turnNumber: 12, currentTurn: 0, phase: "M1", duelEnded: true }),
        latencyMs: 400,
        onClockSeat: 0,
        end: { winner: 1, reason: "timeout" },
      },
    ],
  };
})();

export const SCENARIOS: Scenario[] = [scenarioA, scenarioB, scenarioC, scenarioD];
