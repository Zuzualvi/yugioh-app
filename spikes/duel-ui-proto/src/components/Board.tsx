import type { DuelStateSnapshot, LocationCode, PhaseName, Seat, ZoneCard } from "../fixtures/types";
import type { CardRef } from "../fixtures/scenarios";
import { CardTile } from "./CardTile";

const PHASES: PhaseName[] = ["DP", "SP", "M1", "BP", "M2", "EP"];

export interface BoardClick {
  owner: Seat;
  location: LocationCode;
  sequence: number;
  zc: ZoneCard;
  anchor: { x: number; y: number };
}

interface Props {
  state: DuelStateSnapshot;
  mySeat: Seat;
  highlight: CardRef[];
  selected: CardRef[];
  actionable: (owner: Seat, location: LocationCode, sequence: number) => boolean;
  spent: (owner: Seat, location: LocationCode, sequence: number) => boolean | undefined;
  onCard: (c: BoardClick) => void;
  onPile: (owner: Seat, location: LocationCode) => void;
  onHover: (code: number | null) => void;
  onPhase: (p: PhaseName) => void;
  legalPhases: PhaseName[];
  clock: React.ReactNode;
}

const isIn = (list: CardRef[], o: Seat, l: LocationCode, s: number) =>
  list.some((r) => r.controller === o && r.location === l && r.sequence === s);

export function Board(p: Props) {
  const z = p.state.zones;
  const oppSeat: Seat = p.mySeat === 0 ? 1 : 0;

  const slot = (zc: ZoneCard | null, owner: Seat, location: LocationCode, sequence: number) => (
    <div
      key={`${owner}-${location}-${sequence}`}
      className={`slot ${owner === p.mySeat ? "mine" : "theirs"}`}
    >
      {zc && (
        <CardTile
          zc={zc}
          owner={owner}
          mySeat={p.mySeat}
          target={isIn(p.highlight, owner, location, sequence)}
          selected={isIn(p.selected, owner, location, sequence)}
          actionable={p.actionable(owner, location, sequence)}
          spent={p.spent(owner, location, sequence)}
          onHover={p.onHover}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            p.onCard({
              owner,
              location,
              sequence,
              zc,
              anchor: { x: r.left + r.width / 2, y: r.top },
            });
          }}
        />
      )}
    </div>
  );

  const pile = (label: string, count: number, owner: Seat, location: LocationCode) => (
    <button
      className="pile"
      onClick={() => p.onPile(owner, location)}
      title={`Inspect — free, instant, never broadcast`}
    >
      <span className="lbl">{label}</span>
      <span className="cnt">{count}</span>
    </button>
  );

  const fieldZone = (zc: ZoneCard | null, owner: Seat) => (
    <div
      className={`slot ${owner === p.mySeat ? "mine" : "theirs"}`}
      style={{ width: 44, height: 58 }}
    >
      {zc ? (
        <CardTile
          zc={zc}
          owner={owner}
          mySeat={p.mySeat}
          onHover={p.onHover}
          style={{ width: 40, height: 54 }}
        />
      ) : (
        <span style={{ fontSize: 8, color: "var(--text-2)" }}>FIELD</span>
      )}
    </div>
  );

  return (
    <>
      {/* opponent hand */}
      <div className="hand dimmable" data-testid="opp-hand" style={{ minHeight: 60 }}>
        {z.p1_hand.map((c, i) => (
          <CardTile
            key={i}
            zc={c}
            owner={oppSeat}
            mySeat={p.mySeat}
            style={{ width: 38, height: 52 }}
            onHover={p.onHover}
          />
        ))}
        <span className="chip" style={{ alignSelf: "center" }}>
          {z.p1_hand.length} in hand
        </span>
      </div>

      {/* opponent field */}
      <div className="field theirs dimmable">
        <div className="pilecluster">
          {pile("BAN", z.p1_removed.length, oppSeat, "REMOVED")}
          {pile("GY", z.p1_grave.length, oppSeat, "GRAVE")}
          {fieldZone(z.p1_fzone, oppSeat)}
        </div>
        <div className="rows">
          <div className="zonerow">{z.p1_szone.map((c, i) => slot(c, oppSeat, "SZONE", i))}</div>
          <div className="zonerow">{z.p1_mzone.map((c, i) => slot(c, oppSeat, "MZONE", i))}</div>
        </div>
        <div className="pilecluster">
          {pile("EXTRA", z.p1_extra.length, oppSeat, "EXTRA")}
          {pile("DECK", z.p1_deckCount, oppSeat, "DECK")}
        </div>
      </div>

      {/* phase rail — always on screen, both the phase display and the advance control */}
      <div className="phaserail dimmable">
        {p.clock}
        <div className="line" />
        {PHASES.map((ph) => {
          const current = p.state.currentPhase === ph && p.state.currentTurn === p.mySeat;
          const currentTheirs = p.state.currentPhase === ph && p.state.currentTurn !== p.mySeat;
          const legal = p.legalPhases.includes(ph);
          return (
            <button
              key={ph}
              className={`phase${current || currentTheirs ? " current" : ""}${legal ? " legal" : ""}`}
              style={
                currentTheirs ? { background: "var(--opp)", borderColor: "var(--opp)" } : undefined
              }
              disabled={!legal}
              onClick={() => legal && p.onPhase(ph)}
            >
              {ph}
            </button>
          );
        })}
        <button
          className="endturn"
          disabled={!p.legalPhases.includes("EP")}
          onClick={() => p.onPhase("EP")}
        >
          End Turn
        </button>
        <div className="line" />
      </div>

      {/* own field */}
      <div className="field mine dimmable">
        <div className="pilecluster">
          {pile("DECK", z.p0_deckCount, p.mySeat, "DECK")}
          {pile("EXTRA", z.p0_extra.length, p.mySeat, "EXTRA")}
        </div>
        <div className="rows">
          <div className="zonerow">{z.p0_mzone.map((c, i) => slot(c, p.mySeat, "MZONE", i))}</div>
          <div className="zonerow">{z.p0_szone.map((c, i) => slot(c, p.mySeat, "SZONE", i))}</div>
        </div>
        <div className="pilecluster">
          {fieldZone(z.p0_fzone, p.mySeat)}
          {pile("GY", z.p0_grave.length, p.mySeat, "GRAVE")}
          {pile("BAN", z.p0_removed.length, p.mySeat, "REMOVED")}
        </div>
      </div>

      {/* own hand */}
      <div className="hand mine" data-testid="my-hand">
        {z.p0_hand.map((c, i) => (
          <CardTile
            key={i}
            zc={c}
            owner={p.mySeat}
            mySeat={p.mySeat}
            target={isIn(p.highlight, p.mySeat, "HAND", i)}
            selected={isIn(p.selected, p.mySeat, "HAND", i)}
            actionable={p.actionable(p.mySeat, "HAND", i)}
            onHover={p.onHover}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              p.onCard({
                owner: p.mySeat,
                location: "HAND",
                sequence: i,
                zc: c,
                anchor: { x: r.left + r.width / 2, y: r.top },
              });
            }}
          />
        ))}
      </div>
    </>
  );
}
