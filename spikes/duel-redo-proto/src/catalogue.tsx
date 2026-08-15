/**
 * feed-rail-catalogue — every row the feed rail can ever render, in one place.
 *
 * WHY IT EXISTS. The scenarios each hit three or four event kinds, so the rail's
 * full vocabulary is never visible in one place and looks inconsistent from
 * scenario to scenario. This page renders the WHOLE vocabulary through the REAL
 * `FeedRail` component and the REAL stylesheet — nothing here is hand-drawn, and
 * nothing is a mock-up of a row. If a row looks wrong on this page, it looks wrong
 * in the prototype, because it is the same code.
 *
 * THE LIST IS THE CONTRACT'S, NOT THE ENGINE'S. `packages/contracts/src/duelEvent.ts`
 * on `master` defines `DuelEventSchema` as a discriminated union of exactly 14
 * kinds. That union is what the server puts in an `EVENTS` frame, so it is exactly
 * what the rail can ever be asked to draw. ocgcore's own message set is larger and
 * is mapped down to these 14 at the engine/server boundary (ADR-0007), which is why
 * the contract and not the engine is the authority here.
 *
 * Every event below carries the field shape the contract specifies for its kind.
 */
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./catalogue.css";
import { FeedRail } from "./components/Rails";
import type { DuelEvent, Seat } from "./proto/types";

const ME: Seat = 0;
const THEM: Seat = 1;

const CARD = {
  thunderKing: 71564252,
  uraby: 1784619,
  bookOfMoon: 14087893,
  bottomless: 29401950,
  dimensionalPrison: 70342110,
  mobius: 4929256,
  raiza: 73125233,
  torrential: 53582587,
};

/** An `EventCardRef` as the contract defines it: code + controller + location + sequence. */
const ref = (code: number, controller: Seat, location: string, sequence = 0) => ({
  code,
  controller,
  location,
  sequence,
});

let seq = 0;
const ev = (kind: string, extra: Record<string, unknown> = {}, actor?: Seat): DuelEvent =>
  ({ kind, seq: seq++, turnNumber: 4, phase: 4, ...(actor === undefined ? {} : { actor }), ...extra }) as DuelEvent;

type Status = "row" | "fallback" | "none";

interface Template {
  kind: string;
  variant: string;
  trigger: string;
  status: Status;
  note?: string;
  events: DuelEvent[];
  markAt?: number | null;
  midDuel?: boolean;
}

/**
 * `resolve` is the rail's card-identity join. In the prototype it resolves a ref
 * against the STATE snapshot; here every ref carries its own code, so the join is
 * the identity function and the rows show their best case.
 */
const resolve = (r: unknown) => (r as { code?: number } | undefined)?.code ?? 0;
const NAMES = { me: "You", opp: "Sakura" };

