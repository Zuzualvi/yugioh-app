import type { CardEntry, Loc, Seat, ZoneCard } from "../proto/types";
import { cardInfo } from "../proto/scenarios";
import { entitled, isDefence, isFaceDown, redactedForDisplay } from "../proto/board";
import { CardArt } from "./CardArt";

export interface TileRef {
  controller: Seat;
  location: Loc;
  sequence: number;
}

/**
 * One card on the board.
 *
 * The rule that changed: a tile's identity is TEXT plus art, never art alone.
 * The shipped tile is 58x82 with `alt=""`, `aria-hidden` on the image and no name
 * anywhere, so a card whose art has not loaded is nothing at all — six featureless
 * grey rectangles at t=10s of a real duel. The name renders first and the image
 * arrives on top of it.
 */
export function CardTile({
  card,
  ref_,
  mySeat,
  onClick,
  onHover,
  candidate,
  selected,
  shake,
  broken,
}: {
  card: ZoneCard | null;
  ref_: TileRef;
  mySeat: Seat;
  onClick?: (r: TileRef) => void;
  onHover?: (code: number) => void;
  candidate?: boolean;
  selected?: boolean;
  shake?: boolean;
  broken?: boolean;
}) {
  const own = ref_.controller === mySeat;
  if (!card) {
    return <div className={`slot ${own ? "mine" : "theirs"}`} data-testid={`slot-${ref_.location}-${ref_.sequence}`} />;
  }
  const isEnt = entitled(mySeat, ref_.controller, ref_.location, card);
  const shown = redactedForDisplay(card, isEnt);
  const info = shown.code ? cardInfo(shown.code) : null;
  // ocgcore reports EVERY hand card with position 10 (FACEDOWN_ATTACK |
  // FACEDOWN_DEFENSE). Those bits are meaningless in the hand: a card in your
  // hand is face-up to you and is never rotated. Reading them there is exactly
  // how the shipped inspector came to say "Face-down card" about a card the
  // player was holding.
  const inHand = ref_.location === "HAND";
  const fd = !inHand && isFaceDown(card.position);
  const def = !inHand && isDefence(card.position);
  const cls = [
    "card",
    fd && !own ? "back" : "",
    fd && own ? "translucent" : "",
    def ? "def" : "",
    candidate ? (own ? "target-mine" : "target-theirs") : "",
    selected ? "selected" : "",
    shake ? "tileshake" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={`slot ${own ? "mine" : "theirs"}`}
      data-testid={`slot-${ref_.location}-${ref_.sequence}`}
      onClick={() => onClick?.(ref_)}
      onMouseEnter={() => shown.code && onHover?.(shown.code)}
      // Keyboard parity: a player tabbing the board reads the same card a pointer
      // would. Focus never answers anything — it is the inspector's second trigger,
      // not a third gesture.
      onFocus={() => shown.code && onHover?.(shown.code)}
      aria-label={info ? info.name : fd ? "Face-down card" : "Card"}
    >
      <span className={cls}>
        {shown.code ? <CardArt code={shown.code} className="fill" broken={broken} /> : null}
        {info ? (
          <>
            {info.atk != null ? (
              <span className="tilestats">
                {def && info.def != null ? info.def : info.atk}
              </span>
            ) : null}
            <span className="tilename">{info.name}</span>
          </>
        ) : (
          <span className="tilename">{fd ? "Face-down" : ""}</span>
        )}
      </span>
    </button>
  );
}

export function CandidateThumb({
  entry,
  mySeat,
  label,
  selected,
  onClick,
  onHover,
  broken,
}: {
  entry: CardEntry;
  mySeat: Seat;
  label: string;
  selected: boolean;
  onClick: () => void;
  /** Read the card without choosing it. The ONLY candidates the dock draws itself
   *  are those with no tile on the board, so without this they are the one answer
   *  space on the screen that cannot be read before it is answered. */
  onHover?: (code: number) => void;
  broken?: boolean;
}) {
  const own = entry.controller === mySeat;
  const named = Boolean(entry.name || cardInfo(entry.code));
  return (
    <button
      className={`cand ${selected ? "sel" : ""}`}
      data-testid="decision-candidate"
      onClick={onClick}
      onMouseEnter={() => entry.code && onHover?.(entry.code)}
      onFocus={() => entry.code && onHover?.(entry.code)}
      aria-label={label}
    >
      <span className="thumb">
        {entry.code ? <CardArt code={entry.code} className="fill" broken={broken} /> : null}
      </span>
      <span className={`clabel ${named ? "" : "anon"}`}>{label}</span>
      <span className={`cloc ${own ? "mine" : "theirs"}`}>{own ? "YOURS" : "THEIRS"}</span>
    </button>
  );
}
