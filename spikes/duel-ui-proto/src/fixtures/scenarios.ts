/**
 * Recorded-shape fixtures, played back as scripted scenarios.
 *
 * ── THE RULE THAT MATTERS ───────────────────────────────────────────────────
 * A board is a FUNCTION OF THE CHOICES MADE, never a hardcoded snapshot, and a
 * step's continuation is `branch(answer)`. Revision 2 kept snapshots and keyed
 * continuations to the step, which is why the same bug shipped three times:
 *   B3   tribute selection ignored — always tributed Card Trooper
 *   B4   decline and confirm produced identical outcomes
 *   CEO  chain activation ignored — Book of Moon played Solemn Judgment
 * A spot check on one answer cannot detect an outcome keyed to the step. So the
 * invariant is now structural: **any decision with more than one legal answer
 * defines `branch`, and `branch` receives the answer.**
 *
 * Decision payloads are shaped exactly like packages/contracts/src/duelDecision.ts.
 * Board payloads use the MH-1 extended snapshot (see types.ts header).
 */

import type {
  CardEntry,
  ChainLink,
  DuelDecision,
  DuelEvent,
  DuelStateSnapshot,
  DuelZones,
  LocationCode,
  PendingIntent,
  Seat,
  ZoneCard,
} from "./types";
import {
  POS_FACEDOWN_DEF,
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
import { cardName } from "./cards";

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

/** Cards whose banish by Caius inflicts 1000 damage ("if it is a DARK monster"). */
const DARK_MONSTERS = new Set([CAIUS, KREBONS, SANGAN, JUNK, GORZ]);

export interface CardRef {
  controller: Seat;
  location: LocationCode;
  sequence: number;
}

/** What the player answered. Every continuation is a function of this. */
export type Answer =
  { kind: "confirm"; selection: CardRef[]; codes: number[] } | { kind: "decline" };

export function candidateCodes(d: DuelDecision | null, sel: CardRef[]): number[] {
  if (!d) return [];
  const pool: CardEntry[] =
    d.kind === "ChainPrompt"
      ? d.selects
      : d.kind === "SelectCard" || d.kind === "SelectTribute"
        ? d.cards
        : d.kind === "SelectUnselectCard"
          ? [...d.selectCards, ...d.unselectCards]
          : [];
  return sel.map(
    (r) =>
      pool.find(
        (c) =>
          c.controller === r.controller && c.location === r.location && c.sequence === r.sequence,
      )?.code ?? 0,
  );
}

const pick = (a: Answer): CardRef | null =>
  a.kind === "confirm" ? (a.selection[0] ?? null) : null;
const pickCode = (a: Answer): number | null => (a.kind === "confirm" ? (a.codes[0] ?? null) : null);

export interface Step {
  decision: DuelDecision | null;
  state: DuelStateSnapshot;
  intent?: PendingIntent | null;
  chain?: ChainLink[];
  events?: Omit<DuelEvent, "id">[];
  autoPush?: number;
  caption?: string;
  latencyMs?: number;
  waitLabel?: string;
  myClockSeconds?: number;
  oppClockSeconds?: number;
  onClockSeat?: Seat;
  highlight?: CardRef[];
  autoResolved?: string;
  /**
   * The ONLY way this step leads anywhere. Receives the answer.
   * Returning undefined means: fall through to the next step (confirm) or replay from
   * the top (decline). A step with more than one legal answer MUST define this.
   */
  branch?: (a: Answer) => Step[] | undefined;
  end?: { winner: Seat | null; reason: "normal" | "timeout" | "resign" };
  note?: string;
  /** Prototype-only: which ACT-mode action this scripted step is waiting for. */
  expect?: { ref: CardRef; verb: string } | { phase: "DP" | "SP" | "M1" | "BP" | "M2" | "EP" };
}

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  seedLog?: Omit<DuelEvent, "id">[];
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

// ═════════════════════════════════════════════════════════════════════════════
// A · Tribute Summon Caius
// ═════════════════════════════════════════════════════════════════════════════

interface ChoicesA {
  trib?: number; // own MZONE sequence tributed
  zone?: number; // where Caius landed
  pos?: number; // POS_FACEUP_ATK | POS_FACEUP_DEF
  banish?: CardRef; // Caius trigger target
  /** false at the zone step: the tribute is paid but Caius is not on the field yet */
  placed?: boolean;
}

const A_OWN: Record<number, ZoneCard> = {
  0: mon(TROOPER, 0, 400, 400, 3),
  1: mon(SANGAN, 1, 1000, 600, 3),
  2: mon(JUNK, 2, 1300, 500, 3),
};
/** what the opponent's two set cards really are — revealed only when they leave the field */
const A_OPP_SET: Record<number, number> = { 0: BOTTOMLESS, 1: DPRISON };

function zonesA(c: ChoicesA): DuelZones {
  const z = emptyZones();
  z.p0_szone = row([setCard(MST, 0)]);
  z.p1_hand = backs(4);
  z.p0_deckCount = 30;
  z.p1_deckCount = 32;

  const mz: (ZoneCard | null)[] = [null, null, null, null, null];
  for (const k of [0, 1, 2]) if (c.trib !== k) mz[k] = { ...A_OWN[k] };
  if (c.trib !== undefined && c.placed !== false) {
    const at = c.zone ?? c.trib;
    mz[at] = { ...mon(CAIUS, at, 2400, 1000, 6, c.pos ?? POS_FACEUP_ATK) };
  }
  z.p0_mzone = mz.map((x, i) => (x ? { ...x, sequence: i } : null));

  z.p0_grave =
    c.trib !== undefined
      ? [
          { code: A_OWN[c.trib].code, sequence: 0, position: 1 },
          { code: TREEBORN, sequence: 1, position: 1 },
        ]
      : [{ code: TREEBORN, sequence: 0, position: 1 }];

  z.p0_hand =
    c.trib !== undefined
      ? [handCard(BOOK, 0), handCard(TORRENTIAL, 1), handCard(CYBER, 2), handCard(GORZ, 3)]
      : [
          handCard(CAIUS, 0),
          handCard(BOOK, 1),
          handCard(TORRENTIAL, 2),
          handCard(CYBER, 3),
          handCard(GORZ, 4),
        ];

  // opponent side, minus whatever Caius banished
  const b = c.banish;
  z.p1_mzone = row(b?.location === "MZONE" ? [] : [mon(KREBONS, 0, 1200, 400, 2)]);
  z.p1_szone = row([
    b?.location === "SZONE" && b.sequence === 0 ? null : setCard(0, 0),
    b?.location === "SZONE" && b.sequence === 1 ? null : setCard(0, 1),
  ]);
  z.p1_removed = b
    ? [{ code: b.location === "MZONE" ? KREBONS : A_OPP_SET[b.sequence], sequence: 0, position: 1 }]
    : [];
  return z;
}

function banishedCodeA(r: CardRef): number {
  return r.location === "MZONE" ? KREBONS : A_OPP_SET[r.sequence];
}
function oppLpA(c: ChoicesA): number {
  if (!c.banish) return 8000;
  return DARK_MONSTERS.has(banishedCodeA(c.banish)) ? 7000 : 8000;
}
const stA = (c: ChoicesA) => state(zonesA(c), { lp: [8000, oppLpA(c)] });

const intentA = (stepIndex: number, cancelable: boolean): PendingIntent => ({
  label: 'Tribute Summoning "Caius the Shadow Monarch"',
  cardCode: CAIUS,
  steps: ["Tributes", "Zone", "Position"],
  stepIndex,
  commitAt: 1,
  cancelable,
  trailingUnknown: true,
});
const triggerIntent = (stepIndex: number): PendingIntent => ({
  label: "Caius the Shadow Monarch — Tribute Summon trigger",
  cardCode: CAIUS,
  steps: ["Activate?", "Target"],
  stepIndex,
  commitAt: 99,
  cancelable: true,
});

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

/** last leg: the intent is over, the board is live again */
const idleAfterA = (
  c: ChoicesA,
  events: Omit<DuelEvent, "id">[],
  note: string,
  wait?: string,
): Step[] => [
  {
    decision: idleA,
    state: stA(c),
    intent: null,
    latencyMs: 900,
    waitLabel: wait,
    onClockSeat: 0,
    chain: [],
    events,
    note,
  },
];

function resolveBanishA(c: ChoicesA, target: CardRef): Step[] {
  const done: ChoicesA = { ...c, banish: target };
  const code = banishedCodeA(target);
  const dark = DARK_MONSTERS.has(code);
  return idleAfterA(
    done,
    [
      ev(70, 0, CAIUS, "Chain", 4, "M1", { from: "MZONE", to: "MZONE" }),
      ev(83, 1, code, "Target", 4, "M1", { from: target.location, to: target.location }),
      ev(50, 1, code, "Banish", 4, "M1", { from: target.location, to: "REMOVED" }),
      ...(dark ? [ev(91, 1, CAIUS, "Damage", 4, "M1", { amount: 1000, lpOwner: 1 as Seat })] : []),
    ],
    `Banished ${cardName(code)}.${dark ? " It is a DARK monster, so Caius also inflicted 1000 damage." : " Not a DARK monster, so no damage — the outcome follows the card you picked."}`,
    "Resolving Caius…",
  );
}

function targetStepA(c: ChoicesA): Step[] {
  const cards: CardEntry[] = [
    { code: KREBONS, name: "Krebons", controller: 1, location: "MZONE", sequence: 0 },
    { code: 0, name: "", controller: 1, location: "SZONE", sequence: 0 },
    { code: 0, name: "", controller: 1, location: "SZONE", sequence: 1 },
  ];
  return [
    {
      decision: { kind: "SelectCard", player: 0, cards, min: 1, max: 1, cancelable: true },
      state: stA(c),
      intent: triggerIntent(1),
      latencyMs: 200,
      caption: 'Banish 1 card on the field — "Caius the Shadow Monarch"',
      chain: [{ ordinal: 1, code: CAIUS, owner: 0, location: "MZONE", state: "declared" }],
      autoPush: CAIUS,
      highlight: cards.map((x) => ({
        controller: x.controller,
        location: x.location,
        sequence: x.sequence,
      })),
      branch: (a) =>
        a.kind === "decline"
          ? declineTriggerA(c, "Target selection cancelled — the trigger did not resolve.")
          : resolveBanishA(c, pick(a)!),
      note: "Three legal targets, three different outcomes. Krebons is a DARK monster, so banishing it also costs Sakura 1000 LP; the two set cards cost nothing and reveal themselves as they leave.",
    },
  ];
}

const declineTriggerA = (c: ChoicesA, note: string): Step[] =>
  idleAfterA(
    c,
    [ev(74, 0, CAIUS, "Resolve", 4, "M1")],
    note + " Caius is on the field, Sakura keeps everything, LP untouched.",
  );

function triggerStepA(c: ChoicesA): Step[] {
  return [
    {
      decision: null,
      state: stA(c),
      intent: intentA(2, false),
      latencyMs: 1500,
      waitLabel: "Sakura may respond…",
      onClockSeat: 1,
      note: "The off-clock gap. Their clock runs, yours is banked and still on screen.",
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
            sequence: c.zone ?? c.trib ?? 0,
            description: "Banish 1 card on the field",
          },
        ],
      },
      state: stA(c),
      intent: triggerIntent(0),
      latencyMs: 260,
      onClockSeat: 0,
      chain: [],
      branch: (a) =>
        a.kind === "decline" ? declineTriggerA(c, "You declined the trigger.") : targetStepA(c),
      note: "Two answers, two outcomes: activate and pick a target, or decline and keep the board as it is.",
    },
  ];
}

