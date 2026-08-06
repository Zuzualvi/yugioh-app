import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCENARIOS } from "./fixtures/scenarios";
import type { CardRef } from "./fixtures/scenarios";
import type { DuelDecision, LocationCode, PhaseName, Seat, ZoneCard } from "./fixtures/types";
import { card } from "./fixtures/cards";
import { useProtoEngine } from "./engine/useProtoEngine";
import { Board } from "./components/Board";
import type { BoardClick } from "./components/Board";
import { AutoAnswerReceipt, QuestionBar } from "./components/QuestionBar";
import { ChainStrip, IntentRibbon } from "./components/Dock";
import { LogRail } from "./components/LogRail";
import { Inspector } from "./components/Inspector";
import { CardTile } from "./components/CardTile";

const ME: Seat = 0;
const OPPONENT = "Sakura";

/** Stable verb order — muscle memory only forms if the order never moves. */
const VERB_ORDER = [
  "Normal Summon",
  "Special Summon",
  "Set",
  "Activate",
  "Change Position",
  "Attack",
  "Attack directly",
  "Inspect",
];

const PROMPT_MODES = [
  { key: "Minimal", desc: "Only mandatory effects and certain triggers." },
  { key: "Standard", desc: "Also on summons, attacks and activations." },
  { key: "Every window", desc: "Also every phase change and battle step." },
] as const;
type PromptMode = (typeof PROMPT_MODES)[number]["key"];

function tributesFor(level: number | null | undefined): number {
  if (!level) return 0;
  if (level >= 7) return 2;
  if (level >= 5) return 1;
  return 0;
}

function sameRef(a: { controller: Seat; location: LocationCode; sequence: number }, b: CardRef) {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
}

/** m4 + m17 — one name for one game concept, and the cost carries its unit. */
function verbsFor(decision: DuelDecision | null, ref: CardRef): string[] {
  const out: string[] = [];
  if (decision?.kind === "IdleCommand") {
    const s = decision.summons.find((e) => sameRef(e, ref));
    if (s) {
      const t = tributesFor(card(s.code)?.level);
      out.push(t > 0 ? `Normal Summon — ${t} tribute${t > 1 ? "s" : ""}` : "Normal Summon");
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
    const ix = VERB_ORDER.findIndex((v) => x.startsWith(v.split(" —")[0]));
    const iy = VERB_ORDER.findIndex((v) => y.startsWith(v.split(" —")[0]));
    return ix - iy;
  });
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;
}

