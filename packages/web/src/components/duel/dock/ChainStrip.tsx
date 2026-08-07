/**
 * ChainStrip — shows what is on the chain and what is resolving, unprompted.
 *
 * Built client-side from MSG_CHAINING/CHAINED/CHAIN_SOLVING/CHAIN_SOLVED/CHAIN_END.
 * In this stub implementation, the chain is passed in as ChainLink[].
 *
 * See: docs/specs/2026-08-06-duel-ui-design.md §6.
 */

import React from "react";
import type { ChainLink } from "../../../duel/contracts";

interface Props {
  links: ChainLink[];
  mySeat: number;
}

export function ChainStrip({ links, mySeat }: Props) {
  if (links.length === 0) return null;

  return (
    <div
      data-testid="chain-strip"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px",
        overflowX: "auto",
        fontSize: "0.875rem",
      }}
      aria-label="Chain"
    >
      <span style={{ color: "var(--text-2)", flexShrink: 0 }}>⛓</span>
      {links.map((link, i) => {
        const isOwn = link.owner === mySeat;
        const isResolving = link.resolving;
        return (
          <React.Fragment key={link.link}>
            {i > 0 && <span style={{ color: "var(--text-2)" }}>→</span>}
            <div
              data-testid={isResolving ? "chain-link-resolving" : "chain-link"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                border: isResolving
                  ? `2px solid ${isOwn ? "var(--own)" : "var(--opp)"}`
                  : `1px solid var(--border)`,
                borderRadius: 4,
                background: isResolving ? "var(--bg-2)" : "transparent",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: isOwn ? "var(--own)" : "var(--opp)",
                  fontSize: "0.8rem",
                }}
              >
                {link.link}
              </span>
              <span style={{ color: isOwn ? "var(--own)" : "var(--opp)" }}>{link.name}</span>
              {isResolving && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-2)" }}>▶ RESOLVING</span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
