import { useState } from "react";
import type { CardEntry, DuelDecision, DuelEvent, DuelStateSnapshot, Seat } from "../proto/types";
import { candidateLabel, cardInfo } from "../proto/scenarios";
import type { DecisionResponse } from "../proto/classify";
import { playerCancelExists } from "../proto/playerCancelExists";
import { mayAnswerWithoutAsking } from "../proto/classify";
import type { DuelModel } from "../proto/useDuel";
import { CandidateThumb } from "./CardTile";

/**
 * The dock band.
 *
 * It is a GRID ROW with a reserved height, not a fixed-position overlay. That is
 * the whole of requirement B3: the shipped panel was `position:fixed; bottom:0;
 * maxHeight:40vh` and grew upward over the hand as soon as it had content, so
 * every hand card returned `DIV[action-panel]` from `elementFromPoint`. A band
 * that is laid out cannot grow over anything — it has no mechanism to.
 *
 * Six mutually exclusive contents, one height, never more than one at a time.
 */
export type Answer = (
  a: DecisionResponse,
  probe?: { identities: string[]; label: string; selectionLine: string },
) => void;

export function Dock({
  m,
  onAnswer,
  onCancel,
  onClaim,
  onDismissDelta,
  onToggleDelta,
  selection,
  setSelection,
}: {
  m: DuelModel;
  onAnswer: Answer;
  onCancel: () => void;
  onClaim: () => void;
  onDismissDelta: () => void;
  onToggleDelta: () => void;
  selection: number[];
  setSelection: (s: number[]) => void;
}) {
  return (
    <div className="dockband" data-testid="dock">
      {m.intent ? <IntentLine m={m} onCancel={onCancel} /> : null}
      {m.receipts.map((r) => (
        <div className="receiptrow" key={r.id} data-testid="auto-receipt" role="status">
          <span className="rtag">Answered for you</span>
          <span>{r.detail}</span>
        </div>
      ))}
      {m.delta && m.control === "mine" ? (
        <Delta m={m} onDismiss={onDismissDelta} onToggle={onToggleDelta} />
      ) : null}
      {m.presence !== "connected" && !m.ended ? <Away m={m} onClaim={onClaim} /> : null}
      {m.protoNote ? (
        <div className="protonote" data-testid="proto-note" role="status">
          (prototype) {m.protoNote}
        </div>
      ) : null}
      <DockBody
        m={m}
        onAnswer={onAnswer}
        selection={selection}
        setSelection={setSelection}
      />
    </div>
  );
}

function DockBody({
  m,
  onAnswer,
  selection,
  setSelection,
}: {
  m: DuelModel;
  onAnswer: Answer;
  selection: number[];
  setSelection: (s: number[]) => void;
}) {
  if (m.ended) return <div className="quiet">The duel has ended.</div>;
  if (m.control === "connecting") return <Seating m={m} />;
  if (m.control === "theirs") {
    // One statement at a time. If presence is lost, the away banner owns the
    // truth and the dock does not simultaneously claim they are deciding — the
    // shipped screen's whole disease was saying two contradictory things at once.
    if (m.presence !== "connected") return null;
    return (
      <div className="waiting" data-testid="waiting" role="status">
        <span className="pulse" />
        <span>{m.scenario.opponentName} is deciding</span>
      </div>
    );
  }
  if (m.control === "resolving")
    return (
      <div className="waiting resolving" data-testid="waiting" role="status">
        <span className="pulse" />
        <span>Resolving…</span>
      </div>
    );
  if (m.net === "reconnecting")
    return (
      <div className="waiting disconnected" data-testid="waiting" role="status">
        <span className="pulse" />
        <span>Reconnecting…</span>
      </div>
    );
  if (!m.step) return <div className="quiet">Your move.</div>;

  const d = m.step.decision;
  // A decision the client is answering is never rendered as a live question with
  // an enabled button. It is a receipt (§3.3) and nothing else — "a question the
  // player cannot answer is worse than no question".
  if (mayAnswerWithoutAsking(d)) return null;
  // IdleCommand and BattleCommand are NEVER a question panel. They arm the
  // board; the engine's legal-move list becomes what the board affords. Cleared
  // and carried forward from the previous design.
  //
  // ONE STATEMENT AT A TIME (§3.4), and while the delta is EXPANDED the delta is
  // the statement. This hint is redundant in that moment — the board is armed, the
  // phase rail is on screen and `End Turn` is in it — and the 132px band is
  // reserved, so the 32px it occupies is the only space the delta list can be given
  // without growing the dock over the hand (which is ZUH-118 break 3). Measured:
  // suppressing it takes the expanded list from 42px showing 2 of 5 rows to 74px
  // showing 4 of 5, with the band still at exactly 132px. ZUH-148.
  if (d.kind === "IdleCommand" || d.kind === "BattleCommand")
    return m.delta && m.deltaOpen ? null : (
      <div className="quiet">Your move — click a card, or use the phase rail.</div>
    );

  return <Question m={m} d={d} onAnswer={onAnswer} selection={selection} setSelection={setSelection} />;
}

