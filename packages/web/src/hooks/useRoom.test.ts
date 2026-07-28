// @vitest-environment jsdom
/**
 * useRoom hook tests — socket path, polling fallback, skew correction.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@yugioh-app/contracts";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

function makeSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomId: "r1",
    status: "open",
    closedReason: null,
    closedByUserId: null,
    perMoveSeconds: 300,
    createdAt: 0,
    roomDeadlineAt: Date.now() + 60_000,
    serverNow: Date.now(),
    joinToken: "tok",
    you: {
      role: "creator",
      userId: "u1",
      displayName: "Alice",
      presence: "connected",
      deckSelected: false,
      ready: false,
      deckId: null,
      deckName: null,
      deckCardCount: null,
      deckLocked: false,
    },
    opponent: null,
    flip: null,
    seats: null,
    ...overrides,
  };
}

describe("useRoom — socket path", () => {
  it("enters loading state initially", async () => {
    let onUnavailable: (() => void) | undefined;

    vi.doMock("../api/roomSocket", () => ({
      openRoomSocket: (_id: string, cbs: { onUnavailable?: () => void }) => {
        onUnavailable = cbs.onUnavailable;
        return { close: vi.fn() };
      },
    }));

    const { useRoom } = await import("./useRoom");
    const { result } = renderHook(() => useRoom("room-1"));
    expect(result.current.loading).toBe(true);

    // Prevent dangling timer by triggering unavailable
    act(() => {
      onUnavailable?.();
    });
  });

  it("sets snapshot when socket delivers a ROOM_STATE", async () => {
    const snap = makeSnapshot();
    let onSnapshot: ((s: RoomSnapshot) => void) | undefined;

    vi.doMock("../api/roomSocket", () => ({
      openRoomSocket: (_id: string, cbs: { onSnapshot: (s: RoomSnapshot) => void }) => {
        onSnapshot = cbs.onSnapshot;
        return { close: vi.fn() };
      },
    }));

    const { useRoom } = await import("./useRoom");
    const { result } = renderHook(() => useRoom("room-1"));

    act(() => {
      onSnapshot?.(snap);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot?.roomId).toBe("r1");
    expect(result.current.error).toBeNull();
  });
});

describe("useRoom — polling fallback", () => {
  it("switches to polling when socket reports unavailable and resolves snapshot", async () => {
    const snap = makeSnapshot();
    let onUnavailable: (() => void) | undefined;

    vi.doMock("../api/roomSocket", () => ({
      openRoomSocket: (_id: string, cbs: { onUnavailable?: () => void }) => {
        onUnavailable = cbs.onUnavailable;
        return { close: vi.fn() };
      },
    }));
    vi.doMock("../api/room", () => ({
      getRoomSnapshot: vi.fn().mockResolvedValue(snap),
    }));

    const { useRoom } = await import("./useRoom");
    const { result } = renderHook(() => useRoom("room-1"));

    // Trigger socket unavailable → switches to polling
    act(() => {
      onUnavailable?.();
    });

    await waitFor(
      () => {
        expect(result.current.snapshot?.roomId).toBe("r1");
      },
      { timeout: 3000 },
    );
  }, 5000);
});

describe("useRoom — no roomId", () => {
  it("returns loading=false when roomId is undefined", async () => {
    vi.doMock("../api/roomSocket", () => ({
      openRoomSocket: vi.fn().mockReturnValue({ close: vi.fn() }),
    }));
    const { useRoom } = await import("./useRoom");
    const { result } = renderHook(() => useRoom(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot).toBeNull();
  });
});
