/**
 * Event log rail. "Game state, not teaching. That's the line."
 * Master Duel's STRUCTURE over DuelingBook's COMPLETENESS:
 *   every engine event logged; rendered as phase-nested rows of
 *   thumbnail + name + verb + from→to arrow, tinted by owner; LP snapshot at each
 *   turn boundary; filterable and searchable; collapsed by default; one right rail.
 * No prose sentences.
 */

import { useMemo, useState } from "react";
import { cardName } from "../fixtures/cards";
import type { DuelEvent, LocationCode, Seat } from "../fixtures/types";
import { frameClass } from "./CardTile";

const GLYPH: Record<LocationCode, string> = {
  DECK: "Deck",
  HAND: "Hand",
  MZONE: "Field",
  SZONE: "S/T",
  GRAVE: "GY",
  REMOVED: "Banished",
  EXTRA: "Extra",
  OVERLAY: "Ovl",
  FZONE: "Field Sp.",
  PZONE: "Pend.",
};

const FILTERS = ["All", "Summons", "Activations", "Battle", "Movement", "Phases", "Draws"] as const;
type Filter = (typeof FILTERS)[number];

function matches(e: DuelEvent, f: Filter): boolean {
  switch (f) {
    case "All":
      return true;
    case "Summons":
      return ["Summon", "Tribute Summon", "Special Summon", "Flip Summon", "Set"].includes(e.verb);
    case "Activations":
      return ["Activate", "Chain", "Resolve", "Negated", "Target"].includes(e.verb);
    case "Battle":
      return ["Attack", "Destroyed", "Damage"].includes(e.verb);
    case "Movement":
      return ["Move", "Banish", "Position"].includes(e.verb);
    case "Phases":
      return e.engineType === 40 || e.engineType === 41;
    case "Draws":
      return e.verb === "Draw";
  }
}

interface Props {
  open: boolean;
  onToggle: () => void;
  log: DuelEvent[];
  mySeat: Seat;
  lp: [number, number];
  opponentName: string;
  onPick: (code: number) => void;
  ended: string | null;
}

export function LogRail(p: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const rows = useMemo(
    () =>
      p.log.filter(
        (e) =>
          matches(e, filter) &&
          (q === "" || cardName(e.code).toLowerCase().includes(q.toLowerCase())),
      ),
    [p.log, filter, q],
  );

  if (!p.open) {
    return (
      <div className="rail collapsed">
        <button className="chip" onClick={p.onToggle} title="Open log (L)">
          =
        </button>
        {p.log.length > 0 && (
          <span
            style={{
              marginTop: 6,
              width: 7,
              height: 7,
              borderRadius: 4,
              background: "var(--accent)",
              display: "block",
            }}
          />
        )}
      </div>
    );
  }

  // group by turn, then by phase
  const groups: { turn: number; owner: Seat; phases: { phase: string; rows: DuelEvent[] }[] }[] =
    [];
  for (const e of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.turn !== e.turnNumber) {
      g = { turn: e.turnNumber, owner: e.turnNumber % 2 === 0 ? 0 : 1, phases: [] };
      groups.push(g);
    }
    let ph = g.phases[g.phases.length - 1];
    if (!ph || ph.phase !== e.phase) {
      ph = { phase: e.phase, rows: [] };
      g.phases.push(ph);
    }
    ph.rows.push(e);
  }

  const PHASE_FULL: Record<string, string> = {
    DP: "Draw Phase",
    SP: "Standby Phase",
    M1: "Main Phase 1",
    BP: "Battle Phase",
    M2: "Main Phase 2",
    EP: "End Phase",
  };

  return (
    <div className="rail">
      <div className="head">
        <input
          placeholder="Search cards…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          {FILTERS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button className="chip" onClick={p.onToggle}>
          x
        </button>
      </div>
      <div className="rows">
        {p.log.length === 0 && <div className="empty">The duel has not started.</div>}
        {p.log.length > 0 && rows.length === 0 && (
          <div className="empty">
            No {filter.toLowerCase()} events this duel.
            <br />
            <button
              className="chip"
              style={{ marginTop: 8 }}
              onClick={() => {
                setFilter("All");
                setQ("");
              }}
            >
              Clear filter
            </button>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.turn}>
            <div className={`turnbanner ${g.owner === p.mySeat ? "mine" : "theirs"}`}>
              TURN {g.turn} — {g.owner === p.mySeat ? "You" : p.opponentName}
            </div>
            <div className="lpsnap">
              <span>You {p.lp[p.mySeat]}</span>
              <span>
                {p.opponentName} {p.lp[p.mySeat === 0 ? 1 : 0]}
              </span>
            </div>
            {g.phases.map((ph, i) => (
              <div key={i}>
                <div className="phasehead">{PHASE_FULL[ph.phase] ?? ph.phase}</div>
                {ph.rows.map((e) => (
                  <div key={e.id} className="logrow" onClick={() => e.code && p.onPick(e.code)}>
                    <span className={`thumb ${frameClass(e.code)}`} />
                    <span className={`nm ${e.owner === p.mySeat ? "mine" : "theirs"}`}>
                      {e.code ? cardName(e.code) : e.owner === p.mySeat ? "You" : p.opponentName}
                    </span>
                    <span className="vb">{e.verb}</span>
                    {e.from && e.to && (
                      <span className="arrow">
                        {GLYPH[e.from]} → {GLYPH[e.to]}
                      </span>
                    )}
                    {e.amount !== undefined && <span className="arrow">−{e.amount}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {p.ended && (
          <div className="phasehead" style={{ color: "var(--warn)" }}>
            Duel ended — {p.ended}
          </div>
        )}
      </div>
    </div>
  );
}
