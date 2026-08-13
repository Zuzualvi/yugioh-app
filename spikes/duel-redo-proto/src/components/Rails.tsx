import type { DuelEvent, Seat } from "../proto/types";
import { cardInfo } from "../proto/scenarios";

const PHASES = ["DP", "SP", "M1", "BP", "M2", "EP"];
/** The web-side phase codes carried on every STATE frame
 *  (`mapOcgPhaseToWeb`: DRAW 1 · STANDBY 2 · MAIN1 4 · BATTLE 8 · MAIN2 16 · END 32). */
const PHASE_CODE: Record<string, number> = { DP: 1, SP: 2, M1: 4, BP: 8, M2: 16, EP: 32 };
const PHASE_LABEL: Record<string, string> = {
  DP: "Draw",
  SP: "Standby",
  M1: "Main 1",
  BP: "Battle",
  M2: "Main 2",
  EP: "End",
};

/**
 * The phase rail — both the phase display and the phase-advance control, so no
 * separate "next phase" button exists. End Turn lives at its right end and is
 * never inside a panel that can vanish.
 *
 * The turn-resource line is new. It answers "have I used my Normal Summon?",
 * the most common self-check in the game, from an EVENT the engine emitted —
 * not from the absence of an option, which is not a statement, and not from a
 * cause the engine did not give (D1/D2).
 *
 * ⚠ THE CURRENT-PHASE MARKER IS READ FROM `STATE.currentPhase` AND FROM NOTHING
 * ELSE. It was previously inferred from the kind of decision being held, so the
 * moment an attack-target question opened — a `SelectCard`, not a
 * `BattleCommand` — the marker fell back to M1 and told the player they were in
 * Main Phase 1 while they were mid-declaration of an attack. That is the screen
 * stating something untrue, which is requirement D1's class, on the surface the
 * player uses to orient. The engine puts the phase on every STATE frame; the rail
 * reads it, and a question cannot move it because a question does not change the
 * board.
 */
export function PhaseRail({
  currentPhase,
  legal,
  onPhase,
  onEndTurn,
  canEndTurn,
  summonSpent,
  onTurn,
}: {
  /** `STATE.currentPhase` — the engine's own value, never inferred. */
  currentPhase: number;
  legal: string[];
  onPhase: (p: string) => void;
  onEndTurn: () => void;
  canEndTurn: boolean;
  summonSpent: boolean;
  onTurn: boolean;
}) {
  return (
    <div className="railbar" data-testid="phase-rail">
      <div className="phaserail">
        {PHASES.map((p) => (
          <button
            key={p}
            className={`phase ${PHASE_CODE[p] === currentPhase ? "current" : ""} ${legal.includes(p) ? "legal" : ""}`}
            disabled={!legal.includes(p)}
            onClick={() => onPhase(p)}
            aria-label={`${PHASE_LABEL[p]} Phase`}
          >
            {p}
          </button>
        ))}
      </div>
      <span className="turnres" data-testid="turn-resource">
        Normal Summon <span className={`val ${summonSpent ? "spent" : ""}`}>{summonSpent ? "spent" : "not yet used"}</span>
      </span>
      <span className="grow" />
      <button className="btn endturn" data-testid="end-turn-btn" disabled={!canEndTurn || !onTurn} onClick={onEndTurn}>
        End Turn
      </button>
    </div>
  );
}

/**
 * The feed rail is PERMANENT and 320px wide.
 *
 * The previous design made it collapsed-by-default and overlaying, and what
 * shipped covered End Turn and the clock (break 11). Reserving the width means
 * there is nothing to reflow and nothing to occlude — the rule "it must never
 * move a card" is satisfied by construction rather than by discipline. It also
 * gives dead time (half the duel) something to be, and gives the delta a place
 * to expand into.
 */
export function FeedRail({
  events,
  mySeat,
  markAt,
  names,
}: {
  events: DuelEvent[];
  mySeat: Seat;
  markAt: number | null;
  names: { me: string; opp: string };
}) {
  return (
    <aside className="feedrail" data-testid="feed-rail">
      <div className="feedhead">
        <span>What has happened</span>
      </div>
      <div className="feedrows">
        {events.length === 0 ? <div className="feedempty">The duel has not started.</div> : null}
        {events.map((e, i) => (
          <FeedRow key={i} e={e} mySeat={mySeat} names={names} mark={markAt === i} />
        ))}
      </div>
    </aside>
  );
}