// ── the 14 contract kinds, in the contract's own order ──────────────────────
const TEMPLATES: Template[] = [
  {
    kind: "SUMMON",
    variant: "mine",
    trigger: "You Normal Summon a monster (ocgcore SUMMONING, msg 60)",
    status: "row",
    events: [ev("SUMMON", { card: ref(CARD.thunderKing, ME, "MZONE", 0), position: 5 }, ME)],
  },
  {
    kind: "SUMMON",
    variant: "theirs",
    trigger: "The opponent Normal Summons — same row, opponent tint",
    status: "row",
    events: [ev("SUMMON", { card: ref(CARD.mobius, THEM, "MZONE", 1), position: 5 }, THEM)],
  },
  {
    kind: "SPSUMMON",
    variant: "mine",
    trigger: "Any Special Summon — Synchro, Fusion, a monster that summons itself (SPSUMMONING, msg 62)",
    status: "fallback",
    note:
      "⚠️ NO TEMPLATE. `describe()` has no case for SPSUMMON, so it falls to the default branch and the row prints the raw engine enum with no movement text. In Edison a large share of summons are Special Summons.",
    events: [ev("SPSUMMON", { card: ref(CARD.raiza, ME, "MZONE", 2), position: 5 }, ME)],
  },
  {
    kind: "SET",
    variant: "mine",
    trigger: "You set a card face-down (SET, msg 54)",
    status: "row",
    events: [ev("SET", { card: ref(CARD.dimensionalPrison, ME, "SZONE", 0), position: 10 }, ME)],
  },
  {
    kind: "MOVE",
    variant: "hand → field",
    trigger: "A card changes zone (MOVE, msg 50). The row names the SLOT it came from, not only the card.",
    status: "row",
    events: [
      ev("MOVE", {
        card: ref(CARD.uraby, ME, "HAND", 2),
        from: ref(CARD.uraby, ME, "HAND", 2),
        to: ref(CARD.uraby, ME, "MZONE", 1),
      }, ME),
    ],
  },
  {
    kind: "MOVE",
    variant: "field → graveyard",
    trigger: "A destroyed monster leaves the field",
    status: "row",
    events: [
      ev("MOVE", {
        card: ref(CARD.uraby, ME, "MZONE", 1),
        from: ref(CARD.uraby, ME, "MZONE", 1),
        to: ref(CARD.uraby, ME, "GRAVE", 0),
      }, ME),
    ],
  },
  {
    kind: "MOVE",
    variant: "deck → hand (a draw)",
    trigger: "The draw itself is a MOVE",
    status: "row",
    events: [
      ev("MOVE", {
        card: ref(CARD.bookOfMoon, ME, "DECK", 0),
        from: ref(CARD.bookOfMoon, ME, "DECK", 0),
        to: ref(CARD.bookOfMoon, ME, "HAND", 5),
      }, ME),
    ],
  },
  {
    kind: "MOVE",
    variant: "field → banished, opponent's card",
    trigger: "A banish, on the opponent's side",
    status: "row",
    events: [
      ev("MOVE", {
        card: ref(CARD.mobius, THEM, "MZONE", 1),
        from: ref(CARD.mobius, THEM, "MZONE", 1),
        to: ref(CARD.mobius, THEM, "REMOVED", 0),
      }, THEM),
    ],
  },
  {
    kind: "CHAINING",
    variant: "mine",
    trigger: "A card or effect is activated onto the chain (CHAINING, msg 70)",
    status: "row",
    events: [ev("CHAINING", { card: ref(CARD.bookOfMoon, ME, "SZONE", 0), link: 1, owner: ME }, ME)],
  },
  {
    kind: "CHAINING",
    variant: "theirs, link 2",
    trigger: "The opponent chains back",
    status: "row",
    events: [ev("CHAINING", { card: ref(CARD.bottomless, THEM, "SZONE", 1), link: 2, owner: THEM }, THEM)],
  },
  {
    kind: "CHAIN_SOLVING",
    variant: "—",
    trigger: "One chain link begins resolving (CHAIN_SOLVING, msg 72)",
    status: "row",
    note: "Carries no card ref in the contract, so the row can name the link and nothing else.",
    events: [ev("CHAIN_SOLVING", { link: 2 })],
  },
  {
    kind: "CHAIN_SOLVED",
    variant: "—",
    trigger: "One chain link has finished resolving (CHAIN_SOLVED, msg 73)",
    status: "fallback",
    note: "⚠️ NO TEMPLATE. Falls to the default branch and prints the raw enum.",
    events: [ev("CHAIN_SOLVED", { link: 2 })],
  },
  {
    kind: "CHAIN_END",
    variant: "—",
    trigger: "The whole chain has resolved (CHAIN_END, msg 74)",
    status: "fallback",
    note:
      "⚠️ NO TEMPLATE. Falls to the default branch and prints the raw enum — and it is also the event the chain strip needs in order to clear itself.",
    events: [ev("CHAIN_END", {})],
  },
  {
    kind: "LP_CHANGE",
    variant: "damage, mine",
    trigger: "Life points move (normalised from MSG_DAMAGE 91 and the other LP paths)",
    status: "row",
    note: "The contract carries `reason: damage | cost | recover | effect`. The row does not use it.",
    events: [ev("LP_CHANGE", { seat: ME, delta: -1900, reason: "damage" })],
  },
  {
    kind: "LP_CHANGE",
    variant: "gain, theirs",
    trigger: "Life points gained — the sign is the only difference in the row",
    status: "row",
    events: [ev("LP_CHANGE", { seat: THEM, delta: 800, reason: "recover" })],
  },
  {
    kind: "ATTACK",
    variant: "at a monster",
    trigger: "An attack is declared (ATTACK, msg 110)",
    status: "row",
    events: [
      ev("ATTACK", {
        attacker: ref(CARD.thunderKing, ME, "MZONE", 0),
        target: ref(CARD.mobius, THEM, "MZONE", 1),
        code: CARD.thunderKing,
        targetCode: CARD.mobius,
      }, ME),
    ],
  },
  {
    kind: "ATTACK",
    variant: "direct (target null)",
    trigger: "A direct attack — the contract makes `target` nullable",
    status: "row",
    events: [
      ev("ATTACK", { attacker: ref(CARD.thunderKing, ME, "MZONE", 0), target: null, code: CARD.thunderKing }, ME),
    ],
  },
  {
    kind: "BATTLE",
    variant: "—",
    trigger: "Damage calculation ran (BATTLE, msg 111)",
    status: "row",
    note:
      "The BATTLE row itself says only that the damage step ran. What states the OUTCOME is the synthetic result row below, which this design assembles from ATTACK + BATTLE + LP_CHANGE + MOVE.",
    events: [
      ev("BATTLE", {
        attacker: ref(CARD.thunderKing, ME, "MZONE", 0),
        target: ref(CARD.mobius, THEM, "MZONE", 1),
      }),
    ],
  },
  {
    kind: "PHASE",
    variant: "—",
    trigger: "The phase advances (NEW_PHASE, msg 41)",
    status: "none",
    note:
      "⚠️ NO ROW AT ALL. `describe()` returns null, deliberately — the phase rail carries the phase, so a rail row would duplicate it. It is invisible here, and its invisibility is what broke the delta mark in ZUH-141: the mark used to be attached to a row that draws nothing.",
    events: [ev("PHASE", { phase: 8 })],
  },
  {
    kind: "TURN",
    variant: "—",
    trigger: "The turn changes (NEW_TURN, msg 40)",
    status: "row",
    note: "The contract also carries `turnPlayer` and `lpSnapshot`; the row uses neither.",
    events: [ev("TURN", { turnNumber: 5, turnPlayer: THEM, lpSnapshot: [8000, 6100] })],
  },
  {
    kind: "HINT",
    variant: "—",
    trigger: "An engine hint addressed to the entitled player (HINT / PLAYER_HINT / CARD_HINT)",
    status: "none",
    note:
      "⚠️ NO ROW AT ALL, deliberately: hints are engine chatter, and the recorded duels are full of them (10 in one opponent turn).",
    events: [ev("HINT", { hintType: 3, value: "select a card" })],
  },
];

