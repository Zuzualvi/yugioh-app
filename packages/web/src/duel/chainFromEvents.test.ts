/**
 * chainFromEvents unit tests — C4 acceptance criterion 1.
 *
 * Covers: single link · three links · CHAIN_SOLVING moving the resolving flag ·
 * CHAIN_SOLVED clearing it · CHAIN_END emptying the chain · a 12-link chain
 * preserving ordinals from the event `link` field, not array position.
 */
import { describe, expect, it } from "vitest";
import { chainFromEvents } from "./chainFromEvents";
import type { DuelEvent } from "@yugioh-app/contracts";

const SEQ = 0; // dummy seq for all events
const TURN = 1;
const PHASE = 4;

function chaining(link: number, code: number, owner: 0 | 1 = 0): DuelEvent {
  return {
    kind: "CHAINING",
    seq: SEQ,
    turnNumber: TURN,
    phase: PHASE,
    card: { code, controller: owner, location: "SZONE", sequence: 0 },
    link,
    owner,
  };
}

function solving(link: number): DuelEvent {
  return { kind: "CHAIN_SOLVING", seq: SEQ, turnNumber: TURN, phase: PHASE, link };
}

function solved(link: number): DuelEvent {
  return { kind: "CHAIN_SOLVED", seq: SEQ, turnNumber: TURN, phase: PHASE, link };
}

function chainEnd(): DuelEvent {
  return { kind: "CHAIN_END", seq: SEQ, turnNumber: TURN, phase: PHASE };
}

describe("chainFromEvents", () => {
  it("single link: appends one ChainLink with correct fields", () => {
    const chain = chainFromEvents([chaining(1, 12345)]);
    expect(chain).toHaveLength(1);
    expect(chain[0]!.link).toBe(1);
    expect(chain[0]!.code).toBe(12345);
    expect(chain[0]!.owner).toBe(0);
    expect(chain[0]!.resolving).toBe(false);
    expect(chain[0]!.name).toBe(""); // name resolved later by cardCache
  });

  it("three links: all three present, ordinals from event link field", () => {
    const chain = chainFromEvents([chaining(1, 100), chaining(2, 200), chaining(3, 300)]);
    expect(chain).toHaveLength(3);
    expect(chain.map((l) => l.link)).toEqual([1, 2, 3]);
    expect(chain.map((l) => l.code)).toEqual([100, 200, 300]);
  });

  it("CHAIN_SOLVING sets resolving on the right link and clears others", () => {
    const events: DuelEvent[] = [chaining(1, 100), chaining(2, 200), chaining(3, 300), solving(2)];
    const chain = chainFromEvents(events);
    expect(chain.find((l) => l.link === 1)!.resolving).toBe(false);
    expect(chain.find((l) => l.link === 2)!.resolving).toBe(true);
    expect(chain.find((l) => l.link === 3)!.resolving).toBe(false);
  });

  it("CHAIN_SOLVING then different link: resolving moves to new link", () => {
    const events: DuelEvent[] = [chaining(1, 100), chaining(2, 200), solving(2), solving(1)];
    const chain = chainFromEvents(events);
    expect(chain.find((l) => l.link === 1)!.resolving).toBe(true);
    expect(chain.find((l) => l.link === 2)!.resolving).toBe(false);
  });

  it("CHAIN_SOLVED clears resolving on that link", () => {
    const events: DuelEvent[] = [chaining(1, 100), chaining(2, 200), solving(2), solved(2)];
    const chain = chainFromEvents(events);
    expect(chain.find((l) => l.link === 2)!.resolving).toBe(false);
  });

  it("CHAIN_END returns empty array", () => {
    const events: DuelEvent[] = [chaining(1, 100), chaining(2, 200), chainEnd()];
    expect(chainFromEvents(events)).toHaveLength(0);
  });

  it("12-link chain: ordinals preserved from event link field, NOT array position", () => {
    // Simulate a chain where events arrive out of order or with non-contiguous link numbers.
    // The chain should preserve the link values from the event, not re-number from array index.
    const evs: DuelEvent[] = [
      chaining(3, 300), // link 3 arrives first
      chaining(7, 700), // link 7
      chaining(1, 100), // link 1 (out of order)
      chaining(5, 500),
      chaining(9, 900),
      chaining(2, 200),
      chaining(4, 400),
      chaining(6, 600),
      chaining(8, 800),
      chaining(10, 1000),
      chaining(11, 1100),
      chaining(12, 1200),
    ];
    const chain = chainFromEvents(evs);
    expect(chain).toHaveLength(12);
    // Each link's .link should match its code / 100 (e.g. code 300 → link 3)
    for (const l of chain) {
      expect(l.link).toBe(l.code / 100);
    }
  });

  it("events unrelated to chain (LP_CHANGE etc.) are ignored", () => {
    const events: DuelEvent[] = [
      chaining(1, 100),
      {
        kind: "LP_CHANGE",
        seq: SEQ,
        turnNumber: TURN,
        phase: PHASE,
        seat: 0,
        delta: -500,
        reason: "damage",
      },
      chaining(2, 200),
    ];
    const chain = chainFromEvents(events);
    expect(chain).toHaveLength(2);
    expect(chain.map((l) => l.link)).toEqual([1, 2]);
  });
});
