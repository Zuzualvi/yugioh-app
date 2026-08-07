/**
 * W1 stub — CardLookup (implemented by W3).
 *
 * Always returns null (no card identity available). The board degrades
 * gracefully: tiles show position glyphs and passcode, not art or name.
 *
 * DELETE this file and its import sites when the real W3 CardLookup lands
 * on the integration branch.
 */
import type { CardLookup } from "../contracts";

export const cardLookupStub: CardLookup = {
  get: () => null,
  isLoading: () => false,
};
