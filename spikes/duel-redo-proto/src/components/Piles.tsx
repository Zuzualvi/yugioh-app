import type { DuelEvent, Loc, Seat } from "../proto/types";
import { cardInfo } from "../proto/scenarios";
import { entitled, pile, type Board } from "../proto/board";
import { CardArt } from "./CardArt";

export interface PileTarget {
  seat: Seat;
  loc: Loc;
  label: string;
}

/**
 * Pile inspector — free, instant, silent, and never broadcast to the opponent.
 *
 * A day-one win over DuelingBook, which broadcasts `Viewing Deck` and whose
 * community pays for extensions to stop it. We are an automatic client; there is
 * no integrity argument for hiding public information from the player who is
 * entitled to it.
 *
 * It also answers the question the evaluator could not answer at all: "what did my
 * attack destroy?" The graveyard count went 0 → 1 and there was nowhere to look.
 */
export function PileInspector({
  board,
  mySeat,
  target,
  onClose,
  broken,
}: {
  board: Board;
  mySeat: Seat;
  target: PileTarget;
  onClose: () => void;
  broken?: boolean;
}) {
  const sealed = target.loc === "DECK" || (target.loc === "EXTRA" && target.seat !== mySeat);
  const cards = sealed ? [] : pile(board, target.seat, target.loc as "GRAVE");
  const count = sealed
    ? ((target.seat === 0 ? board.zones.p0_deckCount : board.zones.p1_deckCount) ?? 0)
    : cards.length;
  const whose = target.seat === mySeat ? "Your" : "Their";

  return (
    <aside className="pilesheet" data-testid="pile-inspector">
      <div className="ph">
        <span>
          {whose} {target.label} — {count} card{count === 1 ? "" : "s"}
        </span>
        <span className="pgrow" />
        <button className="btn sm" data-testid="pile-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {sealed ? (
        <div className="pempty">
          {count} cards.
          <br />
          Contents hidden — this is not public information.
        </div>
      ) : cards.length === 0 ? (
        <div className="pempty">{whose} {target.label.toLowerCase()} is empty.</div>
      ) : (
        <div className="pgrid">
          {cards.map((c, i) => {
            const isEnt = entitled(mySeat, target.seat, target.loc, c);
            const info = isEnt && c.code ? cardInfo(c.code) : null;
            return (
              <span className="card" key={i} title={info?.name ?? ""}>
                {info ? <CardArt code={info.passcode} className="fill" broken={broken} /> : null}
                <span className="tilename">{info?.name ?? "Face-down"}</span>
              </span>
            );
          })}
        </div>
      )}
    </aside>
  );
}

/**
 * Chain strip — shows, unprompted and persistently, what is on the chain and what
 * is resolving. Folded from the event feed, with ordinals taken from each event's
 * own `link` field rather than from array position.
 *
 * This is the surface the CEO's own group will hit most while learning the format:
 * Edison games are decided in chain windows, and a chain the player cannot read is
 * a decision they cannot make.
 */
export function ChainStrip({
  events,
  mySeat,
  resolve,
}: {
  events: DuelEvent[];
  mySeat: Seat;
  resolve: (ref: unknown) => number;
}) {
  const links: { link: number; code: number; owner: Seat; resolving: boolean }[] = [];
  let ended = false;
  for (const e of events) {
    if (e.kind === "CHAINING") {
      const link = Number(e["link"] ?? links.length + 1);
      const code = Number(e["code"] ?? 0) || resolve(e["card"]);
      const card = e["card"] as { controller?: Seat } | undefined;
      links.push({ link, code, owner: (card?.controller ?? mySeat) as Seat, resolving: false });
      ended = false;
    }
    if (e.kind === "CHAIN_SOLVING") {
      const l = links.find((x) => x.link === Number(e["link"]));
      links.forEach((x) => (x.resolving = false));
      if (l) l.resolving = true;
    }
    if (e.kind === "CHAIN_END") ended = true;
  }
  if (ended || links.length === 0) return null;

  return (
    <div className="chainstrip" data-testid="chain-strip">
      <span className="clabel">Chain</span>
      {links.map((l) => {
        const info = l.code ? cardInfo(l.code) : null;
        return (
          <span
            className={`clink ${l.owner === mySeat ? "mine" : "theirs"} ${l.resolving ? "resolving" : ""}`}
            key={l.link}
          >
            <span className="ord">{l.link}</span>
            <span>{info?.name ?? "a card"}</span>
            {l.resolving ? <span className="clabel">resolving</span> : null}
          </span>
        );
      })}
    </div>
  );
}
