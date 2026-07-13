/// <reference types="vite/client" />

/**
 * Returns the URL for a card's artwork.
 *
 * - Production build: same-origin `/images/<imageId>.jpg` (REQ-DATA-02).
 *   Vite replaces `import.meta.env.PROD` with `true` at bundle time, so the
 *   dev branch is dead code and is eliminated by the minifier — no CDN string
 *   remains in the prod bundle.
 *
 * - Dev / test: honours `VITE_IMAGE_BASE_URL` env var; falls back to the
 *   YGOPRODeck CDN (dev-only exception — never reaches a prod bundle).
 */
export function cardImageUrl(imageId: number): string {
  if (import.meta.env.PROD) {
    return `/images/${imageId}.jpg`;
  }
  const base =
    (import.meta.env.VITE_IMAGE_BASE_URL as string | undefined) ??
    "https://images.ygoprodeck.com/images/cards_small";
  return `${base}/${imageId}.jpg`;
}
