/**
 * Mock duel session — emits a scripted DuelServerMessage stream using
 * the Phase 2 typed DECISION / DECISION_RESPONSE wire contract.
 *
 * Exercises a representative sequence:
 *   1. IdleCommand (main phase — summon or end)
 *   2. ChainPrompt (opponent priority window)
 *   3. BattleCommand (battle phase — attack or end)
 *   4. SelectEffectYN (opponent asks yes/no)
 *   5. SelectYesNo (player)
 *   6. SelectOption (player)
 *   7. State update with LP damage
 *   8. SelectCard (opponent)
 *   9. DUEL_END
 *
 * Usage (DuelScreen dev mode / tests):
 *   const session = createMockDuelSession(seat, onMessage);
 *   session.start();
 *   session.respond(r);   // DuelDecisionResponse — advances script
 *   session.stop();
 */

import type {
  DuelDecisionResponse,
  DuelServerMessage,
  DuelStateSnapshot,
  Seat,
} from "@yugioh-app/contracts";

export interface MockDuelSession {
  start: () => void;
  respond: (response: DuelDecisionResponse) => void;
  stop: () => void;
}

const PHASE_DRAW = 1;
const PHASE_MAIN1 = 4;
const PHASE_BATTLE = 8;

function makeSnapshot(overrides?: Partial<DuelStateSnapshot>): DuelStateSnapshot {
  return {
    seat: 0,
    duelEnded: false,
    currentTurn: 0,
    currentPhase: PHASE_MAIN1,
    lp: [8000, 8000],
    zones: {
      p0_hand: [
        { code: 46986414, position: 0 }, // Dark Magician
        { code: 89631139, position: 0 }, // Blue-Eyes
        { code: 14558127, position: 0 }, // Stardust
      ],
      p1_hand: [
        { code: 0, position: 0 },
        { code: 0, position: 0 },
        { code: 0, position: 0 },
        { code: 0, position: 0 },
      ],
      p0_mzone: [],
      p1_mzone: [],
      p0_szone: [],
      p1_szone: [],
      p0_grave: [],
      p1_grave: [],
      p0_removed: [],
      p1_removed: [],
      p0_extra: [{ code: 14558127, position: 0 }],
      p1_extra: [],
    },
    ...overrides,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockDuelSession(
  seat: Seat,
  onMessage: (msg: DuelServerMessage) => void,
): MockDuelSession {
  let stopped = false;
  let stepResolve: (() => void) | null = null;

  function waitForResponse(): Promise<void> {
    return new Promise((resolve) => {
      stepResolve = resolve;
    });
  }

  async function runScript() {
    // ── Initial state ────────────────────────────────────────────────────────
    onMessage({ type: "SEAT_ASSIGNED", seat, seatToken: "mock-seat-token" });
    await delay(50);

    const snap = makeSnapshot({ seat });
    onMessage({ type: "STATE", state: snap });
    await delay(100);

    onMessage({ type: "CLOCK", onClockSeat: 0, deadlineAt: Date.now() + 90_000 });
    await delay(200);

    if (stopped) return;

    // ── Decision 1: IdleCommand (seat 0 — Main Phase 1) ─────────────────────
    if (seat === 0) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "IdleCommand",
          player: 0,
          summons: [
            {
              code: 46986414,
              name: "Dark Magician",
              controller: 0,
              location: "HAND",
              sequence: 0,
            },
            {
              code: 89631139,
              name: "Blue-Eyes White Dragon",
              controller: 0,
              location: "HAND",
              sequence: 1,
            },
          ],
          specialSummons: [],
          posChanges: [],
          monsterSets: [
            {
              code: 89631139,
              name: "Blue-Eyes White Dragon",
              controller: 0,
              location: "HAND",
              sequence: 1,
            },
          ],
          spellSets: [],
          activates: [],
          toBattlePhase: false,
          toEndPhase: true,
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(500);
    }

    // ── State: Dark Magician summoned ────────────────────────────────────────
    const snap2 = makeSnapshot({
      seat,
      currentPhase: PHASE_MAIN1,
      lp: [8000, 8000],
      zones: {
        ...snap.zones,
        p0_hand: [
          { code: 89631139, position: 0 },
          { code: 14558127, position: 0 },
        ],
        p0_mzone: [{ code: 46986414, position: 0x2 }],
      },
    });
    onMessage({ type: "STATE", state: snap2 });
    await delay(100);

    if (stopped) return;

    // ── Decision 2: ChainPrompt (seat 1 — priority window) ──────────────────
    if (seat === 1) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "ChainPrompt",
          player: 1,
          forced: false,
          selects: [
            {
              code: 29401950,
              name: "Bottomless Trap Hole",
              controller: 1,
              location: "SZONE",
              sequence: 0,
              description: "Activate to destroy the summoned monster",
            },
            {
              code: 53582587,
              name: "Torrential Tribute",
              controller: 1,
              location: "SZONE",
              sequence: 1,
              description: "Activate to destroy all monsters",
            },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Clock resets + advance to Battle Phase ───────────────────────────────
    onMessage({ type: "CLOCK", onClockSeat: 0, deadlineAt: Date.now() + 90_000 });

    const snap3 = makeSnapshot({
      seat,
      currentTurn: 0,
      currentPhase: PHASE_BATTLE,
      lp: [8000, 8000],
      zones: snap2.zones,
    });
    onMessage({ type: "STATE", state: snap3 });
    await delay(100);

    if (stopped) return;

    // ── Decision 3: BattleCommand (seat 0) ───────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "BattleCommand",
          player: 0,
          chains: [],
          attacks: [
            {
              code: 46986414,
              name: "Dark Magician",
              controller: 0,
              location: "MZONE",
              sequence: 0,
              canDirectAttack: true,
            },
          ],
          toMainPhase2: true,
          toEndPhase: false,
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Decision 4: SelectEffectYN (seat 1) ──────────────────────────────────
    if (seat === 1) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "SelectEffectYN",
          player: 1,
          card: {
            code: 77414722,
            name: "Mirror Force",
            controller: 1,
            location: "SZONE",
            sequence: 0,
          },
          description: "Activate Mirror Force to destroy all attacking monsters?",
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Decision 5: SelectYesNo (seat 0) ─────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "SelectYesNo",
          player: 0,
          description: "Chain Solemn Judgment to negate Mirror Force?",
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── Decision 6: SelectOption (seat 0) ────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "SelectOption",
          player: 0,
          options: ["Effect (1): Draw 2 cards", "Effect (2): Special Summon from GY"],
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── LP damage + state ─────────────────────────────────────────────────────
    const snap4 = makeSnapshot({
      seat,
      currentTurn: 1,
      currentPhase: PHASE_DRAW,
      lp: [8000, 5500],
      zones: {
        ...snap2.zones,
        p1_grave: [{ code: 46986414, position: 0 }],
      },
    });
    onMessage({ type: "STATE", state: snap4 });
    await delay(200);

    if (stopped) return;

    // ── Decision 7: SelectCard (seat 1) ──────────────────────────────────────
    if (seat === 1) {
      onMessage({
        type: "DECISION",
        decision: {
          kind: "SelectCard",
          player: 1,
          cards: [
            {
              code: 29401950,
              name: "Bottomless Trap Hole",
              controller: 1,
              location: "HAND",
              sequence: 0,
            },
            {
              code: 53582587,
              name: "Torrential Tribute",
              controller: 1,
              location: "HAND",
              sequence: 1,
            },
          ],
          min: 1,
          max: 1,
          cancelable: false,
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── DUEL_END ──────────────────────────────────────────────────────────────
    await delay(400);
    if (!stopped) {
      onMessage({ type: "DUEL_END", winner: 0, reason: "normal" });
    }
  }

  return {
    start() {
      stopped = false;
      void runScript();
    },
    respond(_response: DuelDecisionResponse) {
      if (stepResolve) {
        const resolve = stepResolve;
        stepResolve = null;
        resolve();
      }
    },
    stop() {
      stopped = true;
      if (stepResolve) {
        stepResolve();
        stepResolve = null;
      }
    },
  };
}
