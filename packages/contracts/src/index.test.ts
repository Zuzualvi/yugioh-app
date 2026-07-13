import { describe, expect, it } from "vitest";
import {
  CardDTOSchema,
  DeckBodySchema,
  DeckValidationSchema,
  RedeemInviteBodySchema,
  UserSchema,
  ViolationSchema,
} from "./index.js";

describe("contracts — Zod schemas", () => {
  it("CardDTOSchema accepts a valid monster", () => {
    const result = CardDTOSchema.safeParse({
      passcode: 12345678,
      name: "Test Monster",
      frame: "effect",
      isExtraDeck: false,
      race: "Warrior",
      attribute: "DARK",
      level: 4,
      atk: 1800,
      def: 1200,
      desc: "A test monster effect.",
      banlist: "unlimited",
      aliasOf: null,
      imageId: 12345678,
    });
    expect(result.success).toBe(true);
  });

  it("CardDTOSchema rejects unknown frame", () => {
    const result = CardDTOSchema.safeParse({
      passcode: 12345678,
      name: "Test",
      frame: "xyz",
      isExtraDeck: false,
      race: "",
      attribute: null,
      level: null,
      atk: null,
      def: null,
      desc: "",
      banlist: "unlimited",
      aliasOf: null,
      imageId: 12345678,
    });
    expect(result.success).toBe(false);
  });

  it("UserSchema accepts admin and member", () => {
    expect(UserSchema.safeParse({ id: "u1", displayName: "Alice", role: "admin" }).success).toBe(
      true,
    );
    expect(UserSchema.safeParse({ id: "u2", displayName: "Bob", role: "member" }).success).toBe(
      true,
    );
  });

  it("RedeemInviteBodySchema requires password length ≥ 8", () => {
    expect(
      RedeemInviteBodySchema.safeParse({
        inviteCode: "abc",
        displayName: "Alice",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      RedeemInviteBodySchema.safeParse({
        inviteCode: "abc",
        displayName: "Alice",
        password: "longenough",
      }).success,
    ).toBe(true);
  });

  it("ViolationSchema accepts all fixed codes", () => {
    const codes = [
      "main_size",
      "extra_size",
      "side_size",
      "copy_limit",
      "banlist_forbidden",
      "banlist_limit",
      "out_of_pool",
      "wrong_zone",
      "unknown_passcode",
      "parse_error",
    ];
    for (const code of codes) {
      expect(ViolationSchema.safeParse({ code, message: "test" }).success).toBe(true);
    }
  });

  it("DeckValidationSchema requires violations array", () => {
    const result = DeckValidationSchema.safeParse({
      legal: true,
      counts: { main: 40, extra: 0, side: 0 },
      violations: [],
    });
    expect(result.success).toBe(true);
  });

  it("DeckBodySchema validates deck body", () => {
    expect(
      DeckBodySchema.safeParse({ name: "My Deck", main: [12345678], extra: [], side: [] }).success,
    ).toBe(true);
    expect(DeckBodySchema.safeParse({ name: "", main: [], extra: [], side: [] }).success).toBe(
      false,
    );
  });
});
