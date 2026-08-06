/**
 * ONE Question Bar renders ALL 20 DuelDecision variants.
 * A single renderer with a variant switch — not 20 dialogs.
 *
 * Every variant is the same three lines:
 *   1 · a sentence naming the card (card name + verb tinted; location inline)
 *   2 · an answer space (candidates as thumbnails) + a CARD TEXT PANE
 *   3 · a decline and a confirm, of equal presence
 *
 * Changes forced by the ZUH-81 usability pass:
 *   M1  the commit is stated in words on the confirm button, not as a bare glyph
 *   M5  the confirm button names the card it will play
 *   M5/M6/m2/m3  selecting a candidate reveals its text INSIDE the bar, next to the
 *       trigger's text, so "what I am responding to" and "what I am about to play"
 *       are visible at once and near the buttons
 *   m7  SelectPosition tiles ARE the commit — no second Confirm click
 *   c2  the location badge appears only when candidates span more than one location
 *   B2  Esc is advertised next to Cancel, and never bound to confirm
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
  /** an explicit selection overrides lifted state — a position tile answers itself */
  onConfirm: (explicit?: CardRef[]) => void;
  onDecline: () => void;
  clockSeconds: number;
  /** the next step in this intent cannot be cancelled — say so on the confirm */
  commitNext: boolean;
  /** the card this whole intent is about, for sentences that name it */
  subjectCode?: number;
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
  showLocation,
  onClick,
}: {
  e: CardEntry;
  mySeat: Seat;
  selected: boolean;
  showLocation: boolean;
  onClick: () => void;
}) {
  const c = card(e.code);
  const mine = e.controller === mySeat;
  return (
    <div className={`pick${showLocation ? " withloc" : ""}`}>
      <button
        className={`card${selected ? " selected" : ""}`}
        onClick={onClick}
        aria-pressed={selected}
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
        {selected && <span className="tick">SELECTED</span>}
      </button>
      {showLocation && (
        <span className={`locbadge ${mine ? "mine" : "theirs"}`}>{LOC_SHORT[e.location]}</span>
      )}
    </div>
  );
}

