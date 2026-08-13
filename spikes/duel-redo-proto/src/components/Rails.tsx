import { Fragment } from "react";
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
 *
 * ⚠ THE `— since you last acted —` MARK IS A BOUNDARY BETWEEN ROWS, NOT A
 * PROPERTY OF A ROW (ZUH-141). It used to be a `mark` boolean passed to
 * `FeedRow`, and it never rendered at all, for two independent reasons:
 *
 *   1. `markAt` is an index into `events`, and it was compared against the index
 *      of `rows` — which `withBattleResults` INSERTS synthetic result rows into.
 *      The two index spaces diverge at the first battle, and if the mark index
 *      landed on a result row, `FeedRow` was never called with `mark` at all.
 *   2. `FeedRow` returns `null` for an event with no description (`PHASE`,
 *      `HINT`) **before** it rendered the mark — so a mark anchored to an
 *      undescribable event vanished silently. This is the one that fired: the
 *      recorded opponent turn in `s07` begins with a `PHASE` event, so the mark
 *      was attached to a row that draws nothing.
 *
 * So the rail owns the mark, positions it in ITS OWN index space, and anchors it
 * to the first row at or after the boundary **that actually draws**. A boundary
 * whose own row is invisible moves to the next visible row rather than
 * disappearing; if nothing after the boundary draws, no mark is rendered, because
 * a mark with nothing under it would claim a change the rail cannot show.
 */
export function FeedRail({
  events,
  mySeat,
  markAt,
  names,
  resolve,
  midDuel,
}: {
  events: DuelEvent[];
  mySeat: Seat;
  /** Index into `events` of the first event that arrived while control was away. */
  markAt: number | null;
  names: { me: string; opp: string };
  /** The board is a mid-duel snapshot, so "the duel has not started" would be a lie. */
  midDuel: boolean;
  /** Resolve an event card ref to a passcode against the board as it was BEFORE
   *  the events moved it — which is where the card actually was. */
  resolve: (ref: unknown) => number;
}) {
  const rows = withBattleResults(events, mySeat, names, resolve);
  // The mark's position in ROWS space. `describe` is the single source of truth
  // for whether a row draws — asking it here is what stops the two from drifting.
  const markRow =
    markAt === null
      ? -1
      : rows.findIndex(
          (r) => !r.result && r.srcIndex >= markAt && describe(r.e!, names, mySeat) !== null,
        );
  return (
    <aside className="feedrail" data-testid="feed-rail">
      <div className="feedhead">
        <span>What has happened</span>
      </div>
      <div className="feedrows">
        {events.length === 0 ? (
          <div className="feedempty">
            {/* Two different empty states, because they answer different questions.
                Saying "the duel has not started" while the board shows a mid-duel
                position is a lie, and it is the only thing on screen that could
                explain what happened. */}
            {midDuel ? "Earlier turns are not available." : "The duel has not started."}
          </div>
        ) : null}
        {rows.map((r, i) => (
          <Fragment key={i}>
            {i === markRow ? (
              <div className="feedmark" data-testid="feed-mark">
                since you last acted
              </div>
            ) : null}
            {r.result ? (
              <div className="feedrow result" data-testid="battle-result">
                {r.result}
              </div>
            ) : (
              <FeedRow e={r.e!} mySeat={mySeat} names={names} />
            )}
          </Fragment>
        ))}
      </div>
    </aside>
  );
}

/**
 * F-10 — the screen must state the RESULT of a battle, not just that one happened.
 *
 * Nothing here is computed from the rules. The engine emits ATTACK (who attacked
 * what), BATTLE (the damage step ran), LP_CHANGE (whose life points moved and by
 * how much) and MOVE (which card went to the graveyard). This assembles those four
 * into the one sentence the player is actually asking for, and says `no damage`
 * explicitly when the engine emitted no LP_CHANGE — because silence about damage
 * reads as "I do not know", and here we do.
 *
 * ATK/DEF come from the card corpus, which is data we hold. If a participant
 * cannot be identified at all, it is described rather than named, never guessed.
 */
function withBattleResults(
  events: DuelEvent[],
  mySeat: Seat,
  names: { me: string; opp: string },
  resolve: (ref: unknown) => number,
): { e?: DuelEvent; result?: string; srcIndex: number }[] {
  // `srcIndex` is the row's index in EVENTS space. It exists because this function
  // inserts rows, so a row's own index is not the index of the event it came from —
  // which is the bug the mark used to have (see FeedRail).
  const out: { e?: DuelEvent; result?: string; srcIndex: number }[] = [];
  events.forEach((e, i) => {
    out.push({ e, srcIndex: i });
    if (e.kind !== "BATTLE") return;
    const atkRef = e["attacker"];
    const defRef = e["target"];
    const label = (ref: unknown) => {
      const code = resolve(ref);
      if (code) {
        const info = cardInfo(code);
        return info ? `${info.name} (${info.atk ?? "?"})` : String(code);
      }
      const r = ref as { controller?: Seat; sequence?: number } | undefined;
      if (!r) return "a monster";
      return `${r.controller === mySeat ? "your" : "their"} monster in Monster ${(r.sequence ?? 0) + 1}`;
    };
    // Everything after this BATTLE, up to the next ATTACK, belongs to this battle.
    const tail: DuelEvent[] = [];
    for (let j = i + 1; j < events.length; j++) {
      if (events[j]!.kind === "ATTACK" || events[j]!.kind === "BATTLE") break;
      tail.push(events[j]!);
    }
    const lp = tail.find((t) => t.kind === "LP_CHANGE");
    const dead = tail.filter((t) => t.kind === "MOVE");
    const destroyed = dead
      .map((t) => {
        const code = resolve((t as { from?: unknown })["from"]);
        return code ? (cardInfo(code)?.name ?? String(code)) : null;
      })
      .filter(Boolean) as string[];
    const dmgSeat = lp ? (lp["seat"] as Seat) : null;
    const dmg = lp ? Math.abs(lp["delta"] as number) : 0;
    const who = dmgSeat === null ? "" : dmgSeat === mySeat ? "you" : names.opp;
    out.push({
      srcIndex: i,
      result:
        `${label(atkRef)} attacked ${label(defRef)} — ` +
        (destroyed.length ? `${destroyed.join(" and ")} destroyed` : "nothing destroyed") +
        " — " +
        (dmg ? `${who} took ${dmg} damage` : "no damage"),
    });
  });
  return out;
}

function FeedRow({
  e,
  mySeat,
  names,
}: {
  e: DuelEvent;
  mySeat: Seat;
  names: { me: string; opp: string };
}) {
  const actor = (e["actor"] ?? e["seat"] ?? (e["card"] as { controller?: Seat } | undefined)?.controller) as Seat | undefined;
  const mine = actor === mySeat;
  const code = (e["code"] ?? (e["card"] as { code?: number } | undefined)?.code ?? 0) as number;
  const name = code ? (cardInfo(code)?.name ?? String(code)) : "";
  const detail = describe(e, names, mySeat);
  if (!detail) return null;
  return (
    <div className={`feedrow ${actor === undefined ? "" : mine ? "mine" : "theirs"}`} data-testid="feed-row">
      <span className="fverb">{detail.verb}</span>
      <span className="fname">{name || detail.fallback}</span>
      <span className="fmove">{detail.move}</span>
    </div>
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
