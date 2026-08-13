// Contract shapes, copied from packages/contracts (web may not import server/engine,
// and a prototype may not import the workspace at all). These are the REAL shapes as
// of master f86683c — MH-1 is already shipped, so ZoneCard here matches the live
// contract exactly rather than a proposed one.
//
// ⚠ ND-7: `attack`/`defense`/`level` are present on the OPPONENT's hand cards on the
// real wire. They are typed here because they are really sent, not because the design
// wants them. The prototype never reads them for a card it is not entitled to; see
// `redactedForDisplay` in board.ts.

export type Seat = 0 | 1;
export type Loc = "HAND" | "MZONE" | "SZONE" | "GRAVE" | "REMOVED" | "EXTRA" | "DECK" | "FZONE";

export interface ZoneCard {
  code: number;
  position: number;
  sequence?: number;
  attack?: number | null;
  defense?: number | null;
  level?: number | null;
  isPublic?: boolean;
}

export interface DuelZones {
  p0_hand: ZoneCard[];
  p1_hand: ZoneCard[];
  p0_mzone: (ZoneCard | null)[];
  p1_mzone: (ZoneCard | null)[];
  p0_szone: (ZoneCard | null)[];
  p1_szone: (ZoneCard | null)[];
  p0_fzone?: ZoneCard | null;
  p1_fzone?: ZoneCard | null;
  p0_grave: ZoneCard[];
  p1_grave: ZoneCard[];
  p0_removed: ZoneCard[];
  p1_removed: ZoneCard[];
  p0_extra: ZoneCard[];
  p1_extra: ZoneCard[];
  p0_deckCount?: number;
  p1_deckCount?: number;
}

export interface DuelStateSnapshot {
  seat: Seat;
  duelEnded: boolean;
  currentTurn: Seat;
  currentPhase: number;
  lp: [number, number];
  zones: DuelZones;
  turnNumber?: number;
}

export interface CardEntry {
  code: number;
  name: string;
  controller: Seat;
  location: Loc;
  sequence: number;
  description?: string;
  canDirectAttack?: boolean;
}

export interface ZoneEntry {
  controller: Seat;
  location: Loc;
  sequence: number;
}

export type DuelDecision =
  | { kind: "IdleCommand"; player: Seat; summons: CardEntry[]; specialSummons: CardEntry[]; posChanges: CardEntry[]; monsterSets: CardEntry[]; spellSets: CardEntry[]; activates: CardEntry[]; toBattlePhase: boolean; toEndPhase: boolean }
  | { kind: "BattleCommand"; player: Seat; chains: CardEntry[]; attacks: CardEntry[]; toMainPhase2: boolean; toEndPhase: boolean }
  | { kind: "ChainPrompt"; player: Seat; forced: boolean; selects: CardEntry[] }
  | { kind: "SelectEffectYN"; player: Seat; card: CardEntry; description?: string }
  | { kind: "SelectYesNo"; player: Seat; description?: string }
  | { kind: "SelectOption"; player: Seat; options: { index: number; description: string }[] }
  | { kind: "SelectCard"; player: Seat; cards: CardEntry[]; min: number; max: number; cancelable: boolean }
  | { kind: "SelectTribute"; player: Seat; cards: CardEntry[]; min: number; max: number; cancelable: boolean }
  | { kind: "SelectZone"; player: Seat; count: number; zones: ZoneEntry[] }
  | { kind: "SelectPosition"; player: Seat; card?: CardEntry; positions: number[] }
  | { kind: "SelectUnselectCard"; player: Seat; cards: CardEntry[]; min: number; max: number; finishable?: boolean }
  | { kind: "AnnounceRace"; player: Seat; count: number; available: string[] }
  | { kind: "AnnounceAttrib"; player: Seat; count: number; available: string[] }
  | { kind: "AnnounceCard"; player: Seat }
  | { kind: "AnnounceNumber"; player: Seat; options: number[] }
  | { kind: "SortChain"; player: Seat; cards: CardEntry[] }
  | { kind: "SortCard"; player: Seat; cards: CardEntry[] }
  | { kind: "SelectCounter"; player: Seat; counterType?: number; count: number; cards: CardEntry[] }
  | { kind: "SelectSum"; player: Seat; amount: number; cards: CardEntry[]; min: number; max: number }
  | { kind: "SelectDisfield"; player: Seat; count: number; zones: ZoneEntry[] };

export type DecisionKind = DuelDecision["kind"];

export interface EventCardRef {
  code: number;
  controller: Seat;
  location: Loc;
  sequence: number;
}

export interface DuelEvent {
  kind: string;
  turnNumber: number;
  phase: number;
  seq: number;
  [k: string]: unknown;
}

export interface DecisionContext {
  caption?: string;
  activatingCard?: EventCardRef;
  chain?: { link: number; card: EventCardRef; owner: Seat }[];
}

export type ServerFrame =
  | { type: "SEAT_ASSIGNED"; seat: Seat; seatToken: string }
  | { type: "STATE"; state: DuelStateSnapshot }
  | { type: "CLOCK"; onClockSeat: Seat; deadlineAt: number }
  /** ND-8 — the CLOCK frame with the clock removed. Proposed, not shipped. */
  | { type: "CONTROL"; seat: Seat | null }
  | { type: "EVENTS"; events: DuelEvent[] }
  | { type: "DECISION"; decision: DuelDecision }
  | { type: "DECISION_CONTEXT"; context: DecisionContext }
  | { type: "DUEL_END"; winner: Seat | null; reason: string }
  | { type: "PRESENCE"; seat: Seat; presence: "connected" | "away" }
  | { type: "ROOM_STATE"; snapshot: Record<string, unknown> }
  | { type: "MSG"; msg: Record<string, unknown> }
  | { type: "ERROR"; message: string };

export interface CardInfo {
  passcode: number;
  name: string;
  frame: string;
  race: string | null;
  attribute: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  desc: string;
  preErrataText?: boolean;
}
