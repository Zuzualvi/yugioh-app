import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { SCENARIOS, cardInfo, type Scenario } from "./proto/scenarios";
import { useDuel } from "./proto/useDuel";
import type { DecisionResponse } from "./proto/classify";
import { useBoardParts, candidateRefsOf } from "./components/Board";
import type { TileRef } from "./components/CardTile";
import { Dock } from "./components/Dock";
import { FeedRail, PhaseRail } from "./components/Rails";
import { CardArt } from "./components/CardArt";
import { hand, row } from "./proto/board";
import type { CardEntry, Seat } from "./proto/types";

const PHASE_IDX: Record<string, number> = { DP: 0, SP: 1, M1: 2, BP: 3, M2: 4, EP: 5 };

export default function App() {
  const [sid, setSid] = useState(SCENARIOS[1]!.id);
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0]!, [sid]);
  const duel = useDuel(scenario);
  const m = duel.model;
  const [selection, setSelection] = useState<number[]>([]);
  const [verbAt, setVerbAt] = useState<{ ref: TileRef; verbs: { label: string; go: () => void }[] } | null>(null);
  const [shake, setShake] = useState<TileRef | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelection([]);
    setVerbAt(null);
    setInspect(null);
  }, [m.step, sid]);

  const d = m.step?.decision ?? null;
  const armed = (d?.kind === "IdleCommand" || d?.kind === "BattleCommand") && m.control === "mine";
  const answering = !!d && !armed && m.control === "mine";

  const answer = (a: DecisionResponse) => {
    setVerbAt(null);
    duel.answer(a);
  };

  // ── ACT mode: the engine's legal-move list becomes what the board affords ───
  function verbsFor(r: TileRef): { label: string; go: () => void }[] {
    if (!d) return [];
    const same = (c: CardEntry) => c.controller === r.controller && c.location === r.location && c.sequence === r.sequence;
    const out: { label: string; go: () => void }[] = [];
    if (d.kind === "IdleCommand") {
      const i1 = d.summons.findIndex(same);
      if (i1 >= 0) {
        // The tribute COUNT is not on the wire at idle time — verified live by the
        // CTO 2026-08-07, ND-1 withdrawn. The chip says a tribute is required and
        // stops; the count arrives at the tribute step, where the engine gives it.
        const lvl = cardInfo(d.summons[i1]!.code)?.level ?? 0;
        out.push({
          label: lvl >= 5 ? "Normal Summon — tribute" : "Normal Summon",
          go: () => answer({ kind: "IdleCommand", action: "summon", index: i1 }),
        });
      }
      const i2 = d.monsterSets.findIndex(same);
      if (i2 >= 0) out.push({ label: "Set", go: () => answer({ kind: "IdleCommand", action: "monsterSet", index: i2 }) });
      const i3 = d.spellSets.findIndex(same);
      if (i3 >= 0) out.push({ label: "Set", go: () => answer({ kind: "IdleCommand", action: "spellSet", index: i3 }) });
      const i4 = d.activates.findIndex(same);
      if (i4 >= 0) out.push({ label: "Activate", go: () => answer({ kind: "IdleCommand", action: "activate", index: i4 }) });
    }
    if (d.kind === "BattleCommand") {
      const i = d.attacks.findIndex(same);
      if (i >= 0) out.push({ label: "Attack", go: () => answer({ kind: "BattleCommand", action: "attack", index: i }) });
    }
    return out;
  }

  const onCard = (r: TileRef) => {
    const code = codeAt(r);
    if (answering) {
      // While a question is up, a click on a candidate answers it; a click on
      // anything else inspects. Inspection is free, instant and never broadcast.
      const cands = candidateRefsOf(d);
      const i = cands.findIndex((c) => c.controller === r.controller && c.location === r.location && c.sequence === r.sequence);
      if (i >= 0) {
        setSelection((s) => (s.includes(i) ? s.filter((x) => x !== i) : [i]));
        return;
      }
      if (code) setInspect(code);
      return;
    }
    if (!armed || r.controller !== m.mySeat) {
      if (code) setInspect(code);
      return;
    }
    const vs = verbsFor(r);
    if (vs.length === 0) {
      // D1/D2: the screen never states WHY. No sentence, no fabricated cause.
      setShake(r);
      window.setTimeout(() => setShake(null), 220);
      if (code) setInspect(code);
      return;
    }
    setVerbAt({ ref: r, verbs: vs });
  };

  function codeAt(r: TileRef): number {
    if (r.location === "HAND") return hand(m.board, r.controller)[r.sequence]?.code ?? 0;
    const rw = row(m.board, r.controller, r.location as "MZONE");
    return rw[r.sequence]?.code ?? 0;
  }

  const zonePick =
    d?.kind === "SelectZone"
      ? d.zones.map((z) => ({ controller: z.controller, sequence: z.sequence }))
      : null;

  const legalPhases: string[] = [];
  if (d?.kind === "IdleCommand") {
    legalPhases.push("M1");
    if (d.toBattlePhase) legalPhases.push("BP");
  }
  if (d?.kind === "BattleCommand") {
    legalPhases.push("BP");
    if (d.toMainPhase2) legalPhases.push("M2");
  }

  const endTurn = () => {
    if (d?.kind === "IdleCommand") answer({ kind: "IdleCommand", action: "toEP", index: null });
    else if (d?.kind === "BattleCommand") answer({ kind: "BattleCommand", action: "toEP", index: null });
  };

  const info = inspect ? cardInfo(inspect) : null;
  const parts = useBoardParts({
    m,
    onCard,
    onHover: (c) => {
      if (!answering) setInspect(c);
    },
    candidateRefs: answering ? candidateRefsOf(d) : [],
    selectedRefs: answering ? candidateRefsOf(d).filter((_, i) => selection.includes(i)) : [],
    zonePick,
    onZone: (i) => answer({ kind: "SelectZone", indices: [i] }),
    shakeRef: shake,
  });

  return (
    <div className="app">
      <div className="protobar">
        <span>Scenario</span>
        <select className="chip" value={sid} onChange={(e) => setSid(e.target.value)} data-testid="scenario-picker">
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="btn sm" onClick={duel.reset} data-testid="reset">
          Restart
        </button>
        <span className="brief">{scenario.brief}</span>
      </div>

      <div className="duel">
        <TopBar m={m} />
        <div className="playfield" ref={stageRef} data-testid="playfield">
          <div className="boardzone">
            <div className="fieldband">
              {parts.oppHand}
              <Plate name={scenario.opponentName} lp={m.board.lp[(1 - m.mySeat) as Seat]} mine={false} />
            </div>
            {parts.oppField}
            <PhaseRail
              current={PHASE_IDX[legalPhases.includes("BP") && d?.kind === "BattleCommand" ? "BP" : "M1"] ?? 2}
              legal={legalPhases}
              onPhase={(p) => {
                if (p === "BP" && d?.kind === "IdleCommand") answer({ kind: "IdleCommand", action: "toBP", index: null });
                if (p === "M2" && d?.kind === "BattleCommand") answer({ kind: "BattleCommand", action: "toM2", index: null });
              }}
              onEndTurn={endTurn}
              canEndTurn={armed}
              summonSpent={m.normalSummonSpent}
              onTurn={m.control === "mine"}
            />
            {parts.myField}
            <div className="fieldband">
              <span />
              <Plate name={scenario.myName} lp={m.board.lp[m.mySeat]} mine />
            </div>
          </div>
          <Dock
            m={m}
            onAnswer={answer}
            onCancel={duel.cancelIntent}
            onClaim={duel.claim}
            onDismissDelta={duel.dismissDelta}
            onToggleDelta={duel.toggleDelta}
            selection={selection}
            setSelection={setSelection}
          />
          {parts.myHand}
          {answering ? <div className="dimscrim" data-testid="dim-scrim" /> : null}
          {verbAt ? (
            <VerbCluster
              verbs={verbAt.verbs}
              onClose={() => setVerbAt(null)}
            />
          ) : null}
          {info ? (
            <aside className="inspector" data-testid="inspector">
              <div className="inspector-art">
                <CardArt code={info.passcode} broken={scenario.breakArt} />
              </div>
              <h3>{info.name}</h3>
              <div className="tb-head">
                {info.frame === "trap" || info.frame === "spell"
                  ? `${info.frame[0]!.toUpperCase()}${info.frame.slice(1)}`
                  : `${info.attribute ?? ""} · Level ${info.level ?? "?"} · ${info.race ?? ""}`}
              </div>
              {info.atk != null ? (
                <div className="tb-head">
                  ATK {info.atk} / DEF {info.def}
                </div>
              ) : null}
              <p className="tb-body">{info.desc}</p>
            </aside>
          ) : null}
          {m.ended ? <EndOverlay m={m} /> : null}
        </div>
        <FeedRail
          events={m.feed}
          mySeat={m.mySeat}
          markAt={m.delta ? Math.max(0, m.feed.length - m.delta.length) : null}
          names={{ me: scenario.myName, opp: scenario.opponentName }}
        />
      </div>
    </div>
  );
}

