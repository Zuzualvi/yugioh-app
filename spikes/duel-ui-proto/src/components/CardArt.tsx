/**
 * CardArt — the real card image, with the three states a network dependency brings.
 *
 * The image is the FULL card face (813×1185: name, type line, artwork, stats and the
 * text box), not an artwork crop. That matters for two decisions elsewhere:
 *   • the inspector shows the image AND the rendered text, because the text baked into
 *     the image is unreadable at panel width, unselectable, unsearchable and invisible
 *     to a screen reader. Image for recognition, rendered text for reading.
 *   • `alt=""` — the image is decorative duplication of text that is already on the
 *     page. Giving it the card name would make a screen reader say it twice.
 *
 * States, all three required (surface-inventory.md §8):
 *   loading — a placeholder holding the exact aspect ratio, so nothing jumps when the
 *             image lands. Never a spinner: the panel's own text is already readable.
 *   ok      — the image, faded in over 120ms.
 *   failed  — renders NOTHING. The caller keeps its text-only layout, which is exactly
 *             what the panel looked like before art existed. A card whose art fails to
 *             load must still be fully usable, and there must be no broken-image icon.
 *
 * An unknown passcode returns a JSON 404 from the image host, so `onError` covers both
 * "no such card" and "network down" — a 200 is not a guarantee of a JPEG.
 */

import { useEffect, useState } from "react";

/** 813 × 1185 — measured from the served files, not assumed. */
export const CARD_ART_RATIO = 813 / 1185;

/**
 * Mirrors packages/web/src/utils/cardImageUrl.ts, which already resolves
 * `VITE_IMAGE_BASE_URL` (= https://api.zuhayr.io/images in this deployment).
 * No backend change: these are public static files.
 */
const IMAGE_BASE = "https://api.zuhayr.io/images";
export const cardImageUrl = (passcode: number) => `${IMAGE_BASE}/${passcode}.jpg`;

export type ArtState = "loading" | "ok" | "failed";

interface Props {
  code: number;
  /** rendered width in px; height is derived so the box never changes shape */
  width: number;
  className?: string;
  /** board/hand tiles paint the art behind their own text overlays */
  fill?: boolean;
  /** the inspector's art is the thing the player asked for — never defer it */
  eager?: boolean;
  /**
   * Lifted so a caller can react to whether a printing is actually on screen. The
   * provenance badge needs this: it contrasts our text with "this printing", and with
   * no printing visible there is nothing to contrast.
   */
  onState?: (s: ArtState) => void;
}

/**
 * A placeholder that never resolves is the hole this whole state machine exists to
 * avoid, so `loading` is bounded. Past this, we degrade to text exactly as if the
 * request had errored.
 */
const LOAD_DEADLINE_MS = 5000;

export function CardArt({
  code,
  width,
  className = "",
  fill = false,
  eager = false,
  onState,
}: Props) {
  const [state, setState] = useState<ArtState>("loading");
  const src = code > 0 ? cardImageUrl(code) : null;

  useEffect(() => {
    setState("loading");
    if (!src) {
      onState?.("failed");
      return;
    }
    onState?.("loading");
    const t = window.setTimeout(() => {
      setState((s) => (s === "loading" ? "failed" : s));
      onState?.("failed");
    }, LOAD_DEADLINE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Face-down / unknown: there is no art we are entitled to show, and no failure either.
  if (!src) return null;
  // Failed: render nothing at all. The caller's text-only layout is the fallback.
  if (state === "failed") return null;

  const height = Math.round(width / CARD_ART_RATIO);
  const box = fill ? undefined : { width, height };

  return (
    <div
      className={`cardart ${state}${fill ? " fill" : ""} ${className}`}
      style={box}
      data-testid="card-art"
      data-state={state}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => {
          setState("ok");
          onState?.("ok");
        }}
        onError={() => {
          setState("failed");
          onState?.("failed");
        }}
      />
    </div>
  );
}