export default function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  // B1/OQ5 — instrumentation is OFF by default. The CEO must land in the real screen.
  const [revealAuto, setRevealAuto] = useState(false);
  const [chooseZones, setChooseZones] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>("Standard");
  const [promptOpen, setPromptOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const { view, answer, decline, reset, setAutoPush } = useProtoEngine(
    scenario,
    revealAuto,
    chooseZones,
  );

  const [selected, setSelected] = useState<CardRef[]>([]);
  const [cluster, setCluster] = useState<{
    ref: CardRef;
    verbs: string[];
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [pile, setPile] = useState<{ owner: Seat; location: LocationCode } | null>(null);
  /** M7 — a refusal is anchored at the card that refused, not 500px away */
  const [refusal, setRefusal] = useState<{ x: number; y: number; text: string } | null>(null);
  const [endDismissed, setEndDismissed] = useState(false);
  const refusalTimer = useRef<number>();

  const d = view.step?.decision ?? null;
  const isReceipt = view.autoReceipt !== null;
  const inAnswer = view.mode === "answer" && !isReceipt;

  // A decision with exactly ONE candidate is pre-selected: making the player click the
  // only option before the only button is friction with no decision in it (same
  // principle as m7). It is still a real choice — confirm vs decline.
  useEffect(() => {
    const dec = view.step?.decision ?? null;
    if (dec?.kind === "ChainPrompt" && dec.selects.length === 1) {
      const e = dec.selects[0];
      setSelected([{ controller: e.controller, location: e.location, sequence: e.sequence }]);
      return;
    }
    if (
      (dec?.kind === "SelectCard" || dec?.kind === "SelectTribute") &&
      dec.cards.length === 1 &&
      dec.min === 1
    ) {
      const e = dec.cards[0];
      setSelected([{ controller: e.controller, location: e.location, sequence: e.sequence }]);
      return;
    }
    setSelected([]);
  }, [view.stepIndex, view.step]);
  useEffect(() => setCluster(null), [view.stepIndex, view.mode]);
  useEffect(() => setEndDismissed(false), [scenarioId]);

  // B5 — a timeout really forfeits. This is the whole point of scenario 4.
  useEffect(() => {
    if (view.myClockSeconds === 0 && view.onClockSeat === ME && !view.end && !view.busy) answer();
  }, [view.myClockSeconds, view.onClockSeat, view.end, view.busy, answer]);

  const refuse = useCallback((x: number, y: number, text: string) => {
    setRefusal({ x, y, text });
    window.clearTimeout(refusalTimer.current);
    refusalTimer.current = window.setTimeout(() => setRefusal(null), 2600);
  }, []);

  /**
   * B2 — Esc NEVER commits anything. It closes the cheapest open thing, and where a
   * legal decline exists it declines. It is never wired to confirm.
   */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pile) setPile(null);
        else if (cluster) setCluster(null);
        else if (pinned !== null) setPinned(null);
        else if (inAnswer && d && declineAllowed(d)) decline();
        return;
      }
      if (e.key.toLowerCase() === "l" && !promptOpen) setLogOpen((o) => !o);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pile, cluster, pinned, inAnswer, d, decline, promptOpen]);

  const expected = view.step?.expect;

  const onCard = (c: BoardClick) => {
    const ref: CardRef = { controller: c.owner, location: c.location, sequence: c.sequence };

    if (inAnswer) {
      if (view.highlight.some((h) => sameRef(h, ref))) toggle(ref);
      else {
        setPinned(c.zc.code);
        setAutoPush(null);
      }
      return;
    }
    if (view.mode !== "act" || c.owner !== ME) {
      setPinned(c.zc.code);
      return;
    }
    const verbs = verbsFor(d, ref);
    if (verbs.length === 1) {
      setPinned(c.zc.code);
      // M7 — game words, anchored at the card. We do NOT invent a reason: the engine
      // does not tell us why a card was omitted, and guessing would be a rules claim.
      const spentHere = spent(c.owner, c.location, c.sequence);
      refuse(
        c.anchor.x,
        c.anchor.y,
        spentHere
          ? "This monster has already attacked."
          : "Nothing you can do with this card right now.",
      );
      return;
    }
    // m5 — never cover the phase rail; flip below the card when the cluster would.
    setCluster({ ref, verbs, x: c.anchor.x, y: c.anchor.y, below: c.anchor.y < 380 });
  };

  const pickVerb = (v: string, ref: CardRef, x: number, y: number) => {
    setCluster(null);
    if (v === "Inspect") {
      const zc = findCard(view.state.zones, ref);
      setPinned(zc?.code ?? 0);
      return;
    }
    if (expected && "ref" in expected && sameRef(expected.ref, ref) && expected.verb === v) {
      answer();
    } else {
      refuse(x, y, `"${v}" is legal — this prototype scripts one line per scenario.`);
    }
  };

  const onPhase = (ph: PhaseName) => {
    if (expected && "phase" in expected && expected.phase === ph) answer();
    else
      refuse(
        window.innerWidth / 2,
        320,
        "That phase change is legal — the prototype scripts one line.",
      );
  };

  const toggle = (r: CardRef) => {
    const max = d && "max" in d ? d.max : 1;
    const min = d && "min" in d ? d.min : 1;
    setSelected((prev) => {
      const has = prev.some((x) => sameRef(x, r));
      // Radio semantics for a mandatory single choice: clicking a candidate SELECTS it.
      // Deselecting would leave the step unanswerable, which is a dead end — found by
      // answer-matrix.py on the single-candidate attack target.
      if (max === 1 && min >= 1) return [r];
      if (has) return prev.filter((x) => !sameRef(x, r));
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
  const myClock = view.myClockSeconds;
  const urgency =
    view.onClockSeat !== ME || view.end
      ? "none"
      : myClock <= 10
        ? "alarm"
        : myClock <= 30
          ? "high"
          : myClock <= 60
            ? "warn"
            : "none";

  return (
    <div className="app">
      <div className="topbar">
        {/* PROTOTYPE-ONLY chrome, left of the divider */}
        <select className="chip" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
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
          Reveal auto-answers: {revealAuto ? "ON" : "OFF"}
        </button>
        <span className="divider">│</span>

        {/* real duel chrome */}
        <span style={{ color: "var(--text-2)" }}>
          <span style={{ color: view.end ? "var(--text-2)" : "#4ade80" }}>●</span> {OPPONENT}
        </span>
        <span className={`turnpill ${view.state.currentTurn === ME ? "mine" : "theirs"}`}>
          TURN {view.state.turnNumber} · {view.state.currentTurn === ME ? "YOURS" : "THEIRS"}
        </span>
        <span className="sp" />
        {/* M10 — a labelled control whose states are visible without clicking through */}
        <div className="promptwrap">
          <button className="chip" onClick={() => setPromptOpen((o) => !o)}>
            Response prompts: {promptMode} ▾
          </button>
          {promptOpen && (
            <div className="promptmenu">
              {PROMPT_MODES.map((m) => (
                <button
                  key={m.key}
                  className={`promptopt${promptMode === m.key ? " sel" : ""}`}
                  onClick={() => {
                    setPromptMode(m.key);
                    setPromptOpen(false);
                  }}
                >
                  <b>{m.key}</b>
                  <span>{m.desc}</span>
                </button>
              ))}
              <div className="promptwarn">
                Mandatory effects are always offered, whatever this is set to — this cannot make you
                miss a forced response.
              </div>
            </div>
          )}
        </div>
        <button
          className={`chip${chooseZones ? " on" : ""}`}
          onClick={() => setChooseZones((v) => !v)}
        >
          Choose zones: {chooseZones ? "ON" : "OFF"}
        </button>
        <button className="chip" onClick={() => setLogOpen((o) => !o)}>
          Log <kbd>L</kbd>
        </button>
      </div>

      <div className="body">
        <div
          className={`stage${inAnswer ? " dimmed" : ""}${urgency === "alarm" ? " critical" : ""}`}
        >
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
            zonePick={zonePick}
            onZonePick={(r) => answer([r])}
            clock={
              // M8 — BOTH clocks, permanently, each labelled. Never colour alone.
              <div className="clocks" data-testid="clocks">
                <span
                  className={`clockrow mine${view.onClockSeat === ME ? " active" : ""} u-${urgency}`}
                  data-testid="my-clock"
                >
                  <span className="cl-who">You</span>
                  <span className="cl-val">{fmt(myClock)}</span>
                  <span className="cl-state">{view.onClockSeat === ME ? "running" : "banked"}</span>
                </span>
                <span
                  className={`clockrow theirs${view.onClockSeat !== ME ? " active" : ""}`}
                  data-testid="opp-clock"
                >
                  <span className="cl-who">{OPPONENT}</span>
                  <span className="cl-val">{fmt(view.oppClockSeconds)}</span>
                  <span className="cl-state">{view.onClockSeat !== ME ? "running" : "banked"}</span>
                </span>
                {urgency !== "none" && (
                  <span className={`cl-warn u-${urgency}`}>
                    {urgency === "alarm"
                      ? `${myClock}s — TIMEOUT FORFEITS THE DUEL`
                      : "timeout forfeits the duel"}
                  </span>
                )}
              </div>
            }
          />

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

          {/* the bottom dock: chain strip → intent ribbon → ONE question surface */}
          <div className="dock">
            <ChainStrip chain={view.chain} mySeat={ME} />
            {view.intent && (
              <IntentRibbon
                intent={view.intent}
                onCancel={decline}
                cancelWhat={
                  view.intent.label.toLowerCase().includes("attack") ? "attack" : "summon"
                }
              />
            )}
            {/* B1/M2 — an already-answered step is a receipt, never a live question */}
            {isReceipt && (
              <AutoAnswerReceipt
                text={view.autoReceipt!}
                onAskNextTime={() => setChooseZones(true)}
              />
            )}
            {inAnswer && d && (
              <QuestionBar
                caption={view.step?.caption}
                decision={d}
                mySeat={ME}
                opponentName={OPPONENT}
                chain={view.chain}
                selected={selected}
                toggle={toggle}
                onConfirm={(explicit) => answer(explicit ?? selected)}
                onDecline={decline}
                clockSeconds={myClock}
                commitNext={!!view.intent && view.intent.stepIndex + 1 === view.intent.commitAt}
                subjectCode={view.intent?.cardCode}
              />
            )}
            {/* m9 — the waiting state lives where the bar was, not 630px away */}
            {(view.mode === "waiting" || view.mode === "resolving") && !view.end && !isReceipt && (
              <div className="waitdock" data-testid="wait">
                <span className="spinner" />
                {view.waitLabel ??
                  (view.onClockSeat !== ME ? `${OPPONENT} is deciding` : "Engine is resolving…")}
              </div>
            )}
          </div>

          {refusal && (
            <div className="refusal" style={{ left: refusal.x, top: refusal.y - 34 }}>
              {refusal.text}
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
              <div className="sheet endsheet">
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
            <div className="endedpill">
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
          turnNumber={view.state.turnNumber}
          seededCount={scenario.seedLog?.length ?? 0}
          lpByTurn={scenario.lpByTurn ?? {}}
        />
      </div>

      {cluster && (
        <>
          <div className="clusterscrim" onClick={() => setCluster(null)} />
          <div
            className="verbcluster"
            style={
              cluster.below
                ? { left: cluster.x, top: cluster.y + 96 }
                : { left: cluster.x, top: cluster.y - 44 }
            }
          >
            {cluster.verbs.map((v) => (
              <button
                key={v}
                className="verb"
                onClick={() => pickVerb(v, cluster.ref, cluster.x, cluster.y)}
              >
                {v}
              </button>
            ))}
            <span className="verbhint">
              <kbd>Esc</kbd> closes — costs nothing
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function declineAllowed(d: DuelDecision): boolean {
  if (d.kind === "ChainPrompt") return !d.forced;
  if (d.kind === "SelectCard" || d.kind === "SelectTribute" || d.kind === "SelectUnselectCard")
    return d.cancelable;
  if (d.kind === "SelectYesNo" || d.kind === "SelectEffectYN") return true;
  // SelectZone and SelectPosition have no cancel in the protocol.
  return false;
}

function findCard(zones: import("./fixtures/types").DuelZones, ref: CardRef): ZoneCard | null {
  const side = ref.controller === 0 ? "p0" : "p1";
  const key =
    ref.location === "MZONE"
      ? "mzone"
      : ref.location === "SZONE"
        ? "szone"
        : ref.location === "HAND"
          ? "hand"
          : null;
  if (!key) return null;
  const arr = (zones as unknown as Record<string, (ZoneCard | null)[]>)[`${side}_${key}`];
  return arr?.[ref.sequence] ?? null;
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
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
