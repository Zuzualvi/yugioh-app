/**
 * Duel-scoped card cache (NH-1).
 *
 * Implements `CardLookup` from the shared contracts. Consumed by W1 (board
 * tiles) and W2 (confirm labels); W3 implements and owns it.
 *
 * `code === 0` means the viewer is not entitled to the identity — return null.
 * Never render a placeholder name for a hidden card.
 */

import type { CardDTO } from "@yugioh-app/contracts";
import type { CardInfo, CardLookup } from "./contracts";
import { getCard } from "../api/cards";

// Shape mapping from wire CardDTO to the internal CardInfo the UI consumes.
function toCardInfo(dto: CardDTO): CardInfo {
  return {
    passcode: dto.passcode,
    name: dto.name,
    frame: dto.frame,
    level: dto.level,
    atk: dto.atk,
    def: dto.def,
    race: dto.race,
    attribute: dto.attribute,
    desc: dto.desc,
    preErrataText: dto.preErrataText ?? false,
  };
}

type CacheEntry = { status: "ok"; info: CardInfo } | { status: "loading" } | { status: "error" };

/**
 * Creates a duel-scoped card cache. The returned object satisfies `CardLookup`
 * and also exposes `prefetch` so the caller can seed the cache ahead of time.
 *
 * `onChange` is called whenever a fetch completes; the caller should use it to
 * trigger a re-render.
 *
 * `fetchFn` is injectable for testing; defaults to the real API client.
 */
export function createCardCache(
  onChange: () => void,
  fetchFn: (code: number) => Promise<CardDTO> = getCard,
): CardLookup & { prefetch(code: number): void } {
  const cache = new Map<number, CacheEntry>();

  function fetchCard(code: number): void {
    if (code === 0) return; // hidden — caller must handle null
    if (cache.has(code)) return; // already fetched or in flight

    cache.set(code, { status: "loading" });

    fetchFn(code)
      .then((dto) => {
        cache.set(code, { status: "ok", info: toCardInfo(dto) });
        onChange();
      })
      .catch(() => {
        cache.set(code, { status: "error" });
        onChange();
      });
  }

  return {
    get(code: number): CardInfo | null {
      if (code === 0) return null; // not entitled
      const entry = cache.get(code);
      if (!entry) {
        fetchCard(code); // trigger load on first access
        return null;
      }
      if (entry.status === "ok") return entry.info;
      return null;
    },

    isLoading(code: number): boolean {
      if (code === 0) return false;
      const entry = cache.get(code);
      return entry !== undefined && entry.status === "loading";
    },

    prefetch(code: number): void {
      fetchCard(code);
    },
  };
}
