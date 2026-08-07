/**
 * EventLogRail (§10, §8 component-contract) — the right-rail event log.
 *
 * Layout: 320px, collapsed by default (32px spine). Overlays the board;
 * never reflows it. Expanding costs the board 0px extra (it was always 34px).
 *
 * Every engine event appears exactly once — deduped on DuelEvent.seq.
 * Grouped: turn banner → LP snapshot → phase header → rows.
 * No prose sentences. Names tinted by owner (--own blue / --opp red).
 * LP_CHANGE rows name the seat whose LP moved: "Sakura −1200 LP".
 *
 * Filter chips: Summons · Activations · Battle · Movement · Phases.
 * Search matches card names.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DuelEvent, Seat } from "@yugioh-app/contracts";
import type { CardLookup } from "../../../duel/contracts";

// Phase codes (web-encoded, from duelEvent.ts CommonFields comment).
const PHASE_LABELS: Record<number, string> = {
  1: "Draw Phase",
  2: "Standby Phase",
  4: "Main Phase 1",
  8: "Battle Phase",
  16: "Main Phase 2",
  32: "End Phase",
};

type FilterKey = "summons" | "activations" | "battle" | "movement" | "phases";

const FILTER_LABELS: Record<FilterKey, string> = {
  summons: "Summons",
  activations: "Activations",
  battle: "Battle",
  movement: "Movement",
  phases: "Phases",
};

function eventMatchesFilter(e: DuelEvent, filter: FilterKey): boolean {
  switch (filter) {
    case "summons":
      return e.kind === "SUMMON" || e.kind === "SPSUMMON" || e.kind === "SET";
    case "activations":
      return (
        e.kind === "CHAINING" ||
        e.kind === "CHAIN_SOLVING" ||
        e.kind === "CHAIN_SOLVED" ||
        e.kind === "CHAIN_END"
      );
    case "battle":
      return e.kind === "ATTACK" || e.kind === "BATTLE" || e.kind === "LP_CHANGE";
    case "movement":
      return e.kind === "MOVE";
    case "phases":
      return e.kind === "PHASE" || e.kind === "TURN";
  }
}

function eventMatchesSearch(e: DuelEvent, query: string, lookup: CardLookup): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // Check card names from the event.
  const codes: number[] = [];
  if ("card" in e && e.card) codes.push(e.card.code);
  if ("attacker" in e && e.attacker) codes.push(e.attacker.code);
  if ("target" in e && e.target) codes.push(e.target.code);

  for (const code of codes) {
    if (code === 0) continue;
    const info = lookup.get(code);
    if (info?.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

function locationIcon(loc: string): string {
  const map: Record<string, string> = {
    HAND: "🖐",
    MZONE: "⬛",
    SZONE: "⬛",
    FZONE: "⬛",
    GRAVE: "⚰",
    REMOVED: "🚫",
    EXTRA: "📦",
    DECK: "🂠",
    OVERLAY: "◎",
  };
  return map[loc] ?? "?";
}

function verbLabel(e: DuelEvent): string {
  switch (e.kind) {
    case "SUMMON":
      return "Summon";
    case "SPSUMMON":
      return "Special Summon";
    case "SET":
      return "Set";
    case "MOVE":
      return "Move";
    case "CHAINING":
      return "Activate";
    case "CHAIN_SOLVING":
      return "Resolving";
    case "CHAIN_SOLVED":
      return "Resolved";
    case "CHAIN_END":
      return "Chain end";
    case "LP_CHANGE":
      return e.delta < 0 ? "LP −" + Math.abs(e.delta) : "LP +" + e.delta;
    case "ATTACK":
      return "Attack";
    case "BATTLE":
      return "Battle";
    case "PHASE":
      return "Phase";
    case "TURN":
      return "Turn start";
    case "HINT":
      return "Hint";
    default:
      return (e as { kind: string }).kind;
  }
}

interface LogRowProps {
  event: DuelEvent;
  mySeat: Seat;
  playerNames: [string, string];
  lookup: CardLookup;
}

function LogRow({ event, mySeat, playerNames, lookup }: LogRowProps) {
  // LP_CHANGE row: "Sakura −1200 LP" (ND-4 / m14).
  if (event.kind === "LP_CHANGE") {
    const seat = event.seat;
    const name = playerNames[seat];
    const isOwn = seat === mySeat;
    const sign = event.delta < 0 ? "−" : "+";
    const abs = Math.abs(event.delta);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          fontSize: "0.75rem",
        }}
      >
        <span style={{ color: "var(--bg-2,#222)", fontSize: "0.6rem" }}>▪</span>
        <span
          style={{
            color: isOwn ? "var(--own,#4a90d9)" : "var(--opp,#d94a4a)",
            fontWeight: 600,
            minWidth: 60,
          }}
        >
          {name}
        </span>
        <span style={{ color: "var(--text-1)", fontWeight: 500 }}>
          {sign}
          {abs} LP
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--text-3,#666)",
            marginLeft: "auto",
          }}
        >
          {event.reason}
        </span>
      </div>
    );
  }

  // Get primary card code from the event.
  let cardCode = 0;
  if ("card" in event && event.card) cardCode = event.card.code;
  else if ("attacker" in event && event.attacker) cardCode = event.attacker.code;

  const info = cardCode !== 0 ? lookup.get(cardCode) : null;
  const cardName = info?.name ?? (cardCode !== 0 ? `#${cardCode}` : null);

  // From→to arrow for MOVE events.
  let fromTo: string | null = null;
  if (event.kind === "MOVE") {
    const from = locationIcon(event.from.location);
    const to = locationIcon(event.to.location);
    fromTo = `${from} → ${to}`;
  } else if (event.kind === "SUMMON" || event.kind === "SPSUMMON") {
    fromTo = `🖐 → ⬛`;
  } else if (event.kind === "SET") {
    fromTo = `🖐 → ⬛`;
  } else if (event.kind === "ATTACK") {
    const target = event.target ? locationIcon(event.target.location) : "⊕";
    fromTo = `⚔ → ${target}`;
  }

  const actorSeat = event.actor;
  const isOwn = actorSeat === mySeat;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        fontSize: "0.75rem",
      }}
    >
      <span
        style={{
          color: isOwn ? "var(--own,#4a90d9)" : "var(--opp,#d94a4a)",
          fontSize: "0.6rem",
          flexShrink: 0,
        }}
      >
        ▪
      </span>
      {cardName && (
        <span
          style={{
            color: isOwn ? "var(--own,#4a90d9)" : "var(--opp,#d94a4a)",
            fontWeight: 600,
            maxWidth: 80,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title={cardName}
        >
          {cardName.length > 12 ? cardName.slice(0, 11) + "…" : cardName}
        </span>
      )}
      <span style={{ color: "var(--text-1)", flexShrink: 0 }}>{verbLabel(event)}</span>
      {fromTo && (
        <span style={{ color: "var(--text-3,#666)", marginLeft: "auto", flexShrink: 0 }}>
          {fromTo}
        </span>
      )}
    </div>
  );
}

interface Props {
  events: DuelEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mySeat: Seat;
  playerNames: [string, string];
  lookup: CardLookup;
  /** LP by turn: Record<turnNumber, [seat0LP, seat1LP]> */
  lpByTurn?: Record<number, [number, number]>;
  /** True while a reconnect backfill is in progress. */
  loading?: boolean;
  /** True when the log is incomplete (reconnect without persisted log). */
  partial?: boolean;
  /** Unread count since last open. */
  unread?: number;
}

