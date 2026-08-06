import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCENARIOS } from "./fixtures/scenarios";
import type { CardRef, Step } from "./fixtures/scenarios";
import type { DuelDecision, LocationCode, PhaseName, Seat, ZoneCard } from "./fixtures/types";
import { card, cardName } from "./fixtures/cards";
import { useProtoEngine } from "./engine/useProtoEngine";
import { Board } from "./components/Board";
import type { BoardClick } from "./components/Board";
import { QuestionBar } from "./components/QuestionBar";
import { ChainStrip, IntentRibbon } from "./components/Dock";
import { LogRail } from "./components/LogRail";
import { Inspector } from "./components/Inspector";
import { CardTile } from "./components/CardTile";

const ME: Seat = 0;
const OPPONENT = "Sakura";

/** Stable verb order — muscle memory only forms if the order never moves. */
const VERB_ORDER = [
  "Summon",
  "Tribute Summon",
  "Special Summon",
  "Set",
  "Activate",
  "Change Position",
  "Attack",
  "Attack directly",
  "Inspect",
];

function tributesFor(level: number | null | undefined): number {
  if (!level) return 0;
  if (level >= 7) return 2;
  if (level >= 5) return 1;
  return 0;
}

function sameRef(a: { controller: Seat; location: LocationCode; sequence: number }, b: CardRef) {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
}

function verbsFor(decision: DuelDecision | null, ref: CardRef): string[] {
  const out: string[] = [];
  if (decision?.kind === "IdleCommand") {
    const s = decision.summons.find((e) => sameRef(e, ref));
    if (s) {
      const t = tributesFor(card(s.code)?.level);
      out.push(t > 0 ? `Tribute Summon (${t})` : "Summon");
    }
    if (decision.specialSummons.some((e) => sameRef(e, ref))) out.push("Special Summon");
    if (
      decision.monsterSets.some((e) => sameRef(e, ref)) ||
      decision.spellSets.some((e) => sameRef(e, ref))
    )
      out.push("Set");
    if (decision.activates.some((e) => sameRef(e, ref))) out.push("Activate");
    if (decision.posChanges.some((e) => sameRef(e, ref))) out.push("Change Position");
  }
  if (decision?.kind === "BattleCommand") {
    const a = decision.attacks.find((e) => sameRef(e, ref));
    if (a) out.push(a.canDirectAttack ? "Attack directly" : "Attack");
  }
  out.push("Inspect");
  return out.sort((x, y) => {
    const ix = VERB_ORDER.findIndex((v) => x.startsWith(v.split(" (")[0]));
    const iy = VERB_ORDER.findIndex((v) => y.startsWith(v.split(" (")[0]));
    return ix - iy;
  });
}

