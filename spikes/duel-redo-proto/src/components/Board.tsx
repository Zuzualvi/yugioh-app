import type { CardEntry, DuelDecision, Loc, Seat, ZoneCard } from "../proto/types";
import type { PileTarget } from "./Piles";
import { hand, pile, row } from "../proto/board";
import type { DuelModel } from "../proto/useDuel";
import { CardTile, type TileRef } from "./CardTile";

/**
 * The board. Two mirrored field groups, both hands, both pile clusters.
 *
 * Ownership colour law, without exception: yours blue, theirs red. Position
 * encodes ownership too (yours near, theirs far), so colour is reinforcement.
 */
export function useBoardParts({
  m,
  onCard,
  onHover,
  candidateRefs,
  selectedRefs,
  zonePick,
  onZone,
  shakeRef,
  onPile,
}: {
  m: DuelModel;
  onCard: (r: TileRef) => void;
  onHover: (code: number) => void;
  candidateRefs: TileRef[];
  selectedRefs: TileRef[];
  zonePick: { controller: Seat; sequence: number }[] | null;
  onZone: (i: number) => void;
  shakeRef: TileRef | null;
  onPile: (t: PileTarget) => void;
}) {
  const me = m.mySeat;
  const them = (1 - me) as Seat;
  const broken = m.scenario.breakArt;

  const isCand = (r: TileRef) =>
    candidateRefs.some((c) => c.controller === r.controller && c.location === r.location && c.sequence === r.sequence);
  const isSel = (r: TileRef) =>
    selectedRefs.some((c) => c.controller === r.controller && c.location === r.location && c.sequence === r.sequence);
  const isShake = (r: TileRef) =>
    !!shakeRef && shakeRef.controller === r.controller && shakeRef.location === r.location && shakeRef.sequence === r.sequence;

  const tile = (card: ZoneCard | null, r: TileRef) => (
    <CardTile
      key={`${r.controller}-${r.location}-${r.sequence}`}
      card={card}
      ref_={r}
      mySeat={me}
      onClick={onCard}
      onHover={onHover}
      candidate={isCand(r)}
      selected={isSel(r)}
      shake={isShake(r)}
      broken={broken}
    />
  );

  // F-09: these carried `cursor: pointer` with no handler, no role and no tab
  // stop. A pile whose contents we are not entitled to is marked `sealed` and does
  // not advertise a click it cannot honour (D4).
  const pileBadge = (seat: Seat, label: string, loc: Loc, n: number) => {
    const sealed = loc === "DECK" || (loc === "EXTRA" && seat !== me);
    return (
      <button
        className={`pile ${sealed ? "sealed" : ""}`}
        key={label + seat}
        data-testid={`pile-${seat === me ? "mine" : "theirs"}-${label}`}
        aria-label={`${seat === me ? "Your" : "Their"} ${label}, ${n} cards`}
        onClick={() => onPile({ seat, loc, label })}
      >
        <span className="count">{n}</span>
        <span>{label}</span>
      </button>
    );
  };

  const field = (seat: Seat, mine: boolean) => {
    const mz = row(m.board, seat, "MZONE");
    const sz = row(m.board, seat, "SZONE");
    return (
      <div className={`field ${mine ? "mine" : "theirs"}`} data-testid={mine ? "my-field" : "opp-field"}>
        <div className="pilecluster">
          {pileBadge(seat, "GY", "GRAVE", pile(m.board, seat, "GRAVE").length)}
          {pileBadge(seat, "BAN", "REMOVED", pile(m.board, seat, "REMOVED").length)}
        </div>
        <div className="rows">
          {(mine ? [mz, sz] : [sz, mz]).map((r, ri) => {
            const loc = (mine ? ri === 0 : ri === 1) ? "MZONE" : "SZONE";
            return (
              <div className="zonerow" key={loc}>
                {r.map((c, i) => {
                  const ref: TileRef = { controller: seat, location: loc as "MZONE", sequence: i };
                  const pickIdx = zonePick?.findIndex((z) => z.controller === seat && z.sequence === i && loc === "MZONE") ?? -1;
                  if (zonePick && pickIdx >= 0 && !c) {
                    return (
                      <button
                        key={i}
                        className={`slot ${mine ? "mine" : "theirs"} zoneglow`}
                        data-testid="zone-option"
                        onClick={() => onZone(pickIdx)}
                        aria-label={`Place here — Monster ${i + 1}`}
                      >
                        <span className="zonelabel">{i + 1}</span>
                      </button>
                    );
                  }
                  return tile(c, ref);
                })}
              </div>
            );
          })}
        </div>
        <div className="pilecluster">
          {pileBadge(seat, "EX", "EXTRA", pile(m.board, seat, "EXTRA").length)}
          {pileBadge(seat, "DECK", "DECK", (seat === 0 ? m.board.zones.p0_deckCount : m.board.zones.p1_deckCount) ?? 0)}
        </div>
      </div>
    );
  };

  const oppHand = hand(m.board, them);
  const myHand = hand(m.board, me);

  return {
    oppHand: (
      <div className="hand" data-testid="opp-hand">
        {oppHand.map((_, i) => (
          <span className="card back" key={i} />
        ))}
        <span className="chip">{oppHand.length}</span>
      </div>
    ),
    oppField: field(them, false),
    myField: field(me, true),
    myHand: (
      <div className="hand mine" data-testid="my-hand">
        {myHand.map((c, i) => tile(c, { controller: me, location: "HAND", sequence: i }))}
      </div>
    ),
  };
}

/** Every board ref a decision names, so the dim law can lift them out of the scrim. */
export function candidateRefsOf(d: DuelDecision | null): TileRef[] {
  if (!d) return [];
  const list: CardEntry[] =
    "cards" in d ? d.cards : "selects" in d ? d.selects : [];
  return list.map((c) => ({ controller: c.controller, location: c.location, sequence: c.sequence }));
}