function positionStepA(c: ChoicesA): Step[] {
  return [
    {
      decision: {
        kind: "SelectPosition",
        player: 0,
        card: {
          code: CAIUS,
          name: "Caius the Shadow Monarch",
          controller: 0,
          location: "MZONE",
          sequence: c.zone ?? c.trib ?? 0,
        },
        positions: ["faceup_attack", "faceup_defense"],
      },
      state: stA(c),
      intent: intentA(2, false),
      latencyMs: 180,
      branch: (a) => {
        const idx = pick(a)?.sequence ?? 0;
        return triggerStepA({ ...c, pos: idx === 1 ? POS_FACEUP_DEF : POS_FACEUP_ATK });
      },
      note: "Past the lock. Each tile IS the commit — and the board shows which one you picked: defence position is rotated.",
    },
  ];
}

function zoneStepA(c: ChoicesA): Step[] {
  const legal = [c.trib!, 3, 4].sort((x, y) => x - y);
  return [
    {
      decision: {
        kind: "SelectZone",
        player: 0,
        count: 1,
        zones: legal.map((sq) => ({
          controller: 0 as Seat,
          location: "MZONE" as const,
          sequence: sq,
        })),
      },
      state: stA({ ...c, placed: false }),
      intent: intentA(1, false),
      latencyMs: 220,
      autoResolved: `Zone — the freed monster zone. Turn on “Choose zones” to be asked instead.`,
      events: [
        ev(60, 0, CAIUS, "Tribute Summon", 4, "M1", { from: "HAND", to: "MZONE" }),
        ev(50, 0, A_OWN[c.trib!].code, "Move", 4, "M1", { from: "MZONE", to: "GRAVE" }),
      ],
      // Auto-answer arrives as confirm with an EMPTY selection → the default zone.
      branch: (a) => positionStepA({ ...c, zone: pick(a)?.sequence ?? c.trib }),
    },
  ];
}