export default function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const [revealAuto, setRevealAuto] = useState(true);
  const [chooseZones, setChooseZones] = useState(false);
  const [verbosity, setVerbosity] = useState<"OFF" | "Auto" | "ON">("Auto");
  const [logOpen, setLogOpen] = useState(false);

  const { view, answer, reset, setAutoPush } = useProtoEngine(scenario, revealAuto, chooseZones);

  const [selected, setSelected] = useState<CardRef[]>([]);
  const [cluster, setCluster] = useState<{
    ref: CardRef;
    verbs: string[];
    x: number;
    y: number;
  } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [pile, setPile] = useState<{ owner: Seat; location: LocationCode } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [endDismissed, setEndDismissed] = useState(false);
  const toastTimer = useRef<number>();

  const d = view.step?.decision ?? null;
  const inAnswer = view.mode === "answer";

  useEffect(() => setSelected([]), [view.stepIndex]);
  useEffect(() => setCluster(null), [view.stepIndex, view.mode]);
  useEffect(() => {
    setEndDismissed(false);
  }, [scenarioId]);

  // A timeout forfeits the duel — modelled for real.
  useEffect(() => {
    if (view.clockSeconds === 0 && view.onClockSeat === ME && !view.end && !view.busy) answer();
  }, [view.clockSeconds, view.onClockSeat, view.end, view.busy, answer]);

  const say = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  // ── Esc closes the cheapest thing first ────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pile) setPile(null);
        else if (cluster) setCluster(null);
        else if (pinned !== null) setPinned(null);
        else if (inAnswer && d && "cancelable" in d && d.cancelable) answer();
      }
      if (e.key.toLowerCase() === "l") setLogOpen((o) => !o);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pile, cluster, pinned, inAnswer, d, answer]);

  const expected = view.step?.expect;

  const onCard = (c: BoardClick) => {
    const ref: CardRef = { controller: c.owner, location: c.location, sequence: c.sequence };

    // ANSWER mode: clicking a highlighted card answers the question, on the board.
    if (inAnswer) {
      if (view.highlight.some((h) => sameRef(h, ref))) toggle(ref);
      else {
        setPinned(c.zc.code);
        setAutoPush(null);
      }
      return;
    }
    if (view.mode !== "act") {
      setPinned(c.zc.code);
      return;
    }
    // ACT mode: your card → verb chips. Anything else → free, silent inspection.
    if (c.owner !== ME) {
      setPinned(c.zc.code);
      return;
    }
    const verbs = verbsFor(d, ref);
    if (verbs.length === 1) {
      setPinned(c.zc.code);
      say("No legal verbs for that card right now.");
      return;
    }
    setCluster({ ref, verbs, x: c.anchor.x, y: c.anchor.y });
  };

  const pickVerb = (v: string, ref: CardRef) => {
    setCluster(null);
    if (v === "Inspect") {
      const zc = findCard(view.state.zones, ref);
      setPinned(zc?.code ?? 0);
      return;
    }
    if (expected && "ref" in expected && sameRef(expected.ref, ref) && expected.verb === v) {
      answer();
    } else {
      say(`"${v}" is legal, but this prototype only scripts one line per scenario.`);
    }
  };

  const onPhase = (ph: PhaseName) => {
    if (expected && "phase" in expected && expected.phase === ph) answer();
    else say("That phase change is legal — this prototype scripts one line per scenario.");
  };

  const toggle = (r: CardRef) => {
    setSelected((prev) => {
      const has = prev.some((x) => sameRef(x, r));
      if (has) return prev.filter((x) => !sameRef(x, r));
      const max = d && "max" in d ? d.max : 1;
      const next = [...prev, r];
      return next.length > max ? next.slice(next.length - max) : next;
    });
  };

  const legalPhases: PhaseName[] = useMemo(() => {
    if (view.mode !== "act" || !d) return [];
    const out: PhaseName[] = [];
    if (d.kind === "IdleCommand") {
      if (d.toBattlePhase) out.push("BP");
      if (d.toEndPhase) out.push("EP");
    }
    if (d.kind === "BattleCommand") {
      if (d.toMainPhase2) out.push("M2");
      if (d.toEndPhase) out.push("EP");
    }
    return out;
  }, [d, view.mode]);

  const actionable = (owner: Seat, location: LocationCode, sequence: number) =>
    view.mode === "act" &&
    owner === ME &&
    verbsFor(d, { controller: owner, location, sequence }).length > 1;

  const spent = (owner: Seat, location: LocationCode, sequence: number) => {
    if (!d || d.kind !== "BattleCommand" || owner !== ME || location !== "MZONE") return undefined;
    return !d.attacks.some(
      (a) => a.controller === owner && a.location === location && a.sequence === sequence,
    );
  };

  const zonePick: CardRef[] =
    inAnswer && d?.kind === "SelectZone"
      ? d.zones.map((z) => ({
          controller: z.controller,
          location: z.location as LocationCode,
          sequence: z.sequence,
        }))
      : [];

  const inspectCode = pinned ?? hover ?? view.autoPush;
  const critical = view.clockSeconds <= 10 && view.onClockSeat === ME && !view.end;

  return (
    <div className="app">
      <div className="topbar">
        {/* PROTOTYPE-ONLY chrome, left of the divider */}
        <select
          className="chip"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          style={{ background: "var(--bg-2)" }}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button className="chip" onClick={reset}>
          Restart
        </button>
        <button
          className={`chip${revealAuto ? " on" : ""}`}
          onClick={() => setRevealAuto((v) => !v)}
        >
          {revealAuto ? "Showing auto-answered steps" : "Auto-answered steps hidden"}
        </button>
        <span style={{ color: "var(--bg-3)" }}>│</span>

        {/* real duel chrome */}
        <span style={{ color: "var(--text-2)" }}>
          <span style={{ color: view.end ? "var(--text-2)" : "#4ade80" }}>●</span> {OPPONENT}
        </span>
        <span className={`turnpill ${view.state.currentTurn === ME ? "mine" : "theirs"}`}>
          TURN {view.state.turnNumber} · {view.state.currentTurn === ME ? "YOURS" : "THEIRS"}
        </span>
        <span className="sp" />
        <button
          className="chip"
          onClick={() =>
            setVerbosity(verbosity === "OFF" ? "Auto" : verbosity === "Auto" ? "ON" : "OFF")
          }
          title="Response prompts — hold A to widen, D to narrow"
        >
          Chain: {verbosity}
        </button>
        <button
          className={`chip${chooseZones ? " on" : ""}`}
          onClick={() => setChooseZones((v) => !v)}
        >
          Choose zones: {chooseZones ? "ON" : "OFF"}
        </button>
        <button className="chip" onClick={() => setLogOpen((o) => !o)}>
          Log
        </button>
      </div>

      <div className="body">
        <div className={`stage${inAnswer ? " dimmed" : ""}${critical ? " critical" : ""}`}>
          {inAnswer && <div className="dimscrim" />}
          <Board
            state={view.state}
            mySeat={ME}
            highlight={inAnswer ? view.highlight : []}
            selected={selected}
            actionable={actionable}
            spent={spent}
            onCard={onCard}
            onPile={(owner, location) => setPile({ owner, location })}
            onHover={setHover}
            onPhase={onPhase}
            legalPhases={legalPhases}
            clock={
              <span
                className={`clockbadge ${view.onClockSeat === ME ? "mine" : "theirs"}${
                  view.onClockSeat === ME && view.clockSeconds <= 60 ? " warn" : ""
                }`}
              >
                {Math.floor(view.clockSeconds / 60)}:
                {String(view.clockSeconds % 60).padStart(2, "0")}
                {view.onClockSeat === ME && view.clockSeconds <= 10 && " — timeout forfeits"}
              </span>
            }
          />

          {/* zone picking happens ON THE BOARD (only when Choose zones is ON) */}
          {zonePick.length > 0 && !view.autoFlash && (
            <ZoneOverlay zones={zonePick} onPick={() => answer()} />
          )}

          <div className="lp mine">
            <span className="who">You</span>
            <span className="val">{view.state.lp[ME]}</span>
          </div>
          <div className="lp theirs">
            <span className="who">{OPPONENT}</span>
            <span className="val">{view.state.lp[ME === 0 ? 1 : 0]}</span>
          </div>

          <Inspector
            code={inspectCode ?? null}
            pushed={pinned === null && hover === null && view.autoPush !== null}
            pinned={pinned !== null}
            onClose={() => {
              setPinned(null);
              setAutoPush(null);
            }}
          />

          {/* the bottom dock: chain strip → intent ribbon → ONE question bar */}
          <div className="dock">
            <ChainStrip chain={view.chain} mySeat={ME} />
            {view.autoFlash && (
              <div className="autoflash">auto-answered &middot; {view.autoFlash}</div>
            )}
            {view.intent && <IntentRibbon intent={view.intent} onCancel={() => answerCancel()} />}
            {inAnswer && d && (
              <QuestionBar
                auto={!!view.autoFlash}
                caption={view.step?.caption}
                decision={d}
                mySeat={ME}
                opponentName={OPPONENT}
                chain={view.chain}
                selected={selected}
                toggle={toggle}
                onConfirm={answer}
                onDecline={answer}
                clockSeconds={view.clockSeconds}
                commitNext={!!view.intent && view.intent.stepIndex + 1 === view.intent.commitAt}
                subjectCode={view.intent?.cardCode}
              />
            )}
          </div>

          {(view.mode === "waiting" || view.mode === "resolving") && !view.end && (
            <div className="waitbanner">
              <span className="spinner" />
              {view.waitLabel ??
                (view.onClockSeat !== ME ? `${OPPONENT} is deciding` : "Engine is resolving…")}
            </div>
          )}

          {toast && (
            <div
              className="waitbanner"
              style={{ top: "auto", bottom: 12, borderColor: "var(--accent)" }}
            >
              {toast}
            </div>
          )}

          {view.note && (
            <div className="protonote">
              |<b>Design note</b> — {view.note}
            </div>
          )}

          {pile && (
            <PileSheet
              owner={pile.owner}
              location={pile.location}
              state={view.state}
              onClose={() => setPile(null)}
              onHover={setHover}
            />
          )}

          {view.end && !endDismissed && (
            <div className="scrim">
              <div className="sheet" style={{ textAlign: "center", maxWidth: 380 }}>
                <h2>
                  {view.end.winner === null
                    ? "Draw"
                    : view.end.winner === ME
                      ? "You win"
                      : "You lose"}
                </h2>
                <div className="sub">
                  {view.end.reason === "timeout"
                    ? view.end.winner === ME
                      ? `${OPPONENT}'s move timer ran out.`
                      : "Your move timer ran out — the duel is forfeit."
                    : view.end.reason === "resign"
                      ? view.end.winner === ME
                        ? `${OPPONENT} resigned.`
                        : "You resigned."
                      : view.end.winner === ME
                        ? `${OPPONENT}'s LP reached 0.`
                        : "Your LP reached 0."}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
                  <span className="chip">You {view.state.lp[ME]}</span>
                  <span className="chip">
                    {OPPONENT} {view.state.lp[ME === 0 ? 1 : 0]}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "center" }}>
                  <button className="btn decline" onClick={() => setEndDismissed(true)}>
                    Review board
                  </button>
                  <button
                    className="btn decline"
                    onClick={() => {
                      setLogOpen(true);
                      setEndDismissed(true);
                    }}
                  >
                    Open log
                  </button>
                  <button className="btn primary" onClick={reset}>
                    Replay scenario
                  </button>
                </div>
              </div>
            </div>
          )}

          {view.end && endDismissed && (
            <div
              className="waitbanner"
              style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
            >
              Duel ended
              <button className="chip" onClick={() => setEndDismissed(false)}>
                Result
              </button>
            </div>
          )}
        </div>

        <LogRail
          open={logOpen}
          onToggle={() => setLogOpen((o) => !o)}
          log={view.log}
          mySeat={ME}
          lp={view.state.lp}
          opponentName={OPPONENT}
          onPick={(c) => setPinned(c)}
          ended={view.end?.reason ?? null}
        />
      </div>

      {cluster && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 15 }}
            onClick={() => setCluster(null)}
          />
          <div
            className="verbcluster"
            style={{ left: cluster.x, top: cluster.y - 42, transform: "translateX(-50%)" }}
          >
            {cluster.verbs.map((v) => (
              <button key={v} className="verb" onClick={() => pickVerb(v, cluster.ref)}>
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  function answerCancel() {
    say("Cancelled — nothing was consumed. (The prototype restarts the scenario.)");
    reset();
  }
}

function findCard(zones: import("./fixtures/types").DuelZones, ref: CardRef): ZoneCard | null {
  const key = `${ref.controller === 0 ? "p0" : "p1"}_${ref.location.toLowerCase() === "mzone" ? "mzone" : ref.location.toLowerCase() === "szone" ? "szone" : "hand"}`;
  const arr = (zones as unknown as Record<string, (ZoneCard | null)[]>)[key];
  return arr?.[ref.sequence] ?? null;
}

function ZoneOverlay({ zones, onPick }: { zones: CardRef[]; onPick: () => void }) {
  // Zone picking is done on the board itself; this is the affordance layer.
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 12,
          transform: "translateX(-50%)",
          pointerEvents: "auto",
        }}
        className="waitbanner"
      >
        Click a highlighted zone — {zones.length} legal
        <button className="chip" onClick={onPick}>
          Place leftmost
        </button>
      </div>
    </div>
  );
}