function TopBar({ m }: { m: ReturnType<typeof useDuel>["model"] }) {
  const mine = m.control === "mine" || m.control === "resolving";
  return (
    <header className="topbar" data-testid="top-bar">
      <button className="btn sm">← Exit</button>
      <span className="tb-name">
        <span className={`presencedot ${m.presence === "away" ? "lost" : ""}`} />
        {m.scenario.opponentName}
      </span>
      <span className={`turnpill ${mine ? "mine" : "theirs"}`}>
        {m.ended ? "DUEL OVER" : mine ? "YOUR TURN" : "THEIR TURN"}
      </span>
      <span className="tb-spacer" />
      <button className="btn sm">⚙ Settings</button>
      <button className="btn sm decline" data-testid="resign">
        Resign
      </button>
    </header>
  );
}

function Plate({ name, lp, mine }: { name: string; lp: number; mine: boolean }) {
  return (
    <div className={`sideplate ${mine ? "mine" : "theirs"}`} data-testid={mine ? "my-lp" : "opp-lp"} aria-label={`${name} ${lp} life points`}>
      <span className="who">{name}</span>
      <span className="lpval">{lp.toLocaleString()}</span>
    </div>
  );
}

function VerbCluster({ verbs, onClose }: { verbs: { label: string; go: () => void }[]; onClose: () => void }) {
  return (
    <div className="verbcluster" data-testid="verb-chip-cluster" role="menu">
      {verbs.map((v) => (
        <button key={v.label} className="verb" role="menuitem" onClick={v.go}>
          {v.label}
        </button>
      ))}
      <button className="verb" role="menuitem" onClick={onClose}>
        Inspect
      </button>
      <span className="verbhint">Esc closes — costs nothing</span>
    </div>
  );
}