// ── the intent line ───────────────────────────────────────────────────────────

function IntentLine({ m, onCancel }: { m: DuelModel; onCancel: () => void }) {
  const i = m.intent!;
  const name = i.subject ? i.subject.name || cardInfo(i.subject.code)?.name || "" : "";
  return (
    <div className="intentline" data-testid="intent-line">
      <span className="iverb">
        {i.verb}
        {name ? (
          <>
            {" "}
            <b>{name}</b>
          </>
        ) : null}
      </span>
      <span className="igrow" />
      {i.cancelable ? (
        <button className="btn sm decline" data-testid="intent-cancel" onClick={onCancel}>
          Cancel {i.verb.toLowerCase()}
        </button>
      ) : (
        <span className="icommitted" data-testid="intent-committed">
          Committed
        </span>
      )}
    </div>
  );
}

// ── the question ──────────────────────────────────────────────────────────────

function Question({
  m,
  d,
  onAnswer,
  selection,
  setSelection,
}: {
  m: DuelModel;
  d: DuelDecision;
  onAnswer: Answer;
  selection: number[];
  setSelection: (s: number[]) => void;
}) {
  const cands: CardEntry[] = "cards" in d ? d.cards : "selects" in d ? d.selects : [];
  const min = "min" in d ? d.min : 1;
  const max = "max" in d ? d.max : 1;
  const enough = selection.length >= min && selection.length <= max;
  const canCancel = playerCancelExists(d);

  // Candidates are picked WHERE THEY LIVE. The dim law lifts every candidate out
  // of the scrim — hand, field, pile badge — so a target set spanning three
  // locations is legible in one glance and the dock does not show the same card
  // twice. The only candidates the dock draws itself are the ones with no tile on
  // the board: a card inside a pile.
  const offBoard = cands
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.location === "GRAVE" || c.location === "REMOVED" || c.location === "DECK" || c.location === "EXTRA");

  const chosen = selection.map((i) => cands[i]).filter(Boolean) as CardEntry[];
  const selectionLine =
    chosen.length === 0
      ? `Click ${max === 1 ? "a highlighted card" : `${min === max ? min : `${min}–${max}`} highlighted cards`} ${whereCandidatesAre(cands, m.mySeat)}`
      : `Chosen: ${chosen.map((c) => candidateLabel(c, m.mySeat, cands, m.board)).join(", ")}${max > 1 ? ` (${chosen.length} of ${max})` : ""}`;
  // F-08: the clause moves OUT of the button and into the warning line above it.
  // With it inside, the confirm grew from x691-781 to x454-1018 the moment a card
  // was chosen, and Cancel jumped left — so the pixel where Cancel had been was
  // now inside an irreversible confirm. A player returning the mouse to where
  // Cancel was pressed "you cannot cancel". That is an error-prevention defect at
  // the exact moment the commit lock exists to prevent errors.
  const commitWarning = m.step?.commitsNext ? "After this you cannot cancel." : null;
  const confirmLabel = confirmLabelFor(d, selection, m.mySeat, m.intent?.verb, m.board);

  return (
    <div className="question" data-testid="question">
      <Sentence m={m} d={d} />
      {offBoard.length ? (
        <div className="q-cands">
          {offBoard.map(({ c, i }) => (
            <CandidateThumb
              key={`${c.location}-${c.sequence}-${i}`}
              entry={c}
              mySeat={m.mySeat}
              label={candidateLabel(c, m.mySeat, cands, m.board)}
              selected={selection.includes(i)}
              onClick={() =>
                setSelection(
                  max === 1
                    ? selection[0] === i
                      ? []
                      : [i]
                    : selection.includes(i)
                      ? selection.filter((x) => x !== i)
                      : [...selection, i].slice(0, max),
                )
              }
              broken={m.scenario.breakArt}
            />
          ))}
        </div>
      ) : null}
      {cands.length ? (
        <div className="q-count" data-testid="selection-line">
          {selectionLine}
        </div>
      ) : null}
      {commitWarning ? (
        <div className="commitwarn" data-testid="commit-warning">
          {commitWarning}
        </div>
      ) : null}
      <div className="q-verbs">
        {d.kind === "ChainPrompt" ? (
          <button className="btn decline" data-testid="decision-decline" onClick={() => onAnswer({ kind: "ChainPrompt", index: null })}>
            No response
          </button>
        ) : canCancel ? (
          <button className="btn decline" data-testid="decision-decline" onClick={() => onAnswer(cancelResponse(d))}>
            Cancel
          </button>
        ) : (
          <span className="commitnote" data-testid="commit-note">
            This step cannot be cancelled
          </span>
        )}
        <button
          className="btn primary"
          data-testid="decision-confirm"
          disabled={cands.length > 0 && !enough}
          onClick={() =>
            onAnswer(responseFor(d, selection), {
              // The identities are resolved from the RESPONSE's own indices, not
              // from the label's text, so the gate compares two independent paths.
              identities: selection
                .map((i) => cands[i])
                .filter(Boolean)
                .map((c) => candidateLabel(c!, m.mySeat, cands, m.board)),
              label: confirmLabel,
              selectionLine,
            })
          }
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Line 1 — always a sentence, and where the engine gave no context the fallback
 * is STATED rather than silently degrading to a bare verb. The previous design
 * never said what line 1 degrades to, and what shipped was `Chain a card or
 * effect?` with no subject at all.
 */
function Sentence({ m, d }: { m: DuelModel; d: DuelDecision }) {
  const ctx = m.step?.context;
  if (d.kind === "ChainPrompt") {
    return (
      <div className="q-sentence" data-testid="decision-sentence">
        {ctx?.caption ? (
          <span>{ctx.caption}</span>
        ) : ctx?.activatingCard ? (
          <span>
            <span className="cardname theirs">
              {cardInfo(ctx.activatingCard.code)?.name ?? "A card"}
            </span>{" "}
            was activated.
          </span>
        ) : (
          <span>
            Something happened that you may respond to.
            <span className="q-fallback">The engine did not say what. (MH-3b)</span>
          </span>
        )}
        <div>Chain a card or effect?</div>
      </div>
    );
  }
  if (d.kind === "SelectTribute")
    return (
      <div className="q-sentence" data-testid="decision-sentence">
        Tribute {d.min === d.max ? d.min : `${d.min}–${d.max}`} monster{d.max > 1 ? "s" : ""} for{" "}
        <span className="cardname mine">{m.intent?.subject?.name ?? "this summon"}</span>.
      </div>
    );
  if (d.kind === "SelectZone")
    return (
      <div className="q-sentence" data-testid="decision-sentence">
        Place <span className="cardname mine">{m.intent?.subject?.name ?? "the card"}</span> — click a
        highlighted zone on the board.
      </div>
    );
  if (d.kind === "SelectCard") {
    const allHand = d.cards.every((c) => c.location === "HAND" && c.controller === m.mySeat);
    if (allHand)
      return (
        <div className="q-sentence" data-testid="decision-sentence">
          Discard {d.min === d.max ? d.min : `${d.min}–${d.max}`} from your hand.
        </div>
      );
    if (m.intent?.verb === "Attack")
      return (
        <div className="q-sentence" data-testid="decision-sentence">
          <span className="cardname mine">{m.intent.subject?.name}</span> attacks — choose a target.
        </div>
      );
    return (
      <div className="q-sentence" data-testid="decision-sentence">
        {ctx?.caption ?? "Choose a card."}
      </div>
    );
  }
  return (
    <div className="q-sentence" data-testid="decision-sentence">
      {ctx?.caption ?? `Answer: ${d.kind}`}
    </div>
  );
}

/**
 * THE CONFIRM LABEL AND THE SUBMITTED RESPONSE DERIVE FROM THE SAME VALUE.
 * `selection` is that value. Both functions below read it and nothing else, so
 * a label that names one card and a response that submits another is not
 * expressible here.
 */
export function confirmLabelFor(
  d: DuelDecision,
  selection: number[],
  mySeat: Seat,
  verb?: string,
  board?: DuelStateSnapshot | null,
): string {
  const cands: CardEntry[] = "cards" in d ? d.cards : "selects" in d ? d.selects : [];
  const chosen = selection.map((i) => cands[i]).filter(Boolean) as CardEntry[];
  const names = chosen.map((c) => candidateLabel(c, mySeat, cands, board)).join(" + ");
  switch (d.kind) {
    case "ChainPrompt":
      return chosen.length ? `Activate ${names}` : "Activate";
    case "SelectTribute":
      return chosen.length ? `Tribute ${names}` : "Tribute";
    case "SelectCard":
      if (verb === "Attack") return chosen.length ? `Attack ${names}` : "Attack";
      return chosen.length ? `Select ${names}` : "Select";
    case "SelectZone":
      return "Place";
    default:
      return "Confirm";
  }
}

export function responseFor(d: DuelDecision, selection: number[]): DecisionResponse {
  switch (d.kind) {
    case "ChainPrompt":
      return { kind: "ChainPrompt", index: selection[0] ?? null };
    case "SelectTribute":
      return { kind: "SelectTribute", indices: selection };
    case "SelectCard":
      return { kind: "SelectCard", indices: selection };
    case "SelectZone":
      return { kind: "SelectZone", indices: selection };
    case "SelectPosition":
      return { kind: "SelectPosition", position: selection[0] ?? 1 };
    default:
      return { kind: "SelectCard", indices: selection };
  }
}

function cancelResponse(d: DuelDecision): DecisionResponse {
  if (d.kind === "SelectTribute") return { kind: "SelectTribute", indices: null };
  return { kind: "SelectCard", indices: null };
}

// ── While you were away ───────────────────────────────────────────────────────

function Delta({ m, onDismiss, onToggle }: { m: DuelModel; onDismiss: () => void; onToggle: () => void }) {
  const rows = m.delta!.filter((e) => ["SUMMON", "SET", "MOVE", "ATTACK", "BATTLE", "LP_CHANGE", "CHAINING"].includes(e.kind));
  return (
    <>
      <div className="deltastrip" data-testid="delta-strip">
        <span className="dcount">{rows.length}</span>
        <span>thing{rows.length === 1 ? "" : "s"} happened while it was theirs</span>
        <span className="dgrow" />
        <button className="btn sm" data-testid="delta-toggle" onClick={onToggle}>
          {m.deltaOpen ? "Hide" : "Show"}
        </button>
        <button className="btn sm decline" data-testid="delta-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      {m.deltaOpen ? (
        <div className="deltalist" data-testid="delta-list">
          {rows.length === 0 ? <span>Nothing changed on the board.</span> : null}
          {rows.map((e, i) => (
            <span key={i}>{deltaRow(e)}</span>
          ))}
        </div>
      ) : null}
    </>
  );
}