/** M6 — the trigger and your candidate are a comparison. Show both, in the bar. */
function TextPane({
  triggerCode,
  candidateCode,
  opponentName,
  triggerOwnerIsMe,
}: {
  triggerCode: number | null;
  candidateCode: number | null;
  opponentName: string;
  triggerOwnerIsMe: boolean;
}) {
  if (triggerCode === null && candidateCode === null) return null;
  const block = (code: number, label: string, tone: "mine" | "theirs") => {
    const c = card(code);
    if (!c) return null;
    return (
      <div className={`textblock ${tone}`} key={label}>
        <div className="tb-head">
          <span className="tb-tag">{label}</span>
          <b>{c.name}</b>
        </div>
        <div className="tb-body">{c.desc}</div>
      </div>
    );
  };
  return (
    <div className="textpane">
      {triggerCode !== null &&
        block(
          triggerCode,
          triggerOwnerIsMe ? "RESPONDING TO (yours)" : `RESPONDING TO (${opponentName})`,
          triggerOwnerIsMe ? "mine" : "theirs",
        )}
      {candidateCode !== null && block(candidateCode, "YOU WOULD PLAY", "mine")}
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
  let candidateCode: number | null = null;
  let triggerCode: number | null = null;
  let triggerOwnerIsMe = false;

  /** c2 — only badge locations when the candidates actually span more than one. */
  const spanning = (cards: CardEntry[]) =>
    new Set(cards.map((c) => `${c.controller}:${c.location}`)).size > 1;
  /** the card the player has picked, for the text pane and the confirm label */
  const pickedFrom = (cards: CardEntry[]) => cards.find((c) => isSel(c))?.code ?? null;

  switch (d.kind) {
    case "ChainPrompt": {
      const top = p.chain[p.chain.length - 1];
      const trigger = top ? { code: top.code, owner: top.owner, location: top.location } : null;
      if (trigger) {
        triggerCode = trigger.code;
        triggerOwnerIsMe = trigger.owner === p.mySeat;
      } else if (d.selects.length === 1) {
        triggerCode = d.selects[0].code;
        triggerOwnerIsMe = true;
      }
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
      ) : d.selects.length === 1 ? (
        // No chain context (this is your own trigger, not a response). R6.1: never a
        // bare question — name the card and its effect.
        <>
          <span className="vb">Activate</span>{" "}
          <span className="cn mine">&ldquo;{cardName(d.selects[0].code)}&rdquo;</span>{" "}
          <span className="loc">({LOC_LABEL[d.selects[0].location]})</span>?
          <div style={{ fontSize: 11.5, color: "var(--text-1)", marginTop: 3 }}>
            {d.selects[0].description}
          </div>
        </>
      ) : (
        <>
          <span className="vb">Chain</span> a card or effect?
        </>
      );
      candidateCode = pickedFrom(d.selects);
      answers = (
        <div className="answers">
          {d.selects.map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              showLocation={spanning(d.selects)}
              onClick={() => p.toggle(ref(e))}
            />
          ))}
        </div>
      );
      confirmLabel = candidateCode ? `Activate "${cardName(candidateCode)}"` : "Activate effect";
      confirmEnabled = p.selected.length === 1;
      declineLabel = d.forced ? null : "No response";
      if (d.forced) commitStatement = "You must chain one of these — this effect is mandatory.";
      break;
    }

    case "SelectTribute":
    case "SelectCard": {
      const isTrib = d.kind === "SelectTribute";
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
          <span className="cn mine">&ldquo;{cardName(p.subjectCode ?? 0)}&rdquo;</span>.
        </>
      ) : (
        <>
          <span className="vb">Choose</span> {d.min === d.max ? d.min : `${d.min}–${d.max}`} card
          {d.max > 1 ? "s" : ""}.
        </>
      );
      candidateCode = pickedFrom(d.cards);
      answers = (
        <div className="answers">
          {d.cards.map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              showLocation={spanning(d.cards)}
              onClick={() => p.toggle(ref(e))}
            />
          ))}
        </div>
      );
      counter = `${p.selected.length} of ${d.max} selected`;
      confirmEnabled = p.selected.length >= d.min && p.selected.length <= d.max;
      // M1 + B3 — words, and the name of the card that is about to be destroyed.
      const names = p.selected
        .map((r) =>
          d.cards.find(
            (c) =>
              c.controller === r.controller &&
              c.location === r.location &&
              c.sequence === r.sequence,
          ),
        )
        .filter(Boolean)
        // A face-down card has no name we are entitled to show. Name it by WHERE it is,
        // so the confirm control still identifies exactly which card it will act on.
        .map((c) =>
          c!.code === 0
            ? `${c!.controller === p.mySeat ? "your" : `${p.opponentName}'s`} set card in ${LOC_SHORT[c!.location]} ${c!.sequence + 1}`
            : cardName(c!.code),
        );
      if (isTrib) {
        confirmLabel = names.length
          ? `Tribute ${names.join(" + ")}${p.commitNext ? " — cannot be undone" : ""}`
          : "Tribute";
      } else {
        confirmLabel = names.length ? `Target ${names.join(" + ")}` : "Confirm";
      }
      declineLabel = d.cancelable ? "Cancel" : null;
      if (!d.cancelable) commitStatement = "This selection cannot be taken back.";
      break;
    }

    case "SelectZone": {
      sentence = (
        <>
          <span className="vb">Place</span>{" "}
          <span className="cn mine">&ldquo;{cardName(p.subjectCode ?? 0)}&rdquo;</span> — click one
          of the highlighted zones on your field.
        </>
      );
      answers = (
        <div className="answers hint">
          {d.zones.length} legal zone{d.zones.length === 1 ? "" : "s"} highlighted on the board.
        </div>
      );
      declineLabel = null;
      commitStatement = "Choosing a zone completes the summon. There is no cancel at this step.";
      confirmLabel = "Use the left-most legal zone";
      break;
    }

    case "SelectPosition": {
      sentence = (
        <>
          <span className="vb">Summon</span>{" "}
          <span className="cn mine">&ldquo;{cardName(d.card.code)}&rdquo;</span> in which position?
        </>
      );
      // m7 — each tile IS the commit. One click, not two.
      answers = (
        <div className="answers">
          {d.positions.map((pos, idx) => {
            const label =
              pos === "faceup_attack"
                ? "Attack position"
                : pos === "faceup_defense"
                  ? "Defence position"
                  : pos === "facedown_defense"
                    ? "Set face-down (Defence)"
                    : "Set face-down (Attack)";
            const sub =
              pos === "faceup_attack"
                ? "upright · ATK forward"
                : pos === "faceup_defense"
                  ? "sideways · DEF forward"
                  : "face-down";
            return (
              <button
                key={pos}
                className={`postile${optSel(p.selected, idx) ? " sel" : ""}`}
                // m7 — the tile IS the commit, and it carries its own answer so it
                // cannot fire with a stale selection.
                onClick={() => p.onConfirm([optRef(idx)])}
              >
                <span className={`posglyph ${pos}`} />
                <b>{label}</b>
                <span>{sub}</span>
              </button>
            );
          })}
        </div>
      );
      declineLabel = null;
      commitStatement = "The summon is already committed — only the position is left.";
      confirmLabel = "";
      break;
    }

    case "SelectEffectYN": {
      const c = card(d.card.code);
      triggerCode = d.card.code;
      triggerOwnerIsMe = d.card.controller === p.mySeat;
      sentence = (
        <>
          <span className="vb">Activate</span>{" "}
          <span className={`cn ${mine(d.card.controller)}`}>
            &ldquo;{cardName(d.card.code)}&rdquo;
          </span>{" "}
          <span className="loc">({LOC_LABEL[d.card.location]})</span>?
          {!c && d.description && (
            <div style={{ fontSize: 11.5, marginTop: 4 }}>{d.description}</div>
          )}
        </>
      );
      answers = null;
      confirmLabel = `Activate "${cardName(d.card.code)}"`;
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
      const all = [...d.selectCards, ...d.unselectCards];
      sentence = (
        <>
          <span className="vb">Select materials</span> — click cards to add or remove.
        </>
      );
      candidateCode = pickedFrom(all);
      answers = (
        <div className="answers">
          {all.map((e, i) => (
            <Thumb
              key={i}
              e={e}
              mySeat={p.mySeat}
              selected={isSel(e)}
              showLocation={spanning(all)}
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
      answers = <div className="answers hint">Generic answer space (no known Edison trigger).</div>;
      break;
    }
  }

  const warn = p.clockSeconds <= 60;
  const mm = Math.floor(p.clockSeconds / 60);
  const ss = String(p.clockSeconds % 60).padStart(2, "0");

  return (
    <div className="qbar" data-testid="question-bar">
      {/* M9 — the hairline is the TURN clock, and it now says so, with the number. */}
      <div className={`hairtrack${warn ? " warn" : ""}`}>
        <div
          className="hairfill"
          style={{ width: `${Math.max(0, Math.min(100, (p.clockSeconds / 300) * 100))}%` }}
        />
        <span className="hairlabel">
          your turn clock {mm}:{ss}
        </span>
      </div>
      <div className="sentence">{sentence}</div>
      {answers}
      <TextPane
        triggerCode={triggerCode}
        candidateCode={candidateCode}
        opponentName={p.opponentName}
        triggerOwnerIsMe={triggerOwnerIsMe}
      />
      <div className="verbs">
        {declineLabel ? (
          <button className="btn decline" onClick={p.onDecline} data-testid="decline">
            {declineLabel} <kbd>Esc</kbd>
          </button>
        ) : (
          <span className="commitnote">{commitStatement}</span>
        )}
        {counter && <span className="count">{counter}</span>}
        <span style={{ marginLeft: "auto" }} />
        {confirmLabel && (
          <button
            className="btn primary"
            disabled={!confirmEnabled}
            onClick={() => p.onConfirm()}
            data-testid="confirm"
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * B1/M2 — a decision the CLIENT answered is a RECEIPT, not a question.
 * Read-only, past tense, no primary button, and it cannot swallow a click.
 */
export function AutoAnswerReceipt({
  text,
  onAskNextTime,
}: {
  text: string;
  onAskNextTime?: () => void;
}) {
  return (
    <div className="receipt" data-testid="auto-receipt">
      <span className="rc-tag">ANSWERED FOR YOU</span>
      <span className="rc-text">{text}</span>
      {onAskNextTime && (
        <button className="chip" onClick={onAskNextTime}>
          Ask me next time
        </button>
      )}
    </div>
  );
}