const tributeStepA: Step = {
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
  state: stA({}),
  intent: intentA(0, true),
  latencyMs: 160,
  caption: 'Tribute 1 monster to Summon "Caius the Shadow Monarch"',
  highlight: [0, 1, 2].map((sequence) => ({
    controller: 0 as Seat,
    location: "MZONE" as const,
    sequence,
  })),
  branch: (a) => (a.kind === "decline" ? undefined : zoneStepA({ trib: pick(a)!.sequence })),
  note: "Cancel is live here and Esc maps to it. The confirm button names the card it will destroy, because the NEXT step cannot be cancelled.",
};

const scenarioA: Scenario = {
  id: "tribute-summon",
  title: "Tribute Summon Caius",
  blurb:
    "The flagship. One player intent → up to 6 engine decisions, one clock, one ribbon, and an explicit point of no return.",
  lpByTurn: { 3: [8000, 8000], 4: [8000, 8000] },
  seedLog: [
    ev(40, 0, 0, "Move", 3, "DP"),
    ev(90, 1, 0, "Draw", 3, "DP", { from: "DECK", to: "HAND" }),
    ev(60, 1, KREBONS, "Summon", 3, "M1", { from: "HAND", to: "MZONE" }),
    ev(54, 1, 0, "Set", 3, "M1", { from: "HAND", to: "SZONE" }),
    ev(54, 1, 0, "Set", 3, "M1", { from: "HAND", to: "SZONE" }),
    ev(40, 0, 0, "Move", 4, "DP"),
    ev(90, 0, TROOPER, "Draw", 4, "DP", { from: "DECK", to: "HAND" }),
    ev(60, 0, JUNK, "Summon", 4, "M1", { from: "HAND", to: "MZONE" }),
  ],
  steps: [
    {
      decision: idleA,
      state: stA({}),
      myClockSeconds: 285,
      oppClockSeconds: 300,
      onClockSeat: 0,
      expect: {
        ref: { controller: 0, location: "HAND", sequence: 0 },
        verb: "Normal Summon — 1 tribute",
      },
      note: "IdleCommand is NOT rendered as a question. It arms the board: click Caius in your hand.",
    },
    tributeStepA,
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// B · Respond to a chain — three answers, three outcomes
// ═════════════════════════════════════════════════════════════════════════════

interface ChoicesB {
  chained?: number; // SOLEMN | BOOK | undefined (declined)
  flipped?: CardRef; // Book of Moon's target
  resolved?: boolean; // the chain has finished resolving
}

const B_FACEUP: { ref: CardRef; code: number }[] = [
  { ref: { controller: 1, location: "MZONE", sequence: 0 }, code: KREBONS },
  { ref: { controller: 0, location: "MZONE", sequence: 0 }, code: TROOPER },
  { ref: { controller: 0, location: "MZONE", sequence: 1 }, code: JUNK },
];
const sameRefB = (a: CardRef, b: CardRef) =>
  a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;

function zonesB(c: ChoicesB & { summoned?: boolean; torrentialUp?: boolean }): DuelZones {
  const z = emptyZones();
  z.p0_deckCount = 31;
  z.p1_deckCount = 29;
  z.p1_hand = backs(3);
  z.p0_hand = c.summoned
    ? [handCard(GORZ, 0), handCard(CYBER, 1)]
    : [handCard(JUNK, 0), handCard(GORZ, 1), handCard(CYBER, 2)];

  const monsters = c.resolved && c.chained !== SOLEMN;
  const flip = (ref: CardRef, base: ZoneCard) =>
    c.flipped && sameRefB(c.flipped, ref) ? { ...base, position: POS_FACEDOWN_DEF } : base;

  if (monsters) {
    // Torrential Tribute resolved: every monster is destroyed.
    z.p0_mzone = row([]);
    z.p1_mzone = row([]);
    z.p0_grave = [
      ...(c.chained === BOOK ? [{ code: BOOK, sequence: 0, position: 1 }] : []),
      { code: JUNK, sequence: 0, position: 1 },
      { code: TROOPER, sequence: 1, position: 1 },
    ].map((x, i) => ({ ...x, sequence: i }));
    z.p1_grave = [
      { code: KREBONS, sequence: 0, position: 1 },
      { code: TORRENTIAL, sequence: 1, position: 1 },
    ];
  } else if (c.resolved && c.chained === SOLEMN) {
    // Solemn negated it: the monsters live.
    z.p0_mzone = row([mon(TROOPER, 0, 400, 400, 3), mon(JUNK, 1, 1300, 500, 3)]);
    z.p1_mzone = row([mon(KREBONS, 0, 1200, 400, 2)]);
    z.p0_grave = [{ code: SOLEMN, sequence: 0, position: 1 }];
    z.p1_grave = [{ code: TORRENTIAL, sequence: 0, position: 1 }];
  } else {
    z.p0_mzone = row(
      c.summoned
        ? [
            flip({ controller: 0, location: "MZONE", sequence: 0 }, mon(TROOPER, 0, 400, 400, 3)),
            flip({ controller: 0, location: "MZONE", sequence: 1 }, mon(JUNK, 1, 1300, 500, 3)),
          ]
        : [mon(TROOPER, 0, 400, 400, 3)],
    );
    z.p1_mzone = row([
      flip({ controller: 1, location: "MZONE", sequence: 0 }, mon(KREBONS, 0, 1200, 400, 2)),
    ]);
  }

  // your back row: Solemn (0) and Book (1), each gone if it was the card you played
  const solemnGone = c.resolved && c.chained === SOLEMN;
  const bookGone = c.resolved && c.chained === BOOK;
  z.p0_szone = row([
    solemnGone
      ? null
      : c.chained === SOLEMN
        ? { code: SOLEMN, sequence: 0, position: 1, isPublic: true }
        : setCard(SOLEMN, 0),
    bookGone
      ? null
      : c.chained === BOOK
        ? { code: BOOK, sequence: 1, position: 1, isPublic: true }
        : setCard(BOOK, 1),
  ]);

  // Sakura's back row: Torrential in slot 0 (face-up once activated, gone once resolved)
  z.p1_szone = row([
    c.resolved
      ? null
      : c.torrentialUp
        ? { code: TORRENTIAL, sequence: 0, position: 1, isPublic: true }
        : setCard(0, 0),
    setCard(0, 1),
  ]);
  return z;
}

const stB = (c: ChoicesB & { summoned?: boolean; torrentialUp?: boolean }, lp: [number, number]) =>
  state(zonesB(c), { turnNumber: 6, lp });

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
const idleAfterB: DuelDecision = {
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

const chainPromptB: DuelDecision = {
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
      description: "Target 1 face-up monster on the field; change it to face-down Defense Position",
    },
  ],
};

/** DECLINE — Torrential resolves. Both of your set cards are still set. LP untouched. */
const declineB = (): Step[] => [
  {
    decision: null,
    state: stB({ summoned: true, torrentialUp: true }, [8000, 8000]),
    latencyMs: 700,
    waitLabel: "Passing — Torrential Tribute resolves…",
    onClockSeat: 1,
    chain: [{ ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "resolving" }],
    autoPush: TORRENTIAL,
    events: [ev(72, 1, TORRENTIAL, "Resolve", 6, "M1")],
  },
  {
    decision: idleAfterB,
    state: stB({ summoned: true, resolved: true }, [8000, 8000]),
    latencyMs: 1100,
    onClockSeat: 0,
    chain: [],
    events: [
      ev(50, 0, JUNK, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
      ev(50, 0, TROOPER, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
      ev(50, 1, KREBONS, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
      ev(50, 1, TORRENTIAL, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
    ],
    note: "Declined: every monster died, LP 8000 vs 8000, and BOTH your set cards are still set. Compare with the two Activate branches.",
  },
];

/** SOLEMN — pay half, negate, destroy Torrential. Your monsters live. Book stays set. */
const solemnB = (): Step[] => [
  {
    decision: null,
    state: stB({ summoned: true, torrentialUp: true, chained: SOLEMN }, [4000, 8000]),
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
    state: stB({ summoned: true, torrentialUp: true, chained: SOLEMN }, [4000, 8000]),
    latencyMs: 900,
    waitLabel: "Chain resolving — link 2 of 2…",
    onClockSeat: 1,
    chain: [
      { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
      { ordinal: 2, code: SOLEMN, owner: 0, location: "SZONE", state: "resolving" },
    ],
    autoPush: SOLEMN,
  },
  {
    decision: idleB,
    state: stB({ summoned: true, chained: SOLEMN, resolved: true }, [4000, 8000]),
    latencyMs: 900,
    waitLabel: "Chain resolving — link 1 of 2…",
    chain: [],
    onClockSeat: 0,
    events: [
      ev(72, 0, SOLEMN, "Resolve", 6, "M1"),
      ev(73, 1, TORRENTIAL, "Negated", 6, "M1", { from: "SZONE", to: "GRAVE" }),
      ev(50, 0, SOLEMN, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
    ],
    note: "Solemn Judgment: paid 4000 LP, negated Torrential, and your monsters survived. Book of Moon is still set.",
  },
];

/** BOOK OF MOON — flips a monster face-down, costs no LP, then Torrential still resolves. */
const bookResolveB = (target: CardRef): Step[] => {
  const code = B_FACEUP.find((x) => sameRefB(x.ref, target))!.code;
  return [
    {
      decision: null,
      state: stB(
        { summoned: true, torrentialUp: true, chained: BOOK, flipped: target },
        [8000, 8000],
      ),
      latencyMs: 900,
      waitLabel: "Chain resolving — link 2 of 2…",
      onClockSeat: 1,
      chain: [
        { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
        { ordinal: 2, code: BOOK, owner: 0, location: "SZONE", state: "resolving" },
      ],
      autoPush: BOOK,
      events: [
        ev(72, 0, BOOK, "Resolve", 6, "M1"),
        ev(53, target.controller, code, "Position", 6, "M1", { from: "MZONE", to: "MZONE" }),
      ],
      note: `Book of Moon resolved and flipped ${cardName(code)} face-down. No LP was paid.`,
    },
    {
      decision: idleAfterB,
      state: stB({ summoned: true, chained: BOOK, flipped: target, resolved: true }, [8000, 8000]),
      latencyMs: 1000,
      waitLabel: "Chain resolving — link 1 of 2…",
      chain: [],
      onClockSeat: 0,
      events: [
        ev(50, 0, JUNK, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 0, TROOPER, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 1, KREBONS, "Destroyed", 6, "M1", { from: "MZONE", to: "GRAVE" }),
        ev(50, 1, TORRENTIAL, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
        ev(50, 0, BOOK, "Move", 6, "M1", { from: "SZONE", to: "GRAVE" }),
      ],
      note: `Book of Moon: LP untouched at 8000, Book of Moon is in the graveyard, Solemn Judgment is still set — and Torrential destroyed the monsters anyway. A different answer, a different outcome, and in this spot a worse one.`,
    },
  ];
};

const bookTargetB = (): Step[] => [
  {
    decision: {
      kind: "SelectCard",
      player: 0,
      cards: B_FACEUP.map((x) => ({
        code: x.code,
        name: cardName(x.code),
        controller: x.ref.controller,
        location: x.ref.location,
        sequence: x.ref.sequence,
      })),
      min: 1,
      max: 1,
      cancelable: true,
    },
    state: stB({ summoned: true, torrentialUp: true, chained: BOOK }, [8000, 8000]),
    latencyMs: 240,
    caption: 'Target 1 face-up monster — "Book of Moon"',
    chain: [
      { ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" },
      { ordinal: 2, code: BOOK, owner: 0, location: "SZONE", state: "declared" },
    ],
    onClockSeat: 0,
    highlight: B_FACEUP.map((x) => x.ref),
    events: [ev(70, 0, BOOK, "Chain", 6, "M1", { from: "SZONE", to: "SZONE" })],
    branch: (a) => (a.kind === "decline" ? chainPromptStepB() : bookResolveB(pick(a)!)),
    note: "Book of Moon needs a target. Cancelling here un-activates it and hands the window back to you.",
  },
];

function chainPromptStepB(): Step[] {
  return [
    {
      decision: chainPromptB,
      state: stB({ summoned: true, torrentialUp: true }, [8000, 8000]),
      latencyMs: 1300,
      onClockSeat: 0,
      chain: [{ ordinal: 1, code: TORRENTIAL, owner: 1, location: "SZONE", state: "declared" }],
      autoPush: TORRENTIAL,
      highlight: [
        { controller: 0, location: "SZONE", sequence: 0 },
        { controller: 0, location: "SZONE", sequence: 1 },
      ],
      // THE BUG THE CEO FOUND: this used to fall through to a hardcoded Solemn line.
      // The outcome is now a function of the card you picked.
      branch: (a) => {
        if (a.kind === "decline") return declineB();
        const code = pickCode(a);
        if (code === SOLEMN) return solemnB();
        if (code === BOOK) return bookTargetB();
        return declineB();
      },
      note: "Three answers, three outcomes: Solemn Judgment pays 4000 LP and saves the board; Book of Moon costs nothing, flips a monster and does not stop Torrential; No response lets Torrential through with both your traps still set.",
    },
  ];
}

const scenarioB: Scenario = {
  id: "chain-response",
  title: "Respond to a chain",
  blurb:
    "The interaction the format is built on. One Question Bar naming the card, candidates badged by location, and every answer — including declining — with its own outcome.",
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
      state: stB({}, [8000, 8000]),
      myClockSeconds: 240,
      oppClockSeconds: 300,
      onClockSeat: 0,
      expect: { ref: { controller: 0, location: "HAND", sequence: 0 }, verb: "Normal Summon" },
      note: "Summon Junk Synchron and see what Sakura does about it.",
    },
    {
      decision: null,
      state: stB({ summoned: true }, [8000, 8000]),
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
      branch: () => chainPromptStepB(),
    },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// C · Battle phase
// ═════════════════════════════════════════════════════════════════════════════

const scenarioC: Scenario = (() => {
  const base = () => {
    const z = emptyZones();
    z.p0_hand = [handCard(GORZ, 0), handCard(CYBER, 1)];
    z.p0_szone = row([setCard(BOOK, 0)]);
    z.p1_hand = backs(2);
    z.p1_szone = row([setCard(0, 0)]);
    z.p0_deckCount = 28;
    z.p1_deckCount = 27;
    return z;
  };
  const zFresh = (() => {
    const z = base();
    z.p0_mzone = row([mon(CAIUS, 0, 2400, 1000, 6), mon(TROOPER, 1, 400, 400, 3)]);
    z.p1_mzone = row([mon(KREBONS, 0, 1200, 400, 2)]);
    return z;
  })();
  const zSpent = (() => {
    const z = base();
    z.p0_mzone = row([
      { ...mon(CAIUS, 0, 2400, 1000, 6), attacked: true },
      mon(TROOPER, 1, 400, 400, 3),
    ]);
    z.p1_mzone = row([]);
    z.p1_grave = [{ code: KREBONS, sequence: 0, position: 1 }];
    return z;
  })();
  const zBoth = (() => {
    const z = clone(zSpent);
    z.p0_mzone = row([
      { ...mon(CAIUS, 0, 2400, 1000, 6), attacked: true },
      { ...mon(TROOPER, 1, 400, 400, 3), attacked: true },
    ]);
    return z;
  })();

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
  const atk = (entries: { code: number; sequence: number; direct: boolean }[]): DuelDecision => ({
    kind: "BattleCommand",
    player: 0,
    chains: [],
    attacks: entries.map((e) => ({
      code: e.code,
      name: cardName(e.code),
      controller: 0,
      location: "MZONE",
      sequence: e.sequence,
      canDirectAttack: e.direct,
    })),
    toMainPhase2: true,
    toEndPhase: true,
  });

  const attackIntent = (stepIndex: number): PendingIntent => ({
    label: 'Attacking with "Caius the Shadow Monarch"',
    cardCode: CAIUS,
    steps: ["Target", "Declared"],
    stepIndex,
    commitAt: 1,
    cancelable: stepIndex === 0,
  });

  const battleArmed = (): Step[] => [
    {
      decision: atk([
        { code: CAIUS, sequence: 0, direct: false },
        { code: TROOPER, sequence: 1, direct: false },
      ]),
      state: state(zFresh, { turnNumber: 8, phase: "BP" }),
      latencyMs: 200,
      onClockSeat: 0,
      expect: { ref: { controller: 0, location: "MZONE", sequence: 0 }, verb: "Attack" },
      note: "BattleCommand also arms the board — no bar. Monsters that can still attack carry the ATTACK badge.",
    },
    targetStepC(),
  ];

  function afterAttack(): Step[] {
    return [
      {
        decision: null,
        state: state(zFresh, { turnNumber: 8, phase: "BP" }),
        intent: attackIntent(1),
        latencyMs: 1200,
        waitLabel: "Attack declared — Sakura may respond…",
        onClockSeat: 1,
        events: [ev(110, 0, CAIUS, "Attack", 8, "BP")],
        note: "Declared. The ribbon now reads COMMITTED and Cancel is gone — the same commit model as a summon.",
      },
      {
        decision: null,
        state: state(zFresh, { turnNumber: 8, phase: "BP" }),
        intent: attackIntent(1),
        latencyMs: 800,
        waitLabel: "Damage step — Caius 2400 vs Krebons 1200…",
        onClockSeat: 1,
      },
      {
        decision: atk([{ code: TROOPER, sequence: 1, direct: true }]),
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
        decision: atk([]),
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
    ];
  }

  function targetStepC(): Step {
    return {
      decision: {
        kind: "SelectCard",
        player: 0,
        cards: [{ code: KREBONS, name: "Krebons", controller: 1, location: "MZONE", sequence: 0 }],
        min: 1,
        max: 1,
        cancelable: true,
      },
      state: state(zFresh, { turnNumber: 8, phase: "BP" }),
      intent: attackIntent(0),
      latencyMs: 160,
      caption: 'Attack with "Caius the Shadow Monarch" — choose a target',
      highlight: [{ controller: 1, location: "MZONE", sequence: 0 }],
      branch: (a) => (a.kind === "decline" ? battleArmed() : afterAttack()),
      note: "Cancel is live while you are still choosing a target — the engine allows it (can_cancel: true). Cancelling leaves Krebons alive and Caius able to attack again.",
    };
  }

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
        state: state(zFresh, { turnNumber: 8 }),
        myClockSeconds: 300,
        oppClockSeconds: 300,
        onClockSeat: 0,
        expect: { phase: "BP" },
        note: "Click BP on the phase rail. It is always there — it is not inside a decision panel.",
        branch: () => battleArmed(),
      },
    ],
  };
})();

// ═════════════════════════════════════════════════════════════════════════════
// D · Off-clock, clock escalation, forfeit  (no multi-answer questions)
// ═════════════════════════════════════════════════════════════════════════════

const scenarioD: Scenario = (() => {
  const z0 = emptyZones();
  z0.p0_hand = [handCard(GORZ, 0), handCard(CYBER, 1), handCard(BOOK, 2)];
  z0.p0_mzone = row([mon(TROOPER, 0, 400, 400, 3)]);
  z0.p0_szone = row([setCard(DPRISON, 0)]);
  z0.p1_hand = backs(4);
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
      "Half of every duel is spent off-clock. Then your own clock — banked and visible the whole time — runs out, and a timeout forfeits the duel. Takes about 40 seconds; do nothing and watch.",
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
