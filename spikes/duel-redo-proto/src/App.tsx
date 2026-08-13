import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { SCENARIOS, cardInfo, type Scenario } from "./proto/scenarios";
import { useDuel } from "./proto/useDuel";
import type { DecisionResponse } from "./proto/classify";
import { useBoardParts, candidateRefsOf } from "./components/Board";
import type { TileRef } from "./components/CardTile";
import { Dock, type Answer } from "./components/Dock";
import { FeedRail, PhaseRail } from "./components/Rails";
import { CardArt } from "./components/CardArt";
import { ChainStrip, PileInspector, type PileTarget } from "./components/Piles";
import { hand, resolveCode, row } from "./proto/board";
import type { CardEntry, Seat } from "./proto/types";


export default function App() {
  const [sid, setSid] = useState(SCENARIOS[1]!.id);
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0]!, [sid]);
  const duel = useDuel(scenario);
  const m = duel.model;
  const [selection, setSelection] = useState<number[]>([]);
  const [verbAt, setVerbAt] = useState<{ ref: TileRef; verbs: { label: string; go: () => void }[] } | null>(null);
  const [shake, setShake] = useState<TileRef | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const [openPile, setOpenPile] = useState<PileTarget | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelection([]);
    setVerbAt(null);
    setInspect(null);
    setOpenPile(null);
  }, [m.step, sid]);

  /**
   * THE KEYBOARD CONTRACT — normative, and it is the reason this handler exists at
   * all rather than being a convenience.
   *
   * The verb cluster advertises "Esc closes — costs nothing" and, before this, no
   * key handler fired anywhere in the app: a control stating a capability the
   * product does not have, which is the same class of defect as the screen
   * asserting a cause the engine never gave.
   *
   * NO KEYBOARD EVENT MAY SUBMIT OR COMMIT A DECISION. Escape dismisses transient
   * UI and takes the player's own cancel where one exists. It deliberately does NOT
   * answer an OFFER: declining a chain window is a substantive game answer with
   * consequences, not an escape, and that is exactly the distinction the
   * classification law draws. On the previous prototype Escape COMMITTED an
   * irreversible tribute step and destroyed a card the player never chose.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openPile) {
        setOpenPile(null);
        return;
      }
      if (verbAt) {
        setVerbAt(null);
        return;
      }
      if (inspect !== null) {
        setInspect(null);
        return;
      }
      if (m.intent?.cancelable) duel.cancelIntent();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [verbAt, inspect, m.intent, duel]);

  const d = m.step?.decision ?? null;
  const armed = (d?.kind === "IdleCommand" || d?.kind === "BattleCommand") && m.control === "mine";
  const answering = !!d && !armed && m.control === "mine";

  const answer: Answer = (a, probe) => {
    setVerbAt(null);
    duel.answer(a, probe);
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
      const spent = m.spentAttackers.some(
        (x) => x.controller === r.controller && x.location === r.location && x.sequence === r.sequence,
      );
      // The engine re-issues BattleCommand without a monster that has already
      // declared. Modelling that is why the verb disappears; the screen still says
      // nothing about WHY, per D1/D2.
      if (i >= 0 && !spent)
        out.push({ label: "Attack", go: () => answer({ kind: "BattleCommand", action: "attack", index: i }) });
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
    if (verbAt && sameTile(verbAt.ref, r)) {
      setVerbAt(null);
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

  function sameTile(a: TileRef, b: TileRef) {
    return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
  }

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
  // A snapshot taken mid-duel: something is on a field, or life points have moved.
  const midDuel =
    m.board.lp[0] < 8000 ||
    m.board.lp[1] < 8000 ||
    ([0, 1] as Seat[]).some((sd) =>
      (["MZONE", "SZONE"] as const).some((l) => row(m.board, sd, l).some((c) => c != null)),
    );
  const refResolve = (ref: unknown) => {
    const r = ref as { controller?: Seat; location?: string; sequence?: number } | undefined;
    if (!r || r.controller === undefined || !r.location) return 0;
    return (
      resolveCode(scenario.board, {
        controller: r.controller,
        location: r.location as "MZONE",
        sequence: r.sequence ?? 0,
      }) || 0
    );
  };
  // WHERE THE FEED RAIL'S `since you last acted` BOUNDARY IS, BY IDENTITY — not by
  // arithmetic. It was `feed.length - delta.length`, which is only correct at the
  // instant the delta lands: every event appended afterwards moved the mark one row
  // further down a rail whose boundary had not moved. The delta's events ARE the
  // objects appended to the feed, so the boundary is where the first of them sits.
  // `lastIndexOf`, because the prototype replays the same recorded slice on every
  // handover, so one object can appear twice and the boundary is the latest append.
  const deltaBoundary = m.delta?.length ? m.feed.lastIndexOf(m.delta[0]!) : -1;

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
    onPile: (t) => setOpenPile((cur) => (cur && cur.seat === t.seat && cur.loc === t.loc ? null : t)),
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
        <TopBar m={m} onResign={duel.resign} />
        <div
          className="playfield"
          ref={stageRef}
          data-testid="playfield"
          onClick={(e) => {
            // A click that lands on background — anywhere that is not a card, a
            // chip or a control — clears the armed card. The armed state was
            // otherwise sticky and invisible: a verb bar still offering Set/Activate
            // for a card you had stopped thinking about, one click from firing.
            if (!(e.target as HTMLElement).closest("button")) {
              setVerbAt(null);
              setInspect(null);
            }
          }}
        >
          <div className="boardzone">
            <div className="fieldband">
              {parts.oppHand}
              <Plate name={scenario.opponentName} lp={m.board.lp[(1 - m.mySeat) as Seat]} mine={false} />
            </div>
            {parts.oppField}
            <PhaseRail
              currentPhase={m.board.currentPhase}
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
          <ChainStrip events={m.feed} mySeat={m.mySeat} resolve={refResolve} />
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
            <VerbCluster verbs={verbAt.verbs} onClose={() => setVerbAt(null)} />
          ) : null}
          {openPile ? (
            <PileInspector
              board={m.board}
              mySeat={m.mySeat}
              target={openPile}
              onClose={() => setOpenPile(null)}
              broken={scenario.breakArt}
            />
          ) : null}
          {info && !openPile ? (
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
          {m.ended && !m.ended.reviewing ? (
            <EndOverlay m={m} onReview={duel.reviewBoard} onRematch={() => setSid("start")} />
          ) : null}
          {m.ended?.reviewing ? (
            <button className="endedpill" data-testid="show-result" onClick={duel.showResult}>
              Duel over — show result
            </button>
          ) : null}
        </div>
        <FeedRail
          events={m.feed}
          mySeat={m.mySeat}
          markAt={deltaBoundary >= 0 ? deltaBoundary : null}
          names={{ me: scenario.myName, opp: scenario.opponentName }}
          resolve={refResolve}
          midDuel={midDuel}
        />
      </div>
    </div>
  );
}

function TopBar({ m, onResign }: { m: ReturnType<typeof useDuel>["model"]; onResign: () => void }) {
  const mine = m.control === "mine" || m.control === "resolving";
  const [confirming, setConfirming] = useState(false);
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
      <button className="btn sm" disabled title="">
        ⚙ Settings (prototype)
      </button>
      {/* E1 — the guarantee of last resort. With no clock, a player stuck on a
          decision the client cannot answer has nothing else to release them, so an
          inert Resign would make E1 a claim the screen does not honour. Two-step:
          a misclick that forfeits is not acceptable. */}
      {confirming ? (
        <>
          <button className="btn sm decline" data-testid="resign-confirm" onClick={onResign}>
            Confirm resign
          </button>
          <button className="btn sm" data-testid="resign-cancel" onClick={() => setConfirming(false)}>
            Keep playing
          </button>
        </>
      ) : (
        <button
          className="btn sm decline"
          data-testid="resign"
          disabled={!!m.ended}
          onClick={() => setConfirming(true)}
        >
          Resign
        </button>
      )}
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
      <button className="verb verbclose" data-testid="verb-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <span className="verbhint">Esc closes — costs nothing</span>
    </div>
  );
}

function EndOverlay({
  m,
  onReview,
  onRematch,
}: {
  m: ReturnType<typeof useDuel>["model"];
  onReview: () => void;
  onRematch: () => void;
}) {
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
          <button className="btn" data-testid="review-board" onClick={onReview}>
            Review board
          </button>
          <button className="btn primary" data-testid="rematch" onClick={onRematch}>
            Play {m.scenario.opponentName} again
          </button>
          <button className="btn decline" data-testid="back-home" disabled title="">
            Back to Home (prototype: outside the duel screen)
          </button>
        </div>
      </div>
    </div>
  );
}
