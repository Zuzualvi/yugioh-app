/**
 * FieldGroup — one player's field: 5 MZONE + 5 SZONE + 1 FZONE + 4 pile badges.
 *
 * Dense arrays: index === sequence (MH-1 guarantee). No filtering of nulls.
 * The shim that collapsed nulls is deleted — nulls are empty zones, not missing ones.
 *
 * Layout (design spec §2, §1):
 *   [BAN][GY][FZ]  S S S S S  [EX][DECK]
 *                  M M M M M
 */
import React from "react";
import type { ZoneCard, Seat } from "@yugioh-app/contracts";
import type { CardRef, InspectorControl } from "../../../duel/contracts";
import { ZoneSlot } from "./ZoneSlot";
import { PileBadge } from "./PileBadge";

interface Props {
  controller: Seat;
  mySeat: Seat;

  // Dense arrays — index === sequence, nulls are empty zones
  mzone: (ZoneCard | null)[];
  szone: (ZoneCard | null)[];
  fzone: ZoneCard | null | undefined;

  grave: ZoneCard[];
  removed: ZoneCard[];
  extra: ZoneCard[];
  deckCount: number | undefined;

  /** Candidates of the pending decision (dim law + border highlight) */
  candidates: CardRef[];
  /** Cards selected for the pending decision */
  selected: CardRef[];
  /** Monsters absent from attacks[] during BP */
  spentAttackers: CardRef[];
  /** Cards the player can legally act on right now */
  actionableCards: CardRef[];

  inspector: InspectorControl;
  onCardClick: (ref: CardRef, rect: DOMRect) => void;

  /** Flip layout for opponent (zone rows appear from top to bottom in reverse) */
  flipped?: boolean;
}

function sameRef(a: CardRef, b: CardRef): boolean {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence;
}

function hasRef(refs: CardRef[], ref: CardRef): boolean {
  return refs.some((r) => sameRef(r, ref));
}

export function FieldGroup({
  controller,
  mySeat,
  mzone,
  szone,
  fzone,
  grave,
  removed,
  extra,
  deckCount,
  candidates,
  selected,
  spentAttackers,
  actionableCards,
  inspector,
  onCardClick,
  flipped,
}: Props) {
  const isOwn = controller === mySeat;
  const ownerColor = isOwn ? "var(--own)" : "var(--opp)";

  function makeRef(location: CardRef["location"], sequence: number): CardRef {
    return { controller, location, sequence };
  }

  // Pile badge candidates check
  function isPileCandidate(location: "GRAVE" | "REMOVED" | "EXTRA" | "DECK"): boolean {
    return candidates.some((c) => c.controller === controller && c.location === location);
  }

  const pileRow = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        justifyContent: "space-between",
      }}
    >
      {/* Left side: BAN, GY, FZ (field zone) */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <PileBadge
          label="BAN"
          count={removed.length}
          controller={controller}
          location="REMOVED"
          isOwn={isOwn}
          inspector={inspector}
          isCandidate={isPileCandidate("REMOVED")}
        />
        <PileBadge
          label="GY"
          count={grave.length}
          controller={controller}
          location="GRAVE"
          isOwn={isOwn}
          inspector={inspector}
          isCandidate={isPileCandidate("GRAVE")}
        />
        {/* Field zone — renders as a small slot */}
        <div
          data-testid={`fzone-${controller}`}
          style={{
            width: 34,
            height: 48,
            border: `1px solid ${ownerColor}`,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: fzone ? 1 : 0.4,
            fontSize: "0.625rem",
            color: ownerColor,
            background: "var(--bg-2)",
            flexShrink: 0,
          }}
          aria-label={`${isOwn ? "Your" : "Opponent"} field zone${fzone ? "" : " (empty)"}`}
        >
          {fzone ? (
            <img
              data-testid="face-up-card"
              src={`/images/${fzone.code}.jpg`}
              alt=""
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2 }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            "FZ"
          )}
        </div>
      </div>

      {/* Spell/Trap row — 5 slots */}
      <div style={{ display: "flex", gap: 3 }}>
        {szone.slice(0, 5).map((card, idx) => {
          const ref = makeRef("SZONE", idx);
          return (
            <ZoneSlot
              key={idx}
              card={card}
              sequence={idx}
              controller={controller}
              location="SZONE"
              mySeat={mySeat}
              actionable={hasRef(actionableCards, ref)}
              isCandidate={hasRef(candidates, ref)}
              isSelected={hasRef(selected, ref)}
              onClick={onCardClick}
            />
          );
        })}
      </div>

      {/* Right side: EX, DECK */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <PileBadge
          label="EX"
          count={extra.length}
          controller={controller}
          location="EXTRA"
          isOwn={isOwn}
          inspector={inspector}
          isCandidate={isPileCandidate("EXTRA")}
        />
        <PileBadge
          label="DECK"
          count={deckCount ?? 0}
          controller={controller}
          location="DECK"
          isOwn={isOwn}
          inspector={inspector}
          isCandidate={isPileCandidate("DECK")}
        />
      </div>
    </div>
  );

  const monsterRow = (
    <div
      data-testid={isOwn ? "my-mzone" : undefined}
      style={{ display: "flex", gap: 3, justifyContent: "center" }}
    >
      {mzone.slice(0, 5).map((card, idx) => {
        const ref = makeRef("MZONE", idx);
        const isSpent = hasRef(spentAttackers, ref);
        return (
          <ZoneSlot
            key={idx}
            card={card}
            sequence={idx}
            controller={controller}
            location="MZONE"
            mySeat={mySeat}
            actionable={hasRef(actionableCards, ref)}
            isCandidate={hasRef(candidates, ref)}
            isSelected={hasRef(selected, ref)}
            spent={card && card.position & 0x1 ? isSpent : undefined}
            onClick={onCardClick}
          />
        );
      })}
    </div>
  );

  return (
    <div
      data-testid={`field-group-${controller}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "6px 8px",
        background: "var(--bg-1)",
        border: `1px solid ${ownerColor}`,
        borderRadius: 8,
      }}
    >
      {/* For opponent (flipped), pile row is on top, monster row below.
          For own player, monster row is on top, pile row below. */}
      {flipped ? (
        <>
          {pileRow}
          {monsterRow}
        </>
      ) : (
        <>
          {monsterRow}
          {pileRow}
        </>
      )}
    </div>
  );
}