function EndOverlay({ m }: { m: ReturnType<typeof useDuel>["model"] }) {
  const e = m.ended!;
  const won = e.winner === m.mySeat;
  const cause: Record<string, string> = {
    "life points": won
      ? `${m.scenario.opponentName}'s life points reached 0.`
      : "Your life points reached 0.",
    resign: won ? `${m.scenario.opponentName} resigned.` : "You resigned.",
    abandoned: won
      ? `${m.scenario.opponentName} left the duel and did not come back.`
      : "You left the duel.",
  };
  return (
    <div className="endscrim" data-testid="duel-end">
      <div className="endcard">
        <span className={`result ${won ? "win" : "lose"}`}>{won ? "You win" : "You lose"}</span>
        <span className="cause">{cause[e.reason] ?? `The duel ended (${e.reason}).`}</span>
        <div className="totals">
          <span>
            {m.scenario.myName} {m.board.lp[m.mySeat].toLocaleString()}
          </span>
          <span>
            {m.scenario.opponentName} {m.board.lp[(1 - m.mySeat) as Seat].toLocaleString()}
          </span>
        </div>
        <div className="acts">
          <button className="btn">Review board</button>
          <button className="btn primary">Play {m.scenario.opponentName} again</button>
          <button className="btn decline">Back to Home</button>
        </div>
      </div>
    </div>
  );
}
