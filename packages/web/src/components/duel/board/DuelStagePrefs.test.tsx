// @vitest-environment jsdom
/**
 * DuelStagePrefs tests — C1(b) acceptance criteria.
 *
 * 5. DuelStage accepts chooseZones as a prop and passes { chooseZones } through
 *    to useDuelInteraction; rendering with true vs false results in different
 *    values reaching the hook.
 * 6. DuelScreen passes settings.chooseZones into DuelStage — asserted by a
 *    structural render test that intercepts DuelStage and reads the prop.
 */
import React from "react";
import { cleanup, render, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuelStateSnapshot } from "@yugioh-app/contracts";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock("../../DuelBoard", () => ({
  DuelBoard: () => React.createElement("div", { "data-testid": "mock-duel-board" }),
}));
vi.mock("../chrome/DimScrim", () => ({
  DimScrim: () => null,
}));
vi.mock("../chrome/PhaseRail", () => ({
  PhaseRail: () => React.createElement("div", { "data-testid": "mock-phase-rail" }),
}));
vi.mock("../dock/DuelDock", () => ({
  DuelDock: () => React.createElement("div", { "data-testid": "duel-dock" }),
}));
vi.mock("../inspect/CardInspector", () => ({
  CardInspector: () => null,
}));
vi.mock("../inspect/PileInspector", () => ({
  PileInspector: () => null,
}));
vi.mock("../WaitBanner", () => ({
  WaitBanner: () => null,
}));
vi.mock("../../../duel/cardCache", () => ({
  createCardCache: () => ({ get: () => null, isLoading: () => false, prefetch: () => {} }),
}));

function makeState(overrides: Partial<DuelStateSnapshot> = {}): DuelStateSnapshot {
  return {
    seat: 0,
    duelEnded: false,
    currentTurn: 0,
    currentPhase: 4,
    lp: [8000, 8000],
    zones: {
      p0_hand: [],
      p1_hand: [],
      p0_mzone: [],
      p1_mzone: [],
      p0_szone: [],
      p1_szone: [],
      p0_grave: [],
      p1_grave: [],
      p0_removed: [],
      p1_removed: [],
      p0_extra: [],
      p1_extra: [],
    },
    turnNumber: 1,
    ...overrides,
  };
}

const baseStageProps = {
  mySeat: 0 as const,
  clock: null,
  events: [],
  decision: null,
  respond: vi.fn(),
  connection: "open" as const,
  promptLevel: "Standard" as const,
};

// ── Criterion 5: chooseZones prop reaches useDuelInteraction ─────────────────

describe("DuelStage — chooseZones prop wiring to useDuelInteraction", () => {
  it("passes chooseZones=true to useDuelInteraction when prop is true", async () => {
    const capturedPrefs: Array<{ chooseZones: boolean }> = [];

    vi.doMock("../../../duel/useDuelInteraction", () => ({
      useDuelInteraction: (input: { prefs: { chooseZones: boolean } }) => {
        capturedPrefs.push({ chooseZones: input.prefs.chooseZones });
        return {
          mode: "waiting" as const,
          decision: null,
          candidates: [],
          selection: [],
          intent: null,
          chain: [],
          receipts: [],
          status: null,
          prefs: input.prefs,
          setPrefs: vi.fn(),
          toggleSelection: vi.fn(),
          confirm: vi.fn(),
          decline: vi.fn(),
          cancelIntent: vi.fn(),
        };
      },
    }));

    const { DuelStage } = await import("./DuelStage");
    render(
      React.createElement(DuelStage, {
        ...baseStageProps,
        state: makeState(),
        chooseZones: true,
      }),
    );

    expect(capturedPrefs.length).toBeGreaterThan(0);
    expect(capturedPrefs[0]!.chooseZones).toBe(true);
  });

  it("passes chooseZones=false to useDuelInteraction when prop is false", async () => {
    const capturedPrefs: Array<{ chooseZones: boolean }> = [];

    vi.doMock("../../../duel/useDuelInteraction", () => ({
      useDuelInteraction: (input: { prefs: { chooseZones: boolean } }) => {
        capturedPrefs.push({ chooseZones: input.prefs.chooseZones });
        return {
          mode: "waiting" as const,
          decision: null,
          candidates: [],
          selection: [],
          intent: null,
          chain: [],
          receipts: [],
          status: null,
          prefs: input.prefs,
          setPrefs: vi.fn(),
          toggleSelection: vi.fn(),
          confirm: vi.fn(),
          decline: vi.fn(),
          cancelIntent: vi.fn(),
        };
      },
    }));

    const { DuelStage } = await import("./DuelStage");
    render(
      React.createElement(DuelStage, {
        ...baseStageProps,
        state: makeState(),
        chooseZones: false,
      }),
    );

    expect(capturedPrefs.length).toBeGreaterThan(0);
    expect(capturedPrefs[0]!.chooseZones).toBe(false);
  });

  it("value reaching useDuelInteraction differs between chooseZones=true and false", async () => {
    const allCaptured: boolean[] = [];

    vi.doMock("../../../duel/useDuelInteraction", () => ({
      useDuelInteraction: (input: { prefs: { chooseZones: boolean } }) => {
        allCaptured.push(input.prefs.chooseZones);
        return {
          mode: "waiting" as const,
          decision: null,
          candidates: [],
          selection: [],
          intent: null,
          chain: [],
          receipts: [],
          status: null,
          prefs: input.prefs,
          setPrefs: vi.fn(),
          toggleSelection: vi.fn(),
          confirm: vi.fn(),
          decline: vi.fn(),
          cancelIntent: vi.fn(),
        };
      },
    }));

    const { DuelStage } = await import("./DuelStage");

    render(
      React.createElement(DuelStage, {
        ...baseStageProps,
        state: makeState(),
        chooseZones: true,
      }),
    );
    cleanup();

    render(
      React.createElement(DuelStage, {
        ...baseStageProps,
        state: makeState(),
        chooseZones: false,
      }),
    );

    expect(allCaptured).toContain(true);
    expect(allCaptured).toContain(false);
  });
});