// ── composites: the rows that are not a single kind ─────────────────────────
const COMPOSITES: Template[] = [
  {
    kind: "battle result",
    variant: "synthetic — not an engine event",
    trigger: "Assembled by the rail from ATTACK + BATTLE + LP_CHANGE + MOVE, because the engine never states an outcome",
    status: "row",
    note:
      "This is F-10's fix. Nothing here is computed from the rules: the participants, the damage and the destruction all come from the four events above it. It says `no damage` explicitly rather than staying silent, because silence reads as 'I do not know'.",
    events: [
      ev("ATTACK", {
        attacker: ref(CARD.uraby, ME, "MZONE", 0),
        target: ref(CARD.thunderKing, THEM, "MZONE", 0),
        code: CARD.uraby,
        targetCode: CARD.thunderKing,
      }, ME),
      ev("BATTLE", {
        attacker: ref(CARD.uraby, ME, "MZONE", 0),
        target: ref(CARD.thunderKing, THEM, "MZONE", 0),
      }),
      ev("LP_CHANGE", { seat: ME, delta: -400, reason: "damage" }),
      ev("MOVE", {
        card: ref(CARD.uraby, ME, "MZONE", 0),
        from: ref(CARD.uraby, ME, "MZONE", 0),
        to: ref(CARD.uraby, ME, "GRAVE", 0),
      }, ME),
    ],
  },
  {
    kind: "— since you last acted —",
    variant: "the delta boundary",
    trigger: "Control returns after an opponent turn in which at least one event arrived",
    status: "row",
    note:
      "A BOUNDARY BETWEEN ROWS, not a property of one (ZUH-141). It anchors to the first row at or after the boundary that actually draws — which is why the PHASE event it is attached to here does not swallow it — and it outlives the delta strip (ZUH-145).",
    markAt: 0,
    events: [
      ev("PHASE", { phase: 1 }),
      ev("TURN", { turnNumber: 5, turnPlayer: THEM, lpSnapshot: [8000, 8000] }),
      ev("SUMMON", { card: ref(CARD.mobius, THEM, "MZONE", 1), position: 5 }, THEM),
      ev("ATTACK", {
        attacker: ref(CARD.mobius, THEM, "MZONE", 1),
        target: null,
        code: CARD.mobius,
      }, THEM),
      ev("LP_CHANGE", { seat: ME, delta: -2400, reason: "damage" }),
    ],
  },
  {
    kind: "empty",
    variant: "turn 1",
    trigger: "The duel has just started and nothing has happened yet",
    status: "row",
    events: [],
    midDuel: false,
  },
  {
    kind: "empty",
    variant: "turn > 1",
    trigger: "Joined or reconnected mid-duel — the transcript before this point is not available",
    status: "row",
    note: 'Never "the duel has not started", which would be a lie about a board with cards on it.',
    events: [],
    midDuel: true,
  },
];