export function EventLogRail({
  events,
  open,
  onOpenChange,
  mySeat,
  playerNames,
  lookup,
  lpByTurn = {},
  loading = false,
  partial = false,
  unread = 0,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: L.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "l" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Auto-scroll to bottom when new events arrive.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, open]);

  // Dedupe on seq — monotonic, gap-free.
  const dedupedEvents = useMemo(() => {
    const seen = new Set<number>();
    const out: DuelEvent[] = [];
    for (const e of events) {
      if (!seen.has(e.seq)) {
        seen.add(e.seq);
        out.push(e);
      }
    }
    return out;
  }, [events]);

  // Apply filter + search.
  const visibleEvents = useMemo(() => {
    return dedupedEvents.filter((e) => {
      if (activeFilters.size > 0) {
        const matchesAny = [...activeFilters].some((f) => eventMatchesFilter(e, f));
        if (!matchesAny) return false;
      }
      if (search && !eventMatchesSearch(e, search, lookup)) return false;
      return true;
    });
  }, [dedupedEvents, activeFilters, search, lookup]);

  // Group by turn + phase.
  type Group = {
    turnNumber: number;
    turnPlayer: Seat | null;
    phase: number;
    events: DuelEvent[];
  };

  const groups = useMemo(() => {
    const result: Group[] = [];
    let currentGroup: Group | null = null;

    for (const e of visibleEvents) {
      const needsNewGroup =
        !currentGroup || currentGroup.turnNumber !== e.turnNumber || currentGroup.phase !== e.phase;

      if (needsNewGroup) {
        // Determine turn player from TURN events.
        const turnPlayer =
          e.kind === "TURN"
            ? e.turnPlayer
            : (result.find((g) => g.turnNumber === e.turnNumber)?.turnPlayer ?? null);

        currentGroup = {
          turnNumber: e.turnNumber,
          turnPlayer,
          phase: e.phase,
          events: [],
        };
        result.push(currentGroup);
      }
      currentGroup!.events.push(e);
    }

    return result;
  }, [visibleEvents]);

  function toggleFilter(f: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  // Determine turn owner for banner.
  function turnOwnerName(g: Group): string {
    if (g.turnPlayer !== null) return playerNames[g.turnPlayer];
    return g.turnNumber % 2 === 1 ? playerNames[0] : playerNames[1];
  }

  function isTurnOwn(g: Group): boolean {
    if (g.turnPlayer !== null) return g.turnPlayer === mySeat;
    return g.turnNumber % 2 === 1 ? mySeat === 0 : mySeat === 1;
  }

  const maxTurn = dedupedEvents.reduce((m, e) => Math.max(m, e.turnNumber), 0);
  const emptyTurn1 = dedupedEvents.length === 0 && maxTurn <= 1;

  if (!open) {
    // Collapsed spine — 34px wide.
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 34,
          background: "var(--bg-1)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 8,
          zIndex: 20,
        }}
      >
        <button
          aria-label="Open event log (L)"
          title="Log (L)"
          onClick={() => onOpenChange(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-1)",
            fontSize: "1rem",
            writingMode: "vertical-rl",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          ☰
          {unread > 0 && (
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--accent,#4a90d9)",
                color: "#fff",
                fontSize: "0.6rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Expanded rail — 320px, absolutely positioned over right edge.
  return (
    <div
      role="complementary"
      aria-label="Event log"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        background: "var(--bg-1)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          placeholder="🔍 search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: "0.75rem",
            color: "var(--text-0)",
            outline: "none",
            minWidth: 0,
          }}
          aria-label="Search card names"
        />
        <button
          aria-label="Close event log (L)"
          title="Close (L)"
          onClick={() => onOpenChange(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-1)",
            fontSize: "1rem",
            flexShrink: 0,
            minWidth: 24,
            minHeight: 24,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Filter chips */}
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => toggleFilter(f)}
            style={{
              background: activeFilters.has(f) ? "var(--accent,#4a90d9)" : "var(--bg-2)",
              color: activeFilters.has(f) ? "#fff" : "var(--text-1)",
              border: "1px solid var(--border)",
              borderRadius: 9999,
              padding: "2px 8px",
              fontSize: "0.65rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-2)",
              fontSize: "0.65rem",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {loading ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: "0.8rem",
            }}
          >
            Restoring log…
          </div>
        ) : emptyTurn1 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: "0.8rem",
            }}
          >
            The duel has not started.
          </div>
        ) : dedupedEvents.length === 0 && maxTurn > 1 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: "0.8rem",
            }}
          >
            Earlier turns are not available.
          </div>
        ) : visibleEvents.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: "0.8rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span>
              No{" "}
              {activeFilters.size > 0
                ? [...activeFilters].map((f) => FILTER_LABELS[f]).join("/")
                : ""}{" "}
              events this duel.
            </span>
            {activeFilters.size > 0 && (
              <button
                onClick={() => setActiveFilters(new Set())}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  color: "var(--text-1)",
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div style={{ paddingBottom: 12 }}>
            {partial && (
              <div
                style={{
                  borderTop: "1px dashed var(--border)",
                  padding: "4px 10px",
                  textAlign: "center",
                  color: "var(--text-3,#666)",
                  fontSize: "0.65rem",
                }}
              >
                — log resumes here —
              </div>
            )}
            {groups.map((group, gi) => {
              const prevGroup = gi > 0 ? groups[gi - 1] : null;
              const isNewTurn = gi === 0 || prevGroup!.turnNumber !== group.turnNumber;
              const isNewPhase =
                gi === 0 ||
                prevGroup!.phase !== group.phase ||
                prevGroup!.turnNumber !== group.turnNumber;
              const lp = lpByTurn[group.turnNumber];
              const own = isTurnOwn(group);

              return (
                <div key={`${group.turnNumber}-${group.phase}`}>
                  {/* Turn banner */}
                  {isNewTurn && (
                    <div>
                      <div
                        style={{
                          padding: "8px 10px 2px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: own ? "var(--own,#4a90d9)" : "var(--opp,#d94a4a)",
                          borderLeft: `3px solid ${own ? "var(--own,#4a90d9)" : "var(--opp,#d94a4a)"}`,
                          background: "var(--bg-2)",
                        }}
                      >
                        TURN {group.turnNumber} — {turnOwnerName(group)}
                      </div>
                      {/* LP snapshot */}
                      {lp && (
                        <div
                          style={{
                            padding: "2px 13px 6px",
                            fontSize: "0.7rem",
                            color: "var(--text-2)",
                            background: "var(--bg-2)",
                          }}
                        >
                          {playerNames[0]} {lp[0].toLocaleString()} · {playerNames[1]}{" "}
                          {lp[1].toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Phase header */}
                  {isNewPhase && (
                    <div
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.65rem",
                        color: "var(--text-3,#666)",
                        borderTop: "1px solid var(--border)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {PHASE_LABELS[group.phase] ?? `Phase ${group.phase}`}
                    </div>
                  )}
                  {/* Event rows */}
                  {group.events.map((e) => (
                    <LogRow
                      key={e.seq}
                      event={e}
                      mySeat={mySeat}
                      playerNames={playerNames}
                      lookup={lookup}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