function FeedRow({
  e,
  mySeat,
  names,
  mark,
}: {
  e: DuelEvent;
  mySeat: Seat;
  names: { me: string; opp: string };
  mark: boolean;
}) {
  const actor = (e["actor"] ?? e["seat"] ?? (e["card"] as { controller?: Seat } | undefined)?.controller) as Seat | undefined;
  const mine = actor === mySeat;
  const code = (e["code"] ?? (e["card"] as { code?: number } | undefined)?.code ?? 0) as number;
  const name = code ? (cardInfo(code)?.name ?? String(code)) : "";
  const detail = describe(e, names, mySeat);
  if (!detail) return null;
  return (
    <>
      {mark ? <div className="feedmark">since you last acted</div> : null}
      <div className={`feedrow ${actor === undefined ? "" : mine ? "mine" : "theirs"}`} data-testid="feed-row">
        <span className="fverb">{detail.verb}</span>
        <span className="fname">{name || detail.fallback}</span>
        <span className="fmove">{detail.move}</span>
      </div>
    </>
  );
}

/**
 * Structural, never prose. `Caius · Summon · hand → field`, never "Bob summoned
 * Caius". An unrecognised event kind renders its own name rather than being
 * dropped, so the feed can never silently lose something.
 */
function locOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "location" in v) return String((v as { location: string }).location);
  return "";
}

function describe(e: DuelEvent, names: { me: string; opp: string }, mySeat: Seat) {
  switch (e.kind) {
    case "SUMMON":
      return { verb: "Summon", move: "hand → field", fallback: "a monster" };
    case "SET":
      return { verb: "Set", move: "hand → field", fallback: "a card" };
    case "MOVE": {
      // The row names the SLOT it came from, not only the card. Two copies of the
      // same card leave an identical board, so without the slot the feed cannot
      // record WHICH one moved — and the answer-outcome enumeration reported that
      // as a collision, correctly.
      const from = e["card"] as { location?: string; sequence?: number } | undefined;
      const src = from ? `${from.location ?? ""} ${(from.sequence ?? 0) + 1}` : "";
      return { verb: "Move", move: `${src} → ${locOf(e["to"])}`.trim(), fallback: "a card" };
    }
    case "CHAINING":
      return { verb: "Activate", move: `chain ${e["link"] ?? ""}`, fallback: "a card" };
    case "CHAIN_SOLVING":
      return { verb: "Resolving", move: `link ${e["link"] ?? ""}`, fallback: "a chain link" };
    case "ATTACK": {
      // Naming the target is not decoration. Two declarations against different
      // monsters otherwise leave a byte-identical record, and the enumeration
      // reported exactly that as an outcome collision. It is also the only thing
      // on screen that says WHAT was attacked.
      const t = e["target"] as { location?: string; sequence?: number } | null | undefined;
      const tc = Number(e["targetCode"] ?? 0);
      const tname = tc ? (cardInfo(tc)?.name ?? String(tc)) : t ? `their card ${(t.sequence ?? 0) + 1}` : "";
      return { verb: "Attack", move: t ? `→ ${tname}` : "→ directly", fallback: "a monster" };
    }
    case "BATTLE":
      return { verb: "Battle", move: "damage step", fallback: "" };
    case "LP_CHANGE": {
      const seat = e["seat"] as Seat;
      const delta = e["delta"] as number;
      return {
        verb: "Life points",
        move: `${delta > 0 ? "+" : ""}${delta}`,
        fallback: seat === mySeat ? names.me : names.opp,
      };
    }
    case "TURN":
      return { verb: "Turn", move: String(e["turnNumber"] ?? ""), fallback: "" };
    case "PHASE":
      return null;
    case "HINT":
      return null;
    default:
      return { verb: String(e.kind), move: "", fallback: "" };
  }
}
