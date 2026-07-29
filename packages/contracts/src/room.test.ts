import { describe, expect, it } from "vitest";
import {
  RoomStatusSchema,
  RoomClosedReasonSchema,
  RoomPresenceSchema,
  OccupantRoleSchema,
  SeatChoiceSchema,
  RoomSnapshotSchema,
  RoomServerMessageSchema,
  PreJoinRoomInfoSchema,
  CreateRoomBodySchema,
  CreateRoomResultSchema,
  SeatCredentialSchema,
} from "./room.js";

describe("RoomStatusSchema", () => {
  it("accepts all five statuses", () => {
    for (const s of ["open", "filled", "awaiting_choice", "starting", "closed"]) {
      expect(RoomStatusSchema.safeParse(s).success).toBe(true);
    }
  });
  it("rejects unknown status", () => {
    expect(RoomStatusSchema.safeParse("pending").success).toBe(false);
  });
});

describe("RoomClosedReasonSchema", () => {
  const reasons = [
    "left",
    "expired_unclaimed",
    "expired_idle",
    "expired_ready",
    "expired_choice",
    "engine_failed",
  ];
  it("accepts all closed reasons", () => {
    for (const r of reasons) {
      expect(RoomClosedReasonSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("SeatChoiceSchema", () => {
  it("accepts first and second only", () => {
    expect(SeatChoiceSchema.safeParse("first").success).toBe(true);
    expect(SeatChoiceSchema.safeParse("second").success).toBe(true);
    expect(SeatChoiceSchema.safeParse("third").success).toBe(false);
  });
});

describe("CreateRoomBodySchema", () => {
  it("accepts timer in [60, 900]", () => {
    expect(CreateRoomBodySchema.safeParse({ timer: { perMoveSeconds: 60 } }).success).toBe(true);
    expect(CreateRoomBodySchema.safeParse({ timer: { perMoveSeconds: 900 } }).success).toBe(true);
  });
  it("rejects timer outside bounds", () => {
    expect(CreateRoomBodySchema.safeParse({ timer: { perMoveSeconds: 59 } }).success).toBe(false);
    expect(CreateRoomBodySchema.safeParse({ timer: { perMoveSeconds: 901 } }).success).toBe(false);
  });
});

describe("PreJoinRoomInfoSchema", () => {
  it("parses a valid pre-join info", () => {
    const r = PreJoinRoomInfoSchema.safeParse({
      perMoveSeconds: 300,
      creatorDisplayName: "Alice",
      usable: true,
      reason: "ok",
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown reason", () => {
    expect(
      PreJoinRoomInfoSchema.safeParse({
        perMoveSeconds: 300,
        creatorDisplayName: "Alice",
        usable: false,
        reason: "unknown_reason",
      }).success,
    ).toBe(false);
  });
});

describe("RoomSnapshotSchema", () => {
  const validYou = {
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
  };

  it("parses a minimal valid snapshot", () => {
    const snap = {
      roomId: "r1",
      status: "open",
      closedReason: null,
      closedByUserId: null,
      perMoveSeconds: 300,
      createdAt: 0,
      roomDeadlineAt: 999,
      serverNow: 100,
      joinToken: "tok",
      you: validYou,
      opponent: null,
      flip: null,
      seats: null,
    };
    expect(RoomSnapshotSchema.safeParse(snap).success).toBe(true);
  });
});

describe("RoomServerMessageSchema", () => {
  it("parses a ROOM_STATE message", () => {
    const msg = {
      type: "ROOM_STATE",
      snapshot: {
        roomId: "r1",
        status: "open",
        closedReason: null,
        closedByUserId: null,
        perMoveSeconds: 300,
        createdAt: 0,
        roomDeadlineAt: 999,
        serverNow: 100,
        joinToken: null,
        you: {
          role: "opponent",
          userId: "u2",
          displayName: "Bob",
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
      },
    };
    expect(RoomServerMessageSchema.safeParse(msg).success).toBe(true);
  });
});

describe("SeatCredentialSchema", () => {
  it("parses a valid seat credential", () => {
    expect(SeatCredentialSchema.safeParse({ seat: 0, seatToken: "tok-xyz" }).success).toBe(true);
    expect(SeatCredentialSchema.safeParse({ seat: 1, seatToken: "tok-abc" }).success).toBe(true);
    expect(SeatCredentialSchema.safeParse({ seat: 2, seatToken: "tok" }).success).toBe(false);
  });
});

describe("CreateRoomResultSchema", () => {
  it("parses a valid result", () => {
    expect(CreateRoomResultSchema.safeParse({ roomId: "r1", joinToken: "tok" }).success).toBe(true);
  });
});

// Presence and role schemas
describe("RoomPresenceSchema / OccupantRoleSchema", () => {
  it("presence: connected/away/left only", () => {
    for (const p of ["connected", "away", "left"]) {
      expect(RoomPresenceSchema.safeParse(p).success).toBe(true);
    }
    expect(RoomPresenceSchema.safeParse("offline").success).toBe(false);
  });
  it("role: creator/opponent only", () => {
    expect(OccupantRoleSchema.safeParse("creator").success).toBe(true);
    expect(OccupantRoleSchema.safeParse("opponent").success).toBe(true);
    expect(OccupantRoleSchema.safeParse("spectator").success).toBe(false);
  });
});