// ── the opponent is gone ──────────────────────────────────────────────────────

/**
 * F-06: one string per candidate-zone set, chosen at render time. "on the board"
 * was verbatim right in the tribute and attack steps and verbatim wrong in the
 * chain window and the discard, where every candidate is in the hand.
 */
function whereCandidatesAre(cands: CardEntry[], mySeat: Seat): string {
  const inHand = cands.some((c) => c.location === "HAND" && c.controller === mySeat);
  const onBoard = cands.some((c) => c.location === "MZONE" || c.location === "SZONE");
  if (inHand && onBoard) return "in your hand or on the board";
  if (inHand) return "in your hand";
  return "on the board";
}

function deltaRow(e: DuelEvent): string {
  const code = Number(e["code"] ?? (e["card"] as { code?: number } | undefined)?.code ?? 0);
  const name = code ? (cardInfo(code)?.name ?? String(code)) : "";
  return name ? `${e.kind} · ${name}` : e.kind;
}

function Away({ m, onClaim }: { m: DuelModel; onClaim: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="awaybanner" data-testid="away-banner" role="status">
      <span>
        {m.scenario.opponentName} lost connection.
        {armed ? " They have not come back." : " Waiting for them to come back."}
      </span>
      <span className="agrow" />
      {armed ? (
        <button className="btn primary sm" data-testid="claim-duel" onClick={onClaim}>
          Claim the duel
        </button>
      ) : (
        <button className="btn sm" data-testid="arm-claim" onClick={() => setArmed(true)}>
          (prototype) simulate the grace period elapsing
        </button>
      )}
    </div>
  );
}

// ── seating ───────────────────────────────────────────────────────────────────

function Seating({ m }: { m: DuelModel }) {
  const first = m.board.currentTurn === m.mySeat;
  return (
    <div className="seating" data-testid="seating">
      <div className="vs">
        <span className="me">{m.scenario.myName}</span> vs{" "}
        <span className="them">{m.scenario.opponentName}</span>
      </div>
      <div className="order">{first ? "You go first." : `${m.scenario.opponentName} goes first.`}</div>
    </div>
  );
}
