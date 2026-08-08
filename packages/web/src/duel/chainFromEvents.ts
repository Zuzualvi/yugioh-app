/**
 * chainFromEvents — derive the current chain strip from the event feed.
 *
 * Pure, synchronous, no React, no timers. Folds the full event list into
 * the current chain state:
 *   CHAINING      → append a link (resolving: false, name: "")
 *   CHAIN_SOLVING → set resolving: true on that link, false on all others
 *   CHAIN_SOLVED  → set resolving: false on that link
 *   CHAIN_END     → return []
 *
 * Ordinals come from the event's `link` field — never from array position.
 * See design spec §"The re-indexing trap" and engineering spec C4(a).
 */

import type { DuelEvent } from "@yugioh-app/contracts";
import type { ChainLink } from "./contracts";

export function chainFromEvents(events: DuelEvent[]): ChainLink[] {
  let chain: ChainLink[] = [];

  for (const ev of events) {
    switch (ev.kind) {
      case "CHAINING":
        chain = [
          ...chain,
          {
            link: ev.link, // ordinal from the event field — not array position
            card: {
              controller: ev.card.controller,
              location: ev.card.location as ChainLink["card"]["location"],
              sequence: ev.card.sequence ?? 0,
            },
            code: ev.card.code,
            name: "", // resolved later by DuelStage via cardCache
            owner: ev.owner,
            resolving: false,
          },
        ];
        break;

      case "CHAIN_SOLVING":
        chain = chain.map((link) => ({
          ...link,
          resolving: link.link === ev.link,
        }));
        break;

      case "CHAIN_SOLVED":
        chain = chain.map((link) => (link.link === ev.link ? { ...link, resolving: false } : link));
        break;

      case "CHAIN_END":
        chain = [];
        break;

      default:
        break;
    }
  }

  return chain;
}