function PileSheet({
  owner,
  location,
  state,
  onClose,
  onHover,
}: {
  owner: Seat;
  location: LocationCode;
  state: import("./fixtures/types").DuelStateSnapshot;
  onClose: () => void;
  onHover: (c: number | null) => void;
}) {
  const z = state.zones;
  const pre = owner === 0 ? "p0" : "p1";
  const hidden = location === "DECK" || (owner !== ME && location === "EXTRA");
  const cards: ZoneCard[] = hidden
    ? []
    : ((z as unknown as Record<string, ZoneCard[]>)[
        `${pre}_${location === "GRAVE" ? "grave" : location === "REMOVED" ? "removed" : "extra"}`
      ] ?? []);
  const count = hidden
    ? location === "DECK"
      ? owner === 0
        ? z.p0_deckCount
        : z.p1_deckCount
      : (owner === 0 ? z.p0_extra : z.p1_extra).length
    : cards.length;

  const title = `${owner === ME ? "Your" : `${OPPONENT}'s`} ${
    { GRAVE: "Graveyard", REMOVED: "Banished", DECK: "Deck", EXTRA: "Extra Deck" }[
      location as string
    ] ?? location
  }`;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>
          {title} — {count} card{count === 1 ? "" : "s"}
        </h2>
        <div className="sub">Free, instant, silent. {OPPONENT} is never told you looked.</div>
        {hidden ? (
          <div className="empty">Contents hidden — {count} cards.</div>
        ) : count === 0 ? (
          <div className="empty">{title} is empty.</div>
        ) : (
          <div className="grid">
            {cards.map((c, i) => (
              <CardTile
                key={i}
                zc={{ ...c, position: 1 }}
                owner={owner}
                mySeat={ME}
                onHover={onHover}
              />
            ))}
          </div>
        )}
        <button className="chip" style={{ marginTop: 12 }} onClick={onClose}>
          Esc
        </button>
      </div>
    </div>
  );
}
