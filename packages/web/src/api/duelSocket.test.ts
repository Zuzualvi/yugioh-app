/**
 * Tests for duelSocket — parse/round-trip of DuelServerMessage / DuelClientMessage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DuelClientMessage, DuelServerMessage } from "@yugioh-app/contracts";

// ── Fake WebSocket ────────────────────────────────────────────────────────────

interface FakeWsInstance {
  readyState: number;
  sentMessages: string[];
  listeners: Record<string, ((e: unknown) => void)[]>;
  triggerMessage: (data: unknown) => void;
  triggerOpen: () => void;
  triggerClose: (code?: number) => void;
  close: (code?: number) => void;
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
}

let fakeWsInstance: FakeWsInstance;

vi.mock("../api/duelSocket", async (importOriginal) => {
  // We need the real module but with WebSocket mocked.
  // Instead, we test the module after patching globalThis.WebSocket.
  return importOriginal();
});

function makeFakeWebSocket() {
  const instance: FakeWsInstance = {
    readyState: 0, // CONNECTING
    sentMessages: [],
    listeners: {},
    triggerMessage(data: unknown) {
      const serialized = typeof data === "string" ? data : JSON.stringify(data);
      (this.listeners["message"] ?? []).forEach((h) =>
        h({ data: serialized }),
      );
    },
    triggerOpen() {
      this.readyState = 1; // OPEN
      (this.listeners["open"] ?? []).forEach((h) => h({}));
    },
    triggerClose(code = 1000) {
      this.readyState = 3; // CLOSED
      (this.listeners["close"] ?? []).forEach((h) => h({ code }));
    },
    close(_code?: number) {
      this.readyState = 3;
    },
    send(data: string) {
      this.sentMessages.push(data);
    },
    addEventListener(event: string, handler: (e: unknown) => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
  };
  fakeWsInstance = instance;
  return instance;
}

// Patch global WebSocket before tests
beforeEach(() => {
  // @ts-expect-error patching global
  globalThis.WebSocket = vi.fn().mockImplementation(() => makeFakeWebSocket());
  // @ts-expect-error static
  globalThis.WebSocket.OPEN = 1;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openDuelSocket — message parsing", () => {
  it("parses a valid STATE message and calls onMessage", async () => {
    const { openDuelSocket } = await import("./duelSocket");

    const received: DuelServerMessage[] = [];
    const socket = openDuelSocket("duel-1", "token-abc", {
      onMessage: (m) => received.push(m),
    });

    fakeWsInstance.triggerOpen();

    const stateMsg: DuelServerMessage = {
      type: "STATE",
      state: {
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
      },
    };

    fakeWsInstance.triggerMessage(stateMsg);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "STATE" });
    socket.close();
  });

  it("parses a CLOCK message", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const received: DuelServerMessage[] = [];
    const socket = openDuelSocket("d1", "t1", { onMessage: (m) => received.push(m) });
    fakeWsInstance.triggerOpen();

    fakeWsInstance.triggerMessage({
      type: "CLOCK",
      onClockSeat: 1,
      deadlineAt: Date.now() + 60000,
    });

    expect(received[0]).toMatchObject({ type: "CLOCK", onClockSeat: 1 });
    socket.close();
  });

  it("parses a DUEL_END message with timeout reason", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const received: DuelServerMessage[] = [];
    const socket = openDuelSocket("d1", "t1", { onMessage: (m) => received.push(m) });
    fakeWsInstance.triggerOpen();

    fakeWsInstance.triggerMessage({
      type: "DUEL_END",
      winner: 0,
      reason: "timeout",
    });

    expect(received[0]).toMatchObject({ type: "DUEL_END", reason: "timeout" });
    socket.close();
  });

  it("silently drops frames that fail Zod parsing", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const received: DuelServerMessage[] = [];
    const socket = openDuelSocket("d1", "t1", { onMessage: (m) => received.push(m) });
    fakeWsInstance.triggerOpen();

    fakeWsInstance.triggerMessage({ type: "UNKNOWN_TYPE", garbage: true });

    expect(received).toHaveLength(0);
    socket.close();
  });

  it("silently drops non-JSON frames", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const received: DuelServerMessage[] = [];
    const socket = openDuelSocket("d1", "t1", { onMessage: (m) => received.push(m) });
    fakeWsInstance.triggerOpen();

    // send raw string directly
    (fakeWsInstance.listeners["message"] ?? []).forEach((h) =>
      h({ data: "not-json!!!" }),
    );

    expect(received).toHaveLength(0);
    socket.close();
  });
});

describe("openDuelSocket — send round-trip", () => {
  it("sends a RESPONSE message as JSON", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const socket = openDuelSocket("d1", "t1", { onMessage: () => {} });
    fakeWsInstance.triggerOpen();

    const msg: DuelClientMessage = { type: "RESPONSE", response: { type: 1, value: 2 } };
    socket.send(msg);

    expect(fakeWsInstance.sentMessages).toHaveLength(1);
    const raw0 = fakeWsInstance.sentMessages[0];
    if (!raw0) throw new Error("No sent message");
    const parsed = JSON.parse(raw0) as DuelClientMessage;
    expect(parsed).toMatchObject({ type: "RESPONSE", response: { type: 1, value: 2 } });
    socket.close();
  });

  it("sends a RESIGN message", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const socket = openDuelSocket("d1", "t1", { onMessage: () => {} });
    fakeWsInstance.triggerOpen();

    const msg: DuelClientMessage = { type: "RESIGN" };
    socket.send(msg);

    const raw0 = fakeWsInstance.sentMessages[0];
    if (!raw0) throw new Error("No sent message");
    const parsed = JSON.parse(raw0) as DuelClientMessage;
    expect(parsed).toMatchObject({ type: "RESIGN" });
    socket.close();
  });

  it("does not send when socket is not open", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const socket = openDuelSocket("d1", "t1", { onMessage: () => {} });
    // Not triggering open — readyState stays 0

    socket.send({ type: "RESIGN" });
    expect(fakeWsInstance.sentMessages).toHaveLength(0);
    socket.close();
  });
});

describe("openDuelSocket — reconnect", () => {
  it("calls onOpen callback", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const onOpen = vi.fn();
    const socket = openDuelSocket("d1", "t1", { onMessage: () => {}, onOpen });
    fakeWsInstance.triggerOpen();
    expect(onOpen).toHaveBeenCalledOnce();
    socket.close();
  });

  it("calls onClose callback", async () => {
    const { openDuelSocket } = await import("./duelSocket");
    const onClose = vi.fn();
    const socket = openDuelSocket("d1", "t1", { onMessage: () => {}, onClose });
    fakeWsInstance.triggerOpen();
    socket.close(); // triggers close with code 1000
    fakeWsInstance.triggerClose(1000);
    expect(onClose).toHaveBeenCalled();
  });
});
