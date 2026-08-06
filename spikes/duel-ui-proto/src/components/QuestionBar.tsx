/**
 * ONE Question Bar renders ALL 20 DuelDecision variants.
 * A single renderer with a variant switch — not 20 dialogs.
 *
 * Every variant is the same three lines:
 *   1 · a sentence naming the card (card name + verb tinted; location inline)
 *   2 · an answer space (candidates as thumbnails, each badged with its location)
 *   3 · a decline and a confirm, of equal presence
 */

import { card, cardName } from "../fixtures/cards";
import type { CardEntry, ChainLink, DuelDecision, LocationCode, Seat } from "../fixtures/types";
import type { CardRef } from "../fixtures/scenarios";
import { frameClass } from "./CardTile";

const LOC_LABEL: Record<LocationCode, string> = {
  DECK: "Deck",
  HAND: "Hand",
  MZONE: "Monster Zone",
  SZONE: "Spell/Trap Zone",
  GRAVE: "Graveyard",
  REMOVED: "Banished",
  EXTRA: "Extra Deck",
  OVERLAY: "Overlay",
  FZONE: "Field Zone",
  PZONE: "Pendulum Zone",
};
const LOC_SHORT: Record<LocationCode, string> = {
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

interface Props {
  decision: DuelDecision;
  mySeat: Seat;
  opponentName: string;
  chain: ChainLink[];
  selected: CardRef[];
  toggle: (r: CardRef) => void;
  onConfirm: () => void;
  onDecline: () => void;
  clockSeconds: number;
  /** the next step in this intent cannot be cancelled — say so on the confirm */
  commitNext: boolean;
  /** the card this whole intent is about, for sentences that name it */
  subjectCode?: number;
  /** the client is answering this without the player — shown only in the prototype */
  auto?: boolean;
  /** MH-3.1 — the engine's own caption for this selection */
  caption?: string;
}

/** Answer space entries that are not cards (positions, options) live in a pseudo-location. */
const optRef = (i: number): CardRef => ({ controller: 0, location: "PZONE", sequence: i });
const optSel = (sel: CardRef[], i: number) =>
  sel.some((r) => r.location === "PZONE" && r.sequence === i);

function Thumb({
  e,
  mySeat,
  selected,
  onClick,
}: {
  e: CardEntry;
  mySeat: Seat;
  selected: boolean;
  onClick: () => void;
}) {
  const c = card(e.code);
  const mine = e.controller === mySeat;
  return (
    <div className="pick">
      <div
        className={`card${selected ? " selected" : ""}`}
        onClick={onClick}
        style={{ cursor: "pointer" }}
      >
        <div className={`frame ${frameClass(e.code)}`} />
        <div className="nm">{c?.name ?? (e.code === 0 ? "Set card" : e.name || `#${e.code}`)}</div>
        <div className="st">
          {c?.atk != null ? (
            <>
              <span>{c.atk}</span>
              <span>{c.def}</span>
            </>
          ) : (
            <span>{c?.race ?? ""}</span>
          )}
        </div>
      </div>
      <span className={`locbadge ${mine ? "mine" : "theirs"}`}>{LOC_SHORT[e.location]}</span>
    </div>
  );
}

export function QuestionBar(p: Props) {
  const d = p.decision;
  const mine = (s: Seat) => (s === p.mySeat ? "mine" : "theirs");
  const isSel = (e: CardEntry) =>
    p.selected.some(
      (r) =>
        r.controller === e.controller && r.location === e.location && r.sequence === e.sequence,
    );
  const ref = (e: CardEntry): CardRef => ({
    controller: e.controller,
    location: e.location,
    sequence: e.sequence,
  });

  let sentence: React.ReactNode = null;
  let answers: React.ReactNode = null;
  let declineLabel: string | null = "Cancel";
  let confirmLabel = "Confirm";
  let confirmEnabled = true;
  let counter: string | null = null;
  let commitStatement: string | null = null;

  switch (d.kind) {
    case "ChainPrompt": {
      const top = p.chain[p.chain.length - 1];
      const trigger = top ? { code: top.code, owner: top.owner, location: top.location } : null;
      sentence = trigger ? (
        <>
          <span className={`cn ${mine(trigger.owner)}`}>
            {trigger.owner === p.mySeat ? "You" : p.opponentName}
          </span>{" "}
          <span className="vb">activated</span>{" "}
          <span className={`cn ${mine(trigger.owner)}`}>
            &ldquo;{cardName(trigger.code)}&rdquo;
          </span>{" "}
          <span className="loc">({LOC_LABEL[trigger.location]})</span>.<br />
          <span className="vb">Chain</span> a card or effect?
        </>
      ) : (
        <>
          <span className="vb">Chain</span> a card or effect?
        </>
      );
      answers = (
        <div className="answers">
          {d.selects.map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              onClick={() => p.toggle(ref(e))}
            />
          ))}
        </div>
      );
      confirmLabel = "Activate Effect";
      confirmEnabled = p.selected.length === 1;
      declineLabel = d.forced ? null : "No response";
      if (d.forced) commitStatement = "You must chain one of these — this effect is mandatory.";
      break;
    }

    case "SelectTribute":
    case "SelectCard": {
      const isTrib = d.kind === "SelectTribute";
      const subject = p.subjectCode;
      sentence = p.caption ? (
        <>
          <span className="vb">{p.caption}</span>
          {d.max > 1 ? ` — choose ${d.min === d.max ? d.min : `${d.min}–${d.max}`}` : ""}
        </>
      ) : isTrib ? (
        <>
          <span className="vb">Tribute</span> {d.min === d.max ? d.min : `${d.min}–${d.max}`}{" "}
          monster
          {d.max > 1 ? "s" : ""} to summon{" "}
          <span className="cn mine">&ldquo;{cardName(subject ?? 0)}&rdquo;</span>.
        </>
      ) : (
        <>
          <span className="vb">Choose</span> {d.min === d.max ? d.min : `${d.min}–${d.max}`} card
          {d.max > 1 ? "s" : ""} — the effect that is asking is highlighted on the board.
        </>
      );
      answers = (
        <div className="answers">
          {d.cards.map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              onClick={() => p.toggle(ref(e))}
            />
          ))}
        </div>
      );
      counter = `${p.selected.length} of ${d.max} selected`;
      confirmEnabled = p.selected.length >= d.min && p.selected.length <= d.max;
      confirmLabel = p.commitNext
        ? `${isTrib ? "Tribute" : "Confirm"} ${p.selected.length || d.min} & commit ▲`
        : "Confirm";
      declineLabel = d.cancelable ? "Cancel" : null;
      if (!d.cancelable) commitStatement = "This selection cannot be taken back.";
      break;
    }

    case "SelectZone": {
      sentence = (
        <>
          <span className="vb">Place</span> the card — click a highlighted zone on the board.
        </>
      );
      answers = (
        <div className="answers" style={{ color: "var(--text-2)", fontSize: 12 }}>
          The board is the answer space.
        </div>
      );
      declineLabel = null;
      commitStatement = "Choosing a zone completes the summon. There is no cancel at this step.";
      confirmLabel = "Place here";
      break;
    }

    case "SelectPosition": {
      sentence = (
        <>
          <span className="vb">Summon</span>{" "}
          <span className="cn mine">&ldquo;{cardName(d.card.code)}&rdquo;</span> in which position?
        </>
      );
      answers = (
        <div className="answers">
          {d.positions.map((pos) => {
            const label =
              pos === "faceup_attack"
                ? "↑ Attack"
                : pos === "faceup_defense"
                  ? "→ Defence"
                  : pos === "facedown_defense"
                    ? "v Set (Defence)"
                    : "v Set (Attack)";
            const idx = d.positions.indexOf(pos);
            const sel = optSel(p.selected, idx);
            return (
              <button
                key={pos}
                className={`btn${sel ? " primary" : ""}`}
                onClick={() => p.toggle(optRef(idx))}
              >
                {label}
              </button>
            );
          })}
        </div>
      );
      confirmEnabled = p.selected.length === 1;
      confirmLabel = "Confirm";
      declineLabel = null;
      commitStatement = "The summon is already committed.";
      break;
    }

    case "SelectEffectYN": {
      const c = card(d.card.code);
      sentence = (
        <>
          <span className="vb">Activate</span>{" "}
          <span className={`cn ${mine(d.card.controller)}`}>
            &ldquo;{cardName(d.card.code)}&rdquo;
          </span>{" "}
          <span className="loc">({LOC_LABEL[d.card.location]})</span>?
          {/* Where the engine gives no usable description, substitute the card's own text. */}
          <div style={{ fontSize: 11.5, color: "var(--text-1)", marginTop: 4 }}>
            {d.description && !/^\d+n?$/.test(d.description) ? d.description : c?.desc}
          </div>
        </>
      );
      answers = null;
      confirmLabel = "Activate";
      declineLabel = "No";
      break;
    }

    case "SelectYesNo": {
      sentence = <>{d.description || "—"}</>;
      answers = null;
      confirmLabel = "Yes";
      declineLabel = "No";
      break;
    }

    case "SelectOption": {
      sentence = (
        <>
          <span className="vb">Choose</span> an effect:
        </>
      );
      answers = (
        <div style={{ padding: "8px 16px", width: "100%" }}>
          {d.options.map((o, i) => (
            <button
              key={i}
              className={`optionrow${optSel(p.selected, i) ? " sel" : ""}`}
              onClick={() => p.toggle(optRef(i))}
            >
              {o}
            </button>
          ))}
        </div>
      );
      confirmEnabled = p.selected.length === 1;
      break;
    }

    case "SelectUnselectCard": {
      sentence = (
        <>
          <span className="vb">Select materials</span> — click cards to add or remove.
        </>
      );
      answers = (
        <div className="answers">
          {[...d.selectCards, ...d.unselectCards].map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              onClick={() => p.toggle(ref(e))}
            />
          ))}
        </div>
      );
      counter = `${p.selected.length} selected`;
      confirmEnabled = d.canFinish;
      declineLabel = d.cancelable ? "Cancel" : null;
      break;
    }

    default: {
      // AnnounceRace / AnnounceAttrib / AnnounceCard / AnnounceNumber /
      // SortChain / SortCard / SelectCounter / SelectSum / SelectDisfield.
      // Same bar, generic answer space. These must never throw and never get a
      // bespoke surface — no Edison script triggers the last five.
      sentence = (
        <>
          <span className="vb">{d.kind}</span> — answer below.
        </>
      );
      answers = (
        <div className="answers" style={{ fontSize: 11, color: "var(--text-2)" }}>
          Generic answer space (this variant has no known Edison trigger).
        </div>
      );
      break;
    }
  }

  const warn = p.clockSeconds <= 60;

  return (
    <div className={`qbar${p.auto ? " auto" : ""}`} data-testid="question-bar">
      <div
        className={`hair${warn ? " warn" : ""}`}
        style={{ width: `${Math.max(0, Math.min(100, (p.clockSeconds / 300) * 100))}%` }}
      />
      <div className="sentence">{sentence}</div>
      {answers}
      <div className="verbs">
        {declineLabel ? (
          <button className="btn decline" onClick={p.onDecline}>
            {declineLabel}
          </button>
        ) : (
          <span className="commitnote">▲ {commitStatement}</span>
        )}
        {counter && <span className="count">{counter}</span>}
        <span style={{ marginLeft: "auto" }} />
        <button className="btn primary" disabled={!confirmEnabled} onClick={p.onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
