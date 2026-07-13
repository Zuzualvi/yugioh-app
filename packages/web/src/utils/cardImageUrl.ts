/// <reference types="vite/client" />

/**
 * Returns the URL for a card's artwork.
 *
 * - Production build: uses `VITE_IMAGE_BASE_URL` (required at build time on
 *   Vercel, points at the Fly backend image route). The dev branch is dead code
 *   in the prod bundle — no CDN string remains (REQ-DATA-02).
 *
 * - Dev / test: honours `VITE_IMAGE_BASE_URL` env var; falls back to the
 *   YGOPRODeck CDN (dev-only exception — never reaches a prod bundle).
 */
export function cardImageUrl(imageId: number): string {
  if (import.meta.env.PROD) {
    const base = import.meta.env.VITE_IMAGE_BASE_URL as string; // set on Vercel at build time
    return `${base}/${imageId}.jpg`;
  }
  const base =
    (import.meta.env.VITE_IMAGE_BASE_URL as string | undefined) ??
    "https://images.ygoprodeck.com/images/cards_small";
  return `${base}/${imageId}.jpg`;
}