// ── Criterion 6: DuelScreen passes settings.chooseZones to DuelStage ─────────
//
// Strategy: mock DuelStage to capture props, mock createMockDuelSession to fire
// synchronously (no delays), render DuelScreen with useMock:true, and assert
// DuelStage receives chooseZones from settings (default false).

describe("DuelScreen — settings.chooseZones wires to DuelStage", () => {
  it("passes settings.chooseZones to DuelStage as a prop", async () => {
    const stagePropsCapture: Array<{ chooseZones: boolean | undefined }> = [];

    // Intercept DuelStage to capture props
    vi.doMock("./DuelStage", () => ({
      DuelStage: (props: { chooseZones?: boolean }) => {
        stagePropsCapture.push({ chooseZones: props.chooseZones });
        return React.createElement("div", { "data-testid": "mock-stage" });
      },
    }));

    // Synchronous mock session — fires STATE immediately without delays
    vi.doMock("../../../mock/duelSession", () => ({
      createMockDuelSession: (seat: number, onMessage: (msg: unknown) => void) => ({
        start: () => {
          onMessage({ type: "SEAT_ASSIGNED", seat, seatToken: "tok" });
          onMessage({
            type: "STATE",
            state: makeState({ seat: seat as 0 | 1 }),
          });
        },
        respond: vi.fn(),
        stop: vi.fn(),
      }),
    }));

    // Router mocks
    vi.doMock("react-router-dom", () => ({
      useParams: () => ({ duelId: "duel-test" }),
      useLocation: () => ({ state: { useMock: true, seat: 0 } }),
      useNavigate: () => vi.fn(),
    }));

    // Stub other DuelScreen deps
    vi.doMock("../../../components/duel/chrome/DuelTopBar", () => ({
      DuelTopBar: () => null,
    }));
    vi.doMock("../../../api/duelSocket", () => ({
      openDuelSocket: () => ({ send: vi.fn(), close: vi.fn() }),
    }));
    vi.doMock("../../../api/room", () => ({
      getSeatCredential: () => Promise.resolve({ seatToken: "tok", seat: 0 }),
    }));
    vi.doMock("../../../components/duel/log/EventLogRail", () => ({
      EventLogRail: () => null,
    }));
    vi.doMock("../../../components/duel/DuelEndOverlay", () => ({
      DuelEndOverlay: () => null,
    }));
    vi.doMock("../../../duel/cardCache", () => ({
      createCardCache: () => ({ get: () => null, isLoading: () => false }),
    }));

    const { DuelScreen } = await import("../../../screens/DuelScreen");

    await act(async () => {
      render(React.createElement(DuelScreen));
    });

    // DuelStage must have been rendered (state was set synchronously by mock session)
    expect(stagePropsCapture.length).toBeGreaterThan(0);
    // chooseZones must be passed (not undefined) — settings.chooseZones defaults to false
    const lastCapture = stagePropsCapture[stagePropsCapture.length - 1]!;
    expect(lastCapture.chooseZones).not.toBeUndefined();
    expect(lastCapture.chooseZones).toBe(false); // default settings value
  });
});