const STATUS_TEXT: Record<Status, string> = {
  row: "authored row",
  fallback: "NO TEMPLATE — raw engine enum",
  none: "NO ROW — describe() returns null",
};

function Card({ t }: { t: Template }) {
  return (
    <section className="cat-item" data-kind={t.kind}>
      <header className="cat-head">
        <code className="cat-kind">{t.kind}</code>
        <span className="cat-variant">{t.variant}</span>
        <span className={`cat-status cat-${t.status}`}>{STATUS_TEXT[t.status]}</span>
      </header>
      <p className="cat-trigger">{t.trigger}</p>
      {t.note ? <p className="cat-note">{t.note}</p> : null}
      <div className="cat-rail">
        <FeedRail
          events={t.events}
          mySeat={ME}
          markAt={t.markAt ?? null}
          names={NAMES}
          resolve={resolve}
          midDuel={t.midDuel ?? true}
        />
      </div>
    </section>
  );
}

const ALL_IN_ONE: DuelEvent[] = [
  ...TEMPLATES.filter((t) => t.status !== "none").flatMap((t) => t.events),
];

function App() {
  const counts = {
    row: TEMPLATES.filter((t) => t.status === "row").length,
    fallback: TEMPLATES.filter((t) => t.status === "fallback").length,
    none: TEMPLATES.filter((t) => t.status === "none").length,
  };
  return (
    <div className="cat-page">
      <h1>Feed rail — every row it can render</h1>
      <p className="cat-lead">
        The authority is <code>packages/contracts/src/duelEvent.ts</code> on <code>master</code>:{" "}
        <b>DuelEventSchema is a discriminated union of exactly 14 kinds</b>, and that union is what the
        server puts in an <code>EVENTS</code> frame. ocgcore's own message set is larger and is mapped
        down to these 14 at the engine/server boundary, so the contract — not the engine — is the list.
        Every rail below is the <b>real component with the real stylesheet</b>; nothing on this page is
        drawn by hand.
      </p>
      <p className="cat-lead">
        Of the 14 kinds: <b>{9} render an authored row</b>, <b>{3} have no template</b> and print the
        raw engine enum (<code>SPSUMMON</code>, <code>CHAIN_SOLVED</code>, <code>CHAIN_END</code>), and{" "}
        <b>{2} render nothing at all</b> by design (<code>PHASE</code>, <code>HINT</code>). One kind —{" "}
        <code>SPSUMMON</code> — has <b>never appeared in any recorded fixture</b>, so it has never been
        seen in a scenario.
      </p>

      <h2>All of it in one rail, in sequence</h2>
      <p className="cat-trigger">
        Every kind that draws anything, in one transcript, so the vocabulary is visible together rather
        than three kinds at a time.
      </p>
      <div className="cat-rail cat-rail-tall">
        <FeedRail events={ALL_IN_ONE} mySeat={ME} markAt={null} names={NAMES} resolve={resolve} midDuel />
      </div>

      <h2>One kind at a time</h2>
      <div className="cat-grid">
        {TEMPLATES.map((t, i) => (
          <Card t={t} key={i} />
        ))}
      </div>

      <h2>Rows that are not a single event</h2>
      <div className="cat-grid">
        {COMPOSITES.map((t, i) => (
          <Card t={t} key={i} />
        ))}
      </div>

      <h2>What this page shows about the rail as it is built</h2>
      <p className="cat-lead">
        Every line below is visible in the rails above. None of it is fixed here — this page reports the
        vocabulary, it does not change it.
      </p>
      <ol className="cat-findings">
        <li>
          <b>Three contract kinds have no template and print the raw engine enum:</b>{" "}
          <code>SPSUMMON</code> → <code>SPSUMMON Raiza the Storm Monarch</code> with no movement text,{" "}
          <code>CHAIN_SOLVED</code> and <code>CHAIN_END</code> → the bare word, no card, no context.{" "}
          <code>SPSUMMON</code> is the one that matters most: in Edison a large share of summons are
          Special Summons, and this row is the only place the rail would say so.
        </li>
        <li>
          <b>Engine location enums are shown to the player</b> in every <code>MOVE</code> row —{" "}
          <code>HAND 3 → MZONE</code>, <code>MZONE 2 → GRAVE</code>, <code>DECK 1 → HAND</code>. The
          source slot carries a number and the destination does not, so the two halves of one row are
          written in different registers.
        </li>
        <li>
          <b>
            <code>CHAIN_SOLVING</code> reads <code>RESOLVING a chain link link 2</code>
          </b>{" "}
          — the fallback noun and the movement text collide, because the contract gives this kind no card
          reference to name.
        </li>
        <li>
          <b>
            <code>TURN</code> renders <code>TURN 5</code> and says nothing about whose turn it is
          </b>
          , although the contract carries <code>turnPlayer</code>. It is also the one row with no owner
          tint at a moment when ownership is the whole point.
        </li>
        <li>
          <b>
            <code>BATTLE</code> on its own says only <code>BATTLE damage step</code>
          </b>
          . What states the outcome is the synthetic result row beneath it, which exists because the
          engine never sends one.
        </li>
        <li>
          <b>
            <code>PHASE</code> and <code>HINT</code> draw nothing
          </b>{" "}
          — deliberate, and worth knowing: roughly half the events in a recorded opponent turn are these
          two, so a rail that looks sparse is not dropping information it could show.
        </li>
        <li>
          <b>Owner tint is absent wherever the contract carries no actor</b> — <code>BATTLE</code>,{" "}
          <code>CHAIN_SOLVING</code>, <code>CHAIN_SOLVED</code>, <code>CHAIN_END</code> and{" "}
          <code>TURN</code> all render untinted.
        </li>
        <li>
          <b>
            <code>SPSUMMON</code> has never appeared in any recorded fixture
          </b>{" "}
          — the other thirteen all do — so it has never been seen in a scenario, and this page is the
          first time its row has been rendered at all.
        </li>
      </ol>
      <p className="cat-lead cat-foot">
        Counted from this page: {counts.row} single-kind templates draw an authored row,{" "}
        {counts.fallback} print a raw enum, {counts.none} draw nothing. Fourteen contract kinds, twenty
        one single-kind templates once the variants that change a row are counted separately, plus four
        rows that are not a single event.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
