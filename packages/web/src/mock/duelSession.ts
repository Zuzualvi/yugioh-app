/**
 * Mock duel session — emits a scripted DuelServerMessage stream.
 *
 * Models the real per-seat redacted message stream documented in the spike-c
 * relay README.  This drives end-to-end testing of the duel board + action
 * panel without a real server.
 *
 * Usage (in DuelScreen dev mode / tests):
 *   const session = createMockDuelSession(seat, onMessage);
 *   session.start();       // begins emitting messages
 *   session.respond(r);    // simulate sending a RESPONSE
 *   session.stop();        // clean up
 */

import type { DuelServerMessage, DuelStateSnapshot, Seat } from "@yugioh-app/contracts";

export interface MockDuelSession {
  start: () => void;
  respond: (value: number | string | null) => void;
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
        { code: 0, position: 0 }, // hidden (face-down to us)
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
      p0_extra: [
        { code: 14558127, position: 0 }, // Stardust Dragon (extra deck)
      ],
      p1_extra: [],
    },
    ...overrides,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock duel session for the given seat.
 * Emits a scripted stream of DuelServerMessages that exercises every decision
 * type the action panel must render.
 */
export function createMockDuelSession(
  seat: Seat,
  onMessage: (msg: DuelServerMessage) => void,
): MockDuelSession {
  let stopped = false;
  // step index advances when respond() is called
  let stepResolve: (() => void) | null = null;

  function waitForResponse(): Promise<void> {
    return new Promise((resolve) => {
      stepResolve = resolve;
    });
  }

  async function runScript() {
    // ── Initial state snapshot ──────────────────────────────────────────────
    onMessage({ type: "SEAT_ASSIGNED", seat, seatToken: "mock-seat-token" });
    await delay(50);

    const snap = makeSnapshot({ seat });
    onMessage({ type: "STATE", state: snap });
    await delay(100);

    // ── Clock: seat 0 is on the clock, 90s deadline ─────────────────────────
    const deadline = Date.now() + 90_000;
    onMessage({ type: "CLOCK", onClockSeat: 0, deadlineAt: deadline });
    await delay(200);

    if (stopped) return;

    // ── Decision 1: SELECT_IDLECMD (Main Phase 1 — seat 0's turn) ───────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_IDLECMD",
          engineType: 11,
          player: 0,
          options: [
            { label: "Normal Summon Dark Magician", index: 0 },
            { label: "Set Blue-Eyes White Dragon", index: 1 },
            { label: "Activate — (no spell in hand)", index: 2 },
            { label: "End Phase", index: 3 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      // opponent's turn — seat 1 just waits
      await delay(500);
    }

    // ── State update: Dark Magician normal summoned ──────────────────────────
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
        p0_mzone: [{ code: 46986414, position: 0x2 }], // ATK position
      },
    });
    onMessage({ type: "STATE", state: snap2 });
    await delay(100);

    if (stopped) return;

    // ── Decision 2: SELECT_CHAIN (priority window for opponent) ─────────────
    if (seat === 1) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_CHAIN",
          engineType: 22,
          player: 1,
          question: "Respond to the Normal Summon of Dark Magician?",
          canPass: true,
          options: [
            { label: "Activate Bottomless Trap Hole", index: 0 },
            { label: "Activate Torrential Tribute", index: 1 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Clock resets for seat 0: Battle Phase ────────────────────────────────
    const deadline2 = Date.now() + 90_000;
    onMessage({ type: "CLOCK", onClockSeat: 0, deadlineAt: deadline2 });

    // Advance to Battle Phase
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

    // ── Decision 3: SELECT_BATTLECMD ─────────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_BATTLECMD",
          engineType: 12,
          player: 0,
          options: [
            { label: "Attack with Dark Magician (2500 ATK)", index: 0 },
            { label: "End Battle Phase", index: 1 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Decision 4: SELECT_EFFECTYN (opponent prompt on opponent's turn) ──────
    if (seat === 1) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_EFFECTYN",
          engineType: 24,
          player: 1,
          question: "Activate Mirror Force?",
        },
      });
      await waitForResponse();
      if (stopped) return;
    } else {
      await delay(300);
    }

    // ── Decision 5: SELECT_YESNO ──────────────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_YESNO",
          engineType: 25,
          player: 0,
          question: "Send Stardust Dragon from Extra Deck for Synchro Summon?",
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── Decision 6: SELECT_OPTION ─────────────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_OPTION",
          engineType: 30,
          player: 0,
          hint: "Select an effect to activate:",
          options: [
            { label: "Effect (1): Add to hand", index: 0 },
            { label: "Effect (2): Special Summon", index: 1 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── Decision 7: SELECT_POSITION ───────────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_POSITION",
          engineType: 26,
          player: 0,
          positions: [
            { label: "Attack Position", value: 0x2 },
            { label: "Defense Position (face-up)", value: 0x4 },
            { label: "Defense Position (face-down)", value: 0x8 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── Decision 8: ANNOUNCE_ATTRIB ───────────────────────────────────────────
    if (seat === 0) {
      onMessage({
        type: "MSG",
        msg: {
          name: "ANNOUNCE_ATTRIB",
          engineType: 40,
          player: 0,
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── LP damage and state ───────────────────────────────────────────────────
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

    // ── SELECT_CARD example ───────────────────────────────────────────────────
    if (seat === 1) {
      onMessage({
        type: "MSG",
        msg: {
          name: "SELECT_CARD",
          engineType: 15,
          player: 1,
          hint: "Select a card to discard:",
          cards: [
            { name: "Bottomless Trap Hole", code: 29401950, index: 0 },
            { name: "Torrential Tribute", code: 53582587, index: 1 },
          ],
        },
      });
      await waitForResponse();
      if (stopped) return;
    }

    // ── DUEL_END ──────────────────────────────────────────────────────────────
    await delay(400);
    if (!stopped) {
      onMessage({
        type: "DUEL_END",
        winner: 0,
        reason: "normal",
      });
    }
  }

  return {
    start() {
      stopped = false;
      void runScript();
    },
    respond(_value: number | string | null) {
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
